from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DealCustomerTypeBase(BaseModel):
    name: str
    sort_order: int = 0
    is_active: bool = True


class DealCustomerTypeCreate(DealCustomerTypeBase):
    pass


class DealCustomerTypeUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class DealCustomerTypeOut(DealCustomerTypeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DealCompanyBase(BaseModel):
    customer_type_id: int
    name: str
    sort_order: int = 0
    is_active: bool = True


class DealCompanyCreate(DealCompanyBase):
    customer_id: Optional[int] = None


class DealCompanyUpdate(BaseModel):
    customer_type_id: Optional[int] = None
    customer_id: Optional[int] = None
    name: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class DealCompanyOut(DealCompanyBase):
    id: int
    customer_id: int
    customer_name: Optional[str] = None
    customer_type_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DealProductSystemTypeBase(BaseModel):
    name: str
    sort_order: int = 0
    is_active: bool = True


class DealProductSystemTypeCreate(DealProductSystemTypeBase):
    pass


class DealProductSystemTypeUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class DealProductSystemTypeOut(DealProductSystemTypeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DealProjectStatusOptionBase(BaseModel):
    label: str
    key: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class DealProjectStatusOptionCreate(DealProjectStatusOptionBase):
    pass


class DealProjectStatusOptionUpdate(BaseModel):
    label: Optional[str] = None
    key: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class DealProjectStatusOptionOut(BaseModel):
    id: int
    key: str
    label: str
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DealCESStageOptionBase(BaseModel):
    label: str
    key: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class DealCESStageOptionCreate(DealCESStageOptionBase):
    pass


class DealCESStageOptionUpdate(BaseModel):
    label: Optional[str] = None
    key: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class DealCESStageOptionOut(BaseModel):
    id: int
    key: str
    label: str
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DealMasterDataBundleOut(BaseModel):
    customer_types: list[DealCustomerTypeOut]
    companies: list[DealCompanyOut]
    product_system_types: list[DealProductSystemTypeOut]
    project_statuses: list[DealProjectStatusOptionOut]
    ces_stages: list[DealCESStageOptionOut]
