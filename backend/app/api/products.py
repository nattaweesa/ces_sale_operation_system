from __future__ import annotations
from typing import Optional
import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.product import Product, ProductAttachment
from app.models.brand import Brand
from app.models.category import Category
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate, ProductOut, ProductAttachmentOut, ProductAttachmentUpdate
from app.services.auth import get_current_user
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/products", tags=["products"])

ALLOWED_ATTACHMENT_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}


def _build_product_out(product: Product) -> ProductOut:
    data = ProductOut.model_validate(product)
    data.brand_name = product.brand.name if product.brand else None
    data.category_name = product.category.name if product.category else None
    return data


@router.get("", response_model=list[ProductOut])
async def list_products(
    q: Optional[str] = Query(None),
    brand_id: Optional[int] = Query(None),
    category_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = (
        select(Product)
        .options(selectinload(Product.attachments), selectinload(Product.brand), selectinload(Product.category))
        .order_by(Product.item_code)
    )
    if q:
        stmt = stmt.where(
            or_(
                Product.item_code.ilike(f"%{q}%"),
                Product.description.ilike(f"%{q}%"),
            )
        )
    if brand_id:
        stmt = stmt.where(Product.brand_id == brand_id)
    if category_id:
        stmt = stmt.where(Product.category_id == category_id)
    if status:
        stmt = stmt.where(Product.status == status)

    result = await db.execute(stmt)
    products = result.scalars().all()
    return [_build_product_out(p) for p in products]


@router.post("", response_model=ProductOut, status_code=201)
async def create_product(payload: ProductCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    product = Product(**payload.model_dump())
    db.add(product)
    await db.commit()
    stmt = select(Product).options(selectinload(Product.attachments), selectinload(Product.brand), selectinload(Product.category)).where(Product.id == product.id)
    result = await db.execute(stmt)
    return _build_product_out(result.scalar_one())


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    stmt = select(Product).options(selectinload(Product.attachments), selectinload(Product.brand), selectinload(Product.category)).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _build_product_out(product)


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(product_id: int, payload: ProductUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    stmt = select(Product).options(selectinload(Product.attachments), selectinload(Product.brand), selectinload(Product.category)).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(product, field, val)
    await db.commit()
    await db.refresh(product)
    stmt2 = select(Product).options(selectinload(Product.attachments), selectinload(Product.brand), selectinload(Product.category)).where(Product.id == product_id)
    result2 = await db.execute(stmt2)
    return _build_product_out(result2.scalar_one())


@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    await db.commit()


# --- Attachments ---

@router.post("/{product_id}/attachments", response_model=ProductAttachmentOut, status_code=201)
async def upload_attachment(
    product_id: int,
    file: UploadFile = File(...),
    label: str = Form(None),
    sort_order: int = Form(0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_ATTACHMENT_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF and image files are allowed")

    result = await db.execute(select(Product).where(Product.id == product_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Product not found")

    ext = os.path.splitext(file.filename or "file")[1]
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest_dir = os.path.join(settings.storage_path, "attachments", str(product_id))
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, stored_name)

    async with aiofiles.open(dest_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    file_type = "pdf" if file.content_type == "application/pdf" else "image"
    attachment = ProductAttachment(
        product_id=product_id,
        file_name=file.filename,
        file_path=dest_path,
        file_type=file_type,
        label=label,
        sort_order=sort_order,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)
    return attachment


@router.get("/{product_id}/attachments", response_model=list[ProductAttachmentOut])
async def list_attachments(product_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(
        select(ProductAttachment).where(ProductAttachment.product_id == product_id).order_by(ProductAttachment.sort_order)
    )
    return result.scalars().all()


@router.get("/{product_id}/attachments/{att_id}/download")
async def download_attachment(product_id: int, att_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(
        select(ProductAttachment).where(ProductAttachment.id == att_id, ProductAttachment.product_id == product_id)
    )
    att = result.scalar_one_or_none()
    if not att or not os.path.exists(att.file_path):
        raise HTTPException(status_code=404, detail="Attachment not found")
    return FileResponse(att.file_path, filename=att.file_name)


@router.put("/{product_id}/attachments/{att_id}", response_model=ProductAttachmentOut)
async def update_attachment(
    product_id: int,
    att_id: int,
    payload: ProductAttachmentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ProductAttachment).where(ProductAttachment.id == att_id, ProductAttachment.product_id == product_id)
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(att, field, val)
    await db.commit()
    await db.refresh(att)
    return att


@router.delete("/{product_id}/attachments/{att_id}", status_code=204)
async def delete_attachment(product_id: int, att_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(
        select(ProductAttachment).where(ProductAttachment.id == att_id, ProductAttachment.product_id == product_id)
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if os.path.exists(att.file_path):
        os.remove(att.file_path)
    await db.delete(att)
    await db.commit()
