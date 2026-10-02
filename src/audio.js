import { audioState, musicState } from './state.js';

let audioCtx = null;
let resumeContext = null;
let resumePromise = null;
let lastResumeAttempt = 0;
let masterBus = null;
let masterContext = null;
let noiseBuffer = null;

function audioIsEnabled() {
  return audioState.enabled || musicState.enabled;
}

function discardAudioContext(context = audioCtx) {
  if (!context) return;
  if (audioCtx === context) audioCtx = null;
  if (resumeContext === context) {
    resumeContext = null;
    resumePromise = null;
  }
  try { context.close().catch(() => {}); } catch (_) {}
}

function getOrCreateAudioContext() {
  if (!audioIsEnabled() || typeof window === 'undefined') return null;
  if (audioCtx?.state === 'interrupted') discardAudioContext(audioCtx);
  if (!audioCtx || audioCtx.state === 'closed') {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (AudioCtxClass) {
      try { audioCtx = new AudioCtxClass(); } catch (_) { audioCtx = null; }
    }
  }
  return audioCtx;
}

export function getAudioContext() {
  return getOrCreateAudioContext();
}

export function resumeAudioContext({ force = false } = {}) {
  let context = getOrCreateAudioContext();
  if (!context) return Promise.resolve(false);
  if (context.state === 'running') return Promise.resolve(true);
  if (resumeContext === context && resumePromise) {
    if (!force || Date.now() - lastResumeAttempt < 1200) return resumePromise;
    discardAudioContext(context);
    context = getOrCreateAudioContext();
    if (!context) return Promise.resolve(false);
  }
  if (!force && Date.now() - lastResumeAttempt < 500) return Promise.resolve(false);

  lastResumeAttempt = Date.now();
  resumeContext = context;
  try {
    resumePromise = Promise.resolve(context.resume())
      .then(() => context.state === 'running')
      .catch(() => false)
      .finally(() => {
        if (resumeContext === context) {
          resumeContext = null;
          resumePromise = null;
        }
      });
  } catch (_) {
    resumeContext = null;
    resumePromise = null;
    return Promise.resolve(false);
  }
  return resumePromise;
}

function getContext() {
  if (!audioState.enabled) return null;
  const context = getOrCreateAudioContext();
  if (context && context.state !== 'running') void resumeAudioContext();
  return context;
}

