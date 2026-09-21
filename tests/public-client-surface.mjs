import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const pages = Object.fromEntries(['index.html','shop.html','checkout.html'].map((path) => [path, read(path)]));
const shopScript = read('shop.js');
const theme = read('kisaragi-public-theme.css');

for (const [path, html] of Object.entries(pages)) {
  for (const token of ['SANDBOX', 'FUNCTION PREVIEW', 'data-catalog-admin', '商品管理']) {
    assert.ok(!html.includes(token), `${path} must not expose internal construction copy: ${token}`);
  }
}

assert.ok(!pages['shop.html'].includes('commerceStatusGrid'), 'shop must not expose the internal capability board');
assert.ok(!pages['checkout.html'].includes('checkoutModuleStatus') && !pages['checkout.html'].includes('commerceStages'), 'checkout must not expose internal connection state');
assert.ok(!/<(?:form|input|select)\b/i.test(pages['checkout.html']), 'checkout must be read-only until protected services are connected');
assert.ok(pages['checkout.html'].includes('id="selectionItems"') && pages['checkout.html'].includes('オンライン注文は準備中'), 'checkout must preserve selection review and a truthful disabled next action');
assert.ok(pages['shop.html'].includes('kisaragi-public-theme.css') && pages['checkout.html'].includes('kisaragi-public-theme.css'), 'shop and checkout must share the client theme');
assert.ok(theme.includes('filter: none !important') && theme.includes('mix-blend-mode: normal !important'), 'product media must preserve source color');
assert.ok(theme.includes('.site-header .mode-switch-group') && theme.includes('display: none !important'), 'mobile header must not duplicate navigation controls');
assert.ok(shopScript.includes('Number(!imageFor(a))-Number(!imageFor(b))'), 'default catalog order must lead with products that have real images');
assert.ok(!shopScript.includes('renderCommerceStatus'), 'public script must not render internal module state');

console.log('Public client surface: PASS (unified theme, image-first catalog, simplified mobile header, read-only selection page)');
