import {
  SONGS,
  effectiveVolume,
  parseAudioSettings,
  stepDuration,
  stepEvents,
  STEPS_PER_BAR,
  type AudioSettings,
  type EngineVoice,
  type HornSound,
  type NoteEvent,
  type SongId,
} from "@apex/shared";

/**
 * Procedural sound: every effect is synthesised with WebAudio (oscillators + filtered noise),
 * so there are no downloads and no licence questions. The context starts on the first
 * key press or click (browsers block audio before that); until then every call is a no-op.
 */
export type SoundName =
  | "click"
  | "beep"
  | "go"
  | "boost1"
  | "boost2"
  | "boost3"
  | "lap"
  | "finalLap"
  | "finish"
  | "pickup"
  | "use"
  | "hit"
  | "blocked"
  | "emp"
  | "mine"
  | "drone"
  | "shield"
  | "turbo"
  | "perfectStart";

const STORE_KEY = "apexrush.audio";

class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private music: Music | null = null;
  private wantedSong: SongId | null = null;
  settings: AudioSettings;
  private readonly listeners = new Set<(s: AudioSettings) => void>();

  constructor() {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORE_KEY);
    } catch {
      // no storage – defaults
    }
    this.settings = parseAudioSettings(stored);
  }

  /** Call from a user gesture. Safe to call often. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = effectiveVolume(this.settings);
      this.master.connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        d[i] = (seed / 0x7fffffff) * 2 - 1;
      }
      this.music = new Music(ctx, this.master, this.noise, this.settings.music);
      this.music.play(this.wantedSong);
    } catch {
      this.ctx = null;
    }
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  setSettings(patch: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...patch };
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.settings));
    } catch {
      // ignore
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(effectiveVolume(this.settings), this.ctx.currentTime, 0.05);
    this.music?.setLevel(this.settings.music);
    for (const l of this.listeners) l(this.settings);
  }

  /** Switch the music (at the next bar); null fades it out. Remembered until audio is unlocked. */
  song(id: SongId | null): void {
    this.wantedSong = id;
    this.music?.play(id);
  }

  get currentSong(): SongId | null {
    return this.music?.current ?? null;
  }

  toggleMute(): void {
    this.setSettings({ muted: !this.settings.muted });
  }

  onChange(fn: (s: AudioSettings) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ---------- building blocks ----------

  private tone(f0: number, f1: number, dur: number, wave: OscillatorType, gain: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(dur: number, type: BiquadFilterType, f0: number, f1: number, gain: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  /** One-shot effect; `gain` scales it (e.g. by distance). */
  play(name: SoundName, gain = 1): void {
    if (!this.ready || gain < 0.01) return;
    const k = gain;
    switch (name) {
      case "click":
        this.tone(1400, 900, 0.05, "square", 0.08 * k);
        break;
      case "beep":
        this.tone(660, 660, 0.25, "square", 0.18 * k);
        break;
      case "go":
        this.tone(1320, 1320, 0.55, "square", 0.2 * k);
        this.tone(660, 660, 0.55, "sawtooth", 0.08 * k);
        break;
      case "perfectStart":
        this.tone(880, 1760, 0.3, "triangle", 0.25 * k);
        break;
      case "boost1":
      case "boost2":
      case "boost3": {
        const level = Number(name.slice(-1));
        this.burst(0.5 + level * 0.15, "bandpass", 400, 3000 + level * 1500, 0.35 * k);
        this.tone(200 * level, 600 * level, 0.35, "sawtooth", 0.08 * k);
        break;
      }
      case "lap":
        this.tone(880, 880, 0.12, "triangle", 0.2 * k);
        this.tone(1175, 1175, 0.2, "triangle", 0.2 * k, 0.12);
        break;
      case "finalLap":
        [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, f, 0.16, "square", 0.13 * k, i * 0.12));
        break;
      case "finish":
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.5 - i * 0.05, "triangle", 0.2 * k, i * 0.1));
        break;
      case "pickup":
        this.tone(600, 1800, 0.18, "triangle", 0.2 * k);
        break;
      case "use":
        this.tone(900, 400, 0.15, "square", 0.12 * k);
        break;
      case "hit":
        this.burst(0.5, "lowpass", 1800, 120, 0.5 * k);
        this.tone(220, 55, 0.45, "sawtooth", 0.2 * k);
        break;
      case "blocked":
        this.tone(1568, 1568, 0.35, "sine", 0.18 * k);
        this.tone(2093, 2093, 0.3, "sine", 0.12 * k, 0.05);
        break;
      case "emp":
        this.tone(1600, 60, 0.7, "sawtooth", 0.18 * k);
        this.burst(0.7, "bandpass", 3000, 200, 0.25 * k);
        break;
      case "mine":
        this.tone(300, 300, 0.06, "square", 0.15 * k);
        this.burst(0.25, "lowpass", 600, 100, 0.25 * k, 0.06);
        break;
      case "drone":
        this.tone(180, 260, 0.6, "sawtooth", 0.1 * k);
        this.tone(186, 266, 0.6, "sawtooth", 0.1 * k);
        break;
      case "shield":
        [1046, 1318, 1568].forEach((f, i) => this.tone(f, f * 1.01, 0.5, "sine", 0.12 * k, i * 0.05));
        break;
      case "turbo":
        this.burst(0.9, "bandpass", 300, 5000, 0.4 * k);
        break;
    }
  }

  horn(h: HornSound, volume: number): void {
    if (!this.ready || volume < 0.01) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.setValueAtTime(volume, t + h.length - 0.06);
    gain.gain.linearRampToValueAtTime(0, t + h.length);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2400;
    filter.connect(gain).connect(this.master!);
    for (const f of h.freqs) {
      const osc = ctx.createOscillator();
      osc.type = h.wave;
      osc.frequency.value = f;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + h.length + 0.02);
    }
  }

  /** A looping engine voice with tyre squeal and nitro hiss; null until audio is unlocked. */
  engine(): EngineSound | null {
    if (!this.ctx || !this.master || !this.noise) return null;
    return new EngineSound(this.ctx, this.master, this.noise);
  }
}

