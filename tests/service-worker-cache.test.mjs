import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');

function createWorker() {
  const handlers = new Map();
  const entries = new Map([
    ['https://game.test/index.html', new Response('<main>release A</main>')],
    ['https://game.test/src/entities.js', new Response('export const release = "A";')]
  ]);
  const cacheName = source.match(/const CACHE_NAME = '([^']+)'/)?.[1];
  let networkCalls = 0;
  let cacheWrites = 0;
  const caches = {
    async match(request) {
      return entries.get(typeof request === 'string' ? new URL(request, 'https://game.test').href : request.url);
    },
    async open(name) {
      assert.equal(name, cacheName);
      return {
        async addAll() {},
        async put(request, response) {
          cacheWrites++;
          entries.set(request.url, response);
        }
      };
    },
    async keys() { return [cacheName]; },
    async delete() { return true; }
  };
  const self = {
    location: { origin: 'https://game.test' },
    clients: { claim: async () => {} },
    addEventListener(type, listener) { handlers.set(type, listener); },
    skipWaiting() {}
  };
  vm.runInNewContext(source, {
    self,
    caches,
    URL,
    fetch: async request => {
      networkCalls++;
      return new Response(`release B: ${request.url}`);
    }
  });
  return {
    entries,
    get networkCalls() { return networkCalls; },
    get cacheWrites() { return cacheWrites; },
    async fetch(request) {
      let responsePromise;
      handlers.get('fetch')({ request, respondWith(value) { responsePromise = value; } });
      return responsePromise;
    }
  };
}

test('controlled navigation and modules remain on the installed release without background cache writes', async () => {
  const worker = createWorker();
  const page = await worker.fetch({ url: 'https://game.test/index.html', method: 'GET', mode: 'navigate' });
  const module = await worker.fetch({ url: 'https://game.test/src/entities.js', method: 'GET', mode: 'cors' });
  assert.match(await page.text(), /release A/);
  assert.match(await module.text(), /release = "A"/);
  assert.equal(worker.networkCalls, 0);

  const uncached = await worker.fetch({ url: 'https://game.test/uncached.json', method: 'GET', mode: 'cors' });
  assert.match(await uncached.text(), /release B/);
  assert.equal(worker.networkCalls, 1);
  assert.equal(worker.cacheWrites, 0);
  assert.equal(worker.entries.has('https://game.test/uncached.json'), false);
  assert.match(source, /\.\/src\/enemy-navigation\.js/);
});
