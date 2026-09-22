export const APP_VERSION = '3.5.1';

export const dom = {
  canvas: document.getElementById('game'),
  updateButton: document.getElementById('updateButton'),
  updateLabel: document.getElementById('updateLabel'),
  installButton: document.getElementById('installButton'),
  installLabel: document.getElementById('installLabel'),
  installTip: document.getElementById('installTip'),
  appbar: document.getElementById('appbar'),
  hud: document.getElementById('hud'),
  pauseButton: document.getElementById('pauseButton'),
  pauseOverlay: document.getElementById('pauseOverlay'),
  resumeButton: document.getElementById('resumeButton'),
  upgradeModal: document.getElementById('upgradeModal'),
  upgradeCards: document.getElementById('upgradeCards'),
  soundToggle: document.getElementById('soundToggle'),
  soundStatusText: document.getElementById('soundStatusText'),
  hapticsToggle: document.getElementById('hapticsToggle'),
  hapticsStatusText: document.getElementById('hapticsStatusText'),
  comboBadge: document.getElementById('comboBadge'),
  comboText: document.getElementById('comboText'),
  comboBar: document.getElementById('comboBar'),
  controlsWrap: document.getElementById('controlsWrap'),
  joystickZone: document.getElementById('joystickZone'),
  joystickBase: document.getElementById('joystickBase'),
  joystickKnob: document.getElementById('joystickKnob'),
  hintPill: document.getElementById('hintPill'),
  languageSelect: document.getElementById('languageSelect'),
  restartButton: document.getElementById('restartButton'),
  shareButton: document.getElementById('shareButton')
};

export const ctx = dom.canvas.getContext('2d');

export const ui = {
  hpText: document.getElementById('hpText'),
  hpFill: document.getElementById('hpFill'),
  shieldText: document.getElementById('shieldText'),
  shieldFill: document.getElementById('shieldFill'),
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
  gameoverScore: document.getElementById('gameoverScore'),
  gameoverWave: document.getElementById('gameoverWave'),
  gameoverKills: document.getElementById('gameoverKills'),
  gameoverTime: document.getElementById('gameoverTime'),
  gameoverNewBest: document.getElementById('gameoverNewBest'),
  bossBar: document.getElementById('bossBar'),
  bossHpFill: document.getElementById('bossHpFill'),
  bossHpText: document.getElementById('bossHpText'),
  comboBadge: document.getElementById('comboBadge'),
  comboText: document.getElementById('comboText'),
  comboBar: document.getElementById('comboBar'),
  gameoverCombo: document.getElementById('gameoverCombo'),
  gameoverRankBadge: document.getElementById('gameoverRankBadge'),
  gameoverRankText: document.getElementById('gameoverRankText'),
  gameoverBuildGrid: document.getElementById('gameoverBuildGrid')
};

export const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  vx: 0,
  vy: 0,
  active: false
};

export const keyMap = {
  w: 'up', arrowup: 'up',
  s: 'down', arrowdown: 'down',
  a: 'left', arrowleft: 'left',
  d: 'right', arrowright: 'right'
};

export const viewport = { W: innerWidth, H: innerHeight, dpr: 1 };

export const room = { x: 12, y: 150, w: viewport.W - 24, h: viewport.H - 340, obstacles: [], hazards: [] };

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

function readBestScore() {
  try {
    const n = Number(localStorage.getItem('zombie-room-best') || 0);
    return Number.isFinite(n) ? n : 0;
  } catch (_) {
    return 0;
  }
}

function readSoundSetting() {
  try {
    const saved = localStorage.getItem('zombie-room-sound');
    return saved === null ? true : saved === 'true';
  } catch (_) {
    return true;
  }
}

function readHapticsSetting() {
  try {
    const saved = localStorage.getItem('zombie-room-haptics');
    return saved === null ? true : saved === 'true';
  } catch (_) {
    return true;
  }
}

export const scoreState = {
  best: readBestScore()
};

export const audioState = {
  enabled: readSoundSetting()
};

export const hapticsState = {
  enabled: readHapticsSetting()
};

export const game = {
  running: true,
  paused: false,
  pendingUpgrades: 0,
  upgradeModalOpen: false,
  elapsed: 0,
  score: 0,
  kills: 0,
  combo: 0,
  comboTimer: 0,
  maxCombo: 0,
  wave: 1,
  spawnTimer: 0,
  bullets: [],
  zombies: [],
  orbs: [],
  particles: [],
  decals: [],
  floatingTexts: [],
  pickups: [],
  player: null,
  bossWave: 0,
  roomPhase: 0,
  cameraShake: 0,
  blackoutTimer: 0,
  blackoutTriggeredWave: 0,
  performanceMode: false
};
