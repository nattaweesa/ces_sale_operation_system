from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional
from decimal import Decimal
import httpx

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from app.database import get_db
from app.models.ai_chat_history import AIChatConversation, AIChatMessage
from app.models.deal import Deal
from app.models.ai_knowledge import AIKnowledgeChunk, AIKnowledgeDocument
from app.models.user import User
from app.services.ai_settings import resolve_minimax_runtime_config
from app.services.auth import require_roles

router = APIRouter(prefix="/ai-chat", tags=["ai-chat"])

MINIMAX_URL = "https://api.minimaxi.chat/v1/text/chatcompletion_v2"
MAX_MESSAGES_PER_CONVERSATION = 100
RETENTION_DAYS = 30


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class AIChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class AIChatResponse(BaseModel):
    response: str


class ChatHistoryMessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: str


class ChatHistoryOut(BaseModel):
    conversation_id: int
    max_messages: int
    retention_days: int
    messages: list[ChatHistoryMessageOut]


def _extract_minimax_text(data: dict) -> str:
    """Extract assistant text from Minimax response and raise friendly errors."""
    base_resp = data.get("base_resp") if isinstance(data, dict) else None
    if isinstance(base_resp, dict):
        code = base_resp.get("status_code")
        msg = str(base_resp.get("status_msg") or "")
        if code not in (0, None):
            if "insufficient balance" in msg.lower():
                raise HTTPException(
                    status_code=502,
                    detail="Minimax balance ไม่พอ กรุณาเติมเครดิตก่อนใช้งาน AI Chat",
                )
            raise HTTPException(status_code=502, detail=f"Minimax API error: {msg or f'code {code}'}")

    choices = data.get("choices") if isinstance(data, dict) else None
    if isinstance(choices, list) and choices:
        msg = choices[0].get("message") if isinstance(choices[0], dict) else None
        if isinstance(msg, dict):
            content = msg.get("content")
            if isinstance(content, str) and content.strip():
                return content

    # Some responses may use a top-level reply/text field.
    for key in ("reply", "text", "output_text"):
        val = data.get(key) if isinstance(data, dict) else None
        if isinstance(val, str) and val.strip():
            return val

    raise HTTPException(status_code=502, detail="Minimax response ไม่มีข้อความที่อ่านได้")


# ── DB context helpers ────────────────────────────────────────────────────────

async def _fetch_system_context(db: AsyncSession) -> str:
    """Fetch a live snapshot from the DB and return as a formatted string."""

    # 1. Deals by stage
    stage_rows = (await db.execute(
        select(Deal.deal_cycle_stage, func.count(Deal.id), func.sum(Deal.expected_value))
        .group_by(Deal.deal_cycle_stage)
        .order_by(Deal.deal_cycle_stage)
    )).all()

    # 2. Deals by status
    status_rows = (await db.execute(
        select(Deal.status, func.count(Deal.id), func.sum(Deal.expected_value))
        .group_by(Deal.status)
        .order_by(Deal.status)
    )).all()

    # 3. Per-owner pipeline (active deals only; internal CES stage not closed)
    owner_rows = (await db.execute(
        select(
            User.full_name,
            func.count(Deal.id),
            func.coalesce(func.sum(Deal.expected_value), 0),
            func.coalesce(func.avg(Deal.probability_pct), 0),
        )
        .join(User, Deal.owner_id == User.id)
        .where(Deal.deal_cycle_stage.notin_(["won", "lost"]))
        .group_by(User.full_name)
        .order_by(func.sum(Deal.expected_value).desc())
    )).all()

    # 4. Last 20 open deals (lightweight)
    recent_deals = (await db.execute(
        select(
            Deal.id,
            Deal.title,
            User.full_name,
            Deal.deal_cycle_stage,
            Deal.status,
            Deal.expected_value,
            Deal.probability_pct,
            Deal.expected_close_date,
        )
        .join(User, Deal.owner_id == User.id)
        .order_by(Deal.updated_at.desc())
        .limit(20)
    )).all()

    # 5. Summary totals
    totals = (await db.execute(
        select(
            func.count(Deal.id),
            func.coalesce(func.sum(Deal.expected_value), 0),
        )
        .where(Deal.deal_cycle_stage.notin_(["won", "lost"]))
    )).one()

    # ── Format ──
    lines: list[str] = []

    lines.append("=== ข้อมูลระบบ CES Sale Operation (ข้อมูล ณ ปัจจุบัน) ===\n")

    total_count, total_value = totals
    lines.append(f"## สรุป Active Deals ทั้งหมด")
    lines.append(f"- จำนวน Active Deal: {total_count} รายการ")
    lines.append(f"- มูลค่ารวม (Expected Value): {_fmt(total_value)} บาท\n")

    lines.append("## Deals แยกตาม CES Stage (deal_cycle_stage)")
    for stage, cnt, val in stage_rows:
        lines.append(f"- {stage}: {cnt} deal, มูลค่า {_fmt(val or 0)} บาท")
    lines.append("")

    lines.append("## Deals แยกตาม Project Status")
    for status, cnt, val in status_rows:
        lines.append(f"- {status}: {cnt} deal, มูลค่า {_fmt(val or 0)} บาท")
    lines.append("")

    lines.append("## Pipeline แยกตาม Sales (Active Deals เท่านั้น)")
    for owner_name, cnt, pipeline, avg_prob in owner_rows:
        lines.append(
            f"- {owner_name}: {cnt} deal, Pipeline {_fmt(pipeline)} บาท, avg probability {float(avg_prob):.0f}%"
        )
    lines.append("")

    lines.append("## 20 Deals ล่าสุด (เรียงตาม updated)")
    for d in recent_deals:
        close = str(d.expected_close_date) if d.expected_close_date else "-"
        lines.append(
            f"- [{d.id}] {d.title} | Owner: {d.full_name} | CES Stage: {d.deal_cycle_stage} | "
            f"Project Status: {d.status} | Value: {_fmt(d.expected_value)} | Prob: {d.probability_pct}% | Close: {close}"
        )

    return "\n".join(lines)


