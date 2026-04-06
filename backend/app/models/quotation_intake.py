from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class QuotationIntakeDocument(Base):
    __tablename__ = "quotation_intake_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_path: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="parsed")  # parsed | confirmed
    total_lines: Mapped[int] = mapped_column(Integer, default=0)
    existing_lines: Mapped[int] = mapped_column(Integer, default=0)
    new_lines: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    lines: Mapped[list["QuotationIntakeLine"]] = relationship(
        "QuotationIntakeLine",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="QuotationIntakeLine.line_no",
    )


class QuotationIntakeLine(Base):
    __tablename__ = "quotation_intake_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(Integer, ForeignKey("quotation_intake_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    line_no: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    item_code: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=Decimal("1.000"))
    unit: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    list_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    net_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    matched_product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | existing | created | skipped
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    document: Mapped["QuotationIntakeDocument"] = relationship("QuotationIntakeDocument", back_populates="lines")
