import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.responses import FileResponse, PlainTextResponse
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.api.routes.connections import resolve_local_user_id
from app.db.session import get_db
from app.models.api_connection import APIConnection
from app.models.export import Export
from app.models.generated_sql import GeneratedSQL
from app.models.generated_xquery import GeneratedXQuery
from app.models.scan_job import ScanJob
from app.models.schema_version import SchemaVersion
from app.repositories.api_connection import APIConnectionRepository
from app.repositories.export import ExportRepository
from app.repositories.generated_sql import GeneratedSQLRepository
from app.repositories.generated_xquery import GeneratedXQueryRepository
from app.repositories.notification import NotificationRepository
from app.repositories.scan_history import ScanHistoryRepository
from app.repositories.user import UserRepository
from app.schemas.auth import CurrentUser
from app.schemas.notification import NotificationMarkReadRequest, NotificationResponse
from app.schemas.schema_discovery import (
    SchemaDiffEntryResponse,
    SchemaDiffSummaryResponse,
    SchemaVersionDiffResponse,
    SchemaVersionResponse,
    SchemaVersionSummaryResponse,
)
from app.schemas.schema_explorer import SchemaFieldExplorerResponse
from app.schemas.scan_job import ScanDashboardJobResponse, ScanHistoryResponse, ScanJobResponse, ScanJobStartRequest
from app.schemas.scanner import ScannerAnalysisResponse, ScannerOptions, ScannerPayloadRequest
from app.schemas.export_center import ExportCreateRequest, ExportResponse
from app.schemas.sql_generation import GeneratedSQLResponse, SQLGenerationRequest, SQLMigrationRequest
from app.schemas.xquery_generation import (
    CollectionMappingResponse,
    GeneratedXQueryResponse,
    XQueryGenerationRequest,
)
from app.repositories.schema_version import SchemaVersionRepository
from app.services.scan_runtime import create_scan_job
from app.services.scan_broadcast import scan_progress_hub, serialize_scan_job_event
from app.services.scanner_engine import analyze_connection, analyze_payload
from app.services.schema_versioning import build_github_style_diff, compare_schema_versions
from app.services.schema_explorer import build_schema_field_explorer_response
from app.services.sql_generation import build_create_table_sql, build_migration_sql, persist_generated_sql
from app.services.xquery_generation import build_iics_xquery, persist_generated_xquery
from app.services.auth import AuthError, current_user_from_token
from app.services.export_generation import create_export_record
from app.services.naming_service import NamingService

router = APIRouter()


def _scan_dashboard_job_from_row(scan_job: ScanJob, connection_name: str | None) -> ScanDashboardJobResponse:
    payload = serialize_scan_job_event(scan_job, connection_name=connection_name)
    return ScanDashboardJobResponse(
        id=uuid.UUID(payload["id"]),
        api_connection_id=uuid.UUID(payload["api_connection_id"]),
        connection_name=payload["connection_name"],
        status=payload["status"],
        current_record=payload["current_record"],
        records_scanned=payload["records_scanned"],
        columns_found=payload["columns_found"],
        estimated_seconds_remaining=payload["estimated_seconds_remaining"],
        current_cursor=payload["current_cursor"],
        current_api=payload["current_api"],
        speed_records_per_second=payload["speed_records_per_second"],
        error_message=payload["error_message"],
        current_page=payload["current_page"],
        new_columns_discovered=payload["new_columns_discovered"],
        removed_columns=payload["removed_columns"],
        added_columns=payload["added_columns"],
        datatype_changes=payload["datatype_changes"],
        coverage_changes=payload["coverage_changes"],
        metadata=payload["metadata"],
    )


async def _resolve_local_user_id_from_token(token: str, session: AsyncSession) -> uuid.UUID:
    try:
        user = await current_user_from_token(token)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    repository = UserRepository(session)
    await repository.upsert_from_supabase_claims(
        supabase_user_id=user.supabase_user_id,
        email=user.email,
        full_name=user.full_name,
    )
    await session.commit()
    local_user = await repository.get_by_supabase_user_id(user.supabase_user_id)
    if local_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not provisioned.")
    return local_user.id


def _serialize_schema_version_summary(schema_version: SchemaVersion) -> SchemaVersionSummaryResponse:
    return SchemaVersionSummaryResponse.model_validate(schema_version)


