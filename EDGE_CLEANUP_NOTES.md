# Product image edge cleanup

This change trims only the outer screenshot/matte area at render time. It does not alter source product files, image-embedded prices, warning labels, or canonical SKU bindings.

Applied to:
- homepage recommendation cards
- canonical catalog verified images
- product detail gallery

SKU assets explicitly tagged with `has-side-matte` retain their existing asset-specific crop.
