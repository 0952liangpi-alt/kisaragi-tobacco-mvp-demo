#!/usr/bin/env python3
"""Extract code-addressable products from the client-authorized TSN 2026 PDF."""

import argparse
import hashlib
import io
import json
import re
import subprocess
import unicodedata
from pathlib import Path

import pdfplumber
from PIL import Image


SOURCE_URL = (
    "https://api.c3ml3up76n-jtinterna2-p1-public.model-t.cc.commerce.ondemand.com/"
    "medias/-2026-4-20260521-.pdf?context="
    "bWFzdGVyfGltYWdlc3wzODE5OTUxMXxhcHBsaWNhdGlvbi9wZGZ8YURCbUwyZ3paQzg0"
    "T0RreU1qQTNORE14TnpFd0wtaTh1T1dGcGVPQm4tT0JzT09Cay1PQ3EtT0N2LU9EcmVP"
    "Q3NGOHlNREkyNWJtME5PYWNpT2VKaUY4eU1ESTJNRFV5TWVTX3J1YXRveTV3WkdZfDMx"
    "OGM2NWQ4ZjFkZWQ3NzEyM2YyMTQzMTZiYTE3MjA5MWU2M2QxM2NmM2NlZGY2NmM2YTc0"
    "ZGUxMjhiZTY3ZGM"
)
CODE_RE = re.compile(r"[0-9]{4}")
PRICE_RE = re.compile(r"([0-9][0-9,]*)\s*円")
PACK_RE = re.compile(r"([0-9]+(?:\.[0-9]+)?)\s*(本|g|個)\s*(?:入|/)"
                     )


def normalize(value):
    return unicodedata.normalize("NFKC", value).replace("\u0007", "").strip()


def extract_cell(page, page_number, word):
    left = word["x0"] - 17
    top = word["top"]
    cell = page.crop((left, top - 2, left + 136, min(top + 132, page.height)))
    words = cell.extract_words()
    code = word["text"]
    if not words or words[0]["text"] != code:
        raise ValueError(f"Page {page_number}: code/cell mismatch {code}")
    price_words = [item for item in words if PRICE_RE.search(normalize(item["text"]))]
    if not price_words:
        raise ValueError(f"Page {page_number}: no price for {code}")
    price_top = min(item["top"] for item in price_words)
    name_words = [
        item for item in words
        if top + 67 <= item["top"] < price_top - 1
        and item["text"] not in ("カートン", "個", "装")
        and not re.fullmatch(r"[0-9 ]+", item["text"])
    ]
    name = normalize(" ".join(item["text"] for item in name_words))
    name = re.sub(r"\s*・\s*", "・", name)
    name = re.sub(r"\s+", " ", name)
    if len(name) < 2:
        raise ValueError(f"Page {page_number}: no reliable name for {code}: {name!r}")
    body = normalize(cell.extract_text() or "")
    price = PRICE_RE.search(body)
    pack = PACK_RE.search(body)
    if not price or not pack:
        raise ValueError(f"Page {page_number}: no price/pack for {code}: {body[-120:]}")
    manufacturer = re.search(r"〈([^〉]+)〉", body)
    tar = re.search(r"タール\s*[:：]\s*([0-9.]+)", body)
    nicotine = re.search(r"ニコチン\s*[:：]\s*([0-9.]+)", body)
    if page_number <= 7 or 14 <= page_number <= 16:
        category = "IMPORTED_CIGARETTES"
    elif 8 <= page_number <= 11 or code in {"3785", "2213", "3786"}:
        category = "HEATED_TOBACCO_STICKS"
    elif page_number <= 13:
        category = "CIGARS"
    elif page_number <= 27:
        category = "RYO" if "手巻たばこ" in name else "PIPE_TOBACCO"
    elif page_number <= 35:
        category = "CIGARS"
    elif page_number == 36:
        category = "SMOKELESS_TOBACCO"
    else:
        category = "CUT_TOBACCO"
    brand = re.split(r"[・\s（(]", name, maxsplit=1)[0]
    amount = float(pack.group(1))
    official_price = int(price.group(1).replace(",", ""))
    return {
        "code": code,
        "brand": brand,
        "name": name,
        "category": category,
        "manufacturer": normalize(manufacturer.group(1)) if manufacturer else None,
        "pack_size": int(amount) if amount.is_integer() else amount,
        "pack_unit": pack.group(2),
        "tar_mg": float(tar.group(1)) if tar else None,
        "nicotine_mg": float(nicotine.group(1)) if nicotine else None,
        # Compatibility field retained for existing catalog consumers.
        "historical_list_price_jpy": official_price,
        "official_catalog_price_jpy": official_price,
        "official_catalog_price_text": f"{official_price:,}円",
        "official_catalog_price_source_id": "TSN_IMPORT_2026_04",
        "official_catalog_price_as_of": "2026-05-21",
        "official_catalog_price_effective_from": None,
        "official_catalog_price_effective_to": None,
        "official_catalog_price_type": "CATALOG_LISTED_PRICE",
        "official_catalog_price_tax_included": None,
        "official_catalog_price_extraction_status": "SOURCE_EXTRACTED",
        "pdf_page": page_number,
    }


