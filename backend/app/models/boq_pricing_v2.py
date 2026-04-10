from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BOQRevisionV2(Base):
    __tablename__ = "boq_revisions_v2"
    __table_args__ = (UniqueConstraint("boq_id", "revision_no", name="uq_boq_revisions_v2_boq_rev"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    boq_id: Mapped[int] = mapped_column(Integer, ForeignKey("boqs.id"), nullable=False)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id"), nullable=False)
    revision_no: Mapped[int] = mapped_column(Integer, nullable=False)
    source_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="draft")
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    items: Mapped[list["BOQRevisionItemV2"]] = relationship(
        "BOQRevisionItemV2",
        back_populates="boq_revision",
        cascade="all, delete-orphan",
        order_by="BOQRevisionItemV2.seq",
    )


class BOQRevisionItemV2(Base):
    __tablename__ = "boq_revision_items_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    boq_revision_id: Mapped[int] = mapped_column(Integer, ForeignKey("boq_revisions_v2.id", ondelete="CASCADE"), nullable=False)
    boq_item_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("boq_items.id"), nullable=True)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    section_label: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=1)
    unit: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    source_payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    boq_revision: Mapped["BOQRevisionV2"] = relationship("BOQRevisionV2", back_populates="items")


class PricingSessionV2(Base):
    __tablename__ = "pricing_sessions_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    boq_revision_id: Mapped[int] = mapped_column(Integer, ForeignKey("boq_revisions_v2.id"), nullable=False)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="draft")
    currency: Mapped[str] = mapped_column(String(10), default="THB")
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=7)
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    lines: Mapped[list["PricingLineV2"]] = relationship(
        "PricingLineV2",
        back_populates="pricing_session",
        cascade="all, delete-orphan",
        order_by="PricingLineV2.seq",
    )


class PricingLineV2(Base):
    __tablename__ = "pricing_lines_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pricing_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("pricing_sessions_v2.id", ondelete="CASCADE"), nullable=False)
    boq_revision_item_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("boq_revision_items_v2.id"), nullable=True)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    section_label: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    item_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=1)
    unit: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    list_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    net_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    source_line_ref: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    pricing_session: Mapped["PricingSessionV2"] = relationship("PricingSessionV2", back_populates="lines")


class QuotationV2(Base):
    __tablename__ = "quotations_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quotation_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    pricing_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("pricing_sessions_v2.id"), nullable=False)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="issued")
    revision_no: Mapped[int] = mapped_column(Integer, default=1)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=7)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    snapshots: Mapped[list["QuotationSnapshotV2"]] = relationship(
        "QuotationSnapshotV2",
        back_populates="quotation",
        cascade="all, delete-orphan",
        order_by="QuotationSnapshotV2.revision_no",
    )


class QuotationSnapshotV2(Base):
    __tablename__ = "quotation_snapshots_v2"
    __table_args__ = (UniqueConstraint("quotation_id", "revision_no", name="uq_quotation_snapshots_v2_quote_rev"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quotation_id: Mapped[int] = mapped_column(Integer, ForeignKey("quotations_v2.id", ondelete="CASCADE"), nullable=False)
    revision_no: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    issued_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    quotation: Mapped["QuotationV2"] = relationship("QuotationV2", back_populates="snapshots")
