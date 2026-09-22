import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const pages = ['index.html', 'shop.html', 'checkout.html', 'trust.html'];
const canonicalRoutes = [
  './index.html',
  './shop.html#catalog',
  './index.html#jp-sku-catalog',
  './checkout.html#orderFunctions',
  './trust.html'
];

for (const page of pages) {
  const html = read(page);
  assert.ok(html.includes('class="unified-site-nav"'), `${page} must expose the shared desktop navigation`);
  assert.ok(html.includes('class="unified-mobile-dock"'), `${page} must expose the shared mobile navigation`);
  assert.ok(html.includes('unified-site-shell.css?v=20260922-unified1'), `${page} must load the shared site shell last`);
  for (const route of canonicalRoutes) {
    assert.ok(html.includes(`href="${route}"`), `${page} must link to ${route}`);
  }
  const navigation = html.match(/<nav class="unified-(?:site-nav|mobile-dock)"[\s\S]*?<\/nav>/g) || [];
  assert.equal(navigation.length, 2, `${page} must render exactly one desktop and one mobile global navigation`);
  assert.ok(navigation.every((block) => !block.includes('target="_blank"')), `${page} global navigation must stay in the same tab`);
}

const home = read('luxury-home.js');
for (const route of canonicalRoutes) {
  assert.ok(home.includes(`href="${route}"`), `dynamic homepage navigation must link to ${route}`);
}
assert.ok(home.includes('luxury-links unified-site-nav'), 'dynamic homepage must reuse the shared navigation contract');

const css = read('unified-site-shell.css');
assert.ok(css.includes('grid-template-columns: repeat(5, minmax(0, 1fr))'), 'mobile navigation must use five stable columns');
assert.ok(css.includes('env(safe-area-inset-bottom, 0px)'), 'mobile navigation must respect iPhone safe area');
assert.ok(css.includes('white-space: nowrap'), 'mobile labels must remain legible without wrapping');

const worker = read('service-worker.js');
assert.ok(worker.includes('kisaragi-demo-v48-admin-integration'), 'the service worker cache must advance for the admin integration');
assert.ok(worker.includes("'./unified-site-shell.css'"), 'the shared shell must be available offline');
assert.ok(worker.includes('unified-site-shell|sprite-loader'), 'the shared shell must bypass stale runtime cache');

console.log('Unified site navigation: PASS (four pages, two viewports, five canonical routes)');
