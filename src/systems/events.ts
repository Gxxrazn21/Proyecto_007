/**
 * Sistema de eventos de la fase de Operación (TypeScript puro, sin Phaser).
 *
 * Los eventos viven en public/data/events.json. Cada opción tiene una lista
 * de resultados condicionados; gana el PRIMERO cuya condición se cumple.
 *
 * Mini-lenguaje de condiciones (seguro, sin eval):
 *   "batteryWh>=eclipseNeedWh"     compara dos variables
 *   "count.tank>=2"               nº de módulos de un tipo
 *   "severity>=0.8 && solar>0"    varias condiciones con &&
 * Variables disponibles: ver buildContext().
 */
import type { DesignStats } from './calc';
import type { Asteroid, EarthEvent, Effects, EventDef, Mission, Outcome, ReportEntry, SolarEvent } from '../types';

/** Estado vivo de la nave durante la operación. */
export interface OpsState {
  health: number;
  /** Multiplicador acumulado sobre la ciencia (1 = sin cambios). */
  scienceMult: number;
  /** Δv gastado en eventos (m/s). */
  deltaVSpent: number;
  /** Multiplicador permanente sobre la potencia solar. */
  solarFactor: number;
  inserted: boolean;
}

export function newOpsState(): OpsState {
  return { health: 100, scienceMult: 1, deltaVSpent: 0, solarFactor: 1, inserted: false };
}

/** Evento ya preparado para mostrarse: textos rellenados con datos reales. */
export interface LiveEvent {
  def: EventDef;
  text: string;
  title: string;
  severity: number;
  /** Etiqueta "Dato real: NASA DONKI" que se muestra en la tarjeta. */
  dataSource?: string;
  vars: Record<string, string>;
}

export interface Feeds {
  flares: SolarEvent[];
  cmes: SolarEvent[];
  storms: SolarEvent[];
  asteroids: Asteroid[];
  earth: EarthEvent[];
}

/** Variables numéricas que pueden usar las condiciones. */
export function buildContext(stats: DesignStats, ops: OpsState, severity = 0): Record<string, number> {
  const ctx: Record<string, number> = {
    health: ops.health,
    severity,
    batteryWh: stats.batteryWh,
    eclipseNeedWh: Math.ceil(stats.eclipseNeedWh),
    powerMargin: Math.round(stats.powerMargin),
    deltaVMargin: Math.round(stats.deltaV - stats.deltaVRequired - ops.deltaVSpent),
    comms: stats.modules.filter((m) => m.category === 'comms').length,
    solar: stats.modules.filter((m) => (m.solarW1AU ?? 0) > 0).length,
    rtg: stats.modules.filter((m) => (m.rtgW ?? 0) > 0).length,
  };
  for (const m of stats.modules) {
    ctx[`count.${m.id}`] = (ctx[`count.${m.id}`] ?? 0) + 1;
    if (m.instrument) ctx[`has.${m.instrument}`] = 1;
  }
  return ctx;
}

const COND = /^([\w.]+)\s*(>=|<=|==|!=|>|<)\s*([\w.]+)$/;

/** Evalúa una condición del mini-lenguaje. Variables desconocidas valen 0. */
export function evalCondition(expr: string | undefined, ctx: Record<string, number>): boolean {
  if (!expr) return true;
  return expr.split('&&').every((part) => {
    const m = COND.exec(part.trim());
    if (!m) {
      console.warn(`[events] condición inválida: "${part}"`);
      return false;
    }
    const val = (tok: string) => (isNaN(Number(tok)) ? ctx[tok] ?? 0 : Number(tok));
    const a = val(m[1]);
    const b = val(m[3]);
    switch (m[2]) {
      case '>=': return a >= b;
      case '<=': return a <= b;
      case '>': return a > b;
      case '<': return a < b;
      case '==': return a === b;
      default: return a !== b;
    }
  });
}

/** Devuelve el resultado que aplica para una opción. */
export function resolveChoice(ev: LiveEvent, choiceIndex: number, stats: DesignStats, ops: OpsState): Outcome {
  const ctx = buildContext(stats, ops, ev.severity);
  const choice = ev.def.choices[choiceIndex];
  const outcome = choice.outcomes.find((o) => evalCondition(o.when, ctx)) ?? choice.outcomes[choice.outcomes.length - 1];
  return { ...outcome, text: fill(outcome.text, { ...ev.vars, ...stringify(ctx) }) };
}

/** Aplica los efectos al estado de la nave (muta `ops`). */
export function applyEffects(ops: OpsState, fx: Effects): void {
  if (fx.health) ops.health = Math.max(0, Math.min(100, ops.health + fx.health));
  if (fx.science) ops.scienceMult = Math.max(0, ops.scienceMult + fx.science);
  if (fx.deltaV) ops.deltaVSpent += fx.deltaV;
  if (fx.solarPower) ops.solarFactor = Math.max(0, ops.solarFactor + fx.solarPower);
}

