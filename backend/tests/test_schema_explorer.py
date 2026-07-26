from types import SimpleNamespace
from uuid import uuid4

from app.services.schema_explorer import build_schema_field_explorer_response


def _stats(
    *,
    coverage_percent: float,
    occurrences: int,
    average_length: float | None = None,
    maximum_length: int | None = None,
    null_count: int = 0,
    unique_count: int | None = None,
):
    return SimpleNamespace(
        coverage_percent=coverage_percent,
        occurrences=occurrences,
        average_length=average_length,
        maximum_length=maximum_length,
        null_count=null_count,
        unique_count=unique_count,
    )


def _column(
    path: str,
    *,
    data_type: str = "string",
    example_value: str | None = "Ava",
    is_nullable: bool = True,
    is_array: bool = False,
    is_object: bool = False,
    depth: int = 0,
    parent_path: str | None = None,
    statistics=None,
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
        statistics=statistics,
    )


def _version(number: int, columns: list[object], response_root: str = "data"):
    return SimpleNamespace(
        id=uuid4(),
        api_connection_id=uuid4(),
        version_number=number,
        version_label=f"scan-{number}",
        summary={"response_root": response_root},
        columns=columns,
    )


def test_schema_explorer_builds_field_details_with_history_and_previews():
    v1 = _version(
        1,
        [
            _column("data[]", is_object=True),
            _column(
                "data[].businessAddress.lineOne",
                parent_path="data[].businessAddress",
                depth=2,
                statistics=_stats(coverage_percent=100.0, occurrences=10, average_length=12.0, maximum_length=20, unique_count=5),
            ),
        ],
    )
    v2 = _version(
        2,
        [
            _column("data[]", is_object=True),
            _column(
                "data[].businessAddress.lineOne",
                parent_path="data[].businessAddress",
                depth=2,
                data_type="string|integer",
                statistics=_stats(coverage_percent=80.0, occurrences=8, average_length=10.0, maximum_length=22, unique_count=4),
            ),
        ],
    )

    response = build_schema_field_explorer_response(
        schema_version=v2,
        schema_versions=[v1, v2],
        column_path="data[].businessAddress.lineOne",
    )

    assert response.coverage_percent == 80.0
    assert response.occurrences == 8
    assert response.display_name == "lineOne"
    assert response.sql_name == "lineone"
    assert response.sql_preview.startswith('"lineone"')
    assert "<lineOne>" in response.xquery_preview
    assert len(response.history) == 2
    assert {entry.change_type for entry in response.history} == {"datatype_changed", "coverage_changed"}
