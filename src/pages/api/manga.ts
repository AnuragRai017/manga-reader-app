import type { APIRoute } from 'astro';
import { mangaService } from '../../lib/services/mangaService';
import { initDB } from '../../lib/config/database';
import { logger } from '../../lib/utils/logger';

export const GET: APIRoute = async ({ params, request }) => {
  try {
    await initDB();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      const manga = await mangaService.getManga(id);
      if (!manga) {
        logger.warn('Manga not found', { mangaId: id });
        return new Response(JSON.stringify({ error: 'Manga not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify(manga), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const manga = await mangaService.getPopularManga(limit, (page - 1) * limit);

    return new Response(JSON.stringify(manga), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    await initDB();
    const data = await request.json();
    const manga = await mangaService.saveManga(data);
    return new Response(JSON.stringify(manga), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}; 