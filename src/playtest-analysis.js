const RUN_PHASES = Object.freeze([
  { id: 'early', maxWave: 2 },
  { id: 'mid', maxWave: 5 },
  { id: 'late', maxWave: Infinity }
]);

function phaseForWave(wave) {
  if (!Number.isFinite(wave) || wave < 1) return null;
  return RUN_PHASES.find(phase => wave <= phase.maxWave)?.id || null;
}

function buildSignature(snapshot) {
  const upgrades = Object.entries(snapshot?.upgrades || {})
    .filter(([, level]) => Number(level) > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, level]) => `${id}:${level}`);
  const evolutions = Object.entries(snapshot?.evolutions || {})
    .filter(([, active]) => Boolean(active))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id]) => `evo:${id}`);
  return [...upgrades, ...evolutions].join(',') || 'base';
}

function round(value, places = 3) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function createPhaseStats() {
  return {
    runIds: new Set(),
    sampleCount: 0,
    healthSamples: 0,
    healthRatioTotal: 0,
    damageBySource: new Map(),
    builds: new Map(),
    deathsByCause: new Map()
  };
}

function addCount(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function averageHealthRatio(snapshot) {
  const player = snapshot?.player;
  if (!Number.isFinite(player?.hp) || !Number.isFinite(player?.maxHp) || player.maxHp <= 0) return null;
  return Math.max(0, Math.min(1, player.hp / player.maxHp));
}

export function summarizePlaytestRuns(records) {
  const completedRuns = Array.isArray(records)
    ? records.filter(run => run && run.status === 'finished' && run.mode !== 'replay')
    : [];
  const phases = new Map(RUN_PHASES.map(phase => [phase.id, createPhaseStats()]));
  const finalOutcomes = new Map();
  const waveModifiers = new Map();

  completedRuns.forEach((run, index) => {
    const runId = `${index}:${run.startedAt || run.seed || 'run'}`;
    for (const checkpoint of Array.isArray(run.checkpoints) ? run.checkpoints : []) {
      if (!checkpoint || typeof checkpoint !== 'object') continue;
      const phaseId = phaseForWave(checkpoint.wave);
      const phase = phases.get(phaseId);
      if (!phase) continue;

      phase.runIds.add(runId);
      phase.sampleCount++;
      const healthRatio = averageHealthRatio(checkpoint);
      if (healthRatio !== null) {
        phase.healthRatioTotal += healthRatio;
        phase.healthSamples++;
      }

      const signature = buildSignature(checkpoint);
      if (!phase.builds.has(signature)) {
        phase.builds.set(signature, { runIds: new Set(), sampleCount: 0, healthRatioTotal: 0, healthSamples: 0 });
      }
      const build = phase.builds.get(signature);
      build.runIds.add(runId);
      build.sampleCount++;
      if (healthRatio !== null) {
        build.healthRatioTotal += healthRatio;
        build.healthSamples++;
      }
    }

    for (const event of Array.isArray(run.damageEvents) ? run.damageEvents : []) {
      if (!event || typeof event !== 'object') continue;
      const phase = phases.get(phaseForWave(event.wave));
      if (!phase) continue;
      const source = event.source || 'unknown';
      if (!phase.damageBySource.has(source)) phase.damageBySource.set(source, { hits: 0, damage: 0 });
      const sourceStats = phase.damageBySource.get(source);
      sourceStats.hits++;
      sourceStats.damage += Number.isFinite(event.damage) ? event.damage : 0;
    }

    const finalSnapshot = run.final || {};
    const finalWave = Number.isFinite(finalSnapshot.wave) ? finalSnapshot.wave : 1;
    const finalPhase = phaseForWave(finalWave) || 'early';
    const finalBuild = buildSignature(finalSnapshot);
    const deathCause = run.outcome === 'player-death' ? (run.deathCause || 'unknown') : null;
    const outcome = run.outcome || 'unknown';
    const outcomeKey = JSON.stringify([finalPhase, finalBuild, outcome, deathCause]);
    if (!finalOutcomes.has(outcomeKey)) {
      finalOutcomes.set(outcomeKey, {
        phase: finalPhase,
        build: finalBuild,
        outcome,
        deathCause,
        runs: 0,
        highestWaveTotal: 0
      });
    }
    const outcomeStats = finalOutcomes.get(outcomeKey);
    outcomeStats.runs++;
    outcomeStats.highestWaveTotal += finalWave;
    if (deathCause) addCount(phases.get(finalPhase).deathsByCause, deathCause);

    for (const modifier of Array.isArray(run.waveModifiers) ? run.waveModifiers : []) {
      if (!modifier?.id) continue;
      if (!waveModifiers.has(modifier.id)) waveModifiers.set(modifier.id, { appearances: 0, runIds: new Set() });
      const modifierStats = waveModifiers.get(modifier.id);
      modifierStats.appearances++;
      modifierStats.runIds.add(runId);
    }
  });

  return {
    completedRuns: completedRuns.length,
    phaseDefinitions: RUN_PHASES.map(({ id, maxWave }) => ({ id, maxWave: Number.isFinite(maxWave) ? maxWave : null })),
    phases: Object.fromEntries([...phases].map(([id, stats]) => [id, {
      runs: stats.runIds.size,
      checkpointSamples: stats.sampleCount,
      averageHealthRatio: stats.healthSamples ? round(stats.healthRatioTotal / stats.healthSamples) : null,
      damageBySource: Object.fromEntries([...stats.damageBySource]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([source, values]) => [source, { hits: values.hits, damage: round(values.damage) }])),
      builds: [...stats.builds]
        .sort(([, left], [, right]) => right.sampleCount - left.sampleCount)
        .map(([build, values]) => ({
          build,
          runs: values.runIds.size,
          checkpointSamples: values.sampleCount,
          averageHealthRatio: values.healthSamples ? round(values.healthRatioTotal / values.healthSamples) : null
        })),
      deathsByCause: Object.fromEntries([...stats.deathsByCause].sort(([left], [right]) => left.localeCompare(right)))
    }])),
    finalOutcomes: [...finalOutcomes.values()]
      .sort((left, right) => left.phase.localeCompare(right.phase) || left.build.localeCompare(right.build) ||
        (left.deathCause || '').localeCompare(right.deathCause || ''))
      .map(({ highestWaveTotal, ...outcome }) => ({
        ...outcome,
        averageHighestWave: round(highestWaveTotal / outcome.runs, 2)
      })),
    waveModifiers: Object.fromEntries([...waveModifiers]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, stats]) => [id, { appearances: stats.appearances, runs: stats.runIds.size }]))
  };
}
