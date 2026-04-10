from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role_permission import RolePermission
from app.models.user import User


PERMISSION_CATALOG: dict[str, str] = {
    "deals.view_all": "View all deals",
    "boqs.view_all": "View all BOQs",
    "quotations.view_all": "View all quotations",
    "quotation_intake.view_all": "View all quotation intake documents",
    "quotation_uploads.review_all": "Review all uploaded quotation PDFs",
    "projects.manage": "Create/update/delete projects",
    "customers.manage": "Create/update/delete customers and contacts",
    "products.manage": "Create/update/delete products and attachments",
    "menu.admin_access": "Access Admin menu group in frontend",
}


ROLE_DEFAULTS: dict[str, dict[str, bool]] = {
    "admin": {k: True for k in PERMISSION_CATALOG},
    "manager": {k: True for k in PERMISSION_CATALOG},
    "sales_admin": {
        "deals.view_all": True,
        "boqs.view_all": True,
        "quotations.view_all": True,
        "quotation_intake.view_all": False,
        "quotation_uploads.review_all": False,
        "projects.manage": True,
        "customers.manage": True,
        "products.manage": True,
        "menu.admin_access": False,
    },
    "sales": {
        "deals.view_all": False,
        "boqs.view_all": False,
        "quotations.view_all": False,
        "quotation_intake.view_all": False,
        "quotation_uploads.review_all": False,
        "projects.manage": False,
        "customers.manage": False,
        "products.manage": False,
        "menu.admin_access": False,
    },
    "sale_upload": {
        "deals.view_all": False,
        "boqs.view_all": False,
        "quotations.view_all": False,
        "quotation_intake.view_all": False,
        "quotation_uploads.review_all": False,
        "projects.manage": False,
        "customers.manage": False,
        "products.manage": False,
        "menu.admin_access": False,
    },
}

ROLE_DEFAULTS["admin"].update({
    "projects.manage": True,
    "customers.manage": True,
    "products.manage": True,
    "menu.admin_access": True,
})
ROLE_DEFAULTS["manager"].update({
    "projects.manage": True,
    "customers.manage": True,
    "products.manage": True,
    "menu.admin_access": True,
})


def get_default_permission(role: str, permission_key: str) -> bool:
    role_defaults = ROLE_DEFAULTS.get(role)
    if not role_defaults:
        return False
    return role_defaults.get(permission_key, False)


async def can_user(db: AsyncSession, user: User, permission_key: str) -> bool:
    if permission_key not in PERMISSION_CATALOG:
        return False

    result = await db.execute(
        select(RolePermission)
        .where(RolePermission.role == user.role, RolePermission.permission_key == permission_key)
        .limit(1)
    )
    override = result.scalar_one_or_none()
    if override is not None:
        return override.is_allowed

    return get_default_permission(user.role, permission_key)


async def get_effective_permissions(db: AsyncSession, role: str) -> dict[str, bool]:
    result = await db.execute(select(RolePermission).where(RolePermission.role == role))
    overrides = {row.permission_key: row.is_allowed for row in result.scalars().all()}
    return {k: overrides.get(k, get_default_permission(role, k)) for k in PERMISSION_CATALOG}


async def set_role_permissions(
    db: AsyncSession,
    role: str,
    permissions: dict[str, bool],
    updated_by: int,
) -> None:
    keys = set(PERMISSION_CATALOG.keys())
    invalid_keys = [k for k in permissions if k not in keys]
    if invalid_keys:
        raise ValueError(f"Unknown permission keys: {', '.join(sorted(invalid_keys))}")

    existing_result = await db.execute(select(RolePermission).where(RolePermission.role == role))
    existing = {row.permission_key: row for row in existing_result.scalars().all()}

    for key, allowed in permissions.items():
        if key in existing:
            existing[key].is_allowed = allowed
            existing[key].updated_by = updated_by
        else:
            db.add(
                RolePermission(
                    role=role,
                    permission_key=key,
                    is_allowed=allowed,
                    updated_by=updated_by,
                )
            )


def available_roles() -> list[str]:
    return sorted(ROLE_DEFAULTS.keys())


def validate_role(role: str) -> bool:
    return role in ROLE_DEFAULTS


def normalize_permission_payload(raw_permissions: Iterable[dict]) -> dict[str, bool]:
    normalized: dict[str, bool] = {}
    for item in raw_permissions:
        key = str(item.get("permission_key", "")).strip()
        if not key:
            continue
        normalized[key] = bool(item.get("is_allowed", False))
    return normalized
