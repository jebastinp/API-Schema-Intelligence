from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, HttpUrl, model_validator, field_validator

ALLOWED_SCAN_FREQUENCIES = {"manual", "daily", "weekly", "monthly"}


class APIConnectionBase(BaseModel):
    name: str
    base_url: HttpUrl
    token_url: HttpUrl | None = None
    client_id: str | None = None
    client_secret: str | None = None
    grant_type: str | None = None
    authentication_type: str
    incremental: bool = False
    response_root_node: str | None = None
    cursor_parameter: str | None = None
    headers: dict[str, str] = {}
    count_parameter: str | None = None
    status: str = "draft"
    scan_frequency: str = "manual"
    schedule_time_utc: str | None = None
    schedule_day_of_week: int | None = None
    schedule_day_of_month: int | None = None
    auto_compare_schemas: bool = True

    @field_validator("headers", mode="before")
    @classmethod
    def normalize_headers(cls, value: dict[str, str] | None) -> dict[str, str]:
        return value or {}

    @field_validator("scan_frequency")
    @classmethod
    def validate_scan_frequency(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ALLOWED_SCAN_FREQUENCIES:
            raise ValueError("Scan frequency must be manual, daily, weekly, or monthly.")
        return normalized

    @field_validator("schedule_time_utc")
    @classmethod
    def validate_schedule_time_utc(cls, value: str | None) -> str | None:
        if value in {None, ""}:
            return None
        parts = value.split(":")
        if len(parts) != 2 or not all(part.isdigit() for part in parts):
            raise ValueError("Schedule time must use HH:MM in UTC.")
        hour, minute = (int(part) for part in parts)
        if hour < 0 or hour > 23 or minute < 0 or minute > 59:
            raise ValueError("Schedule time must use HH:MM in UTC.")
        return f"{hour:02d}:{minute:02d}"

    @field_validator("schedule_day_of_week")
    @classmethod
    def validate_schedule_day_of_week(cls, value: int | None) -> int | None:
        if value is None:
            return None
        if value < 0 or value > 6:
            raise ValueError("Weekly schedules must use 0-6 where 0 is Monday.")
        return value

    @field_validator("schedule_day_of_month")
    @classmethod
    def validate_schedule_day_of_month(cls, value: int | None) -> int | None:
        if value is None:
            return None
        if value < 1 or value > 31:
            raise ValueError("Monthly schedules must use a day between 1 and 31.")
        return value

    @model_validator(mode="after")
    def validate_schedule_dependencies(self) -> "APIConnectionBase":
        if self.scan_frequency == "manual":
            return self

        if self.schedule_time_utc is None:
            raise ValueError("Scheduled scans require a UTC schedule time.")
        if self.scan_frequency == "weekly" and self.schedule_day_of_week is None:
            raise ValueError("Weekly schedules require a day of week.")
        if self.scan_frequency == "monthly" and self.schedule_day_of_month is None:
            raise ValueError("Monthly schedules require a day of month.")
        return self


class APIConnectionCreate(APIConnectionBase):
    pass


class APIConnectionUpdate(APIConnectionBase):
    pass


class APIConnectionRead(APIConnectionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    next_scheduled_scan_at: datetime | None
    last_scanned_at: datetime | None
    last_scan_status: str | None
    created_at: datetime
    updated_at: datetime


class APITestRequest(APIConnectionBase):
    pass


class APITestResponse(BaseModel):
    success: bool
    status_code: int | None = None
    message: str
    response_time_ms: int | None = None
