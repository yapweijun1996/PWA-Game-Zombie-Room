import { dom, ui, viewport, room, game, perf, scoreState } from './state.js';
import { clamp } from './utils.js';
import { resetGame, update, isDesktopControls, setPaused, togglePause, renderUpgradeCards, currentUpgradeChoices, resolveObstacleCollision } from './entities.js';
import { evaluatePerformance, refreshPerfLabel } from './effects.js';
import { draw } from './render.js';
import { initPwa, refreshPwaLabels } from './pwa.js';
import { initInput } from './input.js';
import { initI18n } from './i18n-apply.js';
import { initSettingsMenu, refreshSoundToggleUI, refreshHapticsToggleUI } from './settings-menu.js';
import { flashMessage } from './ui.js';
import { t } from './i18n.js';
import { initAudio, playUiClick } from './audio.js';

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

  updateObstacles();
  updateHazards();

  if (game.player) {
    game.player.x = clamp(game.player.x, room.x + game.player.r, room.x + room.w - game.player.r);
    game.player.y = clamp(game.player.y, room.y + game.player.r, room.y + room.h - game.player.r);
    resolveObstacleCollision(game.player);
  }
}

export function updateObstacles() {
  room.obstacles = room.obstacles || [];
  room.obstacles.length = 0;

  const isSmall = room.w < 380 || room.h < 340;
  const ow = isSmall ? 38 : 46;
  const oh = isSmall ? 34 : 40;

  // Pillar 1: top-left quadrant
  const p1x = Math.round(room.x + room.w * 0.28 - ow / 2);
  const p1y = Math.round(room.y + room.h * 0.32 - oh / 2);

  // Pillar 2: bottom-right quadrant
  const p2x = Math.round(room.x + room.w * 0.72 - ow / 2);
  const p2y = Math.round(room.y + room.h * 0.68 - oh / 2);

  room.obstacles.push(
    { x: p1x, y: p1y, w: ow, h: oh, type: 'generator' },
    { x: p2x, y: p2y, w: ow, h: oh, type: 'relay' }
  );

  if (room.w >= 640 && room.h >= 380) {
    const p3w = 40, p3h = 36;
    const p3x = Math.round(room.x + room.w * 0.5 - p3w / 2);
    const p3y = Math.round(room.y + room.h * 0.5 - p3h / 2);
    room.obstacles.push({ x: p3x, y: p3y, w: p3w, h: p3h, type: 'terminal' });
  }
}

export function updateHazards() {
  room.hazards = room.hazards || [];
  const isSmall = room.w < 380 || room.h < 340;
  const hr = isSmall ? 26 : 32;

  const h1 = room.hazards[0] || { state: 'dormant', timer: 0, tickTimer: 0 };
  const h2 = room.hazards[1] || { state: 'dormant', timer: 3.8, tickTimer: 0 };

  h1.x = Math.round(room.x + room.w * 0.72);
  h1.y = Math.round(room.y + room.h * 0.28);
  h1.r = hr;

  h2.x = Math.round(room.x + room.w * 0.28);
  h2.y = Math.round(room.y + room.h * 0.72);
  h2.r = hr;

  room.hazards = [h1, h2];
}

function frame(now) {
  const dt = Math.min(.034, Math.max(0, (now - perf.last) / 1000));
  perf.last = now;

  if (!game.paused && !game.upgradeModalOpen) {
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
  refreshSoundToggleUI();
  refreshHapticsToggleUI();
  if (game.upgradeModalOpen && currentUpgradeChoices.length) {
    renderUpgradeCards(currentUpgradeChoices);
  }
});
initAudio();
resize();
ui.bestText.textContent = scoreState.best;
resetGame();
initPwa();
initInput(resetGame);
initSettingsMenu();
dom.restartButton?.addEventListener('click', resetGame);
dom.pauseButton?.addEventListener('click', togglePause);
dom.resumeButton?.addEventListener('click', () => setPaused(false, true));
dom.pauseOverlay?.addEventListener('click', e => {
  if (e.target === dom.pauseOverlay) setPaused(false, true);
});
dom.shareButton?.addEventListener('click', () => {
  const rank = ui.gameoverRankText ? ui.gameoverRankText.textContent : 'RANK S';
  const text = `🧟 Zombie Room | ${rank} | Score: ${Math.floor(game.score)} | Wave ${game.wave} | Kills: ${game.kills} | Max Combo: ×${game.maxCombo || 0}\nhttps://yapweijun1996.github.io/PWA-Game-Zombie-Room/`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      flashMessage(t('shareCopied'));
      playUiClick();
    }).catch(() => {});
  } else {
    flashMessage(t('shareCopied'));
  }
});
requestAnimationFrame(now => { perf.last = now; requestAnimationFrame(frame); });
