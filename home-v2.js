(() => {
  const yen = (value) => value == null ? '未登録' : `¥${Number(value).toLocaleString('ja-JP')}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  const waitForCatalog = (callback, attempts = 0) => {
    const data = globalThis.KISARAGI_CANONICAL_CATALOG;
    if (Array.isArray(data) && data.length) return callback(data, globalThis.KISARAGI_CATALOG_AUDIT || {});
    if (attempts < 80) setTimeout(() => waitForCatalog(callback, attempts + 1), 100);
  };

  const boot = (data, audit) => {
    const main = document.querySelector('main#top');
    if (!main || document.querySelector('.home-v2')) return;

    const withImages = data.filter((p) => p.image || p.images?.length);
    const preferred = withImages.filter((p) => ['キャメル','セブンスター','メビウス','ピース','TEREA'].includes(p.brand));
    const picks = [...preferred, ...withImages].filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i).slice(0, 5);
    const hero = picks.find((p) => /セブンスター/.test(p.brand)) || picks[0];
    const heroImage = hero?.image?.file_path || hero?.images?.[0]?.file_path || 'assets/catalog/products/wt-1020-seven-stars.png';
    const brands = [...new Set(data.map((p) => p.brand).filter(Boolean))];

    const productCard = (p) => {
      const image = p.image?.file_path || p.images?.[0]?.file_path;
      return `<article class="home-v2-product">
        <div class="home-v2-product-image">${image ? `<img src="./${escapeHtml(image)}" alt="${escapeHtml(p.product_name_ja)}" loading="lazy">` : ''}</div>
        <div class="home-v2-product-body">
          <span class="home-v2-product-brand">${escapeHtml(p.brand)}</span>
          <h3>${escapeHtml(p.product_name_ja)}</h3>
          <div class="home-v2-product-price">${yen(p.price_jpy)}</div>
          <button type="button" data-open-product="${escapeHtml(p.id)}">詳細を見る</button>
        </div>
      </article>`;
    };

    const section = document.createElement('section');
    section.className = 'home-v2';
    section.innerHTML = `<div class="home-v2-wrap">
      <div class="home-v2-hero">
        <div class="home-v2-copy">
          <span class="eyebrow">KISARAGI / JAPAN TOBACCO ARCHIVE</span>
          <h1>日本のたばこを、<br>もっと身近に。</h1>
          <p>正確な情報で選べる、信頼のたばこ商品庫。商品・ブランド・画像・仕様・出典をひとつの場所で確認できます。</p>
          <div class="home-v2-actions">
            <a class="primary" href="#jp-sku-catalog">全ての商品を見る（${audit.TOTAL_LOCAL_SKU ?? data.length}） →</a>
            <a class="secondary" href="#guide">基礎知識を見る</a>
          </div>
        </div>
        <div class="home-v2-visual">
          <div class="home-v2-visual-copy">TASTE<br>CULTURE<br>LIFESTYLE<small>商品を、広告ではなく資料として。</small></div>
          <img src="./${escapeHtml(heroImage)}" alt="${escapeHtml(hero?.product_name_ja || '商品資料')}">
        </div>
      </div>

      <div class="home-v2-stats">
        <div><b>${audit.TOTAL_LOCAL_SKU ?? data.length}</b><span>商品</span></div>
        <div><b>${brands.length}</b><span>ブランド</span></div>
        <div><b>20+</b><span>成人限定</span></div>
        <div><b>0</b><span>実販売</span></div>
      </div>

      <div class="home-v2-tools">
        <label class="home-v2-search"><span>⌕</span><input type="search" placeholder="商品名・ブランド・商品コードで検索" aria-label="商品を検索"></label>
        <button class="active" data-cat="ALL">全ての商品</button>
        <button data-cat="CIGARETTES">紙巻たばこ</button>
        <button data-cat="HEATED_TOBACCO_STICKS">加熱式たばこ</button>
        <button data-cat="HEATED_TOBACCO_DEVICES">加熱式デバイス</button>
      </div>

      <div class="home-v2-section">
        <div class="home-v2-section-head"><div><h2>おすすめ商品</h2><p>画像登録済みの商品からピックアップ</p></div><a href="#jp-sku-catalog">すべて見る →</a></div>
        <div class="home-v2-products">${picks.map(productCard).join('')}</div>
      </div>

      <div class="home-v2-section">
        <div class="home-v2-section-head"><div><h2>ブランドから探す</h2><p>商品庫に存在するブランドだけを表示</p></div></div>
        <div class="home-v2-brands">${brands.map((brand) => `<button class="home-v2-brand" type="button" data-brand="${escapeHtml(brand)}">${escapeHtml(brand)}</button>`).join('')}</div>
      </div>
    </div>`;

    main.prepend(section);

    const jumpToCatalog = ({query = '', category = 'ALL', brand = null} = {}) => {
      location.hash = '#jp-sku-catalog';
      setTimeout(() => {
        const search = document.querySelector('#jp-sku-search-input');
        const categorySelect = document.querySelector('#jp-sku-category');
        if (search) { search.value = query; search.dispatchEvent(new Event('input', {bubbles:true})); }
        if (categorySelect) { categorySelect.value = category; categorySelect.dispatchEvent(new Event('change', {bubbles:true})); }
        if (brand) {
          [...document.querySelectorAll('.jp-sku-brands button')].find((b) => b.textContent.trim() === brand)?.click();
        }
      }, 350);
    };

    section.querySelector('.home-v2-search input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') jumpToCatalog({query:e.currentTarget.value});
    });
    section.querySelectorAll('[data-cat]').forEach((button) => button.addEventListener('click', () => jumpToCatalog({category:button.dataset.cat})));
    section.querySelectorAll('[data-brand]').forEach((button) => button.addEventListener('click', () => jumpToCatalog({brand:button.dataset.brand})));
    section.querySelectorAll('[data-open-product]').forEach((button) => button.addEventListener('click', () => {
      const id = button.dataset.openProduct;
      location.hash = '#jp-sku-catalog';
      setTimeout(() => {
        const card = document.querySelector(`.jp-sku-card[data-sku="${CSS.escape(id)}"]`);
        card?.scrollIntoView({behavior:'smooth', block:'center'});
        card?.querySelector('.jp-sku-detail-button')?.click();
      }, 350);
    }));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => waitForCatalog(boot));
  else waitForCatalog(boot);
})();
