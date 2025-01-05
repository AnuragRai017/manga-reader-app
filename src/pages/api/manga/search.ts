import type { APIRoute } from 'astro';
import { mangaService } from '../../../lib/services/mangaService';
import { initDB } from '../../../lib/config/database';
import { logger } from '../../../lib/utils/logger';

export const GET: APIRoute = async ({ request }) => {
  try {
    await initDB();
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    logger.info('Processing search request', { query, page, limit });
    const manga = await mangaService.searchManga(query, limit, (page - 1) * limit);

    const formattedManga = manga.map(m => ({
      _id: m.mangadexId,
      title: m.title,
      author: m.authors?.[0] || 'Unknown',
      coverImage: m.coverUrl,
    }));

    return new Response(JSON.stringify(formattedManga), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Search API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};