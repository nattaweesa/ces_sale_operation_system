from __future__ import annotations
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    full_name: str
    role: str
    active_department_id: int | None = None
    department_ids: list[int] = Field(default_factory=list)
