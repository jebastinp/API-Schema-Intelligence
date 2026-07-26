import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base_mixins import TimestampMixin, UUIDPrimaryKeyMixin


class SchemaVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "schema_versions"

    api_connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("api_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    version_label: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    summary: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    change_notes: Mapped[str | None] = mapped_column(Text)
    columns: Mapped[list["Column"]] = relationship("Column", lazy="selectin", cascade="all, delete-orphan")
