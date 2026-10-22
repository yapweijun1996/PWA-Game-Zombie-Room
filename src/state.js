import { DEFAULT_DIFFICULTY, resolveDifficulty } from './wave-director.js';

export const APP_VERSION = '3.9.0';

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
  musicToggle: document.getElementById('musicToggle'),
  musicStatusText: document.getElementById('musicStatusText'),
  hapticsToggle: document.getElementById('hapticsToggle'),
  hapticsStatusText: document.getElementById('hapticsStatusText'),
  hapticsAvailabilityNote: document.getElementById('hapticsAvailabilityNote'),
  autoUpgradeToggle: document.getElementById('autoUpgradeToggle'),
  upgradeSkipToggle: document.getElementById('upgradeSkipToggle'),
  upgradeSkipButton: document.getElementById('upgradeSkipButton'),
  saveImageButton: document.getElementById('saveImageButton'),
  upgradeAutoToggle: document.getElementById('upgradeAutoToggle'),
  upgradeAutoCountdown: document.getElementById('upgradeAutoCountdown'),
  upgradeAutoProgress: document.getElementById('upgradeAutoProgress'),
  upgradeAutoProgressFill: document.getElementById('upgradeAutoProgressFill'),
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
  hintCoach: document.getElementById('hintCoach'),
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
  surgeVignette: document.getElementById('surgeVignette'),
  buildBanner: document.getElementById('buildBanner'),
  rankTargetText: document.getElementById('rankTargetText'),
  gameoverNextRank: document.getElementById('gameoverNextRank'),
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
  surgeTimer: 0,
  bannerTimer: 0,
  installTipTimer: 0,
  updateResetTimer: 0
};

export const pwaState = {
  swRegistration: null,
  waitingWorker: null,
  deferredInstallPrompt: null
};

// Hard keeps the original keys so best scores from before difficulty modes stay with it.
function bestScoreKeys(mode) {
  return mode === DEFAULT_DIFFICULTY
    ? { best: 'zombie-room-best', version: 'zombie-room-best-version' }
    : { best: `zombie-room-best-${mode}`, version: `zombie-room-best-version-${mode}` };
}

function readBestScore(mode) {
  try {
    const n = Number(localStorage.getItem(bestScoreKeys(mode).best) || 0);
    return Number.isFinite(n) ? n : 0;
  } catch (_) {
    return 0;
  }
}

function readBestVersion(mode) {
  try { return localStorage.getItem(bestScoreKeys(mode).version) || 'pre-3.6'; }
  catch (_) { return 'pre-3.6'; }
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

function readBooleanSetting(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? fallback : saved === 'true';
  } catch (_) {
    return fallback;
  }
}

// The selected mode applies from the next run; the running run keeps the mode it started with.
export const difficultyState = {
  mode: (() => {
    try { return resolveDifficulty(localStorage.getItem('zombie-room-difficulty')); }
    catch (_) { return DEFAULT_DIFFICULTY; }
  })()
};

export function setDifficulty(mode) {
  difficultyState.mode = resolveDifficulty(mode);
  try { localStorage.setItem('zombie-room-difficulty', difficultyState.mode); } catch (_) {}
}

export const scoreState = {
  mode: DEFAULT_DIFFICULTY,
  best: readBestScore(DEFAULT_DIFFICULTY),
  bestVersion: readBestVersion(DEFAULT_DIFFICULTY)
};

export function loadBestScore(mode) {
  scoreState.mode = resolveDifficulty(mode);
  scoreState.best = readBestScore(scoreState.mode);
  scoreState.bestVersion = readBestVersion(scoreState.mode);
}

export function saveBestScore(score, version) {
  const isNewBest = score > scoreState.best;
  scoreState.best = Math.max(scoreState.best, score);
  if (isNewBest) scoreState.bestVersion = version;
  try {
    const keys = bestScoreKeys(scoreState.mode);
    localStorage.setItem(keys.best, String(scoreState.best));
    if (isNewBest) localStorage.setItem(keys.version, version);
  } catch (_) {}
  return isNewBest;
}

export const audioState = {
  enabled: readSoundSetting()
};

export const hapticsState = {
  enabled: readHapticsSetting()
};

export const musicState = {
  enabled: readBooleanSetting('zombie-room-music', true)
};

export const autoUpgradeState = {
  enabled: readBooleanSetting('zombie-room-auto-upgrade', true)
};

// When enabled, level-ups take the first choice without opening the upgrade dialog.
// First-run coaching is shown once, in an ordinary (unseeded) session.
export const coachState = {
  done: readBooleanSetting('zombie-room-coached', false)
};

export function markCoached() {
  coachState.done = true;
  try { localStorage.setItem('zombie-room-coached', 'true'); } catch (_) {}
}

export const upgradeSkipState = {
  enabled: readBooleanSetting('zombie-room-upgrade-skip', true)
};

export function setUpgradeSkipEnabled(enabled) {
  upgradeSkipState.enabled = Boolean(enabled);
  try { localStorage.setItem('zombie-room-upgrade-skip', String(upgradeSkipState.enabled)); } catch (_) {}
}

export function setMusicEnabled(enabled) {
  musicState.enabled = Boolean(enabled);
  try { localStorage.setItem('zombie-room-music', String(musicState.enabled)); } catch (_) {}
}

export function setAutoUpgradeEnabled(enabled) {
  autoUpgradeState.enabled = Boolean(enabled);
  try { localStorage.setItem('zombie-room-auto-upgrade', String(autoUpgradeState.enabled)); } catch (_) {}
}

export const game = {
  running: true,
  // performance.now() at the last death; input restarts wait out a short grace period.
  endedAt: 0,
  difficulty: DEFAULT_DIFFICULTY,
  coachStep: -1,
  damageTaken: {},
  killedBy: null,
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
