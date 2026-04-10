from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.models.product import Product
from app.models.quotation_intake import QuotationIntakeDocument, QuotationIntakeLine
from app.models.user import User
from app.schemas.quotation_intake import (
    QuotationIntakeConfirmOut,
    QuotationIntakeConfirmRequest,
    QuotationIntakeDocumentOut,
    QuotationIntakeLineOut,
    QuotationIntakeUploadOut,
)
from app.services.auth import get_current_user
from app.services.rbac import can_user
from app.services.quotation_intake_service import (
    build_item_code_from_description,
    detect_existing_product,
    ensure_unique_item_code,
    extract_text_from_pdf,
    parse_product_lines,
)

settings = get_settings()
router = APIRouter(prefix="/quotation-intake", tags=["quotation-intake"])
ALWAYS_CUSTOMIZE_CODES = {"CP-KNX"}


async def _load_document(document_id: int, db: AsyncSession) -> QuotationIntakeDocument | None:
    return (
        await db.execute(
            select(QuotationIntakeDocument)
            .options(selectinload(QuotationIntakeDocument.lines))
            .where(QuotationIntakeDocument.id == document_id)
        )
    ).scalar_one_or_none()


def _doc_out(doc: QuotationIntakeDocument) -> QuotationIntakeDocumentOut:
    return QuotationIntakeDocumentOut(
        id=doc.id,
        user_id=doc.user_id,
        original_filename=doc.original_filename,
        status=doc.status,
        total_lines=doc.total_lines,
        existing_lines=doc.existing_lines,
        new_lines=doc.new_lines,
        created_at=doc.created_at.isoformat(),
    )


def _line_out(line: QuotationIntakeLine, product_map: dict[int, Product]) -> QuotationIntakeLineOut:
    match = product_map.get(line.matched_product_id) if line.matched_product_id else None
    return QuotationIntakeLineOut(
        id=line.id,
        line_no=line.line_no,
        raw_text=line.raw_text,
        item_code=line.item_code,
        description=line.description,
        quantity=float(line.quantity or 0),
        unit=line.unit,
        list_price=float(line.list_price or 0),
        net_price=float(line.net_price or 0),
        amount=float(line.amount or 0),
        matched_product_id=line.matched_product_id,
        matched_product_code=match.item_code if match else None,
        matched_product_description=match.description if match else None,
        status=line.status,
    )


@router.post("/upload", response_model=QuotationIntakeUploadOut)
async def upload_quotation_pdf(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filename = file.filename or "quotation.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    extracted_text = extract_text_from_pdf(raw_bytes)
    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="Cannot extract text from PDF. Please upload machine-readable PDF")

    parsed_lines = parse_product_lines(extracted_text)
    if not parsed_lines:
        raise HTTPException(
            status_code=400,
            detail="No complete product rows found. Required: Description, Price list, Qty, Amount (Cat no/Brand optional when recognizable).",
        )

    user_dir = os.path.join(settings.storage_path, "uploaded_quotations", str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    stored_name = f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex}.pdf"
    stored_path = os.path.join(user_dir, stored_name)

    async with aiofiles.open(stored_path, "wb") as out:
        await out.write(raw_bytes)

    document = QuotationIntakeDocument(
        user_id=current_user.id,
        original_filename=filename,
        stored_path=stored_path,
        status="parsed",
    )
    db.add(document)
    await db.flush()

    product_cache = (await db.execute(select(Product))).scalars().all()

    # If same cat no. appears with different descriptions or prices, treat as customized work.
    grouped: dict[str, list] = {}
    for line in parsed_lines:
        if line.item_code:
            grouped.setdefault(line.item_code.strip().upper(), []).append(line)

    customize_codes = {code for code in ALWAYS_CUSTOMIZE_CODES}
    for code, rows in grouped.items():
        descs = {r.description.strip().lower() for r in rows}
        prices = {str(r.list_price) for r in rows}
        if len(descs) > 1 or len(prices) > 1:
            customize_codes.add(code)

    existing = 0
    for line in parsed_lines:
        norm_code = (line.item_code or "").strip().upper()

        matched = None
        status = "pending"

        if not line.item_code:
            status = "pending_no_code"
        elif norm_code in customize_codes:
            status = "pending_customize"
        else:
            matched = await detect_existing_product(db, item_code=line.item_code, description=line.description)
            if matched:
                status = "existing"
                existing += 1

        db.add(
            QuotationIntakeLine(
                document_id=document.id,
                line_no=line.line_no,
                raw_text=line.raw_text,
                item_code=line.item_code,
                description=line.description,
                quantity=line.quantity,
                unit=line.unit,
                list_price=line.list_price,
                net_price=line.net_price,
                amount=line.amount,
                matched_product_id=matched.id if matched else None,
                status=status,
            )
        )

    document.total_lines = len(parsed_lines)
    document.existing_lines = existing
    document.new_lines = len(parsed_lines) - existing

    await db.commit()

    loaded = await _load_document(document.id, db)
    if not loaded:
        raise HTTPException(status_code=500, detail="Failed to load uploaded document")

    line_product_ids = [ln.matched_product_id for ln in loaded.lines if ln.matched_product_id]
    products = (
        await db.execute(select(Product).where(Product.id.in_(line_product_ids)))
    ).scalars().all() if line_product_ids else []
    live_map = {p.id: p for p in products}

    return QuotationIntakeUploadOut(
        document=_doc_out(loaded),
        lines=[_line_out(ln, live_map) for ln in loaded.lines],
    )


