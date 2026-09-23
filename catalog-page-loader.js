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
    await globalThis.KISARAGI_LOAD_LIVE_OVERRIDES();
    await load('./catalog-core.js?v=20260921-jt-color1');
    await load(document.body.dataset.catalogPage === 'checkout' ? './checkout.js' : './shop.js?v=20260921-catalog-mode1');
  })().catch((error) => {
    console.error('KISARAGI catalog page load failed', error);
    showLoadFailure();
  });
})();
