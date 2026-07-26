from functools import lru_cache
from pathlib import Path
from typing import Annotated
from urllib.parse import urlparse

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    app_name: str = "Schema Studio API"
    app_env: str = "development"
    app_debug: bool = True
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    log_level: str = "INFO"
    supabase_project_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SUPABASE_PROJECT_URL", "SUPABASE_URL"),
    )
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None
    supabase_jwt_secret: str | None = None
    supabase_db_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SUPABASE_DB_URL", "DATABASE_URL"),
    )
    supabase_direct_db_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SUPABASE_DIRECT_DB_URL", "DIRECT_DATABASE_URL"),
    )
    scan_cache_directory: str = "generated/scan-cache"
    export_directory: str = "exports/generated"
    upload_directory: str = "uploads"
    log_directory: str = "logs"
    scheduler_enabled: bool = True
    scheduler_poll_interval_seconds: int = 60

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def async_database_url(self) -> str | None:
        if not self.supabase_db_url:
            return None
        if self.supabase_db_url.startswith("postgresql+asyncpg://"):
            return self.supabase_db_url
        if self.supabase_db_url.startswith("postgresql://"):
            return self.supabase_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return self.supabase_db_url

    @property
    def sync_database_url(self) -> str | None:
        source = self.supabase_direct_db_url or self.supabase_db_url
        if not source:
            return None
        if source.startswith("postgresql+asyncpg://"):
            return source.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
        if source.startswith("postgresql://"):
            return source.replace("postgresql://", "postgresql+psycopg://", 1)
        return source

    @property
    def supabase_configured(self) -> bool:
        return bool(
            self.supabase_project_url
            and self.supabase_anon_key
            and self.supabase_service_role_key
            and self.supabase_jwt_secret
            and self.supabase_db_url
        )

    @property
    def supabase_auth_configured(self) -> bool:
        return bool(self.supabase_project_url and self.supabase_anon_key and self.supabase_jwt_secret)

    @property
    def supabase_project_ref(self) -> str | None:
        if not self.supabase_project_url:
            return None
        parsed = urlparse(self.supabase_project_url)
        hostname = parsed.hostname or ""
        if not hostname:
            return None
        return hostname.split(".")[0]

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parents[3]

    @property
    def scan_cache_path(self) -> Path:
        return self.project_root / self.scan_cache_directory

    @property
    def export_path(self) -> Path:
        return self.project_root / self.export_directory

    @property
    def upload_path(self) -> Path:
        return self.project_root / self.upload_directory

    @property
    def log_path(self) -> Path:
        return self.project_root / self.log_directory

    @property
    def required_runtime_values(self) -> dict[str, str | None]:
        return {
            "SUPABASE_URL": self.supabase_project_url,
            "SUPABASE_ANON_KEY": self.supabase_anon_key,
            "SUPABASE_SERVICE_ROLE_KEY": self.supabase_service_role_key,
            "SUPABASE_JWT_SECRET": self.supabase_jwt_secret,
            "DATABASE_URL": self.supabase_db_url,
        }

    def missing_runtime_values(self) -> list[str]:
        return [key for key, value in self.required_runtime_values.items() if not value]

    def assert_runtime_configured(self) -> None:
        missing = self.missing_runtime_values()
        if missing:
            missing_list = ", ".join(missing)
            raise RuntimeError(
                "Schema Studio requires Supabase configuration before startup. Missing: "
                f"{missing_list}."
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
