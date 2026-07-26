from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    event_type: str
    title: str
    message: str
    level: str
    is_read: bool
    metadata_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class NotificationMarkReadRequest(BaseModel):
    is_read: bool = True
