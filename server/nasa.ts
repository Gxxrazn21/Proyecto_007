/**
 * Intermediario (proxy) hacia las APIs de la NASA. SE EJECUTA EN EL SERVIDOR.
 *
 * ¿Por qué un intermediario?
 *   1. La clave NASA_API_KEY nunca llega al navegador (si se pusiera en el
 *      código del juego, cualquiera podría leerla con "Ver código fuente").
 *   2. JPL Horizons no permite llamadas directas desde el navegador (CORS).
 *   3. Simplificamos las respuestas: el juego recibe JSON pequeño y limpio.
 *
 * Lo usan:
 *   - vite.config.ts  → en desarrollo (npm run dev)
 *   - api/*.ts        → en producción (funciones serverless de Vercel)
 */
import type { Apod, Asteroid, Body, EarthEvent, EnvData, SolarEvent } from '../src/types.js';

const NASA = 'https://api.nasa.gov';
const HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const TIMEOUT_MS = 8000;

export interface ApiResult {
  status: number;
  body: unknown;
}

/** Punto de entrada común: decide qué API llamar según la ruta. */
export async function handleApi(route: string, params: URLSearchParams, apiKey = 'DEMO_KEY'): Promise<ApiResult> {
  try {
    switch (route) {
      case 'donki':
        return ok(await donki(apiKey));
      case 'apod':
        return ok(await apod(apiKey));
      case 'neows':
        return ok(await neows(apiKey));
      case 'eonet':
        return ok(await eonet());
      case 'horizons': {
        const body = params.get('body') as Body | null;
        if (!body || !['earth', 'moon', 'mars', 'jupiter'].includes(body)) {
          return { status: 400, body: { error: 'Parámetro body inválido (earth|moon|mars|jupiter)' } };
        }
        return ok(await horizons(body));
      }
      default:
        return { status: 404, body: { error: `Ruta desconocida: ${route}` } };
    }
  } catch (err) {
    // El cliente usará su respaldo offline; aquí sólo informamos.
    return { status: 502, body: { error: 'La API de la NASA no respondió', detail: String(err) } };
  }
}

