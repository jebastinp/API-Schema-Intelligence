from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from app.models.api_connection import APIConnection
from app.models.column import Column
from app.models.generated_xquery import GeneratedXQuery
from app.models.schema_version import SchemaVersion
from app.repositories.generated_xquery import GeneratedXQueryRepository
from app.services.naming_service import NamingService

ROOT_SENTINELS = {"$", "$[]"}


@dataclass(frozen=True)
class PathToken:
    name: str
    is_array: bool = False


@dataclass
class XQueryContext:
    context_path: tuple[PathToken, ...]
    scalar_columns: list[Column] = field(default_factory=list)
    child_arrays: dict[tuple[PathToken, ...], list[Column]] = field(default_factory=lambda: defaultdict(list))


@dataclass
class CollectionMapping:
    path: str
    parent_path: str | None
    depth: int
    loop_variable: str
    element_name: str
    item_element_name: str
    nested: bool


@dataclass
class GeneratedXQueryDocument:
    content: str
    collection_mappings: list[CollectionMapping]


def _parse_path(path: str) -> list[PathToken]:
    tokens: list[PathToken] = []
    for segment in path.split("."):
        if not segment:
            continue
        if segment.endswith("[]"):
            tokens.append(PathToken(segment[:-2], True))
        else:
            tokens.append(PathToken(segment, False))
    return tokens

def _sanitize_xml_name(name: str) -> str:
    sanitized = re.sub(r"[^A-Za-z0-9_]+", "_", name)
    sanitized = re.sub(r"_+", "_", sanitized).strip("_")
    if not sanitized:
        return "value"
    if sanitized[0].isdigit():
        return f"field_{sanitized}"
    return sanitized


def _singularize(name: str) -> str:
    if name.endswith("ies") and len(name) > 3:
        return f"{name[:-3]}y"
    if name.endswith("ses") and len(name) > 3:
        return name[:-2]
    if name.endswith("s") and len(name) > 1:
        return name[:-1]
    return f"{name}_item"


def _get_record_root_prefix(schema_version: SchemaVersion) -> str:
    response_root = str(schema_version.summary.get("response_root") or "$")
    if response_root == "$":
        return "$[]"
    return f"{response_root}[]"


def _root_iteration_expression(schema_version: SchemaVersion) -> str:
    response_root = str(schema_version.summary.get("response_root") or "$")
    if response_root == "$":
        return "$root/*"
    expression = "$root"
    for token in _parse_path(response_root):
        expression += f"/{token.name}"
    return expression


def _strip_record_prefix(column_path: str, record_prefix: str) -> list[PathToken] | None:
    if column_path in {record_prefix[:-2], record_prefix}:
        return None
    if record_prefix == "$[]":
        trimmed = column_path[2:] if column_path.startswith("$.") else column_path
    elif column_path.startswith(f"{record_prefix}."):
        trimmed = column_path[len(record_prefix) + 1 :]
    else:
        return None
    if not trimmed:
        return None
    return _parse_path(trimmed)


def _path_expression(relative_tokens: tuple[PathToken, ...]) -> str:
    expression = ""
    for token in relative_tokens:
        if token.is_array:
            expression += f"/{token.name}"
        else:
            expression += f"/{token.name}[1]"
    return expression


def _build_contexts(schema_version: SchemaVersion) -> dict[tuple[PathToken, ...], XQueryContext]:
    record_prefix = _get_record_root_prefix(schema_version)
    contexts: dict[tuple[PathToken, ...], XQueryContext] = {(): XQueryContext(context_path=())}

    scalar_columns = [
        column
        for column in schema_version.columns
        if not column.is_array and not column.is_object
    ]

    for column in scalar_columns:
        relative_tokens = _strip_record_prefix(column.column_path, record_prefix)
        if not relative_tokens:
            continue

        current_context: tuple[PathToken, ...] = ()
        last_array_index = -1
        for index, token in enumerate(relative_tokens):
            if token.is_array:
                array_context = tuple(relative_tokens[: index + 1])
                contexts.setdefault(array_context, XQueryContext(context_path=array_context))
                contexts.setdefault(current_context, XQueryContext(context_path=current_context))
                contexts[current_context].child_arrays[array_context].append(column)
                current_context = array_context
                last_array_index = index

        scalar_tail = relative_tokens[last_array_index + 1 :]
        if scalar_tail:
            contexts.setdefault(current_context, XQueryContext(context_path=current_context))
            contexts[current_context].scalar_columns.append(column)

    return contexts


def _tokens_to_path(tokens: tuple[PathToken, ...]) -> str:
    segments: list[str] = []
    for token in tokens:
        suffix = "[]" if token.is_array else ""
        segments.append(f"{token.name}{suffix}")
    return ".".join(segments)


