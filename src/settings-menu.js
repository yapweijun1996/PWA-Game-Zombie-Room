import { game, dom, audioState, hapticsState } from './state.js';
import { setPaused } from './entities.js';
import { t } from './i18n.js';
import { playUiClick } from './audio.js';
import { vibrateUi } from './haptics.js';

const CLOSE_TRANSITION_MS = 220;

export function refreshSoundToggleUI() {
  if (!dom.soundToggle || !dom.soundStatusText) return;
  dom.soundToggle.classList.toggle('active', audioState.enabled);
  dom.soundToggle.setAttribute('aria-checked', String(audioState.enabled));
  dom.soundStatusText.textContent = audioState.enabled ? t('soundOn') : t('soundOff');
}

export function refreshHapticsToggleUI() {
  if (!dom.hapticsToggle || !dom.hapticsStatusText) return;
  dom.hapticsToggle.classList.toggle('active', hapticsState.enabled);
  dom.hapticsToggle.setAttribute('aria-checked', String(hapticsState.enabled));
  dom.hapticsStatusText.textContent = hapticsState.enabled ? t('soundOn') : t('soundOff');
}

export function initSettingsMenu() {
  const trigger = document.getElementById('settingsTrigger');
  const panel = document.getElementById('settingsPanel');
  const backdrop = document.getElementById('settingsBackdrop');
  if (!trigger || !panel) return;

  let hideTimer = 0;
  let wasPausedBySettings = false;

  refreshSoundToggleUI();
  dom.soundToggle?.addEventListener('click', () => {
    audioState.enabled = !audioState.enabled;
    try {
      localStorage.setItem('zombie-room-sound', String(audioState.enabled));
    } catch (_) {}
    refreshSoundToggleUI();
    if (audioState.enabled) playUiClick();
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

  function isOpen() {
    return !panel.hidden;
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  function onOutsidePointer(e) {
    if (!panel.contains(e.target) && e.target !== trigger) close({ returnFocus: false });
  }

  function open() {
    if (game.upgradeModalOpen) return;
    clearTimeout(hideTimer);
    panel.hidden = false;
    if (backdrop) backdrop.hidden = false;
    requestAnimationFrame(() => {
      panel.classList.add('show');
      if (backdrop) backdrop.classList.add('show');
    });
    trigger.setAttribute('aria-expanded', 'true');
    if (game.running && !game.paused) {
      wasPausedBySettings = true;
      setPaused(true);
    }
    const focusable = panel.querySelector('select, button, [href], input, [tabindex]');
    focusable?.focus();
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('pointerdown', onOutsidePointer, true);
  }

  function close({ returnFocus = true } = {}) {
    clearTimeout(hideTimer);
    panel.classList.remove('show');
    if (backdrop) backdrop.classList.remove('show');
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('pointerdown', onOutsidePointer, true);
    if (wasPausedBySettings) {
      wasPausedBySettings = false;
      if (game.running) setPaused(false);
    }
    hideTimer = setTimeout(() => {
      panel.hidden = true;
      if (backdrop) backdrop.hidden = true;
    }, CLOSE_TRANSITION_MS);
    if (returnFocus) trigger.focus();
  }

  trigger.addEventListener('click', () => {
    isOpen() ? close() : open();
  });
  backdrop?.addEventListener('click', () => close({ returnFocus: false }));
}
