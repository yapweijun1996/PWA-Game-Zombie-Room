import { musicState } from './state.js';
import { getAudioContext, getMasterBus, resumeAudioContext } from './audio.js';

const STEP_SECONDS = 60 / 92 / 2;
const STEPS_PER_BAR = 8;
// 8-bar loop in E minor: Em | C | G | D, played twice with a higher second phrase.
const ROOTS = [82.41, 65.41, 98, 73.42];
const CHORDS = [
  [164.81, 196, 246.94],
  [130.81, 164.81, 196],
  [196, 246.94, 293.66],
  [146.83, 185, 220]
];
const MELODY = [
  659, 0, 784, 0, 988, 0, 784, 0,
  784, 0, 659, 0, 523, 0, 659, 0,
  587, 0, 784, 0, 988, 0, 784, 0,
  740, 0, 587, 0, 740, 0, 880, 0,
  988, 0, 1175, 0, 988, 0, 784, 0,
  1047, 0, 784, 0, 659, 0, 784, 0,
  988, 0, 784, 0, 587, 0, 784, 0,
  880, 0, 740, 0, 587, 0, 740, 0
];
const LOOP_STEPS = MELODY.length;

let schedulerTimer = 0;
let schedulerActive = false;
let musicContext = null;
let musicBus = null;
let nextStepAt = 0;
let step = 0;

function disconnectAfterEnd(oscillator, envelope) {
  oscillator.addEventListener('ended', () => {
    oscillator.disconnect();
    envelope.disconnect();
  }, { once: true });
}

let noiseBuffer = null;
let noiseContext = null;

function scheduleTone(context, frequency, startAt, duration, volume, type = 'triangle', lowpass = 0) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  envelope.gain.setValueAtTime(0.0001, startAt);
  envelope.gain.exponentialRampToValueAtTime(volume, startAt + 0.025);
  envelope.gain.setValueAtTime(volume, startAt + duration * 0.62);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  let filter = null;
  if (lowpass) {
    filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    oscillator.connect(filter);
    filter.connect(envelope);
  } else {
    oscillator.connect(envelope);
  }
  envelope.connect(musicBus);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
  oscillator.addEventListener('ended', () => {
    oscillator.disconnect();
    filter?.disconnect();
    envelope.disconnect();
  }, { once: true });
}

function scheduleKick(context, startAt, volume) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.frequency.setValueAtTime(140, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(42, startAt + 0.14);
  envelope.gain.setValueAtTime(volume, startAt);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.2);
  oscillator.connect(envelope);
  envelope.connect(musicBus);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.22);
  oscillator.addEventListener('ended', () => {
    oscillator.disconnect();
    envelope.disconnect();
  }, { once: true });
}

function scheduleNoiseHit(context, startAt, duration, volume, filterType, frequency) {
  if (noiseContext !== context) {
    noiseContext = context;
    noiseBuffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.3), context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const envelope = context.createGain();
  source.buffer = noiseBuffer;
  filter.type = filterType;
  filter.frequency.value = frequency;
  envelope.gain.setValueAtTime(volume, startAt);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(musicBus);
  source.start(startAt);
  source.stop(startAt + duration + 0.02);
  source.addEventListener('ended', () => {
    source.disconnect();
    filter.disconnect();
    envelope.disconnect();
  }, { once: true });
}

function scheduleMusicStep(context, loopStep, at) {
  const bar = Math.floor(loopStep / STEPS_PER_BAR);
  const beatStep = loopStep % STEPS_PER_BAR;
  const chordIdx = bar % CHORDS.length;
  const chord = CHORDS[chordIdx];
  const root = ROOTS[chordIdx];

  const note = MELODY[loopStep];
  if (note) scheduleTone(context, note, at, STEP_SECONDS * 1.8, 0.03, 'triangle', 3200);
  else if (beatStep % 2 === 1) {
    // Quiet arpeggio fills the gaps between melody notes.
    const arp = chord[(beatStep >> 1) % chord.length] * 4;
    scheduleTone(context, arp, at, STEP_SECONDS * 0.9, 0.009, 'sine');
  }

  if (beatStep === 0) {
    for (const chordNote of chord) scheduleTone(context, chordNote, at, STEP_SECONDS * 7.6, 0.011, 'sine');
    scheduleTone(context, root, at, STEP_SECONDS * 3.4, 0.07, 'triangle', 600);
  } else if (beatStep === 3 || beatStep === 6) {
    scheduleTone(context, root * 2, at, STEP_SECONDS * 0.9, 0.04, 'triangle', 700);
  } else if (beatStep === 4) {
    scheduleTone(context, root, at, STEP_SECONDS * 1.8, 0.055, 'triangle', 600);
  }

  // Drums come in after the first bar of each loop so the intro breathes.
  if (loopStep >= STEPS_PER_BAR) {
    if (beatStep === 0 || beatStep === 4) scheduleKick(context, at, 0.16);
    if (beatStep === 2 || beatStep === 6) scheduleNoiseHit(context, at, 0.12, 0.05, 'bandpass', 1800);
    if (beatStep % 2 === 1) scheduleNoiseHit(context, at, 0.04, 0.02, 'highpass', 7000);
  }
}

function scheduleStep() {
  const context = musicContext;
  if (!schedulerActive || !musicState.enabled || document.hidden || !context || context.state !== 'running') {
    schedulerActive = false;
    schedulerTimer = 0;
    return;
  }

  const now = context.currentTime;
  if (nextStepAt < now - STEP_SECONDS * 2) {
    nextStepAt = now + 0.03;
    step = 0;
  }
  while (nextStepAt < now + 0.18) {
    scheduleMusicStep(context, step % LOOP_STEPS, nextStepAt);
    nextStepAt += STEP_SECONDS;
    step++;
  }
  schedulerTimer = setTimeout(scheduleStep, 60);
}

function stopScheduler() {
  schedulerActive = false;
  if (schedulerTimer) clearTimeout(schedulerTimer);
  schedulerTimer = 0;
}

export function startMusic() {
  if (!musicState.enabled) return;
  const context = getAudioContext();
  if (!context) return;
  void resumeAudioContext({ force: true }).then(running => {
    if (!running || !musicState.enabled) return;
    if (musicContext !== context) {
      stopScheduler();
      musicContext = context;
      musicBus = context.createGain();
      musicBus.connect(getMasterBus(context));
    }
    if (schedulerActive) return;
    musicBus.gain.cancelScheduledValues(context.currentTime);
    musicBus.gain.setTargetAtTime(0.7, context.currentTime, 0.035);
    schedulerActive = true;
    nextStepAt = context.currentTime + 0.04;
    step = 0;
    scheduleStep();
  });
}

export function stopMusic() {
  stopScheduler();
  if (!musicBus || !musicContext) return;
  try {
    musicBus.gain.cancelScheduledValues(musicContext.currentTime);
    musicBus.gain.setTargetAtTime(0, musicContext.currentTime, 0.035);
  } catch (_) {}
}

export function isMusicScheduled() {
  return schedulerActive && musicState.enabled && musicContext?.state === 'running';
}

export function initMusic() {
  const unlock = () => startMusic();
  const restore = () => {
    if (document.hidden) {
      stopScheduler();
      return;
    }
    startMusic();
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  window.addEventListener('pageshow', restore);
  document.addEventListener('visibilitychange', restore);
}
