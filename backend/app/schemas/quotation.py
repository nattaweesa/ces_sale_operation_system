from __future__ import annotations
from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class QuotationSectionBase(BaseModel):
    label: Optional[str] = None
    sort_order: int = 0


class QuotationSectionCreate(QuotationSectionBase):
    pass


class QuotationSectionUpdate(QuotationSectionBase):
    pass


class QuotationSectionOut(QuotationSectionBase):
    id: int
    quotation_id: int

    model_config = {"from_attributes": True}


class QuotationLineBase(BaseModel):
    section_id: Optional[int] = None
    seq: int
    product_id: Optional[int] = None
    item_code: Optional[str] = None
    description: str
    brand: Optional[str] = None
    list_price: Decimal = Decimal("0")
    discount_pct: Decimal = Decimal("0")
    net_price: Decimal = Decimal("0")
    quantity: Decimal = Decimal("1")
    unit: Optional[str] = None
    amount: Decimal = Decimal("0")
    remark: Optional[str] = None
    is_optional: bool = False


class QuotationLineCreate(QuotationLineBase):
    pass


class QuotationLineUpdate(QuotationLineBase):
    seq: Optional[int] = None
    description: Optional[str] = None


class QuotationLineOut(QuotationLineBase):
    id: int
    quotation_id: int

    model_config = {"from_attributes": True}


class QuotationBase(BaseModel):
    project_id: int
    contact_id: Optional[int] = None
    sales_owner_id: Optional[int] = None
    subject: Optional[str] = None
    delivery_terms: Optional[str] = None
    validity_days: int = 30
    validity_text: Optional[str] = None
    payment_terms: Optional[str] = None
    scope_of_work: Optional[str] = None
    warranty_text: Optional[str] = None
    exclusions: Optional[str] = None
    internal_notes: Optional[str] = None
    vat_rate: Decimal = Decimal("7")


class QuotationCreate(QuotationBase):
    boq_id: Optional[int] = None


class QuotationUpdate(QuotationBase):
    project_id: Optional[int] = None


class QuotationRevisionOut(BaseModel):
    id: int
    quotation_id: int
    revision_number: int
    issued_at: datetime
    issued_by: Optional[int]
    pdf_path: Optional[str]

    model_config = {"from_attributes": True}


class QuotationOut(QuotationBase):
    id: int
    quotation_number: str
    status: str
    current_revision: int
    subtotal: Decimal
    vat_amount: Decimal
    grand_total: Decimal
    boq_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    sections: list[QuotationSectionOut] = []
    lines: list[QuotationLineOut] = []
    revisions: list[QuotationRevisionOut] = []
    project_name: Optional[str] = None
    customer_name: Optional[str] = None
    contact_name: Optional[str] = None
    sales_owner_name: Optional[str] = None

    model_config = {"from_attributes": True}


class QuotationListOut(BaseModel):
    id: int
    quotation_number: str
    project_id: int
    project_name: Optional[str]
    customer_name: Optional[str]
    subject: Optional[str]
    status: str
    current_revision: int
    grand_total: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
