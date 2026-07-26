from __future__ import annotations

from dataclasses import dataclass
from functools import cached_property
import re
from typing import Iterable


WRAPPER_NODES = {
    "updatesequence",
    "results",
    "records",
    "response",
    "payload",
    "root",
    "data",
    "items",
    "item",
    "value",
    "content",
    "$",
}


@dataclass(frozen=True)
class NamingRecord:
    column_path: str
    logical_segments: tuple[str, ...]
    display_name: str
    sql_name: str
    xquery_name: str
    display_parent_path: str | None
    logical_path: str | None


def _split_path(path: str) -> tuple[str, ...]:
    return tuple(segment for segment in path.split(".") if segment)


def _strip_array_suffix(segment: str) -> str:
    return segment[:-2] if segment.endswith("[]") else segment


def _is_wrapper(segment: str) -> bool:
    return _strip_array_suffix(segment).strip().lower() in WRAPPER_NODES


def _logical_segments(path: str) -> tuple[str, ...]:
    segments: list[str] = []
    for segment in _split_path(path):
        if _is_wrapper(segment):
            continue
        name = _strip_array_suffix(segment)
        if not name:
            continue
        segments.append(name)
    return tuple(segments)


def _suffix_key(segments: tuple[str, ...], length: int) -> tuple[str, ...]:
    return segments[-length:]


def _sql_name(display_name: str) -> str:
    value = display_name.replace(".", "_").lower()
    value = re.sub(r"[^a-z0-9_]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    if not value:
        return "value"
    if value[0].isdigit():
        return f"col_{value}"
    return value


def _apply_case(value: str, naming_convention: str) -> str:
    if naming_convention == "snake_case":
        parts = re.findall(r"[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])", value)
        return "_".join(part.lower() for part in parts if part)
    if naming_convention == "camelCase":
        return value[:1].lower() + value[1:] if value else value
    if naming_convention == "PascalCase":
        return value[:1].upper() + value[1:] if value else value
    return value


def _sanitize_xml_name(value: str) -> str:
    sanitized = re.sub(r"[^A-Za-z0-9_]+", "_", value)
    sanitized = re.sub(r"_+", "_", sanitized).strip("_")
    if not sanitized:
        return "value"
    if sanitized[0].isdigit():
        return f"field_{sanitized}"
    return sanitized


class NamingService:
    def __init__(self, column_paths: Iterable[str]) -> None:
        self._column_paths = tuple(dict.fromkeys(column_paths))
        self._logical_paths = {path: _logical_segments(path) for path in self._column_paths}

    @cached_property
    def _display_names(self) -> dict[str, str]:
        resolved: dict[str, str] = {}
        logical_paths = {path: segments for path, segments in self._logical_paths.items() if segments}

        for path, segments in logical_paths.items():
            resolved[path] = self._shortest_unique_display_name(segments)

        return resolved

    def _shortest_unique_display_name(self, segments: tuple[str, ...]) -> str:
        if not segments:
            return ""

        candidates = [path for path in self._logical_paths.values() if path]
        if segments not in candidates:
            candidates = [*candidates, segments]

        for length in range(1, len(segments) + 1):
            suffix = _suffix_key(segments, length)
            matches = sum(1 for candidate in candidates if candidate[-length:] == suffix)
            if matches == 1:
                return ".".join(suffix)
        return ".".join(segments)

    @classmethod
    def for_schema_version(cls, schema_version: object) -> NamingService:
        return cls(getattr(column, "column_path") for column in getattr(schema_version, "columns", []))

    def logical_segments_for_path(self, column_path: str) -> tuple[str, ...]:
        return self._logical_paths.get(column_path, _logical_segments(column_path))

    def logical_path_for_path(self, column_path: str) -> str | None:
        segments = self.logical_segments_for_path(column_path)
        return ".".join(segments) if segments else None

    def generate_display_name(self, column_path: str) -> str:
        logical_segments = self.logical_segments_for_path(column_path)
        if not logical_segments:
            return ""
        return self._display_names.get(column_path, self._shortest_unique_display_name(logical_segments))

    def generate_sql_name(self, column_path: str) -> str:
        return _sql_name(self.generate_display_name(column_path))

    def generate_xquery_name(
        self,
        column_path: str,
        *,
        naming_convention: str = "full_path",
        separator: str = "_",
    ) -> str:
        display_name = self.generate_display_name(column_path)
        if not display_name:
            return "value"
        segments = [_apply_case(segment, naming_convention) for segment in display_name.split(".") if segment]
        return _sanitize_xml_name(separator.join(segments))

    def display_parent_path(self, column_path: str) -> str | None:
        display_name = self.generate_display_name(column_path)
        if "." not in display_name:
            return None
        return display_name.rsplit(".", 1)[0]

    def describe(self, column_path: str) -> NamingRecord:
        logical_segments = self.logical_segments_for_path(column_path)
        display_name = self.generate_display_name(column_path)
        return NamingRecord(
            column_path=column_path,
            logical_segments=logical_segments,
            logical_path=".".join(logical_segments) if logical_segments else None,
            display_name=display_name,
            sql_name=self.generate_sql_name(column_path),
            xquery_name=self.generate_xquery_name(column_path),
            display_parent_path=self.display_parent_path(column_path),
        )
