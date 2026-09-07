(() => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]);
  const yen = (value) => value == null ? '未登録' : `¥${Number(value).toLocaleString('ja-JP')}`;
  const categoryLabels = Object.freeze({
    CIGARETTES: '紙巻たばこ',
    HEATED_TOBACCO_STICKS: '加熱式たばこ',
    HEATED_TOBACCO_DEVICES: '加熱式デバイス',
    JAPANESE_CIGARETTES: '日本の紙巻たばこ',
  });
  const statusLabels = Object.freeze({
    PRICE_CONFLICT: '価格確認待ち',
    IDENTITY_PENDING: '商品名確認待ち',
    IMAGE_BOUND: '画像登録済み',
    CATALOG_ONLY: '画像未登録',
  });

  const mount = () => {
    const catalog = globalThis.KISARAGI_CANONICAL_CATALOG || [];
    const grid = document.querySelector('.jp-sku-grid');
    if (!Array.isArray(catalog) || !catalog.length || !grid || document.getElementById('jp-product-detail')) return;

    const dialog = document.createElement('dialog');
    dialog.id = 'jp-product-detail';
    dialog.className = 'jp-product-detail';
    dialog.setAttribute('aria-labelledby', 'jp-product-detail-title');
    dialog.innerHTML = '<div class="jp-product-detail-shell"><button class="jp-product-detail-close" type="button" aria-label="閉じる">×</button><div class="jp-product-detail-content"></div></div>';
    document.body.appendChild(dialog);
    const content = dialog.querySelector('.jp-product-detail-content');
    const closeButton = dialog.querySelector('.jp-product-detail-close');

    const imageBlock = (product) => {
      const images = product.images?.length ? product.images : (product.image ? [product.image] : []);
      if (!images.length) return '<div class="jp-product-detail-image is-missing">画像未登録</div>';
      return `<div class="jp-product-detail-gallery">${images.map((image, index) => {
        const path = escapeHtml(image.file_path);
        const suffix = images.length > 1 ? ` ${index + 1}/${images.length}` : '';
        return `<a class="jp-product-detail-image" href="./${path}" target="_blank" rel="noopener"><img src="./${path}" alt="${escapeHtml(product.product_name_ja)}${suffix}"></a>`;
      }).join('')}</div>`;
    };

    const metaRow = (label, value) => value == null || value === '' ? '' : `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`;

    const openProduct = (product) => {
      const related = catalog.filter((item) => item.id !== product.id && item.brand === product.brand).slice(0, 4);
      content.innerHTML = `
        <div class="jp-product-detail-grid">
          <div>${imageBlock(product)}</div>
          <div class="jp-product-detail-copy">
            <span class="jp-product-detail-kicker">${escapeHtml(product.brand || '未登録')}</span>
            <h2 id="jp-product-detail-title">${escapeHtml(product.product_name_ja || '商品名未登録')}</h2>
            <p class="jp-product-detail-price">${yen(product.price_jpy)}</p>
            <dl class="jp-product-detail-meta">
              ${metaRow('品類', categoryLabels[product.category] || product.category)}
              ${metaRow('商品コード', product.product_code || product.sku)}
              ${metaRow('System Code', product.system_code)}
              ${metaRow('包装', product.pack_size != null ? `${product.pack_size}本` : null)}
              ${metaRow('Tar', product.tar_mg != null ? `${product.tar_mg}mg` : null)}
              ${metaRow('Nicotine', product.nicotine_mg != null ? `${product.nicotine_mg}mg` : null)}
              ${metaRow('原産国', product.origin_country && product.origin_country !== 'UNKNOWN' ? product.origin_country : null)}
              ${metaRow('状態', statusLabels[product.status] || '確認待ち')}
            </dl>
            <div class="jp-product-detail-source">
              ${product.source_url ? `<a href="${escapeHtml(product.source_url)}" target="_blank" rel="noopener noreferrer">商品情報の出典を開く ↗</a>` : '<span>ユーザー提供資料</span>'}
            </div>
          </div>
        </div>
        ${related.length ? `<div class="jp-product-related"><h3>同じブランドの商品</h3><div>${related.map((item) => `<button type="button" data-related-id="${escapeHtml(item.id)}"><span>${escapeHtml(item.product_name_ja)}</span><b>${yen(item.price_jpy)}</b></button>`).join('')}</div></div>` : ''}
      `;
      if (!dialog.open) dialog.showModal();
      document.body.classList.add('product-detail-open');
      content.querySelectorAll('[data-related-id]').forEach((button) => button.addEventListener('click', () => {
        const next = catalog.find((item) => item.id === button.dataset.relatedId);
        if (next) openProduct(next);
      }));
    };

    const decorateCards = () => {
      grid.querySelectorAll('.jp-sku-card').forEach((card) => {
        if (card.querySelector('.jp-sku-detail-btn')) return;
        const product = catalog.find((item) => item.id === card.dataset.sku);
        if (!product) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'jp-sku-detail-btn';
        button.textContent = '詳細を見る';
        button.addEventListener('click', () => openProduct(product));
        card.querySelector('.jp-sku-body')?.appendChild(button);
      });
    };

    decorateCards();
    new MutationObserver(decorateCards).observe(grid, {childList: true});
    closeButton.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => document.body.classList.remove('product-detail-open'));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && dialog.open) dialog.close(); });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(mount, 0));
  else setTimeout(mount, 0);
})();
