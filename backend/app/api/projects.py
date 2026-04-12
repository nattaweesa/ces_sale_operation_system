from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, exists
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.deal import Deal
from app.models.project import Project
from app.models.customer import Customer
from app.models.quotation import Quotation
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectOut
from app.services.auth import get_current_user
from app.services.department_scope import get_allowed_department_ids
from app.services.rbac import can_user

router = APIRouter(prefix="/projects", tags=["projects"])


def _normalize_department_ids(raw_ids: Optional[list[int]]) -> list[int]:
    if not raw_ids:
        return []
    return sorted({int(v) for v in raw_ids if v is not None})


def _project_department_exists_clause(project_id_col, department_ids: list[int]):
    return exists(
        select(Deal.id)
        .where(Deal.project_id == project_id_col, Deal.department_id.in_(department_ids))
        .limit(1)
    )


async def _enrich(project: Project, db: AsyncSession) -> ProjectOut:
    out = ProjectOut.model_validate(project)
    out.customer_name = project.customer.name if project.customer else None
    return out


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    customer_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    department_ids: Optional[list[int]] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed_department_ids = await get_allowed_department_ids(db, current_user)
    requested_department_ids = _normalize_department_ids(department_ids)

    stmt = select(Project).options(selectinload(Project.customer)).order_by(Project.name)
    if customer_id:
        stmt = stmt.where(Project.customer_id == customer_id)
    if status:
        stmt = stmt.where(Project.status == status)

    if requested_department_ids:
        if allowed_department_ids is not None and not set(requested_department_ids).issubset(allowed_department_ids):
            raise HTTPException(status_code=403, detail="Requested departments are outside your scope")
        stmt = stmt.where(_project_department_exists_clause(Project.id, requested_department_ids))
    elif allowed_department_ids is not None:
        if not allowed_department_ids:
            return []
        stmt = stmt.where(_project_department_exists_clause(Project.id, sorted(allowed_department_ids)))

    result = await db.execute(stmt)
    projects = result.scalars().all()
    return [await _enrich(p, db) for p in projects]


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(payload: ProjectCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not await can_user(db, current_user, "projects.manage"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    project = Project(**payload.model_dump())
    db.add(project)
    await db.commit()
    stmt = select(Project).options(selectinload(Project.customer)).where(Project.id == project.id)
    result = await db.execute(stmt)
    return await _enrich(result.scalar_one(), db)


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    allowed_department_ids = await get_allowed_department_ids(db, current_user)

    stmt = select(Project).options(selectinload(Project.customer)).where(Project.id == project_id)
    if allowed_department_ids is not None:
        if not allowed_department_ids:
            raise HTTPException(status_code=404, detail="Project not found")
        stmt = stmt.where(_project_department_exists_clause(Project.id, sorted(allowed_department_ids)))
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await _enrich(project, db)


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: int, payload: ProjectUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not await can_user(db, current_user, "projects.manage"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    stmt = select(Project).options(selectinload(Project.customer)).where(Project.id == project_id)
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(project, field, val)
    await db.commit()
    stmt2 = select(Project).options(selectinload(Project.customer)).where(Project.id == project_id)
    result2 = await db.execute(stmt2)
    return await _enrich(result2.scalar_one(), db)


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not await can_user(db, current_user, "projects.manage"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.status = "cancelled"
    await db.commit()
