from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.bootstrap import ensure_runtime_directories, verify_runtime_configuration
from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.db.health import check_database_health
from app.services.scheduled_scans import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_runtime_directories()
    configure_logging(settings.log_level)
    logger = get_logger("app.lifecycle")
    verify_runtime_configuration()
    database_health = await check_database_health()
    if database_health["status"] != "ok":
        raise RuntimeError(f"Supabase health check failed: {database_health['detail']}")
    logger.info("Starting Schema Studio backend")
    logger.info("Runtime directories prepared at %s", settings.project_root)
    logger.info("Supabase connectivity check passed.")
    start_scheduler()
    yield
    await stop_scheduler()
    logger.info("Stopping Schema Studio backend")


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.app_debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
