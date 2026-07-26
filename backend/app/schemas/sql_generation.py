from uuid import UUID

from pydantic import BaseModel, ConfigDict


class GeneratedSQLResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    schema_version_id: UUID
    artifact_name: str
    dialect: str
    statement_type: str
    content: str


class SQLGenerationRequest(BaseModel):
    table_name: str | None = None
    dialect: str = "postgresql"


class SQLMigrationRequest(BaseModel):
    from_version_id: UUID
    to_version_id: UUID
    table_name: str | None = None
    dialect: str = "postgresql"
