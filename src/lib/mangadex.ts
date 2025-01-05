import 'dotenv/config';
import axios, { AxiosError } from 'axios';
import { logger } from './utils/logger';
import Bottleneck from 'bottleneck';

const BASE_URL = 'https://api.mangadex.org';
const MAX_RETRIES = 3;
const TIMEOUT = 20000; // 20 seconds

// Initialize rate limiter
const limiter = new Bottleneck({
  reservoir: 80, // Number of tokens
  reservoirRefreshAmount: 80,
  reservoirRefreshInterval: 60 * 1000, // Refresh every minute
  maxConcurrent: 5, // Maximum concurrent requests
  minTime: 750 // Minimum time between requests (in ms) => ~80 requests per minute
});

// Response type definitions
interface MangaDetailsResponse {
  result: 'ok' | 'error';
  data: {
    id: string;
    type: 'manga';
    attributes: {
      title: { [key: string]: string };
      altTitles: Array<{ [key: string]: string }>;
      description: { [key: string]: string };
      status: string;
      contentRating: string;
      tags: Array<{
        id: string;
        type: 'tag';
        attributes: {
          name: { [key: string]: string };
          group: string;
        };
      }>;
      createdAt: string;
      updatedAt: string;
    };
    relationships: Array<{
      id: string;
      type: string;
      attributes?: {
        name?: string;
        fileName?: string;
      };
    }>;
  };
  errors?: Array<{
    id: string;
    status: number;
    title: string;
    detail: string;
  }>;
}

interface PopularMangaResponse {
  data: Array<{
    id: string;
    attributes: {
      title: { [key: string]: string };
      description: { [key: string]: string };
      status: string;
      tags: any[];
    };
    relationships: Array<{
      id: string;
      type: string;
      attributes?: {
        name?: string;
        fileName?: string;
      };
    }>;
  }>;
  limit: number;
  offset: number;
  total: number;
}

interface MangaStatisticsResponse {
  statistics: {
    [mangaId: string]: {
      rating: {
        average: number | null;
        bayesian: number | null;
        follows: number;
      };
    };
  };
}

interface ChapterPagesResponse {
  result: 'ok' | 'error';
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];
    dataSaver: string[];
  };
}

interface SearchOptions {
  offset?: number;
  limit?: number;
  includes?: string[];
  title?: string;
  authors?: string[];
  artists?: string[];
  year?: number;
  includedTags?: string[];
  excludedTags?: string[];
  status?: string[];
  order?: {
    [key: string]: 'asc' | 'desc';
  };
}

export class MangaDexAPI {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private rateLimitRemaining: number = 0;
  private rateLimitResetTime: number = 0;
  private requiresAuth: boolean = false;

  constructor(
    private clientId: string = process.env.MANGADEX_CLIENT_ID || '',
    private clientSecret: string = process.env.MANGADEX_CLIENT_SECRET || ''
  ) {
    if (clientId && clientSecret) {
      this.requiresAuth = true;
    } else {
      console.warn('MangaDex API: No credentials provided, running in public mode');
      this.requiresAuth = false;
    }
  }

