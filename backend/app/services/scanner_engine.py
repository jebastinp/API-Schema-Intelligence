from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qsl, unquote, urlencode, urlparse, urlunparse

import httpx

from app.models.api_connection import APIConnection
from app.schemas.scanner import (
    CollectionDescriptor,
    CursorDetection,
    FieldDescriptor,
    ScannerAnalysisResponse,
    ScannerFeatureSummary,
    ScannerOptions,
)

ROOT_LIST_SENTINEL = "$"
CURSOR_FIELD_NAMES = {"nextCursor", "nextPage", "__next", "cursor", "page"}
ROOT_HINTS = {
    "updateSequence",
    "results",
    "value",
    "items",
    "records",
    "data",
    "effectiveDatedInfo",
    "effectiveDatedJobInfo",
}
EFFECTIVE_DATED_KEYS = {"effectiveDatedInfo", "effectiveDatedJobInfo"}


@dataclass
class CursorCandidate:
    key: str
    path: str
    value: Any
    strategy: str


def _path_join(parent: str, segment: str) -> str:
    if not parent or parent == ROOT_LIST_SENTINEL:
        return segment
    return f"{parent}.{segment}"


def _path_exists(payload: Any, path: str) -> bool:
    try:
        _get_value(payload, path)
        return True
    except KeyError:
        return False


def _get_value(payload: Any, path: str) -> Any:
    if path in {"", ROOT_LIST_SENTINEL}:
        return payload

    current = payload
    for segment in path.split("."):
        normalized = segment.replace("[]", "")
        if isinstance(current, list):
            if not current:
                raise KeyError(path)
            current = current[0]
        if not isinstance(current, dict) or normalized not in current:
            raise KeyError(path)
        current = current[normalized]
    return current


def _infer_scalar_type(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int) and not isinstance(value, bool):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, dict):
        return "object"
    if isinstance(value, list):
        return "array"
    return type(value).__name__


