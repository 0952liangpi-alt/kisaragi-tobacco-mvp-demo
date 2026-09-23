import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';

await import('../world-tobacco-japan.js');
await import('../jt-catalog-2025.js');
await import('../tsn-imported-catalog-2026.js');
await import('../tsn-goods-catalog-2026.js');
await import('../catalog-core.js');

const catalog = globalThis.KISARAGI_CANONICAL_CATALOG;
const audit = globalThis.KISARAGI_CATALOG_AUDIT;
const facts = catalog.flatMap((product) => product.official_catalog_price_evidence);

assert.equal(facts.length, 1078, 'all four official catalog rows must remain traceable');
assert.equal(audit.OFFICIAL_CATALOG_PRICE_TERMS, 1070, 'eight overlapping codes must merge without losing either source');
assert.equal(audit.OFFICIAL_CATALOG_NUMERIC_PRICE, 1056);
assert.equal(audit.OFFICIAL_CATALOG_OPEN_PRICE, 14);
assert.equal(audit.OFFICIAL_CATALOG_PRICE_MISSING, 30);
assert.equal(audit.OFFICIAL_CATALOG_PRICE_CONFLICTS, 0);

assert.deepEqual(
  Object.fromEntries([...new Set(facts.map((fact) => fact.source_id))].sort().map((sourceId) => [
    sourceId, facts.filter((fact) => fact.source_id === sourceId).length,
  ])),
  {
    JT_CATALOG_2025_10: 134,
    TSN_IMPORT_2026_04: 763,
    TSN_LIGHTERS_2026: 24,
    TSN_SMOKING_GOODS_2026: 157,
  },
);

for (const fact of facts) {
  assert.equal(fact.authority, 'OFFICIAL_CLIENT_CATALOG');
  assert.equal(fact.currency, 'JPY');
  assert.equal(fact.visibility, 'PUBLIC');
  assert.match(fact.source_sha256, /^[a-f0-9]{64}$/);
  assert.ok(Number.isInteger(fact.source_page) && fact.source_page > 0);
  assert.ok(fact.source_product_code);
  if (fact.pricing_mode === 'OPEN_PRICE') {
    assert.equal(fact.amount_jpy, null);
    assert.equal(fact.price_text, 'オープン価格');
  } else {
    assert.ok(Number.isInteger(fact.amount_jpy) && fact.amount_jpy >= 0);
  }
}

const overlapCodes = ['2376', '3439', '3441', '3442', '3443', '3440', '2377', '3438'];
for (const code of overlapCodes) {
  const product = catalog.find((item) => item.product_code === code);
  assert.ok(product, `overlap code ${code} must resolve`);
  assert.equal(product.official_catalog_price_evidence.length, 2, `${code} must retain both JT and TSN evidence`);
  assert.equal(new Set(product.official_catalog_price_evidence.map((fact) => fact.amount_jpy)).size, 1, `${code} official amounts must agree`);
  assert.deepEqual(new Set(product.official_catalog_price_evidence.map((fact) => fact.source_id)), new Set([
    'JT_CATALOG_2025_10', 'TSN_IMPORT_2026_04',
  ]));
}

const numericLighters = new Map([
  ['D027', 250], ['D028', 435], ['D006', 132], ['D013', 171], ['D020', 154],
  ['D014', 165], ['D002', 120], ['D001', 165], ['D008', 132], ['D011', 132],
]);
const openLighters = new Set([
  'D026', 'D019', 'D018', 'D025', 'D012', 'D010', 'D005',
  'D024', 'D004', 'D015', 'D021', 'D003', 'D016', 'D009',
]);
for (const [code, amount] of numericLighters) {
  const product = catalog.find((item) => item.product_code === code);
  assert.equal(product?.official_catalog_price_jpy, amount, `${code} must use the suggested retail price, not wholesale`);
  assert.equal(product?.official_catalog_price_kind, 'SUGGESTED_RETAIL_PRICE');
  assert.equal(product?.official_catalog_price_tax_included, true);
}
for (const code of openLighters) {
  const product = catalog.find((item) => item.product_code === code);
  assert.equal(product?.official_catalog_price_jpy, null, `${code} must not expose a wholesale price as retail`);
  assert.equal(product?.official_catalog_price_kind, 'OPEN_PRICE');
  assert.equal(product?.official_catalog_price_text, 'オープン価格');
  assert.equal(product?.official_catalog_price_tax_included, null, `${code} open price must not inherit tax from the adjacent wholesale row`);
}

const limitedLighters = new Set(['D027', 'D028', 'D026']);
for (const code of [...numericLighters.keys(), ...openLighters]) {
  const product = catalog.find((item) => item.product_code === code);
  if (limitedLighters.has(code)) {
    assert.equal(product?.official_catalog_price_effective_from, '2026-04-01', `${code} period-limited start must match page 1`);
    assert.equal(product?.official_catalog_price_effective_to, '2026-12-31', `${code} period-limited end must match page 1`);
  } else {
    assert.equal(product?.official_catalog_price_effective_from, null, `${code} must not receive an unsupported validity start`);
    assert.equal(product?.official_catalog_price_effective_to, null, `${code} must not receive an unsupported validity end`);
  }
}

for (const product of catalog.filter((item) => item.official_catalog_price_source_id === 'TSN_SMOKING_GOODS_2026')) {
  assert.equal(product.official_catalog_price_effective_from, null, `${product.product_code} must not infer a catalog-wide validity start`);
  assert.equal(product.official_catalog_price_effective_to, null, `${product.product_code} must not infer a catalog-wide validity end`);
}

assert.equal(catalog.find((item) => item.product_code === 'D027').official_catalog_price_jpy, 250);
assert.equal(catalog.find((item) => item.product_code === 'D028').official_catalog_price_jpy, 435);
assert.equal(catalog.find((item) => item.product_code === 'D006').official_catalog_price_jpy, 132);
assert.ok(catalog.every((product) => product.price_jpy == null || Number.isInteger(product.price_jpy)), 'catalog facts must not auto-populate the merchant display price');

for (const file of ['shop.js', 'product-detail.js', 'world-tobacco-catalog-render.js', 'checkout.js']) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.equal(
    source.includes('OCR_EXTRACTED|OCR_REVIEW_REQUIRED|PENDING'),
    false,
    `${file} must not present an official PDF OCR extraction as a pending price`,
  );
}

console.log(`Official catalog prices: PASS (${facts.length} source rows, ${audit.OFFICIAL_CATALOG_NUMERIC_PRICE} numeric, ${audit.OFFICIAL_CATALOG_OPEN_PRICE} open-price terms)`);
