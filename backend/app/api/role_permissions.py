from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.role_permission import (
    PermissionCatalogItem,
    PermissionCatalogResponse,
    RolePermissionItem,
    RolePermissionResponse,
    RolePermissionUpdateRequest,
)
from app.services.auth import get_current_user, require_roles
from app.services.activity import log_activity
from app.services.rbac import (
    PERMISSION_CATALOG,
    available_roles,
    get_effective_permissions,
    normalize_permission_payload,
    set_role_permissions,
    validate_role,
)

router = APIRouter(prefix="/role-permissions", tags=["role-permissions"])


@router.get("/catalog", response_model=PermissionCatalogResponse)
async def get_permission_catalog(_: User = Depends(require_roles("admin"))):
    return PermissionCatalogResponse(
        roles=available_roles(),
        permissions=[
            PermissionCatalogItem(permission_key=key, label=label)
            for key, label in PERMISSION_CATALOG.items()
        ],
    )


@router.get("/me", response_model=RolePermissionResponse)
async def get_my_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    effective = await get_effective_permissions(db, current_user.role)
    return RolePermissionResponse(
        role=current_user.role,
        permissions=[
            RolePermissionItem(permission_key=key, is_allowed=allowed)
            for key, allowed in effective.items()
        ],
    )


@router.get("/{role}", response_model=RolePermissionResponse)
async def get_role_permissions(
    role: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    if not validate_role(role):
        raise HTTPException(status_code=404, detail="Role not found")

    effective = await get_effective_permissions(db, role)
    return RolePermissionResponse(
        role=role,
        permissions=[
            RolePermissionItem(permission_key=key, is_allowed=allowed)
            for key, allowed in effective.items()
        ],
    )


@router.put("/{role}", response_model=RolePermissionResponse)
async def update_role_permissions(
    role: str,
    payload: RolePermissionUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    if not validate_role(role):
        raise HTTPException(status_code=404, detail="Role not found")

    normalized = normalize_permission_payload([item.model_dump() for item in payload.permissions])
    try:
        await set_role_permissions(db, role, normalized, updated_by=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await log_activity(
        db,
        current_user.id,
        "role_permissions.update",
        resource_type="role",
        resource_label=role,
    )
    await db.commit()
    effective = await get_effective_permissions(db, role)
    return RolePermissionResponse(
        role=role,
        permissions=[
            RolePermissionItem(permission_key=key, is_allowed=allowed)
            for key, allowed in effective.items()
        ],
    )
