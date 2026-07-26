from __future__ import annotations

import json
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from app.core.logging import get_logger
from app.models.api_connection import APIConnection
from app.models.scan_history import ScanHistory
from app.repositories.column import ColumnRepository
from app.repositories.column_statistics import ColumnStatisticsRepository
from app.repositories.schema_version import SchemaVersionRepository
from app.services.scanner_engine import ROOT_LIST_SENTINEL, _get_value
from app.services.schema_versioning import build_github_style_diff, persist_schema_version_history

logger = get_logger("app.schema_discovery")


def _infer_data_type(value: Any) -> str:
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


def _merge_types(existing: str, incoming: str) -> str:
    if existing == incoming:
        return existing
    values = {part for part in existing.split("|") if part and part != "null"}
    if incoming != "null":
        values.add(incoming)
    if not values:
        return "null"
    return "|".join(sorted(values))


@dataclass
class DiscoveredColumn:
    column_path: str
    parent_path: str | None
    depth: int
    data_type: str
    is_nullable: bool
    is_array: bool
    is_object: bool
    example_value: str | None


@dataclass
class ColumnStatisticAccumulator:
    occurrences: int = 0
    records_with_presence: int = 0
    first_seen_record: int | None = None
    last_seen_record: int | None = None
    null_count: int = 0
    maximum_length: int | None = None
    total_length: int = 0
    length_samples: int = 0
    unique_values: set[str] = field(default_factory=set)
    _seen_in_record: bool = False

    def begin_record(self) -> None:
        self._seen_in_record = False

    def observe(self, record_number: int, value: Any) -> None:
        if self.first_seen_record is None:
            self.first_seen_record = record_number
        self.last_seen_record = record_number
        self.occurrences += 1
        if not self._seen_in_record:
            self.records_with_presence += 1
        self._seen_in_record = True

        if value is None:
            self.null_count += 1
            return

        normalized = _normalize_unique_value(value)
        self.unique_values.add(normalized)

        value_length = _measure_value_length(value)
        if value_length is None:
            return
        self.total_length += value_length
        self.length_samples += 1
        if self.maximum_length is None or value_length > self.maximum_length:
            self.maximum_length = value_length

    def average_length(self) -> float | None:
        if self.length_samples == 0:
            return None
        return self.total_length / self.length_samples


def _normalize_unique_value(value: Any) -> str:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return str(value)
    return json.dumps(value, sort_keys=True, default=str)


def _measure_value_length(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, str):
        return len(value)
    if isinstance(value, (int, float, bool)):
        return len(str(value))
    if isinstance(value, dict):
        return len(json.dumps(value, sort_keys=True, default=str))
    if isinstance(value, list):
        return len(json.dumps(value, default=str))
    return None


