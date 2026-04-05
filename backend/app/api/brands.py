from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.brand import Brand
from app.models.user import User
from app.schemas.brand import BrandCreate, BrandUpdate, BrandOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/brands", tags=["brands"])


@router.get("", response_model=list[BrandOut])
async def list_brands(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Brand).order_by(Brand.name))
    return result.scalars().all()


@router.post("", response_model=BrandOut, status_code=201)
async def create_brand(payload: BrandCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    brand = Brand(name=payload.name)
    db.add(brand)
    await db.commit()
    await db.refresh(brand)
    return brand


@router.put("/{brand_id}", response_model=BrandOut)
async def update_brand(brand_id: int, payload: BrandUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    brand.name = payload.name
    await db.commit()
    await db.refresh(brand)
    return brand


@router.delete("/{brand_id}", status_code=204)
async def delete_brand(brand_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    await db.delete(brand)
    await db.commit()
