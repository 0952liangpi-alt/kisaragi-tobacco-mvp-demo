import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../admin/admin.js', import.meta.url), 'utf8');
const capabilities = {
  service: 'KISARAGI_CATALOG_ADMIN',
  status: 'ready',
  capabilities: ['catalog.read', 'product.update', 'image.upload'],
};

const response = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

function element(hidden = false) {
  const listeners = new Map();
  const classes = new Set();
  return {
    hidden,
    dataset: {},
    textContent: '',
    value: '',
    files: [],
    checked: false,
    src: '',
    listeners,
    children: [],
    classList: {
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
      contains: (name) => classes.has(name),
    },
    addEventListener(type, handler) { listeners.set(type, handler); },
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children.push(...children); },
    setAttribute() {},
    querySelector() { return null; },
  };
}

const settle = async () => {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
};

async function runScenario({apiBase = 'http://127.0.0.1:8767', replies = []} = {}) {
  const heading = element();
  const elements = {
    connectionPanel: element(false),
    connectionMessage: element(),
    loginForm: element(true),
    editor: element(true),
    status: element(),
    detail: element(true),
    selectionCode: element(),
    selectionCategory: element(),
    productName: element(),
    price: element(),
    officialCatalogPrice: element(),
    officialCatalogPriceType: element(),
    officialCatalogPriceSource: element(),
    officialCatalogPricePeriod: element(),
    officialCatalogPriceStatus: element(),
    imageFile: element(),
    packageConfirm: element(),
    preview: element(true),
    results: element(),
    count: element(),
    search: element(),
    password: element(),
    logout: element(),
    productForm: element(),
    imageForm: element(),
  };
  elements.connectionPanel.querySelector = (selector) => selector === 'h1' ? heading : null;
  const queue = [...replies];
  const requests = [];
  const timeoutSignals = [];
  const context = {
    KISARAGI_LIVE_CONFIG: {apiBase},
    location: {hostname: '127.0.0.1', port: '8766', origin: 'http://127.0.0.1:8766'},
    document: {
      querySelector(selector) { return elements[selector.slice(1)]; },
      createElement() { return element(); },
    },
    fetch: async (url, options) => {
      requests.push({url, options});
      const next = queue.shift();
      if (next instanceof Error) throw next;
      if (!next) throw new Error(`Unexpected request: ${url}`);
      return next;
    },
    AbortSignal: {
      timeout(milliseconds) {
        const signal = {milliseconds};
        timeoutSignals.push(signal);
        return signal;
      },
    },
    URL,
    console,
  };
  runInNewContext(source, context, {filename: 'admin/admin.js'});
  await settle();
  return {elements, heading, requests, timeoutSignals, queue};
}

const noService = await runScenario({apiBase: null});
assert.equal(noService.elements.connectionPanel.hidden, false);
assert.equal(noService.elements.connectionPanel.dataset.state, 'not-connected');
assert.equal(noService.elements.loginForm.hidden, true);
assert.equal(noService.elements.editor.hidden, true);
assert.equal(noService.requests.length, 0);

const loggedOut = await runScenario({replies: [response(capabilities), response({authenticated: false})]});
assert.equal(loggedOut.elements.connectionPanel.hidden, true);
assert.equal(loggedOut.elements.loginForm.hidden, false);
assert.equal(loggedOut.elements.editor.hidden, true);
assert.equal(loggedOut.requests.length, 2);
assert.ok(loggedOut.requests.every((request) => request.options.signal?.milliseconds === 2500));

loggedOut.elements.password.value = 'wrong-password';
loggedOut.queue.push(response({error: 'Incorrect password'}, 401));
await loggedOut.elements.loginForm.listeners.get('submit')({preventDefault() {}});
await settle();
assert.equal(loggedOut.elements.connectionPanel.hidden, true, 'a bad password is not a service outage');
assert.equal(loggedOut.elements.loginForm.hidden, false, 'a bad password must keep the login form available');
assert.equal(loggedOut.elements.editor.hidden, true);
assert.equal(loggedOut.elements.status.textContent, '管理パスワードが正しくありません');

for (const [name, replies] of [
  ['capabilities', [new Error('capabilities offline')]],
  ['session', [response(capabilities), new Error('session offline')]],
  ['search', [response(capabilities), response({authenticated: true}), new Error('search offline')]],
]) {
  const failed = await runScenario({replies});
  assert.equal(failed.elements.connectionPanel.hidden, false, `${name} failure must show the connection panel`);
  assert.equal(failed.elements.connectionPanel.dataset.state, 'offline', `${name} failure must report offline`);
  assert.equal(failed.elements.loginForm.hidden, true, `${name} failure must hide login`);
  assert.equal(failed.elements.editor.hidden, true, `${name} failure must hide editor`);
}

const ready = await runScenario({
  replies: [response(capabilities), response({authenticated: true}), response({revision: 4, products: [{
    id: 'tsn-goods-C088',
    code: 'C088',
    name: 'スモーキング・ブラウン・シングル',
    category: 'ROLLING_ACCESSORIES',
    price_jpy: null,
    official_catalog_price_jpy: 110,
    official_catalog_price_text: '110円',
    official_catalog_price_source_id: 'TSN_SMOKING_GOODS_2026',
    official_catalog_price_as_of: null,
    official_catalog_price_effective_from: '2026-04-01',
    official_catalog_price_effective_to: '2027-03-31',
    official_catalog_price_type: 'SUGGESTED_RETAIL_PRICE',
    official_catalog_price_tax_included: true,
    official_catalog_price_extraction_status: 'OCR_EXTRACTED',
    official_catalog_price_evidence: [{source_id: 'TSN_SMOKING_GOODS_2026', source_page: 6}],
  }]})],
});
assert.equal(ready.elements.connectionPanel.hidden, true);
assert.equal(ready.elements.loginForm.hidden, true);
assert.equal(ready.elements.editor.hidden, false);
assert.equal(ready.elements.status.textContent, '管理サービスに接続しました');
assert.ok(ready.requests.every((request) => request.options.signal?.milliseconds === 2500));
ready.elements.results.children[0].listeners.get('click')();
assert.equal(ready.elements.officialCatalogPrice.textContent, '110円（税込）');
assert.equal(ready.elements.officialCatalogPriceType.textContent, '希望小売価格');
assert.equal(ready.elements.officialCatalogPriceSource.textContent, 'TSN喫煙商品カタログ 2026 · PDF 6ページ');
assert.equal(ready.elements.officialCatalogPricePeriod.textContent, '2026年4月1日〜2027年3月31日');
assert.equal(ready.elements.officialCatalogPriceStatus.textContent, '公式PDFからOCR抽出済み');

ready.queue.push(response({ok: true}));
await ready.elements.logout.listeners.get('click')();
await settle();
assert.equal(ready.elements.connectionPanel.hidden, true);
assert.equal(ready.elements.loginForm.hidden, false);
assert.equal(ready.elements.editor.hidden, true);
assert.equal(ready.elements.status.textContent, 'ログアウトしました');

const timeout = new Error('timed out');
timeout.name = 'TimeoutError';
const timedOut = await runScenario({replies: [timeout]});
assert.equal(timedOut.elements.connectionPanel.dataset.state, 'offline');
assert.equal(timedOut.elements.status.textContent, '管理サービスの応答がタイムアウトしました');
assert.equal(timedOut.elements.status.classList.contains('error'), true);

console.log('Admin UI state: PASS (public, login, ready, failure-closed, bounded timeout)');
