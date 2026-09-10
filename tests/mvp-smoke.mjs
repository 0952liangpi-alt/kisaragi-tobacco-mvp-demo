import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const html = read('index.html');
const baseCss = read('styles-base.css');
const imageCss = read('image-layer.css');
const catalogCss = read('world-tobacco-catalog.css');
const loader = read('sprite-loader.js');
const renderer = read('world-tobacco-catalog-render.js');
const luxuryHome = read('luxury-home.js');
const serviceWorker = read('service-worker.js');
const manifest = JSON.parse(read('manifest.webmanifest'));

const requiredChecks = [
  ['age gate', html, 'id="age"'],
  ['adult confirmation', html, 'id="enter"'],
  ['underage notice', html, '未成年者の喫煙は法律で禁じられています'],
  ['no-sales disclosure', html, '本サイトでは販売・決済を行いません'],
  ['mobile viewport fit', html, 'viewport-fit=cover'],
  ['Apple web app metadata', html, 'apple-mobile-web-app-capable'],
  ['canonical catalog navigation', html, 'href="#jp-sku-catalog">商品</a>'],
  ['canonical catalog primary CTA', luxuryHome, 'href="#jp-sku-catalog"'],
  ['canonical catalog loader', loader, "loadScript('./catalog-core.js"],
  ['canonical renderer', loader, "loadScript('./world-tobacco-catalog-render.js"],
  ['per-SKU image paths', renderer, 'product.images?.length'],
  ['multi-image gallery', catalogCss, /scroll-snap-type\s*:\s*x mandatory/],
  ['brand toolbar', renderer, 'aria-label="ブランドで絞り込む"'],
  ['catalog search', renderer, 'type="search"'],
  ['localized image load fallback', renderer, '画像を読み込めません'],
  ['localized missing image state', renderer, '画像未登録'],
  ['localized identity state', renderer, "IDENTITY_PENDING: '商品名確認待ち'"],
  ['mobile two-column catalog', catalogCss, /grid-template-columns\s*:\s*repeat\(2\s*,\s*minmax\(0\s*,\s*1fr\)\)/],
  ['contained product images', catalogCss, /object-fit\s*:\s*contain/],
  ['dark side matte display crop', catalogCss, /clip-path\s*:\s*inset\(0 2\.5%\)/],
  ['registry-driven matte class', renderer, 'SIDE_MATTE_30PX'],
  ['horizontal brand filters', catalogCss, /overflow-x\s*:\s*auto/],
  ['mobile catalog bottom clearance', catalogCss, /padding\s*:\s*48px 12px 104px/],
  ['mobile dock', html, 'aria-label="モバイルナビゲーション"'],
  ['mobile dock safe area', imageCss, 'env(safe-area-inset-bottom)'],
  ['hero dock clearance', imageCss, 'body.hero-in-view .mobile-dock'],
  ['mobile CTA no-wrap', imageCss, 'white-space: nowrap'],
  ['short-screen age gate', imageCss, '@media (max-width: 520px), (max-height: 760px)'],
  ['age gate scroll fallback', imageCss, 'overflow-y: auto'],
  ['hero uses the current local KISARAGI asset', luxuryHome, './assets/home/kisaragi-metal-hero.png'],
  ['whole-page sprite retired', imageCss, '.hero-visual'],
  ['service worker registration target', serviceWorker, './catalog-core.js'],
  ['service worker registration', html, "serviceWorker.register('./service-worker.js')"],
  ['runtime image cache policy', serviceWorker, "dest==='image'"],
  ['PWA icon', JSON.stringify(manifest), 'assets/tougu-mark.svg'],
  ['sticky header', baseCss, 'position:sticky'],
];

for (const [name, source, expected] of requiredChecks) {
  const matches = expected instanceof RegExp ? expected.test(source) : source.includes(expected);
  assert.ok(matches, `${name} is missing`);
}

assert.ok(!html.includes('data-add=') && !html.includes('checkout'), 'public page must not expose purchase controls');
assert.ok(!loader.includes('pack.part01') && !loader.includes('user-sprite36'), 'runtime must not load broken Base64 assets');
assert.ok(!imageCss.includes('home-sprite'), 'homepage must not use the screenshot sprite');
assert.ok(!html.includes('assets/catalog/image2.jpg'), 'rejected photo 1 must not render on the page');
assert.ok(!html.includes('assets/catalog/image5.jpg'), 'rejected Mevius photo must not render on the page');
assert.ok(!html.includes('contact@example.jp'), 'the public page must not expose a placeholder contact address');
assert.ok(html.includes('お問い合わせ窓口 準備中'), 'an unavailable contact channel must be represented truthfully');
assert.ok(!serviceWorker.includes('wt-1034-peace-10.jpg'), 'rejected photo 1 must not be cached');
assert.ok(!renderer.includes('data:image'), 'product cards must use per-SKU files');
assert.ok(manifest.icons.length > 0, 'PWA manifest needs an icon');

console.log(`MVP smoke: PASS (${requiredChecks.length + 8} assertions)`);
