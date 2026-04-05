from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class MaterialApprovalItemIn(BaseModel):
    product_id: int
    attachment_id: int
    custom_label: Optional[str] = None


class MaterialApprovalCreate(BaseModel):
    quotation_id: int
    name: Optional[str] = None
    items: list[MaterialApprovalItemIn]


class MaterialApprovalItemOut(BaseModel):
    id: int
    seq: int
    product_id: Optional[int]
    attachment_id: Optional[int]
    custom_label: Optional[str]
    product_code: Optional[str] = None
    product_description: Optional[str] = None
    attachment_label: Optional[str] = None

    model_config = {"from_attributes": True}


class MaterialApprovalPackageOut(BaseModel):
    id: int
    quotation_id: int
    revision_id: Optional[int]
    name: Optional[str]
    pdf_path: Optional[str]
    created_at: datetime
    items: list[MaterialApprovalItemOut] = []

    model_config = {"from_attributes": True}
