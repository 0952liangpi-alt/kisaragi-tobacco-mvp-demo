(() => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const yen = (value) => value == null ? '未登録' : `¥${Number(value).toLocaleString('ja-JP')}`;
  const waitForCatalog = (callback, attempts = 0) => {
    const data = globalThis.KISARAGI_CANONICAL_CATALOG;
    if (Array.isArray(data) && data.length) return callback(data, globalThis.KISARAGI_CATALOG_AUDIT || {});
    if (attempts < 80) setTimeout(() => waitForCatalog(callback, attempts + 1), 100);
  };

  const boot = (data, audit) => {
    const main = document.querySelector('main#top');
    if (!main || document.querySelector('.home-v3')) return;

    const total = audit.TOTAL_LOCAL_SKU ?? data.length;
    const brands = [...new Set(data.map((p) => p.brand).filter(Boolean))];
    const countCategory = (category) => data.filter((p) => p.category === category).length;
    const cigarettes = countCategory('CIGARETTES') + countCategory('JAPANESE_CIGARETTES');
    const heated = countCategory('HEATED_TOBACCO_STICKS');
    const devices = countCategory('HEATED_TOBACCO_DEVICES');
    const homeImageBlacklist = new Set(['wt-1020']);
    const picks = data.filter((p) => (p.image || p.images?.length) && !homeImageBlacklist.has(p.id)).slice(0, 6);

    const card = (p) => {
      const image = p.image?.file_path || p.images?.[0]?.file_path;
      return `<button class="apple-product-card" type="button" data-open-product="${escapeHtml(p.id)}">
        <span class="apple-product-stage">${image ? `<img src="./${escapeHtml(image)}" alt="" loading="lazy">` : ''}</span>
        <span class="apple-product-brand">${escapeHtml(p.brand)}</span>
        <strong>${escapeHtml(p.product_name_ja)}</strong>
        <span class="apple-product-price">${yen(p.price_jpy)}</span>
        <span class="apple-chevron" aria-hidden="true">›</span>
      </button>`;
    };

    const section = document.createElement('section');
    section.className = 'home-v3';
    section.innerHTML = `<div class="apple-home-wrap">
      <section class="apple-hero" aria-labelledby="apple-hero-title">
        <span class="apple-eyebrow">KISARAGI · PRODUCT ARCHIVE</span>
        <h1 id="apple-hero-title">日本のたばこを、<br>もっと身近に。</h1>
        <p>${total}の商品を、ブランド・価格・仕様から探す。広告ではなく、比較できる商品資料として。</p>
        <label class="apple-search" aria-label="商品を検索">
          <span aria-hidden="true">⌕</span>
          <input type="search" inputmode="search" enterkeyhint="search" placeholder="商品名・ブランド・商品コード">
        </label>
        <div class="apple-quick-grid" aria-label="商品を探す">
          <button type="button" data-cat="CIGARETTES"><span>紙巻たばこ</span><b>${cigarettes || '—'}</b><i>›</i></button>
          <button type="button" data-cat="HEATED_TOBACCO_STICKS"><span>加熱式たばこ</span><b>${heated || '—'}</b><i>›</i></button>
          <a href="#home-brands"><span>ブランド</span><b>${brands.length}</b><i>›</i></a>
        </div>
      </section>

      <section class="apple-featured" aria-labelledby="featured-title">
        <div class="apple-section-head"><div><span class="apple-eyebrow">DISCOVER</span><h2 id="featured-title">おすすめ</h2></div><a href="#jp-sku-catalog">すべて見る</a></div>
        <div class="apple-product-rail">${picks.map(card).join('')}</div>
      </section>

      <section class="apple-disclosures" aria-label="さらに探す">
        <details id="home-brands">
          <summary><span><b>ブランドから探す</b><small>${brands.length}ブランドから選ぶ</small></span><i aria-hidden="true">＋</i></summary>
          <div class="apple-disclosure-body apple-brand-grid">${brands.map((brand) => `<button type="button" data-brand="${escapeHtml(brand)}">${escapeHtml(brand)}<span>›</span></button>`).join('')}</div>
        </details>
        <details>
          <summary><span><b>商品を比較する</b><small>価格・Tar・Nicotine・包装</small></span><i aria-hidden="true">＋</i></summary>
          <div class="apple-disclosure-body apple-compare-links">
            <button type="button" data-cat="CIGARETTES">紙巻たばこを比較 <span>›</span></button>
            <a href="#jp-sku-catalog">全商品から検索 <span>›</span></a>
          </div>
        </details>
        <details>
          <summary><span><b>基礎知識</b><small>分類や表示を正しく読む</small></span><i aria-hidden="true">＋</i></summary>
          <div class="apple-disclosure-body apple-copy"><p>紙巻たばこ、加熱式、Tar・Nicotineなど、商品情報を読むための基礎をまとめています。</p><a href="#guide">ガイドを見る ›</a></div>
        </details>
        <details>
          <summary><span><b>KISARAGIについて</b><small>出典・更新・商品庫について</small></span><i aria-hidden="true">＋</i></summary>
          <div class="apple-disclosure-body apple-copy"><p>実物、分類、仕様、出典をひとつのルールで整理する20歳以上向け調査用商品庫です。販売・決済は行いません。</p><a href="#about">詳しく見る ›</a></div>
        </details>
      </section>
    </div>`;
    main.prepend(section);

    const jumpToCatalog = ({query = '', category = 'ALL', brand = null} = {}) => {
      location.hash = '#jp-sku-catalog';
      setTimeout(() => {
        const search = document.querySelector('#jp-sku-search-input');
        const categorySelect = document.querySelector('#jp-sku-category');
        if (search) { search.value = query; search.dispatchEvent(new Event('input', {bubbles:true})); }
        if (categorySelect && [...categorySelect.options].some((o) => o.value === category)) {
          categorySelect.value = category;
          categorySelect.dispatchEvent(new Event('change', {bubbles:true}));
        }
        if (brand) [...document.querySelectorAll('.jp-sku-brands button')].find((b) => b.textContent.trim() === brand)?.click();
      }, 300);
    };

    const homeSearch = section.querySelector('.apple-search input');
    homeSearch.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && homeSearch.value.trim()) jumpToCatalog({query:homeSearch.value.trim()});
    });
    section.querySelectorAll('[data-cat]').forEach((el) => el.addEventListener('click', () => jumpToCatalog({category:el.dataset.cat})));
    section.querySelectorAll('[data-brand]').forEach((el) => el.addEventListener('click', () => jumpToCatalog({brand:el.dataset.brand})));
    section.querySelectorAll('[data-open-product]').forEach((el) => el.addEventListener('click', () => {
      location.hash = '#jp-sku-catalog';
      setTimeout(() => {
        const product = document.querySelector(`.jp-sku-card[data-sku="${CSS.escape(el.dataset.openProduct)}"]`);
        product?.scrollIntoView({behavior:'smooth', block:'center'});
        product?.querySelector('.jp-sku-detail-button')?.click();
      }, 300);
    }));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => waitForCatalog(boot));
  else waitForCatalog(boot);
})();
