(() => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]);
  const yen = (value) => value == null ? '価格未確認' : `¥${Number(value).toLocaleString('ja-JP')}`;
  const officialPriceKindLabel = (kind) => ({
    MANUFACTURER_LIST_PRICE_TAX_INCLUDED: 'メーカー定価',
    MANUFACTURER_LIST_PRICE_TAX_INCLUSIVE: 'メーカー定価',
    MANUFACTURER_LIST_PRICE: 'メーカー定価',
    FIXED_LIST_PRICE: '定価',
    CATALOG_RETAIL_PRICE: 'カタログ掲載小売価格',
    CATALOG_PRICE: 'カタログ掲載価格',
    CATALOG_LISTED_PRICE: 'カタログ掲載価格',
    SUGGESTED_RETAIL_PRICE_TAX_INCLUDED: '希望小売価格',
    SUGGESTED_RETAIL_PRICE_TAX_INCLUSIVE: '希望小売価格',
    SUGGESTED_RETAIL_PRICE: '希望小売価格',
    OPEN_PRICE: 'オープン価格',
  })[String(kind || '').toUpperCase()] || '公式カタログ価格';
  const officialPrice = (product) => {
    const rawAmount = product.official_catalog_price_jpy;
    const amount = rawAmount != null && Number.isFinite(Number(rawAmount)) ? Number(rawAmount) : null;
    const kind = String(product.official_catalog_price_kind || product.official_catalog_price_type || '').toUpperCase();
    const open = kind === 'OPEN_PRICE' || String(product.official_catalog_price_text || '').includes('オープン価格');
    return {amount, open, kindLabel:officialPriceKindLabel(kind)};
  };
  const officialPriceStatus = (product) => product.official_catalog_price_verification || product.official_catalog_price_extraction_status || null;
  const officialPricePeriod = (product) => [
    product.official_catalog_price_valid_from || product.official_catalog_price_effective_from,
    product.official_catalog_price_valid_until || product.official_catalog_price_effective_to,
  ].filter(Boolean).join(' ～ ');
  const officialPriceStatusLabel = (product) => ({
    SOURCE_VERIFIED:'資料原文確認済み', SOURCE_REVIEWED:'資料原文確認済み', SOURCE_EXTRACTED:'資料原文抽出済み', SOURCE_TEXT:'資料原文抽出済み',
    OCR_REVIEWED:'OCR確認済み', OCR_EXTRACTED:'公式PDFからOCR抽出済み', OCR_REVIEW_REQUIRED:'OCR確認待ち',
  })[String(officialPriceStatus(product) || '').toUpperCase()] || officialPriceStatus(product) || null;
  const publicPrice = (product) => {
    if (product.price_jpy != null) return {text:yen(product.price_jpy), label:'管理者設定の表示価格', note:'注文時は承認済み販売価格をサーバーで再確認します'};
    const official = officialPrice(product);
    const tax = product.official_catalog_price_tax_included === true ? '税込' : product.official_catalog_price_tax_included === false ? '税別' : '税区分記載なし';
    const extractionStatus = String(officialPriceStatus(product) || '').toUpperCase();
    const sourceNote = extractionStatus === 'OCR_EXTRACTED'
      ? '・公式PDF OCR抽出' : /OCR_REVIEW_REQUIRED|PENDING/.test(extractionStatus) ? '・OCR確認待ち' : '';
    if (official.amount != null) return {text:yen(official.amount), label:`${official.kindLabel}（${tax}${sourceNote}）`, note:'参考情報・承認済み販売価格ではありません'};
    if (official.open) return {text:'オープン価格', label:`${official.kindLabel}${sourceNote ? `（${sourceNote.slice(1)}）` : ''}`, note:'販売価格は事業者確認・承認後に確定します'};
    return {text:'価格未登録', label:'販売価格未承認', note:'注文に使用できる価格は登録されていません'};
  };
  const categoryLabels = Object.freeze({
    CIGARETTES: '紙巻たばこ',
    HEATED_TOBACCO_STICKS: '加熱式たばこ',
    HEATED_TOBACCO_DEVICES: '加熱式デバイス',
    HEATED_TOBACCO_CAPSULES: '加熱式たばこカプセル',
    SMOKELESS_TOBACCO: '無煙たばこ',
    CIGARS: '葉巻たばこ',
    JAPANESE_CIGARETTES: '日本の紙巻たばこ',
    IMPORTED_CIGARETTES: '輸入紙巻たばこ',
    RYO: '手巻たばこ',
    PIPE_TOBACCO: 'パイプたばこ',
    CUT_TOBACCO: '刻みたばこ',
    ROLLING_ACCESSORIES: '手巻き喫煙具',
    PIPE_ACCESSORIES: 'パイプ用品',
    ASHTRAYS: '携帯灰皿',
    LIGHTERS: 'ライター',
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
        const version = /^[a-f0-9]{64}$/i.test(image.sha256 || '') ? image.sha256.slice(0, 12) : null;
        const sourcePath = version ? `${image.file_path}${image.file_path.includes('?') ? '&' : '?'}v=${version}` : image.file_path;
        const path = escapeHtml(/^https?:\/\//.test(sourcePath) ? sourcePath : `./${sourcePath}`);
        const suffix = images.length > 1 ? ` ${index + 1}/${images.length}` : '';
        return `<a class="jp-product-detail-image" href="${path}" target="_blank" rel="noopener"><img src="${path}" alt="${escapeHtml(product.product_name_ja)}${suffix}"></a>`;
      }).join('')}</div>`;
    };

    const metaRow = (label, value) => value == null || value === '' ? '' : `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`;

    const openProduct = (product) => {
      const related = catalog.filter((item) => item.id !== product.id && item.brand === product.brand).slice(0, 4);
      const displayPrice = publicPrice(product);
      const official = officialPrice(product);
      const taxLabel = product.official_catalog_price_tax_included === true ? '税込' : product.official_catalog_price_tax_included === false ? '税別' : '税区分記載なし';
      const validity = officialPricePeriod(product);
      const evidenceValue = product.official_catalog_price_evidence;
      const evidenceList = Array.isArray(evidenceValue) ? evidenceValue : (evidenceValue ? [evidenceValue] : []);
      const evidence = evidenceList[0];
      const evidencePage = evidence && typeof evidence === 'object'
        ? evidence.source_page ?? evidence.page ?? evidence.pdf_page ?? evidence.catalog_page ?? product.manufacturer_pdf_page ?? product.pdf_page
        : product.manufacturer_pdf_page ?? product.pdf_page;
      const evidenceSummary = evidenceList.map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const page = entry.source_page ?? entry.page ?? entry.pdf_page ?? entry.catalog_page;
        return `${entry.source_id || '資料'}${page != null ? ` p.${page}` : ''}`;
      }).filter(Boolean).join(' / ');
      const sourceRegistry = Object.values(globalThis.KISARAGI_SOURCE_REGISTRY || {});
      const officialSource = sourceRegistry.find((entry) => (entry.id || entry.source_id) === product.official_catalog_price_source_id);
      const officialSourceUrl = officialSource?.url || officialSource?.source_url;
      const sourceLinks = [
        officialSourceUrl ? `<a href="${escapeHtml(officialSourceUrl)}" target="_blank" rel="noopener noreferrer">価格資料の出典を開く ↗</a>` : '',
        product.source_url ? `<a href="${escapeHtml(product.source_url)}" target="_blank" rel="noopener noreferrer">商品情報の出典を開く ↗</a>` : '',
        product.manufacturer_source_url && product.manufacturer_source_url !== product.source_url
          ? `<a href="${escapeHtml(product.manufacturer_source_url)}" target="_blank" rel="noopener noreferrer">メーカー資料を開く ↗</a>` : '',
      ].filter(Boolean).join('');
      content.innerHTML = `
        <div class="jp-product-detail-grid">
          <div>${imageBlock(product)}</div>
          <div class="jp-product-detail-copy">
            <span class="jp-product-detail-kicker">${escapeHtml(product.brand && product.brand !== 'UNKNOWN' ? product.brand : 'ブランド確認中')}</span>
            <h2 id="jp-product-detail-title">${escapeHtml(product.product_name_ja || '商品名未登録')}</h2>
            <p class="jp-product-detail-price"><small>${escapeHtml(displayPrice.label)}</small><b>${escapeHtml(displayPrice.text)}</b><small>${escapeHtml(displayPrice.note)}</small></p>
            <dl class="jp-product-detail-meta">
              ${metaRow('品類', categoryLabels[product.category] || product.category)}
              ${metaRow('商品コード', product.product_code || product.sku)}
              ${metaRow('System Code', product.system_code)}
              ${metaRow('包装', product.pack_size != null ? `${product.pack_size}${product.pack_unit || '本'}` : null)}
              ${metaRow('Tar', product.tar_mg != null ? `${product.tar_mg}mg` : null)}
              ${metaRow('Nicotine', product.nicotine_mg != null ? `${product.nicotine_mg}mg` : null)}
              ${metaRow('公式カタログ価格', official.amount != null ? yen(official.amount) : official.open ? 'オープン価格' : null)}
              ${metaRow('価格区分', product.official_catalog_price_kind || product.official_catalog_price_type ? `${official.kindLabel} / ${taxLabel}` : null)}
              ${metaRow('価格基準日', product.official_catalog_price_as_of)}
              ${metaRow('価格有効期間', validity)}
              ${metaRow('価格資料', product.official_catalog_price_source_id)}
              ${metaRow('価格掲載ページ', evidencePage)}
              ${metaRow('価格根拠資料', evidenceSummary)}
              ${metaRow('価格根拠件数', evidenceList.length > 1 ? `${evidenceList.length}件（新しい基準日を優先表示）` : null)}
              ${metaRow('価格確認状態', officialPriceStatusLabel(product))}
              ${metaRow('原産国', product.origin_country && product.origin_country !== 'UNKNOWN' ? product.origin_country : null)}
              ${metaRow('状態', statusLabels[product.status] || '確認待ち')}
            </dl>
            <div class="jp-product-detail-source">
              ${sourceLinks || '<span>ユーザー提供資料</span>'}
            </div>
            ${product.status !== 'PRICE_CONFLICT'
              ? `<a class="jp-product-detail-shop" href="./shop.html?sku=${encodeURIComponent(product.id)}#catalog">商品案内で選択する →</a>`
              : ''}
          </div>
        </div>
        ${related.length ? `<div class="jp-product-related"><h3>同じブランドの商品</h3><div>${related.map((item) => `<button type="button" data-related-id="${escapeHtml(item.id)}"><span>${escapeHtml(item.product_name_ja)}</span><b>${escapeHtml(publicPrice(item).text)}</b></button>`).join('')}</div></div>` : ''}
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
    const linkedSku = new URLSearchParams(window.location.search).get('sku');
    const linkedProduct = linkedSku && catalog.find((item) => item.id === linkedSku);
    if (linkedProduct) {
      const gate = document.getElementById('age');
      const openLinked = () => { if (!gate || gate.classList.contains('hide')) openProduct(linkedProduct); };
      if (gate && !gate.classList.contains('hide')) {
        gate.querySelector('#enter')?.addEventListener('click', () => window.setTimeout(openLinked, 0), {once: true});
      } else openLinked();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(mount, 0));
  else setTimeout(mount, 0);
})();