  private async retryRequest<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const axiosError = error as AxiosError;
      if (retries > 0 && (
        axiosError.code === 'ECONNRESET' ||
        axiosError.code === 'ETIMEDOUT' ||
        axiosError.code === 'ECONNABORTED' ||
        axiosError.message === 'socket hang up'
      )) {
        const waitTime = Math.min(1000 * Math.pow(2, MAX_RETRIES - retries), 10000);
        logger.warn(`Connection error, retrying in ${waitTime}ms... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.retryRequest(fn, retries - 1);
      }
      throw error;
    }
  }

  private async request<T>(endpoint: string, config: any = {}): Promise<T> {
    try {
      logger.info('Making API request', { endpoint, params: config.params });
      const url = `${BASE_URL}${endpoint}`;
      
      const axiosConfig = {
        ...config,
        timeout: TIMEOUT,
        family: 4,
        headers: {
          ...config.headers,
          'User-Agent': 'MangaReader/1.0',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
          'Connection': 'close'
        }
      };
      
      if (this.rateLimitRemaining <= 1) {
        const waitTime = Math.max(0, this.rateLimitResetTime - Date.now());
        logger.warn(`Rate limit almost exceeded, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      const response = await limiter.schedule(() => axios.get<T>(url, axiosConfig));

      this.rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining'] || '5');
      const resetTime = parseInt(response.headers['x-ratelimit-reset'] || '0');
      this.rateLimitResetTime = resetTime > 0 ? resetTime * 1000 : Date.now() + 1000;

      logger.info('API request successful', { 
        endpoint,
        rateLimitRemaining: this.rateLimitRemaining,
        resetIn: Math.max(0, this.rateLimitResetTime - Date.now())
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`API request error (${endpoint}):`, {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });

        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
          logger.warn('Rate limit exceeded, waiting to retry', { retryAfter, endpoint });
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          return this.request(endpoint, config);
        }

        if (error.code === 'ECONNABORTED' || error.code === 'EACCES' || error.code === 'ETIMEDOUT') {
          logger.warn('Connection error, retrying...', { endpoint, code: error.code });
          await new Promise(resolve => setTimeout(resolve, 5000));
          return this.request(endpoint, config);
        }
      }
      throw error;
    }
  }

  async searchManga(options: SearchOptions) {
    const params: any = {
      limit: options.limit || 10,
      offset: options.offset || 0,
      includes: ['cover_art', 'author', 'artist'],
    };

    if (options.title) params.title = options.title;
    if (options.authors?.length) params.authors = options.authors;
    if (options.artists?.length) params.artists = options.artists;
    if (options.year) params.year = options.year;
    if (options.includedTags?.length) params.includedTags = options.includedTags;
    if (options.excludedTags?.length) params.excludedTags = options.excludedTags;
    if (options.status?.length) params.status = options.status;
    if (options.order) params.order = options.order;

    return this.request<PopularMangaResponse>('/manga', { params });
  }

  async getPopularManga(offset: number = 0, limit: number = 10) {
    return this.request<PopularMangaResponse>('/manga', {
      params: {
        limit,
        offset,
        includes: ['cover_art', 'author', 'artist'],
        'order[followedCount]': 'desc'
      }
    });
  }

  async getManga(id: string) {
    try {
      const response = await this.request<MangaDetailsResponse>(`/manga/${id}`, {
        params: {
          includes: ['cover_art', 'author', 'artist', 'manga'],
          contentRating: ['safe', 'suggestive', 'erotica', 'pornographic']
        }
      });

      if (response.result === 'error') {
        console.error('MangaDex API error:', response.errors);
        throw new Error(response.errors?.[0]?.detail || 'Unknown error');
      }

      return response;
    } catch (error) {
      console.error('Error fetching manga:', error);
      throw error;
    }
  }

  async getUpdatedManga(offset = 0, limit = 100) {
    try {
      logger.info('Fetching updated manga list', { offset, limit });
      const response = await fetch(
        `${BASE_URL}/manga?limit=${limit}&offset=${offset}&order[updatedAt]=desc`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Error fetching updated manga:', error);
      throw error;
    }
  }

  async getMangaChapters(mangaId: string, offset = 0, limit = 100): Promise<any[]> {
    try {
      let allChapters: any[] = [];
      let hasMore = true;
      let currentOffset = offset;

      while (hasMore) {
        const response = await this.request<any>(`/manga/${mangaId}/feed`, {
          params: {
            limit,
            offset: currentOffset,
            translatedLanguage: ['en'],
            order: { chapter: 'asc' }, // Ensure chapters are fetched in order
            includes: ['scanlation_group'],
            contentRating: ['safe', 'suggestive', 'erotica', 'pornographic']
          }
        });

        if (response.result === 'error') {
          throw new Error('Failed to fetch manga chapters');
        }

        allChapters = allChapters.concat(response.data);

        // Check if there are more chapters to fetch
        if (response.data.length < limit) {
          hasMore = false;
        } else {
          currentOffset += limit;
        }
      }

      logger.info('All chapters fetched successfully', { mangaId, totalChapters: allChapters.length });
      return allChapters;
    } catch (error) {
      logger.error('Error fetching all manga chapters:', error);
      throw error;
    }
  }

  async getChapterPages(chapterId: string): Promise<string[]> {
    try {
      logger.info('Fetching chapter pages', { chapterId });
      const data = await this.request<ChapterPagesResponse>(`/at-home/server/${chapterId}`);
      
      if (data.result === 'error') {
        logger.error('Failed to fetch chapter pages', { chapterId });
        throw new Error('Failed to fetch chapter pages');
      }

      const { baseUrl, chapter } = data;
      const pages = chapter.data.map(page => 
        `${baseUrl}/data/${chapter.hash}/${page}`
      );

      logger.info('Chapter pages fetched successfully', { 
        chapterId,
        pageCount: pages.length 
      });
      return pages;
    } catch (error) {
      logger.error('Error fetching chapter pages:', error);
      throw error;
    }
  }

  getCoverArtUrl(mangaId: string, coverId: string, fileName: string) {
    return `https://uploads.mangadex.org/covers/${mangaId}/${fileName}`;
  }
}

// Create and export a singleton instance
export const mangadex = new MangaDexAPI(
  process.env.MANGADEX_CLIENT_ID || '',
  process.env.MANGADEX_CLIENT_SECRET || ''
);

export async function fetchChapterPages(chapterId: string, useDataSaver = false): Promise<string[]> {
  logger.debug('Fetching at-home server data for chapter', { chapterId });
  try {
    const response = await fetch(`https://api.mangadex.org/at-home/server/${chapterId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch at-home server data for chapter ${chapterId}`);
    }
    const json = await response.json();
    const baseUrl = json.baseUrl;
    const hash = json.chapter.hash;
    const pages = useDataSaver ? json.chapter.dataSaver : json.chapter.data;
    return pages.map((p: string) => `${baseUrl}/${useDataSaver ? 'data-saver' : 'data'}/${hash}/${p}`);
  } catch (error) {
    logger.error('Error in fetchChapterPages', { error, chapterId });
    throw error;
  }
}