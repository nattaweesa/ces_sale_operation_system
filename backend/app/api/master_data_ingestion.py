from __future__ import annotations

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.master_data_ingestion import (
    BatchDetailOut,
    BatchWithDocumentsOut,
    CanonicalDescriptionSuggestionOut,
    CanonicalDescriptionSuggestionRequest,
    CandidateListOut,
    CandidateOut,
    IngestionBatchOut,
    IngestionDocumentOut,
    PublishedEvidenceListOut,
    PublishedEvidenceOut,
    ReviewCandidateOut,
    ReviewCandidateRequest,
    UploadBatchOut,
)
from app.services.auth import get_current_user, require_roles
from app.services.master_data_service import (
    REVIEWER_ROLES,
    UPLOADER_ROLES,
    get_batch_detail,
    get_candidate,
    list_batches,
    list_candidates,
    list_published_evidence,
    list_published_evidence_for_product,
    reprocess_batch,
    review_candidate,
    suggest_canonical_description,
    upload_batch,
)

router = APIRouter(prefix="/master-data", tags=["master-data-ingestion"])


def _batch_out(row) -> IngestionBatchOut:
    return IngestionBatchOut(
        id=row.id,
        uploaded_by=row.uploaded_by,
        status=row.status,
        total_files=row.total_files,
        processed_files=row.processed_files,
        failed_files=row.failed_files,
        created_at=row.created_at.isoformat(),
    )


def _doc_out(row) -> IngestionDocumentOut:
    return IngestionDocumentOut(
        id=row.id,
        batch_id=row.batch_id,
        original_filename=row.original_filename,
        status=row.status,
        parse_notes=row.parse_notes,
    )


def _candidate_out(c) -> CandidateOut:
    norm = c.normalized_line
    raw = norm.raw_line if norm else None
    return CandidateOut(
        id=c.id,
        normalized_line_id=c.normalized_line_id,
        candidate_code=c.candidate_code,
        canonical_description=c.canonical_description,
        canonical_brand=c.canonical_brand,
        selected_list_price=float(c.selected_list_price) if c.selected_list_price is not None else None,
        status=c.status,
        chosen_product_id=c.chosen_product_id,
        reviewed_by=c.reviewed_by,
        reviewed_at=c.reviewed_at.isoformat() if c.reviewed_at else None,
        review_note=c.review_note,
        source_item_code=norm.item_code_norm if norm else None,
        source_description=norm.description_norm if norm else None,
        source_brand=norm.brand_norm if norm else None,
        source_classification=norm.classification if norm else None,
        suggestions=[
            {
                "id": s.id,
                "product_id": s.product_id,
                "method": s.method,
                "confidence": float(s.confidence),
                "notes": s.notes,
            }
            for s in c.suggestions
        ],
        price_observations=[
            {
                "id": p.id,
                "observed_list_price": float(p.observed_list_price),
                "currency": p.currency,
                "observed_at": p.observed_at.isoformat(),
            }
            for p in c.price_observations
        ],
    )


@router.post("/batches/upload", response_model=UploadBatchOut)
async def upload_ingestion_batch(
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*UPLOADER_ROLES)),
    current_user: User = Depends(get_current_user),
):
    if not files:
        raise HTTPException(status_code=400, detail="Please upload at least one PDF")

    for f in files:
        if not (f.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"Only PDF is supported in v1: {f.filename}")

    batch = await upload_batch(db, current_user.id, files)
    return UploadBatchOut(batch_id=batch.id, status=batch.status, total_files=batch.total_files)


@router.get("/batches", response_model=list[BatchWithDocumentsOut])
async def get_batches(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*UPLOADER_ROLES)),
):
    rows = await list_batches(db, limit)
    result: list[BatchWithDocumentsOut] = []
    for b in rows:
        detail = await get_batch_detail(db, b.id)
        docs = detail.documents if detail else []
        result.append(BatchWithDocumentsOut(batch=_batch_out(b), documents=[_doc_out(d) for d in docs]))
    return result