/** ¿El efecto fue bueno, malo o neutro? (para colorear el reporte) */
export function impactOf(fx: Effects): ReportEntry['impact'] {
  const score = (fx.health ?? 0) / 10 + (fx.science ?? 0) * 10 - (fx.deltaV ?? 0) / 100 + (fx.solarPower ?? 0) * 10;
  // Un costo pequeño (p. ej. −5 % de ciencia por el modo seguro) es prudencia, no un error.
  if (score > 0.25) return 'good';
  if (score < -0.6) return 'bad';
  return 'neutral';
}

/** Número de eventos de crucero según la duración del viaje. */
export function cruiseEventCount(days: number): number {
  if (days <= 0) return 0;
  if (days < 30) return 1;
  if (days < 1200) return 2;
  return 4;
}

/**
 * Elige los eventos de una fase. Selección ponderada sin repetición, filtrada
 * por etiquetas de la misión y por las condiciones `requires`.
 */
export function pickEvents(
  all: EventDef[],
  phase: EventDef['phase'],
  n: number,
  mission: Mission,
  feeds: Feeds,
  shadowName: string,
  rng: () => number = Math.random,
  exclude: Set<string> = new Set(),
): LiveEvent[] {
  const tags = new Set([...mission.eventTags, 'all']);
  let pool = all.filter(
    (e) => e.phase === phase && !exclude.has(e.id) && e.tags.some((t) => tags.has(t)) && feedAvailable(e, feeds),
  );
  const out: LiveEvent[] = [];

  // El eclipse es obligatorio en órbitas con sombra: es el trade-off batería/ciencia.
  if (phase === 'science' && mission.eclipseMinutes > 0) {
    const eclipse = pool.find((e) => e.id === 'eclipse');
    if (eclipse) {
      out.push(prepare(eclipse, mission, feeds, shadowName, rng));
      pool = pool.filter((e) => e !== eclipse);
    }
  }

  while (out.length < n && pool.length > 0) {
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let r = rng() * total;
    const idx = pool.findIndex((e) => (r -= e.weight) <= 0);
    const ev = pool.splice(idx < 0 ? 0 : idx, 1)[0];
    out.push(prepare(ev, mission, feeds, shadowName, rng));
  }
  // Mezcla para que el eclipse no salga siempre primero.
  return out.sort(() => rng() - 0.5);
}

function feedAvailable(e: EventDef, f: Feeds): boolean {
  switch (e.feed) {
    case 'donki-flare': return f.flares.length > 0;
    case 'donki-cme': return f.cmes.length > 0;
    case 'donki-storm': return f.storms.length > 0;
    case 'neows': return f.asteroids.length > 0;
    case 'eonet': return f.earth.length > 0;
    default: return true;
  }
}

function prepare(def: EventDef, mission: Mission, feeds: Feeds, shadowName: string, rng: () => number): LiveEvent {
  const vars: Record<string, string> = {
    shadow: shadowName,
    eclipse: String(mission.eclipseMinutes),
  };
  let severity = 0.5;
  let dataSource: string | undefined;
  const pickOne = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];

  if (def.feed?.startsWith('donki')) {
    const list = def.feed === 'donki-flare' ? feeds.flares : def.feed === 'donki-cme' ? feeds.cmes : feeds.storms;
    const ev = pickOne(list);
    vars.label = ev.label;
    vars.date = formatDate(ev.date);
    vars.detail = ev.detail;
    severity = ev.severity;
    dataSource = ev.source === 'donki' ? 'Dato real en vivo: NASA DONKI' : 'Evento histórico real: NASA DONKI';
  } else if (def.feed === 'neows') {
    const a = pickOne(feeds.asteroids);
    vars.asteroid = a.name;
    vars.size = String(Math.round(a.diameterM));
    vars.distance = a.missLunar.toFixed(1);
    vars.date = formatDate(a.date);
    dataSource = a.source === 'neows' ? 'Dato real en vivo: NASA NeoWs' : 'Dato real: NASA NeoWs';
  } else if (def.feed === 'eonet') {
    const e = pickOne(feeds.earth);
    vars.title = e.title;
    vars.category = EARTH_CATEGORY[e.category] ?? 'Evento natural';
    vars.date = formatDate(e.date);
    dataSource = e.source === 'eonet' ? 'Dato real en vivo: NASA EONET' : 'Evento real: NASA EONET';
  }

  return { def, title: fill(def.title, vars), text: fill(def.text, vars), severity, dataSource, vars };
}

const EARTH_CATEGORY: Record<string, string> = {
  wildfires: 'Incendio forestal',
  volcanoes: 'Volcán activo',
  severeStorms: 'Tormenta severa',
  floods: 'Inundación',
  seaLakeIce: 'Hielo marino',
};

export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

function stringify(ctx: Record<string, number>): Record<string, string> {
  return Object.fromEntries(Object.entries(ctx).map(([k, v]) => [k, String(v)]));
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
