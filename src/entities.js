import { game, room, ui, dom, input, timers, perf, scoreState, viewport } from './state.js';
import { clamp, dist2, rand, formatTime, shuffle } from './utils.js';
import { burst, sprayBlood, makeDecal, particleBudget, spawnDamageText, spawnGore } from './effects.js';
import { flashMessage, updateUI } from './ui.js';
import { t } from './i18n.js';
import { playShoot, playCrit, playKill, playXp, playLevelUp, playUpgradeSelect, playPlayerHit, playGameOver, playUiClick, playNuke, playOverdrive, playHeal, playMagnet, playShieldHit, playShieldBreak, playShieldRecharge, playBossRoar, playElectricZap, playComboMilestone, playBlackoutAlarm, playPowerRestored } from './audio.js';
import { vibrateHit, vibrateCrit, vibrateLevelUp, vibrateBoss, vibrateDeath, vibrateUi, vibrateNuke, vibrateOverdrive, vibrateCombo } from './haptics.js';

export function makePlayer() {
  return {
    x: viewport.W / 2,
    y: Math.max(room.y + 60, room.y + room.h / 2),
    r: 13,
    hp: 100,
    maxHp: 100,
    shield: 40,
    maxShield: 40,
    shieldCooldown: 0,
    shieldHitFlash: 0,
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
    recoil: 0,
    projectiles: 1,
    pierce: 1,
    critChance: 0,
    magnetRadius: 125,
    overdriveTimer: 0,
    stepTimer: 0,
    superWeapons: {
      tesla: false,
      plasmaFlak: false
    },
    upgrades: {
      multiShot: 1,
      rapidFire: 0,
      damage: 0,
      pierce: 0,
      vitality: 0,
      agility: 0,
      magnet: 0,
      crit: 0
    }
  };
}

export function isDesktopControls() {
  return innerWidth >= 800 && matchMedia('(pointer: fine)').matches;
}

export function setPaused(paused, userInitiated = false) {
  if (!game.running && paused) return;
  game.paused = paused;
  if (userInitiated) {
    playUiClick();
    vibrateUi();
  }
  if (dom.pauseOverlay) {
    dom.pauseOverlay.hidden = !paused;
    dom.pauseOverlay.classList.toggle('show', paused);
  }
  if (dom.canvas) {
    if (paused) {
      dom.canvas.classList.add('game-dimmed');
    } else if (game.running && !game.upgradeModalOpen) {
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
  if (!game.running || game.upgradeModalOpen) return;
  setPaused(!game.paused, true);
}

export function resetGame() {
  setPaused(false, false);
  closeUpgradeModal();
  game.pendingUpgrades = 0;
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
  game.floatingTexts.length = 0;
  game.pickups.length = 0;
  game.combo = 0;
  game.comboTimer = 0;
  game.maxCombo = 0;
  game.blackoutTimer = 0;
  game.blackoutTriggeredWave = 0;
  game.player = makePlayer();
  game.bossWave = 0;
  game.roomPhase = Math.random() * Math.PI * 2;
  game.cameraShake = 0;
  perf.lowFpsWindows = 0;
  perf.recoveredFpsWindows = 0;
  perf.perfWarmupUntil = performance.now() + 2200;
  ui.gameover.classList.remove('show');
  if (ui.gameoverNewBest) ui.gameoverNewBest.hidden = true;
  if (ui.bossBar) {
    ui.bossBar.classList.remove('show');
    ui.bossBar.hidden = true;
  }
  dom.canvas.classList.remove('game-blurred', 'game-dimmed');
  if (room.hazards && room.hazards.length) {
    room.hazards[0].state = 'dormant';
    room.hazards[0].timer = 0;
    if (room.hazards[1]) {
      room.hazards[1].state = 'dormant';
      room.hazards[1].timer = 3.8;
    }
  }
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
  const z = { x, y, type, hitFlash: 0, attackFlash: 0, walkTime: Math.random() * Math.PI * 2, facing: 0, affix: null };
  if (type === 'runner') Object.assign(z, { r: 10, hp: 1.2 * scale, maxHp: 1.2 * scale, speed: 82 + wave * 2.2, damage: 8, color: '#e5a84d', score: 14, xp: 1 });
  else if (type === 'tank') Object.assign(z, { r: 18, hp: 5.5 * scale, maxHp: 5.5 * scale, speed: 32 + wave * 1.2, damage: 17, color: '#7d9c75', score: 35, xp: 3 });
  else Object.assign(z, { r: 13, hp: 2.1 * scale, maxHp: 2.1 * scale, speed: 48 + wave * 1.7, damage: 11, color: '#79b86a', score: 10, xp: 1 });

  if (wave >= 2 && Math.random() < Math.min(0.28, 0.12 + wave * 0.025)) {
    const affixes = ['frost', 'swift', 'armored'];
    z.affix = affixes[Math.floor(Math.random() * affixes.length)];
    if (z.affix === 'frost') {
      z.xp += 2;
      z.score = Math.round(z.score * 1.5);
    } else if (z.affix === 'swift') {
      z.speed *= 1.42;
      z.xp += 2;
      z.score = Math.round(z.score * 1.5);
    } else if (z.affix === 'armored') {
      z.maxHp *= 1.6;
      z.hp = z.maxHp;
      z.r = Math.round(z.r * 1.22);
      z.armor = 0.60;
      z.xp += 3;
      z.score = Math.round(z.score * 1.8);
    }
  }

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
  const baseAngle = Math.atan2(dy, dx);
  p.aimAngle = baseAngle;
  p.muzzleFlash = .075;
  p.recoil = 1;

  const projectileCount = p.superWeapons?.plasmaFlak ? Math.max(p.projectiles || 1, 5) : (p.projectiles || 1);
  const spreadAngle = p.superWeapons?.plasmaFlak ? 0.22 : 0.16;
  const startAngle = baseAngle - ((projectileCount - 1) * spreadAngle) / 2;

  for (let s = 0; s < projectileCount; s++) {
    const angle = startAngle + s * spreadAngle;
    const comboCritBonus = game.combo >= 50 ? 0.20 : (game.combo >= 25 ? 0.10 : 0);
    const effectiveCrit = Math.min(0.85, (p.critChance || 0) + comboCritBonus);
    const isCrit = effectiveCrit > 0 && Math.random() < effectiveCrit;
    const damage = isCrit ? p.damage * 2.2 : p.damage;

    game.bullets.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * p.bulletSpeed,
      vy: Math.sin(angle) * p.bulletSpeed,
      r: isCrit ? 4.8 : 3.5,
      damage,
      pierce: p.pierce || 1,
      isCrit,
      life: 1.35
    });
  }
  playShoot(projectileCount, p.damage >= 1.6);
  burst(p.x + Math.cos(baseAngle) * 15, p.y + Math.sin(baseAngle) * 15, '#d8f3df', 2, 55);
}

