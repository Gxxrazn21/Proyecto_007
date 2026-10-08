/**
 * Placeholders de pixel art generados por código.
 *
 * Claves de textura (los PNG finales deben usar EXACTAMENTE estas claves):
 *   mod-<idModulo>   módulos de la nave (ver modules.json)
 *   rk-<idCohete>    cohetes (ver rockets.json)
 *   pl-<cuerpo>      planetas: pl-earth, pl-moon, pl-mars, pl-jupiter
 *   ic-<nombre>      iconos 7×7 de la interfaz
 *   fx-flame, fx-smoke, fx-boom   hojas de animación
 *   bg-stars, tower
 */
import Phaser from 'phaser';
import { makeSheet, makeTexture, type Color, type Pix } from './pixel';

export function registerArt(scene: Phaser.Scene): void {
  modules(scene);
  rockets(scene);
  planets(scene);
  icons(scene);
  effects(scene);
  background(scene);
}

/* ================================================================== */
/* Módulos                                                              */
/* ================================================================== */

/** Manta térmica dorada con arrugas (la firma visual del juego). */
function foil(p: Pix, x: number, y: number, w: number, h: number): void {
  p.rect(x, y, w, h, 'foilDk');
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const light = 1 - (i / w + j / h) / 2; // luz desde arriba a la izquierda
      const r = p.rand();
      let c: Color = 'foil';
      if (r < 0.1 + light * 0.25) c = 'foilLt';
      if (r < 0.03 + light * 0.06) c = 'foilHi';
      if (r > 0.93 - light * 0.05) c = 'foilDk';
      p.px(x + i, y + j, c);
    }
  }
}

function solarPanel(p: Pix, cols: number, rows: number): void {
  const w = cols * 5 + 3;
  const h = rows * 5 + 3;
  p.box(0, 0, w, h, 'cellDk', 'steel');
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = 2 + c * 5;
      const y = 2 + r * 5;
      p.rect(x, y, 4, 4, 'cell');
      p.px(x, y, 'signal');
      if (p.rand() < 0.15) p.px(x + 1, y, 'frost');
    }
  }
}

