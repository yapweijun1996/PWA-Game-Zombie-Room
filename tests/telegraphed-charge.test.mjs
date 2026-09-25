import assert from 'node:assert/strict';
import test from 'node:test';
import { createTelegraphedCharge, updateTelegraphedCharge } from '../src/telegraphed-charge.js';

const chargeConfig = {
  minDistance: 100,
  windupSeconds: 0.6,
  dashSeconds: 0.24,
  windupMultiplier: 0.2,
  dashMultiplier: 2.5
};

test('a charge locks its direction during a visible windup before dashing', () => {
  const charge = createTelegraphedCharge();
  const warning = updateTelegraphedCharge(charge, 1 / 60, 200, 0, chargeConfig);
  assert.equal(warning.started, true);
  assert.equal(warning.state, 'windup');
  assert.equal(warning.movementMultiplier, 0.2);
  assert.equal(warning.directionX, 1);
  assert.equal(warning.directionY, 0);

  const stillWarning = updateTelegraphedCharge(charge, 0.2, 0, 220, chargeConfig);
  assert.equal(stillWarning.state, 'windup');
  assert.equal(stillWarning.directionX, 1);
  assert.equal(stillWarning.directionY, 0);

  const launch = updateTelegraphedCharge(charge, 0.4, 0, 220, chargeConfig);
  assert.equal(launch.mode, 'dash');
  assert.equal(launch.state, 'dash');
  assert.equal(launch.movementMultiplier, 2.5);
  assert.equal(launch.directionX, 1);
});

test('charge cooldown prevents overlapping attacks and resets after launch', () => {
  const charge = createTelegraphedCharge();
  const first = updateTelegraphedCharge(charge, 0.01, 0, 180, chargeConfig);
  assert.equal(first.started, true);
  charge.cooldown = 2;

  updateTelegraphedCharge(charge, 0.61, 0, 180, chargeConfig);
  const dash = updateTelegraphedCharge(charge, 0.1, 0, 180, chargeConfig);
  assert.equal(dash.state, 'dash');
  assert.equal(dash.started, false);
  assert.ok(charge.cooldown > 1);
});
