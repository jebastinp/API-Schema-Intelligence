from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.models.schema_version import SchemaVersion
from app.repositories.column_history import ColumnHistoryRepository
from app.services.naming_service import NamingService


@dataclass
class SchemaChange:
    change_type: str
    column_path: str
    display_name: str
    sql_name: str
    previous_data_type: str | None
    new_data_type: str | None
    previous_coverage_percent: float | None
    new_coverage_percent: float | None
    summary: str

    @property
    def diff_line(self) -> str:
        prefix = {
            "added": "+",
            "removed": "-",
            "datatype_changed": "~",
            "coverage_changed": "~",
        }.get(self.change_type, "~")
        return f"{prefix} {self.summary}"


def _column_map(schema_version: SchemaVersion) -> dict[str, Any]:
    return {column.column_path: column for column in schema_version.columns}


def _coverage(column: Any) -> float | None:
    if column.statistics is None:
        return None
    coverage_percent = getattr(column.statistics, "coverage_percent", None)
    if coverage_percent is None:
        return None
    return float(coverage_percent)


def _round_coverage(value: float | None) -> float | None:
    if value is None:
        return None
    return round(float(value), 2)


def compare_schema_versions(previous: SchemaVersion, current: SchemaVersion) -> list[SchemaChange]:
    previous_columns = _column_map(previous)
    current_columns = _column_map(current)
    naming_service = NamingService(
        [column.column_path for column in previous.columns] + [column.column_path for column in current.columns]
    )
    changes: list[SchemaChange] = []

    previous_paths = set(previous_columns)
    current_paths = set(current_columns)

    for path in sorted(current_paths - previous_paths):
        column = current_columns[path]
        coverage = _round_coverage(_coverage(column))
        changes.append(
            SchemaChange(
                change_type="added",
                column_path=path,
                display_name=naming_service.generate_display_name(path),
                sql_name=naming_service.generate_sql_name(path),
                previous_data_type=None,
                new_data_type=column.data_type,
                previous_coverage_percent=None,
                new_coverage_percent=coverage,
                summary=(
                    f"{naming_service.generate_display_name(path)} added as {column.data_type} "
                    f"({coverage if coverage is not None else 'n/a'}% coverage)"
                ),
            )
        )

    for path in sorted(previous_paths - current_paths):
        column = previous_columns[path]
        coverage = _round_coverage(_coverage(column))
        changes.append(
            SchemaChange(
                change_type="removed",
                column_path=path,
                display_name=naming_service.generate_display_name(path),
                sql_name=naming_service.generate_sql_name(path),
                previous_data_type=column.data_type,
                new_data_type=None,
                previous_coverage_percent=coverage,
                new_coverage_percent=None,
                summary=(
                    f"{naming_service.generate_display_name(path)} removed "
                    f"(was {column.data_type}, {coverage if coverage is not None else 'n/a'}% coverage)"
                ),
            )
        )

    for path in sorted(previous_paths & current_paths):
        previous_column = previous_columns[path]
        current_column = current_columns[path]
        previous_coverage = _round_coverage(_coverage(previous_column))
        current_coverage = _round_coverage(_coverage(current_column))

        if previous_column.data_type != current_column.data_type:
            changes.append(
                SchemaChange(
                    change_type="datatype_changed",
                    column_path=path,
                    display_name=naming_service.generate_display_name(path),
                    sql_name=naming_service.generate_sql_name(path),
                    previous_data_type=previous_column.data_type,
                    new_data_type=current_column.data_type,
                    previous_coverage_percent=previous_coverage,
                    new_coverage_percent=current_coverage,
                    summary=(
                        f"{naming_service.generate_display_name(path)} datatype changed from "
                        f"{previous_column.data_type} to {current_column.data_type}"
                    ),
                )
            )

        if previous_coverage != current_coverage:
            changes.append(
                SchemaChange(
                    change_type="coverage_changed",
                    column_path=path,
                    display_name=naming_service.generate_display_name(path),
                    sql_name=naming_service.generate_sql_name(path),
                    previous_data_type=previous_column.data_type,
                    new_data_type=current_column.data_type,
                    previous_coverage_percent=previous_coverage,
                    new_coverage_percent=current_coverage,
                    summary=(
                        f"{naming_service.generate_display_name(path)} coverage changed from "
                        f"{previous_coverage if previous_coverage is not None else 'n/a'}% "
                        f"to {current_coverage if current_coverage is not None else 'n/a'}%"
                    ),
                )
            )

    return changes


def build_github_style_diff(previous: SchemaVersion, current: SchemaVersion, changes: list[SchemaChange]) -> list[str]:
    lines = [
        f"diff --git schema-v{previous.version_number} schema-v{current.version_number}",
        f"--- schema-v{previous.version_number}",
        f"+++ schema-v{current.version_number}",
        f"@@ connection:{current.api_connection_id} schema:{previous.version_number}->{current.version_number} @@",
    ]
    lines.extend(change.diff_line for change in changes)
    return lines


async def persist_schema_version_history(
    session: Any,
    *,
    previous_version: SchemaVersion | None,
    current_version: SchemaVersion,
) -> list[SchemaChange]:
    if previous_version is None:
        return []

    changes = compare_schema_versions(previous_version, current_version)
    if not changes:
        return []

    previous_columns = _column_map(previous_version)
    current_columns = _column_map(current_version)
    history_repository = ColumnHistoryRepository(session)

    rows: list[dict[str, Any]] = []
    for change in changes:
        if change.change_type == "removed":
            column_id = previous_columns[change.column_path].id
        else:
            column_id = current_columns[change.column_path].id
        rows.append(
            {
                "column_id": column_id,
                "schema_version_id": current_version.id,
                "change_type": change.change_type,
                "previous_data_type": change.previous_data_type,
                "new_data_type": change.new_data_type,
                "previous_coverage_percent": change.previous_coverage_percent,
                "new_coverage_percent": change.new_coverage_percent,
                "summary": change.summary,
                "details": {
                    "column_path": change.column_path,
                    "diff_line": change.diff_line,
                },
            }
        )

    await history_repository.create_many(rows)
    return changes