def _serialize_schema_version(schema_version: SchemaVersion) -> SchemaVersionResponse:
    naming_service = NamingService.for_schema_version(schema_version)
    return SchemaVersionResponse(
        id=schema_version.id,
        api_connection_id=schema_version.api_connection_id,
        version_number=schema_version.version_number,
        version_label=schema_version.version_label,
        status=schema_version.status,
        summary=schema_version.summary,
        change_notes=schema_version.change_notes,
        columns=[
            {
                "id": column.id,
                "schema_version_id": column.schema_version_id,
                "column_path": column.column_path,
                "display_name": naming_service.generate_display_name(column.column_path),
                "sql_name": naming_service.generate_sql_name(column.column_path),
                "xquery_name": naming_service.generate_xquery_name(column.column_path),
                "display_parent_path": naming_service.display_parent_path(column.column_path),
                "parent_path": column.parent_path,
                "depth": column.depth,
                "data_type": column.data_type,
                "is_nullable": column.is_nullable,
                "is_array": column.is_array,
                "is_object": column.is_object,
                "example_value": column.example_value,
                "statistics": column.statistics,
            }
            for column in schema_version.columns
        ],
    )


@router.post("/payload/analyze", response_model=ScannerAnalysisResponse)
async def analyze_scanner_payload(
    payload_request: ScannerPayloadRequest,
    _: CurrentUser = Depends(get_current_user),
) -> ScannerAnalysisResponse:
    return analyze_payload(
        payload_request.payload,
        response_root_override=payload_request.options.response_root_override,
    )


