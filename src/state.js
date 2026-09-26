export const APP_VERSION = '3.7.0';

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
  dashButton: document.getElementById('dashButton'),
  dashButtonStatus: document.getElementById('dashButtonStatus'),
  dashCooldownFill: document.getElementById('dashCooldownFill'),
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
  buildPathIcon: document.getElementById('buildPathIcon'),
  levelMetric: document.getElementById('levelMetric'),
  waveText: document.getElementById('waveText'),
  encounterText: document.getElementById('encounterText'),
  killsText: document.getElementById('killsText'),
  timeText: document.getElementById('timeText'),
  scoreText: document.getElementById('scoreText'),
  bestText: document.getElementById('bestText'),
  fpsText: document.getElementById('fpsText'),
  perfLine: document.getElementById('perfLine'),
  perfText: document.getElementById('perfText'),
  legacyBestNote: document.getElementById('legacyBestNote'),
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
  best: readBestScore(),
  bestVersion: (() => {
    try { return localStorage.getItem('zombie-room-best-version') || 'pre-3.6'; }
    catch (_) { return 'pre-3.6'; }
  })()
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
  waveModifierId: null,
  waveModifierWave: 0,
  pendingWaveModifierId: null,
  preparedWave: 0,
  scenarioSeed: 0,
  swiftChargeCooldown: 0,
  spitCooldown: 0,
  director: null,
  spawnTimer: 0,
  bullets: [],
  enemyProjectiles: [],
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

export function hasActiveBoss() {
  return game.zombies.some(zombie => zombie.type === 'boss');
}

export function getActiveBoss() {
  return game.zombies.find(zombie => zombie.type === 'boss') || null;
}