def _sample_preview(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        preview = str(value)
    else:
        preview = json.dumps(value, default=str)
    return preview[:240]


def _score_root_candidate(path: str, value: Any) -> int:
    score = 0
    last_segment = path.split(".")[-1].replace("[]", "")

    if last_segment in ROOT_HINTS:
        score += 5
    if isinstance(value, list):
        score += 4
        if value and isinstance(value[0], dict):
            score += 3
    elif isinstance(value, dict):
        if any(isinstance(child, list) for child in value.values()):
            score += 2
        if last_segment in EFFECTIVE_DATED_KEYS:
            score += 4
    if "d.results" in path:
        score += 4
    if "updateSequence" in path:
        score += 5

    return score


def detect_response_root(payload: Any, configured_root: str | None = None) -> str:
    if configured_root and _path_exists(payload, configured_root):
        return configured_root

    if isinstance(payload, list):
        return ROOT_LIST_SENTINEL

    candidates: list[tuple[str, int]] = []

    def walk(node: Any, path: str = "", depth: int = 0) -> None:
        if depth > 3:
            return
        if isinstance(node, dict):
            for key, value in node.items():
                child_path = _path_join(path, key)
                candidates.append((child_path, _score_root_candidate(child_path, value)))
                walk(value, child_path, depth + 1)
        elif isinstance(node, list) and node:
            walk(node[0], f"{path}[]", depth + 1)

    walk(payload)

    if not candidates:
        return ROOT_LIST_SENTINEL

    best_path, _ = max(candidates, key=lambda item: item[1])
    return best_path


def infer_endpoint_format(payload: Any, response_root: str) -> str:
    if isinstance(payload, list):
        return "root_array"
    if _path_exists(payload, "d.results"):
        return "odata_d_results"
    if _path_exists(payload, "value"):
        value = _get_value(payload, "value")
        if isinstance(value, list):
            return "odata_value"
    if response_root == "updateSequence":
        return "successfactors_update_sequence"
    if response_root in EFFECTIVE_DATED_KEYS:
        return "successfactors_effective_dated"
    if "." in response_root:
        return "nested_wrapper"
    return "object_wrapper"


def _derive_request_parameter(key: str, configured: str | None) -> str | None:
    if configured:
        return configured
    lowered = key.lower()
    if lowered.startswith("next"):
        suffix = key[4:]
        if suffix:
            return suffix[:1].lower() + suffix[1:]
    if lowered in {"cursor", "page"}:
        return lowered
    if "cursor" in lowered:
        return "cursor"
    if "page" in lowered:
        return "page"
    return None


def detect_cursor_candidate(payload: Any, configured_cursor_parameter: str | None) -> CursorCandidate:
    found: list[CursorCandidate] = []

    def walk(node: Any, path: str = "") -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                child_path = _path_join(path, key)
                lowered = key.lower()
                if isinstance(value, (str, int, float)) and (
                    key in CURSOR_FIELD_NAMES
                    or lowered.startswith("next")
                    or "cursor" in lowered
                    or key == "__next"
                ):
                    strategy = "url" if isinstance(value, str) and value.startswith("http") else "cursor"
                    found.append(CursorCandidate(key, child_path, value, strategy))
                walk(value, child_path)
        elif isinstance(node, list):
            for item in node[:2]:
                walk(item, f"{path}[]")

    walk(payload)

    if not found:
        return CursorCandidate(
            key=configured_cursor_parameter or "none",
            path=None,
            value=None,
            strategy="single_response",
        )

    best = found[0]
    return CursorCandidate(
        key=best.key,
        path=best.path,
        value=best.value,
        strategy=best.strategy,
    )


def _append_query_param(url: str, key: str, value: str | int) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    if isinstance(value, str):
        query[key] = unquote(value)
    else:
        query[key] = str(value)
    return urlunparse(parsed._replace(query=urlencode(query)))


def build_request_url(
    *,
    base_url: str,
    cursor_candidate: CursorCandidate | None,
    cursor_parameter: str | None,
    cursor_value: Any,
    count_parameter: str | None,
    page_size: int | None,
) -> str:
    if isinstance(cursor_value, str) and cursor_value.startswith("http"):
        return cursor_value

    url = base_url
    if cursor_value is not None and cursor_parameter:
        url = _append_query_param(url, cursor_parameter, cursor_value)
    if count_parameter and page_size:
        url = _append_query_param(url, count_parameter, page_size)
    return url


async def _resolve_authorization_headers(connection: APIConnection) -> dict[str, str]:
    headers = dict(connection.headers or {})
    auth_type = connection.authentication_type.lower()
    has_oauth_credentials = bool(connection.token_url and connection.client_id and connection.client_secret)

    if has_oauth_credentials and auth_type in {"oauth2_client_credentials", "bearer", "basic", "none", "api_key"}:
        async with httpx.AsyncClient(timeout=20.0) as client:
            token_response = await client.post(
                connection.token_url,
                data={
                    "grant_type": connection.grant_type or "client_credentials",
                    "client_id": connection.client_id,
                    "client_secret": connection.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_response.raise_for_status()
            token_payload = token_response.json()
        access_token = token_payload.get("access_token")
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        return headers

    if auth_type == "bearer" and connection.client_secret:
        headers.setdefault("Authorization", f"Bearer {connection.client_secret}")
    elif auth_type == "basic" and connection.client_id and connection.client_secret:
        credentials = f"{connection.client_id}:{connection.client_secret}".encode("utf-8")
        headers.setdefault("Authorization", f"Basic {base64.b64encode(credentials).decode('utf-8')}")

    return headers


def _extract_records(payload: Any, response_root: str) -> list[Any]:
    root = _get_value(payload, response_root)
    if isinstance(root, list):
        return root
    if isinstance(root, dict):
        return [root]
    return [root]


def _register_field(
    registry: dict[str, FieldDescriptor],
    *,
    path: str,
    parent_path: str | None,
    depth: int,
    value: Any,
    is_array: bool = False,
    is_object: bool = False,
    is_collection_object: bool = False,
) -> None:
    data_type = _infer_scalar_type(value)
    existing = registry.get(path)

    descriptor = FieldDescriptor(
        path=path,
        parent_path=parent_path,
        depth=depth,
        data_type=data_type,
        nullable=value is None,
        is_array=is_array,
        is_object=is_object,
        is_collection_object=is_collection_object,
        sample_value=_sample_preview(value),
    )

    if existing is None:
        registry[path] = descriptor
        return

    existing.nullable = existing.nullable or descriptor.nullable
    existing.is_array = existing.is_array or descriptor.is_array
    existing.is_object = existing.is_object or descriptor.is_object
    existing.is_collection_object = existing.is_collection_object or descriptor.is_collection_object
    if existing.data_type != descriptor.data_type and descriptor.data_type not in {existing.data_type, "null"}:
        existing.data_type = f"{existing.data_type}|{descriptor.data_type}"
    if existing.sample_value is None and descriptor.sample_value is not None:
        existing.sample_value = descriptor.sample_value


def _analyze_node(
    value: Any,
    *,
    path: str,
    parent_path: str | None,
    depth: int,
    fields: dict[str, FieldDescriptor],
    collections: dict[str, CollectionDescriptor],
    update_sequence_paths: set[str],
    next_cursor_paths: set[str],
    effective_dated_paths: set[str],
    nested_array_paths: set[str],
    collection_paths: set[str],
) -> None:
    if isinstance(value, dict):
        _register_field(fields, path=path or ROOT_LIST_SENTINEL, parent_path=parent_path, depth=depth, value=value, is_object=True)
        for key, child in value.items():
            child_path = _path_join(path, key) if path not in {"", ROOT_LIST_SENTINEL} else key
            lowered = key.lower()
            if key == "updateSequence" or ("update" in lowered and "sequence" in lowered):
                update_sequence_paths.add(child_path)
            if key in EFFECTIVE_DATED_KEYS:
                effective_dated_paths.add(child_path)
            if key in CURSOR_FIELD_NAMES or lowered.startswith("next") or "cursor" in lowered:
                next_cursor_paths.add(child_path)
            _analyze_node(
                child,
                path=child_path,
                parent_path=path or None,
                depth=depth + 1,
                fields=fields,
                collections=collections,
                update_sequence_paths=update_sequence_paths,
                next_cursor_paths=next_cursor_paths,
                effective_dated_paths=effective_dated_paths,
                nested_array_paths=nested_array_paths,
                collection_paths=collection_paths,
            )
        return

    if isinstance(value, list):
        _register_field(fields, path=path, parent_path=parent_path, depth=depth, value=value, is_array=True)
        contains_objects = any(isinstance(item, dict) for item in value)
        contains_nested_arrays = any(isinstance(item, list) for item in value)
        effective_dated = path.split(".")[-1].replace("[]", "") in EFFECTIVE_DATED_KEYS
        if contains_nested_arrays:
            nested_array_paths.add(path)
        if contains_objects:
            collection_paths.add(path)

        collections[path] = CollectionDescriptor(
            path=path,
            sample_size=len(value),
            contains_objects=contains_objects,
            contains_nested_arrays=contains_nested_arrays,
            effective_dated=effective_dated,
        )

        item_path = f"{path}[]"
        for item in value:
            _analyze_node(
                item,
                path=item_path,
                parent_path=path,
                depth=depth + 1,
                fields=fields,
                collections=collections,
                update_sequence_paths=update_sequence_paths,
                next_cursor_paths=next_cursor_paths,
                effective_dated_paths=effective_dated_paths,
                nested_array_paths=nested_array_paths,
                collection_paths=collection_paths,
            )
        return

    _register_field(fields, path=path, parent_path=parent_path, depth=depth, value=value)


def analyze_payload(
    payload: Any,
    *,
    response_root_override: str | None = None,
    connection_id: Any = None,
    configured_cursor_parameter: str | None = None,
) -> ScannerAnalysisResponse:
    response_root = detect_response_root(payload, response_root_override)
    cursor_candidate = detect_cursor_candidate(payload, configured_cursor_parameter)
    fields: dict[str, FieldDescriptor] = {}
    collections: dict[str, CollectionDescriptor] = {}
    update_sequence_paths: set[str] = set()
    next_cursor_paths: set[str] = set()
    effective_dated_paths: set[str] = set()
    nested_array_paths: set[str] = set()
    collection_paths: set[str] = set()

    warnings: list[str] = []
    try:
        root_value = _get_value(payload, response_root)
        records = _extract_records(payload, response_root)
    except KeyError:
        root_value = payload
        records = [payload]
        response_root = ROOT_LIST_SENTINEL
        warnings.append("Configured response root was not found. Falling back to payload root.")

    if cursor_candidate.path:
        next_cursor_paths.add(cursor_candidate.path)

    if isinstance(root_value, list):
        collection_paths.add(response_root)
        collections[response_root] = CollectionDescriptor(
            path=response_root,
            sample_size=len(root_value),
            contains_objects=any(isinstance(item, dict) for item in root_value),
            contains_nested_arrays=any(isinstance(item, list) for item in root_value),
            effective_dated=response_root.split(".")[-1].replace("[]", "") in EFFECTIVE_DATED_KEYS,
        )

    scanned_records = 0
    for record in records:
        scanned_records += 1
        if isinstance(root_value, list):
            base_path = f"{response_root}[]"
        else:
            base_path = response_root if response_root != ROOT_LIST_SENTINEL else ROOT_LIST_SENTINEL
        _analyze_node(
            record,
            path=base_path,
            parent_path=None,
            depth=0,
            fields=fields,
            collections=collections,
            update_sequence_paths=update_sequence_paths,
            next_cursor_paths=next_cursor_paths,
            effective_dated_paths=effective_dated_paths,
            nested_array_paths=nested_array_paths,
            collection_paths=collection_paths,
        )

    request_parameter = _derive_request_parameter(cursor_candidate.key, configured_cursor_parameter)
    cursor_detection = CursorDetection(
        key=cursor_candidate.key if cursor_candidate.strategy != "single_response" else None,
        path=cursor_candidate.path,
        value_preview=_sample_preview(cursor_candidate.value),
        request_parameter=request_parameter,
        strategy=cursor_candidate.strategy,
    )

    return ScannerAnalysisResponse(
        connection_id=connection_id,
        endpoint_format=infer_endpoint_format(payload, response_root),
        response_root=response_root,
        scanned_pages=1,
        scanned_records=scanned_records,
        cursor_detection=cursor_detection,
        feature_summary=ScannerFeatureSummary(
            update_sequence_paths=sorted(update_sequence_paths),
            next_cursor_paths=sorted(next_cursor_paths),
            effective_dated_paths=sorted(effective_dated_paths),
            nested_array_paths=sorted(nested_array_paths),
            collection_paths=sorted(collection_paths),
            incremental_supported=bool(update_sequence_paths or configured_cursor_parameter),
        ),
        collections=sorted(collections.values(), key=lambda item: item.path),
        fields=sorted(fields.values(), key=lambda item: item.path),
        warnings=warnings,
    )


async def analyze_connection(connection: APIConnection, options: ScannerOptions) -> ScannerAnalysisResponse:
    headers = await _resolve_authorization_headers(connection)
    scanned_pages = 0
    scanned_records = 0
    fields: dict[str, FieldDescriptor] = {}
    collections: dict[str, CollectionDescriptor] = {}
    update_sequence_paths: set[str] = set()
    next_cursor_paths: set[str] = set()
    effective_dated_paths: set[str] = set()
    nested_array_paths: set[str] = set()
    collection_paths: set[str] = set()
    warnings: list[str] = []
    response_root: str | None = options.response_root_override or connection.response_root_node
    endpoint_format = "unknown"
    cursor_value: Any = options.starting_cursor
    cursor_candidate: CursorCandidate | None = None
    cursor_parameter = connection.cursor_parameter

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        while True:
            request_url = build_request_url(
                base_url=connection.base_url,
                cursor_candidate=cursor_candidate,
                cursor_parameter=cursor_parameter,
                cursor_value=cursor_value,
                count_parameter=connection.count_parameter,
                page_size=options.page_size,
            )
            response = await client.get(request_url, headers=headers)
            response.raise_for_status()
            payload = response.json()
            scanned_pages += 1

            if response_root is None:
                response_root = detect_response_root(payload, connection.response_root_node)
            endpoint_format = infer_endpoint_format(payload, response_root)

            page_analysis = analyze_payload(
                payload,
                response_root_override=response_root,
                connection_id=connection.id,
                configured_cursor_parameter=connection.cursor_parameter,
            )
            scanned_records += page_analysis.scanned_records
            for field in page_analysis.fields:
                _register_field(
                    fields,
                    path=field.path,
                    parent_path=field.parent_path,
                    depth=field.depth,
                    value=field.sample_value,
                    is_array=field.is_array,
                    is_object=field.is_object,
                    is_collection_object=field.is_collection_object,
                )
            for collection in page_analysis.collections:
                collections[collection.path] = collection
            update_sequence_paths.update(page_analysis.feature_summary.update_sequence_paths)
            next_cursor_paths.update(page_analysis.feature_summary.next_cursor_paths)
            effective_dated_paths.update(page_analysis.feature_summary.effective_dated_paths)
            nested_array_paths.update(page_analysis.feature_summary.nested_array_paths)
            collection_paths.update(page_analysis.feature_summary.collection_paths)
            warnings.extend(page_analysis.warnings)

            cursor_candidate = detect_cursor_candidate(payload, connection.cursor_parameter)
            cursor_parameter = _derive_request_parameter(cursor_candidate.key, connection.cursor_parameter)
            if cursor_candidate.strategy == "single_response" or cursor_candidate.value in {None, "", cursor_value}:
                break

            cursor_value = cursor_candidate.value
            if options.max_pages and scanned_pages >= options.max_pages:
                warnings.append("Stopped scanning after reaching the max_pages limit.")
                break
            if options.max_records and scanned_records >= options.max_records:
                warnings.append("Stopped scanning after reaching the max_records limit.")
                break

    final_cursor_detection = CursorDetection(
        key=cursor_candidate.key if cursor_candidate and cursor_candidate.strategy != "single_response" else None,
        path=cursor_candidate.path if cursor_candidate else None,
        value_preview=_sample_preview(cursor_candidate.value) if cursor_candidate else None,
        request_parameter=cursor_parameter,
        strategy=cursor_candidate.strategy if cursor_candidate else "single_response",
    )

    return ScannerAnalysisResponse(
        connection_id=connection.id,
        endpoint_format=endpoint_format,
        response_root=response_root or ROOT_LIST_SENTINEL,
        scanned_pages=scanned_pages,
        scanned_records=scanned_records,
        cursor_detection=final_cursor_detection,
        feature_summary=ScannerFeatureSummary(
            update_sequence_paths=sorted(update_sequence_paths),
            next_cursor_paths=sorted(next_cursor_paths),
            effective_dated_paths=sorted(effective_dated_paths),
            nested_array_paths=sorted(nested_array_paths),
            collection_paths=sorted(collection_paths),
            incremental_supported=bool(update_sequence_paths or connection.incremental or connection.cursor_parameter),
        ),
        collections=sorted(collections.values(), key=lambda item: item.path),
        fields=sorted(fields.values(), key=lambda item: item.path),
        warnings=warnings,
    )
