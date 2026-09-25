import { dom, game, ui } from './state.js';
import { formatTime } from './utils.js';
import { t } from './i18n.js';
import { activateFocusTrap } from './focus-trap.js';

let releasePauseFocusTrap = null;
let releaseUpgradeFocusTrap = null;
let releaseGameOverFocusTrap = null;

export function renderPausePresentation(paused, showOverlay = true) {
  const overlayVisible = paused && showOverlay;
  if (dom.pauseOverlay) {
    dom.pauseOverlay.hidden = !overlayVisible;
    dom.pauseOverlay.classList.toggle('show', overlayVisible);
    if (overlayVisible && !releasePauseFocusTrap) {
      releasePauseFocusTrap = activateFocusTrap(dom.pauseOverlay, {
        initialFocus: dom.resumeButton,
        fallbackFocus: dom.pauseButton
      });
    } else if (!overlayVisible && releasePauseFocusTrap) {
      releasePauseFocusTrap();
      releasePauseFocusTrap = null;
    }
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
      pauseIcon.toggleAttribute('hidden', paused);
      playIcon.toggleAttribute('hidden', !paused);
    }
  }
}

export function updateUpgradeDialog(choices, player, onChoose) {
  if (!dom.upgradeCards) return;
  dom.upgradeCards.replaceChildren();

  choices.forEach((choice, index) => {
    const isEvolution = choice.isEvolution;
    const currentLevel = isEvolution ? null : choice.level(player);
    const levelText = isEvolution ? t('evoBadge') : (currentLevel === 0 ? 'NEW' : `Lv.${currentLevel + 1}`);
    const button = document.createElement('button');
    button.className = 'upgrade-card' + (isEvolution ? ' evolution' : '');
    button.type = 'button';
    button.setAttribute('data-index', String(index));
    button.innerHTML = `
      <div class="upgrade-card-icon" aria-hidden="true">${choice.icon}</div>
      <div class="upgrade-card-content">
        <div class="upgrade-card-header">
          <span class="upgrade-card-name">${t(choice.titleKey)}</span>
          <span class="upgrade-card-level${isEvolution ? ' evo' : ''}">${levelText}</span>
        </div>
        <div class="upgrade-card-desc">${t(choice.descKey)}</div>
      </div>
      <div class="upgrade-card-key" aria-hidden="true">${index + 1}</div>
    `;
    button.addEventListener('click', () => onChoose(index));
    dom.upgradeCards.appendChild(button);
  });

  if (!dom.upgradeModal?.hidden) {
    dom.upgradeCards.querySelector('button')?.focus({ preventScroll: true });
  }
}

export function showUpgradeDialog(choices, player, onChoose) {
  updateUpgradeDialog(choices, player, onChoose);
  if (dom.canvas) dom.canvas.classList.add('game-dimmed');
  if (!dom.upgradeModal) return;
  dom.upgradeModal.hidden = false;
  dom.upgradeModal.classList.add('show');
  releaseUpgradeFocusTrap?.({ restoreFocus: false });
  releaseUpgradeFocusTrap = activateFocusTrap(dom.upgradeModal, {
    initialFocus: dom.upgradeCards?.querySelector('button'),
    fallbackFocus: dom.pauseButton
  });
}

export function hideUpgradeDialog(paused, running) {
  if (releaseUpgradeFocusTrap) {
    releaseUpgradeFocusTrap();
    releaseUpgradeFocusTrap = null;
  }
  if (dom.upgradeModal) {
    dom.upgradeModal.classList.remove('show');
    dom.upgradeModal.hidden = true;
  }
  if (dom.canvas && !paused && running) dom.canvas.classList.remove('game-dimmed');
}

function renderBuildSummary(player, upgrades) {
  if (!ui.gameoverBuildGrid) return;
  ui.gameoverBuildGrid.replaceChildren();

  if (player.superWeapons?.tesla) {
    const chip = document.createElement('div');
    chip.className = 'build-chip evo';
    chip.innerHTML = `
      <span class="build-chip-icon" aria-hidden="true">⚡</span>
      <span class="build-chip-name">${t('evoTeslaTitle')}</span>
      <span class="build-chip-level evo">${t('evoBadge')}</span>
    `;
    ui.gameoverBuildGrid.appendChild(chip);
  }
  if (player.superWeapons?.plasmaFlak) {
    const chip = document.createElement('div');
    chip.className = 'build-chip evo';
    chip.innerHTML = `
      <span class="build-chip-icon" aria-hidden="true">💥</span>
      <span class="build-chip-name">${t('evoPlasmaTitle')}</span>
      <span class="build-chip-level evo">${t('evoBadge')}</span>
    `;
    ui.gameoverBuildGrid.appendChild(chip);
  }

  const activeUpgrades = upgrades.filter(upgrade => upgrade.level(player) > (upgrade.id === 'multiShot' ? 1 : 0));
  if (!activeUpgrades.length) {
    const emptyChip = document.createElement('div');
    emptyChip.className = 'build-chip empty';
    emptyChip.textContent = 'Lv.1 Standard Issue';
    ui.gameoverBuildGrid.appendChild(emptyChip);
    return;
  }

  activeUpgrades.forEach(upgrade => {
    const level = upgrade.level(player);
    const isMax = level >= upgrade.maxLevel;
    const chip = document.createElement('div');
    chip.className = 'build-chip' + (isMax ? ' max' : '');
    chip.innerHTML = `
      <span class="build-chip-icon" aria-hidden="true">${upgrade.icon}</span>
      <span class="build-chip-name">${t(upgrade.titleKey)}</span>
      <span class="build-chip-level">${isMax ? t('upgradeMaxLevel') : 'Lv.' + level}</span>
    `;
    ui.gameoverBuildGrid.appendChild(chip);
  });
}

export function showGameOver({ score, combo, wave, kills, elapsed, isNewBest, rank, player, upgrades, performanceMode }) {
  ui.gameoverScore.textContent = score;
  if (ui.gameoverCombo) ui.gameoverCombo.textContent = combo;
  if (ui.gameoverWave) ui.gameoverWave.textContent = wave;
  ui.gameoverKills.textContent = kills;
  ui.gameoverTime.textContent = formatTime(elapsed);
  if (ui.gameoverNewBest) ui.gameoverNewBest.hidden = !isNewBest;

  if (ui.gameoverRankBadge && ui.gameoverRankText) {
    ui.gameoverRankText.textContent = t('rankLabel') + ' ' + rank;
    ui.gameoverRankBadge.className = 'gameover-rank-badge rank-' + rank.toLowerCase();
  }
  renderBuildSummary(player, upgrades);

  if (dom.canvas) dom.canvas.classList.add(performanceMode ? 'game-dimmed' : 'game-blurred');
  if (!ui.gameover) return;
  ui.gameover.hidden = false;
  ui.gameover.classList.add('show');
  releaseGameOverFocusTrap?.({ restoreFocus: false });
  releaseGameOverFocusTrap = activateFocusTrap(ui.gameover, {
    initialFocus: ui.gameover.querySelector('#restartButton'),
    fallbackFocus: dom.pauseButton
  });
}

export function hideGameOver() {
  if (releaseGameOverFocusTrap) {
    releaseGameOverFocusTrap();
    releaseGameOverFocusTrap = null;
  }
  if (ui.gameover) {
    ui.gameover.classList.remove('show');
    ui.gameover.hidden = true;
  }
  if (ui.gameoverNewBest) ui.gameoverNewBest.hidden = true;
}

export function hideBossBar() {
  if (!ui.bossBar) return;
  ui.bossBar.classList.remove('show');
  ui.bossBar.hidden = true;
}
