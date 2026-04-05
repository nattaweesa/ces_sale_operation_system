from __future__ import annotations
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class DealTaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[date] = None
    priority: str = "medium"


class DealTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[date] = None
    priority: Optional[str] = None
    status: Optional[str] = None


class DealTaskOut(BaseModel):
    id: int
    deal_id: int
    title: str
    description: Optional[str] = None
    due_date: Optional[date] = None
    status: str
    priority: str
    created_by: Optional[int] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DealActivityCreate(BaseModel):
    action_type: str = "note"
    note: Optional[str] = None
    deal_cycle_stage: Optional[str] = None
    status: Optional[str] = None
    next_action: Optional[str] = None
    next_action_date: Optional[date] = None


class DealActivityOut(BaseModel):
    id: int
    deal_id: int
    action_type: str
    note: Optional[str] = None
    from_stage: Optional[str] = None
    to_stage: Optional[str] = None
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    next_action: Optional[str] = None
    next_action_date: Optional[date] = None
    created_by: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DealBase(BaseModel):
    title: str
    customer_id: Optional[int] = None
    project_id: Optional[int] = None
    owner_id: Optional[int] = None

    deal_cycle_stage: str = "lead"
    status: str = "open"

    expected_value: Decimal = Field(default=Decimal("0"))
    probability_pct: int = 10
    expected_close_date: Optional[date] = None

    next_action: Optional[str] = None
    next_action_date: Optional[date] = None

    source: Optional[str] = None
    competitor: Optional[str] = None
    description: Optional[str] = None


class DealCreate(DealBase):
    pass


class DealUpdate(BaseModel):
    title: Optional[str] = None
    customer_id: Optional[int] = None
    project_id: Optional[int] = None
    owner_id: Optional[int] = None

    deal_cycle_stage: Optional[str] = None
    status: Optional[str] = None

    expected_value: Optional[Decimal] = None
    probability_pct: Optional[int] = None
    expected_close_date: Optional[date] = None

    next_action: Optional[str] = None
    next_action_date: Optional[date] = None

    source: Optional[str] = None
    competitor: Optional[str] = None
    description: Optional[str] = None


class DealOut(BaseModel):
    id: int
    title: str
    customer_id: Optional[int] = None
    project_id: Optional[int] = None
    owner_id: int

    deal_cycle_stage: str
    status: str

    expected_value: Decimal
    probability_pct: int
    expected_close_date: Optional[date] = None

    next_action: Optional[str] = None
    next_action_date: Optional[date] = None
    last_reviewed_at: Optional[datetime] = None

    source: Optional[str] = None
    competitor: Optional[str] = None
    description: Optional[str] = None

    created_at: datetime
    updated_at: datetime

    customer_name: Optional[str] = None
    project_name: Optional[str] = None
    owner_name: Optional[str] = None

    tasks: list[DealTaskOut] = []
    activities: list[DealActivityOut] = []

    model_config = {"from_attributes": True}


class FunnelRow(BaseModel):
    stage: str
    count: int
    amount: Decimal


class OwnerSummaryRow(BaseModel):
    owner_id: int
    owner_name: str
    total_deals: int
    open_deals: int
    won_deals: int
    lost_deals: int
    pipeline_amount: Decimal


class DashboardOut(BaseModel):
    total_deals: int
    open_deals: int
    won_deals: int
    lost_deals: int
    pipeline_amount: Decimal
    overdue_tasks: int
    today_tasks: int
    upcoming_tasks: int
    funnel: list[FunnelRow]
    owner_summary: list[OwnerSummaryRow] = []


class ReviewDealRow(BaseModel):
    deal_id: int
    title: str
    owner_id: int
    owner_name: str
    customer_name: Optional[str] = None
    stage: str
    status: str
    expected_value: Decimal
    probability_pct: int
    age_days: int
    stale_days: int
    next_action: Optional[str] = None
    next_action_date: Optional[date] = None
    overdue_tasks: int
    risk_level: str


class ReviewOwnerRow(BaseModel):
    owner_id: int
    owner_name: str
    total_open_deals: int
    at_risk_deals: int
    overdue_tasks: int
    upcoming_7d_actions: int
    pipeline_amount: Decimal


class ReviewReportOut(BaseModel):
    generated_at: datetime
    total_open_deals: int
    total_at_risk_deals: int
    total_overdue_tasks: int
    upcoming_7d_actions: int
    deals: list[ReviewDealRow]
    owner_summary: list[ReviewOwnerRow]