def _absolute_path(record_prefix: str, tokens: tuple[PathToken, ...]) -> str:
    suffix = _tokens_to_path(tokens)
    if record_prefix == "$[]":
        return f"$.{suffix}" if suffix else "$"
    return f"{record_prefix}.{suffix}" if suffix else record_prefix


def _name_map_for_context(
    columns: list[Column],
    context_path: tuple[PathToken, ...],
    record_prefix: str,
    naming_service: NamingService,
    naming_convention: str,
    separator: str,
) -> dict[str, str]:
    result: dict[str, str] = {}
    for column in columns:
        result[column.column_path] = naming_service.generate_xquery_name(
            column.column_path,
            naming_convention=naming_convention,
            separator=separator,
        )
    return result


def _array_name(
    array_path: tuple[PathToken, ...],
    record_prefix: str,
    naming_service: NamingService,
    naming_convention: str,
    separator: str,
) -> str:
    return naming_service.generate_xquery_name(
        _absolute_path(record_prefix, array_path),
        naming_convention=naming_convention,
        separator=separator,
    )


def _collection_mapping(
    array_path: tuple[PathToken, ...],
    context_path: tuple[PathToken, ...],
    record_prefix: str,
    naming_service: NamingService,
    naming_convention: str,
    separator: str,
) -> CollectionMapping:
    element_name = _array_name(array_path, record_prefix, naming_service, naming_convention, separator)
    array_leaf = array_path[-1].name
    item_element_name = _sanitize_xml_name(_singularize(array_leaf))
    loop_variable = f"${element_name}_item"
    path = _tokens_to_path(array_path)
    parent_path = _tokens_to_path(context_path) if context_path else None
    return CollectionMapping(
        path=path,
        parent_path=parent_path,
        depth=len(array_path),
        loop_variable=loop_variable,
        element_name=element_name,
        item_element_name=item_element_name,
        nested=bool(context_path),
    )


def _context_path_for_column(relative_tokens: list[PathToken]) -> tuple[PathToken, ...]:
    current_context: tuple[PathToken, ...] = ()
    for index, token in enumerate(relative_tokens):
        if token.is_array:
            current_context = tuple(relative_tokens[: index + 1])
    return current_context


def _context_variable_for_path(
    context_path: tuple[PathToken, ...],
    naming_convention: str,
    separator: str,
) -> str:
    if not context_path:
        return "$record"
    mapping = _collection_mapping(context_path, context_path[:-1], naming_convention, separator)
    return mapping.loop_variable


def _render_context(
    *,
    schema_version: SchemaVersion,
    contexts: dict[tuple[PathToken, ...], XQueryContext],
    context_path: tuple[PathToken, ...],
    context_var: str,
    indent: str,
    naming_convention: str,
    separator: str,
    emit_child_mapping_comments: bool,
    collection_mappings: list[CollectionMapping],
) -> list[str]:
    context = contexts.get(context_path)
    if context is None:
        return []

    record_prefix = _get_record_root_prefix(schema_version)
    naming_service = NamingService.for_schema_version(schema_version)
    name_map = _name_map_for_context(
        context.scalar_columns,
        context_path,
        record_prefix,
        naming_service,
        naming_convention,
        separator,
    )
    lines: list[str] = []

    for column in sorted(context.scalar_columns, key=lambda item: item.column_path):
        relative_tokens = _strip_record_prefix(column.column_path, record_prefix)
        if not relative_tokens:
            continue
        local_tokens = tuple(relative_tokens[len(context_path) :])
        element_name = name_map.get(column.column_path)
        if not element_name:
            continue
        expression = f"{context_var}{_path_expression(local_tokens)}"
        lines.append(
            f"{indent}<{element_name}>{{ data({expression}) }}</{element_name}>"
        )

    for array_path in sorted(context.child_arrays, key=lambda item: tuple(token.name for token in item)):
        mapping = _collection_mapping(
            array_path,
            context_path,
            record_prefix,
            naming_service,
            naming_convention,
            separator,
        )
        collection_mappings.append(mapping)
        local_array_tokens = array_path[len(context_path) :]
        if emit_child_mapping_comments:
            nesting = "nested child mapping" if mapping.nested else "child mapping"
            lines.append(
                f"{indent}(: {nesting}: {mapping.path} -> <{mapping.element_name}>/{mapping.item_element_name} :)"
            )
        lines.append(f"{indent}<{mapping.element_name}>{{")
        lines.append(
            f"{indent}  for {mapping.loop_variable} in {context_var}{_path_expression(local_array_tokens)}"
        )
        lines.append(f"{indent}  return")
        lines.append(f"{indent}    <{mapping.item_element_name}>")
        lines.extend(
            _render_context(
                schema_version=schema_version,
                contexts=contexts,
                context_path=array_path,
                context_var=mapping.loop_variable,
                indent=f"{indent}      ",
                naming_convention=naming_convention,
                separator=separator,
                emit_child_mapping_comments=emit_child_mapping_comments,
                collection_mappings=collection_mappings,
            )
        )
        lines.append(f"{indent}    </{mapping.item_element_name}>")
        lines.append(f"{indent}}}</{mapping.element_name}>")

    return lines


