import { input, keyMap, game } from './state.js';
import { togglePause, chooseUpgrade } from './entities.js';
import { isPlaytestReplaying, recordPlaytestInput } from './playtest.js';

let resetInputHandler = () => {};

export function resetInputState() {
  resetInputHandler();
}

function recordInputState() {
  recordPlaytestInput(input);
}

export function initInput(onRestart) {
  function setKeyboardInput(dir, pressed) {
    if (!Object.prototype.hasOwnProperty.call(input, dir)) return;
    if (pressed && !game.running) onRestart();
    input[dir] = pressed;
    recordInputState();
  }

  addEventListener('keydown', e => {
    if (isPlaytestReplaying()) {
      const key = e.key.toLowerCase();
      if (keyMap[key] || ['1', '2', '3', 'p', 'escape'].includes(key)) e.preventDefault();
      return;
    }
    if (game.upgradeModalOpen) {
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        e.preventDefault();
        chooseUpgrade(parseInt(e.key, 10) - 1);
      }
      return;
    }
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && game.running) {
      const panel = document.getElementById('settingsPanel');
      // While settings is open it owns pause state (auto-pauses on open, restores
      // on close); let its own Escape handler close it and ignore 'p' entirely so
      // the two pause sources can't desync.
      if (panel && !panel.hidden) return;
      e.preventDefault();
      togglePause();
      return;
    }
    const dir = keyMap[e.key.toLowerCase()];
    if (!dir) return;
    e.preventDefault();
    setKeyboardInput(dir, true);
  }, { passive: false });

  addEventListener('keyup', e => {
    if (isPlaytestReplaying()) return;
    const dir = keyMap[e.key.toLowerCase()];
    if (!dir) return;
    e.preventDefault();
    setKeyboardInput(dir, false);
  }, { passive: false });

  const zone = document.getElementById('joystickZone');
  const base = document.getElementById('joystickBase');
  const knob = document.getElementById('joystickKnob');
  let releaseJoystick = null;

  if (zone && base && knob) {
    const MAX_RADIUS = 36;
    let activePointerId = null;
    let originX = 0;
    let originY = 0;

    function resetJoystick() {
      activePointerId = null;
      input.active = false;
      input.vx = 0;
      input.vy = 0;
      input.up = false;
      input.down = false;
      input.left = false;
      input.right = false;
      knob.style.transition = 'transform .18s ease-out';
      knob.style.transform = 'translate(0px, 0px)';
      base.classList.remove('active');
      base.style.left = '';
      base.style.top = '';
    }

    function onPointerDown(e) {
      if (isPlaytestReplaying()) { e.preventDefault(); return; }
      if (activePointerId !== null || game.upgradeModalOpen) return;
      if (!game.running) {
        onRestart();
        return;
      }
      e.preventDefault();
      activePointerId = e.pointerId;
      try { zone.setPointerCapture(e.pointerId); } catch (_) {}

      const zoneRect = zone.getBoundingClientRect();
      originX = e.clientX;
      originY = e.clientY;

      const localX = originX - zoneRect.left;
      const localY = originY - zoneRect.top;

      base.style.left = localX + 'px';
      base.style.top = localY + 'px';
      base.classList.add('active');
      knob.style.transition = 'none';
      knob.style.transform = 'translate(0px, 0px)';
      input.active = true;
      recordInputState();
    }

    function onPointerMove(e) {
      if (isPlaytestReplaying()) { e.preventDefault(); return; }
      if (e.pointerId !== activePointerId) return;
      e.preventDefault();
      const dx = e.clientX - originX;
      const dy = e.clientY - originY;
      const dist = Math.hypot(dx, dy);

      const clampedDist = Math.min(dist, MAX_RADIUS);
      const angle = dist > 0 ? Math.atan2(dy, dx) : 0;

      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      knob.style.transform = `translate(${knobX}px, ${knobY}px)`;

      const power = clampedDist / MAX_RADIUS;
      input.vx = Math.cos(angle) * power;
      input.vy = Math.sin(angle) * power;

      input.left = input.vx < -0.3;
      input.right = input.vx > 0.3;
      input.up = input.vy < -0.3;
      input.down = input.vy > 0.3;
      recordInputState();
    }

    function onPointerEnd(e) {
      if (isPlaytestReplaying()) { e.preventDefault(); return; }
      if (e.pointerId !== activePointerId) return;
      e.preventDefault();
      try { zone.releasePointerCapture(e.pointerId); } catch (_) {}
      resetJoystick();
      recordInputState();
    }

    zone.addEventListener('pointerdown', onPointerDown, { passive: false });
    zone.addEventListener('pointermove', onPointerMove, { passive: false });
    zone.addEventListener('pointerup', onPointerEnd, { passive: false });
    zone.addEventListener('pointercancel', onPointerEnd, { passive: false });
    zone.addEventListener('lostpointercapture', onPointerEnd, { passive: false });
    zone.addEventListener('contextmenu', e => e.preventDefault());

    releaseJoystick = resetJoystick;
  }

  function clearMovementInput() {
    input.up = false;
    input.down = false;
    input.left = false;
    input.right = false;
    input.vx = 0;
    input.vy = 0;
    input.active = false;
    if (releaseJoystick) releaseJoystick();
    recordInputState();
  }

  resetInputHandler = clearMovementInput;
  addEventListener('blur', () => {
    if (!isPlaytestReplaying()) clearMovementInput();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !isPlaytestReplaying()) clearMovementInput();
  });
}
