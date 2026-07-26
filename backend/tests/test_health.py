import pytest
from datetime import timezone

from app.api.routes import health as health_route
from app.api.routes.health import healthcheck


@pytest.mark.asyncio
async def test_healthcheck(monkeypatch):
    async def fake_database_health():
        return {"configured": True, "reachable": True, "status": "ok", "detail": "ok"}

    monkeypatch.setattr(
        health_route.settings.__class__,
        "missing_runtime_values",
        lambda _self: [],
    )
    monkeypatch.setattr(
        health_route,
        "check_database_health",
        fake_database_health,
    )
    response = await healthcheck()
    assert response.status == "ok"
    assert response.service == "schema-studio-backend"
    assert response.timestamp.tzinfo == timezone.utc
    assert response.environment
    assert response.database.status == "ok"
    assert response.environment_variables.configured is True
    assert response.directories
