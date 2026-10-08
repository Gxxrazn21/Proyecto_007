/**
 * ResultsScene — veredicto y reporte "decisión → consecuencia → lección".
 *
 * El reporte combina:
 *   1. Análisis del diseño (calculado aquí con systems/calc.ts).
 *   2. Lo que registraron Launch y Operations en GameState.report.
 */
import Phaser from 'phaser';
import { C, type PalKey } from '../art/palette';
import { GameState } from '../state/GameState';
import { computeStats, fmtKbps, fmtMoney, type DesignStats } from '../systems/calc';
import { Button, drawPanel, fadeIn, goTo, header, starfield, text } from '../ui/ui';
import type { Mission, ReportEntry } from '../types';
import { recordGame } from '../systems/badges';
import { sfx } from '../systems/sfx';

const LIST_X = 186;
const LIST_Y = 24;
const LIST_W = 286;
const LIST_H = 216;

export class ResultsScene extends Phaser.Scene {
  private list!: Phaser.GameObjects.Container;
  private contentH = 0;

  constructor() {
    super('Results');
  }

  create(): void {
    fadeIn(this);
    starfield(this, 0.02, 0.5);
    header(this, 4, 'Reporte de misión');

    const m = GameState.mission!;
    const s = computeStats(GameState.design, GameState.db.catalog, m, GameState.env!, GameState.db.rockets, {
      rocket: GameState.rocket ?? undefined,
      solarFactor: GameState.ops.solarFactor,
    });
    const stars = this.verdict(m, s);
    this.report([...designAnalysis(m, s), ...GameState.report]);

    // Registrar la partida una sola vez (aunque la escena se redibuje al girar el teléfono).
    if (!GameState.lastRecord) {
      const r = recordGame({
        mission: m, outcome: GameState.outcome ?? 'partial', stars, stats: s, health: GameState.ops.health,
        totalCost: s.craftCost + (GameState.rocket?.cost ?? 0), science: GameState.finalScience,
      });
      GameState.lastRecord = { ...r, shown: false };
    }
    if (!GameState.lastRecord.shown) {
      GameState.lastRecord.shown = true;
      this.time.delayedCall(500, () => this.celebrate());
    }

    new Button(this, 8, 250, 98, 16, 'Ajustar el diseño', () => goTo(this, 'Workshop'), 'primary');
    new Button(this, 112, 250, 66, 16, 'Otra misión', () => goTo(this, 'Briefing'));
    new Button(this, 416, 250, 56, 16, 'Menú', () => goTo(this, 'Menu'), 'ghost');
  }

  /* ------------------------------------------------------------------ */
  /* Veredicto (izquierda)                                                */
  /* ------------------------------------------------------------------ */

  private verdict(m: Mission, s: DesignStats): number {
    const g = this.add.graphics();
    drawPanel(g, 8, 24, 170, 216, 'hull', 'rivet');

    const outcome = GameState.outcome ?? 'partial';
    const sci = GameState.finalScience;
    const total = s.craftCost + (GameState.rocket?.cost ?? 0);
    const titles: Record<string, [string, PalKey]> = {
      success: ['Misión exitosa', 'ok'],
      partial: ['Éxito parcial', 'foilLt'],
      lost: ['Nave perdida', 'alert'],
      'launch-fail': ['Fallo en el lanzamiento', 'alert'],
    };
    const [title, color] = titles[outcome];
    const titleText = text(this, 18, 32, title, { font: 'title', size: 16, color, wrap: 150 });
    const starsY = 36 + titleText.height;

    // Estrellas: 1 por cumplir, +1 ciencia sobresaliente, +1 presupuesto eficiente.
    const stars = outcome !== 'success' ? 0 : 1 + (sci >= m.minScience * 1.3 ? 1 : 0) + (total <= m.budget * 0.8 ? 1 : 0);
    for (let i = 0; i < 3; i++) {
      const filled = i < stars;
      const x = 18 + i * 16;
      this.add.rectangle(x, starsY, 12, 12, filled ? C.foilLt : C.rivet).setOrigin(0);
      if (filled) this.add.rectangle(x + 1, starsY + 1, 10, 1, C.foilHi).setOrigin(0);
    }

    const rows: [string, string, string, PalKey][] = [
      ['science', 'Ciencia', `${Math.floor(sci)} / ${m.minScience}`, sci >= m.minScience ? 'ok' : 'alert'],
      ['money', 'Costo total', `${fmtMoney(total)}`, total <= m.budget ? 'frost' : 'alert'],
      ['money', 'Presupuesto', fmtMoney(m.budget), 'steel'],
      ['health', 'Salud final', `${GameState.ops.health}`, GameState.ops.health > 50 ? 'ok' : 'alert'],
      ['dv', 'Δv de diseño', `${Math.round(s.deltaV)} m/s`, s.deltaV >= m.deltaVRequired ? 'frost' : 'alert'],
    ];
    rows.forEach(([icon, label, value, col], i) => {
      const y = starsY + 22 + i * 13;
      this.add.image(18, y + 1, `ic-${icon}`).setOrigin(0);
      text(this, 28, y, label, { color: 'steel' });
      text(this, 168, y, value, { align: 'right', color: col });
    });

    const tips: Record<string, string> = {
      success: stars < 3 ? 'Prueba conseguir 3 estrellas: más ciencia con menos presupuesto.' : '¡Diseño de nivel JPL! Prueba una misión más difícil.',
      partial: 'Revisa en el reporte qué decisión te costó más ciencia y ajusta el diseño.',
      lost: 'La nave se quedó sin salud. Más redundancia o márgenes de energía la habrían salvado.',
      'launch-fail': 'Quita masa o elige un cohete más potente. Mira la barra de Masa del Taller.',
    };
    text(this, 18, starsY + 96, tips[outcome], { wrap: 152, color: 'frost', lineSpacing: 3 });
    text(this, 18, 214, `Inspirada en ${m.inspiredBy}`, { wrap: 152, color: 'steel' });
    if (GameState.lastRecord?.newBest) text(this, 168, 32, 'Récord', { align: 'right', color: 'signal' });
    return stars;
  }

