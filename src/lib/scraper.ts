import axios from 'axios';
import * as cheerio from 'cheerio';
import { connectDB, closeDB } from './db';
import type { Manga } from '../types/manga';
import { setTimeout } from 'timers/promises';

const BASE_URL = 'https://mangafire.to';
const RATE_LIMIT_MS = 2000; // 2 seconds between requests
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface ScrapedManga {
  title: string;
  coverImage: string;
  description: string;
  author: string;
  status: 'ongoing' | 'completed' | 'hiatus';
  genres: string[];
  chapters: {
    chapterNumber: number;
    title: string;
    url: string;
  }[];
}

class MangaScraper {
  private lastRequestTime: number = 0;

  private async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_MS) {
      await setTimeout(RATE_LIMIT_MS - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();
  }

  private async fetchPage(url: string) {
    await this.rateLimit();
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
        }
      });
      return cheerio.load(response.data);
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  }

  async scrapeMangaList(page: number = 1): Promise<string[]> {
    try {
      const $ = await this.fetchPage(`${BASE_URL}/home?page=${page}`);
      const mangaUrls: string[] = [];

      // Extract manga URLs from the page
      $('.manga-item a').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          mangaUrls.push(BASE_URL + href);
        }
      });

      return mangaUrls;
    } catch (error) {
      console.error('Error scraping manga list:', error);
      return [];
    }
  }

  async scrapeMangaDetails(url: string): Promise<ScrapedManga | null> {
    try {
      const $ = await this.fetchPage(url);

      // Extract manga details
      const title = $('.manga-title').text().trim();
      const coverImage = $('.manga-cover img').attr('src') || '';
      const description = $('.manga-description').text().trim();
      const author = $('.manga-author').text().trim();
      const status = $('.manga-status').text().trim().toLowerCase() as 'ongoing' | 'completed' | 'hiatus';
      
      const genres: string[] = [];
      $('.manga-genres .genre').each((_, element) => {
        genres.push($(element).text().trim());
      });

      const chapters: ScrapedManga['chapters'] = [];
      $('.chapter-list .chapter-item').each((_, element) => {
        const chapterTitle = $(element).find('.chapter-title').text().trim();
        const chapterUrl = $(element).find('a').attr('href') || '';
        const chapterNumber = parseFloat(chapterTitle.match(/Chapter (\d+)/)?.[1] || '0');

        chapters.push({
          chapterNumber,
          title: chapterTitle,
          url: BASE_URL + chapterUrl,
        });
      });

      return {
        title,
        coverImage,
        description,
        author,
        status,
        genres,
        chapters,
      };
    } catch (error) {
      console.error(`Error scraping manga details from ${url}:`, error);
      return null;
    }
  }

  async scrapeChapterPages(url: string): Promise<string[]> {
    try {
      const $ = await this.fetchPage(url);
      const pages: string[] = [];

      $('.chapter-images img').each((_, element) => {
        const imageUrl = $(element).attr('src');
        if (imageUrl) {
          pages.push(imageUrl);
        }
      });

      return pages;
    } catch (error) {
      console.error(`Error scraping chapter pages from ${url}:`, error);
      return [];
    }
  }

  async saveMangaToDatabase(manga: ScrapedManga) {
    try {
      const db = await connectDB();
      const mangaCollection = db.collection<Manga>('manga');

      // Convert ScrapedManga to Manga type
      const mangaDoc: Manga = {
        title: manga.title,
        description: manga.description,
        coverImage: manga.coverImage,
        author: manga.author,
        status: manga.status,
        genres: manga.genres,
        chapters: manga.chapters.map(chapter => ({
          mangaId: '', // Will be set after insertion
          chapterNumber: chapter.chapterNumber,
          title: chapter.title,
          pages: [], // Will be populated later
          uploadDate: new Date(),
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Check if manga already exists
      const existingManga = await mangaCollection.findOne({ title: manga.title });
      
      if (existingManga) {
        // Update existing manga
        await mangaCollection.updateOne(
          { _id: existingManga._id },
          { 
            $set: {
              description: manga.description,
              coverImage: manga.coverImage,
              author: manga.author,
              status: manga.status,
              genres: manga.genres,
              chapters: mangaDoc.chapters,
              updatedAt: new Date()
            }
          }
        );
        return existingManga._id;
      } else {
        // Insert new manga
        const result = await mangaCollection.insertOne(mangaDoc);
        return result.insertedId;
      }
    } catch (error) {
      console.error('Error saving manga to database:', error);
      throw error;
    } finally {
      await closeDB();
    }
  }

  async updateChapterPages(mangaId: string, chapterNumber: number, pages: string[]) {
    try {
      const db = await connectDB();
      const mangaCollection = db.collection<Manga>('manga');

      await mangaCollection.updateOne(
        { _id: mangaId, 'chapters.chapterNumber': chapterNumber },
        {
          $set: {
            'chapters.$.pages': pages,
            updatedAt: new Date()
          }
        }
      );
    } catch (error) {
      console.error('Error updating chapter pages:', error);
      throw error;
    } finally {
      await closeDB();
    }
  }
}

export const scraper = new MangaScraper(); 