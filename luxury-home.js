(() => {
  const waitForCatalog = (callback, attempts = 0) => {
    const data = globalThis.KISARAGI_CANONICAL_CATALOG;
    if (Array.isArray(data) && data.length) return callback(data);
    if (attempts < 80) setTimeout(() => waitForCatalog(callback, attempts + 1), 100);
  };

  const boot = (data) => {
    const main = document.querySelector('main#top');
    if (!main || document.querySelector('.luxury-home')) return;
    const total = data.length;
    const section = document.createElement('section');
    section.className = 'luxury-home';
    section.innerHTML = `
      <section class="luxury-hero" aria-labelledby="luxury-title">
        <div class="luxury-media" aria-hidden="true">
          <img src="./assets/home/kisaragi-metal-hero.png" alt="">
          <video muted loop playsinline preload="none" poster="./assets/home/kisaragi-metal-hero.png"></video>
        </div>
        <div class="luxury-scrim" aria-hidden="true"></div><div class="luxury-gradient" aria-hidden="true"></div>
        <header class="luxury-nav"><span class="luxury-brand">KISARAGI<small>ADULT PRODUCT ARCHIVE</small></span><a href="./shop.html">選択リストを見る</a></header>
        <div class="luxury-content"><div class="luxury-copy"><h1 id="luxury-title"><span>素材を愉しむ。</span><span>細部を選ぶ。</span></h1><p>CONSIDERED MATERIALS. DISTINCTIVE DETAILS.</p><a class="luxury-cta" href="./shop.html"><span>コレクションを見る</span></a></div></div>
        <div class="luxury-floor"><span class="luxury-scroll" aria-hidden="true"><i></i>SCROLL</span><a class="luxury-text-link" href="#jp-sku-catalog">${total} 商品を資料から探す</a></div>
      </section>
      <section class="luxury-path" aria-label="KISARAGI の入口"><p>KISARAGI / COLLECTION PATH</p><div class="luxury-path-grid"><a href="./shop.html"><b>商品を選ぶ</b><span>画像・参考価格・状態を確認し、選択リストへまとめます。</span><i>SHOP →</i></a><a href="#jp-sku-catalog"><b>資料から探す</b><span>ブランド、商品名、品番から比較します。</span><i>ARCHIVE →</i></a><a href="#guide"><b>表示を知る</b><span>分類と表示の読み方を確認します。</span><i>GUIDE →</i></a></div></section>`;
    main.prepend(section);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => waitForCatalog(boot));
  else waitForCatalog(boot);
})();