def product_image_bounds(page, word):
    left = word["x0"] - 17
    top = word["top"]
    pieces = [
        image for image in page.images
        if left + 58 <= image["x0"] < left + 136
        and top - 10 <= image["top"] < top + 85
        and (round(image["width"]), round(image["height"]))
        not in {(94, 31), (31, 92), (31, 31)}
    ]
    if not pieces:
        return None
    return (
        min(image["x0"] for image in pieces),
        min(image["top"] for image in pieces),
        max(image["x1"] for image in pieces),
        max(image["bottom"] for image in pieces),
    )


def render_page(pdf, page_number):
    result = subprocess.run(
        ["pdftoppm", "-f", str(page_number), "-l", str(page_number),
         "-r", "300", "-png", "-singlefile", str(pdf)],
        check=True, capture_output=True,
    )
    image = Image.open(io.BytesIO(result.stdout))
    image.load()
    return image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--asset-dir", type=Path)
    args = parser.parse_args()
    digest = hashlib.sha256(args.pdf.read_bytes()).hexdigest()
    products = []
    image_bounds = {}
    with pdfplumber.open(args.pdf) as pdf:
        if len(pdf.pages) != 40:
            raise ValueError(f"Unexpected TSN PDF page count: {len(pdf.pages)}")
        for page_number in range(2, 38):
            page = pdf.pages[page_number - 1]
            words = [
                word for word in page.extract_words(extra_attrs=["size"])
                if CODE_RE.fullmatch(word["text"])
                and 8.8 <= word["size"] <= 9.2
                and 30 <= word["top"] < 800
                and 30 <= word["x0"] <= 465
            ]
            for word in sorted(words, key=lambda item: (item["top"], item["x0"])):
                product = extract_cell(page, page_number, word)
                products.append(product)
                image_bounds[product["code"]] = product_image_bounds(page, word)
    codes = [product["code"] for product in products]
    if len(set(codes)) != len(codes):
        repeated = sorted({code for code in codes if codes.count(code) > 1})
        raise ValueError(f"Duplicate TSN product codes: {repeated}")
    if len(products) < 500:
        raise ValueError(f"Suspiciously few TSN products: {len(products)}")
    by_category = {}
    for product in products:
        by_category[product["category"]] = by_category.get(product["category"], 0) + 1
    print(json.dumps({"products": len(products), "by_category": by_category,
                      "pdf_sha256": digest}, ensure_ascii=False))
    if args.check:
        return
    if args.asset_dir:
        repo = Path(__file__).resolve().parent.parent
        expected_asset_dir = (repo / "assets/catalog/products").resolve()
        if args.asset_dir.resolve() != expected_asset_dir:
            raise ValueError("Assets must stay in the existing products directory")
        if args.output.resolve() != (repo / "tsn-imported-catalog-2026.js").resolve():
            raise ValueError("Images require the canonical TSN source file")
        current = subprocess.run(
            ["node", "-e", "require('./world-tobacco-japan.js');"
             "require('./jt-catalog-2025.js');require('./catalog-core.js');"
             "process.stdout.write(JSON.stringify(KISARAGI_CANONICAL_CATALOG"
             ".filter(x=>x.product_code).map(x=>({code:x.product_code,image:!!x.image}))));"],
            cwd=repo, check=True, capture_output=True, text=True,
        )
        existing = {item["code"]: item["image"] for item in json.loads(current.stdout)}
        known_hashes = {
            hashlib.sha256(path.read_bytes()).hexdigest(): path
            for path in expected_asset_dir.iterdir() if path.is_file()
        }
        rendered_page_number = None
        rendered_page = None
        pending_files = []
        for product in products:
            code = product["code"]
            if existing.get(code) or image_bounds[code] is None:
                continue
            page_number = product["pdf_page"]
            if page_number != rendered_page_number:
                rendered_page = render_page(args.pdf, page_number)
                rendered_page_number = page_number
            x0, y0, x1, y1 = image_bounds[code]
            scale = 300 / 72
            image = rendered_page.crop(tuple(round(value * scale) for value in (x0, y0, x1, y1)))
            if image.width < 110 or image.height < 100:
                product["image_match_status"] = "LOW_RESOLUTION_REVIEW"
                continue
            encoded = io.BytesIO()
            image.convert("RGB").save(encoded, format="JPEG", quality=94, subsampling=0, optimize=True)
            data = encoded.getvalue()
            image_hash = hashlib.sha256(data).hexdigest()
            path = expected_asset_dir / f"tsn-{code}-2026.jpg"
            if image_hash in known_hashes and known_hashes[image_hash] != path:
                product["image_match_status"] = "DUPLICATE_IMAGE_REVIEW"
                continue
            if path.exists() and path.read_bytes() != data:
                raise ValueError(f"Existing image differs from PDF: {path}")
            known_hashes[image_hash] = path
            product["image_asset"] = {
                "file_path": f"assets/catalog/products/{path.name}",
                "sha256": image_hash,
                "width": image.width,
                "height": image.height,
                "pdf_page": page_number,
            }
            if not path.exists():
                pending_files.append((path, data))
        for path, data in pending_files:
            path.write_bytes(data)
    metadata = {
        "source_id": "TSN_IMPORT_2026_04",
        "source_url": SOURCE_URL,
        "pdf_sha256": digest,
        "price_as_of": "2026-05-21",
        "official_catalog_price_type": "CATALOG_LISTED_PRICE",
        "official_catalog_price_tax_included": None,
        "official_catalog_price_as_of": "2026-05-21",
        "official_catalog_price_effective_from": None,
        "official_catalog_price_effective_to": None,
        "official_catalog_price_extraction_status": "SOURCE_EXTRACTED",
        "scope": "TS Network imported and CAP tobacco catalog, revised 2026-05-21",
        "image_permission_basis": "CLIENT_AUTHORIZATION_CONFIRMED_BY_USER_2026-09-20",
    }
    output = (
        "// Generated by scripts/import-tsn-2026.py from the verified TSN PDF.\n"
        "globalThis.KISARAGI_TSN_2026_SOURCE = Object.freeze("
        + json.dumps(metadata, ensure_ascii=False, indent=2)
        + ");\n"
        "globalThis.KISARAGI_TSN_2026_SKUS = Object.freeze("
        + json.dumps(products, ensure_ascii=False, indent=2)
        + ".map((product) => Object.freeze(product)));\n"
    )
    args.output.write_text(output, encoding="utf-8")


if __name__ == "__main__":
    main()
