/**
 * Motor de cálculo de la nave: TODAS las fórmulas de trade-off del juego.
 *
 * Es TypeScript puro (no importa Phaser) para poder:
 *   - usarlo en las escenas (barras en tiempo real),
 *   - usarlo en `npm run balance` desde la terminal,
 *   - probarlo sin abrir el navegador.
 *
 * Las fórmulas están documentadas en docs/GDD.md §3.
 */
import type { Design, EnvData, Mission, ModuleDef, Rocket } from '../types';

/** Gravedad estándar (m/s²), para la ecuación de Tsiolkovsky. */
export const G0 = 9.80665;
/** Eficiencia de los paneles al final de vida (polvo, radiación, temperatura). */
export const SOLAR_EOL_FACTOR = 0.9;
/** Profundidad de descarga máxima segura de una batería Li-ion. */
export const BATTERY_DOD = 0.8;
/** Rendimiento de un instrumento repetido (redundancia, no ciencia nueva). */
export const DUPLICATE_SCIENCE = 0.4;

export interface Check {
  id: string;
  ok: boolean;
  label: string;
  detail: string;
}

export interface RocketFit {
  rocket: Rocket;
  capacity: number;
  fitsMass: boolean;
  affordable: boolean;
  reachable: boolean;
}

export interface DesignStats {
  modules: ModuleDef[];
  count: Record<string, number>;
  dryMass: number;
  propellant: number;
  wetMass: number;
  craftCost: number;
  launchCost: number;
  totalCost: number;
  budget: number;
  powerGen: number;
  solarGen: number;
  rtgGen: number;
  powerDraw: number;
  powerMargin: number;
  batteryWh: number;
  eclipseNeedWh: number;
  downlinkKbps: number;
  dataKbps: number;
  /** Fracción de los datos científicos que realmente llega a la Tierra. */
  dataRatio: number;
  /** Fracción del tiempo que los instrumentos pueden estar encendidos. */
  powerRatio: number;
  deltaV: number;
  deltaVRequired: number;
  science: number;
  /** Ciencia por instrumento, para explicar el resultado. */
  scienceBreakdown: { module: ModuleDef; points: number }[];
  checks: Check[];
  rockets: RocketFit[];
}

export interface CalcOptions {
  /** Cohete elegido (a partir de la fase de lanzamiento). */
  rocket?: Rocket;
  /** Multiplicador permanente de la potencia solar (eventos de daño). */
  solarFactor?: number;
}

/** Ecuación del cohete: Δv = Isp · g0 · ln(m0 / mf). */
export function tsiolkovsky(isp: number, wetMass: number, dryMass: number): number {
  if (dryMass <= 0 || wetMass <= dryMass) return 0;
  return isp * G0 * Math.log(wetMass / dryMass);
}

/** Potencia solar: cae con el inverso del cuadrado de la distancia al Sol. */
export function solarAt(w1AU: number, sunDistanceAU: number): number {
  return (w1AU * SOLAR_EOL_FACTOR) / (sunDistanceAU * sunDistanceAU);
}

/** Tasa de bajada: cae con el inverso del cuadrado de la distancia a la Tierra. */
export function downlinkAt(m: ModuleDef, earthDistanceAU: number): number {
  const d = Math.max(earthDistanceAU, 1e-6);
  return Math.min(m.downlinkKbpsMax ?? 0, (m.downlinkKbps1AU ?? 0) / (d * d));
}

