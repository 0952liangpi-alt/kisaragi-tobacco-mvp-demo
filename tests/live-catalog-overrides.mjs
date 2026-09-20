import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createContext, runInContext} from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'world-tobacco-japan.js', 'jt-catalog-2025.js', 'tsn-imported-catalog-2026.js',
  'tsn-goods-catalog-2026.js', 'catalog-core.js',
];
function catalogFor(products) {
  const context = createContext({URL, KISARAGI_LIVE_CONFIG: {apiBase: 'http://127.0.0.1:8767'}, KISARAGI_LIVE_OVERRIDES: products});
  for (const file of files) runInContext(readFileSync(join(root, file), 'utf8'), context, {filename: file});
  return context;
}

const baseline = catalogFor({});
const sku = 'tsn-goods-C088';
const hash = 'a'.repeat(64);
const image = {url: `http://127.0.0.1:8767/media/${sku}/${hash}.jpg`, sha256: hash, width: 120, height: 160};
const live = catalogFor({[sku]: {product_name_ja: '管理者設定名', price_jpy: 580, image}});
const item = live.KISARAGI_CANONICAL_CATALOG.find((product) => product.id === sku);
assert.equal(item.product_name_ja, '管理者設定名');
assert.equal(item.price_jpy, 580);
assert.equal(item.price_source, 'ADMIN');
assert.equal(item.image.file_path, image.url);
assert.equal(item.image_source, 'ADMIN_UPLOAD');
assert.equal(item.status, 'IMAGE_BOUND');
assert.equal(live.KISARAGI_CATALOG_AUDIT.IMAGE_BOUND, baseline.KISARAGI_CATALOG_AUDIT.IMAGE_BOUND + 1);
assert.equal(live.KISARAGI_CATALOG_AUDIT.MISSING_IMAGE, baseline.KISARAGI_CATALOG_AUDIT.MISSING_IMAGE - 1);
assert.equal(live.KISARAGI_ASSET_REGISTRY.filter((asset) => asset.sku === sku && asset.source === 'ADMIN_UPLOAD').length, 1);

const rejected = catalogFor({
  [sku]: {image: {...image, url: `https://untrusted.example/media/${sku}/${hash}.jpg`}},
  'unknown-sku': {product_name_ja: 'Should not exist', price_jpy: 1, image},
});
assert.equal(rejected.KISARAGI_CANONICAL_CATALOG.length, baseline.KISARAGI_CANONICAL_CATALOG.length);
assert.equal(rejected.KISARAGI_CANONICAL_CATALOG.find((product) => product.id === sku).image, null);
assert.equal(rejected.KISARAGI_CATALOG_AUDIT.TOTAL_ASSETS, baseline.KISARAGI_CATALOG_AUDIT.TOTAL_ASSETS);

const conflict = catalogFor({'wt-1117': {price_jpy: 580}});
assert.equal(conflict.KISARAGI_CANONICAL_CATALOG.find((product) => product.id === 'wt-1117').status, 'PRICE_CONFLICT');
assert.equal(conflict.KISARAGI_CATALOG_AUDIT.CONFLICTS, baseline.KISARAGI_CATALOG_AUDIT.CONFLICTS + 1);
console.log('Live catalog overrides: PASS (single catalog, image priority, origin guard, price conflict)');
