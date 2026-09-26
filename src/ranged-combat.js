export const SPITTER_CONFIG = Object.freeze({
  hp: 3, speed: 65, radius: 12, contactDamage: 8, score: 20, xp: 2,
  minRange: 120, maxRange: 220, windup: 0.8, cooldown: 3.2, globalCooldown: 1.2,
  projectileSpeed: 170, projectileRadius: 5, projectileDamage: 8, projectileLife: 2, maxProjectiles: 12
});

export function createSpitAttack() {
  return { state: 'idle', timer: 0, cooldown: 0, directionX: 0, directionY: 0 };
}

function segmentBoxTime(x, y, dx, dy, box, radius = 0) {
  let enter = 0, leave = 1;
  for (const [position, delta, min, max] of [
    [x, dx, box.x - radius, box.x + box.w + radius],
    [y, dy, box.y - radius, box.y + box.h + radius]
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (position < min || position > max) return Infinity;
    } else {
      const a = (min - position) / delta, b = (max - position) / delta;
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
      if (enter > leave) return Infinity;
    }
  }
  return enter;
}

function segmentCircleTime(x, y, dx, dy, circle, radius) {
  const ox = x - circle.x, oy = y - circle.y;
  const c = ox * ox + oy * oy - (circle.r + radius) ** 2;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return Infinity;
  const b = 2 * (ox * dx + oy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return Infinity;
  const time = (-b - Math.sqrt(discriminant)) / (2 * a);
  return time >= 0 && time <= 1 ? time : Infinity;
}

export function isInsideRoom(entity, room) {
  return entity.x - entity.r >= room.x && entity.x + entity.r <= room.x + room.w &&
    entity.y - entity.r >= room.y && entity.y + entity.r <= room.y + room.h;
}

export function hasClearShot(from, target, room) {
  return !(room.obstacles || []).some(box => Number.isFinite(segmentBoxTime(from.x, from.y, target.x - from.x, target.y - from.y, box, SPITTER_CONFIG.projectileRadius)));
}

export function advanceSpitter(zombie, dt, player, room, canStart) {
  const attack = zombie.spit;
  attack.cooldown = Math.max(0, attack.cooldown - dt);
  const dx = player.x - zombie.x, dy = player.y - zombie.y;
  const distance = Math.hypot(dx, dy) || 1;
  const result = { moveX: 0, moveY: 0, started: false, fire: false };
  if (attack.state === 'windup') {
    attack.timer = Math.max(0, attack.timer - dt);
    if (attack.timer <= 1e-9) {
      attack.state = 'idle';
      attack.cooldown = SPITTER_CONFIG.cooldown;
      result.fire = true;
    }
    return result;
  }
  const inside = isInsideRoom(zombie, room);
  const clear = hasClearShot(zombie, player, room);
  if (!inside || distance > SPITTER_CONFIG.maxRange || (!clear && distance >= SPITTER_CONFIG.minRange)) {
    result.moveX = dx / distance;
    result.moveY = dy / distance;
  } else if (distance < SPITTER_CONFIG.minRange) {
    result.moveX = -dx / distance;
    result.moveY = -dy / distance;
  } else if (canStart && attack.cooldown === 0 && clear) {
    attack.state = 'windup';
    attack.timer = SPITTER_CONFIG.windup;
    attack.directionX = dx / distance;
    attack.directionY = dy / distance;
    result.started = true;
  }
  return result;
}

export function createEnemyProjectile(zombie) {
  const attack = zombie.spit;
  const muzzle = zombie.r + SPITTER_CONFIG.projectileRadius;
  return {
    x: zombie.x + attack.directionX * muzzle, y: zombie.y + attack.directionY * muzzle,
    vx: attack.directionX * SPITTER_CONFIG.projectileSpeed, vy: attack.directionY * SPITTER_CONFIG.projectileSpeed,
    r: SPITTER_CONFIG.projectileRadius, damage: SPITTER_CONFIG.projectileDamage,
    life: SPITTER_CONFIG.projectileLife, type: 'spitter-projectile'
  };
}

function projectileBlockTime(projectile, dx, dy, room) {
  let blockedAt = Infinity;
  for (const box of room.obstacles || []) {
    blockedAt = Math.min(blockedAt, segmentBoxTime(projectile.x, projectile.y, dx, dy, box, projectile.r));
  }
  for (const [position, delta, min, max] of [
    [projectile.x, dx, room.x + projectile.r, room.x + room.w - projectile.r],
    [projectile.y, dy, room.y + projectile.r, room.y + room.h - projectile.r]
  ]) {
    const exit = delta > 0 ? (max - position) / delta : delta < 0 ? (min - position) / delta : Infinity;
    if (exit >= 0 && exit <= 1) blockedAt = Math.min(blockedAt, exit);
  }
  return blockedAt;
}

export function getSpitEndpoint(zombie, room) {
  const shot = createEnemyProjectile(zombie);
  const dx = shot.vx * shot.life, dy = shot.vy * shot.life;
  const time = Math.min(1, projectileBlockTime(shot, dx, dy, room));
  return { x: shot.x + dx * time, y: shot.y + dy * time };
}

export function advanceEnemyProjectile(projectile, dt, player, room) {
  if (!isInsideRoom(projectile, room)) return 'blocked';
  const step = Math.min(dt, projectile.life);
  const dx = projectile.vx * step, dy = projectile.vy * step;
  const blockedAt = projectileBlockTime(projectile, dx, dy, room);
  const playerAt = segmentCircleTime(projectile.x, projectile.y, dx, dy, player, projectile.r);
  const hitTime = Math.min(1, blockedAt, playerAt);
  projectile.x += dx * hitTime;
  projectile.y += dy * hitTime;
  projectile.life = Math.max(0, projectile.life - dt);
  if (Number.isFinite(blockedAt) && blockedAt <= playerAt) return 'blocked';
  if (Number.isFinite(playerAt)) return 'player';
  return projectile.life <= 0 ? 'expired' : null;
}