export function computeStats(
  design: Design,
  catalog: Map<string, ModuleDef>,
  mission: Mission,
  env: EnvData,
  rockets: Rocket[],
  opts: CalcOptions = {},
): DesignStats {
  const modules = Object.values(design)
    .filter((id): id is string => !!id)
    .map((id) => catalog.get(id))
    .filter((m): m is ModuleDef => !!m);

  const count: Record<string, number> = {};
  for (const m of modules) count[m.id] = (count[m.id] ?? 0) + 1;
  const has = (cat: ModuleDef['category']) => modules.some((m) => m.category === cat);

  // --- Masa -------------------------------------------------------------
  const dryMass = sum(modules, (m) => m.mass);
  const propellant = sum(modules, (m) => m.propellant ?? 0);
  const wetMass = dryMass + propellant;

  // --- Energía (en el destino) -----------------------------------------
  const solarFactor = opts.solarFactor ?? 1;
  const solarGen = sum(modules, (m) => solarAt(m.solarW1AU ?? 0, env.sunDistanceAU)) * solarFactor;
  const rtgGen = sum(modules, (m) => m.rtgW ?? 0);
  const powerGen = solarGen + rtgGen;
  const powerDraw = sum(modules, (m) => m.powerDraw);
  const powerMargin = powerGen - powerDraw;
  const powerRatio = powerDraw <= 0 ? 1 : clamp(powerGen / powerDraw, 0, 1);

  // --- Eclipse: la batería debe cubrir el consumo mientras no hay Sol ----
  // Los RTG siguen generando en la sombra, así que sólo se cubre el déficit.
  const batteryWh = sum(modules, (m) => m.batteryWh ?? 0);
  const deficitW = Math.max(0, powerDraw - rtgGen);
  const eclipseNeedWh = (deficitW * mission.eclipseMinutes) / 60 / BATTERY_DOD;

  // --- Comunicaciones ---------------------------------------------------
  const antennas = modules.filter((m) => m.category === 'comms');
  const downlinkKbps = antennas.reduce((best, m) => Math.max(best, downlinkAt(m, env.earthDistanceAU)), 0);
  const instruments = modules.filter((m) => m.category === 'instrument');
  const dataKbps = sum(instruments, (m) => m.dataKbps ?? 0);
  const dataRatio = dataKbps <= 0 ? 1 : clamp(downlinkKbps / dataKbps, 0, 1);

  // --- Propulsión -------------------------------------------------------
  const engine = modules.find((m) => m.category === 'propulsion');
  const deltaV = engine ? tsiolkovsky(engine.isp ?? 0, wetMass, dryMass) : 0;

  // --- Ciencia ----------------------------------------------------------
  // ciencia = Σ base × afinidad del destino × datos enviados × energía disponible
  const seen: Record<string, number> = {};
  const scienceBreakdown = instruments.map((m) => {
    seen[m.id] = (seen[m.id] ?? 0) + 1;
    const dup = seen[m.id] > 1 ? DUPLICATE_SCIENCE : 1;
    const aff = m.instrument ? mission.affinity[m.instrument] : 1;
    const points = (m.science ?? 0) * aff * dup * dataRatio * powerRatio;
    return { module: m, points };
  });
  const science = has('comms') && has('bus') ? sum(scienceBreakdown, (s) => s.points) : 0;

  // --- Costo ------------------------------------------------------------
  const craftCost = sum(modules, (m) => m.cost);
  const launchCost = opts.rocket?.cost ?? 0;
  const totalCost = craftCost + launchCost;

  // --- Cohetes: ¿cuáles pueden llevar esta nave? -----------------------
  const rocketFits: RocketFit[] = rockets.map((r) => {
    const capacity = r.payload[mission.destination];
    return {
      rocket: r,
      capacity,
      reachable: capacity > 0,
      fitsMass: capacity > 0 && wetMass <= capacity,
      affordable: craftCost + r.cost <= mission.budget,
    };
  });

  const checks: Check[] = [
    {
      id: 'bus', ok: has('bus'), label: 'Bus estructural',
      detail: has('bus') ? 'Instalado' : 'Toda nave necesita un bus',
    },
    {
      id: 'comms', ok: has('comms'), label: 'Comunicaciones',
      detail: has('comms') ? `${fmtKbps(downlinkKbps)} hacia la Tierra` : 'Sin antena no llegan los datos',
    },
    {
      id: 'power', ok: powerGen > 0 && powerMargin >= 0, label: 'Energía',
      detail: `${Math.round(powerGen)} W generados / ${Math.round(powerDraw)} W consumidos`,
    },
    {
      id: 'eclipse', ok: mission.eclipseMinutes === 0 || batteryWh >= eclipseNeedWh, label: 'Eclipse',
      detail: mission.eclipseMinutes === 0
        ? 'Sin eclipses en esta órbita'
        : `Batería ${batteryWh} Wh / necesita ${Math.ceil(eclipseNeedWh)} Wh`,
    },
    {
      id: 'deltav', ok: deltaV >= mission.deltaVRequired, label: 'Δv',
      detail: `${Math.round(deltaV)} / ${mission.deltaVRequired} m/s`,
    },
    {
      id: 'instrument', ok: instruments.length > 0, label: 'Ciencia',
      detail: instruments.length > 0 ? `${Math.round(science)} / ${mission.minScience} pts` : 'Sin instrumentos no hay ciencia',
    },
    {
      id: 'launch', ok: rocketFits.some((f) => f.fitsMass && f.affordable), label: 'Lanzamiento',
      detail: rocketFits.some((f) => f.fitsMass && f.affordable)
        ? 'Hay al menos un cohete posible'
        : 'Ningún cohete puede llevarla con tu presupuesto',
    },
  ];

  return {
    modules, count, dryMass, propellant, wetMass,
    craftCost, launchCost, totalCost, budget: mission.budget,
    powerGen, solarGen, rtgGen, powerDraw, powerMargin,
    batteryWh, eclipseNeedWh,
    downlinkKbps, dataKbps, dataRatio, powerRatio,
    deltaV, deltaVRequired: mission.deltaVRequired,
    science, scienceBreakdown, checks, rockets: rocketFits,
  };
}

export function fmtKbps(kbps: number): string {
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(kbps >= 10000 ? 0 : 1)} Mbps`;
  if (kbps >= 1) return `${Math.round(kbps)} kbps`;
  return `${Math.round(kbps * 1000)} bps`;
}

export function fmtMass(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(2)} t` : `${Math.round(kg)} kg`;
}

export function fmtMoney(m: number): string {
  return `${Math.round(m).toLocaleString('es-MX')} M$`;
}

function sum<T>(arr: T[], f: (x: T) => number): number {
  return arr.reduce((acc, x) => acc + f(x), 0);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
