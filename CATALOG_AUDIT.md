# KISARAGI Canonical Catalog Audit

## Existing-system classification

- **ALREADY_EXISTS** — Current site, `catalog-data.js`, World Tobacco 57-SKU Japan reference import, responsive Japan catalog UI, existing `assets/catalog/` image area, fixed GitHub Pages deployment.
- **PARTIAL** — Product truth was split between legacy `catalog-data.js` and `world-tobacco-japan.js`; the website rendered the reference list directly rather than a canonical normalized catalog.
- **REAL_GAP** — User-upload asset registry, stable SKU↔asset binding, source registry, conflict handling, coverage audit and canonical-catalog-driven rendering.
- **CONFLICT** — Three Natural American Spirit Organic Mint (14) user images cannot be uniquely assigned to reference IDs `wt-1525`, `wt-1524`, `wt-1523` from visible screenshot data alone. They remain `CONFLICT_REVIEW`; no SKU is guessed.

## Phase 1 contract

Japan cigarette reference catalog is normalized into one canonical runtime catalog. User-provided imagery has priority over local verified imagery and external sources. Image-embedded prices are preserved; `price_jpy` remains a separate maintained field. Price disagreements must become `PRICE_CONFLICT`, never silent overwrite.

Pipeline:

`SOURCE → NORMALIZE → SKU MATCH → DEDUPLICATE → CONFLICT CHECK → CANONICAL CATALOG → ASSET REGISTRY → WEBSITE → VALIDATION → DEPLOYMENT`

## Phase 2 readiness

The same schema is reserved for `JAPANESE_CIGARETTES`, `IMPORTED_CIGARETTES`, `RYO`, `CIGARS`, and `PIPE_TOBACCO`. Non-applicable fields stay null/UNKNOWN; no separate database per category is permitted.

## Registries

- Canonical catalog: `catalog-core.js` / `globalThis.KISARAGI_CANONICAL_CATALOG`
- Source registry: `globalThis.KISARAGI_SOURCE_REGISTRY`
- Asset registry: `globalThis.KISARAGI_ASSET_REGISTRY`
- Runtime audit: `globalThis.KISARAGI_CATALOG_AUDIT`
- Reference adapter: `world-tobacco-japan.js`

Final counts are generated from the canonical runtime catalog and displayed on the website catalog summary.