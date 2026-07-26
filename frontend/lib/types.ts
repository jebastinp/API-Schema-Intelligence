export type AuthenticationType =
  | "none"
  | "bearer"
  | "basic"
  | "oauth2_client_credentials"
  | "api_key";

export type APIConnection = {
  id: string;
  user_id: string;
  name: string;
  base_url: string;
  token_url: string | null;
  client_id: string | null;
  client_secret: string | null;
  grant_type: string | null;
  authentication_type: string;
  incremental: boolean;
  response_root_node: string | null;
  cursor_parameter: string | null;
  headers: Record<string, string>;
  count_parameter: string | null;
  status: string;
  scan_frequency: string;
  schedule_time_utc: string | null;
  schedule_day_of_week: number | null;
  schedule_day_of_month: number | null;
  next_scheduled_scan_at: string | null;
  last_scanned_at: string | null;
  last_scan_status: string | null;
  auto_compare_schemas: boolean;
  created_at: string;
  updated_at: string;
};

export type APIConnectionPayload = {
  name: string;
  base_url: string;
  token_url: string | null;
  client_id: string | null;
  client_secret: string | null;
  grant_type: string | null;
  authentication_type: string;
  incremental: boolean;
  response_root_node: string | null;
  cursor_parameter: string | null;
  headers: Record<string, string>;
  count_parameter: string | null;
  status: string;
  scan_frequency: string;
  schedule_time_utc: string | null;
  schedule_day_of_week: number | null;
  schedule_day_of_month: number | null;
  auto_compare_schemas: boolean;
};

export type APITestResult = {
  success: boolean;
  status_code: number | null;
  message: string;
  response_time_ms: number | null;
};

export type ScanJobMetadata = {
  current_page?: number;
  pages_scanned?: number;
  pagination_strategy?: string;
  response_root?: string | null;
  stored_responses?: string[];
  stored_response_count?: number;
  last_page_size?: number;
  discovered_columns?: number;
  new_columns_discovered?: number;
  removed_columns?: number;
  added_columns?: number;
  datatype_changes?: number;
  coverage_changes?: number;
  scan_status?: string;
  status_label?: string;
  scan_scope?: string;
  total_records_known?: boolean;
  total_records?: number | null;
  total_records_label?: string;
  scan_complete?: boolean;
  generated_sql_id?: string;
  generated_xquery_id?: string;
  schema_version_id?: string;
  completed_at?: string;
  trigger_mode?: string;
};

export type ScanJob = {
  id: string;
  api_connection_id: string;
  status: string;
  current_record: number;
  records_scanned: number;
  columns_found: number;
  estimated_seconds_remaining: number | null;
  current_cursor: string | null;
  current_api: string | null;
  speed_records_per_second: number | null;
  error_message: string | null;
  metadata: ScanJobMetadata;
};

export type ScanHistory = {
  id: string;
  api_connection_id: string;
  scan_job_id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  records_scanned: number;
  columns_found: number;
  trigger_mode: string;
  schema_version_id: string | null;
  compared_to_schema_version_id: string | null;
  summary: Record<string, unknown>;
  change_summary: Record<string, unknown>;
  error_message: string | null;
};

export type ScanJobStartPayload = {
  response_root_override?: string | null;
  page_size?: number | null;
  starting_cursor?: string | null;
};

export type ColumnStatistics = {
  occurrences: number;
  coverage_percent: number;
  first_seen_record: number | null;
  last_seen_record: number | null;
  data_type: string;
  average_length: number | null;
  maximum_length: number | null;
  null_count: number;
  unique_count: number | null;
};

export type DiscoveredColumn = {
  id: string;
  schema_version_id: string;
  column_path: string;
  display_name: string;
  sql_name: string;
  xquery_name: string;
  display_parent_path: string | null;
  parent_path: string | null;
  depth: number;
  data_type: string;
  is_nullable: boolean;
  is_array: boolean;
  is_object: boolean;
  example_value: string | null;
  statistics: ColumnStatistics | null;
};

export type SchemaVersion = {
  id: string;
  api_connection_id: string;
  version_number: number;
  version_label: string;
  status: string;
  summary: Record<string, unknown>;
  change_notes: string | null;
  columns: DiscoveredColumn[];
};

export type SchemaVersionSummary = {
  id: string;
  api_connection_id: string;
  version_number: number;
  version_label: string;
  status: string;
  summary: Record<string, unknown>;
  change_notes: string | null;
};

export type SchemaFieldHistoryEntry = {
  from_version_id: string;
  from_version_label: string;
  from_version_number: number;
  to_version_id: string;
  to_version_label: string;
  to_version_number: number;
  change_type: string;
  summary: string;
  previous_data_type: string | null;
  new_data_type: string | null;
  previous_coverage_percent: number | null;
  new_coverage_percent: number | null;
};

