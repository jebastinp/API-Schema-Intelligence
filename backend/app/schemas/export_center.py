from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ExportCreateRequest(BaseModel):
    export_type: str
    table_name: str | None = None
    naming_convention: str = "parent_prefix"
    separator: str = "_"
    root_element_name: str = "rows"
    row_element_name: str = "row"


class ExportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    schema_version_id: UUID | None
    export_type: str
    file_path: str
    metadata_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime
