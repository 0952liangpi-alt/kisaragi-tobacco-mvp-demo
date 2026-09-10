import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const html = read('shop.html');
const script = read('shop.js');

assert.ok(html.includes('id="applicationModal"'), 'the application preview modal must remain available');
assert.ok(html.includes('id="applicationForm"') && !html.includes('id="applicationForm" action='), 'the application form must not submit to a server');
assert.ok(html.includes('テスト値だけを使用してください') && html.includes('autocomplete="off"'), 'the demo must warn against real personal data and disable form autofill');
assert.ok(html.includes('カード番号・本人確認書類は入力、保存、送信されません'), 'the no-payment/no-identity-document boundary must be disclosed');
assert.ok(html.includes('注文確定・決済・配送依頼も開始されません'), 'the no-transaction boundary must be disclosed');
assert.ok(html.includes('class="order-steps"') && html.includes('配送方法') && html.includes('支払い方法'), 'the checkout preview must visibly connect order, delivery, and payment stages');
assert.ok(html.includes('外部決済画面へは遷移しません') && html.includes('配送依頼は作成しません'), 'checkout presentation must remain explicitly frontend-only');
assert.ok(script.includes('event.preventDefault()'), 'the preview handler must prevent browser form submission');
assert.ok(script.includes("scrollTop=0"), 'opening the preview must reset its internal scroll position');
assert.ok(script.includes('保存・送信されません'), 'the preview confirmation must disclose no persistence or transmission');
assert.ok(!script.includes('fetch(') && !script.includes('XMLHttpRequest') && !script.includes('navigator.sendBeacon'), 'the application demo must not transmit form data');
assert.ok(!html.includes('checkout.html'), 'the shop must not link to a live checkout route');

console.log('Shop demo boundary: PASS (preview only; no checkout or network submission)');
