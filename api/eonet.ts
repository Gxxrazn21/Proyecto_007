/**
 * Función serverless de Vercel: GET /api/eonet
 * NASA EONET no necesita clave; pasa por aquí para tener caché y un formato simple.
 */
import { handleApi } from '../server/nasa.js';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { status, body } = await handleApi('eonet', url.searchParams);
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': status === 200 ? 's-maxage=3600, stale-while-revalidate=86400' : 'no-store' },
  });
}
