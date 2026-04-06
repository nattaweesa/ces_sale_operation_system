from __future__ import annotations

import json
import os
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import aiofiles
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models.master_data_ingestion import (
    MasterCandidateMatchSuggestion,
    MasterIngestionBatch,
    MasterIngestionDocument,
    MasterIngestionDocumentHeader,
    MasterIngestionNormalizedLine,
    MasterIngestionRawLine,
    MasterPriceObservation,
    MasterProductCandidate,
    MasterReviewActionLog,
)
from app.models.product import Product
from app.models.sourcing import ProductAlias
from app.services.master_data_ai import ai_adapter
from app.services.master_data_rules import (
    classify_line,
    normalize_brand,
    normalize_item_code,
    normalize_text,
)
from app.services.quotation_intake_service import extract_text_from_pdf, parse_product_lines


settings = get_settings()

UPLOADER_ROLES = {"admin", "manager", "sales_admin"}
REVIEWER_ROLES = {"admin", "manager", "sales_admin"}


@dataclass
class HeaderFields:
    quotation_number: Optional[str]
    project_name: Optional[str]
    quote_date_text: Optional[str]
    subject: Optional[str]


def parse_header_fields(text: str) -> HeaderFields:
    quotation_number = None
    project_name = None
    quote_date_text = None
    subject = None

    lines = [" ".join((ln or "").split()) for ln in text.splitlines()]
    for line in lines:
        low = line.lower()
        if quotation_number is None and "quotation" in low and ":" in line:
            # Examples: Quotation : Q_KNX_025R1-26PA...
            m = re.search(r"quotation\s*:\s*(.+)$", line, flags=re.IGNORECASE)
            if m:
                quotation_number = m.group(1).strip()
        if project_name is None and low.startswith("project") and ":" in line:
            m = re.search(r"project\s*:\s*(.+)$", line, flags=re.IGNORECASE)
            if m:
                project_name = m.group(1).strip()
        if quote_date_text is None and low.startswith("date") and ":" in line:
            m = re.search(r"date\s*:\s*(.+)$", line, flags=re.IGNORECASE)
            if m:
                quote_date_text = m.group(1).strip()
        if subject is None and low.startswith("subject") and ":" in line:
            m = re.search(r"subject\s*:\s*(.+)$", line, flags=re.IGNORECASE)
            if m:
                subject = m.group(1).strip()

    return HeaderFields(
        quotation_number=quotation_number,
        project_name=project_name,
        quote_date_text=quote_date_text,
        subject=subject,
    )


def infer_brand_from_line(raw_text: str, known_brands: list[str]) -> Optional[str]:
    low = normalize_text(raw_text)
    for b in known_brands:
        nb = normalize_text(b)
        if nb and nb in low:
            return b
    return None


async def _ensure_unique_item_code(db: AsyncSession, preferred: str) -> str:
    desired = preferred.strip() or "MD-ITEM"
    final = desired
    i = 1
    while (await db.execute(select(Product.id).where(Product.item_code == final))).scalar_one_or_none() is not None:
        i += 1
        final = f"{desired}-{i}"
    return final


async def _build_candidate_suggestions(
    db: AsyncSession,
    candidate: MasterProductCandidate,
    code: Optional[str],
    brand: Optional[str],
) -> None:
    if not code:
        return

    ncode = normalize_item_code(code)
    nbrand = normalize_brand(brand)

    # 1) exact brand + code
    if ncode and nbrand:
        rows = (
            await db.execute(
                select(Product)
                .options(selectinload(Product.brand))
                .where(Product.item_code == ncode)
            )
        ).scalars().all()
        for p in rows:
            p_brand = p.brand.name if p.brand else None
            if normalize_brand(p_brand) == nbrand:
                db.add(MasterCandidateMatchSuggestion(
                    candidate_id=candidate.id,
                    product_id=p.id,
                    method="exact_brand_code",
                    confidence=Decimal("100.00"),
                    notes="Exact brand + code",
                ))

    # 2) exact code
    if ncode:
        rows = (await db.execute(select(Product).where(Product.item_code == ncode))).scalars().all()
        for p in rows:
            db.add(MasterCandidateMatchSuggestion(
                candidate_id=candidate.id,
                product_id=p.id,
                method="exact_code",
                confidence=Decimal("98.00"),
                notes="Exact item code",
            ))

    # 3) alias-based
    if ncode:
        alias_row = (
            await db.execute(select(ProductAlias).where(ProductAlias.alias_text == normalize_text(ncode)))
        ).scalar_one_or_none()
        if alias_row:
            db.add(MasterCandidateMatchSuggestion(
                candidate_id=candidate.id,
                product_id=alias_row.product_id,
                method="alias_match",
                confidence=Decimal("92.00"),
                notes="Matched by alias table",
            ))


