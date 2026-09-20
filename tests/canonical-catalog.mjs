import {existsSync, readFileSync, statSync} from 'node:fs';
import {strict as assert} from 'node:assert';
import {createHash} from 'node:crypto';

await import('../world-tobacco-japan.js');
await import('../jt-catalog-2025.js');
await import('../tsn-imported-catalog-2026.js');
await import('../tsn-goods-catalog-2026.js');
await import('../catalog-core.js');

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const catalog = globalThis.KISARAGI_CANONICAL_CATALOG;
const registry = globalThis.KISARAGI_ASSET_REGISTRY;
const audit = globalThis.KISARAGI_CATALOG_AUDIT;
const sourceRegistry = globalThis.KISARAGI_SOURCE_REGISTRY;
const missingImageManifest = globalThis.KISARAGI_MISSING_IMAGE_MANIFEST;
const boundAssets = registry.filter((asset) => asset.file_path);
const boundSkus = new Set(boundAssets.map((asset) => asset.sku));

assert.equal(catalog.length, 1100, 'canonical catalog must retain original products and all four source catalogs');
assert.equal(new Set(catalog.map((product) => product.id)).size, catalog.length, 'canonical SKU IDs must be unique');
assert.equal(audit.TOTAL_REFERENCE_SKU, 1074);
assert.equal(audit.TOTAL_LOCAL_SKU, catalog.length);
assert.equal(audit.TOTAL_JT_2025_SKU, 134);
assert.equal(audit.JT_MATCHED_EXISTING, 53);
assert.equal(audit.JT_ADDED, 81);
assert.equal(audit.JT_HISTORICAL_PRICE_DIFFERENCES, 20);
assert.equal(audit.TOTAL_TSN_2026_SKU, 763);
assert.equal(audit.TSN_MATCHED_EXISTING, 8);
assert.equal(audit.TSN_ADDED, 755);
assert.equal(audit.TOTAL_TSN_GOODS_2026_SKU, 181);
assert.deepEqual(audit.TSN_GOODS_BY_CATEGORY, {
  ROLLING_ACCESSORIES: 142,
  PIPE_ACCESSORIES: 17,
  LIGHTERS: 20,
  ASHTRAYS: 2,
});
assert.equal(new Set(catalog.filter((product) => product.product_code).map((product) => product.product_code)).size, catalog.filter((product) => product.product_code).length, 'catalog product codes must be unique');
for (const sourceProduct of globalThis.KISARAGI_JT_2025_SKUS) {
  const matches = catalog.filter((product) => product.product_code === sourceProduct.code);
  assert.equal(matches.length, 1, `JT code ${sourceProduct.code} must resolve to exactly one canonical SKU`);
  assert.equal(matches[0].historical_list_price_jpy, sourceProduct.historical_list_price_jpy);
  assert.equal(matches[0].historical_price_as_of, '2025-10-01');
  assert.equal(matches[0].manufacturer_pdf_page, sourceProduct.pdf_page);
}
assert.equal(catalog.find((product) => product.id === 'jt-1992').price_jpy, null, 'historical JT price must not masquerade as current price');
assert.equal(catalog.find((product) => product.id === 'wt-1117').price_jpy, 470, 'existing reference price must not be overwritten');
assert.equal(catalog.find((product) => product.id === 'jt-1919').category, 'CIGARS');
assert.equal(catalog.find((product) => product.id === 'jt-3438').category, 'SMOKELESS_TOBACCO');
assert.equal(catalog.find((product) => product.id === 'jt-1274').pack_unit, 'カプセル');
for (const sourceProduct of globalThis.KISARAGI_TSN_2026_SKUS) {
  const matches = catalog.filter((product) => product.product_code === sourceProduct.code);
  assert.equal(matches.length, 1, `TSN code ${sourceProduct.code} must resolve to exactly one canonical SKU`);
  assert.equal(matches[0].category, sourceProduct.category);
  if (matches[0].id.startsWith('tsn-')) {
    assert.equal(matches[0].historical_list_price_jpy, sourceProduct.historical_list_price_jpy);
    assert.equal(matches[0].historical_price_as_of, '2026-05-21');
    assert.equal(matches[0].price_jpy, null, 'historical PDF price must not masquerade as current price');
  }
}
assert.equal(catalog.find((product) => product.id === 'tsn-2920').category, 'IMPORTED_CIGARETTES');
assert.equal(catalog.find((product) => product.id === 'tsn-2205').category, 'HEATED_TOBACCO_STICKS');
assert.equal(catalog.find((product) => product.id === 'tsn-2091').category, 'RYO');
assert.equal(catalog.find((product) => product.id === 'tsn-3140').category, 'CIGARS');
assert.equal(catalog.find((product) => product.id === 'tsn-2867').category, 'SMOKELESS_TOBACCO');
assert.equal(catalog.find((product) => product.id === 'tsn-2080').category, 'CUT_TOBACCO');
for (const sourceProduct of globalThis.KISARAGI_TSN_GOODS_2026_SKUS) {
  const matches = catalog.filter((product) => product.product_code === sourceProduct.code);
  assert.equal(matches.length, 1, `goods code ${sourceProduct.code} must resolve to one canonical SKU`);
  assert.equal(matches[0].category, sourceProduct.category);
  assert.equal(matches[0].status, 'IDENTITY_PENDING');
  assert.equal(matches[0].price_jpy, null, 'OCR price must not masquerade as current price');
  assert.equal(matches[0].historical_list_price_jpy, sourceProduct.ocr_list_price_candidate_jpy, 'OCR catalog price remains historical, not current');
  assert.equal(matches[0].image, null, 'unreviewed goods must not receive a guessed image');
  assert.equal(matches[0].product_name_ocr_candidate, sourceProduct.ocr_name_candidate);
  assert.equal(matches[0].product_name_ja, sourceProduct.ocr_name_candidate || sourceProduct.name);
}
assert.equal(catalog.find((product) => product.id === 'tsn-goods-D025').category, 'LIGHTERS');
assert.equal(catalog.find((product) => product.id === 'tsn-goods-D026').category, 'ASHTRAYS');
assert.equal(catalog.find((product) => product.id === 'tsn-goods-D009').category, 'LIGHTERS');
assert.equal(audit.IDENTITY_PENDING, 197);
assert.equal(audit.TOTAL_ASSETS, boundAssets.length);
assert.equal(audit.TOTAL_ASSETS, 901);
assert.equal(audit.TOTAL_UPLOAD_ASSETS, 31);
assert.equal(audit.IMAGE_BOUND, 900);
assert.equal(audit.MISSING_IMAGE, 200);
assert.equal(audit.COMPLETE_SKU, 53);
assert.equal(audit.COVERAGE_PERCENT, 4.8);
assert.equal(audit.IMAGE_BOUND, boundSkus.size, 'audit must count image-bound products, not duplicate images');
assert.equal(audit.MISSING_IMAGE, catalog.length - boundSkus.size);
assert.equal(missingImageManifest.length, audit.MISSING_IMAGE, 'manifest and runtime missing-image audit must agree');
assert.deepEqual(
  Object.fromEntries(Object.entries(audit.MISSING_IMAGE_BY_BRAND).sort()),
  Object.fromEntries(
    missingImageManifest.reduce((counts, product) => {
      counts.set(product.brand, (counts.get(product.brand) || 0) + 1);
      return counts;
    }, new Map())
  ),
  'brand totals must be derived from the missing-image manifest'
);
for (const product of missingImageManifest) {
  assert.deepEqual(Object.keys(product), [
    'id',
    'sku',
    'brand',
    'product_name_ja',
    'product_code',
    'system_code',
    'price_jpy',
    'source_url',
    'image_status',
    'match_status',
  ]);
  assert.equal(product.image_status, 'IMAGE_MISSING');
}
assert.ok(['wt-ime2543', 'wt-ime2544', 'wt-ime2831', 'wt-ime2832'].every((id) =>
  missingImageManifest.some((product) => product.id === id)));
