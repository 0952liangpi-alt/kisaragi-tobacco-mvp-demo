import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const index = read('index.html');
const home = read('luxury-home.js');
const homeCss = read('luxury-home.css');
const shop = read('shop.html');
const shopScript = read('shop.js');
const shopCss = read('shop-polish.css');
const archive = read('world-tobacco-catalog-render.js');
const archiveCss = read('world-tobacco-catalog.css');
const checkout = read('checkout.html');
const checkoutScript = read('checkout.js');
const checkoutCss = read('checkout.css');
const trust = read('trust.html');
const worker = read('service-worker.js');

assert.ok(shopCss.includes('bottom: calc(92px + env(safe-area-inset-bottom, 0px))'), '1: mobile toast must clear the fixed dock');
assert.ok(shopCss.includes('background: #171717; color: #f1f1ee; color-scheme: dark'), '2: sort control must have explicit readable colors');
assert.ok(home.includes('日本のたばこを、') && home.includes('選ぶ前に確かめる。'), '3: the homepage must state its purpose literally');
assert.ok(home.includes('wt-1020-seven-stars.png') && home.includes('ua-mevius-lights-8.jpg'), '3: the homepage must show real product signals');
assert.ok(!shop.includes('id="openReview"') && !shop.includes('id="reviewModal"'), '4: duplicate selection review flow must be removed');
for (const [surface, source] of [['home static', index], ['shop', shop], ['home runtime', home]]) {
  assert.ok(source.includes('>選択リスト</a>') && source.includes('>利用案内</a>'), `4: ${surface} must use the shared customer terminology`);
  assert.ok(!source.includes('>資料庫</a>'), `4: ${surface} global navigation must not expose a second archive destination`);
}
assert.ok(shop.includes('data-mode-target="archive"') && shop.includes('出典を見る'), '4: archive/source review must remain available inside the product surface');
assert.ok(archive.includes('id="jp-sku-brand"') && archive.includes("brandSelect.addEventListener('change'"), '5: archive brand filtering must use a bounded select');
assert.ok(!archive.includes('class="jp-sku-brands"') && !archiveCss.includes('.jp-sku-brands'), '5: the 176-button brand rail must be retired');
assert.ok(checkoutCss.includes('grid-template-columns: repeat(4, minmax(0, 1fr))'), '6: mobile function rail must wrap without clipping');
assert.ok(checkoutScript.includes('enhanceOrderModules') && checkoutScript.includes('is-collapsed'), '6: long mobile order modules must be collapsible');
assert.ok(shop.includes('role="dialog" aria-modal="true" aria-labelledby="cartPanelTitle"'), '7: cart must expose dialog semantics');
assert.ok(shop.includes('aria-hidden="true" inert'), '7: the closed cart dialog must be removed from the focus order');
for (const contract of ['cartReturnFocus', 'document.body.style.overflow=\'hidden\'', "event.key==='Escape'", "event.key!=='Tab'", 'element.inert=true']) {
  assert.ok(shopScript.includes(contract), `7: cart dialog contract missing ${contract}`);
}
assert.ok(shopScript.includes('panel.inert=false') && shopScript.includes('panel.inert=true') && shopScript.includes("element.getAttribute('aria-disabled')!=='true'"), '7: cart opening, closing, and focus trapping must honor inert and disabled controls');
assert.ok(trust.includes('<h1>利用案内</h1>') && trust.includes('たばこ販売許可') && trust.includes('個人情報の取扱い') && trust.includes('配送・返品'), '8: trust center must cover operating and transaction disclosures');
assert.ok(trust.includes('オンライン注文は現在準備中です') && trust.includes('商品案内と選択リストはご利用いただけます'), '8: trust center must explain the inactive service boundary in customer language');
assert.ok(trust.indexOf('id="admin-entry"') > trust.indexOf('id="release-gate"'), '8: operator tools must follow customer disclosures instead of interrupting them');
assert.ok(worker.includes("'./trust.html'") && worker.includes("'./trust.css'"), '8: trust center must be part of the offline shell');
assert.ok(shopCss.includes('.product-grid, .product-grid.is-single { grid-template-columns: 1fr; }'), '9: mobile shop cards must be single-column');
assert.ok(shopCss.includes('grid-template-columns: repeat(3, minmax(0, 1fr))') && shopCss.includes('grid-template-columns: minmax(96px, 30%) minmax(0, 1fr)'), '9: narrow mobile filters and compact product cards must remain scannable');
assert.ok(shopScript.includes("startApplication.setAttribute('aria-disabled','true')") && shopScript.includes("startApplication.setAttribute('tabindex','-1')"), '9: an empty selection must expose a genuinely disabled continuation link');
assert.ok(shopScript.includes('aria-label="${escapeHtml(name)}を選択リストに追加"') && shopScript.includes('aria-label="${escapeHtml(name)}を選択リストから削除"'), '9: repeated product actions must have product-specific accessible names');
assert.ok(read('kisaragi-components.css').includes('grid-template-columns: minmax(0, 1fr)') && read('unified-site-shell.css').includes('body.has-open-modal .unified-mobile-dock'), '9: narrow carts must preserve title width and modal dialogs must suppress the mobile dock');
assert.ok(archiveCss.includes('.jp-sku-grid { grid-template-columns:1fr;'), '9: mobile archive cards must be single-column');
assert.ok(homeCss.includes('min-height:clamp(620px,calc(100dvh - 96px),820px)'), '10: desktop hero must leave the next section visible');
assert.ok(homeCss.includes('min-height:max(520px,calc(100dvh - 126px))'), '10: mobile hero must leave a continuation cue');

console.log('UI/UX cross-surface: PASS (10 audited issues guarded)');
