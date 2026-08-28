import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const root = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');
const html = read('index.html');
const js = read('app.js');
const css = read('styles.css');

for (const [name, source, expected] of [
  ['age gate', html, 'id="ageGate"'],
  ['catalog', html, 'id="productGrid"'],
  ['review form', html, 'id="reviewForm"'],
  ['cart persistence', js, "const CART_KEY = 'kisaragiDemoCart'"],
  ['inventory guard', js, '在庫数を超えて追加できません'],
  ['review safety copy', js, '本人確認・住所確認・許可条件を審査します。'],
  ['mobile safe-area', html, 'apple-mobile-web-app-capable'],
  ['keyboard focus', css, 'focus-visible'],
]) assert.ok(source.includes(expected), `${name} is missing`);

assert.ok(!html.includes('yinzuoshop.com') && !html.includes('world-tobacco.jp'), 'reference-site material leaked into MVP');
assert.ok(!js.includes('fetch('), 'MVP must not send customer or identity data');
console.log('MVP smoke: PASS (9 assertions)');
