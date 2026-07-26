from app.services.scanner_engine import ROOT_LIST_SENTINEL, analyze_payload


def test_scanner_detects_successfactors_shapes():
    payload = {
        "updateSequence": [
            {
                "personIdExternal": "100018",
                "effectiveDatedInfo": [
                    {
                        "startDate": "2026-01-01",
                        "effectiveDatedJobInfo": [
                            {
                                "eventReason": "HIRNEW",
                                "businessUnit": {"code": "CORP"},
                            }
                        ],
                    }
                ],
                "balances": [
                    {"type": "vacation", "amount": 14},
                    {"type": "sick", "amount": 5},
                ],
            }
        ],
        "nextCursor": "opaque-cursor-token",
    }

    analysis = analyze_payload(payload, response_root_override="updateSequence")

    assert analysis.response_root == "updateSequence"
    assert analysis.endpoint_format == "successfactors_update_sequence"
    assert "updateSequence" in analysis.feature_summary.collection_paths
    assert "updateSequence[].effectiveDatedInfo" in analysis.feature_summary.effective_dated_paths
    assert "nextCursor" in analysis.feature_summary.next_cursor_paths
    assert analysis.cursor_detection.request_parameter == "cursor"
    assert any(collection.path == "updateSequence[].balances" for collection in analysis.collections)


def test_scanner_detects_odata_results_root_automatically():
    payload = {
        "d": {
            "results": [
                {
                    "externalCode": "A1",
                    "children": [{"name": "child-1"}],
                }
            ]
        },
        "__next": "https://example.com/odata?$skiptoken=abc",
    }

    analysis = analyze_payload(payload)

    assert analysis.response_root == "d.results"
    assert analysis.endpoint_format == "odata_d_results"
    assert analysis.cursor_detection.strategy == "url"
    assert analysis.cursor_detection.path == "__next"
    assert any(field.path == "d.results[].children[]" for field in analysis.fields)


def test_scanner_supports_root_array_payloads():
    payload = [{"recordId": "1", "nested": [{"id": "x"}]}]

    analysis = analyze_payload(payload)

    assert analysis.response_root == ROOT_LIST_SENTINEL
    assert analysis.endpoint_format == "root_array"
    assert analysis.scanned_records == 1
    assert "$[].nested" in analysis.feature_summary.collection_paths or "$[].nested" in {
        collection.path for collection in analysis.collections
    }
