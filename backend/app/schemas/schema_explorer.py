from uuid import UUID

from pydantic import BaseModel


class SchemaFieldHistoryEntryResponse(BaseModel):
    from_version_id: UUID
    from_version_label: str
    from_version_number: int
    to_version_id: UUID
    to_version_label: str
    to_version_number: int
    change_type: str
    summary: str
    previous_data_type: str | None = None
    new_data_type: str | None = None
    previous_coverage_percent: float | None = None
    new_coverage_percent: float | None = None


class SchemaFieldExplorerResponse(BaseModel):
    column_path: str
    display_name: str
    sql_name: str
    display_parent_path: str | None
    parent_path: str | None
    depth: int
    data_type: str
    coverage_percent: float | None
    occurrences: int | None
    example_value: str | None
    average_length: float | None
    maximum_length: int | None
    null_count: int | None
    unique_count: int | None
    sql_preview: str
    xquery_preview: str
    history: list[SchemaFieldHistoryEntryResponse]
