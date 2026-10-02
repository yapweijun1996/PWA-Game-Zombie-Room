import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const versionOf = source => source.match(/APP_VERSION = '([^']+)'/)?.[1];

test('service worker and app share one APP_VERSION', () => {
  const appVersion = versionOf(read('../src/state.js'));
  assert.match(appVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(versionOf(read('../service-worker.js')), appVersion);
});

test('index.html does not hardcode the app version', () => {
  assert.doesNotMatch(read('../index.html'), /\bv\d+\.\d+\.\d+\b/);
});
