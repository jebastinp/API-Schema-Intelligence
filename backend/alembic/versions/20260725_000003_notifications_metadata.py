"""enhance notifications with event metadata"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260725_000003"
down_revision = "20260725_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column("event_type", sa.String(length=100), nullable=False, server_default="info"),
    )
    op.add_column(
        "notifications",
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )


def downgrade() -> None:
    op.drop_column("notifications", "metadata")
    op.drop_column("notifications", "event_type")
