/**
 * LaunchScene — elegir cohete (capacidad vs. costo) y animación del despegue.
 * Si la masa de la nave supera la capacidad del cohete al destino, falla.
 */
import Phaser from 'phaser';
import { C } from '../art/palette';
import { GameState } from '../state/GameState';
import { computeStats, fmtMass, fmtMoney, type DesignStats } from '../systems/calc';
import { buildCraft } from '../ui/craft';
import { Button, drawPanel, fadeIn, goTo, header, starfield, text } from '../ui/ui';
import { VIEW } from '../ui/view';
import type { Destination, Rocket } from '../types';

const DEST_NAME: Record<Destination, string> = {
  leo: 'órbita terrestre', tli: 'la Luna', mars: 'Marte', jupiter: 'Júpiter',
};

export class LaunchScene extends Phaser.Scene {
  private stats!: DesignStats;
  private choice: Rocket | null = null;
  private cards: { rocket: Rocket; g: Phaser.GameObjects.Graphics; ok: boolean }[] = [];
  private summary!: Phaser.GameObjects.Text;
  private goBtn!: Button;

  constructor() {
    super('Launch');
  }

  create(): void {
    fadeIn(this);
    this.cards = [];
    this.choice = null;
    const m = GameState.mission!;
    this.stats = computeStats(GameState.design, GameState.db.catalog, m, GameState.env!, GameState.db.rockets);

    starfield(this, 0.02, 0.6);
    header(this, 2, `Elige el cohete · destino: ${DEST_NAME[m.destination]}`);

    text(this, 8, 22, `Tu nave pesa ${fmtMass(this.stats.wetMass)} con combustible y cuesta ${fmtMoney(this.stats.craftCost)}.`, { color: 'frost' });
    this.stats.rockets.forEach((fit, i) => this.rocketCard(fit.rocket, i));

    const g = this.add.graphics();
    g.fillStyle(C.hull).fillRect(VIEW.left, 247, VIEW.width, 23).fillStyle(C.rivet).fillRect(VIEW.left, 247, VIEW.width, 1);
    this.summary = text(this, 6, 251, 'Elige un cohete', { wrap: 300 });
    new Button(this, 320, 251, 70, 14, 'Volver al taller', () => goTo(this, 'Workshop'), 'ghost');
    this.goBtn = new Button(this, 396, 250, 80, 16, '¡Lanzar!', () => this.launch(), 'primary').setEnabled(false);

    // Preselecciona el cohete más barato que sirve.
    const fits = (r: Rocket) => this.stats.rockets.find((f) => f.rocket.id === r.id)!.fitsMass;
    const usable = this.cards.filter((c) => c.ok).sort((a, b) => a.rocket.cost - b.rocket.cost);
    const best = usable.find((c) => fits(c.rocket)) ?? usable[0];
    if (best) this.select(best.rocket);
  }

  private rocketCard(r: Rocket, i: number): void {
    const x = 8 + i * 158;
    const y = 36;
    const fit = this.stats.rockets.find((f) => f.rocket.id === r.id)!;
    const ok = fit.reachable && fit.affordable;
    const g = this.add.graphics();
    this.cards.push({ rocket: r, g, ok });

    this.add.image(x + 22, y + 104, `rk-${r.id}`).setOrigin(0.5, 1).setAlpha(ok ? 1 : 0.4);
    text(this, x + 44, y + 8, r.name, { font: 'title', size: 16, color: ok ? 'frost' : 'steel' });
    text(this, x + 44, y + 26, r.operator, { color: 'steel' });
    text(this, x + 44, y + 40, `Costo: ${fmtMoney(r.cost)}`);
    text(this, x + 44, y + 52, fit.reachable ? `Lleva ${fmtMass(fit.capacity)}` : `No llega a ${DEST_NAME[GameState.mission!.destination]}`);
    const days = r.cruiseDays[GameState.mission!.destination];
    text(this, x + 44, y + 64, fit.reachable ? `Viaje: ${days >= 365 ? `${(days / 365).toFixed(1)} años` : days > 0 ? `${days} días` : 'directo'}` : '', { color: 'steel' });

    // Barra: masa de la nave vs capacidad
    if (fit.reachable) {
      const bx = x + 44, by = y + 80, bw = 100;
      const ratio = this.stats.wetMass / fit.capacity;
      g.fillStyle(C.space).fillRect(bx, by, bw, 6);
      g.fillStyle(ratio > 1 ? C.alert : ratio > 0.9 ? C.foilLt : C.ok).fillRect(bx + 1, by + 1, Math.min(bw - 2, (bw - 2) * ratio), 4);
      text(this, bx, by + 9, ratio > 1 ? `Exceso: +${fmtMass(this.stats.wetMass - fit.capacity)}` : `Margen: ${fmtMass(fit.capacity - this.stats.wetMass)}`, { color: ratio > 1 ? 'alert' : 'ok' });
    }
    const status = !fit.reachable ? 'No disponible' : !fit.affordable ? 'Fuera de presupuesto' : '';
    if (status) text(this, x + 44, y + 104, status, { color: 'alert' });
    text(this, x + 6, y + 120, r.description, { wrap: 140, color: 'steel', lineSpacing: 2 });
    g.setDepth(-1);

    const zone = this.add.zone(x, y, 150, 206).setOrigin(0).setInteractive({ cursor: ok ? 'pointer' : 'not-allowed' });
    zone.on('pointerup', () => ok && this.select(r));
    this.drawCards();
  }

