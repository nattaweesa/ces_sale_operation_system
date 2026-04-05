from __future__ import annotations
from typing import Optional
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.material_approval import MaterialApprovalPackage, MaterialApprovalItem
from app.models.quotation import Quotation
from app.models.product import ProductAttachment
from app.models.user import User
from app.schemas.material_approval import MaterialApprovalCreate, MaterialApprovalPackageOut, MaterialApprovalItemOut
from app.services.auth import get_current_user
from app.services.material_approval_service import generate_material_approval_pdf
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/quotations", tags=["material-approval"])


async def _load_package(pkg_id: int, db: AsyncSession) -> Optional[MaterialApprovalPackage]:
    stmt = (
        select(MaterialApprovalPackage)
        .options(
            selectinload(MaterialApprovalPackage.items)
            .selectinload(MaterialApprovalItem.product),
            selectinload(MaterialApprovalPackage.items)
            .selectinload(MaterialApprovalItem.attachment),
        )
        .where(MaterialApprovalPackage.id == pkg_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


def _enrich_item(item: MaterialApprovalItem) -> MaterialApprovalItemOut:
    out = MaterialApprovalItemOut.model_validate(item)
    if item.product:
        out.product_code = item.product.item_code
        out.product_description = item.product.description
    if item.attachment:
        out.attachment_label = item.attachment.label or item.attachment.file_name
    return out


@router.post("/{qt_id}/material-approval", response_model=MaterialApprovalPackageOut, status_code=201)
async def create_material_approval(
    qt_id: int,
    payload: MaterialApprovalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Quotation).where(Quotation.id == qt_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")

    package = MaterialApprovalPackage(
        quotation_id=qt_id,
        name=payload.name,
        created_by=current_user.id,
    )
    db.add(package)
    await db.flush()

    for i, item_in in enumerate(payload.items, start=1):
        item = MaterialApprovalItem(
            package_id=package.id,
            seq=i,
            product_id=item_in.product_id,
            attachment_id=item_in.attachment_id,
            custom_label=item_in.custom_label,
        )
        db.add(item)
    await db.flush()

    # Gather attachment data for PDF generation
    pkg = await _load_package(package.id, db)
    items_data = []
    for item in pkg.items:
        items_data.append({
            "seq": item.seq,
            "product_code": item.product.item_code if item.product else None,
            "product_description": item.product.description if item.product else None,
            "brand": item.product.brand.name if item.product and item.product.brand else None,
            "attachment_label": item.attachment.label or item.attachment.file_name if item.attachment else None,
            "file_path": item.attachment.file_path if item.attachment else None,
            "custom_label": item.custom_label,
        })

    pdf_path = await generate_material_approval_pdf(
        package_id=package.id,
        quotation_number=q.quotation_number,
        package_name=payload.name,
        items=items_data,
        settings=settings,
    )
    package.pdf_path = pdf_path
    await db.commit()

    pkg = await _load_package(package.id, db)
    out = MaterialApprovalPackageOut.model_validate(pkg)
    out.items = [_enrich_item(i) for i in pkg.items]
    return out


@router.get("/{qt_id}/material-approval", response_model=list[MaterialApprovalPackageOut])
async def list_material_approvals(qt_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    stmt = (
        select(MaterialApprovalPackage)
        .options(
            selectinload(MaterialApprovalPackage.items).selectinload(MaterialApprovalItem.product),
            selectinload(MaterialApprovalPackage.items).selectinload(MaterialApprovalItem.attachment),
        )
        .where(MaterialApprovalPackage.quotation_id == qt_id)
        .order_by(MaterialApprovalPackage.created_at.desc())
    )
    result = await db.execute(stmt)
    packages = result.scalars().all()
    out = []
    for pkg in packages:
        pkg_out = MaterialApprovalPackageOut.model_validate(pkg)
        pkg_out.items = [_enrich_item(i) for i in pkg.items]
        out.append(pkg_out)
    return out


@router.get("/{qt_id}/material-approval/{pkg_id}/pdf")
async def download_material_approval_pdf(qt_id: int, pkg_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(
        select(MaterialApprovalPackage).where(
            MaterialApprovalPackage.id == pkg_id,
            MaterialApprovalPackage.quotation_id == qt_id,
        )
    )
    pkg = result.scalar_one_or_none()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    if not pkg.pdf_path or not os.path.exists(pkg.pdf_path):
        raise HTTPException(status_code=404, detail="PDF not generated yet")
    return FileResponse(pkg.pdf_path, media_type="application/pdf", filename=f"material_approval_{pkg_id}.pdf")
