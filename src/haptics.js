import { hapticsState } from './state.js';

function vibrate(pattern) {
  if (!hapticsState.enabled) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch (_) {}
  }
}

export function vibrateHit() {
  vibrate(45);
}

export function vibrateCrit() {
  vibrate([15, 30, 20]);
}

export function vibrateLevelUp() {
  vibrate([25, 35, 30, 35, 45]);
}

export function vibrateBoss() {
  vibrate([60, 50, 70]);
}

export function vibrateDeath() {
  vibrate(120);
}

export function vibrateUi() {
  vibrate(12);
}

export function vibrateNuke() {
  vibrate([80, 40, 110]);
}

export function vibrateOverdrive() {
  vibrate([20, 25, 20, 25, 35]);
}

export function vibrateCombo() {
  vibrate([18, 30, 25]);
}
