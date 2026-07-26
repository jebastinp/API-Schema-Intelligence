from fastapi import APIRouter

from app.api.routes import connections, health, scanner, settings

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(connections.router, prefix="/connections", tags=["connections"])
api_router.include_router(scanner.router, prefix="/scanner", tags=["scanner"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
