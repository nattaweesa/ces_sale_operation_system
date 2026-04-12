from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.department import UserDepartment
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.auth import verify_password, create_access_token, password_token_marker
from app.services.activity import log_activity

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    username = payload.username.strip()
    result = await db.execute(
        select(User).where(func.lower(User.username) == username.lower(), User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Record login
    user.last_login_at = datetime.now(timezone.utc)
    ip = None
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        ip = forwarded_for.split(",")[0].strip()
    elif request.client:
        ip = request.client.host
    await log_activity(db, user.id, "login", ip_address=ip)
    await db.commit()

    token = create_access_token({"sub": str(user.id), "pwh": password_token_marker(user.password_hash)})
    dept_rows = await db.execute(
        select(UserDepartment.department_id).where(UserDepartment.user_id == user.id)
    )
    department_ids = sorted({int(v) for v in dept_rows.scalars().all()})

    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        active_department_id=user.active_department_id,
        department_ids=department_ids,
    )
