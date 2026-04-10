from __future__ import annotations
from typing import Optional
from decimal import Decimal
import httpx

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.deal import Deal
from app.models.user import User
from app.services.auth import require_roles
from app.config import get_settings

router = APIRouter(prefix="/ai-chat", tags=["ai-chat"])

MINIMAX_URL = "https://api.minimaxi.chat/v1/text/chatcompletion_v2"


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class AIChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class AIChatResponse(BaseModel):
    response: str


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

    # 3. Per-owner pipeline (open deals only)
    owner_rows = (await db.execute(
        select(
            User.full_name,
            func.count(Deal.id),
            func.coalesce(func.sum(Deal.expected_value), 0),
            func.coalesce(func.avg(Deal.probability_pct), 0),
        )
        .join(User, Deal.owner_id == User.id)
        .where(Deal.status == "open")
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
        .where(Deal.status == "open")
    )).one()

    # ── Format ──
    lines: list[str] = []

    lines.append("=== ข้อมูลระบบ CES Sale Operation (ข้อมูล ณ ปัจจุบัน) ===\n")

    total_count, total_value = totals
    lines.append(f"## สรุป Open Deals ทั้งหมด")
    lines.append(f"- จำนวน Open Deal: {total_count} รายการ")
    lines.append(f"- มูลค่ารวม (Expected Value): {_fmt(total_value)} บาท\n")

    lines.append("## Deals แยกตาม Stage (deal_cycle_stage)")
    for stage, cnt, val in stage_rows:
        lines.append(f"- {stage}: {cnt} deal, มูลค่า {_fmt(val or 0)} บาท")
    lines.append("")

    lines.append("## Deals แยกตาม Status")
    for status, cnt, val in status_rows:
        lines.append(f"- {status}: {cnt} deal, มูลค่า {_fmt(val or 0)} บาท")
    lines.append("")

    lines.append("## Pipeline แยกตาม Sales (Open Deals เท่านั้น)")
    for owner_name, cnt, pipeline, avg_prob in owner_rows:
        lines.append(
            f"- {owner_name}: {cnt} deal, Pipeline {_fmt(pipeline)} บาท, avg probability {float(avg_prob):.0f}%"
        )
    lines.append("")

    lines.append("## 20 Deals ล่าสุด (เรียงตาม updated)")
    for d in recent_deals:
        close = str(d.expected_close_date) if d.expected_close_date else "-"
        lines.append(
            f"- [{d.id}] {d.title} | Owner: {d.full_name} | Stage: {d.deal_cycle_stage} | "
            f"Status: {d.status} | Value: {_fmt(d.expected_value)} | Prob: {d.probability_pct}% | Close: {close}"
        )

    return "\n".join(lines)


def _fmt(value) -> str:
    try:
        return f"{Decimal(str(value)):,.0f}"
    except Exception:
        return "0"


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/query", response_model=AIChatResponse)
async def ai_chat_query(
    request: AIChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "manager")),
):
    settings = get_settings()
    api_key = getattr(settings, "minimax_api_key", None)
    model = getattr(settings, "minimax_model", "MiniMax-M2.7-highspeed")

    if not api_key:
        raise HTTPException(status_code=503, detail="AI service not configured (MINIMAX_API_KEY missing)")

    # Fetch live DB context
    try:
        system_context = await _fetch_system_context(db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch system context: {exc}")

    system_prompt = (
        "คุณคือ AI Assistant ของระบบ CES Sale Operation ซึ่งเป็นระบบ CRM / Sales Pipeline ของบริษัท CES Electrical Solutions\n"
        "คุณตอบได้เฉพาะคำถามที่เกี่ยวกับข้อมูลในระบบนี้เท่านั้น เช่น Deals, Pipeline, Stage, Owner, มูลค่า, ลูกค้า ฯลฯ\n"
        "ถ้าถามเรื่องที่ไม่เกี่ยวกับระบบนี้ ให้ปฏิเสธอย่างสุภาพ\n"
        "ตอบเป็นภาษาไทยเสมอ ยกเว้นคำศัพท์เฉพาะอาจใช้ภาษาอังกฤษได้\n"
        "ให้คำตอบที่ชัดเจน กระชับ และเป็นประโยชน์\n\n"
        + system_context
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

    return AIChatResponse(response=ai_text)
