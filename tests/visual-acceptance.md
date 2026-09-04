# Visual acceptance gate

On the fixed GitHub Pages URL after merge:

1. Enter age gate.
2. Scroll to canonical Japanese catalog.
3. Confirm 57 product cards exist.
4. Confirm cards with USER_APPROVED_IMAGE show the uploaded product imagery, not the old generic catalog placeholders.
5. Confirm image price text remains visible inside uploaded source imagery where present.
6. Confirm structured price is also rendered from the catalog.
7. Confirm missing images explicitly show IMAGE PENDING.
8. Confirm brand tabs filter the same canonical 57 SKU set.

Failure of step 4 means P0 is not accepted.