type SoundName =
  | "shoot" | "hit" | "death" | "hurt" | "dash" | "pickup" | "levelup"
  | "door" | "bossWarn" | "bossDeath" | "victory" | "gameover" | "break" | "ui"
  | "swap" | "unlock";

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;

let sfxVolume = 0.6;
let musicVolume = 0.3;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.gain.value = muted ? 0 : sfxVolume;
    musicBus.gain.value = muted ? 0 : musicVolume;
    sfxBus.connect(ctx.destination);
    musicBus.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function applyGains() {
  const c = getCtx();
  if (!c || !sfxBus || !musicBus) return;
  sfxBus.gain.setTargetAtTime(muted ? 0 : sfxVolume, c.currentTime, 0.02);
  musicBus.gain.setTargetAtTime(muted ? 0 : musicVolume, c.currentTime, 0.05);
}

export function setSfxVolume(v: number) { sfxVolume = v; applyGains(); }
export function setMusicVolume(v: number) { musicVolume = v; applyGains(); }
export function setMuted(v: boolean) { muted = v; applyGains(); }
export function isMuted() { return muted; }

function audible() { return !muted && sfxVolume > 0; }

function blip(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  const c = getCtx();
  if (!c || !sfxBus || !audible()) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
  gain.gain.setValueAtTime(vol, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  osc.connect(gain).connect(sfxBus);
  osc.start();
  osc.stop(c.currentTime + dur + 0.02);
}

function noise(dur: number, vol: number) {
  const c = getCtx();
  if (!c || !sfxBus || !audible()) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  const gain = c.createGain();
  gain.gain.value = vol;
  src.buffer = buf;
  src.connect(gain).connect(sfxBus);
  src.start();
}

export function playSound(name: SoundName) {
  switch (name) {
    case "shoot": blip(720, 0.07, "square", 0.1, 240); break;
    case "hit": blip(320, 0.05, "square", 0.07, 180); break;
    case "death": noise(0.18, 0.16); blip(180, 0.14, "sawtooth", 0.08, 60); break;
    case "hurt": blip(150, 0.18, "sawtooth", 0.16, 70); break;
    case "dash": blip(420, 0.14, "triangle", 0.09, 900); break;
    case "pickup": blip(880, 0.06, "triangle", 0.09, 1250); break;
    case "levelup": [660, 880, 1180].forEach((f, i) => setTimeout(() => blip(f, 0.14, "square", 0.11), i * 90)); break;
    case "door": noise(0.3, 0.1); blip(90, 0.3, "sawtooth", 0.08, 160); break;
    case "bossWarn": blip(110, 0.6, "sawtooth", 0.14, 90); break;
    case "bossDeath": noise(0.7, 0.22); [300, 200, 120].forEach((f, i) => setTimeout(() => blip(f, 0.3, "sawtooth", 0.12, 50), i * 140)); break;
    case "victory": [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, "square", 0.11), i * 130)); break;
    case "gameover": [400, 300, 220, 140].forEach((f, i) => setTimeout(() => blip(f, 0.3, "sawtooth", 0.12), i * 180)); break;
    case "break": noise(0.12, 0.12); break;
    case "ui": blip(560, 0.05, "square", 0.07); break;
    case "swap": blip(300, 0.07, "square", 0.08, 620); break;
    case "unlock": [520, 780, 1040].forEach((f, i) => setTimeout(() => blip(f, 0.16, "triangle", 0.1), i * 80)); break;
  }
}

/* ---------------- procedural dungeon music ---------------- */

const BASS: number[] = [55, 55, 62, 55, 49, 49, 58, 62];
const LEAD: number[] = [220, 262, 294, 262, 196, 220, 247, 294];
let musicTimer: number | null = null;
let step = 0;

function musicNote(freq: number, dur: number, type: OscillatorType, vol: number) {
  const c = getCtx();
  if (!c || !musicBus) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  osc.connect(gain).connect(musicBus);
  osc.start();
  osc.stop(c.currentTime + dur + 0.05);
}

export function startMusic() {
  if (typeof window === "undefined" || musicTimer !== null) return;
  getCtx();
  applyGains();
  musicTimer = window.setInterval(() => {
    if (muted || musicVolume <= 0) { step++; return; }
    const i = step % 8;
    musicNote(BASS[i]!, 0.42, "triangle", 0.28);
    if (i % 2 === 0) musicNote(LEAD[i]!, 0.3, "square", 0.09);
    if (i === 3 || i === 7) musicNote(LEAD[(i + 2) % 8]! * 2, 0.16, "square", 0.05);
    step++;
  }, 300);
}

export function stopMusic() {
  if (musicTimer !== null) { window.clearInterval(musicTimer); musicTimer = null; }
}

/** Push a Settings object into the audio buses in one call. */
export function applyAudioSettings(s: { sfx: number; music: number; muted: boolean }) {
  setSfxVolume(s.sfx);
  setMusicVolume(s.music);
  setMuted(s.muted);
}
