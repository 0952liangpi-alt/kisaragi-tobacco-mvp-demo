(() => {
  const configuredApiBase = document.querySelector('meta[name="kisaragi-catalog-api"]')?.content?.trim() || null;
  globalThis.KISARAGI_LIVE_CONFIG = Object.freeze({
    apiBase: configuredApiBase,
  });
})();
