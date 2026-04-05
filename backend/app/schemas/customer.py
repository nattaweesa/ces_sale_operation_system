from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class ContactBase(BaseModel):
    full_name: str
    title: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_primary: bool = False


class ContactCreate(ContactBase):
    pass


class ContactUpdate(ContactBase):
    full_name: Optional[str] = None


class ContactOut(ContactBase):
    id: int
    customer_id: int

    model_config = {"from_attributes": True}


class CustomerBase(BaseModel):
    name: str
    tax_id: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    industry: Optional[str] = None
    remark: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(CustomerBase):
    name: Optional[str] = None


class CustomerOut(CustomerBase):
    id: int
    is_active: bool
    created_at: datetime
    contacts: list[ContactOut] = []

    model_config = {"from_attributes": True}
