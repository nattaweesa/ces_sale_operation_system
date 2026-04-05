from __future__ import annotations
from typing import Optional
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Integer, String, Text, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    brand_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("brands.id"), nullable=True)
    category_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("categories.id"), nullable=True)
    list_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    currency: Mapped[str] = mapped_column(String(10), default="THB")
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | obsolete | on_request
    moq: Mapped[int] = mapped_column(Integer, default=1)
    lead_time_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    remark: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    brand: Mapped["Optional[Brand]"] = relationship("Brand", lazy="select")
    category: Mapped["Optional[Category]"] = relationship("Category", lazy="select")
    attachments: Mapped[list["ProductAttachment"]] = relationship(
        "ProductAttachment", back_populates="product", cascade="all, delete-orphan",
        order_by="ProductAttachment.sort_order"
    )


class ProductAttachment(Base):
    __tablename__ = "product_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), default="pdf")  # pdf | image | other
    label: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    product: Mapped["Product"] = relationship("Product", back_populates="attachments")
