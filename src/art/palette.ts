/**
 * Paleta oficial del juego (20 colores). TODO el arte y la UI usan sólo estos.
 * Los artistas deben dibujar con esta paleta para mantener la coherencia.
 *
 * Idea: el oro de la manta térmica (MLI) de las naves reales es la firma
 * visual. Se reserva para la nave y para la acción principal de cada pantalla.
 */
export const PAL = {
  // Cielo y estructura de la interfaz
  space: '#0f1330',
  hull: '#1b2250',
  rivet: '#2e3a78',
  steel: '#6c7bbd',
  frost: '#e2e6f6',
  // Oro de la manta térmica (firma visual)
  foilDk: '#6e4212',
  foil: '#c2852b',
  foilLt: '#efc65c',
  foilHi: '#fff2b3',
  // Celdas solares y datos
  cellDk: '#1a3a86',
  cell: '#3f72d8',
  signal: '#5ad6c6',
  // Estados
  ok: '#7fd46b',
  alert: '#ff6a4d',
  // Cuerpos celestes
  ocean: '#2b5fb2',
  land: '#3f9a52',
  moon: '#aaa6a1',
  moonDk: '#6d6a69',
  mars: '#c1542d',
  jove: '#d9a46c',
} as const;

export type PalKey = keyof typeof PAL;

/** Color como número (0xRRGGBB) para la API de Phaser. */
export const C = Object.fromEntries(
  Object.entries(PAL).map(([k, v]) => [k, parseInt(v.slice(1), 16)]),
) as Record<PalKey, number>;

/** Fuentes (empaquetadas con @fontsource, funcionan offline). */
export const FONT = {
  title: '"Pixelify Sans"',
  ui: '"Tiny5"',
} as const;
