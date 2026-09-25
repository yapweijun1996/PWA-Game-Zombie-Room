import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserPath = findBrowser();
const requireBrowser = process.env.PLAYTEST_REQUIRE_BROWSER === '1';
const skipReason = !browserPath
  ? 'Set PLAYTEST_BROWSER, EDGE_PATH, or CHROME_PATH to run the browser replay regression.'
  : (typeof WebSocket !== 'function' ? 'This Node version does not provide the built-in WebSocket client.' : false);

function findBrowser() {
  const candidates = [
    process.env.PLAYTEST_BROWSER,
    process.env.EDGE_PATH,
    process.env.CHROME_PATH,
    ...windowsBrowserCandidates(),
    ...pathBrowserCandidates().map(locatePathCommand)
  ].filter(Boolean);
  return candidates.find(candidate => existsSync(candidate)) || null;
}

function windowsBrowserCandidates() {
  if (process.platform !== 'win32') return [];
  const roots = [
    process.env['ProgramFiles(x86)'],
    process.env.ProgramFiles,
    process.env.LOCALAPPDATA
  ].filter(Boolean);
  return roots.flatMap(root => [
    join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')
  ]);
}

function pathBrowserCandidates() {
  if (process.platform === 'win32') return [];
  return ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'microsoft-edge', 'msedge'];
}

function locatePathCommand(command) {
  const pathEntries = (process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':');
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
    : [''];
  for (const directory of pathEntries) {
    for (const extension of extensions) {
      const candidate = join(directory, command + extension);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function createStaticServer() {
  const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json; charset=utf-8'
  };

  return createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    } catch (_) {
      response.writeHead(400).end();
      return;
    }
    if (pathname === '/') pathname = '/index.html';
    const filePath = resolve(projectRoot, '.' + pathname);
    if (filePath !== projectRoot && !filePath.startsWith(projectRoot + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = readFileSync(filePath);
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream'
      });
      response.end(body);
    } catch (_) {
      response.writeHead(404).end();
    }
  });
}

async function listen(server) {
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  return server.address().port;
}

async function readDevToolsPort(profilePath, browser, timeoutMs = 20000) {
  const activePortFile = join(profilePath, 'DevToolsActivePort');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (browser.exitCode !== null) throw new Error(`Browser exited with code ${browser.exitCode}.`);
    try {
      const [port] = readFileSync(activePortFile, 'utf8').trim().split(/\r?\n/);
      if (Number.isInteger(Number(port))) return Number(port);
    } catch (_) {
      // Wait for the browser to publish its debugging endpoint.
    }
    await delay(100);
  }
  throw new Error('Timed out waiting for the browser DevTools endpoint.');
}

async function readPageTarget(port, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find(target => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch (_) {
      // The DevTools HTTP endpoint may start slightly after the port file appears.
    }
    await delay(100);
  }
  throw new Error('Timed out waiting for a browser page target.');
}

function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const runtimeExceptions = [];
  let nextId = 0;

  socket.addEventListener('message', event => {
    const message = JSON.parse(typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString('utf8'));
    if (message.method === 'Runtime.exceptionThrown') runtimeExceptions.push(message.params.exceptionDetails.text);
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    clearTimeout(waiter.timeout);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });

  const ready = new Promise((resolveReady, reject) => {
    socket.addEventListener('open', resolveReady, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  return {
    socket,
    runtimeExceptions,
    async ready() {
      await ready;
    },
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolveSend, rejectSend) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          rejectSend(new Error(`DevTools command timed out: ${method}`));
        }, 15000);
        pending.set(id, { resolve: resolveSend, reject: rejectSend, timeout });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    async evaluate(expression) {
      const response = await this.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true
      });
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
      return response.result.value;
    },
    close() {
      for (const waiter of pending.values()) {
        clearTimeout(waiter.timeout);
        waiter.reject(new Error('DevTools connection closed.'));
      }
      pending.clear();
      socket.close();
    }
  };
}

async function waitFor(evaluate, expression, predicate, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  let value;
  while (Date.now() < deadline) {
    value = await evaluate(expression);
    if (predicate(value)) return value;
    await delay(100);
  }
  throw new Error(`Timed out waiting for browser condition. Last value: ${JSON.stringify(value)}`);
}

