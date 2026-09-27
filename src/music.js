import { musicState } from './state.js';
import { getAudioContext, resumeAudioContext } from './audio.js';

const STEP_SECONDS = 60 / 92 / 2;
const MELODY = [659, null, 784, null, 988, null, 784, null, 587, null, 659, null, 784, null, 659, null,
  523, null, 659, null, 784, null, 659, null, 494, null, 587, null, 659, null, 587, null];
const BASS = [82.41, 82.41, 73.42, 73.42, 65.41, 65.41, 73.42, 73.42];
const CHORDS = [
  [164.81, 196, 246.94],
  [146.83, 196, 220],
  [130.81, 164.81, 196],
  [146.83, 185, 220]
];

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

function scheduleTone(context, frequency, startAt, duration, volume, type = 'triangle') {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  envelope.gain.setValueAtTime(0.0001, startAt);
  envelope.gain.exponentialRampToValueAtTime(volume, startAt + 0.025);
  envelope.gain.setValueAtTime(volume, startAt + duration * 0.62);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(envelope);
  envelope.connect(musicBus);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
  disconnectAfterEnd(oscillator, envelope);
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
    const loopStep = step % MELODY.length;
    const note = MELODY[loopStep];
    if (note) scheduleTone(context, note, nextStepAt, STEP_SECONDS * 1.6, 0.035, 'sine');

    if (loopStep % 4 === 0) {
      const bassNote = BASS[Math.floor(loopStep / 4) % BASS.length];
      scheduleTone(context, bassNote, nextStepAt, STEP_SECONDS * 3.4, 0.065, 'triangle');
    }
    if (loopStep % 8 === 0) {
      const chord = CHORDS[Math.floor(loopStep / 8) % CHORDS.length];
      for (const chordNote of chord) scheduleTone(context, chordNote, nextStepAt, STEP_SECONDS * 7.5, 0.009, 'sine');
    }
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
      musicBus.connect(context.destination);
    }
    if (schedulerActive) return;
    musicBus.gain.cancelScheduledValues(context.currentTime);
    musicBus.gain.setTargetAtTime(0.55, context.currentTime, 0.035);
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
