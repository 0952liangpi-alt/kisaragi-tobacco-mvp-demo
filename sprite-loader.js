(() => {
  const showLoadFailure = () => {
    if (document.querySelector('#catalog-load-error')) return;
    const notice = document.createElement('section');
    notice.id = 'catalog-load-error';
    notice.setAttribute('role', 'alert');
    notice.setAttribute('aria-live', 'assertive');
    notice.setAttribute('aria-atomic', 'true');
    const title = document.createElement('h2');
    title.textContent = '商品情報を読み込めませんでした';
    const copy = document.createElement('p');
    copy.textContent = '通信状態を確認して、もう一度お試しください。';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = '再読み込み';
    retry.addEventListener('click', () => location.reload());
    notice.append(title, copy, retry);
    (document.querySelector('main') || document.body).prepend(notice);
  };
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
    try {
      await loadScript('./world-tobacco-japan.js?v=20260905-user-audit');
      await loadScript('./jt-catalog-2025.js?v=20260921-jt-color1');
      await loadScript('./tsn-imported-catalog-2026.js?v=20260923-catalog-complete1');
      await loadScript('./tsn-goods-catalog-2026.js?v=20260923-catalog-complete1');
      await loadScript('./catalog-live-config.js?v=20260920-live-v1');
      await loadScript('./catalog-live-loader.js?v=20260920-live-v1');
      await globalThis.KISARAGI_LOAD_LIVE_OVERRIDES();
      await loadScript('./catalog-core.js?v=20260923-catalog-complete1');
      loadStylesheet('./luxury-home.css?v=20260924-home-image-fit1');
      await loadScript('./luxury-home.js?v=20260924-mobile-polish1');
    } catch (error) {
      console.error('KISARAGI canonical catalog load failed', error);
      showLoadFailure();
    }
  };

  loadCatalog();
})();
