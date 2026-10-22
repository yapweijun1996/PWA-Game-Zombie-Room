// All pacing and difficulty rules live here; the director never mutates combat entities.
export const DIRECTOR_CONFIG = Object.freeze({
  waveSeconds: 25, wavesPerStage: 4, warningSeconds: 3,
  blackoutOffset: 8, blackoutSeconds: 12, recoverySeconds: 4,
  reliefSeconds: 2.25, reliefCooldown: 30, damageWindow: 5, damageThreshold: 0.25,
  nearbyRadius: 90, nearbyThreshold: 9,
  maxEnemies: 90, maxMoveSpeed: 180, maxChargeSpeed: 360,
  phaseRates: Object.freeze([0.82, 1.12, 0.72, 0.55]), recoveryRate: 0.25,
  healthPerWave: 0.11, bossHealthPerWave: 0.19, healthPerStage: 0.3,
  eliteBase: 0.12, elitePerWave: 0.025, eliteCap: 0.4
});

// Upgrades multiply player damage, so durability compounds after the opening waves, and hits
// scale so they keep mattering as maximum HP grows. spawnScale multiplies the spawn rate.
// Hard is the owner-tuned default (3.8.7); Normal is the 3.8.5 curve with lighter spawns for
// newcomers; Nightmare adds denser spawns, because Hard already meets a crowd wall near 2:20.
export const DIFFICULTY_MODES = Object.freeze({
  normal: Object.freeze({ lateHealthGrowth: 1.16, lateGrowthAfterWave: 2, damagePerWave: 0, spawnScale: 0.9 }),
  hard: Object.freeze({ lateHealthGrowth: 1.24, lateGrowthAfterWave: 1, damagePerWave: 0.11, spawnScale: 1 }),
  nightmare: Object.freeze({ lateHealthGrowth: 1.30, lateGrowthAfterWave: 1, damagePerWave: 0.18, spawnScale: 1.5 })
});
export const DIFFICULTY_IDS = Object.freeze(Object.keys(DIFFICULTY_MODES));
// Players start on Nightmare (owner request, 3.9.1). Hard stays the baseline: the tuning that
// seeded playtests, pre-3.9 replays, legacy best-score keys and the pure-function defaults use.
export const DEFAULT_DIFFICULTY = 'nightmare';
export const BASELINE_DIFFICULTY = 'hard';

export function resolveDifficulty(mode, fallback = DEFAULT_DIFFICULTY) {
  return DIFFICULTY_IDS.includes(mode) ? mode : fallback;
}

export const ENCOUNTERS = Object.freeze({
  rush: Object.freeze({ affix: 'swift', weights: Object.freeze([0.45, 0.40, 0.05, 0.10]) }),
  blockade: Object.freeze({ affix: 'armored', weights: Object.freeze([0.40, 0.15, 0.35, 0.10]) }),
  crossfire: Object.freeze({ affix: 'frost', weights: Object.freeze([0.45, 0.15, 0.15, 0.25]) })
});
const ENCOUNTER_IDS = Object.keys(ENCOUNTERS);
const ELITE_AFFIXES = Object.freeze(['frost', 'swift', 'armored']);
export const WAVE_MODIFIER_IDS = Object.freeze(['swift', 'armored', 'frost']);

