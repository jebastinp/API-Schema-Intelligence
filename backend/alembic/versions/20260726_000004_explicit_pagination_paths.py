"""add explicit pagination paths to api connections"""

from alembic import op
import sqlalchemy as sa


revision = "20260726_000004"
down_revision = "20260725_000003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("api_connections", sa.Column("next_cursor_path", sa.String(length=255), nullable=True))
    op.add_column("api_connections", sa.Column("has_next_page_path", sa.String(length=255), nullable=True))
    op.add_column("api_connections", sa.Column("total_records_path", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("api_connections", "total_records_path")
    op.drop_column("api_connections", "has_next_page_path")
    op.drop_column("api_connections", "next_cursor_path")
