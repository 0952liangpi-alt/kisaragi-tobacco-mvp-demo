import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const core = read('commerce-core.js');
const shopHtml = read('shop.html');
const shopScript = read('shop.js');
const checkoutHtml = read('checkout.html');
const checkoutScript = read('checkout.js');
const worker = read('service-worker.js');

const context = vm.createContext({globalThis:{}});
vm.runInContext(core, context);
const commerce = context.globalThis.KISARAGI_COMMERCE;

assert.ok(commerce, 'commerce core must initialize');
assert.equal(commerce.modules.length, 9, 'the formal commerce shell must expose nine capability modules');
assert.deepEqual(
  Array.from(commerce.modules.filter((module) => module.status === 'READY_LOCAL'), (module) => module.id),
  ['catalog', 'cart'],
  'only catalog and local cart may be marked ready'
);
assert.deepEqual(
  Array.from(commerce.modules.filter((module) => module.status === 'PREVIEW_ONLY'), (module) => module.id),
  ['logistics'],
  'only logistics may be marked preview-only'
);
assert.ok(
  commerce.modules.filter((module) => ['member','age','inventory','payment','order','notification'].includes(module.id)).every((module) => module.status === 'NOT_CONNECTED'),
  'identity, inventory, payment, order, and notification modules must remain disconnected'
);

assert.deepEqual(
  JSON.parse(JSON.stringify(commerce.normalizeCart(['a','a','b']))),
  [{id:'a',quantity:2},{id:'b',quantity:1}],
  'legacy ID arrays must migrate and merge quantities'
);
assert.deepEqual(
  JSON.parse(JSON.stringify(commerce.normalizeCart([{id:'a',quantity:3},{id:'a',qty:4},{id:'b',quantity:500}]))),
  [{id:'a',quantity:7},{id:'b',quantity:99}],
  'structured cart entries must merge and clamp quantities'
);
assert.deepEqual(JSON.parse(JSON.stringify(commerce.parseCart('{broken'))), [], 'invalid stored cart JSON must fail closed');

const storage = {
  value:'',
  getItem() { return this.value; },
  setItem(_key, value) { this.value = value; }
};
commerce.writeCart([{id:'sku-1',quantity:2}], storage);
assert.deepEqual(JSON.parse(JSON.stringify(commerce.readCart(storage))), [{id:'sku-1',quantity:2}], 'cart storage round-trip must preserve quantity');
assert.equal(commerce.quantityCount([{id:'sku-1',quantity:2},{id:'sku-2',quantity:3}]), 5, 'cart count must count units');

assert.ok(!shopHtml.includes('id="commerceStatusGrid"') && !checkoutHtml.includes('id="checkoutModuleStatus"'), 'internal module status boards must stay out of the public pages');
assert.ok(!checkoutHtml.includes('id="commerceStages"'), 'the public selection page must not expose the internal purchase stage map');
assert.ok(checkoutHtml.includes('id="selectionItems"') && checkoutHtml.includes('ご注文までの流れ'), 'checkout must present the saved selection and customer-facing next steps');
assert.ok(checkoutHtml.includes('オンライン注文の受付は準備中です') && checkoutHtml.includes('注文受付：未接続'), 'the future order path must remain visibly disconnected');
for (const label of ['会員・ログイン','eKYC・年齢確認','在庫・最終価格確認','配送・受取方法','お支払い','注文内容の確認・確定','注文履歴・お知らせ','配送状況・追跡']) {
  assert.ok(checkoutHtml.includes(label), `checkout must expose the customer-facing ${label} connection status`);
}
assert.ok(!/<(?:form|input|select)\b/i.test(checkoutHtml), 'the public selection page must not accept personal, shipping, or payment data');
assert.equal((checkoutHtml.match(/class="module-unavailable" role="status"/g) || []).length, 8, 'disconnected services must be status rows, not fake feature controls');
assert.ok(!checkoutHtml.includes('class="module-button"') && !checkoutHtml.includes('class="disabled-order-button"'), 'disconnected service cards must not contain fake action buttons');
assert.ok(shopScript.includes('quantity-plus') && shopScript.includes('quantity-minus') && shopScript.includes('removeFromCart'), 'cart must expose quantity and remove controls');
assert.ok(checkoutScript.includes('knownSubtotal += Number(price) * quantity'), 'selection totals must multiply price by quantity');
assert.ok(worker.includes("'./commerce-core.js'") && worker.includes("'./kisaragi-public-theme.css'"), 'offline shell must include commerce core and the shared public theme');

for (const [name, source] of [['shop', shopScript], ['checkout', checkoutScript], ['commerce core', core]]) {
  assert.ok(!source.includes('fetch(') && !source.includes('XMLHttpRequest') && !source.includes('navigator.sendBeacon'), `${name} must not transmit commerce or identity data`);
  assert.ok(!source.includes('submitOrderAndPayment') && !source.includes('ekyc_stage_token_') && !source.includes('orderId:'), `${name} must not fake a connected order or eKYC result`);
}

console.log('Commerce shell: PASS (9-module internal contract, quantity-aware selection list, no public data-entry facade)');