  /** Muestra las insignias desbloqueadas en esta partida. */
  private celebrate(): void {
    const rec = GameState.lastRecord!;
    sfx.play(GameState.outcome === 'success' ? 'success' : 'fail');
    if (rec.newBest) this.time.delayedCall(10, () => text(this, 168, 32, 'Récord', { align: 'right', color: 'signal' }));
    rec.unlocked.forEach((b, i) => {
      this.time.delayedCall(700 + i * 1600, () => {
        sfx.play('badge');
        const c = this.add.container(240, 250).setDepth(50).setAlpha(0);
        const t1 = text(this, 0, -6, 'Nueva insignia', { align: 'center', color: 'space' });
        const t2 = text(this, 0, 4, b.name, { align: 'center', font: 'title', size: 16, color: 'space' });
        const w = Math.max(t1.width, t2.width) + 24;
        const g = this.add.graphics();
        drawPanel(g, -w / 2, -10, w, 34, 'foilLt', 'foilDk');
        g.fillStyle(0xfff2b3).fillRect(-w / 2 + 3, -9, w - 6, 1);
        c.add([g, t1, t2]);
        this.tweens.add({ targets: c, alpha: 1, y: 222, duration: 300, ease: 'Back.out' });
        this.tweens.add({ targets: c, alpha: 0, delay: 1300, duration: 250, onComplete: () => c.destroy() });
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Reporte desplazable (derecha)                                        */
  /* ------------------------------------------------------------------ */

  private report(entries: ReportEntry[]): void {
    const g = this.add.graphics();
    drawPanel(g, LIST_X - 4, LIST_Y, LIST_W + 8, LIST_H, 'hull', 'rivet');
    text(this, LIST_X + 4, LIST_Y + 5, 'Qué causó cada resultado', { color: 'foilLt' });

    this.list = this.add.container(LIST_X, LIST_Y + 18);
    const maskShape = this.make.graphics({}, false).fillStyle(0xffffff).fillRect(LIST_X - 2, LIST_Y + 16, LIST_W + 4, LIST_H - 20);
    this.list.setMask(maskShape.createGeometryMask());

    const phaseName: Record<ReportEntry['phase'], string> = {
      design: 'Diseño', launch: 'Lanzamiento', cruise: 'Crucero', insertion: 'Inserción', science: 'Ciencia',
    };
    let y = 4;
    for (const e of entries) {
      const color: PalKey = e.impact === 'good' ? 'ok' : e.impact === 'bad' ? 'alert' : 'steel';
      const start = y;
      const t1 = text(this, 10, y, `${phaseName[e.phase]} · ${e.title}`, { color: 'frost', wrap: LIST_W - 16 });
      y += t1.height + 2;
      const t2 = text(this, 10, y, `Decisión: ${e.decision}`, { color: 'steel', wrap: LIST_W - 16 });
      y += t2.height + 2;
      const t3 = text(this, 10, y, e.consequence, { color, wrap: LIST_W - 16 });
      y += t3.height + 2;
      this.list.add([t1, t2, t3]);
      if (e.lesson) {
        const t4 = text(this, 10, y, e.lesson, { color: 'signal', wrap: LIST_W - 16 });
        y += t4.height + 2;
        this.list.add(t4);
      }
      const bar = this.add.rectangle(2, start, 3, y - start - 2, C[color]).setOrigin(0);
      this.list.addAt(bar, 0);
      y += 8;
    }
    this.contentH = y;

    // Desplazamiento con rueda, arrastre (móvil) o flechas.
    const minY = LIST_Y + 18 - Math.max(0, this.contentH - (LIST_H - 22));
    const maxY = LIST_Y + 18;
    const scrollBy = (dy: number) => this.list.setY(Phaser.Math.Clamp(this.list.y + dy, minY, maxY));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => scrollBy(-dy * 0.5));
    const zone = this.add.zone(LIST_X, LIST_Y + 16, LIST_W, LIST_H - 20).setOrigin(0).setInteractive();
    zone.on('pointermove', (p: Phaser.Input.Pointer) => p.isDown && scrollBy((p.y - p.prevPosition.y) / this.cameras.main.zoom));
    if (this.contentH > LIST_H - 22) {
      new Button(this, 346, 250, 30, 16, 'Subir', () => scrollBy(60), 'ghost');
      new Button(this, 380, 250, 30, 16, 'Bajar', () => scrollBy(-60), 'ghost');
      text(this, 472, LIST_Y + 5, 'desliza', { align: 'right', color: 'steel' });
    }
  }
}

/** Explica el diseño: las relaciones físicas que más pesaron en el resultado. */
function designAnalysis(m: Mission, s: DesignStats): ReportEntry[] {
  const out: ReportEntry[] = [];
  const env = GameState.env!;
  const light = Math.round(100 / env.sunDistanceAU ** 2);

  out.push(s.powerGen >= s.powerDraw
    ? {
        phase: 'design', title: 'Energía', impact: 'good',
        decision: `${Math.round(s.solarGen)} W solares + ${Math.round(s.rtgGen)} W de RTG`,
        consequence: `Generabas ${Math.round(s.powerGen)} W y consumías ${Math.round(s.powerDraw)} W: margen de ${Math.round(s.powerMargin)} W.`,
        lesson: `A ${env.sunDistanceAU.toFixed(2)} UA la luz solar es el ${light} % de la de la Tierra: la potencia solar cae con 1/r².`,
      }
    : {
        phase: 'design', title: 'Energía insuficiente', impact: 'bad',
        decision: `${Math.round(s.solarGen)} W solares + ${Math.round(s.rtgGen)} W de RTG`,
        consequence: `Consumías ${Math.round(s.powerDraw)} W pero sólo generabas ${Math.round(s.powerGen)} W: los instrumentos funcionaron el ${Math.round(s.powerRatio * 100)} % del tiempo.`,
        lesson: `A ${env.sunDistanceAU.toFixed(2)} UA la luz solar es el ${light} % de la de la Tierra. Por eso Cassini y New Horizons usan RTG.`,
      });

  if (s.dataKbps > 0) {
    out.push(s.dataRatio >= 1
      ? {
          phase: 'design', title: 'Comunicaciones', impact: 'good',
          decision: `Enlace de ${fmtKbps(s.downlinkKbps)} para ${fmtKbps(s.dataKbps)} de datos`,
          consequence: 'Todos los datos científicos llegaron a la Tierra.',
          lesson: 'La señal se debilita con el cuadrado de la distancia: lejos de casa, la antena manda.',
        }
      : {
          phase: 'design', title: 'Cuello de botella de datos', impact: 'bad',
          decision: `Enlace de ${fmtKbps(s.downlinkKbps)} para ${fmtKbps(s.dataKbps)} de datos`,
          consequence: `Sólo llegó el ${Math.round(s.dataRatio * 100)} % de los datos: el resto de la ciencia se perdió.`,
          lesson: `A ${env.earthDistanceAU.toFixed(2)} UA de la Tierra hace falta una antena de alta ganancia o instrumentos que generen menos datos.`,
        });
  }

  if (m.eclipseMinutes > 0) {
    const ok = s.batteryWh >= s.eclipseNeedWh;
    out.push({
      phase: 'design', title: 'Batería para el eclipse', impact: ok ? 'good' : 'bad',
      decision: `${s.batteryWh} Wh de batería`,
      consequence: ok
        ? `Cubría los ${Math.ceil(s.eclipseNeedWh)} Wh que pide un eclipse de ${m.eclipseMinutes} min.`
        : `Un eclipse de ${m.eclipseMinutes} min necesita ${Math.ceil(s.eclipseNeedWh)} Wh: la nave quedó expuesta en la sombra.`,
      lesson: 'Batería = consumo × tiempo en sombra ÷ 80 % (profundidad de descarga segura).',
    });
  }

  const best = [...s.scienceBreakdown].sort((a, b) => b.points - a.points)[0];
  if (best) {
    out.push({
      phase: 'design', title: 'Instrumento estrella', impact: 'neutral',
      decision: best.module.name,
      consequence: `Aportó ${Math.round(best.points)} puntos (afinidad ×${m.affinity[best.module.instrument!]} con este destino).`,
      lesson: 'Cada destino premia instrumentos distintos: en Júpiter brilla el magnetómetro; en la Luna, el espectrómetro que busca hielo.',
    });
  }
  return out;
}