function deathBurst(z) {
  const isBoss = z.type === 'boss';
  burst(z.x, z.y, isBoss ? '#ffd07d' : z.color, isBoss ? 28 : z.type === 'tank' ? 16 : 9, isBoss ? 170 : 110);
  sprayBlood(z.x, z.y, isBoss ? 2.6 : z.type === 'tank' ? 1.5 : 1, isBoss ? '#b93a48' : '#9f3440');
  makeDecal(z.x + rand(-8, 8), z.y + rand(-8, 8), isBoss ? rand(20, 34) : rand(9, 18));
  spawnGore(z.x, z.y, z.type, isBoss ? 4 : (z.killedByCrit ? 3 : 2));
}

export function spawnPickup(x, y, source = 'normal') {
  if (game.pickups.length >= 8) return;
  let type = 'medkit';
  if (source === 'boss') {
    const bossTypes = ['nuke', 'overdrive', 'medkit'];
    type = bossTypes[Math.floor(Math.random() * bossTypes.length)];
  } else {
    const roll = Math.random();
    if (roll < 0.35) type = 'medkit';
    else if (roll < 0.65) type = 'magnet';
    else if (roll < 0.85) type = 'overdrive';
    else type = 'nuke';
  }
  game.pickups.push({
    x: clamp(x, room.x + 20, room.x + room.w - 20),
    y: clamp(y, room.y + 20, room.y + room.h - 20),
    type,
    life: 16,
    pulse: Math.random() * Math.PI * 2
  });
}

function collectPickup(item, index) {
  const p = game.player;
  game.pickups.splice(index, 1);

  if (item.type === 'nuke') {
    playNuke();
    vibrateNuke();
    flashMessage(t('msgNuke'));
    game.cameraShake = Math.max(game.cameraShake, 0.55);
    ui.damageFlash.style.background = 'radial-gradient(circle, rgba(255,255,255,.95) 0%, rgba(255,214,102,.6) 100%)';
    ui.damageFlash.classList.add('show');
    setTimeout(() => { ui.damageFlash.style.background = ''; }, 240);

    for (let i = game.zombies.length - 1; i >= 0; i--) {
      const z = game.zombies[i];
      if (z.type === 'boss') {
        z.hp -= 30;
        spawnDamageText(z.x, z.y - z.r, 30, true, false);
        if (z.hp <= 0) killZombie(i);
      } else {
        spawnDamageText(z.x, z.y - z.r, Math.round(z.hp), true, false);
        killZombie(i);
      }
    }
  } else if (item.type === 'overdrive') {
    playOverdrive();
    vibrateOverdrive();
    flashMessage(t('msgOverdrive'));
    p.overdriveTimer = 8;
    burst(p.x, p.y, '#69b6ff', 24, 130);
  } else if (item.type === 'medkit') {
    playHeal();
    flashMessage(t('msgMedkit'));
    p.hp = Math.min(p.maxHp, p.hp + 35);
    spawnDamageText(p.x, p.y - p.r - 8, '+35', false, false);
    burst(p.x, p.y, '#79f29a', 18, 90);
  } else if (item.type === 'magnet') {
    playMagnet();
    flashMessage(t('msgMagnet'));
    for (const o of game.orbs) {
      gainXp(o.value);
      game.score += 2;
    }
    game.orbs.length = 0;
    burst(p.x, p.y, '#d782ff', 22, 140);
  }
}