  private drawCards(): void {
    this.cards.forEach(({ rocket, g, ok }, i) => {
      g.clear();
      const active = this.choice?.id === rocket.id;
      drawPanel(g, 8 + i * 158, 36, 150, 206, active ? 'rivet' : 'hull', active ? 'foilLt' : ok ? 'rivet' : 'hull');
    });
  }

  private select(r: Rocket): void {
    this.choice = r;
    this.drawCards();
    const m = GameState.mission!;
    const total = this.stats.craftCost + r.cost;
    this.summary.setText(`Total: nave ${fmtMoney(this.stats.craftCost)} + cohete ${fmtMoney(r.cost)} = ${fmtMoney(total)} de ${fmtMoney(m.budget)}`);
    this.goBtn.setEnabled(true);
  }

  /* ------------------------------------------------------------------ */
  /* Animación                                                            */
  /* ------------------------------------------------------------------ */

  private launch(): void {
    const r = this.choice!;
    const m = GameState.mission!;
    GameState.rocket = r;
    const capacity = r.payload[m.destination];
    const fails = this.stats.wetMass > capacity;
    const margin = capacity - this.stats.wetMass;

    GameState.report.push({
      phase: 'launch',
      title: 'Elección del cohete',
      decision: `${r.name} (${fmtMoney(r.cost)}) para una nave de ${fmtMass(this.stats.wetMass)}`,
      consequence: fails
        ? `El ${r.name} sólo puede llevar ${fmtMass(capacity)} a ${DEST_NAME[m.destination]}: le sobraban ${fmtMass(-margin)} y no alcanzó la velocidad orbital.`
        : `Llegó con ${fmtMass(margin)} de margen. Sobró ${fmtMoney(m.budget - this.stats.craftCost - r.cost)} del presupuesto.`,
      lesson: fails
        ? 'Cada kilo de nave exige muchos kilos de combustible en el cohete: la masa es el recurso más caro del espacio.'
        : r.id === 'sls'
          ? 'Europa Clipper cambió el SLS por un Falcon Heavy y ahorró unos 2 000 M$ a cambio de un viaje 3 años más largo.'
          : 'Elegir el cohete más barato que cumple deja dinero para mejores instrumentos.',
      impact: fails ? 'bad' : 'good',
    });

    this.children.removeAll(true);
    this.cameras.main.fadeIn(200, 15, 19, 48);
    this.animateLaunch(r, fails);
  }

