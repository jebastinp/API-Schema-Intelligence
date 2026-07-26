from __future__ import annotations

import csv
import io
import json
import uuid
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.models.api_connection import APIConnection
from app.models.export import Export
from app.models.schema_version import SchemaVersion
from app.repositories.export import ExportRepository
from app.services.naming_service import NamingService
from app.services.sql_generation import build_create_table_sql
from app.services.xquery_generation import build_iics_xquery


EXPORT_CONTENT_TYPES = {
    "sql": "text/sql; charset=utf-8",
    "xquery": "application/xquery; charset=utf-8",
    "csv": "text/csv; charset=utf-8",
    "excel": "application/vnd.ms-excel",
    "json_schema": "application/schema+json; charset=utf-8",
    "markdown": "text/markdown; charset=utf-8",
}


def _ensure_export_directory() -> Path:
    directory = settings.export_path
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _safe_file_name(value: str) -> str:
    return "".join(character if character.isalnum() or character in {"-", "_", "."} else "_" for character in value)


def _column_rows(schema_version: SchemaVersion) -> list[dict[str, Any]]:
    naming_service = NamingService.for_schema_version(schema_version)
    rows: list[dict[str, Any]] = []
    for column in sorted(schema_version.columns, key=lambda item: item.column_path):
        statistics = column.statistics
        rows.append(
            {
                "display_name": naming_service.generate_display_name(column.column_path),
                "sql_name": naming_service.generate_sql_name(column.column_path),
                "column_path": column.column_path,
                "parent_path": column.parent_path or "",
                "display_parent_path": naming_service.display_parent_path(column.column_path) or "",
                "depth": column.depth,
                "data_type": column.data_type,
                "nullable": column.is_nullable,
                "array": column.is_array,
                "object": column.is_object,
                "example_value": column.example_value or "",
                "coverage_percent": float(statistics.coverage_percent) if statistics and statistics.coverage_percent is not None else "",
                "occurrences": statistics.occurrences if statistics else "",
                "maximum_length": statistics.maximum_length if statistics else "",
                "average_length": float(statistics.average_length) if statistics and statistics.average_length is not None else "",
                "null_count": statistics.null_count if statistics else "",
                "unique_count": statistics.unique_count if statistics else "",
            }
        )
    return rows


def build_csv_export(schema_version: SchemaVersion) -> str:
    output = io.StringIO()
    rows = _column_rows(schema_version)
    fieldnames = list(rows[0].keys()) if rows else [
        "display_name",
        "sql_name",
        "column_path",
        "parent_path",
        "display_parent_path",
        "depth",
        "data_type",
        "nullable",
        "array",
        "object",
        "example_value",
        "coverage_percent",
        "occurrences",
        "maximum_length",
        "average_length",
        "null_count",
        "unique_count",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def build_excel_xml_export(schema_version: SchemaVersion) -> str:
    rows = _column_rows(schema_version)
    headers = list(rows[0].keys()) if rows else ["column_path"]

    def cell(value: Any) -> str:
        safe = str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        return f'<Cell><Data ss:Type="String">{safe}</Data></Cell>'

    xml_rows = [
        "<Row>" + "".join(cell(header) for header in headers) + "</Row>",
    ]
    for row in rows:
        xml_rows.append("<Row>" + "".join(cell(row.get(header, "")) for header in headers) + "</Row>")

    return "\n".join(
        [
            '<?xml version="1.0"?>',
            '<?mso-application progid="Excel.Sheet"?>',
            '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
            ' xmlns:o="urn:schemas-microsoft-com:office:office"',
            ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
            ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
            ' <Worksheet ss:Name="SchemaColumns">',
            "  <Table>",
            *[f"   {row}" for row in xml_rows],
            "  </Table>",
            " </Worksheet>",
            "</Workbook>",
        ]
    )


def build_json_schema_export(schema_version: SchemaVersion) -> str:
    naming_service = NamingService.for_schema_version(schema_version)
    root: dict[str, Any] = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": schema_version.version_label,
        "type": "object",
        "properties": {},
    }
    properties = root["properties"]

    for column in sorted(schema_version.columns, key=lambda item: item.column_path):
        path_segments = [segment for segment in naming_service.generate_display_name(column.column_path).split(".") if segment]
        if not path_segments:
            continue
        current_props = properties
        for index, segment in enumerate(path_segments):
            name = segment
            is_last = index == len(path_segments) - 1

            if is_last:
                current_props[name] = _json_schema_for_column(column)
            else:
                if name not in current_props:
                    current_props[name] = {"type": "object", "properties": {}}
                current_props[name].setdefault("type", "object")
                current_props[name].setdefault("properties", {})
                current_props = current_props[name]["properties"]

    return json.dumps(root, indent=2)


