from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from difflib import SequenceMatcher
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.boq import BOQ
from app.models.project import Project
from app.models.product import Product
from app.models.quotation import Quotation
from app.models.sourcing import (
    LineMatchReviewQueue,
    ProductAlias,
    ProductPriceHistory,
    SourceDocument,
    SourceLineItem,
)


def _normalize_text(text: Optional[str]) -> str:
    if not text:
        return ""
    cleaned = "".join(ch.lower() if ch.isalnum() else " " for ch in text)
    return " ".join(cleaned.split())


@dataclass
class MatchCandidate:
    product_id: Optional[int]
    confidence: Decimal
    method: str
    reason: str


async def _seed_product_aliases(db: AsyncSession) -> int:
    products = (await db.execute(select(Product))).scalars().all()
    existing_aliases = {
        row[0]
        for row in (await db.execute(select(ProductAlias.alias_text))).all()
    }

    created = 0
    for p in products:
        candidates = [
            (p.item_code, "item_code"),
            (p.description, "description"),
        ]
        for raw_text, alias_type in candidates:
            norm = _normalize_text(raw_text)
            if not norm or norm in existing_aliases:
                continue
            db.add(ProductAlias(product_id=p.id, alias_text=norm, alias_type=alias_type))
            existing_aliases.add(norm)
            created += 1

    if created:
        await db.flush()
    return created


def _match_line_item(
    item_code: Optional[str],
    description: str,
    products: list[Product],
    alias_to_product: dict[str, int],
) -> MatchCandidate:
    norm_item_code = _normalize_text(item_code)
    norm_desc = _normalize_text(description)

    if norm_item_code:
        for p in products:
            if _normalize_text(p.item_code) == norm_item_code:
                return MatchCandidate(p.id, Decimal("100.00"), "item_code_exact", "Matched by exact item code")

        alias_pid = alias_to_product.get(norm_item_code)
        if alias_pid:
            return MatchCandidate(alias_pid, Decimal("95.00"), "alias_exact", "Matched by alias table")

    best_pid: Optional[int] = None
    best_score = 0.0
    for p in products:
        score = SequenceMatcher(None, norm_desc, _normalize_text(p.description)).ratio()
        if score > best_score:
            best_score = score
            best_pid = p.id

    confidence = Decimal(str(round(best_score * 100, 2)))
    if best_pid and confidence >= Decimal("86.00"):
        return MatchCandidate(best_pid, confidence, "description_fuzzy", "High fuzzy similarity with product description")

    if best_pid:
        return MatchCandidate(best_pid, confidence, "needs_review", "Low confidence fuzzy match")
    return MatchCandidate(None, Decimal("0.00"), "needs_review", "No candidate matched")


async def _upsert_review_queue(
    db: AsyncSession,
    line_item_id: int,
    suggested_product_id: Optional[int],
    confidence: Decimal,
    reason: str,
) -> None:
    existing = (
        await db.execute(select(LineMatchReviewQueue).where(LineMatchReviewQueue.line_item_id == line_item_id))
    ).scalar_one_or_none()
    if existing:
        existing.suggested_product_id = suggested_product_id
        existing.confidence = confidence
        existing.reason = reason
        existing.status = "pending"
        existing.reviewed_by = None
        existing.reviewed_at = None
        existing.note = None
        return

    db.add(
        LineMatchReviewQueue(
            line_item_id=line_item_id,
            suggested_product_id=suggested_product_id,
            confidence=confidence,
            reason=reason,
            status="pending",
        )
    )


def _effective_price(net_price: Decimal, list_price: Decimal, amount: Decimal, qty: Decimal) -> Decimal:
    if net_price and net_price > 0:
        return net_price
    if list_price and list_price > 0:
        return list_price
    if qty and qty > 0 and amount and amount > 0:
        return (amount / qty).quantize(Decimal("0.01"))
    return Decimal("0.00")


async def _capture_price_history(db: AsyncSession, line: SourceLineItem) -> None:
    if not line.product_id:
        return

    existing = (
        await db.execute(
            select(ProductPriceHistory).where(ProductPriceHistory.source_line_item_id == line.id)
        )
    ).scalar_one_or_none()
    if existing:
        return

    price = _effective_price(line.net_price, line.list_price, line.amount, line.quantity)
    if price <= 0:
        return

    db.add(
        ProductPriceHistory(
            product_id=line.product_id,
            source_document_id=line.source_document_id,
            source_line_item_id=line.id,
            price_type="net" if line.net_price and line.net_price > 0 else "list",
            price=price,
            currency="THB",
            quantity=line.quantity,
            unit=line.unit,
            observed_at=datetime.now(timezone.utc),
        )
    )


