from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ColumnStatisticsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    occurrences: int
    coverage_percent: float
    first_seen_record: int | None
    last_seen_record: int | None
    data_type: str
    average_length: float | None
    maximum_length: int | None
    null_count: int
    unique_count: int | None


class DiscoveredColumnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    schema_version_id: UUID
    column_path: str
    display_name: str
    sql_name: str
    xquery_name: str
    display_parent_path: str | None
    parent_path: str | None
    depth: int
    data_type: str
    is_nullable: bool
    is_array: bool
    is_object: bool
    example_value: str | None
    statistics: ColumnStatisticsResponse | None = None


class SchemaVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    api_connection_id: UUID
    version_number: int
    version_label: str
    status: str
    summary: dict[str, Any]
    change_notes: str | None
    columns: list[DiscoveredColumnResponse]


class SchemaVersionSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    api_connection_id: UUID
    version_number: int
    version_label: str
    status: str
    summary: dict[str, Any]
    change_notes: str | None


class SchemaDiffEntryResponse(BaseModel):
    change_type: str
    column_path: str
    display_name: str
    sql_name: str
    previous_data_type: str | None = None
    new_data_type: str | None = None
    previous_coverage_percent: float | None = None
    new_coverage_percent: float | None = None
    summary: str
    diff_line: str


class SchemaDiffSummaryResponse(BaseModel):
    added: int
    removed: int
    datatype_changed: int
    coverage_changed: int
    total_changes: int


class SchemaVersionDiffResponse(BaseModel):
    from_version: SchemaVersionSummaryResponse
    to_version: SchemaVersionSummaryResponse
    summary: SchemaDiffSummaryResponse
    lines: list[str]
    changes: list[SchemaDiffEntryResponse]
