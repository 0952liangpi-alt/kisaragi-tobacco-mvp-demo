(() => {
  const references = globalThis.KISARAGI_JAPAN_SKUS || [];

  const sources = Object.freeze({
    USER_UPLOAD: Object.freeze({id: 'USER_UPLOAD', priority: 100}),
    LOCAL_VERIFIED_IMAGE: Object.freeze({id: 'LOCAL_VERIFIED_IMAGE', priority: 80}),
    WORLD_TOBACCO: Object.freeze({
      id: 'WORLD_TOBACCO',
      priority: 60,
      url: 'https://www.world-tobacco.jp/view/category/ct5',
    }),
    CLUB_JT: Object.freeze({id: 'CLUB_JT', priority: 70}),
    OTHER_APPROVED_SOURCE: Object.freeze({id: 'OTHER_APPROVED_SOURCE', priority: 50}),
  });

  const assets = [
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
      asset_id: 'lv-peace-10',
      sku: 'wt-1034',
      file_path: 'assets/catalog/products/wt-1034-peace-10.jpg',
      source: 'LOCAL_VERIFIED_IMAGE',
      status: 'LOCAL_VERIFIED_IMAGE',
      source_url: 'https://commons.wikimedia.org/wiki/File:Peace(10).jpg',
      license: 'CC BY-SA 4.0',
      price_preserved: false,
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

  const ambiguousAssets = Object.freeze([
    Object.freeze({
      asset_id: 'ua-nas-organic-mint-a',
      sku_candidates: ['wt-1525', 'wt-1524', 'wt-1523'],
      source: 'USER_UPLOAD',
      status: 'CONFLICT_REVIEW',
      reason: 'Three reference SKUs share the same public product name; the image does not expose a reliable unique product code.',
    }),
    Object.freeze({
      asset_id: 'ua-nas-organic-mint-b',
      sku_candidates: ['wt-1525', 'wt-1524', 'wt-1523'],
      source: 'USER_UPLOAD',
      status: 'CONFLICT_REVIEW',
      reason: 'Exact SKU is ambiguous.',
    }),
    Object.freeze({
      asset_id: 'ua-nas-organic-mint-c',
      sku_candidates: ['wt-1525', 'wt-1524', 'wt-1523'],
      source: 'USER_UPLOAD',
      status: 'CONFLICT_REVIEW',
      reason: 'Exact SKU is ambiguous.',
    }),
  ]);

  const bestAssetBySku = new Map();
  assets.forEach((asset) => {
    const current = bestAssetBySku.get(asset.sku);
    const candidatePriority = sources[asset.source]?.priority || 0;
    const currentPriority = current ? sources[current.source]?.priority || 0 : -1;
    if (!current || candidatePriority > currentPriority) bestAssetBySku.set(asset.sku, asset);
  });

  const canonical = references.map((reference) => {
    const asset = bestAssetBySku.get(reference.id) || null;
    const priceConflict = Boolean(
      asset &&
      asset.observed_price_jpy != null &&
      reference.price != null &&
      asset.observed_price_jpy !== reference.price
    );

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
      pack_size: reference.packCount ?? null,
      tar_mg: reference.tar ?? null,
      nicotine_mg: reference.nicotine ?? null,
      product_code: reference.code ?? null,
      system_code: reference.systemCode ?? null,
      image: asset ? Object.freeze({
        asset_id: asset.asset_id,
        file_path: asset.file_path,
        status: asset.status,
        price_preserved: asset.price_preserved,
      }) : null,
      image_source: asset?.source || null,
      source_url: reference.sourceUrl || sources.WORLD_TOBACCO.url,
      source_checked_at: '2026-09-05',
      availability: reference.soldOut ? 'SOLD_OUT' : 'UNKNOWN',
      status: priceConflict ? 'PRICE_CONFLICT' : (asset ? 'IMAGE_BOUND' : 'CATALOG_ONLY'),
      notes: null,
    });
  });

  const ids = new Set();
  const duplicateIds = [];
  canonical.forEach((product) => {
    if (ids.has(product.id)) duplicateIds.push(product.id);
    ids.add(product.id);
  });

  const completeSku = canonical.filter((product) => (
    product.image &&
    product.price_jpy != null &&
    product.product_code &&
    product.brand &&
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

  const audit = Object.freeze({
    TOTAL_REFERENCE_SKU: canonical.length,
    TOTAL_LOCAL_SKU: canonical.length,
    IMAGE_BOUND: imageBound,
    COMPLETE_SKU: completeSku,
    MISSING_SKU: 0,
    MISSING_IMAGE: canonical.length - imageBound,
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
    ],
  });

  globalThis.KISARAGI_SOURCE_REGISTRY = sources;
  globalThis.KISARAGI_ASSET_REGISTRY = Object.freeze([...assets, ...ambiguousAssets]);
  globalThis.KISARAGI_CANONICAL_CATALOG = Object.freeze(canonical);
  globalThis.KISARAGI_CATALOG_AUDIT = audit;
})();
