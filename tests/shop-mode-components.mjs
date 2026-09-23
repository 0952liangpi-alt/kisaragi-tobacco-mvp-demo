import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const html = read('shop.html');
const script = read('shop.js');
const css = read('kisaragi-components.css');
const publicTheme = read('kisaragi-public-theme.css');

assert.ok(html.includes('data-kisaragi-mode="shop"'), 'shop mode must be explicit on first render');
assert.equal((html.match(/data-mode-target="shop"/g) || []).length, 2, 'desktop and mobile shop controls are required');
assert.equal((html.match(/data-mode-target="archive"/g) || []).length, 2, 'desktop and mobile archive controls are required');
assert.ok(html.includes('class="mobile-mode-bar"'), 'the mobile mode switch must remain available when the header switch is hidden');
assert.ok(script.includes("restore();setMode('shop')"), 'every fresh catalog navigation must default to Shop mode');
assert.ok(!script.includes('kisaragi-catalog-mode-v1'), 'Archive mode must not persist across navigations');
assert.ok(html.includes('aria-labelledby="citationTitle"'), 'citation dialog must have an accessible name');
assert.ok(css.includes('env(safe-area-inset-bottom, 0px)'), 'mobile dock must respect the iPhone safe area');
assert.ok(script.includes('textContent'), 'citation fields must be written as text, not untrusted HTML');
assert.ok(script.includes("citationRow('利用状態',usageStatus(item))"), 'citation dialog must show the recorded usage status');
assert.ok(script.includes("citationRow('ライセンス・許諾根拠',licenseStatus(item,source))"), 'citation dialog must show the recorded license basis');
assert.ok(script.includes("sourceRegistry.find((entry)=>entry.id===item.image_source)"), 'image-source permission data must take priority over a generic catalog URL');
assert.ok(script.includes("return '未登録';") && script.includes("?'未登録':String(value)"), 'missing usage and license data must stay explicitly unregistered');
assert.match(script, /function add\(item\)\{\s*if\(state\.mode==='archive'\)\{\s*toast\('アーカイブ制限/, 'the add business function must block Archive mode before any cart mutation');
assert.ok(!script.includes('ekyc_stage_token_'), 'the public catalog must not claim staged eKYC success');
assert.ok(!script.includes('submitOrderAndPayment'), 'the public catalog must not expose a fake payment API');
assert.ok(html.includes('href="./checkout.html"'), 'the public catalog must link to the bounded logistics preview');
assert.ok(html.includes('kisaragi-public-theme.css'), 'the catalog must load the shared public theme');
assert.ok(publicTheme.includes('.site-header .mode-switch-group') && publicTheme.includes('display: none !important'), 'the duplicate desktop mode controls must be hidden on mobile');
assert.ok(css.includes('.mobile-mode-bar') && css.includes('.unified-mobile-dock button'), 'mobile mode and cart controls must have dedicated responsive styles');
assert.ok(html.includes('id="mobileOpenCart"') && html.includes('id="mobileCartCount"'), 'the mobile dock must expose a cart control and live count');
const mobileDock = html.match(/<nav class="unified-mobile-dock"[\s\S]*?<\/nav>/)?.[0] || '';
assert.equal((mobileDock.match(/<(?:a|button)\b/g) || []).length, 5, 'the mobile dock must keep exactly five stable navigation items');
assert.ok(!html.includes('commerceStatusGrid'), 'the internal commerce status board must not render publicly');

console.log('Shop mode components: PASS');
