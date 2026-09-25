import { getWaveModifier } from './wave-director.js';

const UINT32_MAX = 0xffffffff;
const DEFAULT_LIMIT_SECONDS = 180;
const CHECKPOINT_INTERVAL_SECONDS = 5;
const MAX_CHECKPOINTS = 2000;
const MAX_DAMAGE_EVENTS = 1000;
const MAX_PLAYTEST_EVENTS = 20000;
const MAX_RECORDED_RUNS = 25;
const MAX_REPLAY_MISMATCHES = 1000;
const INPUT_FIELDS = ['up', 'down', 'left', 'right', 'vx', 'vy', 'active'];

export const PLAYTEST_FIXED_STEP_SECONDS = 1 / 60;

const search = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

function parseSeed(value) {
  if (value === null || !/^\d+$/.test(value)) return null;
  const seed = Number(value);
  return Number.isSafeInteger(seed) && seed >= 0 && seed <= UINT32_MAX ? seed : null;
}

function parseLimit(value) {
  if (value === null) return DEFAULT_LIMIT_SECONDS;
  if (value === '0') return null;
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds > 0 && seconds <= 3600 ? seconds : DEFAULT_LIMIT_SECONDS;
}

const configuredSeed = parseSeed(search.get('playtestSeed'));

export const playtestConfig = Object.freeze({
  enabled: configuredSeed !== null,
  seed: configuredSeed,
  limitSeconds: parseLimit(search.get('playtestLimit')),
  profile: (search.get('playtestProfile') || '').slice(0, 80) || null,
  inputProfile: (search.get('playtestInput') || '').slice(0, 80) || null
});

export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    let value = state = (state + 0x6d2b79f5) >>> 0;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

let activeSeed = configuredSeed;
let activeLimitSeconds = playtestConfig.limitSeconds;
let random = playtestConfig.enabled ? createSeededRandom(activeSeed) : null;
let randomDraws = 0;
let playtestTick = 0;
let activeRun = null;
let replaySource = null;
let replayCursor = 0;
let lastInputState = null;
let nextCheckpointSeconds = CHECKPOINT_INTERVAL_SECONDS;

export function getPlaytestTick() {
  return playtestTick;
}

export function advancePlaytestTick() {
  playtestTick++;
}

export function isPlaytestReplaying() {
  return replaySource !== null;
}

export function getPlaytestSeed() {
  return playtestConfig.enabled ? activeSeed : null;
}

export function resetPlaytestRandom() {
  if (!playtestConfig.enabled) return;
  random = createSeededRandom(activeSeed);
  randomDraws = 0;
}

export function gameRandom() {
  if (!playtestConfig.enabled) return Math.random();
  if (!random) resetPlaytestRandom();
  randomDraws++;
  const value = random();
  if (activeRun && activeRun.status === 'running') activeRun.randomDraws = randomDraws;
  return value;
}

export function gameRand(min, max) {
  return gameRandom() * (max - min) + min;
}

