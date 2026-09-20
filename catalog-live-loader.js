(() => {
  const config = globalThis.KISARAGI_LIVE_CONFIG || {};

  globalThis.KISARAGI_LOAD_LIVE_OVERRIDES = async () => {
    document.querySelectorAll('[data-catalog-admin]').forEach((link) => {
      if (!config.adminUrl) return;
      link.href = config.adminUrl;
      link.hidden = false;
    });
    if (!config.apiBase) {
      globalThis.KISARAGI_LIVE_STATUS = 'NOT_CONFIGURED';
      return;
    }
    try {
      const response = await fetch(`${config.apiBase}/api/catalog-overrides`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) throw new Error(`Live catalog HTTP ${response.status}`);
      const data = await response.json();
      if (data?.version !== 1 || !data.products || Array.isArray(data.products) || typeof data.products !== 'object') {
        throw new Error('Invalid live catalog payload');
      }
      globalThis.KISARAGI_LIVE_OVERRIDES = data.products;
      globalThis.KISARAGI_LIVE_STATUS = 'LIVE';
    } catch {
      globalThis.KISARAGI_LIVE_OVERRIDES = {};
      globalThis.KISARAGI_LIVE_STATUS = 'OFFLINE_STATIC_FALLBACK';
    }
  };
})();
