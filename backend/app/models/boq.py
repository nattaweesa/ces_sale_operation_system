from __future__ import annotations
from typing import Optional
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Integer, String, Text, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class BOQ(Base):
    __tablename__ = "boqs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id"), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="manual")  # manual | excel_import
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    project: Mapped["Project"] = relationship("Project", back_populates="boqs")
    items: Mapped[list["BOQItem"]] = relationship(
        "BOQItem", back_populates="boq", cascade="all, delete-orphan", order_by="BOQItem.seq"
    )


class BOQItem(Base):
    __tablename__ = "boq_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    boq_id: Mapped[int] = mapped_column(Integer, ForeignKey("boqs.id", ondelete="CASCADE"), nullable=False)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=1)
    unit: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    section_label: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mapped_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    boq: Mapped["BOQ"] = relationship("BOQ", back_populates="items")
    product: Mapped["Optional[Product]"] = relationship("Product", lazy="select")
