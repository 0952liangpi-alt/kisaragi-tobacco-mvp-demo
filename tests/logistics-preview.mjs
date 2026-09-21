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

assert.ok(html.includes('id="shippingMethods"') && html.includes('id="shippingTotal"') && html.includes('id="estimatedGrandTotal"'), 'shipping selection and quote output are required');
assert.ok(html.includes('id="trackingForm"') && html.includes('物流API未接続'), 'tracking integration reservation must disclose its disconnected state');
assert.ok(html.includes('実際の氏名・住所・追跡番号は入力しないでください'), 'the preview must warn against real personal data');
assert.ok(html.includes('公的証明書による年齢確認と購入者本人の同一性確認が別途必要'), 'the preview must disclose the later identity and age gate');
assert.ok(script.includes('event.preventDefault()'), 'forms must remain local previews');
assert.ok(!script.includes('fetch(') && !script.includes('XMLHttpRequest') && !script.includes('navigator.sendBeacon'), 'checkout must not transmit address or tracking data');
assert.ok(!core.includes('submitOrderAndPayment') && !core.includes('mockTracking') && !core.includes('pdfUrl'), 'logistics core must not fake orders, tracking, or labels');
assert.ok(!core.includes('subtotal >= 15000'), 'free-shipping logic must not be present');
assert.ok(worker.includes("'./checkout.html'") && worker.includes("'./logistics-core.js'"), 'offline shell must include the logistics preview assets');

console.log('Logistics preview: PASS (quote, address, date/time, tracking seam; no network or fake fulfillment)');
