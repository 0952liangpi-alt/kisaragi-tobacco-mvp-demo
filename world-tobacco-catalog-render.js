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
          <p>参照SKUとユーザー提供画像を、同じ唯一の商品データから表示しています。型番を特定できない商品は確認待ちのまま掲載します。</p>
        </div>
        <div class="jp-sku-summary" aria-label="商品庫の収録状況">
          <span><b>${audit.TOTAL_REFERENCE_SKU ?? 0}</b> 参照SKU</span>
          <span><b>${audit.TOTAL_LOCAL_SKU ?? data.length}</b> 全品項</span>
          <span><b>${new Set(data.map((product) => product.brand)).size}</b> ブランド</span>
          <span><b>${audit.TOTAL_UPLOAD_ASSETS ?? 0}</b> ユーザー画像</span>
          <span><b>${audit.IMAGE_BOUND ?? 0}</b> 画像登録</span>
          <span><b>${audit.MISSING_IMAGE ?? 0}</b> 画像未登録</span>
          <span><b>${audit.CONFLICTS ?? 0}</b> 確認待ち</span>
        </div>
        <div class="jp-sku-search">
          <label for="jp-sku-search-input">商品を検索</label>
          <input id="jp-sku-search-input" type="search" autocomplete="off" placeholder="商品名・ブランド・商品コード">
        </div>
        <div class="jp-sku-brands" role="toolbar" aria-label="ブランドで絞り込む"></div>
        <p class="jp-sku-result" aria-live="polite"></p>
        <div class="jp-sku-grid"></div>
        <p class="jp-sku-note">掲載情報は調査用資料です。販売、決済、在庫保証は行いません。</p>
      </div>`;
    anchor.insertAdjacentElement('afterend', section);

    const tabs = section.querySelector('.jp-sku-brands');
    const search = section.querySelector('#jp-sku-search-input');
    const grid = section.querySelector('.jp-sku-grid');
    const result = section.querySelector('.jp-sku-result');
    const yen = (value) => value == null ? '未登録' : `¥${Number(value).toLocaleString('ja-JP')}`;
    const statusLabels = Object.freeze({
      PRICE_CONFLICT: '価格確認待ち',
      IDENTITY_PENDING: '商品名確認待ち',
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
            const path = escapeHtml(image.file_path);
            const preservedPrice = image.observed_price_jpy != null
              ? `<span class="jp-sku-image-label">画像内の表示価格 ${yen(image.observed_price_jpy)}</span>`
              : (image.price_preserved ? '<span class="jp-sku-image-label">画像内の価格表示あり</span>' : '');
            const suffix = images.length > 1 ? ` ${index + 1}/${images.length}` : '';
            return `
              <a class="jp-sku-image jp-sku-image-verified" href="./${path}" target="_blank" rel="noopener" aria-label="${name}${suffix}の画像を原寸で見る">
                <img src="./${path}" alt="${name}${suffix}" loading="lazy" width="900" height="1200">
                ${preservedPrice}
              </a>`;
          }).join('')}
        </div>`;
    };

    let activeBrand = 'ALL';
    const draw = () => {
      const query = normalize(search.value);
      const filtered = data.filter((product) => {
        if (activeBrand !== 'ALL' && product.brand !== activeBrand) return false;
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
      const queryLabel = search.value.trim() ? ` / 「${search.value.trim()}」` : '';
      result.textContent = `${brandLabel}${queryLabel} / ${items.length}品項`;
      grid.innerHTML = items.length ? items.map((product) => `
        <article class="jp-sku-card ${product.status === 'PRICE_CONFLICT' ? 'has-conflict' : ''}" data-sku="${escapeHtml(product.id)}">
          ${imageMarkup(product)}
          <div class="jp-sku-body">
            <span class="jp-sku-brand">${escapeHtml(product.brand)}</span>
            <h3>${escapeHtml(product.product_name_ja)}</h3>
            <div class="jp-sku-meta">
              <span>税込価格<b>${yen(product.price_jpy)}</b></span>
              <span>商品コード<b>${escapeHtml(product.product_code || '未登録')}</b></span>
              ${product.pack_size != null ? `<span>包装<b>${product.pack_size}本</b></span>` : ''}
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
        </article>`).join('') : '<p class="jp-sku-empty">該当する商品はありません。検索語またはブランドを変更してください。</p>';

      grid.querySelectorAll('img').forEach((image) => {
        image.addEventListener('error', () => {
          const container = image.closest('.jp-sku-image');
          container.outerHTML = '<div class="jp-sku-image jp-sku-image-missing"><span>画像を読み込めません</span></div>';
        }, {once: true});
      });
    };

    brands.forEach((brand, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = brand === 'ALL' ? 'すべて' : brand;
      button.className = index === 0 ? 'active' : '';
      button.setAttribute('aria-pressed', String(index === 0));
      button.addEventListener('click', () => {
        activeBrand = brand;
        tabs.querySelectorAll('button').forEach((tab) => {
          const active = tab === button;
          tab.classList.toggle('active', active);
          tab.setAttribute('aria-pressed', String(active));
        });
        draw();
      });
      tabs.appendChild(button);
    });

    search.addEventListener('input', draw);
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
