from __future__ import annotations
from typing import Optional
from datetime import datetime, date, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.deal import Deal, DealTask, DealActivity
from app.models.deal_forecast import DealForecastMonthly
from app.models.project import Project
from app.models.user import User
from app.schemas.deal_forecast import DealForecastMonthlyBulkIn, DealForecastMonthlyOut
from app.schemas.deal import (
    DealCreate, DealUpdate, DealOut,
    DealTaskCreate, DealTaskUpdate, DealTaskOut,
    DealActivityCreate, DealActivityOut,
    DashboardOut, FunnelRow, OwnerSummaryRow,
    ReviewReportOut, ReviewDealRow, ReviewOwnerRow,
)
from app.services.auth import get_current_user
from app.services.rbac import can_user
from app.services.activity import log_activity

router = APIRouter(prefix="/deals", tags=["deals"])

MANAGER_ROLES = {"admin", "manager", "sales_admin"}


def _calc_net_amount(amount: Decimal, win_pct: Decimal) -> Decimal:
    return (amount * win_pct / Decimal("100")).quantize(Decimal("0.01"))


async def _load_deal(deal_id: int, db: AsyncSession) -> Optional[Deal]:
    stmt = (
        select(Deal)
        .options(
            selectinload(Deal.customer),
            selectinload(Deal.project),
            selectinload(Deal.owner),
            selectinload(Deal.tasks),
            selectinload(Deal.activities).selectinload(DealActivity.creator),
        )
        .where(Deal.id == deal_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


def _is_manager(user: User) -> bool:
    return user.role in MANAGER_ROLES


def _assert_access(user: User, deal: Deal) -> None:
    if _is_manager(user):
        return
    if deal.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You can only access your own deals")


def _to_deal_out(deal: Deal) -> DealOut:
    out = DealOut.model_validate(deal)
    out.customer_name = deal.customer.name if deal.customer else None
    out.project_name = deal.project.name if deal.project else None
    out.owner_name = deal.owner.full_name if deal.owner else None
    out.tasks = [DealTaskOut.model_validate(t) for t in deal.tasks]
    acts = []
    for a in deal.activities:
        ao = DealActivityOut.model_validate(a)
        ao.creator_name = a.creator.full_name if a.creator else None
        acts.append(ao)
    out.activities = acts
    return out


@router.get("", response_model=list[DealOut])
async def list_deals(
    owner_id: Optional[int] = Query(None),
    stage: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Deal)
        .options(
            selectinload(Deal.customer),
            selectinload(Deal.project),
            selectinload(Deal.owner),
            selectinload(Deal.tasks),
            selectinload(Deal.activities),
        )
        .order_by(Deal.updated_at.desc())
    )

    if await can_user(db, current_user, "deals.view_all"):
        if owner_id:
            stmt = stmt.where(Deal.owner_id == owner_id)
    else:
        stmt = stmt.where(Deal.owner_id == current_user.id)

    if stage:
        stmt = stmt.where(Deal.deal_cycle_stage == stage)
    if status:
        stmt = stmt.where(Deal.status == status)

    result = await db.execute(stmt)
    deals = result.scalars().all()
    return [_to_deal_out(d) for d in deals]


@router.post("", response_model=DealOut, status_code=201)
async def create_deal(
    payload: DealCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = payload.model_dump()

    if data.get("owner_id") is None:
        data["owner_id"] = current_user.id

    if not _is_manager(current_user) and data["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Sales can only create their own deals")

    # Auto-create Project from Deal if customer is known and no project linked yet
    if data.get("customer_id") and not data.get("project_id"):
        auto_project = Project(
            customer_id=data["customer_id"],
            name=data["title"],
            description=data.get("description"),
            status="active",
        )
        db.add(auto_project)
        await db.flush()
        data["project_id"] = auto_project.id

    deal = Deal(**data)
    db.add(deal)
    await db.flush()

    db.add(DealActivity(
        deal_id=deal.id,
        action_type="created",
        note="Deal created",
        created_by=current_user.id,
        to_stage=deal.deal_cycle_stage,
        to_status=deal.status,
        next_action=deal.next_action,
        next_action_date=deal.next_action_date,
    ))

    await log_activity(db, current_user.id, "deal.create",
                       resource_type="deal", resource_id=deal.id, resource_label=deal.title)
    await db.commit()

    full = await _load_deal(deal.id, db)
    return _to_deal_out(full)


@router.get("/{deal_id}", response_model=DealOut)
async def get_deal(
    deal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deal = await _load_deal(deal_id, db)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if not await can_user(db, current_user, "deals.view_all"):
        _assert_access(current_user, deal)
    return _to_deal_out(deal)


@router.put("/{deal_id}", response_model=DealOut)
async def update_deal(
    deal_id: int,
    payload: DealUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deal = await _load_deal(deal_id, db)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if not await can_user(db, current_user, "deals.view_all"):
        _assert_access(current_user, deal)

    updates = payload.model_dump(exclude_none=True)

    if "owner_id" in updates and not _is_manager(current_user):
        raise HTTPException(status_code=403, detail="Only manager/admin can reassign owner")

    from_stage = deal.deal_cycle_stage
    from_status = deal.status

    for field, value in updates.items():
        setattr(deal, field, value)

    deal.last_reviewed_at = datetime.now(timezone.utc)

    db.add(DealActivity(
        deal_id=deal.id,
        action_type="updated",
        note="Deal updated",
        created_by=current_user.id,
        from_stage=from_stage,
        to_stage=deal.deal_cycle_stage,
        from_status=from_status,
        to_status=deal.status,
        next_action=deal.next_action,
        next_action_date=deal.next_action_date,
    ))

    await db.commit()

    full = await _load_deal(deal.id, db)
    return _to_deal_out(full)


@router.get("/{deal_id}/monthly-forecasts", response_model=list[DealForecastMonthlyOut])
async def list_monthly_forecasts(
    deal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deal = await _load_deal(deal_id, db)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if not await can_user(db, current_user, "deals.view_all"):
        _assert_access(current_user, deal)

    rows = await db.execute(
        select(DealForecastMonthly)
        .where(DealForecastMonthly.deal_id == deal_id)
        .order_by(DealForecastMonthly.forecast_year.asc(), DealForecastMonthly.forecast_month.asc())
    )
    return rows.scalars().all()


@router.put("/{deal_id}/monthly-forecasts", response_model=list[DealForecastMonthlyOut])
async def replace_monthly_forecasts(
    deal_id: int,
    payload: DealForecastMonthlyBulkIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deal = await _load_deal(deal_id, db)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if not await can_user(db, current_user, "deals.view_all"):
        _assert_access(current_user, deal)

    seen: set[tuple[int, int]] = set()
    for row in payload.items:
        key = (row.forecast_year, row.forecast_month)
        if key in seen:
            raise HTTPException(
                status_code=400,
                detail=f"Duplicate monthly forecast for year={row.forecast_year}, month={row.forecast_month}",
            )
        seen.add(key)

    await db.execute(
        sa.delete(DealForecastMonthly).where(DealForecastMonthly.deal_id == deal_id)
    )

    for row in sorted(payload.items, key=lambda item: (item.forecast_year, item.forecast_month)):
        amount = Decimal(str(row.amount or 0))
        win_pct = Decimal(str(row.win_pct or 0))
        db.add(
            DealForecastMonthly(
                deal_id=deal_id,
                forecast_year=row.forecast_year,
                forecast_month=row.forecast_month,
                amount=amount,
                win_pct=win_pct,
                net_amount=_calc_net_amount(amount, win_pct),
                note=row.note,
            )
        )

    await db.commit()
    rows = await db.execute(
        select(DealForecastMonthly)
        .where(DealForecastMonthly.deal_id == deal_id)
        .order_by(DealForecastMonthly.forecast_year.asc(), DealForecastMonthly.forecast_month.asc())
    )
    return rows.scalars().all()


@router.post("/{deal_id}/tasks", response_model=DealTaskOut, status_code=201)
async def add_task(
    deal_id: int,
    payload: DealTaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deal = await _load_deal(deal_id, db)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if not await can_user(db, current_user, "deals.view_all"):
        _assert_access(current_user, deal)

    task = DealTask(
        deal_id=deal_id,
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
        priority=payload.priority,
        created_by=current_user.id,
    )
    db.add(task)

    db.add(DealActivity(
        deal_id=deal_id,
        action_type="task_added",
        note=f"Task added: {payload.title}",
        created_by=current_user.id,
    ))

    await db.commit()
    await db.refresh(task)
    return DealTaskOut.model_validate(task)


@router.put("/{deal_id}/tasks/{task_id}", response_model=DealTaskOut)
async def update_task(
    deal_id: int,
    task_id: int,
    payload: DealTaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deal = await _load_deal(deal_id, db)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if not await can_user(db, current_user, "deals.view_all"):
        _assert_access(current_user, deal)

    result = await db.execute(select(DealTask).where(DealTask.id == task_id, DealTask.deal_id == deal_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(task, field, value)

    if payload.status == "done" and task.completed_at is None:
        task.completed_at = datetime.now(timezone.utc)

    db.add(DealActivity(
        deal_id=deal_id,
        action_type="task_updated",
        note=f"Task updated: {task.title}",
        created_by=current_user.id,
    ))

    await db.commit()
    await db.refresh(task)
    return DealTaskOut.model_validate(task)


@router.post("/{deal_id}/activities", response_model=DealActivityOut, status_code=201)
async def add_activity(
    deal_id: int,
    payload: DealActivityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deal = await _load_deal(deal_id, db)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if not await can_user(db, current_user, "deals.view_all"):
        _assert_access(current_user, deal)

    from_stage = deal.deal_cycle_stage
    from_status = deal.status

    if payload.deal_cycle_stage:
        deal.deal_cycle_stage = payload.deal_cycle_stage
    if payload.status:
        deal.status = payload.status
    if payload.next_action is not None:
        deal.next_action = payload.next_action
    if payload.next_action_date is not None:
        deal.next_action_date = payload.next_action_date

    deal.last_reviewed_at = datetime.now(timezone.utc)

    activity = DealActivity(
        deal_id=deal_id,
        action_type=payload.action_type,
        note=payload.note,
        created_by=current_user.id,
        from_stage=from_stage,
        to_stage=deal.deal_cycle_stage,
        from_status=from_status,
        to_status=deal.status,
        next_action=deal.next_action,
        next_action_date=deal.next_action_date,
    )
    db.add(activity)

    await db.commit()
    await db.refresh(activity)
    out = DealActivityOut.model_validate(activity)
    out.creator_name = current_user.full_name
    return out


def _build_dashboard(deals: list[Deal], include_owner: bool) -> DashboardOut:
    today = date.today()

    total_deals = len(deals)
    open_deals = len([d for d in deals if d.status in ("open", "on_hold")])
    won_deals = len([d for d in deals if d.status == "won"])
    lost_deals = len([d for d in deals if d.status == "lost"])
    pipeline_amount = sum((d.expected_value or Decimal("0")) for d in deals if d.status in ("open", "on_hold"))

    task_list = [t for d in deals for t in d.tasks if t.status in ("todo", "in_progress")]
    overdue_tasks = len([t for t in task_list if t.due_date and t.due_date < today])
    today_tasks = len([t for t in task_list if t.due_date == today])
    upcoming_tasks = len([t for t in task_list if t.due_date and t.due_date > today])

    stage_map: dict[str, dict[str, Decimal | int]] = {}
    for d in deals:
        slot = stage_map.setdefault(d.deal_cycle_stage, {"count": 0, "amount": Decimal("0")})
        slot["count"] = int(slot["count"]) + 1
        slot["amount"] = Decimal(slot["amount"]) + (d.expected_value or Decimal("0"))

    funnel = [
        FunnelRow(stage=stage, count=int(vals["count"]), amount=Decimal(vals["amount"]))
        for stage, vals in stage_map.items()
    ]
    funnel.sort(key=lambda x: x.count, reverse=True)

    owner_summary: list[OwnerSummaryRow] = []
    if include_owner:
        owner_map: dict[int, dict[str, Decimal | int | str]] = {}
        for d in deals:
            if not d.owner:
                continue
            slot = owner_map.setdefault(d.owner_id, {
                "owner_name": d.owner.full_name,
                "total_deals": 0,
                "open_deals": 0,
                "won_deals": 0,
                "lost_deals": 0,
                "pipeline_amount": Decimal("0"),
            })
            slot["total_deals"] = int(slot["total_deals"]) + 1
            if d.status in ("open", "on_hold"):
                slot["open_deals"] = int(slot["open_deals"]) + 1
                slot["pipeline_amount"] = Decimal(slot["pipeline_amount"]) + (d.expected_value or Decimal("0"))
            elif d.status == "won":
                slot["won_deals"] = int(slot["won_deals"]) + 1
            elif d.status == "lost":
                slot["lost_deals"] = int(slot["lost_deals"]) + 1

        owner_summary = [
            OwnerSummaryRow(
                owner_id=uid,
                owner_name=str(vals["owner_name"]),
                total_deals=int(vals["total_deals"]),
                open_deals=int(vals["open_deals"]),
                won_deals=int(vals["won_deals"]),
                lost_deals=int(vals["lost_deals"]),
                pipeline_amount=Decimal(vals["pipeline_amount"]),
            )
            for uid, vals in owner_map.items()
        ]
        owner_summary.sort(key=lambda x: x.pipeline_amount, reverse=True)

    return DashboardOut(
        total_deals=total_deals,
        open_deals=open_deals,
        won_deals=won_deals,
        lost_deals=lost_deals,
        pipeline_amount=pipeline_amount,
        overdue_tasks=overdue_tasks,
        today_tasks=today_tasks,
        upcoming_tasks=upcoming_tasks,
        funnel=funnel,
        owner_summary=owner_summary,
    )


@router.get("/dashboard/my", response_model=DashboardOut)
async def dashboard_my(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Deal)
        .options(selectinload(Deal.owner), selectinload(Deal.tasks))
        .where(Deal.owner_id == current_user.id)
    )
    result = await db.execute(stmt)
    deals = result.scalars().all()
    return _build_dashboard(deals, include_owner=False)


@router.get("/dashboard/manager", response_model=DashboardOut)
async def dashboard_manager(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not await can_user(db, current_user, "deals.view_all"):
        raise HTTPException(status_code=403, detail="Manager/Admin only")

    stmt = select(Deal).options(selectinload(Deal.owner), selectinload(Deal.tasks))
    result = await db.execute(stmt)
    deals = result.scalars().all()
    return _build_dashboard(deals, include_owner=True)


@router.get("/review-report/manager", response_model=ReviewReportOut)
async def review_report_manager(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    can_view_all = await can_user(db, current_user, "deals.view_all")

    today = date.today()
    next_7 = today.fromordinal(today.toordinal() + 7)

    stmt = (
        select(Deal)
        .options(
            selectinload(Deal.owner),
            selectinload(Deal.customer),
            selectinload(Deal.tasks),
        )
        .where(Deal.status.in_(["open", "on_hold"]))
        .order_by(Deal.updated_at.asc())
    )
    if not can_view_all:
        stmt = stmt.where(Deal.owner_id == current_user.id)
    result = await db.execute(stmt)
    deals = result.scalars().all()

    review_rows: list[ReviewDealRow] = []
    owner_map: dict[int, dict[str, Decimal | int | str]] = {}

    total_at_risk = 0
    total_overdue_tasks = 0
    total_upcoming_actions = 0

    for d in deals:
        overdue_tasks = len([t for t in d.tasks if t.status in ("todo", "in_progress") and t.due_date and t.due_date < today])
        upcoming_actions = 1 if (d.next_action_date and today <= d.next_action_date <= next_7) else 0

        age_days = (today - d.created_at.date()).days if d.created_at else 0
        stale_days = (today - d.updated_at.date()).days if d.updated_at else 0

        risk_score = 0
        if overdue_tasks > 0:
            risk_score += 2
        if d.next_action_date and d.next_action_date < today:
            risk_score += 2
        if stale_days >= 14:
            risk_score += 1
        if d.probability_pct <= 20 and d.deal_cycle_stage in ("proposal", "negotiation"):
            risk_score += 1

        risk_level = "low"
        if risk_score >= 4:
            risk_level = "high"
        elif risk_score >= 2:
            risk_level = "medium"

        if risk_level in ("medium", "high"):
            total_at_risk += 1

        total_overdue_tasks += overdue_tasks
        total_upcoming_actions += upcoming_actions

        owner_name = d.owner.full_name if d.owner else f"User {d.owner_id}"
        row = ReviewDealRow(
            deal_id=d.id,
            title=d.title,
            owner_id=d.owner_id,
            owner_name=owner_name,
            customer_name=d.customer.name if d.customer else None,
            stage=d.deal_cycle_stage,
            status=d.status,
            expected_value=d.expected_value or Decimal("0"),
            probability_pct=d.probability_pct,
            age_days=age_days,
            stale_days=stale_days,
            next_action=d.next_action,
            next_action_date=d.next_action_date,
            overdue_tasks=overdue_tasks,
            risk_level=risk_level,
        )
        review_rows.append(row)

        slot = owner_map.setdefault(d.owner_id, {
            "owner_name": owner_name,
            "total_open_deals": 0,
            "at_risk_deals": 0,
            "overdue_tasks": 0,
            "upcoming_7d_actions": 0,
            "pipeline_amount": Decimal("0"),
        })
        slot["total_open_deals"] = int(slot["total_open_deals"]) + 1
        slot["pipeline_amount"] = Decimal(slot["pipeline_amount"]) + (d.expected_value or Decimal("0"))
        slot["overdue_tasks"] = int(slot["overdue_tasks"]) + overdue_tasks
        slot["upcoming_7d_actions"] = int(slot["upcoming_7d_actions"]) + upcoming_actions
        if risk_level in ("medium", "high"):
            slot["at_risk_deals"] = int(slot["at_risk_deals"]) + 1

    owner_summary = [
        ReviewOwnerRow(
            owner_id=uid,
            owner_name=str(vals["owner_name"]),
            total_open_deals=int(vals["total_open_deals"]),
            at_risk_deals=int(vals["at_risk_deals"]),
            overdue_tasks=int(vals["overdue_tasks"]),
            upcoming_7d_actions=int(vals["upcoming_7d_actions"]),
            pipeline_amount=Decimal(vals["pipeline_amount"]),
        )
        for uid, vals in owner_map.items()
    ]
    owner_summary.sort(key=lambda x: x.pipeline_amount, reverse=True)

    review_rows.sort(key=lambda x: (x.risk_level != "high", x.risk_level != "medium", -x.stale_days))

    return ReviewReportOut(
        generated_at=datetime.now(timezone.utc),
        total_open_deals=len(deals),
        total_at_risk_deals=total_at_risk,
        total_overdue_tasks=total_overdue_tasks,
        upcoming_7d_actions=total_upcoming_actions,
        deals=review_rows,
        owner_summary=owner_summary,
    )
