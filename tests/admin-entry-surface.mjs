import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const publicPages = ['index.html', 'shop.html', 'checkout.html', 'trust.html'];

for (const page of publicPages) {
  const html = read(page);
  assert.ok(html.includes('href="./admin/"'), `${page} must link to the same-site admin route`);
  assert.ok(!html.includes('127.0.0.1:8767/admin'), `${page} must not expose a phone-breaking loopback admin link`);
  const globalNavigation = html.match(/<nav class="unified-(?:site-nav|mobile-dock)"[\s\S]*?<\/nav>/g) || [];
  assert.ok(globalNavigation.every((navigation) => !navigation.includes('admin/')), `${page} must keep the operator route out of global customer navigation`);
  const customerBoundary = page === 'trust.html' ? html.indexOf('id="release-gate"') : html.indexOf('</main>');
  assert.ok(html.indexOf('href="./admin/"') > customerBoundary, `${page} must place the admin entry after customer-facing content`);
}

const home = read('luxury-home.js');
assert.ok(!home.includes('href="./admin/"') && !home.includes('<b>商品管理</b>'), 'the generated homepage primary path must not expose operator tooling');

const trust = read('trust.html');
assert.ok(trust.includes('id="admin-entry"') && trust.includes('公開クラウド管理</dt><dd>未接続'), 'operations page must state the cloud admin boundary');
assert.ok(trust.indexOf('id="admin-entry"') > trust.indexOf('id="release-gate"'), 'operator tooling must follow all customer-facing disclosures');

const admin = read('admin/index.html');
assert.ok(admin.includes('id="connectionPanel"') && admin.includes('id="loginForm" class="login-panel" autocomplete="off" hidden'), 'admin page must gate login behind service verification');
assert.ok(admin.includes('href="./commerce.html"') && admin.includes('取引運用'), 'product admin must link to the same-site commerce operations console');
assert.ok(admin.includes('autocomplete="username" hidden'), 'admin login must expose a hidden username field to password managers');
assert.ok(admin.includes('id="logout"') && admin.includes('ログアウト'), 'the real admin session must expose logout');
assert.ok(admin.includes('公式カタログ価格') && admin.includes('読取専用'), 'product admin must expose official catalog price evidence as read-only');
assert.ok(admin.includes('注文・決済で使用する承認価格とは別'), 'product admin must distinguish catalog evidence from an approved checkout price');
assert.ok(admin.indexOf('../catalog-live-config.js') < admin.indexOf('./admin.js'), 'admin config must load before the admin controller');

const adminScript = read('admin/admin.js');
for (const marker of ['KISARAGI_CATALOG_ADMIN', 'catalog.read', 'product.update', 'image.upload']) {
  assert.ok(adminScript.includes(marker), `admin controller must validate ${marker}`);
}
assert.ok(adminScript.includes("if (!apiBase)") && adminScript.includes("'クラウド管理は未接続です'"), 'public admin must fail closed when no data service is configured');
assert.ok(adminScript.includes("credentials: 'include'"), 'protected local admin requests must carry the HttpOnly session cookie');
assert.ok(adminScript.includes('AbortSignal.timeout(requestTimeoutMs)'), 'admin API requests must have a bounded timeout');
assert.ok(adminScript.includes('official_catalog_price_source_id') && adminScript.includes('official_catalog_price_extraction_status'), 'admin controller must render official catalog price provenance');

const loader = read('catalog-live-loader.js');
assert.ok(!loader.includes('data-catalog-admin'), 'catalog loading must not reveal an admin link without service health proof');

const worker = read('service-worker.js');
for (const asset of ["'./admin/'", "'./admin/admin.css'", "'./admin/admin.js'", "'./admin/commerce.html'", "'./admin/commerce.css'", "'./admin/commerce.js'", "'./admin-entry.css'"]) {
  assert.ok(worker.includes(asset), `service worker must include ${asset}`);
}
assert.ok(worker.includes('admin\\/(?:admin|commerce)'), 'all admin runtime assets must bypass stale cache');

const detail = read('product-detail.js');
assert.ok(detail.includes('/^https?:\\/\\//.test(sourcePath)'), 'product details must preserve absolute uploaded image URLs');

console.log('Admin integration: PASS (one-site route, fail-closed public state, health-gated real local editor)');
