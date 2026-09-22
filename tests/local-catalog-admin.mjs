import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = await mkdtemp(join(tmpdir(), 'kisaragi-admin-test-'));
const password = 'test-only-password-not-for-production';
const serverSource = await readFile(join(root, 'scripts', 'local-catalog-admin-server.mjs'), 'utf8');
assert.match(serverSource, /const host = '127\.0\.0\.1';/, 'the admin server must remain bound to loopback');
assert.match(serverSource, /const SESSION_TTL_MS = 60 \* 60 \* 1000;/, 'the server session lifetime must be exactly one hour');
assert.match(serverSource, /Date\.now\(\) >= session\.expiresAt/, 'authorization must enforce the session lifetime server-side');
const probe = net.createServer();
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const publicOrigin = 'http://127.0.0.1:8766';
const process = spawn('node', [join(root, 'scripts', 'local-catalog-admin-server.mjs')], {
  cwd: root,
  env: {...globalThis.process.env, KISARAGI_ADMIN_PORT: String(port), KISARAGI_ADMIN_PASSWORD: password, KISARAGI_DATA_DIR: dataDir},
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
process.stdout.on('data', (chunk) => { output += chunk.toString(); });
process.stderr.on('data', (chunk) => { output += chunk.toString(); });
try {
  const deadline = Date.now() + 30000;
  while (!output.includes('KISARAGI admin:')) {
    if (process.exitCode !== null || Date.now() > deadline) throw new Error(`Admin server failed: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const adminPage = await fetch(`${origin}/admin/`);
  assert.equal(adminPage.status, 200);
  const adminHtml = await adminPage.text();
  assert.ok(adminHtml.includes('id="connectionPanel"') && adminHtml.includes('id="loginForm"') && adminHtml.includes('hidden'));
  assert.equal((await fetch(`${origin}/admin/admin.js`)).status, 200);
  assert.equal((await fetch(`${origin}/admin/admin.css`)).status, 200);
  const preflight = await fetch(`${origin}/admin/api/login`, {
    method: 'OPTIONS', headers: {Origin: publicOrigin, 'Access-Control-Request-Method': 'POST'},
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), publicOrigin);
  assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  const capabilities = await fetch(`${origin}/admin/api/capabilities`, {headers: {Origin: publicOrigin}});
  assert.equal(capabilities.status, 200);
  assert.equal(capabilities.headers.get('access-control-allow-origin'), publicOrigin);
  const capabilityPayload = await capabilities.json();
  assert.equal(capabilityPayload.service, 'KISARAGI_CATALOG_ADMIN');
  assert.deepEqual(capabilityPayload.capabilities, ['catalog.read', 'product.update', 'image.upload']);
  const publicResponse = await fetch(`${origin}/api/catalog-overrides`, {
    headers: {Origin: publicOrigin},
  });
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.headers.get('access-control-allow-origin'), publicOrigin);
  assert.equal((await publicResponse.json()).revision, 0);
  const foreign = await fetch(`${origin}/api/catalog-overrides`, {headers: {Origin: 'https://untrusted.example'}});
  assert.equal(foreign.status, 403);
  const unauthenticated = await fetch(`${origin}/admin/api/products/C088`, {
    method: 'PUT', headers: {Origin: publicOrigin, 'X-Kisaragi-Admin': '1', 'Content-Type': 'application/json'},
    body: JSON.stringify({price_jpy: 500}),
  });
  assert.equal(unauthenticated.status, 401);
  const maliciousLogin = await fetch(`${origin}/admin/api/login`, {
    method: 'POST',
    headers: {Origin: 'https://untrusted.example', 'X-Kisaragi-Admin': '1', 'Content-Type': 'application/json'},
    body: JSON.stringify({password}),
  });
  assert.equal(maliciousLogin.status, 403, 'a foreign origin must not be able to start an admin session');
  const badLogin = await fetch(`${origin}/admin/api/login`, {
    method: 'POST',
    headers: {Origin: publicOrigin, 'X-Kisaragi-Admin': '1', 'Content-Type': 'application/json'},
    body: JSON.stringify({password: 'wrong-password'}),
  });
  assert.equal(badLogin.status, 401);
  const login = await fetch(`${origin}/admin/api/login`, {
    method: 'POST',
    headers: {Origin: publicOrigin, 'X-Kisaragi-Admin': '1', 'Content-Type': 'application/json'},
    body: JSON.stringify({password}),
  });
  assert.equal(login.status, 200);
  assert.equal(login.headers.get('access-control-allow-origin'), publicOrigin);
  assert.equal(login.headers.get('access-control-allow-credentials'), 'true');
  const loginCookie = login.headers.get('set-cookie');
  assert.match(loginCookie, /^kisaragi_admin=[a-f0-9]{64};/);
  assert.match(loginCookie, /; HttpOnly(?:;|$)/i);
  assert.match(loginCookie, /; SameSite=Strict(?:;|$)/i);
  assert.match(loginCookie, /; Path=\/admin(?:;|$)/i);
  assert.match(loginCookie, /; Max-Age=3600(?:;|$)/i);
  const originalCookie = loginCookie.split(';')[0];
  const rotatedLogin = await fetch(`${origin}/admin/api/login`, {
    method: 'POST',
    headers: {Origin: publicOrigin, 'X-Kisaragi-Admin': '1', 'Content-Type': 'application/json'},
    body: JSON.stringify({password}),
  });
  assert.equal(rotatedLogin.status, 200);
  const rotatedCookie = rotatedLogin.headers.get('set-cookie').split(';')[0];
  assert.notEqual(rotatedCookie, originalCookie, 'every successful login must rotate the session token');
  const supersededSession = await fetch(`${origin}/admin/api/products?q=C088`, {
    headers: {Origin: publicOrigin, 'X-Kisaragi-Admin': '1', Cookie: originalCookie},
  });
  assert.equal(supersededSession.status, 401, 'the previous token must stop working after login rotation');
  const cookie = rotatedCookie;
  const auth = {Origin: publicOrigin, 'X-Kisaragi-Admin': '1', Cookie: cookie};
  const maliciousLogout = await fetch(`${origin}/admin/api/logout`, {
    method: 'POST',
    headers: {...auth, Origin: 'https://untrusted.example'},
  });
  assert.equal(maliciousLogout.status, 403, 'a foreign origin must not be able to end the local admin session');
  const list = await fetch(`${origin}/admin/api/products?q=C088`, {headers: auth});
  assert.equal(list.status, 200);
  const items = await list.json();
  assert.equal(items.products.length, 1);
  const sku = items.products[0].id;
  const change = await fetch(`${origin}/admin/api/products/${sku}`, {
    method: 'PUT',
    headers: {...auth, 'Content-Type': 'application/json', 'If-Match': '0'},
    body: JSON.stringify({product_name_ja: '検証用商品', price_jpy: 580}),
  });
  assert.equal(change.status, 200);
  const stored = JSON.parse(await readFile(join(dataDir, 'catalog-overrides.json'), 'utf8'));
  assert.equal(stored.products[sku].price_jpy, 580);
  const stale = await fetch(`${origin}/admin/api/products/${sku}`, {
    method: 'PUT',
    headers: {...auth, 'Content-Type': 'application/json', 'If-Match': '0'},
    body: JSON.stringify({price_jpy: 600}),
  });
  assert.equal(stale.status, 409);
  const publicAfter = await (await fetch(`${origin}/api/catalog-overrides`)).json();
  assert.equal(publicAfter.products[sku].price_jpy, 580);
  assert.equal(publicAfter.products[sku].product_name_ja, '検証用商品');
  const fixture = join(dataDir, 'image-fixture.png');
  await execFileAsync('/usr/bin/sips', [
    '-s', 'format', 'png', '-Z', '160',
    join(root, 'assets/catalog/products/ua-terea-riviera-pearl.jpg'), '--out', fixture,
  ]);
  const bytes = await readFile(fixture);
  const imageSku = 'ua-terea-riviera-pearl';
  const upload = await fetch(`${origin}/admin/api/products/${imageSku}/image`, {
    method: 'PUT',
    headers: {...auth, 'Content-Type': 'image/png', 'If-Match': '1'},
    body: bytes,
  });
  assert.equal(upload.status, 200);
  const uploaded = await upload.json();
  assert.equal(uploaded.image.width > 0, true);
  assert.equal((await fetch(uploaded.image.url)).status, 200);
  const duplicate = await fetch(`${origin}/admin/api/products/${sku}/image`, {
    method: 'PUT',
    headers: {...auth, 'Content-Type': 'image/png', 'If-Match': '2'},
    body: bytes,
  });
  assert.equal(duplicate.status, 409);
  const badSignature = await fetch(`${origin}/admin/api/products/${sku}/image`, {
    method: 'PUT',
    headers: {...auth, 'Content-Type': 'image/png', 'If-Match': '2'},
    body: Buffer.from('not an image'),
  });
  assert.equal(badSignature.status, 422);
  const logout = await fetch(`${origin}/admin/api/logout`, {method: 'POST', headers: auth});
  assert.equal(logout.status, 200);
  const clearedCookie = logout.headers.get('set-cookie');
  assert.match(clearedCookie, /^kisaragi_admin=;/);
  assert.match(clearedCookie, /; HttpOnly(?:;|$)/i);
  assert.match(clearedCookie, /; SameSite=Strict(?:;|$)/i);
  assert.match(clearedCookie, /; Path=\/admin(?:;|$)/i);
  assert.match(clearedCookie, /; Max-Age=0(?:;|$)/i);
  const rejectedAfterLogout = await fetch(`${origin}/admin/api/products?q=C088`, {headers: auth});
  assert.equal(rejectedAfterLogout.status, 401, 'logout must invalidate the token server-side');
  const sessionAfterLogout = await fetch(`${origin}/admin/api/session`, {headers: auth});
  assert.equal(sessionAfterLogout.status, 200);
  assert.equal((await sessionAfterLogout.json()).authenticated, false);
  console.log(`Local admin: PASS (one-hour rotating session, logout, origin guard, protected writes, optimistic concurrency, name/price, image, dedup; ${dataDir})`);
} finally {
  process.kill('SIGTERM');
}
