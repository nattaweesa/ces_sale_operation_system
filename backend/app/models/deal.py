from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy import Integer, String, Text, DateTime, Date, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.boq import BOQ
    from app.models.customer import Customer
    from app.models.department import Department
    from app.models.deal_master import DealCompany, DealCustomerType, DealProductSystemType
    from app.models.deal_forecast import DealForecastMonthly
    from app.models.project import Project
    from app.models.user import User


class Deal(Base):
    __tablename__ = "deals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    deal_customer_type_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("deal_customer_types.id"), nullable=True)
    deal_company_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("deal_companies.id"), nullable=True)
    customer_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("customers.id"), nullable=True)
    project_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("projects.id"), nullable=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    department_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("departments.id"), nullable=True)

    deal_cycle_stage: Mapped[str] = mapped_column(String(30), default="lead")
    status: Mapped[str] = mapped_column(String(20), default="design")  # design | bidding | award | on_hold | legacy values may still exist

    expected_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    probability_pct: Mapped[int] = mapped_column(Integer, default=10)
    expected_close_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    next_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_action_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    competitor: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    deal_customer_type: Mapped["Optional[DealCustomerType]"] = relationship("DealCustomerType", lazy="select")
    deal_company: Mapped["Optional[DealCompany]"] = relationship("DealCompany", lazy="select")
    customer: Mapped["Optional[Customer]"] = relationship("Customer", lazy="select")
    project: Mapped["Optional[Project]"] = relationship("Project", lazy="select")
    owner: Mapped["User"] = relationship("User", lazy="select")
    department: Mapped["Optional[Department]"] = relationship("Department", lazy="select")
    product_system_types: Mapped[list["DealProductSystemType"]] = relationship(
        "DealProductSystemType",
        secondary="deal_product_system_links",
        back_populates="deals",
        lazy="select",
    )
    boqs: Mapped[list["BOQ"]] = relationship("BOQ", lazy="select")
    tasks: Mapped[list["DealTask"]] = relationship(
        "DealTask", back_populates="deal", cascade="all, delete-orphan", order_by="DealTask.created_at.desc()"
    )
    activities: Mapped[list["DealActivity"]] = relationship(
        "DealActivity", back_populates="deal", cascade="all, delete-orphan", order_by="DealActivity.created_at.desc()"
    )
    forecasts: Mapped[list["DealForecastMonthly"]] = relationship(
        "DealForecastMonthly", back_populates="deal", cascade="all, delete-orphan", order_by="DealForecastMonthly.id"
    )


class DealTask(Base):
    __tablename__ = "deal_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    deal_id: Mapped[int] = mapped_column(Integer, ForeignKey("deals.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="todo")  # todo | in_progress | done | cancelled
    priority: Mapped[str] = mapped_column(String(20), default="medium")  # low | medium | high
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    deal: Mapped["Deal"] = relationship("Deal", back_populates="tasks")
    creator: Mapped["Optional[User]"] = relationship("User", lazy="select")


class DealActivity(Base):
    __tablename__ = "deal_activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    deal_id: Mapped[int] = mapped_column(Integer, ForeignKey("deals.id", ondelete="CASCADE"), nullable=False)
    action_type: Mapped[str] = mapped_column(String(30), default="note")
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    from_stage: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    to_stage: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    from_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    to_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    next_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_action_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    deal: Mapped["Deal"] = relationship("Deal", back_populates="activities")
    creator: Mapped["Optional[User]"] = relationship("User", lazy="select")
