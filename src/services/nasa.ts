/**
 * Cliente de datos de la NASA con RESPALDO OFFLINE.
 *
 * Estrategia para cada dato:
 *   1. Pedir /api/... (nuestro intermediario con la clave secreta).
 *   2. Si tarda más de 5 s, falla o no devuelve JSON (p. ej. hosting
 *      estático sin funciones), usar /data/fallback/*.json o las
 *      efemérides calculadas localmente.
 * El juego NUNCA se bloquea por falta de internet.
 */
import { offlineEnv } from '../systems/ephemeris';
import type { Apod, Asteroid, Body, EnvData, SolarEvent } from '../types';
import type { Feeds } from '../systems/events';

const TIMEOUT_MS = 5000;

async function getJson<T>(url: string, timeout = TIMEOUT_MS): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json')) throw new Error('La respuesta no es JSON');
  return (await res.json()) as T;
}

async function withFallback<T>(name: string, live: () => Promise<T>, offline: () => Promise<T> | T): Promise<T> {
  try {
    return await live();
  } catch (err) {
    console.info(`[nasa] ${name}: usando respaldo offline (${(err as Error).message})`);
    return offline();
  }
}

/** Distancias reales del destino: JPL Horizons → efemérides offline. */
export function getEnv(body: Body): Promise<EnvData> {
  return withFallback('horizons', () => getJson<EnvData>(`api/horizons?body=${body}`, 8000), () => offlineEnv(body));
}

/** Clima espacial y asteroides. Mezcla datos en vivo con históricos si hay pocos. */
export async function getFeeds(): Promise<Feeds> {
  const offline = getJson<{ flares: SolarEvent[]; cmes: SolarEvent[]; storms: SolarEvent[] }>('data/fallback/donki.json');
  const donki = await withFallback('donki', () => getJson<Awaited<typeof offline>>('api/donki', 9000), () => offline);
  const asteroids = await withFallback(
    'neows',
    () => getJson<Asteroid[]>('api/neows'),
    async () => (await getJson<{ asteroids: Asteroid[] }>('data/fallback/neows.json')).asteroids,
  );
  // Si el Sol estuvo tranquilo en los últimos meses, completamos con eventos históricos.
  const hist = await offline.catch(() => ({ flares: [], cmes: [], storms: [] }));
  return {
    flares: donki.flares.length ? donki.flares : hist.flares,
    cmes: donki.cmes.length ? donki.cmes : hist.cmes,
    storms: donki.storms.length ? donki.storms : hist.storms,
    asteroids: asteroids.length ? asteroids : [],
  };
}

/** Imagen astronómica del día. */
export function getApod(): Promise<Apod> {
  return withFallback('apod', () => getJson<Apod>('api/apod'), () => getJson<Apod>('data/fallback/apod.json'));
}
