from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class IngestionBatchOut(BaseModel):
    id: int
    uploaded_by: int
    status: str
    total_files: int
    processed_files: int
    failed_files: int
    created_at: str


class IngestionDocumentOut(BaseModel):
    id: int
    batch_id: int
    original_filename: str
    status: str
    parse_notes: Optional[str] = None


class BatchWithDocumentsOut(BaseModel):
    batch: IngestionBatchOut
    documents: list[IngestionDocumentOut]


class UploadBatchOut(BaseModel):
    batch_id: int
    status: str
    total_files: int


class DocumentHeaderOut(BaseModel):
    quotation_number: Optional[str] = None
    project_name: Optional[str] = None
    quote_date_text: Optional[str] = None
    subject: Optional[str] = None


class RawLineOut(BaseModel):
    id: int
    line_no: int
    raw_text: str
    item_code_raw: Optional[str] = None
    description_raw: Optional[str] = None
    brand_raw: Optional[str] = None
    list_price_raw: Optional[str] = None
    qty_raw: Optional[str] = None
    discount_text_raw: Optional[str] = None
    total_amount_raw: Optional[str] = None
    parse_notes: Optional[str] = None


class NormalizedLineOut(BaseModel):
    id: int
    raw_line_id: int
    classification: str
    item_code_norm: Optional[str] = None
    description_norm: Optional[str] = None
    brand_norm: Optional[str] = None
    list_price_norm: Optional[float] = None
    qty_norm: Optional[float] = None
    amount_norm: Optional[float] = None
    uncertain: bool
    normalize_notes: Optional[str] = None


class BatchDetailOut(BaseModel):
    batch: IngestionBatchOut
    documents: list[IngestionDocumentOut]
    headers: list[DocumentHeaderOut]
    raw_lines: list[RawLineOut]
    normalized_lines: list[NormalizedLineOut]


class CandidateSuggestionOut(BaseModel):
    id: int
    product_id: int
    method: str
    confidence: float
    notes: Optional[str] = None


class PriceObservationOut(BaseModel):
    id: int
    observed_list_price: float
    currency: str
    observed_at: str


class CandidateOut(BaseModel):
    id: int
    normalized_line_id: int
    candidate_code: Optional[str] = None
    canonical_description: Optional[str] = None
    canonical_brand: Optional[str] = None
    selected_list_price: Optional[float] = None
    status: str
    chosen_product_id: Optional[int] = None
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[str] = None
    review_note: Optional[str] = None
    source_item_code: Optional[str] = None
    source_description: Optional[str] = None
    source_brand: Optional[str] = None
    source_classification: Optional[str] = None
    suggestions: list[CandidateSuggestionOut] = Field(default_factory=list)
    price_observations: list[PriceObservationOut] = Field(default_factory=list)


class CandidateListOut(BaseModel):
    items: list[CandidateOut]


class ReviewCandidateRequest(BaseModel):
    action: str  # approve_new | merge_existing | reject
    target_product_id: Optional[int] = None
    canonical_description: Optional[str] = None
    selected_list_price: Optional[float] = None
    note: Optional[str] = None


class ReviewCandidateOut(BaseModel):
    candidate_id: int
    action: str
    status: str
    product_id: Optional[int] = None


class CanonicalDescriptionSuggestionRequest(BaseModel):
    draft_description: str


class CanonicalDescriptionSuggestionOut(BaseModel):
    suggestion: str
    provider: str


class PublishedEvidenceOut(BaseModel):
    action_id: int
    candidate_id: int
    product_id: int
    selected_list_price: Optional[float] = None
    reviewer_id: int
    created_at: str
    notes: Optional[str] = None
    evidence_json: Optional[str] = None


class PublishedEvidenceListOut(BaseModel):
    items: list[PublishedEvidenceOut]
