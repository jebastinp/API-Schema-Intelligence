from typing import Literal

from pydantic import BaseModel, Field


class SupabaseSettingsValue(BaseModel):
    project_url: str = ""
    anon_key_hint: str = ""
    service_role_key_hint: str = ""
    jwt_secret_configured: bool = False
    database_url_configured: bool = False


class SMTPSettingsValue(BaseModel):
    host: str = ""
    port: int = 587
    username: str = ""
    from_email: str = ""
    from_name: str = "Schema Studio"
    encryption: Literal["none", "tls", "ssl"] = "tls"
    enabled: bool = False


class NamingRulesSettingsValue(BaseModel):
    sql_table_prefix: str = ""
    sql_column_case: Literal["snake_case", "camelCase", "PascalCase"] = "snake_case"
    xquery_element_case: Literal["snake_case", "camelCase", "PascalCase"] = "snake_case"
    duplicate_separator: str = "_"
    child_collection_suffix: str = "_items"


class ScannerRulesSettingsValue(BaseModel):
    default_page_size: int = Field(default=200, ge=1, le=10000)
    request_timeout_seconds: int = Field(default=30, ge=5, le=300)
    max_retry_attempts: int = Field(default=3, ge=0, le=10)
    retry_backoff_seconds: int = Field(default=2, ge=0, le=60)
    persist_raw_responses: bool = True
    schema_compare_after_scan: bool = True


class ThemeSettingsValue(BaseModel):
    mode: Literal["system", "light", "dark"] = "system"
    accent_color: Literal["apple_blue", "slate", "emerald"] = "apple_blue"
    compact_density: bool = False
    glass_effects_enabled: bool = True


class XQueryRulesSettingsValue(BaseModel):
    naming_convention: Literal["snake_case", "camelCase", "PascalCase"] = "snake_case"
    emit_child_mapping_comments: bool = True
    include_positional_selectors: bool = True
    use_distinct_duplicate_names: bool = True
    root_element_name: str = "SchemaStudioExport"


class SQLRulesSettingsValue(BaseModel):
    dialect: Literal["postgresql", "snowflake", "sqlserver"] = "postgresql"
    varchar_default_length: int = Field(default=255, ge=16, le=65535)
    timestamp_mode: Literal["timestamp", "timestamptz"] = "timestamp"
    include_drop_statements: bool = False
    include_index_suggestions: bool = True


class SystemSettingsValue(BaseModel):
    environment_label: str = "Production"
    audit_logging_enabled: bool = True
    notification_email: str = ""
    retention_days: int = Field(default=30, ge=1, le=3650)
    scheduler_enabled: bool = True


class SettingsEnvelope(BaseModel):
    supabase: SupabaseSettingsValue
    smtp: SMTPSettingsValue
    naming_rules: NamingRulesSettingsValue
    scanner_rules: ScannerRulesSettingsValue
    theme: ThemeSettingsValue
    xquery_rules: XQueryRulesSettingsValue
    sql_rules: SQLRulesSettingsValue
    system_settings: SystemSettingsValue


class SettingsResponse(BaseModel):
    settings: SettingsEnvelope


class SettingsUpdateRequest(BaseModel):
    settings: SettingsEnvelope
