import { game, room, ui, perf } from './state.js';
import { rand } from './utils.js';
import { flashMessage } from './ui.js';
import { t } from './i18n.js';

export function particleBudget() {
  return game.performanceMode ? 90 : 260;
}

export function effectCount(count, minimum = 1) {
  return Math.max(minimum, Math.round(count * (game.performanceMode ? .42 : 1)));
}

export function setPerformanceMode(enabled, notify = true) {
  if (game.performanceMode === enabled) return;
  game.performanceMode = enabled;
  perf.lowFpsWindows = 0;
  perf.recoveredFpsWindows = 0;
  ui.perfText.textContent = enabled ? t('hudEco') : t('hudFull');
  ui.perfLine.classList.toggle('eco', enabled);
  if (enabled && game.particles.length > particleBudget()) {
    game.particles.splice(0, game.particles.length - particleBudget());
  }
  if (enabled && game.decals.length > 22) {
    game.decals.splice(0, game.decals.length - 22);
  }
  if (enabled && game.floatingTexts.length > 16) {
    game.floatingTexts.splice(0, game.floatingTexts.length - 16);
  }
  if (notify) flashMessage(enabled ? t('msgPerfEco') : t('msgPerfFull'));
}

export function refreshPerfLabel() {
  ui.perfText.textContent = game.performanceMode ? t('hudEco') : t('hudFull');
}

export function evaluatePerformance(measuredFps, now) {
  if (document.hidden || now < perf.perfWarmupUntil) return;
  if (!game.performanceMode) {
    perf.lowFpsWindows = measuredFps < 48 ? perf.lowFpsWindows + 1 : Math.max(0, perf.lowFpsWindows - 1);
    perf.recoveredFpsWindows = 0;
    if (perf.lowFpsWindows >= 5) setPerformanceMode(true);
  } else {
    perf.recoveredFpsWindows = measuredFps > 56 ? perf.recoveredFpsWindows + 1 : Math.max(0, perf.recoveredFpsWindows - 1);
    perf.lowFpsWindows = 0;
    if (perf.recoveredFpsWindows >= 10) setPerformanceMode(false);
  }
}

export function burst(x, y, color, count = 5, speed = 80) {
  const actualCount = effectCount(count);
  for (let i = 0; i < actualCount && game.particles.length < particleBudget(); i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * speed;
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(.18, .48), maxLife: .48, color, size: rand(1.5, 3.5), drag: .02, gravity: 0, shape: 'square' });
  }
}

export function sprayBlood(x, y, strength = 1, color = '#c74857') {
  const count = effectCount(Math.round(6 + strength * 7), 2);
  for (let i = 0; i < count && game.particles.length < particleBudget(); i++) {
    const a = rand(-Math.PI, Math.PI);
    const s = rand(20, 70 + strength * 35);
    game.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - rand(4, 28),
      life: rand(.28, .7),
      maxLife: rand(.28, .7),
      color: i % 4 === 0 ? '#ff9aa5' : color,
      size: rand(2, 4.8 + strength),
      drag: .01,
      gravity: 220,
      shape: Math.random() < .75 ? 'dot' : 'square'
    });
  }
}

export function makeDecal(x, y, radius, color = 'rgba(110,24,30,.24)') {
  if (x < room.x || x > room.x + room.w || y < room.y || y > room.y + room.h) return;
  game.decals.push({ x, y, radius, color, seed: Math.random() * Math.PI * 2 });
  const maxDecals = game.performanceMode ? 22 : 36;
  while (game.decals.length > maxDecals) game.decals.shift();
}

export function spawnDamageText(x, y, amount, isCrit = false, isPlayer = false) {
  const maxTexts = game.performanceMode ? 16 : 32;
  if (game.floatingTexts.length >= maxTexts) {
    game.floatingTexts.shift();
  }

  const rounded = Number.isInteger(amount) ? amount : (amount >= 10 ? Math.round(amount) : amount.toFixed(1));
  let text = String(rounded);
  let color = '#f3fdf6';
  let size = 11;
  let stroke = 'rgba(0,0,0,.75)';

  if (isPlayer) {
    text = '-' + text;
    color = '#ff6174';
    size = 12;
    stroke = 'rgba(40,8,12,.85)';
  } else if (isCrit) {
    text = '★ ' + text;
    color = '#ffd666';
    size = 14;
    stroke = 'rgba(120,70,10,.85)';
  }

  game.floatingTexts.push({
    x,
    y,
    text,
    color,
    stroke,
    size,
    isCrit,
    isPlayer,
    vx: rand(-12, 12),
    vy: rand(-38, -52),
    life: isCrit ? 0.65 : 0.48,
    maxLife: isCrit ? 0.65 : 0.48
  });
}

export function spawnGore(x, y, type = 'walker', count = 2) {
  const actualCount = game.performanceMode ? Math.min(1, count) : count;
  const isBoss = type === 'boss';
  const outfitColor = type === 'runner' ? '#b6813d' : (type === 'tank' ? '#53685a' : (isBoss ? '#7a1926' : '#678a62'));

  for (let i = 0; i < actualCount && game.particles.length < particleBudget(); i++) {
    const angle = rand(-Math.PI, Math.PI);
    const speed = rand(45, 120 + (isBoss ? 50 : 0));
    const shape = i % 2 === 0 ? 'limb' : 'bone';
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - rand(15, 45),
      rot: Math.random() * Math.PI * 2,
      vrot: rand(-10, 10),
      life: rand(0.5, 0.95),
      maxLife: 0.95,
      color: shape === 'limb' ? outfitColor : '#e8eedb',
      size: isBoss ? rand(5, 7.5) : rand(3.5, 5),
      drag: 0.015,
      gravity: 280,
      shape
    });
  }
}
