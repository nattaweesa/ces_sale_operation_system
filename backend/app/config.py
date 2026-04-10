from __future__ import annotations
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://ces:ces_secret@localhost:5432/ces_sale_operation"
    secret_key: str = "change-this-in-production"
    access_token_expire_minutes: int = 60
    storage_path: str = "./storage"
    frontend_origin: str = "http://localhost:5173"
    vat_rate: float = 7.0
    qt_number_prefix: str = "CES-QT"
    company_name: str = "CES Electrical Solutions"
    company_address: str = ""
    company_phone: str = ""
    company_email: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
