from __future__ import annotations
from typing import Optional
import json
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.quotation import Quotation, QuotationSection, QuotationLine, QuotationRevision
from app.models.project import Project
from app.models.customer import Customer, Contact
from app.models.user import User
from app.models.product import Product
from app.models.boq import BOQ, BOQItem
from app.schemas.quotation import (
    QuotationCreate, QuotationUpdate, QuotationOut, QuotationListOut,
    QuotationSectionCreate, QuotationSectionUpdate, QuotationSectionOut,
    QuotationLineCreate, QuotationLineUpdate, QuotationLineOut,
    QuotationRevisionOut,
)
from app.services.auth import get_current_user
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/quotations", tags=["quotations"])


async def _load_quotation(qid: int, db: AsyncSession) -> Quotation:
    stmt = (
        select(Quotation)
        .options(
            selectinload(Quotation.project).selectinload(Project.customer),
            selectinload(Quotation.contact),
            selectinload(Quotation.sales_owner),
            selectinload(Quotation.sections),
            selectinload(Quotation.lines),
            selectinload(Quotation.revisions),
        )
        .where(Quotation.id == qid)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


def _enrich_quotation(q: Quotation) -> QuotationOut:
    out = QuotationOut.model_validate(q)
    if q.project:
        out.project_name = q.project.name
        if q.project.customer:
            out.customer_name = q.project.customer.name
    out.contact_name = q.contact.full_name if q.contact else None
    out.sales_owner_name = q.sales_owner.full_name if q.sales_owner else None
    return out


async def _generate_qt_number(db: AsyncSession) -> str:
    year = datetime.now().year
    result = await db.execute(
        select(func.count()).select_from(Quotation).where(
            Quotation.quotation_number.like(f"{settings.qt_number_prefix}-{year}-%")
        )
    )
    count = result.scalar() or 0
    return f"{settings.qt_number_prefix}-{year}-{str(count + 1).zfill(4)}"


def _recalculate(q: Quotation) -> None:
    subtotal = sum(
        (line.amount for line in q.lines if not line.is_optional),
        Decimal("0"),
    )
    vat_amount = (subtotal * q.vat_rate / Decimal("100")).quantize(Decimal("0.01"))
    q.subtotal = subtotal
    q.vat_amount = vat_amount
    q.grand_total = subtotal + vat_amount


def _build_snapshot(q: Quotation) -> dict:
    return {
        "quotation_number": q.quotation_number,
        "subject": q.subject,
        "status": q.status,
        "revision": q.current_revision,
        "project": {"id": q.project_id, "name": q.project.name if q.project else None},
        "customer": {"name": q.project.customer.name if q.project and q.project.customer else None},
        "contact": {"full_name": q.contact.full_name if q.contact else None, "email": getattr(q.contact, "email", None)},
        "sales_owner": {"full_name": q.sales_owner.full_name if q.sales_owner else None},
        "subtotal": str(q.subtotal),
        "vat_rate": str(q.vat_rate),
        "vat_amount": str(q.vat_amount),
        "grand_total": str(q.grand_total),
        "delivery_terms": q.delivery_terms,
        "validity_days": q.validity_days,
        "validity_text": q.validity_text,
        "payment_terms": q.payment_terms,
        "scope_of_work": q.scope_of_work,
        "warranty_text": q.warranty_text,
        "exclusions": q.exclusions,
        "sections": [{"id": s.id, "label": s.label, "sort_order": s.sort_order} for s in q.sections],
        "lines": [
            {
                "seq": ln.seq,
                "section_id": ln.section_id,
                "item_code": ln.item_code,
                "description": ln.description,
                "brand": ln.brand,
                "list_price": str(ln.list_price),
                "discount_pct": str(ln.discount_pct),
                "net_price": str(ln.net_price),
                "quantity": str(ln.quantity),
                "unit": ln.unit,
                "amount": str(ln.amount),
                "remark": ln.remark,
                "is_optional": ln.is_optional,
            }
            for ln in sorted(q.lines, key=lambda l: l.seq)
        ],
        "issued_at": datetime.now(timezone.utc).isoformat(),
    }


# ────────────────────────────────────────────
# Quotation CRUD
# ────────────────────────────────────────────

@router.get("", response_model=list[QuotationListOut])
async def list_quotations(
    project_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = (
        select(Quotation)
        .options(
            selectinload(Quotation.project).selectinload(Project.customer),
        )
        .order_by(Quotation.created_at.desc())
    )
    if project_id:
        stmt = stmt.where(Quotation.project_id == project_id)
    if status:
        stmt = stmt.where(Quotation.status == status)
    result = await db.execute(stmt)
    quotations = result.scalars().all()

    out = []
    for q in quotations:
        out.append(QuotationListOut(
            id=q.id,
            quotation_number=q.quotation_number,
            project_id=q.project_id,
            project_name=q.project.name if q.project else None,
            customer_name=q.project.customer.name if q.project and q.project.customer else None,
            subject=q.subject,
            status=q.status,
            current_revision=q.current_revision,
            grand_total=q.grand_total,
            created_at=q.created_at,
            updated_at=q.updated_at,
        ))
    return out


@router.post("", response_model=QuotationOut, status_code=201)
async def create_quotation(
    payload: QuotationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    qt_number = await _generate_qt_number(db)
    q = Quotation(
        quotation_number=qt_number,
        sales_owner_id=payload.sales_owner_id or current_user.id,
        **payload.model_dump(exclude={"sales_owner_id"}),
    )
    if payload.sales_owner_id:
        q.sales_owner_id = payload.sales_owner_id
    db.add(q)
    await db.flush()

    # If created from BOQ, pre-populate lines
    if payload.boq_id:
        boq_stmt = select(BOQ).options(selectinload(BOQ.items).selectinload(BOQItem.product)).where(BOQ.id == payload.boq_id)
        boq_result = await db.execute(boq_stmt)
        boq = boq_result.scalar_one_or_none()
        if boq:
            sections_map: dict[str, QuotationSection] = {}
            seq = 1
            for item in sorted(boq.items, key=lambda i: i.seq):
                if item.section_label and item.section_label not in sections_map:
                    section = QuotationSection(quotation_id=q.id, label=item.section_label, sort_order=len(sections_map))
                    db.add(section)
                    await db.flush()
                    sections_map[item.section_label] = section

                section_id = sections_map[item.section_label].id if item.section_label else None
                product = item.product

                list_price = product.list_price if product else Decimal("0")
                line = QuotationLine(
                    quotation_id=q.id,
                    section_id=section_id,
                    seq=seq,
                    product_id=product.id if product else None,
                    item_code=product.item_code if product else None,
                    description=product.description if product else item.description,
                    brand=product.brand.name if product and product.brand else None,
                    list_price=list_price,
                    discount_pct=Decimal("0"),
                    net_price=list_price,
                    quantity=item.quantity,
                    unit=item.unit,
                    amount=list_price * item.quantity,
                )
                db.add(line)
                seq += 1

    await db.commit()
    loaded = await _load_quotation(q.id, db)
    _recalculate(loaded)
    await db.commit()
    loaded = await _load_quotation(q.id, db)
    return _enrich_quotation(loaded)


@router.get("/{qt_id}", response_model=QuotationOut)
async def get_quotation(qt_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    q = await _load_quotation(qt_id, db)
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return _enrich_quotation(q)


@router.put("/{qt_id}", response_model=QuotationOut)
async def update_quotation(qt_id: int, payload: QuotationUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    q = await _load_quotation(qt_id, db)
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if q.status not in ("draft",):
        raise HTTPException(status_code=400, detail="Only draft quotations can be edited")

    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(q, field, val)
    await db.commit()
    q = await _load_quotation(qt_id, db)
    return _enrich_quotation(q)


# ────────────────────────────────────────────
# Sections
# ────────────────────────────────────────────

@router.post("/{qt_id}/sections", response_model=QuotationSectionOut, status_code=201)
async def add_section(qt_id: int, payload: QuotationSectionCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Quotation).where(Quotation.id == qt_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Quotation not found")
    section = QuotationSection(quotation_id=qt_id, **payload.model_dump())
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return section


@router.put("/{qt_id}/sections/{sid}", response_model=QuotationSectionOut)
async def update_section(qt_id: int, sid: int, payload: QuotationSectionUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(QuotationSection).where(QuotationSection.id == sid, QuotationSection.quotation_id == qt_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    for f, v in payload.model_dump(exclude_none=True).items():
        setattr(section, f, v)
    await db.commit()
    await db.refresh(section)
    return section


@router.delete("/{qt_id}/sections/{sid}", status_code=204)
async def delete_section(qt_id: int, sid: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(QuotationSection).where(QuotationSection.id == sid, QuotationSection.quotation_id == qt_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    await db.delete(section)
    await db.commit()


# ────────────────────────────────────────────
# Lines
# ────────────────────────────────────────────

@router.post("/{qt_id}/lines", response_model=QuotationLineOut, status_code=201)
async def add_line(qt_id: int, payload: QuotationLineCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Quotation).where(Quotation.id == qt_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")

    # Compute net_price and amount
    data = payload.model_dump()
    list_price = Decimal(str(data["list_price"]))
    discount_pct = Decimal(str(data["discount_pct"]))
    quantity = Decimal(str(data["quantity"]))
    net_price = list_price * (1 - discount_pct / Decimal("100"))
    data["net_price"] = net_price.quantize(Decimal("0.01"))
    data["amount"] = (net_price * quantity).quantize(Decimal("0.01"))

    # Snapshot product fields if product_id provided
    if payload.product_id:
        p_result = await db.execute(
            select(Product).options(selectinload(Product.brand)).where(Product.id == payload.product_id)
        )
        product = p_result.scalar_one_or_none()
        if product:
            if not data.get("item_code"):
                data["item_code"] = product.item_code
            if not data.get("brand"):
                data["brand"] = product.brand.name if product.brand else None
            if data["list_price"] == 0:
                data["list_price"] = product.list_price
                data["net_price"] = product.list_price * (1 - discount_pct / Decimal("100"))
                data["amount"] = data["net_price"] * quantity

    line = QuotationLine(quotation_id=qt_id, **data)
    db.add(line)
    await db.flush()

    # Recalculate totals
    loaded = await _load_quotation(qt_id, db)
    _recalculate(loaded)
    await db.commit()
    await db.refresh(line)
    return line


@router.put("/{qt_id}/lines/{lid}", response_model=QuotationLineOut)
async def update_line(qt_id: int, lid: int, payload: QuotationLineUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(QuotationLine).where(QuotationLine.id == lid, QuotationLine.quotation_id == qt_id))
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Line not found")

    data = payload.model_dump(exclude_none=True)
    for f, v in data.items():
        setattr(line, f, v)

    list_price = Decimal(str(line.list_price))
    discount_pct = Decimal(str(line.discount_pct))
    quantity = Decimal(str(line.quantity))
    line.net_price = (list_price * (1 - discount_pct / Decimal("100"))).quantize(Decimal("0.01"))
    line.amount = (line.net_price * quantity).quantize(Decimal("0.01"))

    loaded = await _load_quotation(qt_id, db)
    _recalculate(loaded)
    await db.commit()
    await db.refresh(line)
    return line


@router.delete("/{qt_id}/lines/{lid}", status_code=204)
async def delete_line(qt_id: int, lid: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(QuotationLine).where(QuotationLine.id == lid, QuotationLine.quotation_id == qt_id))
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Line not found")
    await db.delete(line)
    await db.flush()
    loaded = await _load_quotation(qt_id, db)
    _recalculate(loaded)
    await db.commit()


# ────────────────────────────────────────────
# Issue (creates immutable revision + PDF)
# ────────────────────────────────────────────

@router.post("/{qt_id}/issue", response_model=QuotationRevisionOut)
async def issue_quotation(
    qt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.pdf_service import generate_quotation_pdf

    q = await _load_quotation(qt_id, db)
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")

    snapshot = _build_snapshot(q)
    rev_number = q.current_revision + 1
    revision = QuotationRevision(
        quotation_id=qt_id,
        revision_number=rev_number,
        issued_by=current_user.id,
        snapshot_json=snapshot,
    )
    db.add(revision)
    q.current_revision = rev_number
    q.status = "issued"
    await db.flush()

    # Generate PDF
    pdf_path = await generate_quotation_pdf(snapshot, qt_id, rev_number, settings)
    revision.pdf_path = pdf_path

    await db.commit()
    await db.refresh(revision)
    return revision


@router.get("/{qt_id}/revisions", response_model=list[QuotationRevisionOut])
async def list_revisions(qt_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(
        select(QuotationRevision).where(QuotationRevision.quotation_id == qt_id).order_by(QuotationRevision.revision_number)
    )
    return result.scalars().all()


@router.get("/{qt_id}/revisions/{rev}/pdf")
async def download_revision_pdf(qt_id: int, rev: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    import os
    result = await db.execute(
        select(QuotationRevision).where(QuotationRevision.quotation_id == qt_id, QuotationRevision.revision_number == rev)
    )
    revision = result.scalar_one_or_none()
    if not revision:
        raise HTTPException(status_code=404, detail="Revision not found")
    if not revision.pdf_path or not os.path.exists(revision.pdf_path):
        raise HTTPException(status_code=404, detail="PDF not found")
    return FileResponse(revision.pdf_path, media_type="application/pdf", filename=f"quotation_rev{rev}.pdf")
