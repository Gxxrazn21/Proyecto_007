/**
 * Vista adaptable (responsive).
 *
 * El juego se DISEÑA a 480×270, pero la altura base es fija (270 px) y el
 * ANCHO crece con la pantalla (hasta 640 px) para que no haya franjas negras
 * en móviles alargados ni en monitores panorámicos.
 *
 * Las escenas siguen colocando todo en coordenadas 0..480: la cámara se
 * desplaza para centrar esa zona, y los fondos se estiran de borde a borde
 * usando VIEW.left y VIEW.width.
 */
export const DESIGN_W = 480;
export const BASE_H = 270;
const MAX_W = 640;

export const VIEW = {
  /** Ancho real del lienzo en píxeles del juego. */
  width: DESIGN_W,
  /** Coordenada X del borde izquierdo visible (negativa si sobra ancho). */
  left: 0,
  /** Coordenada X del borde derecho visible. */
  get right(): number {
    return this.left + this.width;
  },
};

/** Ancho ideal para la pantalla actual. */
export function idealWidth(vw = window.innerWidth, vh = window.innerHeight): number {
  const aspect = vw / vh;
  if (aspect <= DESIGN_W / BASE_H) return DESIGN_W;
  return Math.min(MAX_W, Math.round((BASE_H * aspect) / 2) * 2);
}

export function setViewWidth(w: number): void {
  VIEW.width = w;
  VIEW.left = -Math.round((w - DESIGN_W) / 2);
}

/**
 * Escala del lienzo en la pantalla. Usa un múltiplo ENTERO (píxeles perfectos)
 * sólo si eso no desperdicia más del 12 % de la pantalla; si no, llena el espacio.
 */
export function cssZoom(w: number, vw = window.innerWidth, vh = window.innerHeight): number {
  const z = Math.min(vw / w, vh / BASE_H);
  const zi = Math.floor(z);
  return zi >= 1 && zi / z >= 0.88 ? zi : z;
}

/** Centra la zona de diseño en la cámara principal de una escena. */
export function frameCamera(scene: Phaser.Scene): void {
  scene.cameras.main.setScroll(VIEW.left, 0);
}
