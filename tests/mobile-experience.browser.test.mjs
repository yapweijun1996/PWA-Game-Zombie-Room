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
      const { setAutoUpgradeEnabled } = await import('./src/state.js');
      const { openUpgradeModal } = await import('./src/entities.js');
      setAutoUpgradeEnabled(false);
      game.pendingUpgrades = 1;
      openUpgradeModal();
      return { checked: document.querySelector('#upgradeAutoToggle').checked, progressHidden: document.querySelector('#upgradeAutoProgress').hidden, countdown: document.querySelector('#upgradeAutoCountdown').textContent };
    })()`);
    assert.equal(enabledAuto.checked, false);
    assert.equal(enabledAuto.progressHidden, true);
    await cdp.evaluate(`(() => {
      const toggle = document.querySelector('#upgradeAutoToggle');
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
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

test('upgrade choices are skipped by default and the dialog can opt in to skipping all', browserOptions, async () => {
  await withBrowser(async (cdp, url) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    // An ordinary session: seeded playtests keep the dialog for synthetic controllers.
    await cdp.send('Page.navigate', { url: `${url}/` });
    await waitFor(cdp.evaluate.bind(cdp), "document.readyState === 'complete' && Boolean(document.querySelector('#upgradeSkipToggle'))", Boolean);
    const skipped = await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      const { resetGame, openUpgradeModal } = await import('./src/entities.js');
      resetGame();
      const before = Object.values(game.player.upgrades).reduce((sum, level) => sum + (level || 0), 0);
      game.pendingUpgrades = 2;
      openUpgradeModal();
      const after = Object.values(game.player.upgrades).reduce((sum, level) => sum + (level || 0), 0);
      return { toggle: document.querySelector('#upgradeSkipToggle').getAttribute('aria-checked'), open: game.upgradeModalOpen,
        hidden: document.querySelector('#upgradeModal').hidden, pending: game.pendingUpgrades, gained: after > before, paused: game.paused };
    })()`);
    assert.deepEqual(skipped, { toggle: 'true', open: false, hidden: true, pending: 0, gained: true, paused: false });

    const smartPicks = await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      const { resetGame, openUpgradeModal, pickAutomaticUpgradeIndex, UPGRADES, EVOLUTIONS } = await import('./src/entities.js');
      resetGame();
      game.player.level = 4; game.pendingUpgrades = 1;
      openUpgradeModal();
      const path = game.player.build.path;
      const byId = id => UPGRADES.find(u => u.id === id);
      game.player.build.path = 'scatter';
      const towardEvolution = pickAutomaticUpgradeIndex([byId('magnet'), byId('vitality'), byId('rapidFire')], game.player);
      const evolutionFirst = pickAutomaticUpgradeIndex([EVOLUTIONS[1], byId('rapidFire')], game.player);
      return { path, towardEvolution, evolutionFirst, autoToggleDisabled: document.querySelector('#autoUpgradeToggle').disabled };
    })()`);
    assert.ok(['arc', 'scatter', 'mobility'].includes(smartPicks.path), 'skipping a path choice must still pick a path');

    const death = await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      const { resetGame, update } = await import('./src/entities.js');
      resetGame();
      const p = game.player;
      Object.assign(p, { hp: 1, shield: 0, invuln: 0 });
      game.zombies.push({ x: p.x, y: p.y, r: 13, type: 'walker', hp: 99, maxHp: 99, speed: 0, damage: 50, color: '#79b86a', xp: 1, score: 10, hitFlash: 0, attackFlash: 0, walkTime: 0, facing: 0, affix: null });
      update(1 / 60);
      const key = repeat => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', repeat, bubbles: true, cancelable: true }));
      key(false); key(true);
      return { dead: !game.running, stillOnDefeatScreen: !game.running, cause: document.querySelector('#gameoverCause').textContent, nextRank: document.querySelector('#gameoverNextRank').textContent };
    })()`);
    assert.equal(death.nextRank, '75s more for RANK B (1:15)', 'the defeat screen names the next rank target');
    delete death.nextRank;
    assert.equal(death.cause, 'Killed by Walker\nMost damage: Walker 100%', 'the defeat screen names the lethal hit and the largest damage share');
    delete death.cause;
    assert.deepEqual(death, { dead: true, stillOnDefeatScreen: true }, 'a key pressed at death must not skip the defeat screen');
    await new Promise(resolve => setTimeout(resolve, 1300));
    const restarted = await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', repeat: true, bubbles: true, cancelable: true }));
      const afterRepeat = game.running;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', bubbles: true, cancelable: true }));
      return { afterRepeat, afterPress: game.running };
    })()`);
    assert.deepEqual(restarted, { afterRepeat: false, afterPress: true }, 'a fresh key press restarts after the grace period');
    assert.deepEqual({ ...smartPicks, path: undefined }, { path: undefined, towardEvolution: 2, evolutionFirst: 0, autoToggleDisabled: true });

    const dialog = await cdp.evaluate(`(async () => {
      const { game, setUpgradeSkipEnabled } = await import('./src/state.js');
      const { openUpgradeModal } = await import('./src/entities.js');
      setUpgradeSkipEnabled(false);
      game.pendingUpgrades = 2;
      openUpgradeModal();
      return { open: game.upgradeModalOpen, buttonVisible: Boolean(document.querySelector('#upgradeSkipButton')?.offsetParent) };
    })()`);
    assert.deepEqual(dialog, { open: true, buttonVisible: true });
    await cdp.evaluate("document.querySelector('#upgradeSkipButton').click()");
    const afterSkipAll = await cdp.evaluate(`import('./src/state.js').then(({ game, upgradeSkipState }) => ({
      open: game.upgradeModalOpen, hidden: document.querySelector('#upgradeModal').hidden, pending: game.pendingUpgrades,
      enabled: upgradeSkipState.enabled, stored: localStorage.getItem('zombie-room-upgrade-skip') }))`);
    assert.deepEqual(afterSkipAll, { open: false, hidden: true, pending: 0, enabled: true, stored: 'true' });

    await cdp.evaluate("document.querySelector('#settingsTrigger').click()");
    await waitFor(cdp.evaluate.bind(cdp), "!document.querySelector('#settingsPanel').hidden", Boolean);
    const toggled = await cdp.evaluate(`(() => {
      document.querySelector('#upgradeSkipToggle').click();
      return { checked: document.querySelector('#upgradeSkipToggle').getAttribute('aria-checked'), stored: localStorage.getItem('zombie-room-upgrade-skip') };
    })()`);
    assert.deepEqual(toggled, { checked: 'false', stored: 'false' });
    const reenabled = await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      const { openUpgradeModal } = await import('./src/entities.js');
      game.pendingUpgrades = 1;
      openUpgradeModal();
      const openedWhileOff = game.upgradeModalOpen;
      document.querySelector('#upgradeSkipToggle').click();
      return { openedWhileOff, open: game.upgradeModalOpen, pending: game.pendingUpgrades };
    })()`);
    assert.deepEqual(reenabled, { openedWhileOff: true, open: false, pending: 0 }, 'enabling skip in Settings resolves an open dialog');
    assert.deepEqual(cdp.runtimeExceptions, []);
  });
});

test('narrow HUD keeps every visible value whole, badges clear the HUD, and the defeat screen hides controls', browserOptions, async () => {
  await withBrowser(async (cdp, url) => {
    for (const width of [360, 390]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: true });
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
      await cdp.send('Page.navigate', { url: `${url}/?playtestSeed=42&playtestManual=1&playtestLimit=0` });
      await waitFor(cdp.evaluate.bind(cdp), 'typeof window.advanceTime === "function"', Boolean);
      const layout = await cdp.evaluate(`(async () => {
        const { game } = await import('./src/state.js');
        const { updateUI } = await import('./src/ui.js');
        const problems = [];
        for (const locale of ['en', 'zh', 'ms', 'ja', 'ko', 'vi', 'th']) {
          const select = document.querySelector('#languageSelect'); select.value = locale; select.dispatchEvent(new Event('change'));
          Object.assign(game.player, { hp: 225, maxHp: 225, level: 34, xp: 120, xpNeed: 135, shield: 40 });
          Object.assign(game, { wave: 12, kills: 1234, score: 123456, elapsed: 299, combo: 30, comboTimer: 2 });
          game.player.build.path = 'scatter';
          updateUI();
          await new Promise(requestAnimationFrame);
          for (const selector of ['#hpText', '#shieldText', '#levelText', '#waveText', '#encounterText', '#killsText', '#timeText', '#rankTargetText', '#scoreText']) {
            const element = document.querySelector(selector);
            if (element.scrollWidth > element.clientWidth + 1) problems.push(locale + ' ' + selector + ' clipped');
          }
          const hp = document.querySelector('.meter-hp .value').getBoundingClientRect();
          const xp = document.querySelector('.meter-xp .label').getBoundingClientRect();
          if (hp.right > xp.left) problems.push(locale + ' HP overlaps XP');
          if (!document.querySelector('.meter-hp .label').textContent.trim()) problems.push(locale + ' HP label missing for screen readers');
        }
        const badge = document.querySelector('#comboBadge');
        badge.hidden = false;
        const clearsHud = badge.getBoundingClientRect().top >= document.querySelector('#hud').getBoundingClientRect().bottom;
        badge.hidden = true;
        return { problems, clearsHud };
      })()`);
      assert.deepEqual(layout, { problems: [], clearsHud: true }, `${width}px HUD layout`);
    }
    const defeat = await cdp.evaluate(`(async () => {
      const { showGameOver, hideGameOver } = await import('./src/game-ui.js');
      showGameOver({ score: 10, combo: 2, wave: 3, kills: 4, elapsed: 60, isNewBest: false, rank: 'C', player: { superWeapons: {}, build: {} }, upgrades: [], performanceMode: false });
      const hidden = getComputedStyle(document.querySelector('#controlsWrap')).visibility === 'hidden';
      const label = document.querySelector('.gameover-stat-label').textContent;
      hideGameOver();
      return { hidden, label: Boolean(label), restored: getComputedStyle(document.querySelector('#controlsWrap')).visibility === 'visible' };
    })()`);
    assert.deepEqual(defeat, { hidden: true, label: true, restored: true });
    assert.deepEqual(cdp.runtimeExceptions, []);
  });
});

test('pressure waves get a red edge warning and build picks get a centred banner', browserOptions, async () => {
  await withBrowser(async (cdp, url) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.send('Page.navigate', { url: `${url}/?playtestSeed=42&playtestManual=1&playtestLimit=0` });
    await waitFor(cdp.evaluate.bind(cdp), 'typeof window.advanceTime === "function"', Boolean);
    const result = await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      const { openUpgradeModal, chooseUpgrade } = await import('./src/entities.js');
      game.player.invuln = 100;
      // Wave 2 is a pressure wave; its warning starts three seconds before it.
      game.elapsed = 22.2;
      window.advanceTime(100);
      const vignette = document.querySelector('#surgeVignette').classList.contains('show');
      const message = document.querySelector('#message').textContent;
      window.advanceTime(3500);
      const cleared = !document.querySelector('#surgeVignette').classList.contains('show');
      game.player.level = 4; game.pendingUpgrades = 1;
      openUpgradeModal();
      chooseUpgrade(0);
      const banner = document.querySelector('#buildBanner');
      const shown = !banner.hidden && banner.querySelector('small').textContent === 'PATH';
      window.advanceTime(2200);
      return { vignette, surgeText: message.startsWith('⚠'), cleared, shown, hiddenAgain: banner.hidden, rankTarget: document.querySelector('#rankTargetText').textContent };
    })()`);
    assert.deepEqual(result, { vignette: true, surgeText: true, cleared: true, shown: true, hiddenAgain: true, rankTarget: '→B 1:15' });
    assert.deepEqual(cdp.runtimeExceptions, []);
  });
});

