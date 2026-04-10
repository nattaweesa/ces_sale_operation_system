from __future__ import annotations
from typing import Optional
from datetime import datetime, timedelta, timezone
import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.user_activity import UserActivityLog
from app.services.auth import require_roles
from app.config import get_settings

router = APIRouter(prefix="/admin", tags=["admin"])
settings = get_settings()


# ── Response schemas ──────────────────────────────────────────────────────────

class ActivityLogOut(BaseModel):
    id: int
    action: str
    resource_type: Optional[str]
    resource_id: Optional[int]
    resource_label: Optional[str]
    ip_address: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class UserSessionOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime]
    is_likely_online: bool
    activity_today: int
    activity_7d: int
    last_activity: Optional[ActivityLogOut]


class UserActivityPageOut(BaseModel):
    user_id: int
    username: str
    full_name: str
    total: int
    activities: list[ActivityLogOut]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/user-sessions", response_model=list[UserSessionOut])
async def list_user_sessions(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    """Return all users with last-login info and 24 h / 7 d activity counts."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    token_ttl = settings.access_token_expire_minutes

    users_result = await db.execute(select(User).order_by(User.full_name))
    users = users_result.scalars().all()

    out: list[UserSessionOut] = []
    for user in users:
        today_count: int = (
            await db.execute(
                select(func.count())
                .select_from(UserActivityLog)
                .where(
                    UserActivityLog.user_id == user.id,
                    UserActivityLog.created_at >= today_start,
                )
            )
        ).scalar() or 0

        week_count: int = (
            await db.execute(
                select(func.count())
                .select_from(UserActivityLog)
                .where(
                    UserActivityLog.user_id == user.id,
                    UserActivityLog.created_at >= week_ago,
                )
            )
        ).scalar() or 0

        last_act = (
            await db.execute(
                select(UserActivityLog)
                .where(UserActivityLog.user_id == user.id)
                .order_by(UserActivityLog.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

        is_likely_online = False
        if user.last_login_at:
            elapsed_mins = (now - user.last_login_at).total_seconds() / 60
            is_likely_online = elapsed_mins <= token_ttl

        out.append(
            UserSessionOut(
                id=user.id,
                username=user.username,
                full_name=user.full_name,
                role=user.role,
                is_active=user.is_active,
                created_at=user.created_at,
                last_login_at=user.last_login_at,
                is_likely_online=is_likely_online,
                activity_today=today_count,
                activity_7d=week_count,
                last_activity=ActivityLogOut.model_validate(last_act) if last_act else None,
            )
        )
    return out


@router.get("/user-sessions/{user_id}/activity", response_model=UserActivityPageOut)
async def get_user_activity(
    user_id: int,
    limit: int = 50,
    offset: int = 0,
    action: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    q: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    """Return paginated activity log for a specific user."""
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    filters = [UserActivityLog.user_id == user_id]
    if action:
        filters.append(UserActivityLog.action == action)
    if date_from:
        filters.append(UserActivityLog.created_at >= date_from)
    if date_to:
        filters.append(UserActivityLog.created_at <= date_to)
    if q:
        like_term = f"%{q}%"
        filters.append(
            (UserActivityLog.resource_label.ilike(like_term))
            | (UserActivityLog.action.ilike(like_term))
            | (UserActivityLog.ip_address.ilike(like_term))
        )

    total: int = (
        await db.execute(
            select(func.count())
            .select_from(UserActivityLog)
            .where(*filters)
        )
    ).scalar() or 0

    acts = (
        await db.execute(
            select(UserActivityLog)
            .where(*filters)
            .order_by(UserActivityLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()

    return UserActivityPageOut(
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
        total=total,
        activities=[ActivityLogOut.model_validate(a) for a in acts],
    )


@router.get("/user-sessions/{user_id}/activity/export.csv")
async def export_user_activity_csv(
    user_id: int,
    action: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    q: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    """Export filtered activity logs for a user as CSV."""
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    filters = [UserActivityLog.user_id == user_id]
    if action:
        filters.append(UserActivityLog.action == action)
    if date_from:
        filters.append(UserActivityLog.created_at >= date_from)
    if date_to:
        filters.append(UserActivityLog.created_at <= date_to)
    if q:
        like_term = f"%{q}%"
        filters.append(
            (UserActivityLog.resource_label.ilike(like_term))
            | (UserActivityLog.action.ilike(like_term))
            | (UserActivityLog.ip_address.ilike(like_term))
        )

    activities = (
        await db.execute(
            select(UserActivityLog)
            .where(*filters)
            .order_by(UserActivityLog.created_at.desc())
        )
    ).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "created_at", "action", "resource_type", "resource_id", "resource_label", "ip_address"])
    for row in activities:
        writer.writerow([
            row.id,
            row.created_at.isoformat() if row.created_at else "",
            row.action,
            row.resource_type or "",
            row.resource_id or "",
            row.resource_label or "",
            row.ip_address or "",
        ])

    filename = f"user_activity_{user.username}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
