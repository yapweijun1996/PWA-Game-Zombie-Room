import { game, room, ui, dom, input, timers, perf, scoreState, viewport } from './state.js';
import { clamp, dist2, rand, formatTime } from './utils.js';
import { burst, sprayBlood, makeDecal, particleBudget } from './effects.js';
import { flashMessage, updateUI } from './ui.js';
import { t } from './i18n.js';

export function makePlayer() {
  return {
    x: viewport.W / 2,
    y: Math.max(room.y + 60, room.y + room.h / 2),
    r: 13,
    hp: 100,
    maxHp: 100,
    speed: 180,
    level: 1,
    xp: 0,
    xpNeed: 5,
    damage: 1,
    fireRate: 0.38,
    shootTimer: 0,
    bulletSpeed: 460,
    invuln: 0,
    aimAngle: -Math.PI / 2,
    moveAngle: -Math.PI / 2,
    moving: false,
    walkTime: 0,
    muzzleFlash: 0,
    recoil: 0
  };
}

export function isDesktopControls() {
  return innerWidth >= 800 && matchMedia('(pointer: fine)').matches;
}

export function setPaused(paused) {
  if (!game.running && paused) return;
  game.paused = paused;
  if (dom.pauseOverlay) {
    dom.pauseOverlay.hidden = !paused;
    dom.pauseOverlay.classList.toggle('show', paused);
  }
  if (dom.canvas) {
    if (paused) {
      dom.canvas.classList.add('game-dimmed');
    } else if (game.running) {
      dom.canvas.classList.remove('game-dimmed');
    }
  }
  if (dom.pauseButton) {
    dom.pauseButton.classList.toggle('active', paused);
    const pauseIcon = dom.pauseButton.querySelector('.pause-icon');
    const playIcon = dom.pauseButton.querySelector('.play-icon');
    if (pauseIcon && playIcon) {
      if (paused) {
        pauseIcon.setAttribute('hidden', '');
        playIcon.removeAttribute('hidden');
      } else {
        playIcon.setAttribute('hidden', '');
        pauseIcon.removeAttribute('hidden');
      }
    }
  }
  if (!paused) {
    perf.last = performance.now();
  }
}

export function togglePause() {
  if (!game.running) return;
  setPaused(!game.paused);
}

export function resetGame() {
  setPaused(false);
  game.running = true;
  game.elapsed = 0;
  game.score = 0;
  game.kills = 0;
  game.wave = 1;
  game.spawnTimer = 0.3;
  game.bullets.length = 0;
  game.zombies.length = 0;
  game.orbs.length = 0;
  game.particles.length = 0;
  game.decals.length = 0;
  game.player = makePlayer();
  game.bossWave = 0;
  game.roomPhase = Math.random() * Math.PI * 2;
  game.cameraShake = 0;
  perf.lowFpsWindows = 0;
  perf.recoveredFpsWindows = 0;
  perf.perfWarmupUntil = performance.now() + 2200;
  ui.gameover.classList.remove('show');
  if (ui.gameoverNewBest) ui.gameoverNewBest.hidden = true;
  dom.canvas.classList.remove('game-blurred', 'game-dimmed');
  dom.hintPill.classList.remove('hide');
  setTimeout(() => dom.hintPill.classList.add('hide'), 4200);
  updateUI();
}

function spawnZombie() {
  if (game.zombies.length > 90) return;
  const p = game.player;
  const wave = game.wave;
  const roll = Math.random();
  let type = 'walker';
  if (wave >= 5 && roll < Math.min(.18, wave * .018)) type = 'tank';
  else if (wave >= 3 && roll < .34) type = 'runner';

  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = rand(room.x, room.x + room.w); y = room.y - 18; }
  if (side === 1) { x = room.x + room.w + 18; y = rand(room.y, room.y + room.h); }
  if (side === 2) { x = rand(room.x, room.x + room.w); y = room.y + room.h + 18; }
  if (side === 3) { x = room.x - 18; y = rand(room.y, room.y + room.h); }

  const scale = 1 + (wave - 1) * .08;
  const z = { x, y, type, hitFlash: 0, attackFlash: 0, walkTime: Math.random() * Math.PI * 2, facing: 0 };
  if (type === 'runner') Object.assign(z, { r: 10, hp: 1.2 * scale, maxHp: 1.2 * scale, speed: 82 + wave * 2.2, damage: 8, color: '#e5a84d', score: 14, xp: 1 });
  else if (type === 'tank') Object.assign(z, { r: 18, hp: 5.5 * scale, maxHp: 5.5 * scale, speed: 32 + wave * 1.2, damage: 17, color: '#7d9c75', score: 35, xp: 3 });
  else Object.assign(z, { r: 13, hp: 2.1 * scale, maxHp: 2.1 * scale, speed: 48 + wave * 1.7, damage: 11, color: '#79b86a', score: 10, xp: 1 });

  const dx = z.x - p.x, dy = z.y - p.y;
  if (dx * dx + dy * dy > 900) game.zombies.push(z);
}

