from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class BOQRevisionItemV2Out(BaseModel):
    id: int
    boq_revision_id: int
    boq_item_id: Optional[int]
    seq: int
    section_label: Optional[str]
    description: str
    quantity: Decimal
    unit: Optional[str]
    product_id: Optional[int]
    source_payload: Optional[dict]

    model_config = {"from_attributes": True}


class BOQRevisionV2Out(BaseModel):
    id: int
    boq_id: int
    project_id: int
    revision_no: int
    source_hash: str
    status: str
    created_by: Optional[int]
    created_at: datetime
    items: list[BOQRevisionItemV2Out] = []

    model_config = {"from_attributes": True}


class PricingSessionV2Create(BaseModel):
    boq_revision_id: int
    currency: str = "THB"
    vat_rate: Decimal = Decimal("7")


class PricingLineV2Update(BaseModel):
    description: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    list_price: Optional[Decimal] = None
    discount_pct: Optional[Decimal] = None


class PricingLineV2Out(BaseModel):
    id: int
    pricing_session_id: int
    boq_revision_item_id: Optional[int]
    seq: int
    section_label: Optional[str]
    description: str
    product_id: Optional[int]
    item_code: Optional[str]
    brand: Optional[str]
    quantity: Decimal
    unit: Optional[str]
    list_price: Decimal
    discount_pct: Decimal
    net_price: Decimal
    amount: Decimal
    source_line_ref: Optional[dict]

    model_config = {"from_attributes": True}


class PricingTotalsV2(BaseModel):
    subtotal: Decimal
    vat_rate: Decimal
    vat_amount: Decimal
    grand_total: Decimal


class PricingSessionV2Out(BaseModel):
    id: int
    boq_revision_id: int
    project_id: int
    status: str
    currency: str
    vat_rate: Decimal
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    lines: list[PricingLineV2Out] = []
    totals: PricingTotalsV2


class QuotationSnapshotV2Out(BaseModel):
    id: int
    quotation_id: int
    revision_no: int
    snapshot_json: dict
    issued_by: Optional[int]
    issued_at: datetime

    model_config = {"from_attributes": True}


class QuotationV2Out(BaseModel):
    id: int
    quotation_number: str
    pricing_session_id: int
    project_id: int
    status: str
    revision_no: int
    subtotal: Decimal
    vat_rate: Decimal
    vat_amount: Decimal
    grand_total: Decimal
    created_by: Optional[int]
    created_at: datetime
    snapshots: list[QuotationSnapshotV2Out] = []

    model_config = {"from_attributes": True}
