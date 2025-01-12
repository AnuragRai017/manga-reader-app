import type { APIRoute } from 'astro';
import { mangadex } from '../../../lib/mangadex';
import { initDB } from '../../../lib/config/database';
import { MangaModel } from '../../../lib/models/manga';
import type { Manga } from '../../../types/manga';

export const POST: APIRoute = async ({ request }) => {
  try {
    await initDB();
    const { mangaId } = await request.json();
    
    if (!mangaId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Manga ID is required'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Get manga details
    const manga = await mangadex.getManga(mangaId);
    const mangaDetails = manga.data;

    // Get cover art
    const coverArt = mangaDetails.relationships.find(rel => rel.type === 'cover_art');
    const coverUrl = coverArt ? mangadex.getCoverArtUrl(mangaId, coverArt.id, coverArt.attributes?.fileName || '') : '';

    // Get author
    const author = mangaDetails.relationships.find(rel => rel.type === 'author');
    const authorName = author?.attributes?.name || 'Unknown';

    // Get chapters
    const chapters = await mangadex.getMangaChapters(mangaId);

    const mangaCollection = MangaModel.collection;

    // Check if manga already exists
    const existingManga = await mangaCollection.findOne({ mangadexId: mangaId });

    // Convert to our Manga type
    const mangaDoc: Manga = {
      _id: existingManga?._id || undefined,
      mangadexId: mangaId,
      title: mangaDetails.attributes.title.en || Object.values(mangaDetails.attributes.title)[0],
      description: mangaDetails.attributes.description.en || Object.values(mangaDetails.attributes.description)[0],
      coverUrl: coverUrl,
      authors: [authorName],
      artists: [authorName], // Assuming author is also the artist, adjust if needed
      status: mangaDetails.attributes.status,
      contentRating: mangaDetails.attributes.contentRating,
      tags: mangaDetails.attributes.tags
        .filter(tag => tag.attributes.group === 'genre')
        .map(tag => tag.attributes.name.en),
      chapters: chapters.map(chapter => ({
        mangaId: mangaId,
        chapterNumber: parseFloat(chapter.attributes.chapter || '0'),
        title: chapter.attributes.title || `Chapter ${chapter.attributes.chapter}`,
        pages: [], // Will be populated on-demand
        uploadDate: new Date(chapter.attributes.publishAt),
      })),
      createdAt: new Date(mangaDetails.attributes.createdAt),
      updatedAt: new Date()
    };

    // Update existing manga if found by mangadexId
    
    if (existingManga) {
      // Update existing manga
      await mangaCollection.updateOne(
        { _id: existingManga._id },
        { 
          $set: {
            description: mangaDoc.description,
            coverUrl: mangaDoc.coverUrl,
            authors: mangaDoc.authors,
            status: mangaDoc.status,
            tags: mangaDoc.tags,
            chapters: mangaDoc.chapters,
            updatedAt: new Date()
          }
        }
      );
    } else {
      // Insert new manga
      await mangaCollection.insertOne(mangaDoc);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully synced manga ${mangaDoc.title}`
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Retry sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Failed to retry manga sync',
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