import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const html = read('index.html');
const shop = read('shop.html');
const shopScript = read('shop.js');
const productDetail = read('product-detail.js');
const jtImporter = read('scripts/import-jt-2025.py');
const shopPolish = read('shop-polish.css');
const baseCss = read('styles-base.css');
const imageCss = read('image-layer.css');
const edgeCleanup = read('edge-cleanup.css');
const catalogCss = read('world-tobacco-catalog.css');
const loader = read('sprite-loader.js');
const renderer = read('world-tobacco-catalog-render.js');
const luxuryHome = read('luxury-home.js');
const luxuryCss = read('luxury-home.css');
const serviceWorker = read('service-worker.js');
const manifest = JSON.parse(read('manifest.webmanifest'));

const requiredChecks = [
  ['age gate', html, 'id="age"'],
  ['home age gate is a labelled modal', html, 'role="dialog" aria-modal="true" aria-labelledby="age-title"'],
  ['home age gate traps keyboard focus', html, "if(event.key!=='Tab')return"],
  ['home age gate locks background scroll', html, "document.body.style.overflow='hidden'"],
  ['home age gate restores background interaction', html, 'element.inert=inert'],
  ['adult confirmation', html, 'id="enter"'],
  ['underage notice', html, '未成年者の喫煙は法律で禁じられています'],
  ['no-sales disclosure', html, '本サイトでは販売・決済を行いません'],
  ['mobile viewport fit', html, 'viewport-fit=cover'],
  ['Apple web app metadata', html, 'apple-mobile-web-app-capable'],
  ['canonical catalog navigation', html, 'href="#jp-sku-catalog">資料商品庫</a>'],
  ['shop navigation from home', html, 'href="./shop.html#catalog">商品案内</a>'],
  ['home navigation from shop', shop, 'href="./index.html">ホーム</a>'],
  ['archive navigation from shop', shop, 'href="./index.html#jp-sku-catalog">資料商品庫</a>'],
  ['shared age session on home', html, "sessionStorage.setItem(ageKey,'1')"],
  ['shared age session on shop', shopScript, "sessionStorage.setItem('kisaragi-age-verified','1')"],
  ['canonical catalog primary CTA', luxuryHome, 'href="#jp-sku-catalog"'],
  ['archive incremental display', renderer, 'items.slice(0, shownCount)'],
  ['shop incremental display', shopScript, 'items.slice(0,shownCount)'],
  ['shop load-more control', shop, 'id="loadMoreProducts"'],
  ['mobile cross-page navigation', shopPolish, '.site-header nav { order:3; display:flex;'],
  ['shop product images preserve their source colors', shopPolish, 'object-fit: contain;'],
  ['shop keeps neutral product surfaces on dark-mode devices', shopPolish, ':root { color-scheme: light; }'],
  ['shop hero photo has no dark overlay', shopPolish, '.hero-image::after { display: none; }'],
  ['shop loader cache version', shop, 'catalog-page-loader.js?v=20260921-catalog-sort1'],
  ['shop sort control', shop, 'id="sortOrder"'],
  ['unmatched OCR names follow known products when sorted', shopScript, "a.status==='IDENTITY_PENDING'"],
  ['shop image hash cache version', shopScript, 'asset.sha256.slice(0, 12)'],
  ['archive image hash cache version', renderer, 'image.sha256.slice(0, 12)'],
  ['detail image hash cache version', productDetail, 'image.sha256.slice(0, 12)'],
  ['extracted JT packs are not cropped', edgeCleanup, '.jp-sku-image-verified img[src*="-jt-2025.jpg"]'],
  ['extracted PDF packs retain their full frame', edgeCleanup, 'clip-path:none!important;transform:none!important'],
  ['detail pack can shrink within the gallery', edgeCleanup, '.jp-product-detail-image img{min-height:0!important;'],
  ['shop included in offline shell', serviceWorker, "'./shop.html'"],
  ['navigation bypasses stale HTTP cache', serviceWorker, "cache:freshPage?'no-store':'default'"],
  ['visible home navigation', luxuryHome, 'class="luxury-links"'],
  ['home navigation to shop', luxuryHome, 'href="./shop.html#catalog"'],
  ['home guide link to visible shop guide', luxuryHome, 'href="./shop.html#guide"'],
  ['mobile shop link to source archive', shop, 'href="./index.html#jp-sku-catalog">資料商品庫</a>'],
  ['canonical catalog loader', loader, "loadScript('./catalog-core.js"],
  ['canonical renderer', loader, "loadScript('./world-tobacco-catalog-render.js"],
  ['per-SKU image paths', renderer, 'product.images?.length'],
  ['multi-image gallery', catalogCss, /scroll-snap-type\s*:\s*x mandatory/],
  ['brand toolbar', renderer, 'aria-label="ブランドで絞り込む"'],
  ['catalog search', renderer, 'type="search"'],
  ['localized image load fallback', renderer, '画像を読み込めません'],
  ['localized missing image state', renderer, '画像未登録'],
  ['catalog distinguishes unverified reference price', renderer, "参考税込価格<b>${product.price_jpy == null ? '未確認'"],
  ['catalog labels OCR prices as candidates', renderer, "product.ocr_list_price_candidate_jpy != null ? '資料価格候補'"],
  ['detail uses source-specific price date', productDetail, 'product.historical_price_as_of'],
  ['detail uses neutral source-page label', productDetail, "metaRow('資料掲載ページ',"],
  ['detail offers manufacturer source when distinct', productDetail, 'product.manufacturer_source_url !== product.source_url'],
  ['detail localizes unknown brand', productDetail, "product.brand !== 'UNKNOWN' ? product.brand : 'ブランド確認中'"],
  ['localized identity state', renderer, "IDENTITY_PENDING: '資料転記・現行未確認'"],
  ['mobile two-column catalog', catalogCss, /grid-template-columns\s*:\s*repeat\(2\s*,\s*minmax\(0\s*,\s*1fr\)\)/],
  ['contained product images', catalogCss, /object-fit\s*:\s*contain/],
  ['dark side matte display crop', catalogCss, /clip-path\s*:\s*inset\(0 2\.5%\)/],
  ['registry-driven matte class', renderer, 'SIDE_MATTE_30PX'],
  ['horizontal brand filters', catalogCss, /overflow-x\s*:\s*auto/],
  ['mobile catalog bottom clearance', catalogCss, /padding\s*:\s*48px 12px 104px/],
  ['mobile dock', html, 'aria-label="モバイルナビゲーション"'],
  ['home dock guide targets a visible page', html, 'href="./shop.html#guide">ガイド</a>'],
  ['home dock remains visible on phones', luxuryCss, 'body:has(.luxury-home) .mobile-dock{display:flex!important'],
  ['shop guide hash scrolls after catalog render', shopScript, "if(location.hash==='#guide')requestAnimationFrame"],
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
assert.ok(!html.includes('独立 Work 版') && !shop.includes('Work 版'), 'the two pages must not describe themselves as separate sites');
assert.ok(luxuryCss.includes('body:has(.luxury-home)>header') && !luxuryCss.includes('body:has(.luxury-home) header,'), 'luxury styling must not hide its own header');
assert.ok(!loader.includes('pack.part01') && !loader.includes('user-sprite36'), 'runtime must not load broken Base64 assets');
assert.ok(!shopPolish.includes('prefers-color-scheme: dark'), 'device dark mode must not darken the catalog');
assert.ok(!/filter:\s*(?:saturate|brightness)/.test(luxuryCss), 'homepage media must not recolor the source image');
assert.ok(jtImporter.includes('"pdfimages", "-png"') && !jtImporter.includes('get_rawdata()'), 'JT CMYK images must use PDF-aware color decoding');
assert.ok(!imageCss.includes('home-sprite'), 'homepage must not use the screenshot sprite');
assert.ok(!html.includes('assets/catalog/image2.jpg'), 'rejected photo 1 must not render on the page');
assert.ok(!html.includes('assets/catalog/image5.jpg'), 'rejected Mevius photo must not render on the page');
assert.ok(!html.includes('contact@example.jp'), 'the public page must not expose a placeholder contact address');
assert.ok(html.includes('お問い合わせ窓口 準備中'), 'an unavailable contact channel must be represented truthfully');
assert.ok(!serviceWorker.includes('wt-1034-peace-10.jpg'), 'rejected photo 1 must not be cached');
assert.ok(!productDetail.includes('JT 定価（2025-10-01 時点）'), 'all catalog sources must not be attributed to JT');
assert.ok(!renderer.includes('data:image'), 'product cards must use per-SKU files');
assert.ok(manifest.icons.length > 0, 'PWA manifest needs an icon');

console.log(`MVP smoke: PASS (${requiredChecks.length + 16} assertions)`);
