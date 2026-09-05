import {existsSync, readFileSync, statSync} from 'node:fs';
import {strict as assert} from 'node:assert';

await import('../world-tobacco-japan.js');
await import('../catalog-core.js');

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const catalog = globalThis.KISARAGI_CANONICAL_CATALOG;
const registry = globalThis.KISARAGI_ASSET_REGISTRY;
const audit = globalThis.KISARAGI_CATALOG_AUDIT;
const sourceRegistry = globalThis.KISARAGI_SOURCE_REGISTRY;
const boundAssets = registry.filter((asset) => asset.file_path);

assert.equal(catalog.length, 57, 'canonical catalog must contain all 57 reference SKUs');
assert.equal(new Set(catalog.map((product) => product.id)).size, 57, 'canonical SKU IDs must be unique');
assert.equal(audit.TOTAL_REFERENCE_SKU, 57);
assert.equal(audit.TOTAL_LOCAL_SKU, 57);
assert.equal(audit.IMAGE_BOUND, boundAssets.length, 'audit must count only file-backed assets');
assert.equal(audit.MISSING_IMAGE, catalog.length - boundAssets.length);
assert.equal(audit.CONFLICTS, registry.filter((asset) => asset.status === 'CONFLICT_REVIEW').length);
assert.ok(sourceRegistry.USER_UPLOAD.priority > sourceRegistry.LOCAL_VERIFIED_IMAGE.priority);
assert.ok(sourceRegistry.LOCAL_VERIFIED_IMAGE.priority > sourceRegistry.WORLD_TOBACCO.priority);

for (const asset of boundAssets) {
  const url = new URL(asset.file_path, root);
  assert.ok(existsSync(url), `${asset.asset_id} must point to an existing file`);
  assert.ok(statSync(url).size > 1024, `${asset.asset_id} must not be an empty placeholder`);
  const bytes = readFileSync(url);
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  const isPng = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  assert.ok(isJpeg || isPng, `${asset.asset_id} must be a complete JPEG or PNG`);

  const product = catalog.find((candidate) => candidate.id === asset.sku);
  assert.ok(product, `${asset.asset_id} must bind to a canonical SKU`);
  assert.equal(product.image.file_path, asset.file_path);
}

const userAssets = boundAssets.filter((asset) => asset.source === 'USER_UPLOAD');
assert.ok(userAssets.length >= 2, 'the recoverable user-approved images must remain bound');
assert.ok(userAssets.every((asset) => asset.price_preserved));
assert.ok(userAssets.every((asset) => asset.observed_price_jpy === catalog.find((product) => product.id === asset.sku).price_jpy));

const index = read('index.html');
const loader = read('sprite-loader.js');
const imageLayer = read('image-layer.css');
const renderer = read('world-tobacco-catalog-render.js');

assert.ok(index.includes('href="#jp-sku-catalog">品項</a>'), 'the product navigation must target the canonical catalog');
assert.ok(index.includes('57品項を見る'), 'the main CTA must open the canonical catalog');
assert.ok(renderer.includes('product.image?.file_path'), 'cards must render per-SKU files from the Asset Registry');
assert.ok(!renderer.includes('data:image'), 'cards must not transport product images as inline Base64');
assert.ok(!loader.includes('pack.part01') && !loader.includes('user-sprite36'), 'runtime must not depend on broken image packs');
assert.ok(!imageLayer.includes('home-sprite'), 'homepage must not render a whole-page screenshot sprite');

console.log(`Canonical catalog: PASS (${18 + boundAssets.length * 5} assertions; 57 SKU, ${audit.IMAGE_BOUND} image-bound, ${audit.MISSING_IMAGE} missing, ${audit.CONFLICTS} conflicts)`);