@router.get("/batches/{batch_id}", response_model=BatchDetailOut)
async def get_batch(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*UPLOADER_ROLES)),
):
    detail = await get_batch_detail(db, batch_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Batch not found")

    headers = []
    raw_lines = []
    normalized_lines = []

    for d in detail.documents:
        if d.header:
            headers.append(
                {
                    "quotation_number": d.header.quotation_number,
                    "project_name": d.header.project_name,
                    "quote_date_text": d.header.quote_date_text,
                    "subject": d.header.subject,
                }
            )
        for rl in d.raw_lines:
            raw_lines.append(
                {
                    "id": rl.id,
                    "line_no": rl.line_no,
                    "raw_text": rl.raw_text,
                    "item_code_raw": rl.item_code_raw,
                    "description_raw": rl.description_raw,
                    "brand_raw": rl.brand_raw,
                    "list_price_raw": rl.list_price_raw,
                    "qty_raw": rl.qty_raw,
                    "discount_text_raw": rl.discount_text_raw,
                    "total_amount_raw": rl.total_amount_raw,
                    "parse_notes": rl.parse_notes,
                }
            )
            if rl.normalized_line:
                nl = rl.normalized_line
                normalized_lines.append(
                    {
                        "id": nl.id,
                        "raw_line_id": nl.raw_line_id,
                        "classification": nl.classification,
                        "item_code_norm": nl.item_code_norm,
                        "description_norm": nl.description_norm,
                        "brand_norm": nl.brand_norm,
                        "list_price_norm": float(nl.list_price_norm) if nl.list_price_norm is not None else None,
                        "qty_norm": float(nl.qty_norm) if nl.qty_norm is not None else None,
                        "amount_norm": float(nl.amount_norm) if nl.amount_norm is not None else None,
                        "uncertain": bool(nl.uncertain),
                        "normalize_notes": nl.normalize_notes,
                    }
                )

    return BatchDetailOut(
        batch=_batch_out(detail),
        documents=[_doc_out(d) for d in detail.documents],
        headers=headers,
        raw_lines=raw_lines,
        normalized_lines=normalized_lines,
    )


@router.post("/batches/{batch_id}/reprocess", response_model=IngestionBatchOut)
async def reprocess_ingestion_batch(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*UPLOADER_ROLES)),
):
    try:
        row = await reprocess_batch(db, batch_id)
        return _batch_out(row)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/candidates", response_model=CandidateListOut)
async def get_candidates(
    status: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*REVIEWER_ROLES)),
):
    rows = await list_candidates(db, status, limit)
    return CandidateListOut(items=[_candidate_out(c) for c in rows])


@router.get("/candidates/{candidate_id}", response_model=CandidateOut)
async def get_candidate_detail(
    candidate_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*REVIEWER_ROLES)),
):
    row = await get_candidate(db, candidate_id)
    if not row:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return _candidate_out(row)


@router.post("/candidates/{candidate_id}/ai-canonical", response_model=CanonicalDescriptionSuggestionOut)
async def ai_canonical_suggestion(
    candidate_id: int,
    payload: CanonicalDescriptionSuggestionRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*REVIEWER_ROLES)),
):
    row = await get_candidate(db, candidate_id)
    if not row:
        raise HTTPException(status_code=404, detail="Candidate not found")
    suggestion, provider = await suggest_canonical_description(payload.draft_description)
    return CanonicalDescriptionSuggestionOut(suggestion=suggestion, provider=provider)


@router.post("/candidates/{candidate_id}/review", response_model=ReviewCandidateOut)
async def review_candidate_action(
    candidate_id: int,
    payload: ReviewCandidateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*REVIEWER_ROLES)),
    current_user: User = Depends(get_current_user),
):
    try:
        candidate, product_id = await review_candidate(
            db,
            candidate_id,
            current_user.id,
            action=payload.action,
            target_product_id=payload.target_product_id,
            canonical_description=payload.canonical_description,
            selected_list_price=None if payload.selected_list_price is None else Decimal(str(payload.selected_list_price)),
            note=payload.note,
        )
        return ReviewCandidateOut(candidate_id=candidate.id, action=payload.action, status=candidate.status, product_id=product_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/published-evidence", response_model=PublishedEvidenceListOut)
async def get_published_evidence(
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*REVIEWER_ROLES)),
):
    rows = await list_published_evidence(db, limit)
    return PublishedEvidenceListOut(
        items=[
            PublishedEvidenceOut(
                action_id=r.id,
                candidate_id=r.candidate_id,
                product_id=r.product_id,
                selected_list_price=float(r.selected_list_price) if r.selected_list_price is not None else None,
                reviewer_id=r.reviewer_id,
                created_at=r.created_at.isoformat(),
                notes=r.notes,
                evidence_json=r.evidence_json,
            )
            for r in rows if r.product_id is not None
        ]
    )


@router.get("/published-evidence/{product_id}", response_model=PublishedEvidenceListOut)
async def get_published_evidence_for_product(
    product_id: int,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*REVIEWER_ROLES)),
):
    rows = await list_published_evidence_for_product(db, product_id, limit)
    return PublishedEvidenceListOut(
        items=[
            PublishedEvidenceOut(
                action_id=r.id,
                candidate_id=r.candidate_id,
                product_id=r.product_id,
                selected_list_price=float(r.selected_list_price) if r.selected_list_price is not None else None,
                reviewer_id=r.reviewer_id,
                created_at=r.created_at.isoformat(),
                notes=r.notes,
                evidence_json=r.evidence_json,
            )
            for r in rows if r.product_id is not None
        ]
    )
