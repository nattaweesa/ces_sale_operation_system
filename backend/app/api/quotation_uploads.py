from __future__ import annotations
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.quotation_upload import QuotationUploadFile
from app.services.auth import get_current_user, require_roles
from app.services.rbac import can_user
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/quotation-uploads", tags=["quotation-uploads"])

# Base directory for storing uploads
UPLOAD_BASE_DIR = os.path.join(settings.storage_path, "quotation-uploads")
os.makedirs(UPLOAD_BASE_DIR, exist_ok=True)

ALLOWED_TYPES = {"application/pdf"}


def _serialize_upload(file_record: QuotationUploadFile) -> dict:
    return {
        "id": file_record.id,
        "user_id": file_record.user_id,
        "username": file_record.user.username if file_record.user else None,
        "full_name": file_record.user.full_name if file_record.user else None,
        "filename": file_record.filename,
        "file_size": file_record.file_size,
        "uploaded_at": file_record.uploaded_at.isoformat(),
    }


@router.post("/upload", status_code=201)
async def upload_quotation_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("sale_upload")),
):
    """Upload a quotation PDF file. Only sale_upload role allowed."""
    
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF files allowed")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    
    # Create user directory
    user_dir = os.path.join(UPLOAD_BASE_DIR, f"user_{current_user.id}")
    os.makedirs(user_dir, exist_ok=True)
    
    # Generate safe filename with timestamp
    import uuid
    import secrets
    file_ext = os.path.splitext(file.filename)[1] or ".pdf"
    unique_name = f"{secrets.token_hex(8)}{uuid.uuid4().hex[:8]}{file_ext}"
    file_path = os.path.join(user_dir, unique_name)
    
    # Save file to disk
    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        file_size = len(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Create database record
    try:
        record = QuotationUploadFile(
            user_id=current_user.id,
            filename=file.filename,
            file_path=file_path,
            file_size=file_size,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        
        return {
            "id": record.id,
            "filename": record.filename,
            "file_size": record.file_size,
            "uploaded_at": record.uploaded_at.isoformat(),
        }
    except Exception as e:
        # Clean up file if DB operation fails
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to save record: {str(e)}")


@router.get("/my-uploads")
async def list_my_uploads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("sale_upload")),
):
    """List all upload files for current user."""
    
    stmt = (
        select(QuotationUploadFile)
        .options(selectinload(QuotationUploadFile.user))
        .where(QuotationUploadFile.user_id == current_user.id)
        .order_by(QuotationUploadFile.uploaded_at.desc())
    )
    result = await db.execute(stmt)
    files = result.scalars().all()
    
    return {
        "data": [_serialize_upload(f) for f in files]
    }


@router.get("/review")
async def list_all_uploads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not await can_user(db, current_user, "quotation_uploads.review_all"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    stmt = (
        select(QuotationUploadFile)
        .options(selectinload(QuotationUploadFile.user))
        .order_by(QuotationUploadFile.uploaded_at.desc())
    )
    result = await db.execute(stmt)
    files = result.scalars().all()

    return {"data": [_serialize_upload(f) for f in files]}


@router.get("/{file_id}/view")
async def view_upload_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(QuotationUploadFile)
        .options(selectinload(QuotationUploadFile.user))
        .where(QuotationUploadFile.id == file_id)
    )
    result = await db.execute(stmt)
    file_record = result.scalar_one_or_none()

    if not file_record or not os.path.exists(file_record.file_path):
        raise HTTPException(status_code=404, detail="File not found")

    has_review_all = await can_user(db, current_user, "quotation_uploads.review_all")
    if not has_review_all and current_user.id != file_record.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this file")

    return FileResponse(
        file_record.file_path,
        media_type="application/pdf",
        filename=file_record.filename,
    )


@router.delete("/{file_id}")
async def delete_upload_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("sale_upload")),
):
    """Delete a quotation upload file (only owner can delete)."""
    
    # Get file record
    stmt = select(QuotationUploadFile).where(QuotationUploadFile.id == file_id)
    result = await db.execute(stmt)
    file_record = result.scalar_one_or_none()
    
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check ownership
    if file_record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this file")
    
    # Delete from disk
    try:
        if os.path.exists(file_record.file_path):
            os.remove(file_record.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")
    
    # Delete from database
    await db.delete(file_record)
    await db.commit()
    
    return {"message": "File deleted successfully"}