function shootNearest() {
  const p = game.player;
  if (!game.zombies.length) return;
  let target = null;
  let bestD = Infinity;
  for (const z of game.zombies) {
    const d = dist2(p, z);
    if (d < bestD) { bestD = d; target = z; }
  }
  if (!target) return;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  p.aimAngle = Math.atan2(dy, dx);
  p.muzzleFlash = .075;
  p.recoil = 1;
  game.bullets.push({
    x: p.x,
    y: p.y,
    vx: dx / len * p.bulletSpeed,
    vy: dy / len * p.bulletSpeed,
    r: 3.5,
    damage: p.damage,
    life: 1.35
  });
  burst(p.x + dx / len * 15, p.y + dy / len * 15, '#d8f3df', 2, 55);
}

function deathBurst(z) {
  const isBoss = z.type === 'boss';
  burst(z.x, z.y, isBoss ? '#ffd07d' : z.color, isBoss ? 28 : z.type === 'tank' ? 16 : 9, isBoss ? 170 : 110);
  sprayBlood(z.x, z.y, isBoss ? 2.6 : z.type === 'tank' ? 1.5 : 1, isBoss ? '#b93a48' : '#9f3440');
  makeDecal(z.x + rand(-8, 8), z.y + rand(-8, 8), isBoss ? rand(20, 34) : rand(9, 18));
}

export function hasActiveBoss() {
  return game.zombies.some(z => z.type === 'boss');
}

function spawnBoss() {
  if (hasActiveBoss()) return;
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = rand(room.x + 40, room.x + room.w - 40); y = room.y - 44; }
  if (side === 1) { x = room.x + room.w + 44; y = rand(room.y + 40, room.y + room.h - 40); }
  if (side === 2) { x = rand(room.x + 40, room.x + room.w - 40); y = room.y + room.h + 44; }
  if (side === 3) { x = room.x - 44; y = rand(room.y + 40, room.y + room.h - 40); }
  const scale = 1 + (game.wave - 1) * .14;
  const z = {
    x, y, type: 'boss', hitFlash: 0, attackFlash: 0, walkTime: 0, facing: 0, pulse: 0, entrance: 1.2,
    r: 26,
    hp: 20 * scale,
    maxHp: 20 * scale,
    speed: 28 + game.wave * 1.4,
    damage: 24,
    color: '#c75b68',
    score: 140,
    xp: 8,
    dashCd: 2.6,
    lunge: 0,
    armor: .86
  };
  game.zombies.push(z);
  game.bossWave = game.wave;
  flashMessage(t('msgBossIncoming'));
  burst(x, y, '#ffd27a', 24, 150);
}

function gainXp(amount) {
  const p = game.player;
  p.xp += amount;
  while (p.xp >= p.xpNeed) {
    p.xp -= p.xpNeed;
    p.level++;
    p.xpNeed = Math.ceil(5 + p.level * 2.35);
    applyAutoUpgrade(p.level);
  }
}

function applyAutoUpgrade(level) {
  const p = game.player;
  const kind = (level - 2) % 4;
  let text = '';
  if (kind === 0) { p.damage *= 1.22; text = t('msgUpgradeDamage', { level }); }
  if (kind === 1) { p.fireRate = Math.max(.13, p.fireRate * .88); text = t('msgUpgradeFireRate', { level }); }
  if (kind === 2) { p.maxHp += 12; p.hp = Math.min(p.maxHp, p.hp + 24); text = t('msgUpgradeHp', { level }); }
  if (kind === 3) { p.speed = Math.min(280, p.speed * 1.06); text = t('msgUpgradeSpeed', { level }); }
  flashMessage(text);
  burst(p.x, p.y, '#79f29a', 18, 130);
}

