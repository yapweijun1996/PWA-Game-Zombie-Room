import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { browserPath, requireBrowser, skipReason, createStaticServer, listen, readDevToolsPort, readPageTarget, connectCdp, waitFor, sendKey, stopBrowser } from './browser-harness.mjs';

async function verifyFocusTrap(cdp, selector) {
  return cdp.evaluate(`(() => {
    const dialog = document.querySelector(${JSON.stringify(selector)});
    const focusables = [...dialog.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.hidden && !element.closest('[hidden]') && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length);
    if (!focusables.length) return { count: 0, role: dialog?.getAttribute('role'), ariaModal: dialog?.getAttribute('aria-modal') };

    focusables.at(-1).focus();
    const forwardEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(forwardEvent);
    const forwardWraps = forwardEvent.defaultPrevented && document.activeElement === focusables[0];

    focusables[0].focus();
    const backwardEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(backwardEvent);
    const backwardWraps = backwardEvent.defaultPrevented && document.activeElement === focusables.at(-1);
    focusables[0].focus();

    return {
      count: focusables.length,
      forwardWraps,
      backwardWraps,
      role: dialog.getAttribute('role'),
      ariaModal: dialog.getAttribute('aria-modal')
    };
  })()`);
}

async function driveRecording(cdp, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  const startedAt = Date.now();
  const directions = ['d', 's', 'a', 'w'];
  let activeDirection = null;
  let pausedOnce = false;
  let resumedOnce = false;
  let upgradeFocusVerified = false;
  let pauseFocusVerified = false;
  let state;

  while (Date.now() < deadline) {
    state = await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      const button = game.upgradeModalOpen ? document.querySelector('#upgradeCards button') : null;
      const player = game.player;
      const orb = game.orbs.reduce((nearest, candidate) => !nearest ||
        Math.hypot(candidate.x - player.x, candidate.y - player.y) < Math.hypot(nearest.x - player.x, nearest.y - player.y) ? candidate : nearest, null);
      const dx = orb ? orb.x - player.x : 0, dy = orb ? orb.y - player.y : 0;
      const orbDirection = orb ? (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'd' : 'a') : (dy > 0 ? 's' : 'w')) : null;
      return {
        status: window.__zombieRoomPlaytest?.status,
        orbDirection,
        driverUpgradeReady: !game.upgradeModalOpen || Boolean(button),
        elapsed: game.elapsed,
        paused: game.paused,
        upgradeModal: game.upgradeModalOpen,
        dashCooldown: game.player?.dashCooldown ?? 0,
        dashAbilityCount: window.__zombieRoomPlaytest?.abilities.length ?? 0
      };
    })()`);
    if (state.status === 'finished') return state;
    if (!state.driverUpgradeReady) throw new Error('Upgrade modal opened without a selectable card.');
    if (state.upgradeModal) {
      if (!upgradeFocusVerified) {
        const focus = await verifyFocusTrap(cdp, '#upgradeModal');
        assert.ok(focus.forwardWraps && focus.backwardWraps, 'upgrade dialog should contain keyboard focus');
        assert.equal(focus.ariaModal, 'true');
        upgradeFocusVerified = true;
      }
      await cdp.evaluate("document.querySelector('#upgradeCards button')?.click()");
    }
    if (!state.paused && !state.upgradeModal && state.dashAbilityCount === 0 && state.dashCooldown <= 0) {
      await cdp.evaluate("document.querySelector('#dashButton')?.click()");
    }
    if (state.paused && !pauseFocusVerified) {
      const focus = await verifyFocusTrap(cdp, '#pauseOverlay');
      assert.ok(focus.forwardWraps && focus.backwardWraps, 'pause dialog should contain keyboard focus');
      assert.equal(focus.ariaModal, 'true');
      pauseFocusVerified = true;
    }

    const phase = Math.floor(state.elapsed / 0.75) % directions.length;
    // Seek XP explicitly so the focus/replay fixture does not depend on accidental pickups.
    const direction = state.orbDirection || directions[phase];
    if (direction !== activeDirection) {
      if (activeDirection) await sendKey(cdp, 'keyup', activeDirection);
      activeDirection = direction;
      await sendKey(cdp, 'keydown', activeDirection);
    }

    const wallElapsed = Date.now() - startedAt;
    if (!pausedOnce && !state.paused && !state.upgradeModal && wallElapsed >= 900) {
      await sendKey(cdp, 'keydown', 'p');
      pausedOnce = true;
    } else if (pausedOnce && !resumedOnce && state.paused && !state.upgradeModal && wallElapsed >= 1200) {
      await sendKey(cdp, 'keydown', 'p');
      resumedOnce = true;
    }
    await delay(100);
  }
  throw new Error(`Recording timed out: ${JSON.stringify(state)}`);
}

test('replay, dash controls, telegraphs, wave modifiers, and modal focus work together', {
  skip: requireBrowser ? false : skipReason,
  timeout: 120000
}, async () => {
  if (skipReason) throw new Error(skipReason);
  const profilePath = mkdtempSync(join(tmpdir(), 'zombie-room-replay-'));
  const server = createStaticServer();
  let browser;
  let cdp;

  try {
    const serverPort = await listen(server);
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      // Linux headless runners may have no mouse; make the desktop fixture explicit.
      '--blink-settings=primaryPointerType=4,availablePointerTypes=4',
      '--remote-debugging-port=0',
      '--remote-allow-origins=*',
      `--user-data-dir=${profilePath}`,
      '--mute-audio',
      'about:blank'
    ];
    if (process.env.PLAYTEST_NO_SANDBOX === '1' ||
      (process.platform !== 'win32' && typeof process.getuid === 'function' && process.getuid() === 0)) {
      args.unshift('--no-sandbox');
    }
    let browserStderr = '';
    browser = spawn(browserPath, args, {
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true
    });
    browser.stderr.setEncoding('utf8');
    browser.stderr.on('data', chunk => { browserStderr = (browserStderr + chunk).slice(-16384); });

    const browserStartError = new Promise((_, reject) => browser.once('error', reject));
    const devToolsPort = await Promise.race([readDevToolsPort(profilePath, browser, () => browserStderr), browserStartError]);
    const page = await readPageTarget(devToolsPort);
    cdp = connectCdp(page.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await cdp.send('Page.navigate', {
      url: `http://127.0.0.1:${serverPort}/?playtestSeed=987&playtestLimit=25&playtestProfile=browser-regression&playtestInput=keyboard-loop-v1`
    });

    await waitFor(cdp.evaluate.bind(cdp), 'Boolean(window.__zombieRoomPlaytestTools && window.__zombieRoomPlaytest?.mode === "record")', Boolean);
    assert.equal(await cdp.evaluate("matchMedia('(pointer: coarse)').matches"), true, 'portrait fixture should expose a touch pointer');
    const appVersion = await cdp.evaluate("import('./src/state.js').then(({ APP_VERSION }) => APP_VERSION)");
    assert.equal(typeof appVersion, 'string');
    assert.ok(appVersion.length > 0);
    assert.equal(appVersion, await cdp.evaluate('window.__zombieRoomPlaytest.appVersion'));

    const gameStartup = await cdp.evaluate('(async () => { const { game } = await import("./src/state.js"); return { running: game.running, paused: game.paused, upgradeModal: game.upgradeModalOpen, hasPlayer: Boolean(game.player) }; })()');
    assert.deepEqual(gameStartup, { running: true, paused: false, upgradeModal: false, hasPlayer: true });
    const dashControl = await cdp.evaluate(`(() => {
      const button = document.querySelector('#dashButton');
      const rect = button.getBoundingClientRect();
      return { visible: rect.width >= 48 && rect.height >= 48, label: button.getAttribute('aria-label'), right: rect.right, bottom: rect.bottom };
    })()`);
    assert.equal(dashControl.visible, true, 'touch dash control should have a usable hit target');
    assert.ok(dashControl.right <= 390 && dashControl.bottom <= 844, 'touch dash control should fit in portrait viewport');
    assert.match(dashControl.label, /ready/i);
    await cdp.evaluate("document.querySelector('#dashButton').click()");
    const usedDash = await waitFor(
      cdp.evaluate.bind(cdp),
      '(async () => { const { game } = await import("./src/state.js"); return { hasPlayer: Boolean(game.player), running: game.running, paused: game.paused, upgradeModal: game.upgradeModalOpen, timer: game.player?.dashTimer ?? 0, cooldown: game.player?.dashCooldown ?? 0, disabled: document.querySelector("#dashButton").getAttribute("aria-disabled"), abilityCount: window.__zombieRoomPlaytest?.abilities.length ?? -1 }; })()',
      value => value.hasPlayer && value.cooldown > 7 && value.disabled === 'true' && value.abilityCount === 1,
      5000
    );
    assert.ok(usedDash.timer > 0, 'dash should begin immediately');
    const repeatedDashAbilityCount = await cdp.evaluate(`(() => {
      document.querySelector('#dashButton').click();
      return window.__zombieRoomPlaytest?.abilities.length ?? -1;
    })()`);
    assert.equal(repeatedDashAbilityCount, 1, 'cooldown should reject repeat activation');

    const completedRun = await driveRecording(cdp);
    assert.equal(completedRun.status, 'finished');
    const source = await cdp.evaluate('JSON.stringify(window.__zombieRoomPlaytest)').then(JSON.parse);
    assert.equal(source.schemaVersion, 4);
    assert.equal(source.scenarioSeed, source.seed);
    assert.equal(source.abilities.length, 1);
    assert.ok(source.events.some(event => event.type === 'ability' && event.id === 'dash'));
    assert.equal(source.mode, 'record');
    assert.equal(source.eventsTruncated, false);
    assert.ok(source.events.some(event => event.type === 'input' &&
      (event.state.up || event.state.down || event.state.left || event.state.right)), 'record should contain movement events');
    const pauseEvents = source.events.filter(event => event.type === 'pause');
    assert.ok(pauseEvents.some(event => event.paused) && pauseEvents.some(event => !event.paused), 'record should contain pause and resume events');
    assert.ok(source.events.some(event => event.type === 'upgrade'), 'record should contain an upgrade selection');
    const runSummary = await cdp.evaluate('window.__zombieRoomPlaytestTools.summarizeRuns()');
    assert.equal(runSummary.completedRuns, 1);
    assert.ok(runSummary.phases.early.checkpointSamples > 0);

    const replayJson = JSON.stringify(source);
    const replayResult = await cdp.evaluate(`window.__zombieRoomPlaytestTools.replay(JSON.parse(${JSON.stringify(replayJson)}))`);
    assert.equal(replayResult.ok, true, replayResult.reason);

    await waitFor(
      cdp.evaluate.bind(cdp),
      'window.__zombieRoomPlaytest?.mode === "replay" && window.__zombieRoomPlaytest?.status === "finished" ? JSON.stringify(window.__zombieRoomPlaytest.replayComparison) : null',
      value => typeof value === 'string'
    );
    const comparison = await cdp.evaluate('window.__zombieRoomPlaytest.replayComparison');
    assert.deepEqual(comparison, {
      outcomeMatches: true,
      scenarioSeedMatches: true,
      finalMatches: true,
      checkpointsMatch: true,
      upgradesMatch: true,
      abilitiesMatch: true,
      waveModifiersMatch: true,
      directorEventsMatch: true,
      damageEventsMatch: true,
      randomDrawsMatch: true,
      eventsConsumed: true,
      mismatchCount: 0
    });

    await cdp.evaluate('window.__zombieRoomPlaytestTools.stopReplay()');
    const gameOverState = await cdp.evaluate(`import('./src/game-ui.js').then(({ showGameOver }) => {
      showGameOver({ score: 120, combo: 4, wave: 2, kills: 8, elapsed: 35, isNewBest: false, rank: 'C', player: { superWeapons: {} }, upgrades: [], performanceMode: false });
      return { activeElement: document.activeElement.id, ariaModal: document.querySelector('#gameover').getAttribute('aria-modal') };
    })`);
    assert.equal(gameOverState.activeElement, 'restartButton');
    assert.equal(gameOverState.ariaModal, 'true');
    const gameOverFocus = await verifyFocusTrap(cdp, '#gameover');
    assert.ok(gameOverFocus.forwardWraps && gameOverFocus.backwardWraps, 'game-over dialog should contain keyboard focus');

    await cdp.evaluate("document.querySelector('#settingsTrigger').click()");
    const nestedModalState = await cdp.evaluate(`({
      gameOverModal: document.querySelector('#gameover').getAttribute('aria-modal'),
      settingsModal: document.querySelector('#settingsPanel').getAttribute('aria-modal')
    })`);
    assert.deepEqual(nestedModalState, { gameOverModal: 'false', settingsModal: 'true' });
    await cdp.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))");
    await waitFor(
      cdp.evaluate.bind(cdp),
      `({ settingsHidden: document.querySelector('#settingsPanel').hidden, gameOverModal: document.querySelector('#gameover').getAttribute('aria-modal') })`,
      value => value.settingsHidden && value.gameOverModal === 'true',
      5000
    );
    await cdp.evaluate("import('./src/game-ui.js').then(({ hideGameOver }) => { hideGameOver(); document.querySelector('#game').classList.remove('game-blurred', 'game-dimmed'); })");

    const settingsState = await cdp.evaluate(`(async () => {
      document.querySelector('#settingsTrigger').click();
      const { game } = await import('./src/state.js');
      const panel = document.querySelector('#settingsPanel');
      return {
        role: panel.getAttribute('role'),
        ariaModal: panel.getAttribute('aria-modal'),
        ariaLabel: panel.getAttribute('aria-label'),
        expanded: document.querySelector('#settingsTrigger').getAttribute('aria-expanded'),
        activeElement: document.activeElement.id,
        paused: game.paused
      };
    })()`);
    assert.equal(settingsState.role, 'dialog');
    assert.equal(settingsState.ariaModal, 'true');
    assert.equal(settingsState.ariaLabel, 'Settings');
    assert.equal(settingsState.expanded, 'true');
    assert.equal(settingsState.activeElement, 'languageSelect');
    assert.equal(settingsState.paused, true);

    const settingsFocus = await verifyFocusTrap(cdp, '#settingsPanel');
    assert.ok(settingsFocus.forwardWraps && settingsFocus.backwardWraps, 'settings dialog should contain keyboard focus');
    await cdp.evaluate("(() => { const select = document.querySelector('#languageSelect'); select.value = 'zh'; select.dispatchEvent(new Event('change', { bubbles: true })); })()");
    assert.equal(await cdp.evaluate("document.querySelector('#settingsPanel').getAttribute('aria-label')"), '设置');
    await cdp.evaluate("(() => { const select = document.querySelector('#languageSelect'); select.value = 'en'; select.dispatchEvent(new Event('change', { bubbles: true })); })()");
    assert.equal(await cdp.evaluate("document.querySelector('#settingsPanel').getAttribute('aria-label')"), 'Settings');
    await cdp.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))");
    const closedSettings = await waitFor(
      cdp.evaluate.bind(cdp),
      '(async () => { const { game } = await import("./src/state.js"); const panel = document.querySelector("#settingsPanel"); return { hidden: panel.hidden, expanded: document.querySelector("#settingsTrigger").getAttribute("aria-expanded"), activeElement: document.activeElement.id, paused: game.paused }; })()',
      value => value.hidden && value.expanded === 'false' && value.activeElement === 'settingsTrigger' && !value.paused,
      5000
    );
    assert.equal(closedSettings.activeElement, 'settingsTrigger');

    await sendKey(cdp, 'keydown', 'p');
    const openedPause = await waitFor(
      cdp.evaluate.bind(cdp),
      '(async () => { const { game } = await import("./src/state.js"); return { paused: game.paused, hidden: document.querySelector("#pauseOverlay").hidden, activeElement: document.activeElement.id }; })()',
      value => value.paused && !value.hidden,
      5000
    );
    assert.equal(openedPause.activeElement, 'resumeButton');
    const pauseFocus = await verifyFocusTrap(cdp, '#pauseOverlay');
    assert.ok(pauseFocus.forwardWraps && pauseFocus.backwardWraps, 'pause dialog should contain keyboard focus');

    await cdp.evaluate("document.querySelector('#settingsTrigger').click()");
    const settingsWhilePaused = await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      return { paused: game.paused, settingsVisible: !document.querySelector('#settingsPanel').hidden, pauseHidden: document.querySelector('#pauseOverlay').hidden };
    })()`);
    assert.deepEqual(settingsWhilePaused, { paused: true, settingsVisible: true, pauseHidden: true });
    await cdp.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))");
    const restoredPause = await waitFor(
      cdp.evaluate.bind(cdp),
      '(async () => { const { game } = await import("./src/state.js"); return { paused: game.paused, settingsHidden: document.querySelector("#settingsPanel").hidden, pauseHidden: document.querySelector("#pauseOverlay").hidden, activeElement: document.activeElement.id }; })()',
      value => value.paused && value.settingsHidden && !value.pauseHidden,
      5000
    );
    assert.equal(restoredPause.activeElement, 'resumeButton');
    await cdp.evaluate("document.querySelector('#resumeButton').click()");
    const resumedPause = await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      return { paused: game.paused, pauseHidden: document.querySelector('#pauseOverlay').hidden };
    })()`);
    assert.deepEqual(resumedPause, { paused: false, pauseHidden: true });

    // Disabling touch restores host capabilities. Navigate afterward to reapply
    // the explicit desktop Blink settings instead of inheriting a missing mouse.
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/` });
    const normalStartup = await waitFor(
      cdp.evaluate.bind(cdp),
      `(async () => {
        const { APP_VERSION, game, room } = await import('./src/state.js');
        const player = game.player;
        const spawnClear = room.obstacles.every(obstacle => {
          const x = Math.max(obstacle.x, Math.min(player.x, obstacle.x + obstacle.w));
          const y = Math.max(obstacle.y, Math.min(player.y, obstacle.y + obstacle.h));
          return (player.x - x) ** 2 + (player.y - y) ** 2 >= player.r ** 2;
        });
        return { appVersion: APP_VERSION, updateLabel: document.querySelector('#updateLabel').textContent, running: game.running, spawnClear, recorder: Boolean(window.__zombieRoomPlaytest), tools: Boolean(window.__zombieRoomPlaytestTools) };
      })()`,
      value => value?.running === true
    );
    assert.equal(typeof normalStartup.appVersion, 'string');
    assert.ok(normalStartup.updateLabel.includes(normalStartup.appVersion));
    assert.equal(normalStartup.spawnClear, true);
    assert.equal(normalStartup.recorder, false);
    assert.equal(normalStartup.tools, false);

    assert.equal(await cdp.evaluate("matchMedia('(min-width: 800px) and (pointer: fine)').matches"), true,
      'desktop fixture should expose a fine pointer at desktop width');
    assert.equal(await cdp.evaluate("document.querySelector('#dashButton').getClientRects().length"), 0, 'touch control should yield to desktop keyboard layout');
    await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      const { resetGame } = await import('./src/entities.js');
      if (!game.player) resetGame();
      // Keep the live startup fixture active while later UI checks run.
      Object.assign(game.player, { dashCooldown: 0, dashTimer: 0, invuln: 180 });
    })()`);
    await sendKey(cdp, 'keydown', ' ');
    const keyboardDash = await waitFor(
      cdp.evaluate.bind(cdp),
      '(async () => { const { game } = await import("./src/state.js"); return { timer: game.player.dashTimer, cooldown: game.player.dashCooldown }; })()',
      value => value.cooldown > 7
    );
    assert.ok(keyboardDash.timer > 0, 'Space should activate the desktop evasive dash');

    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
    const landscapeDash = await waitFor(
      cdp.evaluate.bind(cdp),
      `(async () => {
        const { viewport } = await import('./src/state.js');
        const rect = document.querySelector('#dashButton').getBoundingClientRect();
        return { width: innerWidth, height: innerHeight, coarsePointer: matchMedia('(pointer: coarse)').matches,
          resized: viewport.W === innerWidth && viewport.H === Math.max(420, innerHeight),
          visible: rect.width >= 48 && rect.height >= 48, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      })()`,
      value => value.width === 844 && value.height === 390 && value.coarsePointer && value.resized,
      5000
    );
    assert.equal(landscapeDash.visible, true, 'dash control should remain usable in landscape');
    assert.ok(landscapeDash.left >= 0 && landscapeDash.right <= 844 && landscapeDash.top >= 0 && landscapeDash.bottom <= 390,
      'landscape dash control should remain inside the viewport');

    const waveAndCharge = await cdp.evaluate(`(async () => {
      const { game, ui, room } = await import('./src/state.js');
      const { update, resetGame } = await import('./src/entities.js');
      const { getWaveModifier } = await import('./src/wave-director.js');
      const { t } = await import('./src/i18n.js');
      const { createTelegraphedCharge } = await import('./src/telegraphed-charge.js');
      // Isolate manual simulation steps from the preceding live keyboard dash.
      resetGame();
      const { createDirectorState } = await import('./src/wave-director.js');
      game.scenarioSeed = 1337;
      game.director = createDirectorState(1337);
      game.wave = 1;
      game.waveModifierId = null;
      game.waveModifierWave = 0;
      game.pendingWaveModifierId = null;
      game.preparedWave = 0;
      game.elapsed = 21.99;
      game.spawnTimer = 100;
      game.zombies.length = 0;
      update(1 / 60);
      const warning = { preparedWave: game.preparedWave, pending: game.pendingWaveModifierId, message: ui.message.textContent };
      game.elapsed = 25 - 1 / 60;
      update(1 / 60);
      const expectedModifier = getWaveModifier(1337, 2);
      const modifierLabelKey = 'phase_pressure';
      const waveStart = { wave: game.wave, active: game.waveModifierId, expected: expectedModifier, expectedLabel: t(modifierLabelKey) };

      const player = game.player;
      player.x = room.x + room.w * .7;
      player.y = room.y + room.h * .5;
      player.shootTimer = 1;
      player.invuln = 0;
      game.elapsed = 0;
      game.wave = 1;
      game.waveModifierId = null;
      game.waveModifierWave = 0;
      game.pendingWaveModifierId = null;
      game.preparedWave = 0;
      game.spawnTimer = 100;
      game.bossWave = 1;
      game.zombies.length = 0;
      const boss = { x: player.x - 220, y: player.y, type: 'boss', r: 26, hp: 100, maxHp: 100, speed: 30, damage: 24, hitFlash: 0, attackFlash: 0, walkTime: 0, facing: 0, pulse: 0, entrance: 0, armor: .86, frenzy: false, charge: createTelegraphedCharge(0) };
      game.zombies.push(boss);
      update(1 / 60);
      const bossWindup = boss.charge.state;
      const bossDirection = boss.charge.directionX;
      update(.62);
      const bossDash = { state: boss.charge.state, x: boss.x };

      game.zombies.length = 0;
      game.elapsed = 0;
      game.swiftChargeCooldown = 0;
      const swift = { x: player.x - 190, y: player.y, type: 'walker', affix: 'swift', r: 13, hp: 10, maxHp: 10, speed: 100, damage: 8, hitFlash: 0, attackFlash: 0, walkTime: 0, facing: 0, charge: createTelegraphedCharge(0) };
      game.zombies.push(swift);
      update(1 / 60);
      return { warning, waveStart, bossWindup, bossDirection, bossDash, swiftWindup: swift.charge.state };
    })()`);
    assert.equal(waveAndCharge.warning.preparedWave, 2);
    assert.equal(waveAndCharge.warning.pending, waveAndCharge.waveStart.expected);
    assert.ok(waveAndCharge.warning.message.includes(waveAndCharge.waveStart.expectedLabel));
    assert.deepEqual(waveAndCharge.waveStart, {
      wave: 2,
      active: waveAndCharge.waveStart.expected,
      expected: waveAndCharge.waveStart.expected,
      expectedLabel: waveAndCharge.waveStart.expectedLabel
    });
    assert.equal(waveAndCharge.bossWindup, 'windup');
    assert.equal(waveAndCharge.bossDirection, 1);
    assert.equal(waveAndCharge.bossDash.state, 'dash');
    assert.equal(waveAndCharge.swiftWindup, 'windup');
    assert.deepEqual(cdp.runtimeExceptions, []);
  } finally {
    cdp?.close();
    await stopBrowser(browser);
    if (server.listening) await new Promise(resolveClose => server.close(resolveClose));
    // Chromium helpers can finish profile writes just after the parent exits.
    rmSync(profilePath, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
