from types import SimpleNamespace
from uuid import uuid4

from app.services.xquery_generation import build_iics_xquery


def _column(
    path: str,
    *,
    is_array: bool = False,
    is_object: bool = False,
    data_type: str = "string",
):
    return SimpleNamespace(
        id=uuid4(),
        column_path=path,
        is_array=is_array,
        is_object=is_object,
        is_nullable=True,
        data_type=data_type,
        example_value=None,
        statistics=None,
    )


def _schema_version(columns: list[object], response_root: str = "data"):
    return SimpleNamespace(
        id=uuid4(),
        version_label="scan-2",
        version_number=2,
        summary={"response_root": response_root},
        columns=columns,
    )


def _connection(name: str = "Employee API"):
    return SimpleNamespace(name=name)


def test_xquery_uses_parent_prefix_for_duplicate_leaf_names():
    schema_version = _schema_version(
        [
            _column("data[]", is_object=True),
            _column("data[].businessAddress", is_object=True),
            _column("data[].businessAddress.lineOne"),
            _column("data[].homeAddress", is_object=True),
            _column("data[].homeAddress.lineOne"),
        ]
    )

    document = build_iics_xquery(
        _connection(),
        schema_version,
        naming_convention="parent_prefix",
        separator="_",
        root_element_name="rows",
        row_element_name="row",
    )
    xquery = document.content

    assert "<businessAddress_lineOne>{ data($record/businessAddress[1]/lineOne[1]) }</businessAddress_lineOne>" in xquery
    assert "<homeAddress_lineOne>{ data($record/homeAddress[1]/lineOne[1]) }</homeAddress_lineOne>" in xquery


def test_xquery_renders_nested_array_loops():
    schema_version = _schema_version(
        [
            _column("data[]", is_object=True),
            _column("data[].balances", is_array=True),
            _column("data[].balances[].type"),
            _column("data[].balances[].entries", is_array=True),
            _column("data[].balances[].entries[].amount"),
        ]
    )

    document = build_iics_xquery(
        _connection(),
        schema_version,
        naming_convention="parent_prefix",
        separator="_",
        root_element_name="rows",
        row_element_name="row",
    )
    xquery = document.content

    assert "for $balances_item in $record/balances" in xquery
    assert "<balances>{" in xquery
    assert "for $entries_item in $balances_item/entries" in xquery
    assert "<amount>{ data($entries_item/amount[1]) }</amount>" in xquery
    assert any(mapping.path == "balances[]" and mapping.parent_path is None for mapping in document.collection_mappings)
    assert any(
        mapping.path == "balances[].entries[]" and mapping.parent_path == "balances[]"
        for mapping in document.collection_mappings
    )
    assert "collection[1]" not in xquery


def test_xquery_supports_snake_case_naming_rules():
    schema_version = _schema_version(
        [
            _column("data[]", is_object=True),
            _column("data[].businessAddress", is_object=True),
            _column("data[].businessAddress.lineOne"),
        ]
    )

    document = build_iics_xquery(
        _connection(),
        schema_version,
        naming_convention="snake_case",
        separator="_",
        root_element_name="rows",
        row_element_name="row",
    )
    xquery = document.content

    assert "<line_one>{ data($record/businessAddress[1]/lineOne[1]) }</line_one>" in xquery


def test_xquery_marks_child_mapping_comments_for_repeated_collections():
    schema_version = _schema_version(
        [
            _column("data[]", is_object=True),
            _column("data[].balances", is_array=True),
            _column("data[].balances[].amount"),
        ]
    )

    document = build_iics_xquery(
        _connection(),
        schema_version,
        naming_convention="parent_prefix",
        separator="_",
        root_element_name="rows",
        row_element_name="row",
        emit_child_mapping_comments=True,
    )

    assert "Each object inside a collection becomes a repeated child row" in document.content
    assert "(: child mapping: balances[] -> <balances>/balance :)" in document.content
