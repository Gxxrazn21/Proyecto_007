/**
 * OperationsScene — la misión en vuelo.
 *
 * Secuencia: eventos de crucero → inserción orbital (prueba de Δv) →
 * eventos científicos → fin. Cada evento es una decisión rápida con
 * temporizador; el resultado depende del DISEÑO de la nave (systems/events.ts).
 */
import Phaser from 'phaser';
import { C } from '../art/palette';
import { GameState } from '../state/GameState';
import { computeStats, type DesignStats } from '../systems/calc';
import { applyEffects, cruiseEventCount, impactOf, pickEvents, resolveChoice, type Feeds, type LiveEvent } from '../systems/events';
import { buildCraft } from '../ui/craft';
import { sfx } from '../systems/sfx';
import { Button, Gauge, drawPanel, fadeIn, goTo, header, starfield, text } from '../ui/ui';

/** Segundos para decidir en cada evento. */
const DECISION_SECONDS = 12;
/** Duración de la fase científica (días de juego). */
const SCIENCE_DAYS = 730;

const SHADOW: Record<string, string> = { earth: 'de la Tierra', moon: 'de la Luna', mars: 'de Marte', jupiter: 'de Júpiter' };

type Step = { kind: 'event'; ev: LiveEvent } | { kind: 'insertion' } | { kind: 'end' };

export class OperationsScene extends Phaser.Scene {
  private steps: Step[] = [];
  private stepIndex = -1;
  private day = 0;
  private craft!: Phaser.GameObjects.Container;
  private card?: Phaser.GameObjects.Container;
  private timerEvent?: Phaser.Time.TimerEvent;
  private health!: Gauge;
  private science!: Gauge;
  private dvGauge!: Gauge;
  private power!: Gauge;
  private dayText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private timeline!: Phaser.GameObjects.Graphics;
  private cruiseCount = 0;
  /** Vista orbital: miniatura que gira alrededor del planeta tras la inserción. */
  private mini?: Phaser.GameObjects.Image;
  private orbitAngle = 0;

  constructor() {
    super('Operations');
  }

