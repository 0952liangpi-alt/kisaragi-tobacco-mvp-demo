(() => {
  const $ = (selector) => document.querySelector(selector);
  const config = globalThis.KISARAGI_LIVE_CONFIG || {};
  const directLocal = location.hostname === '127.0.0.1' && location.port === '8767'
    ? location.origin : null;
  const apiBase = typeof config.apiBase === 'string' ? config.apiBase.replace(/\/$/, '') : directLocal;
  const requestTimeoutMs = 2500;
  let revision = 0;
  let products = [];
  let selected = null;
  let previewUrl = null;
  const status = (message, error = false) => {
    const node = $('#status');
    node.setAttribute('role', error ? 'alert' : 'status');
    node.setAttribute('aria-live', error ? 'assertive' : 'polite');
    node.textContent = message;
    node.classList.toggle('error', error);
  };
  async function request(path, options = {}) {
    if (!apiBase) throw new Error('管理データサービスは接続されていません');
    const signal = options.signal || globalThis.AbortSignal.timeout(requestTimeoutMs);
    let response;
    let data;
    try {
      response = await fetch(`${apiBase}${path}`, {
        cache: 'no-store',
        credentials: 'include',
        ...options,
        signal,
        headers: {'X-Kisaragi-Admin': '1', ...(options.headers || {})},
      });
      data = await response.json();
    } catch (error) {
      if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
        throw new Error('管理サービスの応答がタイムアウトしました');
      }
      throw error;
    }
    if (!response.ok) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function showConnectionState(state, title, message) {
    const panel = $('#connectionPanel');
    panel.hidden = false;
    panel.dataset.state = state;
    panel.querySelector('h1').textContent = title;
    $('#connectionMessage').textContent = message;
    $('#loginForm').hidden = true;
    $('#editor').hidden = true;
  }
  function showLogin() {
    $('#connectionPanel').hidden = true;
    $('#loginForm').hidden = false;
    $('#editor').hidden = true;
  }
  function showEditor() {
    $('#connectionPanel').hidden = true;
    $('#loginForm').hidden = true;
    $('#editor').hidden = false;
  }
  function failClosed(error) {
    showConnectionState(
      'offline',
      '管理サービスに接続できません',
      'この端末では管理サービスが起動していません。接続が確認できるまで、ログインと編集機能は表示しません。',
    );
    status(error.message, true);
  }
  const priceTypeLabels = {
    FIXED_LIST_PRICE: '定価',
    CATALOG_LISTED_PRICE: 'カタログ掲載価格',
    SUGGESTED_RETAIL_PRICE: '希望小売価格',
    OPEN_PRICE: 'オープン価格',
  };
  const sourceLabels = {
    JT_CATALOG_2025_10: 'JTたばこカタログ 2025年10月版',
    TSN_IMPORT_2026_04: 'TSN輸入たばこカタログ 2026年4月版（5月21日修正）',
    TSN_SMOKING_GOODS_2026: 'TSN喫煙商品カタログ 2026',
    TSN_LIGHTERS_2026: 'TSNライターカタログ 2026',
  };
  const extractionLabels = {
    SOURCE_EXTRACTED: '原典データから抽出済み',
    OCR_EXTRACTED: '公式PDFからOCR抽出済み',
    SOURCE_REVIEWED: '公式原典で確認済み',
  };
  function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || null;
    const [year, month, day] = value.split('-');
    return `${year}年${Number(month)}月${Number(day)}日`;
  }
  function showOfficialPrice(product) {
    const amount = Number.isInteger(product.official_catalog_price_jpy)
      ? `¥${product.official_catalog_price_jpy.toLocaleString('ja-JP')}` : null;
    const listedText = product.official_catalog_price_text || amount || '価格記載なし';
    const isOpenPrice = product.official_catalog_price_type === 'OPEN_PRICE' || listedText === 'オープン価格';
    const tax = isOpenPrice ? '' : product.official_catalog_price_tax_included === true ? '（税込）'
      : product.official_catalog_price_tax_included === false ? '（税別）' : '';
    $('#officialCatalogPrice').textContent = `${listedText}${tax}`;
    $('#officialCatalogPriceType').textContent = priceTypeLabels[product.official_catalog_price_type]
      || product.official_catalog_price_type || '―';
    const evidence = Array.isArray(product.official_catalog_price_evidence)
      ? product.official_catalog_price_evidence[0] : product.official_catalog_price_evidence;
    const sourcePage = evidence?.source_page ?? evidence?.pdf_page;
    const source = sourceLabels[product.official_catalog_price_source_id]
      || product.official_catalog_price_source_id || '―';
    $('#officialCatalogPriceSource').textContent = sourcePage ? `${source} · PDF ${sourcePage}ページ` : source;
    const from = formatDate(product.official_catalog_price_effective_from);
    const to = formatDate(product.official_catalog_price_effective_to);
    const asOf = formatDate(product.official_catalog_price_as_of);
    $('#officialCatalogPricePeriod').textContent = from && to ? `${from}〜${to}`
      : from ? `${from}から` : asOf ? `${asOf}時点` : '―';
    $('#officialCatalogPriceStatus').textContent = extractionLabels[product.official_catalog_price_extraction_status]
      || product.official_catalog_price_extraction_status || '―';
  }
  function choose(product) {
    selected = product;
    for (const item of $('#results').children) {
      const button = item.children?.[0];
      if (button) button.setAttribute('aria-pressed', String(button.dataset.productId === String(product.id)));
    }
    $('#detail').hidden = false;
    $('#selectionCode').textContent = product.code;
    $('#selectionCategory').textContent = product.category;
    $('#productName').value = product.product_name_ja || product.name;
    $('#price').value = product.price_jpy ?? '';
    showOfficialPrice(product);
    $('#imageFile').value = '';
    $('#packageConfirm').checked = false;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    const image = product.image?.url || product.image_url;
    $('#preview').hidden = !image;
    if (image) $('#preview').src = image;
    draw();
  }
  function draw() {
    const host = $('#results');
    host.replaceChildren();
    for (const product of products) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'result';
      button.dataset.productId = product.id;
      button.setAttribute('aria-pressed', String(selected?.id === product.id));
      const name = document.createElement('strong');
      name.textContent = product.product_name_ja || product.name;
      const code = document.createElement('small');
      code.textContent = `${product.code} · ${product.category}`;
      button.append(name, code);
      item.append(button);
      button.addEventListener('click', () => choose(product));
      host.append(item);
    }
    $('#count').textContent = `${products.length} 件`;
  }
  async function search() {
    const query = encodeURIComponent($('#search').value.trim());
    const data = await request(`/admin/api/products?q=${query}`);
    revision = data.revision;
    products = data.products;
    if (selected) selected = products.find((item) => item.id === selected.id) || null;
    if (!selected) $('#detail').hidden = true;
    draw();
  }
  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await request('/admin/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({password: $('#password').value}),
      });
      $('#password').value = '';
      await search();
      showEditor();
      status('ログインしました');
    } catch (error) {
      if (error.status === 401) {
        showLogin();
        status('管理パスワードが正しくありません', true);
      } else {
        failClosed(error);
      }
    }
  });
  $('#logout').addEventListener('click', async () => {
    try {
      await request('/admin/api/logout', {method: 'POST'});
      selected = null;
      products = [];
      $('#detail').hidden = true;
      draw();
      showLogin();
      status('ログアウトしました');
    } catch (error) { failClosed(error); }
  });
  $('#search').addEventListener('input', () => search().catch(failClosed));
  $('#productForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selected) return;
    const priceText = $('#price').value.trim();
    const price_jpy = priceText === '' ? null : Number(priceText);
    if (price_jpy !== null && (!Number.isInteger(price_jpy) || price_jpy < 0)) return status('価格は0以上の整数で入力してください', true);
    try {
      const data = await request(`/admin/api/products/${selected.id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json', 'If-Match': String(revision)},
        body: JSON.stringify({product_name_ja: $('#productName').value.trim(), price_jpy}),
      });
      revision = data.revision;
      selected = {...selected, ...data.product};
      products = products.map((item) => item.id === selected.id ? selected : item);
      draw();
      status('商品情報を保存しました。商品ページを再読み込みすると反映されます。');
    } catch (error) { status(error.message, true); }
  });
  $('#imageFile').addEventListener('change', () => {
    const file = $('#imageFile').files[0];
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = file ? URL.createObjectURL(file) : null;
    $('#preview').hidden = !previewUrl;
    if (previewUrl) $('#preview').src = previewUrl;
  });
  $('#imageForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = $('#imageFile').files[0];
    if (!selected || !file || !$('#packageConfirm').checked) return;
    try {
      const data = await request(`/admin/api/products/${selected.id}/image`, {
        method: 'PUT',
        headers: {'Content-Type': file.type, 'If-Match': String(revision)},
        body: file,
      });
      revision = data.revision;
      selected = {...selected, image: data.image};
      products = products.map((item) => item.id === selected.id ? selected : item);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      $('#preview').src = data.image.url;
      $('#imageFile').value = '';
      $('#packageConfirm').checked = false;
      status('画像を登録しました。商品ページを再読み込みすると反映されます。');
    } catch (error) { status(error.message, true); }
  });
  async function boot() {
    if (!apiBase) {
      showConnectionState(
        'not-connected',
        'クラウド管理は未接続です',
        'この公開サイトでは、商品名・価格・画像を全訪問者へ反映する保護されたデータサービスをまだ接続していません。操作できないログイン画面は表示しません。',
      );
      return;
    }
    try {
      const capabilities = await request('/admin/api/capabilities');
      const required = ['catalog.read', 'product.update', 'image.upload'];
      if (capabilities.service !== 'KISARAGI_CATALOG_ADMIN' || capabilities.status !== 'ready' ||
          !required.every((capability) => capabilities.capabilities?.includes(capability))) {
        throw new Error('管理サービスの機能確認に失敗しました');
      }
      const session = await request('/admin/api/session');
      if (!session.authenticated) {
        showLogin();
        return;
      }
      await search();
      showEditor();
      status('管理サービスに接続しました');
    } catch (error) { failClosed(error); }
  }
  boot();
})();
