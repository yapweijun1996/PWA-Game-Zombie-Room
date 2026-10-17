import assert from 'node:assert/strict';
import test from 'node:test';
import { createSpitAttack, advanceSpitter, createEnemyProjectile, advanceEnemyProjectile, tracePlayerBulletStep, SPITTER_CONFIG } from '../src/ranged-combat.js';

const room = { x: 0, y: 0, w: 600, h: 500, obstacles: [] };
const player = { x: 300, y: 250, r: 13 };
const spitter = () => ({ x: 150, y: 250, r: 12, spit: createSpitAttack() });

test('spitter locks direction for the full windup and observes post-shot cooldown', () => {
  const z = spitter();
  assert.equal(advanceSpitter(z, 1 / 60, player, room, true).started, true);
  assert.equal(advanceSpitter(z, 0.79, { ...player, y: 400 }, room, true).fire, false);
  assert.equal(z.spit.directionY, 0);
  assert.equal(advanceSpitter(z, 0.01, { ...player, y: 400 }, room, true).fire, true);
  const shot = createEnemyProjectile(z);
  assert.equal(shot.vx, 170);
  assert.equal(shot.vy, 0);
  assert.equal(z.spit.cooldown, 3.2);
  assert.equal(advanceSpitter(z, 3, player, room, true).started, false);
  assert.equal(advanceSpitter(z, 0.21, player, room, true).started, true);
});

test('offscreen, obstructed and globally throttled enemies cannot start an attack', () => {
  const z = spitter();
  assert.equal(advanceSpitter(z, 0.1, player, room, false).started, false);
  const blocked = { ...room, obstacles: [{ x: 200, y: 230, w: 30, h: 40 }] };
  assert.equal(advanceSpitter(z, 0.1, player, blocked, true).started, false);
  z.x = 5;
  assert.equal(advanceSpitter(z, 0.1, { ...player, x: 160 }, room, true).started, false);
});

test('spitter approaches, holds range and retreats without tracking a windup target', () => {
  const z = spitter();
  assert.ok(advanceSpitter(z, 0.1, { ...player, x: 500 }, room, false).moveX > 0);
  assert.equal(advanceSpitter(z, 0.1, player, room, false).moveX, 0);
  assert.ok(advanceSpitter(z, 0.1, { ...player, x: 200 }, room, false).moveX < 0);
});

function projectile(overrides = {}) {
  return { x: 100, y: 250, vx: 170, vy: 0, r: 5, life: 2, ...overrides };
}

test('swept collision catches a player even when a frame crosses their entire diameter', () => {
  const shot = projectile();
  assert.equal(advanceEnemyProjectile(shot, 2, player, room), 'player');
  assert.equal(shot.x, 282);
});

test('cover intercepts a shot before the player and boundaries consume it', () => {
  const blocked = { ...room, obstacles: [{ x: 180, y: 240, w: 10, h: 20 }] };
  const shot = projectile();
  assert.equal(advanceEnemyProjectile(shot, 2, player, blocked), 'blocked');
  assert.equal(shot.x, 175);
  assert.equal(advanceEnemyProjectile(projectile({ x: 590 }), 0.1, player, room), 'blocked');
  assert.equal(advanceEnemyProjectile(projectile({ x: -1 }), 0.1, player, room), 'blocked');
});

test('shots expire after two seconds and consume on contact even during invulnerability', () => {
  const shot = projectile({ y: 100 });
  assert.equal(advanceEnemyProjectile(shot, 2.5, player, room), 'expired');
  assert.equal(shot.x, 440);
  assert.equal(advanceEnemyProjectile(projectile(), 2, { ...player, invuln: 1 }, room), 'player');
  assert.equal(SPITTER_CONFIG.maxProjectiles, 12);
});

test('telegraph endpoint agrees with the actual projectile cover and boundary collision', async () => {
  const { getSpitEndpoint } = await import('../src/ranged-combat.js');
  const z = spitter();
  z.spit.directionX = 1;
  const blocked = { ...room, obstacles: [{ x: 240, y: 230, w: 20, h: 40 }] };
  const end = getSpitEndpoint(z, blocked);
  const shot = createEnemyProjectile(z);
  advanceEnemyProjectile(shot, 2, { x: -1000, y: -1000, r: 13 }, blocked);
  assert.deepEqual(end, { x: shot.x, y: shot.y });
  assert.equal(end.x, 235);
  assert.equal(getSpitEndpoint(z, { ...room, w: 300 }).x, 295);
});

test('player bullets hit targets in travel order and cover blocks targets behind it', () => {
  const blockedRoom = { ...room, obstacles: [{ x: 40, y: 30, w: 20, h: 40 }] };
  const bullet = { x: 0, y: 50, vx: 100, vy: 0, r: 2, hitTargets: new Set() };
  const near = { x: 20, y: 50, r: 4 };
  const behindCover = { x: 80, y: 50, r: 4 };

  const traced = tracePlayerBulletStep(bullet, 1, [behindCover, near], blockedRoom);
  assert.equal(traced.hits.length, 1);
  assert.equal(traced.hits[0].target, near);
  assert.ok(traced.hits[0].time < traced.blockedAt);
  assert.equal(traced.blocked, true);
});

test('piercing player bullet trace returns multiple visible targets in distance order', () => {
  const bullet = { x: 0, y: 50, vx: 100, vy: 0, r: 2, hitTargets: new Set() };
  const first = { x: 20, y: 50, r: 4 };
  const second = { x: 70, y: 50, r: 4 };
  const traced = tracePlayerBulletStep(bullet, 1, [second, first], room);
  assert.deepEqual(traced.hits.map(hit => hit.target), [first, second]);
});

test('player bullet radius catches a swept cover corner before a target', () => {
  const blockedRoom = { ...room, obstacles: [{ x: 180, y: 210, w: 46, h: 40 }] };
  const bullet = { x: 176, y: 211, vx: 460, vy: -100, r: 3.5, hitTargets: new Set() };
  const behindCorner = { x: 205, y: 205, r: 13 };
  const traced = tracePlayerBulletStep(bullet, 0.034, [behindCorner], blockedRoom);
  assert.equal(traced.blocked, true);
  assert.equal(traced.hits.length, 0);
  assert.ok(traced.blockedX < blockedRoom.obstacles[0].x + blockedRoom.obstacles[0].w);
});
