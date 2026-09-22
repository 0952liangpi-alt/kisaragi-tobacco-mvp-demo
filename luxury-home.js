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
        <header class="luxury-nav"><a class="luxury-brand" href="./index.html">KISARAGI<small>RESEARCH ARCHIVE</small></a><nav class="luxury-links" aria-label="メインナビゲーション"><a href="./shop.html#catalog">商品案内</a><a href="#jp-sku-catalog">資料商品庫</a><a href="./checkout.html#orderFunctions">注文機能</a><a href="./shop.html#guide">利用案内</a></nav></header>
        <div class="luxury-content"><div class="luxury-copy"><h1 id="luxury-title"><span>素材を愉しむ。</span><span>細部を選ぶ。</span></h1><p>CONSIDERED MATERIALS. DISTINCTIVE DETAILS.</p><a class="luxury-cta" href="./shop.html"><span>コレクションを見る</span></a></div></div>
        <div class="luxury-floor"><span class="luxury-scroll" aria-hidden="true"><i></i>SCROLL</span><a class="luxury-text-link" href="#jp-sku-catalog">${total} 商品を資料から探す</a></div>
      </section>
      <section class="luxury-path" aria-label="KISARAGI の入口"><p>KISARAGI / COLLECTION PATH</p><div class="luxury-path-grid"><a href="./shop.html#catalog"><b>商品を選ぶ</b><span>画像・参考価格・状態を確認し、選択リストへまとめます。</span><i>SHOP →</i></a><a href="#jp-sku-catalog"><b>資料から探す</b><span>ブランド、商品名、品番から比較します。</span><i>ARCHIVE →</i></a><a href="./checkout.html#orderFunctions"><b>注文機能を見る</b><span>会員、年齢確認、配送、支払い、注文、追跡の全体像を確認します。</span><i>ORDER FUNCTIONS →</i></a><a href="./shop.html#guide"><b>利用案内</b><span>年齢確認と選択リストの利用条件を確認します。</span><i>GUIDE →</i></a></div></section>`;
    main.prepend(section);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => waitForCatalog(boot));
  else waitForCatalog(boot);
})();