function modules(s: Phaser.Scene): void {
  // Nave en miniatura para la vista orbital: alas azules + cuerpo dorado.
  makeTexture(s, 'craft-mini', 11, 5, (p) => {
    p.rect(0, 1, 3, 3, 'cell'); p.rect(8, 1, 3, 3, 'cell');
    p.rect(3, 2, 1, 1, 'steel'); p.rect(7, 2, 1, 1, 'steel');
    p.rect(4, 1, 3, 3, 'foil'); p.px(4, 1, 'foilHi'); p.px(5, 0, 'frost');
  });

  makeTexture(s, 'mod-bus', 28, 28, (p) => {
    foil(p, 0, 3, 28, 25);
    p.rect(2, 0, 24, 4, 'steel'); // cubierta superior de instrumentos
    p.rect(2, 0, 24, 1, 'frost');
    p.rect(3, 4, 22, 1, 'foilDk');
    p.rect(11, 12, 6, 6, 'hull'); // escotilla de servicio
    p.rect(12, 13, 4, 4, 'rivet');
  }, 3);

  makeTexture(s, 'mod-solar_s', 23, 13, (p) => solarPanel(p, 4, 2));
  makeTexture(s, 'mod-solar_l', 38, 18, (p) => solarPanel(p, 7, 3), 5);

  makeTexture(s, 'mod-rtg', 12, 20, (p) => {
    p.rect(4, 0, 4, 20, 'moonDk');
    for (let y = 3; y < 18; y += 3) p.rect(0, y, 12, 2, 'steel'); // aletas de disipación
    for (let y = 3; y < 18; y += 3) p.rect(0, y, 12, 1, 'moon');
    p.rect(5, 1, 2, 18, 'hull');
    p.px(5, 7, 'alert');
    p.px(6, 13, 'alert');
    p.rect(3, 0, 6, 1, 'frost');
  });

  makeTexture(s, 'mod-battery', 12, 9, (p) => {
    p.box(0, 0, 12, 9, 'hull', 'steel');
    for (let i = 0; i < 3; i++) p.rect(2 + i * 3, 2, 2, 5, i < 2 ? 'ok' : 'rivet');
    p.rect(4, 0, 4, 1, 'frost');
  });

  makeTexture(s, 'mod-lga', 8, 12, (p) => {
    p.rect(3, 4, 2, 8, 'steel');
    p.rect(1, 1, 6, 3, 'frost');
    p.rect(2, 0, 4, 1, 'frost');
    p.rect(1, 3, 6, 1, 'steel');
  });

  makeTexture(s, 'mod-hga', 26, 15, (p) => {
    // plato visto de frente con sombra en la parte inferior derecha
    for (let y = 0; y < 13; y++) {
      for (let x = 0; x < 26; x++) {
        const dx = (x - 12.5) / 12.5;
        const dy = (y - 6) / 6.5;
        const d = dx * dx + dy * dy;
        if (d <= 1) p.px(x, y, d > 0.8 ? 'steel' : dx + dy > 0.6 ? 'moon' : 'frost');
      }
    }
    for (let i = 0; i < 6; i++) p.px(7 + i * 2, 6 - Math.round(i * 0.2), 'steel'); // soportes
    p.rect(12, 5, 3, 3, 'foil');
    p.rect(12, 13, 3, 2, 'steel');
  });

  makeTexture(s, 'mod-engine', 14, 14, (p) => {
    p.rect(4, 0, 6, 3, 'foilDk');
    p.rect(5, 0, 4, 1, 'foil');
    for (let y = 3; y < 14; y++) {
      const half = 2 + Math.floor((y - 3) * 0.48);
      for (let x = 7 - half; x < 7 + half; x++) {
        const t = (x - (7 - half)) / (2 * half);
        p.px(x, y, t < 0.25 ? 'frost' : t < 0.7 ? 'moon' : 'moonDk');
      }
    }
    p.rect(1, 13, 12, 1, 'moonDk');
  });

  makeTexture(s, 'mod-tank', 12, 16, (p) => {
    p.disc(6, 5, 5, (dx, dy) => (dx + dy < -0.6 ? 'frost' : dx + dy < 0.5 ? 'moon' : 'moonDk'));
    p.disc(6, 10, 5, (dx, dy) => (dx + dy < -0.6 ? 'frost' : dx + dy < 0.5 ? 'moon' : 'moonDk'));
    p.rect(1, 5, 10, 6, 'moon');
    p.rect(1, 5, 2, 6, 'frost');
    p.rect(9, 5, 2, 6, 'moonDk');
    p.rect(1, 8, 10, 1, 'steel');
  });

  makeTexture(s, 'mod-camera', 12, 12, (p) => {
    p.box(0, 2, 12, 10, 'frost', 'steel');
    p.rect(1, 2, 10, 1, 'steel');
    p.disc(6, 7, 3, (dx, dy) => (dx < -0.2 && dy < -0.2 ? 'signal' : 'space'));
    p.rect(3, 0, 6, 2, 'steel');
  });

  makeTexture(s, 'mod-spectrometer', 12, 12, (p) => {
    p.box(0, 0, 12, 12, 'moon', 'moonDk');
    p.rect(2, 3, 8, 2, 'space');
    const rainbow: Color[] = ['alert', 'foilLt', 'ok', 'signal', 'cell'];
    rainbow.forEach((c, i) => p.rect(2 + i * 2, 7, 2, 2, c));
    p.rect(1, 1, 10, 1, 'frost');
  });

  makeTexture(s, 'mod-magnetometer', 22, 6, (p) => {
    p.rect(0, 2, 18, 1, 'steel');
    p.rect(0, 3, 18, 1, 'rivet');
    for (let x = 3; x < 18; x += 5) p.px(x, 1, 'steel');
    p.box(17, 0, 5, 6, 'frost', 'steel');
    p.px(19, 2, 'cell');
  });
}

/* ================================================================== */
/* Cohetes                                                              */
/* ================================================================== */

