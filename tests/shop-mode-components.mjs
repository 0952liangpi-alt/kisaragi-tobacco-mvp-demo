import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const html = read('shop.html');
const script = read('shop.js');
const css = read('kisaragi-components.css');
const publicTheme = read('kisaragi-public-theme.css');

assert.ok(html.includes('data-kisaragi-mode="shop"'), 'shop mode must be explicit on first render');
assert.equal((html.match(/data-mode-target="shop"/g) || []).length, 1, 'the desktop shop control is required');
assert.equal((html.match(/data-mode-target="archive"/g) || []).length, 1, 'the desktop archive control is required');
assert.ok(html.includes('aria-labelledby="citationTitle"'), 'citation dialog must have an accessible name');
assert.ok(css.includes('env(safe-area-inset-bottom, 0px)'), 'mobile dock must respect the iPhone safe area');
assert.ok(script.includes('textContent'), 'citation fields must be written as text, not untrusted HTML');
assert.ok(!script.includes('ekyc_stage_token_'), 'the public catalog must not claim staged eKYC success');
assert.ok(!script.includes('submitOrderAndPayment'), 'the public catalog must not expose a fake payment API');
assert.ok(html.includes('href="./checkout.html"'), 'the public catalog must link to the bounded logistics preview');
assert.ok(html.includes('kisaragi-public-theme.css'), 'the catalog must load the shared public theme');
assert.ok(publicTheme.includes('.site-header .mode-switch-group') && publicTheme.includes('display: none !important'), 'the duplicate desktop mode controls must be hidden on mobile');
assert.ok(!html.includes('commerceStatusGrid'), 'the internal commerce status board must not render publicly');

console.log('Shop mode components: PASS');
