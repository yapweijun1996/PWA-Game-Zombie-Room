const CLOSE_TRANSITION_MS = 220;

export function initSettingsMenu() {
  const trigger = document.getElementById('settingsTrigger');
  const panel = document.getElementById('settingsPanel');
  const backdrop = document.getElementById('settingsBackdrop');
  if (!trigger || !panel) return;

  let hideTimer = 0;

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
    clearTimeout(hideTimer);
    panel.hidden = false;
    if (backdrop) backdrop.hidden = false;
    requestAnimationFrame(() => {
      panel.classList.add('show');
      if (backdrop) backdrop.classList.add('show');
    });
    trigger.setAttribute('aria-expanded', 'true');
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
