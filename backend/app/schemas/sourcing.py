from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class BackfillRequest(BaseModel):
    run: bool = Field(default=True, description="Set false to block accidental execution.")


class ConfirmReviewRequest(BaseModel):
    product_id: int
    note: Optional[str] = None
