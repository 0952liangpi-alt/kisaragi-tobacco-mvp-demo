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
const boundSkus = new Set(boundAssets.map((asset) => asset.sku));

assert.equal(catalog.length, 83, 'canonical catalog must contain 57 reference SKUs and 26 uploaded products');
assert.equal(new Set(catalog.map((product) => product.id)).size, catalog.length, 'canonical SKU IDs must be unique');
assert.equal(audit.TOTAL_REFERENCE_SKU, 57);
assert.equal(audit.TOTAL_LOCAL_SKU, catalog.length);
assert.equal(audit.TOTAL_UPLOAD_ASSETS, 31);
assert.equal(audit.IMAGE_BOUND, boundSkus.size, 'audit must count image-bound products, not duplicate images');
assert.equal(audit.MISSING_IMAGE, catalog.length - boundSkus.size);
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
  assert.ok(product.images.some((image) => image.file_path === asset.file_path), `${asset.asset_id} must be exposed by its canonical product`);
}

const userAssets = boundAssets.filter((asset) => asset.source === 'USER_UPLOAD');
assert.equal(userAssets.length, 31, 'all deduplicated user-approved images must remain bound');
const pricePreservedAssets = userAssets.filter((asset) => asset.price_preserved);
assert.equal(pricePreservedAssets.length, 3, 'all three uploaded images with visible prices must preserve those pixels');
assert.ok(pricePreservedAssets.every((asset) => asset.observed_price_jpy != null));
assert.equal(catalog.find((product) => product.id === 'wt-1692').image.asset_id, 'ua-mevius-option-purple-100s-1');
assert.equal(catalog.find((product) => product.id === 'wt-1138').image.asset_id, 'ua-mevius-lights-8');
assert.equal(catalog.find((product) => product.id === 'ua-terea-pastel').images.length, 2);
assert.ok(!existsSync(new URL('assets/catalog/image2.jpg', root)), 'rejected Peace photo must be absent');
assert.ok(!existsSync(new URL('assets/catalog/image5.jpg', root)), 'rejected Mevius pair photo must be absent');
assert.ok(!existsSync(new URL('assets/catalog/products/wt-1034-peace-10.jpg', root)), 'rejected Peace product copy must be absent');

const index = read('index.html');
const loader = read('sprite-loader.js');
const imageLayer = read('image-layer.css');
const renderer = read('world-tobacco-catalog-render.js');

assert.ok(index.includes('href="#jp-sku-catalog">品項</a>'), 'the product navigation must target the canonical catalog');
assert.ok(index.includes('83品項を見る'), 'the main CTA must open the canonical catalog');
assert.ok(renderer.includes('product.images?.length'), 'cards must render every per-SKU file from the Asset Registry');
assert.ok(!renderer.includes('data:image'), 'cards must not transport product images as inline Base64');
assert.ok(!loader.includes('pack.part01') && !loader.includes('user-sprite36'), 'runtime must not depend on broken image packs');
assert.ok(!imageLayer.includes('home-sprite'), 'homepage must not render a whole-page screenshot sprite');

console.log(`Canonical catalog: PASS (${catalog.length} products, ${boundAssets.length} files, ${audit.IMAGE_BOUND} image-bound, ${audit.MISSING_IMAGE} missing, ${audit.CONFLICTS} conflicts)`);
