#!/usr/bin/env python3
"""OCR product facts from TSN's image-only 2026 accessories catalogs."""

import argparse
import hashlib
import json
import re
import subprocess
import tempfile
import unicodedata
from pathlib import Path


CATALOG_URL = "https://jsapps.c3ml3up76n-jtinterna2-p1-public.model-t.cc.commerce.ondemand.com/tsn/ja/JPY/productCatalog"
PDFS = [
    ("SMOKING_GOODS", "8786400c8527547a500288475d0ff299a1220727a1bc8105c5e4fda1868ca71d", 5, 27),
    ("LIGHTERS", "2d9493884c82a8efe26e358c8b12a33988d50e31e37989d9e8e7716ddcbbc10b", 1, 4),
]
CODE = re.compile(r"^[CD][0-9]{3}$")
PRICE = re.compile(r"([0-9][0-9,]*)\s*円")
SKIP_NAME = re.compile(r"^(?:商品コード|希望小売価格|お得意様|最少ご注文|REGULAR|KING|SLIM|フリー|スロー|巻紙|カートン)")


def normalize(text):
    return unicodedata.normalize("NFKC", text).strip()


def ocr_page(pdf, page, ocr_binary, temp_dir, dpi=250):
    prefix = temp_dir / f"{pdf.stem}-{page}-{dpi}"
    subprocess.run(
        ["pdftoppm", "-f", str(page), "-l", str(page), "-r", str(dpi),
         "-png", "-singlefile", str(pdf), str(prefix)],
        check=True, capture_output=True,
    )
    result = subprocess.run([str(ocr_binary), str(prefix) + ".png"],
                            check=True, capture_output=True, text=True)
    return [
        {**item, "text": normalize(item["text"])}
        for item in json.loads(result.stdout)
    ]


def category_for(source_id, code, page):
    if source_id == "SMOKING_GOODS":
        return "PIPE_ACCESSORIES" if page >= 24 else "ROLLING_ACCESSORIES"
    if code in {"D026", "D005"}:
        return "ASHTRAYS"
    if code in {"D002", "D001"}:
        return "PIPE_ACCESSORIES"
    return "LIGHTERS"


def extract_product(lines, code_line, source_id, page):
    code = code_line["text"]
    x = code_line["x"]
    y = code_line["y"]
    names = [
        item for item in lines
        if x - 0.17 <= item["x"] <= x + 0.05
        and y - 0.07 <= item["y"] <= y - 0.022
        and item["confidence"] >= 0.3
        and len(item["text"]) > 1
        and not SKIP_NAME.search(item["text"])
        and not PRICE.search(item["text"])
        and not CODE.fullmatch(item["text"])
    ]
    names.sort(key=lambda item: (item["y"], item["x"]))
    name = normalize(" ".join(item["text"] for item in names))
    price_lines = [
        item for item in lines
        if abs(item["y"] - (y + 0.016)) <= 0.017
        and x - 0.08 <= item["x"] <= x + 0.12
        and PRICE.search(item["text"])
    ]
    price_lines.sort(key=lambda item: abs(item["y"] - (y + 0.016)))
    listed_price = PRICE.search(price_lines[0]["text"]) if price_lines else None
    category = category_for(source_id, code, page)
    return {
        "code": code,
        "name": f"{code}（商品名確認中）",
        "brand": "UNKNOWN",
        "category": category,
        "source_id": source_id,
        "pdf_page": page,
        "ocr_name_candidate": name or None,
        "ocr_list_price_candidate_jpy": int(listed_price.group(1).replace(",", "")) if listed_price else None,
        "ocr_name_confidence": round(min((item["confidence"] for item in names), default=0), 2),
        "match_status": "IDENTITY_PENDING",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("goods_pdf", type=Path)
    parser.add_argument("lighters_pdf", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--ocr-binary", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--review-output", type=Path)
    args = parser.parse_args()
    pdfs = {"SMOKING_GOODS": args.goods_pdf, "LIGHTERS": args.lighters_pdf}
    products = []
    pages = []
    with tempfile.TemporaryDirectory(prefix="kisaragi-tsn-ocr-") as temp:
        temp_dir = Path(temp)
        for source_id, expected_digest, first_page, last_page in PDFS:
            pdf = pdfs[source_id]
            digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
            if digest != expected_digest:
                raise ValueError(f"Unexpected {source_id} PDF hash: {digest}")
            for page in range(first_page, last_page + 1):
                lines = ocr_page(pdf, page, args.ocr_binary, temp_dir)
                prefix = "C" if source_id == "SMOKING_GOODS" else "D"
                codes = [item for item in lines if CODE.fullmatch(item["text"])
                         and item["text"].startswith(prefix) and item["confidence"] >= 0.3]
                code_labels = sum("商品コード" in item["text"] for item in lines)
                if code_labels > len(codes):
                    fallback_lines = ocr_page(pdf, page, args.ocr_binary, temp_dir, dpi=128)
                    known = {item["text"] for item in codes}
                    for item in fallback_lines:
                        if CODE.fullmatch(item["text"]) and item["text"].startswith(prefix) and item["confidence"] >= 0.3 and item["text"] not in known:
                            codes.append(item)
                            known.add(item["text"])
                if source_id == "LIGHTERS" and page == 3 and "D009" not in {item["text"] for item in codes}:
                    # The bottom-middle item is legibly D009 in the source PDF, but Vision misses its code line.
                    codes.append({"text": "D009", "x": 0.448, "y": 0.783, "confidence": 1})
                if len(codes) != code_labels:
                    raise ValueError(f"{source_id} page {page}: {len(codes)} codes for {code_labels} labels")
                page_products = [extract_product(lines, item, source_id, page) for item in codes]
                products.extend(page_products)
                pages.append({"source": source_id, "page": page, "count": len(codes),
                              "code_labels": code_labels,
                              "sample": [item["code"] for item in page_products[:3]]})
    duplicates = sorted({product["code"] for product in products
                         if sum(item["code"] == product["code"] for item in products) > 1})
    questionable = [product for product in products
                    if not product["ocr_name_candidate"] or product["ocr_name_confidence"] < 0.5]
    print(json.dumps({"total": len(products), "pages": pages,
                      "duplicates": duplicates, "questionable": questionable[:30],
                      "questionable_count": len(questionable)}, ensure_ascii=False))
    if args.review_output:
        args.review_output.write_text(json.dumps({"products": products, "pages": pages},
                                                ensure_ascii=False, indent=2), encoding="utf-8")
    if duplicates or len(products) != 181:
        raise ValueError("Goods source codes failed count or uniqueness gate")
    if args.check:
        return
    sources = {
        key: {
            "source_url": CATALOG_URL,
            "pdf_sha256": hashlib.sha256(pdf.read_bytes()).hexdigest(),
            "catalog_edition": "2026",
            "identity_status": "OCR_REVIEW_REQUIRED",
            "image_permission_basis": "CLIENT_AUTHORIZATION_CONFIRMED_BY_USER_2026-09-20",
        }
        for key, pdf in pdfs.items()
    }
    output = (
        "// Generated by scripts/import-tsn-goods-2026.py after OCR review.\n"
        "globalThis.KISARAGI_TSN_GOODS_2026_SOURCE = Object.freeze("
        + json.dumps(sources, ensure_ascii=False, indent=2)
        + ");\n"
        "globalThis.KISARAGI_TSN_GOODS_2026_SKUS = Object.freeze("
        + json.dumps(products, ensure_ascii=False, indent=2)
        + ".map((product) => Object.freeze(product)));\n"
    )
    args.output.write_text(output, encoding="utf-8")


if __name__ == "__main__":
    main()
