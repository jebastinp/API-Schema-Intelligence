from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine


async def check_database_health() -> dict[str, str | bool]:
    if not settings.supabase_configured or engine is None:
        return {
            "configured": False,
            "reachable": False,
            "status": "error",
            "detail": "Required Supabase environment variables are missing.",
        }

    try:
        async with engine.connect() as connection:
            await connection.execute(text("select 1"))
        return {
            "configured": True,
            "reachable": True,
            "status": "ok",
            "detail": "Supabase database connection succeeded.",
        }
    except Exception as exc:
        return {
            "configured": True,
            "reachable": False,
            "status": "error",
            "detail": str(exc),
        }
