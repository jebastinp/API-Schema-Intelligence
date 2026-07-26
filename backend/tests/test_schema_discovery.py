from types import SimpleNamespace

from app.services.schema_discovery import SchemaDiscoveryAccumulator


def test_schema_discovery_flattens_nested_objects_arrays_and_nested_arrays():
    payload = {
        "data": [
            {
                "person": {
                    "name": "Ava",
                    "contact": {"email": "ava@example.com"},
                },
                "balances": [
                    {"type": "vacation", "amount": 10},
                    {"type": "sick", "amount": None},
                ],
                "matrix": [[1, 2], [3]],
            }
        ]
    }

    accumulator = SchemaDiscoveryAccumulator(response_root="data")
    accumulator.consume_payload(payload)
    rows = {row["column_path"]: row for row in accumulator.to_rows("schema-version-id")}

    assert "data[]" in rows
    assert rows["data[]"]["is_object"] is True
    assert rows["data[].person.contact.email"]["data_type"] == "string"
    assert rows["data[].balances"]["is_array"] is True
    assert rows["data[].balances[].type"]["parent_path"] == "data[].balances[]"
    assert rows["data[].balances[].amount"]["is_nullable"] is True
    assert rows["data[].matrix[]"]["is_array"] is True
    assert rows["data[].matrix[][]"]["data_type"] == "integer"


def test_schema_discovery_merges_types_and_retains_example_values():
    accumulator = SchemaDiscoveryAccumulator(response_root="results")
    accumulator.consume_payload({"results": [{"value": 1}]})
    accumulator.consume_payload({"results": [{"value": "one"}, {"value": None}]})

    rows = {row["column_path"]: row for row in accumulator.to_rows("schema-version-id")}

    assert rows["results[].value"]["data_type"] == "integer|string"
    assert rows["results[].value"]["is_nullable"] is True
    assert rows["results[].value"]["example_value"] == "1"


def test_schema_discovery_calculates_statistics():
    accumulator = SchemaDiscoveryAccumulator(response_root="results")
    accumulator.consume_payload(
        {
            "results": [
                {"value": "alpha", "optional": None},
                {"value": "beta"},
            ]
        }
    )
    accumulator.consume_payload({"results": [{"value": "alpha"}]})

    stats = {
        row["column_id"]: row
        for row in accumulator.statistics_rows(
            {
                "results[]": "root-column",
                "results[].value": "value-column",
                "results[].optional": "optional-column",
            },
            "scan-history-id",
        )
    }

    value_stats = stats["value-column"]
    optional_stats = stats["optional-column"]

    assert value_stats["occurrences"] == 3
    assert value_stats["coverage_percent"] == 100.0
    assert value_stats["first_seen_record"] == 1
    assert value_stats["last_seen_record"] == 3
    assert float(value_stats["average_length"]) == 4.67
    assert value_stats["maximum_length"] == 5
    assert value_stats["unique_count"] == 2

    assert optional_stats["occurrences"] == 1
    assert optional_stats["coverage_percent"] == 33.33
    assert optional_stats["null_count"] == 1
    assert optional_stats["unique_count"] == 0
