import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const html = read('admin/commerce.html');
const css = read('admin/commerce.css');
const mobileCss = read('admin/commerce-mobile.css');
const script = read('admin/commerce.js');

for (const marker of [
  'id="coreState"', 'id="providerState"', 'id="activationState"',
  'id="inventoryForm"', 'id="priceApprovalForm"', 'id="refundForm"', 'id="shipmentForm"', 'id="outboxForm"',
    'id="orderLedger"', 'id="ordersList"', 'id="ordersStatus"', 'id="refreshOrders"',
    'id="adminToken" type="password"', 'autocomplete="new-password"',
    'id="tokenForm" class="token-form" autocomplete="off" hidden',
    'id="identityForm" class="identity-form" hidden', 'id="startIdentitySession"',
]) {
  assert.ok(html.includes(marker), `operations console must include ${marker}`);
}

assert.ok(html.includes('事業者が発行した実運送番号だけをAPI応答として記録'), 'shipping UI must explain real carrier tracking provenance');
assert.ok(html.includes('一意に確認できる成功済み決済だけ') && html.includes('複数の成功記録がある場合は自動操作を禁止'), 'payment review UI must state its automatic decision boundary');
assert.ok(html.includes('商品管理の「表示価格」とは別の注文用価格台帳') && html.includes('通信結果が不明な場合の同一入力再送信には同じ冪等キー') && html.includes('成功応答後の再実行は新しい登録'), 'approved order price must be separated from display price and state the exact idempotent retry boundary');
assert.ok(!html.includes('name="trackingNumber"'), 'shipping UI must not accept an invented local tracking number');
assert.ok(!html.includes('value="Bearer') && !html.includes('value="token'), 'admin token must never be prefilled');
assert.ok(script.includes('HttpOnly Cookie') && !html.includes('sessionStorage'), 'both administrator identity modes must end in an HttpOnly short session and never use browser storage');
assert.ok(html.includes('connect-src \'self\' http://127.0.0.1:8769'), 'CSP must restrict the local commerce connection');
assert.ok(css.includes('@media(max-width:800px)') && css.includes('.operations-grid{grid-template-columns:1fr}'), 'console must collapse to one mobile column');
assert.ok(css.includes('.order-card') && css.includes('.payment-review-alert') && css.includes('@media(max-width:480px)'), 'protected order ledger must have responsive order and reconciliation states');
assert.ok(mobileCss.includes('grid-template-columns: minmax(0, 1fr)') && mobileCss.includes('.readiness-layout > *'), 'mobile readiness grid must allow its only track and children to shrink without horizontal overflow');

for (const route of [
  "'/capabilities'", "'/activation/readiness'", "'/admin/inventory/adjust'", "'/admin/prices/approve'",
  "'/admin/session'", "'/admin/outbox/process'", "'/admin/orders'", '/refund`', '/ship`', '/cancel`', '/payment-review/resolve`', '/tracking/refresh`',
]) {
  assert.ok(script.includes(route), `operations controller must call ${route}`);
}

for (const contract of [
  "headers.set('Authorization', `Bearer ${bootstrapToken}`)",
  "headers.set('X-Kisaragi-Commerce', '1')",
  "adminSessionExchangeOptions('local_bootstrap', token)",
  "adminSessionExchangeOptions('trusted_proxy')",
  "headers.set('Idempotency-Key', idempotencyKey)",
  "credentials: 'include'",
  "adminSession.authenticated",
  "method: 'DELETE'",
  "API_BASE = LOCAL_SITE_ORIGINS.has(location.origin)",
  "crypto.randomUUID()",
]) {
  assert.ok(script.includes(contract), `operations controller must enforce ${contract}`);
}

