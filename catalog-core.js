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

  const assets = [
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
    status: asset.status,
    observed_price_jpy: asset.observed_price_jpy ?? null,
    price_preserved: asset.price_preserved,
    display_crop: asset.display_crop || null,
  });

  const productImages = (sku) => Object.freeze((assetsBySku.get(sku) || []).map(imageRecord));

  const referenceProducts = references.map((reference) => {
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
      pack_size: reference.packCount ?? null,
      tar_mg: reference.tar ?? null,
      nicotine_mg: reference.nicotine ?? null,
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

  const uploadedProducts = userProducts.map((product) => {
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

  const canonical = Object.freeze([...referenceProducts, ...uploadedProducts]);

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
    TOTAL_REFERENCE_SKU: references.length,
    TOTAL_LOCAL_SKU: canonical.length,
    TOTAL_ASSETS: assets.length,
    TOTAL_UPLOAD_ASSETS: assets.filter((asset) => asset.source === 'USER_UPLOAD').length,
    TOTAL_UPLOAD_PRODUCTS: new Set(assets.filter((asset) => asset.source === 'USER_UPLOAD').map((asset) => asset.sku)).size,
    IMAGE_BOUND: imageBound,
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
      'HEATED_TOBACCO_STICKS',
      'HEATED_TOBACCO_DEVICES',
    ],
  });

  globalThis.KISARAGI_SOURCE_REGISTRY = sources;
  globalThis.KISARAGI_ASSET_REGISTRY = Object.freeze([...assets, ...ambiguousAssets]);
  globalThis.KISARAGI_CANONICAL_CATALOG = Object.freeze(canonical);
  globalThis.KISARAGI_MISSING_IMAGE_MANIFEST = missingImageManifest;
  globalThis.KISARAGI_CATALOG_AUDIT = audit;
})();
