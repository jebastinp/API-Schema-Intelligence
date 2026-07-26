import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.base_mixins import TimestampMixin, UUIDPrimaryKeyMixin


class ScanJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "scan_jobs"

    api_connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("api_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(50), default="queued", nullable=False)
    current_record: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_scanned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    columns_found: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    estimated_seconds_remaining: Mapped[int | None] = mapped_column(Integer)
    current_cursor: Mapped[str | None] = mapped_column(Text)
    current_api: Mapped[str | None] = mapped_column(String(255))
    speed_records_per_second: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)
