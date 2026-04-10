from __future__ import annotations
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.ai_setting import AISetting
from app.models.user import User
from app.services.activity import log_activity
from app.services.ai_settings import (
    decrypt_api_key,
    encrypt_api_key,
    get_ai_settings_row,
    mask_api_key,
    resolve_minimax_runtime_config,
)
from app.services.auth import require_roles

router = APIRouter(prefix="/admin/ai-settings", tags=["admin"])
MINIMAX_URL = "https://api.minimaxi.chat/v1/text/chatcompletion_v2"


class AISettingsOut(BaseModel):
    provider: str = "minimax"
    model: str
    has_api_key: bool
    api_key_masked: Optional[str]
    updated_at: Optional[datetime]
    updated_by_name: Optional[str]


class AISettingsUpdateIn(BaseModel):
    model: str = Field(..., min_length=2, max_length=100)
    api_key: Optional[str] = Field(default=None, min_length=10, max_length=512)
    clear_api_key: bool = False


class AISettingsTestOut(BaseModel):
    ok: bool
    detail: str
    model: str


@router.get("", response_model=AISettingsOut)
async def get_ai_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    env = get_settings()
    row = await get_ai_settings_row(db)

    if not row:
        env_key = env.minimax_api_key or ""
        return AISettingsOut(
            model=env.minimax_model,
            has_api_key=bool(env_key),
            api_key_masked=mask_api_key(env_key) if env_key else None,
            updated_at=None,
            updated_by_name=None,
        )

    updater_name: Optional[str] = None
    if row.updated_by:
        updater_name = (
            await db.execute(select(User.full_name).where(User.id == row.updated_by).limit(1))
        ).scalar_one_or_none()

    decrypted = decrypt_api_key(row.api_key_encrypted, env.secret_key) if row.api_key_encrypted else None
    return AISettingsOut(
        model=row.model or env.minimax_model,
        has_api_key=bool(decrypted),
        api_key_masked=mask_api_key(decrypted) if decrypted else None,
        updated_at=row.updated_at,
        updated_by_name=updater_name,
    )


@router.put("", response_model=AISettingsOut)
async def update_ai_settings(
    payload: AISettingsUpdateIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    row = await get_ai_settings_row(db)
    env = get_settings()

    if not row:
        row = AISetting(provider="minimax", model=payload.model, updated_by=current_user.id)
        db.add(row)

    row.model = payload.model
    row.updated_by = current_user.id

    if payload.clear_api_key:
        row.api_key_encrypted = None
    elif payload.api_key:
        row.api_key_encrypted = encrypt_api_key(payload.api_key.strip(), env.secret_key)

    await db.flush()

    await log_activity(
        db,
        user_id=current_user.id,
        action="ai.settings.update",
        resource_type="ai_settings",
        resource_id=row.id,
        resource_label=f"provider=minimax model={row.model}",
    )

    await db.commit()
    await db.refresh(row)

    decrypted = decrypt_api_key(row.api_key_encrypted, env.secret_key) if row.api_key_encrypted else None
    return AISettingsOut(
        model=row.model,
        has_api_key=bool(decrypted),
        api_key_masked=mask_api_key(decrypted) if decrypted else None,
        updated_at=row.updated_at,
        updated_by_name=current_user.full_name,
    )


@router.post("/test", response_model=AISettingsTestOut)
async def test_ai_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    api_key, model = await resolve_minimax_runtime_config(db)
    if not api_key:
        raise HTTPException(status_code=400, detail="ยังไม่ได้ตั้งค่า API key")

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "ทดสอบการเชื่อมต่อ"}],
        "temperature": 0.1,
        "max_tokens": 64,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
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
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"เชื่อมต่อ Minimax ไม่สำเร็จ: {exc}")

    base = data.get("base_resp") if isinstance(data, dict) else None
    if isinstance(base, dict) and (base.get("status_code") not in (0, None)):
        raise HTTPException(status_code=400, detail=f"Minimax error: {base.get('status_msg') or base.get('status_code')}")

    return AISettingsTestOut(ok=True, detail="เชื่อมต่อ Minimax สำเร็จ", model=model)
