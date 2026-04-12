from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.deal import Deal


class DealCustomerType(Base):
    __tablename__ = "deal_customer_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    companies: Mapped[list["DealCompany"]] = relationship(
        "DealCompany",
        back_populates="customer_type",
        cascade="all, delete-orphan",
        order_by="DealCompany.sort_order.asc(), DealCompany.name.asc()",
    )


class DealCompany(Base):
    __tablename__ = "deal_companies"
    __table_args__ = (
        UniqueConstraint("customer_type_id", "name", name="uq_deal_companies_type_name"),
        UniqueConstraint("customer_id", name="uq_deal_companies_customer_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_type_id: Mapped[int] = mapped_column(Integer, ForeignKey("deal_customer_types.id"), nullable=False)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey("customers.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    customer_type: Mapped["DealCustomerType"] = relationship("DealCustomerType", back_populates="companies")
    customer: Mapped["Customer"] = relationship("Customer", lazy="select")


class DealProductSystemType(Base):
    __tablename__ = "deal_product_system_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False, unique=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    deals: Mapped[list["Deal"]] = relationship(
        "Deal",
        secondary="deal_product_system_links",
        back_populates="product_system_types",
        lazy="select",
    )


class DealProjectStatusOption(Base):
    __tablename__ = "deal_project_status_options"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class DealProductSystemLink(Base):
    __tablename__ = "deal_product_system_links"

    deal_id: Mapped[int] = mapped_column(Integer, ForeignKey("deals.id", ondelete="CASCADE"), primary_key=True)
    product_system_type_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("deal_product_system_types.id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
