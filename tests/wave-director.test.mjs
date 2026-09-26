import assert from 'node:assert/strict';
import test from 'node:test';
import { getWaveModifier, isModifierWave, selectEliteAffix, WAVE_MODIFIER_IDS } from '../src/wave-director.js';

test('wave modifiers avoid boss and blackout event waves', () => {
  assert.equal(isModifierWave(1), false);
  assert.equal(isModifierWave(2), true);
  assert.equal(isModifierWave(3), false);
  assert.equal(isModifierWave(4), false);
  assert.equal(isModifierWave(5), true);
  assert.equal(isModifierWave(6), true);
  assert.equal(isModifierWave(7), false);
  assert.equal(isModifierWave(2.5), false);
});

test('modifier selection is stable for a seed and independent of gameplay random draws', () => {
  const expected = getWaveModifier(987, 5);
  for (let drawCount = 0; drawCount < 20; drawCount++) {
    Math.random();
    assert.equal(getWaveModifier(987, 5), expected);
  }
  assert.ok(WAVE_MODIFIER_IDS.includes(expected));
  assert.equal(getWaveModifier(987, 4), null);
  assert.equal(new Set(Array.from({ length: 32 }, (_, seed) => getWaveModifier(seed, 5))).size, 3);
});

test('the active wave modifier favors its elite affix without changing the affix roll count', () => {
  for (const modifier of WAVE_MODIFIER_IDS) {
    assert.equal(selectEliteAffix(modifier, 0.59), modifier);
  }
  assert.equal(selectEliteAffix('swift', 0.6), 'frost');
  assert.equal(selectEliteAffix('swift', 0.8), 'armored');
  assert.deepEqual([0, 0.34, 0.67].map(roll => selectEliteAffix(null, roll)), ['frost', 'swift', 'armored']);
});

const {
  DIRECTOR_CONFIG, getWavePlan, createDirectorState, advanceDirector,
  recordDirectorDamage, startDirectorRecovery, getSpawnInterval, selectEnemyType, capEnemySpeed
} = await import('../src/wave-director.js');
const context = (elapsed, overrides = {}) => ({ elapsed, maxHp: 100, nearbyEnemies: 0, hasBoss: false, blackoutActive: false, ...overrides });

test('1000 waves keep growing, use complete shuffled bags, and never repeat adjacent encounters', () => {
  for (const seed of [0, 42, 987, 0xffffffff]) {
    let lastHealth = 0, lastBossHealth = 0, lastEncounter = null;
    const encounters = [];
    for (let wave = 1; wave <= 1000; wave++) {
      const plan = getWavePlan(seed, wave);
      assert.ok(plan.healthScale > lastHealth);
      assert.ok(plan.bossHealthScale > lastBossHealth);
      assert.ok(plan.eliteChance <= 0.4);
      assert.ok(plan.spitterLimit <= 4);
      assert.equal(plan.stage, Math.ceil(wave / 4));
      if (plan.encounterId) {
        assert.notEqual(plan.encounterId, lastEncounter);
        assert.ok(plan.phase < 2 && wave >= 5);
        encounters.push(plan.encounterId);
        lastEncounter = plan.encounterId;
      }
      lastHealth = plan.healthScale;
      lastBossHealth = plan.bossHealthScale;
    }
    for (let i = 0; i + 3 <= encounters.length; i += 3) assert.equal(new Set(encounters.slice(i, i + 3)).size, 3);
  }
});

test('reduced rates lengthen intervals and both enemy speed modes remain bounded', () => {
  assert.equal(getSpawnInterval(0, 1, 0.25), getSpawnInterval(0, 1, 1) * 4);
  assert.equal(capEnemySpeed(9999), 160);
  assert.equal(capEnemySpeed(9999, true), 360);
  assert.equal(capEnemySpeed(65), 65);
  assert.equal(DIRECTOR_CONFIG.maxEnemies, 90);
});

