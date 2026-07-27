from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

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
    logger.info("Starting Schema Studio backend")
    logger.info("Runtime directories prepared at %s", settings.project_root)
    if database_health["status"] == "ok":
        logger.info("Supabase connectivity check passed.")
        start_scheduler()
    else:
        logger.warning("Supabase connectivity check failed at startup: %s", database_health["detail"])
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


@app.exception_handler(RuntimeError)
async def runtime_error_handler(_: Request, exc: RuntimeError):
    message = str(exc)
    if message == "Supabase database connection is not configured.":
        return JSONResponse(
            status_code=503,
            content={
                "detail": "Schema Studio database is not configured for this deployment. Check Railway environment configuration and try again."
            },
        )
    return JSONResponse(status_code=500, content={"detail": message})


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_error_handler(_: Request, __: SQLAlchemyError):
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Schema Studio database is currently unreachable. Check Railway and Supabase connectivity, then try again."
        },
    )


app.include_router(api_router, prefix="/api")
