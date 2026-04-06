from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SourceDocument(Base):
    __tablename__ = "source_documents"
    __table_args__ = (
        UniqueConstraint("document_type", "source_document_id", name="uq_source_doc_type_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_type: Mapped[str] = mapped_column(String(30), nullable=False)  # quotation | boq
    source_document_id: Mapped[int] = mapped_column(Integer, nullable=False)
    document_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    project_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("projects.id"), nullable=True)
    project_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    customer_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    source_created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    line_items: Mapped[list["SourceLineItem"]] = relationship(
        "SourceLineItem",
        back_populates="source_document",
        cascade="all, delete-orphan",
        order_by="SourceLineItem.seq",
    )


class SourceLineItem(Base):
    __tablename__ = "source_line_items"
    __table_args__ = (
        UniqueConstraint("source_document_id", "source_line_key", name="uq_source_line_document_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_document_id: Mapped[int] = mapped_column(Integer, ForeignKey("source_documents.id", ondelete="CASCADE"), nullable=False)
    source_line_key: Mapped[str] = mapped_column(String(60), nullable=False)  # ql:<id> | bi:<id>
    seq: Mapped[int] = mapped_column(Integer, default=0)
    section_label: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    item_code: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    brand: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=0)
    list_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    net_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    match_status: Mapped[str] = mapped_column(String(30), default="needs_review")  # auto_matched | needs_review | confirmed
    match_method: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    match_confidence: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    source_document: Mapped["SourceDocument"] = relationship("SourceDocument", back_populates="line_items")
    review: Mapped[Optional["LineMatchReviewQueue"]] = relationship(
        "LineMatchReviewQueue",
        back_populates="line_item",
        cascade="all, delete-orphan",
        uselist=False,
    )


class ProductAlias(Base):
    __tablename__ = "product_aliases"
    __table_args__ = (
        UniqueConstraint("alias_text", name="uq_product_alias_text"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    alias_text: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    alias_type: Mapped[str] = mapped_column(String(30), default="description")  # item_code | description | brand
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ProductPriceHistory(Base):
    __tablename__ = "product_price_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    source_document_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("source_documents.id"), nullable=True)
    source_line_item_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("source_line_items.id"), nullable=True)
    price_type: Mapped[str] = mapped_column(String(20), default="net")  # list | net
    price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="THB")
    quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 3), nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class LineMatchReviewQueue(Base):
    __tablename__ = "line_match_review_queue"
    __table_args__ = (
        UniqueConstraint("line_item_id", name="uq_review_queue_line_item"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    line_item_id: Mapped[int] = mapped_column(Integer, ForeignKey("source_line_items.id", ondelete="CASCADE"), nullable=False)
    suggested_product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    confidence: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | resolved | ignored
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    line_item: Mapped["SourceLineItem"] = relationship("SourceLineItem", back_populates="review")
