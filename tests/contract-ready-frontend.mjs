import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const configSource = read('commerce-live-config.js');
const clientSource = read('commerce-live-client.js');
const checkoutHtml = read('checkout.html');
const checkoutScript = read('checkout.js');
const accountHtml = read('account.html');
const accountScript = read('account.js');
const trustHtml = read('trust.html');
const trustScript = read('trust.js');

function loadConfig(hostname, port, protocol = 'https:', origin = `${protocol}//${hostname}${port ? `:${port}` : ''}`) {
  const context = {globalThis:{}, location:{hostname, port, protocol, origin}};
  vm.runInNewContext(configSource, context);
  return context.globalThis.KISARAGI_COMMERCE_CONFIG;
}

assert.equal(loadConfig('127.0.0.1', '8766', 'http:', 'http://127.0.0.1:8766').apiBase, 'http://127.0.0.1:8769/commerce/api', 'local preview must use the protected commerce service');
assert.equal(loadConfig('0952liangpi-alt.github.io', '').apiBase, null, 'public GitHub Pages must fail closed until a protected cloud API is deployed');
assert.equal(loadConfig('shop.example.jp', '').apiBase, 'https://shop.example.jp/commerce/api', 'a protected custom-domain deployment must use the same-origin cloud seam');

const clientContext = {
  globalThis:{KISARAGI_COMMERCE_CONFIG:{apiBase:null, requestTimeoutMs:100}},
  Headers,
  AbortSignal,
  URL,
};
vm.runInNewContext(clientSource, clientContext);
const client = clientContext.globalThis.KISARAGI_COMMERCE_LIVE;
assert.equal(client.configured, false, 'client must report an unconfigured public API');
assert.equal(client.isActivated({status:'active', activated:true, providers:{}}), false, 'activation must require every accepted provider');
assert.equal(client.isActivated({
  status:'active', activated:true,
  providers:Object.fromEntries(['ekyc','payment','carrier','email'].map((id) => [id,{configured:true,verified:true,status:'verified'}])),
}), true, 'activation must require explicit active state and all provider readiness receipts');
assert.equal(client.isActivated({
  status:'active', activated:true,
  providers:Object.fromEntries(['ekyc','payment','carrier','email'].map((id) => [id,{configured:true,verified:false,status:'configured_unverified'}])),
}), false, 'configured endpoints without acceptance evidence must remain inactive');

const capabilityProvider = (ready) => ({configured:ready, verified:ready, status:ready ? 'verified' : 'not_configured'});
const capabilityOperation = (ready) => ({implemented:true, ready, status:ready ? 'ready' : 'provider_not_ready'});
const capabilityOperations = (ready) => ({
  ekyc:{verify:capabilityOperation(ready), status:capabilityOperation(ready)},
  payment:{create:capabilityOperation(ready), status:capabilityOperation(ready), cancel:capabilityOperation(ready), refund:capabilityOperation(ready), webhook:capabilityOperation(ready)},
  carrier:{create:capabilityOperation(ready), tracking:capabilityOperation(ready)},
  email:{send:capabilityOperation(ready)},
});
const validCapabilityDocument = {
  service:'KISARAGI_COMMERCE', schemaVersion:3, status:'ready_internal', activated:false,
  modules:{memberAuth:'ready'},
  providers:Object.fromEntries(['ekyc','payment','carrier','email'].map((id) => [id, capabilityProvider(false)])),
  operations:capabilityOperations(false),
  checkout:{available:false, currency:'JPY', services:[], deliveryPolicy:null},
};
const capabilityContext = {
  globalThis:{KISARAGI_COMMERCE_CONFIG:{apiBase:'http://127.0.0.1:8769/commerce/api', requestTimeoutMs:100}},
  Headers, AbortSignal, URL, Response,
  fetch:async () => new Response(JSON.stringify(validCapabilityDocument), {status:200, headers:{'Content-Type':'application/json'}}),
};
capabilityContext.globalThis.fetch = capabilityContext.fetch;
vm.runInNewContext(clientSource, capabilityContext);
assert.equal((await capabilityContext.globalThis.KISARAGI_COMMERCE_LIVE.capabilities()).schemaVersion, 3, 'live client must accept capability schema v3');
capabilityContext.fetch = async () => new Response(JSON.stringify({...validCapabilityDocument, schemaVersion:2}), {status:200, headers:{'Content-Type':'application/json'}});
capabilityContext.globalThis.fetch = capabilityContext.fetch;
vm.runInNewContext(clientSource, capabilityContext);
await assert.rejects(() => capabilityContext.globalThis.KISARAGI_COMMERCE_LIVE.capabilities(), /Unexpected commerce capability document/, 'live client must reject stale capability schemas');