assert.deepEqual(registry.filter((asset) => asset.status === 'CONFLICT_REVIEW').map((asset) => asset.asset_id),
  ['ua-nas-organic-mint-a', 'ua-nas-organic-mint-b', 'ua-nas-organic-mint-c',
    'tsn2026-review-3048', 'tsn2026-review-3045'],
  'ambiguous user images must remain unbound even when exact-code JT images exist');
assert.equal(audit.CONFLICTS, registry.filter((asset) => asset.status === 'CONFLICT_REVIEW').length);
assert.ok(sourceRegistry.USER_UPLOAD.priority > sourceRegistry.LOCAL_VERIFIED_IMAGE.priority);
assert.ok(sourceRegistry.LOCAL_VERIFIED_IMAGE.priority > sourceRegistry.JT_CATALOG_2025_10.priority);
assert.ok(sourceRegistry.LOCAL_VERIFIED_IMAGE.priority > sourceRegistry.WORLD_TOBACCO.priority);
assert.equal(sourceRegistry.JT_CATALOG_2025_10.price_as_of, '2025-10-01');
assert.equal(sourceRegistry.JT_CATALOG_2025_10.pdf_sha256, 'ebe8533550163676bfe3a230c0401d08a62266bd43a1c2cde9d9836a4314206e');
assert.equal(sourceRegistry.JT_CATALOG_2025_10.image_permission_basis, 'CLIENT_AUTHORIZATION_CONFIRMED_BY_USER_2026-09-20');
assert.equal(sourceRegistry.TSN_IMPORT_2026_04.pdf_sha256, '2696e449faf1d9fb7b00b2c2689e6573d744f0d96456bd4b4b8852f7e41d768e');
assert.equal(sourceRegistry.TSN_IMPORT_2026_04.image_permission_basis, 'CLIENT_AUTHORIZATION_CONFIRMED_BY_USER_2026-09-20');
assert.equal(sourceRegistry.TSN_SMOKING_GOODS_2026.pdf_sha256, '8786400c8527547a500288475d0ff299a1220727a1bc8105c5e4fda1868ca71d');
assert.equal(sourceRegistry.TSN_LIGHTERS_2026.pdf_sha256, '2d9493884c82a8efe26e358c8b12a33988d50e31e37989d9e8e7716ddcbbc10b');
assert.equal(sourceRegistry.TSN_SMOKING_GOODS_2026.identity_status, 'OCR_REVIEW_REQUIRED');

