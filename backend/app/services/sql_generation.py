from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from app.models.api_connection import APIConnection
from app.models.column import Column
from app.models.generated_sql import GeneratedSQL
from app.models.schema_version import SchemaVersion
from app.repositories.generated_sql import GeneratedSQLRepository
from app.services.naming_service import NamingService
from app.services.schema_versioning import compare_schema_versions

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIMESTAMP_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$"
)


@dataclass
class SQLColumnDefinition:
    identifier: str
    sql_type: str
    nullable: bool


def infer_table_name(connection: APIConnection, schema_version: SchemaVersion, override: str | None = None) -> str:
    base = override or connection.name or f"schema_{schema_version.version_number}"
    return NamingService([]).generate_sql_name(base.replace(" ", "_"))


def _coerce_example(example_value: str | None) -> Any:
    if example_value is None:
        return None
    if example_value in {"True", "False"}:
        return example_value == "True"
    if DATE_RE.match(example_value):
        try:
            return date.fromisoformat(example_value)
        except ValueError:
            return example_value
    if TIMESTAMP_RE.match(example_value):
        try:
            normalized = example_value.replace("Z", "+00:00")
            return datetime.fromisoformat(normalized)
        except ValueError:
            return example_value
    try:
        if "." in example_value:
            return Decimal(example_value)
        return int(example_value)
    except Exception:
        return example_value


def infer_sql_type(column: Column) -> str:
    if column.is_array or column.is_object:
        return "JSONB"

    data_types = {part for part in column.data_type.split("|") if part}
    example = _coerce_example(column.example_value)

    if "object" in data_types or "array" in data_types:
        return "JSONB"
    if "boolean" in data_types:
        return "BOOLEAN"
    if data_types <= {"integer"}:
        return "NUMERIC"
    if data_types & {"number"}:
        return "NUMERIC"
    if isinstance(example, datetime):
        return "TIMESTAMP"
    if isinstance(example, date):
        return "DATE"
    if isinstance(example, bool):
        return "BOOLEAN"
    if isinstance(example, (int, Decimal, float)):
        return "NUMERIC"

    max_length = column.statistics.maximum_length if column.statistics else None
    if isinstance(example, str):
        if TIMESTAMP_RE.match(example):
            return "TIMESTAMP"
        if DATE_RE.match(example):
            return "DATE"
    if max_length is None:
        max_length = max(len(column.example_value), 64) if column.example_value else 255
    max_length = max(8, min(int(max_length), 65535))
    return f"VARCHAR({max_length})"


def build_column_sql_preview(column: Column, *, naming_service: NamingService | None = None) -> str:
    naming_service = naming_service or NamingService([column.column_path])
    identifier = naming_service.generate_sql_name(column.column_path)
    nullability = "" if column.is_nullable else " NOT NULL"
    return f'"{identifier}" {infer_sql_type(column)}{nullability}'


def build_create_table_sql(connection: APIConnection, schema_version: SchemaVersion, table_name: str | None = None) -> str:
    resolved_table_name = infer_table_name(connection, schema_version, table_name)
    naming_service = NamingService.for_schema_version(schema_version)
    column_definitions: list[SQLColumnDefinition] = []
    for column in sorted(schema_version.columns, key=lambda item: item.column_path):
        if column.column_path.endswith("[]"):
            continue
        column_definitions.append(
            SQLColumnDefinition(
                identifier=naming_service.generate_sql_name(column.column_path),
                sql_type=infer_sql_type(column),
                nullable=column.is_nullable,
            )
        )

    lines = [f'CREATE TABLE "{resolved_table_name}" (']
    for index, definition in enumerate(column_definitions):
        suffix = "," if index < len(column_definitions) - 1 else ""
        nullability = "" if definition.nullable else " NOT NULL"
        lines.append(f'  "{definition.identifier}" {definition.sql_type}{nullability}{suffix}')
    lines.append(");")
    return "\n".join(lines)


def _find_column(version: SchemaVersion, column_path: str) -> Column | None:
    for column in version.columns:
        if column.column_path == column_path:
            return column
    return None


def build_migration_sql(
    connection: APIConnection,
    from_version: SchemaVersion,
    to_version: SchemaVersion,
    table_name: str | None = None,
) -> str:
    resolved_table_name = infer_table_name(connection, to_version, table_name)
    naming_service = NamingService(
        [column.column_path for column in from_version.columns] + [column.column_path for column in to_version.columns]
    )
    changes = compare_schema_versions(from_version, to_version)
    statements: list[str] = []

    for change in changes:
        if change.change_type == "added":
            column = _find_column(to_version, change.column_path)
            if column is None or column.column_path.endswith("[]"):
                continue
            statements.append(
                f'ALTER TABLE "{resolved_table_name}" ADD COLUMN "{naming_service.generate_sql_name(change.column_path)}" '
                f"{infer_sql_type(column)}{' NOT NULL' if not column.is_nullable else ''};"
            )
        elif change.change_type == "removed":
            statements.append(
                f'ALTER TABLE "{resolved_table_name}" DROP COLUMN "{naming_service.generate_sql_name(change.column_path)}";'
            )
        elif change.change_type == "datatype_changed":
            column = _find_column(to_version, change.column_path)
            if column is None or column.column_path.endswith("[]"):
                continue
            statements.append(
                f'ALTER TABLE "{resolved_table_name}" ALTER COLUMN "{naming_service.generate_sql_name(change.column_path)}" '
                f"TYPE {infer_sql_type(column)};"
            )

    if not statements:
        return f"-- No SQL changes detected between schema versions {from_version.version_number} and {to_version.version_number}."
    return "\n".join(statements)


async def persist_generated_sql(
    session: Any,
    *,
    schema_version: SchemaVersion,
    artifact_name: str,
    statement_type: str,
    content: str,
    dialect: str,
) -> GeneratedSQL:
    repository = GeneratedSQLRepository(session)
    return await repository.create(
        schema_version_id=schema_version.id,
        artifact_name=artifact_name,
        dialect=dialect,
        statement_type=statement_type,
        content=content,
    )
