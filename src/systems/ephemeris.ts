/**
 * Efemérides OFFLINE: posición aproximada de los planetas para cualquier fecha.
 *
 * Se usa cuando JPL Horizons no responde (sin internet, CORS, límite de uso).
 * Fuente: "Keplerian Elements for Approximate Positions of the Major Planets",
 * E. M. Standish, JPL/Caltech — Tabla 1 (válida 1800–2050).
 * https://ssd.jpl.nasa.gov/planets/approx_pos.html
 *
 * Precisión: unas milésimas de UA. Más que suficiente para la física del juego.
 */
import type { Body, EnvData } from '../types';

interface Elements {
  /** [valor en J2000, tasa por siglo] */
  a: [number, number]; // semieje mayor (UA)
  e: [number, number]; // excentricidad
  I: [number, number]; // inclinación (°)
  L: [number, number]; // longitud media (°)
  w: [number, number]; // longitud del perihelio ϖ (°)
  O: [number, number]; // longitud del nodo ascendente Ω (°)
}

const ELEMENTS: Record<'earth' | 'mars' | 'jupiter', Elements> = {
  // Baricentro Tierra-Luna
  earth: {
    a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668],
    L: [100.46457166, 35999.37244981], w: [102.93768193, 0.32327364], O: [0, 0],
  },
  mars: {
    a: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882], I: [1.84969142, -0.00813131],
    L: [-4.55343205, 19140.30268499], w: [-23.94362959, 0.44441088], O: [49.55953891, -0.29257343],
  },
  jupiter: {
    a: [5.202887, -0.00011607], e: [0.04838624, -0.00013253], I: [1.30439695, -0.00183714],
    L: [34.39644051, 3034.74612775], w: [14.72847983, 0.21252668], O: [100.47390909, 0.20469106],
  },
};

/** Distancia media Tierra–Luna en UA (384 400 km). */
const MOON_AU = 0.00257;
/** Órbita heliosincrónica de 705 km ≈ 7 080 km del centro de la Tierra, en UA. */
const LEO_AU = 7080 / 149_597_870.7;

const RAD = Math.PI / 180;

/** Posición heliocéntrica eclíptica (UA) de un planeta en una fecha. */
export function heliocentric(planet: keyof typeof ELEMENTS, date: Date): [number, number, number] {
  const jd = date.getTime() / 86_400_000 + 2_440_587.5;
  const T = (jd - 2_451_545.0) / 36_525;
  const el = ELEMENTS[planet];
  const v = (k: keyof Elements) => el[k][0] + el[k][1] * T;

  const a = v('a');
  const e = v('e');
  const I = v('I') * RAD;
  const L = v('L');
  const varpi = v('w');
  const Omega = v('O');
  const omega = (varpi - Omega) * RAD;
  const O = Omega * RAD;

  // Anomalía media normalizada a [-180, 180]
  let M = ((L - varpi) % 360 + 540) % 360 - 180;
  M *= RAD;

  // Ecuación de Kepler: E − e·sin(E) = M  (Newton-Raphson)
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 10; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-10) break;
  }

  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

  const cw = Math.cos(omega), sw = Math.sin(omega);
  const cO = Math.cos(O), sO = Math.sin(O);
  const cI = Math.cos(I), sI = Math.sin(I);

  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ];
}

/** Distancias al Sol y a la Tierra del destino de la misión. */
export function offlineEnv(body: Body, date = new Date()): EnvData {
  const earth = heliocentric('earth', date);
  const rEarth = norm(earth);
  const iso = date.toISOString().slice(0, 10);

  if (body === 'earth') return { sunDistanceAU: rEarth, earthDistanceAU: LEO_AU, date: iso, source: 'offline' };
  if (body === 'moon') return { sunDistanceAU: rEarth, earthDistanceAU: MOON_AU, date: iso, source: 'offline' };

  const p = heliocentric(body, date);
  const delta = norm([p[0] - earth[0], p[1] - earth[1], p[2] - earth[2]]);
  return { sunDistanceAU: norm(p), earthDistanceAU: delta, date: iso, source: 'offline' };
}

function norm(v: [number, number, number]): number {
  return Math.hypot(v[0], v[1], v[2]);
}