assert.ok(!script.includes('localStorage') && !script.includes('sessionStorage'), 'bootstrap admin token must never be persisted in browser storage');
assert.ok(script.includes("ADMIN_AUTH_MODES = Object.freeze(['local_bootstrap', 'trusted_proxy'])"), 'administrator UI must use only the server-declared authentication modes');
assert.ok(script.includes("ADMIN_IDENTITY_NOT_CONFIGURED: '管理者SSO・受信プロキシ認証'"), 'administrator identity readiness must have a user-facing label');
assert.ok(script.includes("if (!localBootstrap) $('#adminToken').value = ''"), 'trusted-proxy mode must clear and disable the shared-token field');
assert.ok(!script.includes('setTimeout('), 'operations console must not simulate asynchronous success');
assert.ok(!script.includes('Math.random'), 'operations console must not invent business identifiers');
assert.ok(!script.includes('trackingNumber:'), 'operations console must not generate a tracking number');
assert.ok(script.includes("decision: 'fulfill'") && script.includes("decision: 'refund'"), 'payment reconciliation must use the two server-owned decisions');
assert.ok(script.includes('成功済み決済が複数あります。自動判断は禁止') && script.includes('PAYMENT_REVIEW_NOT_AUTOMATABLE'), 'multiple settled payments must fail closed and escalate');
assert.ok(script.includes('REFUND_REASON_REQUIRED') && script.includes('globalThis.confirm'), 'review refund must require an explicit reason and confirmation');
assert.ok(script.includes('UNCERTAIN_OPERATION_INPUT_CHANGED'), 'uncertain mutations must prevent an idempotency-key reset through edited input');
assert.ok(script.includes("accepted: false"), 'rejected operations must be represented as rejected');
assert.ok(script.includes("error.uncertain") && script.includes('pendingIdempotency'), 'uncertain network outcomes must retain their idempotency key for safe retry');
assert.ok(script.includes('error.status >= 500') && script.includes('definitiveResponse'), 'provider/server 5xx outcomes must retain the same idempotency key because the remote outcome may be uncertain');
for (const validator of ['validateInventoryReceipt', 'validatePriceReceipt', 'validateRefundReceipt', 'validateShipmentReceipt', 'validateOutboxReceipt']) {
  assert.ok(script.includes(`.then(${validator})`), `${validator} must validate the server receipt before the UI reports a result`);
}
assert.ok(script.includes("typeof shipment?.trackingNumber !== 'string'") && script.includes("payload?.order?.status !== 'SHIPPED'"), 'shipment completion must require a real carrier tracking receipt and SHIPPED order');

const moduleIds = ['memberAuth', 'cart', 'inventory', 'orders', 'idempotency', 'webhooks', 'outbox', 'audit', 'reconciliation'];
const providerIds = ['ekyc', 'payment', 'carrier', 'email'];
for (const id of [...moduleIds, ...providerIds]) assert.ok(script.includes(id), `readiness UI must cover ${id}`);

assert.ok(script.includes("capabilities?.activated === true") && script.includes("capabilities?.status === 'active'"), 'ACTIVE must require the server activation flag and active status');
assert.ok(script.includes("provider?.configured === true && provider?.verified === true && provider?.status === 'verified'"), 'ACTIVE and provider actions must require configured providers with acceptance evidence');
assert.ok(script.includes("const windDown = currentCapabilities?.activated !== true") && script.includes('既存注文の善後処理が可能'), 'verified provider operations must remain available for existing-order wind-down after new sales stop');
assert.ok(script.includes("!providerReady(providerId)"), 'external mutations must remain disabled until their required provider is configured');
assert.ok(script.includes("if (operationId === 'inventory')"), 'internal inventory must remain independently operable when the core is ready');
assert.ok(script.includes("if (operationId === 'priceApproval')") && script.includes("mutate('priceApproval', '/admin/prices/approve', payload).then(validatePriceReceipt)"), 'approved-price writes must use the protected idempotent mutation path');

function element(dataset = {}) {
  const listeners = new Map();
  const classes = new Set();
  return {
    dataset: {...dataset}, textContent: '', value: '', disabled: false, listeners,
    classList: {add: (name) => classes.add(name), remove: (name) => classes.delete(name)},
    addEventListener: (type, handler) => listeners.set(type, handler),
    querySelector: () => null,
    replaceChildren() {}, append() {},
  };
}

