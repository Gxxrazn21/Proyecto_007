/**
 * Estado global de una partida. Un único objeto compartido por todas las
 * escenas (más simple que pasar datos entre escenas para un equipo nuevo).
 *
 * Flujo: Menu → Briefing (mission) → Workshop (design) → Launch (rocket)
 *        → Operations (ops, report) → Results
 */
import type { Apod, Design, EnvData, EventDef, Mission, ModuleDef, ReportEntry, Rocket } from '../types';
import type { Feeds, OpsState } from '../systems/events';
import { newOpsState } from '../systems/events';

export interface Database {
  missions: Mission[];
  modules: ModuleDef[];
  rockets: Rocket[];
  events: EventDef[];
  catalog: Map<string, ModuleDef>;
}

class GameStateStore {
  db!: Database;
  /** Datos de la NASA (o respaldo). Se cargan en segundo plano al arrancar. */
  feeds: Promise<Feeds> | null = null;
  apod: Promise<Apod> | null = null;
  envCache = new Map<string, Promise<EnvData>>();

  mission: Mission | null = null;
  env: EnvData | null = null;
  design: Design = {};
  rocket: Rocket | null = null;
  ops: OpsState = newOpsState();
  report: ReportEntry[] = [];
  /** Resultado final calculado en Operations. */
  outcome: 'success' | 'partial' | 'lost' | 'launch-fail' | null = null;
  finalScience = 0;

  /** Empieza una misión nueva (conserva el diseño si es la misma misión). */
  startMission(m: Mission): void {
    if (this.mission?.id !== m.id) this.design = {};
    this.mission = m;
    this.resetFlight();
  }

  /** Limpia lo que pasa después del Taller (para reintentar). */
  resetFlight(): void {
    this.rocket = null;
    this.ops = newOpsState();
    this.report = [];
    this.outcome = null;
    this.finalScience = 0;
  }
}

export const GameState = new GameStateStore();
