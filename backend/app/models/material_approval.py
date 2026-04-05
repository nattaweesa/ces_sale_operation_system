from __future__ import annotations
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class MaterialApprovalPackage(Base):
    __tablename__ = "material_approval_packages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quotation_id: Mapped[int] = mapped_column(Integer, ForeignKey("quotations.id"), nullable=False)
    revision_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("quotation_revisions.id"), nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    pdf_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    quotation: Mapped["Quotation"] = relationship("Quotation", lazy="select")
    items: Mapped[list["MaterialApprovalItem"]] = relationship(
        "MaterialApprovalItem", back_populates="package",
        cascade="all, delete-orphan", order_by="MaterialApprovalItem.seq"
    )


class MaterialApprovalItem(Base):
    __tablename__ = "material_approval_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    package_id: Mapped[int] = mapped_column(Integer, ForeignKey("material_approval_packages.id", ondelete="CASCADE"), nullable=False)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("products.id"), nullable=True)
    attachment_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("product_attachments.id"), nullable=True)
    custom_label: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    package: Mapped["MaterialApprovalPackage"] = relationship("MaterialApprovalPackage", back_populates="items")
    product: Mapped["Optional[Product]"] = relationship("Product", lazy="select")
    attachment: Mapped["Optional[ProductAttachment]"] = relationship("ProductAttachment", lazy="select")
