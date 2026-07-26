from uuid import UUID

from pydantic import BaseModel, ConfigDict


class XQueryGenerationRequest(BaseModel):
    naming_convention: str = "parent_prefix"
    separator: str = "_"
    root_element_name: str = "rows"
    row_element_name: str = "row"
    emit_child_mapping_comments: bool = True


class CollectionMappingResponse(BaseModel):
    path: str
    parent_path: str | None
    depth: int
    loop_variable: str
    element_name: str
    item_element_name: str
    nested: bool


class GeneratedXQueryResponse(BaseModel):
    id: UUID
    schema_version_id: UUID
    artifact_name: str
    naming_convention: str
    content: str
    collection_mappings: list[CollectionMappingResponse]
