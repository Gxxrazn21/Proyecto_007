/**
 * MenuScene: portada con la Tierra, una nave en órbita, la imagen
 * astronómica del día (APOD) y el estado de la conexión con la NASA.
 */
import Phaser from 'phaser';
import { C } from '../art/palette';
import { GameState } from '../state/GameState';
import { buildCraft } from '../ui/craft';
import { Button, drawPanel, fadeIn, goTo, panel, starfield, text } from '../ui/ui';

const DEMO_CRAFT = { core: 'bus', pwr1: 'solar_s', pwr2: 'solar_s', ant1: 'hga', eng: 'engine', ins1: 'camera', ins2: 'magnetometer' };

export class MenuScene extends Phaser.Scene {
  private modal?: Phaser.GameObjects.Container;

  constructor() {
    super('Menu');
  }

  create(): void {
    fadeIn(this);
    starfield(this, 0.03);

    // Tierra gigante en la esquina, girando muy despacio.
    const earth = this.add.image(400, 290, 'pl-earth-xl');
    this.tweens.add({ targets: earth, angle: 360, duration: 600_000, repeat: -1 });

    // Nave orbitando sobre el horizonte.
    const craft = buildCraft(this, 300, 120, DEMO_CRAFT);
    this.tweens.add({ targets: craft, x: 340, y: 108, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: craft, angle: 4, duration: 5000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // Título
    text(this, 25, 33, 'Misión Órbita', { font: 'title', size: 32, color: 'foilDk' }).setFontStyle('bold');
    text(this, 24, 32, 'Misión Órbita', { font: 'title', size: 32, color: 'foilLt' }).setFontStyle('bold');
    text(this, 24, 70, 'Diseña, lanza y opera tu propia nave\ncon datos reales de la NASA.', { color: 'frost', lineSpacing: 3 });

    new Button(this, 24, 104, 120, 18, 'Nueva misión', () => goTo(this, 'Briefing'), 'primary');
    new Button(this, 24, 128, 120, 16, 'Cómo se juega', () => this.showHowTo());
    new Button(this, 24, 150, 120, 16, 'Datos y créditos', () => this.showCredits());

    this.dataStatus();
    this.apodCard();

    text(this, 476, 260, 'NASA Space Apps Challenge 2026', { align: 'right', color: 'rivet' });
  }

  /** Línea que dice si estamos usando datos en vivo o el respaldo offline. */
  private dataStatus(): void {
    const t = text(this, 24, 178, 'Conectando con la NASA…', { color: 'steel' });
    const dot = this.add.rectangle(18, 182, 3, 3, C.steel);
    GameState.feeds?.then((f) => {
      const live = f.flares[0]?.source === 'donki';
      t.setText(live ? 'Datos de la NASA en vivo' : 'Sin conexión: usando datos históricos reales');
      t.setColor(live ? '#7fd46b' : '#efc65c');
      dot.setFillStyle(live ? C.ok : C.foilLt);
    });
  }

  /** Imagen astronómica del día: se abre en una pestaña nueva. */
  private apodCard(): void {
    GameState.apod?.then((a) => {
      if (!a.url) return;
      panel(this, 18, 206, 196, 44, 'hull', 'rivet');
      text(this, 26, 212, 'Imagen astronómica del día · APOD', { color: 'steel' });
      text(this, 26, 223, a.title, { wrap: 140 });
      new Button(this, 172, 226, 34, 14, 'Ver', () => window.open(a.url, '_blank', 'noopener'));
    });
  }

  private openModal(title: string, body: string): void {
    this.modal?.destroy();
    const c = this.add.container(0, 0).setDepth(10);
    const shade = this.add.rectangle(0, 0, 480, 270, C.space, 0.85).setOrigin(0).setInteractive();
    const p = this.add.graphics();
    drawPanel(p, 60, 24, 360, 222, 'hull', 'steel');
    const t1 = text(this, 74, 34, title, { font: 'title', size: 16, color: 'foilLt' });
    const t2 = text(this, 74, 58, body, { wrap: 332, lineSpacing: 3 });
    const close = new Button(this, 340, 222, 70, 16, 'Cerrar', () => c.destroy(), 'primary');
    c.add([shade, p, t1, t2, close]);
    this.modal = c;
  }

  private showHowTo(): void {
    this.openModal(
      'Cómo se juega',
      [
        '1. Briefing: elige un objetivo. Cada uno tiene presupuesto, Δv requerido y ciencia mínima.',
        '2. Taller: arrastra módulos a la nave (o tócalos y luego toca una ranura). Mira las barras: masa, energía, presupuesto, datos, Δv y ciencia cambian con cada pieza.',
        '3. Lanzamiento: elige un cohete. Si la nave pesa más de lo que puede llevar, el lanzamiento falla.',
        '4. Operación: llegan eventos reales (llamaradas de DONKI, asteroides de NeoWs…). Decide rápido: tienes pocos segundos.',
        '5. Reporte: verás qué decisión causó cada resultado y qué hicieron las misiones reales.',
        '',
        'Truco: en el espacio todo es un compromiso. Cada kilo cuesta, cada vatio cuenta.',
      ].join('\n'),
    );
  }

  private showCredits(): void {
    this.openModal(
      'Datos y créditos',
      [
        'Clima espacial: NASA DONKI (llamaradas, CME, tormentas geomagnéticas).',
        'Asteroides: NASA NeoWs. Imagen del día: NASA APOD.',
        'Distancias planetarias: JPL Horizons; sin conexión, elementos keplerianos aproximados de JPL (E. M. Standish).',
        'Masas, potencias y cohetes: cifras públicas de NASA, JPL y SpaceX, redondeadas para el juego (ver docs/DATOS.md).',
        '',
        'Hecho para el NASA Space Apps Challenge 2026 — reto "Space Mission Design Game".',
        'Fuentes tipográficas: Pixelify Sans y Tiny5 (SIL Open Font License).',
      ].join('\n'),
    );
  }
}
