import { ui, game, timers, scoreState } from './state.js';
import { clamp, formatTime } from './utils.js';

export function flashMessage(text) {
  ui.message.textContent = text;
  ui.message.classList.add('show');
  timers.messageTimer = 1.7;
}

export function updateUI() {
  const p = game.player;
  if (!p) return;
  ui.hpText.textContent = Math.ceil(p.hp) + ' / ' + p.maxHp;
  ui.hpFill.style.width = clamp(p.hp / p.maxHp * 100, 0, 100) + '%';
  ui.xpText.textContent = p.xp + ' / ' + p.xpNeed;
  ui.xpFill.style.width = clamp(p.xp / p.xpNeed * 100, 0, 100) + '%';
  ui.levelText.textContent = p.level;
  ui.levelMetric.textContent = p.level;
  ui.waveText.textContent = game.wave;
  ui.killsText.textContent = game.kills;
  ui.timeText.textContent = formatTime(game.elapsed);
  ui.scoreText.textContent = Math.floor(game.score);
  ui.bestText.textContent = scoreState.best;
}
