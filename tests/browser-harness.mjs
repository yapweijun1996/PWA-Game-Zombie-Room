import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const browserPath = findBrowser();
const requireBrowser = process.env.PLAYTEST_REQUIRE_BROWSER === '1';
const skipReason = !browserPath
  ? (process.env.PLAYTEST_BROWSER !== undefined
    ? `PLAYTEST_BROWSER does not point to a browser file: ${process.env.PLAYTEST_BROWSER || '(empty)'}`
    : 'Set PLAYTEST_BROWSER, EDGE_PATH, or CHROME_PATH to run the browser replay regression.')
  : (typeof WebSocket !== 'function' ? 'This Node version does not provide the built-in WebSocket client.' : false);

function findBrowser() {
  if (process.env.PLAYTEST_BROWSER !== undefined) {
    return process.env.PLAYTEST_BROWSER && existsSync(process.env.PLAYTEST_BROWSER) ? process.env.PLAYTEST_BROWSER : null;
  }
  const candidates = [
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

function createStaticServer({ serviceWorker = false } = {}) {
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
    if (pathname === '/service-worker.js' && !serviceWorker) {
      // Keep first-control reloads out of this replay-focused browser test.
      response.writeHead(404).end();
      return;
    }
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

async function readDevToolsPort(profilePath, browser, getBrowserStderr, timeoutMs = 20000) {
  const activePortFile = join(profilePath, 'DevToolsActivePort');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const stderr = getBrowserStderr();
    if (browser.exitCode !== null) {
      throw new Error(`Browser ${browser.spawnfile} exited with code ${browser.exitCode}. Browser stderr: ${stderr.trim().slice(-4000) || '(empty)'}`);
    }
    // Chromium announces the endpoint even when the profile file is unavailable.
    const endpoint = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (endpoint) {
      const port = Number(new URL(endpoint[1]).port);
      if (Number.isInteger(port) && port > 0) return port;
    }
    try {
      const [port] = readFileSync(activePortFile, 'utf8').trim().split(/\r?\n/);
      const parsedPort = Number(port);
      if (Number.isInteger(parsedPort) && parsedPort > 0) return parsedPort;
    } catch (_) {
      // Wait for the browser to publish its debugging endpoint.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for the browser DevTools endpoint from ${browser.spawnfile}. Browser stderr: ${getBrowserStderr().trim().slice(-4000) || '(empty)'}`);
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
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
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

async function stopBrowser(browser) {
  if (!browser?.pid) return;
  const exited = once(browser, 'exit').catch(() => {});
  if (process.platform === 'win32') {
    if (browser.exitCode === null) {
      browser.kill();
      await Promise.race([exited, delay(3000)]);
      if (browser.exitCode === null) {
        const taskkill = spawn('taskkill.exe', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        await once(taskkill, 'exit').catch(() => {});
      }
    }
    await Promise.race([exited, delay(1000)]);
    return;
  }

  const signalGroup = signal => {
    try {
      process.kill(-browser.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };
  signalGroup('SIGTERM');
  await Promise.race([exited, delay(3000)]);
  // Chromium can leave renderer processes writing to its profile after the
  // browser process exits, so terminate the entire process group before cleanup.
  signalGroup('SIGKILL');
  await Promise.race([exited, delay(1000)]);
}


export { browserPath, requireBrowser, skipReason, createStaticServer, listen, readDevToolsPort, readPageTarget, connectCdp, waitFor, sendKey, stopBrowser };

export async function withBrowser(run, { serviceWorker = false } = {}) {
  if (skipReason) throw new Error(skipReason);
  const profilePath = mkdtempSync(join(tmpdir(), 'zombie-room-director-'));
  const server = createStaticServer({ serviceWorker });
  let browser, cdp;
  try {
    const serverPort = await listen(server);
    let stderr = '';
    const args = [
      '--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run', '--no-default-browser-check',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
      '--blink-settings=primaryPointerType=4,availablePointerTypes=4', '--remote-debugging-port=0', '--remote-allow-origins=*',
      `--user-data-dir=${profilePath}`, '--mute-audio', 'about:blank'
    ];
    if (process.env.PLAYTEST_NO_SANDBOX === '1' || (typeof process.getuid === 'function' && process.getuid() === 0)) args.unshift('--no-sandbox');
    browser = spawn(browserPath, args, {
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true
    });
    browser.stderr.setEncoding('utf8');
    browser.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-16384); });
    const failed = new Promise((_, reject) => browser.once('error', reject));
    const port = await Promise.race([readDevToolsPort(profilePath, browser, () => stderr), failed]);
    cdp = connectCdp((await readPageTarget(port)).webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await run(cdp, `http://127.0.0.1:${serverPort}`);
  } finally {
    cdp?.close();
    await stopBrowser(browser);
    if (server.listening) await new Promise(resolveClose => server.close(resolveClose));
    rmSync(profilePath, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
