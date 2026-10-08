/**
 * Mini-API para dibujar pixel art por código (placeholders del MVP).
 *
 * Cada sprite se genera una vez al arrancar y se guarda como textura de
 * Phaser con una clave (p. ej. "mod-rtg"). Cuando el equipo de arte entregue
 * los PNG finales, basta con cargarlos con la MISMA clave en BootScene y
 * no generar el placeholder (ver art/sprites.ts → registerArt).
 */
import Phaser from 'phaser';
import { PAL, type PalKey } from './palette';

export type Color = PalKey | 'none';

export class Pix {
  constructor(
    public readonly ctx: CanvasRenderingContext2D,
    public readonly w: number,
    public readonly h: number,
    private seed = 7,
  ) {}

  /** Generador pseudoaleatorio con semilla: el arte sale igual en cada carga. */
  rand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  px(x: number, y: number, c: Color): void {
    if (c === 'none' || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.ctx.fillStyle = PAL[c];
    this.ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
  }

  rect(x: number, y: number, w: number, h: number, c: Color): void {
    if (c === 'none') return;
    this.ctx.fillStyle = PAL[c];
    this.ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  /** Rectángulo con borde de 1 px. */
  box(x: number, y: number, w: number, h: number, fill: Color, border: Color): void {
    this.rect(x, y, w, h, border);
    this.rect(x + 1, y + 1, w - 2, h - 2, fill);
  }

  /** Relleno con tramado (dithering) en damero entre dos colores. */
  dither(x: number, y: number, w: number, h: number, a: Color, b: Color): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, (i + j) % 2 ? a : b);
  }

  /** Círculo relleno; `shade` decide el color de cada píxel (para iluminación). */
  disc(cx: number, cy: number, r: number, shade: (dx: number, dy: number, d: number) => Color): void {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = Math.sqrt(x * x + y * y) / r;
        if (d <= 1) this.px(cx + x, cy + y, shade(x / r, y / r, d));
      }
    }
  }
}

/** Crea una textura de Phaser dibujada con `draw`. */
export function makeTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (p: Pix) => void,
  seed = 7,
): void {
  if (scene.textures.exists(key)) return; // un PNG real tiene prioridad
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(new Pix(tex.getContext(), w, h, seed));
  tex.refresh();
}

/** Igual que makeTexture pero con varios cuadros horizontales (animaciones). */
export function makeSheet(
  scene: Phaser.Scene,
  key: string,
  fw: number,
  fh: number,
  frames: number,
  draw: (p: Pix, frame: number) => void,
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, fw * frames, fh);
  if (!tex) return;
  const ctx = tex.getContext();
  for (let f = 0; f < frames; f++) {
    ctx.save();
    ctx.translate(f * fw, 0);
    draw(new Pix(ctx, fw, fh, 11 + f * 31), f);
    ctx.restore();
  }
  for (let f = 0; f < frames; f++) tex.add(f, 0, f * fw, 0, fw, fh);
  tex.refresh();
}
