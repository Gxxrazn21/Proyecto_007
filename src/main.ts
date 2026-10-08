/**
 * Punto de entrada. Configura Phaser y registra las escenas.
 *
 * Nitidez y responsive (ver ui/view.ts): el lienzo tiene la resolución física
 * de la pantalla y cada escena amplía su cámara VIEW.zoom veces.
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
import { VIEW, canvasSize, frameCamera, updateView } from './ui/view';

const parent = document.getElementById('game')!;
updateView();

function fitParent(): void {
  parent.style.width = `${VIEW.cssW}px`;
  parent.style.height = `${VIEW.cssH}px`;
}
fitParent();

const [cw, ch] = canvasSize();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  width: cw,
  height: ch,
  backgroundColor: '#0f1330',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE, zoom: VIEW.cssW / cw },
  input: { activePointers: 2 },
  scene: [BootScene, MenuScene, BriefingScene, WorkshopScene, LaunchScene, OperationsScene, ResultsScene],
});

/** Al girar el teléfono o cambiar el tamaño de la ventana. */
function onResize(): void {
  if (!updateView()) return;
  fitParent();
  const [w, h] = canvasSize();
  game.scale.resize(w, h);
  game.scale.setZoom(VIEW.cssW / w);
  for (const s of game.scene.getScenes(true)) {
    // Una partida en curso no se reinicia: sólo se reencuadra la cámara.
    if (['Launch', 'Operations'].includes(s.scene.key)) frameCamera(s, s.cameras.main.midPoint.y);
    else if (s.scene.key !== 'Boot') s.scene.restart();
  }
}
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(onResize, 120);
});

// Acceso para depurar desde la consola del navegador: window.game
(window as unknown as { game: Phaser.Game }).game = game;