@router.get("/documents", response_model=list[QuotationIntakeDocumentOut])
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(QuotationIntakeDocument).order_by(QuotationIntakeDocument.created_at.desc())
    if not await can_user(db, current_user, "quotation_intake.view_all"):
        stmt = stmt.where(QuotationIntakeDocument.user_id == current_user.id)

    rows = (await db.execute(stmt)).scalars().all()
    return [_doc_out(doc) for doc in rows]


@router.get("/documents/{document_id}", response_model=QuotationIntakeUploadOut)
async def get_document_detail(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await _load_document(document_id, db)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not await can_user(db, current_user, "quotation_intake.view_all") and doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    line_product_ids = [ln.matched_product_id for ln in doc.lines if ln.matched_product_id]
    products = (
        await db.execute(select(Product).where(Product.id.in_(line_product_ids)))
    ).scalars().all() if line_product_ids else []
    product_map = {p.id: p for p in products}

    return QuotationIntakeUploadOut(
        document=_doc_out(doc),
        lines=[_line_out(ln, product_map) for ln in doc.lines],
    )


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await _load_document(document_id, db)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not await can_user(db, current_user, "quotation_intake.view_all") and doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    file_path = doc.stored_path
    await db.delete(doc)
    await db.commit()

    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except OSError:
            pass


@router.post("/documents/{document_id}/confirm-missing", response_model=QuotationIntakeConfirmOut)
async def confirm_missing_items(
    document_id: int,
    payload: QuotationIntakeConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await _load_document(document_id, db)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not await can_user(db, current_user, "quotation_intake.view_all") and doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    selected = set(payload.line_ids or [])
    created = 0
    existing = 0
    skipped = 0

    for line in doc.lines:
        if line.status in ("created", "existing"):
            continue
        if selected and line.id not in selected:
            skipped += 1
            line.status = "skipped"
            continue

        matched = await detect_existing_product(db, item_code=line.item_code, description=line.description)
        if matched and line.status != "pending_customize":
            line.matched_product_id = matched.id
            line.status = "existing"
            existing += 1
            continue

        base_code = (line.item_code or build_item_code_from_description(line.description) or f"OCR-{doc.id}-{line.id}").strip()
        item_code = await ensure_unique_item_code(db, base_code)
        price = line.net_price if line.net_price and line.net_price > 0 else line.list_price

        is_customize = line.status == "pending_customize"
        final_price = Decimal("0.00") if is_customize else Decimal(price or 0)
        final_status = "on_request" if is_customize else "active"
        final_remark = (
            f"CUSTOMIZE item from intake doc {doc.id}: manual pricing required. Source line amount={line.amount}"
            if is_customize
            else f"Created from OCR upload doc {doc.id}"
        )

        product = Product(
            item_code=item_code,
            description=line.description,
            list_price=final_price,
            currency="THB",
            status=final_status,
            moq=1,
            lead_time_days=None,
            remark=final_remark,
        )
        db.add(product)
        await db.flush()

        line.matched_product_id = product.id
        line.status = "created"
        created += 1

    doc.existing_lines = sum(1 for ln in doc.lines if ln.status == "existing")
    doc.new_lines = sum(1 for ln in doc.lines if ln.status == "pending")
    if doc.new_lines == 0:
        doc.status = "confirmed"

    await db.commit()

    return QuotationIntakeConfirmOut(
        document_id=doc.id,
        created_products=created,
        existing_lines=existing,
        skipped_lines=skipped,
    )
