// Blast Arena audio: chiptune BGM + SFX synthesized with the Web Audio API.
// Everything is generated in code — no audio assets, nothing fetched.
// Module-level singleton so the engine hook and HUD toggles share one state.

const BGM_KEY = 'blast-audio-bgm';
const SFX_KEY = 'blast-audio-sfx';

const BGM_VOLUME = 0.14;
const SFX_VOLUME = 0.45;

let bgmOn = true;
let sfxOn = true;
try {
  bgmOn = localStorage.getItem(BGM_KEY) !== '0';
  sfxOn = localStorage.getItem(SFX_KEY) !== '0';
} catch {
  // Storage unavailable (private mode) — defaults stand
}

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let bgmBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let resumeArmed = false;

// Browsers keep a context created outside a user gesture suspended; retry on the next one
function armResumeOnGesture() {
  if (resumeArmed) return;
  resumeArmed = true;
  const resume = () => {
    if (ctx && ctx.state === 'suspended') void ctx.resume();
    resumeArmed = false;
  };
  window.addEventListener('pointerdown', resume, { once: true });
  window.addEventListener('keydown', resume, { once: true });
}

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    sfxBus = ctx.createGain();
    sfxBus.gain.value = SFX_VOLUME;
    sfxBus.connect(ctx.destination);
    bgmBus = ctx.createGain();
    bgmBus.gain.value = BGM_VOLUME;
    bgmBus.connect(ctx.destination);
    const len = ctx.sampleRate;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
    armResumeOnGesture();
  }
  return ctx;
}

// ── Synthesis primitives ───────────────────────────────────────────────────────

interface ToneOpts {
  type?: OscillatorType;
  freq: number;
  freqTo?: number;
  dur: number;
  vol?: number;
  at?: number;
  bus?: GainNode;
}

function tone(c: AudioContext, o: ToneOpts): void {
  const t0 = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(Math.max(1, o.freq), t0);
  if (o.freqTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqTo), t0 + o.dur);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(o.vol ?? 0.5, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + o.dur);
  osc.connect(g).connect(o.bus ?? sfxBus ?? c.destination);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);
}

interface NoiseOpts {
  dur: number;
  vol?: number;
  at?: number;
  filterFrom?: number;
  filterTo?: number;
  filterType?: BiquadFilterType;
}

function noise(c: AudioContext, o: NoiseOpts): void {
  if (!noiseBuffer) return;
  const t0 = c.currentTime + (o.at ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = o.filterType ?? 'lowpass';
  filter.frequency.setValueAtTime(o.filterFrom ?? 2000, t0);
  if (o.filterTo !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.filterTo), t0 + o.dur);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(o.vol ?? 0.4, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + o.dur);
  src.connect(filter).connect(g).connect(sfxBus ?? c.destination);
  src.start(t0);
  src.stop(t0 + o.dur + 0.02);
}

