import { MangaModel } from '../models/manga';
import type { Manga } from '../models/manga';
import { mangadex, fetchChapterPages } from '../mangadex';
import { logger } from '../utils/logger';
import { initDB, waitForConnection } from '../config/database';
import axios from 'axios';
import { config } from '../config/config';

interface SearchOptions {
  offset?: number;
  limit?: number;
  includes?: string[];
  translatedLanguage?: string[];
  order?: {
    [key: string]: string;
  };
  contentRating?: string[];
}

class MangaService {
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private readonly MAX_INIT_RETRIES = 3;
  private readonly INIT_TIMEOUT = 30000; // 30 seconds

  constructor() {
    // Initialize will be called before any operation
    this.initialize();
  }

  private async initialize() {
    if (this.isInitialized) {
      return;
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    let retries = 0;
    while (retries < this.MAX_INIT_RETRIES) {
      try {
        this.initializationPromise = this.initializeInternal();
        await this.initializationPromise;
        this.isInitialized = true;
        logger.info('MangaService initialized successfully');
        return;
      } catch (error) {
        retries++;
        logger.error(`Failed to initialize MangaService (attempt ${retries}/${this.MAX_INIT_RETRIES}):`, error);
        if (retries === this.MAX_INIT_RETRIES) {
          throw error;
        }
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      } finally {
        this.initializationPromise = null;
      }
    }
  }

  private async initializeInternal() {
    // Initialize database connection
    await initDB();
    
    // Wait for connection to be ready
    const isConnected = await waitForConnection(this.INIT_TIMEOUT);
    if (!isConnected) {
      throw new Error('Timed out waiting for database connection');
    }
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  async saveManga(mangaData: any, chaptersCount = 0): Promise<Manga> {
    try {
      // Ensure database is initialized before proceeding
      await this.ensureInitialized();
      
      logger.info('Starting manga save process', { mangaId: mangaData.id });

      // Extract basic manga info
      const mangaDoc = {
        mangadexId: mangaData.id,
        title: mangaData.attributes.title.en || Object.values(mangaData.attributes.title)[0],
        description: mangaData.attributes.description.en || Object.values(mangaData.attributes.description)[0],
        status: mangaData.attributes.status,
        contentRating: mangaData.attributes.contentRating,
        tags: mangaData.attributes.tags
          .filter((tag: any) => tag.attributes.group === 'genre')
          .map((tag: any) => tag.attributes.name.en),
        createdAt: new Date(mangaData.attributes.createdAt),
        updatedAt: new Date(mangaData.attributes.updatedAt),
        coverUrl: ''
      };

      const coverArt = mangaData.relationships.find((rel: any) => rel.type === 'cover_art');
      const coverFileName = coverArt?.attributes?.fileName;
      mangaDoc.coverUrl = coverFileName
        ? `https://uploads.mangadex.org/covers/${mangaData.id}/${coverFileName}`
        : DEFAULT_COVER_URL;

      // Find existing manga
      const existingManga = await MangaModel.findOne({ mangadexId: mangaData.id });
      
      if (existingManga) {
        logger.info('Updating existing manga', { mangaId: mangaData.id });
        // Update only missing or changed fields
        const updates: any = {};
        
        for (const [key, value] of Object.entries(mangaDoc)) {
          if (!(existingManga as any)[key] || JSON.stringify((existingManga as any)[key]) !== JSON.stringify(value)) {
            updates[key] = value;
          }
        }

        // Update chapters if they don't exist
        if (!existingManga.chapters?.length) {
          logger.info('Fetching chapters for manga', { mangaId: mangaData.id });
          const chaptersResponse = await mangadex.getMangaChapters(mangaData.id);
          if (chaptersResponse.length > 0) {
            updates.chapters = chaptersResponse.map((chapter: any) => ({
              chapterId: chapter.id,
              number: chapter.attributes.chapter,
              title: chapter.attributes.title,
              volume: chapter.attributes.volume,
              pages: [], // Will be populated on-demand
              publishedAt: new Date(chapter.attributes.publishAt)
            }));
          }
        }

        // Apply updates if there are any
        if (Object.keys(updates).length > 0) {
          logger.info('Applying updates to manga', { 
            mangaId: mangaData.id,
            updatedFields: Object.keys(updates)
          });
          const updatedManga = await MangaModel.findOneAndUpdate(
            { mangadexId: mangaData.id },
            { $set: updates },
            { new: true }
          );
          if (!updatedManga) {
            throw new Error(`Failed to update manga with id: ${mangaData.id}`);
          }
          logger.success('Saved manga', {
            mangaId: mangaData.id,
            title: mangaData.title,
            chaptersCount
          });
          return updatedManga;
        }

        return existingManga;
      } else {
        logger.info('Creating new manga entry', { mangaId: mangaData.id });
        // Create new manga with all data
        const coverArt = mangaData.relationships.find((rel: any) => rel.type === 'cover_art');
        const coverFileName = coverArt?.attributes?.fileName || '';
        const coverUrl = coverFileName ? 
          `https://uploads.mangadex.org/covers/${mangaData.id}/${coverFileName}` :
          DEFAULT_COVER_URL;

        const authors = mangaData.relationships
          .filter((rel: any) => rel.type === 'author')
          .map((author: any) => author.attributes?.name || 'Unknown');

        const artists = mangaData.relationships
          .filter((rel: any) => rel.type === 'artist')
          .map((artist: any) => artist.attributes?.name || 'Unknown');

        // Fetch chapters
        logger.info('Fetching chapters for new manga', { mangaId: mangaData.id });
        const chaptersResponse = await mangadex.getMangaChapters(mangaData.id);
        let chapters: Array<{
          chapterId: string;
          number: string;
          title: string | null;
          volume: string | null;
          pages: string[];
          publishedAt: Date;
        }> = [];
        
        if (chaptersResponse.length > 0) {
          chapters = chaptersResponse.map((chapter: any) => ({
            chapterId: chapter.id,
            number: chapter.attributes.chapter,
            title: chapter.attributes.title,
            volume: chapter.attributes.volume,
            pages: [], // Will be populated on-demand
            publishedAt: new Date(chapter.attributes.publishAt)
          }));
        }

        const newManga = new MangaModel({
          ...mangaDoc,
          coverUrl,
          coverFileName,
          authors,
          artists,
          chapters
        });

        logger.success('Successfully created new manga', { 
          mangaId: mangaData.id,
          chaptersCount
        });
        return newManga.save();
      }
    } catch (error) {
      logger.error('Error saving manga:', error);
      throw error;
    }
  }

  async getManga(id: string): Promise<Manga | null> {
    try {
      await this.ensureInitialized();
      logger.info('Fetching manga', { mangaId: id });
      // Try to find manga in database
      const manga = await MangaModel.findOne({ mangadexId: id });
      
      if (!manga) {
        logger.info('Manga not found in database, fetching from API', { mangaId: id });
        // If not found in database, fetch from MangaDex API
        const response = await mangadex.getManga(id);
        
        if (response.result === 'error') {
          logger.error('MangaDex API error:', response.errors);
          return null;
        }
        
        // Save to database and return
        return this.saveManga(response.data);
      }
      
      logger.info('Manga found in database', { 
        mangaId: id, 
        title: manga.title,
        chaptersCount: manga.chapters?.length || 0 
      });
      return manga;
    } catch (error) {
      logger.error('Error getting manga:', error);
      return null;
    }
  }

  async getPopularManga(limit: number = 20, offset: number = 0): Promise<Manga[]> {
    try {
      await this.ensureInitialized();
      logger.info('Fetching popular manga', { limit, offset });
      const manga = await MangaModel.find()
        .sort({ updatedAt: -1 })
        .skip(offset)
        .limit(limit);

      logger.info('Popular manga fetched', { count: manga.length });
      return manga;
    } catch (error) {
      logger.error('Error fetching popular manga:', error);
      return [];
    }
  }

  async searchManga(query: string, limit: number = 20, offset: number = 0): Promise<Manga[]> {
    try {
      await this.ensureInitialized();
      logger.info('Searching manga', { query, limit, offset });
      const manga = await MangaModel.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { authors: { $regex: query, $options: 'i' } },
          { tags: { $regex: query, $options: 'i' } }
        ]
      })
      .skip(offset)
      .limit(limit);

      logger.info('Search completed', { 
        query,
        resultsCount: manga.length 
      });
      return manga;
    } catch (error) {
      logger.error('Error searching manga:', error);
      return [];
    }
  }

  async getMangaDetails(id: string): Promise<any> {
    try {
      await this.ensureInitialized();
      logger.info('Fetching complete manga details', { mangaId: id });

      // Get basic manga data
      const mangaResponse = await mangadex.getManga(id);
      if (mangaResponse.result === 'error' || !mangaResponse.data) {
        throw new Error('Failed to fetch manga details');
      }

      // Get manga statistics (ratings, follows)
      const statsResponse = await axios.get(`${config.api.mangadex.baseUrl}/statistics/manga/${id}`);
      const statistics = statsResponse.data.statistics[id];

      // Get aggregate chapters data
      const aggregateResponse = await axios.get(
        `${config.api.mangadex.baseUrl}/manga/${id}/aggregate`,
        { params: { translatedLanguage: ['en'] } }
      );

      // Extract cover art
      const coverArt = mangaResponse.data.relationships.find(
        (rel: any) => rel.type === 'cover_art'
      );
      const coverFileName = coverArt?.attributes?.fileName;
      const coverUrl = coverFileName ? 
        `https://uploads.mangadex.org/covers/${id}/${coverFileName}` : 
        null;

      // Extract authors and artists
      const authors = mangaResponse.data.relationships
        .filter((rel: any) => rel.type === 'author')
        .map((author: any) => author.attributes?.name)
        .filter(Boolean);

      const artists = mangaResponse.data.relationships
        .filter((rel: any) => rel.type === 'artist')
        .map((artist: any) => artist.attributes?.name)
        .filter(Boolean);

      // Combine all data
      const mangaDetails = {
        id: mangaResponse.data.id,
        type: mangaResponse.data.type,
        attributes: {
          ...mangaResponse.data.attributes,
          statistics: {
            rating: {
              average: statistics?.rating?.average || null,
              bayesian: statistics?.rating?.bayesian || null,
              distribution: statistics?.rating?.distribution || {},
            },
            follows: statistics?.follows || 0,
            comments: statistics?.comments || { threadId: null, repliesCount: 0 }
          },
          chapters: aggregateResponse.data.volumes,
          coverUrl,
          authors,
          artists
        }
      };

      logger.success('Successfully fetched manga details', { 
        mangaId: id,
        title: mangaDetails.attributes.title.en || Object.values(mangaDetails.attributes.title)[0]
      });

      return mangaDetails;
    } catch (error) {
      logger.error('Error fetching manga details:', error);
      throw error;
    }
  }

  async getChapterDetails(chapterId: string): Promise<any> {
    try {
      await this.ensureInitialized();
      logger.info('Fetching chapter details', { chapterId });

      // Get chapter data
      const response = await axios.get(
        `${config.api.mangadex.baseUrl}/chapter/${chapterId}`,
        {
          params: {
            includes: ['scanlation_group', 'user', 'manga']
          }
        }
      );

      if (response.data.result === 'error') {
        throw new Error('Failed to fetch chapter details');
      }

      // Get chapter pages
      const pages = await mangadex.getChapterPages(chapterId);

      // Get chapter statistics
      const statsResponse = await axios.get(`${config.api.mangadex.baseUrl}/statistics/chapter/${chapterId}`);
      const statistics = statsResponse.data.statistics[chapterId];

      // Extract scanlation group
      const group = response.data.relationships.find(
        (rel: any) => rel.type === 'scanlation_group'
      );

      const chapterDetails = {
        id: response.data.data.id,
        type: response.data.data.type,
        attributes: {
          ...response.data.data.attributes,
          pages,
          statistics: {
            comments: statistics?.comments || { threadId: null, repliesCount: 0 }
          },
          group: group?.attributes?.name || 'No Group'
        }
      };

      logger.success('Successfully fetched chapter details', { 
        chapterId,
        title: chapterDetails.attributes.title || `Chapter ${chapterDetails.attributes.chapter}`
      });

      return chapterDetails;
    } catch (error) {
      logger.error('Error fetching chapter details:', error);
      throw error;
    }
  }

  async getChapterPages(chapterId: string): Promise<string[]> {
    logger.debug('Fetching chapter pages', { chapterId });
    try {
      return await mangadex.getChapterPages(chapterId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to fetch chapter pages', { error: errorMessage, chapterId });
      throw new Error(`Unable to retrieve pages for chapter ${chapterId}: ${errorMessage}`);
    }
  }

async saveChapterPages(chapterId: string, pages: string[]): Promise<void> {
  if (!chapterId) {
    logger.warn('Attempted to save pages with undefined chapterId');
      return;
    }
    try {
      await MangaModel.updateOne(
        { 'chapters.chapterId': chapterId },
        { 
          $set: { 
            'chapters.$.pages': pages 
          }
        }
      );
      logger.info(`Saved ${pages.length} pages for chapter ${chapterId}`);
    } catch (error) {
      logger.error('Failed to save chapter pages', { error, chapterId });
    }
  }

  async updateMissingChapters(mangaId: string): Promise<void> {
    await this.ensureInitialized();
    logger.info('Updating missing chapters', { mangaId });

    // Fetch full chapter list from MangaDex
    const chaptersResponse = await mangadex.getMangaChapters(mangaId);

    // Get stored manga
    const storedManga = await MangaModel.findOne({ mangadexId: mangaId });
    if (!storedManga) {
      logger.warn('Manga not found in DB, skipping', { mangaId });
      return;
    }

    // Compare DB chapters with the new list
    interface StoredChapter {
      chapterId: string;
      number: string;
      title: string | null;
      volume: string | null;
      pages: string[];
      publishedAt: Date;
    }

    const existingChapterIds: string[] = (storedManga.chapters || [] as StoredChapter[]).map((ch: StoredChapter) => ch.chapterId);
    const missingChapters = chaptersResponse.filter(ch => !existingChapterIds.includes(ch.id));

    if (missingChapters.length > 0) {
      // For each missing chapter, fetch pages and upsert
      const newChapters = [];
      for (const chapter of missingChapters) {
        const pages: string[] = await mangadex.getChapterPages(chapter.id);
        newChapters.push({
          chapterId: chapter.id,
          number: chapter.attributes.chapter,
          title: chapter.attributes.title,
          volume: chapter.attributes.volume,
          pages,
          publishedAt: new Date(chapter.attributes.publishAt)
        });
      }

      logger.info('Adding missing chapters', { count: newChapters.length, mangaId });
      await MangaModel.updateOne(
        { mangadexId: mangaId },
        { $push: { chapters: { $each: newChapters } } }
      );
    }
  }
}

export const mangaService = new MangaService();

export async function getChapterPages(chapterId: string) {
  const response = await fetch(`https://api.mangadex.org/chapter/${chapterId}/pages`);
  if (!response.ok) {
    throw new Error(`Failed to fetch pages for chapter ${chapterId}`);
  }
  const data = await response.json();
  return data.pages || [];
}

export async function getAtHomeServerData(chapterId: string, useDataSaver = false): Promise<string[]> {
  const res = await fetch(`https://api.mangadex.org/at-home/server/${chapterId}`);
  if (!res.ok) {
    throw new Error(`Failed to get at-home server data for chapter ${chapterId}`);
  }
  const json = await res.json();
  const baseUrl = json.baseUrl;
  const hash = json.chapter.hash;
  const files = useDataSaver ? json.chapter.dataSaver : json.chapter.data;
  return files.map((filename: string) =>
    `${baseUrl}/${useDataSaver ? 'data-saver' : 'data'}/${hash}/${filename}`
  );
}

const DEFAULT_COVER_URL = 'https://placeholder.moe/i/500x700.png?text=No+Cover';