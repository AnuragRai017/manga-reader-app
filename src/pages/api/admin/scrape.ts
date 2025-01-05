import type { APIRoute } from 'astro';
import { scraper } from '../../../lib/scraper';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { page = 1, maxPages = 1 } = await request.json();
    const results = [];

    for (let currentPage = page; currentPage <= maxPages; currentPage++) {
      // Get manga URLs from the current page
      const mangaUrls = await scraper.scrapeMangaList(currentPage);
      console.log(`Found ${mangaUrls.length} manga on page ${currentPage}`);

      // Process each manga
      for (const url of mangaUrls) {
        try {
          // Scrape manga details
          const manga = await scraper.scrapeMangaDetails(url);
          if (!manga) continue;

          // Save manga to database
          const mangaId = await scraper.saveMangaToDatabase(manga);
          console.log(`Saved manga: ${manga.title}`);

          // Scrape and save chapter pages
          for (const chapter of manga.chapters) {
            const pages = await scraper.scrapeChapterPages(chapter.url);
            if (pages.length > 0) {
              await scraper.updateChapterPages(mangaId.toString(), chapter.chapterNumber, pages);
              console.log(`Saved chapter ${chapter.chapterNumber} of ${manga.title}`);
            }
          }

          results.push({
            title: manga.title,
            chaptersCount: manga.chapters.length,
            status: 'success'
          });
        } catch (error) {
          console.error(`Error processing manga from ${url}:`, error);
          results.push({
            url,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Scraped ${results.length} manga`,
        results
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Scraping error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Failed to scrape manga',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}; 