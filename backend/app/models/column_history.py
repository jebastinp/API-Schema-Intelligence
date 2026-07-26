import uuid

from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.base_mixins import TimestampMixin, UUIDPrimaryKeyMixin


class ColumnHistory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "column_history"

    column_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("columns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    schema_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schema_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    change_type: Mapped[str] = mapped_column(String(50), nullable=False)
    previous_data_type: Mapped[str | None] = mapped_column(String(100))
    new_data_type: Mapped[str | None] = mapped_column(String(100))
    previous_coverage_percent: Mapped[float | None] = mapped_column(Float)
    new_coverage_percent: Mapped[float | None] = mapped_column(Float)
    summary: Mapped[str | None] = mapped_column(Text)
    details: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
