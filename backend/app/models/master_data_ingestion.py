from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MasterIngestionBatch(Base):
    __tablename__ = "md_ingestion_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    uploaded_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="uploaded")  # uploaded | processing | parsed | partial_failed | failed
    total_files: Mapped[int] = mapped_column(Integer, default=0)
    processed_files: Mapped[int] = mapped_column(Integer, default=0)
    failed_files: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    documents: Mapped[list["MasterIngestionDocument"]] = relationship(
        "MasterIngestionDocument",
        back_populates="batch",
        cascade="all, delete-orphan",
        order_by="MasterIngestionDocument.id",
    )


class MasterIngestionDocument(Base):
    __tablename__ = "md_ingestion_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    batch_id: Mapped[int] = mapped_column(Integer, ForeignKey("md_ingestion_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="uploaded")  # uploaded | parsing | parsed | failed
    parse_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    batch: Mapped["MasterIngestionBatch"] = relationship("MasterIngestionBatch", back_populates="documents")
    header: Mapped[Optional["MasterIngestionDocumentHeader"]] = relationship(
        "MasterIngestionDocumentHeader",
        back_populates="document",
        cascade="all, delete-orphan",
        uselist=False,
    )
    sections: Mapped[list["MasterIngestionDocumentSection"]] = relationship(
        "MasterIngestionDocumentSection",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="MasterIngestionDocumentSection.sort_order",
    )
    raw_lines: Mapped[list["MasterIngestionRawLine"]] = relationship(
        "MasterIngestionRawLine",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="MasterIngestionRawLine.line_no",
    )


class MasterIngestionDocumentHeader(Base):
    __tablename__ = "md_document_headers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(Integer, ForeignKey("md_ingestion_documents.id", ondelete="CASCADE"), nullable=False, unique=True)
    quotation_number: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    project_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    quote_date_text: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    subject: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    document: Mapped["MasterIngestionDocument"] = relationship("MasterIngestionDocument", back_populates="header")


class MasterIngestionDocumentSection(Base):
    __tablename__ = "md_document_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(Integer, ForeignKey("md_ingestion_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    section_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    document: Mapped["MasterIngestionDocument"] = relationship("MasterIngestionDocument", back_populates="sections")


class MasterIngestionRawLine(Base):
    __tablename__ = "md_raw_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(Integer, ForeignKey("md_ingestion_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("md_document_sections.id"), nullable=True)
    line_no: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)

    item_code_raw: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    description_raw: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    brand_raw: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    list_price_raw: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    qty_raw: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    discount_text_raw: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    total_amount_raw: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    parse_confidence: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    parse_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    document: Mapped["MasterIngestionDocument"] = relationship("MasterIngestionDocument", back_populates="raw_lines")
    normalized_line: Mapped[Optional["MasterIngestionNormalizedLine"]] = relationship(
        "MasterIngestionNormalizedLine",
        back_populates="raw_line",
        cascade="all, delete-orphan",
        uselist=False,
    )


class MasterIngestionNormalizedLine(Base):
    __tablename__ = "md_normalized_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    raw_line_id: Mapped[int] = mapped_column(Integer, ForeignKey("md_raw_lines.id", ondelete="CASCADE"), nullable=False, unique=True)

    classification: Mapped[str] = mapped_column(String(30), default="unknown")  # catalog_product | service | panel_local | bundle | unknown
    item_code_norm: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    description_norm: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    brand_norm: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    unit_norm: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    list_price_norm: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    qty_norm: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 3), nullable=True)
    amount_norm: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)

    uncertain: Mapped[bool] = mapped_column(Boolean, default=False)
    normalize_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    raw_line: Mapped["MasterIngestionRawLine"] = relationship("MasterIngestionRawLine", back_populates="normalized_line")
    candidate: Mapped[Optional["MasterProductCandidate"]] = relationship(
        "MasterProductCandidate",
        back_populates="normalized_line",
        cascade="all, delete-orphan",
        uselist=False,
    )


class MasterProductCandidate(Base):
    __tablename__ = "md_product_candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    normalized_line_id: Mapped[int] = mapped_column(Integer, ForeignKey("md_normalized_lines.id", ondelete="CASCADE"), nullable=False, unique=True)

    candidate_code: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    canonical_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    canonical_brand: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    selected_list_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending_review")  # pending_review | approved_new | approved_merge | rejected | published

    chosen_product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    reviewed_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    normalized_line: Mapped["MasterIngestionNormalizedLine"] = relationship("MasterIngestionNormalizedLine", back_populates="candidate")
    suggestions: Mapped[list["MasterCandidateMatchSuggestion"]] = relationship(
        "MasterCandidateMatchSuggestion",
        back_populates="candidate",
        cascade="all, delete-orphan",
        order_by="MasterCandidateMatchSuggestion.confidence.desc()",
    )
    price_observations: Mapped[list["MasterPriceObservation"]] = relationship(
        "MasterPriceObservation",
        back_populates="candidate",
        cascade="all, delete-orphan",
        order_by="MasterPriceObservation.observed_at.desc()",
    )
    actions: Mapped[list["MasterReviewActionLog"]] = relationship(
        "MasterReviewActionLog",
        back_populates="candidate",
        cascade="all, delete-orphan",
        order_by="MasterReviewActionLog.created_at.desc()",
    )


class MasterCandidateMatchSuggestion(Base):
    __tablename__ = "md_candidate_match_suggestions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    candidate_id: Mapped[int] = mapped_column(Integer, ForeignKey("md_product_candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"), nullable=False)
    method: Mapped[str] = mapped_column(String(40), nullable=False)  # exact_brand_code | exact_code | alias_match
    confidence: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.00"))
    notes: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    candidate: Mapped["MasterProductCandidate"] = relationship("MasterProductCandidate", back_populates="suggestions")


class MasterPriceObservation(Base):
    __tablename__ = "md_price_observations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    candidate_id: Mapped[int] = mapped_column(Integer, ForeignKey("md_product_candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    observed_list_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="THB")
    source_document_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("md_ingestion_documents.id"), nullable=True)
    source_raw_line_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("md_raw_lines.id"), nullable=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    candidate: Mapped["MasterProductCandidate"] = relationship("MasterProductCandidate", back_populates="price_observations")


class MasterReviewActionLog(Base):
    __tablename__ = "md_review_action_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    candidate_id: Mapped[int] = mapped_column(Integer, ForeignKey("md_product_candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(30), nullable=False)  # approve_new | merge_existing | reject | publish
    reviewer_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    selected_list_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    candidate: Mapped["MasterProductCandidate"] = relationship("MasterProductCandidate", back_populates="actions")
