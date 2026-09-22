(() => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character]);

  const boot = () => {
    const data = globalThis.KISARAGI_CANONICAL_CATALOG || [];
    const audit = globalThis.KISARAGI_CATALOG_AUDIT || {};
    if (!Array.isArray(data) || !data.length) return;

    const anchor = document.getElementById('archive');
    if (!anchor || document.getElementById('jp-sku-catalog')) return;

    const brands = ['ALL', ...new Set(data.map((product) => product.brand).filter(Boolean))];
    const categoryLabels = Object.freeze({
      CIGARETTES: '紙巻たばこ',
      IMPORTED_CIGARETTES: '輸入紙巻たばこ',
      CIGARS: '葉巻たばこ',
      RYO: '手巻たばこ',
      PIPE_TOBACCO: 'パイプたばこ',
      CUT_TOBACCO: '刻みたばこ',
      HEATED_TOBACCO_STICKS: '加熱式たばこ',
      HEATED_TOBACCO_CAPSULES: '加熱式たばこカプセル',
      HEATED_TOBACCO_DEVICES: '加熱式デバイス',
      SMOKELESS_TOBACCO: '無煙たばこ',
      JAPANESE_CIGARETTES: '日本の紙巻たばこ',
      ROLLING_ACCESSORIES: '手巻き喫煙具',
      PIPE_ACCESSORIES: 'パイプ用品',
      ASHTRAYS: '携帯灰皿',
      LIGHTERS: 'ライター',
    });
    const categories = [...new Set(data.map((product) => product.category).filter(Boolean))];
    const section = document.createElement('section');
    section.id = 'jp-sku-catalog';
    section.className = 'jp-sku-section';
    section.tabIndex = -1;
    section.innerHTML = `
      <div class="jp-sku-wrap">
        <div class="jp-sku-head">
          <div>
            <span class="jp-sku-kicker">CANONICAL PRODUCT CATALOG</span>
            <h2>商品庫<br>${audit.TOTAL_LOCAL_SKU ?? data.length}品項。</h2>
          </div>
          <p>JTたばこ、TSN取扱たばこ、喫煙商品、ライターを同じ商品データで整理しています。商品名や価格を照合中の品目は確認待ちとして掲載します。</p>
        </div>
        <div class="jp-sku-summary" aria-label="商品庫の収録状況">
          <span><b>${audit.TOTAL_REFERENCE_SKU ?? 0}</b> 参照SKU</span>
          <span><b>${audit.TOTAL_LOCAL_SKU ?? data.length}</b> 全品項</span>
          <span><b>${new Set(data.map((product) => product.brand)).size}</b> ブランド</span>
          <span><b>${audit.TOTAL_UPLOAD_ASSETS ?? 0}</b> ユーザー画像</span>
          <span><b>${audit.IMAGE_BOUND ?? 0}</b> 画像登録</span>
          <span><b>${audit.MISSING_IMAGE ?? 0}</b> 画像未登録</span>
          <span><b>${audit.IDENTITY_PENDING ?? 0}</b> 商品名確認待ち</span>
          <span><b>${audit.CONFLICTS ?? 0}</b> 画像照合競合</span>
        </div>
        <div class="jp-sku-controls" aria-label="商品絞り込み">
          <div class="jp-sku-search">
            <label for="jp-sku-search-input">商品を検索</label>
            <input id="jp-sku-search-input" type="search" autocomplete="off" placeholder="商品名・ブランド・商品コード">
          </div>
          <div class="jp-sku-select">
            <label for="jp-sku-category">品類</label>
            <select id="jp-sku-category">
              <option value="ALL">すべての品類</option>
              ${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(categoryLabels[category] || category)}</option>`).join('')}
            </select>
          </div>
          <div class="jp-sku-select">
            <label for="jp-sku-brand">ブランド</label>
            <select id="jp-sku-brand">
              ${brands.map((brand) => `<option value="${escapeHtml(brand)}">${brand === 'ALL' ? 'すべてのブランド' : escapeHtml(brand === 'UNKNOWN' ? 'ブランド未登録' : brand)}</option>`).join('')}
            </select>
          </div>
          <div class="jp-sku-select">
            <label for="jp-sku-image-filter">画像</label>
            <select id="jp-sku-image-filter">
              <option value="ALL">すべて</option>
              <option value="BOUND">画像登録済み</option>
              <option value="MISSING">画像未登録</option>
            </select>
          </div>
          <button class="jp-sku-reset" type="button">条件をクリア</button>
        </div>
        <p class="jp-sku-result" aria-live="polite"></p>
        <div class="jp-sku-grid"></div>
        <button class="jp-sku-more" type="button" hidden>さらに表示</button>
        <p class="jp-sku-note">掲載情報は調査用資料です。販売、決済、在庫保証は行いません。</p>
      </div>`;
    anchor.insertAdjacentElement('afterend', section);

    const search = section.querySelector('#jp-sku-search-input');
    const categorySelect = section.querySelector('#jp-sku-category');
    const brandSelect = section.querySelector('#jp-sku-brand');
    const imageSelect = section.querySelector('#jp-sku-image-filter');
    const resetButton = section.querySelector('.jp-sku-reset');
    const grid = section.querySelector('.jp-sku-grid');
    const result = section.querySelector('.jp-sku-result');
    const moreButton = section.querySelector('.jp-sku-more');
    const pageSize = 24;
    const yen = (value) => value == null ? '未登録' : `¥${Number(value).toLocaleString('ja-JP')}`;
    const statusLabels = Object.freeze({
      PRICE_CONFLICT: '価格確認待ち',
      IDENTITY_PENDING: '資料転記・現行未確認',
      IMAGE_BOUND: '画像登録済み',
      CATALOG_ONLY: '画像未登録',
    });
    const normalize = (value) => String(value ?? '')
      .normalize('NFKC')
      .toLocaleLowerCase('ja')
      .replace(/\s+/g, '');

    const imageMarkup = (product) => {
      const images = product.images?.length ? product.images : (product.image ? [product.image] : []);
      if (!images.length) {
        return '<div class="jp-sku-image jp-sku-image-missing"><span>画像未登録</span></div>';
      }

      const name = escapeHtml(product.product_name_ja);
      return `
        <div class="jp-sku-images ${images.length > 1 ? 'is-gallery' : ''}">
          ${images.map((image, index) => {
            const sourcePath = /^https?:\/\//.test(image.file_path) ? image.file_path : `./${image.file_path}`;
            const version = /^[a-f0-9]{64}$/i.test(image.sha256 || '') ? image.sha256.slice(0, 12) : null;
            const path = escapeHtml(version ? `${sourcePath}${sourcePath.includes('?') ? '&' : '?'}v=${version}` : sourcePath);
            const cropClass = image.display_crop === 'SIDE_MATTE_30PX' ? ' has-side-matte' : '';
            const preservedPrice = image.observed_price_jpy != null
              ? `<span class="jp-sku-image-label">画像内の表示価格 ${yen(image.observed_price_jpy)}</span>`
              : (image.price_preserved ? '<span class="jp-sku-image-label">画像内の価格表示あり</span>' : '');
            const suffix = images.length > 1 ? ` ${index + 1}/${images.length}` : '';
            return `
              <a class="jp-sku-image jp-sku-image-verified${cropClass}" href="${path}" target="_blank" rel="noopener" aria-label="${name}${suffix}の画像を原寸で見る">
                <img src="${path}" alt="${name}${suffix}" loading="lazy" width="900" height="1200">
                ${preservedPrice}
              </a>`;
          }).join('')}
        </div>`;
    };

    let visibleCount = pageSize;
    const draw = (keepVisibleCount = false) => {
      if (keepVisibleCount !== true) visibleCount = pageSize;
      const query = normalize(search.value);
      const activeBrand = brandSelect.value;
      const activeCategory = categorySelect.value;
      const imageFilter = imageSelect.value;
      const filtered = data.filter((product) => {
        if (activeBrand !== 'ALL' && product.brand !== activeBrand) return false;
        if (activeCategory !== 'ALL' && product.category !== activeCategory) return false;
        const hasImage = Boolean(product.image || product.images?.length);
        if (imageFilter === 'BOUND' && !hasImage) return false;
        if (imageFilter === 'MISSING' && hasImage) return false;
        if (!query) return true;
        return normalize([
          product.product_name_ja,
          product.product_name_en,
          product.brand,
          product.product_code,
          product.sku,
        ].join(' ')).includes(query);
      });
      const items = [...filtered].sort((left, right) => (
        Number(Boolean(right.image)) - Number(Boolean(left.image)) ||
        left.product_name_ja.localeCompare(right.product_name_ja, 'ja')
      ));

      const brandLabel = activeBrand === 'ALL' ? 'すべてのブランド' : activeBrand;
      const categoryLabel = activeCategory === 'ALL' ? '' : ` / ${categoryLabels[activeCategory] || activeCategory}`;
      const imageLabel = imageFilter === 'BOUND' ? ' / 画像登録済み' : imageFilter === 'MISSING' ? ' / 画像未登録' : '';
      const queryLabel = search.value.trim() ? ` / 「${search.value.trim()}」` : '';
      const shownCount = Math.min(items.length, visibleCount);
      result.textContent = `${brandLabel}${categoryLabel}${imageLabel}${queryLabel} / ${items.length}品項中${shownCount}件表示`;
      moreButton.hidden = shownCount >= items.length;
      moreButton.textContent = `さらに${Math.min(pageSize, items.length - shownCount)}件表示`;
      grid.innerHTML = items.length ? items.slice(0, shownCount).map((product) => `
        <article class="jp-sku-card ${product.status === 'PRICE_CONFLICT' ? 'has-conflict' : ''}" data-sku="${escapeHtml(product.id)}">
          ${imageMarkup(product)}
          <div class="jp-sku-body">
            <span class="jp-sku-brand">${escapeHtml(product.brand === 'UNKNOWN' ? 'ブランド確認中' : product.brand)}</span>
            <h3>${escapeHtml(product.product_name_ja)}</h3>
            <div class="jp-sku-meta">
              <span>参考税込価格<b>${product.price_jpy == null ? '未確認' : yen(product.price_jpy)}</b></span>
              <span>商品コード<b>${escapeHtml(product.product_code || '未登録')}</b></span>
              ${product.historical_list_price_jpy != null ? `<span>${product.ocr_list_price_candidate_jpy != null ? '資料価格候補' : '資料掲載価格'}（${escapeHtml(product.historical_price_as_of || '日付未確認')}・現行未確認）<b>${yen(product.historical_list_price_jpy)}</b></span>` : ''}
              ${product.pack_size != null ? `<span>包装<b>${product.pack_size}${escapeHtml(product.pack_unit || '本')}</b></span>` : ''}
              ${product.tar_mg != null ? `<span>Tar<b>${product.tar_mg}mg</b></span>` : ''}
              ${product.nicotine_mg != null ? `<span>Nicotine<b>${product.nicotine_mg}mg</b></span>` : ''}
            </div>
            <div class="jp-sku-source">
              <span>${escapeHtml(statusLabels[product.status] || '確認待ち')}</span>
              ${product.source_url
                ? `<a href="${escapeHtml(product.source_url)}" target="_blank" rel="noopener noreferrer">商品情報の出典</a>`
                : '<span>提供画像</span>'}
            </div>
          </div>
        </article>`).join('') : '<p class="jp-sku-empty">該当する商品はありません。検索語または絞り込み条件を変更してください。</p>';

      grid.querySelectorAll('img').forEach((image) => {
        image.addEventListener('error', () => {
          const container = image.closest('.jp-sku-image');
          container.outerHTML = '<div class="jp-sku-image jp-sku-image-missing"><span>画像を読み込めません</span></div>';
        }, {once: true});
      });
    };

    search.addEventListener('input', draw);
    categorySelect.addEventListener('change', draw);
    brandSelect.addEventListener('change', draw);
    imageSelect.addEventListener('change', draw);
    moreButton.addEventListener('click', () => {
      visibleCount += pageSize;
      draw(true);
    });
    resetButton.addEventListener('click', () => {
      search.value = '';
      categorySelect.value = 'ALL';
      brandSelect.value = 'ALL';
      imageSelect.value = 'ALL';
      draw();
      search.focus();
    });

    const linkedSku = new URLSearchParams(window.location.search).get('sku');
    const linkedProduct = linkedSku && data.find((product) => product.id === linkedSku);
    if (linkedProduct) search.value = linkedProduct.sku || linkedProduct.product_code || linkedProduct.product_name_ja;
    draw();
    const dockVisibilityObserver = new IntersectionObserver((entries) => {
      const catalogVisible = entries.some((entry) => entry.isIntersecting);
      document.body.classList.toggle('catalog-browsing', catalogVisible);
    }, {rootMargin: '-5% 0px -5%'});
    dockVisibilityObserver.observe(section);

    if (window.location.hash === '#jp-sku-catalog') {
      requestAnimationFrame(() => section.scrollIntoView({block: 'start'}));
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
