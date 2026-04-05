from __future__ import annotations

import argparse
import re
from decimal import Decimal
from pathlib import Path

from pypdf import PdfReader
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.brand import Brand
from app.models.category import Category
from app.models.product import Product


ROW_RE = re.compile(r"^\s*(\d+)\s*([A-Za-z0-9][A-Za-z0-9\-/_\.]+)\s+(.+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})\s*(.*)$")

IGNORE_LINE_RE = re.compile(
    r"^(SMART SOLUTIONS|Item Code Description|Price list RCU|Issued date|Page \d+ of \d+|\(กรณี|ค่าเฟิมแวร์|50,000\)|Picture)$",
    re.IGNORECASE,
)


def normalize_category(line: str) -> str:
    cleaned = " ".join(line.split())
    return cleaned.strip().title()


def parse_status(remark: str) -> str:
    r = (remark or "").lower()
    if "obsolete" in r:
        return "obsolete"
    if "on request" in r:
        return "on_request"
    return "active"


def parse_moq(remark: str) -> int:
    m = re.search(r"MOQ\s*=\s*(\d+)", remark, re.IGNORECASE)
    return int(m.group(1)) if m else 1


def parse_pdf_rows(pdf_path: Path) -> tuple[list[dict], list[str]]:
    reader = PdfReader(str(pdf_path))
    current_category = "Uncategorized"
    rows: list[dict] = []
    skipped: list[str] = []

    for page in reader.pages:
        text = page.extract_text() or ""
        for raw in text.split("\n"):
            line = raw.strip()
            if not line:
                continue

            if IGNORE_LINE_RE.search(line):
                continue

            match = ROW_RE.match(line)
            if not match:
                # Non-row lines are treated as category headings.
                if not re.match(r"^\d+\s", line):
                    current_category = normalize_category(line)
                else:
                    skipped.append(line)
                continue

            _, item_code, desc, price_str, remark = match.groups()
            rows.append(
                {
                    "item_code": item_code.strip(),
                    "description": " ".join(desc.split()).strip(),
                    "list_price": Decimal(price_str.replace(",", "")),
                    "remark": " ".join(remark.split()).strip() or None,
                    "status": parse_status(remark),
                    "moq": parse_moq(remark),
                    "category": current_category,
                }
            )

    return rows, skipped


async def get_or_create_brand(session, name: str) -> Brand:
    q = await session.execute(select(Brand).where(Brand.name == name))
    brand = q.scalar_one_or_none()
    if brand:
        return brand
    brand = Brand(name=name)
    session.add(brand)
    await session.flush()
    return brand


async def get_or_create_category(session, name: str) -> Category:
    q = await session.execute(select(Category).where(Category.name == name))
    category = q.scalar_one_or_none()
    if category:
        return category
    category = Category(name=name)
    session.add(category)
    await session.flush()
    return category


async def run_import(pdf_path: Path, brand_name: str) -> None:
    rows, skipped = parse_pdf_rows(pdf_path)

    inserted = 0
    updated = 0

    async with AsyncSessionLocal() as session:
        brand = await get_or_create_brand(session, brand_name)

        for row in rows:
            category = await get_or_create_category(session, row["category"])
            q = await session.execute(select(Product).where(Product.item_code == row["item_code"]))
            product = q.scalar_one_or_none()

            if product:
                product.description = row["description"]
                product.list_price = row["list_price"]
                product.remark = row["remark"]
                product.status = row["status"]
                product.moq = row["moq"]
                product.brand_id = brand.id
                product.category_id = category.id
                updated += 1
            else:
                product = Product(
                    item_code=row["item_code"],
                    description=row["description"],
                    list_price=row["list_price"],
                    remark=row["remark"],
                    status=row["status"],
                    moq=row["moq"],
                    brand_id=brand.id,
                    category_id=category.id,
                )
                session.add(product)
                inserted += 1

        await session.commit()

    print(f"Imported rows: {len(rows)}")
    print(f"Inserted: {inserted}")
    print(f"Updated: {updated}")
    print(f"Skipped lines: {len(skipped)}")

    if skipped:
        out = pdf_path.parent / "import_skipped_lines.txt"
        out.write_text("\n".join(skipped), encoding="utf-8")
        print(f"Skipped line report: {out}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import product master data from SMART RCU price list PDF")
    parser.add_argument("--pdf", required=True, help="Path to source PDF")
    parser.add_argument("--brand", default="SMART", help="Brand name to assign")
    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")

    import asyncio

    asyncio.run(run_import(pdf_path, args.brand))


if __name__ == "__main__":
    main()
