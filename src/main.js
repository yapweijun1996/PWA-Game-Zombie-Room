import { dom, ui, viewport, room, game, perf, scoreState } from './state.js';
import { clamp } from './utils.js';
import { resetGame, update, isDesktopControls, setPaused, togglePause } from './entities.js';
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

  const hudRect = dom.hud ? dom.hud.getBoundingClientRect() : { bottom: 60 };
  const appbarBottom = dom.appbar ? dom.appbar.getBoundingClientRect().bottom : 0;
  const roomTop = Math.max(hudRect.bottom + 8, appbarBottom + 8);
  const controlsRect = dom.controlsWrap ? dom.controlsWrap.getBoundingClientRect() : { height: 0 };
  const mobileBottom = controlsRect.height > 0 ? Math.max(controlsRect.height + 8, 134) : 18;
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

  if (!game.paused) {
    perf.fpsFrames++;
    const fpsWindowMs = now - perf.fpsWindowStart;
    if (fpsWindowMs >= 500) {
      const measuredFps = perf.fpsFrames * 1000 / fpsWindowMs;
      perf.fpsValue = perf.fpsValue ? perf.fpsValue * .62 + measuredFps * .38 : measuredFps;
      if (ui.fpsText) ui.fpsText.textContent = String(Math.round(perf.fpsValue));
      evaluatePerformance(perf.fpsValue, now);
      perf.fpsFrames = 0;
      perf.fpsWindowStart = now;
    }

    update(dt);
  } else {
    perf.fpsWindowStart = now;
    perf.fpsFrames = 0;
  }

  draw();
  requestAnimationFrame(frame);
}

addEventListener('resize', () => requestAnimationFrame(resize), { passive: true });
addEventListener('orientationchange', () => setTimeout(resize, 140), { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (game.running && !game.paused) {
      setPaused(true);
    }
  } else {
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
dom.pauseButton?.addEventListener('click', togglePause);
dom.resumeButton?.addEventListener('click', () => setPaused(false));
dom.pauseOverlay?.addEventListener('click', e => {
  if (e.target === dom.pauseOverlay) setPaused(false);
});
requestAnimationFrame(now => { perf.last = now; requestAnimationFrame(frame); });