@router.post("/connections/{connection_id}/analyze", response_model=ScannerAnalysisResponse)
async def analyze_saved_connection(
    connection_id: uuid.UUID,
    options: ScannerOptions,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ScannerAnalysisResponse:
    user_id = await resolve_local_user_id(session, user)
    repository = APIConnectionRepository(session)
    connection = await repository.get_for_user(connection_id, user_id)
    if connection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API connection not found.")

    return await analyze_connection(connection, options)


@router.post("/connections/{connection_id}/scan", response_model=ScanJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_connection_scan(
    connection_id: uuid.UUID,
    request: ScanJobStartRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ScanJobResponse:
    user_id = await resolve_local_user_id(session, user)
    repository = APIConnectionRepository(session)
    connection = await repository.get_for_user(connection_id, user_id)
    if connection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API connection not found.")

    scan_job = await create_scan_job(connection, request)
    return ScanJobResponse.from_model(scan_job)


@router.get("/jobs/{job_id}", response_model=ScanJobResponse)
async def get_scan_job(
    job_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ScanJobResponse:
    user_id = await resolve_local_user_id(session, user)
    result = await session.execute(
        select(ScanJob)
        .join(APIConnection, APIConnection.id == ScanJob.api_connection_id)
        .where(
            ScanJob.id == job_id,
            APIConnection.user_id == user_id,
        )
    )
    scan_job = result.scalar_one_or_none()
    if scan_job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan job not found.")

    return ScanJobResponse.from_model(scan_job)


@router.get("/jobs", response_model=list[ScanDashboardJobResponse])
async def list_scan_jobs(
    limit: int = Query(default=12, ge=1, le=50),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[ScanDashboardJobResponse]:
    user_id = await resolve_local_user_id(session, user)
    result = await session.execute(
        select(ScanJob, APIConnection.name)
        .join(APIConnection, APIConnection.id == ScanJob.api_connection_id)
        .where(APIConnection.user_id == user_id)
        .order_by(ScanJob.created_at.desc())
        .limit(limit)
    )
    return [_scan_dashboard_job_from_row(scan_job, connection_name) for scan_job, connection_name in result.all()]


@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    limit: int = Query(default=20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[NotificationResponse]:
    user_id = await resolve_local_user_id(session, user)
    repository = NotificationRepository(session)
    notifications = await repository.list_for_user(user_id, limit=limit)
    return [NotificationResponse.model_validate(notification) for notification in notifications]


@router.put("/notifications/{notification_id}", response_model=NotificationResponse)
async def mark_notification_read_state(
    notification_id: uuid.UUID,
    payload: NotificationMarkReadRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> NotificationResponse:
    user_id = await resolve_local_user_id(session, user)
    repository = NotificationRepository(session)
    notification = await repository.get_for_user(notification_id, user_id)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")

    notification.is_read = payload.is_read
    await session.commit()
    await session.refresh(notification)
    return NotificationResponse.model_validate(notification)


@router.post("/notifications/read-all", response_model=list[NotificationResponse])
async def mark_all_notifications_read(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[NotificationResponse]:
    user_id = await resolve_local_user_id(session, user)
    repository = NotificationRepository(session)
    updated = await repository.mark_all_as_read(user_id)
    await session.commit()
    return [NotificationResponse.model_validate(notification) for notification in updated]


@router.get("/history", response_model=list[ScanHistoryResponse])
async def list_scan_history(
    connection_id: uuid.UUID | None = None,
    limit: int = Query(default=25, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[ScanHistoryResponse]:
    user_id = await resolve_local_user_id(session, user)
    if connection_id is not None:
        connection_repository = APIConnectionRepository(session)
        connection = await connection_repository.get_for_user(connection_id, user_id)
        if connection is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API connection not found.")

    repository = ScanHistoryRepository(session)
    history = await repository.list_for_user(user_id, connection_id=connection_id, limit=limit)
    return [ScanHistoryResponse.model_validate(item) for item in history]


@router.get("/connections/{connection_id}/history", response_model=list[ScanHistoryResponse])
async def list_connection_scan_history(
    connection_id: uuid.UUID,
    limit: int = Query(default=25, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[ScanHistoryResponse]:
    user_id = await resolve_local_user_id(session, user)
    connection_repository = APIConnectionRepository(session)
    connection = await connection_repository.get_for_user(connection_id, user_id)
    if connection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API connection not found.")

    repository = ScanHistoryRepository(session)
    history = await repository.list_for_user(user_id, connection_id=connection_id, limit=limit)
    return [ScanHistoryResponse.model_validate(item) for item in history]


@router.websocket("/ws")
async def scan_progress_websocket(
    websocket: WebSocket,
    token: str = Query(...),
) -> None:
    from app.db.session import SessionLocal

    if SessionLocal is None:
        await websocket.close(code=1011)
        return

    async with SessionLocal() as session:
        try:
            local_user_id = await _resolve_local_user_id_from_token(token, session)
        except HTTPException:
            await websocket.close(code=4401)
            return

        await scan_progress_hub.connect(local_user_id, websocket)
        snapshot_result = await session.execute(
            select(ScanJob, APIConnection.name)
            .join(APIConnection, APIConnection.id == ScanJob.api_connection_id)
            .where(APIConnection.user_id == local_user_id)
            .order_by(ScanJob.created_at.desc())
            .limit(12)
        )
        snapshot_jobs = [
            serialize_scan_job_event(scan_job, connection_name=connection_name)
            for scan_job, connection_name in snapshot_result.all()
        ]
        await websocket.send_json({"type": "snapshot", "jobs": snapshot_jobs})

        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            await scan_progress_hub.disconnect(local_user_id, websocket)


@router.get("/connections/{connection_id}/schema/latest", response_model=SchemaVersionResponse)
async def get_latest_schema_version(
    connection_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> SchemaVersionResponse:
    user_id = await resolve_local_user_id(session, user)
    connection_repository = APIConnectionRepository(session)
    connection = await connection_repository.get_for_user(connection_id, user_id)
    if connection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API connection not found.")

    schema_repository = SchemaVersionRepository(session)
    schema_version = await schema_repository.get_latest_for_connection(connection_id)
    if schema_version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No schema version found for this connection.")

    return _serialize_schema_version(schema_version)


@router.get("/connections/{connection_id}/schema/versions", response_model=list[SchemaVersionSummaryResponse])
async def list_schema_versions(
    connection_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[SchemaVersionSummaryResponse]:
    user_id = await resolve_local_user_id(session, user)
    connection_repository = APIConnectionRepository(session)
    connection = await connection_repository.get_for_user(connection_id, user_id)
    if connection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API connection not found.")

    schema_repository = SchemaVersionRepository(session)
    versions = await schema_repository.list_for_connection(connection_id)
    return [_serialize_schema_version_summary(version) for version in versions]


@router.get("/connections/{connection_id}/schema/{version_id}", response_model=SchemaVersionResponse)
async def get_schema_version(
    connection_id: uuid.UUID,
    version_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> SchemaVersionResponse:
    user_id = await resolve_local_user_id(session, user)
    connection_repository = APIConnectionRepository(session)
    connection = await connection_repository.get_for_user(connection_id, user_id)
    if connection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API connection not found.")

    schema_repository = SchemaVersionRepository(session)
    schema_version = await schema_repository.get_by_id_for_connection(version_id, connection_id)
    if schema_version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schema version not found.")

    return _serialize_schema_version(schema_version)


@router.get("/connections/{connection_id}/schema/{version_id}/field", response_model=SchemaFieldExplorerResponse)
async def get_schema_field_explorer_details(
    connection_id: uuid.UUID,
    version_id: uuid.UUID,
    column_path: str,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> SchemaFieldExplorerResponse:
    user_id = await resolve_local_user_id(session, user)
    connection_repository = APIConnectionRepository(session)
    connection = await connection_repository.get_for_user(connection_id, user_id)
    if connection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API connection not found.")

    schema_repository = SchemaVersionRepository(session)
    schema_version = await schema_repository.get_by_id_for_connection(version_id, connection_id)
    if schema_version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schema version not found.")

    schema_versions = await schema_repository.list_for_connection(connection_id)
    try:
        return build_schema_field_explorer_response(
            schema_version=schema_version,
            schema_versions=schema_versions,
            column_path=column_path,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/connections/{connection_id}/schema/compare", response_model=SchemaVersionDiffResponse)
async def compare_schema_versions_for_connection(
    connection_id: uuid.UUID,
    from_version_id: uuid.UUID,
    to_version_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> SchemaVersionDiffResponse:
    user_id = await resolve_local_user_id(session, user)
    connection_repository = APIConnectionRepository(session)
    connection = await connection_repository.get_for_user(connection_id, user_id)
    if connection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API connection not found.")

    schema_repository = SchemaVersionRepository(session)
    from_version = await schema_repository.get_by_id_for_connection(from_version_id, connection_id)
    to_version = await schema_repository.get_by_id_for_connection(to_version_id, connection_id)
    if from_version is None or to_version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schema version not found.")

    changes = compare_schema_versions(from_version, to_version)
    lines = build_github_style_diff(from_version, to_version, changes)

    return SchemaVersionDiffResponse(
        from_version=_serialize_schema_version_summary(from_version),
        to_version=_serialize_schema_version_summary(to_version),
        summary=SchemaDiffSummaryResponse(
            added=sum(change.change_type == "added" for change in changes),
            removed=sum(change.change_type == "removed" for change in changes),
            datatype_changed=sum(change.change_type == "datatype_changed" for change in changes),
            coverage_changed=sum(change.change_type == "coverage_changed" for change in changes),
            total_changes=len(changes),
        ),
        lines=lines,
        changes=[
            SchemaDiffEntryResponse(
                change_type=change.change_type,
                column_path=change.column_path,
                display_name=change.display_name,
                sql_name=change.sql_name,
                previous_data_type=change.previous_data_type,
                new_data_type=change.new_data_type,
                previous_coverage_percent=change.previous_coverage_percent,
                new_coverage_percent=change.new_coverage_percent,
                summary=change.summary,
                diff_line=change.diff_line,
            )
            for change in changes
        ],
    )


@router.get("/connections/{connection_id}/schema-compare", response_model=SchemaVersionDiffResponse)
async def compare_schema_versions_for_connection_alias(
    connection_id: uuid.UUID,
    from_version_id: uuid.UUID,
    to_version_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> SchemaVersionDiffResponse:
    return await compare_schema_versions_for_connection(
        connection_id=connection_id,
        from_version_id=from_version_id,
        to_version_id=to_version_id,
        user=user,
        session=session,
    )


@router.post("/connections/{connection_id}/schema/{version_id}/sql/create", response_model=GeneratedSQLResponse)
async def generate_create_table_sql(
    connection_id: uuid.UUID,
    version_id: uuid.UUID,
    request: SQLGenerationRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> GeneratedSQLResponse:
    user_id = await resolve_local_user_id(session, user)
    connection_repository = APIConnectionRepository(session)
    connection = await connection_repository.get_for_user(connection_id, user_id)
    if connection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API connection not found.")

    schema_repository = SchemaVersionRepository(session)
    schema_version = await schema_repository.get_by_id_for_connection(version_id, connection_id)
    if schema_version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schema version not found.")

    content = build_create_table_sql(connection, schema_version, request.table_name)
    artifact = await persist_generated_sql(
        session,
        schema_version=schema_version,
        artifact_name=f"{schema_version.version_label}-create.sql",
        statement_type="create_table",
        content=content,
        dialect=request.dialect,
    )
    await session.commit()
    await session.refresh(artifact)
    return GeneratedSQLResponse.model_validate(artifact)


@router.post("/connections/{connection_id}/schema/sql/migration", response_model=GeneratedSQLResponse)
async def generate_migration_sql(
    connection_id: uuid.UUID,
    request: SQLMigrationRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> GeneratedSQLResponse:
    user_id = await resolve_local_user_id(session, user)
    connection_repository = APIConnectionRepository(session)
    connection = await connection_repository.get_for_user(connection_id, user_id)
    if connection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API connection not found.")

    schema_repository = SchemaVersionRepository(session)
    from_version = await schema_repository.get_by_id_for_connection(request.from_version_id, connection_id)
    to_version = await schema_repository.get_by_id_for_connection(request.to_version_id, connection_id)
    if from_version is None or to_version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schema version not found.")

    content = build_migration_sql(connection, from_version, to_version, request.table_name)
    artifact = await persist_generated_sql(
        session,
        schema_version=to_version,
        artifact_name=f"{from_version.version_label}-to-{to_version.version_label}-migration.sql",
        statement_type="schema_migration",
        content=content,
        dialect=request.dialect,
    )
    await session.commit()
    await session.refresh(artifact)
    return GeneratedSQLResponse.model_validate(artifact)


@router.get("/sql/{artifact_id}", response_model=GeneratedSQLResponse)
async def get_generated_sql_artifact(
    artifact_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> GeneratedSQLResponse:
    user_id = await resolve_local_user_id(session, user)
    result = await session.execute(
        select(GeneratedSQL)
        .join(SchemaVersion, SchemaVersion.id == GeneratedSQL.schema_version_id)
        .join(APIConnection, APIConnection.id == SchemaVersion.api_connection_id)
        .where(
            GeneratedSQL.id == artifact_id,
            APIConnection.user_id == user_id,
        )
    )
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SQL artifact not found.")

    return GeneratedSQLResponse.model_validate(artifact)


@router.get("/sql/{artifact_id}/download", response_class=PlainTextResponse)
async def download_generated_sql_artifact(
    artifact_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> PlainTextResponse:
    artifact_response = await get_generated_sql_artifact(artifact_id, user, session)
    response = PlainTextResponse(content=artifact_response.content)
    response.headers["Content-Disposition"] = f'attachment; filename="{artifact_response.artifact_name}"'
    return response


@router.post("/connections/{connection_id}/schema/{version_id}/xquery", response_model=GeneratedXQueryResponse)
async def generate_xquery(
    connection_id: uuid.UUID,
    version_id: uuid.UUID,
    request: XQueryGenerationRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> GeneratedXQueryResponse:
    user_id = await resolve_local_user_id(session, user)
    connection_repository = APIConnectionRepository(session)
    connection = await connection_repository.get_for_user(connection_id, user_id)
    if connection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API connection not found.")

    schema_repository = SchemaVersionRepository(session)
    schema_version = await schema_repository.get_by_id_for_connection(version_id, connection_id)
    if schema_version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schema version not found.")

    document = build_iics_xquery(
        connection,
        schema_version,
        naming_convention=request.naming_convention,
        separator=request.separator,
        root_element_name=request.root_element_name,
        row_element_name=request.row_element_name,
        emit_child_mapping_comments=request.emit_child_mapping_comments,
    )
    artifact = await persist_generated_xquery(
        session,
        schema_version=schema_version,
        artifact_name=f"{schema_version.version_label}.xq",
        naming_convention=request.naming_convention,
        content=document.content,
    )
    await session.commit()
    await session.refresh(artifact)
    return GeneratedXQueryResponse(
        id=artifact.id,
        schema_version_id=artifact.schema_version_id,
        artifact_name=artifact.artifact_name,
        naming_convention=artifact.naming_convention,
        content=artifact.content,
        collection_mappings=[
            CollectionMappingResponse(
                path=mapping.path,
                parent_path=mapping.parent_path,
                depth=mapping.depth,
                loop_variable=mapping.loop_variable,
                element_name=mapping.element_name,
                item_element_name=mapping.item_element_name,
                nested=mapping.nested,
            )
            for mapping in document.collection_mappings
        ],
    )


@router.get("/xquery/{artifact_id}", response_model=GeneratedXQueryResponse)
async def get_generated_xquery_artifact(
    artifact_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> GeneratedXQueryResponse:
    user_id = await resolve_local_user_id(session, user)
    result = await session.execute(
        select(GeneratedXQuery)
        .join(SchemaVersion, SchemaVersion.id == GeneratedXQuery.schema_version_id)
        .join(APIConnection, APIConnection.id == SchemaVersion.api_connection_id)
        .where(
            GeneratedXQuery.id == artifact_id,
            APIConnection.user_id == user_id,
        )
    )
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="XQuery artifact not found.")

    return GeneratedXQueryResponse(
        id=artifact.id,
        schema_version_id=artifact.schema_version_id,
        artifact_name=artifact.artifact_name,
        naming_convention=artifact.naming_convention,
        content=artifact.content,
        collection_mappings=[],
    )


@router.get("/xquery/{artifact_id}/download", response_class=PlainTextResponse)
async def download_generated_xquery_artifact(
    artifact_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> PlainTextResponse:
    artifact_response = await get_generated_xquery_artifact(artifact_id, user, session)
    response = PlainTextResponse(content=artifact_response.content)
    response.headers["Content-Disposition"] = f'attachment; filename="{artifact_response.artifact_name}"'
    return response


@router.post("/connections/{connection_id}/schema/{version_id}/exports", response_model=ExportResponse, status_code=status.HTTP_201_CREATED)
async def create_schema_export(
    connection_id: uuid.UUID,
    version_id: uuid.UUID,
    request: ExportCreateRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ExportResponse:
    user_id = await resolve_local_user_id(session, user)
    connection_repository = APIConnectionRepository(session)
    connection = await connection_repository.get_for_user(connection_id, user_id)
    if connection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API connection not found.")

    schema_repository = SchemaVersionRepository(session)
    schema_version = await schema_repository.get_by_id_for_connection(version_id, connection_id)
    if schema_version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schema version not found.")

    try:
        export_record = await create_export_record(
            session,
            user_id=user_id,
            connection=connection,
            schema_version=schema_version,
            export_type=request.export_type,
            table_name=request.table_name,
            naming_convention=request.naming_convention,
            separator=request.separator,
            root_element_name=request.root_element_name,
            row_element_name=request.row_element_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await session.commit()
    await session.refresh(export_record)
    return ExportResponse.model_validate(export_record)


@router.get("/exports", response_model=list[ExportResponse])
async def list_exports(
    limit: int = Query(default=20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[ExportResponse]:
    user_id = await resolve_local_user_id(session, user)
    repository = ExportRepository(session)
    exports = await repository.list_for_user(user_id, limit=limit)
    return [ExportResponse.model_validate(item) for item in exports]


@router.get("/exports/{export_id}", response_model=ExportResponse)
async def get_export(
    export_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ExportResponse:
    user_id = await resolve_local_user_id(session, user)
    result = await session.execute(
        select(Export).where(
            Export.id == export_id,
            Export.user_id == user_id,
        )
    )
    export_record = result.scalar_one_or_none()
    if export_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export not found.")
    return ExportResponse.model_validate(export_record)


@router.get("/exports/{export_id}/download", response_class=FileResponse)
async def download_export(
    export_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> FileResponse:
    user_id = await resolve_local_user_id(session, user)
    result = await session.execute(
        select(Export).where(
            Export.id == export_id,
            Export.user_id == user_id,
        )
    )
    export_record = result.scalar_one_or_none()
    if export_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export not found.")

    file_path = Path(export_record.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export file is missing.")

    return FileResponse(
        path=file_path,
        media_type=export_record.metadata_json.get("content_type", "application/octet-stream"),
        filename=export_record.metadata_json.get("file_name", file_path.name),
    )