@dataclass
class SchemaDiscoveryAccumulator:
    response_root: str
    records_processed: int = 0
    pages_processed: int = 0
    _columns: dict[str, DiscoveredColumn] = field(default_factory=dict)
    _statistics: dict[str, ColumnStatisticAccumulator] = field(default_factory=dict)

    def consume_payload(self, payload: Any) -> None:
        root_value, record_path = self._extract_root(payload)
        records = self._records_from_root(root_value)

        self.pages_processed += 1
        for record in records:
            self.records_processed += 1
            for statistic in self._statistics.values():
                statistic.begin_record()
            self._walk(record, path=record_path, parent_path=None, depth=0, record_number=self.records_processed)

    def _extract_root(self, payload: Any) -> tuple[Any, str]:
        if self.response_root == ROOT_LIST_SENTINEL:
            if isinstance(payload, list):
                return payload, f"{ROOT_LIST_SENTINEL}[]"
            return payload, ROOT_LIST_SENTINEL

        try:
            root_value = _get_value(payload, self.response_root)
        except KeyError:
            logger.warning("Response root %s not found during schema discovery; falling back to payload root.", self.response_root)
            if isinstance(payload, list):
                return payload, f"{ROOT_LIST_SENTINEL}[]"
            return payload, ROOT_LIST_SENTINEL

        if isinstance(root_value, list):
            return root_value, f"{self.response_root}[]"
        return root_value, self.response_root

    def _records_from_root(self, root_value: Any) -> list[Any]:
        if isinstance(root_value, list):
            return root_value
        return [root_value]

    def _register(
        self,
        *,
        path: str,
        parent_path: str | None,
        depth: int,
        value: Any,
        record_number: int,
        is_array: bool = False,
        is_object: bool = False,
    ) -> None:
        data_type = _infer_data_type(value)
        existing = self._columns.get(path)
        statistic = self._statistics.setdefault(path, ColumnStatisticAccumulator())

        if existing is None:
            self._columns[path] = DiscoveredColumn(
                column_path=path,
                parent_path=parent_path,
                depth=depth,
                data_type=data_type,
                is_nullable=value is None,
                is_array=is_array,
                is_object=is_object,
                example_value=_sample_preview(value),
            )
        else:
            existing.is_nullable = existing.is_nullable or value is None
            existing.is_array = existing.is_array or is_array
            existing.is_object = existing.is_object or is_object
            existing.data_type = _merge_types(existing.data_type, data_type)
            if existing.example_value is None:
                existing.example_value = _sample_preview(value)
        statistic.observe(record_number, value)

    def _walk(self, value: Any, *, path: str, parent_path: str | None, depth: int, record_number: int) -> None:
        if isinstance(value, dict):
            self._register(
                path=path,
                parent_path=parent_path,
                depth=depth,
                value=value,
                is_object=True,
                record_number=record_number,
            )
            for key, child in value.items():
                child_path = key if path in {"", ROOT_LIST_SENTINEL} else f"{path}.{key}"
                self._walk(
                    child,
                    path=child_path,
                    parent_path=path or None,
                    depth=depth + 1,
                    record_number=record_number,
                )
            return

        if isinstance(value, list):
            self._register(
                path=path,
                parent_path=parent_path,
                depth=depth,
                value=value,
                is_array=True,
                record_number=record_number,
            )
            item_path = f"{path}[]"
            for child in value:
                self._walk(
                    child,
                    path=item_path,
                    parent_path=path,
                    depth=depth + 1,
                    record_number=record_number,
                )
            return

        self._register(
            path=path,
            parent_path=parent_path,
            depth=depth,
            value=value,
            record_number=record_number,
        )

    def column_count(self) -> int:
        return len(self._columns)

    def column_paths(self) -> set[str]:
        return set(self._columns)

    def to_rows(self, schema_version_id: Any) -> list[dict[str, Any]]:
        return [
            {
                "schema_version_id": schema_version_id,
                "column_path": column.column_path,
                "parent_path": column.parent_path,
                "depth": column.depth,
                "data_type": column.data_type,
                "is_nullable": column.is_nullable,
                "is_array": column.is_array,
                "is_object": column.is_object,
                "example_value": column.example_value,
            }
            for column in sorted(self._columns.values(), key=lambda item: item.column_path)
        ]

    def statistics_rows(self, column_id_by_path: dict[str, Any], scan_history_id: Any) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        total_records = max(self.records_processed, 1)

        for path, statistic in sorted(self._statistics.items()):
            column_id = column_id_by_path.get(path)
            if column_id is None:
                continue
            column = self._columns[path]
            rows.append(
                {
                    "column_id": column_id,
                    "occurrences": statistic.occurrences,
                    "coverage_percent": round((statistic.records_with_presence / total_records) * 100, 2),
                    "first_seen_record": statistic.first_seen_record,
                    "last_seen_record": statistic.last_seen_record,
                    "first_seen_scan_id": scan_history_id,
                    "last_seen_scan_id": scan_history_id,
                    "data_type": column.data_type,
                    "average_length": Decimal(f"{statistic.average_length():.2f}") if statistic.average_length() is not None else None,
                    "maximum_length": statistic.maximum_length,
                    "null_count": statistic.null_count,
                    "unique_count": len(statistic.unique_values),
                }
            )
        return rows


async def persist_discovered_schema(
    session: Any,
    *,
    connection: APIConnection,
    scan_history: ScanHistory,
    accumulator: SchemaDiscoveryAccumulator,
) -> Any:
    schema_repository = SchemaVersionRepository(session)
    column_repository = ColumnRepository(session)
    statistics_repository = ColumnStatisticsRepository(session)
    previous_version = await schema_repository.get_latest_for_connection(connection.id)

    version_number = await schema_repository.next_version_number(connection.id)
    schema_version = await schema_repository.create(
        api_connection_id=connection.id,
        version_number=version_number,
        version_label=f"scan-{version_number}",
        status="active",
        summary={
            "records_processed": accumulator.records_processed,
            "pages_processed": accumulator.pages_processed,
            "columns_discovered": accumulator.column_count(),
            "response_root": accumulator.response_root,
            "scan_history_id": str(scan_history.id),
        },
        change_notes=None,
    )

    columns = await column_repository.create_many(accumulator.to_rows(schema_version.id))
    column_id_by_path = {column.column_path: column.id for column in columns}
    await statistics_repository.create_many(
        accumulator.statistics_rows(column_id_by_path, scan_history.id)
    )
    await session.flush()
    current_version = await schema_repository.get_by_id_for_connection(schema_version.id, connection.id)
    changes = await persist_schema_version_history(
        session,
        previous_version=previous_version,
        current_version=current_version,
    )
    schema_version.summary = {
        **schema_version.summary,
        "previous_version_id": str(previous_version.id) if previous_version is not None else None,
        "added_columns": sum(change.change_type == "added" for change in changes),
        "removed_columns": sum(change.change_type == "removed" for change in changes),
        "datatype_changes": sum(change.change_type == "datatype_changed" for change in changes),
        "coverage_changes": sum(change.change_type == "coverage_changed" for change in changes),
        "diff_lines": build_github_style_diff(previous_version, current_version, changes) if previous_version else [],
    }
    return schema_version