async def process_document(db: AsyncSession, document: MasterIngestionDocument) -> None:
    document.status = "parsing"
    await db.flush()

    try:
        async with aiofiles.open(document.stored_path, "rb") as fh:
            pdf_bytes = await fh.read()

        text = extract_text_from_pdf(pdf_bytes)
        if not text.strip():
            raise ValueError("No extractable text in PDF")

        header = parse_header_fields(text)
        db.add(MasterIngestionDocumentHeader(
            document_id=document.id,
            quotation_number=header.quotation_number,
            project_name=header.project_name,
            quote_date_text=header.quote_date_text,
            subject=header.subject,
        ))

        parsed_lines = parse_product_lines(text)
        if not parsed_lines:
            document.status = "failed"
            document.parse_notes = "No complete product rows detected"
            await db.flush()
            return

        # Brand extraction is best-effort in v1; keep deterministic parser output as primary source.
        known_brands: list[str] = []

        for line in parsed_lines:
            raw = MasterIngestionRawLine(
                document_id=document.id,
                line_no=line.line_no,
                raw_text=line.raw_text,
                item_code_raw=line.item_code,
                description_raw=line.description,
                brand_raw=infer_brand_from_line(line.raw_text, known_brands),
                list_price_raw=str(line.list_price),
                qty_raw=str(line.quantity),
                discount_text_raw=None,
                total_amount_raw=str(line.amount),
                parse_confidence=Decimal("90.00"),
                parse_notes=None,
            )
            db.add(raw)
            await db.flush()

            code_norm = normalize_item_code(line.item_code)
            desc_norm = " ".join((line.description or "").split())
            brand_norm = normalize_brand(raw.brand_raw)
            list_price = line.list_price if line.list_price and line.list_price > 0 else None
            qty = line.quantity if line.quantity and line.quantity > 0 else None
            amount = line.amount if line.amount and line.amount > 0 else None

            classification = classify_line(code_norm, desc_norm, brand_norm, list_price)
            uncertain = classification == "unknown"
            note = None
            if uncertain:
                note = "Deterministic classifier could not confidently classify this row"

            norm = MasterIngestionNormalizedLine(
                raw_line_id=raw.id,
                classification=classification,
                item_code_norm=code_norm,
                description_norm=desc_norm,
                brand_norm=brand_norm,
                unit_norm=line.unit,
                list_price_norm=list_price,
                qty_norm=qty,
                amount_norm=amount,
                uncertain=1 if uncertain else 0,
                normalize_notes=note,
            )
            db.add(norm)
            await db.flush()

            if classification != "catalog_product":
                continue

            candidate = MasterProductCandidate(
                normalized_line_id=norm.id,
                candidate_code=code_norm,
                canonical_description=desc_norm,
                canonical_brand=brand_norm,
                selected_list_price=None,
                status="pending_review",
            )
            db.add(candidate)
            await db.flush()

            if list_price is not None:
                db.add(MasterPriceObservation(
                    candidate_id=candidate.id,
                    observed_list_price=list_price,
                    currency="THB",
                    source_document_id=document.id,
                    source_raw_line_id=raw.id,
                ))

            await _build_candidate_suggestions(db, candidate, code_norm, brand_norm)

        document.status = "parsed"
        document.parse_notes = None
    except Exception as exc:
        document.status = "failed"
        document.parse_notes = str(exc)