const elements = Object.fromEntries([
  'refreshStatus', 'tokenForm', 'identityForm', 'clearToken', 'inventoryForm', 'priceApprovalForm', 'refundForm', 'shipmentForm', 'outboxForm',
  'tokenState', 'connectionPanel', 'connectionTitle', 'connectionMessage', 'coreState', 'providerState',
  'activationState', 'coreSummary', 'providerSummary', 'activationSummary', 'adminToken', 'saveToken', 'startIdentitySession',
  'credentialTitle', 'credentialModeDescription', 'credentialSecurityNote',
  'moduleList', 'providerList', 'businessRuleList', 'missingList', 'operationStatus', 'operationResponse',
  'refreshOrders', 'ordersSummary', 'ordersStatus', 'ordersList',
].map((id) => [id, element()]));
const forms = [
  ['inventoryForm', 'inventory'], ['priceApprovalForm', 'priceApproval'], ['refundForm', 'refund'], ['shipmentForm', 'shipment'], ['outboxForm', 'outbox'],
].map(([id, operation]) => {
  const form = elements[id];
  form.dataset.operation = operation;
  form.button = element();
  form.querySelector = () => form.button;
  return form;
});
const gates = Object.fromEntries(forms.map((form) => [form.dataset.operation, element()]));
const context = {
  __KISARAGI_COMMERCE_CONSOLE_TEST__: true,
  location: {origin: 'https://public.example', protocol: 'https:', hostname: 'public.example'},
  document: {
    querySelector(selector) {
      if (selector.startsWith('#')) return elements[selector.slice(1)];
      const match = selector.match(/^\[data-gate-for="(.+)"\]$/);
      return match ? gates[match[1]] : null;
    },
    querySelectorAll(selector) { return selector === '[data-operation]' ? forms : []; },
    createElement() { return element(); },
  },
  Headers,
  AbortSignal,
  crypto,
  console,
};
runInNewContext(script, context, {filename: 'admin/commerce.js'});
const hooks = context.__KISARAGI_COMMERCE_CONSOLE_HOOKS__;
assert.ok(hooks, 'test hooks must expose pure contract validators in test mode');

const modules = Object.fromEntries(moduleIds.map((id) => [id, 'ready']));
const disconnectedProviders = Object.fromEntries(providerIds.map((id) => [id, {configured: false, verified: false, status: 'not_configured'}]));
const connectedProviders = Object.fromEntries(providerIds.map((id) => [id, {configured: true, verified: true, status: 'verified'}]));
const rules = {approvedSalePriceRequired: true, freeShipping: false, licensedPremiseRequired: true, ekycAddressMatchRequired: true};
const localAdminAuthentication = {mode: 'local_bootstrap', configured: false, sessionTtlSeconds: 900};
const trustedAdminAuthentication = {mode: 'trusted_proxy', configured: true, sessionTtlSeconds: 900};
const operationShape = (ready) => ({implemented: true, ready, status: ready ? 'ready' : 'provider_not_ready'});
const operations = (ready) => ({
  ekyc: {verify: operationShape(ready), status: operationShape(ready)},
  payment: {create: operationShape(ready), status: operationShape(ready), cancel: operationShape(ready), refund: operationShape(ready), webhook: operationShape(ready)},
  carrier: {create: operationShape(ready), tracking: operationShape(ready)},
  email: {send: operationShape(ready)},
});
const lockedCheckout = {available: false, currency: 'JPY', services: [], deliveryPolicy: null};
const internalCapabilities = {service: 'KISARAGI_COMMERCE', schemaVersion: 3, status: 'ready_internal', activated: false, environment: 'local', modules, providers: disconnectedProviders, operations: operations(false), checkout: lockedCheckout, businessRules: rules, integrations: {adminAuthentication: localAdminAuthentication}};
const activeCapabilities = {...internalCapabilities, status: 'active', activated: true, environment: 'production', providers: connectedProviders, operations: operations(true), checkout: {available: true, currency: 'JPY', services: [{id: 'contracted', label: 'Contracted carrier', feeJpy: 800, freeShippingThresholdJpy: null}], deliveryPolicy: {timeZone: 'Asia/Tokyo'}}, integrations: {adminAuthentication: trustedAdminAuthentication}};
const productionWindDownCapabilities = {...activeCapabilities, status: 'ready_internal', activated: false};
assert.equal(hooks.coreReady(internalCapabilities), true);
assert.equal(hooks.productionActive(internalCapabilities), false);
assert.equal(hooks.productionActive(activeCapabilities), true);
assert.equal(hooks.validateCapabilities(internalCapabilities), internalCapabilities);
assert.equal(hooks.validateCapabilities(activeCapabilities), activeCapabilities);
assert.equal(hooks.adminAuthMode(internalCapabilities), 'local_bootstrap');
assert.equal(hooks.adminAuthMode(productionWindDownCapabilities), 'trusted_proxy', 'production wind-down must not expose the local bootstrap path');
const localControls = hooks.adminAuthControlState(internalCapabilities, {authenticated: false}, {apiAvailable: true, healthy: true, pending: false});
const trustedWindDownControls = hooks.adminAuthControlState(productionWindDownCapabilities, {authenticated: false}, {apiAvailable: true, healthy: true, pending: false});
assert.equal(localControls.showLocal, true);
assert.equal(localControls.showTrusted, false);
assert.equal(trustedWindDownControls.showLocal, false, 'production wind-down must never show the shared-token entry');
assert.equal(trustedWindDownControls.showTrusted, true);
assert.equal(trustedWindDownControls.canStartTrusted, true);
const unconfiguredTrustedControls = hooks.adminAuthControlState({...productionWindDownCapabilities, integrations: {adminAuthentication: {...trustedAdminAuthentication, configured: false}}}, {authenticated: false}, {apiAvailable: true, healthy: true, pending: false});
assert.equal(unconfiguredTrustedControls.showTrusted, true);
assert.equal(unconfiguredTrustedControls.canStartTrusted, false, 'unconfigured trusted identity must remain visible but disabled');
const localExchange = hooks.adminSessionExchangeOptions('local_bootstrap', 'local-secret');
const trustedExchange = hooks.adminSessionExchangeOptions('trusted_proxy');
assert.equal(localExchange.bootstrapToken, 'local-secret');
assert.equal(trustedExchange.bootstrapToken, undefined, 'trusted proxy exchange must not submit a shared token');
assert.equal(Object.hasOwn(trustedExchange, 'body'), false, 'trusted proxy exchange must leave the request body empty');
assert.equal(trustedExchange.sessionExchange, true, 'trusted proxy exchange must still carry the mutation-origin guard');
assert.throws(() => hooks.adminSessionExchangeOptions('unknown'), /確認できません/);
assert.throws(() => hooks.validateCapabilities({...internalCapabilities, service: 'unexpected'}), /形式が正しくありません/);
assert.throws(() => hooks.validateCapabilities({...internalCapabilities, schemaVersion: 2}), /形式が正しくありません/, 'legacy capability schema must fail closed');
assert.throws(() => hooks.validateCapabilities({...internalCapabilities, operations: {...internalCapabilities.operations, payment: {...internalCapabilities.operations.payment, refund: undefined}}}), /外部操作情報/);
assert.throws(() => hooks.validateCapabilities({...internalCapabilities, environment: 'production'}), /形式が正しくありません/, 'production/local-bootstrap mismatch must fail closed');
assert.throws(() => hooks.validateCapabilities({...activeCapabilities, integrations: {adminAuthentication: {...trustedAdminAuthentication, mode: 'unknown'}}}), /形式が正しくありません/);
const validAdminSession = {authenticated: true, actorId: 'operator@example.jp', expiresAt: Date.now() + 60_000};
assert.equal(hooks.validateAdminSession(validAdminSession).actorId, 'operator@example.jp');
assert.equal(hooks.validateAdminSession({authenticated: false}).authenticated, false);
assert.throws(() => hooks.validateAdminSession({authenticated: true, actorId: '', expiresAt: Date.now() + 60_000}, {required: true}), /不完全/);
assert.throws(() => hooks.validateAdminSession({authenticated: false}, {required: true}), /開始できません/);
assert.deepEqual(hooks.validateReadiness({ready: false, activated: false, missing: [{code: 'PAYMENT_NOT_CONFIGURED', label: 'payment provider contract'}], providers: disconnectedProviders}).missing.length, 1);