def _json_schema_for_column(column: Any) -> dict[str, Any]:
    types = [part for part in column.data_type.split("|") if part and part != "null"]
    mapped_types: list[str] = []
    for data_type in types or ["string"]:
        if data_type == "integer":
            mapped_types.append("integer")
        elif data_type == "number":
            mapped_types.append("number")
        elif data_type == "boolean":
            mapped_types.append("boolean")
        elif data_type == "object":
            mapped_types.append("object")
        elif data_type == "array":
            mapped_types.append("array")
        else:
            mapped_types.append("string")
    schema_type: Any = mapped_types[0] if len(set(mapped_types)) == 1 else sorted(set(mapped_types))
    schema: dict[str, Any] = {"type": schema_type}
    if column.example_value:
        schema["examples"] = [column.example_value]
    if column.is_array:
        schema = {"type": "array", "items": {"type": "object" if column.is_object else "string"}}
    elif column.is_object:
        schema = {"type": "object", "properties": {}}
    return schema


def build_markdown_export(connection: APIConnection, schema_version: SchemaVersion) -> str:
    lines = [
        f"# Schema Export: {connection.name}",
        "",
        f"- Version: `{schema_version.version_label}`",
        f"- Columns: `{len(schema_version.columns)}`",
        "",
        "| Display Name | Datatype | Coverage | Occurrences | Example |",
        "| --- | --- | ---: | ---: | --- |",
    ]
    for row in _column_rows(schema_version):
        lines.append(
            f"| `{row['display_name'] or row['column_path']}` | `{row['data_type']}` | {row['coverage_percent'] or 'N/A'} | {row['occurrences'] or 'N/A'} | `{row['example_value']}` |"
        )
    return "\n".join(lines)


def generate_export_content(
    *,
    export_type: str,
    connection: APIConnection,
    schema_version: SchemaVersion,
    table_name: str | None,
    naming_convention: str,
    separator: str,
    root_element_name: str,
    row_element_name: str,
) -> tuple[str, str]:
    if export_type == "sql":
        return build_create_table_sql(connection, schema_version, table_name), "sql"
    if export_type == "xquery":
        document = build_iics_xquery(
            connection,
            schema_version,
            naming_convention=naming_convention,
            separator=separator,
            root_element_name=root_element_name,
            row_element_name=row_element_name,
            emit_child_mapping_comments=True,
        )
        return document.content, "xq"
    if export_type == "csv":
        return build_csv_export(schema_version), "csv"
    if export_type == "excel":
        return build_excel_xml_export(schema_version), "xls"
    if export_type == "json_schema":
        return build_json_schema_export(schema_version), "json"
    if export_type == "markdown":
        return build_markdown_export(connection, schema_version), "md"
    raise ValueError(f"Unsupported export type: {export_type}")


async def create_export_record(
    session: Any,
    *,
    user_id: uuid.UUID,
    connection: APIConnection,
    schema_version: SchemaVersion,
    export_type: str,
    table_name: str | None,
    naming_convention: str,
    separator: str,
    root_element_name: str,
    row_element_name: str,
) -> Export:
    content, extension = generate_export_content(
        export_type=export_type,
        connection=connection,
        schema_version=schema_version,
        table_name=table_name,
        naming_convention=naming_convention,
        separator=separator,
        root_element_name=root_element_name,
        row_element_name=row_element_name,
    )
    export_id = uuid.uuid4()
    file_name = _safe_file_name(f"{connection.name}-{schema_version.version_label}-{export_type}.{extension}")
    file_path = _ensure_export_directory() / f"{export_id}-{file_name}"
    file_path.write_text(content, encoding="utf-8")

    repository = ExportRepository(session)
    export_record = await repository.create(
        id=export_id,
        user_id=user_id,
        schema_version_id=schema_version.id,
        export_type=export_type,
        file_path=str(file_path),
        metadata_json={
            "file_name": file_name,
            "content_type": EXPORT_CONTENT_TYPES[export_type],
            "table_name": table_name,
            "naming_convention": naming_convention,
            "separator": separator,
        },
    )
    return export_record