async def upload_batch(db: AsyncSession, uploader_id: int, files: list) -> MasterIngestionBatch:
    batch = MasterIngestionBatch(
        uploaded_by=uploader_id,
        status="processing",
        total_files=len(files),
        processed_files=0,
        failed_files=0,
    )
    db.add(batch)
    await db.flush()

    storage_dir = os.path.join(settings.storage_path, "master_data_ingestion", str(batch.id), str(uploader_id))
    os.makedirs(storage_dir, exist_ok=True)

    docs: list[MasterIngestionDocument] = []
    for f in files:
        ext = os.path.splitext(f.filename or "file.pdf")[1] or ".pdf"
        stored_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(storage_dir, stored_name)
        content = await f.read()
        async with aiofiles.open(file_path, "wb") as out:
            await out.write(content)

        doc = MasterIngestionDocument(
            batch_id=batch.id,
            original_filename=f.filename or "file.pdf",
            stored_path=file_path,
            mime_type=getattr(f, "content_type", None),
            file_size=len(content),
            status="uploaded",
        )
        db.add(doc)
        docs.append(doc)

    await db.flush()

    for doc in docs:
        await process_document(db, doc)
        batch.processed_files += 1
        if doc.status == "failed":
            batch.failed_files += 1

    if batch.failed_files == 0:
        batch.status = "parsed"
    elif batch.processed_files > batch.failed_files:
        batch.status = "partial_failed"
    else:
        batch.status = "failed"

    await db.commit()
    await db.refresh(batch)
    return batch


async def reprocess_batch(db: AsyncSession, batch_id: int) -> MasterIngestionBatch:
    batch = (
        await db.execute(
            select(MasterIngestionBatch)
            .options(selectinload(MasterIngestionBatch.documents))
            .where(MasterIngestionBatch.id == batch_id)
        )
    ).scalar_one_or_none()
    if not batch:
        raise ValueError("Batch not found")

    batch.status = "processing"
    batch.processed_files = 0
    batch.failed_files = 0

    for doc in batch.documents:
        # remove previous rows for clean reprocess
        existing_raw = (
            await db.execute(select(MasterIngestionRawLine).where(MasterIngestionRawLine.document_id == doc.id))
        ).scalars().all()
        for row in existing_raw:
            await db.delete(row)

        existing_hdr = (
            await db.execute(select(MasterIngestionDocumentHeader).where(MasterIngestionDocumentHeader.document_id == doc.id))
        ).scalar_one_or_none()
        if existing_hdr:
            await db.delete(existing_hdr)

        await db.flush()
        await process_document(db, doc)
        batch.processed_files += 1
        if doc.status == "failed":
            batch.failed_files += 1

    if batch.failed_files == 0:
        batch.status = "parsed"
    elif batch.processed_files > batch.failed_files:
        batch.status = "partial_failed"
    else:
        batch.status = "failed"

    await db.commit()
    await db.refresh(batch)
    return batch


