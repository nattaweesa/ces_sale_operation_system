from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    is_active: Optional[bool] = None


class DepartmentOut(BaseModel):
    id: int
    name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
