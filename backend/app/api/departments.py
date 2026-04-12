from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.department import Department
from app.models.user import User
from app.schemas.department import DepartmentCreate, DepartmentOut, DepartmentUpdate
from app.services.auth import get_current_user, require_roles
from app.services.department_scope import get_allowed_department_ids

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentOut])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Department).order_by(Department.name.asc())
    allowed_ids = await get_allowed_department_ids(db, current_user)
    if allowed_ids is not None:
        if not allowed_ids:
            return []
        stmt = stmt.where(Department.id.in_(allowed_ids), Department.is_active == True)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=DepartmentOut, status_code=201)
async def create_department(
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Department name cannot be empty")

    exists = await db.execute(select(Department).where(Department.name == name))
    if exists.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Department name already exists")

    department = Department(name=name)
    db.add(department)
    await db.commit()
    await db.refresh(department)
    return department


@router.put("/{department_id}", response_model=DepartmentOut)
async def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    result = await db.execute(select(Department).where(Department.id == department_id))
    department = result.scalar_one_or_none()
    if department is None:
        raise HTTPException(status_code=404, detail="Department not found")

    updates = payload.model_dump(exclude_none=True)
    if "name" in updates:
        name = str(updates["name"]).strip()
        if not name:
            raise HTTPException(status_code=400, detail="Department name cannot be empty")
        dup = await db.execute(select(Department).where(Department.name == name, Department.id != department_id))
        if dup.scalar_one_or_none() is not None:
            raise HTTPException(status_code=400, detail="Department name already exists")
        department.name = name

    if "is_active" in updates:
        department.is_active = bool(updates["is_active"])

    await db.commit()
    await db.refresh(department)

    return department
