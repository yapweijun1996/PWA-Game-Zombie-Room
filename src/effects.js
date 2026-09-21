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
