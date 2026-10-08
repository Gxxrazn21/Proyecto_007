/**
 * BootScene: carga datos JSON y fuentes, genera el arte y pide los datos de
 * la NASA en segundo plano (el juego no espera por ellos).
 */
import Phaser from 'phaser';
import { registerArt } from '../art/sprites';
import { C } from '../art/palette';
import { GameState } from '../state/GameState';
import { getApod, getFeeds } from '../services/nasa';
import { text } from '../ui/ui';
import { frameCamera } from '../ui/view';
import type { EventDef, Mission, ModuleDef, Rocket } from '../types';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    frameCamera(this);
    const bar = this.add.graphics();
    this.load.on('progress', (v: number) => {
      bar.clear().fillStyle(C.rivet).fillRect(190, 140, 100, 3).fillStyle(C.foilLt).fillRect(190, 140, 100 * v, 3);
    });
    // Datos de balance: edítalos sin tocar código.
    this.load.json('missions', 'data/missions.json');
    this.load.json('modules', 'data/modules.json');
    this.load.json('rockets', 'data/rockets.json');
    this.load.json('events', 'data/events.json');
    // Arte final: cuando existan los PNG, cárgalos aquí con la misma clave
    // que el placeholder (p. ej. this.load.image('mod-rtg', 'assets/rtg.png')).
  }

  async create(): Promise<void> {
    const modules = this.cache.json.get('modules').modules as ModuleDef[];
    GameState.db = {
      missions: this.cache.json.get('missions').missions as Mission[],
      modules,
      rockets: this.cache.json.get('rockets').rockets as Rocket[],
      events: this.cache.json.get('events').events as EventDef[],
      catalog: new Map(modules.map((m) => [m.id, m])),
    };

    // Datos de la NASA en segundo plano (con respaldo offline).
    GameState.feeds = getFeeds();
    GameState.apod = getApod();

    // Las fuentes web deben estar listas antes de dibujar texto en el canvas.
    await Promise.all([
      document.fonts.load('8px "Tiny5"', 'Aá Δ'),
      document.fonts.load('16px "Pixelify Sans"'),
      document.fonts.load('bold 16px "Pixelify Sans"'),
    ]).catch(() => undefined);

    registerArt(this);
    this.anims.create({ key: 'flame', frames: this.anims.generateFrameNumbers('fx-flame', { start: 0, end: 2 }), frameRate: 14, repeat: -1 });
    this.anims.create({ key: 'boom', frames: this.anims.generateFrameNumbers('fx-boom', { start: 0, end: 4 }), frameRate: 10 });

    text(this, 240, 124, 'Preparando la sala limpia…', { align: 'center', color: 'steel' });
    this.time.delayedCall(150, () => this.scene.start('Menu'));
  }
}
