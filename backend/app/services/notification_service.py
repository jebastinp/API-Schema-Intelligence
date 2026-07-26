from __future__ import annotations

import uuid
from typing import Any

from app.models.api_connection import APIConnection
from app.models.notification import Notification
from app.repositories.notification import NotificationRepository
from app.services.scan_broadcast import scan_progress_hub, serialize_notification_event


async def create_notification(
    session: Any,
    *,
    user_id: uuid.UUID,
    event_type: str,
    title: str,
    message: str,
    level: str = "info",
    metadata: dict[str, Any] | None = None,
) -> Notification:
    repository = NotificationRepository(session)
    notification = await repository.create(
        user_id=user_id,
        event_type=event_type,
        title=title,
        message=message,
        level=level,
        is_read=False,
        metadata_json=metadata or {},
    )
    await session.flush()
    await scan_progress_hub.broadcast(
        user_id,
        {
            "type": "notification",
            "notification": serialize_notification_event(notification),
        },
    )
    return notification


async def create_schema_change_notifications(
    session: Any,
    *,
    connection: APIConnection,
    summary: dict[str, Any],
) -> list[Notification]:
    created: list[Notification] = []
    version_id = summary.get("schema_version_id")
    previous_version_id = summary.get("previous_version_id")

    event_specs = [
        ("new_column", "New columns discovered", "info", int(summary.get("added_columns", 0))),
        ("removed_column", "Columns removed", "warning", int(summary.get("removed_columns", 0))),
        ("datatype_changed", "Column datatype changes detected", "warning", int(summary.get("datatype_changes", 0))),
    ]

    for event_type, title, level, count in event_specs:
        if count <= 0:
            continue
        noun = "column" if count == 1 else "columns"
        message = f"{count} {noun} changed in {connection.name} during the latest schema comparison."
        created.append(
            await create_notification(
                session,
                user_id=connection.user_id,
                event_type=event_type,
                title=title,
                message=message,
                level=level,
                metadata={
                    "api_connection_id": str(connection.id),
                    "connection_name": connection.name,
                    "schema_version_id": version_id,
                    "previous_version_id": previous_version_id,
                    "count": count,
                },
            )
        )
    return created


async def create_api_failed_notification(
    session: Any,
    *,
    connection: APIConnection,
    error_message: str,
    status_code: int | None = None,
) -> Notification:
    return await create_notification(
        session,
        user_id=connection.user_id,
        event_type="api_failed",
        title="API scan failed",
        message=f"{connection.name} failed during scanning. {error_message}",
        level="error",
        metadata={
            "api_connection_id": str(connection.id),
            "connection_name": connection.name,
            "status_code": status_code,
        },
    )


async def create_auth_expired_notification(
    session: Any,
    *,
    connection: APIConnection,
    error_message: str,
    status_code: int | None = None,
) -> Notification:
    return await create_notification(
        session,
        user_id=connection.user_id,
        event_type="authentication_expired",
        title="Authentication expired",
        message=f"{connection.name} requires refreshed credentials. {error_message}",
        level="error",
        metadata={
            "api_connection_id": str(connection.id),
            "connection_name": connection.name,
            "status_code": status_code,
        },
    )
