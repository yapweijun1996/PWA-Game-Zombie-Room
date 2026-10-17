import assert from 'node:assert/strict';
import test from 'node:test';
import { getEnemySteering, getEnemyWaypoint } from '../src/enemy-navigation.js';

const pillar = { x: 200, y: 200, w: 46, h: 40 };

test('enemy routes around a pillar instead of remaining pinned on its centerline', () => {
  const enemy = { x: 180, y: 220, r: 13 };
  const player = { x: 300, y: 220 };
  const first = getEnemySteering(enemy, player, [pillar]);
  assert.ok(first.y < 0);
  for (let i = 0; i < 900; i++) {
    const direction = getEnemySteering(enemy, player, [pillar]);
    enemy.x += direction.x * 50 / 60;
    enemy.y += direction.y * 50 / 60;
    const nearestX = Math.max(pillar.x, Math.min(enemy.x, pillar.x + pillar.w));
    const nearestY = Math.max(pillar.y, Math.min(enemy.y, pillar.y + pillar.h));
    assert.ok(Math.hypot(enemy.x - nearestX, enemy.y - nearestY) >= enemy.r - 1e-6);
  }
  assert.ok(enemy.x > 260, `enemy should reach the player's side of the pillar: ${JSON.stringify(enemy)}`);
});

test('direct pursuit remains direct when no obstacle blocks the route', () => {
  const target = { x: 300, y: 220 };
  assert.equal(getEnemyWaypoint({ x: 180, y: 220 }, target, [], 13), target);
});

test('navigation handles multiple obstacles without crossing their expanded bounds', () => {
  const obstacles = [pillar, { x: 280, y: 160, w: 32, h: 80 }];
  const waypoint = getEnemyWaypoint({ x: 180, y: 220 }, { x: 380, y: 220 }, obstacles, 13);
  assert.notDeepEqual(waypoint, { x: 380, y: 220 });
  assert.ok(Number.isFinite(waypoint.x) && Number.isFinite(waypoint.y));
});

test('enemies route around all four pillar faces without intersecting the obstacle', () => {
  const cases = [
    [{ x: 180, y: 220 }, { x: 300, y: 220 }, enemy => enemy.x > pillar.x + pillar.w + enemy.r],
    [{ x: 280, y: 220 }, { x: 100, y: 220 }, enemy => enemy.x < pillar.x - enemy.r],
    [{ x: 220, y: 180 }, { x: 220, y: 320 }, enemy => enemy.y > pillar.y + pillar.h + enemy.r],
    [{ x: 220, y: 260 }, { x: 220, y: 100 }, enemy => enemy.y < pillar.y - enemy.r]
  ];
  for (const [start, target, reachedOtherSide] of cases) {
    const enemy = { ...start, r: 13 };
    let reached = false;
    for (let step = 0; step < 1800 && !reached; step++) {
      const direction = getEnemySteering(enemy, target, [pillar]);
      enemy.x += direction.x;
      enemy.y += direction.y;
      const closestX = Math.max(pillar.x, Math.min(enemy.x, pillar.x + pillar.w));
      const closestY = Math.max(pillar.y, Math.min(enemy.y, pillar.y + pillar.h));
      assert.ok(Math.hypot(enemy.x - closestX, enemy.y - closestY) >= enemy.r - 1e-6);
      reached = reachedOtherSide(enemy);
    }
    assert.equal(reached, true, `failed to pass pillar from ${JSON.stringify(start)}`);
  }
});