def _fmt(value) -> str:
    try:
        return f"{Decimal(str(value)):,.0f}"
    except Exception:
        return "0"


def _tokenize_query(text: str) -> list[str]:
    terms: list[str] = []
    for raw in (text or "").lower().split():
        t = "".join(ch for ch in raw if ch.isalnum() or ch in "_-")
        if len(t) >= 2 and t not in terms:
            terms.append(t)
    return terms[:10]


def _build_snippet(content: str, terms: list[str], max_len: int = 500) -> str:
    lower = content.lower()
    start = 0
    for t in terms:
        idx = lower.find(t)
        if idx >= 0:
            start = max(0, idx - 120)
            break
    end = min(len(content), start + max_len)
    snippet = content[start:end].strip()
    return snippet + ("..." if end < len(content) else "")


async def _fetch_knowledge_context(db: AsyncSession, user_query: str) -> str:
    terms = _tokenize_query(user_query)
    rows = (
        await db.execute(
            select(AIKnowledgeChunk, AIKnowledgeDocument)
            .join(AIKnowledgeDocument, AIKnowledgeDocument.id == AIKnowledgeChunk.document_id)
            .where(AIKnowledgeDocument.is_active == True)
            .order_by(AIKnowledgeDocument.updated_at.desc())
            .limit(1500)
        )
    ).all()

    if not rows:
        return ""

    ranked: list[tuple[int, AIKnowledgeChunk, AIKnowledgeDocument]] = []
    for chunk, doc in rows:
        content_lower = (chunk.content_text or "").lower()
        title_lower = (doc.title or "").lower()
        if terms:
            score = sum(content_lower.count(t) for t in terms) + 3 * sum(title_lower.count(t) for t in terms)
            if score <= 0:
                continue
        else:
            score = 1
        ranked.append((score, chunk, doc))

    if not ranked:
        return ""

    ranked.sort(key=lambda x: x[0], reverse=True)
    top_chunks = ranked[:6]

    lines: list[str] = ["=== คู่มือ/เอกสารอ้างอิงเพิ่มเติม (AI Knowledge Chunks) ==="]
    for i, (score, chunk, doc) in enumerate(top_chunks, start=1):
        cite = f"K{i}"
        snippet = _build_snippet(chunk.content_text or "", terms)
        lines.append(f"- [{cite}] เอกสาร: {doc.title} | source: {doc.source_filename} | chunk: {chunk.chunk_index} | score: {score}")
        lines.append(f"  เนื้อหา: {snippet}")

    return "\n".join(lines)


async def _get_or_create_conversation(db: AsyncSession, user_id: int) -> AIChatConversation:
    conv = (
        await db.execute(
            select(AIChatConversation)
            .where(AIChatConversation.user_id == user_id)
            .order_by(AIChatConversation.updated_at.desc(), AIChatConversation.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if conv:
        return conv

    conv = AIChatConversation(user_id=user_id, title="AI Chat")
    db.add(conv)
    await db.flush()
    return conv


async def _trim_conversation_messages(db: AsyncSession, conversation_id: int) -> None:
    ids = (
        await db.execute(
            select(AIChatMessage.id)
            .where(AIChatMessage.conversation_id == conversation_id)
            .order_by(AIChatMessage.id.desc())
        )
    ).scalars().all()
    if len(ids) <= MAX_MESSAGES_PER_CONVERSATION:
        return
    keep = ids[:MAX_MESSAGES_PER_CONVERSATION]
    await db.execute(
        delete(AIChatMessage).where(
            AIChatMessage.conversation_id == conversation_id,
            AIChatMessage.id.notin_(keep),
        )
    )


async def _cleanup_old_messages(db: AsyncSession, user_id: int) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    conversation_ids = (
        await db.execute(select(AIChatConversation.id).where(AIChatConversation.user_id == user_id))
    ).scalars().all()
    if not conversation_ids:
        return
    await db.execute(
        delete(AIChatMessage).where(
            AIChatMessage.conversation_id.in_(conversation_ids),
            AIChatMessage.created_at < cutoff,
        )
    )


@router.get("/history", response_model=ChatHistoryOut)
async def get_chat_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "manager")),
):
    await _cleanup_old_messages(db, current_user.id)
    conversation = await _get_or_create_conversation(db, current_user.id)
    rows = (
        await db.execute(
            select(AIChatMessage)
            .where(AIChatMessage.conversation_id == conversation.id)
            .order_by(AIChatMessage.id.desc())
            .limit(MAX_MESSAGES_PER_CONVERSATION)
        )
    ).scalars().all()
    messages = list(reversed(rows))
    await db.commit()
    return ChatHistoryOut(
        conversation_id=conversation.id,
        max_messages=MAX_MESSAGES_PER_CONVERSATION,
        retention_days=RETENTION_DAYS,
        messages=[
            ChatHistoryMessageOut(
                id=m.id,
                role=m.role,
                content=m.content,
                created_at=m.created_at.isoformat(),
            )
            for m in messages
        ],
    )


