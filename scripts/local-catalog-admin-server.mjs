import {createServer} from 'node:http';
import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {readFile, mkdir, rename, stat, writeFile, unlink} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {homedir} from 'node:os';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createContext, runInContext} from 'node:vm';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.KISARAGI_DATA_DIR || join(homedir(), 'Library', 'Application Support', 'KisaragiCatalog');
const host = '127.0.0.1';
const port = Number(process.env.KISARAGI_ADMIN_PORT || 8767);
const origin = `http://${host}:${port}`;
const password = process.env.KISARAGI_ADMIN_PASSWORD || randomBytes(24).toString('base64url');
const SESSION_TTL_MS = 60 * 60 * 1000;
const SESSION_COOKIE = 'kisaragi_admin';
let session = null;
const catalogFiles = [
  'world-tobacco-japan.js', 'jt-catalog-2025.js', 'tsn-imported-catalog-2026.js',
  'tsn-goods-catalog-2026.js', 'catalog-core.js',
];
const context = createContext({});
for (const filename of catalogFiles) {
  runInContext(await readFile(join(root, filename), 'utf8'), context, {filename});
}
const productMap = new Map(context.KISARAGI_CANONICAL_CATALOG.map((product) => [product.id, {
  id: product.id,
  code: product.product_code || product.sku,
  name: product.product_name_ja,
  category: product.category,
  price_jpy: product.price_jpy,
  image_url: product.image?.file_path ? `http://127.0.0.1:8766/${product.image.file_path}` : null,
}]));
const registeredHashes = new Map();
for (const asset of context.KISARAGI_ASSET_REGISTRY || []) {
  if (!asset.file_path?.startsWith('assets/catalog/products/')) continue;
  const sha256 = asset.sha256 || createHash('sha256').update(await readFile(join(root, asset.file_path))).digest('hex');
  if (!registeredHashes.has(sha256)) registeredHashes.set(sha256, asset.sku);
}
const dbFile = join(dataDir, 'catalog-overrides.json');
let db = {version: 1, revision: 0, products: {}};
try {
  const stored = JSON.parse(await readFile(dbFile, 'utf8'));
  if (stored.version !== 1 || !stored.products || typeof stored.products !== 'object') throw new Error('Invalid override database');
  db = stored;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const json = (res, status, value, headers = {}) => respond(res, status, JSON.stringify(value), {
  'Content-Type': 'application/json; charset=utf-8', ...headers,
});
function respond(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...headers,
  });
  res.end(body);
}
function authorized(req) {
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const value = cookie?.slice(SESSION_COOKIE.length + 1) || '';
  if (!session || Date.now() >= session.expiresAt) {
    session = null;
    return false;
  }
  const left = Buffer.from(value);
  const right = Buffer.from(session.token);
  return left.length === right.length && timingSafeEqual(left, right);
}
function issueSession() {
  const token = randomBytes(32).toString('hex');
  session = {token, expiresAt: Date.now() + SESSION_TTL_MS};
  return token;
}
function sessionCookie(token, maxAge) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=${maxAge}`;
}
function allowedAdminOrigin(value) {
  return value === origin || value === 'http://127.0.0.1:8766';
}
function sameOrigin(req) {
  return allowedAdminOrigin(req.headers.origin) && req.headers['x-kisaragi-admin'] === '1';
}
function allowedPublicOrigin(value) {
  return value === 'http://127.0.0.1:8766' || value === 'http://localhost:8766' ||
    value === 'https://0952liangpi-alt.github.io';
}
async function body(req, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('Payload too large'), {status: 413});
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function contentType(req) {
  return (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
}
function validName(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 160 && !/[\u0000-\u001f]/.test(value);
}
function revisionMatches(req) {
  return req.headers['if-match'] === String(db.revision);
}
async function save(next) {
  await mkdir(dataDir, {recursive: true, mode: 0o700});
  const temp = `${dbFile}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(temp, JSON.stringify(next, null, 2), {mode: 0o600});
  await rename(temp, dbFile);
  db = next;
}
let mutation = Promise.resolve();
function serialize(action) {
  const next = mutation.then(action);
  mutation = next.catch(() => {});
  return next;
}
async function imageDimensions(path) {
  const {stdout} = await execFileAsync('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path]);
  const width = Number(stdout.match(/pixelWidth: (\d+)/)?.[1]);
  const height = Number(stdout.match(/pixelHeight: (\d+)/)?.[1]);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 100 || height < 100) {
    throw Object.assign(new Error('Image dimensions are too small'), {status: 422});
  }
  const decoded = `${path}.decoded.png`;
  try { await execFileAsync('/usr/bin/sips', ['-s', 'format', 'png', path, '--out', decoded]); }
  catch { throw Object.assign(new Error('Image decode failed'), {status: 422}); }
  finally { await unlink(decoded).catch(() => {}); }
  return {width, height};
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    const requestOrigin = req.headers.origin;
    if (url.pathname.startsWith('/admin/api/')) {
      if (requestOrigin && !allowedAdminOrigin(requestOrigin)) return json(res, 403, {error: 'Forbidden'});
      if (requestOrigin) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        return respond(res, 204, '', {
          'Access-Control-Allow-Methods': 'GET, POST, PUT',
          'Access-Control-Allow-Headers': 'Content-Type, If-Match, X-Kisaragi-Admin',
          'Access-Control-Max-Age': '600',
        });
      }
    }
    if (req.method === 'OPTIONS' && url.pathname === '/api/catalog-overrides') {
      if (!allowedPublicOrigin(requestOrigin)) return respond(res, 403, 'Forbidden');
      return respond(res, 204, '', {
        'Access-Control-Allow-Origin': requestOrigin,
        'Access-Control-Allow-Methods': 'GET',
        Vary: 'Origin',
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/catalog-overrides') {
      if (requestOrigin && !allowedPublicOrigin(requestOrigin)) return json(res, 403, {error: 'Forbidden'});
      return json(res, 200, db, requestOrigin ? {
        'Access-Control-Allow-Origin': requestOrigin,
        Vary: 'Origin',
      } : {});
    }
    const media = url.pathname.match(/^\/media\/([A-Za-z0-9-]+)\/([a-f0-9]{64})\.(jpg|png)$/);
    if (req.method === 'GET' && media) {
      const filename = `${media[2]}.${media[3]}`;
      const path = join(dataDir, 'images', media[1], filename);
      try {
        const info = await stat(path);
        if (!info.isFile()) throw new Error('Not a file');
        return respond(res, 200, await readFile(path), {
          'Content-Type': media[3] === 'png' ? 'image/png' : 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
        });
      } catch { return json(res, 404, {error: 'Image not found'}); }
    }
    if (req.method === 'GET' && ['/admin', '/admin/'].includes(url.pathname)) {
      return respond(res, 200, await readFile(join(root, 'admin', 'index.html')), {'Content-Type': 'text/html; charset=utf-8'});
    }
    if (req.method === 'GET' && url.pathname === '/favicon.ico') return respond(res, 204, '');
    if (req.method === 'GET' && url.pathname === '/assets/tougu-mark.svg') {
      return respond(res, 200, await readFile(join(root, 'assets', 'tougu-mark.svg')), {'Content-Type': 'image/svg+xml'});
    }
    if (req.method === 'GET' && url.pathname === '/catalog-live-config.js') {
      return respond(res, 200, await readFile(join(root, 'catalog-live-config.js')), {'Content-Type': 'text/javascript; charset=utf-8'});
    }
    if (req.method === 'GET' && ['/admin/admin.js', '/admin/admin.css'].includes(url.pathname)) {
      const filename = url.pathname.slice('/admin/'.length);
      return respond(res, 200, await readFile(join(root, 'admin', filename)), {
        'Content-Type': filename.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8',
      });
    }
    if (req.method === 'GET' && url.pathname === '/admin/api/capabilities') {
      return json(res, 200, {
        service: 'KISARAGI_CATALOG_ADMIN',
        status: 'ready',
        capabilities: ['catalog.read', 'product.update', 'image.upload'],
      });
    }
    if (req.method === 'POST' && url.pathname === '/admin/api/login') {
      if (!sameOrigin(req) || contentType(req) !== 'application/json') return json(res, 403, {error: 'Forbidden'});
      const input = JSON.parse((await body(req, 2048)).toString('utf8'));
      const left = createHash('sha256').update(String(input.password || '')).digest();
      const right = createHash('sha256').update(password).digest();
      if (!timingSafeEqual(left, right)) return json(res, 401, {error: 'Incorrect password'});
      const token = issueSession();
      return json(res, 200, {ok: true}, {
        'Set-Cookie': sessionCookie(token, 3600),
      });
    }
    if (req.method === 'POST' && url.pathname === '/admin/api/logout') {
      if (!sameOrigin(req)) return json(res, 403, {error: 'Forbidden'});
      session = null;
      return json(res, 200, {ok: true}, {
        'Set-Cookie': sessionCookie('', 0),
      });
    }
    if (req.method === 'GET' && url.pathname === '/admin/api/session') {
      return json(res, 200, {authenticated: authorized(req)});
    }
    if (!url.pathname.startsWith('/admin/api/')) return json(res, 404, {error: 'Not found'});
    if (!authorized(req)) return json(res, 401, {error: 'Login required'});
    if (req.method === 'GET' && url.pathname === '/admin/api/products') {
      const query = (url.searchParams.get('q') || '').toLocaleLowerCase('ja').trim();
      const products = [...productMap.values()].filter((product) => {
        const text = `${product.id} ${product.code} ${product.name} ${product.category}`.toLocaleLowerCase('ja');
        return !query || text.includes(query);
      }).slice(0, 80).map((product) => ({...product, ...db.products[product.id]}));
      return json(res, 200, {revision: db.revision, products});
    }
    const match = url.pathname.match(/^\/admin\/api\/products\/([A-Za-z0-9-]+)(\/image)?$/);
    if (!match || !productMap.has(match[1])) return json(res, 404, {error: 'Unknown SKU'});
    if (!['PUT'].includes(req.method) || !sameOrigin(req)) return json(res, 403, {error: 'Forbidden'});
    const sku = match[1];
    if (!match[2]) {
      if (contentType(req) !== 'application/json') return json(res, 415, {error: 'JSON required'});
      const input = JSON.parse((await body(req, 4096)).toString('utf8'));
      if (!Object.keys(input).length || Object.keys(input).some((key) => !['product_name_ja', 'price_jpy'].includes(key))) {
        return json(res, 422, {error: 'Only name and price can be edited'});
      }
      if ('product_name_ja' in input && !validName(input.product_name_ja)) return json(res, 422, {error: 'Invalid name'});
      if ('price_jpy' in input && input.price_jpy !== null && (!Number.isInteger(input.price_jpy) || input.price_jpy < 0 || input.price_jpy > 10000000)) {
        return json(res, 422, {error: 'Invalid price'});
      }
      return await serialize(async () => {
        if (!revisionMatches(req)) return json(res, 409, {error: 'Catalog changed; reload before editing'});
        const next = {version: 1, revision: db.revision + 1, products: {
          ...db.products, [sku]: {...db.products[sku], ...input},
        }};
        await save(next);
        return json(res, 200, {revision: db.revision, product: next.products[sku]});
      });
    }
    const mime = contentType(req);
    if (!['image/jpeg', 'image/png'].includes(mime)) return json(res, 415, {error: 'JPEG or PNG required'});
    const buffer = await body(req, 8 * 1024 * 1024);
    const jpg = mime === 'image/jpeg' && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    const png = mime === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!jpg && !png) return json(res, 422, {error: 'File signature does not match MIME'});
    return await serialize(async () => {
      if (!revisionMatches(req)) return json(res, 409, {error: 'Catalog changed; reload before editing'});
      const sha256 = createHash('sha256').update(buffer).digest('hex');
      const registeredSku = registeredHashes.get(sha256) || Object.entries(db.products)
        .find(([, value]) => value.image?.sha256 === sha256)?.[0];
      if (registeredSku && registeredSku !== sku) return json(res, 409, {error: 'Image already belongs to another SKU'});
      const extension = jpg ? 'jpg' : 'png';
      const imageDir = join(dataDir, 'images', sku);
      await mkdir(imageDir, {recursive: true, mode: 0o700});
      const path = join(imageDir, `${sha256}.${extension}`);
      const temp = `${path}.${randomBytes(6).toString('hex')}.tmp`;
      await writeFile(temp, buffer, {mode: 0o600});
      let dimensions;
      try { dimensions = await imageDimensions(temp); }
      finally { await unlink(temp).catch(() => {}); }
      await writeFile(path, buffer, {flag: 'wx', mode: 0o600}).catch((error) => {
        if (error.code !== 'EEXIST') throw error;
      });
      const image = {url: `${origin}/media/${sku}/${sha256}.${extension}`, sha256, ...dimensions, mime};
      const next = {version: 1, revision: db.revision + 1, products: {
        ...db.products, [sku]: {...db.products[sku], image},
      }};
      await save(next);
      return json(res, 200, {revision: db.revision, image});
    });
  } catch (error) {
    const status = error.status || (error instanceof SyntaxError ? 400 : 500);
    json(res, status, {error: status === 500 ? 'Internal error' : error.message});
    if (status === 500) console.error(error);
  }
});

server.listen(port, host, () => {
  console.log(`KISARAGI admin: ${origin}/admin`);
  if (!process.env.KISARAGI_ADMIN_PASSWORD) console.log(`One-session admin password: ${password}`);
  console.log(`Catalog SKUs: ${productMap.size}; data: ${dataDir}`);
});
