# KISARAGI Japan Catalog P0 Delivery

Delivery scope is intentionally limited to Phase 1 Japanese cigarette catalog closure.

## Canonical paths
- Catalog: `world-tobacco-japan.js` normalized by `catalog-core.js`
- Asset registry: `KISARAGI_ASSET_REGISTRY` in `catalog-core.js`
- User product image payload: `assets/catalog/user-sprite36.b64`
- Website renderer: `world-tobacco-catalog-render.js`
- Catalog presentation: `world-tobacco-catalog.css`
- Runtime loader: `sprite-loader.js`
- Coverage audit: `KISARAGI_CATALOG_AUDIT` + `CATALOG_AUDIT.md`

## Delivery gates
- One canonical catalog only.
- User-uploaded images take priority and preserve observed price text.
- Ambiguous SKU matches remain `CONFLICT_REVIEW`.
- Price conflicts are not silently overwritten.
- Brand navigation is generated from catalog data.
- Website cards are generated from canonical catalog data.
- Future categories reuse the same catalog/source/asset model; no second database.

## Scope lock
Search/filter expansion, product detail, Product Graph expansion, homepage compression and imported/cigar/RYO population are explicitly after image coverage P0.