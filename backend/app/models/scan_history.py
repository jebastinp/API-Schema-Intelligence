import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.base_mixins import TimestampMixin, UUIDPrimaryKeyMixin


class ScanHistory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "scan_history"

    api_connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("api_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scan_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    records_scanned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    columns_found: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    trigger_mode: Mapped[str] = mapped_column(String(20), default="manual", nullable=False)
    schema_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schema_versions.id", ondelete="SET NULL"),
    )
    compared_to_schema_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schema_versions.id", ondelete="SET NULL"),
    )
    summary: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    change_summary: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text)
