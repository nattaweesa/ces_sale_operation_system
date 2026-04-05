from __future__ import annotations
from typing import Optional
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Integer, String, Text, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Quotation(Base):
    __tablename__ = "quotations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quotation_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id"), nullable=False)
    contact_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("contacts.id"), nullable=True)
    sales_owner_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    subject: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="draft")  # draft | issued | accepted | rejected | cancelled
    current_revision: Mapped[int] = mapped_column(Integer, default=0)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=7)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    delivery_terms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    validity_days: Mapped[int] = mapped_column(Integer, default=30)
    validity_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payment_terms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scope_of_work: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    warranty_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    exclusions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    internal_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    boq_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("boqs.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    project: Mapped["Project"] = relationship("Project", back_populates="quotations")
    contact: Mapped["Optional[Contact]"] = relationship("Contact", lazy="select")
    sales_owner: Mapped["Optional[User]"] = relationship("User", lazy="select")
    sections: Mapped[list["QuotationSection"]] = relationship(
        "QuotationSection", back_populates="quotation",
        cascade="all, delete-orphan", order_by="QuotationSection.sort_order"
    )
    lines: Mapped[list["QuotationLine"]] = relationship(
        "QuotationLine", back_populates="quotation",
        cascade="all, delete-orphan", order_by="QuotationLine.seq"
    )
    revisions: Mapped[list["QuotationRevision"]] = relationship(
        "QuotationRevision", back_populates="quotation",
        cascade="all, delete-orphan", order_by="QuotationRevision.revision_number"
    )


class QuotationSection(Base):
    __tablename__ = "quotation_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quotation_id: Mapped[int] = mapped_column(Integer, ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    quotation: Mapped["Quotation"] = relationship("Quotation", back_populates="sections")
    lines: Mapped[list["QuotationLine"]] = relationship("QuotationLine", back_populates="section")


class QuotationLine(Base):
    __tablename__ = "quotation_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quotation_id: Mapped[int] = mapped_column(Integer, ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False)
    section_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("quotation_sections.id"), nullable=True)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    item_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    list_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    net_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=1)
    unit: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    remark: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_optional: Mapped[bool] = mapped_column(Boolean, default=False)

    quotation: Mapped["Quotation"] = relationship("Quotation", back_populates="lines")
    section: Mapped["Optional[QuotationSection]"] = relationship("QuotationSection", back_populates="lines")
    product: Mapped["Optional[Product]"] = relationship("Product", lazy="select")


class QuotationRevision(Base):
    __tablename__ = "quotation_revisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quotation_id: Mapped[int] = mapped_column(Integer, ForeignKey("quotations.id"), nullable=False)
    revision_number: Mapped[int] = mapped_column(Integer, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    issued_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    snapshot_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    pdf_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    quotation: Mapped["Quotation"] = relationship("Quotation", back_populates="revisions")
    issuer: Mapped["Optional[User]"] = relationship("User", lazy="select")
