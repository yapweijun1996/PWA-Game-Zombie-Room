export const APP_VERSION = '1.4.0';

export const dom = {
  canvas: document.getElementById('game'),
  updateButton: document.getElementById('updateButton'),
  updateLabel: document.getElementById('updateLabel'),
  installButton: document.getElementById('installButton'),
  installLabel: document.getElementById('installLabel'),
  installTip: document.getElementById('installTip'),
  appbar: document.getElementById('appbar'),
  hud: document.getElementById('hud'),
  controlsWrap: document.getElementById('controlsWrap'),
  hintPill: document.getElementById('hintPill'),
  languageSelect: document.getElementById('languageSelect')
};

export const ctx = dom.canvas.getContext('2d');

export const ui = {
  hpText: document.getElementById('hpText'),
  hpFill: document.getElementById('hpFill'),
  xpText: document.getElementById('xpText'),
  xpFill: document.getElementById('xpFill'),
  levelText: document.getElementById('levelText'),
  levelMetric: document.getElementById('levelMetric'),
  waveText: document.getElementById('waveText'),
  killsText: document.getElementById('killsText'),
  timeText: document.getElementById('timeText'),
  scoreText: document.getElementById('scoreText'),
  bestText: document.getElementById('bestText'),
  fpsText: document.getElementById('fpsText'),
  perfLine: document.getElementById('perfLine'),
  perfText: document.getElementById('perfText'),
  message: document.getElementById('message'),
  damageFlash: document.getElementById('damageFlash'),
  gameover: document.getElementById('gameover'),
  gameoverStats: document.getElementById('gameoverStats'),
  gameoverSurvived: document.getElementById('gameoverSurvived')
};

export const input = { up: false, down: false, left: false, right: false };

export const keyMap = {
  w: 'up', arrowup: 'up',
  s: 'down', arrowdown: 'down',
  a: 'left', arrowleft: 'left',
  d: 'right', arrowright: 'right'
};

export const viewport = { W: innerWidth, H: innerHeight, dpr: 1 };

export const room = { x: 12, y: 150, w: viewport.W - 24, h: viewport.H - 340 };

export const perf = {
  last: performance.now(),
  fpsWindowStart: 0,
  fpsFrames: 0,
  fpsValue: 0,
  lowFpsWindows: 0,
  recoveredFpsWindows: 0,
  perfWarmupUntil: 0
};
perf.fpsWindowStart = perf.last;
perf.perfWarmupUntil = perf.last + 3000;

export const timers = {
  messageTimer: 0,
  damageTimer: 0,
  installTipTimer: 0,
  updateResetTimer: 0
};

export const pwaState = {
  swRegistration: null,
  waitingWorker: null,
  deferredInstallPrompt: null
};

export const scoreState = {
  best: Number(localStorage.getItem('zombie-room-best') || 0)
};

export const game = {
  running: true,
  elapsed: 0,
  score: 0,
  kills: 0,
  wave: 1,
  spawnTimer: 0,
  bullets: [],
  zombies: [],
  orbs: [],
  particles: [],
  decals: [],
  player: null,
  bossWave: 0,
  roomPhase: 0,
  cameraShake: 0,
  performanceMode: false
};
