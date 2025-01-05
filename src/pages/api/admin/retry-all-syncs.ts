import type { APIRoute } from 'astro';
import { mangadex } from '../../../lib/mangadex';

export const POST: APIRoute = async () => {
  try {
    const results = await mangadex.retryAllFailedSyncs();
    
    const successCount = results.filter(result => result.status === 'fulfilled').length;
    const failureCount = results.filter(result => result.status === 'rejected').length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Retried all failed syncs: ${successCount} succeeded, ${failureCount} failed`,
        results: results.map((result, index) => ({
          status: result.status,
          error: result.status === 'rejected' ? result.reason.message : undefined
        }))
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Retry all syncs error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Failed to retry all syncs',
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