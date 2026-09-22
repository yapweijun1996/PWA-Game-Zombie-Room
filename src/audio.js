import { audioState } from './state.js';

let audioCtx = null;

function getContext() {
  if (!audioState.enabled) return null;
  if (!audioCtx && typeof AudioContext !== 'undefined') {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function initAudio() {
  const unlock = () => {
    if (audioState.enabled) getContext();
    removeEventListener('pointerdown', unlock);
    removeEventListener('keydown', unlock);
  };
  addEventListener('pointerdown', unlock, { passive: true });
  addEventListener('keydown', unlock, { passive: true });
}

// 1. Shoot Sound: Tiered laser/cannon pitch drop adapting to upgrades
export function playShoot(volleys = 1, isHeavy = false) {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = isHeavy ? 'sawtooth' : 'triangle';
  const startFreq = isHeavy ? 520 : 640;
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(isHeavy ? 80 : 110, now + 0.075);

  gain.gain.setValueAtTime(isHeavy ? 0.11 : 0.09, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.075);

  // Multi-shot harmonic resonance
  if (volleys > 1) {
    const osc2 = ac.createOscillator();
    const gain2 = ac.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(780, now + 0.01);
    osc2.frequency.exponentialRampToValueAtTime(140, now + 0.08);
    gain2.gain.setValueAtTime(0.06, now + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc2.connect(gain2);
    gain2.connect(ac.destination);
    osc2.start(now + 0.01);
    osc2.stop(now + 0.08);
  }

  // Heavy sub-bass punch
  if (isHeavy) {
    const sub = ac.createOscillator();
    const subGain = ac.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(95, now);
    sub.frequency.exponentialRampToValueAtTime(35, now + 0.09);
    subGain.gain.setValueAtTime(0.12, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    sub.connect(subGain);
    subGain.connect(ac.destination);
    sub.start(now);
    sub.stop(now + 0.09);
  }
}

// 2. Critical Hit Sound: Bright dual chime
export function playCrit() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  [1200, 1800].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + i * 0.015);
    gain.gain.setValueAtTime(0.12, now + i * 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now + i * 0.015);
    osc.stop(now + 0.14);
  });
}

// 3. Zombie Kill: Low crunch/thud with dynamic combo pitch scaling
// Throttled: mass-kill events (e.g. the tactical nuke) can trigger dozens of
// kills in a single frame, and creating that many oscillator/gain nodes at
// once causes audible crackle and a frame hitch. Cap real voices per short
// window; excess kills in the same burst simply stay silent (inaudible
// difference at that density anyway).
const KILL_VOICE_MAX = 6;
const KILL_VOICE_WINDOW = 0.05;
let killVoiceWindowStart = 0;
let killVoiceWindowCount = 0;

function allowKillVoice(now) {
  if (now - killVoiceWindowStart > KILL_VOICE_WINDOW) {
    killVoiceWindowStart = now;
    killVoiceWindowCount = 0;
  }
  killVoiceWindowCount++;
  return killVoiceWindowCount <= KILL_VOICE_MAX;
}

export function playKill(combo = 0) {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;
  if (!allowKillVoice(now)) return;

  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'square';
  const pitchBump = Math.min(110, combo * 2.5);
  osc.frequency.setValueAtTime(160 + pitchBump, now);
  osc.frequency.exponentialRampToValueAtTime(45 + pitchBump * 0.2, now + 0.08);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(ac.destination);

  osc.start(now);
  osc.stop(now + 0.08);
}

// 4. XP Pickup: Pentatonic rising crystalline tone
const XP_NOTES = [784, 880, 988, 1175, 1319, 1568];
let xpNoteIdx = 0;
let lastXpTime = 0;

export function playXp() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  if (now - lastXpTime < 0.4) {
    xpNoteIdx = (xpNoteIdx + 1) % XP_NOTES.length;
  } else {
    xpNoteIdx = 0;
  }
  lastXpTime = now;

  const freq = XP_NOTES[xpNoteIdx];
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.08, now + 0.07);

  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

  osc.connect(gain);
  gain.connect(ac.destination);

  osc.start(now);
  osc.stop(now + 0.07);
}

// 5. Level Up: Triumphant 4-note ascending major arpeggio
export function playLevelUp() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  const chord = [523.25, 659.25, 783.99, 1046.50];
  chord.forEach((freq, idx) => {
    const t = now + idx * 0.07;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = idx === chord.length - 1 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.28);
  });
}

// 6. Upgrade Select: Power-up ascending sweep
export function playUpgradeSelect() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(920, now + 0.12);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(gain);
  gain.connect(ac.destination);

  osc.start(now);
  osc.stop(now + 0.12);
}

// 7. Player Hurt: Low dull thud
export function playPlayerHit() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.exponentialRampToValueAtTime(32, now + 0.14);

  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  osc.connect(gain);
  gain.connect(ac.destination);

  osc.start(now);
  osc.stop(now + 0.14);
}

// 8. Game Over: Grim descending progression
export function playGameOver() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  const notes = [330, 293.66, 246.94, 196];
  notes.forEach((freq, idx) => {
    const t = now + idx * 0.14;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.10, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.35);
  });
}

