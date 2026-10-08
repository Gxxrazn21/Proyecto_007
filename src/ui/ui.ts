/**
 * Kit de interfaz: textos, paneles, botones, medidores y tarjetas.
 * Todas las escenas usan SOLO estas piezas para mantener un estilo único.
 */
import Phaser from 'phaser';
import { C, FONT, PAL, type PalKey } from '../art/palette';

/* ------------------------------------------------------------------ */
/* Texto                                                                */
/* ------------------------------------------------------------------ */

export interface TextOpts {
  size?: number;
  color?: PalKey;
  font?: 'ui' | 'title';
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  lineSpacing?: number;
}

/** Texto pixelado. Tamaños recomendados: ui 8 (normal) / 16; title 16 / 32. */
export function text(scene: Phaser.Scene, x: number, y: number, str: string, o: TextOpts = {}): Phaser.GameObjects.Text {
  const font = o.font ?? 'ui';
  const t = scene.add.text(Math.round(x), Math.round(y), str, {
    fontFamily: FONT[font],
    fontSize: `${o.size ?? (font === 'ui' ? 8 : 16)}px`,
    color: PAL[o.color ?? 'frost'],
    align: o.align ?? 'left',
    lineSpacing: o.lineSpacing ?? (font === 'ui' ? 2 : 0),
    wordWrap: o.wrap ? { width: o.wrap, useAdvancedWrap: true } : undefined,
  });
  if (o.align === 'center') t.setOrigin(0.5, 0);
  if (o.align === 'right') t.setOrigin(1, 0);
  return t;
}

/* ------------------------------------------------------------------ */
/* Paneles con esquinas achaflanadas (como placas de una nave)          */
/* ------------------------------------------------------------------ */

export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number,
  fill: PalKey = 'hull', border: PalKey = 'rivet', chamfer = 3,
): void {
  const pts = [
    [x + chamfer, y], [x + w - chamfer, y], [x + w, y + chamfer], [x + w, y + h - chamfer],
    [x + w - chamfer, y + h], [x + chamfer, y + h], [x, y + h - chamfer], [x, y + chamfer],
  ].map(([a, b]) => new Phaser.Math.Vector2(a, b));
  g.fillStyle(C[border]).fillPoints(pts, true);
  const inner = [
    [x + chamfer, y + 1], [x + w - chamfer, y + 1], [x + w - 1, y + chamfer], [x + w - 1, y + h - chamfer],
    [x + w - chamfer, y + h - 1], [x + chamfer, y + h - 1], [x + 1, y + h - chamfer], [x + 1, y + chamfer],
  ].map(([a, b]) => new Phaser.Math.Vector2(a, b));
  g.fillStyle(C[fill]).fillPoints(inner, true);
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill: PalKey = 'hull', border: PalKey = 'rivet'): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawPanel(g, x, y, w, h, fill, border);
  return g;
}

/* ------------------------------------------------------------------ */
/* Botón                                                                */
/* ------------------------------------------------------------------ */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private enabled = true;
  private hover = false;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    public readonly bw: number, public readonly bh: number,
    str: string,
    private onClick: () => void,
    private variant: ButtonVariant = 'secondary',
  ) {
    super(scene, x, y);
    this.bg = scene.add.graphics();
    this.label = text(scene, bw / 2, Math.round(bh / 2 - 5), str, { align: 'center', size: 8 });
    this.add([this.bg, this.label]);
    // Área táctil ampliada 4 px por lado: más fácil de tocar en móvil.
    // (Sin setSize: así el área se mide desde la esquina, no desde el centro.)
    this.setInteractive(new Phaser.Geom.Rectangle(-4, -4, bw + 8, bh + 8), Phaser.Geom.Rectangle.Contains);
    this.input!.cursor = 'pointer';
    this.on('pointerover', () => { this.hover = true; this.redraw(); });
    this.on('pointerout', () => { this.hover = false; this.redraw(); });
    this.on('pointerdown', () => this.enabled && this.setY(this.y + 1));
    this.on('pointerup', () => {
      if (!this.enabled) return;
      this.setY(this.y - 1);
      this.onClick();
    });
    this.redraw();
    scene.add.existing(this);
  }

  setText(str: string): this {
    this.label.setText(str);
    return this;
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.redraw();
    return this;
  }

  private redraw(): void {
    const g = this.bg.clear();
    const { bw: w, bh: h } = this;
    const v = this.enabled ? this.variant : 'ghost';
    const scheme: Record<ButtonVariant, [PalKey, PalKey, PalKey, PalKey]> = {
      // [relleno, borde, texto, relleno en hover]
      primary: ['foil', 'foilDk', 'space', 'foilLt'],
      secondary: ['rivet', 'steel', 'frost', 'steel'],
      ghost: ['hull', 'rivet', 'steel', 'hull'],
      danger: ['alert', 'foilDk', 'space', 'foilLt'],
    };
    const [fill, border, color, hover] = scheme[v];
    drawPanel(g, 0, 0, w, h, this.hover && this.enabled ? hover : fill, border, 2);
    if (v === 'primary') g.fillStyle(C.foilHi).fillRect(2, 1, w - 4, 1); // brillo del oro
    this.label.setColor(PAL[color]);
  }
}

