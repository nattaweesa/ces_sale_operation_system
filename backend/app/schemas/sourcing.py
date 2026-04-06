from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class BackfillRequest(BaseModel):
    run: bool = Field(default=True, description="Set false to block accidental execution.")


class ConfirmReviewRequest(BaseModel):
    product_id: int
    note: Optional[str] = None


class CreateProductFromReviewRequest(BaseModel):
    item_code: Optional[str] = None
    description: Optional[str] = None
    brand_id: Optional[int] = None
    category_id: Optional[int] = None
    list_price: Optional[float] = None
    currency: str = "THB"
    status: str = "active"
    moq: int = 1
    lead_time_days: Optional[int] = None
    remark: Optional[str] = None
    note: Optional[str] = None