const jtImages = boundAssets.filter((asset) => asset.source === 'JT_CATALOG_2025_10');
assert.equal(jtImages.length, 129);
assert.equal(new Set(jtImages.map((asset) => asset.pdf_object_id)).size, 129);
for (const asset of jtImages) {
  const bytes = readFileSync(new URL(asset.file_path, root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  assert.equal(catalog.find((product) => product.id === asset.sku)?.image?.sha256, asset.sha256,
    `${asset.sku} must expose its current image hash to renderers for cache-safe URLs`);
  assert.ok(asset.width >= 200 && asset.height >= 280);
  assert.equal(asset.status, 'APPROVED_EXTERNAL_SOURCE');
}
for (const code of ['1117', '1116', '1020', '1692', '1138']) {
  assert.ok(!jtImages.some((asset) => asset.asset_id === `jt2025-${code}`), `${code} must keep its earlier image`);
}
const tsnImages = boundAssets.filter((asset) => asset.source === 'TSN_IMPORT_2026_04');
assert.equal(tsnImages.length, 740);
assert.equal(new Set(tsnImages.map((asset) => asset.sha256)).size, tsnImages.length);
for (const asset of tsnImages) {
  const bytes = readFileSync(new URL(asset.file_path, root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  assert.ok(asset.width >= 110 && asset.height >= 100);
  assert.equal(asset.status, 'APPROVED_EXTERNAL_SOURCE');
}

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
assert.equal(
  boundAssets.filter((asset) => asset.display_crop === 'SIDE_MATTE_30PX').length,
  15,
  'all uploaded screenshots with dark side mattes must opt into the display-only crop'
);
assert.ok(!existsSync(new URL('assets/catalog/image2.jpg', root)), 'rejected Peace photo must be absent');
assert.ok(!existsSync(new URL('assets/catalog/image5.jpg', root)), 'rejected Mevius pair photo must be absent');
assert.ok(!existsSync(new URL('assets/catalog/products/wt-1034-peace-10.jpg', root)), 'rejected Peace product copy must be absent');

const index = read('index.html');
const loader = read('sprite-loader.js');
const imageLayer = read('image-layer.css');
const renderer = read('world-tobacco-catalog-render.js');
const luxuryHome = read('luxury-home.js');

assert.ok(index.includes('href="#jp-sku-catalog">資料商品庫</a>'), 'the source archive navigation must target the canonical catalog');
assert.ok(luxuryHome.includes('href="#jp-sku-catalog"'), 'the rendered home CTA must open the canonical catalog');
assert.ok(renderer.includes('product.images?.length'), 'cards must render every per-SKU file from the Asset Registry');
assert.ok(!renderer.includes('data:image'), 'cards must not transport product images as inline Base64');
assert.ok(!loader.includes('pack.part01') && !loader.includes('user-sprite36'), 'runtime must not depend on broken image packs');
assert.ok(!imageLayer.includes('home-sprite'), 'homepage must not render a whole-page screenshot sprite');
assert.ok(loader.includes('tsn-imported-catalog-2026.js'));
assert.ok(loader.includes('tsn-goods-catalog-2026.js'));
assert.ok(read('shop.html').includes('tsn-goods-catalog-2026.js'));
assert.ok(read('checkout.html').includes('tsn-goods-catalog-2026.js'));

console.log(`Canonical catalog: PASS (${catalog.length} products, ${boundAssets.length} files, ${audit.IMAGE_BOUND} image-bound, ${audit.MISSING_IMAGE} missing, ${audit.CONFLICTS} conflicts)`);