export function hasActiveBoss() {
  return game.zombies.some(z => z.type === 'boss');
}

export function getActiveBoss() {
  return game.zombies.find(z => z.type === 'boss') || null;
}

export function resolveObstacleCollision(entity) {
  if (!room.obstacles) return;
  const r = entity.r || 13;
  for (const obs of room.obstacles) {
    const closestX = clamp(entity.x, obs.x, obs.x + obs.w);
    const closestY = clamp(entity.y, obs.y, obs.y + obs.h);
    const dx = entity.x - closestX;
    const dy = entity.y - closestY;
    const distSq = dx * dx + dy * dy;
    if (distSq < r * r) {
      const dist = Math.sqrt(distSq) || 0.001;
      const overlap = r - dist;
      entity.x += (dx / dist) * overlap;
      entity.y += (dy / dist) * overlap;
    }
  }
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
    armor: .86,
    frenzy: false
  };
  game.zombies.push(z);
  game.bossWave = game.wave;
  flashMessage(t('msgBossIncoming'));
  vibrateBoss();
  game.cameraShake = Math.max(game.cameraShake, .45);
  burst(x, y, '#ffd27a', 24, 150);
}

export const UPGRADES = [
  {
    id: 'multiShot',
    icon: '🏹',
    titleKey: 'upgradeMultiShotTitle',
    descKey: 'upgradeMultiShotDesc',
    maxLevel: 3,
    level: p => p.upgrades.multiShot,
    apply: p => {
      p.projectiles = (p.projectiles || 1) + 1;
      p.upgrades.multiShot = p.projectiles;
    }
  },
  {
    id: 'rapidFire',
    icon: '⚡',
    titleKey: 'upgradeRapidFireTitle',
    descKey: 'upgradeRapidFireDesc',
    maxLevel: 5,
    level: p => p.upgrades.rapidFire,
    apply: p => {
      p.fireRate = Math.max(0.12, p.fireRate * 0.82);
      p.upgrades.rapidFire = (p.upgrades.rapidFire || 0) + 1;
    }
  },
  {
    id: 'damage',
    icon: '💥',
    titleKey: 'upgradeDamageTitle',
    descKey: 'upgradeDamageDesc',
    maxLevel: 5,
    level: p => p.upgrades.damage,
    apply: p => {
      p.damage *= 1.30;
      p.upgrades.damage = (p.upgrades.damage || 0) + 1;
    }
  },
  {
    id: 'pierce',
    icon: '🎯',
    titleKey: 'upgradePierceTitle',
    descKey: 'upgradePierceDesc',
    maxLevel: 3,
    level: p => p.upgrades.pierce,
    apply: p => {
      p.pierce = (p.pierce || 1) + 1;
      p.upgrades.pierce = p.pierce;
    }
  },
  {
    id: 'vitality',
    icon: '💖',
    titleKey: 'upgradeVitalityTitle',
    descKey: 'upgradeVitalityDesc',
    maxLevel: 5,
    level: p => p.upgrades.vitality,
    apply: p => {
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 40);
      p.upgrades.vitality = (p.upgrades.vitality || 0) + 1;
    }
  },
  {
    id: 'agility',
    icon: '👟',
    titleKey: 'upgradeAgilityTitle',
    descKey: 'upgradeAgilityDesc',
    maxLevel: 4,
    level: p => p.upgrades.agility,
    apply: p => {
      p.speed = Math.min(300, p.speed * 1.14);
      p.upgrades.agility = (p.upgrades.agility || 0) + 1;
    }
  },
  {
    id: 'magnet',
    icon: '🧲',
    titleKey: 'upgradeMagnetTitle',
    descKey: 'upgradeMagnetDesc',
    maxLevel: 3,
    level: p => p.upgrades.magnet,
    apply: p => {
      p.magnetRadius = (p.magnetRadius || 125) * 1.5;
      p.upgrades.magnet = (p.upgrades.magnet || 0) + 1;
    }
  },
  {
    id: 'crit',
    icon: '⚔️',
    titleKey: 'upgradeCritTitle',
    descKey: 'upgradeCritDesc',
    maxLevel: 3,
    level: p => p.upgrades.crit,
    apply: p => {
      p.critChance = Math.min(0.65, (p.critChance || 0) + 0.20);
      p.upgrades.crit = (p.upgrades.crit || 0) + 1;
    }
  }
];

export const EVOLUTIONS = [
  {
    id: 'tesla',
    icon: '⚡',
    titleKey: 'evoTeslaTitle',
    descKey: 'evoTeslaDesc',
    isEvolution: true,
    canUnlock: p => (p.upgrades.multiShot || 1) >= 3 && (p.upgrades.pierce || 1) >= 3 && !p.superWeapons?.tesla,
    apply: p => {
      p.superWeapons.tesla = true;
    }
  },
  {
    id: 'plasmaFlak',
    icon: '💥',
    titleKey: 'evoPlasmaTitle',
    descKey: 'evoPlasmaDesc',
    isEvolution: true,
    canUnlock: p => (p.upgrades.damage || 0) >= 3 && (p.upgrades.rapidFire || 0) >= 3 && !p.superWeapons?.plasmaFlak,
    apply: p => {
      p.superWeapons.plasmaFlak = true;
    }
  }
];

