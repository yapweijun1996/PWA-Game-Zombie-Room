import { hapticsState } from './state.js';

let userHasInteracted = false;

if (typeof window !== 'undefined') {
  const onUserGesture = () => {
    userHasInteracted = true;
    window.removeEventListener('pointerdown', onUserGesture);
    window.removeEventListener('keydown', onUserGesture);
    window.removeEventListener('touchstart', onUserGesture);
  };
  window.addEventListener('pointerdown', onUserGesture, { passive: true });
  window.addEventListener('keydown', onUserGesture, { passive: true });
  window.addEventListener('touchstart', onUserGesture, { passive: true });
}

function hasUserActivation() {
  if (typeof navigator !== 'undefined' && navigator.userActivation) {
    return navigator.userActivation.hasBeenActive;
  }
  return userHasInteracted;
}

function vibrate(pattern) {
  if (!hapticsState.enabled) return;
  if (!hasUserActivation()) return;
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
