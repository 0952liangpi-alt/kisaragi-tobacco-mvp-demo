(() => {
  'use strict';

  const LOCAL_SITE_ORIGINS = new Set(['http://127.0.0.1:8766', 'http://localhost:8766']);
  const API_BASE = LOCAL_SITE_ORIGINS.has(location.origin)
    ? 'http://127.0.0.1:8769/commerce/api'
    : location.protocol === 'https:' && !location.hostname.endsWith('.github.io')
      ? `${location.origin}/commerce/api`
      : null;
  const REQUEST_TIMEOUT_MS = 4000;
  const REQUIRED_MODULES = Object.freeze(['memberAuth', 'cart', 'inventory', 'orders', 'idempotency', 'webhooks', 'outbox', 'audit', 'reconciliation']);
  const REQUIRED_PROVIDERS = Object.freeze(['ekyc', 'payment', 'carrier', 'email']);
  const REQUIRED_PROVIDER_OPERATIONS = Object.freeze({
    ekyc: Object.freeze(['verify', 'status']),
    payment: Object.freeze(['create', 'status', 'cancel', 'refund', 'webhook']),
    carrier: Object.freeze(['create', 'tracking']),
    email: Object.freeze(['send']),
  });
  const MODULE_LABELS = Object.freeze({
    memberAuth: '会員認証', cart: 'サーバーカート', inventory: '在庫台帳', orders: '注文状態管理',
    idempotency: '重複実行防止', webhooks: 'Webhook受信', outbox: '通知キュー', audit: '監査記録',
    reconciliation: '外部結果照合',
  });
  const PROVIDER_LABELS = Object.freeze({ekyc: 'eKYC', payment: '決済', carrier: '配送', email: 'メール'});
  const ADMIN_AUTH_MODES = Object.freeze(['local_bootstrap', 'trusted_proxy']);
  const READINESS_LABELS = Object.freeze({
    ADMIN_IDENTITY_NOT_CONFIGURED: '管理者SSO・受信プロキシ認証',
  });
  const RULE_LABELS = Object.freeze({
    approvedSalePriceRequired: '承認済み販売価格が必須',
    freeShipping: '送料無料',
    licensedPremiseRequired: '許可営業所が必須',
    ekycAddressMatchRequired: 'eKYC住所一致が必須',
  });
  const ORDER_STATUS_LABELS = Object.freeze({
    DRAFT: '下書き',
    AGE_VERIFICATION_PENDING: '年齢確認中',
    AGE_VERIFIED: '年齢確認済み',
    AGE_VERIFICATION_FAILED: '年齢確認失敗',
    PAYMENT_PENDING: '決済確認中',
    PAYMENT_FAILED: '決済失敗',
    PAID: '決済済み',
    FULFILLMENT_PENDING: '出荷待ち',
    SHIPPED: '出荷済み',
    COMPLETED: '配達完了',
    REFUND_PENDING: '返金確認中',
    REFUNDED: '返金済み',
    CANCELLED: '取消済み',
  });
  const CANCELLABLE_ORDER_STATES = new Set(['DRAFT', 'AGE_VERIFICATION_PENDING', 'AGE_VERIFICATION_FAILED', 'PAYMENT_FAILED']);
  const REFUNDABLE_ORDER_STATES = new Set(['PAID', 'FULFILLMENT_PENDING', 'SHIPPED', 'COMPLETED']);
  const pendingIdempotency = new Map();
  let currentCapabilities = null;
  let currentReadiness = null;
  let currentOrders = [];
  let serviceHealthy = false;
  let adminSession = {authenticated: false, actorId: null, expiresAt: null};
  let adminAuthFeedback = '';
  let adminAuthPending = false;

  const $ = (selector) => document.querySelector(selector);
  const operationForms = () => [...document.querySelectorAll('[data-operation]')];

  class ConsoleRequestError extends Error {
    constructor(message, {status = 0, code = 'REQUEST_FAILED', payload = null, uncertain = false} = {}) {
      super(message);
      this.name = 'ConsoleRequestError';
      this.status = status;
      this.code = code;
      this.payload = payload;
      this.uncertain = uncertain;
    }
  }

  function providerReady(providerId) {
    const provider = currentCapabilities?.providers?.[providerId];
    return provider?.configured === true && provider?.verified === true && provider?.status === 'verified';
  }

  function coreReady(capabilities = currentCapabilities) {
    return capabilities?.status === 'ready_internal' || capabilities?.status === 'active'
      ? REQUIRED_MODULES.every((moduleId) => capabilities.modules?.[moduleId] === 'ready')
      : false;
  }

  function productionActive(capabilities = currentCapabilities) {
    return capabilities?.activated === true && capabilities?.status === 'active' &&
      REQUIRED_PROVIDERS.every((providerId) => {
        const provider = capabilities.providers?.[providerId];
        return provider?.configured === true && provider?.verified === true && provider?.status === 'verified';
      });
  }

  function activationBaseReady() {
    if (currentCapabilities?.activated !== true || !currentReadiness) return false;
    return !currentReadiness.missing.some((item) =>
      item.code === 'ACTIVATION_DISABLED' || item.code === 'LICENSED_PREMISE_NOT_CONFIGURED');
  }

  function validateCapabilities(payload) {
    const adminAuthentication = payload?.integrations?.adminAuthentication;
    if (payload?.service !== 'KISARAGI_COMMERCE' || payload?.schemaVersion !== 3 ||
        !['ready_internal', 'active'].includes(payload.status) || typeof payload.activated !== 'boolean' ||
        !['local', 'production'].includes(payload.environment) ||
        typeof payload.modules !== 'object' || typeof payload.providers !== 'object' ||
        typeof payload.operations !== 'object' || typeof payload.checkout !== 'object' ||
        typeof payload.checkout.available !== 'boolean' || payload.checkout.currency !== 'JPY' ||
        !Array.isArray(payload.checkout.services) ||
        typeof payload.businessRules !== 'object' || !adminAuthentication ||
        !ADMIN_AUTH_MODES.includes(adminAuthentication.mode) || typeof adminAuthentication.configured !== 'boolean' ||
        !Number.isInteger(adminAuthentication.sessionTtlSeconds) || adminAuthentication.sessionTtlSeconds <= 0 ||
        (payload.environment === 'local' && adminAuthentication.mode !== 'local_bootstrap') ||
        (payload.environment === 'production' && adminAuthentication.mode !== 'trusted_proxy')) {
      throw new ConsoleRequestError('機能情報の形式が正しくありません。', {code: 'INVALID_CAPABILITIES'});
    }
    for (const moduleId of REQUIRED_MODULES) {
      if (payload.modules[moduleId] !== 'ready') {
        throw new ConsoleRequestError(`内部モジュールが準備未完了です: ${moduleId}`, {code: 'CORE_NOT_READY'});
      }
    }
    for (const providerId of REQUIRED_PROVIDERS) {
      const provider = payload.providers[providerId];
      if (!provider || typeof provider.configured !== 'boolean' || typeof provider.verified !== 'boolean' ||
          !['verified', 'configured_unverified', 'not_configured'].includes(provider.status)) {
        throw new ConsoleRequestError(`外部事業者情報の形式が正しくありません: ${providerId}`, {code: 'INVALID_PROVIDER'});
      }
      for (const operationId of REQUIRED_PROVIDER_OPERATIONS[providerId]) {
        const operation = payload.operations?.[providerId]?.[operationId];
        if (!operation || operation.implemented !== true || typeof operation.ready !== 'boolean' ||
            !['ready', 'provider_not_ready'].includes(operation.status) ||
            (operation.ready && operation.status !== 'ready') ||
            (!operation.ready && operation.status !== 'provider_not_ready')) {
          throw new ConsoleRequestError(`外部操作情報の形式が正しくありません: ${providerId}.${operationId}`, {code: 'INVALID_PROVIDER_OPERATION'});
        }
      }
    }
    return payload;
  }

  function adminAuthMode(capabilities = currentCapabilities) {
    const mode = capabilities?.integrations?.adminAuthentication?.mode;
    return ADMIN_AUTH_MODES.includes(mode) ? mode : null;
  }

  function adminSessionExchangeOptions(mode, bootstrapToken = '') {
    if (mode === 'local_bootstrap') return {method: 'POST', bootstrapToken, sessionExchange: true};
    if (mode === 'trusted_proxy') return {method: 'POST', sessionExchange: true};
    throw new ConsoleRequestError('管理認証方式を確認できません。', {code: 'ADMIN_AUTH_MODE_UNKNOWN'});
  }

  function adminAuthControlState(
    capabilities = currentCapabilities,
    session = adminSession,
    {apiAvailable = Boolean(API_BASE), healthy = serviceHealthy, pending = adminAuthPending} = {},
  ) {
    const mode = adminAuthMode(capabilities);
    const configured = capabilities?.integrations?.adminAuthentication?.configured === true;
    const authenticated = session?.authenticated === true;
    const showLocal = mode === 'local_bootstrap' && !authenticated;
    const showTrusted = mode === 'trusted_proxy' && !authenticated;
    return {
      mode,
      configured,
      showLocal,
      showTrusted,
      canStartLocal: Boolean(apiAvailable && healthy && showLocal && !pending),
      canStartTrusted: Boolean(apiAvailable && healthy && showTrusted && configured && !pending),
    };
  }

  function validateAdminSession(payload, {required = false} = {}) {
    if (payload?.authenticated !== true) {
      if (required) throw new ConsoleRequestError('管理者の本人確認済みセッションを開始できませんでした。', {code: 'INVALID_ADMIN_SESSION'});
      return {authenticated: false, actorId: null, expiresAt: null};
    }
    if (typeof payload.actorId !== 'string' || !payload.actorId.trim() || !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= Date.now()) {
      throw new ConsoleRequestError('管理セッションAPIの応答が不完全です。', {code: 'INVALID_ADMIN_SESSION'});
    }
    return {authenticated: true, actorId: payload.actorId, expiresAt: payload.expiresAt};
  }

  function validateReadiness(payload) {
    if (typeof payload?.ready !== 'boolean' || typeof payload?.activated !== 'boolean' ||
        !Array.isArray(payload.missing) || typeof payload.providers !== 'object') {
      throw new ConsoleRequestError('有効化判定の形式が正しくありません。', {code: 'INVALID_READINESS'});
    }
    for (const item of payload.missing) {
      if (typeof item?.code !== 'string' || typeof item?.label !== 'string') {
        throw new ConsoleRequestError('不足項目の形式が正しくありません。', {code: 'INVALID_READINESS'});
      }
    }
    return payload;
  }

  function validateInventoryReceipt(payload) {
    const inventory = payload?.inventory;
    if (typeof payload?.ledgerEntryId !== 'string' || typeof inventory?.productId !== 'string' ||
        !Number.isInteger(inventory.onHand) || !Number.isInteger(inventory.reserved) || !Number.isInteger(inventory.available)) {
      throw new ConsoleRequestError('在庫APIの処理結果が不完全です。', {code: 'INVALID_INVENTORY_RECEIPT'});
    }
    return payload;
  }

  function validatePriceReceipt(payload) {
    const price = payload?.price;
    if (typeof price?.id !== 'string' || typeof price?.productId !== 'string' ||
        !Number.isInteger(price?.priceJpy) || price.priceJpy < 0 ||
        typeof price?.sourceType !== 'string' || typeof price?.sourceReference !== 'string' ||
        typeof price?.approvedBy !== 'string' || price?.status !== 'approved') {
      throw new ConsoleRequestError('承認販売価格APIの登録結果が不完全です。', {code: 'INVALID_PRICE_RECEIPT'});
    }
    return payload;
  }

  function validateRefundReceipt(payload) {
    if (typeof payload?.refund?.id !== 'string' || typeof payload?.refund?.externalId !== 'string' ||
        !Number.isInteger(payload?.refund?.amountJpy) || !['pending', 'succeeded'].includes(payload?.refund?.status) ||
        typeof payload?.order?.id !== 'string' || typeof payload?.order?.status !== 'string') {
      throw new ConsoleRequestError('決済事業者の返金受付結果が不完全です。', {code: 'INVALID_REFUND_RECEIPT'});
    }
    return payload;
  }

  function validateShipmentReceipt(payload) {
    const shipment = payload?.shipment;
    if (typeof shipment?.id !== 'string' || typeof shipment?.externalId !== 'string' ||
        typeof shipment?.trackingNumber !== 'string' || !shipment.trackingNumber.trim() ||
        typeof shipment?.trackingUrl !== 'string' || !shipment.trackingUrl.trim() ||
        payload?.order?.status !== 'SHIPPED') {
      throw new ConsoleRequestError('配送事業者の実運送番号を含む受付結果が不完全です。', {code: 'INVALID_SHIPMENT_RECEIPT'});
    }
    return payload;
  }

  function validateOutboxReceipt(payload) {
    if (!['processed', 'delivered', 'failed', 'remaining'].every((field) => Number.isInteger(payload?.[field]) && payload[field] >= 0)) {
      throw new ConsoleRequestError('通知キューの処理結果が不完全です。', {code: 'INVALID_OUTBOX_RECEIPT'});
    }
    return payload;
  }

  function validateAdminOrders(payload) {
    if (!Array.isArray(payload?.orders)) {
      throw new ConsoleRequestError('注文台帳APIの形式が正しくありません。', {code: 'INVALID_ORDER_LEDGER'});
    }
    for (const order of payload.orders) {
      const totals = order?.totals;
      if (typeof order?.id !== 'string' || !order.id || typeof order?.status !== 'string' ||
          typeof order?.paymentReviewRequired !== 'boolean' || typeof order?.currency !== 'string' ||
          !Array.isArray(order?.items) || !Array.isArray(order?.paymentAttempts) ||
          !Number.isInteger(totals?.subtotalJpy) || !Number.isInteger(totals?.shippingJpy) || !Number.isInteger(totals?.totalJpy) ||
          typeof order?.shippingAddress !== 'object' || !Array.isArray(order?.reservations) ||
          (order.shipment !== null && typeof order.shipment !== 'object')) {
        throw new ConsoleRequestError('注文台帳に不完全な注文が含まれています。', {code: 'INVALID_ORDER_LEDGER'});
      }
      for (const item of order.items) {
        if (typeof item?.productId !== 'string' || typeof item?.sku !== 'string' || typeof item?.name !== 'string' ||
            !Number.isInteger(item?.unitPriceJpy) || !Number.isInteger(item?.quantity) || !Number.isInteger(item?.lineTotalJpy)) {
          throw new ConsoleRequestError('注文台帳の商品明細が不完全です。', {code: 'INVALID_ORDER_LEDGER'});
        }
      }
      for (const attempt of order.paymentAttempts) {
        const externalIdValid = attempt?.externalId === null || typeof attempt?.externalId === 'string';
        if (typeof attempt?.id !== 'string' || typeof attempt?.provider !== 'string' || typeof attempt?.status !== 'string' || !Number.isInteger(attempt?.amountJpy) ||
            !externalIdValid) {
          throw new ConsoleRequestError('注文台帳の決済記録が不完全です。', {code: 'INVALID_ORDER_LEDGER'});
        }
      }
      if (order.shipment && (!Array.isArray(order.shipment.events) || typeof order.shipment.status !== 'string')) {
        throw new ConsoleRequestError('注文台帳の配送情報が不完全です。', {code: 'INVALID_ORDER_LEDGER'});
      }
    }
    return payload;
  }

  function validateCancelReceipt(payload) {
    if (typeof payload?.order?.id !== 'string' || payload.order.status !== 'CANCELLED' || payload.order.paymentReviewRequired !== false) {
      throw new ConsoleRequestError('注文取消APIの結果が不完全です。', {code: 'INVALID_CANCEL_RECEIPT'});
    }
    return payload;
  }

  function validateTrackingReceipt(payload) {
    const shipment = payload?.shipment;
    if (!Number.isInteger(payload?.inserted) || payload.inserted < 0 || typeof shipment?.id !== 'string' ||
        typeof shipment?.trackingNumber !== 'string' || !shipment.trackingNumber.trim() ||
        typeof shipment?.status !== 'string' || !Array.isArray(shipment?.events)) {
      throw new ConsoleRequestError('配送追跡APIの結果が不完全です。', {code: 'INVALID_TRACKING_RECEIPT'});
    }
    return payload;
  }

  function validatePaymentReviewReceipt(payload, expectedDecision) {
    if (payload?.decision !== expectedDecision || typeof payload?.order?.id !== 'string') {
      throw new ConsoleRequestError('決済照合APIの結果が不完全です。', {code: 'INVALID_PAYMENT_REVIEW_RECEIPT'});
    }
    if (expectedDecision === 'fulfill') {
      if (payload.order.status !== 'FULFILLMENT_PENDING' || payload.order.paymentReviewRequired !== false) {
        throw new ConsoleRequestError('履約継続後の注文状態を確認できません。', {code: 'INVALID_PAYMENT_REVIEW_RECEIPT'});
      }
      return payload;
    }
    const refund = payload.refund;
    const validPending = refund?.status === 'pending' && payload.order.status === 'REFUND_PENDING' && payload.order.paymentReviewRequired === true;
    const validSucceeded = refund?.status === 'succeeded' && payload.order.status === 'REFUNDED' && payload.order.paymentReviewRequired === false;
    if (typeof refund?.id !== 'string' || typeof refund?.externalId !== 'string' || !refund.externalId.trim() ||
        !Number.isInteger(refund?.amountJpy) || (!validPending && !validSucceeded)) {
      throw new ConsoleRequestError('原路返金後の注文状態を確認できません。', {code: 'INVALID_PAYMENT_REVIEW_RECEIPT'});
    }
    return payload;
  }

  async function request(path, {method = 'GET', body, admin = false, bootstrapToken = '', sessionExchange = false, idempotencyKey} = {}) {
    if (!API_BASE) throw new ConsoleRequestError('公開サイトから運営APIへは接続しません。', {code: 'NOT_CONFIGURED'});
    const headers = new Headers({'Accept': 'application/json'});
    if (body !== undefined || sessionExchange) headers.set('Content-Type', 'application/json');
    if (admin || bootstrapToken || sessionExchange) {
      if (admin && !adminSession.authenticated) throw new ConsoleRequestError('短期管理セッションを開始してください。', {code: 'ADMIN_SESSION_REQUIRED'});
      headers.set('X-Kisaragi-Commerce', '1');
    }
    if (bootstrapToken) headers.set('Authorization', `Bearer ${bootstrapToken}`);
    if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
        credentials: 'include',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      throw new ConsoleRequestError(timeout ? '運営APIの応答がタイムアウトしました。' : '運営APIへ接続できません。', {
        code: timeout ? 'TIMEOUT' : 'OFFLINE', uncertain: true,
      });
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ConsoleRequestError(payload?.message || payload?.error || `運営API HTTP ${response.status}`, {
        status: response.status, code: payload?.error || 'HTTP_ERROR', payload,
      });
    }
    if (!payload || typeof payload !== 'object') {
      throw new ConsoleRequestError('運営APIから有効なJSON応答がありません。', {status: response.status, code: 'INVALID_RESPONSE'});
    }
    return payload;
  }

  function getIdempotencyKey(scope, path, payload) {
    const fingerprint = JSON.stringify({path, payload});
    const pending = pendingIdempotency.get(scope);
    if (pending?.fingerprint === fingerprint) return pending.key;
    if (pending) {
      throw new ConsoleRequestError('前回送信の結果が不明です。重複処理を避けるため、入力を変更せず同じ内容で再送信してください。', {
        code: 'UNCERTAIN_OPERATION_INPUT_CHANGED',
      });
    }
    const key = crypto.randomUUID();
    pendingIdempotency.set(scope, {fingerprint, key});
    return key;
  }

  async function mutate(scope, path, payload, {idempotent = true} = {}) {
    const key = idempotent ? getIdempotencyKey(scope, path, payload) : null;
    try {
      const result = await request(path, {method: 'POST', body: payload, admin: true, idempotencyKey: key});
      if (idempotent) pendingIdempotency.delete(scope);
      return result;
    } catch (error) {
      const definitiveResponse = error.status >= 400 && error.status < 500;
      if (idempotent && definitiveResponse) pendingIdempotency.delete(scope);
      if (error.status >= 500) error.uncertain = true;
      throw error;
    }
  }

  function statePill(element, text, state) {
    element.textContent = text;
    element.dataset.state = state;
  }

  function appendDefinition(list, label, value) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    list.append(row);
  }

  function element(tagName, className = '', text = '') {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    if (text !== '') node.textContent = text;
    return node;
  }

  function formatYen(value) {
    return Number.isInteger(value) ? `¥${value.toLocaleString('ja-JP')}` : '確認不可';
  }

  function formatDateTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '確認不可' : date.toLocaleString('ja-JP');
  }

  function safeHttpsUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : null;
    } catch {
      return null;
    }
  }

  function appendOrderFact(list, label, value) {
    const row = element('div', 'order-fact');
    row.append(element('dt', '', label), element('dd', '', value));
    list.append(row);
  }

  function canCancelOrder(order) {
    return CANCELLABLE_ORDER_STATES.has(order.status) && order.paymentReviewRequired === false;
  }

  function paymentReviewDecisionState(order) {
    if (order.paymentReviewRequired !== true) return {kind: 'not_required', paymentAttempt: null, fulfillAllowed: false};
    if (order.status === 'REFUND_PENDING') return {kind: 'refund_pending', paymentAttempt: null, fulfillAllowed: false};
    if (!['PAYMENT_PENDING', 'PAYMENT_FAILED'].includes(order.status)) {
      return {kind: 'state_blocked', paymentAttempt: null, fulfillAllowed: false};
    }
    const succeeded = order.paymentAttempts.filter((attempt) => attempt?.status === 'succeeded');
    if (succeeded.length > 1) return {kind: 'multiple_settled', paymentAttempt: null, fulfillAllowed: false};
    if (succeeded.length === 0) return {kind: 'no_settled', paymentAttempt: null, fulfillAllowed: false};
    if (typeof succeeded[0].id !== 'string' || !succeeded[0].id.trim() ||
        typeof succeeded[0].externalId !== 'string' || !succeeded[0].externalId.trim()) {
      return {kind: 'no_settled', paymentAttempt: null, fulfillAllowed: false};
    }
    const selectedId = succeeded[0].id;
    const otherAttemptsFinal = order.paymentAttempts
      .filter((attempt) => attempt.id !== selectedId)
      .every((attempt) => ['failed', 'cancelled'].includes(attempt.status));
    return {kind: 'ready', paymentAttempt: succeeded[0], fulfillAllowed: otherAttemptsFinal};
  }

  function canRefreshTracking(order) {
    return providerReady('carrier') && typeof order.shipment?.externalId === 'string' && Boolean(order.shipment.externalId.trim()) &&
      typeof order.shipment?.trackingNumber === 'string' && Boolean(order.shipment.trackingNumber.trim());
  }

  function orderStateTone(order) {
    if (order.paymentReviewRequired || ['AGE_VERIFICATION_FAILED', 'PAYMENT_FAILED'].includes(order.status)) return 'blocked';
    if (['PAYMENT_PENDING', 'REFUND_PENDING', 'AGE_VERIFICATION_PENDING'].includes(order.status)) return 'waiting';
    if (['PAID', 'FULFILLMENT_PENDING', 'SHIPPED'].includes(order.status)) return 'active';
    if (['COMPLETED', 'REFUNDED'].includes(order.status)) return 'ready';
    return 'neutral';
  }

  function appendTrackingLink(container, shipment) {
    const trackingUrl = safeHttpsUrl(shipment.trackingUrl);
    if (!trackingUrl) {
      container.append(element('span', 'tracking-number', shipment.trackingNumber || '運送番号未発行'));
      return;
    }
    const link = element('a', 'tracking-link', shipment.trackingNumber || '配送事業者で確認');
    link.href = trackingUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    container.append(link);
  }

  function renderOrder(order) {
    const card = element('article', 'order-card');
    card.dataset.orderId = order.id;

    const heading = element('header', 'order-card-header');
    const identity = element('div');
    identity.append(element('span', 'order-id-label', '注文ID'), element('strong', 'order-id', order.id));
    const states = element('div', 'order-state-group');
    const status = element('span', 'state-pill', ORDER_STATUS_LABELS[order.status] || order.status);
    status.dataset.state = orderStateTone(order);
    states.append(status);
    if (order.paymentReviewRequired) {
      const review = element('strong', 'review-flag', '要手動決済照合');
      review.title = '決済結果と在庫確保を運営者が照合する必要があります';
      states.append(review);
    }
    heading.append(identity, states);
    card.append(heading);

    const facts = element('dl', 'order-facts');
    appendOrderFact(facts, '合計', `${formatYen(order.totals.totalJpy)} (${order.currency})`);
    appendOrderFact(facts, '内訳', `商品 ${formatYen(order.totals.subtotalJpy)} / 配送 ${formatYen(order.totals.shippingJpy)}`);
    appendOrderFact(facts, '商品', `${order.items.length}明細 / ${order.items.reduce((sum, item) => sum + (Number.isInteger(item.quantity) ? item.quantity : 0), 0)}点`);
    appendOrderFact(facts, '配送先確認', order.shippingAddress.verifiedByEkyc ? 'eKYC住所一致済み' : '未確認');
    appendOrderFact(facts, '配送サービス', order.carrierService || '未指定');
    appendOrderFact(facts, '更新', formatDateTime(order.updatedAt));
    card.append(facts);

    const items = element('div', 'order-subsection');
    items.append(element('h3', '', '注文明細'));
    const itemList = element('ul', 'order-item-list');
    for (const item of order.items) {
      const label = `${item.name || item.sku || item.productId} × ${item.quantity} / ${formatYen(item.lineTotalJpy)}`;
      itemList.append(element('li', '', label));
    }
    if (order.items.length === 0) itemList.append(element('li', '', '明細なし'));
    items.append(itemList);
    card.append(items);

    const payments = element('div', 'order-subsection');
    payments.append(element('h3', '', '決済記録'));
    const paymentList = element('ul', 'payment-attempt-list');
    for (const attempt of order.paymentAttempts) {
      const failure = attempt.failureCode ? ` / 理由 ${attempt.failureCode}` : '';
      paymentList.append(element('li', '', `${attempt.provider || 'payment'}: ${attempt.status} / ${formatYen(attempt.amountJpy)}${failure}`));
    }
    if (order.paymentAttempts.length === 0) paymentList.append(element('li', '', '決済試行なし'));
    payments.append(paymentList);
    card.append(payments);

    if (order.paymentReviewRequired) {
      const reviewState = paymentReviewDecisionState(order);
      const alert = element('div', 'payment-review-alert');
      alert.setAttribute('role', 'alert');
      alert.append(element('strong', '', '決済結果の手動照合が必要です'));
      if (reviewState.kind === 'multiple_settled') {
        alert.append(element('p', '', '成功済み決済が複数あります。自動判断は禁止です。決済事業者の管理画面と監査記録を照合し、責任者へエスカレーションしてください。'));
      } else if (reviewState.kind === 'refund_pending') {
        alert.append(element('p', '', '原路返金の事業者確定を待っています。新しい照合決定は送信せず、Webhookによる確定または失敗を待ってください。'));
      } else if (reviewState.kind === 'state_blocked') {
        alert.append(element('p', '', `注文状態 ${order.status} では照合決定を実行できません。注文状態と監査記録を確認してください。`));
      } else if (reviewState.kind === 'no_settled') {
        alert.append(element('p', '', '実在する成功済み決済を一意に特定できません。注文状態を変更せず、決済事業者の記録を確認してください。'));
      } else {
        alert.append(element('p', '', `対象決済: ${reviewState.paymentAttempt.id} / ${formatYen(reviewState.paymentAttempt.amountJpy)}`));
        if (!reviewState.fulfillAllowed) {
          alert.append(element('p', 'review-block-note', 'ほかの決済試行が未確定です。履約継続は失敗または取消の確定後まで無効です。'));
        }
        const reasonLabel = element('label', 'review-reason-label', '原路返金理由');
        const reason = element('textarea', 'review-reason');
        reason.dataset.reviewReasonFor = order.id;
        reason.maxLength = 300;
        reason.rows = 2;
        reason.placeholder = '決済事業者・監査記録と照合した具体的な理由を入力';
        reasonLabel.append(reason);
        alert.append(reasonLabel);

        const decisions = element('div', 'review-actions');
        const fulfill = element('button', 'button-secondary', '成功決済で履約を継続');
        fulfill.type = 'button';
        fulfill.dataset.orderAction = 'resolve-review-fulfill';
        fulfill.dataset.orderId = order.id;
        fulfill.dataset.paymentAttemptId = reviewState.paymentAttempt.id;
        fulfill.disabled = !reviewState.fulfillAllowed;
        if (!reviewState.fulfillAllowed) fulfill.title = 'ほかの決済試行が未確定です';
        const refund = element('button', 'button-danger', '成功決済を原路返金');
        refund.type = 'button';
        refund.dataset.orderAction = 'resolve-review-refund';
        refund.dataset.orderId = order.id;
        refund.dataset.paymentAttemptId = reviewState.paymentAttempt.id;
        refund.disabled = !providerReady('payment');
        if (!providerReady('payment')) refund.title = '決済事業者の本番接続・検証が必要です';
        decisions.append(fulfill, refund);
        alert.append(decisions);
      }
      card.append(alert);
    }

    const shipping = element('div', 'order-subsection shipment-summary');
    shipping.append(element('h3', '', '配送・追跡'));
    if (!order.shipment) {
      shipping.append(element('p', 'muted-copy', '配送依頼は未登録です。'));
    } else {
      const summary = element('p', 'shipment-primary');
      summary.append(element('span', '', `状態: ${order.shipment.status} / 運送番号: `));
      appendTrackingLink(summary, order.shipment);
      shipping.append(summary);
      const events = element('ol', 'tracking-events');
      for (const event of order.shipment.events) {
        const detail = [formatDateTime(event.occurredAt), event.status, event.location, event.detail].filter(Boolean).join(' / ');
        events.append(element('li', '', detail));
      }
      if (order.shipment.events.length === 0) events.append(element('li', '', '追跡イベントはまだ取得されていません。'));
      shipping.append(events);
    }
    card.append(shipping);

    const actions = element('div', 'order-actions');
    if (canCancelOrder(order)) {
      const cancel = element('button', 'button-danger', 'この注文を取り消す');
      cancel.type = 'button';
      cancel.dataset.orderAction = 'cancel';
      cancel.dataset.orderId = order.id;
      actions.append(cancel);
    }
    if (order.status === 'FULFILLMENT_PENDING' && !order.paymentReviewRequired) {
      const ship = element('button', 'button-secondary', '出荷フォームに設定');
      ship.type = 'button';
      ship.dataset.orderAction = 'prepare-shipment';
      ship.dataset.orderId = order.id;
      actions.append(ship);
    }
    if (REFUNDABLE_ORDER_STATES.has(order.status) && !order.paymentReviewRequired) {
      const refund = element('button', 'button-secondary', '返金フォームに設定');
      refund.type = 'button';
      refund.dataset.orderAction = 'prepare-refund';
      refund.dataset.orderId = order.id;
      actions.append(refund);
    }
    if (canRefreshTracking(order)) {
      const tracking = element('button', 'button-secondary', '配送事業者から追跡を更新');
      tracking.type = 'button';
      tracking.dataset.orderAction = 'refresh-tracking';
      tracking.dataset.orderId = order.id;
      actions.append(tracking);
    }
    if (!actions.childElementCount) actions.append(element('span', 'muted-copy', '現在この注文に実行可能な操作はありません。'));
    card.append(actions);
    return card;
  }

  function clearOrders(message = '管理セッションを開始すると注文台帳を表示します。') {
    currentOrders = [];
    $('#ordersSummary').textContent = '短期管理セッションの開始後に、保護APIから最新100件を取得します。';
    $('#ordersStatus').textContent = '管理セッション待ち';
    $('#ordersStatus').classList.remove('error');
    $('#ordersList').replaceChildren(element('div', 'orders-empty', message));
  }

  function renderOrders() {
    const list = $('#ordersList');
    list.replaceChildren();
    const reviewCount = currentOrders.filter((order) => order.paymentReviewRequired).length;
    const inTransitCount = currentOrders.filter((order) => order.status === 'SHIPPED').length;
    $('#ordersSummary').textContent = `${currentOrders.length}件 / 要決済照合 ${reviewCount}件 / 配送中 ${inTransitCount}件`;
    $('#ordersStatus').classList.remove('error');
    $('#ordersStatus').textContent = `保護APIから${currentOrders.length}件を取得しました。`;
    if (currentOrders.length === 0) {
      list.append(element('div', 'orders-empty', '保存済み注文はありません。'));
      return;
    }
    for (const order of currentOrders) list.append(renderOrder(order));
  }

  async function refreshOrders() {
    if (!API_BASE || !adminSession.authenticated) {
      clearOrders();
      return;
    }
    $('#refreshOrders').disabled = true;
    $('#ordersStatus').classList.remove('error');
    $('#ordersStatus').textContent = '保護APIから注文台帳を取得しています。';
    try {
      const payload = await request('/admin/orders', {admin: true}).then(validateAdminOrders);
      currentOrders = payload.orders;
      renderOrders();
    } catch (error) {
      if (error.status === 401) adminSession = {authenticated: false, actorId: null, expiresAt: null};
      currentOrders = [];
      $('#ordersSummary').textContent = '注文台帳を取得できませんでした。';
      $('#ordersStatus').classList.add('error');
      $('#ordersStatus').textContent = error.message;
      $('#ordersList').replaceChildren(element('div', 'orders-empty', '注文情報は表示されていません。'));
    } finally {
      syncOperationControls();
    }
  }

  function renderStatus() {
    const capabilities = currentCapabilities;
    const readiness = currentReadiness;
    const modulesReady = coreReady(capabilities);
    const readyProviderCount = REQUIRED_PROVIDERS.filter(providerReady).length;
    const active = productionActive(capabilities) && readiness?.activated === true;

    statePill($('#coreState'), modulesReady ? 'CORE_READY' : '未準備', modulesReady ? 'ready' : 'blocked');
    $('#coreSummary').textContent = modulesReady ? `${REQUIRED_MODULES.length}モジュールが内部APIで稼働` : '内部モジュールを確認できません';
    statePill($('#providerState'), readyProviderCount === REQUIRED_PROVIDERS.length ? '接続済み' : `${readyProviderCount}/${REQUIRED_PROVIDERS.length} 接続`, readyProviderCount === REQUIRED_PROVIDERS.length ? 'ready' : 'waiting');
    $('#providerSummary').textContent = readyProviderCount === REQUIRED_PROVIDERS.length ? '必要な外部事業者をすべて確認' : '未契約・未設定の事業者機能は実行不可';
    statePill($('#activationState'), active ? 'ACTIVE' : '未有効化', active ? 'active' : 'waiting');
    $('#activationSummary').textContent = active ? '本番有効化条件をAPIが確認済み' : '契約・認証情報・本番検証の完了待ち';

    const moduleList = $('#moduleList');
    moduleList.replaceChildren();
    for (const moduleId of REQUIRED_MODULES) appendDefinition(moduleList, MODULE_LABELS[moduleId], capabilities.modules[moduleId]);

    const providerList = $('#providerList');
    providerList.replaceChildren();
    for (const providerId of REQUIRED_PROVIDERS) {
      const provider = capabilities.providers[providerId];
      appendDefinition(providerList, PROVIDER_LABELS[providerId], provider.configured ? provider.status : 'not_configured');
    }

    const missingList = $('#missingList');
    missingList.replaceChildren();
    missingList.dataset.empty = String(readiness.missing.length === 0);
    if (readiness.missing.length === 0) {
      const item = document.createElement('li');
      item.textContent = 'APIが不足項目なしと判定';
      missingList.append(item);
    } else {
      for (const missing of readiness.missing) {
        const item = document.createElement('li');
        item.textContent = `${READINESS_LABELS[missing.code] || missing.label} (${missing.code})`;
        missingList.append(item);
      }
    }

    const ruleList = $('#businessRuleList');
    ruleList.replaceChildren();
    for (const [ruleId, label] of Object.entries(RULE_LABELS)) {
      appendDefinition(ruleList, label, capabilities.businessRules[ruleId] === true ? '必須 / 有効' : '無効');
    }
  }

  function setConnection(state, title, message) {
    $('#connectionPanel').dataset.state = state;
    $('#connectionTitle').textContent = title;
    $('#connectionMessage').textContent = message;
  }

  function operationGate(operationId) {
    if (!serviceHealthy || !coreReady()) return {enabled: false, message: '内部コアAPIの確認待ち'};
    if (!adminSession.authenticated) return {enabled: false, message: '短期管理セッションの開始待ち'};
    if (operationId === 'inventory') return {enabled: true, message: '内部在庫台帳へ記録可能'};
    if (operationId === 'priceApproval') return {enabled: true, message: '根拠資料を伴う承認価格を登録可能'};
    const providerByOperation = {refund: 'payment', shipment: 'carrier', outbox: 'email'};
    const providerId = providerByOperation[operationId];
    if (!providerReady(providerId)) return {enabled: false, message: `${PROVIDER_LABELS[providerId]}の契約・設定待ち`};
    const windDown = currentCapabilities?.activated !== true;
    return {
      enabled: true,
      message: windDown
        ? `${PROVIDER_LABELS[providerId]}APIで既存注文の善後処理が可能`
        : `${PROVIDER_LABELS[providerId]}APIへ実処理可能`,
    };
  }

  function syncOperationControls() {
    for (const form of operationForms()) {
      const operationId = form.dataset.operation;
      const gate = operationGate(operationId);
      const button = form.querySelector('button[type="submit"]');
      const message = document.querySelector(`[data-gate-for="${operationId}"]`);
      button.disabled = !gate.enabled;
      message.textContent = gate.message;
      message.dataset.state = gate.enabled ? 'ready' : 'blocked';
    }
    const authentication = currentCapabilities?.integrations?.adminAuthentication;
    const controls = adminAuthControlState();
    const mode = controls.mode;
    const localBootstrap = mode === 'local_bootstrap';
    const trustedProxy = mode === 'trusted_proxy';
    $('#tokenForm').hidden = !controls.showLocal;
    $('#identityForm').hidden = !controls.showTrusted;
    $('#clearToken').hidden = !adminSession.authenticated;
    $('#adminToken').disabled = !controls.canStartLocal;
    $('#saveToken').disabled = !controls.canStartLocal;
    $('#startIdentitySession').disabled = !controls.canStartTrusted;
    $('#clearToken').disabled = !API_BASE || !adminSession.authenticated;
    $('#refreshOrders').disabled = !API_BASE || !adminSession.authenticated;
    if (!localBootstrap) $('#adminToken').value = '';

    $('#credentialTitle').textContent = trustedProxy ? 'SSO管理者セッション' : localBootstrap ? '短期管理セッション' : '管理認証を確認中';
    $('#credentialModeDescription').textContent = trustedProxy
      ? authentication?.configured === true
        ? '受信プロキシが確認した管理者IDで、15分の本人確認済みセッションを開始します。共有トークンは使用しません。'
        : '管理者SSO・受信プロキシ認証が未設定のため、管理セッションを開始できません。'
      : localBootstrap
        ? 'ローカル保守環境だけで、管理トークンを15分の短期セッションへ交換します。'
        : 'APIの管理認証方式を確認できるまで、認証情報を入力できません。';
    $('#credentialSecurityNote').textContent = trustedProxy
      ? 'ブラウザーは共有トークンを送信しません。Access Proxy が上流IdP・MFAで確認した一回限りの署名済み管理者アサーションを注入し、サーバーは HttpOnly Cookie を15分だけ発行します。'
      : localBootstrap
        ? '管理トークンは短期セッションとの交換時に一度だけ送信し、ブラウザー保存領域へ書き込みません。以後の操作はサーバーが発行する HttpOnly Cookie で認証し、15分で失効します。'
        : '管理認証方式を検証できない状態では、共有トークン、SSO、管理操作のいずれも開始しません。';
    $('#tokenState').textContent = adminSession.authenticated
      ? `本人確認済み管理セッション：${adminSession.actorId} / ${new Date(adminSession.expiresAt).toLocaleTimeString('ja-JP')}まで`
      : adminAuthFeedback || (trustedProxy ? 'SSO本人確認セッションは開始されていません。' : localBootstrap ? '管理セッションは開始されていません。' : '管理認証方式を確認しています。');
  }

  function resetStatusForFailure(message, state = 'offline') {
    serviceHealthy = false;
    currentCapabilities = null;
    currentReadiness = null;
    currentOrders = [];
    adminAuthFeedback = message;
    adminAuthPending = false;
    setConnection(state, state === 'not-connected' ? '公開サイトでは運営API未接続です' : '内部コマース基盤に接続できません', message);
    statePill($('#coreState'), '確認不可', 'offline');
    statePill($('#providerState'), '確認不可', 'offline');
    statePill($('#activationState'), '有効化不可', 'offline');
    $('#coreSummary').textContent = 'API応答なし';
    $('#providerSummary').textContent = 'API応答なし';
    $('#activationSummary').textContent = 'API応答なし';
    for (const selector of ['#moduleList', '#providerList', '#businessRuleList']) {
      const list = $(selector);
      list.replaceChildren();
      appendDefinition(list, '状態', '確認不可');
    }
    const missingList = $('#missingList');
    missingList.replaceChildren();
    missingList.dataset.empty = 'false';
    const missing = document.createElement('li');
    missing.textContent = 'API応答がないため判定できません';
    missingList.append(missing);
    $('#ordersSummary').textContent = 'API再接続後に注文台帳を再取得します。';
    $('#ordersStatus').classList.add('error');
    $('#ordersStatus').textContent = '注文台帳は最新状態を確認できないため非表示です。';
    $('#ordersList').replaceChildren(element('div', 'orders-empty', '運営APIへ再接続するまで注文情報は表示しません。'));
    syncOperationControls();
  }

  async function refresh() {
    if (!API_BASE) {
      resetStatusForFailure('運営操作は保護されたローカル環境だけで利用できます。公開ページから外部処理を起動しません。', 'not-connected');
      return;
    }
    setConnection('checking', '内部コマース基盤を確認しています', '機能情報と有効化条件をサーバーから取得しています。');
    serviceHealthy = false;
    syncOperationControls();
    try {
      const [capabilities, readiness] = await Promise.all([
        request('/capabilities').then(validateCapabilities),
        request('/activation/readiness').then(validateReadiness),
      ]);
      currentCapabilities = capabilities;
      currentReadiness = readiness;
      serviceHealthy = true;
      if (!adminSession.authenticated) adminAuthFeedback = '';
      renderStatus();
      const active = productionActive(capabilities) && readiness.activated;
      setConnection(
        active ? 'ready' : 'inactive',
        active ? 'コマース基盤は本番有効です' : '内部コア稼働中・外部接続は未有効です',
        active ? '必要な外部事業者と本番有効化条件をAPIが確認しました。' : '内部処理は稼働しています。未接続の外部処理はサーバー側で拒否されます。',
      );
      syncOperationControls();
      if (adminSession.authenticated) await refreshOrders();
    } catch (error) {
      resetStatusForFailure(error.message);
    }
  }

  function showOperationResult(label, payload) {
    $('#operationStatus').classList.remove('error');
    $('#operationStatus').textContent = `${label}: APIが処理結果を返しました。`;
    $('#operationResponse').textContent = JSON.stringify(payload, null, 2);
  }

  function showOperationError(error) {
    $('#operationStatus').classList.add('error');
    $('#operationStatus').textContent = error.uncertain
      ? `${error.message} 同じ入力で再実行した場合は同じ冪等キーを使用します。`
      : error.message;
    $('#operationResponse').textContent = JSON.stringify({
      accepted: false,
      httpStatus: error.status || null,
      code: error.code,
      serverResponse: error.payload,
    }, null, 2);
  }

  async function runOperation(form, label, action) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    $('#operationStatus').classList.remove('error');
    $('#operationStatus').textContent = `${label}: サーバー応答待ち`;
    try {
      const payload = await action();
      showOperationResult(label, payload);
      await refresh();
    } catch (error) {
      if (error.status === 401) {
        adminSession = {authenticated: false, actorId: null, expiresAt: null};
        clearOrders('管理セッションが失効したため注文情報を消去しました。');
      }
      showOperationError(error);
    } finally {
      syncOperationControls();
    }
  }

  async function runOrderAction(button, label, action) {
    button.disabled = true;
    $('#ordersStatus').classList.remove('error');
    $('#ordersStatus').textContent = `${label}: サーバー応答待ち`;
    try {
      const payload = await action();
      showOperationResult(label, payload);
      await refreshOrders();
    } catch (error) {
      if (error.status === 401) {
        adminSession = {authenticated: false, actorId: null, expiresAt: null};
        clearOrders('管理セッションが失効したため注文情報を消去しました。');
      }
      $('#ordersStatus').classList.add('error');
      $('#ordersStatus').textContent = error.uncertain
        ? `${error.message} 最新状態を確認し、同じ入力で再実行してください。`
        : error.message;
      showOperationError(error);
    } finally {
      button.disabled = false;
      syncOperationControls();
    }
  }

  $('#refreshStatus').addEventListener('click', refresh);
  $('#refreshOrders').addEventListener('click', refreshOrders);
  $('#tokenForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!API_BASE || !serviceHealthy || adminAuthMode() !== 'local_bootstrap') return;
    const input = $('#adminToken');
    const token = input.value.trim();
    if (token.length < 32) {
      adminAuthFeedback = '管理トークンは32文字以上で入力してください。';
      syncOperationControls();
      return;
    }
    input.value = '';
    adminAuthPending = true;
    adminAuthFeedback = '管理トークンを短期セッションへ交換しています。';
    syncOperationControls();
    try {
      adminSession = validateAdminSession(await request('/admin/session', adminSessionExchangeOptions('local_bootstrap', token)), {required: true});
      adminAuthFeedback = '';
      await refreshOrders();
    } catch (error) {
      adminSession = {authenticated: false, actorId: null, expiresAt: null};
      adminAuthFeedback = error.message;
      clearOrders('管理者本人確認に失敗したため、注文情報は表示しません。');
    } finally {
      adminAuthPending = false;
      syncOperationControls();
    }
  });
  $('#identityForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const authentication = currentCapabilities?.integrations?.adminAuthentication;
    if (!API_BASE || !serviceHealthy || adminAuthMode() !== 'trusted_proxy') return;
    if (authentication?.configured !== true) {
      adminAuthFeedback = '管理者SSO・受信プロキシ認証が未設定です。';
      syncOperationControls();
      return;
    }
    adminAuthFeedback = 'SSOで管理者本人確認を行っています。';
    adminAuthPending = true;
    syncOperationControls();
    try {
      adminSession = validateAdminSession(await request('/admin/session', adminSessionExchangeOptions('trusted_proxy')), {required: true});
      adminAuthFeedback = '';
      await refreshOrders();
    } catch (error) {
      adminSession = {authenticated: false, actorId: null, expiresAt: null};
      adminAuthFeedback = error.code === 'ADMIN_IDENTITY_NOT_CONFIGURED'
        ? '管理者SSO・受信プロキシ認証が未設定です。'
        : 'SSOで管理者本人確認を完了できませんでした。Access Proxy と上流IdPの状態を確認してください。';
      clearOrders('管理者本人確認に失敗したため、注文情報は表示しません。');
    } finally {
      adminAuthPending = false;
      syncOperationControls();
    }
  });
  $('#clearToken').addEventListener('click', async () => {
    $('#clearToken').disabled = true;
    try {
      if (adminSession.authenticated) await request('/admin/session', {method: 'DELETE', admin: true});
    } catch { /* The local session is cleared even if the server is unavailable. */ }
    adminSession = {authenticated: false, actorId: null, expiresAt: null};
    adminAuthFeedback = '';
    adminAuthPending = false;
    $('#adminToken').value = '';
    pendingIdempotency.clear();
    clearOrders();
    syncOperationControls();
  });

  $('#ordersList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-order-action]');
    if (!button || button.disabled) return;
    const orderId = button.dataset.orderId;
    const order = currentOrders.find((item) => item.id === orderId);
    if (!order) return showOperationError(new ConsoleRequestError('注文台帳を再取得してください。', {code: 'ORDER_LEDGER_STALE'}));

    if (button.dataset.orderAction === 'resolve-review-fulfill' || button.dataset.orderAction === 'resolve-review-refund') {
      const reviewState = paymentReviewDecisionState(order);
      if (reviewState.kind !== 'ready' || reviewState.paymentAttempt.id !== button.dataset.paymentAttemptId) {
        return showOperationError(new ConsoleRequestError('成功済み決済を一意に確認できません。台帳を再取得し、責任者へエスカレーションしてください。', {code: 'PAYMENT_REVIEW_NOT_AUTOMATABLE'}));
      }
      if (button.dataset.orderAction === 'resolve-review-fulfill') {
        if (!reviewState.fulfillAllowed) return;
        const confirmed = typeof globalThis.confirm === 'function' && globalThis.confirm(
          `注文 ${orderId} の成功済み決済 ${reviewState.paymentAttempt.id} を採用し、在庫を確定して履約を続行します。続行しますか？`,
        );
        if (!confirmed) return;
        const payload = {decision: 'fulfill', paymentAttemptId: reviewState.paymentAttempt.id};
        runOrderAction(button, '決済照合・履約継続', () =>
          mutate(`payment-review:${orderId}`, `/admin/orders/${encodeURIComponent(orderId)}/payment-review/resolve`, payload)
            .then((receipt) => validatePaymentReviewReceipt(receipt, 'fulfill')));
        return;
      }

      const reasonField = button.closest('.order-card')?.querySelector('[data-review-reason-for]');
      const reason = reasonField?.value.trim() || '';
      if (!reason || reason.length > 300) {
        return showOperationError(new ConsoleRequestError('原路返金の具体的な理由を300文字以内で入力してください。', {code: 'REFUND_REASON_REQUIRED'}));
      }
      const confirmed = typeof globalThis.confirm === 'function' && globalThis.confirm(
        `注文 ${orderId} の成功済み決済 ${reviewState.paymentAttempt.id} を ${formatYen(order.totals.totalJpy)} 原路返金します。この操作を実行しますか？`,
      );
      if (!confirmed) return;
      const payload = {decision: 'refund', paymentAttemptId: reviewState.paymentAttempt.id, reason};
      runOrderAction(button, '決済照合・原路返金', () =>
        mutate(`payment-review:${orderId}`, `/admin/orders/${encodeURIComponent(orderId)}/payment-review/resolve`, payload)
          .then((receipt) => validatePaymentReviewReceipt(receipt, 'refund')));
      return;
    }

    if (button.dataset.orderAction === 'cancel') {
      const confirmed = typeof globalThis.confirm === 'function' && globalThis.confirm(`注文 ${orderId} を取り消します。元に戻せません。続行しますか？`);
      if (!confirmed) return;
      runOrderAction(button, '注文取消', () =>
        mutate(`cancel:${orderId}`, `/admin/orders/${encodeURIComponent(orderId)}/cancel`, {}).then(validateCancelReceipt));
      return;
    }

    if (button.dataset.orderAction === 'refresh-tracking') {
      runOrderAction(button, '配送追跡更新', () =>
        mutate(`tracking:${orderId}`, `/admin/orders/${encodeURIComponent(orderId)}/tracking/refresh`, {}, {idempotent: false}).then(validateTrackingReceipt));
      return;
    }

    if (button.dataset.orderAction === 'prepare-shipment') {
      $('#shipmentOrderId').value = order.id;
      $('#shipmentServiceCode').value = order.carrierService || '';
      $('#shipmentForm').scrollIntoView({behavior: 'smooth', block: 'start'});
      $('#operationStatus').textContent = `注文 ${order.id} を出荷フォームに設定しました。送信前に配送条件を確認してください。`;
      return;
    }

    if (button.dataset.orderAction === 'prepare-refund') {
      $('#refundOrderId').value = order.id;
      $('#refundAmount').value = String(order.totals.totalJpy);
      $('#refundForm').scrollIntoView({behavior: 'smooth', block: 'start'});
      $('#operationStatus').textContent = `注文 ${order.id} を全額返金フォームに設定しました。理由を入力して確認してください。`;
    }
  });

  $('#inventoryForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const delta = Number($('#inventoryDelta').value);
    if (!Number.isInteger(delta) || delta === 0) return showOperationError(new ConsoleRequestError('増減数は0以外の整数で入力してください。', {code: 'INVALID_INPUT'}));
    const payload = {
      productId: $('#inventoryProductId').value.trim(),
      delta,
      reason: $('#inventoryReason').value.trim(),
    };
    runOperation(event.currentTarget, '在庫調整', () => mutate('inventory', '/admin/inventory/adjust', payload).then(validateInventoryReceipt));
  });

  $('#priceApprovalForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const priceJpy = Number($('#approvedPriceJpy').value);
    if (!Number.isInteger(priceJpy) || priceJpy < 0) return showOperationError(new ConsoleRequestError('承認販売価格は0円以上の整数で入力してください。', {code: 'INVALID_INPUT'}));
    const payload = {
      productId: $('#priceProductId').value.trim(),
      priceJpy,
      sourceType: $('#priceSourceType').value.trim(),
      sourceReference: $('#priceSourceReference').value.trim(),
    };
    runOperation(event.currentTarget, '承認販売価格登録', () =>
      mutate('priceApproval', '/admin/prices/approve', payload).then(validatePriceReceipt));
  });

  $('#refundForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const orderId = $('#refundOrderId').value.trim();
    const amountJpy = Number($('#refundAmount').value);
    if (!Number.isInteger(amountJpy) || amountJpy <= 0) return showOperationError(new ConsoleRequestError('返金額は1円以上の整数で入力してください。', {code: 'INVALID_INPUT'}));
    const payload = {amountJpy, reason: $('#refundReason').value.trim()};
    runOperation(event.currentTarget, '返金申請', () => mutate('refund', `/admin/orders/${encodeURIComponent(orderId)}/refund`, payload).then(validateRefundReceipt));
  });

  $('#shipmentForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const orderId = $('#shipmentOrderId').value.trim();
    const payload = {serviceCode: $('#shipmentServiceCode').value.trim()};
    const deliveryDate = $('#shipmentDeliveryDate').value;
    const timeSlot = $('#shipmentTimeSlot').value.trim();
    if (deliveryDate) payload.deliveryDate = deliveryDate;
    if (timeSlot) payload.timeSlot = timeSlot;
    runOperation(event.currentTarget, '出荷登録', () => mutate('shipment', `/admin/orders/${encodeURIComponent(orderId)}/ship`, payload).then(validateShipmentReceipt));
  });

  $('#outboxForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const rawLimit = $('#outboxLimit').value.trim();
    const payload = {};
    if (rawLimit) {
      const limit = Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) return showOperationError(new ConsoleRequestError('処理件数は1〜50の整数で入力してください。', {code: 'INVALID_INPUT'}));
      payload.limit = limit;
    }
    runOperation(event.currentTarget, '通知キュー処理', () => mutate('outbox', '/admin/outbox/process', payload, {idempotent: false}).then(validateOutboxReceipt));
  });

  if (globalThis.__KISARAGI_COMMERCE_CONSOLE_TEST__ === true) {
    globalThis.__KISARAGI_COMMERCE_CONSOLE_HOOKS__ = Object.freeze({
      coreReady, productionActive, activationBaseReady, validateCapabilities, validateReadiness,
      adminAuthMode, adminSessionExchangeOptions, adminAuthControlState, validateAdminSession,
      validateInventoryReceipt, validatePriceReceipt, validateRefundReceipt, validateShipmentReceipt,
      validateOutboxReceipt, validateAdminOrders, validateCancelReceipt, validateTrackingReceipt,
      validatePaymentReviewReceipt, paymentReviewDecisionState, canCancelOrder, operationGate,
    });
  }

  async function initialize() {
    if (API_BASE) {
      try {
        adminSession = validateAdminSession(await request('/admin/session'));
      } catch { /* An absent or expired session stays unauthenticated. */ }
    }
    syncOperationControls();
    await refresh();
  }

  initialize();
})();
