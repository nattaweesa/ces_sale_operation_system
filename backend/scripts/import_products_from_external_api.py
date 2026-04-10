from __future__ import annotations

import argparse
import asyncio
import json
import re
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.brand import Brand
from app.models.category import Category
from app.models.product import Product


def parse_status(remark: str | None) -> str:
    r = (remark or "").lower()
    if "obsolete" in r:
        return "obsolete"
    if "on request" in r:
        return "on_request"
    return "active"


def parse_moq(remark: str | None) -> int:
    m = re.search(r"MOQ\s*=\s*(\d+)", remark or "", re.IGNORECASE)
    return int(m.group(1)) if m else 1


def to_decimal(raw: Any, default: str = "0") -> Decimal:
    text = str(raw if raw is not None else default).strip().replace(",", "")
    try:
        return Decimal(text)
    except (InvalidOperation, ValueError):
        return Decimal(default)


def build_remark(src_remark: str | None, unit: str | None, source_file: str | None) -> str | None:
    parts: list[str] = []
    if src_remark and src_remark.strip():
        parts.append(src_remark.strip())
    if unit and unit.strip():
        parts.append(f"unit={unit.strip()}")
    if source_file and source_file.strip():
        parts.append(f"source_file={source_file.strip()}")
    return " | ".join(parts) if parts else None


async def get_or_create_brand(session, name: str) -> Brand:
    value = (name or "Unknown").strip() or "Unknown"
    found = (await session.execute(select(Brand).where(Brand.name == value))).scalar_one_or_none()
    if found:
        return found
    obj = Brand(name=value)
    session.add(obj)
    await session.flush()
    return obj


async def get_or_create_category(session, name: str) -> Category:
    value = (name or "Uncategorized").strip() or "Uncategorized"
    found = (await session.execute(select(Category).where(Category.name == value))).scalar_one_or_none()
    if found:
        return found
    obj = Category(name=value)
    session.add(obj)
    await session.flush()
    return obj


async def fetch_payload(url: str, timeout: float) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
    if not isinstance(data, dict):
        raise ValueError("API response must be a JSON object")
    if "products" not in data or not isinstance(data["products"], list):
        raise ValueError("API response must contain products list")
    return data


def load_payload_from_file(file_path: str) -> dict[str, Any]:
    path = Path(file_path)
    if not path.exists():
        raise ValueError(f"Payload file not found: {file_path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Payload file must contain JSON object")
    if "products" not in data or not isinstance(data["products"], list):
        raise ValueError("Payload file must contain products list")
    return data


async def run_import(url: str, timeout: float) -> None:
    payload = await fetch_payload(url, timeout)
    rows: list[dict[str, Any]] = payload.get("products", [])

    inserted = 0
    updated = 0
    skipped = 0

    async with AsyncSessionLocal() as session:
        for row in rows:
            code = str(row.get("product_code") or "").strip()
            if not code:
                skipped += 1
                continue

            description = str(row.get("description") or "").strip() or "Unnamed product"
            brand_name = str(row.get("brand") or "Unknown").strip() or "Unknown"
            category_name = str(row.get("category") or "Uncategorized").strip() or "Uncategorized"
            list_price = to_decimal(row.get("list_price"), default="0")
            src_remark = row.get("remark")
            unit = row.get("unit")
            source_file = row.get("source_file")

            brand = await get_or_create_brand(session, brand_name)
            category = await get_or_create_category(session, category_name)
            remark = build_remark(str(src_remark) if src_remark is not None else None, str(unit) if unit is not None else None, str(source_file) if source_file is not None else None)

            existing = (await session.execute(select(Product).where(Product.item_code == code))).scalar_one_or_none()
            if existing:
                existing.description = description
                existing.brand_id = brand.id
                existing.category_id = category.id
                existing.list_price = list_price
                existing.status = parse_status(str(src_remark) if src_remark is not None else None)
                existing.moq = parse_moq(str(src_remark) if src_remark is not None else None)
                existing.remark = remark
                updated += 1
            else:
                session.add(
                    Product(
                        item_code=code,
                        description=description,
                        brand_id=brand.id,
                        category_id=category.id,
                        list_price=list_price,
                        status=parse_status(str(src_remark) if src_remark is not None else None),
                        moq=parse_moq(str(src_remark) if src_remark is not None else None),
                        remark=remark,
                    )
                )
                inserted += 1

        await session.commit()

    print(f"Source count: {len(rows)}")
    print(f"Inserted: {inserted}")
    print(f"Updated: {updated}")
    print(f"Skipped: {skipped}")


async def run_import_from_payload(payload: dict[str, Any]) -> None:
    rows: list[dict[str, Any]] = payload.get("products", [])

    inserted = 0
    updated = 0
    skipped = 0

    async with AsyncSessionLocal() as session:
        for row in rows:
            code = str(row.get("product_code") or "").strip()
            if not code:
                skipped += 1
                continue

            description = str(row.get("description") or "").strip() or "Unnamed product"
            brand_name = str(row.get("brand") or "Unknown").strip() or "Unknown"
            category_name = str(row.get("category") or "Uncategorized").strip() or "Uncategorized"
            list_price = to_decimal(row.get("list_price"), default="0")
            src_remark = row.get("remark")
            unit = row.get("unit")
            source_file = row.get("source_file")

            brand = await get_or_create_brand(session, brand_name)
            category = await get_or_create_category(session, category_name)
            remark = build_remark(str(src_remark) if src_remark is not None else None, str(unit) if unit is not None else None, str(source_file) if source_file is not None else None)

            existing = (await session.execute(select(Product).where(Product.item_code == code))).scalar_one_or_none()
            if existing:
                existing.description = description
                existing.brand_id = brand.id
                existing.category_id = category.id
                existing.list_price = list_price
                existing.status = parse_status(str(src_remark) if src_remark is not None else None)
                existing.moq = parse_moq(str(src_remark) if src_remark is not None else None)
                existing.remark = remark
                updated += 1
            else:
                session.add(
                    Product(
                        item_code=code,
                        description=description,
                        brand_id=brand.id,
                        category_id=category.id,
                        list_price=list_price,
                        status=parse_status(str(src_remark) if src_remark is not None else None),
                        moq=parse_moq(str(src_remark) if src_remark is not None else None),
                        remark=remark,
                    )
                )
                inserted += 1

        await session.commit()

    print(f"Source count: {len(rows)}")
    print(f"Inserted: {inserted}")
    print(f"Updated: {updated}")
    print(f"Skipped: {skipped}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import products from external master-data API")
    parser.add_argument("--url", help="External API URL, e.g. http://host:port/api/products")
    parser.add_argument("--file", help="Path to JSON payload file with { count, products: [] }")
    parser.add_argument("--timeout", type=float, default=20.0, help="HTTP timeout seconds")
    args = parser.parse_args()
    if not args.url and not args.file:
        raise SystemExit("Either --url or --file is required")

    if args.file:
        payload = load_payload_from_file(args.file)
        asyncio.run(run_import_from_payload(payload))
    else:
        asyncio.run(run_import(args.url, args.timeout))


if __name__ == "__main__":
    main()
