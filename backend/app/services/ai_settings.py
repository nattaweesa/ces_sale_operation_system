from __future__ import annotations
from typing import Optional, Tuple
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.ai_setting import AISetting


def _fernet(secret_key: str) -> Fernet:
    digest = hashlib.sha256(secret_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_api_key(api_key: str, secret_key: str) -> str:
    token = _fernet(secret_key).encrypt(api_key.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_api_key(token: str, secret_key: str) -> Optional[str]:
    try:
        val = _fernet(secret_key).decrypt(token.encode("utf-8"))
        return val.decode("utf-8")
    except (InvalidToken, ValueError):
        return None


def mask_api_key(api_key: str) -> str:
    if len(api_key) <= 8:
        return "*" * len(api_key)
    return f"{api_key[:6]}...{api_key[-4:]}"


async def get_ai_settings_row(db: AsyncSession) -> Optional[AISetting]:
    result = await db.execute(
        select(AISetting).where(AISetting.provider == "minimax").order_by(AISetting.id.asc()).limit(1)
    )
    return result.scalar_one_or_none()


async def resolve_minimax_runtime_config(db: AsyncSession) -> Tuple[Optional[str], str]:
    settings = get_settings()
    model = settings.minimax_model
    api_key: Optional[str] = settings.minimax_api_key or None

    row = await get_ai_settings_row(db)
    if not row:
        return api_key, model

    if row.model:
        model = row.model

    if row.api_key_encrypted:
        decrypted = decrypt_api_key(row.api_key_encrypted, settings.secret_key)
        if decrypted:
            api_key = decrypted

    return api_key, model
