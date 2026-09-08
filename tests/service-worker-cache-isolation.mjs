import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
const current = source.match(/const CACHE_NAME = '([^']+)'/)[1];
const handlers = {};
const deleted = [];
let pending;
runInNewContext(source, {
  self: { addEventListener: (name, fn) => { handlers[name] = fn; }, clients: { claim() {} } },
  caches: {
    keys: async () => [current, 'kisaragi-demo-v18-old', 'other-project-v1', 'kisaragi-demo-unrelated'],
    delete: async (key) => { deleted.push(key); return true; },
  },
});
handlers.activate({ waitUntil(promise) { pending = promise; } });
await pending;
assert.deepEqual(deleted, ['kisaragi-demo-v18-old'], 'Activation must retain the current cache and unrelated same-origin caches');
console.log('PASS: current and unrelated caches preserved; obsolete application cache removed');
