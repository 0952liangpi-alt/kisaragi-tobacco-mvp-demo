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
  const load = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
  (async () => {
    const liveReady = globalThis.KISARAGI_LIVE_OVERRIDES_READY || globalThis.KISARAGI_LOAD_LIVE_OVERRIDES();
    const projectionPending = globalThis.KISARAGI_LIVE_STATUS === 'LOADING';
    await load('./catalog-core.js?v=20260924-uiux3');
    await load(document.body.dataset.catalogPage === 'checkout' ? './checkout.js?v=20260924-uiux3' : './shop.js?v=20260924-uiux3');
    if (projectionPending && liveReady && typeof liveReady.then === 'function') {
      void liveReady.then(async () => {
        if (globalThis.KISARAGI_LIVE_STATUS !== 'LIVE') return;
        await load(`./catalog-core.js?v=20260924-uiux3&projection=${encodeURIComponent(globalThis.KISARAGI_LIVE_REVISION)}`);
        globalThis.dispatchEvent(new CustomEvent('kisaragi-catalog-updated', {detail:{revision:globalThis.KISARAGI_LIVE_REVISION}}));
      }).catch((error) => console.error('KISARAGI live catalog refresh failed', error));
    }
  })().catch((error) => {
    console.error('KISARAGI catalog page load failed', error);
    showLoadFailure();
  });
})();
