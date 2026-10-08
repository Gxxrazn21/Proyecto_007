/**
 * Herramienta de balance: `npm run balance`
 *
 * Evalúa diseños de referencia contra cada misión con las MISMAS fórmulas del
 * juego (src/systems/calc.ts) y las distancias reales de hoy (efemérides
 * offline). Úsala cada vez que cambies un JSON: si un diseño "bueno" deja de
 * pasar o uno "malo" empieza a pasar, el balance se rompió.
 */
import { readFileSync } from 'node:fs';
import { computeStats, fmtMoney } from '../src/systems/calc';
import { offlineEnv } from '../src/systems/ephemeris';
import type { Design, Mission, ModuleDef, Rocket } from '../src/types';

const load = <T>(f: string): T => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), 'utf8'));
const modules = load<{ modules: ModuleDef[] }>('modules.json').modules;
const rockets = load<{ rockets: Rocket[] }>('rockets.json').rockets;
const missions = load<{ missions: Mission[] }>('missions.json').missions;
const catalog = new Map(modules.map((m) => [m.id, m]));

/** Diseños de referencia: [nombre, se espera que pase, lista de módulos]. */
const designs: Record<string, [string, boolean, string[]][]> = {
  earth: [
    ['Equilibrado', true, ['bus', 'solar_s', 'battery', 'lga', 'engine', 'tank', 'camera', 'spectrometer']],
    ['Sin batería', false, ['bus', 'solar_s', 'lga', 'engine', 'tank', 'camera', 'spectrometer']],
    ['Sin motor', false, ['bus', 'solar_s', 'battery', 'lga', 'tank', 'camera', 'spectrometer']],
    ['Todo lujo', false, ['bus', 'solar_l', 'solar_l', 'battery', 'battery', 'hga', 'lga', 'engine', 'tank', 'camera', 'spectrometer', 'magnetometer']],
  ],
  moon: [
    ['Equilibrado', true, ['bus', 'solar_s', 'battery', 'lga', 'engine', 'tank', 'spectrometer', 'camera']],
    ['Sin tanque', false, ['bus', 'solar_s', 'battery', 'lga', 'engine', 'spectrometer', 'camera']],
  ],
  mars: [
    ['Ligero (Falcon 9)', true, ['bus', 'solar_s', 'solar_s', 'battery', 'hga', 'engine', 'tank', 'spectrometer', 'camera']],
    ['Completo (Falcon Heavy)', true, ['bus', 'solar_l', 'battery', 'hga', 'engine', 'tank', 'tank', 'spectrometer', 'camera']],
    ['Sólo antena LGA', false, ['bus', 'solar_l', 'battery', 'lga', 'engine', 'tank', 'tank', 'spectrometer', 'camera']],
    ['Un panel pequeño', false, ['bus', 'solar_s', 'battery', 'hga', 'engine', 'tank', 'tank', 'spectrometer', 'camera']],
  ],
  jupiter: [
    ['RTG x2 (Cassini)', true, ['bus', 'rtg', 'rtg', 'hga', 'engine', 'tank', 'tank', 'magnetometer', 'spectrometer']],
    ['Solar x4 (Juno)', true, ['bus', 'solar_l', 'solar_l', 'solar_l', 'solar_l', 'hga', 'engine', 'tank', 'tank', 'tank', 'magnetometer', 'spectrometer']],
    ['Solar grande x2', false, ['bus', 'solar_l', 'solar_l', 'hga', 'engine', 'tank', 'tank', 'magnetometer', 'spectrometer']],
    ['Un solo tanque', false, ['bus', 'rtg', 'rtg', 'hga', 'engine', 'tank', 'magnetometer', 'spectrometer']],
    ['Con cámara', false, ['bus', 'rtg', 'rtg', 'hga', 'engine', 'tank', 'tank', 'camera', 'spectrometer']],
  ],
};

const today = new Date();
let broken = 0;

for (const mission of missions) {
  const env = offlineEnv(mission.body, today);
  console.log(`\n■ ${mission.name}  (Sol ${env.sunDistanceAU.toFixed(2)} UA · Tierra ${env.earthDistanceAU.toFixed(4)} UA · presupuesto ${fmtMoney(mission.budget)})`);
  for (const [name, expected, ids] of designs[mission.id] ?? []) {
    const design: Design = Object.fromEntries(ids.map((id, i) => [`s${i}`, id]));
    const s = computeStats(design, catalog, mission, env, rockets);
    const cheapest = s.rockets.filter((r) => r.fitsMass && r.affordable).sort((a, b) => a.rocket.cost - b.rocket.cost)[0];
    const failed = s.checks.filter((c) => !c.ok).map((c) => c.id);
    const sciOk = s.science >= mission.minScience;
    const pass = failed.length === 0 && sciOk;
    const flag = pass === expected ? 'OK ' : '¡¡ROTO!!';
    if (pass !== expected) broken++;
    console.log(
      `  ${flag} ${name.padEnd(22)} masa ${String(Math.round(s.wetMass)).padStart(5)} kg | ` +
      `nave ${fmtMoney(s.craftCost).padStart(8)} | cohete ${(cheapest?.rocket.name ?? '—').padEnd(12)} | ` +
      `E ${Math.round(s.powerGen)}/${Math.round(s.powerDraw)} W | bat ${s.batteryWh}/${Math.ceil(s.eclipseNeedWh)} Wh | ` +
      `Δv ${Math.round(s.deltaV)}/${mission.deltaVRequired} | datos ${(s.dataRatio * 100).toFixed(0)}% | ` +
      `ciencia ${s.science.toFixed(0)}/${mission.minScience}` + (failed.length ? `  ✗ ${failed.join(',')}` : ''),
    );
  }
}

console.log(broken ? `\n${broken} diseño(s) con balance roto.` : '\nBalance correcto: todos los diseños se comportan como se espera.');
process.exit(broken ? 1 : 0);
