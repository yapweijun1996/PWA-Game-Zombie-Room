import assert from 'node:assert/strict';
import test from 'node:test';
import { createSeededRandom } from '../src/playtest.js';
import { shuffle } from '../src/utils.js';

test('seeded random streams repeat and remain in the unit interval', () => {
  const generate = seed => {
    const random = createSeededRandom(seed);
    return Array.from({ length: 64 }, random);
  };

  const first = generate(123456);
  assert.deepEqual(first, generate(123456));
  assert.notDeepEqual(first, generate(123457));
  assert.deepEqual(generate(0), generate(0));
  assert.ok(first.every(value => value >= 0 && value < 1));
});

test('upgrade shuffles use the supplied seeded random source', () => {
  const upgrades = ['damage', 'rapidFire', 'multiShot', 'vitality', 'pierce'];
  const shuffleWithSeed = seed => shuffle([...upgrades], createSeededRandom(seed));

  assert.deepEqual(shuffleWithSeed(42), shuffleWithSeed(42));
  assert.deepEqual([...shuffleWithSeed(42)].sort(), [...upgrades].sort());
});
