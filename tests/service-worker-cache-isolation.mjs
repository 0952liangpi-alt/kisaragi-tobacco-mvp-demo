import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
const current = source.match(/const CACHE_NAME = '([^']+)'/)[1];
const handlers = {};
const deleted = [];
const fetched = [];
let pending;
runInNewContext(source, {
  self: { location: { origin: 'http://127.0.0.1:8766' }, addEventListener: (name, fn) => { handlers[name] = fn; }, clients: { claim() {} } },
  URL,
  fetch: async (request, options) => { fetched.push({ url: request.url, cache: options?.cache }); return { ok: true }; },
  caches: {
    keys: async () => [current, 'kisaragi-demo-v18-old', 'other-project-v1', 'kisaragi-demo-unrelated'],
    delete: async (key) => { deleted.push(key); return true; },
    match: async () => { throw new Error('Runtime script must not be served from cache first'); },
  },
});
handlers.activate({ waitUntil(promise) { pending = promise; } });
await pending;
assert.deepEqual(deleted, ['kisaragi-demo-v18-old'], 'Activation must retain the current cache and unrelated same-origin caches');
for (const file of ['shop.js', 'checkout.js']) {
  const request = { method: 'GET', url: `http://127.0.0.1:8766/${file}`, destination: 'script' };
  let response;
  handlers.fetch({ request, respondWith(promise) { response = promise; } });
  assert.equal((await response).ok, true, `${file} should come from the network`);
}
assert.deepEqual(fetched.map((item) => item.cache), ['no-store', 'no-store']);
console.log('PASS: current and unrelated caches preserved; obsolete application cache removed');