async function sendKey(cdp, type, key) {
  await cdp.evaluate(`window.dispatchEvent(new KeyboardEvent(${JSON.stringify(type)}, { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true }))`);
}

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
  let currentPhase = -1;
  let pausedOnce = false;
  let resumedOnce = false;
  let upgradeFocusVerified = false;
  let pauseFocusVerified = false;
  let state;

  while (Date.now() < deadline) {
    state = await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      const button = game.upgradeModalOpen ? document.querySelector('#upgradeCards button') : null;
      return {
        status: window.__zombieRoomPlaytest?.status,
        driverUpgradeReady: !game.upgradeModalOpen || Boolean(button),
        elapsed: game.elapsed,
        paused: game.paused,
        upgradeModal: game.upgradeModalOpen
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
    if (state.paused && !pauseFocusVerified) {
      const focus = await verifyFocusTrap(cdp, '#pauseOverlay');
      assert.ok(focus.forwardWraps && focus.backwardWraps, 'pause dialog should contain keyboard focus');
      assert.equal(focus.ariaModal, 'true');
      pauseFocusVerified = true;
    }

    const phase = Math.floor(state.elapsed / 0.75) % directions.length;
    if (phase !== currentPhase) {
      if (activeDirection) await sendKey(cdp, 'keyup', activeDirection);
      activeDirection = directions[phase];
      await sendKey(cdp, 'keydown', activeDirection);
      currentPhase = phase;
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

async function stopBrowser(browser) {
  if (!browser || browser.exitCode !== null) return;
  const exited = once(browser, 'exit').catch(() => {});
  browser.kill();
  await Promise.race([exited, delay(3000)]);
  if (browser.exitCode === null && process.platform === 'win32') {
    const taskkill = spawn('taskkill.exe', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    await once(taskkill, 'exit').catch(() => {});
  }
}

test('fixed-step replay and modal keyboard focus behavior match expectations', {
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
      '--remote-debugging-port=0',
      '--remote-allow-origins=*',
      `--user-data-dir=${profilePath}`,
      '--mute-audio',
      'about:blank'
    ];
    if (process.platform !== 'win32' && typeof process.getuid === 'function' && process.getuid() === 0) {
      args.unshift('--no-sandbox');
    }
    browser = spawn(browserPath, args, { stdio: 'ignore', windowsHide: true });

    const browserStartError = new Promise((_, reject) => browser.once('error', reject));
    const devToolsPort = await Promise.race([readDevToolsPort(profilePath, browser), browserStartError]);
    const page = await readPageTarget(devToolsPort);
    cdp = connectCdp(page.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', {
      url: `http://127.0.0.1:${serverPort}/?playtestSeed=987&playtestLimit=15&playtestProfile=browser-regression&playtestInput=keyboard-loop-v1`
    });

    await waitFor(cdp.evaluate.bind(cdp), 'Boolean(window.__zombieRoomPlaytestTools && window.__zombieRoomPlaytest?.mode === "record")', Boolean);
    const appVersion = await cdp.evaluate("import('./src/state.js').then(({ APP_VERSION }) => APP_VERSION)");
    assert.equal(typeof appVersion, 'string');
    assert.ok(appVersion.length > 0);
    assert.equal(appVersion, await cdp.evaluate('window.__zombieRoomPlaytest.appVersion'));

    const completedRun = await driveRecording(cdp);
    assert.equal(completedRun.status, 'finished');
    const source = await cdp.evaluate('JSON.stringify(window.__zombieRoomPlaytest)').then(JSON.parse);
    assert.equal(source.schemaVersion, 2);
    assert.equal(source.mode, 'record');
    assert.equal(source.eventsTruncated, false);
    assert.ok(source.events.some(event => event.type === 'input' &&
      (event.state.up || event.state.down || event.state.left || event.state.right)), 'record should contain movement events');
    const pauseEvents = source.events.filter(event => event.type === 'pause');
    assert.ok(pauseEvents.some(event => event.paused) && pauseEvents.some(event => !event.paused), 'record should contain pause and resume events');
    assert.ok(source.events.some(event => event.type === 'upgrade'), 'record should contain an upgrade selection');

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
      finalMatches: true,
      checkpointsMatch: true,
      upgradesMatch: true,
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
    assert.deepEqual(cdp.runtimeExceptions, []);
  } finally {
    cdp?.close();
    await stopBrowser(browser);
    if (server.listening) await new Promise(resolveClose => server.close(resolveClose));
    rmSync(profilePath, { recursive: true, force: true });
  }
});
