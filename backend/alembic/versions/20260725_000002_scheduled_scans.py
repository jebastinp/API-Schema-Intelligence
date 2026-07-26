"""add scheduled scans and enhanced history"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260725_000002"
down_revision = "20260725_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "api_connections",
        sa.Column("scan_frequency", sa.String(length=20), nullable=False, server_default="manual"),
    )
    op.add_column("api_connections", sa.Column("schedule_time_utc", sa.String(length=5), nullable=True))
    op.add_column("api_connections", sa.Column("schedule_day_of_week", sa.Integer(), nullable=True))
    op.add_column("api_connections", sa.Column("schedule_day_of_month", sa.Integer(), nullable=True))
    op.add_column("api_connections", sa.Column("next_scheduled_scan_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("api_connections", sa.Column("last_scanned_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("api_connections", sa.Column("last_scan_status", sa.String(length=50), nullable=True))
    op.add_column(
        "api_connections",
        sa.Column("auto_compare_schemas", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.add_column("scan_history", sa.Column("api_connection_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(
        "scan_history",
        sa.Column("trigger_mode", sa.String(length=20), nullable=False, server_default="manual"),
    )
    op.add_column("scan_history", sa.Column("schema_version_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(
        "scan_history",
        sa.Column("compared_to_schema_version_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "scan_history",
        sa.Column("change_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )

    op.execute(
        """
        UPDATE scan_history AS history
        SET api_connection_id = jobs.api_connection_id
        FROM scan_jobs AS jobs
        WHERE history.scan_job_id = jobs.id
        """
    )

    op.alter_column("scan_history", "api_connection_id", nullable=False)
    op.create_foreign_key(
        "fk_scan_history_api_connection_id_api_connections",
        "scan_history",
        "api_connections",
        ["api_connection_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_scan_history_schema_version_id_schema_versions",
        "scan_history",
        "schema_versions",
        ["schema_version_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_scan_history_compared_to_schema_version_id_schema_versions",
        "scan_history",
        "schema_versions",
        ["compared_to_schema_version_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_scan_history_api_connection_id"), "scan_history", ["api_connection_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_scan_history_api_connection_id"), table_name="scan_history")
    op.drop_constraint("fk_scan_history_compared_to_schema_version_id_schema_versions", "scan_history", type_="foreignkey")
    op.drop_constraint("fk_scan_history_schema_version_id_schema_versions", "scan_history", type_="foreignkey")
    op.drop_constraint("fk_scan_history_api_connection_id_api_connections", "scan_history", type_="foreignkey")
    op.drop_column("scan_history", "change_summary")
    op.drop_column("scan_history", "compared_to_schema_version_id")
    op.drop_column("scan_history", "schema_version_id")
    op.drop_column("scan_history", "trigger_mode")
    op.drop_column("scan_history", "api_connection_id")

    op.drop_column("api_connections", "auto_compare_schemas")
    op.drop_column("api_connections", "last_scan_status")
    op.drop_column("api_connections", "last_scanned_at")
    op.drop_column("api_connections", "next_scheduled_scan_at")
    op.drop_column("api_connections", "schedule_day_of_month")
    op.drop_column("api_connections", "schedule_day_of_week")
    op.drop_column("api_connections", "schedule_time_utc")
    op.drop_column("api_connections", "scan_frequency")
