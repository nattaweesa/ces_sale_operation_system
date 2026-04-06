from __future__ import annotations

import re
from decimal import Decimal
from typing import Optional


SERVICE_KEYWORDS = ("testing", "commissioning", "programming", "interface")
PANEL_KEYWORDS = ("control panel", "cp-knx", "cp-rpc", "panel")
BUNDLE_KEYWORDS = ("computer&ups", "computer", "ups", "interface bas")


def normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""
    cleaned = "".join(ch.lower() if ch.isalnum() else " " for ch in value)
    return " ".join(cleaned.split())


def normalize_item_code(item_code: Optional[str]) -> Optional[str]:
    if not item_code:
        return None
    code = item_code.strip().upper().replace(" ", "")
    return code or None


def normalize_brand(brand: Optional[str]) -> Optional[str]:
    if not brand:
        return None
    b = " ".join(brand.strip().split())
    return b.title() if b else None


def parse_money(raw: Optional[str]) -> Optional[Decimal]:
    if raw is None:
        return None
    cleaned = re.sub(r"[^0-9.,-]", "", raw)
    if not cleaned:
        return None
    cleaned = cleaned.replace(",", "")
    try:
        return Decimal(cleaned)
    except Exception:
        return None


def classify_line(item_code: Optional[str], description: Optional[str], brand: Optional[str], list_price: Optional[Decimal]) -> str:
    desc = normalize_text(description)
    code = normalize_item_code(item_code)
    brand_norm = normalize_brand(brand)

    if any(k in desc for k in SERVICE_KEYWORDS):
        return "service"
    if any(k in desc for k in PANEL_KEYWORDS) or (code and code.startswith("CP-")):
        return "panel_local"
    if any(k in desc for k in BUNDLE_KEYWORDS):
        return "bundle"

    # Deterministic catalog signal for v1.
    if code and description and list_price and list_price > 0:
        return "catalog_product"
    if code and description and brand_norm and list_price and list_price > 0:
        return "catalog_product"

    return "unknown"
