from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import Integer, DateTime, ForeignKey, Numeric, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DealForecastMonthly(Base):
    __tablename__ = "deal_forecast_monthly"
    __table_args__ = (
        UniqueConstraint(
            "deal_id",
            "forecast_year",
            "forecast_month",
            "product_system_type_id",
            name="uq_deal_forecast_monthly_deal_year_month_product",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    deal_id: Mapped[int] = mapped_column(Integer, ForeignKey("deals.id", ondelete="CASCADE"), nullable=False)
    product_system_type_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("deal_product_system_types.id", ondelete="SET NULL"),
        nullable=True,
    )
    forecast_year: Mapped[int] = mapped_column(Integer, nullable=False)
    forecast_month: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    win_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    net_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    deal = relationship("Deal", back_populates="forecasts")
