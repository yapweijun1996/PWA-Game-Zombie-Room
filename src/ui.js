import { APP_VERSION, dom, ui, game, timers, scoreState, getActiveBoss } from './state.js';
import { clamp, formatTime } from './utils.js';
import { t } from './i18n.js';
import { getWavePlan } from './wave-director.js';
import { BUILD_PATHS } from './builds.js';

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
  if (ui.shieldFill && p.maxShield) {
    ui.shieldFill.style.width = clamp((p.shield / p.maxShield) * 100, 0, 100) + '%';
  }
  if (ui.shieldText) {
    ui.shieldText.textContent = '🛡️ ' + Math.ceil(p.shield);
    ui.shieldText.classList.toggle('depleted', p.shield <= 0);
  }
  ui.xpText.textContent = p.xp + ' / ' + p.xpNeed;
  ui.xpFill.style.width = clamp(p.xp / p.xpNeed * 100, 0, 100) + '%';
  ui.levelText.textContent = p.level;
  const path = BUILD_PATHS.find(choice => choice.path === p.build?.path);
  if (ui.buildPathIcon) {
    ui.buildPathIcon.hidden = !path;
    ui.buildPathIcon.textContent = path?.icon || '';
    const description = path ? t(path.titleKey) + (p.build.specialization ? ' · ' + t(p.build.specialization) : '') : '';
    ui.buildPathIcon.title = description;
    ui.buildPathIcon.setAttribute('aria-label', description);
    ui.buildPathIcon.classList.toggle('burst-active', p.build?.burstTimer > 0);
  }
  if (ui.levelMetric) ui.levelMetric.textContent = p.level;
  const plan = getWavePlan(game.scenarioSeed, game.wave);
  ui.waveText.textContent = t('hudStageWave', { stage: plan.stage, wave: game.wave });
  const encounter = t(plan.encounterId ? 'encounter_' + plan.encounterId : 'phase_' + plan.phaseId);
  if (ui.encounterText) ui.encounterText.textContent = encounter;
  ui.waveText.title = t('msgDirectorWave', { wave: plan.wave, stage: plan.stage, encounter });
  ui.waveText.setAttribute('aria-label', ui.waveText.title);
  ui.killsText.textContent = game.kills;
  ui.timeText.textContent = formatTime(game.elapsed);
  ui.scoreText.textContent = Math.floor(game.score);
  const legacyBest = scoreState.best > 0 && scoreState.bestVersion !== APP_VERSION;
  ui.bestText.textContent = scoreState.best + (legacyBest ? '*' : '');
  ui.bestText.title = legacyBest ? t('legacyBestNote') : '';
  if (ui.legacyBestNote) {
    ui.legacyBestNote.hidden = !legacyBest;
    ui.legacyBestNote.textContent = t('legacyBestNote');
  }
  ui.bestText.setAttribute('aria-label', legacyBest ? `${scoreState.best}. ${t('legacyBestNote')}` : String(scoreState.best));

  if (dom.dashButton) {
    const cooldownMax = p.dashCooldownMax || 8;
    const cooldown = Math.max(0, p.dashCooldown || 0);
    const coolingDown = cooldown > 0;
    const secondsRemaining = Math.ceil(cooldown);
    dom.dashButton.setAttribute('aria-disabled', String(coolingDown));
    dom.dashButton.setAttribute('aria-label', coolingDown
      ? t('dashActionCooldown', { seconds: secondsRemaining })
      : t('dashActionReady'));
    if (dom.dashButtonStatus) dom.dashButtonStatus.textContent = coolingDown ? String(secondsRemaining) : '';
    if (dom.dashCooldownFill) {
      dom.dashCooldownFill.style.width = clamp(1 - cooldown / cooldownMax, 0, 1) * 100 + '%';
    }
  }

  if (ui.comboBadge && ui.comboText && ui.comboBar) {
    if (game.combo >= 5 && game.running) {
      ui.comboBadge.hidden = false;
      ui.comboText.textContent = t('comboLabel') + ' ×' + game.combo;
      ui.comboBar.style.width = clamp((game.comboTimer / 2.4) * 100, 0, 100) + '%';
      ui.comboBadge.classList.toggle('tier-1', game.combo >= 10 && game.combo < 25);
      ui.comboBadge.classList.toggle('tier-2', game.combo >= 25 && game.combo < 50);
      ui.comboBadge.classList.toggle('tier-3', game.combo >= 50);
    } else {
      ui.comboBadge.hidden = true;
    }
  }

  if (ui.bossBar && ui.bossHpFill) {
    const boss = getActiveBoss();
    if (boss && game.running) {
      ui.bossBar.hidden = false;
      if (!ui.bossBar.classList.contains('show')) {
        requestAnimationFrame(() => ui.bossBar.classList.add('show'));
      }
      const pct = clamp(Math.ceil((boss.hp / boss.maxHp) * 100), 0, 100);
      ui.bossHpFill.style.width = pct + '%';
      if (ui.bossHpText) ui.bossHpText.textContent = pct + '%';

      const badge = ui.bossBar.querySelector('.boss-badge');
      if (badge) {
        badge.textContent = boss.frenzy ? t('bossFrenzyBadge') : t('bossLabel');
        badge.classList.toggle('frenzy', !!boss.frenzy);
      }
      ui.bossBar.classList.toggle('frenzy', !!boss.frenzy);
    } else if (!ui.bossBar.hidden) {
      ui.bossBar.classList.remove('show');
      ui.bossBar.classList.remove('frenzy');
      setTimeout(() => {
        if (!getActiveBoss() || !game.running) ui.bossBar.hidden = true;
      }, 240);
    }
  }
}