export let currentUpgradeChoices = [];

export function getAvailableUpgrades() {
  const p = game.player;
  if (!p) return [];

  const availableEvos = EVOLUTIONS.filter(e => e.canUnlock(p));
  const availableRegular = UPGRADES.filter(u => u.level(p) < u.maxLevel);

  if (availableEvos.length > 0) {
    const evo = availableEvos[0];
    const otherChoices = shuffle([...availableRegular]).slice(0, 2);
    return [evo, ...otherChoices];
  }

  const shuffled = shuffle([...availableRegular]);
  return shuffled.slice(0, 3);
}

export function openUpgradeModal() {
  const p = game.player;
  if (!p || !game.running) return;
  currentUpgradeChoices = getAvailableUpgrades();
  if (!currentUpgradeChoices.length) {
    p.hp = Math.min(p.maxHp, p.hp + 50);
    game.pendingUpgrades = Math.max(0, (game.pendingUpgrades || 1) - 1);
    flashMessage(t('msgLevelUp'));
    return;
  }

  game.upgradeModalOpen = true;
  playLevelUp();
  vibrateLevelUp();
  if (dom.canvas) dom.canvas.classList.add('game-dimmed');

  renderUpgradeCards(currentUpgradeChoices);

  if (dom.upgradeModal) {
    dom.upgradeModal.hidden = false;
    dom.upgradeModal.classList.add('show');
    dom.upgradeModal.focus();
  }
}

export function renderUpgradeCards(choices) {
  if (!dom.upgradeCards) return;
  dom.upgradeCards.innerHTML = '';
  const p = game.player;

  choices.forEach((choice, idx) => {
    const isEvo = choice.isEvolution;
    let lvlText = '';
    if (isEvo) {
      lvlText = t('evoBadge');
    } else {
      const curLvl = choice.level(p);
      lvlText = curLvl === 0 ? 'NEW' : `Lv.${curLvl + 1}`;
    }

    const btn = document.createElement('button');
    btn.className = 'upgrade-card' + (isEvo ? ' evolution' : '');
    btn.type = 'button';
    btn.setAttribute('data-index', String(idx));
    btn.innerHTML = `
      <div class="upgrade-card-icon" aria-hidden="true">${choice.icon}</div>
      <div class="upgrade-card-content">
        <div class="upgrade-card-header">
          <span class="upgrade-card-name">${t(choice.titleKey)}</span>
          <span class="upgrade-card-level${isEvo ? ' evo' : ''}">${lvlText}</span>
        </div>
        <div class="upgrade-card-desc">${t(choice.descKey)}</div>
      </div>
      <div class="upgrade-card-key" aria-hidden="true">${idx + 1}</div>
    `;
    btn.addEventListener('click', () => chooseUpgrade(idx));
    dom.upgradeCards.appendChild(btn);
  });
}

export function chooseUpgrade(index) {
  if (!game.upgradeModalOpen || !currentUpgradeChoices[index]) return;
  const chosen = currentUpgradeChoices[index];
  const p = game.player;
  chosen.apply(p);
  playUpgradeSelect();
  vibrateUi();

  if (chosen.isEvolution) {
    flashMessage('⚡ ' + t(chosen.titleKey) + ' · ' + t('evoBadge'));
    burst(p.x, p.y, '#ffd700', 30, 160);
    game.cameraShake = Math.max(game.cameraShake, .4);
  } else {
    flashMessage(t(chosen.titleKey) + ' · ' + t('msgLevelUp'));
    burst(p.x, p.y, '#ffd27a', 16, 110);
  }

  game.pendingUpgrades = Math.max(0, (game.pendingUpgrades || 1) - 1);

  if (game.pendingUpgrades > 0) {
    currentUpgradeChoices = getAvailableUpgrades();
    if (currentUpgradeChoices.length) {
      renderUpgradeCards(currentUpgradeChoices);
      return;
    }
    p.hp = Math.min(p.maxHp, p.hp + 50);
    game.pendingUpgrades = 0;
    flashMessage(t('msgLevelUp'));
  }

  closeUpgradeModal();
}

export function closeUpgradeModal() {
  game.upgradeModalOpen = false;
  if (dom.upgradeModal) {
    dom.upgradeModal.classList.remove('show');
    dom.upgradeModal.hidden = true;
  }
  if (dom.canvas && !game.paused && game.running) {
    dom.canvas.classList.remove('game-dimmed');
  }
  perf.last = performance.now();
  updateUI();
}

function gainXp(amount) {
  const p = game.player;
  p.xp += amount;
  let leveled = false;
  while (p.xp >= p.xpNeed) {
    p.xp -= p.xpNeed;
    p.level++;
    p.xpNeed = Math.ceil(5 + p.level * 2.35);
    game.pendingUpgrades = (game.pendingUpgrades || 0) + 1;
    leveled = true;
  }
  if (leveled && !game.upgradeModalOpen) {
    openUpgradeModal();
  }
}

