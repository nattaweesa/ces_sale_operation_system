from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class ProjectBase(BaseModel):
    customer_id: int
    name: str
    location: Optional[str] = None
    description: Optional[str] = None
    status: str = "active"


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(ProjectBase):
    customer_id: Optional[int] = None
    name: Optional[str] = None


class ProjectOut(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime
    customer_name: Optional[str] = None

    model_config = {"from_attributes": True}