export function initAudio() {
  const unlock = () => {
    if (audioIsEnabled()) void resumeAudioContext({ force: true });
  };
  const restore = () => {
    if (!document.hidden && audioIsEnabled()) void resumeAudioContext({ force: true });
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  window.addEventListener('pageshow', restore);
  document.addEventListener('visibilitychange', restore);
}

// Shared master chain (soft compressor) so stacked SFX + music never clip.
export function getMasterBus(ac) {
  if (masterContext !== ac || !masterBus) {
    masterContext = ac;
    noiseBuffer = null;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    comp.connect(ac.destination);
    masterBus = comp;
  }
  return masterBus;
}

function getNoise(ac) {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.6), ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// Oscillator voice: optional pitch slide, optional detuned twin for thickness, optional lowpass.
function tone(ac, { type = 'sine', from, to = from, at = 0, dur, vol, lp = 0, detune = 0 }) {
  const t = ac.currentTime + at;
  const out = getMasterBus(ac);
  const env = ac.createGain();
  env.gain.setValueAtTime(vol, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  let sink = env;
  if (lp) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(lp, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(120, lp * 0.15), t + dur);
    f.connect(env);
    sink = f;
  }
  env.connect(out);
  for (const d of detune ? [-detune, detune] : [0]) {
    const o = ac.createOscillator();
    o.type = type;
    o.detune.value = d;
    o.frequency.setValueAtTime(from, t);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    o.connect(sink);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

// Filtered noise burst: gives hits, blasts and zaps real texture.
function noise(ac, { at = 0, dur, vol, type = 'lowpass', from, to = from, q = 0.7 }) {
  const t = ac.currentTime + at;
  const src = ac.createBufferSource();
  src.buffer = getNoise(ac);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  if (to !== from) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const env = ac.createGain();
  env.gain.setValueAtTime(vol, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f);
  f.connect(env);
  env.connect(getMasterBus(ac));
  src.start(t, Math.random() * 0.2);
  src.stop(t + dur + 0.02);
}

function ready() {
  const ac = getContext();
  return ac && ac.state === 'running' ? ac : null;
}

// Cap overlapping voices for high-frequency sounds (nukes can kill dozens per frame).
function makeLimiter(max, window) {
  let start = 0;
  let count = 0;
  return now => {
    if (now - start > window) { start = now; count = 0; }
    return ++count <= max;
  };
}
const allowKillVoice = makeLimiter(6, 0.05);
const allowShootVoice = makeLimiter(4, 0.05);
const allowZapVoice = makeLimiter(2, 0.08);

export function playShoot(volleys = 1, isHeavy = false) {
  const ac = ready();
  if (!ac || !allowShootVoice(ac.currentTime)) return;
  const j = 1 + (Math.random() - 0.5) * 0.08;
  tone(ac, { type: isHeavy ? 'sawtooth' : 'triangle', from: (isHeavy ? 520 : 680) * j, to: isHeavy ? 80 : 120, dur: 0.08, vol: isHeavy ? 0.1 : 0.08, lp: 3500 });
  noise(ac, { dur: 0.03, vol: isHeavy ? 0.07 : 0.04, type: 'highpass', from: 3000 });
  if (volleys > 1) tone(ac, { type: 'sawtooth', from: 780 * j, to: 140, at: 0.01, dur: 0.08, vol: 0.05, lp: 3000 });
  if (isHeavy) tone(ac, { from: 95, to: 35, dur: 0.12, vol: 0.14 });
}

export function playCrit() {
  const ac = ready();
  if (!ac) return;
  [1200, 1800, 2400].forEach((freq, i) => tone(ac, { type: 'triangle', from: freq, at: i * 0.015, dur: 0.16, vol: 0.09 - i * 0.02 }));
  noise(ac, { dur: 0.05, vol: 0.05, type: 'highpass', from: 5000 });
}

export function playKill(combo = 0) {
  const ac = ready();
  if (!ac || !allowKillVoice(ac.currentTime)) return;
  const bump = Math.min(110, combo * 2.5);
  tone(ac, { type: 'square', from: 170 + bump, to: 45 + bump * 0.2, dur: 0.09, vol: 0.07, lp: 1800 });
  noise(ac, { dur: 0.08, vol: 0.09, from: 1800, to: 300 });
}

const XP_NOTES = [784, 880, 988, 1175, 1319, 1568];
let xpNoteIdx = 0;
let lastXpTime = 0;

export function playXp() {
  const ac = ready();
  if (!ac) return;
  const now = ac.currentTime;
  xpNoteIdx = now - lastXpTime < 0.4 ? (xpNoteIdx + 1) % XP_NOTES.length : 0;
  lastXpTime = now;
  const freq = XP_NOTES[xpNoteIdx];
  tone(ac, { from: freq, to: freq * 1.05, dur: 0.1, vol: 0.06 });
  tone(ac, { from: freq * 2, dur: 0.06, vol: 0.015 });
}

export function playLevelUp() {
  const ac = ready();
  if (!ac) return;
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, idx, a) => {
    const last = idx === a.length - 1;
    tone(ac, { type: last ? 'triangle' : 'sine', from: freq, at: idx * 0.07, dur: last ? 0.5 : 0.3, vol: 0.1, detune: 4 });
  });
}

export function playUpgradeSelect() {
  const ac = ready();
  if (!ac) return;
  tone(ac, { type: 'triangle', from: 440, to: 920, dur: 0.14, vol: 0.1 });
  tone(ac, { from: 1320, at: 0.12, dur: 0.18, vol: 0.06 });
}

export function playPlayerHit() {
  const ac = ready();
  if (!ac) return;
  tone(ac, { type: 'sawtooth', from: 120, to: 30, dur: 0.18, vol: 0.14, lp: 900 });
  noise(ac, { dur: 0.12, vol: 0.12, from: 1200, to: 200 });
}

export function playGameOver() {
  const ac = ready();
  if (!ac) return;
  [330, 293.66, 246.94, 196, 164.81].forEach((freq, idx) => {
    tone(ac, { type: 'sawtooth', from: freq, to: freq * 0.97, at: idx * 0.16, dur: idx === 4 ? 0.9 : 0.4, vol: 0.09, lp: 1400, detune: 6 });
  });
}

export function playUiClick() {
  const ac = ready();
  if (!ac) return;
  tone(ac, { from: 1400, to: 1100, dur: 0.035, vol: 0.04 });
}

export function playNuke() {
  const ac = ready();
  if (!ac) return;
  tone(ac, { type: 'sawtooth', from: 80, to: 18, dur: 0.8, vol: 0.22, lp: 600 });
  tone(ac, { type: 'square', from: 120, to: 30, dur: 0.4, vol: 0.1, lp: 900 });
  noise(ac, { dur: 1.0, vol: 0.3, from: 3000, to: 120 });
}

export function playOverdrive() {
  const ac = ready();
  if (!ac) return;
  tone(ac, { type: 'sawtooth', from: 220, to: 1200, dur: 0.26, vol: 0.1, lp: 5000, detune: 8 });
  noise(ac, { dur: 0.26, vol: 0.05, type: 'bandpass', from: 400, to: 4000, q: 2 });
}

export function playHeal() {
  const ac = ready();
  if (!ac) return;
  [587.33, 739.99, 880, 1174.66].forEach((freq, idx) => tone(ac, { from: freq, at: idx * 0.05, dur: 0.3, vol: 0.07 }));
}

export function playMagnet() {
  const ac = ready();
  if (!ac) return;
  tone(ac, { type: 'triangle', from: 260, to: 880, dur: 0.22, vol: 0.08 });
  noise(ac, { dur: 0.22, vol: 0.04, type: 'bandpass', from: 500, to: 3000, q: 3 });
}

export function playShieldHit() {
  const ac = ready();
  if (!ac) return;
  tone(ac, { type: 'triangle', from: 1100, to: 540, dur: 0.1, vol: 0.1 });
  noise(ac, { dur: 0.05, vol: 0.05, type: 'highpass', from: 4000 });
}

export function playShieldBreak() {
  const ac = ready();
  if (!ac) return;
  tone(ac, { type: 'sawtooth', from: 320, to: 55, dur: 0.24, vol: 0.14, lp: 2000 });
  noise(ac, { dur: 0.3, vol: 0.14, type: 'highpass', from: 6000, to: 1500 });
}

export function playShieldRecharge() {
  const ac = ready();
  if (!ac) return;
  [440, 660, 880].forEach((freq, idx) => tone(ac, { from: freq, at: idx * 0.06, dur: 0.26, vol: 0.06 }));
}

export function playBossRoar() {
  const ac = ready();
  if (!ac) return;
  tone(ac, { type: 'sawtooth', from: 160, to: 38, dur: 0.8, vol: 0.2, lp: 1200, detune: 12 });
  tone(ac, { type: 'square', from: 120, to: 44, at: 0.04, dur: 0.55, vol: 0.12, lp: 800 });
  noise(ac, { dur: 0.7, vol: 0.12, from: 900, to: 150 });
}

export function playElectricZap() {
  const ac = ready();
  if (!ac || !allowZapVoice(ac.currentTime)) return;
  tone(ac, { type: 'sawtooth', from: 360, to: 70, dur: 0.18, vol: 0.09, lp: 4000 });
  noise(ac, { dur: 0.18, vol: 0.1, type: 'bandpass', from: 3500, to: 900, q: 4 });
}

export function playComboMilestone(tier = 1) {
  const ac = ready();
  if (!ac) return;
  const notes = tier === 3 ? [587, 740, 880, 1175] : (tier === 2 ? [523, 659, 784] : [587, 880]);
  notes.forEach((freq, idx) => tone(ac, { type: tier >= 2 ? 'triangle' : 'sine', from: freq, at: idx * 0.05, dur: 0.24, vol: 0.1 }));
}

export function playBlackoutAlarm() {
  const ac = ready();
  if (!ac) return;
  tone(ac, { type: 'sawtooth', from: 180, to: 32, dur: 0.8, vol: 0.2, lp: 800 });
  [0.15, 0.42].forEach(at => tone(ac, { type: 'square', from: 880, at, dur: 0.12, vol: 0.1, lp: 3000 }));
}

export function playPowerRestored() {
  const ac = ready();
  if (!ac) return;
  tone(ac, { type: 'triangle', from: 45, to: 360, dur: 0.45, vol: 0.18 });
  tone(ac, { type: 'sawtooth', from: 1200, at: 0.45, dur: 0.07, vol: 0.12, lp: 4000 });
  noise(ac, { at: 0.45, dur: 0.08, vol: 0.12, type: 'bandpass', from: 2500, q: 2 });
}
