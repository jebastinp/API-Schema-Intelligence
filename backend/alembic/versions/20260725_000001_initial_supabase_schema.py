"""initial supabase schema"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260725_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("supabase_user_id", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("avatar_url", sa.String(length=1024), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("supabase_user_id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)
    op.create_index(op.f("ix_users_supabase_user_id"), "users", ["supabase_user_id"], unique=False)

    op.create_table(
        "api_connections",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("base_url", sa.String(length=1024), nullable=False),
        sa.Column("token_url", sa.String(length=1024), nullable=True),
        sa.Column("client_id", sa.String(length=255), nullable=True),
        sa.Column("client_secret", sa.String(length=255), nullable=True),
        sa.Column("grant_type", sa.String(length=100), nullable=True),
        sa.Column("authentication_type", sa.String(length=100), nullable=False),
        sa.Column("response_root_node", sa.String(length=255), nullable=True),
        sa.Column("incremental", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("cursor_parameter", sa.String(length=255), nullable=True),
        sa.Column("count_parameter", sa.String(length=255), nullable=True),
        sa.Column("headers", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="draft"),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_api_connections_user_id"), "api_connections", ["user_id"], unique=False)

    op.create_table(
        "scan_jobs",
        sa.Column("api_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="queued"),
        sa.Column("current_record", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_scanned", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("columns_found", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_seconds_remaining", sa.Integer(), nullable=True),
        sa.Column("current_cursor", sa.Text(), nullable=True),
        sa.Column("current_api", sa.String(length=255), nullable=True),
        sa.Column("speed_records_per_second", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["api_connection_id"], ["api_connections.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scan_jobs_api_connection_id"), "scan_jobs", ["api_connection_id"], unique=False)

    op.create_table(
        "scan_history",
        sa.Column("scan_job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("records_scanned", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("columns_found", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("summary", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["scan_job_id"], ["scan_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scan_history_scan_job_id"), "scan_history", ["scan_job_id"], unique=False)

    op.create_table(
        "schema_versions",
        sa.Column("api_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("version_label", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="active"),
        sa.Column("summary", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("change_notes", sa.Text(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["api_connection_id"], ["api_connections.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_schema_versions_api_connection_id"), "schema_versions", ["api_connection_id"], unique=False)

    op.create_table(
        "columns",
        sa.Column("schema_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("column_path", sa.String(length=1024), nullable=False),
        sa.Column("parent_path", sa.String(length=1024), nullable=True),
        sa.Column("depth", sa.Integer(), nullable=False),
        sa.Column("data_type", sa.String(length=100), nullable=False),
        sa.Column("is_nullable", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_array", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_object", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("example_value", sa.Text(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["schema_version_id"], ["schema_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_columns_column_path"), "columns", ["column_path"], unique=False)
    op.create_index(op.f("ix_columns_schema_version_id"), "columns", ["schema_version_id"], unique=False)

    op.create_table(
        "column_statistics",
        sa.Column("column_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("occurrences", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("coverage_percent", sa.Float(), nullable=False, server_default="0"),
        sa.Column("first_seen_record", sa.Integer(), nullable=True),
        sa.Column("last_seen_record", sa.Integer(), nullable=True),
        sa.Column("first_seen_scan_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("last_seen_scan_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("data_type", sa.String(length=100), nullable=False),
        sa.Column("average_length", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("maximum_length", sa.Integer(), nullable=True),
        sa.Column("null_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unique_count", sa.Integer(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["column_id"], ["columns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["first_seen_scan_id"], ["scan_history.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["last_seen_scan_id"], ["scan_history.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_column_statistics_column_id"), "column_statistics", ["column_id"], unique=False)

    op.create_table(
        "column_history",
        sa.Column("column_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("schema_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("change_type", sa.String(length=50), nullable=False),
        sa.Column("previous_data_type", sa.String(length=100), nullable=True),
        sa.Column("new_data_type", sa.String(length=100), nullable=True),
        sa.Column("previous_coverage_percent", sa.Float(), nullable=True),
        sa.Column("new_coverage_percent", sa.Float(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["column_id"], ["columns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["schema_version_id"], ["schema_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_column_history_column_id"), "column_history", ["column_id"], unique=False)
    op.create_index(op.f("ix_column_history_schema_version_id"), "column_history", ["schema_version_id"], unique=False)

    op.create_table(
        "generated_sql",
        sa.Column("schema_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("artifact_name", sa.String(length=255), nullable=False),
        sa.Column("dialect", sa.String(length=100), nullable=False),
        sa.Column("statement_type", sa.String(length=100), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["schema_version_id"], ["schema_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_generated_sql_schema_version_id"), "generated_sql", ["schema_version_id"], unique=False)

    op.create_table(
        "generated_xquery",
        sa.Column("schema_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("artifact_name", sa.String(length=255), nullable=False),
        sa.Column("naming_convention", sa.String(length=100), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["schema_version_id"], ["schema_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_generated_xquery_schema_version_id"), "generated_xquery", ["schema_version_id"], unique=False)

    op.create_table(
        "exports",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("schema_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("export_type", sa.String(length=100), nullable=False),
        sa.Column("file_path", sa.String(length=1024), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["schema_version_id"], ["schema_versions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_exports_user_id"), "exports", ["user_id"], unique=False)

    op.create_table(
        "notifications",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("level", sa.String(length=50), nullable=False, server_default="info"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)

    op.create_table(
        "settings",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_settings_user_id"), "settings", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_settings_user_id"), table_name="settings")
    op.drop_table("settings")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_table("notifications")
    op.drop_index(op.f("ix_exports_user_id"), table_name="exports")
    op.drop_table("exports")
    op.drop_index(op.f("ix_generated_xquery_schema_version_id"), table_name="generated_xquery")
    op.drop_table("generated_xquery")
    op.drop_index(op.f("ix_generated_sql_schema_version_id"), table_name="generated_sql")
    op.drop_table("generated_sql")
    op.drop_index(op.f("ix_column_history_schema_version_id"), table_name="column_history")
    op.drop_index(op.f("ix_column_history_column_id"), table_name="column_history")
    op.drop_table("column_history")
    op.drop_index(op.f("ix_column_statistics_column_id"), table_name="column_statistics")
    op.drop_table("column_statistics")
    op.drop_index(op.f("ix_columns_schema_version_id"), table_name="columns")
    op.drop_index(op.f("ix_columns_column_path"), table_name="columns")
    op.drop_table("columns")
    op.drop_index(op.f("ix_schema_versions_api_connection_id"), table_name="schema_versions")
    op.drop_table("schema_versions")
    op.drop_index(op.f("ix_scan_history_scan_job_id"), table_name="scan_history")
    op.drop_table("scan_history")
    op.drop_index(op.f("ix_scan_jobs_api_connection_id"), table_name="scan_jobs")
    op.drop_table("scan_jobs")
    op.drop_index(op.f("ix_api_connections_user_id"), table_name="api_connections")
    op.drop_table("api_connections")
    op.drop_index(op.f("ix_users_supabase_user_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
