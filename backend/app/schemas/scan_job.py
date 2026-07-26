from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ScanJobStartRequest(BaseModel):
    response_root_override: str | None = None
    page_size: int | None = None
    starting_cursor: str | None = None
    trigger_mode: str = "manual"


class ScanJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    api_connection_id: UUID
    status: str
    current_record: int
    records_scanned: int
    columns_found: int
    estimated_seconds_remaining: int | None
    current_cursor: str | None
    current_api: str | None
    speed_records_per_second: int | None
    error_message: str | None
    metadata: dict[str, Any]

    @classmethod
    def from_model(cls, scan_job: Any) -> "ScanJobResponse":
        return cls(
            id=scan_job.id,
            api_connection_id=scan_job.api_connection_id,
            status=scan_job.status,
            current_record=scan_job.current_record,
            records_scanned=scan_job.records_scanned,
            columns_found=scan_job.columns_found,
            estimated_seconds_remaining=scan_job.estimated_seconds_remaining,
            current_cursor=scan_job.current_cursor,
            current_api=scan_job.current_api,
            speed_records_per_second=scan_job.speed_records_per_second,
            error_message=scan_job.error_message,
            metadata=scan_job.metadata_json or {},
        )


class ScanDashboardJobResponse(BaseModel):
    id: UUID
    api_connection_id: UUID
    connection_name: str | None = None
    status: str
    current_record: int
    records_scanned: int
    columns_found: int
    estimated_seconds_remaining: int | None
    current_cursor: str | None
    current_api: str | None
    speed_records_per_second: int | None
    error_message: str | None
    current_page: int | None
    new_columns_discovered: int = 0
    removed_columns: int = 0
    added_columns: int = 0
    datatype_changes: int = 0
    coverage_changes: int = 0
    metadata: dict[str, Any]


class ScanHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    api_connection_id: UUID
    scan_job_id: UUID
    started_at: datetime
    completed_at: datetime | None
    status: str
    records_scanned: int
    columns_found: int
    trigger_mode: str
    schema_version_id: UUID | None
    compared_to_schema_version_id: UUID | None
    summary: dict[str, Any]
    change_summary: dict[str, Any]
    error_message: str | None