@router.delete("/history", status_code=204)
async def clear_chat_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "manager")),
):
    conversation = await _get_or_create_conversation(db, current_user.id)
    await db.execute(delete(AIChatMessage).where(AIChatMessage.conversation_id == conversation.id))
    await db.commit()
    return None


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/query", response_model=AIChatResponse)
async def ai_chat_query(
    request: AIChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "manager")),
):
    api_key, model = await resolve_minimax_runtime_config(db)

    if not api_key:
        raise HTTPException(status_code=503, detail="AI service not configured (MINIMAX_API_KEY missing)")

    # Fetch live DB context
    try:
        system_context = await _fetch_system_context(db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch system context: {exc}")

    try:
        knowledge_context = await _fetch_knowledge_context(db, request.message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch AI knowledge context: {exc}")

    system_prompt = (
        "คุณคือ AI Assistant ของระบบ CES Sale Operation ซึ่งเป็นระบบ CRM / Sales Pipeline ของบริษัท CES Electrical Solutions\n"
        "คุณตอบได้จาก 2 แหล่งข้อมูล: (1) ข้อมูลระบบสดจากฐานข้อมูล และ (2) เอกสารคู่มือที่ผู้ใช้อัปโหลดไว้ใน AI Knowledge\n"
        "ถ้าคำถามไม่พบข้อมูลจากทั้งสองแหล่ง ให้ปฏิเสธอย่างสุภาพ\n"
        "ตอบเป็นภาษาไทยเสมอ ยกเว้นคำศัพท์เฉพาะอาจใช้ภาษาอังกฤษได้\n"
        "ให้คำตอบที่ชัดเจน กระชับ และเป็นประโยชน์\n"
        "ถ้าเป็นข้อมูลเปรียบเทียบ/หลายรายการ ให้ตอบเป็นตาราง Markdown (GFM)\n"
        "หากอ้างอิงจากเอกสารคู่มือ ให้ใส่ citation ที่ท้ายประโยคในรูปแบบ [K1], [K2] ตามที่ให้ไว้ใน context\n"
        "นิยามข้อมูลสำคัญ: deal_cycle_stage คือ CES Stage ภายในบริษัท CES เช่น lead, qualified, proposal, negotiation, won, lost\n"
        "นิยามข้อมูลสำคัญ: status คือ Project Status ของหน้างานฝั่งลูกค้า/ผู้รับเหมา เช่น design, bidding, award, on_hold\n"
        "นิยามข้อมูลสำคัญ: expected_value คือมูลค่าคาดการณ์ที่ใช้ในระบบอยู่แล้ว ห้ามนำ expected_value ไปคูณ probability_pct ซ้ำ เว้นแต่ผู้ใช้สั่งให้คำนวณสมมติฐานใหม่อย่างชัดเจน\n"
        "นิยามข้อมูลสำคัญ: probability_pct คือเปอร์เซ็นต์โอกาสของดีล\n"
        "หากมีการคำนวณ ให้ระบุสูตรและตัวแปรที่ใช้ให้ชัดเจน และแยกผลคำนวณใหม่ออกจากค่าจริงในระบบ\n"
        "อย่าใส่ <think> หรือ reasoning ภายในคำตอบ\n\n"
        + system_context
        + ("\n\n" + knowledge_context if knowledge_context else "")
    )

    # Build message list for Minimax
    messages = [{"role": "system", "content": system_prompt}]
    for msg in request.history[-10:]:  # Keep last 10 turns to limit token usage
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.message})

    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 1024,
        "temperature": 0.3,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                MINIMAX_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Minimax API error: {exc.response.status_code} {exc.response.text[:200]}",
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Minimax API unreachable: {exc}")

    ai_text = _extract_minimax_text(data)

    # Persist user + assistant messages, then enforce retention and max-lines limit.
    conversation = await _get_or_create_conversation(db, current_user.id)
    db.add(AIChatMessage(conversation_id=conversation.id, role="user", content=request.message.strip()))
    db.add(AIChatMessage(conversation_id=conversation.id, role="assistant", content=ai_text))
    conversation.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await _trim_conversation_messages(db, conversation.id)
    await _cleanup_old_messages(db, current_user.id)
    await db.commit()

    return AIChatResponse(response=ai_text)
