import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const pages = ['index.html', 'shop.html', 'checkout.html', 'account.html', 'trust.html'];
const canonicalRoutes = [
  './index.html',
  './shop.html#catalog',
  './checkout.html',
  './trust.html'
];
const desktopLabels = ['ホーム', '商品案内', '選択リスト', '利用案内'];
const mobileLabels = ['ホーム', '商品', '選択', '案内'];

for (const page of pages) {
  const html = read(page);
  assert.ok(html.includes('class="unified-site-nav"'), `${page} must expose the shared desktop navigation`);
  assert.ok(html.includes('class="unified-mobile-dock"'), `${page} must expose the shared mobile navigation`);
  assert.ok(html.includes('unified-site-shell.css?v=20260922-unified1'), `${page} must load the shared site shell last`);
  for (const route of canonicalRoutes) {
    assert.ok(html.includes(`href="${route}"`), `${page} must link to ${route}`);
  }
  const desktopNav = html.match(/<nav class="unified-site-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  const mobileNav = html.match(/<nav class="unified-mobile-dock"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.equal((desktopNav.match(/<a\b/g) || []).length, 4, `${page} desktop navigation must contain four user routes`);
  assert.equal((mobileNav.match(/<a\b/g) || []).length, 4, `${page} mobile navigation must contain four user routes`);
  for (const label of desktopLabels) assert.ok(desktopNav.includes(`>${label}</a>`), `${page} desktop navigation must expose ${label}`);
  for (const label of mobileLabels) assert.ok(mobileNav.includes(`>${label}</a>`), `${page} mobile navigation must expose ${label}`);
  for (const navigation of [desktopNav, mobileNav]) {
    assert.ok(!navigation.includes('target="_blank"'), `${page} global navigation must stay in the same tab`);
    assert.ok(!navigation.includes('account.html') && !navigation.includes('admin/'), `${page} global navigation must not expose account or operator routes`);
  }
}

const home = read('luxury-home.js');
for (const route of canonicalRoutes) {
  assert.ok(home.includes(`href="${route}"`), `dynamic homepage navigation must link to ${route}`);
}
assert.ok(home.includes('luxury-links unified-site-nav'), 'dynamic homepage must reuse the shared navigation contract');
assert.ok(!home.includes('href="./account.html"') && !home.includes('href="./admin/"'), 'dynamic homepage navigation and primary path must stay customer-focused');
for (const label of desktopLabels) assert.ok(home.includes(`>${label}</a>`), `dynamic homepage navigation must expose ${label}`);

const css = read('unified-site-shell.css');
assert.ok(css.includes('grid-template-columns: repeat(4, minmax(0, 1fr))'), 'mobile navigation must use four stable columns');
assert.ok(css.includes('env(safe-area-inset-bottom, 0px)'), 'mobile navigation must respect iPhone safe area');
assert.ok(css.includes('white-space: nowrap'), 'mobile labels must remain legible without wrapping');

const worker = read('service-worker.js');
assert.match(worker, /CACHE_NAME\s*=\s*'kisaragi-demo-v(?:5[6-9]|[6-9]\d|\d{3,})-[^']+'/, 'the service worker cache must advance after the four-route navigation release');
assert.ok(worker.includes("'./unified-site-shell.css'"), 'the shared shell must be available offline');
for (const asset of ["'./index-page.js'", "'./account.html'", "'./account.css'", "'./account.js'", "'./trust.js'", "'./commerce-live-config.js'", "'./commerce-live-client.js'"]) {
  assert.ok(worker.includes(asset), `the contract-ready shell must include ${asset}`);
}
assert.ok(worker.includes('unified-site-shell|sprite-loader'), 'the shared shell must bypass stale runtime cache');

console.log('Unified site navigation: PASS (five pages, two viewports, four customer routes; account/admin excluded)');
