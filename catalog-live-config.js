(() => {
  const local = location.hostname === '127.0.0.1' && location.port === '8766';
  const siteBase = document.currentScript ? new URL('./', document.currentScript.src) : new URL('./', location.href);
  // Set these to the protected cloud service origin when it is deployed.
  const cloudApiBase = null;
  globalThis.KISARAGI_LIVE_CONFIG = Object.freeze({
    apiBase: local ? 'http://127.0.0.1:8767' : cloudApiBase,
    adminUrl: new URL('admin/', siteBase).href,
  });
})();
