from types import SimpleNamespace

import pytest

from app.services.notification_service import create_schema_change_notifications
from app.services.scan_broadcast import serialize_notification_event


def test_serialize_notification_event_includes_metadata():
    notification = SimpleNamespace(
        id="n-1",
        user_id="u-1",
        event_type="new_column",
        title="New columns discovered",
        message="2 columns changed.",
        level="info",
        is_read=False,
        metadata_json={"connection_name": "SuccessFactors"},
        created_at=None,
        updated_at=None,
    )

    payload = serialize_notification_event(notification)

    assert payload["event_type"] == "new_column"
    assert payload["metadata_json"]["connection_name"] == "SuccessFactors"


@pytest.mark.asyncio
async def test_create_schema_change_notifications_emits_only_non_zero_events(monkeypatch):
    recorded: list[dict[str, object]] = []

    async def fake_create_notification(session, **kwargs):  # noqa: ANN001
        recorded.append(kwargs)
        return SimpleNamespace(**kwargs)

    monkeypatch.setattr(
        "app.services.notification_service.create_notification",
        fake_create_notification,
    )

    connection = SimpleNamespace(id="c-1", user_id="u-1", name="SuccessFactors Users")
    summary = {
        "schema_version_id": "v-2",
        "previous_version_id": "v-1",
        "added_columns": 3,
        "removed_columns": 0,
        "datatype_changes": 2,
    }

    await create_schema_change_notifications(object(), connection=connection, summary=summary)

    assert [item["event_type"] for item in recorded] == ["new_column", "datatype_changed"]