function midi(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

// ── SFX ────────────────────────────────────────────────────────────────────────

export type SfxName =
  | 'fire' | 'throw' | 'boot' | 'explosion' | 'bigExplosion' | 'thud' | 'splash'
  | 'jump' | 'ko' | 'pickup' | 'crateDrop' | 'cratePop' | 'turn' | 'move'
  | 'tick' | 'click' | 'win' | 'lose';

const SFX: Record<SfxName, (c: AudioContext) => void> = {
  fire: c => {
    noise(c, { dur: 0.25, vol: 0.35, filterFrom: 900, filterTo: 4500, filterType: 'bandpass' });
    tone(c, { type: 'sawtooth', freq: 220, freqTo: 880, dur: 0.2, vol: 0.18 });
  },
  throw: c => {
    tone(c, { freq: 300, freqTo: 140, dur: 0.12, vol: 0.25 });
  },
  boot: c => {
    tone(c, { freq: 150, freqTo: 620, dur: 0.18, vol: 0.3 });
    tone(c, { freq: 620, freqTo: 300, dur: 0.12, vol: 0.2, at: 0.18 });
  },
  explosion: c => {
    noise(c, { dur: 0.5, vol: 0.6, filterFrom: 3000, filterTo: 120 });
    tone(c, { type: 'sine', freq: 120, freqTo: 35, dur: 0.45, vol: 0.7 });
  },
  bigExplosion: c => {
    noise(c, { dur: 1.4, vol: 0.85, filterFrom: 5000, filterTo: 40 });
    tone(c, { type: 'sine', freq: 90, freqTo: 20, dur: 1.5, vol: 1.0 });
    tone(c, { type: 'square', freq: 55, freqTo: 25, dur: 1.0, vol: 0.3, at: 0.05 });
    // Aftershock rumble
    noise(c, { dur: 0.6, vol: 0.35, filterFrom: 500, filterTo: 50, at: 0.5 });
    tone(c, { type: 'sine', freq: 60, freqTo: 22, dur: 0.7, vol: 0.5, at: 0.45 });
  },
  thud: c => {
    tone(c, { type: 'sine', freq: 160, freqTo: 50, dur: 0.15, vol: 0.5 });
    noise(c, { dur: 0.08, vol: 0.2, filterFrom: 600, filterTo: 200 });
  },
  splash: c => {
    noise(c, { dur: 0.45, vol: 0.5, filterFrom: 1400, filterTo: 300, filterType: 'bandpass' });
    tone(c, { type: 'sine', freq: 300, freqTo: 80, dur: 0.3, vol: 0.2 });
  },
  jump: c => {
    tone(c, { freq: 300, freqTo: 700, dur: 0.12, vol: 0.15 });
  },
  ko: c => {
    tone(c, { freq: midi(69), freqTo: midi(57), dur: 0.4, vol: 0.25 });
    tone(c, { freq: midi(64), freqTo: midi(52), dur: 0.4, vol: 0.2, at: 0.08 });
  },
  pickup: c => {
    [76, 81, 85].forEach((n, i) =>
      tone(c, { freq: midi(n), dur: 0.1, vol: 0.25, at: i * 0.07 }),
    );
  },
  crateDrop: c => {
    tone(c, { type: 'triangle', freq: 1200, freqTo: 400, dur: 1.1, vol: 0.12 });
  },
  cratePop: c => {
    noise(c, { dur: 0.12, vol: 0.4, filterFrom: 2500, filterTo: 600 });
    tone(c, { freq: 200, freqTo: 90, dur: 0.1, vol: 0.25 });
  },
  turn: c => {
    tone(c, { freq: midi(76), dur: 0.09, vol: 0.2 });
    tone(c, { freq: midi(83), dur: 0.14, vol: 0.2, at: 0.09 });
  },
  move: c => {
    [72, 76, 79].forEach((n, i) =>
      tone(c, { freq: midi(n), dur: 0.08, vol: 0.2, at: i * 0.06 }),
    );
  },
  tick: c => {
    tone(c, { freq: midi(88), dur: 0.07, vol: 0.18 });
  },
  click: c => {
    tone(c, { freq: midi(84), dur: 0.04, vol: 0.1 });
  },
  win: c => {
    [72, 76, 79, 84].forEach((n, i) =>
      tone(c, { freq: midi(n), dur: i === 3 ? 0.4 : 0.13, vol: 0.25, at: i * 0.13 }),
    );
  },
  lose: c => {
    [64, 62, 60, 55].forEach((n, i) =>
      tone(c, { freq: midi(n), dur: i === 3 ? 0.5 : 0.16, vol: 0.22, at: i * 0.16 }),
    );
  },
};

export function playSfx(name: SfxName): void {
  if (!sfxOn) return;
  const c = ensureCtx();
  if (!c) return;
  SFX[name](c);
}

// ── BGM: 4-bar chiptune battle loop, scheduled with a 200ms lookahead ─────────

const BPM = 108;
const STEP = 60 / BPM / 4;
const LOOP_STEPS = 64;

// Bass on 8ths — i · VI · VII · v in A minor
const BASS: (number | null)[] = [
  45, null, 45, null, 52, null, 45, null, 45, null, 45, null, 52, null, 43, null,
  41, null, 41, null, 48, null, 41, null, 41, null, 41, null, 48, null, 45, null,
  43, null, 43, null, 50, null, 43, null, 43, null, 43, null, 50, null, 48, null,
  40, null, 40, null, 47, null, 40, null, 40, null, 47, null, 52, null, 47, null,
];

// Sparse lead melody on 16ths
const LEAD: (number | null)[] = [
  69, null, null, 72, null, null, 76, null, null, null, 72, null, 76, null, 79, null,
  77, null, null, 76, null, null, 72, null, 69, null, null, null, null, null, null, null,
  67, null, null, 71, null, null, 74, null, null, null, 71, null, 74, null, 79, null,
  76, null, null, 74, null, null, 71, null, 69, null, null, null, 64, null, 67, null,
];

let bgmWanted = false;
let bgmTimer: number | null = null;
let nextStepTime = 0;
let stepIdx = 0;

function scheduleStep(step: number, t: number, c: AudioContext): void {
  const bus = bgmBus;
  if (!bus) return;
  const at = t - c.currentTime;
  const bass = BASS[step];
  if (bass !== null) {
    tone(c, { type: 'triangle', freq: midi(bass), dur: STEP * 1.8, vol: 0.5, at, bus });
  }
  const lead = LEAD[step];
  if (lead !== null) {
    tone(c, { type: 'square', freq: midi(lead), dur: STEP * 1.2, vol: 0.16, at, bus });
  }
  // Kick on beats 1 and 3, hat on off-8ths
  if (step % 16 === 0 || step % 16 === 8) {
    tone(c, { type: 'sine', freq: 130, freqTo: 45, dur: 0.1, vol: 0.5, at, bus });
  }
  if (step % 4 === 2) {
    tone(c, { type: 'square', freq: 8000, dur: 0.03, vol: 0.03, at, bus });
  }
}

function beginBgmScheduler(): void {
  const c = ensureCtx();
  if (!c || bgmTimer !== null) return;
  nextStepTime = c.currentTime + 0.1;
  stepIdx = 0;
  bgmTimer = window.setInterval(() => {
    if (!ctx) return;
    while (nextStepTime < ctx.currentTime + 0.2) {
      scheduleStep(stepIdx % LOOP_STEPS, nextStepTime, ctx);
      stepIdx++;
      nextStepTime += STEP;
    }
  }, 100);
}

function haltBgmScheduler(): void {
  if (bgmTimer !== null) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

// Engine calls start/stop around a match; the toggle honors "wanted" on re-enable
export function startBgm(): void {
  bgmWanted = true;
  if (bgmOn) beginBgmScheduler();
}

export function stopBgm(): void {
  bgmWanted = false;
  haltBgmScheduler();
}

// ── Toggles (persisted) ────────────────────────────────────────────────────────

export function isBgmOn(): boolean {
  return bgmOn;
}

export function isSfxOn(): boolean {
  return sfxOn;
}

export function setBgmOn(on: boolean): void {
  bgmOn = on;
  try {
    localStorage.setItem(BGM_KEY, on ? '1' : '0');
  } catch {
    // Persist is best-effort
  }
  if (!on) haltBgmScheduler();
  else if (bgmWanted) beginBgmScheduler();
}

export function setSfxOn(on: boolean): void {
  sfxOn = on;
  try {
    localStorage.setItem(SFX_KEY, on ? '1' : '0');
  } catch {
    // Persist is best-effort
  }
}