function hashSeedWave(seed, wave) {
  let value = ((seed >>> 0) ^ Math.imul(wave, 0x9e3779b9)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

function rawBag(seed, index) {
  const bag = [...ENCOUNTER_IDS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = hashSeedWave(seed ^ 0x45ab129f, index * 3 + i) % (i + 1);
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function encounterForWave(seed, wave) {
  const phase = (wave - 1) % 4;
  if (wave < 5 || phase > 1) return null;
  const ordinal = (Math.floor((wave - 1) / 4) - 1) * 2 + phase;
  const bagIndex = Math.floor(ordinal / 3);
  const bag = rawBag(seed, bagIndex);
  // Swapping only the first two entries leaves the last entry independently queryable.
  if (bagIndex > 0 && bag[0] === rawBag(seed, bagIndex - 1)[2]) {
    [bag[0], bag[1]] = [bag[1], bag[0]];
  }
  return bag[ordinal % 3];
}

export function isModifierWave(wave) {
  return Number.isInteger(wave) && (wave === 2 || (wave >= 5 && (wave - 1) % 4 < 2));
}

export function getWaveModifier(seed, wave) {
  if (!isModifierWave(wave)) return null;
  const encounter = encounterForWave(seed, wave);
  return encounter ? ENCOUNTERS[encounter].affix : WAVE_MODIFIER_IDS[hashSeedWave(seed, wave) % 3];
}

export function getWavePlan(seed, wave, mode = BASELINE_DIFFICULTY) {
  const tuning = DIFFICULTY_MODES[resolveDifficulty(mode, BASELINE_DIFFICULTY)];
  const cycle = Math.floor((wave - 1) / DIRECTOR_CONFIG.wavesPerStage);
  const phase = (wave - 1) % DIRECTOR_CONFIG.wavesPerStage;
  const late = tuning.lateHealthGrowth ** Math.max(0, wave - tuning.lateGrowthAfterWave);
  return {
    wave, stage: cycle + 1, phase,
    phaseId: ['buildup', 'pressure', 'blackout', 'boss'][phase],
    encounterId: encounterForWave(seed, wave),
    modifierId: getWaveModifier(seed, wave),
    spawnRate: DIRECTOR_CONFIG.phaseRates[phase],
    healthScale: (1 + DIRECTOR_CONFIG.healthPerWave * (wave - 1) + DIRECTOR_CONFIG.healthPerStage * cycle) * late,
    bossHealthScale: (1 + DIRECTOR_CONFIG.bossHealthPerWave * (wave - 1) + DIRECTOR_CONFIG.healthPerStage * cycle) * late,
    damageScale: 1 + tuning.damagePerWave * (wave - 1),
    eliteChance: Math.min(DIRECTOR_CONFIG.eliteCap, DIRECTOR_CONFIG.eliteBase + wave * DIRECTOR_CONFIG.elitePerWave),
    spitterLimit: wave < 5 ? 0 : Math.min(6, cycle + 2)
  };
}

export function selectEliteAffix(modifierId, roll) {
  const value = Math.min(0.999999999, Math.max(0, Number.isFinite(roll) ? roll : 0));
  if (!ELITE_AFFIXES.includes(modifierId)) return ELITE_AFFIXES[Math.floor(value * 3)];
  if (value < 0.6) return modifierId;
  const alternatives = ELITE_AFFIXES.filter(affix => affix !== modifierId);
  return alternatives[Math.min(1, Math.floor((value - 0.6) / 0.2))];
}

export function selectEnemyType(plan, roll, { walkersOnly = false, allowSpitter = false, spitterCount = 0 } = {}) {
  if (walkersOnly) return 'walker';
  let type = 'walker';
  if (plan.encounterId) {
    let cumulative = 0;
    const types = ['walker', 'runner', 'tank', 'spitter'];
    const weights = ENCOUNTERS[plan.encounterId].weights;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (roll < cumulative) { type = types[i]; break; }
    }
  } else if (plan.wave >= 5 && roll < Math.min(0.18, plan.wave * 0.018)) type = 'tank';
  else if (plan.wave >= 3 && roll < 0.34) type = 'runner';
  if (type === 'spitter' && (!allowSpitter || spitterCount >= plan.spitterLimit)) return 'walker';
  return type;
}

export function getSpawnInterval(elapsed, wave, rate) {
  return Math.max(0.18, 0.82 - elapsed * 0.0038 - wave * 0.018) / rate;
}

export function capEnemySpeed(speed, charging = false) {
  return Math.min(speed, charging ? DIRECTOR_CONFIG.maxChargeSpeed : DIRECTOR_CONFIG.maxMoveSpeed);
}

export function createDirectorState(seed, mode = BASELINE_DIFFICULTY) {
  return {
    seed: seed >>> 0, mode: resolveDifficulty(mode, BASELINE_DIFFICULTY), wave: 0, warningWave: 0, eventHandledWave: 0,
    recoveryUntil: 0, reliefUntil: 0, reliefCooldownUntil: 0, recentDamage: []
  };
}

export function recordDirectorDamage(state, elapsed, loss) {
  if (state && loss > 0) state.recentDamage.push({ elapsed, loss });
}

export function startDirectorRecovery(state, elapsed) {
  state.recoveryUntil = elapsed + DIRECTOR_CONFIG.recoverySeconds;
  state.reliefUntil = 0;
  return { type: 'recovery', wave: state.wave, elapsed, until: state.recoveryUntil };
}

export function advanceDirector(state, context) {
  const { elapsed, maxHp, nearbyEnemies = 0, hasBoss = false, blackoutActive = false } = context;
  const wave = 1 + Math.floor(elapsed / DIRECTOR_CONFIG.waveSeconds);
  const offset = elapsed - (wave - 1) * DIRECTOR_CONFIG.waveSeconds;
  const plan = getWavePlan(state.seed, wave, state.mode);
  const events = [];
  const enteredWave = wave !== state.wave;
  if (enteredWave) {
    state.wave = wave;
    events.push({ type: 'wave', wave, stage: plan.stage, encounterId: plan.encounterId, phaseId: plan.phaseId, elapsed });
  }
  let warning = null;
  if (offset >= DIRECTOR_CONFIG.waveSeconds - DIRECTOR_CONFIG.warningSeconds && state.warningWave !== wave + 1) {
    state.warningWave = wave + 1;
    warning = getWavePlan(state.seed, wave + 1, state.mode);
  }

  state.recentDamage = state.recentDamage.filter(hit => elapsed - hit.elapsed <= DIRECTOR_CONFIG.damageWindow);
  const recovering = elapsed < state.recoveryUntil;
  const loss = state.recentDamage.reduce((total, hit) => total + hit.loss, 0);
  if (!recovering && elapsed >= state.reliefCooldownUntil &&
      ((maxHp > 0 && loss >= maxHp * DIRECTOR_CONFIG.damageThreshold) || nearbyEnemies >= DIRECTOR_CONFIG.nearbyThreshold)) {
    state.reliefUntil = elapsed + DIRECTOR_CONFIG.reliefSeconds;
    state.reliefCooldownUntil = elapsed + DIRECTOR_CONFIG.reliefCooldown;
    events.push({ type: 'relief', wave, elapsed, until: state.reliefUntil, reason: loss >= maxHp * DIRECTOR_CONFIG.damageThreshold ? 'damage' : 'surrounded' });
  }
  const relieved = !recovering && elapsed < state.reliefUntil;
  let event = null;
  const eventDue = plan.phaseId === 'boss' || (plan.phaseId === 'blackout' && offset >= DIRECTOR_CONFIG.blackoutOffset);
  if (eventDue && state.eventHandledWave !== wave) {
    if (hasBoss || (plan.phaseId === 'blackout' && offset + DIRECTOR_CONFIG.blackoutSeconds > DIRECTOR_CONFIG.waveSeconds)) {
      state.eventHandledWave = wave;
      events.push({ type: 'event-skipped', wave, elapsed, event: plan.phaseId, reason: hasBoss ? 'active-boss' : 'insufficient-time' });
    } else if (!recovering && !relieved && !blackoutActive) {
      state.eventHandledWave = wave;
      event = plan.phaseId;
      events.push({ type: 'event', wave, elapsed, event });
    }
  }
  const bossPressure = hasBoss || event === 'boss';
  const baseRate = recovering ? DIRECTOR_CONFIG.recoveryRate : Math.min(plan.spawnRate, bossPressure ? 0.68 : 1);
  const spawnRate = baseRate * DIFFICULTY_MODES[resolveDifficulty(state.mode, BASELINE_DIFFICULTY)].spawnScale;
  return {
    plan, enteredWave, warning, event, events, spawnRate,
    pausedSpawns: relieved, walkersOnly: recovering,
    allowSpitter: plan.phase < 2 && !blackoutActive && !recovering && !relieved
  };
}

// Survival rank by the wave reached: B after 75s, A after 175s (the 3-minute wall), S after 300s.
export const RANK_THRESHOLDS = Object.freeze([
  Object.freeze({ rank: 'S', wave: 13 }),
  Object.freeze({ rank: 'A', wave: 8 }),
  Object.freeze({ rank: 'B', wave: 4 })
]);

export function calculateRunRank(wave) {
  return RANK_THRESHOLDS.find(threshold => wave >= threshold.wave)?.rank || 'C';
}

// The next rank and the elapsed time that earns it, or null once S is reached.
export function getNextRankTarget(elapsed) {
  const wave = 1 + Math.floor(elapsed / DIRECTOR_CONFIG.waveSeconds);
  const next = [...RANK_THRESHOLDS].reverse().find(threshold => wave < threshold.wave);
  return next ? { rank: next.rank, at: (next.wave - 1) * DIRECTOR_CONFIG.waveSeconds } : null;
}
