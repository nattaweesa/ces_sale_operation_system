from __future__ import annotations

import io
import re
from dataclasses import dataclass
from decimal import Decimal
from difflib import SequenceMatcher
from typing import Optional

from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product


STRICT_PRODUCT_LINE_RE = re.compile(
    r"^(?P<item_no>\d+)\s+"
    r"(?P<cat>[A-Za-z0-9][A-Za-z0-9_\-\/.]{2,80})\s+"
    r"(?P<desc>.+?)\s+"
    r"(?P<brand>[A-Za-z][A-Za-z0-9&.\-]*(?:\s+[A-Za-z][A-Za-z0-9&.\-]*){0,2})\s+"
    r"(?P<list>\d[\d,]*(?:\.\d{1,2})?)\s+"
    r"(?P<qty>\d+(?:\.\d{1,3})?)\s+"
    r"(?P<amount>\d[\d,]*(?:\.\d{1,2})?)$"
)


@dataclass
class ParsedLine:
    line_no: int
    raw_text: str
    item_code: Optional[str]
    description: str
    quantity: Decimal
    unit: Optional[str]
    list_price: Decimal
    net_price: Decimal
    amount: Decimal


def normalize_text(text: Optional[str]) -> str:
    if not text:
        return ""
    cleaned = "".join(ch.lower() if ch.isalnum() else " " for ch in text)
    return " ".join(cleaned.split())


def to_decimal(raw: Optional[str], default: str = "0.00") -> Decimal:
    if not raw:
        return Decimal(default)
    return Decimal(raw.replace(",", "").strip())


def _normalize_number_separators(line: str) -> str:
    # Fix OCR/PDF extraction artifacts: "162 ,988.70" -> "162,988.70" and "716 .18" -> "716.18".
    line = re.sub(r"(\d)\s*,\s*(\d)", r"\1,\2", line)
    line = re.sub(r"(\d)\s*\.\s*(\d)", r"\1.\2", line)
    return line


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    chunks: list[str] = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        if page_text.strip():
            chunks.append(page_text)
    return "\n".join(chunks)


def parse_product_lines(text: str) -> list[ParsedLine]:
    parsed: list[ParsedLine] = []
    lines = [_normalize_number_separators(" ".join((ln or "").strip().split())) for ln in text.splitlines()]

    for idx, raw in enumerate(lines, start=1):
        if len(raw) < 24:
            continue

        low = raw.lower()
        if "description" in low and ("qty" in low or "quantity" in low):
            continue
        if not raw[0].isdigit():
            continue

        match = STRICT_PRODUCT_LINE_RE.match(raw)
        if match:
            amount = to_decimal(match.group("amount"))
            qty = to_decimal(match.group("qty"), "1.000")
            price = (amount / qty).quantize(Decimal("0.01")) if qty > 0 else Decimal("0.00")
            parsed.append(
                ParsedLine(
                    line_no=idx,
                    raw_text=raw,
                    item_code=match.group("cat"),
                    description=match.group("desc").strip(),
                    quantity=qty,
                    unit="pcs",
                    list_price=price,
                    net_price=price,
                    amount=amount,
                )
            )

    return parsed


async def detect_existing_product(
    db: AsyncSession,
    *,
    item_code: Optional[str],
    description: str,
) -> Optional[Product]:
    products = (await db.execute(select(Product))).scalars().all()
    norm_code = normalize_text(item_code)
    norm_desc = normalize_text(description)

    if norm_code:
        for product in products:
            if normalize_text(product.item_code) == norm_code:
                return product

    best: Optional[Product] = None
    best_score = 0.0
    for product in products:
        score = SequenceMatcher(None, norm_desc, normalize_text(product.description)).ratio()
        if score > best_score:
            best_score = score
            best = product
    if best and best_score >= 0.94:
        return best

    return None


async def ensure_unique_item_code(db: AsyncSession, preferred: str) -> str:
    desired = preferred.strip() or "OCR-ITEM"
    final = desired
    suffix = 1
    while (await db.execute(select(Product.id).where(Product.item_code == final))).scalar_one_or_none() is not None:
        suffix += 1
        final = f"{desired}-{suffix}"
    return final