assert.equal(hooks.validateInventoryReceipt({ledgerEntryId: 'ledger-1', inventory: {productId: 'p-1', onHand: 10, reserved: 2, available: 8}}).inventory.available, 8);
assert.throws(() => hooks.validateInventoryReceipt({inventory: {}}), /不完全/);
assert.equal(hooks.validatePriceReceipt({price: {id: 'price-1', productId: 'p-1', priceJpy: 580, sourceType: 'signed_price_list', sourceReference: 'document-1 line-4', approvedBy: 'commerce-admin', status: 'approved'}}).price.priceJpy, 580);
assert.throws(() => hooks.validatePriceReceipt({price: {priceJpy: 580}}), /不完全/);
assert.equal(hooks.validateRefundReceipt({refund: {id: 'r-1', externalId: 'provider-r-1', amountJpy: 500, status: 'pending'}, order: {id: 'o-1', status: 'REFUND_PENDING'}}).refund.externalId, 'provider-r-1');
assert.throws(() => hooks.validateRefundReceipt({refund: {status: 'succeeded'}}), /不完全/);
assert.equal(hooks.validateShipmentReceipt({shipment: {id: 's-1', externalId: 'provider-s-1', trackingNumber: 'REAL-123', trackingUrl: 'https://carrier.example/REAL-123'}, order: {id: 'o-1', status: 'SHIPPED'}}).shipment.trackingNumber, 'REAL-123');
assert.throws(() => hooks.validateShipmentReceipt({shipment: {trackingNumber: ''}, order: {status: 'SHIPPED'}}), /実運送番号/);
assert.equal(hooks.validateOutboxReceipt({processed: 2, delivered: 1, failed: 1, remaining: 3}).remaining, 3);
assert.throws(() => hooks.validateOutboxReceipt({processed: -1}), /不完全/);

