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
          <div class="luxury-product-stage">
            <img class="luxury-pack luxury-pack-primary" src="./assets/catalog/products/wt-1020-seven-stars.png" alt="">
            <img class="luxury-pack luxury-pack-secondary" src="./assets/catalog/products/ua-mevius-lights-8.jpg" alt="">
            <img class="luxury-pack luxury-pack-tertiary" src="./assets/catalog/products/ua-terea-riviera-pearl.jpg" alt="">
          </div>
        </div>
        <div class="luxury-scrim" aria-hidden="true"></div><div class="luxury-gradient" aria-hidden="true"></div>
        <header class="luxury-nav"><a class="luxury-brand" href="./index.html">KISARAGI<small>JAPAN TOBACCO CATALOG</small></a><nav class="luxury-links unified-site-nav" aria-label="メインナビゲーション"><a href="./index.html" aria-current="page">ホーム</a><a href="./shop.html#catalog">商品案内</a><a href="./index.html#jp-sku-catalog">資料庫</a><a href="./checkout.html#orderFunctions">注文機能</a><a href="./account.html">会員・注文</a><a href="./trust.html">運営・取引</a></nav></header>
        <div class="luxury-content"><div class="luxury-copy"><p class="luxury-eyebrow">日本たばこ商品庫 / ${total} 品項</p><h1 id="luxury-title"><span>日本のたばこを、</span><span>選ぶ前に確かめる。</span></h1><p class="luxury-lead">品名、画像、参考価格、出典をひとつの画面で確認できます。オンライン注文機能は現在準備中です。</p><a class="luxury-cta" href="./shop.html#catalog"><span>商品を探す</span></a></div></div>
        <div class="luxury-floor"><span class="luxury-scroll" aria-hidden="true"><i></i>MORE</span><a class="luxury-text-link" href="#jp-sku-catalog">${total} 品項を資料庫で探す</a></div>
      </section>
      <section class="luxury-path" aria-label="KISARAGI の入口"><p>KISARAGI / CATALOG PATH</p><div class="luxury-path-grid"><a href="./shop.html#catalog"><b>商品を選ぶ</b><span>画像・参考価格・状態を確認し、選択リストへまとめます。</span><i>SHOP →</i></a><a href="#jp-sku-catalog"><b>資料庫で探す</b><span>ブランド、商品名、品番から比較します。</span><i>ARCHIVE →</i></a><a href="./checkout.html#orderFunctions"><b>注文接続状況</b><span>会員、年齢確認、配送、支払い、注文、追跡の接続状況を確認します。</span><i>SERVICE STATUS →</i></a><a href="./account.html"><b>会員・注文</b><span>保護された会員セッション、注文履歴、外部サービスの準備状況を確認します。</span><i>MEMBER →</i></a><a href="./trust.html"><b>運営・取引情報</b><span>現在利用できる機能と、正式運用前に公開する情報を確認します。</span><i>TRUST →</i></a><a href="./admin/"><b>商品管理</b><span>商品名、表示価格、商品画像を更新する管理サービスの接続状況を確認します。</span><i>ADMIN →</i></a></div></section>`;
    main.prepend(section);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => waitForCatalog(boot));
  else waitForCatalog(boot);
})();
