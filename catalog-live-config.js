(() => {
  const local = ['127.0.0.1', 'localhost'].includes(location.hostname) && location.port === '8766';
  // Set these to the protected cloud service origin when it is deployed.
  const cloudApiBase = null;
  const cloudAdminUrl = null;
  globalThis.KISARAGI_LIVE_CONFIG = Object.freeze({
    apiBase: local ? 'http://127.0.0.1:8767' : cloudApiBase,
    adminUrl: local ? 'http://127.0.0.1:8767/admin' : cloudAdminUrl,
  });
})();
