"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Binary,
  DatabaseZap,
  FileCode2,
  LoaderCircle,
  Mail,
  Palette,
  RefreshCw,
  Save,
  ScanSearch,
  Settings2,
  ShieldCheck,
  Type,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import type { SettingsEnvelope, SettingsResponse } from "@/lib/types";

const settingsSchema = z.object({
  supabase_project_url: z.string(),
  supabase_anon_key_hint: z.string(),
  supabase_service_role_key_hint: z.string(),
  supabase_jwt_secret_configured: z.boolean(),
  supabase_database_url_configured: z.boolean(),
  smtp_host: z.string(),
  smtp_port: z.coerce.number().min(1).max(65535),
  smtp_username: z.string(),
  smtp_from_email: z.string(),
  smtp_from_name: z.string(),
  smtp_encryption: z.enum(["none", "tls", "ssl"]),
  smtp_enabled: z.boolean(),
  naming_sql_table_prefix: z.string(),
  naming_sql_column_case: z.enum(["snake_case", "camelCase", "PascalCase"]),
  naming_xquery_element_case: z.enum(["snake_case", "camelCase", "PascalCase"]),
  naming_duplicate_separator: z.string().min(1),
  naming_child_collection_suffix: z.string().min(1),
  scanner_default_page_size: z.coerce.number().min(1).max(10000),
  scanner_request_timeout_seconds: z.coerce.number().min(5).max(300),
  scanner_max_retry_attempts: z.coerce.number().min(0).max(10),
  scanner_retry_backoff_seconds: z.coerce.number().min(0).max(60),
  scanner_persist_raw_responses: z.boolean(),
  scanner_schema_compare_after_scan: z.boolean(),
  theme_mode: z.enum(["system", "light", "dark"]),
  theme_accent_color: z.enum(["apple_blue", "slate", "emerald"]),
  theme_compact_density: z.boolean(),
  theme_glass_effects_enabled: z.boolean(),
  xquery_naming_convention: z.enum(["snake_case", "camelCase", "PascalCase"]),
  xquery_emit_child_mapping_comments: z.boolean(),
  xquery_include_positional_selectors: z.boolean(),
  xquery_use_distinct_duplicate_names: z.boolean(),
  xquery_root_element_name: z.string().min(1),
  sql_dialect: z.enum(["postgresql", "snowflake", "sqlserver"]),
  sql_varchar_default_length: z.coerce.number().min(16).max(65535),
  sql_timestamp_mode: z.enum(["timestamp", "timestamptz"]),
  sql_include_drop_statements: z.boolean(),
  sql_include_index_suggestions: z.boolean(),
  system_environment_label: z.string().min(1),
  system_audit_logging_enabled: z.boolean(),
  system_notification_email: z.string(),
  system_retention_days: z.coerce.number().min(1).max(3650),
  system_scheduler_enabled: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const defaultValues: SettingsFormValues = {
  supabase_project_url: "",
  supabase_anon_key_hint: "",
  supabase_service_role_key_hint: "",
  supabase_jwt_secret_configured: false,
  supabase_database_url_configured: false,
  smtp_host: "",
  smtp_port: 587,
  smtp_username: "",
  smtp_from_email: "",
  smtp_from_name: "Schema Studio",
  smtp_encryption: "tls",
  smtp_enabled: false,
  naming_sql_table_prefix: "",
  naming_sql_column_case: "snake_case",
  naming_xquery_element_case: "snake_case",
  naming_duplicate_separator: "_",
  naming_child_collection_suffix: "_items",
  scanner_default_page_size: 200,
  scanner_request_timeout_seconds: 30,
  scanner_max_retry_attempts: 3,
  scanner_retry_backoff_seconds: 2,
  scanner_persist_raw_responses: true,
  scanner_schema_compare_after_scan: true,
  theme_mode: "system",
  theme_accent_color: "apple_blue",
  theme_compact_density: false,
  theme_glass_effects_enabled: true,
  xquery_naming_convention: "snake_case",
  xquery_emit_child_mapping_comments: true,
  xquery_include_positional_selectors: true,
  xquery_use_distinct_duplicate_names: true,
  xquery_root_element_name: "SchemaStudioExport",
  sql_dialect: "postgresql",
  sql_varchar_default_length: 255,
  sql_timestamp_mode: "timestamp",
  sql_include_drop_statements: false,
  sql_include_index_suggestions: true,
  system_environment_label: "Production",
  system_audit_logging_enabled: true,
  system_notification_email: "",
  system_retention_days: 30,
  system_scheduler_enabled: true,
};

function toFormValues(settings: SettingsEnvelope): SettingsFormValues {
  return {
    supabase_project_url: settings.supabase.project_url,
    supabase_anon_key_hint: settings.supabase.anon_key_hint,
    supabase_service_role_key_hint: settings.supabase.service_role_key_hint,
    supabase_jwt_secret_configured: settings.supabase.jwt_secret_configured,
    supabase_database_url_configured: settings.supabase.database_url_configured,
    smtp_host: settings.smtp.host,
    smtp_port: settings.smtp.port,
    smtp_username: settings.smtp.username,
    smtp_from_email: settings.smtp.from_email,
    smtp_from_name: settings.smtp.from_name,
    smtp_encryption: settings.smtp.encryption,
    smtp_enabled: settings.smtp.enabled,
    naming_sql_table_prefix: settings.naming_rules.sql_table_prefix,
    naming_sql_column_case: settings.naming_rules.sql_column_case,
    naming_xquery_element_case: settings.naming_rules.xquery_element_case,
    naming_duplicate_separator: settings.naming_rules.duplicate_separator,
    naming_child_collection_suffix: settings.naming_rules.child_collection_suffix,
    scanner_default_page_size: settings.scanner_rules.default_page_size,
    scanner_request_timeout_seconds: settings.scanner_rules.request_timeout_seconds,
    scanner_max_retry_attempts: settings.scanner_rules.max_retry_attempts,
    scanner_retry_backoff_seconds: settings.scanner_rules.retry_backoff_seconds,
    scanner_persist_raw_responses: settings.scanner_rules.persist_raw_responses,
    scanner_schema_compare_after_scan: settings.scanner_rules.schema_compare_after_scan,
    theme_mode: settings.theme.mode,
    theme_accent_color: settings.theme.accent_color,
    theme_compact_density: settings.theme.compact_density,
    theme_glass_effects_enabled: settings.theme.glass_effects_enabled,
    xquery_naming_convention: settings.xquery_rules.naming_convention,
    xquery_emit_child_mapping_comments: settings.xquery_rules.emit_child_mapping_comments,
    xquery_include_positional_selectors: settings.xquery_rules.include_positional_selectors,
    xquery_use_distinct_duplicate_names: settings.xquery_rules.use_distinct_duplicate_names,
    xquery_root_element_name: settings.xquery_rules.root_element_name,
    sql_dialect: settings.sql_rules.dialect,
    sql_varchar_default_length: settings.sql_rules.varchar_default_length,
    sql_timestamp_mode: settings.sql_rules.timestamp_mode,
    sql_include_drop_statements: settings.sql_rules.include_drop_statements,
    sql_include_index_suggestions: settings.sql_rules.include_index_suggestions,
    system_environment_label: settings.system_settings.environment_label,
    system_audit_logging_enabled: settings.system_settings.audit_logging_enabled,
    system_notification_email: settings.system_settings.notification_email,
    system_retention_days: settings.system_settings.retention_days,
    system_scheduler_enabled: settings.system_settings.scheduler_enabled,
  };
}

function toPayload(values: SettingsFormValues): SettingsEnvelope {
  return {
    supabase: {
      project_url: values.supabase_project_url.trim(),
      anon_key_hint: values.supabase_anon_key_hint.trim(),
      service_role_key_hint: values.supabase_service_role_key_hint.trim(),
      jwt_secret_configured: values.supabase_jwt_secret_configured,
      database_url_configured: values.supabase_database_url_configured,
    },
    smtp: {
      host: values.smtp_host.trim(),
      port: values.smtp_port,
      username: values.smtp_username.trim(),
      from_email: values.smtp_from_email.trim(),
      from_name: values.smtp_from_name.trim(),
      encryption: values.smtp_encryption,
      enabled: values.smtp_enabled,
    },
    naming_rules: {
      sql_table_prefix: values.naming_sql_table_prefix.trim(),
      sql_column_case: values.naming_sql_column_case,
      xquery_element_case: values.naming_xquery_element_case,
      duplicate_separator: values.naming_duplicate_separator,
      child_collection_suffix: values.naming_child_collection_suffix,
    },
    scanner_rules: {
      default_page_size: values.scanner_default_page_size,
      request_timeout_seconds: values.scanner_request_timeout_seconds,
      max_retry_attempts: values.scanner_max_retry_attempts,
      retry_backoff_seconds: values.scanner_retry_backoff_seconds,
      persist_raw_responses: values.scanner_persist_raw_responses,
      schema_compare_after_scan: values.scanner_schema_compare_after_scan,
    },
    theme: {
      mode: values.theme_mode,
      accent_color: values.theme_accent_color,
      compact_density: values.theme_compact_density,
      glass_effects_enabled: values.theme_glass_effects_enabled,
    },
    xquery_rules: {
      naming_convention: values.xquery_naming_convention,
      emit_child_mapping_comments: values.xquery_emit_child_mapping_comments,
      include_positional_selectors: values.xquery_include_positional_selectors,
      use_distinct_duplicate_names: values.xquery_use_distinct_duplicate_names,
      root_element_name: values.xquery_root_element_name.trim(),
    },
    sql_rules: {
      dialect: values.sql_dialect,
      varchar_default_length: values.sql_varchar_default_length,
      timestamp_mode: values.sql_timestamp_mode,
      include_drop_statements: values.sql_include_drop_statements,
      include_index_suggestions: values.sql_include_index_suggestions,
    },
    system_settings: {
      environment_label: values.system_environment_label.trim(),
      audit_logging_enabled: values.system_audit_logging_enabled,
      notification_email: values.system_notification_email.trim(),
      retention_days: values.system_retention_days,
      scheduler_enabled: values.system_scheduler_enabled,
    },
  };
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-[1.5rem] bg-white/58 px-4 py-4 text-sm font-medium text-slate-700 dark:bg-white/5 dark:text-slate-100">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block">{label}</span>
        <span className="mt-1 block text-sm font-normal text-slate-500 dark:text-slate-300">
          {description}
        </span>
      </span>
    </label>
  );
}

function SettingsSection({
  title,
  eyebrow,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  icon: typeof DatabaseZap;
  children: ReactNode;
}) {
  return (
    <Card className="liquid-card rounded-[2rem] p-6">
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {title}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {description}
            </p>
          </div>
          <div className="rounded-2xl bg-white/75 p-3 text-primary shadow-[0_18px_38px_-24px_rgba(37,99,235,0.45)] dark:bg-white/8">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-6 space-y-5">{children}</div>
      </div>
    </Card>
  );
}

export function SettingsModule() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema) as Resolver<SettingsFormValues>,
    defaultValues,
  });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<SettingsResponse>("/settings");
      form.reset(toFormValues(response.settings));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function onSubmit(values: SettingsFormValues) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = toPayload(values);
      const response = await apiFetch<SettingsResponse>("/settings", {
        method: "PUT",
        body: JSON.stringify({ settings: payload }),
      });
      form.reset(toFormValues(response.settings));
      setSuccess("Settings saved successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
        <Card className="liquid-card rounded-[2rem] p-7">
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                  Settings Module
                </p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  Operational rules for Schema Studio, stored per user.
                </h3>
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 dark:bg-white/8 dark:text-slate-100">
                <ShieldCheck className="h-4 w-4 text-primary" />
                User-scoped configuration
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] bg-white/68 p-4 dark:bg-white/6">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Categories</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-50">8</p>
              </div>
              <div className="rounded-[1.5rem] bg-white/68 p-4 dark:bg-white/6">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Scope</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-50">User</p>
              </div>
              <div className="rounded-[1.5rem] bg-white/68 p-4 dark:bg-white/6">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">State</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                  {loading ? "Loading" : "Ready"}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-[2rem] p-7">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
            Configuration Scope
          </p>
          <div className="mt-6 space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <p>Connectivity, delivery, naming, scanner behavior, theme controls, XQuery rules, SQL output rules, and system-level retention controls are centralized here.</p>
            <p>Values are persisted under your account and hydrate the settings experience on every protected session.</p>
          </div>
          <div className="mt-6 flex items-center gap-2">
            <Button variant="secondary" onClick={() => void loadSettings()} disabled={loading || saving} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={loading || saving} className="gap-2">
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Settings
            </Button>
          </div>
        </Card>
      </section>

      {error ? (
        <Card className="rounded-[1.75rem] border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </Card>
      ) : null}

      {success ? (
        <Card className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
          {success}
        </Card>
      ) : null}

      {loading ? (
        <Card className="rounded-[2rem] p-8 text-sm text-slate-500 dark:text-slate-300">
          <div className="flex items-center gap-3">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading settings...
          </div>
        </Card>
      ) : (
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsSection
            eyebrow="Connectivity"
            title="Connection Settings"
            description="Reference-level visibility into the connected platform project and whether critical runtime credentials are configured."
            icon={DatabaseZap}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Project URL">
                <Input {...form.register("supabase_project_url")} />
              </FormField>
              <FormField label="Public Key Status">
                <Input {...form.register("supabase_anon_key_hint")} placeholder="Configured" />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Administrative Key Status">
                <Input {...form.register("supabase_service_role_key_hint")} placeholder="Configured" />
              </FormField>
              <FormField label="Credential Notes">
                <Textarea
                  value={`JWT secret configured: ${form.watch("supabase_jwt_secret_configured") ? "Yes" : "No"}\nDatabase URL configured: ${form.watch("supabase_database_url_configured") ? "Yes" : "No"}`}
                  readOnly
                />
              </FormField>
            </div>
          </SettingsSection>

          <SettingsSection
            eyebrow="SMTP"
            title="SMTP Delivery"
            description="Configure outbound mail routing for operational notifications and future workflow messaging."
            icon={Mail}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Host">
                <Input {...form.register("smtp_host")} placeholder="smtp.example.com" />
              </FormField>
              <FormField label="Port">
                <Input type="number" {...form.register("smtp_port", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Encryption">
                <Select {...form.register("smtp_encryption")}>
                  <option value="tls">TLS</option>
                  <option value="ssl">SSL</option>
                  <option value="none">None</option>
                </Select>
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Username">
                <Input {...form.register("smtp_username")} />
              </FormField>
              <FormField label="From Email">
                <Input {...form.register("smtp_from_email")} placeholder="alerts@schemastudio.com" />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="From Name">
                <Input {...form.register("smtp_from_name")} />
              </FormField>
              <ToggleField
                label="SMTP enabled"
                description="Use this profile for notification delivery."
                checked={form.watch("smtp_enabled")}
                onChange={(checked) => form.setValue("smtp_enabled", checked)}
              />
            </div>
          </SettingsSection>

          <SettingsSection
            eyebrow="Naming Rules"
            title="Naming Conventions"
            description="Drive SQL, XQuery, and repeated collection naming consistency across generated artifacts."
            icon={Type}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="SQL Table Prefix">
                <Input {...form.register("naming_sql_table_prefix")} placeholder="sf_" />
              </FormField>
              <FormField label="Duplicate Separator">
                <Input {...form.register("naming_duplicate_separator")} />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="SQL Column Case">
                <Select {...form.register("naming_sql_column_case")}>
                  <option value="snake_case">snake_case</option>
                  <option value="camelCase">camelCase</option>
                  <option value="PascalCase">PascalCase</option>
                </Select>
              </FormField>
              <FormField label="XQuery Element Case">
                <Select {...form.register("naming_xquery_element_case")}>
                  <option value="snake_case">snake_case</option>
                  <option value="camelCase">camelCase</option>
                  <option value="PascalCase">PascalCase</option>
                </Select>
              </FormField>
              <FormField label="Child Collection Suffix">
                <Input {...form.register("naming_child_collection_suffix")} />
              </FormField>
            </div>
          </SettingsSection>

          <SettingsSection
            eyebrow="Scanner Rules"
            title="Scanner Runtime"
            description="Set default pagination volume, retry behavior, and raw payload handling for full-endpoint scans."
            icon={ScanSearch}
          >
            <div className="grid gap-4 md:grid-cols-4">
              <FormField label="Default Page Size">
                <Input type="number" {...form.register("scanner_default_page_size", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Timeout (Seconds)">
                <Input type="number" {...form.register("scanner_request_timeout_seconds", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Max Retries">
                <Input type="number" {...form.register("scanner_max_retry_attempts", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Retry Backoff">
                <Input type="number" {...form.register("scanner_retry_backoff_seconds", { valueAsNumber: true })} />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ToggleField
                label="Persist raw responses"
                description="Store each page payload in the generated scan cache."
                checked={form.watch("scanner_persist_raw_responses")}
                onChange={(checked) => form.setValue("scanner_persist_raw_responses", checked)}
              />
              <ToggleField
                label="Compare schemas automatically"
                description="Run schema diffing after each completed scan."
                checked={form.watch("scanner_schema_compare_after_scan")}
                onChange={(checked) => form.setValue("scanner_schema_compare_after_scan", checked)}
              />
            </div>
          </SettingsSection>

          <SettingsSection
            eyebrow="Theme"
            title="Theme Preferences"
            description="Configure dashboard presentation preferences for the current workspace."
            icon={Palette}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Mode">
                <Select {...form.register("theme_mode")}>
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </Select>
              </FormField>
              <FormField label="Accent Color">
                <Select {...form.register("theme_accent_color")}>
                  <option value="apple_blue">Blue</option>
                  <option value="slate">Slate</option>
                  <option value="emerald">Emerald</option>
                </Select>
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ToggleField
                label="Compact density"
                description="Use tighter spacing in dense administrative views."
                checked={form.watch("theme_compact_density")}
                onChange={(checked) => form.setValue("theme_compact_density", checked)}
              />
              <ToggleField
                label="Glass effects enabled"
                description="Keep translucent liquid glass surfaces active."
                checked={form.watch("theme_glass_effects_enabled")}
                onChange={(checked) => form.setValue("theme_glass_effects_enabled", checked)}
              />
            </div>
          </SettingsSection>

          <SettingsSection
            eyebrow="XQuery Rules"
            title="XQuery Generation"
            description="Define naming and selector rules for production Informatica IICS-compatible XQuery output."
            icon={FileCode2}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Naming Convention">
                <Select {...form.register("xquery_naming_convention")}>
                  <option value="snake_case">snake_case</option>
                  <option value="camelCase">camelCase</option>
                  <option value="PascalCase">PascalCase</option>
                </Select>
              </FormField>
              <FormField label="Root Element Name">
                <Input {...form.register("xquery_root_element_name")} />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ToggleField
                label="Emit child mapping comments"
                description="Annotate repeating collection child mappings in generated output."
                checked={form.watch("xquery_emit_child_mapping_comments")}
                onChange={(checked) => form.setValue("xquery_emit_child_mapping_comments", checked)}
              />
              <ToggleField
                label="Include positional selectors"
                description="Insert positional selectors where singleton extraction is required."
                checked={form.watch("xquery_include_positional_selectors")}
                onChange={(checked) => form.setValue("xquery_include_positional_selectors", checked)}
              />
            </div>
            <ToggleField
              label="Distinct duplicate names"
              description="Resolve duplicate XML element names using contextual prefixes."
              checked={form.watch("xquery_use_distinct_duplicate_names")}
              onChange={(checked) => form.setValue("xquery_use_distinct_duplicate_names", checked)}
            />
          </SettingsSection>

          <SettingsSection
            eyebrow="SQL Rules"
            title="SQL Output Rules"
            description="Set dialect defaults and DDL generation policies for CREATE and migration previews."
            icon={Binary}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Dialect">
                <Select {...form.register("sql_dialect")}>
                  <option value="postgresql">PostgreSQL</option>
                  <option value="snowflake">Snowflake</option>
                  <option value="sqlserver">SQL Server</option>
                </Select>
              </FormField>
              <FormField label="Default VARCHAR Length">
                <Input type="number" {...form.register("sql_varchar_default_length", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Timestamp Mode">
                <Select {...form.register("sql_timestamp_mode")}>
                  <option value="timestamp">TIMESTAMP</option>
                  <option value="timestamptz">TIMESTAMPTZ</option>
                </Select>
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ToggleField
                label="Include DROP statements"
                description="Emit destructive column drops in migration suggestions."
                checked={form.watch("sql_include_drop_statements")}
                onChange={(checked) => form.setValue("sql_include_drop_statements", checked)}
              />
              <ToggleField
                label="Include index suggestions"
                description="Generate index guidance with SQL previews where appropriate."
                checked={form.watch("sql_include_index_suggestions")}
                onChange={(checked) => form.setValue("sql_include_index_suggestions", checked)}
              />
            </div>
          </SettingsSection>

          <SettingsSection
            eyebrow="System Settings"
            title="System Configuration"
            description="Define retention, audit logging, scheduler behavior, and administrative labels for the platform."
            icon={Settings2}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Environment Label">
                <Input {...form.register("system_environment_label")} />
              </FormField>
              <FormField label="Notification Email">
                <Input {...form.register("system_notification_email")} placeholder="ops@schemastudio.com" />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Retention Days">
                <Input type="number" {...form.register("system_retention_days", { valueAsNumber: true })} />
              </FormField>
              <ToggleField
                label="Audit logging enabled"
                description="Retain operational audit metadata for settings-sensitive actions."
                checked={form.watch("system_audit_logging_enabled")}
                onChange={(checked) => form.setValue("system_audit_logging_enabled", checked)}
              />
              <ToggleField
                label="Scheduler enabled"
                description="Keep scheduled scan orchestration enabled for this user profile."
                checked={form.watch("system_scheduler_enabled")}
                onChange={(checked) => form.setValue("system_scheduler_enabled", checked)}
              />
            </div>
          </SettingsSection>

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => void loadSettings()} disabled={saving} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reset to Saved
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Settings
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
