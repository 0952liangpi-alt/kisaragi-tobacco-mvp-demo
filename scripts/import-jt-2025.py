#!/usr/bin/env python3
"""Extract product facts from the reviewed JT October 2025 PDF."""

import argparse
import hashlib
import io
import json
import re
import subprocess
import unicodedata
from pathlib import Path
from tempfile import TemporaryDirectory

import pdfplumber
from PIL import Image


EXPECTED_SHA256 = "ebe8533550163676bfe3a230c0401d08a62266bd43a1c2cde9d9836a4314206e"
SOURCE_URL = (
    "https://api.c3ml3up76n-jtinterna2-p1-public.model-t.cc.commerce.ondemand.com/"
    "medias/JT-2025-10-.pdf?context="
    "bWFzdGVyfGltYWdlc3wzNTgxMzQ2M3xhcHBsaWNhdGlvbi9wZGZ8YUdGaUwyZ3lNUzg0"
    "T0RnMk5UTXlPRGs0T0RRMkwwcFU0NEtyNDRLXzQ0T3Q0NEt3WHpJd01qWGx1YlF4"
    "TU9hY2lDNXdaR1l8ODQzNzE3OWZhZWQ4YzAzZmUwMDBlZTEyNGVjMTAzZDVmYjk4"
    "NGE2ZmQwMTVkNzZlMDhmOGIyYzczYzRmODI2Yg"
)
BRANDS = (
    ("メビウス", "メビウス"),
    ("セブンスター", "セブンスター"),
    ("ウィンストン", "ウィンストン"),
    ("ホープ", "ホープ"),
    ("ザ・ピース", "ピース"),
    ("ピース", "ピース"),
    ("キャメル", "キャメル"),
    ("ナチュラル", "ナチュラルアメリカンスピリット"),
    ("ハイライト", "ハイライト"),
    ("ピアニッシモ", "ピアニッシモ"),
    ("わかば", "わかば・エコー"),
    ("エコー", "わかば・エコー"),
    ("ウルマ", "ウルマ"),
    ("エボ", "エボ"),
    ("ゼロスタイル", "ゼロスタイル"),
)


def normalize(text):
    return unicodedata.normalize("NFKC", text).replace("\u0007", "").strip()


def extract_product(page, page_number, word):
    col = round((word["x0"] - 111) / 122)
    top = word["top"]
    cell = page.crop((87 + 122 * col, top - 2, 209 + 122 * col, min(top + 355, 822)))
    lines = [normalize(line) for line in (cell.extract_text() or "").splitlines()]
    code = word["text"]
    if not lines or lines[0] != code:
        raise ValueError(f"Code/cell mismatch on page {page_number}: {code}, {lines[:2]}")

    name_lines = []
    for line in lines[1:]:
        if any(marker in line for marker in ("本入/", "たばこスティック", "たばこカプセル", "(標準)", "円")):
            break
        name_lines.append(line)
    name = re.sub(r"\s+・", "・", re.sub(r"・\s+", "・", " ".join(name_lines))).strip()
    if not name:
        raise ValueError(f"Missing name for {code} on page {page_number}")
    brand = next((value for prefix, value in BRANDS if name.startswith(prefix)), None)
    if not brand:
        raise ValueError(f"Unknown brand for {code}: {name}")

    body = " ".join(lines[1:])
    price = re.search(r"([0-9][0-9,]*)\s*円", body)
    if not price:
        raise ValueError(f"Missing historical price for {code}: {body}")
    official_price = int(price.group(1).replace(",", ""))
    pack = re.search(r"([0-9]+)\s*本入", body)
    pack_unit = "本"
    if page_number == 21:
        pack = re.search(r"([0-9]+)\s*個入", body)
        pack_unit = "カプセル"
    elif page_number == 22:
        pack = re.search(r"([0-9]+)\s*個入り", body)
        pack_unit = "個"
    if not pack:
        raise ValueError(f"Missing pack size for {code}: {body}")

    tar = re.search(r"タール値[:：]\s*([0-9.]+)", body)
    nicotine = re.search(r"ニコチン値[:：]\s*([0-9.]+)", body)
    category = "CIGARETTES"
    if code == "1919":
        category = "CIGARS"
    elif 18 <= page_number <= 20:
        category = "HEATED_TOBACCO_STICKS"
    elif page_number == 21:
        category = "HEATED_TOBACCO_CAPSULES"
    elif page_number == 22:
        category = "SMOKELESS_TOBACCO"
    return {
        "code": code,
        "brand": brand,
        "name": name,
        "category": category,
        "pack_size": int(pack.group(1)),
        "pack_unit": pack_unit,
        "tar_mg": float(tar.group(1)) if tar else None,
        "nicotine_mg": float(nicotine.group(1)) if nicotine else None,
        # Compatibility field retained for existing catalog consumers.
        "historical_list_price_jpy": official_price,
        "official_catalog_price_jpy": official_price,
        "official_catalog_price_text": f"{official_price:,}円",
        "official_catalog_price_source_id": "JT_CATALOG_2025_10",
        "official_catalog_price_as_of": "2025-10-01",
        "official_catalog_price_effective_from": None,
        "official_catalog_price_effective_to": None,
        "official_catalog_price_type": "FIXED_LIST_PRICE",
        "official_catalog_price_tax_included": True,
        "official_catalog_price_extraction_status": "SOURCE_EXTRACTED",
        "pdf_page": page_number,
    }