  private animateLaunch(r: Rocket, fails: boolean): void {
    const WORLD_H = 1400;
    const cam = this.cameras.main;
    const L = VIEW.left, W = VIEW.width;
    cam.setBounds(L, 0, W, WORLD_H);

    // Cielo por bandas: azul abajo → espacio arriba (tramado entre bandas).
    const sky = this.add.graphics();
    const bands = [C.space, C.hull, C.rivet, C.cellDk, C.cell];
    const bandH = WORLD_H / bands.length;
    bands.forEach((c, i) => sky.fillStyle(c).fillRect(L, i * bandH, W, bandH));
    for (let i = 1; i < bands.length; i++) {
      for (let y = 0; y < 6; y++) for (let x = L + (y % 2) * 2; x < L + W; x += 4) sky.fillStyle(bands[i - 1]).fillRect(x, i * bandH + y, 2, 1);
    }
    this.add.tileSprite(L, 0, W, 270, 'bg-stars').setOrigin(0).setAlpha(0.9);
    this.add.tileSprite(L, 270, W, 270, 'bg-stars').setOrigin(0).setAlpha(0.4).setFlipY(true);

    // Suelo y plataforma
    const groundY = WORLD_H - 20;
    this.add.rectangle(L, groundY, W, 20, C.hull).setOrigin(0);
    this.add.rectangle(L, groundY, W, 1, C.steel).setOrigin(0);
    this.add.rectangle(212, groundY - 4, 56, 4, C.moonDk).setOrigin(0);
    this.add.image(222, groundY - 4, 'tower').setOrigin(0.5, 1);

    const rocket = this.add.container(240, groundY - 4);
    const flame = this.add.sprite(0, 0, 'fx-flame').setOrigin(0.5, 0).play('flame').setVisible(false);
    const body = this.add.image(0, 0, `rk-${r.id}`).setOrigin(0.5, 1);
    rocket.add([flame, body]);
    if (r.id === 'falconheavy' || r.id === 'sls') {
      const side = r.id === 'sls' ? 9 : 10;
      for (const dx of [-side, side]) rocket.add(this.add.sprite(dx, 0, 'fx-flame').setOrigin(0.5, 0).play('flame').setVisible(false).setName('booster'));
    }

    cam.scrollY = WORLD_H - 270;
    const smoke = this.add.particles(240, groundY - 2, 'fx-smoke', {
      frame: [0, 1, 2], speedX: { min: -60, max: 60 }, speedY: { min: -12, max: 0 }, lifespan: 1600,
      alpha: { start: 0.9, end: 0 }, frequency: 30, emitting: false,
    });

    const countdown = text(this, Math.round(W / 2), 0, '', { font: 'title', size: 32, color: 'foilLt', align: 'center' }).setScrollFactor(0).setY(60);
    const caption = text(this, Math.round(W / 2), 240, '', { align: 'center', color: 'frost', wrap: 400 }).setScrollFactor(0);
    const steps = ['T-3', 'T-2', 'T-1', '¡Despegue!'];
    steps.forEach((s, i) => this.time.delayedCall(i * 700, () => {
      countdown.setText(s);
      if (i === 3) {
        flame.setVisible(true);
        rocket.each((o: Phaser.GameObjects.GameObject) => o.name === 'booster' && (o as Phaser.GameObjects.Sprite).setVisible(true));
        smoke.start();
        cam.shake(1200, 0.006);
      }
    }));

    this.time.delayedCall(2600, () => {
      countdown.setText('');
      smoke.stop();
      cam.startFollow(rocket, true, 0.1, 0.1, 0, 60);
      const climb = fails ? 520 : WORLD_H - 140;
      this.tweens.add({
        targets: rocket, y: rocket.y - climb, duration: fails ? 4200 : 5200, ease: fails ? 'Sine.out' : 'Quad.in',
        onUpdate: () => {
          if (fails) rocket.setAngle(Math.sin(this.time.now / 140) * (rocket.y < groundY - 300 ? 8 : 2));
        },
        onComplete: () => (fails ? this.explode(rocket, r) : this.separate(rocket)),
      });
      caption.setText(fails ? 'El cohete va demasiado cargado…' : `Ascenso nominal. Rumbo a ${DEST_NAME[GameState.mission!.destination]}.`);
    });
  }

  private explode(rocket: Phaser.GameObjects.Container, r: Rocket): void {
    const { x, y } = rocket;
    rocket.destroy();
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.shake(600, 0.02);
    cam.flash(150, 255, 242, 179);
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 160, () => this.add.sprite(x + Phaser.Math.Between(-16, 16), y - 40 + Phaser.Math.Between(-20, 20), 'fx-boom').play('boom'));
    }
    const m = GameState.mission!;
    GameState.outcome = 'launch-fail';
    GameState.finalScience = 0;
    this.time.delayedCall(1300, () => this.endCard(
      'Fallo en el lanzamiento',
      `Tu nave pesaba ${fmtMass(this.stats.wetMass)} y el ${r.name} sólo puede llevar ${fmtMass(r.payload[m.destination])} a ${DEST_NAME[m.destination]}.`,
      'alert', 'Ver el reporte', 'Results',
    ));
  }

  private separate(rocket: Phaser.GameObjects.Container): void {
    const cam = this.cameras.main;
    cam.stopFollow();
    const { x, y } = rocket;
    // La etapa se aleja y aparece la nave.
    this.tweens.add({ targets: rocket, y: y + 220, alpha: 0, angle: -20, duration: 2400, ease: 'Quad.in' });
    // La nave aparece en la parte alta de la vista actual de la cámara.
    const top = cam.worldView.y;
    const craft = buildCraft(this, x, top + 110, GameState.design).setAlpha(0);
    this.tweens.add({ targets: craft, alpha: 1, y: top + 92, duration: 1800, ease: 'Sine.out' });
    this.time.delayedCall(1900, () => this.endCard('Separación exitosa', 'La nave está en camino. Empieza la fase de operación.', 'ok', 'Iniciar operación', 'Operations'));
  }

  /** Tarjeta final. Se dibuja en coordenadas del mundo (la cámara ya está quieta). */
  private endCard(title: string, body: string, color: 'ok' | 'alert', cta: string, next: string): void {
    const cam = this.cameras.main;
    cam.stopFollow();
    const oy = Math.round(cam.worldView.y);
    const g = this.add.graphics();
    drawPanel(g, 90, oy + 190, 300, 70, 'hull', color === 'ok' ? 'foilLt' : 'alert');
    text(this, 102, oy + 196, title, { font: 'title', size: 16, color: color === 'ok' ? 'foilLt' : 'alert' });
    text(this, 102, oy + 216, body, { wrap: 200, lineSpacing: 2 });
    new Button(this, 304, oy + 236, 78, 16, cta, () => goTo(this, next), 'primary');
  }
}
