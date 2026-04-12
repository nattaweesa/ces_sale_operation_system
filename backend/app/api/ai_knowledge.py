from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.ai_knowledge import AIKnowledgeChunk, AIKnowledgeDocument
from app.models.user import User
from app.services.auth import require_roles
from app.services.quotation_intake_service import extract_text_from_pdf

router = APIRouter(prefix="/admin/ai-knowledge", tags=["admin-ai-knowledge"])
settings = get_settings()

MAX_UPLOAD_BYTES = 15 * 1024 * 1024


class AIKnowledgeDocumentOut(BaseModel):
    id: int
    title: str
    source_filename: str
    mime_type: Optional[str]
    content_chars: int
    chunk_count: int
    is_active: bool
    uploaded_by: int
    uploaded_by_name: Optional[str]
    created_at: str


class AIKnowledgeUploadOut(BaseModel):
    id: int
    title: str
    content_chars: int
    chunk_count: int


def _decode_text_bytes(raw: bytes) -> str:
    # Try utf-8 first; fallback keeps upload resilient to odd encodings.
    text = raw.decode("utf-8", errors="ignore")
    return "\n".join(line.rstrip() for line in text.splitlines()).strip()


def _extract_text_from_file(filename: str, content_type: Optional[str], raw: bytes) -> str:
    name = (filename or "").lower()
    ctype = (content_type or "").lower()

    if name.endswith(".pdf") or "pdf" in ctype:
        return extract_text_from_pdf(raw).strip()

    if any(name.endswith(ext) for ext in (".txt", ".md", ".csv", ".log", ".json", ".yaml", ".yml")):
        return _decode_text_bytes(raw)

    raise HTTPException(status_code=400, detail="รองรับเฉพาะไฟล์ PDF/TXT/MD/CSV/JSON/YAML")


def _split_chunks(text: str, max_chars: int = 1200, overlap: int = 180) -> list[str]:
    cleaned = "\n".join(line.rstrip() for line in text.splitlines() if line.strip())
    if len(cleaned) <= max_chars:
        return [cleaned]

    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = min(len(cleaned), start + max_chars)
        cut = end
        if end < len(cleaned):
            window = cleaned[start:end]
            boundary = max(window.rfind("\n\n"), window.rfind(". "), window.rfind(" "))
            if boundary > max_chars // 2:
                cut = start + boundary
        piece = cleaned[start:cut].strip()
        if piece:
            chunks.append(piece)
        if cut >= len(cleaned):
            break
        start = max(cut - overlap, start + 1)
    return chunks


@router.get("/documents", response_model=list[AIKnowledgeDocumentOut])
async def list_ai_knowledge_documents(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager")),
):
    chunk_count_subq = (
        select(AIKnowledgeChunk.document_id, func.count(AIKnowledgeChunk.id).label("chunk_count"))
        .group_by(AIKnowledgeChunk.document_id)
        .subquery()
    )

    rows = (
        await db.execute(
            select(
                AIKnowledgeDocument,
                User.full_name,
                func.coalesce(chunk_count_subq.c.chunk_count, 0),
            )
            .join(User, User.id == AIKnowledgeDocument.uploaded_by)
            .outerjoin(chunk_count_subq, chunk_count_subq.c.document_id == AIKnowledgeDocument.id)
            .order_by(desc(AIKnowledgeDocument.created_at))
            .limit(300)
        )
    ).all()

    return [
        AIKnowledgeDocumentOut(
            id=doc.id,
            title=doc.title,
            source_filename=doc.source_filename,
            mime_type=doc.mime_type,
            content_chars=doc.content_chars,
            chunk_count=int(chunk_count),
            is_active=doc.is_active,
            uploaded_by=doc.uploaded_by,
            uploaded_by_name=full_name,
            created_at=doc.created_at.isoformat(),
        )
        for doc, full_name, chunk_count in rows
    ]


@router.post("/documents/upload", response_model=AIKnowledgeUploadOut, status_code=201)
async def upload_ai_knowledge_document(
    title: Optional[str] = Form(default=None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "manager")),
):
    filename = file.filename or "document"
    raw = await file.read()

    if not raw:
        raise HTTPException(status_code=400, detail="ไฟล์ว่าง ไม่สามารถอัปโหลดได้")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="ไฟล์ใหญ่เกินไป (จำกัด 15MB)")

    text = _extract_text_from_file(filename, file.content_type, raw)
    if not text.strip() or len(text.strip()) < 40:
        raise HTTPException(status_code=400, detail="ไม่พบข้อความที่ใช้ได้ในไฟล์ กรุณาตรวจสอบไฟล์ก่อนอัปโหลด")

    safe_title = (title or "").strip() or os.path.splitext(filename)[0] or "Untitled manual"

    storage_dir = os.path.join(settings.storage_path, "ai_knowledge", str(current_user.id))
    os.makedirs(storage_dir, exist_ok=True)
    stored_name = f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex}_{filename}"
    stored_path = os.path.join(storage_dir, stored_name)

    async with aiofiles.open(stored_path, "wb") as out:
        await out.write(raw)

    row = AIKnowledgeDocument(
        title=safe_title,
        source_filename=filename,
        mime_type=file.content_type,
        stored_path=stored_path,
        content_text=text,
        content_chars=len(text),
        is_active=True,
        uploaded_by=current_user.id,
    )
    db.add(row)
    await db.flush()

    chunks = _split_chunks(text)
    for idx, piece in enumerate(chunks):
        db.add(
            AIKnowledgeChunk(
                document_id=row.id,
                chunk_index=idx,
                content_text=piece,
                content_chars=len(piece),
            )
        )

    await db.commit()
    await db.refresh(row)

    return AIKnowledgeUploadOut(id=row.id, title=row.title, content_chars=row.content_chars, chunk_count=len(chunks))


@router.delete("/documents/{document_id}", status_code=204)
async def deactivate_ai_knowledge_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager")),
):
    row = (
        await db.execute(select(AIKnowledgeDocument).where(AIKnowledgeDocument.id == document_id).limit(1))
    ).scalar_one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")

    row.is_active = False
    await db.execute(delete(AIKnowledgeChunk).where(AIKnowledgeChunk.document_id == row.id))
    await db.commit()
    return None
