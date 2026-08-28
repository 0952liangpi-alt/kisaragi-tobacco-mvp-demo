import { readFileSync, readdirSync } from 'node:fs';
import { strict as assert } from 'node:assert';

await import('../catalog-data.js');
const catalog = globalThis.KISARAGI_CATALOG;

const root = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');
const html = read('index.html');
const js = read('app.js');
const css = read('styles.css');
const sw = read('service-worker.js');
const manifest = JSON.parse(read('manifest.webmanifest'));

const requiredChecks = [
  ['age gate', html, 'id="ageGate"'],
  ['catalog', html, 'id="productGrid"'],
  ['review form', html, 'id="reviewForm"'],
  ['cart persistence', js, "const CART_KEY = 'kisaragiDemoCart'"],
  ['inventory guard', js, '在庫数を超えて追加できません'],
  ['review safety copy', js, '本人確認・住所確認・許可条件を審査します。'],
  ['mobile safe-area', html, 'apple-mobile-web-app-capable'],
  ['keyboard focus', css, 'focus-visible'],
  ['age background isolation', js, "element.setAttribute('inert', '')"],
  ['tax-inclusive price format', js, "toLocaleString('ja-JP')}（税込）"],
  ['legal modal controls', html, 'data-legal="tokusho"'],
  ['underage legal notice', html, '未成年者の喫煙は法律で禁じられています'],
  ['low-stock selector', html, 'value="low_stock"'],
  ['drawer above mobile navigation', css, 'aside[aria-label="カート"]{position:fixed;right:0;bottom:0;z-index:9999}'],
  ['mobile 3d reduction', css, 'transform:none!important'],
  ['subtle noise texture', css, "feTurbulence"],
  ['five-dimensional taste profile', js, "sweetness:'甘さ',menthol:'清涼感'"],
  ['low-stock state', js, "label:'残りわずか'"],
  ['real-photo hero', html, 'hero-real-gallery'],
  ['clickable full-size catalog photo', js, 'catalog-photo-link'],
  ['network-first page refresh', sw, "event.request.mode === 'navigate'"],
  ['stable review vote identity', js, 'data-helpful="${product.id}:${review.id}"'],
  ['generic modal focus isolation', js, 'releaseActiveModalFocus'],
  ['cart focus isolation', js, 'releaseCartFocus'],
  ['closed cart inert state', html, 'aria-hidden="true" inert'],
  ['catalog data loaded before app', html, 'catalog-data.js'],
  ['catalog category filters', html, 'data-catalog-filter="smokeless"'],
  ['catalog source links', js, 'entry.sourceUrl'],
  ['service worker registration', js, "serviceWorker.register('./service-worker.js')"],
  ['offline cache', sw, "const CACHE_NAME = 'kisaragi-demo-v4'"],
  ['glass product direction', css, 'Aurora Glass product direction'],
  ['real catalog primary CTA', html, 'href="#catalog">実物図鑑を見る'],
  ['Japanese navigation label', html, 'aria-label="メインナビゲーション"'],
  ['prototype status above the fold', html, 'PROTOTYPE / NO SALES'],
];

for (const [name, source, expected] of requiredChecks) assert.ok(source.includes(expected), `${name} is missing`);

assert.ok(!html.includes('yinzuoshop.com') && !html.includes('world-tobacco.jp'), 'reference-site material leaked into MVP');
assert.equal((html.match(/data-catalog-filter="all"/g) || []).length, 1, 'catalog must have one all-category filter');
assert.ok(!js.includes('fetch('), 'MVP must not send customer or identity data');
assert.equal(catalog.length, 35, 'catalog must contain 35 verified product records');
assert.equal(new Set(catalog.map((entry) => entry.id)).size, 35, 'catalog IDs must be unique');
assert.equal(new Set(catalog.map((entry) => entry.category)).size, 10, 'catalog must cover 10 product categories');
assert.equal(catalog.filter((entry) => entry.publicationAllowed).length, 6, 'only six open-license images may be published');
assert.equal(catalog.filter((entry) => !entry.publicationAllowed).length, 29, '29 records must remain source-link only');
assert.ok(catalog.every((entry) => /^https:\/\//.test(entry.sourceUrl)), 'every catalog record needs a secure source URL');
assert.ok(catalog.every((entry) => entry.publicationAllowed === Boolean(entry.asset)), 'image publication flag and local asset must agree');

const expectedAssets = catalog.filter((entry) => entry.asset).map((entry) => entry.asset).sort();
const deployedAssets = readdirSync(new URL('../assets/catalog/', import.meta.url)).sort();
assert.deepEqual(deployedAssets, expectedAssets, 'public bundle must contain only approved catalog images');
assert.ok(manifest.icons.length > 0, 'PWA manifest needs an icon');
assert.ok(!['文档目录', '实物照片', '商业发布', '主导航', '纸卷烟', '图片来源'].some((phrase) => html.includes(phrase)), 'customer-facing HTML must not contain the previous Chinese copy');
console.log(`MVP smoke: PASS (${requiredChecks.length + 11} assertions)`);
