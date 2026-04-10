from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class UserBase(BaseModel):
    username: str
    full_name: str
    email: Optional[str] = None
    role: str = "sales"


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserSelfUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None


class UserChangePassword(BaseModel):
    current_password: str
    new_password: str


class UserOut(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
