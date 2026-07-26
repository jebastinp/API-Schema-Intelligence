from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.models.api_connection import APIConnection
from app.models.scan_job import ScanJob
from app.repositories.api_connection import APIConnectionRepository
from app.repositories.scan_history import ScanHistoryRepository
from app.repositories.scan_job import ScanJobRepository
from app.repositories.schema_version import SchemaVersionRepository
from app.schemas.scan_job import ScanJobStartRequest
from app.services.scan_broadcast import scan_progress_hub, serialize_scan_job_event
from app.services.notification_service import (
    create_api_failed_notification,
    create_auth_expired_notification,
    create_schema_change_notifications,
)
from app.services.schema_discovery import SchemaDiscoveryAccumulator, persist_discovered_schema
from app.services.scanner_engine import (
    ROOT_LIST_SENTINEL,
    _get_value,
    _resolve_authorization_headers,
    analyze_payload,
    build_request_url,
    detect_cursor_candidate,
)
from app.services.sql_generation import build_create_table_sql, persist_generated_sql
from app.services.xquery_generation import build_iics_xquery, persist_generated_xquery

logger = get_logger("app.scan_runtime")
RUNNING_SCAN_TASKS: dict[uuid.UUID, asyncio.Task[None]] = {}
DEFAULT_PAGE_SIZE = 200
NO_NEXT_PAGE_PATHS = (
    "hasNext",
    "hasNextPage",
    "moreResults",
    "hasMore",
    "pagination.hasNext",
    "paging.hasNext",
    "pageInfo.hasNextPage",
)
TOTAL_RECORD_COUNT_PATHS = (
    "total",
    "totalCount",
    "totalRecords",
    "count",
    "__count",
    "d.__count",
    "pageInfo.total",
    "pagination.total",
)


@dataclass
class PaginationState:
    strategy: str
    response_root: str
    cursor_parameter: str | None
    cursor_value: Any
    page_number: int
    offset_value: int
    page_size: int
    seeded: bool = False
    pages_scanned: int = 0


def _extract_root_records(payload: Any, response_root: str) -> list[Any]:
    if response_root == ROOT_LIST_SENTINEL:
        if isinstance(payload, list):
            return payload
        return [payload]

    try:
        records = _get_value(payload, response_root)
    except KeyError:
        return []

    if isinstance(records, list):
        return records
    if records is None:
        return []
    return [records]


def _resolve_next_value(payload: Any, path: str | None) -> Any:
    if not path:
        return None
    try:
        return _get_value(payload, path)
    except KeyError:
        return None


def _resolve_first_existing_value(payload: Any, paths: tuple[str, ...]) -> Any:
    for path in paths:
        try:
            return _get_value(payload, path)
        except KeyError:
            continue
    return None


def _resolve_configured_or_default_value(
    payload: Any,
    configured_path: str | None,
    default_paths: tuple[str, ...],
) -> Any:
    if configured_path:
        return _resolve_next_value(payload, configured_path)
    return _resolve_first_existing_value(payload, default_paths)


def _coerce_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "yes", "1"}:
            return True
        if lowered in {"false", "no", "0"}:
            return False
    return None


def determine_pagination_state(
    connection: APIConnection,
    options: ScanJobStartRequest,
    analysis_cursor: Any,
    page_size: int,
) -> PaginationState:
    if options.starting_cursor:
        return PaginationState(
            strategy="cursor",
            response_root=connection.response_root_node or ROOT_LIST_SENTINEL,
            cursor_parameter=connection.cursor_parameter or analysis_cursor.request_parameter or "cursor",
            cursor_value=options.starting_cursor,
            seeded=True,
            page_number=1,
            offset_value=0,
            page_size=page_size,
        )

    strategy = "single_response"
    cursor_parameter = connection.cursor_parameter or analysis_cursor.request_parameter
    cursor_value = None

    if analysis_cursor.strategy == "url" and analysis_cursor.path:
        strategy = "url"
        cursor_value = analysis_cursor.path
    elif analysis_cursor.strategy == "cursor" and analysis_cursor.path:
        strategy = "cursor"
        cursor_value = analysis_cursor.path
    elif cursor_parameter:
        lowered = cursor_parameter.lower()
        if "offset" in lowered or lowered in {"skip", "$skip"}:
            strategy = "offset"
        elif "page" in lowered:
            strategy = "page"
        else:
            strategy = "cursor"
    elif getattr(connection, "next_cursor_path", None):
        strategy = "cursor"
    elif connection.count_parameter:
        strategy = "offset"

    return PaginationState(
        strategy=strategy,
        response_root=connection.response_root_node or ROOT_LIST_SENTINEL,
        cursor_parameter=cursor_parameter,
        cursor_value=cursor_value,
        seeded=strategy in {"page", "offset"},
        page_number=1,
        offset_value=0,
        page_size=page_size,
    )


