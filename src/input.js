import { input, keyMap, game } from './state.js';

export function initInput(onRestart) {
  function setInput(dir, pressed) {
    if (!Object.prototype.hasOwnProperty.call(input, dir)) return;
    if (pressed && !game.running) onRestart();
    input[dir] = pressed;
    const button = document.querySelector('[data-key="' + dir + '"]');
    if (button) button.classList.toggle('active', pressed);
  }

  addEventListener('keydown', e => {
    const dir = keyMap[e.key.toLowerCase()];
    if (!dir) return;
    e.preventDefault();
    setInput(dir, true);
  }, { passive: false });

  addEventListener('keyup', e => {
    const dir = keyMap[e.key.toLowerCase()];
    if (!dir) return;
    e.preventDefault();
    setInput(dir, false);
  }, { passive: false });

  document.querySelectorAll('.dpad button').forEach(button => {
    const dir = button.dataset.key;
    const down = e => {
      e.preventDefault();
      try { button.setPointerCapture(e.pointerId); } catch (_) {}
      setInput(dir, true);
    };
    const up = e => {
      e.preventDefault();
      setInput(dir, false);
    };
    button.addEventListener('pointerdown', down, { passive: false });
    button.addEventListener('pointerup', up, { passive: false });
    button.addEventListener('pointercancel', up, { passive: false });
    button.addEventListener('lostpointercapture', up, { passive: false });
    button.addEventListener('contextmenu', e => e.preventDefault());
  });

  addEventListener('blur', () => Object.keys(input).forEach(k => setInput(k, false)));
}
