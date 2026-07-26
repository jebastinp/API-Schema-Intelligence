from datetime import datetime

from pydantic import BaseModel


class DatabaseHealthResponse(BaseModel):
    configured: bool
    reachable: bool
    status: str
    detail: str


class RuntimeDirectoryResponse(BaseModel):
    name: str
    path: str
    exists: bool


class EnvironmentHealthResponse(BaseModel):
    configured: bool
    missing_values: list[str]


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: datetime
    environment: str
    app_version: str
    environment_variables: EnvironmentHealthResponse
    database: DatabaseHealthResponse
    directories: list[RuntimeDirectoryResponse]