  async create(): Promise<void> {
    fadeIn(this);
    const m = GameState.mission!;
    starfield(this, 0.08);
    header(this, 3, `Operación · ${m.name}`);

    // Destino a la derecha, nave a la izquierda.
    this.add.image(300, 120, `pl-${m.body}`).setDepth(1);
    this.mini = undefined;
    this.craft = buildCraft(this, 150, 130, GameState.design);
    this.tweens.add({ targets: this.craft, y: 124, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.buildHud();

    const feeds: Feeds = (await GameState.feeds) ?? { flares: [], cmes: [], storms: [], asteroids: [], earth: [] };
    if (!this.scene.isActive()) return;
    const cruiseDays = GameState.rocket?.cruiseDays[m.destination] ?? 0;
    this.cruiseCount = cruiseEventCount(cruiseDays);
    const cruise = pickEvents(GameState.db.events, 'cruise', this.cruiseCount, m, feeds, SHADOW[m.body]);
    const used = new Set(cruise.map((e) => e.def.id));
    // Evita dos llamaradas casi iguales en la misma partida.
    if (used.has('flare')) used.add('flare-ops');
    const science = pickEvents(GameState.db.events, 'science', m.scienceEvents, m, feeds, SHADOW[m.body], Math.random, used);

    this.steps = [
      ...cruise.map((ev) => ({ kind: 'event' as const, ev })),
      { kind: 'insertion' as const },
      ...science.map((ev) => ({ kind: 'event' as const, ev })),
      { kind: 'end' as const },
    ];
    this.updateHud();
    this.time.delayedCall(900, () => this.next());
  }

  update(_t: number, dt: number): void {
    if (!this.mini) return;
    // Órbita elíptica vista de canto: por detrás del planeta en la mitad superior.
    this.orbitAngle += (dt / 1000) * 0.8;
    const s = Math.sin(this.orbitAngle);
    this.mini.setPosition(Math.round(300 + 46 * Math.cos(this.orbitAngle)), Math.round(120 + 12 * s));
    this.mini.setDepth(s > 0 ? 2 : 0);
  }

  private stats(): DesignStats {
    return computeStats(GameState.design, GameState.db.catalog, GameState.mission!, GameState.env!, GameState.db.rockets, {
      rocket: GameState.rocket ?? undefined,
      solarFactor: GameState.ops.solarFactor,
    });
  }

  /* ------------------------------------------------------------------ */
  /* HUD                                                                  */
  /* ------------------------------------------------------------------ */

  private buildHud(): void {
    const g = this.add.graphics();
    drawPanel(g, 360, 20, 116, 136, 'hull', 'rivet');
    this.health = new Gauge(this, 366, 28, 104, 'health', 'Salud de la nave');
    this.science = new Gauge(this, 366, 60, 104, 'science', 'Ciencia');
    this.dvGauge = new Gauge(this, 366, 92, 104, 'dv', 'Δv disponible');
    this.power = new Gauge(this, 366, 124, 104, 'power', 'Energía');

    this.timeline = this.add.graphics();
    this.phaseText = text(this, 8, 22, '', { color: 'foilLt' });
    this.dayText = text(this, 352, 22, '', { align: 'right', color: 'steel' });
  }

  private updateHud(): void {
    const s = this.stats();
    const ops = GameState.ops;
    const m = GameState.mission!;
    this.health.set(ops.health, 100, `${ops.health}`, ops.health > 60 ? 'ok' : ops.health > 30 ? 'foilLt' : 'alert');
    const sci = s.science * ops.scienceMult;
    this.science.set(sci, Math.max(sci, m.minScience) * 1.3, `${Math.floor(sci)} pts`, sci >= m.minScience ? 'ok' : 'alert', [{ value: m.minScience, label: 'meta', color: 'frost' }]);
    const dvLeft = s.deltaV - ops.deltaVSpent;
    const need = ops.inserted ? 0 : m.deltaVRequired;
    this.dvGauge.set(Math.max(0, dvLeft), Math.max(dvLeft, m.deltaVRequired) * 1.2, `${Math.max(0, Math.round(dvLeft))} m/s`,
      dvLeft >= need ? 'ok' : 'alert', need ? [{ value: need, label: 'inserción', color: 'frost' }] : []);
    this.power.set(s.powerDraw, Math.max(s.powerGen, s.powerDraw, 1) * 1.15, `${Math.round(s.powerDraw)}/${Math.round(s.powerGen)} W`,
      s.powerDraw > s.powerGen ? 'alert' : 'ok', [{ value: s.powerGen, label: '', color: 'foilLt' }]);

    // Línea de tiempo: un punto por paso.
    const g = this.timeline.clear();
    const total = this.steps.length;
    const x0 = 8, x1 = 352, y = 36;
    g.fillStyle(C.rivet).fillRect(x0, y, x1 - x0, 1);
    this.steps.forEach((st, i) => {
      const x = Math.round(x0 + ((x1 - x0) * i) / Math.max(1, total - 1));
      const done = i < this.stepIndex;
      const now = i === this.stepIndex;
      const col = st.kind === 'insertion' ? C.foilLt : st.kind === 'end' ? C.ok : C.steel;
      g.fillStyle(now ? C.frost : done ? col : C.rivet).fillRect(x - (now ? 2 : 1), y - (now ? 2 : 1), now ? 5 : 3, now ? 5 : 3);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Secuencia                                                            */
  /* ------------------------------------------------------------------ */

  private next(): void {
    if (GameState.ops.health <= 0) {
      this.finish();
      return;
    }
    this.stepIndex++;
    const step = this.steps[this.stepIndex];
    const m = GameState.mission!;
    const cruiseDays = GameState.rocket?.cruiseDays[m.destination] ?? 0;
    const inScience = this.stepIndex > this.cruiseCount;
    const sciIndex = this.stepIndex - this.cruiseCount - 1;
    const sciTotal = this.steps.length - this.cruiseCount - 2;
    this.day = inScience
      ? cruiseDays + Math.round((SCIENCE_DAYS * (sciIndex + 1)) / Math.max(1, sciTotal + 1))
      : Math.round((cruiseDays * (this.stepIndex + 1)) / (this.cruiseCount + 1));
    this.dayText.setText(`Día ${this.day.toLocaleString('es-MX')}`);
    this.phaseText.setText(step.kind === 'insertion' ? 'Inserción orbital' : inScience ? 'Operación científica' : 'Crucero');
    this.updateHud();

    if (step.kind === 'event') this.showEvent(step.ev);
    else if (step.kind === 'insertion') this.insertion();
    else this.finish();
  }

  /* ------------------------------------------------------------------ */
  /* Tarjeta de evento                                                    */
  /* ------------------------------------------------------------------ */

  private showEvent(ev: LiveEvent): void {
    const c = this.add.container(0, 0).setDepth(20);
    this.card = c;
    sfx.play('alert');
    let lastSecond = DECISION_SECONDS;
    const x = 40, w = 300;
    const g = this.add.graphics();
    c.add(g);
    const title = text(this, x + 10, 8, ev.title, { font: 'title', size: 16, color: 'foilLt', wrap: w - 20 });
    c.add(title);
    let ty = 8 + title.height + 6;
    if (ev.dataSource) {
      const chip = text(this, x + 14, ty + 1, ev.dataSource, { color: 'space' });
      const cg = this.add.graphics().fillStyle(C.signal).fillRect(x + 10, ty, chip.width + 8, 10);
      c.add([cg, chip]);
      ty += 14;
    }
    const body = text(this, x + 10, ty, ev.text, { wrap: w - 20, lineSpacing: 3 });
    c.add(body);

    // Altura dinámica: título + texto + temporizador + opciones.
    const barY = body.y + body.height + 10;
    const h = barY + 8 + ev.def.choices.length * 20 + 2;
    c.setY(Math.round(44 + (200 - h) / 2));
    drawPanel(g, x, 0, w, h, 'hull', 'foilLt');

    // Temporizador de decisión
    const bar = this.add.graphics();
    c.add(bar);
    const started = this.time.now;
    const drawBar = () => {
      const left = Math.max(0, 1 - (this.time.now - started) / (DECISION_SECONDS * 1000));
      bar.clear().fillStyle(C.space).fillRect(x + 10, barY, w - 20, 3);
      bar.fillStyle(left > 0.3 ? C.foilLt : C.alert).fillRect(x + 10, barY, Math.round((w - 20) * left), 3);
    };
    drawBar();
    this.timerEvent = this.time.addEvent({
      delay: 50, repeat: (DECISION_SECONDS * 1000) / 50,
      callback: () => {
        drawBar();
        // Tic en los últimos 3 segundos.
        const secLeft = Math.ceil(DECISION_SECONDS - (this.time.now - started) / 1000);
        if (secLeft < lastSecond) {
          lastSecond = secLeft;
          if (secLeft <= 3 && secLeft > 0) sfx.play('tick');
        }
        if (this.time.now - started >= DECISION_SECONDS * 1000) this.decide(ev, ev.def.timeoutChoice, true);
      },
    });

    ev.def.choices.forEach((ch, i) => {
      c.add(new Button(this, x + 10, barY + 8 + i * 20, w - 20, 16, ch.label, () => this.decide(ev, i, false)));
    });

    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 160 });
  }

  private decide(ev: LiveEvent, index: number, timedOut: boolean): void {
    if (!this.card) return;
    this.timerEvent?.remove();
    this.card.destroy();
    this.card = undefined;

    const outcome = resolveChoice(ev, index, this.stats(), GameState.ops);
    applyEffects(GameState.ops, outcome.effects);
    const impact = impactOf(outcome.effects);
    sfx.play(impact === 'bad' ? 'bad' : 'good');
    GameState.report.push({
      phase: this.stepIndex > this.cruiseCount ? 'science' : 'cruise',
      title: ev.title,
      decision: timedOut ? `Se acabó el tiempo: "${ev.def.choices[index].label}"` : ev.def.choices[index].label,
      consequence: outcome.text,
      lesson: ev.def.lesson,
      impact,
    });

    if (outcome.effects.health && outcome.effects.health < 0) {
      this.cameras.main.shake(300, 0.01);
      this.cameras.main.flash(120, 255, 106, 77);
    }
    this.updateHud();
    const heading = timedOut ? 'Se acabó el tiempo' : impact === 'good' ? 'Buena decisión' : impact === 'bad' ? 'Consecuencia' : 'Resultado';
    this.resultCard(heading, outcome.text, ev.def.lesson, impact);
  }

  private resultCard(title: string, body: string, lesson: string, impact: 'good' | 'bad' | 'neutral', onContinue = () => this.next()): void {
    const c = this.add.container(0, 0).setDepth(20);
    const x = 40, y = 70, w = 300;
    const color = impact === 'good' ? 'ok' : impact === 'bad' ? 'alert' : 'steel';
    const t1 = text(this, x + 10, y + 8, title, { font: 'title', size: 16, color });
    const t2 = text(this, x + 10, y + 30, body, { wrap: w - 20, lineSpacing: 3 });
    const t3 = text(this, x + 10, y + 36 + t2.height, lesson, { wrap: w - 20, color: 'steel', lineSpacing: 2 });
    const h = 36 + t2.height + t3.height + 34;
    const g = this.add.graphics();
    drawPanel(g, x, y, w, h, 'hull', color);
    c.add([g, t1, t2, t3]);
    c.add(new Button(this, x + w - 90, y + h - 22, 80, 16, 'Continuar', () => { c.destroy(); onContinue(); }, 'primary'));
  }

  /* ------------------------------------------------------------------ */
  /* Inserción orbital: aquí se prueba el Δv                              */
  /* ------------------------------------------------------------------ */

  private insertion(): void {
    const s = this.stats();
    const m = GameState.mission!;
    const ops = GameState.ops;
    const spentBefore = ops.deltaVSpent;
    const available = s.deltaV - spentBefore;
    const ok = available >= m.deltaVRequired && ops.health > 0;

    // Encendido del motor
    const flame = this.add.sprite(0, 30, 'fx-flame').setOrigin(0.5, 0).play('flame');
    this.craft.add(flame);
    this.tweens.add({ targets: this.craft, x: this.craft.x + (ok ? 40 : 90), duration: 2000, ease: 'Sine.inOut' });

    this.time.delayedCall(2100, () => {
      flame.destroy();
      if (ok) {
        ops.inserted = true;
        ops.deltaVSpent += m.deltaVRequired;
        sfx.play('good');
        this.enterOrbit();
      } else {
        sfx.play('bad');
        ops.scienceMult *= m.body === 'earth' ? 0.5 : 0.15;
        ops.deltaVSpent = s.deltaV;
      }
      const body = ok
        ? `Necesitabas ${m.deltaVRequired} m/s y tenías ${Math.round(available)} m/s. ¡En órbita!`
        : `Necesitabas ${m.deltaVRequired} m/s pero sólo quedaban ${Math.max(0, Math.round(available))} m/s. ${m.body === 'earth' ? 'La órbita quedó baja y la misión se acortó a la mitad.' : 'La nave pasó de largo: sólo un breve sobrevuelo.'}`;
      GameState.report.push({
        phase: 'insertion',
        title: m.body === 'earth' ? 'Ajuste de órbita' : 'Inserción orbital',
        decision: `Δv de diseño: ${Math.round(s.deltaV)} m/s; gastado en el viaje: ${Math.round(spentBefore)} m/s`,
        consequence: body,
        lesson: 'Ecuación del cohete: Δv = Isp · g0 · ln(masa llena / masa vacía). Más combustible da más Δv, pero cada vez rinde menos.',
        impact: ok ? 'good' : 'bad',
      });
      this.updateHud();
      if (!ok) {
        // Sin órbita no hay fase científica: saltamos al final.
        this.steps = [...this.steps.slice(0, this.stepIndex + 1), { kind: 'end' }];
      }
      this.resultCard(ok ? 'Inserción exitosa' : 'Inserción fallida', body, ok ? 'Toda la ciencia empieza aquí.' : 'Un margen de Δv del 10–20 % protege contra imprevistos del viaje.', ok ? 'good' : 'bad');
    });
  }

  /** La nave grande se acerca al planeta y pasa a la vista orbital. */
  private enterOrbit(): void {
    this.tweens.killTweensOf(this.craft);
    this.tweens.add({
      targets: this.craft, x: 300, y: 120, scale: 0.2, alpha: 0, duration: 900, ease: 'Quad.in',
      onComplete: () => {
        this.orbitAngle = Math.PI;
        this.mini = this.add.image(254, 120, 'craft-mini');
      },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Fin                                                                  */
  /* ------------------------------------------------------------------ */

  private finish(): void {
    const s = this.stats();
    const ops = GameState.ops;
    const m = GameState.mission!;
    const lost = ops.health <= 0;
    GameState.finalScience = lost ? s.science * ops.scienceMult * 0.3 : s.science * ops.scienceMult;
    GameState.outcome = lost ? 'lost' : ops.inserted && GameState.finalScience >= m.minScience ? 'success' : 'partial';

    sfx.play(lost ? 'fail' : 'success');
    if (lost) {
      this.tweens.add({ targets: this.craft, angle: 200, alpha: 0, duration: 2000 });
      if (this.mini) this.tweens.add({ targets: this.mini, alpha: 0, duration: 1500 });
      text(this, 180, 200, 'Se perdió el contacto con la nave', { align: 'center', color: 'alert' });
    } else {
      text(this, 180, 200, 'Misión completada: los datos están en casa', { align: 'center', color: 'ok' });
    }
    this.time.delayedCall(1600, () => goTo(this, 'Results'));
  }
}
