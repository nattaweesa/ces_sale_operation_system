from __future__ import annotations

import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.customer import Customer
from app.models.deal_master import (
    DealCompany,
    DealCustomerType,
    DealProductSystemType,
    DealProjectStatusOption,
)
from app.models.user import User
from app.schemas.deal_master_data import (
    DealCompanyCreate,
    DealCompanyOut,
    DealCompanyUpdate,
    DealCustomerTypeCreate,
    DealCustomerTypeOut,
    DealCustomerTypeUpdate,
    DealMasterDataBundleOut,
    DealProductSystemTypeCreate,
    DealProductSystemTypeOut,
    DealProductSystemTypeUpdate,
    DealProjectStatusOptionCreate,
    DealProjectStatusOptionOut,
    DealProjectStatusOptionUpdate,
)
from app.services.auth import get_current_user, require_roles

router = APIRouter(prefix="/deal-master-data", tags=["deal-master-data"])

MASTER_DATA_ADMIN_ROLES = {"admin", "manager"}
DEAL_EDITOR_ROLES = {"admin", "manager", "sales_admin", "sales"}


def _normalize_name(value: str) -> str:
    normalized = re.sub(r"\s+", " ", str(value or "").strip())
    if not normalized:
        raise HTTPException(status_code=400, detail="Value cannot be empty")
    return normalized


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    slug = re.sub(r"_+", "_", slug)
    if not slug:
        raise HTTPException(status_code=400, detail="Unable to generate a valid key")
    return slug


def _ensure_deal_editor(current_user: User) -> None:
    if current_user.role not in DEAL_EDITOR_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def _to_company_out(row: DealCompany) -> DealCompanyOut:
    out = DealCompanyOut.model_validate(row)
    out.customer_name = row.customer.name if row.customer else None
    out.customer_type_name = row.customer_type.name if row.customer_type else None
    return out


async def _list_customer_types(db: AsyncSession, active_only: bool) -> list[DealCustomerType]:
    stmt = select(DealCustomerType).order_by(DealCustomerType.sort_order.asc(), DealCustomerType.name.asc())
    if active_only:
        stmt = stmt.where(DealCustomerType.is_active == True)
    result = await db.execute(stmt)
    return result.scalars().all()


async def _list_companies(db: AsyncSession, active_only: bool) -> list[DealCompany]:
    stmt = (
        select(DealCompany)
        .options(selectinload(DealCompany.customer_type), selectinload(DealCompany.customer))
        .order_by(DealCompany.sort_order.asc(), DealCompany.name.asc())
    )
    if active_only:
        stmt = stmt.where(DealCompany.is_active == True)
    result = await db.execute(stmt)
    return result.scalars().all()


async def _list_product_system_types(db: AsyncSession, active_only: bool) -> list[DealProductSystemType]:
    stmt = select(DealProductSystemType).order_by(DealProductSystemType.sort_order.asc(), DealProductSystemType.name.asc())
    if active_only:
        stmt = stmt.where(DealProductSystemType.is_active == True)
    result = await db.execute(stmt)
    return result.scalars().all()


async def _list_project_statuses(db: AsyncSession, active_only: bool) -> list[DealProjectStatusOption]:
    stmt = select(DealProjectStatusOption).order_by(DealProjectStatusOption.sort_order.asc(), DealProjectStatusOption.label.asc())
    if active_only:
        stmt = stmt.where(DealProjectStatusOption.is_active == True)
    result = await db.execute(stmt)
    return result.scalars().all()


