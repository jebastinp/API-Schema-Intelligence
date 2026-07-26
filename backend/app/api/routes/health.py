from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.bootstrap import ensure_runtime_directories
from app.core.config import settings
from app.db.health import check_database_health
from app.schemas.common import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def healthcheck() -> HealthResponse:
    directory_statuses = ensure_runtime_directories()
    database = await check_database_health()
    missing_values = settings.missing_runtime_values()
    env_configured = not missing_values
    overall_ok = env_configured and database["status"] == "ok"

    return HealthResponse(
        status="ok" if overall_ok else "degraded",
        service="schema-studio-backend",
        timestamp=datetime.now(timezone.utc),
        environment=settings.app_env,
        app_version="0.1.0",
        environment_variables={
            "configured": env_configured,
            "missing_values": missing_values,
        },
        database=database,
        directories=[status.__dict__ for status in directory_statuses],
    )
