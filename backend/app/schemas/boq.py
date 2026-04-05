from __future__ import annotations
from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class BOQItemBase(BaseModel):
    seq: int
    description: str
    quantity: Decimal = Decimal("1")
    unit: Optional[str] = None
    section_label: Optional[str] = None
    product_id: Optional[int] = None
    notes: Optional[str] = None


class BOQItemCreate(BOQItemBase):
    pass


class BOQItemUpdate(BOQItemBase):
    seq: Optional[int] = None
    description: Optional[str] = None


class BOQItemOut(BOQItemBase):
    id: int
    boq_id: int
    mapped_at: Optional[datetime]
    product_code: Optional[str] = None
    product_description: Optional[str] = None

    model_config = {"from_attributes": True}


class BOQBase(BaseModel):
    project_id: int
    name: Optional[str] = None


class BOQCreate(BOQBase):
    pass


class BOQOut(BOQBase):
    id: int
    source: str
    created_at: datetime
    items: list[BOQItemOut] = []

    model_config = {"from_attributes": True}
