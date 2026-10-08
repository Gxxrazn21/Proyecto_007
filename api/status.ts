/**
 * Diagnóstico: GET /api/status
 * Dice qué APIs de la NASA responden desde el servidor y cuánto tardan.
 * No muestra la clave, sólo si está configurada.
 */
import { handleApi } from '../server/nasa.js';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { status, body } = await handleApi('status', url.searchParams, process.env.NASA_API_KEY);
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
