export function createTelegraphedCharge(cooldown = 0) {
  return {
    state: 'idle',
    timer: 0,
    cooldown: Math.max(0, cooldown),
    directionX: 0,
    directionY: 0,
    windupMultiplier: 1,
    dashDuration: 0,
    dashMultiplier: 1
  };
}

export function updateTelegraphedCharge(charge, dt, targetDx, targetDy, config) {
  charge.cooldown = Math.max(0, charge.cooldown - dt);
  let mode = charge.state;
  let started = false;
  let finishedDash = false;

  if (charge.state === 'windup') {
    charge.timer = Math.max(0, charge.timer - dt);
    if (charge.timer === 0) {
      charge.state = 'dash';
      charge.timer = charge.dashDuration;
      mode = 'dash';
    }
  } else if (charge.state === 'dash') {
    mode = 'dash';
    charge.timer = Math.max(0, charge.timer - dt);
    if (charge.timer === 0) {
      charge.state = 'idle';
      finishedDash = true;
    }
  }

  const distance = Math.hypot(targetDx, targetDy);
  if (charge.state === 'idle' && !finishedDash && config.canStart !== false && charge.cooldown === 0 && distance > config.minDistance) {
    charge.directionX = targetDx / distance;
    charge.directionY = targetDy / distance;
    charge.state = 'windup';
    charge.timer = config.windupSeconds;
    charge.windupMultiplier = config.windupMultiplier;
    charge.dashDuration = config.dashSeconds;
    charge.dashMultiplier = config.dashMultiplier;
    mode = 'windup';
    started = true;
  }

  const movementMultiplier = mode === 'windup'
    ? charge.windupMultiplier
    : mode === 'dash'
      ? charge.dashMultiplier
      : 1;

  return {
    state: charge.state,
    mode,
    started,
    directionX: charge.directionX,
    directionY: charge.directionY,
    movementMultiplier
  };
}
