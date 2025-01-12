import { mangaService } from './services/mangaService';
import { mangadex } from './mangadex';
import { logger } from './utils/logger';
import { config } from './config/config';

interface LoadingProgress {
  current: number;
  total: number;
  isLoading: boolean;
  loadedCount: number;
  failedCount: number;
  lastError?: string;
}

function broadcastProgress(eventData: any) {
  const clients = globalThis.__SSE_CLIENTS__ || [];
  clients.forEach((res: any) => {
    res.write(`event: progress\n`);
    res.write(`data: ${JSON.stringify(eventData)}\n\n`);
  });
}

export class DataLoader {
  private readonly BATCH_SIZE = config.api.mangadex.batchSize;
  private readonly DELAY_BETWEEN_BATCHES = config.api.mangadex.delayBetweenBatches;
  private progress: LoadingProgress = {
    current: 0,
    total: 100,
    isLoading: false,
    loadedCount: 0,
    failedCount: 0
  };

  getProgress(): LoadingProgress {
    return { ...this.progress };
  }

  async loadAllMangaFromAPI() {
    if (this.progress.isLoading) {
      logger.warn('Data load already in progress');
      throw new Error('Data load already in progress');
    }

    try {
      this.progress = {
        current: 0,
        total: 100,
        isLoading: true,
        loadedCount: 0,
        failedCount: 0
      };

      logger.info('Starting manga data load');
      let offset = 0;
      let hasMore = true;
      let retryCount = 0;
      const MAX_RETRIES = config.api.mangadex.maxRetries;

      while (hasMore && retryCount < MAX_RETRIES) {
        try {
          const response = await mangadex.getPopularManga(offset, this.BATCH_SIZE);
          
          if (!response.data || response.data.length === 0) {
            hasMore = false;
            continue;
          }

          logger.info(`Processing batch of ${response.data.length} manga`, { offset });

          const concurrency = 10;
          const tasks: Promise<void>[] = [];
          
          for (const mangaData of response.data) {
            tasks.push((async () => {
              try {
                const chapters = await mangadex.getMangaChapters(mangaData.id);
                await mangaService.saveManga(mangaData, chapters.length);
                
                // Fetch and save pages for each chapter
                for (const chapter of chapters) {
                  const chapterId = chapter.id; // Changed from chapter.chapterId to chapter.id
                  if (!chapterId) {
                    logger.warn('Chapter ID is undefined', { chapter });
                    continue;
                  }
                  try {
                    const pages = await mangaService.getChapterPages(chapterId);
                    await mangaService.saveChapterPages(chapterId, pages);
                  } catch (error: any) {
                    this.progress.failedCount++;
                    this.progress.lastError = error.message;
                    logger.error('Failed to fetch or save chapter pages', { error: error.message, chapterId });
                    broadcastProgress({
                      manga: mangaData.attributes.title.en,
                      updatedChapters: chapters.length,
                      status: `Error fetching pages for chapter ${chapterId}`
                    });
                    // ...existing error handling...
                  }
                }

                this.progress.loadedCount++;
                logger.success('Saved manga', { 
                  mangaId: mangaData.id,
                  title: mangaData.attributes.title.en 
                });
                broadcastProgress({
                  manga: mangaData.attributes.title.en,
                  updatedChapters: chapters.length,
                  status: 'updating...'
                });
              } catch (error: any) {
                this.progress.failedCount++;
                this.progress.lastError = error.message;
                logger.error('Failed to save manga', { 
                  mangaId: mangaData.id,
                  error: error.message 
                });
              }
            })());

            if (tasks.length >= concurrency) {
              await Promise.all(tasks);
              tasks.length = 0;
            }
          }

          if (tasks.length > 0) {
            await Promise.all(tasks);
          }

          offset += response.data.length;
          retryCount = 0; // Reset retry count on successful batch

          // Update progress percentage
          this.progress.current = Math.min(100, Math.floor((offset / 1000) * 100));
          this.progress.total = Math.max(this.progress.total, offset);

          // Add delay between batches
          await new Promise(resolve => setTimeout(resolve, this.DELAY_BETWEEN_BATCHES));
        } catch (error: unknown) {
          retryCount++;
          this.progress.lastError = (error instanceof Error) ? error.message : 'Unknown error';
          logger.error(`Batch failed (attempt ${retryCount}/${MAX_RETRIES})`, { 
            offset,
            error: this.progress.lastError 
          });
          
          // Wait longer between retries
          await new Promise(resolve => setTimeout(resolve, this.DELAY_BETWEEN_BATCHES * 2));
        }
      }

      logger.success('Completed manga data load', { 
        totalProcessed: offset,
        loaded: this.progress.loadedCount,
        failed: this.progress.failedCount
      });
    } catch (error: unknown) {
      logger.error('Load all manga from API failed:', error);
      this.progress.lastError = (error instanceof Error) ? error.message : 'Unknown error';
      throw error;
    } finally {
      this.progress.isLoading = false;
    }
  }
}

export const dataLoader = new DataLoader();