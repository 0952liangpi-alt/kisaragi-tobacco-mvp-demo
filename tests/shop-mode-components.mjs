import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const html = read('shop.html');
const script = read('shop.js');
const css = read('kisaragi-components.css');

assert.ok(html.includes('data-kisaragi-mode="shop"'), 'shop mode must be explicit on first render');
assert.equal((html.match(/data-mode-target="shop"/g) || []).length, 2, 'desktop and mobile shop controls are required');
assert.equal((html.match(/data-mode-target="archive"/g) || []).length, 2, 'desktop and mobile archive controls are required');
assert.ok(html.includes('aria-labelledby="citationTitle"'), 'citation dialog must have an accessible name');
assert.ok(css.includes('env(safe-area-inset-bottom, 0px)'), 'mobile dock must respect the iPhone safe area');
assert.ok(script.includes('textContent'), 'citation fields must be written as text, not untrusted HTML');
assert.ok(!script.includes('ekyc_stage_token_'), 'the public catalog must not claim staged eKYC success');
assert.ok(!script.includes('submitOrderAndPayment'), 'the public catalog must not expose a fake payment API');
assert.ok(!html.includes('href="./checkout.html"'), 'the public catalog must not link to a live checkout route');

console.log('Shop mode components: PASS');