/** Cuerpo cilíndrico vertical con sombreado lateral. */
function cylinder(p: Pix, x: number, y: number, w: number, h: number, base: Color, light: Color, dark: Color): void {
  p.rect(x, y, w, h, base);
  p.rect(x, y, 1, h, light);
  p.rect(x + w - 1, y, 1, h, dark);
  if (w > 4) p.rect(x + w - 2, y, 1, h, dark);
}

/** Cono de punta (cofia). */
function nose(p: Pix, x: number, y: number, w: number, h: number, base: Color, light: Color, dark: Color): void {
  for (let j = 0; j < h; j++) {
    const half = Math.max(1, Math.round((w / 2) * Math.sqrt((j + 1) / h)));
    const cx = x + w / 2;
    p.rect(cx - half, y + j, half * 2, 1, base);
    p.px(cx - half, y + j, light);
    p.px(cx + half - 1, y + j, dark);
  }
}

function falconCore(p: Pix, x: number, top: number, bottom: number): void {
  nose(p, x, top, 8, 12, 'frost', 'frost', 'moon');
  cylinder(p, x, top + 12, 8, bottom - top - 16, 'frost', 'frost', 'moon');
  p.rect(x, top + 26, 8, 3, 'space'); // interetapa negra
  p.rect(x, bottom - 4, 8, 4, 'moonDk');
  p.rect(x - 1, bottom - 2, 1, 2, 'space'); // patas
  p.rect(x + 8, bottom - 2, 1, 2, 'space');
}

function rockets(s: Phaser.Scene): void {
  makeTexture(s, 'rk-falcon9', 10, 74, (p) => falconCore(p, 1, 0, 74));

  makeTexture(s, 'rk-falconheavy', 28, 74, (p) => {
    falconCore(p, 10, 0, 74);
    for (const bx of [1, 19]) {
      nose(p, bx, 16, 8, 6, 'frost', 'frost', 'moon');
      cylinder(p, bx, 22, 8, 48, 'frost', 'frost', 'moon');
      p.rect(bx, 34, 8, 2, 'space');
      p.rect(bx, 70, 8, 4, 'moonDk');
    }
  });

  makeTexture(s, 'rk-sls', 26, 88, (p) => {
    nose(p, 8, 0, 10, 12, 'frost', 'frost', 'moon');
    cylinder(p, 9, 12, 8, 10, 'moon', 'frost', 'moonDk'); // etapa superior
    cylinder(p, 8, 22, 10, 62, 'foil', 'foilLt', 'foilDk'); // etapa central naranja
    for (let y = 30; y < 84; y += 9) p.rect(9, y, 8, 1, 'foilDk');
    for (const bx of [1, 19]) {
      nose(p, bx, 24, 6, 6, 'frost', 'frost', 'moon');
      cylinder(p, bx, 30, 6, 52, 'frost', 'frost', 'moon');
      p.rect(bx, 44, 6, 1, 'steel');
      p.rect(bx, 64, 6, 1, 'steel');
      p.rect(bx + 1, 82, 4, 6, 'moonDk');
    }
    p.rect(9, 84, 8, 4, 'moonDk');
  });

  makeTexture(s, 'tower', 12, 96, (p) => {
    p.rect(1, 0, 2, 96, 'rivet');
    p.rect(9, 0, 2, 96, 'rivet');
    for (let y = 0; y < 96; y += 6) {
      p.rect(1, y, 10, 1, 'rivet');
      for (let i = 0; i < 6; i++) p.px(3 + i, y + i, 'hull');
    }
    p.rect(0, 0, 12, 2, 'steel');
  });
}

/* ================================================================== */
/* Planetas (iluminados desde arriba a la izquierda, con tramado)       */
/* ================================================================== */

