import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const html = read('shop.html');
const script = read('shop.js');

assert.ok(html.includes('href="./checkout.html"') && html.includes('配送見積り・申込プレビューへ'), 'the cart must expose the logistics preview route');
assert.ok(!html.includes('id="applicationModal"'), 'the obsolete duplicate application modal must be removed');
assert.ok(html.includes('ここでは決済・注文確定・配送依頼は行いません'), 'the no-transaction boundary must remain disclosed');
assert.ok(script.includes('event.preventDefault()'), 'the empty-cart guard must prevent navigation');
assert.ok(!script.includes('fetch(') && !script.includes('XMLHttpRequest') && !script.includes('navigator.sendBeacon'), 'the application demo must not transmit form data');
assert.ok(!script.includes('submitOrderAndPayment') && !script.includes('ekyc_stage_token_'), 'the shop must not expose fake order or eKYC success');

console.log('Shop demo boundary: PASS (logistics preview only; no order or network submission)');
