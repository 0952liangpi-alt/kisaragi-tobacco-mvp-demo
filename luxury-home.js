(() => {
  'use strict';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character]));

  const waitForCatalog = (callback, attempts = 0) => {
    const data = globalThis.KISARAGI_CANONICAL_CATALOG;
    if (Array.isArray(data) && data.length) return callback(data);
    if (attempts < 80) setTimeout(() => waitForCatalog(callback, attempts + 1), 100);
    return undefined;
  };

  const productImage = (product) => product.image?.file_path || product.images?.[0]?.file_path || '';
  const productPrice = (product) => {
    const amount = product.official_catalog_price_jpy ?? product.price_jpy;
    if (Number.isFinite(amount)) return `&yen;${Number(amount).toLocaleString('ja-JP')}`;
    return escapeHtml(product.official_catalog_price_text || '価格を見る');
  };

  const cartCount = () => {
    try {
      const lines = JSON.parse(localStorage.getItem('kisaragi-shop-demo-cart-v1') || '[]');
      return Array.isArray(lines)
        ? lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0), 0)
        : 0;
    } catch (_error) {
      return 0;
    }
  };

  const groups = [
    {
      id: 'cigarettes',
      title: '紙巻たばこ',
      description: '国内・輸入ブランド',
      categories: ['CIGARETTES', 'IMPORTED_CIGARETTES'],
    },
    {
      id: 'heated',
      title: '加熱式たばこ',
      description: 'スティック・デバイス',
      categories: ['HEATED_TOBACCO_STICKS', 'HEATED_TOBACCO_CAPSULES', 'HEATED_TOBACCO_DEVICES'],
    },
    {
      id: 'rolling',
      title: '手巻き・葉巻',
      description: 'シャグ・葉巻・パイプ',
      categories: ['RYO', 'CIGARS', 'PIPE_TOBACCO', 'CUT_TOBACCO', 'SMOKELESS_TOBACCO'],
    },
    {
      id: 'goods',
      title: 'ライター・喫煙具',
      description: 'ライター・灰皿・用品',
      categories: ['SMOKING_ACCESSORIES', 'ROLLING_ACCESSORIES', 'PIPE_ACCESSORIES', 'ASHTRAYS', 'LIGHTERS'],
    },
  ];

  const boot = (catalog) => {
    const main = document.querySelector('main#top');
    if (!main || document.querySelector('.retail-home')) return;

    const productsWithImages = catalog.filter((product) => {
      const price = product.official_catalog_price_jpy ?? product.price_jpy;
      return productImage(product)
        && Number.isFinite(price)
        && product.status !== 'IDENTITY_PENDING'
        && !String(product.product_name_ja || '').includes('確認待ち');
    });
    const preferredBrands = ['メビウス', 'セブンスター', 'マールボロ', 'キャメル', 'TEREA', 'IQOS'];
    const featured = [];
    preferredBrands.forEach((brand) => {
      const match = productsWithImages.find((product) => product.brand === brand && !featured.includes(product));
      if (match) featured.push(match);
    });
    productsWithImages.forEach((product) => {
      if (featured.length < 8 && !featured.includes(product)) featured.push(product);
    });

    const heroProducts = featured.slice(0, 3);
    const brandPriority = [
      'メビウス', 'セブンスター', 'キャメル', 'マールボロ', 'ピース', 'ウィンストン',
      'ナチュラルアメリカンスピリット', 'ラーク', 'ケント', 'ラッキー', 'パーラメント',
      'TEREA', 'センティア', 'IQOS', 'エボ', 'ネオ', 'ヴァルト', 'ピアニッシモ',
      'アークローヤル', 'ブラックデビル', 'プエブロ', 'チェ', 'ピーターソン', 'コイーバ',
    ];
    const availableBrands = new Set(catalog.map((product) => product.brand).filter((brand) => (
      brand && brand !== 'UNKNOWN'
    )));
    const brands = [
      ...brandPriority.filter((brand) => availableBrands.has(brand)),
      ...[...availableBrands]
        .filter((brand) => !brandPriority.includes(brand))
        .sort((left, right) => left.localeCompare(right, 'ja')),
    ];

    const categoryCards = groups.map((group) => {
      const count = catalog.filter((product) => group.categories.includes(product.category)).length;
      return `<a class="retail-category" href="./shop.html?category=${group.id}#catalog">
        <span class="retail-category-name">${escapeHtml(group.title)}</span>
        <span class="retail-category-description">${escapeHtml(group.description)}</span>
        <span class="retail-category-count">${count.toLocaleString('ja-JP')} 商品</span>
      </a>`;
    }).join('');

    const featuredCards = featured.map((product) => {
      const image = productImage(product);
      return `<article class="retail-product-card">
        <a href="./shop.html?sku=${encodeURIComponent(product.id)}#catalog" aria-label="${escapeHtml(product.product_name_ja)}の詳細を見る">
          <span class="retail-product-image"><img src="./${escapeHtml(image)}" alt="${escapeHtml(product.product_name_ja)}" loading="lazy"></span>
          <span class="retail-product-brand">${escapeHtml(product.brand || 'KISARAGI')}</span>
          <strong>${escapeHtml(product.product_name_ja)}</strong>
          <span class="retail-product-price">${productPrice(product)}</span>
        </a>
      </article>`;
    }).join('');

    const brandLinks = brands.slice(0, 24).map((brand) => (
      `<a href="./shop.html?q=${encodeURIComponent(brand)}#catalog">${escapeHtml(brand)}</a>`
    )).join('');

    const section = document.createElement('section');
    section.className = 'retail-home';
    section.innerHTML = `
      <div class="retail-age-strip">20歳以上の方限定</div>
      <header class="retail-header">
        <a class="retail-brand" href="./index.html"><span>K</span><b>KISARAGI</b></a>
        <nav class="retail-primary-nav" aria-label="メインナビゲーション">
          <a href="./shop.html#catalog">商品カテゴリー</a>
          <a href="#retail-brands">ブランド</a>
          <a href="./trust.html">ご利用ガイド</a>
        </nav>
        <div class="retail-actions">
          <a href="./account.html">会員メニュー</a>
          <a class="retail-cart-link" href="./checkout.html">カート <b>${cartCount()}</b></a>
        </div>
      </header>

      <section class="retail-hero" aria-labelledby="retail-title">
        <div class="retail-product-stage" aria-hidden="true">
          ${heroProducts.map((product, index) => `<img class="retail-hero-pack retail-hero-pack-${index + 1}" src="./${escapeHtml(productImage(product))}" alt="">`).join('')}
        </div>
        <div class="retail-hero-copy">
          <p>TOBACCO &amp; SMOKING GOODS</p>
          <h1 id="retail-title">たばこ・喫煙具を探す</h1>
          <span>${catalog.length.toLocaleString('ja-JP')} 商品を、カテゴリー・ブランド・商品名から検索できます。</span>
          <form class="retail-search" action="./shop.html" method="get" role="search">
            <label for="retail-search-input">商品検索</label>
            <div><input id="retail-search-input" name="q" type="search" enterkeyhint="search" placeholder="商品名・ブランド・商品コード"><button type="submit">検索</button></div>
          </form>
        </div>
      </section>

      <div class="retail-main">
        <section class="retail-section" aria-labelledby="category-title">
          <div class="retail-section-heading"><div><p>CATEGORY</p><h2 id="category-title">商品カテゴリー</h2></div><a href="./shop.html#catalog">すべての商品</a></div>
          <div class="retail-category-grid">${categoryCards}</div>
        </section>

        <section class="retail-section" aria-labelledby="featured-title">
          <div class="retail-section-heading"><div><p>FEATURED</p><h2 id="featured-title">商品を探す</h2></div><a href="./shop.html#catalog">一覧を見る</a></div>
          <div class="retail-product-grid">${featuredCards}</div>
        </section>

        <section class="retail-section retail-brand-section" id="retail-brands" aria-labelledby="brand-title">
          <div class="retail-section-heading"><div><p>BRAND</p><h2 id="brand-title">ブランドから探す</h2></div><a href="./shop.html#catalog">ブランド一覧</a></div>
          <div class="retail-brand-grid">${brandLinks}</div>
        </section>

        <section class="retail-service-grid" aria-label="ご利用メニュー">
          <a href="./account.html"><b>会員メニュー</b><span>登録情報・年齢確認・注文履歴</span></a>
          <a href="./checkout.html"><b>カートを見る</b><span>商品・数量・合計を確認</span></a>
          <a href="./trust.html"><b>ご利用ガイド</b><span>配送・お支払い・返品・お問い合わせ</span></a>
        </section>
      </div>`;

    main.prepend(section);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForCatalog(boot));
  } else {
    waitForCatalog(boot);
  }
})();
