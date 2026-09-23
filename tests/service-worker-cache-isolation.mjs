import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
const current = source.match(/const CACHE_NAME = '([^']+)'/)[1];
const handlers = {};
const deleted = [];
const fetched = [];
const matched = [];
let pending;
runInNewContext(source, {
  self: { location: { origin: 'http://127.0.0.1:8766' }, addEventListener: (name, fn) => { handlers[name] = fn; }, clients: { claim() {} } },
  URL,
  fetch: async (request, options) => {
    fetched.push({ url: request.url, cache: options?.cache });
    if (request.url.includes('?v=offline')) throw new TypeError('offline');
    return { ok: true, clone() { return { ok: true }; } };
  },
  caches: {
    keys: async () => [current, 'kisaragi-demo-v18-old', 'other-project-v1', 'kisaragi-demo-unrelated'],
    delete: async (key) => { deleted.push(key); return true; },
    open: async () => ({ put: async () => {} }),
    match: async (request, options) => {
      matched.push({url:request.url, options});
      return {ok:true, source:'cache'};
    },
  },
});
handlers.activate({ waitUntil(promise) { pending = promise; } });
await pending;
assert.deepEqual(deleted, ['kisaragi-demo-v18-old'], 'Activation must retain the current cache and unrelated same-origin caches');
for (const file of ['index-page.js', 'shop.js', 'checkout.js', 'admin/admin.js']) {
  const request = { method: 'GET', url: `http://127.0.0.1:8766/${file}`, destination: 'script' };
  let response;
  handlers.fetch({ request, respondWith(promise) { response = promise; } });
  assert.equal((await response).ok, true, `${file} should come from the network`);
}
assert.deepEqual(fetched.map((item) => item.cache), ['no-store', 'no-store', 'no-store', 'no-store']);
{
  const request = {method:'GET', url:'http://127.0.0.1:8766/account.js?v=offline', destination:'script'};
  let response;
  handlers.fetch({request, respondWith(promise) { response = promise; }});
  assert.equal((await response).source, 'cache', 'a versioned runtime script must fall back to the precached path while offline');
  assert.equal(matched.at(-1).options.ignoreSearch, true, 'offline fallback must ignore the version query string');
}
for (const [file, destination, mode] of [
  ['shop.html', 'document', 'navigate'], ['styles.css', 'style', 'cors'], ['pack.jpg', 'image', 'cors'],
]) {
  const request = { method: 'GET', url: `http://127.0.0.1:8766/${file}`, destination, mode };
  let response;
  handlers.fetch({ request, respondWith(promise) { response = promise; } });
  assert.equal((await response).ok, true, `${file} should come from the network`);
}
assert.deepEqual(fetched.map((item) => item.cache),
  ['no-store', 'no-store', 'no-store', 'no-store', 'no-store', 'no-store', 'no-store', 'default'],
  'navigation and styles must bypass HTTP cache while versioned images retain normal caching');
console.log('PASS: current and unrelated caches preserved; obsolete application cache removed');