function killZombie(index, isCrit = false) {
  const z = game.zombies[index];
  z.killedByCrit = isCrit;
  game.score += z.score;
  game.kills++;

  game.combo++;
  game.comboTimer = 2.4;
  game.maxCombo = Math.max(game.maxCombo || 0, game.combo);
  const p = game.player;

  if (game.combo === 10) {
    flashMessage(t('msgCombo10'));
    playComboMilestone(1);
    vibrateCombo();
    burst(p.x, p.y, '#ffd27a', 16, 100);
    game.cameraShake = Math.max(game.cameraShake, .15);
  } else if (game.combo === 25) {
    flashMessage(t('msgCombo25'));
    playComboMilestone(2);
    vibrateCombo();
    burst(p.x, p.y, '#ff6174', 24, 130);
    game.cameraShake = Math.max(game.cameraShake, .25);
  } else if (game.combo === 50) {
    flashMessage(t('msgCombo50'));
    playComboMilestone(3);
    vibrateCombo();
    burst(p.x, p.y, '#ffd700', 32, 160);
    game.cameraShake = Math.max(game.cameraShake, .38);
  }

  playKill(game.combo);
  deathBurst(z);
  if (z.type === 'boss') {
    game.cameraShake = Math.max(game.cameraShake, .45);
    flashMessage(t('msgBossDown'));
    spawnPickup(z.x, z.y, 'boss');
  } else {
    const dropChance = z.type === 'tank' ? 0.14 : (z.type === 'runner' ? 0.05 : 0.025);
    if (Math.random() < dropChance) {
      spawnPickup(z.x, z.y);
    }
  }
  for (let i = 0; i < z.xp; i++) {
    game.orbs.push({ x: z.x + rand(-8, 8), y: z.y + rand(-8, 8), r: z.type === 'boss' ? 6 : 5, value: 1, pulse: Math.random() * Math.PI * 2 });
  }
  game.zombies.splice(index, 1);
}

function damagePlayer(amount, from) {
  const p = game.player;
  if (p.invuln > 0 || !game.running) return;

  p.invuln = .58;
  timers.damageTimer = .16;
  p.shieldCooldown = 4.0;

  let hpDamage = amount;
  if (p.shield > 0) {
    p.shieldHitFlash = 0.16;
    if (p.shield >= amount) {
      p.shield -= amount;
      hpDamage = 0;
      playShieldHit();
      spawnDamageText(p.x + rand(-4, 4), p.y - p.r - 8, '-' + amount + ' 🛡️', false, true);
      burst(p.x, p.y, '#8ae0ff', 7, 70);
    } else {
      hpDamage = amount - p.shield;
      p.shield = 0;
      playShieldBreak();
      vibrateHit();
      spawnDamageText(p.x + rand(-4, 4), p.y - p.r - 8, amount, false, true);
      burst(p.x, p.y, '#69b6ff', 14, 110);
    }
  }

  if (hpDamage > 0) {
    p.hp -= hpDamage;
    ui.damageFlash.classList.add('show');
    playPlayerHit();
    vibrateHit();
    if (p.shield === 0 && hpDamage === amount) {
      spawnDamageText(p.x + rand(-4, 4), p.y - p.r - 8, hpDamage, false, true);
    }
    burst(p.x, p.y, '#ff6576', 10, 120);
    sprayBlood(p.x, p.y, .7, '#d95b67');
  }

  const dx = p.x - from.x;
  const dy = p.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  p.x = clamp(p.x + dx / len * 16, room.x + p.r, room.x + room.w - p.r);
  p.y = clamp(p.y + dy / len * 16, room.y + p.r, room.y + room.h - p.r);

  if (p.hp <= 0) endGame();
}

export function calculateRunRank(wave, score, kills, maxCombo) {
  const scoreRating = score + wave * 140 + kills * 8 + maxCombo * 12;
  if (scoreRating >= 2200 || wave >= 8) return 'S';
  if (scoreRating >= 1100 || wave >= 5) return 'A';
  if (scoreRating >= 450 || wave >= 3) return 'B';
  return 'C';
}

function renderBuildSummary(p) {
  if (!ui.gameoverBuildGrid) return;
  ui.gameoverBuildGrid.innerHTML = '';

  if (p.superWeapons?.tesla) {
    const evoChip = document.createElement('div');
    evoChip.className = 'build-chip evo';
    evoChip.innerHTML = `
      <span class="build-chip-icon" aria-hidden="true">⚡</span>
      <span class="build-chip-name">${t('evoTeslaTitle')}</span>
      <span class="build-chip-level evo">${t('evoBadge')}</span>
    `;
    ui.gameoverBuildGrid.appendChild(evoChip);
  }
  if (p.superWeapons?.plasmaFlak) {
    const evoChip = document.createElement('div');
    evoChip.className = 'build-chip evo';
    evoChip.innerHTML = `
      <span class="build-chip-icon" aria-hidden="true">💥</span>
      <span class="build-chip-name">${t('evoPlasmaTitle')}</span>
      <span class="build-chip-level evo">${t('evoBadge')}</span>
    `;
    ui.gameoverBuildGrid.appendChild(evoChip);
  }

  const activeUpgrades = UPGRADES.filter(u => u.level(p) > (u.id === 'multiShot' ? 1 : 0));
  if (!activeUpgrades.length) {
    const emptyChip = document.createElement('div');
    emptyChip.className = 'build-chip empty';
    emptyChip.textContent = 'Lv.1 Standard Issue';
    ui.gameoverBuildGrid.appendChild(emptyChip);
    return;
  }
  activeUpgrades.forEach(u => {
    const lvl = u.level(p);
    const isMax = lvl >= u.maxLevel;
    const chip = document.createElement('div');
    chip.className = 'build-chip' + (isMax ? ' max' : '');
    chip.innerHTML = `
      <span class="build-chip-icon" aria-hidden="true">${u.icon}</span>
      <span class="build-chip-name">${t(u.titleKey)}</span>
      <span class="build-chip-level">${isMax ? t('upgradeMaxLevel') : 'Lv.' + lvl}</span>
    `;
    ui.gameoverBuildGrid.appendChild(chip);
  });
}

