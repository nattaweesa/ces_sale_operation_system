from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ExistingMatchOut(BaseModel):
    id: int
    label: str
    reason: str


class ProductExtractionCandidateOut(BaseModel):
    line_no: int
    item_code: Optional[str] = None
    description: str
    brand: Optional[str] = None
    quantity: float
    unit: Optional[str] = None
    list_price: float
    amount: float
    status: str
    matches: list[ExistingMatchOut] = []


class CustomerExtractionCandidateOut(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: str
    matches: list[ExistingMatchOut] = []


class ProjectExtractionCandidateOut(BaseModel):
    name: Optional[str] = None
    status: str
    matches: list[ExistingMatchOut] = []


class ContactExtractionCandidateOut(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: str
    matches: list[ExistingMatchOut] = []


class QuotationMasterDataPreviewOut(BaseModel):
    filename: str
    text_preview: str
    warnings: list[str] = []
    customer: Optional[CustomerExtractionCandidateOut] = None
    project: Optional[ProjectExtractionCandidateOut] = None
    contacts: list[ContactExtractionCandidateOut] = []
    products: list[ProductExtractionCandidateOut] = []
