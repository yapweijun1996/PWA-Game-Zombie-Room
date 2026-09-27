import assert from 'node:assert/strict';
import test from 'node:test';
import { withBrowser, waitFor, requireBrowser, skipReason } from './browser-harness.mjs';

const browserOptions = { skip: requireBrowser ? false : skipReason, timeout: 30000 };

test('touch anywhere steers, settings stay on toggles, and timed upgrade choice is optional', browserOptions, async () => {
  await withBrowser(async (cdp, url) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await cdp.send('Page.navigate', { url: `${url}/?playtestSeed=42&playtestManual=1&playtestLimit=0` });
    await waitFor(cdp.evaluate.bind(cdp), 'Boolean(window.__zombieRoomPlaytestTools)', Boolean);

    const touchPoints = [
      { id: 1, x: 72, y: 238, radiusX: 1, radiusY: 1, force: 1 },
      { id: 2, x: 290, y: 588, radiusX: 1, radiusY: 1, force: 1 }
    ];
    for (const point of touchPoints) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      const started = await cdp.evaluate(`(async () => {
        const { input } = await import('./src/state.js');
        const base = document.querySelector('#joystickBase');
        const zone = document.querySelector('#joystickZone').getBoundingClientRect();
        return { active: input.active, left: parseFloat(base.style.left), top: parseFloat(base.style.top), zone: { left: zone.left, top: zone.top, width: zone.width, height: zone.height } };
      })()`);
      assert.equal(started.active, true, `touch at ${point.x},${point.y} should start movement`);
      assert.equal(started.left, point.x);
      assert.equal(started.top, point.y);
      assert.ok(started.zone.left <= 0 && started.zone.top <= 0 && started.zone.width >= 390 && started.zone.height >= 844);

      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ ...point, x: point.x + 40 }]
      });
      const moved = await cdp.evaluate(`import('./src/state.js').then(({ input }) => ({ active: input.active, vx: input.vx, right: input.right }))`);
      assert.equal(moved.active, true);
      assert.ok(moved.vx > 0.9 && moved.right, 'dragging from the touch origin should move right');

      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const ended = await cdp.evaluate(`import('./src/state.js').then(({ input }) => ({ active: input.active, vx: input.vx, vy: input.vy }))`);
      assert.deepEqual(ended, { active: false, vx: 0, vy: 0 });
    }

    const audioUnlock = await cdp.evaluate(`(async () => {
      const { getAudioContext, resumeAudioContext } = await import('./src/audio.js');
      const { isMusicScheduled } = await import('./src/music.js');
      await resumeAudioContext({ force: true });
      return { state: getAudioContext()?.state, musicScheduled: isMusicScheduled() };
    })()`);
    assert.equal(audioUnlock.state, 'running', 'a touch gesture should unlock Web Audio');
    assert.equal(audioUnlock.musicScheduled, true, 'background music should start after the first touch gesture');

    const settings = await cdp.evaluate(`(async () => {
      const { musicState, audioState } = await import('./src/state.js');
      const { isHapticsSupported } = await import('./src/haptics.js');
      document.querySelector('#settingsTrigger').click();
      return {
        focused: document.activeElement.id,
        language: document.querySelector('#languageSelect').value,
        musicOn: musicState.enabled,
        soundOn: audioState.enabled,
        hapticsSupported: isHapticsSupported(),
        hapticsDisabled: document.querySelector('#hapticsToggle').disabled,
        hapticsNoteHidden: document.querySelector('#hapticsAvailabilityNote').hidden
      };
    })()`);
    assert.equal(settings.focused, 'soundToggle');
    assert.equal(settings.language, 'en', 'opening settings must not change or open the language picker');
    assert.equal(settings.musicOn, true);
    assert.equal(settings.soundOn, true);
    assert.equal(settings.hapticsDisabled, !settings.hapticsSupported);
    assert.equal(settings.hapticsNoteHidden, settings.hapticsSupported);

    await cdp.evaluate("document.querySelector('#musicToggle').click()");
    const musicOff = await cdp.evaluate(`import('./src/state.js').then(({ musicState }) => ({ enabled: musicState.enabled, stored: localStorage.getItem('zombie-room-music') }))`);
    assert.deepEqual(musicOff, { enabled: false, stored: 'false' });
    assert.equal(await cdp.evaluate("import('./src/music.js').then(({ isMusicScheduled }) => isMusicScheduled())"), false);
    await cdp.evaluate("document.querySelector('#musicToggle').click()");
    const musicOn = await waitFor(
      cdp.evaluate.bind(cdp),
      `import('./src/state.js').then(async ({ musicState }) => ({ enabled: musicState.enabled, stored: localStorage.getItem('zombie-room-music'), scheduled: (await import('./src/music.js')).isMusicScheduled() }))`,
      value => value?.scheduled === true
    );
    assert.deepEqual(musicOn, { enabled: true, stored: 'true', scheduled: true });
    await cdp.evaluate("document.querySelector('#settingsTrigger').click()");
    await waitFor(cdp.evaluate.bind(cdp), "document.querySelector('#settingsPanel').hidden", Boolean);

    const disabledAuto = await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      const { openUpgradeModal } = await import('./src/entities.js');
      const { setAutoUpgradeEnabled } = await import('./src/state.js');
      const { resetGame } = await import('./src/entities.js');
      resetGame();
      setAutoUpgradeEnabled(false);
      game.pendingUpgrades = 1;
      openUpgradeModal();
      return { open: game.upgradeModalOpen, checked: document.querySelector('#upgradeAutoToggle').checked, progressHidden: document.querySelector('#upgradeAutoProgress').hidden };
    })()`);
    assert.deepEqual(disabledAuto, { open: true, checked: false, progressHidden: true });
    await new Promise(resolve => setTimeout(resolve, 3200));
    assert.equal(await cdp.evaluate("import('./src/state.js').then(({ game }) => game.upgradeModalOpen)"), true,
      'disabling auto-pick in the upgrade dialog should leave the choices open');
    await cdp.evaluate("document.querySelector('#upgradeCards button').click()");
    await waitFor(cdp.evaluate.bind(cdp), "document.querySelector('#upgradeModal').hidden", Boolean);

    await cdp.evaluate("document.querySelector('#settingsTrigger').click()");
    const autoSetting = await cdp.evaluate(`(() => {
      const toggle = document.querySelector('#autoUpgradeToggle');
      const values = [];
      toggle.click(); values.push(toggle.getAttribute('aria-checked'));
      toggle.click(); values.push(toggle.getAttribute('aria-checked'));
      return { values, stored: localStorage.getItem('zombie-room-auto-upgrade') };
    })()`);
    assert.deepEqual(autoSetting, { values: ['true', 'false'], stored: 'false' });
    await cdp.evaluate("document.querySelector('#autoUpgradeToggle').click(); document.querySelector('#settingsTrigger').click()");
    await waitFor(cdp.evaluate.bind(cdp), "document.querySelector('#settingsPanel').hidden", Boolean);

    const enabledAuto = await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      const { openUpgradeModal } = await import('./src/entities.js');
      game.pendingUpgrades = 1;
      openUpgradeModal();
      return { checked: document.querySelector('#upgradeAutoToggle').checked, progressHidden: document.querySelector('#upgradeAutoProgress').hidden, countdown: document.querySelector('#upgradeAutoCountdown').textContent };
    })()`);
    assert.equal(enabledAuto.checked, true);
    const countdown = await waitFor(
      cdp.evaluate.bind(cdp),
      `(() => ({ hidden: document.querySelector('#upgradeAutoProgress').hidden, text: document.querySelector('#upgradeAutoCountdown').textContent }))()`,
      value => value && !value.hidden
    );
    assert.match(countdown.text, /3/);
    const autoChoice = await waitFor(
      cdp.evaluate.bind(cdp),
      `import('./src/state.js').then(({ game }) => ({ open: game.upgradeModalOpen, pending: game.pendingUpgrades, selected: window.__zombieRoomPlaytest.upgrades.at(-1)?.id }))`,
      value => value && !value.open,
      5000
    );
    assert.equal(autoChoice.pending, 0);
    assert.ok(autoChoice.selected, 'automatic choice should use the existing recorded upgrade path');
    assert.equal(await cdp.evaluate("localStorage.getItem('zombie-room-auto-upgrade')"), 'true');
    assert.deepEqual(cdp.runtimeExceptions, []);
  });
});
