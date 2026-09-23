import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const pages = Object.fromEntries(['index.html','shop.html','checkout.html'].map((path) => [path, read(path)]));
const shopScript = read('shop.js');
const theme = read('kisaragi-public-theme.css');

for (const [path, html] of Object.entries(pages)) {
  for (const token of ['SANDBOX', 'FUNCTION PREVIEW', 'data-catalog-admin', '127.0.0.1:8767/admin']) {
    assert.ok(!html.includes(token), `${path} must not expose internal construction copy: ${token}`);
  }
}

assert.ok(!pages['shop.html'].includes('commerceStatusGrid'), 'shop must not expose the internal capability board');
assert.ok(!pages['checkout.html'].includes('checkoutModuleStatus') && !pages['checkout.html'].includes('commerceStages'), 'checkout must not expose internal connection state');
assert.ok(!/<(?:form|input|select)\b/i.test(pages['checkout.html']), 'checkout must be read-only until protected services are connected');
assert.ok(pages['checkout.html'].includes('id="selectionItems"') && pages['checkout.html'].includes('オンライン注文の受付は準備中です'), 'checkout must preserve selection review and a truthful disabled next action');
for (const id of ['memberModule','ageModule','inventoryModule','deliveryModule','paymentModule','orderModule','notificationModule','trackingModule']) {
  assert.ok(pages['checkout.html'].includes(`id="${id}"`), `checkout must show the ${id} customer module`);
}
assert.equal((pages['checkout.html'].match(/class="module-unavailable" role="status"/g) || []).length, 8, 'all disconnected services must render as status, not fake controls');
assert.ok(!pages['checkout.html'].includes('class="module-button"') && !pages['checkout.html'].includes('class="disabled-order-button"'), 'disconnected services must not look like actionable buttons');
for (const path of ['index.html','shop.html']) {
  assert.ok(pages[path].includes('href="./checkout.html"'), `${path} must expose the saved-selection route`);
}
for (const [path, html] of Object.entries(pages)) {
  assert.ok(html.includes('href="./admin/"'), `${path} must link to the integrated same-site admin route`);
  const globalNavigation = html.match(/<nav class="unified-(?:site-nav|mobile-dock)"[\s\S]*?<\/nav>/g) || [];
  assert.ok(globalNavigation.every((navigation) => !navigation.includes('account.html') && !navigation.includes('admin/')), `${path} global navigation must remain customer-only`);
  assert.ok(html.indexOf('href="./admin/"') > html.indexOf('</main>'), `${path} admin entry must remain in the footer rather than the primary journey`);
}
assert.ok(pages['shop.html'].includes('kisaragi-public-theme.css') && pages['checkout.html'].includes('kisaragi-public-theme.css'), 'shop and checkout must share the client theme');
assert.ok(theme.includes('filter: none !important') && theme.includes('mix-blend-mode: normal !important'), 'product media must preserve source color');
assert.ok(theme.includes('.site-header .mode-switch-group') && theme.includes('display: none !important'), 'mobile header must not duplicate navigation controls');
assert.ok(shopScript.includes('Number(!imageFor(a))-Number(!imageFor(b))'), 'default catalog order must lead with products that have real images');
assert.ok(!shopScript.includes('renderCommerceStatus'), 'public script must not render internal module state');
assert.ok(pages['shop.html'].includes('commerce-live-config.js') && pages['shop.html'].includes('commerce-live-client.js'), 'shop must share the protected commerce client');
assert.ok(shopScript.includes('live().isActivated(capabilities)') && shopScript.includes('live().setCartItem') && shopScript.includes('live().removeCartItem'), 'an activated member cart must use the protected server cart');
assert.ok(shopScript.includes("if(!live()?.configured)return") && shopScript.includes('liveCart.connected=false'), 'shop must retain its local selection list when the protected API is unavailable');

console.log('Public client surface: PASS (unified theme, image-first catalog, simplified mobile header, visible read-only order modules)');
