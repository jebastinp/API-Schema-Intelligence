import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base_mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Column(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "columns"

    schema_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schema_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    column_path: Mapped[str] = mapped_column(String(1024), nullable=False, index=True)
    parent_path: Mapped[str | None] = mapped_column(String(1024))
    depth: Mapped[int] = mapped_column(Integer, nullable=False)
    data_type: Mapped[str] = mapped_column(String(100), nullable=False)
    is_nullable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_array: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_object: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    example_value: Mapped[str | None] = mapped_column(Text)
    statistics: Mapped["ColumnStatistics | None"] = relationship(
        "ColumnStatistics",
        lazy="selectin",
        cascade="all, delete-orphan",
        uselist=False,
    )
