import assert from 'node:assert/strict';
import test from 'node:test';
import { createBuildState, getBuildChoices, getBuildProfile, BUILD_PATHS, BUILD_SPECIALIZATIONS, BUILD_EVOLUTIONS, canUnlockEvolution, applyEvolution } from '../src/builds.js';

function player(level = 1) {
  return { level, build: createBuildState(), damage: 1, fireRate: 0.38, projectiles: 1, pierce: 1, upgrades: {}, superWeapons: {} };
}
function selectPath(p, path) { return BUILD_PATHS.find(choice => choice.path === path).apply(p); }

test('level gates expose three exclusive paths and two matching specializations', () => {
  const p = player(3);
  assert.deepEqual(getBuildChoices(p), []);
  assert.equal(selectPath(p, 'arc'), false);
  p.level = 4;
  assert.equal(getBuildChoices(p).length, 3);
  assert.equal(selectPath(p, 'arc'), true);
  assert.equal(selectPath(p, 'scatter'), false);
  assert.deepEqual(getBuildChoices(p), []);
  p.level = 8;
  assert.deepEqual(getBuildChoices(p).map(choice => choice.id), ['fork', 'conductor']);
  assert.equal(BUILD_SPECIALIZATIONS.find(choice => choice.id === 'choke').apply(p), false);
  assert.equal(getBuildChoices(p)[0].apply(p), true);
  assert.deepEqual(getBuildChoices(p), []);
  assert.equal(BUILD_SPECIALIZATIONS.find(choice => choice.id === 'conductor').apply(p), false);
  assert.deepEqual(createBuildState(), { path: null, specialization: null, burstTimer: 0 });
});

test('each evolution requires its path and prerequisites and cannot stack or repeat', () => {
  for (const path of BUILD_PATHS) {
    const p = player(8);
    path.apply(p);
    assert.ok(BUILD_EVOLUTIONS.every(evolution => !canUnlockEvolution(p, evolution)));
    Object.assign(p.upgrades, { multiShot: 3, pierce: 3, damage: 3, rapidFire: 3, agility: 2, crit: 2 });
    assert.deepEqual(BUILD_EVOLUTIONS.filter(evo => canUnlockEvolution(p, evo)).map(evo => evo.path), [path.path]);
    for (const evolution of BUILD_EVOLUTIONS) {
      assert.equal(applyEvolution(p, evolution), evolution.path === path.path);
      assert.equal(applyEvolution(p, evolution), false);
    }
    assert.equal(Object.values(p.superWeapons).filter(Boolean).length, 1);
  }
});

test('arc offers additional targets or reach with explicit costs, including after evolution', () => {
  const p = player(8); selectPath(p, 'arc');
  const base = getBuildProfile(p);
  assert.equal(base.damage, 0.85);
  assert.equal(base.chainTargets, 1);
  p.build.specialization = 'fork';
  const fork = getBuildProfile(p);
  assert.equal(fork.chainTargets, 3);
  assert.ok(fork.chainDamage < base.chainDamage);
  p.superWeapons.tesla = true;
  assert.equal(getBuildProfile(p).chainTargets, 5);
  p.build.specialization = 'conductor';
  const conductor = getBuildProfile(p);
  assert.equal(conductor.chainRange, 160);
  assert.ok(conductor.fireRate > base.fireRate);
});

test('scatter trades projectile damage and range for volleys and displacement', () => {
  const p = player(8); selectPath(p, 'scatter');
  const base = getBuildProfile(p);
  assert.equal(base.projectiles, 3);
  assert.equal(base.damage, 0.65);
  assert.equal(Math.round(base.life * 460), 253);
  assert.equal(base.knockback, 16);
  p.build.specialization = 'choke';
  const choke = getBuildProfile(p);
  assert.equal(choke.projectiles, 2);
  assert.ok(choke.spread < base.spread);
  assert.equal(choke.life * 460, 391);
  p.build.specialization = 'concussion';
  const concussion = getBuildProfile(p);
  assert.ok(concussion.knockback > base.knockback);
  assert.ok(concussion.damage < base.damage);
  p.superWeapons.plasmaFlak = true;
  assert.equal(getBuildProfile(p).projectiles, 5);
});

test('mobility burst ends cleanly and both specializations preserve cooldown tradeoffs', () => {
  const p = player(8); selectPath(p, 'mobility');
  const base = getBuildProfile(p);
  assert.equal(base.dashCooldown, 5);
  assert.equal(base.burstDuration, 2);
  p.build.specialization = 'ambush'; p.build.burstTimer = 1;
  const ambush = getBuildProfile(p);
  assert.equal(ambush.dashCooldown, 6);
  assert.ok(ambush.damage > base.damage);
  assert.ok(ambush.fireRate < base.fireRate);
  p.build.burstTimer = 0;
  assert.equal(getBuildProfile(p).damage, base.damage);
  assert.equal(getBuildProfile(p).fireRate, base.fireRate);
  p.build.specialization = 'slipstream';
  assert.equal(getBuildProfile(p).dashCooldown, 4);
  assert.equal(getBuildProfile(p).burstDuration, 1.2);
  p.superWeapons.phaseDrive = true; p.build.burstTimer = 1;
  assert.equal(getBuildProfile(p).burstDuration, 2.2);
  assert.equal(getBuildProfile(p).pierce, 3);
  assert.equal(getBuildProfile(p).chainTargets, 0);
});

test('profile derivation never compounds upgrades or mutates the player', () => {
  for (const path of BUILD_PATHS) {
    const p = player(8); path.apply(p);
    const snapshot = structuredClone(p);
    const first = getBuildProfile(p);
    for (let i = 0; i < 100; i++) assert.deepEqual(getBuildProfile(p), first);
    assert.deepEqual(p, snapshot);
  }
});