export function beginPlaytestRun(metadata, previousSnapshot) {
  if (!playtestConfig.enabled || typeof window === 'undefined') return;
  if (activeRun && activeRun.status === 'running') {
    finishPlaytestRun('manual-restart', previousSnapshot);
  }

  activeSeed = replaySource ? replaySource.seed : configuredSeed;
  activeLimitSeconds = replaySource ? replaySource.limitSeconds : playtestConfig.limitSeconds;
  resetPlaytestRandom();
  playtestTick = 0;
  nextCheckpointSeconds = CHECKPOINT_INTERVAL_SECONDS;
  lastInputState = null;

  activeRun = {
    schemaVersion: 3,
    appVersion: metadata.appVersion,
    scenarioSeed: metadata.scenarioSeed,
    seed: activeSeed,
    rng: 'mulberry32-v1',
    fixedStepSeconds: PLAYTEST_FIXED_STEP_SECONDS,
    limitSeconds: activeLimitSeconds,
    mode: replaySource ? 'replay' : 'record',
    profile: replaySource ? replaySource.profile : playtestConfig.profile,
    inputProfile: replaySource ? replaySource.inputProfile : playtestConfig.inputProfile,
    replayOf: replaySource ? {
      seed: replaySource.seed,
      profile: replaySource.profile,
      inputProfile: replaySource.inputProfile,
      outcome: replaySource.outcome
    } : null,
    viewport: metadata.viewport,
    startedAt: new Date().toISOString(),
    status: 'running',
    outcome: null,
    randomDraws: 0,
    simulationTicks: 0,
    checkpoints: [],
    upgrades: [],
    abilities: [],
    waveModifiers: [],
    damageEvents: [],
    events: replaySource ? replaySource.events.map(event => ({ ...event })) : [],
    eventsTruncated: replaySource ? replaySource.eventsTruncated : false,
    replayMismatches: [],
    lastDamage: null,
    final: null
  };

  if (!Array.isArray(window.__zombieRoomPlaytestRuns)) {
    window.__zombieRoomPlaytestRuns = [];
  }
  if (window.__zombieRoomPlaytestRuns.length >= MAX_RECORDED_RUNS) {
    window.__zombieRoomPlaytestRuns.shift();
  }
  window.__zombieRoomPlaytestRuns.push(activeRun);
  window.__zombieRoomPlaytest = activeRun;
}

function appendPlaytestEvent(type, details) {
  if (!activeRun || activeRun.status !== 'running' || replaySource) return;
  if (activeRun.events.length >= MAX_PLAYTEST_EVENTS) {
    activeRun.eventsTruncated = true;
    return;
  }
  activeRun.events.push({
    type,
    tick: playtestTick,
    sequence: activeRun.events.length,
    randomDraws,
    ...details
  });
}

export function recordPlaytestInput(input) {
  if (!activeRun || activeRun.status !== 'running' || replaySource) return;
  const state = {
    up: Boolean(input.up),
    down: Boolean(input.down),
    left: Boolean(input.left),
    right: Boolean(input.right),
    vx: Number.isFinite(input.vx) ? input.vx : 0,
    vy: Number.isFinite(input.vy) ? input.vy : 0,
    active: Boolean(input.active)
  };
  if (lastInputState && INPUT_FIELDS.every(field => lastInputState[field] === state[field])) return;
  lastInputState = state;
  appendPlaytestEvent('input', { state });
}

export function recordPlaytestPause(paused) {
  appendPlaytestEvent('pause', { paused: Boolean(paused) });
}

export function recordPlaytestCheckpoint(snapshot) {
  if (!activeRun || activeRun.status !== 'running') return;

  if (snapshot.elapsed >= nextCheckpointSeconds) {
    if (activeRun.checkpoints.length < MAX_CHECKPOINTS) {
      activeRun.checkpoints.push({ ...snapshot, tick: playtestTick, randomDraws });
    }
    while (nextCheckpointSeconds <= snapshot.elapsed) {
      nextCheckpointSeconds += CHECKPOINT_INTERVAL_SECONDS;
    }
  }

  if (activeLimitSeconds !== null && snapshot.elapsed >= activeLimitSeconds) {
    finishPlaytestRun('time-cap', snapshot);
  }
}

export function recordPlaytestUpgrade(upgrade) {
  if (!activeRun || activeRun.status !== 'running') return;
  const recorded = { ...upgrade, tick: playtestTick, randomDraws };
  activeRun.upgrades.push(recorded);
  appendPlaytestEvent('upgrade', { id: upgrade.id, index: upgrade.index });
}

export function recordPlaytestAbility(id, dx, dy) {
  if (!activeRun || activeRun.status !== 'running') return;
  activeRun.abilities.push({ id, dx, dy, tick: playtestTick, randomDraws });
  appendPlaytestEvent('ability', { id, dx, dy });
}

