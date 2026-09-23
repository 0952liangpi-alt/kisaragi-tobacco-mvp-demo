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
assert.ok(index.includes('>資料庫</a>') && shop.includes('>資料庫</a>') && home.includes('>資料庫</a>'), '4: archive terminology must be consistent');
assert.ok(archive.includes('id="jp-sku-brand"') && archive.includes("brandSelect.addEventListener('change'"), '5: archive brand filtering must use a bounded select');
assert.ok(!archive.includes('class="jp-sku-brands"') && !archiveCss.includes('.jp-sku-brands'), '5: the 176-button brand rail must be retired');
assert.ok(checkoutCss.includes('grid-template-columns: repeat(4, minmax(0, 1fr))'), '6: mobile function rail must wrap without clipping');
assert.ok(checkoutScript.includes('enhanceOrderModules') && checkoutScript.includes('is-collapsed'), '6: long mobile order modules must be collapsible');
assert.ok(shop.includes('role="dialog" aria-modal="true" aria-labelledby="cartPanelTitle"'), '7: cart must expose dialog semantics');
for (const contract of ['cartReturnFocus', 'document.body.style.overflow=\'hidden\'', "event.key==='Escape'", "event.key!=='Tab'", 'element.inert=true']) {
  assert.ok(shopScript.includes(contract), `7: cart dialog contract missing ${contract}`);
}
assert.ok(trust.includes('運営・取引情報') && trust.includes('たばこ販売許可') && trust.includes('個人情報の取扱い') && trust.includes('配送・返品'), '8: trust center must cover operating and transaction disclosures');
assert.ok(trust.includes('内部取引コアは構築済み、公開販売は未開始です') && trust.includes('本番受入が完了するまで、会員・注文・決済は停止します'), '8: trust center must distinguish built internals from the inactive public service boundary');
assert.ok(worker.includes("'./trust.html'") && worker.includes("'./trust.css'"), '8: trust center must be part of the offline shell');
assert.ok(shopCss.includes('.product-grid, .product-grid.is-single { grid-template-columns: 1fr; }'), '9: mobile shop cards must be single-column');
assert.ok(archiveCss.includes('.jp-sku-grid { grid-template-columns:1fr;'), '9: mobile archive cards must be single-column');
assert.ok(homeCss.includes('min-height:clamp(620px,calc(100dvh - 96px),820px)'), '10: desktop hero must leave the next section visible');
assert.ok(homeCss.includes('min-height:max(520px,calc(100dvh - 126px))'), '10: mobile hero must leave a continuation cue');

console.log('UI/UX cross-surface: PASS (10 audited issues guarded)');
