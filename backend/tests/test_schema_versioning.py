from types import SimpleNamespace
from uuid import uuid4

from app.services.schema_versioning import build_github_style_diff, compare_schema_versions


def _column(path: str, data_type: str, coverage: float | None):
    statistics = None if coverage is None else SimpleNamespace(coverage_percent=coverage)
    return SimpleNamespace(id=uuid4(), column_path=path, data_type=data_type, statistics=statistics)


def _version(version_number: int, columns: list[object]):
    return SimpleNamespace(
        id=uuid4(),
        api_connection_id=uuid4(),
        version_number=version_number,
        version_label=f"scan-{version_number}",
        status="active",
        summary={},
        change_notes=None,
        columns=columns,
    )


def test_compare_schema_versions_detects_added_removed_datatype_and_coverage_changes():
    previous = _version(
        1,
        [
            _column("employee.name", "string", 100.0),
            _column("employee.age", "integer", 100.0),
            _column("employee.legacy", "string", 50.0),
        ],
    )
    current = _version(
        2,
        [
            _column("employee.name", "string", 75.0),
            _column("employee.age", "integer|string", 100.0),
            _column("employee.title", "string", 100.0),
        ],
    )

    changes = compare_schema_versions(previous, current)
    change_types_by_path = {(change.column_path, change.change_type) for change in changes}

    assert ("employee.title", "added") in change_types_by_path
    assert ("employee.legacy", "removed") in change_types_by_path
    assert ("employee.age", "datatype_changed") in change_types_by_path
    assert ("employee.name", "coverage_changed") in change_types_by_path


def test_build_github_style_diff_renders_prefixed_lines():
    previous = _version(1, [_column("a", "string", 100.0)])
    current = _version(2, [_column("a", "string", 90.0), _column("b", "integer", 100.0)])

    changes = compare_schema_versions(previous, current)
    lines = build_github_style_diff(previous, current, changes)

    assert lines[0].startswith("diff --git")
    assert any(line.startswith("+ ") for line in lines)
    assert any(line.startswith("~ ") for line in lines)
