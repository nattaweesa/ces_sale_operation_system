from __future__ import annotations

from collections.abc import Iterable

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.department import Department, UserDepartment
from app.models.user import User

GLOBAL_DEPARTMENT_ROLES = {"admin", "manager"}


def is_global_department_role(role: str) -> bool:
    return role in GLOBAL_DEPARTMENT_ROLES


async def get_allowed_department_ids(db: AsyncSession, user: User) -> set[int] | None:
    if is_global_department_role(user.role):
        return None

    rows = await db.execute(
        select(UserDepartment.department_id).where(UserDepartment.user_id == user.id)
    )
    return {int(v) for v in rows.scalars().all()}


async def ensure_user_can_access_department(db: AsyncSession, user: User, department_id: int) -> None:
    if is_global_department_role(user.role):
        return
    allowed_ids = await get_allowed_department_ids(db, user)
    if department_id not in (allowed_ids or set()):
        raise HTTPException(status_code=403, detail="You do not have access to this department")


async def validate_department_ids(db: AsyncSession, department_ids: Iterable[int]) -> list[int]:
    ids = sorted({int(v) for v in department_ids})
    if not ids:
        return []

    result = await db.execute(
        select(Department.id).where(Department.id.in_(ids), Department.is_active == True)  # noqa: E712
    )
    found = {int(v) for v in result.scalars().all()}
    missing = [v for v in ids if v not in found]
    if missing:
        raise HTTPException(status_code=400, detail=f"Invalid or inactive department IDs: {missing}")
    return ids
