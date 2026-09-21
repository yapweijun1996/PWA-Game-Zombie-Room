import { dom, ui, viewport, room, game, perf, scoreState } from './state.js';
import { clamp } from './utils.js';
import { resetGame, update, isDesktopControls } from './entities.js';
import { evaluatePerformance, refreshPerfLabel } from './effects.js';
import { draw } from './render.js';
import { initPwa, refreshPwaLabels } from './pwa.js';
import { initInput } from './input.js';
import { initI18n } from './i18n-apply.js';
import { initSettingsMenu } from './settings-menu.js';

function resize() {
  viewport.W = Math.max(320, innerWidth);
  viewport.H = Math.max(420, innerHeight);
  viewport.dpr = Math.min(2, devicePixelRatio || 1);
  dom.canvas.width = Math.floor(viewport.W * viewport.dpr);
  dom.canvas.height = Math.floor(viewport.H * viewport.dpr);
  dom.canvas.style.width = viewport.W + 'px';
  dom.canvas.style.height = viewport.H + 'px';

  const hudRect = dom.hud.getBoundingClientRect();
  const controlsRect = dom.controlsWrap.getBoundingClientRect();
  const roomTop = Math.max(hudRect.bottom + 8, dom.appbar.getBoundingClientRect().bottom + 8);
  const mobileBottom = controlsRect.height > 0 ? Math.max(controlsRect.height + 14, 172) : 18;
  const bottomReserve = isDesktopControls() ? 18 : mobileBottom;

  room.x = 10;
  room.y = roomTop;
  room.w = viewport.W - 20;
  room.h = Math.max(150, viewport.H - roomTop - bottomReserve);

  if (game.player) {
    game.player.x = clamp(game.player.x, room.x + game.player.r, room.x + room.w - game.player.r);
    game.player.y = clamp(game.player.y, room.y + game.player.r, room.y + room.h - game.player.r);
  }
}

function frame(now) {
  const dt = Math.min(.034, Math.max(0, (now - perf.last) / 1000));
  perf.last = now;

  perf.fpsFrames++;
  const fpsWindowMs = now - perf.fpsWindowStart;
  if (fpsWindowMs >= 500) {
    const measuredFps = perf.fpsFrames * 1000 / fpsWindowMs;
    perf.fpsValue = perf.fpsValue ? perf.fpsValue * .62 + measuredFps * .38 : measuredFps;
    ui.fpsText.textContent = String(Math.round(perf.fpsValue));
    evaluatePerformance(perf.fpsValue, now);
    perf.fpsFrames = 0;
    perf.fpsWindowStart = now;
  }

  update(dt);
  draw();
  requestAnimationFrame(frame);
}

addEventListener('resize', () => requestAnimationFrame(resize), { passive: true });
addEventListener('orientationchange', () => setTimeout(resize, 140), { passive: true });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    perf.last = performance.now();
    perf.fpsWindowStart = perf.last;
    perf.fpsFrames = 0;
    perf.lowFpsWindows = 0;
    perf.recoveredFpsWindows = 0;
    perf.perfWarmupUntil = perf.last + 1800;
  }
});

initI18n(() => {
  refreshPwaLabels();
  refreshPerfLabel();
});
resize();
ui.bestText.textContent = scoreState.best;
resetGame();
initPwa();
initInput(resetGame);
initSettingsMenu();
dom.restartButton?.addEventListener('click', resetGame);
requestAnimationFrame(now => { perf.last = now; requestAnimationFrame(frame); });
