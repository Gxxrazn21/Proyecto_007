/**
 * Insignias y récords. Se guardan en el navegador del jugador (localStorage).
 * Si el almacenamiento no está disponible (modo incógnito), el juego sigue
 * funcionando: simplemente no recuerda el progreso entre visitas.
 */
import type { DesignStats } from './calc';
import type { Mission } from '../types';

export interface BadgeContext {
  mission: Mission;
  outcome: 'success' | 'partial' | 'lost' | 'launch-fail';
  stars: number;
  stats: DesignStats;
  health: number;
  totalCost: number;
  science: number;
}

export interface Badge {
  id: string;
  name: string;
  /** Cómo se consigue (se muestra aunque esté bloqueada). */
  hint: string;
  check: (c: BadgeContext, progress: Progress) => boolean;
}

export interface Progress {
  badges: string[];
  /** Mejor ciencia y estrellas por misión. */
  best: Record<string, { science: number; stars: number }>;
}

const KEY = 'mision-orbita:progreso';

const ok = (c: BadgeContext) => c.outcome === 'success';
const usesOnly = (c: BadgeContext, kind: 'solar' | 'rtg') =>
  c.stats.modules.some((m) => (kind === 'rtg' ? m.rtgW : m.solarW1AU)) &&
  !c.stats.modules.some((m) => (kind === 'rtg' ? m.solarW1AU : m.rtgW));

export const BADGES: Badge[] = [
  { id: 'first', name: 'Primer contacto', hint: 'Completa cualquier misión con éxito.', check: ok },
  { id: 'stars3', name: 'Tres estrellas', hint: 'Consigue 3 estrellas en una misión.', check: (c) => c.stars >= 3 },
  { id: 'cassini', name: 'Ingeniería Cassini', hint: 'Llega a Júpiter usando sólo RTG.', check: (c) => ok(c) && c.mission.id === 'jupiter' && usesOnly(c, 'rtg') },
  { id: 'juno', name: 'Al estilo Juno', hint: 'Llega a Júpiter usando sólo paneles solares.', check: (c) => ok(c) && c.mission.id === 'jupiter' && usesOnly(c, 'solar') },
  { id: 'budget', name: 'Presupuesto de hierro', hint: 'Triunfa gastando el 60 % del presupuesto o menos.', check: (c) => ok(c) && c.totalCost <= c.mission.budget * 0.6 },
  { id: 'flawless', name: 'Sin un rasguño', hint: 'Termina una misión con el 100 % de salud.', check: (c) => ok(c) && c.health >= 100 },
  { id: 'lesson', name: 'Lección aprendida', hint: 'Pierde una misión. Los ingenieros también aprenden de los fallos.', check: (c) => c.outcome === 'lost' || c.outcome === 'launch-fail' },
  {
    id: 'explorer', name: 'Explorador del Sistema Solar', hint: 'Completa con éxito las 4 misiones.',
    check: (c, p) => ok(c) && new Set([...Object.entries(p.best).filter(([, b]) => b.stars > 0).map(([id]) => id), c.mission.id]).size >= 4,
  },
];

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Progress;
      return { badges: p.badges ?? [], best: p.best ?? {} };
    }
  } catch { /* almacenamiento no disponible */ }
  return { badges: [], best: {} };
}

/** Registra una partida terminada. Devuelve las insignias NUEVAS y si es récord. */
export function recordGame(c: BadgeContext): { unlocked: Badge[]; newBest: boolean } {
  const p = loadProgress();
  const unlocked = BADGES.filter((b) => !p.badges.includes(b.id) && b.check(c, p));
  p.badges.push(...unlocked.map((b) => b.id));
  const prev = p.best[c.mission.id];
  const newBest = !prev || c.science > prev.science;
  if (newBest) p.best[c.mission.id] = { science: Math.floor(c.science), stars: Math.max(c.stars, prev?.stars ?? 0) };
  else p.best[c.mission.id] = { ...prev, stars: Math.max(c.stars, prev.stars) };
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* sin almacenamiento */ }
  return { unlocked, newBest: newBest && c.science > 0 };
}