test('difficulty modes, first-run coaching and the share image card', browserOptions, async () => {
  await withBrowser(async (cdp, url) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await cdp.send('Page.navigate', { url: `${url}/` });
    await waitFor(cdp.evaluate.bind(cdp), "document.readyState === 'complete' && Boolean(document.querySelector('[data-difficulty-picker] button'))", Boolean);
    const coach = await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      const { update, setPaused } = await import('./src/entities.js');
      setPaused(false, true);
      const first = document.querySelector('#hintCoach').textContent;
      const coaching = document.querySelector('#hintPill').classList.contains('coaching');
      for (let i = 0; i < 60 * 25 && game.running; i++) { game.player.invuln = 1; update(1 / 60); }
      return { first, coaching, done: localStorage.getItem('zombie-room-coached'), hidden: document.querySelector('#hintPill').classList.contains('hide') };
    })()`);
    assert.match(coach.first, /^1\/4 · /);
    assert.deepEqual({ ...coach, first: undefined }, { first: undefined, coaching: true, done: 'true', hidden: true });

    const modes = await cdp.evaluate(`(async () => {
      const { game, scoreState, saveBestScore } = await import('./src/state.js');
      const { resetGame } = await import('./src/entities.js');
      const pickers = [...document.querySelectorAll('[data-difficulty-picker]')];
      const initial = pickers.map(picker => picker.querySelector('[aria-pressed="true"]').dataset.mode);
      localStorage.setItem('zombie-room-best', '500');
      pickers[0].querySelector('[data-mode="nightmare"]').click();
      const synced = pickers.every(picker => picker.querySelector('[aria-pressed="true"]').dataset.mode === 'nightmare');
      resetGame();
      const applied = { run: game.difficulty, director: game.director.mode, best: scoreState.best };
      saveBestScore(120, 'test');
      const stored = { nightmare: localStorage.getItem('zombie-room-best-nightmare'), hard: localStorage.getItem('zombie-room-best') };
      pickers[0].querySelector('[data-mode="hard"]').click();
      resetGame();
      return { initial, synced, applied, stored, hardBest: scoreState.best, saved: localStorage.getItem('zombie-room-difficulty') };
    })()`);
    assert.deepEqual(modes, {
      initial: ['nightmare', 'nightmare'], synced: true,
      applied: { run: 'nightmare', director: 'nightmare', best: 0 },
      stored: { nightmare: '120', hard: '500' }, hardBest: 500, saved: 'hard'
    });

    const card = await cdp.evaluate(`(async () => {
      const { drawShareCard, shareCardBlob } = await import('./src/share-card.js');
      const sample = { title: 'ROOM LOST', rank: 'RANK A · Hard', score: 4321, stats: [{ label: 'Wave', value: 8 }, { label: 'Kills', value: 210 }], build: ['Scatter Cannon', 'Rapid Fire LV.3'], cause: 'Killed by Tank', url: 'example.test' };
      const canvas = drawShareCard(sample);
      const blob = await shareCardBlob(sample);
      return { width: canvas.width, height: canvas.height, png: blob?.type, bytes: blob?.size > 10000 };
    })()`);
    assert.deepEqual(card, { width: 1080, height: 1350, png: 'image/png', bytes: true });

    await cdp.send('Page.navigate', { url: `${url}/?playtestSeed=42&playtestManual=1&playtestLimit=0&playtestDifficulty=normal` });
    await waitFor(cdp.evaluate.bind(cdp), 'typeof window.advanceTime === "function"', Boolean);
    const recorded = await cdp.evaluate(`import('./src/state.js').then(({ game }) => ({ run: window.__zombieRoomPlaytest.difficulty, director: game.director.mode, coached: document.querySelector('#hintPill').classList.contains('coaching') }))`);
    assert.deepEqual(recorded, { run: 'normal', director: 'normal', coached: false });
    assert.deepEqual(cdp.runtimeExceptions, []);
  });
});
