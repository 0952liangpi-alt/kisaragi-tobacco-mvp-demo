# 商品素材规则

## 当前默认素材

`original/` 中的 SVG 包装 mockup 为原创演示素材，用于替代真实烟草品牌包装。它们不代表真实品牌、商品或价格。

## 商业图库素材

图库素材只允许用于背景、材质或氛围图，不用于伪造真实品牌包装。每张正式素材在进入生产包前必须登记：来源 URL、作者/素材 ID、下载日期、许可名称、许可链接、是否含可识别人像/商标。

已核对的可选来源：

- Unsplash License: https://unsplash.com/license
- Pexels License: https://www.pexels.com/license/

使用前仍需逐张检查人物、商标、包装和平台条款；不要把图库图片原样销售或制作成竞争图库服务。

## `catalog/`

`catalog/` contains only the six photographs whose open copyright licences were
verified in the customer-provided catalog. Their records, source URLs and
licence notes live in `../catalog-data.js`.

The remaining 29 legacy records deliberately contain source-page links but no
local image asset. Do not add those images to a public build until written reuse
permission is recorded. An open photo licence does not waive packaging,
trademark or brand rights.

## `catalog/products/`

This is the canonical per-product delivery path for the 57-SKU Japan reference
catalog and user-uploaded additions. Every file must be bound by
`KISARAGI_ASSET_REGISTRY`; cards never depend on a Base64 sprite or a second
product list.

- `wt-1117-camel-berry-5.jpg` and `wt-1116-camel-berry-8.jpg` are complete
  recoveries from the user-approved upload pack. Their visible prices are part
  of the original pixels and are not cropped or covered.
- `wt-1020-seven-stars.png` reuses the existing local open-license file with an
  exact canonical SKU match. The rejected Peace and Mevius photos are removed
  from the repository and are not bound, cached, or rendered.
- `ua-*.jpg` contains the 29 distinct files from the latest approved upload.
  Visible labels are used as product names; color-only packages and devices stay
  `IDENTITY_PENDING`. Exact duplicate uploads are stored once, and the two
  distinct pastel TEREA images share one canonical product record.

Broken or truncated Base64 artifacts are retained for audit history but are not
loaded by the website and are not counted as `IMAGE_BOUND`.