function endGame() {
  const p = game.player;
  p.hp = 0;
  game.running = false;
  setPaused(false, false);
  closeUpgradeModal();
  if (ui.bossBar) {
    ui.bossBar.classList.remove('show');
    ui.bossBar.hidden = true;
  }
  playGameOver();
  vibrateDeath();
  const currentScore = Math.floor(game.score);
  const isNewBest = currentScore > scoreState.best;
  scoreState.best = Math.max(scoreState.best, currentScore);
  try {
    localStorage.setItem('zombie-room-best', String(scoreState.best));
  } catch (_) {}
  ui.gameoverScore.textContent = currentScore;
  if (ui.gameoverCombo) ui.gameoverCombo.textContent = game.maxCombo || 0;
  if (ui.gameoverWave) ui.gameoverWave.textContent = game.wave;
  ui.gameoverKills.textContent = game.kills;
  ui.gameoverTime.textContent = formatTime(game.elapsed);
  if (ui.gameoverNewBest) ui.gameoverNewBest.hidden = !isNewBest;

  const rank = calculateRunRank(game.wave, currentScore, game.kills, game.maxCombo || 0);
  if (ui.gameoverRankBadge && ui.gameoverRankText) {
    ui.gameoverRankText.textContent = t('rankLabel') + ' ' + rank;
    ui.gameoverRankBadge.className = 'gameover-rank-badge rank-' + rank.toLowerCase();
  }
  renderBuildSummary(p);

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
    if (p.rot !== undefined) p.rot += (p.vrot || 0) * dt;
    p.vx *= Math.pow(p.drag ?? .02, dt);
    p.vy *= Math.pow(p.drag ?? .02, dt);
    p.vy += (p.gravity ?? 0) * dt;
    p.life -= dt;
  }
  game.particles = game.particles.filter(p => p.life > 0);
  for (let i = game.floatingTexts.length - 1; i >= 0; i--) {
    const ft = game.floatingTexts[i];
    ft.x += ft.vx * dt;
    ft.y += ft.vy * dt;
    ft.vy += 42 * dt;
    ft.life -= dt;
    if (ft.life <= 0) {
      game.floatingTexts.splice(i, 1);
    }
  }
  game.cameraShake = Math.max(0, game.cameraShake - dt * 1.7);
  game.roomPhase += dt * .8;

  if (!game.running || game.paused || game.upgradeModalOpen) return;

  game.elapsed += dt;
  const p = game.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.shootTimer -= dt;
  p.muzzleFlash = Math.max(0, p.muzzleFlash - dt);
  p.recoil = Math.max(0, p.recoil - dt * 9);
  p.overdriveTimer = Math.max(0, p.overdriveTimer - dt);
  p.shieldHitFlash = Math.max(0, p.shieldHitFlash - dt);

  if (game.comboTimer > 0) {
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) {
      game.combo = 0;
    }
  }

  if (p.shieldCooldown > 0) {
    p.shieldCooldown = Math.max(0, p.shieldCooldown - dt);
  } else if (p.shield < p.maxShield) {
    const wasFull = p.shield >= p.maxShield;
    p.shield = Math.min(p.maxShield, p.shield + 16 * dt);
    if (!wasFull && p.shield >= p.maxShield) {
      playShieldRecharge();
      burst(p.x, p.y, '#8ae0ff', 8, 70);
    }
  }

  const nextWave = 1 + Math.floor(game.elapsed / 25);
  if (nextWave !== game.wave) {
    game.wave = nextWave;
    flashMessage(t('msgWave', { wave: game.wave }));
  }
  if (game.wave >= 4 && game.wave % 4 === 0 && game.bossWave !== game.wave && !hasActiveBoss()) {
    spawnBoss();
  }

  // Reactor Blackout Event: triggers on waves 3, 6, 9... about 8s in
  if (game.wave >= 3 && game.wave % 3 === 0 && game.blackoutTriggeredWave !== game.wave && !hasActiveBoss() && (game.elapsed % 25) >= 8) {
    game.blackoutTriggeredWave = game.wave;
    game.blackoutTimer = 12.0;
    flashMessage(t('msgBlackout'));
    playBlackoutAlarm();
    vibrateBoss();
    game.cameraShake = Math.max(game.cameraShake, .35);
  }

  if (game.blackoutTimer > 0) {
    game.blackoutTimer -= dt;
    if (game.blackoutTimer <= 0) {
      game.blackoutTimer = 0;
      flashMessage(t('msgPowerRestored'));
      playPowerRestored();
      vibrateUi();
      game.cameraShake = Math.max(game.cameraShake, .25);
      spawnPickup(room.x + room.w * 0.45, room.y + room.h * 0.5, 'boss');
      spawnPickup(room.x + room.w * 0.55, room.y + room.h * 0.5, 'boss');
      burst(room.x + room.w * 0.5, room.y + room.h * 0.5, '#ffd700', 28, 140);
    }
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
    const comboSpeedBonus = game.combo >= 50 ? 1.25 : (game.combo >= 25 ? 1.18 : (game.combo >= 10 ? 1.10 : 1.0));

    let frostSlow = 1.0;
    for (const z of game.zombies) {
      if (z.affix === 'frost') {
        const dx = p.x - z.x;
        const dy = p.y - z.y;
        if (dx * dx + dy * dy < (z.r + 55) ** 2) {
          frostSlow = 0.72;
          break;
        }
      }
    }

    p.walkTime += dt * 11 * speedMultiplier * comboSpeedBonus * frostSlow;
    p.x += normX * p.speed * speedMultiplier * comboSpeedBonus * frostSlow * dt;
    p.y += normY * p.speed * speedMultiplier * comboSpeedBonus * frostSlow * dt;

    p.stepTimer = (p.stepTimer || 0) - dt;
    if (p.stepTimer <= 0) {
      p.stepTimer = 0.11;
      const backX = p.x - normX * 8 + rand(-2, 2);
      const backY = p.y - normY * 8 + rand(-2, 2);
      burst(backX, backY, 'rgba(140, 168, 150, .32)', 1, 16);
    }
  } else {
    p.walkTime += dt * 3;
  }
  if (!game.zombies.length && p.moving) p.aimAngle = p.moveAngle;
  p.x = clamp(p.x, room.x + p.r, room.x + room.w - p.r);
  p.y = clamp(p.y, room.y + p.r, room.y + room.h - p.r);
  resolveObstacleCollision(p);
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
    p.shootTimer = p.overdriveTimer > 0 ? p.fireRate * 0.48 : p.fireRate;
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
        let dealt = b.damage;
        if (z.type === 'boss') dealt *= (z.armor || .86);
        else if (z.affix === 'armored') dealt *= (z.armor || .60);
        z.hp -= dealt;
        z.hitFlash = .08;
        if (b.isCrit) {
          playCrit();
          vibrateCrit();
        }
        spawnDamageText(z.x + rand(-6, 6), z.y - z.r - 4, dealt, b.isCrit, false);
        burst(b.x, b.y, b.isCrit ? '#ffd27a' : (z.affix === 'armored' ? '#69b6ff' : '#eaf7ed'), b.isCrit ? 6 : 3, b.isCrit ? 75 : 45);
        sprayBlood(b.x, b.y, z.type === 'boss' ? 1.1 : .45, z.type === 'boss' ? '#e06c78' : '#ba4956');

        if (p.superWeapons?.plasmaFlak) {
          const knockDist = z.type === 'boss' ? 12 : 36;
          const bulletSpeed = p.bulletSpeed || 460;
          z.x += (b.vx / bulletSpeed) * knockDist;
          z.y += (b.vy / bulletSpeed) * knockDist;
          resolveObstacleCollision(z);
        }

        if (p.superWeapons?.tesla && !b.hasChained) {
          b.hasChained = true;
          let chainCount = 0;
          for (let k = game.zombies.length - 1; k >= 0; k--) {
            if (k === j) continue;
            const cz = game.zombies[k];
            const cdx = cz.x - z.x;
            const cdy = cz.y - z.y;
            if (cdx * cdx + cdy * cdy < 110 * 110) {
              const chainDmg = Math.max(1, Math.round(dealt * 0.75));
              cz.hp -= chainDmg;
              cz.hitFlash = 0.08;
              spawnDamageText(cz.x, cz.y - cz.r, chainDmg, false, false);
              game.particles.push({
                shape: 'arc',
                x: z.x,
                y: z.y,
                tx: cz.x,
                ty: cz.y,
                life: 0.14,
                maxLife: 0.14
              });
              playElectricZap();
              if (cz.hp <= 0) {
                killZombie(k, b.isCrit);
                if (k < j) j--;
              }
              chainCount++;
              if (chainCount >= 3) break;
            }
          }
        }

        b.pierce = (b.pierce || 1) - 1;
        if (b.pierce <= 0) hit = true;
        if (z.type === 'boss') game.cameraShake = Math.max(game.cameraShake, .08);
        if (z.hp <= 0) killZombie(j, b.isCrit);
        if (hit) break;
      }
    }
    if (!hit && room.obstacles) {
      for (const obs of room.obstacles) {
        if (b.x >= obs.x && b.x <= obs.x + obs.w && b.y >= obs.y && b.y <= obs.y + obs.h) {
          hit = true;
          burst(b.x, b.y, '#ffd27a', 3, 50);
          break;
        }
      }
    }
    if (hit || b.life <= 0 || b.x < room.x - 35 || b.x > room.x + room.w + 35 || b.y < room.y - 35 || b.y > room.y + room.h + 35) {
      game.bullets.splice(i, 1);
    }
  }

  for (const z of game.zombies) {
    z.hitFlash = Math.max(0, z.hitFlash - dt);
    z.attackFlash = Math.max(0, z.attackFlash - dt);
    z.walkTime += dt * (z.type === 'runner' ? 15 : z.type === 'tank' ? 7 : (z.type === 'boss' ? (z.frenzy ? 14 : 6) : 10));
    if (z.type === 'boss') {
      if (!z.frenzy && z.hp <= z.maxHp * 0.5) {
        z.frenzy = true;
        flashMessage(t('msgBossFrenzy'));
        playBossRoar();
        vibrateBoss();
        game.cameraShake = Math.max(game.cameraShake, .55);
        burst(z.x, z.y, '#ff4359', 32, 160);
      }
      z.pulse += dt * (z.frenzy ? 7.2 : 3.2);
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
      const baseScale = z.frenzy ? 1.42 : 1.0;
      moveScale = z.entrance > 0 ? .35 : baseScale;
      const minDistance = z.frenzy ? 75 : 100;
      if (z.dashCd <= 0 && len > minDistance) {
        z.attackFlash = z.frenzy ? .42 : .32;
        z.lunge = z.frenzy ? .32 : .22;
        z.dashCd = z.frenzy ? rand(1.3, 2.3) : rand(2.6, 4.2);
        game.cameraShake = Math.max(game.cameraShake, z.frenzy ? .28 : .18);
        if (z.frenzy) {
          burst(z.x, z.y, '#ff4359', 8, 80);
        }
      }
      if (z.lunge > 0) moveScale = z.frenzy ? 2.85 : 2.15;
    }
    z.x += dx / len * z.speed * moveScale * dt;
    z.y += dy / len * z.speed * moveScale * dt;
    resolveObstacleCollision(z);

    const rr = p.r + z.r - (z.type === 'boss' ? 6 : 2);
    if (dx * dx + dy * dy <= rr * rr) {
      if (p.invuln <= 0) z.attackFlash = z.type === 'boss' ? .24 : .18;
      damagePlayer(z.damage, z);
    }
  }

  const magnetDist = p.magnetRadius || 125;
  for (let i = game.orbs.length - 1; i >= 0; i--) {
    const o = game.orbs[i];
    o.pulse += dt * 5;
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < magnetDist) {
      const speed = 115 + (magnetDist - d) * 2.2;
      o.x += dx / d * speed * dt;
      o.y += dy / d * speed * dt;
    }
    if (d < p.r + o.r + 5) {
      gainXp(o.value);
      playXp();
      game.score += 2;
      game.orbs.splice(i, 1);
    }
  }

  for (let i = game.pickups.length - 1; i >= 0; i--) {
    const item = game.pickups[i];
    item.pulse += dt * 5;
    item.life -= dt;
    if (item.life <= 0) {
      game.pickups.splice(i, 1);
      continue;
    }
    const dx = p.x - item.x;
    const dy = p.y - item.y;
    if (dx * dx + dy * dy < (p.r + 14) ** 2) {
      collectPickup(item, i);
    }
  }

  if (room.hazards) {
    for (const h of room.hazards) {
      h.timer += dt;
      if (h.state === 'dormant' && h.timer >= 4.0) {
        h.state = 'warning';
        h.timer = 0;
      } else if (h.state === 'warning' && h.timer >= 1.5) {
        h.state = 'active';
        h.timer = 0;
        h.tickTimer = 0;
        playElectricZap();
      } else if (h.state === 'active' && h.timer >= 2.5) {
        h.state = 'dormant';
        h.timer = 0;
      }

      if (h.state === 'active') {
        h.tickTimer -= dt;
        if (h.tickTimer <= 0) {
          h.tickTimer = 0.32;
          for (let j = game.zombies.length - 1; j >= 0; j--) {
            const z = game.zombies[j];
            const dx = z.x - h.x;
            const dy = z.y - h.y;
            if (dx * dx + dy * dy < (z.r + h.r) ** 2) {
              const dealt = 3.6 * (1 + game.wave * 0.08);
              z.hp -= dealt;
              z.hitFlash = 0.08;
              spawnDamageText(z.x + rand(-4, 4), z.y - z.r, Math.round(dealt), false, false);
              burst(z.x, z.y, '#69b6ff', 3, 55);
              if (z.hp <= 0) killZombie(j);
            }
          }

          const pdx = p.x - h.x;
          const pdy = p.y - h.y;
          if (pdx * pdx + pdy * pdy < (p.r + h.r) ** 2) {
            damagePlayer(7, h);
            burst(p.x, p.y, '#69b6ff', 4, 60);
          }
        }
      }
    }
  }

  game.score += dt * (1 + game.wave * .12);
  updateUI();
}
