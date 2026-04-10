from __future__ import annotations
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user_activity import UserActivityLog


async def log_activity(
    db: AsyncSession,
    user_id: int,
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    resource_label: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Add a UserActivityLog record to the current session (caller must commit)."""
    db.add(UserActivityLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        resource_label=resource_label,
        ip_address=ip_address,
    ))
