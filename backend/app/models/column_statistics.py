import uuid

from sqlalchemy import Float, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.base_mixins import TimestampMixin, UUIDPrimaryKeyMixin


class ColumnStatistics(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "column_statistics"

    column_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("columns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    occurrences: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    coverage_percent: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    first_seen_record: Mapped[int | None] = mapped_column(Integer)
    last_seen_record: Mapped[int | None] = mapped_column(Integer)
    first_seen_scan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_history.id", ondelete="SET NULL"),
    )
    last_seen_scan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_history.id", ondelete="SET NULL"),
    )
    data_type: Mapped[str] = mapped_column(String(100), nullable=False)
    average_length: Mapped[float | None] = mapped_column(Numeric(12, 2))
    maximum_length: Mapped[int | None] = mapped_column(Integer)
    null_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unique_count: Mapped[int | None] = mapped_column(Integer)