function killZombie(index) {
  const z = game.zombies[index];
  game.score += z.score;
  game.kills++;
  deathBurst(z);
  if (z.type === 'boss') {
    game.cameraShake = Math.max(game.cameraShake, .45);
    flashMessage(t('msgBossDown'));
  }
  for (let i = 0; i < z.xp; i++) {
    game.orbs.push({ x: z.x + rand(-8, 8), y: z.y + rand(-8, 8), r: z.type === 'boss' ? 6 : 5, value: 1, pulse: Math.random() * Math.PI * 2 });
  }
  game.zombies.splice(index, 1);
}

function damagePlayer(amount, from) {
  const p = game.player;
  if (p.invuln > 0 || !game.running) return;
  p.hp -= amount;
  p.invuln = .58;
  timers.damageTimer = .16;
  ui.damageFlash.classList.add('show');
  burst(p.x, p.y, '#ff6576', 10, 120);
  sprayBlood(p.x, p.y, .7, '#d95b67');

  const dx = p.x - from.x;
  const dy = p.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  p.x = clamp(p.x + dx / len * 16, room.x + p.r, room.x + room.w - p.r);
  p.y = clamp(p.y + dy / len * 16, room.y + p.r, room.y + room.h - p.r);

  if (p.hp <= 0) endGame();
}

function endGame() {
  const p = game.player;
  p.hp = 0;
  game.running = false;
  setPaused(false);
  const currentScore = Math.floor(game.score);
  const isNewBest = currentScore > scoreState.best && scoreState.best > 0;
  scoreState.best = Math.max(scoreState.best, currentScore);
  localStorage.setItem('zombie-room-best', String(scoreState.best));
  ui.gameoverScore.textContent = currentScore;
  if (ui.gameoverWave) ui.gameoverWave.textContent = game.wave;
  ui.gameoverKills.textContent = game.kills;
  ui.gameoverTime.textContent = formatTime(game.elapsed);
  if (ui.gameoverNewBest) ui.gameoverNewBest.hidden = !isNewBest;
  dom.canvas.classList.add(game.performanceMode ? 'game-dimmed' : 'game-blurred');
  ui.gameover.classList.add('show');
  ui.gameover.focus();
  updateUI();
}

