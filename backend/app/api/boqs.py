from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import openpyxl

from app.database import get_db
from app.models.boq import BOQ, BOQItem
from app.models.product import Product
from app.models.user import User
from app.schemas.boq import BOQCreate, BOQOut, BOQItemCreate, BOQItemUpdate, BOQItemOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/boqs", tags=["boqs"])


def _enrich_item(item: BOQItem) -> BOQItemOut:
    out = BOQItemOut.model_validate(item)
    if item.product:
        out.product_code = item.product.item_code
        out.product_description = item.product.description
    return out


@router.post("", response_model=BOQOut, status_code=201)
async def create_boq(payload: BOQCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    boq = BOQ(project_id=payload.project_id, name=payload.name)
    db.add(boq)
    await db.commit()
    stmt = select(BOQ).options(selectinload(BOQ.items).selectinload(BOQItem.product)).where(BOQ.id == boq.id)
    result = await db.execute(stmt)
    return result.scalar_one()


@router.get("/{boq_id}", response_model=BOQOut)
async def get_boq(boq_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    stmt = select(BOQ).options(selectinload(BOQ.items).selectinload(BOQItem.product)).where(BOQ.id == boq_id)
    result = await db.execute(stmt)
    boq = result.scalar_one_or_none()
    if not boq:
        raise HTTPException(status_code=404, detail="BOQ not found")
    return boq


@router.post("/{boq_id}/items", response_model=BOQItemOut, status_code=201)
async def add_boq_item(boq_id: int, payload: BOQItemCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(BOQ).where(BOQ.id == boq_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="BOQ not found")

    item = BOQItem(boq_id=boq_id, **payload.model_dump())
    if payload.product_id:
        item.mapped_at = datetime.now(timezone.utc)
    db.add(item)
    await db.commit()
    stmt = select(BOQItem).options(selectinload(BOQItem.product)).where(BOQItem.id == item.id)
    result2 = await db.execute(stmt)
    return _enrich_item(result2.scalar_one())


@router.put("/{boq_id}/items/{item_id}", response_model=BOQItemOut)
async def update_boq_item(boq_id: int, item_id: int, payload: BOQItemUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    stmt = select(BOQItem).options(selectinload(BOQItem.product)).where(BOQItem.id == item_id, BOQItem.boq_id == boq_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="BOQ item not found")

    prev_product_id = item.product_id
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(item, field, val)
    if payload.product_id and payload.product_id != prev_product_id:
        item.mapped_at = datetime.now(timezone.utc)
    await db.commit()
    stmt2 = select(BOQItem).options(selectinload(BOQItem.product)).where(BOQItem.id == item_id)
    result2 = await db.execute(stmt2)
    return _enrich_item(result2.scalar_one())


@router.delete("/{boq_id}/items/{item_id}", status_code=204)
async def delete_boq_item(boq_id: int, item_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(BOQItem).where(BOQItem.id == item_id, BOQItem.boq_id == boq_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="BOQ item not found")
    await db.delete(item)
    await db.commit()


@router.post("/{boq_id}/import", response_model=BOQOut)
async def import_boq_from_excel(
    boq_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Import BOQ items from Excel. Expected columns: seq, description, quantity, unit, section_label"""
    result = await db.execute(select(BOQ).where(BOQ.id == boq_id))
    boq = result.scalar_one_or_none()
    if not boq:
        raise HTTPException(status_code=404, detail="BOQ not found")

    content = await file.read()
    import io
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise HTTPException(status_code=400, detail="Empty spreadsheet")

    # Auto-detect header row
    header_row = [str(c).strip().lower() if c else "" for c in rows[0]]
    col_map = {}
    for i, h in enumerate(header_row):
        if "seq" in h or "no" in h or "#" in h:
            col_map.setdefault("seq", i)
        elif "desc" in h:
            col_map["description"] = i
        elif "qty" in h or "quantity" in h:
            col_map["quantity"] = i
        elif "unit" in h:
            col_map["unit"] = i
        elif "section" in h or "area" in h or "zone" in h:
            col_map["section_label"] = i

    if "description" not in col_map:
        raise HTTPException(status_code=400, detail="Could not find 'description' column in spreadsheet")

    seq = 1
    for row in rows[1:]:
        desc = row[col_map["description"]] if "description" in col_map else None
        if not desc:
            continue
        item = BOQItem(
            boq_id=boq_id,
            seq=int(row[col_map["seq"]]) if "seq" in col_map and row[col_map["seq"]] else seq,
            description=str(desc),
            quantity=float(row[col_map["quantity"]]) if "quantity" in col_map and row[col_map["quantity"]] else 1,
            unit=str(row[col_map["unit"]]) if "unit" in col_map and row[col_map["unit"]] else None,
            section_label=str(row[col_map["section_label"]]) if "section_label" in col_map and row[col_map["section_label"]] else None,
        )
        db.add(item)
        seq += 1

    boq.source = "excel_import"
    await db.commit()

    stmt = select(BOQ).options(selectinload(BOQ.items).selectinload(BOQItem.product)).where(BOQ.id == boq_id)
    r = await db.execute(stmt)
    return r.scalar_one()
