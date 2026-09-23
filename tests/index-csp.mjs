import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const html = read('index.html');
const script = read('index-page.js');
const worker = read('service-worker.js');

const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1] || '';
assert.ok(csp, 'homepage must declare a CSP');
for (const directive of [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' http://127.0.0.1:8767",
  "connect-src 'self' http://127.0.0.1:8767 http://127.0.0.1:8769",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
]) {
  assert.ok(csp.includes(directive), `homepage CSP is missing ${directive}`);
}
assert.ok(!csp.includes("'unsafe-inline'") && !csp.includes("'unsafe-eval'"), 'homepage CSP must not allow inline or evaluated code');
assert.ok(html.includes('<script defer src="./index-page.js?v=20260922-csp1"></script>'), 'homepage must load its external behavior bundle');
assert.equal((html.match(/<script(?![^>]*\bsrc=)[^>]*>/gi) || []).length, 0, 'homepage must not contain inline scripts');
for (const behavior of ['kisaragi-age-verified', 'IntersectionObserver', "serviceWorker.register('./service-worker.js')"]) {
  assert.ok(script.includes(behavior), `external homepage bundle must preserve ${behavior}`);
}
assert.ok(worker.includes("'./index-page.js'"), 'external homepage bundle must be in the application shell');
assert.ok(worker.includes('|index-page|'), 'external homepage bundle must use the network-first runtime policy');

console.log('Homepage CSP: PASS (self-only scripts, no inline execution, external behavior bundle cached and network-first)');