async def _get_customer_type_or_404(customer_type_id: int, db: AsyncSession) -> DealCustomerType:
    result = await db.execute(select(DealCustomerType).where(DealCustomerType.id == customer_type_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Customer type not found")
    return row


async def _get_company_or_404(company_id: int, db: AsyncSession) -> DealCompany:
    result = await db.execute(
        select(DealCompany)
        .options(selectinload(DealCompany.customer_type), selectinload(DealCompany.customer))
        .where(DealCompany.id == company_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Company not found")
    return row


async def _get_product_system_type_or_404(product_system_type_id: int, db: AsyncSession) -> DealProductSystemType:
    result = await db.execute(select(DealProductSystemType).where(DealProductSystemType.id == product_system_type_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Product/System Type not found")
    return row


async def _get_project_status_or_404(project_status_id: int, db: AsyncSession) -> DealProjectStatusOption:
    result = await db.execute(select(DealProjectStatusOption).where(DealProjectStatusOption.id == project_status_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Project status not found")
    return row


async def _resolve_customer_for_company(name: str, customer_id: Optional[int], db: AsyncSession) -> Customer:
    company_name = _normalize_name(name)

    if customer_id is not None:
        customer_result = await db.execute(select(Customer).where(Customer.id == customer_id))
        customer = customer_result.scalar_one_or_none()
        if not customer:
            raise HTTPException(status_code=404, detail="Linked customer not found")
        customer.name = company_name
        return customer

    existing_result = await db.execute(select(Customer).where(func.lower(Customer.name) == company_name.lower()).limit(1))
    customer = existing_result.scalar_one_or_none()
    if customer:
        customer.name = company_name
        customer.is_active = True
        return customer

    customer = Customer(name=company_name, is_active=True)
    db.add(customer)
    await db.flush()
    return customer


async def _get_bundle(db: AsyncSession, active_only: bool) -> DealMasterDataBundleOut:
    customer_types = await _list_customer_types(db, active_only)
    companies = await _list_companies(db, active_only)
    product_system_types = await _list_product_system_types(db, active_only)
    project_statuses = await _list_project_statuses(db, active_only)

    return DealMasterDataBundleOut(
        customer_types=[DealCustomerTypeOut.model_validate(row) for row in customer_types],
        companies=[_to_company_out(row) for row in companies],
        product_system_types=[DealProductSystemTypeOut.model_validate(row) for row in product_system_types],
        project_statuses=[DealProjectStatusOptionOut.model_validate(row) for row in project_statuses],
    )


@router.get("/options", response_model=DealMasterDataBundleOut)
async def get_active_options(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await _get_bundle(db, active_only=True)


@router.get("/overview", response_model=DealMasterDataBundleOut)
async def get_overview(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager")),
):
    return await _get_bundle(db, active_only=False)


@router.post("/customer-types", response_model=DealCustomerTypeOut, status_code=201)
async def create_customer_type(
    payload: DealCustomerTypeCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager")),
):
    row = DealCustomerType(
        name=_normalize_name(payload.name),
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return DealCustomerTypeOut.model_validate(row)


@router.put("/customer-types/{customer_type_id}", response_model=DealCustomerTypeOut)
async def update_customer_type(
    customer_type_id: int,
    payload: DealCustomerTypeUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager")),
):
    row = await _get_customer_type_or_404(customer_type_id, db)
    updates = payload.model_dump(exclude_none=True)
    if "name" in updates:
        updates["name"] = _normalize_name(updates["name"])
    for field, value in updates.items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return DealCustomerTypeOut.model_validate(row)


@router.post("/companies", response_model=DealCompanyOut, status_code=201)
async def create_company(
    payload: DealCompanyCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager")),
):
    await _get_customer_type_or_404(payload.customer_type_id, db)
    customer = await _resolve_customer_for_company(payload.name, payload.customer_id, db)
    row = DealCompany(
        customer_type_id=payload.customer_type_id,
        customer_id=customer.id,
        name=_normalize_name(payload.name),
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    db.add(row)
    await db.commit()
    return _to_company_out(await _get_company_or_404(row.id, db))


@router.put("/companies/{company_id}", response_model=DealCompanyOut)
async def update_company(
    company_id: int,
    payload: DealCompanyUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager")),
):
    row = await _get_company_or_404(company_id, db)
    updates = payload.model_dump(exclude_none=True)
    company_name = _normalize_name(updates.get("name", row.name))

    if "customer_type_id" in updates:
        await _get_customer_type_or_404(int(updates["customer_type_id"]), db)

    customer = await _resolve_customer_for_company(company_name, updates.get("customer_id", row.customer_id), db)
    row.customer_id = customer.id
    row.name = company_name

    for field in ("customer_type_id", "sort_order", "is_active"):
        if field in updates:
            setattr(row, field, updates[field])

    await db.commit()
    return _to_company_out(await _get_company_or_404(row.id, db))


@router.post("/quick-add/company", response_model=DealCompanyOut, status_code=201)
async def quick_add_company(
    payload: DealCompanyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_deal_editor(current_user)
    await _get_customer_type_or_404(payload.customer_type_id, db)
    customer = await _resolve_customer_for_company(payload.name, payload.customer_id, db)
    row = DealCompany(
        customer_type_id=payload.customer_type_id,
        customer_id=customer.id,
        name=_normalize_name(payload.name),
        sort_order=payload.sort_order,
        is_active=True,
    )
    db.add(row)
    await db.commit()
    return _to_company_out(await _get_company_or_404(row.id, db))


@router.post("/product-system-types", response_model=DealProductSystemTypeOut, status_code=201)
async def create_product_system_type(
    payload: DealProductSystemTypeCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager")),
):
    row = DealProductSystemType(
        name=_normalize_name(payload.name),
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return DealProductSystemTypeOut.model_validate(row)


@router.put("/product-system-types/{product_system_type_id}", response_model=DealProductSystemTypeOut)
async def update_product_system_type(
    product_system_type_id: int,
    payload: DealProductSystemTypeUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager")),
):
    row = await _get_product_system_type_or_404(product_system_type_id, db)
    updates = payload.model_dump(exclude_none=True)
    if "name" in updates:
        updates["name"] = _normalize_name(updates["name"])
    for field, value in updates.items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return DealProductSystemTypeOut.model_validate(row)


@router.post("/quick-add/product-system-type", response_model=DealProductSystemTypeOut, status_code=201)
async def quick_add_product_system_type(
    payload: DealProductSystemTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_deal_editor(current_user)
    row = DealProductSystemType(
        name=_normalize_name(payload.name),
        sort_order=payload.sort_order,
        is_active=True,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return DealProductSystemTypeOut.model_validate(row)


@router.post("/project-statuses", response_model=DealProjectStatusOptionOut, status_code=201)
async def create_project_status(
    payload: DealProjectStatusOptionCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager")),
):
    label = _normalize_name(payload.label)
    key = _slugify(payload.key or label)
    row = DealProjectStatusOption(
        key=key,
        label=label,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return DealProjectStatusOptionOut.model_validate(row)


@router.put("/project-statuses/{project_status_id}", response_model=DealProjectStatusOptionOut)
async def update_project_status(
    project_status_id: int,
    payload: DealProjectStatusOptionUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager")),
):
    row = await _get_project_status_or_404(project_status_id, db)
    updates = payload.model_dump(exclude_none=True)
    if "label" in updates:
        updates["label"] = _normalize_name(updates["label"])
    if "key" in updates:
        updates["key"] = _slugify(updates["key"])
    for field, value in updates.items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return DealProjectStatusOptionOut.model_validate(row)