async def _get_or_create_source_document(
    db: AsyncSession,
    *,
    document_type: str,
    source_document_id: int,
    document_number: Optional[str],
    project_id: Optional[int],
    project_name: Optional[str],
    customer_name: Optional[str],
    source_created_at: Optional[datetime],
) -> tuple[SourceDocument, bool]:
    existing = (
        await db.execute(
            select(SourceDocument).where(
                SourceDocument.document_type == document_type,
                SourceDocument.source_document_id == source_document_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return existing, False

    doc = SourceDocument(
        document_type=document_type,
        source_document_id=source_document_id,
        document_number=document_number,
        project_id=project_id,
        project_name=project_name,
        customer_name=customer_name,
        source_created_at=source_created_at,
    )
    db.add(doc)
    await db.flush()
    return doc, True


async def backfill_from_existing_documents(db: AsyncSession) -> dict:
    alias_created = await _seed_product_aliases(db)
    products = (await db.execute(select(Product))).scalars().all()
    alias_rows = (await db.execute(select(ProductAlias.alias_text, ProductAlias.product_id))).all()
    alias_to_product = {row[0]: row[1] for row in alias_rows}

    stats = {
        "documents_created": 0,
        "lines_created": 0,
        "lines_auto_matched": 0,
        "lines_queued": 0,
        "aliases_created": alias_created,
    }

    q_stmt = (
        select(Quotation)
        .options(
            selectinload(Quotation.project).selectinload(Project.customer),
            selectinload(Quotation.sections),
            selectinload(Quotation.lines),
        )
        .order_by(Quotation.id)
    )
    quotations = (await db.execute(q_stmt)).scalars().all()

    for q in quotations:
        customer_name = None
        if q.project and getattr(q.project, "customer", None):
            customer_name = q.project.customer.name

        src_doc, created_doc = await _get_or_create_source_document(
            db,
            document_type="quotation",
            source_document_id=q.id,
            document_number=q.quotation_number,
            project_id=q.project_id,
            project_name=q.project.name if q.project else None,
            customer_name=customer_name,
            source_created_at=q.created_at,
        )
        if created_doc:
            stats["documents_created"] += 1

        existing_keys = {
            row[0]
            for row in (
                await db.execute(
                    select(SourceLineItem.source_line_key).where(SourceLineItem.source_document_id == src_doc.id)
                )
            ).all()
        }
        section_labels = {s.id: s.label for s in q.sections}

        for ln in q.lines:
            line_key = f"ql:{ln.id}"
            if line_key in existing_keys:
                continue

            staged = SourceLineItem(
                source_document_id=src_doc.id,
                source_line_key=line_key,
                seq=ln.seq,
                section_label=section_labels.get(ln.section_id),
                item_code=ln.item_code,
                description=ln.description,
                brand=ln.brand,
                unit=ln.unit,
                quantity=ln.quantity,
                list_price=ln.list_price,
                net_price=ln.net_price,
                amount=ln.amount,
            )
            db.add(staged)
            await db.flush()

            match = _match_line_item(staged.item_code, staged.description, products, alias_to_product)
            staged.match_confidence = match.confidence
            staged.match_method = match.method

            if match.product_id and match.confidence >= Decimal("90.00"):
                staged.product_id = match.product_id
                staged.match_status = "auto_matched"
                await _capture_price_history(db, staged)
                stats["lines_auto_matched"] += 1
            else:
                staged.match_status = "needs_review"
                await _upsert_review_queue(db, staged.id, match.product_id, match.confidence, match.reason)
                stats["lines_queued"] += 1

            stats["lines_created"] += 1

    boq_stmt = (
        select(BOQ)
        .options(
            selectinload(BOQ.project).selectinload(Project.customer),
            selectinload(BOQ.items),
        )
        .order_by(BOQ.id)
    )
    boqs = (await db.execute(boq_stmt)).scalars().all()

    for b in boqs:
        customer_name = None
        if b.project and getattr(b.project, "customer", None):
            customer_name = b.project.customer.name

        src_doc, created_doc = await _get_or_create_source_document(
            db,
            document_type="boq",
            source_document_id=b.id,
            document_number=b.name,
            project_id=b.project_id,
            project_name=b.project.name if b.project else None,
            customer_name=customer_name,
            source_created_at=b.created_at,
        )
        if created_doc:
            stats["documents_created"] += 1

        existing_keys = {
            row[0]
            for row in (
                await db.execute(
                    select(SourceLineItem.source_line_key).where(SourceLineItem.source_document_id == src_doc.id)
                )
            ).all()
        }

        for it in b.items:
            line_key = f"bi:{it.id}"
            if line_key in existing_keys:
                continue

            staged = SourceLineItem(
                source_document_id=src_doc.id,
                source_line_key=line_key,
                seq=it.seq,
                section_label=it.section_label,
                item_code=None,
                description=it.description,
                brand=None,
                unit=it.unit,
                quantity=it.quantity,
                list_price=Decimal("0.00"),
                net_price=Decimal("0.00"),
                amount=Decimal("0.00"),
            )
            db.add(staged)
            await db.flush()

            match = _match_line_item(staged.item_code, staged.description, products, alias_to_product)
            staged.match_confidence = match.confidence
            staged.match_method = match.method

            if it.product_id:
                staged.product_id = it.product_id
                staged.match_status = "confirmed"
                await _capture_price_history(db, staged)
                stats["lines_auto_matched"] += 1
            elif match.product_id and match.confidence >= Decimal("90.00"):
                staged.product_id = match.product_id
                staged.match_status = "auto_matched"
                await _capture_price_history(db, staged)
                stats["lines_auto_matched"] += 1
            else:
                staged.match_status = "needs_review"
                await _upsert_review_queue(db, staged.id, match.product_id, match.confidence, match.reason)
                stats["lines_queued"] += 1

            stats["lines_created"] += 1

    await db.commit()
    return stats


async def get_sourcing_stats(db: AsyncSession) -> dict:
    source_docs = (await db.execute(select(SourceDocument))).scalars().all()
    lines = (await db.execute(select(SourceLineItem))).scalars().all()
    queue_rows = (
        await db.execute(select(LineMatchReviewQueue).where(LineMatchReviewQueue.status == "pending"))
    ).scalars().all()

    return {
        "source_documents": len(source_docs),
        "staged_lines": len(lines),
        "pending_reviews": len(queue_rows),
        "auto_matched": sum(1 for x in lines if x.match_status == "auto_matched"),
        "confirmed": sum(1 for x in lines if x.match_status == "confirmed"),
    }


async def list_pending_reviews(db: AsyncSession, limit: int = 100) -> list[dict]:
    rows = (
        await db.execute(
            select(LineMatchReviewQueue)
            .options(selectinload(LineMatchReviewQueue.line_item).selectinload(SourceLineItem.source_document))
            .where(LineMatchReviewQueue.status == "pending")
            .order_by(LineMatchReviewQueue.created_at.asc())
            .limit(limit)
        )
    ).scalars().all()

    out: list[dict] = []
    for row in rows:
        line = row.line_item
        doc = line.source_document if line else None
        out.append(
            {
                "review_id": row.id,
                "line_item_id": line.id if line else None,
                "document_type": doc.document_type if doc else None,
                "document_number": doc.document_number if doc else None,
                "description": line.description if line else None,
                "item_code": line.item_code if line else None,
                "unit": line.unit if line else None,
                "quantity": str(line.quantity) if line and line.quantity is not None else None,
                "suggested_product_id": row.suggested_product_id,
                "confidence": str(row.confidence) if row.confidence is not None else None,
                "reason": row.reason,
                "status": row.status,
            }
        )
    return out


async def confirm_review_match(
    db: AsyncSession,
    review_id: int,
    product_id: int,
    reviewer_id: int,
    note: Optional[str] = None,
) -> dict:
    review = (
        await db.execute(
            select(LineMatchReviewQueue)
            .options(selectinload(LineMatchReviewQueue.line_item))
            .where(LineMatchReviewQueue.id == review_id)
        )
    ).scalar_one_or_none()
    if not review:
        raise ValueError("Review item not found")
    if review.status != "pending":
        raise ValueError("Review item is not pending")

    line = review.line_item
    if not line:
        raise ValueError("Related staged line not found")

    line.product_id = product_id
    line.match_status = "confirmed"
    line.match_method = "manual_review"
    line.match_confidence = Decimal("100.00")

    review.status = "resolved"
    review.reviewed_by = reviewer_id
    review.reviewed_at = datetime.now(timezone.utc)
    review.note = note
    review.suggested_product_id = product_id

    await _capture_price_history(db, line)
    await db.commit()

    return {
        "review_id": review.id,
        "line_item_id": line.id,
        "product_id": product_id,
        "status": review.status,
    }
