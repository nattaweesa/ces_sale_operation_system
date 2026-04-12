from __future__ import annotations
from typing import Optional
from typing import TYPE_CHECKING
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

if TYPE_CHECKING:
    from app.models.department import Department, UserDepartment


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(30), default="sales")  # admin | sales | sales_admin | manager | sale_upload
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    active_department_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("departments.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    active_department: Mapped[Optional["Department"]] = relationship("Department", foreign_keys=[active_department_id], lazy="select")
    department_links: Mapped[list["UserDepartment"]] = relationship(
        "UserDepartment", foreign_keys="UserDepartment.user_id", back_populates="user", cascade="all, delete-orphan"
    )
    quotation_uploads: Mapped[list["QuotationUploadFile"]] = relationship("QuotationUploadFile", back_populates="user", cascade="all, delete-orphan")