def build_iics_xquery(
    connection: APIConnection,
    schema_version: SchemaVersion,
    *,
    naming_convention: str,
    separator: str,
    root_element_name: str,
    row_element_name: str,
    emit_child_mapping_comments: bool = True,
) -> GeneratedXQueryDocument:
    contexts = _build_contexts(schema_version)
    record_expr = _root_iteration_expression(schema_version)
    output_root = _sanitize_xml_name(root_element_name)
    output_row = _sanitize_xml_name(row_element_name)
    collection_mappings: list[CollectionMapping] = []

    lines = [
        'xquery version "1.0";',
        "",
        "declare namespace fn = \"http://www.w3.org/2005/xpath-functions\";",
        "",
        f"(: Generated for {connection.name} schema version {schema_version.version_label} :)",
    ]
    if emit_child_mapping_comments:
        lines.extend(
            [
                "(: Repeating collections are emitted as child mappings.",
                "   Each object inside a collection becomes a repeated child row instead of a single indexed element. :)",
                "",
            ]
        )
    lines.extend(
        [
        f"declare function local:transform($root as node()*) as element({output_root}) {{",
        f"  <{output_root}>{{",
        f"    for $record in {record_expr}",
        "    return",
        f"      <{output_row}>",
        ]
    )
    lines.extend(
        _render_context(
            schema_version=schema_version,
            contexts=contexts,
            context_path=(),
            context_var="$record",
            indent="        ",
            naming_convention=naming_convention,
            separator=separator,
            emit_child_mapping_comments=emit_child_mapping_comments,
            collection_mappings=collection_mappings,
        )
    )
    lines.extend(
        [
            f"      </{output_row}>",
            f"  }}</{output_root}>",
            "};",
        ]
    )
    return GeneratedXQueryDocument(
        content="\n".join(lines),
        collection_mappings=collection_mappings,
    )


def build_field_xquery_preview(
    schema_version: SchemaVersion,
    column_path: str,
    *,
    naming_convention: str,
    separator: str,
) -> str:
    record_prefix = _get_record_root_prefix(schema_version)
    relative_tokens = _strip_record_prefix(column_path, record_prefix)
    if not relative_tokens:
        return ""

    contexts = _build_contexts(schema_version)
    naming_service = NamingService.for_schema_version(schema_version)
    if relative_tokens and relative_tokens[-1].is_array:
        array_path = tuple(relative_tokens)
        context_path = array_path[:-1]
        mapping = _collection_mapping(
            array_path,
            context_path,
            record_prefix,
            naming_service,
            naming_convention,
            separator,
        )
        context_var = "$record" if not context_path else _context_variable_for_path(context_path, naming_convention, separator)
        local_array_tokens = array_path[len(context_path) :]
        return "\n".join(
            [
                f"<{mapping.element_name}>{{",
                f"  for {mapping.loop_variable} in {context_var}{_path_expression(local_array_tokens)}",
                "  return",
                f"    <{mapping.item_element_name}>...</{mapping.item_element_name}>",
                f"}}</{mapping.element_name}>",
            ]
        )

    context_path = _context_path_for_column(relative_tokens)
    context = contexts.get(context_path)
    if context is None:
        return ""

    column = next((item for item in context.scalar_columns if item.column_path == column_path), None)
    if column is None:
        return ""

    name_map = _name_map_for_context(
        context.scalar_columns,
        context_path,
        record_prefix,
        naming_service,
        naming_convention,
        separator,
    )
    element_name = name_map.get(column_path)
    if not element_name:
        return ""

    local_tokens = tuple(relative_tokens[len(context_path) :])
    context_var = _context_variable_for_path(context_path, naming_convention, separator)
    expression = f"{context_var}{_path_expression(local_tokens)}"
    return f"<{element_name}>{{ data({expression}) }}</{element_name}>"


async def persist_generated_xquery(
    session: Any,
    *,
    schema_version: SchemaVersion,
    artifact_name: str,
    naming_convention: str,
    content: str,
) -> GeneratedXQuery:
    repository = GeneratedXQueryRepository(session)
    return await repository.create(
        schema_version_id=schema_version.id,
        artifact_name=artifact_name,
        naming_convention=naming_convention,
        content=content,
    )
