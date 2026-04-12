from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class UserBase(BaseModel):
    username: str
    full_name: str
    email: Optional[str] = None
    role: str = "sales"


class UserCreate(UserBase):
    password: str
    department_ids: list[int] = Field(default_factory=list)
    active_department_id: Optional[int] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    department_ids: Optional[list[int]] = None
    active_department_id: Optional[int] = None


class UserSelfUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None


class UserChangePassword(BaseModel):
    current_password: str
    new_password: str


class UserDepartmentSwitch(BaseModel):
    department_id: int


class UserDepartmentOut(BaseModel):
    id: int
    name: str


class UserOut(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    active_department_id: Optional[int] = None
    departments: list[UserDepartmentOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}
