# P0 browser acceptance

Open `tests/catalog-p0-smoke.html`: `pass` must be true and TOTAL_REFERENCE_SKU must be 57.

Open `tests/catalog-importer-smoke.html`: `pass` must be true and conflicts must contain `PRICE_CONFLICT`.

Then open the production homepage after merge and verify user-upload product imagery renders in image-bound SKU cards. Do not treat merge alone as visual acceptance.