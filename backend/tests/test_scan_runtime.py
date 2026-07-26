from types import SimpleNamespace

from app.services.scan_runtime import PaginationState, _update_pagination_state, determine_pagination_state
from app.services.scanner_engine import build_request_url


def test_cursor_pagination_continues_until_cursor_is_missing():
    connection = SimpleNamespace(response_root_node="updateSequence", cursor_parameter=None, count_parameter=None)
    cursor_detection = SimpleNamespace(strategy="cursor", path="nextCursor", request_parameter="cursor")

    state = determine_pagination_state(connection, SimpleNamespace(starting_cursor=None), cursor_detection, 100)

    assert state.strategy == "cursor"
    assert _update_pagination_state(state, {"nextCursor": "abc"}, 100, cursor_detection) is True
    assert state.cursor_value == "abc"
    assert _update_pagination_state(state, {}, 100, cursor_detection) is False


def test_page_pagination_advances_when_next_page_is_missing_but_page_is_full():
    state = PaginationState(
        strategy="page",
        response_root="results",
        cursor_parameter="page",
        cursor_value=None,
        page_number=1,
        offset_value=0,
        page_size=50,
    )
    cursor_detection = SimpleNamespace(path="nextPage")

    assert _update_pagination_state(state, {}, 50, cursor_detection) is True
    assert state.page_number == 2
    assert _update_pagination_state(state, {}, 12, cursor_detection) is False


def test_offset_pagination_advances_by_page_size_until_last_page():
    state = PaginationState(
        strategy="offset",
        response_root="results",
        cursor_parameter="offset",
        cursor_value=None,
        page_number=1,
        offset_value=0,
        page_size=25,
    )
    cursor_detection = SimpleNamespace(path="nextOffset")

    assert _update_pagination_state(state, {}, 25, cursor_detection) is True
    assert state.offset_value == 25
    assert _update_pagination_state(state, {}, 0, cursor_detection) is False


def test_cursor_pagination_stops_when_next_cursor_repeats():
    state = PaginationState(
        strategy="cursor",
        response_root="results",
        cursor_parameter="cursor",
        cursor_value="%23abc",
        page_number=1,
        offset_value=0,
        page_size=100,
    )
    cursor_detection = SimpleNamespace(path="nextCursor")

    assert _update_pagination_state(state, {"nextCursor": "%23abc"}, 100, cursor_detection) is False


def test_build_request_url_does_not_double_encode_cursor_values():
    url = build_request_url(
        base_url="https://example.com/employee/v1",
        cursor_candidate=None,
        cursor_parameter="cursor",
        cursor_value="%23%2Bopaque%3D%3D",
        count_parameter=None,
        page_size=None,
    )

    assert url == "https://example.com/employee/v1?cursor=%23%2Bopaque%3D%3D"
