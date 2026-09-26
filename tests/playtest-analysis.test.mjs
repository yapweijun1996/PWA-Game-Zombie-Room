import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizePlaytestRuns } from '../src/playtest-analysis.js';

const records = [
  {
    status: 'finished',
    outcome: 'player-death',
    deathCause: 'swift',
    final: { wave: 3, upgrades: { rapidFire: 2 }, evolutions: {} },
    checkpoints: [
      { wave: 1, player: { hp: 80, maxHp: 100 }, upgrades: { rapidFire: 1 }, evolutions: {} },
      { wave: 3, player: { hp: 40, maxHp: 100 }, upgrades: { rapidFire: 2 }, evolutions: {} }
    ],
    damageEvents: [{ wave: 3, source: 'swift', damage: 12 }],
    waveModifiers: [{ wave: 2, id: 'frost' }]
  },
  {
    status: 'finished',
    mode: 'replay',
    outcome: 'player-death',
    deathCause: 'replayed',
    final: { wave: 99, upgrades: {}, evolutions: {} },
    checkpoints: [],
    damageEvents: [],
    waveModifiers: []
  },
  {
    status: 'finished',
    outcome: 'time-cap',
    final: { wave: 6, upgrades: { damage: 1 }, evolutions: { tesla: true } },
    checkpoints: [
      { wave: 2, player: { hp: 100, maxHp: 100 }, upgrades: { damage: 1 }, evolutions: {} },
      { wave: 6, player: { hp: 75, maxHp: 100 }, upgrades: { damage: 1 }, evolutions: { tesla: true } }
    ],
    damageEvents: [{ wave: 6, source: 'hazard', damage: 7 }],
    waveModifiers: [{ wave: 5, id: 'swift' }]
  },
  { status: 'running', checkpoints: [] }
];

test('run summaries compare phases, builds, damage sources, outcomes, and modifiers', () => {
  const summary = summarizePlaytestRuns(records);
  assert.equal(summary.completedRuns, 2);
  assert.equal(summary.phases.early.runs, 2);
  assert.equal(summary.phases.early.checkpointSamples, 2);
  assert.equal(summary.phases.early.averageHealthRatio, 0.9);
  assert.equal(summary.phases.mid.damageBySource.swift.damage, 12);
  assert.equal(summary.phases.late.damageBySource.hazard.hits, 1);
  assert.equal(summary.phases.mid.deathsByCause.swift, 1);
  assert.deepEqual(summary.phases.late.deathsByCause, {});
  assert.deepEqual(summary.waveModifiers, {
    frost: { appearances: 1, runs: 1 },
    swift: { appearances: 1, runs: 1 }
  });
  assert.ok(summary.finalOutcomes.some(result => result.phase === 'mid' && result.build === 'rapidFire:2' && result.deathCause === 'swift'));
  assert.ok(summary.finalOutcomes.some(result => result.phase === 'late' && result.build === 'damage:1,evo:tesla' && result.outcome === 'time-cap'));
});

test('empty and malformed inputs return an empty, serializable report', () => {
  assert.equal(summarizePlaytestRuns(null).completedRuns, 0);
  assert.doesNotThrow(() => JSON.stringify(summarizePlaytestRuns([{ status: 'finished', checkpoints: [null], damageEvents: [null] }])));
});

test('director summaries report pacing and ranged actions without counting replays', () => {
  const sample = { status: 'finished', final: { wave: 13, director: { stage: 4 } }, directorEvents: [{ type: 'relief' }, { type: 'recovery' }, { type: 'spit' }, { type: 'spit' }] };
  const summary = summarizePlaytestRuns([sample, { ...sample, mode: 'replay' }]);
  assert.deepEqual(summary.director, { reliefs: 1, recoveries: 1, shots: 2, highestStage: 4 });
  assert.doesNotThrow(() => summarizePlaytestRuns([{ status: 'finished', directorEvents: 'invalid' }]));
});

test('build summaries keep paths and specializations distinct despite identical upgrades', () => {
  const records = ['fork', 'conductor'].map(specialization => ({
    status: 'finished', outcome: 'time-cap',
    final: { wave: 8, upgrades: { damage: 5 }, build: { path: 'arc', specialization, burstTimer: 0 } },
    checkpoints: [], damageEvents: []
  }));
  const builds = summarizePlaytestRuns(records).finalOutcomes.map(outcome => outcome.build);
  assert.equal(builds.length, 2);
  assert.ok(builds.includes('build:arc,build:fork,damage:5'));
  assert.ok(builds.includes('build:arc,build:conductor,damage:5'));
});
