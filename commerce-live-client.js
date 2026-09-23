(() => {
  'use strict';

  const config = globalThis.KISARAGI_COMMERCE_CONFIG || {};
  const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  const requiredProviders = Object.freeze(['ekyc', 'payment', 'carrier', 'email']);
  const requiredOperations = Object.freeze({
    ekyc:Object.freeze(['verify', 'status']),
    payment:Object.freeze(['create', 'status', 'cancel', 'refund', 'webhook']),
    carrier:Object.freeze(['create', 'tracking']),
    email:Object.freeze(['send']),
  });
  const pendingIdempotency = new Map();

  class CommerceRequestError extends Error {
    constructor(message, {status = 0, code = 'COMMERCE_REQUEST_FAILED', payload = null} = {}) {
      super(message);
      this.name = 'CommerceRequestError';
      this.status = status;
      this.code = code;
      this.payload = payload;
    }
  }

  async function request(path, options = {}) {
    if (!config.apiBase) {
      throw new CommerceRequestError('Protected commerce API is not configured.', {code:'NOT_CONFIGURED'});
    }

    const method = String(options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});
    if (mutatingMethods.has(method)) {
      headers.set('Content-Type', 'application/json');
      headers.set('X-Kisaragi-Commerce', '1');
    }

    const timeout = AbortSignal.timeout(Number(config.requestTimeoutMs) || 3500);
    let response;
    try {
      response = await fetch(`${config.apiBase}${path}`, {
        ...options,
        method,
        headers,
        cache:'no-store',
        credentials:'include',
        signal:timeout,
      });
    } catch (error) {
      throw new CommerceRequestError('Protected commerce API is unavailable.', {
        code:error?.name === 'TimeoutError' ? 'TIMEOUT' : 'OFFLINE',
      });
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new CommerceRequestError(payload?.message || payload?.error || `Commerce API HTTP ${response.status}`, {
        status:response.status,
        code:payload?.error || 'HTTP_ERROR',
        payload,
      });
    }
    return payload;
  }

  function validateCapabilities(payload) {
    if (payload?.service !== 'KISARAGI_COMMERCE' || payload?.schemaVersion !== 3) {
      throw new CommerceRequestError('Unexpected commerce capability document.', {code:'INVALID_CAPABILITIES'});
    }
    if (!['ready_internal', 'active'].includes(payload.status) || typeof payload.activated !== 'boolean' ||
      typeof payload.modules !== 'object' || typeof payload.providers !== 'object' ||
      typeof payload.operations !== 'object' || typeof payload.checkout !== 'object' ||
      typeof payload.checkout.available !== 'boolean' || payload.checkout.currency !== 'JPY' ||
      !Array.isArray(payload.checkout.services)) {
      throw new CommerceRequestError('Incomplete commerce capability document.', {code:'INVALID_CAPABILITIES'});
    }
    for (const providerId of requiredProviders) {
      const provider = payload.providers[providerId];
      if (!provider || typeof provider.configured !== 'boolean' || typeof provider.verified !== 'boolean' ||
        !['verified', 'configured_unverified', 'not_configured'].includes(provider.status)) {
        throw new CommerceRequestError('Invalid provider capability document.', {code:'INVALID_CAPABILITIES'});
      }
      for (const operationId of requiredOperations[providerId]) {
        const operation = payload.operations?.[providerId]?.[operationId];
        if (!operation || operation.implemented !== true || typeof operation.ready !== 'boolean' ||
          !['ready', 'provider_not_ready'].includes(operation.status) ||
          (operation.ready && operation.status !== 'ready') || (!operation.ready && operation.status !== 'provider_not_ready')) {
          throw new CommerceRequestError('Invalid provider operation document.', {code:'INVALID_CAPABILITIES'});
        }
      }
    }
    return payload;
  }

  function providerReady(capabilities, providerId) {
    const provider = capabilities?.providers?.[providerId];
    return provider?.configured === true && provider?.verified === true && provider?.status === 'verified';
  }

  function isActivated(capabilities) {
    return capabilities?.activated === true &&
      capabilities?.status === 'active' &&
      requiredProviders.every((providerId) => providerReady(capabilities, providerId));
  }

  function createIdempotencyKey(scope) {
    if (typeof globalThis.crypto?.randomUUID !== 'function') {
      throw new CommerceRequestError('Secure idempotency key generation is unavailable.', {code:'CRYPTO_UNAVAILABLE'});
    }
    return `${scope}:${globalThis.crypto.randomUUID()}`;
  }

  async function requestFingerprint(body) {
    if (typeof globalThis.crypto?.subtle?.digest !== 'function' || typeof TextEncoder !== 'function') {
      throw new CommerceRequestError('Secure request fingerprinting is unavailable.', {code:'CRYPTO_UNAVAILABLE'});
    }
    const bytes = new TextEncoder().encode(JSON.stringify(body));
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
    return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function storageKey(scope) {
    return `kisaragi_commerce_idempotency:${scope}`;
  }

  function readPending(scope) {
    if (pendingIdempotency.has(scope)) return pendingIdempotency.get(scope);
    try {
      const parsed = JSON.parse(globalThis.sessionStorage?.getItem(storageKey(scope)) || 'null');
      if (parsed && typeof parsed.fingerprint === 'string' && typeof parsed.key === 'string') {
        pendingIdempotency.set(scope, parsed);
        return parsed;
      }
    } catch { /* Session storage is optional; the in-memory key still protects this page. */ }
    return null;
  }

  function writePending(scope, value) {
    pendingIdempotency.set(scope, value);
    try { globalThis.sessionStorage?.setItem(storageKey(scope), JSON.stringify(value)); }
    catch { /* The operation can continue with the in-memory copy. */ }
  }

  function clearPending(scope) {
    pendingIdempotency.delete(scope);
    try { globalThis.sessionStorage?.removeItem(storageKey(scope)); }
    catch { /* No persisted copy is available. */ }
  }

  async function idempotentRequest(scope, path, body) {
    const fingerprint = await requestFingerprint(body);
    const existing = readPending(scope);
    const pending = existing?.fingerprint === fingerprint
      ? existing
      : {fingerprint, key:createIdempotencyKey(scope)};
    writePending(scope, pending);
    try {
      const result = await request(path, {
        method:'POST',
        headers:{'Idempotency-Key':pending.key},
        body:JSON.stringify(body),
      });
      clearPending(scope);
      return result;
    } catch (error) {
      // A received 4xx response is definitive. Network/timeout/5xx outcomes may have
      // committed remotely, so the exact key is retained for the next retry.
      if (error.status >= 400 && error.status < 500) clearPending(scope);
      throw error;
    }
  }

  const api = Object.freeze({
    configured:Boolean(config.apiBase),
    requiredProviders,
    request,
    providerReady,
    isActivated,
    async capabilities() { return validateCapabilities(await request('/capabilities')); },
    async activationReadiness() { return request('/activation/readiness'); },
    async merchantDisclosures() { return request('/merchant-disclosures'); },
    async session() { return request('/session'); },
    async register(email, password) { return request('/register', {method:'POST', body:JSON.stringify({email, password})}); },
    async login(email, password) { return request('/login', {method:'POST', body:JSON.stringify({email, password})}); },
    async logout() { return request('/logout', {method:'POST', body:'{}'}); },
    async cart() { return request('/cart'); },
    async setCartItem(productId, quantity) {
      return request(`/cart/items/${encodeURIComponent(productId)}`, {method:'PUT', body:JSON.stringify({quantity})});
    },
    async removeCartItem(productId) {
      return request(`/cart/items/${encodeURIComponent(productId)}`, {method:'DELETE'});
    },
    async checkoutOptions() { return request('/checkout/options'); },
    async createDraftOrder(shippingAddress, carrierService, deliveryDate, timeSlot) {
      return idempotentRequest('draft', '/orders/draft', {
        shippingAddress,
        carrierService,
        deliveryDate,
        timeSlot,
      });
    },
    async orders() { return request('/orders'); },
    async order(orderId) { return request(`/orders/${encodeURIComponent(orderId)}`); },
    async activateOrder(orderId) {
      return idempotentRequest(`activate:${orderId}`, `/orders/${encodeURIComponent(orderId)}/activate`, {});
    },
    async retryPayment(orderId) {
      return idempotentRequest(`retry-payment:${orderId}`, `/orders/${encodeURIComponent(orderId)}/retry-payment`, {});
    },
  });

  globalThis.KISARAGI_COMMERCE_LIVE = api;
})();
