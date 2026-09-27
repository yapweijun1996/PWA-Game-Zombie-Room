import { game, dom, audioState, hapticsState, musicState, autoUpgradeState, setMusicEnabled, setAutoUpgradeEnabled } from './state.js';
import { setPaused } from './entities.js';
import { activateFocusTrap } from './focus-trap.js';
import { t } from './i18n.js';
import { playUiClick, resumeAudioContext } from './audio.js';
import { isHapticsSupported, vibrateUi } from './haptics.js';
import { startMusic, stopMusic } from './music.js';
import { syncAutoUpgradePreference } from './game-ui.js';

const CLOSE_TRANSITION_MS = 220;

export function refreshSoundToggleUI() {
  if (!dom.soundToggle || !dom.soundStatusText) return;
  dom.soundToggle.classList.toggle('active', audioState.enabled);
  dom.soundToggle.setAttribute('aria-checked', String(audioState.enabled));
  dom.soundStatusText.textContent = audioState.enabled ? t('soundOn') : t('soundOff');
}

export function refreshHapticsToggleUI() {
  if (!dom.hapticsToggle || !dom.hapticsStatusText) return;
  const supported = isHapticsSupported();
  dom.hapticsToggle.disabled = !supported;
  dom.hapticsToggle.classList.toggle('active', supported && hapticsState.enabled);
  dom.hapticsToggle.setAttribute('aria-checked', String(supported && hapticsState.enabled));
  dom.hapticsToggle.setAttribute('aria-label', t(supported ? 'hapticsLabel' : 'hapticsUnavailable'));
  dom.hapticsStatusText.textContent = supported ? (hapticsState.enabled ? t('soundOn') : t('soundOff')) : 'N/A';
  if (dom.hapticsAvailabilityNote) {
    dom.hapticsAvailabilityNote.hidden = supported;
    dom.hapticsAvailabilityNote.textContent = t('hapticsUnavailable');
  }
}

export function refreshMusicToggleUI() {
  if (!dom.musicToggle || !dom.musicStatusText) return;
  dom.musicToggle.classList.toggle('active', musicState.enabled);
  dom.musicToggle.setAttribute('aria-checked', String(musicState.enabled));
  dom.musicStatusText.textContent = musicState.enabled ? t('soundOn') : t('soundOff');
}

export function refreshAutoUpgradeToggleUI() {
  if (!dom.autoUpgradeToggle) return;
  dom.autoUpgradeToggle.classList.toggle('active', autoUpgradeState.enabled);
  dom.autoUpgradeToggle.setAttribute('aria-checked', String(autoUpgradeState.enabled));
  const status = document.getElementById('autoUpgradeStatusText');
  if (status) status.textContent = autoUpgradeState.enabled ? t('soundOn') : t('soundOff');
  if (dom.upgradeAutoToggle) dom.upgradeAutoToggle.checked = autoUpgradeState.enabled;
}

export function initSettingsMenu() {
  const trigger = document.getElementById('settingsTrigger');
  const panel = document.getElementById('settingsPanel');
  const backdrop = document.getElementById('settingsBackdrop');
  if (!trigger || !panel) return;

  let hideTimer = 0;
  let closing = false;
  let releaseFocusTrap = null;
  let wasPausedBySettings = false;
  let wasPausedBeforeSettings = false;

  refreshSoundToggleUI();
  dom.soundToggle?.addEventListener('click', () => {
    audioState.enabled = !audioState.enabled;
    try {
      localStorage.setItem('zombie-room-sound', String(audioState.enabled));
    } catch (_) {}
    refreshSoundToggleUI();
    if (audioState.enabled) {
      resumeAudioContext({ force: true }).then(running => {
        if (running) playUiClick();
      });
    }
  });

  refreshMusicToggleUI();
  dom.musicToggle?.addEventListener('click', () => {
    setMusicEnabled(!musicState.enabled);
    refreshMusicToggleUI();
    if (musicState.enabled) startMusic();
    else stopMusic();
  });

  refreshHapticsToggleUI();
  dom.hapticsToggle?.addEventListener('click', () => {
    hapticsState.enabled = !hapticsState.enabled;
    try {
      localStorage.setItem('zombie-room-haptics', String(hapticsState.enabled));
    } catch (_) {}
    refreshHapticsToggleUI();
    if (hapticsState.enabled) vibrateUi();
  });

  refreshAutoUpgradeToggleUI();
  dom.autoUpgradeToggle?.addEventListener('click', () => {
    setAutoUpgradeEnabled(!autoUpgradeState.enabled);
    refreshAutoUpgradeToggleUI();
    syncAutoUpgradePreference();
  });

  function isOpen() {
    return !panel.hidden;
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  function onOutsidePointer(event) {
    if (!panel.contains(event.target) && event.target !== trigger) {
      close({ returnFocus: false, focusTarget: event.target });
    }
  }

  function open() {
    if (game.upgradeModalOpen || closing) return;
    clearTimeout(hideTimer);
    wasPausedBeforeSettings = game.paused;
    wasPausedBySettings = game.running && !game.paused;
    if (game.running) setPaused(true, false, false, { showOverlay: false });

    refreshSoundToggleUI();
    refreshMusicToggleUI();
    refreshHapticsToggleUI();
    refreshAutoUpgradeToggleUI();

    panel.hidden = false;
    if (backdrop) backdrop.hidden = false;
    requestAnimationFrame(() => {
      panel.classList.add('show');
      if (backdrop) backdrop.classList.add('show');
    });
    trigger.setAttribute('aria-expanded', 'true');
    releaseFocusTrap = activateFocusTrap(panel, {
      initialFocus: dom.soundToggle,
      fallbackFocus: trigger
    });
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('pointerdown', onOutsidePointer, true);
  }

  function close({ returnFocus = true, focusTarget = null } = {}) {
    if (closing || panel.hidden) return;
    closing = true;
    clearTimeout(hideTimer);
    panel.classList.remove('show');
    if (backdrop) backdrop.classList.remove('show');
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('pointerdown', onOutsidePointer, true);

    const resumeGame = wasPausedBySettings;
    const restorePausedOverlay = wasPausedBeforeSettings;
    wasPausedBySettings = false;
    wasPausedBeforeSettings = false;
    hideTimer = setTimeout(() => {
      panel.hidden = true;
      if (backdrop) backdrop.hidden = true;
      releaseFocusTrap?.({ restoreFocus: false });
      releaseFocusTrap = null;

      const pointerTargetSelector = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
      const pointerTarget = focusTarget?.matches?.(pointerTargetSelector) && focusTarget.getClientRects().length
        ? focusTarget
        : trigger;
      const returnTarget = returnFocus ? trigger : pointerTarget;
      returnTarget.focus({ preventScroll: true });
      if (resumeGame && game.running) {
        setPaused(false, false, false, { showOverlay: false });
      } else if (restorePausedOverlay && game.running) {
        setPaused(true, false, false, { showOverlay: true });
      }
      closing = false;
    }, CLOSE_TRANSITION_MS);
  }

  trigger.addEventListener('click', () => {
    isOpen() ? close() : open();
  });
  backdrop?.addEventListener('click', () => close({ returnFocus: false }));
}
