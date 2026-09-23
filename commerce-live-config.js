(() => {
  'use strict';

  const localPreview = ['127.0.0.1', 'localhost'].includes(location.hostname) && location.port === '8766';
  const githubPages = location.hostname.endsWith('.github.io');
  // A future protected custom-domain deployment can reverse-proxy this same-origin path.
  // GitHub Pages has no trusted server runtime, so it deliberately remains fail-closed.
  const cloudApiBase = !githubPages && location.protocol === 'https:'
    ? `${location.origin}/commerce/api`
    : null;

  globalThis.KISARAGI_COMMERCE_CONFIG = Object.freeze({
    apiBase: localPreview ? 'http://127.0.0.1:8769/commerce/api' : cloudApiBase,
    requestTimeoutMs: 3500,
  });
})();