test('boss and blackout schedules have one owner with no delayed catch-up', () => {
  const director = createDirectorState(42);
  assert.equal(advanceDirector(director, context(57.99)).event, null);
  assert.equal(advanceDirector(director, context(58)).event, 'blackout');
  assert.equal(advanceDirector(director, context(58.1)).event, null);
  assert.equal(advanceDirector(director, context(75)).event, 'boss');
  assert.equal(advanceDirector(director, context(175, { hasBoss: true })).event, null);
  assert.equal(advanceDirector(director, context(176)).event, null);
  assert.equal(advanceDirector(director, context(258, { hasBoss: true })).event, null);
  assert.equal(advanceDirector(director, context(259)).event, null);
  assert.equal(advanceDirector(director, context(275)).event, 'boss');
});

test('recovery delays events within the wave, skips an unfittable blackout and only allows walkers', () => {
  const director = createDirectorState(42);
  startDirectorRecovery(director, 56);
  const recovery = advanceDirector(director, context(58));
  assert.equal(recovery.event, null);
  assert.equal(recovery.spawnRate, 0.25);
  assert.equal(recovery.walkersOnly, true);
  assert.equal(recovery.allowSpitter, false);
  assert.equal(advanceDirector(director, context(62)).event, 'blackout');
  const late = createDirectorState(42);
  startDirectorRecovery(late, 60);
  assert.equal(advanceDirector(late, context(63)).event, null);
  assert.equal(advanceDirector(late, context(64)).events[0].type, 'event-skipped');
  assert.equal(advanceDirector(late, context(66)).event, null);
  startDirectorRecovery(late, 74);
  assert.equal(advanceDirector(late, context(75)).event, null);
  assert.equal(advanceDirector(late, context(80)).event, 'boss');
});

test('shield plus HP loss and crowding trigger bounded relief across wave boundaries', () => {
  const director = createDirectorState(1);
  recordDirectorDamage(director, 22, 11);
  recordDirectorDamage(director, 24, 9);
  assert.equal(advanceDirector(director, context(24)).pausedSpawns, true);
  const next = advanceDirector(director, context(25));
  assert.equal(next.plan.wave, 2);
  assert.equal(next.pausedSpawns, true);
  assert.equal(advanceDirector(director, context(27, { nearbyEnemies: 20 })).pausedSpawns, false);
  assert.equal(advanceDirector(director, context(48.9, { nearbyEnemies: 20 })).pausedSpawns, false);
  assert.equal(advanceDirector(director, context(49, { nearbyEnemies: 8 })).pausedSpawns, true);
  assert.equal(advanceDirector(director, context(52)).pausedSpawns, false);
  assert.equal(director.recentDamage.length, 0);
});

test('damage older than five seconds cannot trigger relief and recovery does not stack it', () => {
  const director = createDirectorState(1);
  recordDirectorDamage(director, 0, 100);
  assert.equal(advanceDirector(director, context(5.01)).pausedSpawns, false);
  advanceDirector(director, context(10, { nearbyEnemies: 8 }));
  startDirectorRecovery(director, 11);
  const recovery = advanceDirector(director, context(12, { nearbyEnemies: 8 }));
  assert.equal(recovery.pausedSpawns, false);
  assert.equal(director.reliefUntil, 0);
  assert.equal(director.recoveryUntil, 17);
  assert.equal(advanceDirector(director, context(17, { nearbyEnemies: 8 })).pausedSpawns, false);
});

test('spitter quotas fall back immediately and special phases cannot add spitters', () => {
  const director = createDirectorState(42);
  const normal = advanceDirector(director, context(100));
  assert.equal(normal.allowSpitter, true);
  assert.equal(selectEnemyType(normal.plan, 0.99, { allowSpitter: true }), 'spitter');
  assert.equal(selectEnemyType(normal.plan, 0.99, { allowSpitter: true, spitterCount: 2 }), 'walker');
  assert.equal(selectEnemyType(normal.plan, 0.99), 'walker');
  assert.equal(selectEnemyType(normal.plan, 0.5, { walkersOnly: true }), 'walker');
  assert.equal(advanceDirector(director, context(150)).allowSpitter, false);
  assert.equal(advanceDirector(director, context(175)).allowSpitter, false);
  assert.equal(advanceDirector(director, context(200, { hasBoss: true })).allowSpitter, false);
});
