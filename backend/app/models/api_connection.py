import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.base_mixins import TimestampMixin, UUIDPrimaryKeyMixin


class APIConnection(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "api_connections"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    base_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    token_url: Mapped[str | None] = mapped_column(String(1024))
    client_id: Mapped[str | None] = mapped_column(String(255))
    client_secret: Mapped[str | None] = mapped_column(String(255))
    grant_type: Mapped[str | None] = mapped_column(String(100))
    authentication_type: Mapped[str] = mapped_column(String(100), nullable=False)
    response_root_node: Mapped[str | None] = mapped_column(String(255))
    incremental: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cursor_parameter: Mapped[str | None] = mapped_column(String(255))
    count_parameter: Mapped[str | None] = mapped_column(String(255))
    headers: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)
    scan_frequency: Mapped[str] = mapped_column(String(20), default="manual", nullable=False)
    schedule_time_utc: Mapped[str | None] = mapped_column(String(5))
    schedule_day_of_week: Mapped[int | None] = mapped_column(Integer)
    schedule_day_of_month: Mapped[int | None] = mapped_column(Integer)
    next_scheduled_scan_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_scan_status: Mapped[str | None] = mapped_column(String(50))
    auto_compare_schemas: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
