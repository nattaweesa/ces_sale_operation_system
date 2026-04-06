from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.sourcing import BackfillRequest, ConfirmReviewRequest
from app.services.auth import get_current_user, require_roles
from app.services.sourcing_service import (
    backfill_from_existing_documents,
    confirm_review_match,
    get_sourcing_stats,
    list_pending_reviews,
)

router = APIRouter(prefix="/sourcing", tags=["sourcing"])


@router.post("/backfill")
async def run_backfill(
    payload: BackfillRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager", "sales_admin")),
):
    if not payload.run:
        raise HTTPException(status_code=400, detail="Request blocked. Set run=true to execute backfill")
    stats = await backfill_from_existing_documents(db)
    return {"status": "ok", "stats": stats}


@router.get("/stats")
async def sourcing_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager", "sales_admin")),
):
    return await get_sourcing_stats(db)


@router.get("/review-queue")
async def review_queue(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager", "sales_admin")),
):
    return await list_pending_reviews(db, limit=limit)


@router.post("/review-queue/{review_id}/confirm")
async def confirm_queue_match(
    review_id: int,
    payload: ConfirmReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await confirm_review_match(db, review_id, payload.product_id, current_user.id, payload.note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