def existing_bindings(repo_root):
    script = (
        "require('./world-tobacco-japan.js');"
        "require('./jt-catalog-2025.js');"
        "require('./catalog-core.js');"
        "process.stdout.write(JSON.stringify({"
        "referenceIds:Object.fromEntries(KISARAGI_JAPAN_SKUS.map(x=>[x.code,x.id])),"
        "boundSkus:KISARAGI_ASSET_REGISTRY.filter(x=>x.file_path&&x.source!=="
        "'JT_CATALOG_2025_10').map(x=>x.sku),"
        "jtAssets:Object.fromEntries(KISARAGI_JT_2025_SKUS.filter(x=>x.image_asset)"
        ".map(x=>[x.code,x.image_asset]))"
        "}));"
    )
    result = subprocess.run(
        ["node", "-e", script], cwd=repo_root, check=True,
        capture_output=True, text=True,
    )
    return json.loads(result.stdout)


def image_code(page_number, image, codes):
    matches = [
        word for word in codes
        if abs(image["x0"] + 15 - word["x0"]) < 18
        and 0 < image["top"] - word["top"] < 80
    ]
    if len(matches) != 1:
        raise ValueError(f"Ambiguous image/code placement on page {page_number}: {matches}")
    return matches[0]["text"]


def decoded_pdf_images(pdf_path, image_streams, directory):
    listing = subprocess.run(
        ["pdfimages", "-list", str(pdf_path)], check=True, capture_output=True, text=True,
    ).stdout
    by_object = {}
    for line in listing.splitlines():
        columns = line.split()
        if len(columns) < 11 or columns[2] != "image":
            continue
        key = (int(columns[0]), int(columns[10]))
        if key in by_object:
            raise ValueError(f"Duplicate PDF image object: {key}")
        by_object[key] = (int(columns[1]), int(columns[3]), int(columns[4]))

    prefix = directory / "jt-image"
    subprocess.run(["pdfimages", "-png", str(pdf_path), str(prefix)], check=True)
    decoded = {}
    for code, source in image_streams.items():
        key = (source["pdf_page"], source["stream"].objid)
        if key not in by_object:
            raise ValueError(f"PDF image object for {code} was not decoded: {key}")
        number, width, height = by_object[key]
        if (width, height) != source["srcsize"]:
            raise ValueError(f"PDF image dimensions changed for {code}: {(width, height)}")
        path = directory / f"jt-image-{number:03d}.png"
        if not path.is_file():
            raise ValueError(f"Decoded PDF image is missing for {code}: {path}")
        decoded[code] = path
    return decoded


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--asset-dir", type=Path)
    parser.add_argument("--client-authorized-images", action="store_true")
    parser.add_argument("--repair-color", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if bool(args.asset_dir) != args.client_authorized_images:
        raise ValueError("Image extraction requires --asset-dir and --client-authorized-images together")
    if args.repair_color and not args.client_authorized_images:
        raise ValueError("Color repair requires authorized image extraction")
    digest = hashlib.sha256(args.pdf.read_bytes()).hexdigest()
    if digest != EXPECTED_SHA256:
        raise ValueError(f"Unexpected PDF SHA-256: {digest}")

    products = []
    image_streams = {}
    with pdfplumber.open(args.pdf) as pdf:
        if len(pdf.pages) != 24:
            raise ValueError(f"Unexpected PDF page count: {len(pdf.pages)}")
        for page_index in range(3, 22):
            page = pdf.pages[page_index]
            codes = [
                word for word in page.extract_words(extra_attrs=["size"])
                if re.fullmatch(r"[0-9]{4}", word["text"])
                and 10.5 <= word["size"] <= 11.5
            ]
            for word in sorted(codes, key=lambda value: (value["top"], value["x0"])):
                products.append(extract_product(page, page_index + 1, word))
            if args.client_authorized_images:
                if len(page.images) != len(codes):
                    raise ValueError(f"Image/code count mismatch on page {page_index + 1}")
                for image in page.images:
                    code = image_code(page_index + 1, image, codes)
                    if code in image_streams:
                        raise ValueError(f"Duplicate PDF image for product code {code}")
                    image_streams[code] = {
                        "stream": image["stream"],
                        "pdf_page": page_index + 1,
                        "srcsize": image["srcsize"],
                    }

    if len(products) != 134 or len({product["code"] for product in products}) != 134:
        raise ValueError(f"Expected 134 unique products, got {len(products)}")
    pending_files = []
    if args.client_authorized_images:
        if set(image_streams) != {product["code"] for product in products}:
            raise ValueError("PDF image codes do not match the product catalog")
        repo_root = Path(__file__).resolve().parent.parent
        asset_dir = (repo_root / "assets/catalog/products").resolve()
        if args.output.resolve() != (repo_root / "jt-catalog-2025.js").resolve():
            raise ValueError("Image extraction must update the canonical JT source file")
        if args.asset_dir.resolve() != asset_dir:
            raise ValueError("Images must stay under assets/catalog/products")
        binding = existing_bindings(repo_root)
        bound_skus = set(binding["boundSkus"])
        reference_ids = binding["referenceIds"]
        existing_hashes = {
            hashlib.sha256(path.read_bytes()).hexdigest(): path
            for path in asset_dir.iterdir() if path.is_file()
        }
        new_hashes = set()
        with TemporaryDirectory(prefix="kisaragi-jt-images-") as temporary:
            decoded = decoded_pdf_images(args.pdf, image_streams, Path(temporary))
            for product in products:
                code = product["code"]
                sku = reference_ids.get(code, f"jt-{code}")
                if sku in bound_skus:
                    continue
                source = image_streams[code]
                with Image.open(decoded[code]) as source_image:
                    source_image.load()
                    image = source_image.convert("RGB")
                width, height = image.size
                if (width, height) != source["srcsize"] or width < 200 or height < 280:
                    raise ValueError(f"Image dimensions for {code} are invalid: {image.size}")
                encoded = io.BytesIO()
                image.save(encoded, format="JPEG", quality=94, subsampling=0, optimize=True)
                data = encoded.getvalue()
                image_hash = hashlib.sha256(data).hexdigest()
                filename = f"{sku}-jt-2025.jpg"
                path = asset_dir / filename
                if image_hash in new_hashes:
                    raise ValueError(f"Duplicate output image hash for {code}")
                if image_hash in existing_hashes and existing_hashes[image_hash] != path:
                    raise ValueError(f"Image for {code} duplicates {existing_hashes[image_hash]}")
                if path.exists() and path.read_bytes() != data:
                    previous = binding["jtAssets"].get(code)
                    current_hash = hashlib.sha256(path.read_bytes()).hexdigest()
                    if not args.repair_color or not previous or (
                        previous["file_path"] != f"assets/catalog/products/{filename}"
                        or previous["sha256"] != current_hash
                        or previous["pdf_object_id"] != source["stream"].objid
                    ):
                        raise ValueError(f"Existing image differs from reviewed JT binding: {path}")
                elif args.repair_color and not path.exists():
                    raise ValueError(f"Reviewed JT image is missing: {path}")
                new_hashes.add(image_hash)
                product["image_asset"] = {
                    "file_path": f"assets/catalog/products/{filename}",
                    "sha256": image_hash,
                    "width": width,
                    "height": height,
                    "pdf_object_id": source["stream"].objid,
                }
                if not path.exists() or path.read_bytes() != data:
                    pending_files.append((path, data))
    metadata = {
        "source_id": "JT_CATALOG_2025_10",
        "source_url": SOURCE_URL,
        "pdf_sha256": digest,
        "price_as_of": "2025-10-01",
        "official_catalog_price_type": "FIXED_LIST_PRICE",
        "official_catalog_price_tax_included": True,
        "official_catalog_price_as_of": "2025-10-01",
        "official_catalog_price_effective_from": None,
        "official_catalog_price_effective_to": None,
        "official_catalog_price_extraction_status": "SOURCE_EXTRACTED",
        "scope": "JT products listed for Japan in the October 2025 manufacturer catalog",
        "image_permission_basis": (
            "CLIENT_AUTHORIZATION_CONFIRMED_BY_USER_2026-09-20"
            if args.client_authorized_images else None
        ),
    }
    output = (
        "// Generated by scripts/import-jt-2025.py from the verified JT PDF.\n"
        "globalThis.KISARAGI_JT_2025_SOURCE = Object.freeze("
        + json.dumps(metadata, ensure_ascii=False, indent=2)
        + ");\n"
        "globalThis.KISARAGI_JT_2025_SKUS = Object.freeze("
        + json.dumps(products, ensure_ascii=False, indent=2)
        + ".map((product) => Object.freeze(product)));\n"
    )
    if args.dry_run:
        print(f"Validated {len(products)} JT products and {len(pending_files)} color repairs; no files written")
        return
    for path, data in pending_files:
        path.write_bytes(data)
    temporary_output = args.output.with_suffix(args.output.suffix + ".tmp")
    temporary_output.write_text(output, encoding="utf-8")
    temporary_output.replace(args.output)
    print(f"Extracted {len(products)} unique JT products and {len(pending_files)} image bindings to {args.output}")


if __name__ == "__main__":
    main()
