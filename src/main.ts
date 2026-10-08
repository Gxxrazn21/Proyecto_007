/**
 * Punto de entrada. Configura Phaser a 480×270 sin suavizado y registra las escenas.
 *
 * Escalado: en pantallas grandes se usa un múltiplo ENTERO (×2, ×3, ×4…) para
 * que cada píxel del arte sea un cuadrado perfecto. En móviles (donde no cabe
 * ×2) se ajusta al tamaño disponible.
 */
import Phaser from 'phaser';
import '@fontsource/tiny5';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';

import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { BriefingScene } from './scenes/BriefingScene';
import { WorkshopScene } from './scenes/WorkshopScene';
import { LaunchScene } from './scenes/LaunchScene';
import { OperationsScene } from './scenes/OperationsScene';
import { ResultsScene } from './scenes/ResultsScene';

export const WIDTH = 480;
export const HEIGHT = 270;

const parent = document.getElementById('game')!;

function fitParent(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let zoom = Math.min(vw / WIDTH, vh / HEIGHT);
  if (zoom >= 2) zoom = Math.floor(zoom); // píxeles perfectos
  parent.style.width = `${Math.floor(WIDTH * zoom)}px`;
  parent.style.height = `${Math.floor(HEIGHT * zoom)}px`;
}
fitParent();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#0f1330',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [BootScene, MenuScene, BriefingScene, WorkshopScene, LaunchScene, OperationsScene, ResultsScene],
});

window.addEventListener('resize', () => {
  fitParent();
  game.scale.refresh();
});

// Acceso para depurar desde la consola del navegador: window.game
(window as unknown as { game: Phaser.Game }).game = game;
