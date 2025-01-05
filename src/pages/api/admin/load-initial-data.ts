import type { APIRoute, APIContext } from 'astro';
import { initDB } from '../../../lib/db/init';
import { dataLoader } from '../../../lib/dataLoader';
import { logger } from '../../../lib/utils/logger';
import { WritableStream } from 'node:stream/web';

interface ProgressData {
  message?: string;
  manga?: string;
  updatedChapters?: number;
  pages?: number;
}

interface SSEClient extends WritableStream {
  writeHead: (statusCode: number, headers: Record<string, string>) => void;
  clientId?: string;
}

declare global {
  var __SSE_CLIENTS__: SSEClient[];
}

export const POST: APIRoute = async ({ request }: APIContext) => {
  if (typeof request.url === 'string' && request.url.endsWith('/progress')) {
    const sseRes = new Response(
        new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              const client: SSEClient = new WritableStream({
                  write(chunk) {
                      controller.enqueue(encoder.encode(chunk));
                  }
              }) as unknown as SSEClient;

              client.clientId = crypto.randomUUID();

               // Send initial data
              client.write(`event: progress\n`);
              client.write(`data: ${JSON.stringify({ message: 'Waiting for updates...' })}\n\n`);


                // Keep connection open
              const keepAlive = setInterval(() => {
                client.write(':\n\n');
              }, 30000);


              // Store client for broadcasting from dataLoader
              globalThis.__SSE_CLIENTS__ = globalThis.__SSE_CLIENTS__ || [];
              globalThis.__SSE_CLIENTS__.push(client);

              // Clean up on connection close
              request.signal.addEventListener('abort', () => {
                clearInterval(keepAlive);
                globalThis.__SSE_CLIENTS__ = (globalThis.__SSE_CLIENTS__ || []).filter(
                    (c: SSEClient) => c.clientId !== client.clientId
                );
                controller.close();
              });
          }
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      }
    );

    return sseRes;
  }


  try {
    await initDB();
    logger.info('Starting initial data load');

    await dataLoader.loadAllMangaFromAPI();

    const progress: ProgressData = dataLoader.getProgress() as ProgressData;
    return new Response(JSON.stringify({
      success: true,
      message: 'Initial data load completed',
      progress
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Initial data load failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      progress: dataLoader.getProgress()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ request, params }) => {
  try {
    const progress = dataLoader.getProgress() as ProgressData;
    return new Response(JSON.stringify({
      success: true,
      progress
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Progress check error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to get progress',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};