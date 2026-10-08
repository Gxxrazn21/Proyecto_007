/**
 * Efectos de sonido sintetizados con Web Audio (sin archivos de audio).
 * Estilo chiptune: ondas cuadradas y triangulares cortas + ruido.
 *
 * Uso: import { sfx } from '../systems/sfx'; sfx.play('click');
 * El sonido sólo puede empezar tras un toque/clic del jugador (regla de los
 * navegadores), por eso el contexto se crea en el primer evento de entrada.
 */
type SoundName =
  | 'click' | 'place' | 'remove' | 'error' | 'alert' | 'good' | 'bad'
  | 'ignition' | 'boom' | 'success' | 'fail' | 'badge' | 'tick';

const STORAGE_KEY = 'mision-orbita:sonido';

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = readMuted();

  /** Crea el contexto de audio (llamar desde un gesto del jugador). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.ctx.destination);
  }

  toggle(): boolean {
    this.muted = !this.muted;
    try { localStorage.setItem(STORAGE_KEY, this.muted ? '0' : '1'); } catch { /* sin almacenamiento */ }
    return this.muted;
  }

  play(name: SoundName): void {
    if (this.muted || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'click': this.tone(660, t, 0.04, 'square', 0.5); break;
      case 'tick': this.tone(1200, t, 0.02, 'square', 0.25); break;
      case 'place': this.tone(523, t, 0.06, 'square'); this.tone(784, t + 0.05, 0.08, 'square'); break;
      case 'remove': this.tone(392, t, 0.06, 'triangle'); this.tone(262, t + 0.05, 0.08, 'triangle'); break;
      case 'error': this.tone(180, t, 0.12, 'square', 0.6); this.tone(150, t + 0.1, 0.14, 'square', 0.6); break;
      case 'alert': [0, 0.16, 0.32].forEach((d) => this.tone(880, t + d, 0.08, 'square', 0.5)); break;
      case 'good': this.tone(659, t, 0.08, 'triangle'); this.tone(988, t + 0.08, 0.14, 'triangle'); break;
      case 'bad': this.tone(330, t, 0.1, 'sawtooth', 0.4); this.tone(220, t + 0.09, 0.2, 'sawtooth', 0.4); break;
      case 'ignition': this.noise(t, 2.2, 400, 0.9); this.tone(55, t, 2.2, 'sawtooth', 0.35); break;
      case 'boom': this.noise(t, 1.2, 900, 1.2); this.tone(70, t, 0.8, 'square', 0.6); break;
      case 'success': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.11, 0.16, 'square', 0.6)); break;
      case 'fail': [392, 330, 262, 196].forEach((f, i) => this.tone(f, t + i * 0.14, 0.2, 'triangle', 0.7)); break;
      case 'badge': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, t + i * 0.07, 0.12, 'triangle', 0.7)); break;
    }
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType, vol = 0.8): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(g).connect(this.master!);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  /** Ruido filtrado (motores, explosiones). */
  private noise(start: number, dur: number, cutoff: number, vol: number): void {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(start);
  }
}

function readMuted(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '0'; } catch { return false; }
}

export const sfx = new Sfx();

// Desbloquea el audio con el primer gesto del jugador.
for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
  window.addEventListener(ev, () => sfx.unlock(), { capture: true });
}