// 9. UI Click / Button Tap
export function playUiClick() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1400, now);
  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

  osc.connect(gain);
  gain.connect(ac.destination);

  osc.start(now);
  osc.stop(now + 0.025);
}

// 10. Tactical Nuke: Thunderous low explosion roar
export function playNuke() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  // Sub-bass blast
  const sub = ac.createOscillator();
  const subGain = ac.createGain();
  sub.type = 'sawtooth';
  sub.frequency.setValueAtTime(80, now);
  sub.frequency.exponentialRampToValueAtTime(20, now + 0.45);
  subGain.gain.setValueAtTime(0.24, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  sub.connect(subGain);
  subGain.connect(ac.destination);
  sub.start(now);
  sub.stop(now + 0.45);

  // High-frequency shockwave rumble
  const roar = ac.createOscillator();
  const roarGain = ac.createGain();
  roar.type = 'square';
  roar.frequency.setValueAtTime(120, now);
  roar.frequency.exponentialRampToValueAtTime(30, now + 0.35);
  roarGain.gain.setValueAtTime(0.14, now);
  roarGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  roar.connect(roarGain);
  roarGain.connect(ac.destination);
  roar.start(now);
  roar.stop(now + 0.35);
}

// 11. Overdrive: Electric charging power surge
export function playOverdrive() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.22);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.22);
}

// 12. Medkit: Pleasant restorative chime
export function playHeal() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  [587.33, 739.99, 880].forEach((freq, idx) => {
    const t = now + idx * 0.04;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.24);
  });
}

// 13. Super Magnet: Suction whoosh sweep
export function playMagnet() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(260, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
  gain.gain.setValueAtTime(0.09, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

// 14. Shield Deflection: High plasma bounce
export function playShieldHit() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1100, now);
  osc.frequency.exponentialRampToValueAtTime(540, now + 0.08);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.08);
}

// 15. Shield Overload Break: Resonant shatter
export function playShieldBreak() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.18);
  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

// 16. Shield Recharged: Gentle rising harmonic chime
export function playShieldRecharge() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  [440, 880].forEach((freq, idx) => {
    const t = now + idx * 0.06;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  });
}

// 17. Boss Enraged Roar: Terrifying low-frequency beast roar
export function playBossRoar() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  const roar1 = ac.createOscillator();
  const gain1 = ac.createGain();
  roar1.type = 'sawtooth';
  roar1.frequency.setValueAtTime(160, now);
  roar1.frequency.exponentialRampToValueAtTime(38, now + 0.55);
  gain1.gain.setValueAtTime(0.24, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  roar1.connect(gain1);
  gain1.connect(ac.destination);
  roar1.start(now);
  roar1.stop(now + 0.55);

  const roar2 = ac.createOscillator();
  const gain2 = ac.createGain();
  roar2.type = 'square';
  roar2.frequency.setValueAtTime(120, now + 0.04);
  roar2.frequency.exponentialRampToValueAtTime(44, now + 0.45);
  gain2.gain.setValueAtTime(0.16, now + 0.04);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  roar2.connect(gain2);
  gain2.connect(ac.destination);
  roar2.start(now + 0.04);
  roar2.stop(now + 0.45);
}

// 18. Electric Hazard Arc / Zap: High-voltage crackle
export function playElectricZap() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(360, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.16);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.16);
}

// 19. Combo Milestone: Triumphant ascending fanfare
export function playComboMilestone(tier = 1) {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  const notes = tier === 3 ? [587, 740, 880, 1175] : (tier === 2 ? [523, 659, 784] : [587, 880]);
  notes.forEach((freq, idx) => {
    const t = now + idx * 0.05;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = tier >= 2 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  });
}

// 20. Blackout Alarm: Generator power-down spool and warning sirens
export function playBlackoutAlarm() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(32, now + 0.65);
  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.65);

  [0.15, 0.42].forEach(delay => {
    const beep = ac.createOscillator();
    const beepGain = ac.createGain();
    beep.type = 'square';
    beep.frequency.setValueAtTime(880, now + delay);
    beepGain.gain.setValueAtTime(0.12, now + delay);
    beepGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);
    beep.connect(beepGain);
    beepGain.connect(ac.destination);
    beep.start(now + delay);
    beep.stop(now + delay + 0.12);
  });
}

// 21. Power Restored: Generator spin-up and breaker switch clack
export function playPowerRestored() {
  const ac = getContext();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(45, now);
  osc.frequency.exponentialRampToValueAtTime(360, now + 0.45);
  gain.gain.setValueAtTime(0.20, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.45);

  const click = ac.createOscillator();
  const clickGain = ac.createGain();
  click.type = 'sawtooth';
  click.frequency.setValueAtTime(1200, now + 0.45);
  clickGain.gain.setValueAtTime(0.16, now + 0.45);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
  click.connect(clickGain);
  clickGain.connect(ac.destination);
  click.start(now + 0.45);
  click.stop(now + 0.52);
}