const ok = (body: unknown): ApiResult => ({ status: 200, body });

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url.replace(/api_key=[^&]+/, 'api_key=***')}`);
  return (await res.json()) as T;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86_400_000));

/* ------------------------------------------------------------------ */
/* DONKI: clima espacial (llamaradas, CME, tormentas geomagnéticas)     */
/* https://api.nasa.gov → DONKI                                         */
/* ------------------------------------------------------------------ */

interface DonkiFlare { classType: string; beginTime: string; activeRegionNum?: number }
interface DonkiCme { time21_5: string; speed: number; type: string }
interface DonkiGst { startTime: string; allKpIndex?: { kpIndex: number }[] }

export async function donki(key: string): Promise<{ flares: SolarEvent[]; cmes: SolarEvent[]; storms: SolarEvent[] }> {
  const range = `startDate=${daysAgo(120)}&endDate=${daysAgo(0)}`;
  const [flr, cme, gst] = await Promise.all([
    getJson<DonkiFlare[]>(`${NASA}/DONKI/FLR?${range}&api_key=${key}`),
    getJson<DonkiCme[]>(`${NASA}/DONKI/CMEAnalysis?${range}&mostAccurateOnly=true&speed=700&api_key=${key}`),
    getJson<DonkiGst[]>(`${NASA}/DONKI/GST?${range}&api_key=${key}`),
  ]);

  const flares = (flr ?? [])
    .filter((f) => /^[MX]/.test(f.classType ?? ''))
    .map<SolarEvent>((f) => ({
      kind: 'flare',
      label: f.classType,
      severity: flareSeverity(f.classType),
      date: f.beginTime,
      detail: f.activeRegionNum ? `Región activa ${f.activeRegionNum}` : 'Región activa sin numerar',
      source: 'donki',
    }))
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 12);

  const cmes = (cme ?? []).slice(-12).map<SolarEvent>((c) => ({
    kind: 'cme',
    label: `${Math.round(c.speed).toLocaleString('es-MX')} km/s`,
    severity: c.speed >= 1500 ? 1 : c.speed >= 1000 ? 0.8 : 0.5,
    date: c.time21_5,
    detail: `CME tipo ${c.type}`,
    source: 'donki',
  }));

  const storms = (gst ?? []).map<SolarEvent>((g) => {
    const kp = Math.max(0, ...(g.allKpIndex ?? []).map((k) => k.kpIndex));
    return {
      kind: 'storm',
      label: `Kp ${kp}`,
      severity: kp >= 8 ? 1 : kp >= 7 ? 0.8 : kp >= 6 ? 0.6 : 0.4,
      date: g.startTime,
      detail: `Índice Kp máximo ${kp}`,
      source: 'donki',
    };
  });

  return { flares, cmes, storms };
}

function flareSeverity(cls: string): number {
  const mag = parseFloat(cls.slice(1)) || 1;
  if (cls.startsWith('X')) return 1;
  if (cls.startsWith('M')) return Math.min(0.75, 0.4 + mag * 0.04);
  return 0.2;
}

/* ------------------------------------------------------------------ */
/* APOD: imagen astronómica del día (pantalla de carga / menú)          */
/* ------------------------------------------------------------------ */

interface ApodRaw { title: string; url: string; hdurl?: string; media_type: string; date: string; copyright?: string }

export async function apod(key: string): Promise<Apod> {
  const a = await getJson<ApodRaw>(`${NASA}/planetary/apod?api_key=${key}&thumbs=true`);
  return { title: a.title, url: a.url, mediaType: a.media_type, date: a.date, copyright: a.copyright?.trim(), source: 'apod' };
}

/* ------------------------------------------------------------------ */
/* NeoWs: asteroides cercanos a la Tierra (próximos 7 días)             */
/* ------------------------------------------------------------------ */

interface NeoRaw {
  name: string;
  is_potentially_hazardous_asteroid: boolean;
  estimated_diameter: { meters: { estimated_diameter_max: number } };
  close_approach_data: { close_approach_date: string; miss_distance: { lunar: string } }[];
}

export async function neows(key: string): Promise<Asteroid[]> {
  const feed = await getJson<{ near_earth_objects: Record<string, NeoRaw[]> }>(
    `${NASA}/neo/rest/v1/feed?start_date=${daysAgo(0)}&end_date=${isoDay(new Date(Date.now() + 6 * 86_400_000))}&api_key=${key}`,
  );
  return Object.values(feed.near_earth_objects ?? {})
    .flat()
    .map<Asteroid>((n) => ({
      name: n.name.replace(/[()]/g, '').trim(),
      diameterM: n.estimated_diameter.meters.estimated_diameter_max,
      missLunar: parseFloat(n.close_approach_data[0]?.miss_distance.lunar ?? '0'),
      date: n.close_approach_data[0]?.close_approach_date ?? '',
      hazardous: n.is_potentially_hazardous_asteroid,
      source: 'neows',
    }))
    .sort((a, b) => a.missLunar - b.missLunar)
    .slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* EONET: eventos naturales en la Tierra en curso (no necesita clave)   */
/* https://eonet.gsfc.nasa.gov/docs/v3                                  */
/* ------------------------------------------------------------------ */

interface EonetRaw {
  title: string;
  categories: { id: string }[];
  geometry: { date: string }[];
}

const EONET_CATEGORIES = new Set(['wildfires', 'volcanoes', 'severeStorms', 'floods', 'seaLakeIce']);

export async function eonet(): Promise<EarthEvent[]> {
  const data = await getJson<{ events: EonetRaw[] }>('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=60&limit=60');
  return (data.events ?? [])
    .filter((e) => EONET_CATEGORIES.has(e.categories[0]?.id))
    .map<EarthEvent>((e) => ({
      title: e.title,
      category: e.categories[0].id,
      date: e.geometry[e.geometry.length - 1]?.date ?? '',
      source: 'eonet',
    }))
    .slice(0, 15);
}

/* ------------------------------------------------------------------ */
/* JPL Horizons: distancias reales al Sol (r) y a la Tierra (Δ)         */
/* https://ssd-api.jpl.nasa.gov/doc/horizons.html                       */
/* ------------------------------------------------------------------ */

/** Códigos de Horizons. Para "earth" pedimos la Tierra vista desde el Sol. */
const HORIZONS_ID: Record<Body, string> = { earth: '399', moon: '301', mars: '499', jupiter: '599' };
const LEO_AU = 7080 / 149_597_870.7;

export async function horizons(body: Body): Promise<EnvData> {
  const today = new Date();
  const q = new URLSearchParams({
    format: 'json',
    COMMAND: `'${HORIZONS_ID[body]}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    // Observador: centro de la Tierra (o del Sol, si el objetivo es la Tierra)
    CENTER: body === 'earth' ? "'500@10'" : "'500@399'",
    START_TIME: `'${isoDay(today)}'`,
    STOP_TIME: `'${isoDay(new Date(today.getTime() + 86_400_000))}'`,
    STEP_SIZE: "'1d'",
    QUANTITIES: "'19,20'", // 19 = r (distancia al Sol), 20 = Δ (distancia al observador)
    CSV_FORMAT: "'YES'",
  });
  const data = await getJson<{ result: string }>(`${HORIZONS}?${q}`);
  const block = data.result.split('$$SOE')[1]?.split('$$EOE')[0];
  if (!block) throw new Error('Respuesta de Horizons sin efemérides');

  // Primera fila CSV: fecha, flags, r, rdot, delta, deldot
  const nums = block.trim().split('\n')[0].split(',').slice(1).map((s) => s.trim()).filter((s) => s !== '' && !isNaN(Number(s))).map(Number);
  const [r, , delta] = nums;
  if (r === undefined || delta === undefined) throw new Error('No se pudo leer r/Δ de Horizons');

  const iso = isoDay(today);
  if (body === 'earth') return { sunDistanceAU: r, earthDistanceAU: LEO_AU, date: iso, source: 'horizons' };
  return { sunDistanceAU: r, earthDistanceAU: delta, date: iso, source: 'horizons' };
}
