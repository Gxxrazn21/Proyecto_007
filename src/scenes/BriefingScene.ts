/**
 * BriefingScene: el jugador elige el objetivo de la misión.
 * Muestra requisitos y las distancias REALES de hoy (JPL Horizons),
 * traducidas a consecuencias: luz solar disponible y retardo de la señal.
 */
import Phaser from 'phaser';
import { C } from '../art/palette';
import { GameState } from '../state/GameState';
import { getEnv } from '../services/nasa';
import { fmtMoney } from '../systems/calc';
import { Button, drawPanel, fadeIn, goTo, header, text } from '../ui/ui';
import type { EnvData, Mission } from '../types';

/** Segundos que tarda la luz en recorrer 1 UA. */
const LIGHT_SECONDS_PER_AU = 499.005;

export class BriefingScene extends Phaser.Scene {
  private selected!: Mission;
  private cards: Phaser.GameObjects.Graphics[] = [];
  private detail?: Phaser.GameObjects.Container;
  private loadToken = 0;

  constructor() {
    super('Briefing');
  }

  create(): void {
    fadeIn(this);
    this.add.image(0, 0, 'bg-stars').setOrigin(0).setAlpha(0.6);
    header(this, 0, 'Elige tu misión');

    const missions = GameState.db.missions;
    missions.forEach((m, i) => this.missionCard(m, i));

    new Button(this, 8, 250, 60, 14, 'Volver', () => goTo(this, 'Menu'), 'ghost');
    new Button(this, 372, 248, 100, 18, 'Diseñar la nave', () => {
      GameState.startMission(this.selected);
      goTo(this, 'Workshop');
    }, 'primary');

    this.select(GameState.mission ?? missions[0]);
  }

  private missionCard(m: Mission, i: number): void {
    const y = 22 + i * 56;
    const g = this.add.graphics();
    this.cards.push(g);
    g.setData('mission', m);
    this.add.image(26, y + 26, `pl-${m.body}-sm`);
    text(this, 44, y + 10, m.name, { font: 'title', size: 12 });
    text(this, 44, y + 26, m.objective, { color: 'steel' });
    // Dificultad: 3 indicadores, rellenos según el nivel.
    for (let d = 0; d < 3; d++) {
      this.add.rectangle(45 + d * 7, y + 41, 5, 5, d < m.difficulty ? C.foilLt : C.rivet).setOrigin(0);
    }
    const zone = this.add.zone(8, y, 160, 52).setOrigin(0).setInteractive({ cursor: 'pointer' });
    zone.on('pointerup', () => this.select(m));
    g.setDepth(-1);
  }

  private select(m: Mission): void {
    this.selected = m;
    this.cards.forEach((g, i) => {
      const active = g.getData('mission') === m;
      g.clear();
      drawPanel(g, 8, 22 + i * 56, 160, 52, active ? 'rivet' : 'hull', active ? 'foilLt' : 'rivet');
    });
    this.showDetail(m);
  }

  private showDetail(m: Mission): void {
    this.detail?.destroy();
    const c = this.add.container(0, 0);
    this.detail = c;
    const g = this.add.graphics();
    drawPanel(g, 176, 22, 296, 222, 'hull', 'rivet');
    c.add(g);

    c.add(this.add.image(206, 54, `pl-${m.body}`));
    c.add(text(this, 240, 30, m.name, { font: 'title', size: 16, color: 'foilLt' }));
    c.add(text(this, 240, 50, m.objective, { color: 'frost' }));
    c.add(text(this, 240, 62, `Inspirada en ${m.inspiredBy}`, { color: 'steel', wrap: 224 }));
    c.add(text(this, 186, 90, m.briefing, { wrap: 276, lineSpacing: 3 }));

    // Requisitos
    const reqs: [string, string, string][] = [
      ['money', 'Presupuesto', fmtMoney(m.budget)],
      ['dv', 'Δv que debe aportar la nave', `${m.deltaVRequired.toLocaleString('es-MX')} m/s`],
      ['eclipse', 'Eclipse por órbita', m.eclipseMinutes ? `${m.eclipseMinutes} min` : 'ninguno'],
      ['science', 'Ciencia mínima', `${m.minScience} puntos`],
    ];
    reqs.forEach(([icon, label, value], i) => {
      const y = 132 + i * 12;
      c.add(this.add.image(186, y + 1, `ic-${icon}`).setOrigin(0));
      c.add(text(this, 196, y, label, { color: 'steel' }));
      c.add(text(this, 462, y, value, { align: 'right' }));
    });
    const sep = this.add.graphics().fillStyle(C.rivet).fillRect(186, 184, 276, 1);
    c.add(sep);

    // Datos reales de hoy
    const live = text(this, 186, 190, 'Consultando JPL Horizons…', { color: 'steel' });
    const facts = text(this, 186, 204, '', { wrap: 276, lineSpacing: 3 });
    c.add([live, facts]);

    const token = ++this.loadToken;
    if (!GameState.envCache.has(m.body)) GameState.envCache.set(m.body, getEnv(m.body));
    GameState.envCache.get(m.body)!.then((env) => {
      if (token !== this.loadToken || !live.active) return;
      live.setText(env.source === 'horizons' ? `Hoy, según JPL Horizons (${env.date})` : `Hoy, según efemérides offline de JPL (${env.date})`);
      live.setColor(env.source === 'horizons' ? '#5ad6c6' : '#efc65c');
      facts.setText(this.describe(m, env));
    });
  }

  /** Traduce las distancias a consecuencias de diseño que un estudiante entiende. */
  private describe(m: Mission, env: EnvData): string {
    const sun = (100 / (env.sunDistanceAU * env.sunDistanceAU)).toFixed(0);
    const delay = env.earthDistanceAU * LIGHT_SECONDS_PER_AU;
    const delayTxt = delay < 60 ? `${delay.toFixed(delay < 1 ? 2 : 1)} s` : `${(delay / 60).toFixed(1)} min`;
    if (m.body === 'earth' || m.body === 'moon') {
      return `Estás a ${env.sunDistanceAU.toFixed(3)} UA del Sol: tus paneles reciben el ${sun} % de la luz de referencia. Una señal tarda ${delayTxt} en llegar a casa.`;
    }
    return `${m.body === 'mars' ? 'Marte' : 'Júpiter'} está a ${env.sunDistanceAU.toFixed(2)} UA del Sol (luz solar: ${sun} % de la de la Tierra) y a ${env.earthDistanceAU.toFixed(2)} UA de nosotros: cada mensaje tarda ${delayTxt} en llegar.`;
  }
}
