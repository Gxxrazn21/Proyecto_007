/**
 * Ranuras de la nave en el Taller. Posiciones relativas al centro del bus,
 * en píxeles de la resolución base (480×270).
 *
 * Para cambiar la forma de la nave, edita sólo esta lista.
 */
import type { SlotDef } from '../types';

export const SLOTS: SlotDef[] = [
  { id: 'core', accepts: ['bus'], x: 0, y: 0, label: 'Bus' },
  { id: 'pwr1', accepts: ['power'], x: -37, y: 0, label: 'Energía' },
  { id: 'pwr2', accepts: ['power'], x: 37, y: 0, label: 'Energía' },
  { id: 'pwr3', accepts: ['power'], x: -79, y: 0, label: 'Energía' },
  { id: 'pwr4', accepts: ['power'], x: 79, y: 0, label: 'Energía' },
  { id: 'ant1', accepts: ['comms'], x: 0, y: -27, label: 'Antena' },
  { id: 'ant2', accepts: ['comms'], x: 22, y: -26, label: 'Antena' },
  { id: 'ins3', accepts: ['instrument'], x: -22, y: -24, label: 'Instrumento' },
  { id: 'eng', accepts: ['propulsion'], x: 0, y: 23, label: 'Motor' },
  { id: 'ins1', accepts: ['instrument'], x: -22, y: 22, label: 'Instrumento' },
  { id: 'ins2', accepts: ['instrument'], x: 22, y: 22, label: 'Instrumento' },
  // Compartimento interno: se dibuja como una bahía debajo de la nave.
  { id: 'int1', accepts: ['storage', 'tank'], x: -36, y: 66, label: 'Interno' },
  { id: 'int2', accepts: ['storage', 'tank'], x: -12, y: 66, label: 'Interno' },
  { id: 'int3', accepts: ['storage', 'tank'], x: 12, y: 66, label: 'Interno' },
  { id: 'int4', accepts: ['storage', 'tank'], x: 36, y: 66, label: 'Interno' },
];

/** Ranuras que se ven por fuera (las internas no se dibujan en vuelo). */
export const EXTERNAL = SLOTS.filter((s) => !s.id.startsWith('int'));

/** Orden de dibujo: lo que va detrás primero (paneles), el bus encima. */
export const DRAW_ORDER = ['pwr3', 'pwr4', 'pwr1', 'pwr2', 'ant1', 'ant2', 'ins3', 'eng', 'core', 'ins1', 'ins2'];
