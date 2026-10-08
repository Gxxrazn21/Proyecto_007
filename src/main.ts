/**
 * Punto de entrada. Configura Phaser en pixel art y registra las escenas.
 *
 * Responsive (ver ui/view.ts): altura base 270 px, ancho de 480 a 640 px
 * según la forma de la pantalla, y escala entera cuando no desperdicia espacio.
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
import { BASE_H, VIEW, cssZoom, idealWidth, setViewWidth } from './ui/view';

const parent = document.getElementById('game')!;
setViewWidth(idealWidth());

function fitParent(): void {
  const z = cssZoom(VIEW.width);
  parent.style.width = `${Math.floor(VIEW.width * z)}px`;
  parent.style.height = `${Math.floor(BASE_H * z)}px`;
}
fitParent();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  width: VIEW.width,
  height: BASE_H,
  backgroundColor: '#0f1330',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [BootScene, MenuScene, BriefingScene, WorkshopScene, LaunchScene, OperationsScene, ResultsScene],
});

/** Al girar el teléfono o cambiar el tamaño de la ventana. */
function onResize(): void {
  const w = idealWidth();
  if (w !== VIEW.width) {
    setViewWidth(w);
    game.scale.resize(w, BASE_H);
    // Las escenas de menú se redibujan con el nuevo ancho. Las escenas con una
    // partida en curso (lanzamiento, operación) no se reinician: sólo se centran.
    for (const s of game.scene.getScenes(true)) {
      if (['Launch', 'Operations'].includes(s.scene.key)) s.cameras.main.setScroll(VIEW.left, s.cameras.main.scrollY);
      else if (s.scene.key !== 'Boot') s.scene.restart();
    }
  }
  fitParent();
  game.scale.refresh();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 200));

// Acceso para depurar desde la consola del navegador: window.game
(window as unknown as { game: Phaser.Game }).game = game;