def _coerce_positive_int(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value if value >= 0 else None
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def _extract_total_record_count(payload: Any, connection: APIConnection) -> int | None:
    total_records_path = getattr(connection, "total_records_path", None)
    return _coerce_positive_int(
        _resolve_configured_or_default_value(payload, total_records_path, TOTAL_RECORD_COUNT_PATHS)
    )


def _payload_has_more_pages(payload: Any, connection: APIConnection) -> bool | None:
    has_next_page_path = getattr(connection, "has_next_page_path", None)
    return _coerce_bool(
        _resolve_configured_or_default_value(payload, has_next_page_path, NO_NEXT_PAGE_PATHS)
    )


def _resolve_next_cursor_value(payload: Any, connection: APIConnection, detected_path: str | None) -> Any:
    next_cursor_path = getattr(connection, "next_cursor_path", None)
    if next_cursor_path:
        return _resolve_next_value(payload, next_cursor_path)
    return _resolve_next_value(payload, detected_path)


def _update_pagination_state(
    state: PaginationState,
    connection: APIConnection,
    payload: Any,
    records_count: int,
    cursor_detection: Any,
) -> bool:
    next_value = _resolve_next_cursor_value(payload, connection, cursor_detection.path)
    has_more_pages = _payload_has_more_pages(payload, connection)
    state.pages_scanned += 1

    if records_count == 0:
        return False

    if state.strategy == "url":
        if has_more_pages is False:
            return False
        if isinstance(next_value, str) and next_value:
            if next_value == state.cursor_value:
                return False
            state.cursor_value = next_value
            return True
        return False

    if state.strategy == "cursor":
        if has_more_pages is False:
            return False
        if next_value not in {None, ""}:
            if next_value == state.cursor_value:
                return False
            state.cursor_value = next_value
            return True
        return False

    if state.strategy == "page":
        next_page = _coerce_positive_int(next_value)
        if next_page is not None and next_page > state.page_number:
            state.page_number = next_page
            return True
        if has_more_pages is False:
            return False
        state.page_number += 1
        return True

    if state.strategy == "offset":
        next_offset = _coerce_positive_int(next_value)
        if next_offset is not None and next_offset > state.offset_value:
            state.offset_value = next_offset
            return True
        if has_more_pages is False:
            return False
        state.offset_value += max(records_count, state.page_size)
        return True

    return False


def build_scan_request_url(connection: APIConnection, state: PaginationState) -> str:
    if state.strategy == "url" and isinstance(state.cursor_value, str) and state.cursor_value.startswith("http"):
        return state.cursor_value

    if state.strategy == "page":
        cursor_value: Any = state.page_number
    elif state.strategy == "offset":
        cursor_value = state.offset_value
    else:
        cursor_value = state.cursor_value

    return build_request_url(
        base_url=connection.base_url,
        cursor_candidate=None,
        cursor_parameter=state.cursor_parameter,
        cursor_value=cursor_value,
        count_parameter=connection.count_parameter,
        page_size=state.page_size,
    )


def _build_initial_request_url(connection: APIConnection, state: PaginationState) -> str:
    if state.seeded:
        return build_scan_request_url(connection, state)
    return build_request_url(
        base_url=connection.base_url,
        cursor_candidate=None,
        cursor_parameter=state.cursor_parameter if state.strategy in {"page", "offset"} else None,
        cursor_value=state.page_number if state.strategy == "page" else state.offset_value if state.strategy == "offset" else None,
        count_parameter=connection.count_parameter,
        page_size=state.page_size,
    )


def _temp_scan_directory(scan_job_id: uuid.UUID) -> Path:
    directory = settings.scan_cache_path / str(scan_job_id)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


async def _store_payload(scan_job_id: uuid.UUID, page_number: int, payload: Any) -> str:
    directory = _temp_scan_directory(scan_job_id)
    file_path = directory / f"page-{page_number:05d}.json"
    content = json.dumps(payload, ensure_ascii=True, default=str, indent=2)
    await asyncio.to_thread(file_path.write_text, content, "utf-8")
    return str(file_path)


async def _update_job_progress(
    scan_job: ScanJob,
    *,
    current_record: int,
    records_scanned: int,
    columns_found: int,
    current_cursor: str | None,
    speed_records_per_second: int | None,
    estimated_seconds_remaining: int | None,
    metadata: dict[str, Any],
    status: str,
) -> None:
    scan_job.current_record = current_record
    scan_job.records_scanned = records_scanned
    scan_job.columns_found = columns_found
    scan_job.current_cursor = current_cursor
    scan_job.speed_records_per_second = speed_records_per_second
    scan_job.estimated_seconds_remaining = estimated_seconds_remaining
    scan_job.metadata_json = metadata
    scan_job.status = status


async def _broadcast_scan_job(scan_job: ScanJob, connection: APIConnection) -> None:
    await scan_progress_hub.broadcast(
        connection.user_id,
        {
            "type": "job_update",
            "job": serialize_scan_job_event(scan_job, connection_name=connection.name),
        },
    )


async def _run_scan_task(scan_job_id: uuid.UUID, connection_id: uuid.UUID, options: ScanJobStartRequest) -> None:
    if SessionLocal is None:
        logger.error("Skipping scan %s because database is not configured.", scan_job_id)
        return

    async with SessionLocal() as session:
        job_repository = ScanJobRepository(session)
        connection_repository = APIConnectionRepository(session)
        history_repository = ScanHistoryRepository(session)

        scan_job = await job_repository.get(scan_job_id)
        connection = await connection_repository.get(connection_id)
        if scan_job is None or connection is None:
            logger.error("Scan job %s or connection %s could not be loaded.", scan_job_id, connection_id)
            return

        async def set_runtime_state(
            *,
            scan_status: str,
            current_page: int,
            records_scanned: int,
            columns_found: int,
            current_cursor: str | None,
            current_api: str | None,
            speed_records_per_second: int | None,
            estimated_seconds_remaining: int | None,
            metadata_overrides: dict[str, Any] | None = None,
            status: str = "running",
        ) -> None:
            base_metadata = scan_job.metadata_json or {}
            merged_metadata = {
                **base_metadata,
                "current_page": current_page,
                "pages_scanned": current_page,
                "scan_status": scan_status,
                "status_label": scan_status,
                "current_api": current_api,
                "current_cursor": current_cursor,
                "records_scanned": records_scanned,
                "columns_discovered": columns_found,
                "columns_found": columns_found,
                "total_records_known": False,
                "total_records": None,
                "total_records_label": "Unknown",
                "scan_scope": "Scanning entire API...",
                "scan_complete": False,
                "trigger_mode": options.trigger_mode,
            }
            if metadata_overrides:
                merged_metadata.update(metadata_overrides)

            await _update_job_progress(
                scan_job,
                current_record=records_scanned,
                records_scanned=records_scanned,
                columns_found=columns_found,
                current_cursor=current_cursor,
                speed_records_per_second=speed_records_per_second,
                estimated_seconds_remaining=estimated_seconds_remaining,
                metadata=merged_metadata,
                status=status,
            )
            scan_job.current_api = current_api

        history = await history_repository.create(
            api_connection_id=connection.id,
            scan_job_id=scan_job.id,
            started_at=datetime.now(UTC),
            status="running",
            records_scanned=0,
            columns_found=0,
            trigger_mode=options.trigger_mode,
            schema_version_id=None,
            compared_to_schema_version_id=None,
            summary={},
            change_summary={},
            error_message=None,
        )
        await set_runtime_state(
            scan_status="Initializing",
            current_page=0,
            records_scanned=0,
            columns_found=0,
            current_cursor=options.starting_cursor,
            current_api=connection.base_url,
            speed_records_per_second=None,
            estimated_seconds_remaining=None,
            metadata_overrides={
                "pagination_strategy": "initializing",
                "response_root": connection.response_root_node,
                "stored_responses": [],
                "stored_response_count": 0,
                "new_columns_discovered": 0,
                "removed_columns": 0,
                "added_columns": 0,
                "datatype_changes": 0,
                "coverage_changes": 0,
            },
        )
        await session.commit()
        await _broadcast_scan_job(scan_job, connection)

        start_time = time.perf_counter()
        stored_responses: list[str] = []
        previous_version = None
        previous_column_paths: set[str] = set()

        try:
            await set_runtime_state(
                scan_status="Authenticating",
                current_page=0,
                records_scanned=0,
                columns_found=0,
                current_cursor=options.starting_cursor,
                current_api=connection.base_url,
                speed_records_per_second=None,
                estimated_seconds_remaining=None,
            )
            await session.commit()
            await _broadcast_scan_job(scan_job, connection)

            headers = await _resolve_authorization_headers(connection)
            timeout = httpx.Timeout(30.0, connect=10.0)

            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                bootstrap_response = await client.get(connection.base_url, headers=headers)
                bootstrap_response.raise_for_status()
                bootstrap_payload = bootstrap_response.json()

                analysis = analyze_payload(
                    bootstrap_payload,
                    response_root_override=options.response_root_override or connection.response_root_node,
                )
                page_size = options.page_size or DEFAULT_PAGE_SIZE
                state = determine_pagination_state(connection, options, analysis.cursor_detection, page_size)
                state.response_root = analysis.response_root
                current_url = _build_initial_request_url(connection, state)
                keep_scanning = True
                seen_pages = 0
                records_scanned = 0
                discovery = SchemaDiscoveryAccumulator(response_root=state.response_root)
                current_cursor_detection = analysis.cursor_detection
                previous_schema_repository = SchemaVersionRepository(session)
                previous_version = await previous_schema_repository.get_latest_for_connection(connection.id)
                if previous_version is not None:
                    previous_column_paths = {column.column_path for column in previous_version.columns}
                total_records = _extract_total_record_count(bootstrap_payload, connection)
                total_records_known = total_records is not None

                while keep_scanning:
                    if seen_pages == 0 and current_url == connection.base_url:
                        current_payload = bootstrap_payload
                    else:
                        if seen_pages > 0:
                            current_url = build_scan_request_url(connection, state)
                        response = await client.get(current_url, headers=headers)
                        response.raise_for_status()
                        current_payload = response.json()

                    current_page = seen_pages + 1
                    await set_runtime_state(
                        scan_status=f"Scanning Page {current_page}",
                        current_page=current_page,
                        records_scanned=records_scanned,
                        columns_found=discovery.column_count(),
                        current_cursor=scan_job.current_cursor,
                        current_api=current_url,
                        speed_records_per_second=scan_job.speed_records_per_second,
                        estimated_seconds_remaining=scan_job.estimated_seconds_remaining,
                        metadata_overrides={
                            "pagination_strategy": state.strategy,
                            "response_root": state.response_root,
                            "stored_responses": stored_responses,
                            "stored_response_count": len(stored_responses),
                            "total_records_known": total_records_known,
                            "total_records": total_records,
                            "total_records_label": str(total_records) if total_records_known else "Unknown",
                            "scan_scope": "Scanning entire API..." if not total_records_known else f"Scanning {total_records:,} records",
                        },
                    )
                    await session.commit()
                    await _broadcast_scan_job(scan_job, connection)

                    page_records = _extract_root_records(current_payload, state.response_root)
                    page_record_count = len(page_records)
                    records_scanned += page_record_count
                    seen_pages += 1

                    await set_runtime_state(
                        scan_status="Discovering Fields",
                        current_page=seen_pages,
                        records_scanned=records_scanned,
                        columns_found=discovery.column_count(),
                        current_cursor=scan_job.current_cursor,
                        current_api=current_url,
                        speed_records_per_second=scan_job.speed_records_per_second,
                        estimated_seconds_remaining=scan_job.estimated_seconds_remaining,
                        metadata_overrides={
                            "last_page_size": page_record_count,
                            "total_records_known": total_records_known,
                            "total_records": total_records,
                            "total_records_label": str(total_records) if total_records_known else "Unknown",
                            "scan_scope": "Scanning entire API..." if not total_records_known else f"Scanning {total_records:,} records",
                        },
                    )
                    await session.commit()
                    await _broadcast_scan_job(scan_job, connection)

                    discovery.consume_payload(current_payload)
                    stored_file = await _store_payload(scan_job.id, seen_pages, current_payload)
                    stored_responses.append(stored_file)
                    current_cursor_detection = detect_cursor_candidate(current_payload, connection.cursor_parameter)
                    if current_cursor_detection.path and not getattr(connection, "next_cursor_path", None):
                        state.cursor_parameter = (
                            connection.cursor_parameter
                            or current_cursor_detection.key
                            or state.cursor_parameter
                        )
                    next_cursor_preview = _resolve_next_cursor_value(
                        current_payload,
                        connection,
                        current_cursor_detection.path,
                    )

                    elapsed = max(time.perf_counter() - start_time, 0.001)
                    speed = int(records_scanned / elapsed) if records_scanned else None
                    eta = None
                    if page_record_count and speed and page_record_count >= state.page_size:
                        eta = max(int(page_record_count / max(speed, 1)), 1)

                    metadata = {
                        "pagination_strategy": state.strategy,
                        "response_root": state.response_root,
                        "stored_responses": stored_responses,
                        "stored_response_count": len(stored_responses),
                        "last_page_size": page_record_count,
                        "discovered_columns": discovery.column_count(),
                        "new_columns_discovered": len(discovery.column_paths() - previous_column_paths),
                        "removed_columns": 0,
                        "added_columns": 0,
                        "datatype_changes": 0,
                        "coverage_changes": 0,
                        "total_records_known": total_records_known,
                        "total_records": total_records,
                        "total_records_label": str(total_records) if total_records_known else "Unknown",
                        "scan_scope": "Scanning entire API..." if not total_records_known else f"Scanning {total_records:,} records",
                    }
                    await set_runtime_state(
                        scan_status=f"Scanning Page {seen_pages}",
                        current_page=seen_pages,
                        records_scanned=records_scanned,
                        columns_found=discovery.column_count(),
                        current_cursor=str(next_cursor_preview) if next_cursor_preview is not None else None,
                        current_api=current_url,
                        speed_records_per_second=speed,
                        estimated_seconds_remaining=eta,
                        metadata_overrides=metadata,
                    )
                    history.records_scanned = records_scanned
                    history.columns_found = discovery.column_count()
                    history.summary = scan_job.metadata_json
                    await session.commit()
                    await _broadcast_scan_job(scan_job, connection)

                    keep_scanning = _update_pagination_state(
                        state,
                        connection,
                        current_payload,
                        page_record_count,
                        current_cursor_detection,
                    )

                await set_runtime_state(
                    scan_status="Saving Results",
                    current_page=seen_pages,
                    records_scanned=records_scanned,
                    columns_found=discovery.column_count(),
                    current_cursor=scan_job.current_cursor,
                    current_api=current_url,
                    speed_records_per_second=scan_job.speed_records_per_second,
                    estimated_seconds_remaining=None,
                    metadata_overrides={
                        "stored_responses": stored_responses,
                        "stored_response_count": len(stored_responses),
                        "total_records_known": total_records_known,
                        "total_records": total_records,
                        "total_records_label": str(total_records) if total_records_known else "Unknown",
                        "scan_scope": "Scanning entire API..." if not total_records_known else f"Scanning {total_records:,} records",
                    },
                )
                await session.commit()
                await _broadcast_scan_job(scan_job, connection)

                schema_version = await persist_discovered_schema(
                    session,
                    connection=connection,
                    scan_history=history,
                    accumulator=discovery,
                )
                await set_runtime_state(
                    scan_status="Comparing Schema",
                    current_page=seen_pages,
                    records_scanned=records_scanned,
                    columns_found=discovery.column_count(),
                    current_cursor=scan_job.current_cursor,
                    current_api=current_url,
                    speed_records_per_second=scan_job.speed_records_per_second,
                    estimated_seconds_remaining=None,
                    metadata_overrides={
                        "schema_version_id": str(schema_version.id),
                    },
                )
                await session.commit()
                await _broadcast_scan_job(scan_job, connection)

                sql_content = build_create_table_sql(connection, schema_version)
                await set_runtime_state(
                    scan_status="Generating SQL",
                    current_page=seen_pages,
                    records_scanned=records_scanned,
                    columns_found=discovery.column_count(),
                    current_cursor=scan_job.current_cursor,
                    current_api=current_url,
                    speed_records_per_second=scan_job.speed_records_per_second,
                    estimated_seconds_remaining=None,
                    metadata_overrides={
                        "schema_version_id": str(schema_version.id),
                    },
                )
                await session.commit()
                await _broadcast_scan_job(scan_job, connection)
                sql_artifact = await persist_generated_sql(
                    session,
                    schema_version=schema_version,
                    artifact_name=f"{schema_version.version_label}-create.sql",
                    statement_type="create_table",
                    content=sql_content,
                    dialect="postgresql",
                )

                await set_runtime_state(
                    scan_status="Generating XQuery",
                    current_page=seen_pages,
                    records_scanned=records_scanned,
                    columns_found=discovery.column_count(),
                    current_cursor=scan_job.current_cursor,
                    current_api=current_url,
                    speed_records_per_second=scan_job.speed_records_per_second,
                    estimated_seconds_remaining=None,
                    metadata_overrides={
                        "schema_version_id": str(schema_version.id),
                        "generated_sql_id": str(sql_artifact.id),
                    },
                )
                await session.commit()
                await _broadcast_scan_job(scan_job, connection)
                xquery_document = build_iics_xquery(
                    connection,
                    schema_version,
                    naming_convention="parent_prefix",
                    separator="_",
                    root_element_name="rows",
                    row_element_name="row",
                    emit_child_mapping_comments=True,
                )
                xquery_artifact = await persist_generated_xquery(
                    session,
                    schema_version=schema_version,
                    artifact_name=f"{schema_version.version_label}.xq",
                    naming_convention="parent_prefix",
                    content=xquery_document.content,
                )

                history.status = "completed"
                history.completed_at = datetime.now(UTC)
                history.columns_found = discovery.column_count()
                history.schema_version_id = schema_version.id
                history.compared_to_schema_version_id = previous_version.id if previous_version is not None else None
                history.change_summary = {
                    "added_columns": schema_version.summary.get("added_columns", 0),
                    "removed_columns": schema_version.summary.get("removed_columns", 0),
                    "datatype_changes": schema_version.summary.get("datatype_changes", 0),
                    "coverage_changes": schema_version.summary.get("coverage_changes", 0),
                    "previous_version_id": schema_version.summary.get("previous_version_id"),
                }
                history.summary = {
                    **(history.summary or {}),
                    "schema_version_id": str(schema_version.id),
                    "columns_discovered": discovery.column_count(),
                    "statistics_calculated": discovery.column_count(),
                    "pages_scanned": seen_pages,
                    "generated_sql_id": str(sql_artifact.id),
                    "generated_xquery_id": str(xquery_artifact.id),
                }
                await set_runtime_state(
                    scan_status="Completed",
                    current_page=seen_pages,
                    records_scanned=records_scanned,
                    columns_found=discovery.column_count(),
                    current_cursor=scan_job.current_cursor,
                    current_api=current_url,
                    speed_records_per_second=scan_job.speed_records_per_second,
                    estimated_seconds_remaining=0,
                    metadata_overrides={
                        "completed_at": history.completed_at.isoformat(),
                        "schema_version_id": str(schema_version.id),
                        "discovered_columns": discovery.column_count(),
                        "statistics_calculated": discovery.column_count(),
                        "new_columns_discovered": schema_version.summary.get("added_columns", 0),
                        "removed_columns": schema_version.summary.get("removed_columns", 0),
                        "added_columns": schema_version.summary.get("added_columns", 0),
                        "datatype_changes": schema_version.summary.get("datatype_changes", 0),
                        "coverage_changes": schema_version.summary.get("coverage_changes", 0),
                        "generated_sql_id": str(sql_artifact.id),
                        "generated_xquery_id": str(xquery_artifact.id),
                        "scan_complete": True,
                    },
                    status="completed",
                )
                connection.last_scanned_at = history.completed_at
                connection.last_scan_status = "completed"
                await create_schema_change_notifications(
                    session,
                    connection=connection,
                    summary=schema_version.summary,
                )
                await session.commit()
                await _broadcast_scan_job(scan_job, connection)
        except httpx.HTTPStatusError as exc:
            logger.exception("Scan job %s failed with HTTP status error.", scan_job_id)
            status_code = exc.response.status_code if exc.response is not None else None
            scan_job.status = "failed"
            scan_job.error_message = str(exc)
            scan_job.metadata_json = {
                **(scan_job.metadata_json or {}),
                "stored_response_count": len(stored_responses),
                "stored_responses": stored_responses,
                "trigger_mode": options.trigger_mode,
                "status_code": status_code,
                "scan_status": "Failed",
                "status_label": "Failed",
            }
            history.status = "failed"
            history.completed_at = datetime.now(UTC)
            history.error_message = str(exc)
            connection.last_scanned_at = history.completed_at
            connection.last_scan_status = "failed"

            if status_code in {401, 403}:
                await create_auth_expired_notification(
                    session,
                    connection=connection,
                    error_message=f"Received HTTP {status_code} from the API or token endpoint.",
                    status_code=status_code,
                )
            else:
                await create_api_failed_notification(
                    session,
                    connection=connection,
                    error_message=f"Received HTTP {status_code} during scanning.",
                    status_code=status_code,
                )
            await session.commit()
            await _broadcast_scan_job(scan_job, connection)
        except Exception as exc:
            logger.exception("Scan job %s failed.", scan_job_id)
            scan_job.status = "failed"
            scan_job.error_message = str(exc)
            scan_job.metadata_json = {
                **(scan_job.metadata_json or {}),
                "stored_response_count": len(stored_responses),
                "stored_responses": stored_responses,
                "trigger_mode": options.trigger_mode,
                "scan_status": "Failed",
                "status_label": "Failed",
            }
            history.status = "failed"
            history.completed_at = datetime.now(UTC)
            history.error_message = str(exc)
            connection.last_scanned_at = history.completed_at
            connection.last_scan_status = "failed"
            await create_api_failed_notification(
                session,
                connection=connection,
                error_message=str(exc),
            )
            await session.commit()
            await _broadcast_scan_job(scan_job, connection)
        finally:
            RUNNING_SCAN_TASKS.pop(scan_job_id, None)


async def create_scan_job(connection: APIConnection, options: ScanJobStartRequest) -> ScanJob:
    if SessionLocal is None:
        raise RuntimeError("Supabase database connection is not configured.")

    async with SessionLocal() as session:
        repository = ScanJobRepository(session)
        scan_job = await repository.create(
            api_connection_id=connection.id,
            status="queued",
            current_record=0,
            records_scanned=0,
            columns_found=0,
            estimated_seconds_remaining=None,
            current_cursor=options.starting_cursor,
            current_api=connection.base_url,
            speed_records_per_second=None,
            error_message=None,
            metadata_json={
                "current_page": 0,
                "pages_scanned": 0,
                "pagination_strategy": "queued",
                "response_root": options.response_root_override or connection.response_root_node,
                "stored_responses": [],
                "stored_response_count": 0,
                "scan_status": "Initializing",
                "status_label": "Initializing",
                "scan_scope": "Scanning entire API...",
                "total_records_known": False,
                "total_records": None,
                "total_records_label": "Unknown",
                "trigger_mode": options.trigger_mode,
            },
        )
        await session.commit()
        await session.refresh(scan_job)
        await scan_progress_hub.broadcast(
            connection.user_id,
            {
                "type": "job_update",
                "job": serialize_scan_job_event(scan_job, connection_name=connection.name),
            },
        )

    task = asyncio.create_task(_run_scan_task(scan_job.id, connection.id, options))
    RUNNING_SCAN_TASKS[scan_job.id] = task
    return scan_job
