from __future__ import annotations
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import get_settings
from app.database import engine, Base, AsyncSessionLocal
from app.models import *  # noqa – ensures all models are registered
from app.api import auth, users, brands, categories, products, customers, projects, boqs, quotations, material_approval, deals, sourcing, quotation_intake, master_data_ingestion, boq_pricing_v2, role_permissions, quotation_master_data, quotation_uploads, deal_master_data, departments
from app.api import admin_activity
from app.api import ai_chat
from app.api import ai_settings
from app.services.auth import hash_password

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    is_production = os.getenv("ENVIRONMENT", "").lower() == "production"

    # Dev convenience only: in production, schema must be managed via Alembic.
    if not is_production:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # Create storage directories
    for sub in ("attachments", "quotations", "material_approvals", "uploaded_quotations", "master_data_ingestion"):
        os.makedirs(os.path.join(settings.storage_path, sub), exist_ok=True)

    # Seed default admin user only in non-production environments.
    if not is_production:
        async with AsyncSessionLocal() as db:
            from app.models.user import User
            result = await db.execute(select(User).where(User.role == "admin").limit(1))
            if not result.scalar_one_or_none():
                admin = User(
                    username="admin",
                    full_name="System Admin",
                    email="admin@ces.local",
                    role="admin",
                    password_hash=hash_password("admin1234"),
                )
                db.add(admin)
                await db.commit()
                print("✅ Default admin created: username=admin password=admin1234")

    yield


app = FastAPI(
    title="CES Sale Operation API",
    version="1.0.0",
    description="Backend API for CES Sale Operation System",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(brands.router)
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(customers.router)
app.include_router(projects.router)
app.include_router(boqs.router)
app.include_router(quotations.router)
app.include_router(material_approval.router)
app.include_router(deals.router)
app.include_router(sourcing.router)
app.include_router(quotation_intake.router)
app.include_router(master_data_ingestion.router)
app.include_router(quotation_master_data.router)
app.include_router(boq_pricing_v2.router)
app.include_router(role_permissions.router)
app.include_router(quotation_uploads.router)
app.include_router(deal_master_data.router)
app.include_router(departments.router)
app.include_router(admin_activity.router)
app.include_router(ai_chat.router)
app.include_router(ai_settings.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "CES Sale Operation API"}