/** Ruido de valor 2D sencillo para continentes, cráteres y bandas. */
function noise(seed: number) {
  const hash = (x: number, y: number) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
  };
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function planet(s: Phaser.Scene, key: string, r: number, surface: (x: number, y: number) => Color, halo?: Color): void {
  if (r === 26) planet(s, `${key}-sm`, 11, surface, halo); // versión para tarjetas
  const m = halo ? Math.max(2, Math.round(r * 0.06)) : 0; // margen para la atmósfera
  const size = (r + m) * 2 + 1;
  makeTexture(s, key, size, size, (p) => {
    if (halo) {
      // Atmósfera: anillo tramado, más visible del lado iluminado.
      const R = r + m;
      for (let y = -R; y <= R; y++) {
        for (let x = -R; x <= R; x++) {
          const d = Math.hypot(x, y);
          if (d <= r || d > R) continue;
          const lit = -(x * 0.65 + y * 0.55) / d;
          if (lit > 0.1 || (lit > -0.4 && (x + y) % 2 === 0)) p.px(R + x, R + y, d < r + m / 2 + 0.5 ? halo : (x + y) % 2 ? halo : 'none');
        }
      }
    }
    const o = m;
    p.disc(r + o, r + o, r, (dx, dy, d) => {
      // Terminador: la luz llega desde arriba a la izquierda.
      const lit = -(dx * 0.65 + dy * 0.55) + Math.sqrt(Math.max(0, 1 - d * d)) * 0.55;
      const x = Math.round(dx * r) + r, y = Math.round(dy * r) + r;
      if (lit < -0.32) return 'space';
      if (lit < -0.12) return (x + y) % 2 ? 'space' : 'hull';
      const c = surface(dx, dy);
      if (lit < 0.02) return (x + y) % 2 ? c : 'hull';
      return c;
    });
  });
}

function planets(s: Phaser.Scene): void {
  const n1 = noise(1), n2 = noise(2), n3 = noise(3), n4 = noise(4);

  const earth = (x: number, y: number): Color => {
    const cloud = n4(x * 5 + 10, y * 9) * 0.7 + n3(x * 14, y * 20) * 0.3;
    if (cloud > 0.72) return 'frost';
    if (Math.abs(y) > 0.86) return 'frost';
    return n1(x * 3.2 + 4, y * 3.2) * 0.75 + n2(x * 9, y * 9) * 0.25 > 0.55 ? 'land' : 'ocean';
  };
  planet(s, 'pl-earth', 26, earth, 'signal');
  planet(s, 'pl-earth-xl', 110, earth, 'signal'); // horizonte del menú

  planet(s, 'pl-moon', 26, (x, y) => {
    const v = n2(x * 5, y * 5);
    if (v > 0.68) return 'moonDk';
    if (v < 0.16) return 'frost';
    return n2(x * 2 + 9, y * 2) > 0.62 ? 'steel' : 'moon';
  });

  planet(s, 'pl-mars', 26, (x, y) => {
    if (y < -0.82) return 'frost'; // casquete polar
    const v = n3(x * 3.5, y * 3.5);
    if (v > 0.66) return 'foilDk';
    if (v < 0.25) return 'foil';
    return 'mars';
  });

  planet(s, 'pl-jupiter', 26, (x, y) => {
    // Gran Mancha Roja
    if (((x - 0.25) / 0.22) ** 2 + ((y - 0.32) / 0.12) ** 2 < 1) return 'mars';
    const band = Math.sin((y + n3(x * 2, y * 4) * 0.12) * 14);
    if (band > 0.6) return 'frost';
    if (band > 0.1) return 'jove';
    if (band > -0.5) return 'foil';
    return 'foilDk';
  });
}

/* ================================================================== */
/* Iconos 7×7 de la interfaz                                            */
/* ================================================================== */

const ICONS: Record<string, [Color, string[]]> = {
  mass: ['frost', ['..###..', '..#.#..', '.#####.', '#######', '#######', '#######', '.#####.']],
  power: ['foilLt', ['...##..', '..##...', '.##....', '######.', '...##..', '..##...', '.##....']],
  money: ['foilLt', ['.#####.', '##.#.##', '#.###.#', '##.#.##', '#.###.#', '##.#.##', '.#####.']],
  data: ['signal', ['#......', '..##...', '#...#..', '.#...#.', '..#..#.', '#..#..#', '##.#..#']],
  dv: ['frost', ['...#...', '..###..', '.#####.', '...#...', '...#...', '..#.#..', '.#...#.']],
  science: ['ok', ['.##.##.', '#..#..#', '#.###.#', '.##.##.', '#.###.#', '#..#..#', '.##.##.']],
  health: ['alert', ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...']],
  eclipse: ['steel', ['..###..', '.#####.', '####...', '###....', '####...', '.#####.', '..###..']],
  check: ['ok', ['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....', '.......']],
  cross: ['alert', ['#.....#', '##...##', '.##.##.', '..###..', '.##.##.', '##...##', '#.....#']],
};

function icons(s: Phaser.Scene): void {
  for (const [name, [color, rows]] of Object.entries(ICONS)) {
    makeTexture(s, `ic-${name}`, 7, 7, (p) => {
      rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && p.px(x, y, color)));
    });
  }
}

