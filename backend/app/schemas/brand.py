from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel


class BrandBase(BaseModel):
    name: str


class BrandCreate(BrandBase):
    pass


class BrandUpdate(BrandBase):
    pass


class BrandOut(BrandBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}
