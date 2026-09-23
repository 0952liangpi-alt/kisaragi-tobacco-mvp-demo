import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
import vm from 'node:vm';

const source = readFileSync(new URL('../trust.js', import.meta.url), 'utf8');
assert.ok(!source.includes('innerHTML'), 'the public disclosure renderer must never use innerHTML');

const ids = [
  'merchantLegalName', 'merchantBusinessAddress', 'merchantContactChannel', 'merchantPermitReference',
  'merchantPrivacyVersion', 'merchantPrivacyReference', 'merchantTermsVersion', 'merchantTermsReference',
  'merchantReturnsVersion', 'merchantReturnsReference', 'merchantDisclosureState', 'merchantPublicationStatus', 'operator',
];

function elements() {
  return Object.fromEntries(ids.map((id) => [id, {textContent:`placeholder:${id}`, dataset:{}}]));
}

async function renderWith(merchantDisclosures, activationReadiness) {
  const nodes = elements();
  const document = {
    readyState:'complete',
    getElementById:(id) => nodes[id],
    addEventListener() { throw new Error('DOMContentLoaded listener is not expected for a complete document'); },
  };
  const context = {
    document,
    globalThis:{KISARAGI_COMMERCE_LIVE:{configured:true, merchantDisclosures, activationReadiness}},
  };
  vm.runInNewContext(source, context);
  await new Promise((resolve) => setImmediate(resolve));
  return nodes;
}

const hostileName = '<img src=x onerror=alert(1)>';
const verified = await renderWith(async () => ({
  verified:true,
  disclosure:{
    legalName:hostileName,
    businessAddress:'1-1 Chiyoda, Tokyo',
    contactChannel:'support@example.jp',
    permitPublicationReference:'permit-public-001',
    privacyPolicy:{version:'privacy-v1', reference:'privacy-public-001'},
    terms:{version:'terms-v1', reference:'terms-public-001'},
    returnsCancellation:{version:'returns-v1', reference:'returns-public-001'},
  },
}));
assert.equal(verified.merchantLegalName.textContent, hostileName, 'hostile public text must remain inert text');
assert.equal(verified.operator.dataset.disclosureState, 'verified');
assert.equal(verified.merchantDisclosureState.textContent, '公開経営情報：本番受入確認済み');
assert.match(verified.merchantPublicationStatus.textContent, /公開経営情報は本番受入確認済み/);

const rejected = await renderWith(async () => { throw Object.assign(new Error('not verified'), {status:503}); });
assert.equal(rejected.merchantLegalName.textContent, 'placeholder:merchantLegalName', '503 must preserve the static unverified placeholder');
assert.equal(rejected.merchantPublicationStatus.textContent, 'placeholder:merchantPublicationStatus', '503 must preserve the inactive status copy');
assert.equal(rejected.operator.dataset.disclosureState, undefined, '503 must not mark disclosures as verified');

const incomplete = await renderWith(async () => ({verified:true, disclosure:{legalName:'Partial Operator'}}));
assert.equal(incomplete.merchantLegalName.textContent, 'placeholder:merchantLegalName', 'partial payloads must not partially overwrite placeholders');

let blockedDisclosureRequests = 0;
const blocked = await renderWith(
  async () => { blockedDisclosureRequests += 1; throw new Error('must not request blocked disclosures'); },
  async () => ({
    ready:false,
    missing:[{code:'MERCHANT_PUBLICATION_ACCEPTANCE_UNVERIFIED'}],
  }),
);
assert.equal(blockedDisclosureRequests, 0, 'unaccepted merchant disclosures must not be requested');
assert.equal(blocked.merchantLegalName.textContent, 'placeholder:merchantLegalName', 'blocked disclosure must preserve static placeholders');

console.log('Trust merchant disclosures: PASS (readiness-gated request, verified-only textContent rendering, 503 and partial payload fail closed)');