export function recordPlaytestWaveModifier(wave, id, elapsed) {
  if (!activeRun || activeRun.status !== 'running') return;
  activeRun.waveModifiers.push({
    wave,
    id,
    elapsed: Math.round(elapsed * 100) / 100,
    tick: playtestTick,
    randomDraws
  });
}

export function recordPlaytestDamage(event) {
  if (!activeRun || activeRun.status !== 'running') return;
  const recorded = { ...event, tick: playtestTick, randomDraws };
  activeRun.lastDamage = recorded;
  if (activeRun.damageEvents.length < MAX_DAMAGE_EVENTS) {
    activeRun.damageEvents.push(recorded);
  }
}

export function takePlaytestReplayEvents(tick) {
  if (!replaySource) return [];
  const events = [];
  while (replayCursor < replaySource.events.length && replaySource.events[replayCursor].tick <= tick) {
    events.push(replaySource.events[replayCursor++]);
  }
  return events;
}

export function recordPlaytestReplayMismatch(mismatch) {
  if (!activeRun || activeRun.mode !== 'replay' || activeRun.replayMismatches.length >= MAX_REPLAY_MISMATCHES) return;
  activeRun.replayMismatches.push({ tick: playtestTick, ...mismatch });
}

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function finishPlaytestRun(outcome, snapshot, details = {}) {
  if (!activeRun || activeRun.status !== 'running') return;
  activeRun.status = 'finished';
  activeRun.outcome = outcome;
  activeRun.finishedAt = new Date().toISOString();
  activeRun.randomDraws = randomDraws;
  activeRun.simulationTicks = playtestTick;
  activeRun.final = snapshot;
  if (details.deathCause) activeRun.deathCause = details.deathCause;
  else if (outcome === 'player-death' && activeRun.lastDamage) {
    activeRun.deathCause = activeRun.lastDamage.source;
  }

  if (activeRun.mode === 'replay' && replaySource && ['player-death', 'time-cap'].includes(outcome)) {
    activeRun.replayComparison = {
      outcomeMatches: outcome === replaySource.outcome,
      scenarioSeedMatches: activeRun.scenarioSeed === replaySource.scenarioSeed,
      finalMatches: equalJson(snapshot, replaySource.final),
      checkpointsMatch: equalJson(activeRun.checkpoints, replaySource.checkpoints),
      upgradesMatch: equalJson(activeRun.upgrades, replaySource.upgrades),
      abilitiesMatch: equalJson(activeRun.abilities, replaySource.abilities),
      waveModifiersMatch: equalJson(activeRun.waveModifiers, replaySource.waveModifiers),
      damageEventsMatch: equalJson(activeRun.damageEvents, replaySource.damageEvents),
      randomDrawsMatch: randomDraws === replaySource.randomDraws,
      eventsConsumed: replayCursor === replaySource.events.length,
      mismatchCount: activeRun.replayMismatches.length
    };
  }
}

