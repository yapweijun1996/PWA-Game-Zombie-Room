const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const activeTraps = [];

function isVisible(element) {
  return Boolean(element && !element.disabled && !element.hidden &&
    !element.closest('[hidden]') && element.getAttribute('aria-hidden') !== 'true' &&
    element.getClientRects().length);
}

function getFocusableElements(container) {
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(isVisible);
}

function syncModalSemantics() {
  const topTrap = activeTraps[activeTraps.length - 1];
  for (const trap of activeTraps) {
    if (trap.container.getAttribute('role') === 'dialog' && trap.originalAriaModal !== null) {
      trap.container.setAttribute('aria-modal', trap === topTrap ? 'true' : 'false');
    }
  }
}

function focusElement(element) {
  if (isVisible(element) && typeof element.focus === 'function' &&
    (element.matches(FOCUSABLE_SELECTOR) || element.isContentEditable)) {
    element.focus({ preventScroll: true });
    return true;
  }
  return false;
}

export function activateFocusTrap(container, { initialFocus, fallbackFocus } = {}) {
  if (!container) return () => {};

  const trap = {
    container,
    previousFocus: document.activeElement,
    fallbackFocus,
    originalAriaModal: container.getAttribute('aria-modal'),
    onKeydown: null,
    onFocusIn: null
  };

  trap.onKeydown = event => {
    if (activeTraps[activeTraps.length - 1] !== trap || event.key !== 'Tab') return;
    const focusable = getFocusableElements(container);
    if (!focusable.length) {
      event.preventDefault();
      container.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement;
    if (event.shiftKey && (activeElement === first || !container.contains(activeElement))) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && (activeElement === last || !container.contains(activeElement))) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  trap.onFocusIn = event => {
    if (activeTraps[activeTraps.length - 1] !== trap || container.contains(event.target)) return;
    const focusable = getFocusableElements(container);
    (focusable[0] || container).focus({ preventScroll: true });
  };

  activeTraps.push(trap);
  document.addEventListener('keydown', trap.onKeydown, true);
  document.addEventListener('focusin', trap.onFocusIn, true);
  syncModalSemantics();

  const requestedFocus = typeof initialFocus === 'string'
    ? container.querySelector(initialFocus)
    : initialFocus;
  const focusable = getFocusableElements(container);
  if (!focusElement(requestedFocus)) focusElement(focusable[0] || container);

  let active = true;
  return ({ restoreFocus = true } = {}) => {
    if (!active) return;
    active = false;
    document.removeEventListener('keydown', trap.onKeydown, true);
    document.removeEventListener('focusin', trap.onFocusIn, true);
    const index = activeTraps.indexOf(trap);
    if (index !== -1) activeTraps.splice(index, 1);
    if (trap.originalAriaModal === null) container.removeAttribute('aria-modal');
    else container.setAttribute('aria-modal', trap.originalAriaModal);
    syncModalSemantics();

    if (restoreFocus && !focusElement(trap.previousFocus)) {
      focusElement(trap.fallbackFocus);
    }
  };
}
