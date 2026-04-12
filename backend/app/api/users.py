from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.department import Department, UserDepartment
from app.models.deal import Deal
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserOut,
    UserSelfUpdate,
    UserChangePassword,
    UserDepartmentOut,
    UserDepartmentSwitch,
)
from app.services.auth import hash_password, verify_password, validate_password_strength, get_current_user, require_roles
from app.services.activity import log_activity
from app.services.department_scope import (
    is_global_department_role,
    validate_department_ids,
)

router = APIRouter(prefix="/users", tags=["users"])


def _to_user_out(user: User) -> UserOut:
    department_map: dict[int, UserDepartmentOut] = {}
    for link in user.department_links:
        if link.department is None:
            continue
        department_map[link.department.id] = UserDepartmentOut(id=link.department.id, name=link.department.name)

    return UserOut(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        active_department_id=user.active_department_id,
        departments=sorted(department_map.values(), key=lambda d: d.name.lower()),
    )


async def _replace_user_departments(
    db: AsyncSession,
    user: User,
    department_ids: list[int],
    granted_by: int,
) -> None:
    await db.execute(delete(UserDepartment).where(UserDepartment.user_id == user.id))
    await db.flush()

    for department_id in department_ids:
        db.add(UserDepartment(user_id=user.id, department_id=department_id, granted_by=granted_by))


def _ensure_active_department_is_valid(user: User, department_ids: list[int]) -> None:
    if is_global_department_role(user.role):
        return
    if user.active_department_id is None:
        raise HTTPException(status_code=400, detail="Active department is required for this role")
    if user.active_department_id not in department_ids:
        raise HTTPException(status_code=400, detail="Active department must be one of assigned departments")


@router.get("", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "manager", "sales_admin")),
):
    stmt = (
        select(User)
        .options(selectinload(User.department_links).selectinload(UserDepartment.department))
        .order_by(User.full_name)
    )
    if current_user.role == "sales_admin":
        rows = await db.execute(select(UserDepartment.department_id).where(UserDepartment.user_id == current_user.id))
        allowed = sorted({int(v) for v in rows.scalars().all()})
        if not allowed:
            return []
        stmt = (
            stmt
            .join(UserDepartment, UserDepartment.user_id == User.id)
            .where(UserDepartment.department_id.in_(allowed))
            .distinct()
        )

    result = await db.execute(stmt)
    return [_to_user_out(user) for user in result.scalars().all()]


