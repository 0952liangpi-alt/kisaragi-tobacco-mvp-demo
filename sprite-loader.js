(() => {
  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  const loadCatalog = async () => {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = './world-tobacco-catalog.css?v=20260905-p0';
    document.head.appendChild(stylesheet);

    try {
      await loadScript('./world-tobacco-japan.js?v=20260905-p0');
      await loadScript('./catalog-core.js?v=20260905-p0');
      await loadScript('./world-tobacco-catalog-render.js?v=20260905-p0');
    } catch (error) {
      console.error('KISARAGI canonical catalog load failed', error);
    }
  };

  loadCatalog();
})();