/* ------------------------------------------------------------------ */
/* Medidor de recurso (barra con marcas)                                */
/* ------------------------------------------------------------------ */

export interface GaugeMark {
  value: number;
  label: string;
  color?: PalKey;
}

export class Gauge extends Phaser.GameObjects.Container {
  private g: Phaser.GameObjects.Graphics;
  private valueText: Phaser.GameObjects.Text;
  private shown = 0;
  private target = 0;
  private max = 1;
  private fill: PalKey = 'ok';
  private marks: GaugeMark[] = [];
  private markLabels: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, private barW: number, icon: string, title: string) {
    super(scene, x, y);
    this.g = scene.add.graphics();
    this.add([
      scene.add.image(0, 0, `ic-${icon}`).setOrigin(0),
      text(scene, 10, -2, title, { color: 'steel' }),
    ]);
    this.valueText = text(scene, barW, -2, '', { align: 'right' });
    this.add([this.g, this.valueText]);
    scene.add.existing(this);
  }

  /**
   * value: valor actual · max: escala de la barra · fill: color según el estado
   * marks: líneas de referencia (capacidad de cada cohete, mínimo requerido…)
   */
  set(value: number, max: number, label: string, fill: PalKey, marks: GaugeMark[] = []): void {
    this.target = value;
    this.max = Math.max(max, 1e-9);
    this.fill = fill;
    this.valueText.setText(label).setColor(PAL[fill === 'ok' || fill === 'signal' ? 'frost' : fill]);
    this.marks = marks;
    this.markLabels.forEach((t) => t.destroy());
    // Etiquetas de las marcas, saltando las que se solaparían.
    let lastRight = -Infinity;
    this.markLabels = [];
    for (const m of [...marks].sort((a, b) => a.value - b.value)) {
      if (!m.label) continue;
      const x = Math.round(Math.min(1, m.value / this.max) * (this.barW - 1));
      const t = text(this.scene, x, 18, m.label, { color: m.color ?? 'steel', align: 'center' });
      t.setX(Phaser.Math.Clamp(x, t.width / 2, this.barW - t.width / 2));
      if (t.x - t.width / 2 < lastRight + 3) { t.destroy(); continue; }
      lastRight = t.x + t.width / 2;
      this.add(t);
      this.markLabels.push(t);
    }
  }

  preUpdate(): void {
    // Animación suave de la barra hacia el valor nuevo.
    this.shown += (this.target - this.shown) * 0.25;
    if (Math.abs(this.target - this.shown) < this.max * 0.001) this.shown = this.target;
    const g = this.g.clear();
    const y = 9;
    g.fillStyle(C.space).fillRect(0, y, this.barW, 8);
    g.fillStyle(C.rivet).fillRect(0, y + 8, this.barW, 1);
    const fw = Math.round(Math.min(1, Math.max(0, this.shown / this.max)) * (this.barW - 2));
    g.fillStyle(C[this.fill]).fillRect(1, y + 1, fw, 6);
    g.fillStyle(C.frost, 0.35).fillRect(1, y + 1, fw, 1);
    // Exceso: rayas sobre toda la barra
    if (this.shown > this.max) for (let i = 2; i < this.barW; i += 4) g.fillStyle(C.space).fillRect(i, y + 2, 1, 4);
    for (const m of this.marks) {
      const x = Math.round(Math.min(1, m.value / this.max) * (this.barW - 1));
      g.fillStyle(C[m.color ?? 'frost']).fillRect(x, y - 1, 1, 10);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                           */
/* ------------------------------------------------------------------ */

/** Fondo estándar: estrellas + leve desplazamiento (parallax). */
export function starfield(scene: Phaser.Scene, drift = 0.02): Phaser.GameObjects.TileSprite {
  const t = scene.add.tileSprite(0, 0, 480, 270, 'bg-stars').setOrigin(0);
  scene.events.on('update', () => (t.tilePositionX += drift));
  return t;
}

/** Transición entre escenas con cortina. */
export function goTo(scene: Phaser.Scene, key: string, data?: object): void {
  scene.cameras.main.fadeOut(180, 15, 19, 48);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}

export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(220, 15, 19, 48);
}

/** Barra superior común: título de la fase + migas del flujo de juego. */
export function header(scene: Phaser.Scene, step: number, title: string): void {
  const g = scene.add.graphics();
  g.fillStyle(C.hull).fillRect(0, 0, 480, 15);
  g.fillStyle(C.rivet).fillRect(0, 15, 480, 1);
  text(scene, 6, 3, title, { color: 'frost' });
  const steps = ['Briefing', 'Taller', 'Lanzamiento', 'Operación', 'Reporte'];
  let x = 474;
  for (let i = steps.length - 1; i >= 0; i--) {
    const active = i === step;
    const done = i < step;
    const t = text(scene, x, 3, steps[i], { align: 'right', color: active ? 'foilLt' : done ? 'steel' : 'rivet' });
    x -= t.width + 4;
    if (i > 0) {
      text(scene, x, 3, '›', { align: 'right', color: 'rivet' });
      x -= 8;
    }
  }
}
