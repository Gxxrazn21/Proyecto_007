/**
 * MenuScene: portada con la Tierra, una nave en órbita, la imagen
 * astronómica del día (APOD) y el estado de la conexión con la NASA.
 */
import Phaser from 'phaser';
import { C } from '../art/palette';
import { GameState } from '../state/GameState';
import { buildCraft } from '../ui/craft';
import { Button, drawPanel, fadeIn, goTo, panel, prefersReducedMotion, shade, starfield, text } from '../ui/ui';
import { VIEW } from '../ui/view';

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
    const earth = this.add.image(VIEW.right - 80, 290, 'pl-earth-xl');
    this.tweens.add({ targets: earth, angle: 360, duration: 600_000, repeat: -1 });

    // Nave orbitando sobre el horizonte.
    const cx = Math.round((VIEW.right + 200) / 2);
    const craft = buildCraft(this, cx - 20, 120, DEMO_CRAFT);
    this.tweens.add({ targets: craft, x: cx + 20, y: 108, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
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

    text(this, 24, 258, 'NASA Space Apps Challenge 2026', { color: 'rivet' });
    this.fullscreenButton();
    this.shootingStars();
  }

  /** Línea que dice si estamos usando datos en vivo o el respaldo offline. */
  private dataStatus(): void {
    const t = text(this, 24, 192, 'Conectando con la NASA…', { color: 'steel' });
    const dot = this.add.rectangle(18, 196, 3, 3, C.steel);
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
      panel(this, 18, 208, 196, 44, 'hull', 'rivet');
      text(this, 26, 214, 'Imagen astronómica del día · APOD', { color: 'steel' });
      text(this, 26, 225, a.title, { wrap: 140 });
      new Button(this, 172, 228, 34, 14, 'Ver', () => window.open(a.url, '_blank', 'noopener'));
    });
  }

  private openModal(title: string, body: string): void {
    this.modal?.destroy();
    const c = this.add.container(0, 0).setDepth(10);
    const bg = shade(this);
    const p = this.add.graphics();
    drawPanel(p, 60, 24, 360, 222, 'hull', 'steel');
    const t1 = text(this, 74, 34, title, { font: 'title', size: 16, color: 'foilLt' });
    const t2 = text(this, 74, 58, body, { wrap: 332, lineSpacing: 3 });
    const close = new Button(this, 340, 222, 70, 16, 'Cerrar', () => c.destroy(), 'primary');
    c.add([bg, p, t1, t2, close]);
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

  /** Pantalla completa (Android y PC): más espacio = texto más grande. */
  private fullscreenButton(): void {
    if (!this.sys.game.device.fullscreen.available) return;
    const b = new Button(this, 24, 170, 120, 14, this.scale.isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa', () => {
      if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
      } else {
        this.scale.startFullscreen();
        // En móviles, fijar la orientación horizontal (si el navegador lo permite).
        (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape').catch(() => undefined);
      }
    }, 'ghost');
    this.scale.on('enterfullscreen', () => b.active && b.setText('Salir de pantalla completa'));
    this.scale.on('leavefullscreen', () => b.active && b.setText('Pantalla completa'));
  }

  /** Una estrella fugaz de vez en cuando: el único adorno animado del menú. */
  private shootingStars(): void {
    if (prefersReducedMotion()) return;
    const launch = () => {
      const x = Phaser.Math.Between(VIEW.left + 140, VIEW.right - 40);
      const star = this.add.rectangle(x, 20, 6, 1, C.frost).setAngle(-28).setAlpha(0);
      this.tweens.add({
        targets: star, x: x - 70, y: 58, alpha: { from: 1, to: 0 }, duration: 700, ease: 'Quad.in',
        onComplete: () => star.destroy(),
      });
    };
    this.time.addEvent({ delay: 5200, loop: true, callback: launch });
  }
}
