import assert from 'node:assert/strict';
import test from 'node:test';
import { getWaveModifier, isModifierWave, selectEliteAffix, WAVE_MODIFIER_IDS } from '../src/wave-director.js';

test('wave modifiers avoid boss and blackout event waves', () => {
  assert.equal(isModifierWave(1), false);
  assert.equal(isModifierWave(2), true);
  assert.equal(isModifierWave(3), false);
  assert.equal(isModifierWave(4), false);
  assert.equal(isModifierWave(5), true);
  assert.equal(isModifierWave(6), false);
  assert.equal(isModifierWave(7), true);
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