@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    normalized_username = payload.username.strip()
    existing = await db.execute(select(User).where(func.lower(User.username) == normalized_username.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")

    password_error = validate_password_strength(payload.password)
    if password_error:
        raise HTTPException(status_code=400, detail=password_error)

    user = User(
        username=normalized_username,
        full_name=payload.full_name,
        email=payload.email,
        role=payload.role,
        password_hash=hash_password(payload.password),
        active_department_id=payload.active_department_id,
    )
    db.add(user)
    await db.flush()

    department_ids = await validate_department_ids(db, payload.department_ids)
    if payload.active_department_id is not None and payload.active_department_id not in department_ids:
        raise HTTPException(status_code=400, detail="Active department must be one of assigned departments")
    for department_id in department_ids:
        db.add(UserDepartment(user_id=user.id, department_id=department_id, granted_by=current_user.id))
    _ensure_active_department_is_valid(user, department_ids)
    await log_activity(
        db,
        current_user.id,
        "user.create",
        resource_type="user",
        resource_id=user.id,
        resource_label=user.username,
    )
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        msg = str(getattr(exc, "orig", exc)).lower()
        if "users_username_key" in msg or "username" in msg:
            raise HTTPException(status_code=400, detail="Username already exists")
        raise
    result = await db.execute(
        select(User)
        .options(selectinload(User.department_links).selectinload(UserDepartment.department))
        .where(User.id == user.id)
    )
    return _to_user_out(result.scalar_one())


@router.get("/me", response_model=UserOut)
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(User)
        .options(selectinload(User.department_links).selectinload(UserDepartment.department))
        .where(User.id == current_user.id)
    )
    user = result.scalar_one()
    return _to_user_out(user)


@router.put("/me", response_model=UserOut)
async def update_me(
    payload: UserSelfUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_result = await db.execute(
        select(User)
        .options(selectinload(User.department_links).selectinload(UserDepartment.department))
        .where(User.id == current_user.id)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = payload.model_dump(exclude_none=True)
    if "full_name" in updates and not str(updates["full_name"]).strip():
        raise HTTPException(status_code=400, detail="Full name cannot be empty")

    for field, val in updates.items():
        setattr(user, field, val)

    await db.commit()
    refreshed = await db.execute(
        select(User)
        .options(selectinload(User.department_links).selectinload(UserDepartment.department))
        .where(User.id == user.id)
    )
    return _to_user_out(refreshed.scalar_one())


@router.put("/me/active-department", response_model=UserOut)
async def switch_my_active_department(
    payload: UserDepartmentSwitch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_result = await db.execute(
        select(User)
        .options(selectinload(User.department_links).selectinload(UserDepartment.department))
        .where(User.id == current_user.id)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    department_ids = {link.department_id for link in user.department_links}
    if payload.department_id not in department_ids and not is_global_department_role(user.role):
        raise HTTPException(status_code=403, detail="Department is not assigned to this user")

    department_exists = await db.execute(
        select(Department.id).where(Department.id == payload.department_id, Department.is_active == True)
    )
    if department_exists.scalar_one_or_none() is None:
        raise HTTPException(status_code=400, detail="Invalid or inactive department")

    user.active_department_id = payload.department_id
    await db.commit()
    refreshed = await db.execute(
        select(User)
        .options(selectinload(User.department_links).selectinload(UserDepartment.department))
        .where(User.id == user.id)
    )
    return _to_user_out(refreshed.scalar_one())


@router.put("/me/password")
async def change_my_password(
    payload: UserChangePassword,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    password_error = validate_password_strength(payload.new_password)
    if password_error:
        raise HTTPException(status_code=400, detail=password_error)

    user_result = await db.execute(select(User).where(User.id == current_user.id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.password_hash = hash_password(payload.new_password)
    await db.commit()
    return {"message": "Password updated successfully"}


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager")),
):
    result = await db.execute(
        select(User)
        .options(selectinload(User.department_links).selectinload(UserDepartment.department))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _to_user_out(user)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    result = await db.execute(
        select(User)
        .options(selectinload(User.department_links).selectinload(UserDepartment.department))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = payload.model_dump(exclude_none=True, exclude={"password", "department_ids"})
    for field, val in updates.items():
        setattr(user, field, val)
    if payload.password:
        password_error = validate_password_strength(payload.password)
        if password_error:
            raise HTTPException(status_code=400, detail=password_error)
        user.password_hash = hash_password(payload.password)

    if payload.department_ids is not None:
        department_ids = await validate_department_ids(db, payload.department_ids)
        await _replace_user_departments(db, user, department_ids, current_user.id)
    else:
        department_ids = [link.department_id for link in user.department_links]

    if payload.active_department_id is not None:
        user.active_department_id = payload.active_department_id

    _ensure_active_department_is_valid(user, department_ids)

    await log_activity(
        db,
        current_user.id,
        "user.update",
        resource_type="user",
        resource_id=user.id,
        resource_label=user.username,
    )
    await db.commit()
    refreshed = await db.execute(
        select(User)
        .options(selectinload(User.department_links).selectinload(UserDepartment.department))
        .where(User.id == user.id)
    )
    return _to_user_out(refreshed.scalar_one())


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    deal_count_result = await db.execute(
        select(func.count()).select_from(Deal).where(Deal.owner_id == user.id)
    )
    deal_count = int(deal_count_result.scalar_one() or 0)
    if deal_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete user with existing deals ({deal_count}). Deactivate instead.",
        )

    await db.delete(user)
    await log_activity(
        db,
        current_user.id,
        "user.delete",
        resource_type="user",
        resource_id=user.id,
        resource_label=user.username,
    )
    await db.commit()
    return {"message": "User deleted successfully"}
