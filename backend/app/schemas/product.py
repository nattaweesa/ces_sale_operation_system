from __future__ import annotations
from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class ProductAttachmentOut(BaseModel):
    id: int
    product_id: int
    file_name: str
    file_path: str
    file_type: str
    label: Optional[str]
    sort_order: int
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class ProductAttachmentUpdate(BaseModel):
    label: Optional[str] = None
    sort_order: Optional[int] = None


class ProductBase(BaseModel):
    item_code: str
    description: str
    brand_id: Optional[int] = None
    category_id: Optional[int] = None
    list_price: Decimal = Decimal("0")
    currency: str = "THB"
    status: str = "active"
    moq: int = 1
    lead_time_days: Optional[int] = None
    remark: Optional[str] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(ProductBase):
    item_code: Optional[str] = None
    description: Optional[str] = None


class ProductOut(ProductBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    attachments: list[ProductAttachmentOut] = []
    brand_name: Optional[str] = None
    category_name: Optional[str] = None

    model_config = {"from_attributes": True}
