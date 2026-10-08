/**
 * Dibuja la nave completa a partir de un diseño (ranura → módulo).
 * La usan el Taller (vista previa), el Lanzamiento y la Operación.
 */
import Phaser from 'phaser';
import { C } from '../art/palette';
import { DRAW_ORDER, SLOTS } from '../systems/slots';
import type { Design } from '../types';

export function buildCraft(scene: Phaser.Scene, x: number, y: number, design: Design): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  if (!design.core) return c;

  // Brazos que unen las alas de energía con el bus.
  const g = scene.add.graphics();
  for (const id of ['pwr1', 'pwr2', 'pwr3', 'pwr4']) {
    if (!design[id]) continue;
    const s = SLOTS.find((sl) => sl.id === id)!;
    g.fillStyle(C.steel).fillRect(Math.min(0, s.x), -1, Math.abs(s.x), 2);
  }
  c.add(g);

  for (const id of DRAW_ORDER) {
    const mod = design[id];
    if (!mod) continue;
    const s = SLOTS.find((sl) => sl.id === id)!;
    const img = scene.add.image(s.x, s.y, `mod-${mod}`);
    // El magnetómetro de la izquierda apunta hacia afuera.
    if (mod === 'magnetometer' && s.x < 0) img.setFlipX(true);
    c.add(img);
  }
  return c;
}
