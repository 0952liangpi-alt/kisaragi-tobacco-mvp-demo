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
    loadStylesheet('./world-tobacco-catalog.css?v=20260907-filter-v2');
    loadStylesheet('./product-detail.css?v=20260907-detail-v1');

    try {
      await loadScript('./world-tobacco-japan.js?v=20260905-user-audit');
      await loadScript('./catalog-core.js?v=20260905-image-closeout');
      await loadScript('./world-tobacco-catalog-render.js?v=20260907-filter-v2');
      await loadScript('./product-detail.js?v=20260907-detail-v1');
    } catch (error) {
      console.error('KISARAGI canonical catalog load failed', error);
    }
  };

  loadCatalog();
})();