async def list_batches(db: AsyncSession, limit: int = 100) -> list[MasterIngestionBatch]:
    return (
        await db.execute(
            select(MasterIngestionBatch)
            .order_by(MasterIngestionBatch.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()


async def get_batch_detail(db: AsyncSession, batch_id: int) -> Optional[MasterIngestionBatch]:
    return (
        await db.execute(
            select(MasterIngestionBatch)
            .options(
                selectinload(MasterIngestionBatch.documents)
                .selectinload(MasterIngestionDocument.header),
                selectinload(MasterIngestionBatch.documents)
                .selectinload(MasterIngestionDocument.raw_lines)
                .selectinload(MasterIngestionRawLine.normalized_line)
                .selectinload(MasterIngestionNormalizedLine.candidate)
                .selectinload(MasterProductCandidate.suggestions),
                selectinload(MasterIngestionBatch.documents)
                .selectinload(MasterIngestionDocument.raw_lines)
                .selectinload(MasterIngestionRawLine.normalized_line)
                .selectinload(MasterIngestionNormalizedLine.candidate)
                .selectinload(MasterProductCandidate.price_observations),
            )
            .where(MasterIngestionBatch.id == batch_id)
        )
    ).scalar_one_or_none()


async def list_candidates(db: AsyncSession, status: Optional[str], limit: int = 200) -> list[MasterProductCandidate]:
    stmt = (
        select(MasterProductCandidate)
        .options(
            selectinload(MasterProductCandidate.normalized_line)
            .selectinload(MasterIngestionNormalizedLine.raw_line),
            selectinload(MasterProductCandidate.suggestions),
            selectinload(MasterProductCandidate.price_observations),
        )
        .order_by(MasterProductCandidate.id.desc())
        .limit(limit)
    )
    if status:
        stmt = stmt.where(MasterProductCandidate.status == status)
    return (await db.execute(stmt)).scalars().all()


async def get_candidate(db: AsyncSession, candidate_id: int) -> Optional[MasterProductCandidate]:
    return (
        await db.execute(
            select(MasterProductCandidate)
            .options(
                selectinload(MasterProductCandidate.normalized_line)
                .selectinload(MasterIngestionNormalizedLine.raw_line),
                selectinload(MasterProductCandidate.suggestions),
                selectinload(MasterProductCandidate.price_observations),
                selectinload(MasterProductCandidate.actions),
            )
            .where(MasterProductCandidate.id == candidate_id)
        )
    ).scalar_one_or_none()


async def suggest_canonical_description(draft_description: str) -> tuple[str, str]:
    suggestion = ai_adapter.suggest(draft_description)
    return suggestion.text, suggestion.provider


async def review_candidate(
    db: AsyncSession,
    candidate_id: int,
    reviewer_id: int,
    *,
    action: str,
    target_product_id: Optional[int],
    canonical_description: Optional[str],
    selected_list_price: Optional[Decimal],
    note: Optional[str],
) -> tuple[MasterProductCandidate, Optional[int]]:
    candidate = await get_candidate(db, candidate_id)
    if not candidate:
        raise ValueError("Candidate not found")

    norm = candidate.normalized_line
    if not norm or norm.classification != "catalog_product":
        raise ValueError("Only catalog_product candidates can be published")

    if action not in {"approve_new", "merge_existing", "reject"}:
        raise ValueError("Unsupported action")

    product_id: Optional[int] = None
    price_choice = selected_list_price

    if action == "reject":
        candidate.status = "rejected"
    elif action == "merge_existing":
        if not target_product_id:
            raise ValueError("target_product_id is required for merge_existing")
        product = (await db.execute(select(Product).where(Product.id == target_product_id))).scalar_one_or_none()
        if not product:
            raise ValueError("Target product not found")
        product_id = product.id
        if canonical_description:
            product.description = canonical_description.strip()
        if price_choice is not None:
            product.list_price = price_choice
        candidate.status = "published"
        candidate.chosen_product_id = product.id
        candidate.published_at = datetime.now(timezone.utc)
    else:  # approve_new
        if price_choice is None:
            raise ValueError("selected_list_price is required for approve_new")

        base_code = candidate.candidate_code or f"MD-{candidate.id}"
        final_code = await _ensure_unique_item_code(db, base_code)
        product = Product(
            item_code=final_code,
            description=(canonical_description or candidate.canonical_description or "").strip() or "Unnamed product",
            list_price=price_choice,
            currency="THB",
            status="active",
            moq=1,
            lead_time_days=None,
            remark="Published from Module 1 Master Data Ingestion",
        )
        db.add(product)
        await db.flush()
        product_id = product.id

        # Add alias evidence if available.
        if candidate.candidate_code:
            alias_text = normalize_text(candidate.candidate_code)
            if alias_text and (await db.execute(select(ProductAlias).where(ProductAlias.alias_text == alias_text))).scalar_one_or_none() is None:
                db.add(ProductAlias(product_id=product.id, alias_text=alias_text, alias_type="item_code"))

        candidate.status = "published"
        candidate.chosen_product_id = product.id
        candidate.published_at = datetime.now(timezone.utc)

    candidate.reviewed_by = reviewer_id
    candidate.reviewed_at = datetime.now(timezone.utc)
    candidate.review_note = note
    if canonical_description:
        candidate.canonical_description = canonical_description.strip()
    if price_choice is not None:
        candidate.selected_list_price = price_choice

    evidence = {
        "raw_line_id": norm.raw_line_id if norm else None,
        "classification": norm.classification if norm else None,
        "source_item_code": norm.item_code_norm if norm else None,
        "source_description": norm.description_norm if norm else None,
        "price_observations": [str(o.observed_list_price) for o in candidate.price_observations],
    }

    db.add(MasterReviewActionLog(
        candidate_id=candidate.id,
        action=action,
        reviewer_id=reviewer_id,
        product_id=product_id,
        selected_list_price=price_choice,
        notes=note,
        evidence_json=json.dumps(evidence),
    ))

    await db.commit()
    await db.refresh(candidate)
    return candidate, product_id


async def list_published_evidence(db: AsyncSession, limit: int = 200) -> list[MasterReviewActionLog]:
    return (
        await db.execute(
            select(MasterReviewActionLog)
            .where(MasterReviewActionLog.product_id.is_not(None))
            .order_by(MasterReviewActionLog.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()


async def list_published_evidence_for_product(db: AsyncSession, product_id: int, limit: int = 100) -> list[MasterReviewActionLog]:
    return (
        await db.execute(
            select(MasterReviewActionLog)
            .where(MasterReviewActionLog.product_id == product_id)
            .order_by(MasterReviewActionLog.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