export class EngineSound {
  private readonly saw: OscillatorNode;
  private readonly sub: OscillatorNode;
  private readonly filter: BiquadFilterNode;
  private readonly engineGain: GainNode;
  private readonly squealGain: GainNode;
  private readonly nitroGain: GainNode;
  private readonly out: GainNode;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private stopped = false;

  constructor(
    private readonly ctx: AudioContext,
    master: GainNode,
    noise: AudioBuffer,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(master);
    // engine: sawtooth + square one octave down, through a lowpass
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.Q.value = 3;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.filter.connect(this.engineGain).connect(this.out);
    this.saw = ctx.createOscillator();
    this.saw.type = "sawtooth";
    this.sub = ctx.createOscillator();
    this.sub.type = "square";
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;
    this.saw.connect(this.filter);
    this.sub.connect(subGain).connect(this.filter);
    // tyre squeal: band-passed noise around 2.4 kHz
    const squeal = ctx.createBufferSource();
    squeal.buffer = noise;
    squeal.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    bp.Q.value = 6;
    this.squealGain = ctx.createGain();
    this.squealGain.gain.value = 0;
    squeal.connect(bp).connect(this.squealGain).connect(this.out);
    // nitro: high-passed hiss
    const hiss = ctx.createBufferSource();
    hiss.buffer = noise;
    hiss.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1800;
    this.nitroGain = ctx.createGain();
    this.nitroGain.gain.value = 0;
    hiss.connect(hp).connect(this.nitroGain).connect(this.out);
    this.sources.push(this.saw, this.sub, squeal, hiss);
    for (const s of this.sources) s.start();
    this.out.gain.setTargetAtTime(1, ctx.currentTime, 0.2);
  }

  /** `volume` lets the whole engine fade (e.g. on the podium). */
  update(v: EngineVoice, squeal: number, nitro: boolean, volume = 1): void {
    if (this.stopped) return;
    const t = this.ctx.currentTime;
    this.saw.frequency.setTargetAtTime(v.freq, t, 0.04);
    this.sub.frequency.setTargetAtTime(v.freq / 2, t, 0.04);
    this.filter.frequency.setTargetAtTime(v.cutoff, t, 0.05);
    this.engineGain.gain.setTargetAtTime(v.gain * 0.35, t, 0.05);
    this.squealGain.gain.setTargetAtTime(squeal * 0.22, t, 0.06);
    this.nitroGain.gain.setTargetAtTime(nitro ? 0.12 : 0, t, 0.08);
    this.out.gain.setTargetAtTime(volume, t, 0.25);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.08);
    for (const s of this.sources) s.stop(t + 0.4);
    window.setTimeout(() => this.out.disconnect(), 600);
  }
}

/** Step sequencer with lookahead scheduling on the audio clock. */
class Music {
  private readonly bus: GainNode;
  private readonly echo: DelayNode;
  current: SongId | null = null;
  private next: SongId | null = null;
  private step = 0;
  private nextTime = 0;
  private timer = 0;

  constructor(
    private readonly ctx: AudioContext,
    master: GainNode,
    private readonly noise: AudioBuffer,
    level: number,
  ) {
    this.bus = ctx.createGain();
    this.bus.gain.value = level * 0.55;
    this.bus.connect(master);
    // echo for arp and lead – the synthwave sheen
    this.echo = ctx.createDelay(1);
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.echo.connect(feedback).connect(this.echo);
    this.echo.connect(wet).connect(this.bus);
  }

