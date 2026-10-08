/**
 * WorkshopScene — Taller de diseño.
 *
 * Interacción (funciona igual con ratón y con dedo):
 *   - ARRASTRAR un módulo del catálogo a una ranura compatible.
 *   - o TOCAR un módulo (queda "en mano") y luego TOCAR una ranura.
 *   - Arrastrar un módulo instalado fuera de la nave lo quita;
 *     tocarlo lo selecciona y muestra el botón "Quitar".
 *
 * Cada cambio recalcula las estadísticas con systems/calc.ts y actualiza
 * los 7 medidores de la derecha.
 */
import Phaser from 'phaser';
import { C, type PalKey } from '../art/palette';
import { GameState } from '../state/GameState';
import { computeStats, fmtKbps, fmtMass, fmtMoney, type DesignStats } from '../systems/calc';
import { offlineEnv } from '../systems/ephemeris';
import { SLOTS } from '../systems/slots';
import { Button, Gauge, drawPanel, fadeIn, goTo, header, shade, text } from '../ui/ui';
import { VIEW } from '../ui/view';
import { sfx } from '../systems/sfx';
import type { ModuleCategory, ModuleDef, SlotDef } from '../types';

/** Centro del bus dentro de la sala limpia. */
const CX = 238;
const CY = 92;

/** Tamaño de la caja de cada ranura según la categoría que acepta. */
const SLOT_SIZE: Record<string, [number, number]> = {
  bus: [30, 30], power: [26, 16], comms: [14, 14], instrument: [14, 14], propulsion: [14, 14], storage: [20, 18],
};

const SHORT: Record<string, string> = { falcon9: 'F9', falconheavy: 'FH', sls: 'SLS' };

const CATEGORY_COLOR: Record<ModuleCategory, PalKey> = {
  bus: 'foil', power: 'cell', storage: 'ok', comms: 'signal', propulsion: 'alert', tank: 'moon', instrument: 'foilLt',
};

interface Drag {
  mod: ModuleDef;
  from?: string; // ranura de origen si se arrastra un módulo instalado
  ghost?: Phaser.GameObjects.Image;
  startX: number;
  startY: number;
}

export class WorkshopScene extends Phaser.Scene {
  private stats!: DesignStats;
  private craftLayer!: Phaser.GameObjects.Container;
  private slotLayer!: Phaser.GameObjects.Graphics;
  private gauges: Record<string, Gauge> = {};
  private info!: Phaser.GameObjects.Text;
  private infoSub!: Phaser.GameObjects.Text;
  private issues!: Phaser.GameObjects.Text;
  private removeBtn!: Button;
  private launchBtn!: Button;
  private rowBg: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private rowCount: Map<string, Phaser.GameObjects.Text> = new Map();
  private hint!: Phaser.GameObjects.Text;
  private toastText?: Phaser.GameObjects.Container;

  private drag: Drag | null = null;
  /** Módulo "en mano" tras un toque (modo táctil). */
  private armed: ModuleDef | null = null;
  /** Ranura seleccionada (para quitar su módulo). */
  private selectedSlot: string | null = null;
  private pulse = 0;

  constructor() {
    super('Workshop');
  }