/* ================================================================== */
/* Efectos (hojas de animación)                                         */
/* ================================================================== */

function effects(s: Phaser.Scene): void {
  makeSheet(s, 'fx-flame', 10, 20, 3, (p, f) => {
    const len = 14 + f * 3;
    for (let y = 0; y < len; y++) {
      const half = Math.max(1, Math.round(4 * (1 - y / len) + (p.rand() < 0.3 ? 1 : 0)));
      for (let x = 5 - half; x < 5 + half; x++) {
        const core = Math.abs(x - 4.5) < half * 0.4 && y < len * 0.6;
        p.px(x, y, core ? 'foilHi' : y < len * 0.5 ? 'foilLt' : p.rand() < 0.5 ? 'alert' : 'foil');
      }
    }
  });

  makeSheet(s, 'fx-smoke', 12, 12, 3, (p, f) => {
    const r = 3 + f;
    p.disc(6, 6, r, (dx, dy) => (p.rand() < 0.15 ? 'none' : dx + dy < -0.3 ? 'frost' : dx + dy < 0.6 ? 'moon' : 'steel'));
  });

  makeSheet(s, 'fx-boom', 32, 32, 5, (p, f) => {
    const r = 4 + f * 3;
    const palette: Color[][] = [
      ['foilHi', 'foilHi', 'foilLt'],
      ['foilHi', 'foilLt', 'alert'],
      ['foilLt', 'alert', 'foil'],
      ['alert', 'foil', 'moonDk'],
      ['moon', 'moonDk', 'steel'],
    ];
    p.disc(16, 16, r, (_dx, _dy, d) => {
      if (p.rand() < 0.08 + f * 0.08) return 'none';
      const [a, b, c] = palette[f];
      return d < 0.4 ? a : d < 0.75 ? b : c;
    });
  });

  makeTexture(s, 'fx-spark', 2, 2, (p) => p.rect(0, 0, 2, 2, 'foilHi'));
  makeTexture(s, 'fx-dot', 1, 1, (p) => p.px(0, 0, 'frost'));
}

/* ================================================================== */
/* Fondo de estrellas 480×270                                           */
/* ================================================================== */

function background(s: Phaser.Scene): void {
  makeTexture(s, 'bg-stars', 480, 270, (p) => {
    p.rect(0, 0, 480, 270, 'space');
    // Vía Láctea tenue: banda diagonal con tramado
    for (let y = 0; y < 270; y++) {
      for (let x = 0; x < 480; x++) {
        const band = Math.abs(y - (x * 0.35 + 40)) / 60;
        if (band < 1 && p.rand() < 0.22 * (1 - band)) p.px(x, y, 'hull');
      }
    }
    for (let i = 0; i < 420; i++) {
      const x = Math.floor(p.rand() * 480);
      const y = Math.floor(p.rand() * 270);
      const r = p.rand();
      p.px(x, y, r < 0.6 ? 'rivet' : r < 0.85 ? 'steel' : r < 0.95 ? 'frost' : r < 0.98 ? 'signal' : 'foilLt');
    }
    // Algunas estrellas brillantes en cruz
    for (let i = 0; i < 9; i++) {
      const x = 4 + Math.floor(p.rand() * 472);
      const y = 4 + Math.floor(p.rand() * 262);
      p.px(x, y, 'frost');
      p.px(x - 1, y, 'steel'); p.px(x + 1, y, 'steel'); p.px(x, y - 1, 'steel'); p.px(x, y + 1, 'steel');
    }
  }, 42);
}
