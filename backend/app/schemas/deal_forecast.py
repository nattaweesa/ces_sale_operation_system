from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class DealForecastMonthlyItemIn(BaseModel):
    forecast_year: int = Field(ge=2000, le=2100)
    forecast_month: int = Field(ge=1, le=12)
    amount: Decimal = Field(default=Decimal("0"), ge=Decimal("0"))
    win_pct: Decimal = Field(default=Decimal("0"), ge=Decimal("0"), le=Decimal("100"))
    note: str | None = None


class DealForecastMonthlyBulkIn(BaseModel):
    items: list[DealForecastMonthlyItemIn] = []


class DealForecastMonthlyOut(BaseModel):
    id: int
    deal_id: int
    forecast_year: int
    forecast_month: int
    amount: Decimal
    win_pct: Decimal
    net_amount: Decimal
    note: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
