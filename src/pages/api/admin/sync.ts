import type { APIRoute } from 'astro';
import { mangadex } from '../../../lib/mangadex';
import { initDB } from '../../../lib/config/database';
import { MangaModel } from '../../../lib/models/manga';
import { dataLoader } from '../../../lib/dataLoader';
import { logger } from '../../../lib/utils/logger';

export const POST: APIRoute = async ({ request }) => {
  try {
    await initDB();
    const { offset = 0, limit = 10 } = await request.json();
    const results = [];

    // Get manga list from MangaDex
    const mangaList = await mangadex.getUpdatedManga(offset, limit);
    console.log(`Found ${mangaList.data.length} manga to sync`);

    const mangaCollection = MangaModel.collection;

    // Process each manga
    for (const mangaData of mangaList.data) {
      try {
        // Get full manga details
        const manga = await mangadex.getManga(mangaData.id);
        const mangaDetails = manga.data;

        // Get cover art
        const coverArt = mangaDetails.relationships.find(rel => rel.type === 'cover_art');
        const coverUrl = coverArt ? 
          mangadex.getCoverArtUrl(
            mangaData.id, 
            coverArt.id, 
            coverArt.attributes?.fileName || ''
          ) : '';

        // Get author
        const author = mangaDetails.relationships.find(rel => rel.type === 'author');
        const authorName = author?.attributes?.name || 'Unknown';

        // Get chapters
        const chapters = await mangadex.getMangaChapters(mangaData.id);
        
        // Convert to our Manga type
        const mangaDoc = {
          mangadexId: mangaData.id,
          title: mangaDetails.attributes.title.en || Object.values(mangaDetails.attributes.title)[0],
          description: mangaDetails.attributes.description.en || Object.values(mangaDetails.attributes.description)[0],
          coverUrl,
          author: authorName,
          status: mangaDetails.attributes.status,
          contentRating: mangaDetails.attributes.contentRating,
          tags: mangaDetails.attributes.tags
            .filter(tag => tag.attributes.group === 'genre')
            .map(tag => tag.attributes.name.en),
          chapters: chapters.map(chapter => ({
            chapterId: chapter.id,
            number: parseFloat(chapter.attributes.chapter || '0'),
            title: chapter.attributes.title || `Chapter ${chapter.attributes.chapter}`,
            pages: [], // Will be populated on-demand
            uploadDate: new Date(chapter.attributes.publishAt),
          })),
          createdAt: new Date(mangaDetails.attributes.createdAt),
          updatedAt: new Date(mangaDetails.attributes.updatedAt),
        };

        // Check if manga already exists
        const existingManga = await mangaCollection.findOne({ mangadexId: mangaDoc.mangadexId });
        
        if (existingManga) {
          // Update existing manga
          await mangaCollection.updateOne(
            { _id: existingManga._id },
            { 
              $set: {
                description: mangaDoc.description,
                coverUrl: mangaDoc.coverUrl,
                author: mangaDoc.author,
                status: mangaDoc.status,
                tags: mangaDoc.tags,
                chapters: mangaDoc.chapters,
                updatedAt: new Date()
              }
            }
          );
          console.log(`Updated manga: ${mangaDoc.title}`);
        } else {
          // Insert new manga
          await mangaCollection.insertOne(mangaDoc);
          console.log(`Added new manga: ${mangaDoc.title}`);
        }

        results.push({
          title: mangaDoc.title,
          chaptersCount: mangaDoc.chapters.length,
          status: 'success'
        });
      } catch (error) {
        console.error(`Error processing manga ${mangaData.id}:`, error);
        results.push({
          id: mangaData.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${results.length} manga`,
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
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Failed to sync manga',
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

export const GET: APIRoute = async () => {
  try {
    logger.info('Starting full sync via admin endpoint');
    await dataLoader.loadAllMangaFromAPI();
    return new Response(JSON.stringify({ message: 'Data load completed successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    logger.error('Error during admin sync:', error);
    return new Response(JSON.stringify({ error: 'Data load failed', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}