export function update(dt) {
  if (timers.messageTimer > 0) {
    timers.messageTimer -= dt;
    if (timers.messageTimer <= 0) ui.message.classList.remove('show');
  }
  if (timers.damageTimer > 0) {
    timers.damageTimer -= dt;
    if (timers.damageTimer <= 0) ui.damageFlash.classList.remove('show');
  }

  for (const p of game.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(p.drag ?? .02, dt);
    p.vy *= Math.pow(p.drag ?? .02, dt);
    p.vy += (p.gravity ?? 0) * dt;
    p.life -= dt;
  }
  game.particles = game.particles.filter(p => p.life > 0);
  game.cameraShake = Math.max(0, game.cameraShake - dt * 1.7);
  game.roomPhase += dt * .8;

  if (!game.running || game.paused) return;

  game.elapsed += dt;
  const p = game.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.shootTimer -= dt;
  p.muzzleFlash = Math.max(0, p.muzzleFlash - dt);
  p.recoil = Math.max(0, p.recoil - dt * 9);

  const nextWave = 1 + Math.floor(game.elapsed / 25);
  if (nextWave !== game.wave) {
    game.wave = nextWave;
    flashMessage(t('msgWave', { wave: game.wave }));
  }
  if (game.wave >= 4 && game.wave % 4 === 0 && game.bossWave !== game.wave && !hasActiveBoss()) {
    spawnBoss();
  }

  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  let speedMultiplier = 1;
  if (input.active) {
    mx = input.vx;
    my = input.vy;
    const rawLen = Math.hypot(mx, my);
    speedMultiplier = Math.min(1, Math.max(0.25, rawLen));
  }
  const len = Math.hypot(mx, my);
  p.moving = len > 0.06;
  if (p.moving) {
    const normX = mx / len;
    const normY = my / len;
    p.moveAngle = Math.atan2(normY, normX);
    p.walkTime += dt * 11 * speedMultiplier;
    p.x += normX * p.speed * speedMultiplier * dt;
    p.y += normY * p.speed * speedMultiplier * dt;
  } else {
    p.walkTime += dt * 3;
  }
  if (!game.zombies.length && p.moving) p.aimAngle = p.moveAngle;
  p.x = clamp(p.x, room.x + p.r, room.x + room.w - p.r);
  p.y = clamp(p.y, room.y + p.r, room.y + room.h - p.r);

  game.spawnTimer -= dt;
  const spawnEvery = Math.max(.22, .82 - game.elapsed * .0038 - game.wave * .018);
  if (game.spawnTimer <= 0) {
    if (!hasActiveBoss() || Math.random() < .42) spawnZombie();
    if (game.wave >= 6 && !hasActiveBoss() && Math.random() < .17) spawnZombie();
    game.spawnTimer = spawnEvery * rand(.72, 1.18);
  }

  if (p.shootTimer <= 0) {
    shootNearest();
    p.shootTimer = p.fireRate;
  }

  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let hit = false;
    for (let j = game.zombies.length - 1; j >= 0; j--) {
      const z = game.zombies[j];
      const rr = b.r + z.r;
      if ((b.x - z.x) ** 2 + (b.y - z.y) ** 2 <= rr * rr) {
        const dealt = z.type === 'boss' ? b.damage * (z.armor || .86) : b.damage;
        z.hp -= dealt;
        z.hitFlash = .08;
        burst(b.x, b.y, '#eaf7ed', 3, 45);
        sprayBlood(b.x, b.y, z.type === 'boss' ? 1.1 : .45, z.type === 'boss' ? '#e06c78' : '#ba4956');
        hit = true;
        if (z.type === 'boss') game.cameraShake = Math.max(game.cameraShake, .08);
        if (z.hp <= 0) killZombie(j);
        break;
      }
    }
    if (hit || b.life <= 0 || b.x < room.x - 35 || b.x > room.x + room.w + 35 || b.y < room.y - 35 || b.y > room.y + room.h + 35) {
      game.bullets.splice(i, 1);
    }
  }

  for (const z of game.zombies) {
    z.hitFlash = Math.max(0, z.hitFlash - dt);
    z.attackFlash = Math.max(0, z.attackFlash - dt);
    z.walkTime += dt * (z.type === 'runner' ? 15 : z.type === 'tank' ? 7 : z.type === 'boss' ? 6 : 10);
    if (z.type === 'boss') {
      z.pulse += dt * 3.2;
      z.entrance = Math.max(0, z.entrance - dt);
      z.dashCd -= dt;
      z.lunge = Math.max(0, z.lunge - dt);
    }
    const dx = p.x - z.x;
    const dy = p.y - z.y;
    const len = Math.hypot(dx, dy) || 1;
    z.facing = Math.atan2(dy, dx);
    let moveScale = 1;
    if (z.type === 'boss') {
      moveScale = z.entrance > 0 ? .35 : 1;
      if (z.dashCd <= 0 && len > 100) {
        z.attackFlash = .32;
        z.lunge = .22;
        z.dashCd = rand(2.6, 4.2);
        game.cameraShake = Math.max(game.cameraShake, .18);
      }
      if (z.lunge > 0) moveScale = 2.15;
    }
    z.x += dx / len * z.speed * moveScale * dt;
    z.y += dy / len * z.speed * moveScale * dt;

    const rr = p.r + z.r - (z.type === 'boss' ? 6 : 2);
    if (dx * dx + dy * dy <= rr * rr) {
      if (p.invuln <= 0) z.attackFlash = z.type === 'boss' ? .24 : .18;
      damagePlayer(z.damage, z);
    }
  }

  for (let i = game.orbs.length - 1; i >= 0; i--) {
    const o = game.orbs[i];
    o.pulse += dt * 5;
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 125) {
      const speed = 115 + (125 - d) * 2.2;
      o.x += dx / d * speed * dt;
      o.y += dy / d * speed * dt;
    }
    if (d < p.r + o.r + 5) {
      gainXp(o.value);
      game.score += 2;
      game.orbs.splice(i, 1);
    }
  }

  game.score += dt * (1 + game.wave * .12);
  updateUI();
}