  setLevel(level: number): void {
    this.bus.gain.setTargetAtTime(level * 0.55, this.ctx.currentTime, 0.1);
  }

  play(id: SongId | null): void {
    if (id === this.current && this.next === null) return;
    if (id === null) {
      this.current = null;
      this.next = null;
      window.clearInterval(this.timer);
      this.timer = 0;
      return;
    }
    if (!this.current) {
      this.current = id;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 25);
    } else this.next = id;
  }

  private schedule(): void {
    if (!this.current) return;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      if (this.next && this.step % STEPS_PER_BAR === 0) {
        this.current = this.next;
        this.next = null;
      }
      const song = SONGS[this.current];
      const dur = stepDuration(song.bpm);
      this.echo.delayTime.setValueAtTime(dur * 3, this.nextTime);
      for (const e of stepEvents(song, this.step)) this.voice(e, this.nextTime, dur);
      this.nextTime += dur;
      this.step++;
    }
  }

  private env(t: number, attack: number, hold: number, release: number, peak: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    return g;
  }

  private osc(type: OscillatorType, freq: number, t: number, end: number, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    o.start(t);
    o.stop(end + 0.05);
    return o;
  }

  private filter(type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  private voice(e: NoteEvent, t: number, step: number): void {
    const v = e.velocity;
    const len = e.steps * step;
    switch (e.voice) {
      case "bass": {
        const g = this.env(t, 0.005, len * 0.5, len * 0.4, 0.32 * v);
        const f = this.filter("lowpass", 520, 4);
        f.frequency.setValueAtTime(900, t);
        f.frequency.exponentialRampToValueAtTime(260, t + len);
        this.osc("sawtooth", e.freq, t, t + len).connect(f);
        f.connect(g).connect(this.bus);
        break;
      }
      case "arp": {
        const g = this.env(t, 0.003, 0.02, len * 0.9, 0.09 * v);
        const f = this.filter("lowpass", 2600, 2);
        this.osc("square", e.freq, t, t + len).connect(f);
        f.connect(g);
        g.connect(this.bus);
        g.connect(this.echo);
        break;
      }
      case "lead": {
        const g = this.env(t, 0.02, len * 0.6, len * 0.4, 0.1 * v);
        const f = this.filter("lowpass", 3200, 1);
        const o = this.osc("sawtooth", e.freq, t, t + len);
        const vib = this.osc("sine", 5.5, t, t + len);
        const depth = this.ctx.createGain();
        depth.gain.value = e.freq * 0.01;
        vib.connect(depth).connect(o.frequency);
        o.connect(f);
        f.connect(g);
        g.connect(this.bus);
        g.connect(this.echo);
        break;
      }
      case "pad": {
        const g = this.env(t, len * 0.3, len * 0.4, len * 0.3, 0.045 * v);
        const f = this.filter("lowpass", 1100, 0.7);
        this.osc("sawtooth", e.freq, t, t + len, -9).connect(f);
        this.osc("sawtooth", e.freq, t, t + len, 9).connect(f);
        f.connect(g).connect(this.bus);
        break;
      }
      case "kick": {
        const g = this.env(t, 0.002, 0.02, 0.25, 0.9 * v);
        const o = this.osc("sine", 150, t, t + 0.3);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
        o.connect(g).connect(this.bus);
        break;
      }
      case "snare": {
        const g = this.env(t, 0.002, 0.01, 0.16, 0.35 * v);
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        src.connect(this.filter("bandpass", 1900, 0.8)).connect(g).connect(this.bus);
        src.start(t, (t * 7.31) % 1.5);
        src.stop(t + 0.2);
        const body = this.env(t, 0.002, 0.01, 0.08, 0.2 * v);
        this.osc("triangle", 190, t, t + 0.1).connect(body).connect(this.bus);
        break;
      }
      case "hat": {
        const g = this.env(t, 0.001, 0.005, 0.035, 0.12 * v);
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        src.connect(this.filter("highpass", 7500)).connect(g).connect(this.bus);
        src.start(t, (t * 3.17) % 1.5);
        src.stop(t + 0.06);
        break;
      }
    }
  }
}

export const sound = new Sound();

/** Unlock audio on the first interaction, click sounds for buttons, M = mute. */
export function initSound(): void {
  const unlock = (): void => sound.unlock();
  window.addEventListener("pointerdown", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });
  document.addEventListener("click", (e) => {
    if ((e.target as HTMLElement | null)?.closest?.("button")) sound.play("click");
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyM" && !(e.target instanceof HTMLInputElement)) sound.toggleMute();
  });
}