export function preparePlaytestReplay(record, expectedAppVersion = null) {
  if (!playtestConfig.enabled) return { ok: false, reason: 'Open the app with a valid playtestSeed first.' };

  let source;
  try {
    source = JSON.parse(JSON.stringify(record));
  } catch (_) {
    return { ok: false, reason: 'The replay record must be JSON data.' };
  }

  if (!source || source.schemaVersion !== 3) return { ok: false, reason: 'Replay requires a schemaVersion 3 record.' };
  if (expectedAppVersion && source.appVersion !== expectedAppVersion) {
    return { ok: false, reason: 'Replay records must come from the same app version.' };
  }
  if (!['player-death', 'time-cap'].includes(source.outcome) || source.status !== 'finished') {
    return { ok: false, reason: 'Only completed death or time-cap runs can be replayed.' };
  }
  if (source.eventsTruncated) return { ok: false, reason: 'The input event limit was reached; this record is not replayable.' };
  if (!Array.isArray(source.events) || source.events.length > MAX_PLAYTEST_EVENTS || !Number.isInteger(source.seed) || source.seed < 0 || source.seed > UINT32_MAX ||
    !Array.isArray(source.abilities) || !Array.isArray(source.waveModifiers) || !Number.isInteger(source.scenarioSeed) ||
    source.scenarioSeed !== source.seed) {
    return { ok: false, reason: 'The replay record has invalid seed or event data.' };
  }
  if (source.fixedStepSeconds !== PLAYTEST_FIXED_STEP_SECONDS) {
    return { ok: false, reason: 'The replay fixed-step version does not match this app.' };
  }

  let previousTick = -1;
  for (let index = 0; index < source.events.length; index++) {
    const event = source.events[index];
    if (!event || !Number.isInteger(event.tick) || event.tick < 0 || event.tick < previousTick || event.sequence !== index) {
      return { ok: false, reason: 'Replay events are malformed or out of order.' };
    }
    previousTick = event.tick;
    if (event.type === 'input') {
      const booleanFields = ['up', 'down', 'left', 'right', 'active'];
      if (!event.state || !INPUT_FIELDS.every(field => field in event.state) ||
        !booleanFields.every(field => typeof event.state[field] === 'boolean') ||
        !Number.isFinite(event.state.vx) || !Number.isFinite(event.state.vy)) {
        return { ok: false, reason: 'A replay input event is malformed.' };
      }
    } else if (event.type === 'pause') {
      if (typeof event.paused !== 'boolean') return { ok: false, reason: 'A replay pause event is malformed.' };
    } else if (event.type === 'upgrade') {
      if (typeof event.id !== 'string') return { ok: false, reason: 'A replay upgrade event is malformed.' };
    } else if (event.type === 'ability') {
      if (event.id !== 'dash' || !Number.isFinite(event.dx) || !Number.isFinite(event.dy) ||
        Math.abs(Math.hypot(event.dx, event.dy) - 1) > 0.001) {
        return { ok: false, reason: 'A replay ability event is malformed.' };
      }
    } else {
      return { ok: false, reason: 'The replay contains an unknown event type.' };
    }
  }

  const abilityEvents = source.events.filter(event => event.type === 'ability').map(({ id, dx, dy, tick, randomDraws: draws }) => ({ id, dx, dy, tick, randomDraws: draws }));
  if (source.abilities.length !== abilityEvents.length || !equalJson(source.abilities, abilityEvents) ||
    source.abilities.some(ability => ability.id !== 'dash' || !Number.isFinite(ability.dx) || !Number.isFinite(ability.dy) ||
      Math.abs(Math.hypot(ability.dx, ability.dy) - 1) > 0.001 || !Number.isInteger(ability.tick) || ability.tick < 0)) {
    return { ok: false, reason: 'The replay record has malformed ability data.' };
  }

  let previousModifierWave = 0;
  for (const modifier of source.waveModifiers) {
    if (!modifier || !Number.isInteger(modifier.wave) || modifier.wave <= previousModifierWave ||
      !Number.isFinite(modifier.elapsed) || !Number.isInteger(modifier.tick) || modifier.tick < 0 ||
      modifier.id !== getWaveModifier(source.scenarioSeed, modifier.wave)) {
      return { ok: false, reason: 'The replay record has malformed wave modifier data.' };
    }
    previousModifierWave = modifier.wave;
  }

  if (source.limitSeconds !== null && (!Number.isInteger(source.limitSeconds) || source.limitSeconds <= 0 || source.limitSeconds > 3600)) {
    return { ok: false, reason: 'The replay time limit is malformed.' };
  }

  replaySource = source;
  replayCursor = 0;
  activeSeed = source.seed;
  activeLimitSeconds = source.limitSeconds;
  return { ok: true, seed: source.seed, eventCount: source.events.length };
}

export function stopPlaytestReplay() {
  replaySource = null;
  replayCursor = 0;
  activeSeed = configuredSeed;
  activeLimitSeconds = playtestConfig.limitSeconds;
}
