import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const root = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');
const html = read('index.html');
const js = read('app.js');
const css = read('styles.css');

const requiredChecks = [
  ['age gate', html, 'id="ageGate"'],
  ['catalog', html, 'id="productGrid"'],
  ['review form', html, 'id="reviewForm"'],
  ['cart persistence', js, "const CART_KEY = 'kisaragiDemoCart'"],
  ['inventory guard', js, '在庫数を超えて追加できません'],
  ['review safety copy', js, '本人確認・住所確認・許可条件を審査します。'],
  ['mobile safe-area', html, 'apple-mobile-web-app-capable'],
  ['keyboard focus', css, 'focus-visible'],
  ['age background isolation', js, "element.setAttribute('inert', '')"],
  ['tax-inclusive price format', js, "toLocaleString('ja-JP')}（税込）"],
  ['legal modal controls', html, 'data-legal="tokusho"'],
  ['underage legal notice', html, '未成年者の喫煙は法律で禁じられています'],
  ['low-stock selector', html, 'value="low_stock"'],
  ['drawer above mobile navigation', css, 'aside[aria-label="カート"]{position:fixed;right:0;bottom:0;z-index:9999}'],
  ['mobile 3d reduction', css, 'transform:none!important'],
  ['subtle noise texture', css, "feTurbulence"],
  ['five-dimensional taste profile', js, "sweetness:'甘さ',menthol:'清涼感'"],
  ['low-stock state', js, "label:'残りわずか'"],
  ['stable review vote identity', js, 'data-helpful="${product.id}:${review.id}"'],
  ['generic modal focus isolation', js, 'releaseActiveModalFocus'],
];

for (const [name, source, expected] of requiredChecks) assert.ok(source.includes(expected), `${name} is missing`);

assert.ok(!html.includes('yinzuoshop.com') && !html.includes('world-tobacco.jp'), 'reference-site material leaked into MVP');
assert.ok(!js.includes('fetch('), 'MVP must not send customer or identity data');
console.log(`MVP smoke: PASS (${requiredChecks.length + 2} assertions)`);
