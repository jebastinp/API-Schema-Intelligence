from __future__ import annotations

from typing import Any

from app.models.column import Column
from app.models.schema_version import SchemaVersion
from app.schemas.schema_explorer import (
    SchemaFieldExplorerResponse,
    SchemaFieldHistoryEntryResponse,
)
from app.services.naming_service import NamingService
from app.services.schema_versioning import compare_schema_versions
from app.services.sql_generation import build_column_sql_preview
from app.services.xquery_generation import build_field_xquery_preview


def _find_column(schema_version: SchemaVersion, column_path: str) -> Column | None:
    return next((column for column in schema_version.columns if column.column_path == column_path), None)


def _history_for_column(schema_versions: list[SchemaVersion], column_path: str) -> list[SchemaFieldHistoryEntryResponse]:
    history: list[SchemaFieldHistoryEntryResponse] = []
    chronological_versions = sorted(schema_versions, key=lambda version: version.version_number)

    for previous, current in zip(chronological_versions, chronological_versions[1:], strict=False):
        for change in compare_schema_versions(previous, current):
            if change.column_path != column_path:
                continue
            history.append(
                SchemaFieldHistoryEntryResponse(
                    from_version_id=previous.id,
                    from_version_label=previous.version_label,
                    from_version_number=previous.version_number,
                    to_version_id=current.id,
                    to_version_label=current.version_label,
                    to_version_number=current.version_number,
                    change_type=change.change_type,
                    summary=change.summary,
                    previous_data_type=change.previous_data_type,
                    new_data_type=change.new_data_type,
                    previous_coverage_percent=change.previous_coverage_percent,
                    new_coverage_percent=change.new_coverage_percent,
                )
            )

    return list(reversed(history))


def build_schema_field_explorer_response(
    *,
    schema_version: SchemaVersion,
    schema_versions: list[SchemaVersion],
    column_path: str,
    xquery_naming_convention: str = "parent_prefix",
    xquery_separator: str = "_",
) -> SchemaFieldExplorerResponse:
    column = _find_column(schema_version, column_path)
    if column is None:
        raise ValueError(f"Column {column_path} not found.")

    naming_service = NamingService.for_schema_version(schema_version)
    statistics = column.statistics
    return SchemaFieldExplorerResponse(
        column_path=column.column_path,
        display_name=naming_service.generate_display_name(column.column_path),
        sql_name=naming_service.generate_sql_name(column.column_path),
        display_parent_path=naming_service.display_parent_path(column.column_path),
        parent_path=column.parent_path,
        depth=column.depth,
        data_type=column.data_type,
        coverage_percent=float(statistics.coverage_percent) if statistics and statistics.coverage_percent is not None else None,
        occurrences=statistics.occurrences if statistics else None,
        example_value=column.example_value,
        average_length=float(statistics.average_length) if statistics and statistics.average_length is not None else None,
        maximum_length=statistics.maximum_length if statistics else None,
        null_count=statistics.null_count if statistics else None,
        unique_count=statistics.unique_count if statistics else None,
        sql_preview=build_column_sql_preview(column, naming_service=naming_service),
        xquery_preview=build_field_xquery_preview(
            schema_version,
            column_path,
            naming_convention=xquery_naming_convention,
            separator=xquery_separator,
        ),
        history=_history_for_column(schema_versions, column_path),
    )
