(() => {
  'use strict';

  const client = () => globalThis.KISARAGI_COMMERCE_LIVE;
  const fieldIds = Object.freeze({
    legalName:'merchantLegalName',
    businessAddress:'merchantBusinessAddress',
    contactChannel:'merchantContactChannel',
    privacyPolicyVersion:'merchantPrivacyVersion',
    privacyPolicyReference:'merchantPrivacyReference',
    termsVersion:'merchantTermsVersion',
    termsReference:'merchantTermsReference',
    returnsCancellationVersion:'merchantReturnsVersion',
    returnsCancellationReference:'merchantReturnsReference',
  });

  function publicFields(payload) {
    if (payload?.available !== true || payload?.published !== true || payload?.complete !== true || !payload.disclosure) return null;
    const disclosure = payload.disclosure;
    const fields = {
      legalName:disclosure.legalName,
      businessAddress:disclosure.businessAddress,
      contactChannel:disclosure.contactChannel,
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

  function renderDisclosure(fields) {
    for (const [field, id] of Object.entries(fieldIds)) {
      const element = document.getElementById(id);
      if (element) element.textContent = fields[field];
    }
  }

  async function init() {
    const api = client();
    if (!api?.configured || typeof api.merchantDisclosures !== 'function') return;
    try {
      const fields = publicFields(await api.merchantDisclosures());
      if (fields) renderDisclosure(fields);
    } catch {
      // Static customer guidance remains available when the optional text service is unavailable.
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
