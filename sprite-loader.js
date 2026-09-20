(() => {
  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  const loadStylesheet = (href) => {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = href;
    document.head.appendChild(stylesheet);
  };

  const loadCatalog = async () => {
    loadStylesheet('./world-tobacco-catalog.css?v=20260921-site-merge3');
    loadStylesheet('./product-detail.css?v=20260921-price-context1');

    try {
      await loadScript('./world-tobacco-japan.js?v=20260905-user-audit');
      await loadScript('./jt-catalog-2025.js?v=20260921-jt-color1');
      await loadScript('./tsn-imported-catalog-2026.js?v=20260920-tsn-import');
      await loadScript('./tsn-goods-catalog-2026.js?v=20260920-tsn-goods');
      await loadScript('./catalog-live-config.js?v=20260920-live-v1');
      await loadScript('./catalog-live-loader.js?v=20260920-live-v1');
      await globalThis.KISARAGI_LOAD_LIVE_OVERRIDES();
      await loadScript('./catalog-core.js?v=20260921-jt-color1');
      await loadScript('./world-tobacco-catalog-render.js?v=20260921-price-context1');
      await loadScript('./product-detail.js?v=20260921-price-context1');
      loadStylesheet('./luxury-home.css?v=20260921-home-gates1');
      await loadScript('./luxury-home.js?v=20260920-site-merge');
    } catch (error) {
      console.error('KISARAGI canonical catalog load failed', error);
    }
  };

  loadCatalog();
})();
