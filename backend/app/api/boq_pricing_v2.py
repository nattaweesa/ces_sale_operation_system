from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Union

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.boq import BOQ, BOQItem
from app.models.boq_pricing_v2 import (
    BOQRevisionItemV2,
    BOQRevisionV2,
    PricingLineV2,
    PricingSessionV2,
    QuotationSnapshotV2,
    QuotationV2,
)
from app.models.product import Product
from app.models.user import User
from app.schemas.boq_pricing_v2 import (
    BOQRevisionV2Out,
    PricingLineV2Out,
    PricingLineV2Update,
    PricingSessionV2Create,
    PricingSessionV2Out,
    PricingTotalsV2,
    QuotationSnapshotV2Out,
    QuotationV2Out,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/v2", tags=["boq-pricing-v2"])


def _to_decimal(value: Union[Decimal, int, float, str]) -> Decimal:
    return Decimal(str(value))


def _calc_line(line: PricingLineV2) -> None:
    list_price = _to_decimal(line.list_price)
    discount_pct = _to_decimal(line.discount_pct)
    quantity = _to_decimal(line.quantity)
    net = (list_price * (Decimal("1") - discount_pct / Decimal("100"))).quantize(Decimal("0.01"))
    amount = (net * quantity).quantize(Decimal("0.01"))
    line.net_price = net
    line.amount = amount


def _pricing_totals(session: PricingSessionV2) -> PricingTotalsV2:
    subtotal = sum((_to_decimal(line.amount) for line in session.lines), Decimal("0")).quantize(Decimal("0.01"))
    vat_rate = _to_decimal(session.vat_rate)
    vat_amount = (subtotal * vat_rate / Decimal("100")).quantize(Decimal("0.01"))
    grand_total = (subtotal + vat_amount).quantize(Decimal("0.01"))
    return PricingTotalsV2(subtotal=subtotal, vat_rate=vat_rate, vat_amount=vat_amount, grand_total=grand_total)


def _serialize_boq_for_hash(boq_items: list[BOQItem]) -> str:
    payload = [
        {
            "id": item.id,
            "seq": item.seq,
            "description": item.description,
            "quantity": str(item.quantity),
            "unit": item.unit,
            "section_label": item.section_label,
            "product_id": item.product_id,
        }
        for item in sorted(boq_items, key=lambda value: value.seq)
    ]
    content = json.dumps(payload, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


async def _load_pricing_session(db: AsyncSession, session_id: int) -> Optional[PricingSessionV2]:
    result = await db.execute(
        select(PricingSessionV2)
        .options(selectinload(PricingSessionV2.lines))
        .where(PricingSessionV2.id == session_id)
    )
    return result.scalar_one_or_none()


async def _load_quotation_v2(db: AsyncSession, quotation_id: int) -> Optional[QuotationV2]:
    result = await db.execute(
        select(QuotationV2)
        .options(selectinload(QuotationV2.snapshots))
        .where(QuotationV2.id == quotation_id)
    )
    return result.scalar_one_or_none()


@router.post("/boq-revisions/from-boq/{boq_id}", response_model=BOQRevisionV2Out, status_code=201)
async def create_boq_revision_from_boq(
    boq_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    boq_result = await db.execute(select(BOQ).options(selectinload(BOQ.items)).where(BOQ.id == boq_id))
    boq = boq_result.scalar_one_or_none()
    if not boq:
        raise HTTPException(status_code=404, detail="BOQ not found")
    if not boq.items:
        raise HTTPException(status_code=400, detail="BOQ has no items")

    max_rev_result = await db.execute(
        select(func.coalesce(func.max(BOQRevisionV2.revision_no), 0)).where(BOQRevisionV2.boq_id == boq_id)
    )
    next_revision_no = int(max_rev_result.scalar_one()) + 1
    source_hash = _serialize_boq_for_hash(list(boq.items))

    revision = BOQRevisionV2(
        boq_id=boq.id,
        project_id=boq.project_id,
        revision_no=next_revision_no,
        source_hash=source_hash,
        status="draft",
        created_by=current_user.id,
    )
    db.add(revision)
    await db.flush()

    for item in sorted(boq.items, key=lambda value: value.seq):
        db.add(
            BOQRevisionItemV2(
                boq_revision_id=revision.id,
                boq_item_id=item.id,
                seq=item.seq,
                section_label=item.section_label,
                description=item.description,
                quantity=item.quantity,
                unit=item.unit,
                product_id=item.product_id,
                source_payload={
                    "boq_item_id": item.id,
                    "mapped_at": item.mapped_at.isoformat() if item.mapped_at else None,
                },
            )
        )

    await db.commit()

    loaded_result = await db.execute(
        select(BOQRevisionV2)
        .options(selectinload(BOQRevisionV2.items))
        .where(BOQRevisionV2.id == revision.id)
    )
    return loaded_result.scalar_one()


@router.get("/boq-revisions", response_model=list[BOQRevisionV2Out])
async def list_boq_revisions(
    boq_id: Optional[int] = None,
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = (
        select(BOQRevisionV2)
        .options(selectinload(BOQRevisionV2.items))
        .order_by(BOQRevisionV2.id.desc())
    )
    if boq_id is not None:
        stmt = stmt.where(BOQRevisionV2.boq_id == boq_id)
    if project_id is not None:
        stmt = stmt.where(BOQRevisionV2.project_id == project_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/boq-revisions/{revision_id}", response_model=BOQRevisionV2Out)
async def get_boq_revision(
    revision_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BOQRevisionV2)
        .options(selectinload(BOQRevisionV2.items))
        .where(BOQRevisionV2.id == revision_id)
    )
    revision = result.scalar_one_or_none()
    if not revision:
        raise HTTPException(status_code=404, detail="BOQ revision not found")
    return revision


@router.post("/pricing-sessions", response_model=PricingSessionV2Out, status_code=201)
async def create_pricing_session(
    payload: PricingSessionV2Create,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    revision_result = await db.execute(
        select(BOQRevisionV2)
        .options(selectinload(BOQRevisionV2.items))
        .where(BOQRevisionV2.id == payload.boq_revision_id)
    )
    revision = revision_result.scalar_one_or_none()
    if not revision:
        raise HTTPException(status_code=404, detail="BOQ revision not found")

    product_ids = [item.product_id for item in revision.items if item.product_id]
    products_map: dict[int, Product] = {}
    if product_ids:
        product_result = await db.execute(
            select(Product).options(selectinload(Product.brand)).where(Product.id.in_(product_ids))
        )
        for product in product_result.scalars().all():
            products_map[product.id] = product

    session = PricingSessionV2(
        boq_revision_id=revision.id,
        project_id=revision.project_id,
        status="draft",
        currency=payload.currency,
        vat_rate=payload.vat_rate,
        created_by=current_user.id,
    )
    db.add(session)
    await db.flush()

    for item in sorted(revision.items, key=lambda value: value.seq):
        product = products_map.get(item.product_id) if item.product_id else None
        list_price = product.list_price if product else Decimal("0")
        line = PricingLineV2(
            pricing_session_id=session.id,
            boq_revision_item_id=item.id,
            seq=item.seq,
            section_label=item.section_label,
            description=item.description,
            product_id=item.product_id,
            item_code=product.item_code if product else None,
            brand=product.brand.name if product and product.brand else None,
            quantity=item.quantity,
            unit=item.unit,
            list_price=list_price,
            discount_pct=Decimal("0"),
            source_line_ref={"boq_revision_item_id": item.id, "boq_item_id": item.boq_item_id},
        )
        _calc_line(line)
        db.add(line)

    await db.commit()

    loaded = await _load_pricing_session(db, session.id)
    if not loaded:
        raise HTTPException(status_code=500, detail="Failed to load pricing session")
    return PricingSessionV2Out(
        id=loaded.id,
        boq_revision_id=loaded.boq_revision_id,
        project_id=loaded.project_id,
        status=loaded.status,
        currency=loaded.currency,
        vat_rate=loaded.vat_rate,
        created_by=loaded.created_by,
        created_at=loaded.created_at,
        updated_at=loaded.updated_at,
        lines=[PricingLineV2Out.model_validate(line) for line in loaded.lines],
        totals=_pricing_totals(loaded),
    )


@router.get("/pricing-sessions/{session_id}", response_model=PricingSessionV2Out)
async def get_pricing_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    session = await _load_pricing_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Pricing session not found")
    return PricingSessionV2Out(
        id=session.id,
        boq_revision_id=session.boq_revision_id,
        project_id=session.project_id,
        status=session.status,
        currency=session.currency,
        vat_rate=session.vat_rate,
        created_by=session.created_by,
        created_at=session.created_at,
        updated_at=session.updated_at,
        lines=[PricingLineV2Out.model_validate(line) for line in session.lines],
        totals=_pricing_totals(session),
    )


@router.get("/pricing-sessions", response_model=list[PricingSessionV2Out])
async def list_pricing_sessions(
    boq_id: Optional[int] = None,
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = (
        select(PricingSessionV2)
        .options(selectinload(PricingSessionV2.lines))
        .order_by(PricingSessionV2.id.desc())
    )
    if project_id is not None:
        stmt = stmt.where(PricingSessionV2.project_id == project_id)
    if boq_id is not None:
        rev_ids_result = await db.execute(
            select(BOQRevisionV2.id).where(BOQRevisionV2.boq_id == boq_id)
        )
        rev_ids = [r[0] for r in rev_ids_result.all()]
        if not rev_ids:
            return []
        stmt = stmt.where(PricingSessionV2.boq_revision_id.in_(rev_ids))
    result = await db.execute(stmt)
    sessions = result.scalars().all()
    return [
        PricingSessionV2Out(
            id=s.id,
            boq_revision_id=s.boq_revision_id,
            project_id=s.project_id,
            status=s.status,
            currency=s.currency,
            vat_rate=s.vat_rate,
            created_by=s.created_by,
            created_at=s.created_at,
            updated_at=s.updated_at,
            lines=[PricingLineV2Out.model_validate(line) for line in s.lines],
            totals=_pricing_totals(s),
        )
        for s in sessions
    ]


@router.patch("/pricing-sessions/{session_id}/lines/{line_id}", response_model=PricingLineV2Out)
async def update_pricing_line(
    session_id: int,
    line_id: int,
    payload: PricingLineV2Update,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    session_result = await db.execute(select(PricingSessionV2).where(PricingSessionV2.id == session_id))
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Pricing session not found")
    if session.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft pricing sessions can be edited")

    line_result = await db.execute(
        select(PricingLineV2).where(PricingLineV2.id == line_id, PricingLineV2.pricing_session_id == session_id)
    )
    line = line_result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Pricing line not found")

    updates = payload.model_dump(exclude_none=True)
    for key, value in updates.items():
        setattr(line, key, value)
    _calc_line(line)
    await db.commit()
    await db.refresh(line)
    return line


@router.post("/pricing-sessions/{session_id}/finalize", response_model=PricingSessionV2Out)
async def finalize_pricing_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    session = await _load_pricing_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Pricing session not found")
    if session.status == "finalized":
        return PricingSessionV2Out(
            id=session.id,
            boq_revision_id=session.boq_revision_id,
            project_id=session.project_id,
            status=session.status,
            currency=session.currency,
            vat_rate=session.vat_rate,
            created_by=session.created_by,
            created_at=session.created_at,
            updated_at=session.updated_at,
            lines=[PricingLineV2Out.model_validate(line) for line in session.lines],
            totals=_pricing_totals(session),
        )

    session.status = "finalized"
    await db.commit()
    await db.refresh(session)

    loaded = await _load_pricing_session(db, session_id)
    if not loaded:
        raise HTTPException(status_code=500, detail="Failed to load pricing session")
    return PricingSessionV2Out(
        id=loaded.id,
        boq_revision_id=loaded.boq_revision_id,
        project_id=loaded.project_id,
        status=loaded.status,
        currency=loaded.currency,
        vat_rate=loaded.vat_rate,
        created_by=loaded.created_by,
        created_at=loaded.created_at,
        updated_at=loaded.updated_at,
        lines=[PricingLineV2Out.model_validate(line) for line in loaded.lines],
        totals=_pricing_totals(loaded),
    )


async def _generate_qtv2_number(db: AsyncSession) -> str:
    year = datetime.now(timezone.utc).year
    result = await db.execute(
        select(func.count()).select_from(QuotationV2).where(QuotationV2.quotation_number.like(f"QTV2-{year}-%"))
    )
    count = int(result.scalar() or 0)
    return f"QTV2-{year}-{str(count + 1).zfill(4)}"


@router.post("/quotations/from-pricing/{session_id}", response_model=QuotationV2Out, status_code=201)
async def create_quotation_from_pricing(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await _load_pricing_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Pricing session not found")
    if session.status != "finalized":
        raise HTTPException(status_code=400, detail="Pricing session must be finalized before issuing quotation")

    totals = _pricing_totals(session)
    quotation_number = await _generate_qtv2_number(db)
    quotation = QuotationV2(
        quotation_number=quotation_number,
        pricing_session_id=session.id,
        project_id=session.project_id,
        status="issued",
        revision_no=1,
        subtotal=totals.subtotal,
        vat_rate=totals.vat_rate,
        vat_amount=totals.vat_amount,
        grand_total=totals.grand_total,
        created_by=current_user.id,
    )
    db.add(quotation)
    await db.flush()

    snapshot_payload = {
        "quotation_number": quotation_number,
        "project_id": session.project_id,
        "pricing_session_id": session.id,
        "issued_at": datetime.now(timezone.utc).isoformat(),
        "currency": session.currency,
        "totals": {
            "subtotal": str(totals.subtotal),
            "vat_rate": str(totals.vat_rate),
            "vat_amount": str(totals.vat_amount),
            "grand_total": str(totals.grand_total),
        },
        "lines": [
            {
                "id": line.id,
                "seq": line.seq,
                "section_label": line.section_label,
                "description": line.description,
                "product_id": line.product_id,
                "item_code": line.item_code,
                "brand": line.brand,
                "quantity": str(line.quantity),
                "unit": line.unit,
                "list_price": str(line.list_price),
                "discount_pct": str(line.discount_pct),
                "net_price": str(line.net_price),
                "amount": str(line.amount),
                "source_line_ref": line.source_line_ref,
            }
            for line in sorted(session.lines, key=lambda value: value.seq)
        ],
    }

    snapshot = QuotationSnapshotV2(
        quotation_id=quotation.id,
        revision_no=1,
        snapshot_json=snapshot_payload,
        issued_by=current_user.id,
    )
    db.add(snapshot)
    await db.commit()

    loaded = await _load_quotation_v2(db, quotation.id)
    if not loaded:
        raise HTTPException(status_code=500, detail="Failed to load quotation")
    return loaded


@router.get("/quotations", response_model=list[QuotationV2Out])
async def list_quotations_v2(
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = (
        select(QuotationV2)
        .options(selectinload(QuotationV2.snapshots))
        .order_by(QuotationV2.id.desc())
    )
    if project_id is not None:
        stmt = stmt.where(QuotationV2.project_id == project_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/quotations/{quotation_id}", response_model=QuotationV2Out)
async def get_quotation_v2(
    quotation_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    quotation = await _load_quotation_v2(db, quotation_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return quotation


@router.get("/quotations/{quotation_id}/snapshots", response_model=list[QuotationSnapshotV2Out])
async def list_quotation_snapshots(
    quotation_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(QuotationSnapshotV2)
        .where(QuotationSnapshotV2.quotation_id == quotation_id)
        .order_by(QuotationSnapshotV2.revision_no)
    )
    return result.scalars().all()
