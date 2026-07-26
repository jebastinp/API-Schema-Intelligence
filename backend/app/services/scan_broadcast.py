from __future__ import annotations

import asyncio
import uuid
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

from app.models.scan_job import ScanJob
from app.models.notification import Notification


def serialize_scan_job_event(
    scan_job: ScanJob,
    *,
    connection_name: str | None = None,
) -> dict[str, Any]:
    metadata = scan_job.metadata_json or {}
    return {
        "id": str(scan_job.id),
        "api_connection_id": str(scan_job.api_connection_id),
        "connection_name": connection_name,
        "status": scan_job.status,
        "current_record": scan_job.current_record,
        "records_scanned": scan_job.records_scanned,
        "columns_found": scan_job.columns_found,
        "estimated_seconds_remaining": scan_job.estimated_seconds_remaining,
        "current_cursor": scan_job.current_cursor,
        "current_api": scan_job.current_api,
        "speed_records_per_second": scan_job.speed_records_per_second,
        "error_message": scan_job.error_message,
        "current_page": metadata.get("current_page"),
        "new_columns_discovered": metadata.get("new_columns_discovered", 0),
        "removed_columns": metadata.get("removed_columns", 0),
        "added_columns": metadata.get("added_columns", 0),
        "datatype_changes": metadata.get("datatype_changes", 0),
        "coverage_changes": metadata.get("coverage_changes", 0),
        "metadata": metadata,
    }


def serialize_notification_event(notification: Notification) -> dict[str, Any]:
    return {
        "id": str(notification.id),
        "user_id": str(notification.user_id),
        "event_type": notification.event_type,
        "title": notification.title,
        "message": notification.message,
        "level": notification.level,
        "is_read": notification.is_read,
        "metadata_json": notification.metadata_json or {},
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
        "updated_at": notification.updated_at.isoformat() if notification.updated_at else None,
    }


class ScanProgressHub:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[str(user_id)].add(websocket)

    async def disconnect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        async with self._lock:
            sockets = self._connections.get(str(user_id))
            if not sockets:
                return
            sockets.discard(websocket)
            if not sockets:
                self._connections.pop(str(user_id), None)

    async def broadcast(self, user_id: uuid.UUID, payload: dict[str, Any]) -> None:
        async with self._lock:
            sockets = list(self._connections.get(str(user_id), set()))

        if not sockets:
            return

        stale: list[WebSocket] = []
        for websocket in sockets:
            try:
                await websocket.send_json(payload)
            except Exception:
                stale.append(websocket)

        if stale:
            async with self._lock:
                active = self._connections.get(str(user_id))
                if active is None:
                    return
                for websocket in stale:
                    active.discard(websocket)
                if not active:
                    self._connections.pop(str(user_id), None)


scan_progress_hub = ScanProgressHub()
