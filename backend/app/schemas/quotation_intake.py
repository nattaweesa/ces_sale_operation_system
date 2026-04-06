from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class QuotationIntakeLineOut(BaseModel):
    id: int
    line_no: int
    raw_text: str
    item_code: Optional[str] = None
    description: str
    quantity: float
    unit: Optional[str] = None
    list_price: float
    net_price: float
    amount: float
    matched_product_id: Optional[int] = None
    matched_product_code: Optional[str] = None
    matched_product_description: Optional[str] = None
    status: str


class QuotationIntakeDocumentOut(BaseModel):
    id: int
    user_id: int
    original_filename: str
    status: str
    total_lines: int
    existing_lines: int
    new_lines: int
    created_at: str


class QuotationIntakeUploadOut(BaseModel):
    document: QuotationIntakeDocumentOut
    lines: list[QuotationIntakeLineOut]


class QuotationIntakeConfirmRequest(BaseModel):
    line_ids: list[int] = Field(default_factory=list)


class QuotationIntakeConfirmOut(BaseModel):
    document_id: int
    created_products: int
    existing_lines: int
    skipped_lines: int
