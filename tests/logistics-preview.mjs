import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const html = read('checkout.html');
const script = read('checkout.js');
const core = read('logistics-core.js');
const worker = read('service-worker.js');

const context = vm.createContext({globalThis:{}, Date});
vm.runInContext(core, context);
const logistics = context.globalThis.KISARAGI_LOGISTICS;

assert.equal(logistics.shippingMethods.length, 3, 'three provisional carrier options are required');
assert.ok(logistics.integrations.every((entry) => entry.status === 'NOT_CONNECTED'), 'every carrier integration must default to NOT_CONNECTED');
assert.equal(logistics.calculateQuote({methodId:'yamato', subtotal:15000}).shippingFee, 800, 'the preview must not silently apply free shipping');
assert.equal(logistics.calculateQuote({methodId:'sagawa', subtotal:1000}).knownGrandTotal, 1750, 'subtotal and provisional shipping must be added');
assert.equal(logistics.getAvailableDeliveryDates(new Date(2026, 8, 21)).length, 8, 'delivery preference window must cover days 3 through 10');
assert.equal(logistics.validateAddress({recipientName:'テスト 太郎', phone:'090-1234-5678', postalCode:'100-0001', prefecture:'東京都', addressLine:'千代田区千代田'}).valid, true, 'valid Japanese preview address must pass');
assert.equal(logistics.validateAddress({recipientName:'テスト 太郎', phone:'090-1234-5678', postalCode:'100-01', prefecture:'東京都', addressLine:'千代田区千代田'}).valid, false, 'invalid postal code must fail');

assert.ok(!html.includes('id="shippingMethods"') && !html.includes('id="trackingForm"'), 'shipping and tracking controls must stay out of the public selection page until connected');
assert.ok(!/<(?:form|input|select)\b/i.test(html), 'the public selection page must not collect personal or logistics data');
assert.ok(html.includes('eKYC・年齢確認') && html.includes('配送・受取方法') && html.includes('配送状況・追跡'), 'identity, delivery, and tracking modules must remain visible as read-only customer functions');
assert.ok(html.includes('現在は入力できません') && html.includes('現在は発行しません'), 'disconnected delivery and tracking modules must tell customers that data entry and IDs are unavailable');
assert.ok(!html.includes('logistics-core.js'), 'the public selection page must not load the provisional logistics module');
assert.ok(!script.includes('fetch(') && !script.includes('XMLHttpRequest') && !script.includes('navigator.sendBeacon'), 'checkout must not transmit address or tracking data');
assert.ok(!core.includes('submitOrderAndPayment') && !core.includes('mockTracking') && !core.includes('pdfUrl'), 'logistics core must not fake orders, tracking, or labels');
assert.ok(!core.includes('subtotal >= 15000'), 'free-shipping logic must not be present');
assert.ok(worker.includes("'./checkout.html'") && worker.includes("'./logistics-core.js'"), 'offline shell must include the logistics preview assets');

console.log('Logistics contract: PASS (internal quote seam retained; no public form, tracking control, network, or fake fulfillment)');
