(() => {
  const config = globalThis.KISARAGI_LIVE_CONFIG || {};

  globalThis.KISARAGI_LOAD_LIVE_OVERRIDES = async () => {
    if (!config.apiBase) {
      globalThis.KISARAGI_LIVE_STATUS = 'NOT_CONFIGURED';
      return;
    }
    globalThis.KISARAGI_LIVE_STATUS = 'LOADING';
    try {
      const apiBase = String(config.apiBase).replace(/\/$/, '');
      const response = await fetch(`${apiBase}/catalog/api/public/v1/projection`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`Live catalog HTTP ${response.status}`);
      const data = await response.json();
      if (data?.schemaVersion !== 1 || !Number.isInteger(data.projectionVersion) ||
          !Array.isArray(data.products) || typeof data.etag !== 'string') {
        throw new Error('Invalid live catalog payload');
      }
      const overrides = {};
      for (const product of data.products) {
        if (!product || typeof product.id !== 'string' || typeof product.name !== 'string' || typeof product.active !== 'boolean') {
          throw new Error('Invalid live catalog product');
        }
        if (product.salePrice !== null && (
          !product.salePrice || product.salePrice.currency !== 'JPY' ||
          !Number.isInteger(product.salePrice.amount) || product.salePrice.amount <= 0 ||
          typeof product.salePrice.priceId !== 'string' || !product.salePrice.priceId ||
          typeof product.salePrice.priceVersion !== 'string' ||
          !product.salePrice.priceVersion.startsWith(`${product.salePrice.priceId}:`)
        )) throw new Error('Invalid protected sale price');
        const override = {
          product_name_ja: product.name,
          active: product.active,
          price_jpy: product.salePrice?.amount ?? null,
          price_id: product.salePrice?.priceId ?? null,
          price_version: product.salePrice?.priceVersion ?? null,
        };
        if (product.image) {
          const imageUrl = new URL(product.image.path, `${apiBase}/`);
          if (imageUrl.origin !== new URL(apiBase).origin ||
              !/^\/catalog\/media\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.(?:jpg|png)$/.test(imageUrl.pathname) ||
              !/^[a-f0-9]{64}$/.test(product.image.sha256) ||
              !Number.isInteger(product.image.width) || !Number.isInteger(product.image.height)) {
            throw new Error('Invalid live catalog image');
          }
          override.image = {
            url: imageUrl.href,
            sha256: product.image.sha256,
            width: product.image.width,
            height: product.image.height,
          };
        }
        overrides[product.id] = override;
      }
      globalThis.KISARAGI_LIVE_OVERRIDES = Object.freeze(overrides);
      globalThis.KISARAGI_LIVE_PROJECTED_IDS = Object.freeze(data.products.map(({id}) => id));
      globalThis.KISARAGI_LIVE_REVISION = data.projectionVersion;
      globalThis.KISARAGI_LIVE_ETAG = data.etag;
      globalThis.KISARAGI_LIVE_STATUS = 'LIVE';
    } catch {
      globalThis.KISARAGI_LIVE_OVERRIDES = {};
      globalThis.KISARAGI_LIVE_PROJECTED_IDS = null;
      globalThis.KISARAGI_LIVE_STATUS = 'OFFLINE_STATIC_FALLBACK';
    }
  };

  // Start the protected projection request while the static catalog files download.
  globalThis.KISARAGI_LIVE_OVERRIDES_READY = globalThis.KISARAGI_LOAD_LIVE_OVERRIDES();
})();
