/**
 * Vista adaptable y NÍTIDA.
 *
 * - El juego se DISEÑA a 480×270. La altura de diseño es fija (270) y el
 *   ANCHO crece con la pantalla (hasta 640) para no dejar franjas negras.
 * - El lienzo se dibuja a la resolución REAL de la pantalla (incluida la
 *   densidad de píxeles del móvil): la cámara amplía el mundo VIEW.zoom veces.
 *   Así los textos se rasterizan grandes y nítidos, y el pixel art se amplía
 *   sin difuminarse, en lugar de estirar con el navegador una imagen pequeña.
 *
 * Las escenas colocan todo en coordenadas 0..480; los fondos usan
 * VIEW.left/VIEW.width para llegar de borde a borde.
 */
export const DESIGN_W = 480;
export const BASE_H = 270;
const MAX_W = 640;

export const VIEW = {
  /** Ancho visible en unidades del juego (480..640). */
  width: DESIGN_W,
  /** X del borde izquierdo visible (negativa si sobra ancho). */
  left: 0,
  /** Ampliación de la cámara = píxeles físicos por píxel del juego. */
  zoom: 1,
  /** Tamaño CSS del lienzo. */
  cssW: DESIGN_W,
  cssH: BASE_H,
  get right(): number {
    return this.left + this.width;
  },
};

/** Recalcula la vista para la ventana actual. Devuelve true si cambió. */
export function updateView(vw = window.innerWidth, vh = window.innerHeight): boolean {
  const aspect = vw / vh;
  const width = aspect <= DESIGN_W / BASE_H ? DESIGN_W : Math.min(MAX_W, Math.round((BASE_H * aspect) / 2) * 2);
  // Escala CSS: entera si casi no desperdicia pantalla (píxeles perfectos), si no, llena.
  const z = Math.min(vw / width, vh / BASE_H);
  const zi = Math.floor(z);
  const css = zi >= 1 && zi / z >= 0.9 ? zi : z;
  // Densidad máxima ×2 y lienzo de ~4 megapíxeles como mucho: nítido y fluido
  // incluso en móviles de gama baja y monitores 4K.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const maxZoom = Math.sqrt(4_000_000 / (width * BASE_H));
  const zoom = Math.max(1, Math.min(css * dpr, maxZoom));
  const changed = width !== VIEW.width || Math.abs(zoom - VIEW.zoom) > 0.01;
  VIEW.width = width;
  VIEW.left = -Math.round((width - DESIGN_W) / 2);
  VIEW.zoom = zoom;
  VIEW.cssW = Math.floor(width * css);
  VIEW.cssH = Math.floor(BASE_H * css);
  return changed;
}

/** Tamaño del lienzo en píxeles físicos. */
export function canvasSize(): [number, number] {
  return [Math.round(VIEW.width * VIEW.zoom), Math.round(BASE_H * VIEW.zoom)];
}

/** Encuadra la zona de diseño en la cámara principal de una escena. */
export function frameCamera(scene: Phaser.Scene, centerY = BASE_H / 2): void {
  const cam = scene.cameras.main;
  cam.setZoom(VIEW.zoom);
  cam.centerOn(VIEW.left + VIEW.width / 2, centerY);
}