export type SchemaFieldExplorer = {
  column_path: string;
  display_name: string;
  sql_name: string;
  display_parent_path: string | null;
  parent_path: string | null;
  depth: number;
  data_type: string;
  coverage_percent: number | null;
  occurrences: number | null;
  example_value: string | null;
  average_length: number | null;
  maximum_length: number | null;
  null_count: number | null;
  unique_count: number | null;
  sql_preview: string;
  xquery_preview: string;
  history: SchemaFieldHistoryEntry[];
};

export type ScanDashboardJob = {
  id: string;
  api_connection_id: string;
  connection_name: string | null;
  status: string;
  current_record: number;
  records_scanned: number;
  columns_found: number;
  estimated_seconds_remaining: number | null;
  current_cursor: string | null;
  current_api: string | null;
  speed_records_per_second: number | null;
  error_message: string | null;
  current_page: number | null;
  new_columns_discovered: number;
  removed_columns: number;
  added_columns: number;
  datatype_changes: number;
  coverage_changes: number;
  metadata: ScanJobMetadata;
};

export type SchemaDiffEntry = {
  change_type: string;
  column_path: string;
  display_name: string;
  sql_name: string;
  previous_data_type: string | null;
  new_data_type: string | null;
  previous_coverage_percent: number | null;
  new_coverage_percent: number | null;
  summary: string;
  diff_line: string;
};

export type SchemaDiffSummary = {
  added: number;
  removed: number;
  datatype_changed: number;
  coverage_changed: number;
  total_changes: number;
};

export type SchemaVersionDiff = {
  from_version: SchemaVersionSummary;
  to_version: SchemaVersionSummary;
  summary: SchemaDiffSummary;
  lines: string[];
  changes: SchemaDiffEntry[];
};

export type ExportRecord = {
  id: string;
  user_id: string;
  schema_version_id: string | null;
  export_type: string;
  file_path: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type GeneratedSQLArtifact = {
  id: string;
  schema_version_id: string;
  artifact_name: string;
  dialect: string;
  statement_type: string;
  content: string;
};

export type CollectionMapping = {
  path: string;
  parent_path: string | null;
  depth: number;
  loop_variable: string;
  element_name: string;
  item_element_name: string;
  nested: boolean;
};

export type GeneratedXQueryArtifact = {
  id: string;
  schema_version_id: string;
  artifact_name: string;
  naming_convention: string;
  content: string;
  collection_mappings: CollectionMapping[];
};

export type NotificationRecord = {
  id: string;
  user_id: string;
  event_type: string;
  title: string;
  message: string;
  level: string;
  is_read: boolean;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SettingsEnvelope = {
  supabase: {
    project_url: string;
    anon_key_hint: string;
    service_role_key_hint: string;
    jwt_secret_configured: boolean;
    database_url_configured: boolean;
  };
  smtp: {
    host: string;
    port: number;
    username: string;
    from_email: string;
    from_name: string;
    encryption: "none" | "tls" | "ssl";
    enabled: boolean;
  };
  naming_rules: {
    sql_table_prefix: string;
    sql_column_case: "snake_case" | "camelCase" | "PascalCase";
    xquery_element_case: "snake_case" | "camelCase" | "PascalCase";
    duplicate_separator: string;
    child_collection_suffix: string;
  };
  scanner_rules: {
    default_page_size: number;
    request_timeout_seconds: number;
    max_retry_attempts: number;
    retry_backoff_seconds: number;
    persist_raw_responses: boolean;
    schema_compare_after_scan: boolean;
  };
  theme: {
    mode: "system" | "light" | "dark";
    accent_color: "apple_blue" | "slate" | "emerald";
    compact_density: boolean;
    glass_effects_enabled: boolean;
  };
  xquery_rules: {
    naming_convention: "snake_case" | "camelCase" | "PascalCase";
    emit_child_mapping_comments: boolean;
    include_positional_selectors: boolean;
    use_distinct_duplicate_names: boolean;
    root_element_name: string;
  };
  sql_rules: {
    dialect: "postgresql" | "snowflake" | "sqlserver";
    varchar_default_length: number;
    timestamp_mode: "timestamp" | "timestamptz";
    include_drop_statements: boolean;
    include_index_suggestions: boolean;
  };
  system_settings: {
    environment_label: string;
    audit_logging_enabled: boolean;
    notification_email: string;
    retention_days: number;
    scheduler_enabled: boolean;
  };
};

export type SettingsResponse = {
  settings: SettingsEnvelope;
};
