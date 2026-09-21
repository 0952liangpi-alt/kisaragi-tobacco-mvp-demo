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

assert.ok(shopHtml.includes('id="commerceStatusGrid"') && checkoutHtml.includes('id="checkoutModuleStatus"'), 'status boards must exist on shop and checkout pages');
assert.ok(checkoutHtml.includes('id="commerceStages"'), 'checkout must show the five-stage purchase flow');
assert.ok(checkoutHtml.includes('会員ログイン（未接続）') && checkoutHtml.includes('eKYC 年齢確認（未接続）'), 'member and eKYC modules must be visible and disabled');
assert.ok(checkoutHtml.includes('注文を確定する（未接続）') && /注文を確定する（未接続）<\/button>/.test(checkoutHtml), 'order confirmation must be visible as disconnected');
assert.ok((checkoutHtml.match(/type="button" disabled/g) || []).length >= 3, 'disconnected actions must use disabled buttons');
assert.ok(shopScript.includes('quantity-plus') && shopScript.includes('quantity-minus') && shopScript.includes('removeFromCart'), 'cart must expose quantity and remove controls');
assert.ok(checkoutScript.includes('Number(currentPrice(line.item) ?? 0) * line.quantity'), 'checkout totals must multiply price by quantity');
assert.ok(worker.includes("'./commerce-core.js'") && worker.includes('commerce-core|logistics-core'), 'offline shell and runtime freshness policy must include commerce core');

for (const [name, source] of [['shop', shopScript], ['checkout', checkoutScript], ['commerce core', core]]) {
  assert.ok(!source.includes('fetch(') && !source.includes('XMLHttpRequest') && !source.includes('navigator.sendBeacon'), `${name} must not transmit commerce or identity data`);
  assert.ok(!source.includes('submitOrderAndPayment') && !source.includes('ekyc_stage_token_') && !source.includes('orderId:'), `${name} must not fake a connected order or eKYC result`);
}

console.log('Commerce shell: PASS (9 modules, cart migration and quantity, disconnected identity/payment/order boundary)');
