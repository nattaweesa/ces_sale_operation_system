from __future__ import annotations

from pydantic import BaseModel


class PermissionCatalogItem(BaseModel):
    permission_key: str
    label: str


class RolePermissionItem(BaseModel):
    permission_key: str
    is_allowed: bool


class RolePermissionResponse(BaseModel):
    role: str
    permissions: list[RolePermissionItem]


class RolePermissionUpdateRequest(BaseModel):
    permissions: list[RolePermissionItem]


class PermissionCatalogResponse(BaseModel):
    roles: list[str]
    permissions: list[PermissionCatalogItem]
