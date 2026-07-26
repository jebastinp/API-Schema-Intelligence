import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.base_mixins import TimestampMixin, UUIDPrimaryKeyMixin


class GeneratedXQuery(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "generated_xquery"

    schema_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schema_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    artifact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    naming_convention: Mapped[str] = mapped_column(String(100), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
