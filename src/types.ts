/**
 * Tipos compartidos del juego.
 *
 * Los datos de balance viven en /public/data/*.json y deben cumplir estas
 * interfaces. Si agregas un campo a un JSON, agrégalo aquí primero.
 */

/** Destino de lanzamiento: define qué capacidad del cohete se usa. */
export type Destination = 'leo' | 'tli' | 'mars' | 'jupiter';

/** Cuerpo celeste del que pedimos distancias a JPL Horizons. */
export type Body = 'earth' | 'moon' | 'mars' | 'jupiter';

export type ModuleCategory =
  | 'bus'
  | 'power'
  | 'storage'
  | 'comms'
  | 'propulsion'
  | 'tank'
  | 'instrument';

export type InstrumentKind = 'camera' | 'spectrometer' | 'magnetometer';

export interface Mission {
  id: string;
  name: string;
  objective: string;
  /** Texto corto que se muestra en el briefing. */
  briefing: string;
  /** Misión real en la que se inspira (para el apartado educativo). */
  inspiredBy: string;
  body: Body;
  destination: Destination;
  /** Presupuesto total en millones de dólares (nave + cohete). */
  budget: number;
  /** Δv que la nave debe aportar después del lanzamiento (m/s). */
  deltaVRequired: number;
  /** Minutos de eclipse por órbita: hay que sobrevivirlos con batería. */
  eclipseMinutes: number;
  /** Puntos de ciencia mínimos para considerar la misión un éxito. */
  minScience: number;
  /** Multiplicador de ciencia por tipo de instrumento en este destino. */
  affinity: Record<InstrumentKind, number>;
  /** Cuántos eventos aparecen en la fase de operación científica. */
  scienceEvents: number;
  difficulty: 1 | 2 | 3;
  /** Etiquetas de eventos permitidos (ver events.json). */
  eventTags: string[];
}

export interface ModuleDef {
  id: string;
  name: string;
  category: ModuleCategory;
  description: string;
  /** Masa seca en kg. */
  mass: number;
  /** Costo en millones de dólares. */
  cost: number;
  /** Consumo eléctrico continuo en W (positivo = consume). */
  powerDraw: number;
  /** Generación solar a 1 UA en W (se divide entre r² al alejarse del Sol). */
  solarW1AU?: number;
  /** Generación constante en W (RTG: no depende del Sol). */
  rtgW?: number;
  /** Capacidad de batería en Wh. */
  batteryWh?: number;
  /** Tasa de bajada a 1 UA en kbps (se divide entre d² a la Tierra). */
  downlinkKbps1AU?: number;
  /** Tasa máxima que permite el hardware (para destinos cercanos). */
  downlinkKbpsMax?: number;
  /** Impulso específico del motor en segundos. */
  isp?: number;
  /** Masa de propelente que carga un tanque (kg). */
  propellant?: number;
  /** Datos que genera un instrumento en kbps. */
  dataKbps?: number;
  /** Puntos de ciencia base de un instrumento. */
  science?: number;
  instrument?: InstrumentKind;
  /** Referencia pública del dato (para el jurado y para estudiantes). */
  source: string;
}

export interface Rocket {
  id: string;
  name: string;
  operator: string;
  /** Costo por lanzamiento en millones de dólares. */
  cost: number;
  /** Carga útil máxima (kg) por destino. 0 = no puede llegar. */
  payload: Record<Destination, number>;
  /** Días de crucero hasta el destino (depende de la energía del cohete). */
  cruiseDays: Record<Destination, number>;
  description: string;
  source: string;
}

/** Ranura del taller: qué categorías acepta y dónde se dibuja. */
export interface SlotDef {
  id: string;
  accepts: ModuleCategory[];
  /** Posición relativa al centro del bus, en píxeles de la resolución base. */
  x: number;
  y: number;
  label: string;
}

/** Diseño de la nave: ranura → id de módulo. */
export type Design = Record<string, string | undefined>;

/** Datos del entorno: vienen de la NASA (en vivo) o del respaldo offline. */
export interface EnvData {
  /** Distancia del destino al Sol (UA). */
  sunDistanceAU: number;
  /** Distancia del destino a la Tierra (UA). */
  earthDistanceAU: number;
  /** Fecha de las efemérides (ISO). */
  date: string;
  source: 'horizons' | 'offline';
}

export interface SolarEvent {
  kind: 'flare' | 'cme' | 'storm';
  /** Clase de la llamarada (X9.0), velocidad de la CME o índice Kp. */
  label: string;
  /** Intensidad normalizada 0..1 para los efectos de juego. */
  severity: number;
  date: string;
  detail: string;
  source: 'donki' | 'offline';
}

export interface Asteroid {
  name: string;
  diameterM: number;
  missLunar: number;
  date: string;
  hazardous: boolean;
  source: 'neows' | 'offline';
}

export interface Apod {
  title: string;
  url: string;
  mediaType: string;
  date: string;
  copyright?: string;
  source: 'apod' | 'offline';
}

/* ------------------------------------------------------------------ */
/* Eventos de operación                                                 */
/* ------------------------------------------------------------------ */

/** Efecto numérico de una decisión. */
export interface Effects {
  /** Cambio en salud de la nave (puntos, 0..100). */
  health?: number;
  /** Multiplicador sobre la ciencia final (−0.1 = pierde 10 %). */
  science?: number;
  /** Δv gastado en m/s (sale del margen). */
  deltaV?: number;
  /** Cambio permanente en la generación solar (−0.1 = −10 %). */
  solarPower?: number;
}

/** Resultado condicionado: el primero cuya condición se cumple gana. */
export interface Outcome {
  /** Condición (ver systems/events.ts → evalCondition). Vacía = siempre. */
  when?: string;
  effects: Effects;
  text: string;
}

export interface Choice {
  label: string;
  outcomes: Outcome[];
}

export interface EventDef {
  id: string;
  title: string;
  /** Texto con marcadores {flare}, {date}, {asteroid}… */
  text: string;
  phase: 'cruise' | 'science';
  /** La misión debe tener alguna de estas etiquetas. */
  tags: string[];
  /** De dónde viene el dato real que lo dispara. */
  feed?: 'donki-flare' | 'donki-cme' | 'donki-storm' | 'neows';
  /** Condición para que el evento pueda aparecer. */
  requires?: string;
  weight: number;
  /** Qué se aprende: aparece en el reporte final. */
  lesson: string;
  /** Índice de la opción por defecto si se acaba el tiempo. */
  timeoutChoice: number;
  choices: Choice[];
}

/** Línea del reporte final: decisión → consecuencia. */
export interface ReportEntry {
  phase: 'design' | 'launch' | 'cruise' | 'insertion' | 'science';
  title: string;
  /** Qué decidió el jugador. */
  decision: string;
  /** Qué pasó por esa decisión. */
  consequence: string;
  /** Lección de ingeniería. */
  lesson?: string;
  impact: 'good' | 'bad' | 'neutral';
}