  create(): void {
    fadeIn(this);
    const mission = GameState.mission!;
    GameState.resetFlight();
    GameState.env ??= offlineEnv(mission.body);
    GameState.envCache.get(mission.body)?.then((env) => {
      GameState.env = env;
      if (this.scene.isActive()) this.refresh();
    });

    this.add.rectangle(VIEW.left, 0, VIEW.width, 270, C.space).setOrigin(0);
    header(this, 1, `Taller · ${mission.name}`);

    this.buildCatalog();
    this.buildCleanRoom();
    this.buildGauges();
    this.buildBottomBar();

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));

    this.refresh();
  }

  update(_t: number, dt: number): void {
    this.pulse += dt / 1000;
    this.drawSlots();
  }

  /* ------------------------------------------------------------------ */
  /* Catálogo (izquierda)                                                 */
  /* ------------------------------------------------------------------ */

  private buildCatalog(): void {
    const g = this.add.graphics();
    drawPanel(g, 4, 20, 112, 224, 'hull', 'rivet');
    text(this, 10, 24, 'Módulos', { color: 'steel' });

    GameState.db.modules.forEach((m, i) => {
      const y = 35 + i * 17;
      const bg = this.add.graphics();
      this.rowBg.set(m.id, bg);
      // Miniatura recortada a 16×14 sin escalar (respeta el pixel art).
      const thumb = this.add.image(17, y + 8, `mod-${m.id}`);
      const fw = thumb.width, fh = thumb.height;
      thumb.setCrop(Math.max(0, (fw - 16) / 2), Math.max(0, (fh - 14) / 2), 16, 14);
      this.add.rectangle(8, y + 1, 2, 14, C[CATEGORY_COLOR[m.category]]).setOrigin(0);
      text(this, 28, y, m.name, { wrap: 84 }).setFixedSize(84, 9);
      text(this, 28, y + 8, `${fmtMass(m.mass + (m.propellant ?? 0))} · ${m.cost} M$`, { color: 'steel' });
      this.rowCount.set(m.id, text(this, 110, y + 8, '', { align: 'right', color: 'foilLt' }));

      const zone = this.add.zone(6, y, 108, 17).setOrigin(0).setInteractive({ cursor: 'grab' });
      zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
        this.drag = { mod: m, startX: p.worldX, startY: p.worldY };
      });
      zone.on('pointerover', () => !this.drag && !this.armed && this.showInfo(m));
    });
  }

  private drawRows(): void {
    for (const m of GameState.db.modules) {
      const bg = this.rowBg.get(m.id)!.clear();
      const i = GameState.db.modules.indexOf(m);
      const y = 35 + i * 17;
      if (this.armed?.id === m.id) {
        bg.fillStyle(C.rivet).fillRect(6, y - 1, 108, 17);
        bg.fillStyle(C.foilLt).fillRect(6, y - 1, 108, 1).fillRect(6, y + 15, 108, 1);
      }
      const n = this.stats.count[m.id] ?? 0;
      this.rowCount.get(m.id)!.setText(n ? `×${n}` : '');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Sala limpia (centro)                                                 */
  /* ------------------------------------------------------------------ */

  private buildCleanRoom(): void {
    const g = this.add.graphics();
    drawPanel(g, 120, 20, 236, 224, 'space', 'rivet');
    // Suelo de la sala limpia: cuadrícula que se pierde hacia arriba.
    for (let y = 30; y < 240; y += 12) g.fillStyle(C.hull, y > 140 ? 1 : 0.5).fillRect(122, y, 232, 1);
    for (let x = 126; x < 354; x += 12) g.fillStyle(C.hull, 0.5).fillRect(x, 22, 1, 220);
    // Foco de luz sobre el suelo, bajo la nave (elipse tramada).
    for (let y = -7; y <= 7; y++) {
      for (let x = -70; x <= 70; x++) {
        const d = (x / 70) ** 2 + (y / 7) ** 2;
        if (d < 1 && (x + y) % 2 === 0) g.fillStyle(d < 0.45 ? C.rivet : C.hull).fillRect(CX + x, CY + 36 + y, 1, 1);
      }
    }
    // Bahía del compartimento interno
    drawPanel(g, CX - 54, CY + 52, 108, 28, 'hull', 'rivet');
    text(this, CX, CY + 82, 'Compartimento interno: baterías y tanques', { align: 'center', color: 'steel' });

    this.slotLayer = this.add.graphics();
    this.craftLayer = this.add.container(CX, CY);
    this.hint = text(this, CX, CY - 4, '', { align: 'center', color: 'foilLt', wrap: 200 });

    // Zonas de las ranuras (para tocar).
    for (const s of SLOTS) {
      const [w, h] = this.slotSize(s);
      const z = this.add.zone(CX + s.x, CY + s.y, w + 6, h + 6).setInteractive({ cursor: 'pointer' });
      z.on('pointerdown', (p: Phaser.Input.Pointer) => {
        const id = GameState.design[s.id];
        if (id) this.drag = { mod: GameState.db.catalog.get(id)!, from: s.id, startX: p.worldX, startY: p.worldY };
      });
    }
  }

  private slotSize(s: SlotDef): [number, number] {
    const cat = s.accepts[0] === 'tank' ? 'storage' : s.accepts[0];
    return SLOT_SIZE[cat] ?? [14, 14];
  }

  private accepts(s: SlotDef, m: ModuleDef): boolean {
    return s.accepts.includes(m.category);
  }

  private drawSlots(): void {
    const g = this.slotLayer.clear();
    const moving = this.drag?.ghost ? this.drag.mod : this.armed;
    const blink = 0.5 + 0.5 * Math.sin(this.pulse * 6);
    for (const s of SLOTS) {
      const filled = !!GameState.design[s.id];
      const needsBus = s.id !== 'core' && !GameState.design.core;
      const [w, h] = this.slotSize(s);
      const x = CX + s.x - w / 2;
      const y = CY + s.y - h / 2;
      const compatible = moving && this.accepts(s, moving) && !(needsBus && moving.category !== 'bus');
      if (filled && !compatible) {
        if (this.selectedSlot === s.id) this.dashed(g, x - 2, y - 2, w + 4, h + 4, C.foilLt, 1);
        continue;
      }
      if (needsBus && !compatible) continue;
      const color = compatible ? C.foilLt : C.rivet;
      this.dashed(g, x, y, w, h, color, compatible ? 0.4 + blink * 0.6 : 0.9);
    }
  }

  /** Rectángulo de línea discontinua (ranura vacía). */
  private dashed(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, alpha: number): void {
    g.fillStyle(color, alpha);
    for (let i = 0; i < w; i += 3) {
      g.fillRect(Math.round(x + i), Math.round(y), 2, 1);
      g.fillRect(Math.round(x + i), Math.round(y + h - 1), 2, 1);
    }
    for (let j = 0; j < h; j += 3) {
      g.fillRect(Math.round(x), Math.round(y + j), 1, 2);
      g.fillRect(Math.round(x + w - 1), Math.round(y + j), 1, 2);
    }
  }

  private drawCraft(): void {
    this.craftLayer.removeAll(true);
    const d = GameState.design;
    const g = this.add.graphics();
    for (const id of ['pwr1', 'pwr2', 'pwr3', 'pwr4']) {
      if (!d[id] || !d.core) continue;
      const s = SLOTS.find((sl) => sl.id === id)!;
      g.fillStyle(C.steel).fillRect(Math.min(0, s.x), -1, Math.abs(s.x), 2);
    }
    this.craftLayer.add(g);
    const order = ['pwr3', 'pwr4', 'pwr1', 'pwr2', 'ant1', 'ant2', 'ins3', 'eng', 'core', 'ins1', 'ins2', 'int1', 'int2', 'int3', 'int4'];
    for (const id of order) {
      const mod = d[id];
      if (!mod) continue;
      const s = SLOTS.find((sl) => sl.id === id)!;
      const img = this.add.image(s.x, s.y, `mod-${mod}`);
      if (mod === 'magnetometer' && s.x < 0) img.setFlipX(true);
      if (this.drag?.from === id && this.drag.ghost) img.setAlpha(0.3);
      this.craftLayer.add(img);
    }
    this.hint.setText(d.core ? '' : this.armed?.category === 'bus' ? 'Toca la ranura central' : 'Empieza por el Bus estructural:\narrástralo aquí');
    this.hint.setY(d.core ? CY : CY - 8);
  }

  /* ------------------------------------------------------------------ */
  /* Arrastrar / tocar                                                    */
  /* ------------------------------------------------------------------ */

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.drag || !p.isDown) return;
    if (!this.drag.ghost && Phaser.Math.Distance.Between(p.worldX, p.worldY, this.drag.startX, this.drag.startY) > 3) {
      this.armed = null;
      this.drag.ghost = this.add.image(p.worldX, p.worldY, `mod-${this.drag.mod.id}`).setAlpha(0.85).setDepth(20);
      this.showInfo(this.drag.mod);
      this.drawCraft();
      this.drawRows();
    }
    this.drag.ghost?.setPosition(Math.round(p.worldX), Math.round(p.worldY));
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const drag = this.drag;
    this.drag = null;
    const slot = this.slotAt(p.worldX, p.worldY);

    if (drag?.ghost) {
      // Fin de un arrastre.
      drag.ghost.destroy();
      if (slot && this.accepts(slot, drag.mod)) {
        if (drag.from) this.removeFrom(drag.from, true);
        this.place(slot, drag.mod);
      } else if (drag.from) {
        this.removeFrom(drag.from);
      } else if (slot) {
        this.toast(`${drag.mod.name} no va en una ranura de ${slot.label.toLowerCase()}`);
      }
      this.refresh();
      return;
    }

    if (drag && !drag.from) {
      // Toque en el catálogo: tomar / soltar el módulo.
      this.armed = this.armed?.id === drag.mod.id ? null : drag.mod;
      this.selectedSlot = null;
      if (this.armed) this.showInfo(this.armed, 'Ahora toca una ranura resaltada');
      this.refresh();
      return;
    }

    if (slot && this.armed) {
      if (this.accepts(slot, this.armed)) {
        this.place(slot, this.armed);
      } else {
        this.toast(`${this.armed.name} no va en una ranura de ${slot.label.toLowerCase()}`);
      }
      this.refresh();
      return;
    }

    if (drag?.from) {
      // Toque sobre un módulo instalado: seleccionarlo.
      this.selectedSlot = this.selectedSlot === drag.from ? null : drag.from;
      if (this.selectedSlot) this.showInfo(drag.mod);
      this.refresh();
    }
  }

  private slotAt(x: number, y: number): SlotDef | undefined {
    let best: SlotDef | undefined;
    let bestD = Infinity;
    for (const s of SLOTS) {
      const [w, h] = this.slotSize(s);
      const dx = Math.abs(x - (CX + s.x));
      const dy = Math.abs(y - (CY + s.y));
      if (dx <= w / 2 + 6 && dy <= h / 2 + 6) {
        const d = dx + dy;
        if (d < bestD) { bestD = d; best = s; }
      }
    }
    return best;
  }

  private place(slot: SlotDef, mod: ModuleDef): void {
    const d = GameState.design;
    if (slot.id !== 'core' && !d.core) {
      this.toast('Primero instala el Bus estructural: es el esqueleto de la nave');
      return;
    }
    d[slot.id] = mod.id;
    this.sparkle(CX + slot.x, CY + slot.y);
    sfx.play('place');
    this.selectedSlot = null;
    this.armed = null; // cada toque en el catálogo toma UNA pieza
    this.cameras.main.shake(60, 0.002);
  }

  /** Chispas doradas al instalar un módulo: confirma la acción. */
  private sparkle(x: number, y: number): void {
    const fx = this.add.particles(x, y, 'fx-spark', {
      speed: { min: 20, max: 60 }, lifespan: 380, quantity: 10, alpha: { start: 1, end: 0 }, emitting: false,
    }).setDepth(15);
    fx.explode(10);
    this.time.delayedCall(500, () => fx.destroy());
  }

  private removeFrom(slotId: string, moving = false): void {
    const d = GameState.design;
    if (!moving) sfx.play('remove');
    if (slotId === 'core' && !moving) {
      for (const k of Object.keys(d)) delete d[k];
      this.toast('Sin bus no hay nave: se desmontaron todos los módulos');
    } else {
      delete d[slotId];
    }
    this.selectedSlot = null;
  }

  /* ------------------------------------------------------------------ */
  /* Medidores (derecha)                                                  */
  /* ------------------------------------------------------------------ */

  private buildGauges(): void {
    const g = this.add.graphics();
    drawPanel(g, 360, 20, 116, 224, 'hull', 'rivet');
    const defs: [string, string, string][] = [
      ['mass', 'mass', 'Masa'],
      ['money', 'money', 'Costo'],
      ['power', 'power', 'Energía'],
      ['eclipse', 'eclipse', 'Eclipse'],
      ['data', 'data', 'Datos'],
      ['dv', 'dv', 'Δv'],
      ['science', 'science', 'Ciencia'],
    ];
    defs.forEach(([key, icon, title], i) => {
      this.gauges[key] = new Gauge(this, 366, 26 + i * 30, 104, icon, title);
    });
    this.issues = text(this, 366, 232, '', { color: 'alert' });
  }

  private updateGauges(): void {
    const s = this.stats;
    const m = GameState.mission!;
    const reachable = s.rockets.filter((r) => r.reachable).sort((a, b) => a.capacity - b.capacity);

    // Masa: comparada con la capacidad de cada cohete que llega al destino.
    const smallest = reachable[0]?.capacity ?? 1;
    const massMax = Math.max(s.wetMass * 1.25, smallest * 1.15);
    const fitsCheapest = reachable.some((r) => r.fitsMass && r.affordable);
    this.gauges.mass.set(s.wetMass, massMax, fmtMass(s.wetMass),
      !reachable.some((r) => r.fitsMass) ? 'alert' : fitsCheapest ? 'ok' : 'foilLt',
      reachable.filter((r) => r.capacity <= massMax).map((r) => ({ value: r.capacity, label: SHORT[r.rocket.id] ?? r.rocket.name, color: 'frost' as PalKey })));

    // Presupuesto: marcas = cuánto puede costar la nave con cada cohete.
    this.gauges.money.set(s.craftCost, m.budget, `${Math.round(s.craftCost)} / ${fmtMoney(m.budget)}`,
      s.craftCost > m.budget ? 'alert' : reachable.some((r) => r.affordable) ? 'ok' : 'foilLt',
      reachable.filter((r) => r.fitsMass && r.rocket.cost < m.budget).map((r) => ({ value: m.budget - r.rocket.cost, label: SHORT[r.rocket.id] ?? '', color: 'frost' as PalKey })));

    // Energía: consumo frente a generación en el destino.
    const pMax = Math.max(s.powerGen, s.powerDraw, 1) * 1.15;
    this.gauges.power.set(s.powerDraw, pMax, `${Math.round(s.powerDraw)} / ${Math.round(s.powerGen)} W`,
      s.powerDraw > s.powerGen ? 'alert' : s.powerDraw > s.powerGen * 0.9 ? 'foilLt' : 'ok',
      [{ value: s.powerGen, label: 'genera', color: 'foilLt' }]);

    if (m.eclipseMinutes > 0) {
      const eMax = Math.max(s.batteryWh, s.eclipseNeedWh, 1) * 1.2;
      this.gauges.eclipse.set(s.batteryWh, eMax, `${s.batteryWh} / ${Math.ceil(s.eclipseNeedWh)} Wh`,
        s.batteryWh >= s.eclipseNeedWh ? 'ok' : 'alert', [{ value: s.eclipseNeedWh, label: 'necesita', color: 'frost' }]);
    } else {
      this.gauges.eclipse.set(0, 1, 'sin eclipses', 'steel');
    }

    const dMax = Math.max(s.dataKbps, s.downlinkKbps, 1) * 1.15;
    this.gauges.data.set(s.dataKbps, dMax, s.dataKbps ? `llega ${Math.round(s.dataRatio * 100)} %` : '—',
      s.dataRatio >= 1 ? 'signal' : s.dataRatio > 0.5 ? 'foilLt' : 'alert',
      s.downlinkKbps > 0 ? [{ value: s.downlinkKbps, label: fmtKbps(s.downlinkKbps), color: 'frost' }] : []);

    const vMax = Math.max(s.deltaV, m.deltaVRequired) * 1.25;
    this.gauges.dv.set(s.deltaV, vMax, `${Math.round(s.deltaV)} m/s`,
      s.deltaV >= m.deltaVRequired * 1.1 ? 'ok' : s.deltaV >= m.deltaVRequired ? 'foilLt' : 'alert',
      [{ value: m.deltaVRequired, label: 'mínimo', color: 'frost' }]);

    const sMax = Math.max(s.science, m.minScience) * 1.3;
    this.gauges.science.set(s.science, sMax, `${Math.floor(s.science)} pts`,
      s.science >= m.minScience ? 'ok' : 'alert', [{ value: m.minScience, label: 'meta', color: 'frost' }]);

    const bad = s.checks.filter((c) => !c.ok).length;
    this.issues.setText(bad ? `${bad} problema${bad > 1 ? 's' : ''} por resolver` : 'Diseño listo para volar').setColor(bad ? '#ff6a4d' : '#7fd46b');
  }

  /* ------------------------------------------------------------------ */
  /* Barra inferior                                                       */
  /* ------------------------------------------------------------------ */

  private buildBottomBar(): void {
    const g = this.add.graphics();
    g.fillStyle(C.hull).fillRect(VIEW.left, 247, VIEW.width, 23);
    g.fillStyle(C.rivet).fillRect(VIEW.left, 247, VIEW.width, 1);
    this.info = text(this, 6, 250, '');
    this.infoSub = text(this, 6, 260, '', { color: 'steel' });
    this.removeBtn = new Button(this, 300, 251, 46, 14, 'Quitar', () => {
      if (this.selectedSlot) this.removeFrom(this.selectedSlot);
      this.refresh();
    }, 'danger');
    new Button(this, 314 + 40, 251, 44, 14, 'Briefing', () => goTo(this, 'Briefing'), 'ghost');
    this.launchBtn = new Button(this, 404, 250, 72, 16, 'Lanzamiento', () => this.tryLaunch(), 'primary');
  }

  private showInfo(m: ModuleDef, extra?: string): void {
    this.info.setText(`${m.name}: ${m.description}`);
    const parts = [`${m.mass} kg`, `${m.cost} M$`];
    if (m.powerDraw) parts.push(`consume ${m.powerDraw} W`);
    if (m.solarW1AU) parts.push(`${m.solarW1AU} W a 1 UA`);
    if (m.rtgW) parts.push(`${m.rtgW} W constantes`);
    if (m.batteryWh) parts.push(`${m.batteryWh} Wh`);
    if (m.downlinkKbps1AU) parts.push(`${fmtKbps(m.downlinkKbps1AU)} a 1 UA`);
    if (m.isp) parts.push(`Isp ${m.isp} s`);
    if (m.propellant) parts.push(`+${m.propellant} kg de propelente`);
    if (m.dataKbps) parts.push(`${fmtKbps(m.dataKbps)} de datos`);
    if (m.science) parts.push(`ciencia ${m.science}`);
    this.infoSub.setText(extra ?? parts.join(' · '));
    fitLine(this.info, 290);
    fitLine(this.infoSub, 290);
  }

  private refresh(): void {
    const m = GameState.mission!;
    this.stats = computeStats(GameState.design, GameState.db.catalog, m, GameState.env!, GameState.db.rockets);
    this.drawCraft();
    this.drawRows();
    this.updateGauges();
    this.removeBtn.setVisible(!!this.selectedSlot);
    this.launchBtn.setEnabled(!!GameState.design.core);
    if (!this.armed && !this.selectedSlot && !this.drag) {
      this.info.setText(GameState.design.core ? 'Toca un módulo instalado para quitarlo, o arrástralo fuera de la nave.' : 'Arrastra módulos desde la izquierda, o tócalos y luego toca una ranura.');
      fitLine(this.info, 290);
      this.infoSub.setText(`Distancias de hoy: ${GameState.env!.sunDistanceAU.toFixed(2)} UA del Sol · fuente: ${GameState.env!.source === 'horizons' ? 'JPL Horizons' : 'efemérides JPL offline'}`);
    }
  }

  private toast(msg: string): void {
    sfx.play('error');
    this.toastText?.destroy();
    const t = text(this, 0, 0, msg, { align: 'center', color: 'space', wrap: 220 });
    const w = Math.min(232, t.width + 12);
    const g = this.add.graphics();
    drawPanel(g, -w / 2, -3, w, t.height + 6, 'foilLt', 'foilDk', 2);
    const c = this.add.container(CX, 28, [g, t]).setDepth(30);
    this.toastText = c;
    this.tweens.add({ targets: c, alpha: 0, delay: 2200, duration: 400, onComplete: () => c.destroy() });
  }

  /* ------------------------------------------------------------------ */
  /* Ir al lanzamiento (con confirmación si hay problemas)                */
  /* ------------------------------------------------------------------ */

  private tryLaunch(): void {
    const problems = this.stats.checks.filter((c) => !c.ok && c.id !== 'launch');
    if (problems.length === 0) {
      goTo(this, 'Launch');
      return;
    }
    const c = this.add.container(0, 0).setDepth(40);
    const bg = shade(this);
    const g = this.add.graphics();
    drawPanel(g, 100, 50, 280, 40 + problems.length * 12 + 40, 'hull', 'alert');
    const lines = problems.map((p) => `· ${p.label}: ${p.detail}`).join('\n');
    c.add([
      bg, g,
      text(this, 112, 58, 'Tu nave tiene problemas', { font: 'title', size: 16, color: 'alert' }),
      text(this, 112, 80, lines, { wrap: 256, lineSpacing: 4 }),
    ]);
    const by = 50 + 40 + problems.length * 12 + 16;
    c.add(new Button(this, 112, by, 120, 16, 'Volver al taller', () => c.destroy(), 'secondary'));
    c.add(new Button(this, 248, by, 120, 16, 'Lanzar de todos modos', () => goTo(this, 'Launch'), 'danger'));
  }
}

/** Recorta un texto a una sola línea de `maxW` píxeles, terminando en "…". */
function fitLine(t: Phaser.GameObjects.Text, maxW: number): void {
  if (t.width <= maxW) return;
  const words = t.text.split(' ');
  while (words.length > 1 && t.setText(`${words.join(' ')}…`).width > maxW) words.pop();
}
