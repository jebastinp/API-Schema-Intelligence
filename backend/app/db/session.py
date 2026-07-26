from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings


def _build_async_engine() -> AsyncEngine | None:
    database_url = settings.async_database_url
    if not database_url:
        return None

    return create_async_engine(
        database_url,
        pool_pre_ping=True,
        future=True,
    )


engine = _build_async_engine()
SessionLocal = (
    async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False) if engine else None
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if SessionLocal is None:
        raise RuntimeError("Supabase database connection is not configured.")

    async with SessionLocal() as session:
        yield session