const requests = [];
const liveContext = {
  globalThis:{
    KISARAGI_COMMERCE_CONFIG:{apiBase:'http://127.0.0.1:8769/commerce/api', requestTimeoutMs:100},
    crypto:{randomUUID:() => '12345678-1234-4123-8123-123456789abc', subtle:webcrypto.subtle},
  },
  Headers,
  AbortSignal,
  TextEncoder,
  URL,
  fetch:async (url, options) => {
    requests.push({url, options});
    return new Response(JSON.stringify({order:{id:'order-real',status:'DRAFT'}}), {status:201, headers:{'Content-Type':'application/json'}});
  },
  Response,
};
liveContext.globalThis.fetch = liveContext.fetch;
vm.runInNewContext(clientSource, liveContext);
await liveContext.globalThis.KISARAGI_COMMERCE_LIVE.checkoutOptions();
assert.match(requests.at(-1).url, /\/checkout\/options$/, 'checkout options must come from the protected API');
await liveContext.globalThis.KISARAGI_COMMERCE_LIVE.createDraftOrder({postalCode:'100-0001'}, 'yamato', '2026-09-25', '18-20');
const draftRequest = requests.at(-1);
assert.equal(new Headers(draftRequest.options.headers).get('X-Kisaragi-Commerce'), '1', 'mutations must carry the same-origin commerce guard header');
assert.match(new Headers(draftRequest.options.headers).get('Idempotency-Key'), /^draft:/, 'draft writes must carry a cryptographically generated idempotency key');
assert.deepEqual(JSON.parse(draftRequest.options.body), {
  shippingAddress:{postalCode:'100-0001'}, carrierService:'yamato', deliveryDate:'2026-09-25', timeSlot:'18-20',
}, 'draft request must persist the selected carrier, delivery date, and server-defined time slot');

const retryRequests = [];
const retryStorage = new Map();
let retryAttempt = 0;
const retryContext = {
  globalThis:{
    KISARAGI_COMMERCE_CONFIG:{apiBase:'http://127.0.0.1:8769/commerce/api', requestTimeoutMs:100},
    crypto:{randomUUID:() => `00000000-0000-4000-8000-${String(++retryAttempt).padStart(12, '0')}`, subtle:webcrypto.subtle},
    sessionStorage:{
      getItem:(key) => retryStorage.get(key) || null,
      setItem:(key, value) => retryStorage.set(key, value),
      removeItem:(key) => retryStorage.delete(key),
    },
  },
  Headers,
  AbortSignal,
  TextEncoder,
  URL,
  Response,
  fetch:async (url, options) => {
    retryRequests.push({url, options});
    if (retryRequests.length === 1) throw new TypeError('connection dropped after send');
    return new Response(JSON.stringify({order:{id:'order-recovered',status:'DRAFT'}}), {status:201, headers:{'Content-Type':'application/json'}});
  },
};
retryContext.globalThis.fetch = retryContext.fetch;
vm.runInNewContext(clientSource, retryContext);
const retryClient = retryContext.globalThis.KISARAGI_COMMERCE_LIVE;
await assert.rejects(() => retryClient.createDraftOrder({postalCode:'100-0001'}, 'yamato', '2026-09-25', '18-20'), /unavailable/);
const persistedRetryState = [...retryStorage.values()][0];
assert.doesNotMatch(persistedRetryState, /100-0001|yamato|2026-09-25|18-20/, 'persisted retry state must not contain address or delivery data');
assert.match(JSON.parse(persistedRetryState).fingerprint, /^[a-f0-9]{64}$/, 'persisted request fingerprint must be a SHA-256 digest');
await retryClient.createDraftOrder({postalCode:'100-0001'}, 'yamato', '2026-09-25', '18-20');
const firstUncertainKey = new Headers(retryRequests[0].options.headers).get('Idempotency-Key');
const recoveredKey = new Headers(retryRequests[1].options.headers).get('Idempotency-Key');
assert.equal(recoveredKey, firstUncertainKey, 'an uncertain network outcome must reuse the exact same idempotency key');
assert.equal(retryStorage.size, 0, 'the retained idempotency key must be cleared after a confirmed response');

