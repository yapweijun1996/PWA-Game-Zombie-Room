const MODIFIER_IDS = Object.freeze(['swift', 'armored', 'frost']);
const ELITE_AFFIXES = Object.freeze(['frost', 'swift', 'armored']);

export function isModifierWave(wave) {
  return Number.isInteger(wave) && wave >= 2 && wave % 3 !== 0 && wave % 4 !== 0;
}

function hashSeedWave(seed, wave) {
  let value = ((seed >>> 0) ^ Math.imul(wave, 0x9e3779b9)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function getWaveModifier(seed, wave) {
  if (!isModifierWave(wave)) return null;
  return MODIFIER_IDS[hashSeedWave(seed, wave) % MODIFIER_IDS.length];
}

export function selectEliteAffix(modifierId, roll) {
  const value = Math.min(0.999999999, Math.max(0, Number.isFinite(roll) ? roll : 0));
  const preferredAffix = modifierId === 'swift'
    ? 'swift'
    : modifierId === 'armored'
      ? 'armored'
      : modifierId === 'frost'
        ? 'frost'
        : null;

  if (!preferredAffix) return ELITE_AFFIXES[Math.floor(value * ELITE_AFFIXES.length)];
  if (value < 0.6) return preferredAffix;

  const alternatives = ELITE_AFFIXES.filter(affix => affix !== preferredAffix);
  return alternatives[Math.floor(((value - 0.6) / 0.4) * alternatives.length)];
}

export { MODIFIER_IDS as WAVE_MODIFIER_IDS };
