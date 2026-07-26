from types import SimpleNamespace
from uuid import uuid4

from app.services.export_generation import (
    build_csv_export,
    build_excel_xml_export,
    build_json_schema_export,
    build_markdown_export,
    generate_export_content,
)


def _stats():
    return SimpleNamespace(
        coverage_percent=87.5,
        occurrences=14,
        maximum_length=32,
        average_length=12.5,
        null_count=1,
        unique_count=9,
    )


def _column(
    path: str,
    *,
    data_type: str = "string",
    is_nullable: bool = True,
    is_array: bool = False,
    is_object: bool = False,
    parent_path: str | None = None,
    depth: int = 0,
    example_value: str | None = "Ava",
):
    return SimpleNamespace(
        id=uuid4(),
        column_path=path,
        parent_path=parent_path,
        depth=depth,
        data_type=data_type,
        is_nullable=is_nullable,
        is_array=is_array,
        is_object=is_object,
        example_value=example_value,
        statistics=_stats(),
    )


def _schema_version(columns: list[object]):
    return SimpleNamespace(
        id=uuid4(),
        version_label="scan-4",
        version_number=4,
        summary={"response_root": "data"},
        columns=columns,
    )


def _connection():
    return SimpleNamespace(name="Employee Profile API")


def test_build_csv_export_contains_schema_rows():
    schema_version = _schema_version([_column("data[].employee.name", parent_path="data[].employee", depth=2)])

    content = build_csv_export(schema_version)

    assert "display_name,sql_name,column_path,parent_path,display_parent_path,depth,data_type" in content
    assert "name,name,data[].employee.name,data[].employee,,2,string" in content


def test_build_excel_xml_export_produces_excel_workbook():
    schema_version = _schema_version([_column("data[].employee.name")])

    content = build_excel_xml_export(schema_version)

    assert "<?mso-application progid=\"Excel.Sheet\"?>" in content
    assert "<Worksheet ss:Name=\"SchemaColumns\">" in content


def test_build_json_schema_export_nests_properties():
    schema_version = _schema_version(
        [
            _column("data[].employee", is_object=True),
            _column("data[].employee.name", parent_path="data[].employee", depth=2),
        ]
    )

    content = build_json_schema_export(schema_version)

    assert "\"employee\"" in content
    assert "\"name\"" in content


def test_build_markdown_export_contains_table():
    schema_version = _schema_version([_column("data[].employee.name")])

    content = build_markdown_export(_connection(), schema_version)

    assert "# Schema Export: Employee Profile API" in content
    assert "| Display Name | Datatype | Coverage | Occurrences | Example |" in content


def test_generate_export_content_supports_all_types():
    schema_version = _schema_version([_column("data[].employee.name")])
    connection = _connection()

    for export_type in ["sql", "xquery", "csv", "excel", "json_schema", "markdown"]:
        content, extension = generate_export_content(
            export_type=export_type,
            connection=connection,
            schema_version=schema_version,
            table_name=None,
            naming_convention="parent_prefix",
            separator="_",
            root_element_name="rows",
            row_element_name="row",
        )
        assert content
        assert extension
