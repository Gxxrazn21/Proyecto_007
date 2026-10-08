/**
 * Función serverless de Vercel: GET /api/donki
 * La clave se lee de la variable de entorno NASA_API_KEY (Vercel → Settings → Environment Variables).
 */
import { handleApi } from '../server/nasa.js';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { status, body } = await handleApi('donki', url.searchParams, process.env.NASA_API_KEY);
  return Response.json(body, {
    status,
    // Caché de 1 h en la CDN: protege el límite de 1 000 peticiones/hora de api.nasa.gov.
    headers: { 'Cache-Control': status === 200 ? 's-maxage=3600, stale-while-revalidate=86400' : 'no-store' },
  });
}
