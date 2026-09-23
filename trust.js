(() => {
  'use strict';

  const client = () => globalThis.KISARAGI_COMMERCE_LIVE;
  const fieldIds = Object.freeze({
    legalName:'merchantLegalName',
    businessAddress:'merchantBusinessAddress',
    contactChannel:'merchantContactChannel',
    permitPublicationReference:'merchantPermitReference',
    privacyPolicyVersion:'merchantPrivacyVersion',
    privacyPolicyReference:'merchantPrivacyReference',
    termsVersion:'merchantTermsVersion',
    termsReference:'merchantTermsReference',
    returnsCancellationVersion:'merchantReturnsVersion',
    returnsCancellationReference:'merchantReturnsReference',
  });

  function publicFields(payload) {
    if (payload?.verified !== true || !payload.disclosure) return null;
    const disclosure = payload.disclosure;
    const fields = {
      legalName:disclosure.legalName,
      businessAddress:disclosure.businessAddress,
      contactChannel:disclosure.contactChannel,
      permitPublicationReference:disclosure.permitPublicationReference,
      privacyPolicyVersion:disclosure.privacyPolicy?.version,
      privacyPolicyReference:disclosure.privacyPolicy?.reference,
      termsVersion:disclosure.terms?.version,
      termsReference:disclosure.terms?.reference,
      returnsCancellationVersion:disclosure.returnsCancellation?.version,
      returnsCancellationReference:disclosure.returnsCancellation?.reference,
    };
    return Object.values(fields).every((value) => typeof value === 'string' && value.trim())
      ? fields
      : null;
  }

  function renderVerifiedDisclosure(fields) {
    for (const [field, id] of Object.entries(fieldIds)) {
      document.getElementById(id).textContent = fields[field];
    }
    const section = document.getElementById('operator');
    section.dataset.disclosureState = 'verified';
    document.getElementById('merchantDisclosureState').textContent = '運営者情報：公開確認済み';
    document.getElementById('merchantPublicationStatus').textContent = '運営者情報と利用条件を確認できます。オンライン注文の受付状況は、公開環境の安全性と必要な外部サービスの準備状況を含めて判定します。';
  }

  async function init() {
    const api = client();
    if (!api?.configured || typeof api.merchantDisclosures !== 'function') return;
    try {
      if (typeof api.activationReadiness === 'function') {
        const readiness = await api.activationReadiness();
        const merchantPublicationBlocked = Array.isArray(readiness?.missing) && readiness.missing.some((item) =>
          ['MERCHANT_PUBLICATION_NOT_CONFIGURED', 'MERCHANT_PUBLICATION_ACCEPTANCE_UNVERIFIED'].includes(item?.code));
        if (merchantPublicationBlocked) return;
      }
      const fields = publicFields(await api.merchantDisclosures());
      if (fields) renderVerifiedDisclosure(fields);
    } catch {
      // The static unverified placeholders are the fail-closed public state.
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