const protectedOrder = {
  id: 'order-1', status: 'PAYMENT_FAILED', paymentReviewRequired: false, currency: 'JPY',
  totals: {subtotalJpy: 580, shippingJpy: 800, totalJpy: 1380},
  shippingAddress: {verifiedByEkyc: true}, carrierService: 'yamato-standard',
  items: [{productId: 'p-1', sku: 'sku-1', name: '商品', unitPriceJpy: 580, quantity: 1, lineTotalJpy: 580}],
  reservations: [{productId: 'p-1', quantity: 1, status: 'active', expiresAt: 1}],
  paymentAttempts: [{id: 'pay-1', provider: 'payment', externalId: 'provider-pay-1', status: 'failed', amountJpy: 1380, failureCode: 'declined'}],
  shipment: null, createdAt: 1, updatedAt: 2,
};
assert.equal(hooks.validateAdminOrders({orders: [protectedOrder]}).orders[0].id, 'order-1');
assert.throws(() => hooks.validateAdminOrders({orders: [{id: 'broken'}]}), /不完全/);
assert.equal(hooks.canCancelOrder(protectedOrder), true);
assert.equal(hooks.canCancelOrder({...protectedOrder, paymentReviewRequired: true}), false);
assert.equal(hooks.validateCancelReceipt({order: {...protectedOrder, status: 'CANCELLED'}}).order.status, 'CANCELLED');
assert.throws(() => hooks.validateCancelReceipt({order: {...protectedOrder, status: 'DRAFT'}}), /不完全/);
assert.equal(hooks.validateTrackingReceipt({inserted: 1, shipment: {id: 'ship-1', trackingNumber: 'REAL-123', status: 'in_transit', events: []}}).inserted, 1);
assert.throws(() => hooks.validateTrackingReceipt({inserted: 0, shipment: {id: 'ship-1', trackingNumber: '', status: 'created', events: []}}), /不完全/);
const settledAttempt = {id: 'pay-settled', provider: 'payment', externalId: 'provider-pay-settled', status: 'succeeded', amountJpy: 1380, failureCode: null};
const reviewOrder = {...protectedOrder, paymentReviewRequired: true, paymentAttempts: [settledAttempt, protectedOrder.paymentAttempts[0]]};
assert.equal(hooks.paymentReviewDecisionState(reviewOrder).paymentAttempt.id, 'pay-settled');
assert.equal(hooks.paymentReviewDecisionState(reviewOrder).fulfillAllowed, true);
assert.equal(hooks.paymentReviewDecisionState({...reviewOrder, paymentAttempts: [settledAttempt, {...settledAttempt, id: 'pay-settled-2', externalId: 'provider-pay-settled-2'}]}).kind, 'multiple_settled');
assert.equal(hooks.paymentReviewDecisionState({...reviewOrder, paymentAttempts: [settledAttempt, {...settledAttempt, id: 'pay-settled-2', externalId: null}]}).kind, 'multiple_settled');
assert.equal(hooks.paymentReviewDecisionState({...reviewOrder, paymentAttempts: protectedOrder.paymentAttempts}).kind, 'no_settled');
assert.equal(hooks.paymentReviewDecisionState({...reviewOrder, status: 'REFUND_PENDING'}).kind, 'refund_pending');
assert.equal(hooks.validatePaymentReviewReceipt({decision: 'fulfill', order: {...reviewOrder, status: 'FULFILLMENT_PENDING', paymentReviewRequired: false}}, 'fulfill').decision, 'fulfill');
assert.throws(() => hooks.validatePaymentReviewReceipt({decision: 'fulfill', order: reviewOrder}, 'fulfill'), /確認できません/);
assert.equal(hooks.validatePaymentReviewReceipt({
  decision: 'refund',
  refund: {id: 'refund-1', externalId: 'provider-refund-1', amountJpy: 1380, status: 'pending'},
  order: {...reviewOrder, status: 'REFUND_PENDING'},
}, 'refund').refund.status, 'pending');
assert.throws(() => hooks.validatePaymentReviewReceipt({decision: 'refund', refund: {status: 'pending'}, order: reviewOrder}, 'refund'), /確認できません/);

console.log('Operations console: PASS (protected ledger, real cancel/tracking/reconciliation routes, fail-closed ambiguity, no simulated receipts)');
