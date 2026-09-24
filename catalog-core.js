(() => {
  const references = globalThis.KISARAGI_JAPAN_SKUS || [];
  const jtProducts = globalThis.KISARAGI_JT_2025_SKUS || [];
  const jtSource = globalThis.KISARAGI_JT_2025_SOURCE || null;
  const tsnProducts = globalThis.KISARAGI_TSN_2026_SKUS || [];
  const tsnSource = globalThis.KISARAGI_TSN_2026_SOURCE || null;
  const goodsProducts = globalThis.KISARAGI_TSN_GOODS_2026_SKUS || [];
  const goodsSources = globalThis.KISARAGI_TSN_GOODS_2026_SOURCE || {};
  const liveOverrides = globalThis.KISARAGI_LIVE_OVERRIDES || {};
  const liveApiBase = globalThis.KISARAGI_LIVE_CONFIG?.apiBase || null;
  const liveSaleAuthorityUnavailable = Boolean(liveApiBase) && globalThis.KISARAGI_LIVE_STATUS !== 'LIVE';
  const liveProjectedIds = Array.isArray(globalThis.KISARAGI_LIVE_PROJECTED_IDS)
    ? new Set(globalThis.KISARAGI_LIVE_PROJECTED_IDS) : null;
  const jtByCode = new Map(jtProducts.map((product) => [product.code, product]));
  if (jtByCode.size !== jtProducts.length) throw new Error('Duplicate JT manufacturer product code');
  const tsnByCode = new Map(tsnProducts.map((product) => [product.code, product]));
  if (tsnByCode.size !== tsnProducts.length) throw new Error('Duplicate TSN product code');
  const goodsCodes = new Set(goodsProducts.map((product) => product.code));
  if (goodsCodes.size !== goodsProducts.length) throw new Error('Duplicate TSN goods product code');
  const referenceCodes = new Set(references.map((product) => product.code));
  const existingCodes = new Set([...referenceCodes, ...jtProducts.map((product) => product.code)]);
  if (goodsProducts.some((product) => existingCodes.has(product.code) || tsnByCode.has(product.code))) {
    throw new Error('TSN goods product code overlaps an existing SKU');
  }

  const sources = Object.freeze({
    ADMIN_UPLOAD: Object.freeze({id: 'ADMIN_UPLOAD', priority: 120}),
    USER_UPLOAD: Object.freeze({id: 'USER_UPLOAD', priority: 100}),
    LOCAL_VERIFIED_IMAGE: Object.freeze({id: 'LOCAL_VERIFIED_IMAGE', priority: 80}),
    WORLD_TOBACCO: Object.freeze({
      id: 'WORLD_TOBACCO',
      priority: 60,
      url: 'https://www.world-tobacco.jp/view/category/ct5',
    }),
    JT_CATALOG_2025_10: Object.freeze({
      id: 'JT_CATALOG_2025_10',
      priority: 65,
      url: jtSource?.source_url || null,
      price_as_of: jtSource?.price_as_of || null,
      price_kind: jtSource?.official_catalog_price_type || 'FIXED_LIST_PRICE',
      price_tax_mode: 'INCLUDED',
      pdf_sha256: jtSource?.pdf_sha256 || null,
      image_permission_basis: jtSource?.image_permission_basis || null,
    }),
    TSN_IMPORT_2026_04: Object.freeze({
      id: 'TSN_IMPORT_2026_04',
      priority: 64,
      url: tsnSource?.source_url || null,
      price_as_of: tsnSource?.price_as_of || null,
      price_kind: tsnSource?.official_catalog_price_type || 'CATALOG_LISTED_PRICE',
      price_tax_mode: 'UNSPECIFIED',
      pdf_sha256: tsnSource?.pdf_sha256 || null,
      image_permission_basis: tsnSource?.image_permission_basis || null,
    }),
    TSN_SMOKING_GOODS_2026: Object.freeze({
      id: 'TSN_SMOKING_GOODS_2026',
      priority: 64,
      url: goodsSources.SMOKING_GOODS?.source_url || null,
      pdf_sha256: goodsSources.SMOKING_GOODS?.pdf_sha256 || null,
      identity_status: goodsSources.SMOKING_GOODS?.identity_status || null,
      price_kind: 'SUGGESTED_RETAIL_PRICE',
      price_tax_mode: 'INCLUDED',
      price_effective_from: goodsSources.SMOKING_GOODS?.price_effective_from || null,
      price_effective_to: goodsSources.SMOKING_GOODS?.price_effective_to || null,
    }),
    TSN_LIGHTERS_2026: Object.freeze({
      id: 'TSN_LIGHTERS_2026',
      priority: 64,
      url: goodsSources.LIGHTERS?.source_url || null,
      pdf_sha256: goodsSources.LIGHTERS?.pdf_sha256 || null,
      identity_status: goodsSources.LIGHTERS?.identity_status || null,
      price_kind: 'SUGGESTED_RETAIL_PRICE',
      price_tax_mode: 'MIXED',
      price_effective_from: goodsSources.LIGHTERS?.price_effective_from || null,
      price_effective_to: goodsSources.LIGHTERS?.price_effective_to || null,
    }),
    CLUB_JT: Object.freeze({id: 'CLUB_JT', priority: 70}),
    OTHER_APPROVED_SOURCE: Object.freeze({id: 'OTHER_APPROVED_SOURCE', priority: 50}),
  });

  const officialPriceFact = (product, sourceId, source, fallback = {}) => {
    if (!product || !source) return null;
    const amount = Number.isInteger(product.official_catalog_price_jpy)
      ? product.official_catalog_price_jpy
      : Number.isInteger(product.historical_list_price_jpy)
        ? product.historical_list_price_jpy
        : Number.isInteger(product.ocr_list_price_candidate_jpy)
          ? product.ocr_list_price_candidate_jpy
          : null;
    const priceText = product.official_catalog_price_text || null;
    const priceKind = product.official_catalog_price_type || fallback.priceKind || source.price_kind || null;
    const openPrice = priceKind === 'OPEN_PRICE' || priceText === 'オープン価格';
    if (amount == null && !openPrice) return null;
    const taxIncluded = typeof product.official_catalog_price_tax_included === 'boolean'
      ? product.official_catalog_price_tax_included
      : fallback.taxIncluded;
    const asOf = product.official_catalog_price_as_of || source.price_as_of || fallback.asOf || null;
    const effectiveFrom = product.official_catalog_price_effective_from
      || source.price_effective_from || fallback.effectiveFrom || null;
    const effectiveTo = product.official_catalog_price_effective_to
      || source.price_effective_to || fallback.effectiveTo || null;
    return Object.freeze({
      amount_jpy: amount,
      price_text: openPrice ? 'オープン価格' : (priceText || null),
      pricing_mode: openPrice ? 'OPEN_PRICE' : 'AMOUNT',
      price_kind: openPrice ? 'OPEN_PRICE' : priceKind,
      tax_mode: taxIncluded === true ? 'INCLUDED' : taxIncluded === false ? 'EXCLUDED' : 'UNSPECIFIED',
      currency: 'JPY',
      as_of: asOf,
      effective_from: effectiveFrom,
      effective_to: effectiveTo,
      source_id: product.official_catalog_price_source_id || sourceId,
      source_sha256: source.pdf_sha256 || null,
      source_page: product.pdf_page ?? null,
      source_product_code: product.code,
      authority: 'OFFICIAL_CLIENT_CATALOG',
      capture_status: product.official_catalog_price_extraction_status
        || fallback.captureStatus || 'SOURCE_TEXT',
      visibility: 'PUBLIC',
    });
  };

  const priceFactsForCode = (code) => Object.freeze([
    officialPriceFact(jtByCode.get(code), 'JT_CATALOG_2025_10', jtSource, {
      priceKind: 'FIXED_LIST_PRICE', taxIncluded: true, asOf: '2025-10-01', captureStatus: 'SOURCE_TEXT',
    }),
    officialPriceFact(tsnByCode.get(code), 'TSN_IMPORT_2026_04', tsnSource, {
      priceKind: 'CATALOG_LISTED_PRICE', taxIncluded: null, asOf: '2026-05-21', captureStatus: 'SOURCE_TEXT',
    }),
  ].filter(Boolean));

  const officialPriceFields = (facts) => {
    const evidence = Object.freeze([...facts].sort((left, right) => {
      const leftDate = left.effective_from || left.as_of || '';
      const rightDate = right.effective_from || right.as_of || '';
      return rightDate.localeCompare(leftDate) || right.source_id.localeCompare(left.source_id);
    }));
    const primary = evidence[0] || null;
    const taxIncluded = primary?.tax_mode === 'INCLUDED'
      ? true : primary?.tax_mode === 'EXCLUDED' ? false : null;
    return {
      official_catalog_price_jpy: primary?.amount_jpy ?? null,
      official_catalog_price_text: primary?.price_text || null,
      official_catalog_price_kind: primary?.price_kind || null,
      official_catalog_price_type: primary?.price_kind || null,
      official_catalog_price_tax_included: taxIncluded,
      official_catalog_price_tax_mode: primary?.tax_mode || null,
      official_catalog_price_as_of: primary?.as_of || null,
      official_catalog_price_valid_from: primary?.effective_from || null,
      official_catalog_price_valid_until: primary?.effective_to || null,
      official_catalog_price_effective_from: primary?.effective_from || null,
      official_catalog_price_effective_to: primary?.effective_to || null,
      official_catalog_price_source_id: primary?.source_id || null,
      official_catalog_price_verification: primary?.capture_status || null,
      official_catalog_price_extraction_status: primary?.capture_status || null,
      official_catalog_price_evidence: evidence,
    };
  };

  const userProducts = [
    {id: 'ua-terea-silver-blue', brand: 'TEREA', name: 'TEREA for IQOS ILUMA（銀青系・商品名確認待ち）', category: 'HEATED_TOBACCO_STICKS', identity: 'IDENTITY_PENDING'},
    {id: 'ua-terea-cyan', brand: 'TEREA', name: 'TEREA for IQOS ILUMA（シアン系・商品名確認待ち）', category: 'HEATED_TOBACCO_STICKS', identity: 'IDENTITY_PENDING'},
    {id: 'ua-terea-purple', brand: 'TEREA', name: 'TEREA for IQOS ILUMA（紫系・商品名確認待ち）', category: 'HEATED_TOBACCO_STICKS', identity: 'IDENTITY_PENDING'},
    {id: 'ua-terea-green-black', brand: 'TEREA', name: 'TEREA for IQOS ILUMA（緑黒系・商品名確認待ち）', category: 'HEATED_TOBACCO_STICKS', identity: 'IDENTITY_PENDING'},
    {id: 'ua-terea-bright-blue', brand: 'TEREA', name: 'TEREA for IQOS ILUMA（鮮青系・商品名確認待ち）', category: 'HEATED_TOBACCO_STICKS', identity: 'IDENTITY_PENDING'},
    {id: 'ua-terea-lime', brand: 'TEREA', name: 'TEREA for IQOS ILUMA（ライム系・商品名確認待ち）', category: 'HEATED_TOBACCO_STICKS', identity: 'IDENTITY_PENDING'},
    {id: 'ua-terea-orange', brand: 'TEREA', name: 'TEREA for IQOS ILUMA（オレンジ系・商品名確認待ち）', category: 'HEATED_TOBACCO_STICKS', identity: 'IDENTITY_PENDING'},
    {id: 'ua-terea-black-purple', brand: 'TEREA', name: 'TEREA for IQOS ILUMA（黒紫系・商品名確認待ち）', category: 'HEATED_TOBACCO_STICKS', identity: 'IDENTITY_PENDING'},
    {id: 'ua-terea-riviera-pearl', brand: 'TEREA', name: 'TEREA RIVIERA PEARL', category: 'HEATED_TOBACCO_STICKS', identity: 'LABEL_VISIBLE'},
    {id: 'ua-terea-red-black', brand: 'TEREA', name: 'TEREA for IQOS ILUMA（赤黒系・商品名確認待ち）', category: 'HEATED_TOBACCO_STICKS', identity: 'IDENTITY_PENDING'},
    {id: 'ua-terea-pastel', brand: 'TEREA', name: 'TEREA for IQOS ILUMA（淡紫系・商品名確認待ち）', category: 'HEATED_TOBACCO_STICKS', identity: 'IDENTITY_PENDING'},
    {id: 'ua-iqos-device-purple', brand: 'IQOS', name: 'IQOS 加熱式デバイス（パープル）', category: 'HEATED_TOBACCO_DEVICES', identity: 'IDENTITY_PENDING'},
    {id: 'ua-iqos-iluma-prime-blue', brand: 'IQOS', name: 'IQOS ILUMA i PRIME（ブルー系）', category: 'HEATED_TOBACCO_DEVICES', identity: 'IDENTITY_PENDING'},
    {id: 'ua-iqos-iluma-prime-burgundy', brand: 'IQOS', name: 'IQOS ILUMA i PRIME（バーガンディ系）', category: 'HEATED_TOBACCO_DEVICES', identity: 'IDENTITY_PENDING'},
    {id: 'ua-iqos-iluma-prime-violet', brand: 'IQOS', name: 'IQOS ILUMA i PRIME（バイオレット系）', category: 'HEATED_TOBACCO_DEVICES', identity: 'IDENTITY_PENDING'},
    {id: 'ua-iqos-iluma-prime-clear-blue', brand: 'IQOS', name: 'IQOS ILUMA i PRIME 清風藍', category: 'HEATED_TOBACCO_DEVICES', identity: 'LABEL_VISIBLE'},
    {id: 'ua-iqos-iluma-prime-green', brand: 'IQOS', name: 'IQOS ILUMA i PRIME（グリーン系）', category: 'HEATED_TOBACCO_DEVICES', identity: 'IDENTITY_PENDING'},
    {id: 'ua-mevius-option-fizzy-dew-8', brand: 'メビウス', name: 'MEVIUS OPTION FIZZY DEW 8', category: 'CIGARETTES', identity: 'LABEL_VISIBLE'},
    {id: 'ua-seven-stars-prime-leaf-12', brand: 'セブンスター', name: 'Seven Stars PRIME LEAF 12', category: 'CIGARETTES', identity: 'LABEL_VISIBLE'},
    {id: 'ua-mevius-prestige', brand: 'メビウス', name: 'MEVIUS PRESTIGE', category: 'CIGARETTES', identity: 'LABEL_VISIBLE'},
    {id: 'ua-mevius-e-series-super-slims-1', brand: 'メビウス', name: 'MEVIUS E-SERIES SUPER SLIMS 1', category: 'CIGARETTES', identity: 'LABEL_VISIBLE'},
    {id: 'ua-mevius-e-series-menthol-ice-storm-100s-1', brand: 'メビウス', name: 'MEVIUS E-SERIES MENTHOL ICE STORM 100’s 1', category: 'CIGARETTES', identity: 'LABEL_VISIBLE'},
    {id: 'ua-peace-lights', brand: 'ピース', name: 'Peace LIGHTS', category: 'CIGARETTES', identity: 'LABEL_VISIBLE'},
    {id: 'ua-peace-filter-original', brand: 'ピース', name: 'Peace Filter Original', category: 'CIGARETTES', identity: 'LABEL_VISIBLE'},
    {id: 'ua-terea-gold', brand: 'TEREA', name: 'TEREA for IQOS ILUMA（ゴールド系・商品名確認待ち）', category: 'HEATED_TOBACCO_STICKS', identity: 'IDENTITY_PENDING'},
    {id: 'ua-terea-velvet-pearl', brand: 'TEREA', name: 'TEREA VELVET PEARL', category: 'HEATED_TOBACCO_STICKS', identity: 'LABEL_VISIBLE'},
  ].map((product) => Object.freeze(product));

  const sideMatteFiles = new Set([
    'ua-iqos-device-purple.jpg',
    'ua-iqos-iluma-prime-blue.jpg',
    'ua-mevius-option-purple-100s-1.jpg',
    'ua-terea-black-purple.jpg',
    'ua-terea-bright-blue.jpg',
    'ua-terea-cyan.jpg',
    'ua-terea-green-black.jpg',
    'ua-terea-lime.jpg',
    'ua-terea-orange.jpg',
    'ua-terea-pastel-a.jpg',
    'ua-terea-pastel-b.jpg',
    'ua-terea-purple.jpg',
    'ua-terea-red-black.jpg',
    'ua-terea-riviera-pearl.jpg',
    'ua-terea-silver-blue.jpg',
  ]);

  const userAsset = (assetId, sku, filename, details = {}) => ({
    asset_id: assetId,
    sku,
    file_path: `assets/catalog/products/${filename}`,
    source: 'USER_UPLOAD',
    status: 'USER_APPROVED_IMAGE',
    price_preserved: false,
    display_crop: sideMatteFiles.has(filename) ? 'SIDE_MATTE_30PX' : null,
    ...details,
  });

  const existingAssets = [
    userAsset('ua-terea-silver-blue', 'ua-terea-silver-blue', 'ua-terea-silver-blue.jpg'),
    userAsset('ua-terea-cyan', 'ua-terea-cyan', 'ua-terea-cyan.jpg'),
    userAsset('ua-terea-purple', 'ua-terea-purple', 'ua-terea-purple.jpg'),
    userAsset('ua-terea-green-black', 'ua-terea-green-black', 'ua-terea-green-black.jpg'),
    userAsset('ua-terea-bright-blue', 'ua-terea-bright-blue', 'ua-terea-bright-blue.jpg'),
    userAsset('ua-terea-lime', 'ua-terea-lime', 'ua-terea-lime.jpg'),
    userAsset('ua-terea-orange', 'ua-terea-orange', 'ua-terea-orange.jpg'),
    userAsset('ua-terea-black-purple', 'ua-terea-black-purple', 'ua-terea-black-purple.jpg'),
    userAsset('ua-terea-riviera-pearl', 'ua-terea-riviera-pearl', 'ua-terea-riviera-pearl.jpg'),
    userAsset('ua-terea-red-black', 'ua-terea-red-black', 'ua-terea-red-black.jpg'),
    userAsset('ua-terea-pastel-a', 'ua-terea-pastel', 'ua-terea-pastel-a.jpg', {rank: 1}),
    userAsset('ua-terea-pastel-b', 'ua-terea-pastel', 'ua-terea-pastel-b.jpg', {rank: 2}),
    userAsset('ua-iqos-device-purple', 'ua-iqos-device-purple', 'ua-iqos-device-purple.jpg'),
    userAsset('ua-iqos-iluma-prime-blue', 'ua-iqos-iluma-prime-blue', 'ua-iqos-iluma-prime-blue.jpg'),
    userAsset('ua-iqos-iluma-prime-burgundy', 'ua-iqos-iluma-prime-burgundy', 'ua-iqos-iluma-prime-burgundy.jpg'),
    userAsset('ua-iqos-iluma-prime-violet', 'ua-iqos-iluma-prime-violet', 'ua-iqos-iluma-prime-violet.jpg'),
    userAsset('ua-iqos-iluma-prime-clear-blue', 'ua-iqos-iluma-prime-clear-blue', 'ua-iqos-iluma-prime-clear-blue.jpg', {
      observed_price_jpy: 8980,
      price_preserved: true,
    }),
    userAsset('ua-iqos-iluma-prime-green', 'ua-iqos-iluma-prime-green', 'ua-iqos-iluma-prime-green.jpg'),
    userAsset('ua-mevius-option-purple-100s-1', 'wt-1692', 'ua-mevius-option-purple-100s-1.jpg'),
    userAsset('ua-mevius-option-fizzy-dew-8', 'ua-mevius-option-fizzy-dew-8', 'ua-mevius-option-fizzy-dew-8.jpg'),
    userAsset('ua-seven-stars-prime-leaf-12', 'ua-seven-stars-prime-leaf-12', 'ua-seven-stars-prime-leaf-12.jpg'),
    userAsset('ua-mevius-prestige', 'ua-mevius-prestige', 'ua-mevius-prestige.jpg'),
    userAsset('ua-mevius-e-series-super-slims-1', 'ua-mevius-e-series-super-slims-1', 'ua-mevius-e-series-super-slims-1.jpg'),
    userAsset('ua-mevius-e-series-menthol-ice-storm-100s-1', 'ua-mevius-e-series-menthol-ice-storm-100s-1', 'ua-mevius-e-series-menthol-ice-storm-100s-1.jpg'),
    userAsset('ua-mevius-lights-8', 'wt-1138', 'ua-mevius-lights-8.jpg'),
    userAsset('ua-peace-lights', 'ua-peace-lights', 'ua-peace-lights.jpg'),
    userAsset('ua-peace-filter-original', 'ua-peace-filter-original', 'ua-peace-filter-original.jpg'),
    userAsset('ua-terea-gold', 'ua-terea-gold', 'ua-terea-gold.jpg'),
    userAsset('ua-terea-velvet-pearl', 'ua-terea-velvet-pearl', 'ua-terea-velvet-pearl.jpg'),
    {
      asset_id: 'ua-camel-berry-5',
      sku: 'wt-1117',
      file_path: 'assets/catalog/products/wt-1117-camel-berry-5.jpg',
      source: 'USER_UPLOAD',
      status: 'USER_APPROVED_IMAGE',
      observed_price_jpy: 470,
      price_preserved: true,
    },
    {
      asset_id: 'ua-camel-berry-8',
      sku: 'wt-1116',
      file_path: 'assets/catalog/products/wt-1116-camel-berry-8.jpg',
      source: 'USER_UPLOAD',
      status: 'USER_APPROVED_IMAGE',
      observed_price_jpy: 470,
      price_preserved: true,
    },
    {
      asset_id: 'lv-seven-stars',
      sku: 'wt-1020',
      file_path: 'assets/catalog/products/wt-1020-seven-stars.png',
      source: 'LOCAL_VERIFIED_IMAGE',
      status: 'LOCAL_VERIFIED_IMAGE',
      source_url: 'https://commons.wikimedia.org/wiki/File:Sevenstars_charcoalsoft.gif',
      license: 'CC BY-SA 3.0',
      price_preserved: false,
    },
  ].map((asset) => Object.freeze(asset));

  const existingBoundSkus = new Set(existingAssets.filter((asset) => asset.file_path).map((asset) => asset.sku));
  const referenceIdsByCode = new Map(references.map((reference) => [reference.code, reference.id]));
  const jtImageAssets = jtProducts.filter((product) => product.image_asset).map((product) => {
    const sku = referenceIdsByCode.get(product.code) || `jt-${product.code}`;
    if (existingBoundSkus.has(sku)) throw new Error(`JT image would replace an existing asset: ${sku}`);
    return Object.freeze({
      asset_id: `jt2025-${product.code}`,
      sku,
      file_path: product.image_asset.file_path,
      sha256: product.image_asset.sha256,
      width: product.image_asset.width,
      height: product.image_asset.height,
      pdf_object_id: product.image_asset.pdf_object_id,
      pdf_page: product.pdf_page,
      source: 'JT_CATALOG_2025_10',
      source_url: jtSource?.source_url || null,
      status: 'APPROVED_EXTERNAL_SOURCE',
      price_preserved: false,
    });
  });
  const boundSkusBeforeTsn = new Set([...existingAssets, ...jtImageAssets].map((asset) => asset.sku));
  const tsnImageAssets = tsnProducts.filter((product) => product.image_asset).map((product) => {
    const sku = referenceIdsByCode.get(product.code) || (jtByCode.has(product.code) ? `jt-${product.code}` : `tsn-${product.code}`);
    if (boundSkusBeforeTsn.has(sku)) throw new Error(`TSN image would replace an existing asset: ${sku}`);
    return Object.freeze({
      asset_id: `tsn2026-${product.code}`,
      sku,
      file_path: product.image_asset.file_path,
      sha256: product.image_asset.sha256,
      width: product.image_asset.width,
      height: product.image_asset.height,
      pdf_page: product.pdf_page,
      source: 'TSN_IMPORT_2026_04',
      source_url: tsnSource?.source_url || null,
      status: 'APPROVED_EXTERNAL_SOURCE',
      price_preserved: false,
    });
  });
  const goodsImageAssets = goodsProducts.filter((product) => product.image_asset).map((product) => {
    const sourceId = product.source_id === 'LIGHTERS' ? 'TSN_LIGHTERS_2026' : 'TSN_SMOKING_GOODS_2026';
    return Object.freeze({
      asset_id: `tsn-goods-2026-${product.code}`,
      sku: `tsn-goods-${product.code}`,
      file_path: product.image_asset.file_path,
      sha256: product.image_asset.sha256,
      width: product.image_asset.width,
      height: product.image_asset.height,
      pdf_page: product.pdf_page,
      extraction_mode: product.image_asset.extraction_mode,
      source: sourceId,
      source_url: goodsSources[product.source_id]?.source_url || null,
      status: 'APPROVED_EXTERNAL_SOURCE',
      price_preserved: false,
    });
  });
  const validLiveIds = new Set([
    ...references.map((product) => product.id),
    ...userProducts.map((product) => product.id),
    ...jtProducts.filter((product) => !referenceCodes.has(product.code)).map((product) => `jt-${product.code}`),
    ...tsnProducts.filter((product) => !existingCodes.has(product.code)).map((product) => `tsn-${product.code}`),
    ...goodsProducts.map((product) => `tsn-goods-${product.code}`),
  ]);
  const unsupportedLiveIds = Object.freeze(Object.keys(liveOverrides).filter((id) => !validLiveIds.has(id)).sort());
  const liveImageAssets = Object.entries(liveOverrides).flatMap(([sku, override]) => {
    if (!validLiveIds.has(sku) || !override || !override.image || !liveApiBase) return [];
    const image = override.image;
    let url;
    try { url = new URL(image.url); } catch { return []; }
    if (url.origin !== new URL(liveApiBase).origin ||
        !/^\/catalog\/media\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.(?:jpg|png)$/.test(url.pathname)) return [];
    if (!/^[a-f0-9]{64}$/.test(image.sha256) || !Number.isInteger(image.width) || !Number.isInteger(image.height)) return [];
    return [Object.freeze({
      asset_id: `admin-${sku}-${image.sha256}`,
      sku,
      file_path: url.href,
      sha256: image.sha256,
      width: image.width,
      height: image.height,
      source: 'ADMIN_UPLOAD',
      status: 'ADMIN_UPLOADED_IMAGE',
      price_preserved: false,
    })];
  });
  const assets = [
    ...existingAssets,
    ...jtImageAssets,
    ...tsnImageAssets,
    ...goodsImageAssets,
    ...liveImageAssets,
  ];

  const ambiguousAssets = Object.freeze([
    ...tsnProducts.filter((product) => product.image_match_status === 'DUPLICATE_IMAGE_REVIEW').map((product) => Object.freeze({
      asset_id: `tsn2026-review-${product.code}`,
      sku_candidates: [`tsn-${product.code}`],
      source: 'TSN_IMPORT_2026_04',
      status: 'CONFLICT_REVIEW',
      reason: 'The PDF image has the same hash as another product code; it is not bound to multiple SKUs.',
    })),
  ]);

  const assetsBySku = new Map();
  assets.forEach((asset) => {
    const productAssets = assetsBySku.get(asset.sku) || [];
    productAssets.push(asset);
    productAssets.sort((left, right) => (
      (sources[right.source]?.priority || 0) - (sources[left.source]?.priority || 0) ||
      (left.rank || 0) - (right.rank || 0)
    ));
    assetsBySku.set(asset.sku, productAssets);
  });

  const imageRecord = (asset) => Object.freeze({
    asset_id: asset.asset_id,
    file_path: asset.file_path,
    sha256: asset.sha256 || null,
    status: asset.status,
    observed_price_jpy: asset.observed_price_jpy ?? null,
    price_preserved: asset.price_preserved,
    display_crop: asset.display_crop || null,
  });

  const productImages = (sku) => Object.freeze((assetsBySku.get(sku) || []).map(imageRecord));

  const referenceProducts = references.map((reference) => {
    const jtProduct = jtByCode.get(reference.code) || null;
    const officialPrice = officialPriceFields(priceFactsForCode(reference.code));
    const images = productImages(reference.id);
    const image = images[0] || null;
    const primaryAsset = (assetsBySku.get(reference.id) || [])[0] || null;
    const priceConflict = (assetsBySku.get(reference.id) || []).some((asset) => (
      asset.observed_price_jpy != null &&
      reference.price != null &&
      asset.observed_price_jpy !== reference.price
    ));

    return Object.freeze({
      id: reference.id,
      sku: reference.code || reference.id,
      category: 'CIGARETTES',
      subcategory: 'JAPANESE_CIGARETTE_REFERENCE',
      origin_country: reference.origin || 'UNKNOWN',
      brand: reference.brand || 'UNKNOWN',
      series: null,
      variant: null,
      product_name_ja: reference.name || 'UNKNOWN',
      product_name_en: null,
      price_jpy: reference.price ?? null,
      reference_shop_price_jpy: reference.shopPrice ?? null,
      ...officialPrice,
      pack_size: reference.packCount ?? jtProduct?.pack_size ?? null,
      pack_unit: jtProduct?.pack_unit || '本',
      tar_mg: reference.tar ?? jtProduct?.tar_mg ?? null,
      nicotine_mg: reference.nicotine ?? jtProduct?.nicotine_mg ?? null,
      manufacturer_name_ja: jtProduct?.name || null,
      historical_list_price_jpy: jtProduct?.historical_list_price_jpy ?? null,
      historical_price_as_of: jtProduct ? jtSource?.price_as_of : null,
      manufacturer_pdf_page: jtProduct?.pdf_page ?? null,
      manufacturer_source_url: jtProduct ? jtSource?.source_url : null,
      product_code: reference.code ?? null,
      system_code: reference.systemCode ?? null,
      image,
      images,
      image_source: primaryAsset?.source || null,
      source_url: reference.sourceUrl || sources.WORLD_TOBACCO.url,
      source_checked_at: '2026-09-05',
      availability: reference.soldOut ? 'SOLD_OUT' : 'UNKNOWN',
      status: priceConflict ? 'PRICE_CONFLICT' : (image ? 'IMAGE_BOUND' : 'CATALOG_ONLY'),
      notes: null,
    });
  });

  const jtOnlyProducts = jtProducts.filter((product) => !referenceCodes.has(product.code)).map((product) => {
    const id = `jt-${product.code}`;
    const officialPrice = officialPriceFields(priceFactsForCode(product.code));
    const images = productImages(id);
    const image = images[0] || null;
    const primaryAsset = (assetsBySku.get(id) || [])[0] || null;
    return Object.freeze({
      id,
      sku: product.code,
      category: product.category,
      subcategory: 'JT_2025_REFERENCE',
      origin_country: 'UNKNOWN',
      brand: product.brand,
      series: null,
      variant: null,
      product_name_ja: product.name,
      product_name_en: null,
      price_jpy: null,
      reference_shop_price_jpy: null,
      ...officialPrice,
      historical_list_price_jpy: product.historical_list_price_jpy,
      historical_price_as_of: jtSource?.price_as_of || null,
      manufacturer_pdf_page: product.pdf_page,
      manufacturer_source_url: jtSource?.source_url || null,
      pack_size: product.pack_size,
      pack_unit: product.pack_unit,
      tar_mg: product.tar_mg,
      nicotine_mg: product.nicotine_mg,
      product_code: product.code,
      system_code: null,
      image,
      images,
      image_source: primaryAsset?.source || null,
      source_url: jtSource?.source_url || null,
      source_checked_at: '2026-09-20',
      availability: 'UNKNOWN',
      status: image ? 'IMAGE_BOUND' : 'CATALOG_ONLY',
      notes: 'JT 2025-10 manufacturer catalog; current price and availability not verified.',
    });
  });

  const uploadedProducts = userProducts.map((product) => {
    const officialPrice = officialPriceFields(Object.freeze([]));
    const images = productImages(product.id);
    const image = images[0] || null;
    return Object.freeze({
      id: product.id,
      sku: product.id,
      category: product.category,
      subcategory: 'USER_UPLOAD',
      origin_country: 'UNKNOWN',
      brand: product.brand,
      series: null,
      variant: null,
      product_name_ja: product.name,
      product_name_en: null,
      price_jpy: null,
      reference_shop_price_jpy: null,
      ...officialPrice,
      pack_size: null,
      tar_mg: null,
      nicotine_mg: null,
      product_code: null,
      system_code: null,
      image,
      images,
      image_source: 'USER_UPLOAD',
      source_url: null,
      source_checked_at: '2026-09-05',
      availability: 'UNKNOWN',
      status: product.identity === 'IDENTITY_PENDING' ? 'IDENTITY_PENDING' : 'IMAGE_BOUND',
      notes: product.identity,
    });
  });

  const tsnOnlyProducts = tsnProducts.filter((product) => !existingCodes.has(product.code)).map((product) => {
    const id = `tsn-${product.code}`;
    const officialPrice = officialPriceFields(priceFactsForCode(product.code));
    const images = productImages(id);
    const image = images[0] || null;
    return Object.freeze({
      id,
      sku: product.code,
      category: product.category,
      subcategory: 'TSN_2026_REFERENCE',
      origin_country: 'UNKNOWN',
      brand: product.brand,
      series: null,
      variant: null,
      product_name_ja: product.name,
      product_name_en: null,
      price_jpy: null,
      reference_shop_price_jpy: null,
      ...officialPrice,
      historical_list_price_jpy: product.historical_list_price_jpy,
      historical_price_as_of: tsnSource?.price_as_of || null,
      manufacturer_name_ja: product.manufacturer,
      manufacturer_pdf_page: product.pdf_page,
      manufacturer_source_url: tsnSource?.source_url || null,
      pack_size: product.pack_size,
      pack_unit: product.pack_unit,
      tar_mg: product.tar_mg,
      nicotine_mg: product.nicotine_mg,
      product_code: product.code,
      system_code: null,
      image,
      images,
      image_source: image ? 'TSN_IMPORT_2026_04' : null,
      source_url: tsnSource?.source_url || null,
      source_checked_at: '2026-09-20',
      availability: 'UNKNOWN',
      status: image ? 'IMAGE_BOUND' : (product.image_match_status || 'CATALOG_ONLY'),
      notes: 'TSN 2026-05-21 catalog; current price and availability not verified.',
    });
  });

  const goodsOnlyProducts = goodsProducts.map((product) => {
    const source = goodsSources[product.source_id];
    if (!source || product.match_status !== 'SOURCE_CELL_MATCHED' || !product.image_asset) {
      throw new Error(`Incomplete TSN goods source-cell record: ${product.code}`);
    }
    const sourceId = product.source_id === 'LIGHTERS' ? 'TSN_LIGHTERS_2026' : 'TSN_SMOKING_GOODS_2026';
    const officialPrice = officialPriceFields(Object.freeze([
      officialPriceFact(product, sourceId, source, {
        priceKind: 'SUGGESTED_RETAIL_PRICE',
        taxIncluded: product.source_id === 'SMOKING_GOODS' ? true : null,
        effectiveFrom: null,
        effectiveTo: null,
        captureStatus: product.source_id === 'LIGHTERS' ? 'SOURCE_REVIEWED' : 'OCR_EXTRACTED',
      }),
    ].filter(Boolean)));
    const id = `tsn-goods-${product.code}`;
    const images = productImages(id);
    const image = images[0] || null;
    return Object.freeze({
      id,
      sku: product.code,
      category: product.category,
      subcategory: `TSN_${product.source_id}_2026_REFERENCE`,
      origin_country: 'UNKNOWN',
      brand: product.brand,
      series: null,
      variant: null,
      product_name_ja: product.name,
      product_name_en: null,
      product_name_ocr_candidate: product.ocr_name_candidate,
      ocr_name_confidence: product.ocr_name_confidence,
      ocr_list_price_candidate_jpy: product.ocr_list_price_candidate_jpy,
      price_jpy: null,
      reference_shop_price_jpy: null,
      ...officialPrice,
      historical_list_price_jpy: product.ocr_list_price_candidate_jpy,
      historical_price_as_of: '2026',
      manufacturer_pdf_page: product.pdf_page,
      manufacturer_source_url: source.source_url,
      pack_size: null,
      pack_unit: null,
      tar_mg: null,
      nicotine_mg: null,
      product_code: product.code,
      system_code: null,
      image,
      images,
      image_source: sourceId,
      source_url: source.source_url,
      source_checked_at: '2026-09-20',
      availability: 'UNKNOWN',
      status: image ? 'IMAGE_BOUND' : 'CATALOG_ONLY',
      notes: '2026 official client catalog source-cell name, image, code, and catalog price.',
    });
  });

  const canonical = Object.freeze([
    ...referenceProducts, ...uploadedProducts, ...jtOnlyProducts, ...tsnOnlyProducts, ...goodsOnlyProducts,
  ].map((product) => {
    const override = liveOverrides[product.id];
    if (!override || typeof override !== 'object') {
      if (!liveSaleAuthorityUnavailable) return product;
      return Object.freeze({
        ...product,
        price_jpy: null,
        price_source: null,
        approved_sale_price_id: null,
        approved_sale_price_version: null,
        sale_authority_unavailable: true,
      });
    }
    const editedName = typeof override.product_name_ja === 'string' && override.product_name_ja.trim().length > 0
      ? override.product_name_ja.trim() : null;
    const approvedPriceIdentity = typeof override.price_id === 'string' && override.price_id.length > 0 &&
      typeof override.price_version === 'string' && override.price_version.startsWith(`${override.price_id}:`);
    const hasPrice = Object.hasOwn(override, 'price_jpy') && (
      override.price_jpy === null || (Number.isInteger(override.price_jpy) && override.price_jpy > 0 && approvedPriceIdentity)
    );
    const protectedApprovedPrice = hasPrice && override.price_jpy !== null && approvedPriceIdentity;
    const price = hasPrice ? override.price_jpy : product.price_jpy;
    const images = productImages(product.id);
    const image = images[0] || null;
    const priceConflict = !protectedApprovedPrice && images.some((item) => (
      item.observed_price_jpy != null && price != null && item.observed_price_jpy !== price
    ));
    let status = product.status;
    if (protectedApprovedPrice) status = image ? 'IMAGE_BOUND' : 'CATALOG_ONLY';
    else if (priceConflict || status === 'PRICE_CONFLICT') status = 'PRICE_CONFLICT';
    else if (status === 'IDENTITY_PENDING' && editedName) status = image ? 'IMAGE_BOUND' : 'CATALOG_ONLY';
    else if (status === 'CATALOG_ONLY' && image) status = 'IMAGE_BOUND';
    return Object.freeze({
      ...product,
      product_name_ja: editedName || product.product_name_ja,
      price_jpy: price,
      price_source: hasPrice && override.price_id ? 'APPROVED_SALE_PRICE' : null,
      approved_sale_price_id: typeof override.price_id === 'string' ? override.price_id : null,
      approved_sale_price_version: typeof override.price_version === 'string' ? override.price_version : null,
      sale_authority_unavailable: false,
      image,
      images,
      image_source: (assetsBySku.get(product.id) || [])[0]?.source || null,
      status,
    });
  }).filter((product) => (
    (!liveProjectedIds || liveProjectedIds.has(product.id)) && liveOverrides[product.id]?.active !== false
  )));

  const ids = new Set();
  const duplicateIds = [];
  canonical.forEach((product) => {
    if (ids.has(product.id)) duplicateIds.push(product.id);
    ids.add(product.id);
  });

  const completeSku = canonical.filter((product) => (
    product.status === 'IMAGE_BOUND' &&
    product.image &&
    product.price_jpy != null &&
    product.product_code &&
    product.brand &&
    product.brand !== 'UNKNOWN' &&
    product.product_name_ja
  )).length;
  const imageBound = canonical.filter((product) => product.image).length;
  const missingFields = canonical.reduce((count, product) => count + [
    'brand',
    'product_name_ja',
    'price_jpy',
    'product_code',
    'pack_size',
    'tar_mg',
    'nicotine_mg',
  ].filter((key) => product[key] == null || product[key] === 'UNKNOWN').length, 0);
  const priceConflicts = canonical.filter((product) => product.status === 'PRICE_CONFLICT').length;
  const officialPriceEvidenceCount = canonical.reduce(
    (count, product) => count + product.official_catalog_price_evidence.length, 0,
  );
  const officialPriceTerms = canonical.filter((product) => product.official_catalog_price_evidence.length > 0);
  const officialNumericPrices = officialPriceTerms.filter((product) => Number.isInteger(product.official_catalog_price_jpy));
  const officialOpenPrices = officialPriceTerms.filter((product) => product.official_catalog_price_kind === 'OPEN_PRICE');
  const officialCatalogCodes = new Set([
    ...jtProducts.map((product) => product.code),
    ...tsnProducts.map((product) => product.code),
    ...goodsProducts.map((product) => product.code),
  ]);
  const officialCatalogProducts = canonical.filter((product) => officialCatalogCodes.has(product.product_code));
  const officialCatalogImageReady = officialCatalogProducts.filter((product) => product.image);
  const officialCatalogReady = officialCatalogProducts.filter((product) => (
    product.image
    && product.product_code
    && product.brand
    && product.brand !== 'UNKNOWN'
    && product.product_name_ja
    && product.official_catalog_price_evidence.length > 0
  ));
  const officialPriceConflicts = canonical.filter((product) => {
    const byPeriod = new Map();
    for (const fact of product.official_catalog_price_evidence) {
      const key = `${fact.effective_from || fact.as_of || 'UNKNOWN'}:${fact.effective_to || ''}`;
      const value = fact.pricing_mode === 'OPEN_PRICE' ? 'OPEN_PRICE' : String(fact.amount_jpy);
      const values = byPeriod.get(key) || new Set();
      values.add(value);
      byPeriod.set(key, values);
    }
    return [...byPeriod.values()].some((values) => values.size > 1);
  });
  const missingImageManifest = Object.freeze(canonical
    .filter((product) => product.image == null || product.images.length === 0)
    .map((product) => Object.freeze({
      id: product.id,
      sku: product.sku,
      brand: product.brand,
      product_name_ja: product.product_name_ja,
      product_code: product.product_code,
      system_code: product.system_code,
      price_jpy: product.price_jpy,
      source_url: product.source_url,
      image_status: 'IMAGE_MISSING',
      match_status: ambiguousAssets.some((asset) => asset.sku_candidates.includes(product.id))
        ? 'CONFLICT_REVIEW'
        : 'UNMATCHED',
    })));
  const runtimeMissingImage = canonical.length - imageBound;
  if (missingImageManifest.length !== runtimeMissingImage) {
    throw new Error(`Missing-image manifest mismatch: ${missingImageManifest.length} != ${runtimeMissingImage}`);
  }
  const missingImageByBrand = Object.freeze(missingImageManifest.reduce((counts, product) => {
    counts[product.brand] = (counts[product.brand] || 0) + 1;
    return counts;
  }, {}));

  const audit = Object.freeze({
    TOTAL_REFERENCE_SKU: references.length + jtOnlyProducts.length + tsnOnlyProducts.length + goodsOnlyProducts.length,
    TOTAL_LOCAL_SKU: canonical.length,
    TOTAL_JT_2025_SKU: jtProducts.length,
    JT_MATCHED_EXISTING: jtProducts.length - jtOnlyProducts.length,
    JT_ADDED: jtOnlyProducts.length,
    JT_HISTORICAL_PRICE_DIFFERENCES: referenceProducts.filter((product) => (
      product.historical_list_price_jpy != null &&
      product.price_jpy != null &&
      product.historical_list_price_jpy !== product.price_jpy
    )).length,
    TOTAL_TSN_2026_SKU: tsnProducts.length,
    TSN_MATCHED_EXISTING: tsnProducts.length - tsnOnlyProducts.length,
    TSN_ADDED: tsnOnlyProducts.length,
    TOTAL_TSN_GOODS_2026_SKU: goodsProducts.length,
    TSN_GOODS_BY_CATEGORY: Object.freeze(goodsOnlyProducts.reduce((counts, product) => {
      counts[product.category] = (counts[product.category] || 0) + 1;
      return counts;
    }, {})),
    IDENTITY_PENDING: canonical.filter((product) => product.status === 'IDENTITY_PENDING').length,
    OFFICIAL_CATALOG_PRICE_SOURCE_ROWS: officialPriceEvidenceCount,
    OFFICIAL_CATALOG_PRICE_TERMS: officialPriceTerms.length,
    OFFICIAL_CATALOG_NUMERIC_PRICE: officialNumericPrices.length,
    OFFICIAL_CATALOG_OPEN_PRICE: officialOpenPrices.length,
    OFFICIAL_CATALOG_PRICE_MISSING: canonical.length - officialPriceTerms.length,
    OFFICIAL_CATALOG_PRICE_CONFLICTS: officialPriceConflicts.length,
    OFFICIAL_CATALOG_PRICE_COVERAGE_PERCENT: Number(((officialPriceTerms.length / canonical.length) * 100).toFixed(1)),
    OFFICIAL_CATALOG_UNIQUE_SKU: officialCatalogProducts.length,
    OFFICIAL_CATALOG_IMAGE_READY: officialCatalogImageReady.length,
    OFFICIAL_CATALOG_IMAGE_MISSING: officialCatalogProducts.length - officialCatalogImageReady.length,
    OFFICIAL_CATALOG_READY_SKU: officialCatalogReady.length,
    OFFICIAL_CATALOG_COMPLETENESS_PERCENT: Number(((officialCatalogReady.length / officialCatalogProducts.length) * 100).toFixed(1)),
    TOTAL_ASSETS: assets.length,
    TOTAL_UPLOAD_ASSETS: assets.filter((asset) => asset.source === 'USER_UPLOAD').length,
    TOTAL_UPLOAD_PRODUCTS: new Set(assets.filter((asset) => asset.source === 'USER_UPLOAD').map((asset) => asset.sku)).size,
    IMAGE_BOUND: imageBound,
    MERCHANT_SALE_READY_SKU: completeSku,
    COMPLETE_SKU: completeSku,
    MISSING_SKU: 0,
    MISSING_IMAGE: runtimeMissingImage,
    MISSING_IMAGE_BY_BRAND: missingImageByBrand,
    MISSING_FIELDS: missingFields,
    DUPLICATE_SKU: duplicateIds.length,
    CONFLICTS: priceConflicts + ambiguousAssets.length,
    COVERAGE_PERCENT: Number(((completeSku / canonical.length) * 100).toFixed(1)),
    SCHEMA_READY_CATEGORIES: [
      'JAPANESE_CIGARETTES',
      'IMPORTED_CIGARETTES',
      'RYO',
      'CIGARS',
      'PIPE_TOBACCO',
      'CUT_TOBACCO',
      'SMOKELESS_TOBACCO',
      'HEATED_TOBACCO_STICKS',
      'HEATED_TOBACCO_DEVICES',
      'ROLLING_ACCESSORIES',
      'PIPE_ACCESSORIES',
      'ASHTRAYS',
      'LIGHTERS',
    ],
  });

  globalThis.KISARAGI_SOURCE_REGISTRY = sources;
  globalThis.KISARAGI_ASSET_REGISTRY = Object.freeze([...assets, ...ambiguousAssets]);
  globalThis.KISARAGI_CANONICAL_CATALOG = Object.freeze(canonical);
  globalThis.KISARAGI_MISSING_IMAGE_MANIFEST = missingImageManifest;
  globalThis.KISARAGI_CATALOG_AUDIT = audit;
  globalThis.KISARAGI_LIVE_UNSUPPORTED_IDS = unsupportedLiveIds;
})();