for (const path of ['/capabilities','/activation/readiness','/merchant-disclosures','/session','/cart','/checkout/options','/orders','/orders/draft','/activate','/retry-payment']) {
  assert.ok(clientSource.includes(path), `live client must implement ${path}`);
}
for (const token of ['Math.random', 'setTimeout', 'mockTracking', 'example.com/labels', 'success: true']) {
  assert.ok(!clientSource.includes(token) && !checkoutScript.includes(token) && !accountScript.includes(token), `frontend must not synthesize success with ${token}`);
}

for (const html of [checkoutHtml, accountHtml]) {
  assert.ok(html.includes('commerce-live-config.js') && html.includes('commerce-live-client.js'), 'commerce pages must share one protected API client');
  assert.ok(!/<(?:form|input|select)\b/i.test(html), 'sensitive controls must not exist in static public HTML');
}

const checkoutFirstScreen = checkoutHtml.slice(checkoutHtml.indexOf('<section class="intro">'), checkoutHtml.indexOf('<section class="checkout-grid"'));
const accountFirstScreen = accountHtml.slice(accountHtml.indexOf('<section class="account-intro">'), accountHtml.indexOf('<section class="three-layer"'));
for (const [surface, firstScreen] of [['checkout', checkoutFirstScreen], ['account', accountFirstScreen]]) {
  for (const technicalTerm of ['内部コア', '外部契約', '接続境界', '総合販売スイッチ', 'commerce API', '本番受入']) {
    assert.ok(!firstScreen.includes(technicalTerm), `${surface} first screen must not expose engineering term ${technicalTerm}`);
  }
}
assert.ok(!checkoutScript.includes("notice.querySelector('strong').textContent = '内部コア") && !checkoutScript.includes('公開環境の保護された commerce API'), 'checkout runtime must not replace customer-facing first-screen copy with engineering language');
assert.ok(!accountScript.includes("setServiceState('offline', '外部契約待ち・販売開始前'") && !accountScript.includes("'内部コア構築済み・外部契約待ち'"), 'account runtime must not replace customer-facing first-screen copy with engineering language');
assert.ok(checkoutHtml.includes('機能：準備済み') && checkoutHtml.includes('契約・接続準備中') && checkoutHtml.includes('受付開始前の確認項目'), 'checkout detail must retain the real internal, provider, and activation state in customer language');
assert.ok(checkoutHtml.includes('id="selectionItems"') && checkoutScript.includes('会員カート'), 'the local selection and protected member-cart implementation must both remain real');
assert.ok(accountHtml.includes('サイト機能') && accountHtml.includes('外部契約') && accountHtml.includes('販売開始'), 'account page must expose the three readiness layers in customer language');
for (const blocker of ['通信販売許可','供給元審査','承認済み販売価格表','外部事業者の契約情報','公開環境の安全確認','販売開始前の総合テスト']) {
  assert.ok(accountHtml.includes(blocker), `account readiness must include ${blocker}`);
}
assert.ok(checkoutScript.includes('isApprovedPriceSource') && checkoutHtml.includes('参考表示価格') && checkoutHtml.includes('承認済み販売価格'), 'reference display prices and approved sale prices must stay separate');
assert.ok(checkoutScript.includes('live().isActivated(liveCapabilities)') && accountScript.includes('client().isActivated(capabilities)'), 'sensitive controls must require a server-confirmed activation state');
assert.ok(checkoutScript.includes('live().createDraftOrder') && checkoutScript.includes('const persistedOrder = draft.order || draft') && checkoutScript.includes("DRAFT:'確認待ち'") && checkoutScript.includes('orderStatusLabel(persistedStatus)') && checkoutScript.includes('activateOrder(orderId)'), 'checkout must persist a real draft and map its server status before external activation');
assert.ok(checkoutScript.includes('orderStatusLabel(response.order?.status)'), 'activated-order feedback must not expose a raw server status');
assert.ok(checkoutScript.includes("url.protocol === 'https:'"), 'external provider navigation must only accept HTTPS URLs');
assert.ok(checkoutScript.includes('service.freeShippingThresholdJpy') && !checkoutScript.includes('subtotal >= 15000'), 'free shipping must use the approved per-service threshold and never invent a fixed amount');
assert.ok(checkoutScript.includes('live().checkoutOptions()') && checkoutScript.includes('options?.services') && !checkoutScript.includes("{id:'yamato'"), 'checkout must only offer protected server-approved services');
assert.ok(checkoutScript.includes("policy?.timeZone !== 'Asia/Tokyo'") && checkoutScript.includes('policy.minDays') && checkoutScript.includes('policy.maxDays'), 'delivery dates must be generated from the server policy in Asia/Tokyo');
assert.ok(checkoutScript.includes("['対面受取', '受取時年齢確認要', '置き配不可']") && checkoutScript.includes('policy.leaveAtDoorAllowed'), 'activated checkout must render the server-confirmed tobacco delivery conditions');
assert.ok(checkoutScript.includes('eKYC 年齢確認処理中...') && checkoutScript.includes('決済処理状況を確認中...'), 'activation feedback must distinguish eKYC and payment processing without declaring success');
assert.ok(accountScript.includes('retryPayment') && clientSource.includes('retry-payment'), 'payment failure must expose a real idempotent server retry path');
assert.ok(accountScript.includes('client().order(id)') && accountScript.includes('order.publicReference') && accountScript.includes('order.deliveryPreference'), 'each real order must expose protected on-demand details and the public reference/delivery preference');
assert.ok(accountScript.includes('memberStatusLabel(session.user?.status)') && accountScript.includes('shipmentStatusLabel(shipment.status)') && accountScript.includes('shipmentStatusLabel(event.status)'), 'member and shipment views must map raw server statuses to customer language');
assert.ok(accountScript.includes('shipment?.events') && accountScript.includes("url.protocol === 'https:'") && !accountScript.includes('羽田'), 'tracking must render only server-returned events and HTTPS provider links');
assert.ok(accountScript.includes("const loginAllowed = mode === 'login' && Boolean(capabilities)"), 'existing members must retain login and order-history access while new sales are disabled');
assert.ok(accountScript.includes('新規登録と新規販売は停止中です。既存会員はログインして注文履歴を確認できます。'), 'the stopped-sale member state must explain the read-only service boundary');
assert.ok(accountHtml.includes('既存会員のログインと注文履歴確認のみ継続') && accountHtml.includes('新規登録、住所入力、本人確認、決済、注文確定は受け付けません'), 'account copy must describe the wind-down boundary without claiming all login is disabled');
for (const script of [checkoutScript, accountScript]) {
  for (const code of ['DEPLOYMENT_SECURITY_NOT_CONFIGURED','DEPLOYMENT_SECURITY_EVIDENCE_STALE','DEPLOYMENT_SECURITY_ACCEPTANCE_UNVERIFIED','MERCHANT_PUBLICATION_NOT_CONFIGURED','MERCHANT_PUBLICATION_ACCEPTANCE_UNVERIFIED','ADMIN_IDENTITY_NOT_CONFIGURED']) {
    assert.ok(script.includes(code), `readiness copy must map ${code}`);
  }
}
assert.ok(trustHtml.includes('commerce-live-config.js') && trustHtml.includes('commerce-live-client.js') && trustHtml.includes('trust.js'), 'trust page must load the protected disclosure client');
assert.ok(trustHtml.includes('運営者情報：公開準備中') && trustHtml.includes('暗号化、バックアップ復旧、監視、アクセス制御の安全確認'), 'trust page must preserve a customer-readable unverified publication and security state');
assert.ok(trustScript.includes('merchantDisclosures()') && trustScript.includes('.textContent =') && !trustScript.includes('innerHTML'), 'merchant disclosures must render through textContent only');

console.log('Contract-ready frontend: PASS (fail-closed public mode, live capability/session/cart/order/disclosure client, approved-price boundary, activation-gated sensitive controls)');
