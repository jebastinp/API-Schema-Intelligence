from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ScannerOptions(BaseModel):
    response_root_override: str | None = None
    max_pages: int | None = 5
    max_records: int | None = 500
    page_size: int | None = None
    starting_cursor: str | None = None


class ScannerPayloadRequest(BaseModel):
    payload: dict[str, Any] | list[Any]
    options: ScannerOptions = ScannerOptions()


class CursorDetection(BaseModel):
    key: str | None = None
    path: str | None = None
    value_preview: str | None = None
    request_parameter: str | None = None
    strategy: str


class CollectionDescriptor(BaseModel):
    path: str
    sample_size: int
    contains_objects: bool
    contains_nested_arrays: bool
    effective_dated: bool = False


class FieldDescriptor(BaseModel):
    path: str
    parent_path: str | None = None
    depth: int
    data_type: str
    nullable: bool
    is_array: bool = False
    is_object: bool = False
    is_collection_object: bool = False
    sample_value: str | None = None


class ScannerFeatureSummary(BaseModel):
    update_sequence_paths: list[str]
    next_cursor_paths: list[str]
    effective_dated_paths: list[str]
    nested_array_paths: list[str]
    collection_paths: list[str]
    incremental_supported: bool


class ScannerAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    connection_id: UUID | None = None
    endpoint_format: str
    response_root: str
    scanned_pages: int
    scanned_records: int
    cursor_detection: CursorDetection
    feature_summary: ScannerFeatureSummary
    collections: list[CollectionDescriptor]
    fields: list[FieldDescriptor]
    warnings: list[str]
