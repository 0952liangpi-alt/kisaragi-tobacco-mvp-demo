(() => {
  const load = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
  (async () => {
    await globalThis.KISARAGI_LOAD_LIVE_OVERRIDES();
    await load('./catalog-core.js');
    await load(document.body.dataset.catalogPage === 'checkout' ? './checkout.js' : './shop.js?v=20260921-site-merge3');
  })().catch((error) => console.error('KISARAGI catalog page load failed', error));
})();
