"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  LoaderCircle,
  PencilLine,
  Play,
  PlugZap,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import { apiFetch } from "@/lib/api";
import type { APIConnection, APIConnectionPayload, APITestResult, ScanHistory, ScanJob } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const connectionSchema = z.object({
  name: z.string().min(2, "API name is required."),
  base_url: z.string().url("Enter a valid base URL."),
  token_url: z.union([z.string().url("Enter a valid token URL."), z.literal("")]),
  client_id: z.string(),
  client_secret: z.string(),
  grant_type: z.string(),
  authentication_type: z.string().min(1, "Authentication is required."),
  incremental: z.boolean(),
  response_root_node: z.string(),
  cursor_parameter: z.string(),
  headers_text: z.string(),
  count_parameter: z.string(),
  status: z.string().min(1, "Status is required."),
  scan_frequency: z.enum(["manual", "daily", "weekly", "monthly"]),
  schedule_time_utc: z.string(),
  schedule_day_of_week: z.coerce.number().min(0).max(6),
  schedule_day_of_month: z.coerce.number().min(1).max(31),
  auto_compare_schemas: z.boolean(),
});

type ConnectionFormValues = z.infer<typeof connectionSchema>;

const defaultValues: ConnectionFormValues = {
  name: "",
  base_url: "",
  token_url: "",
  client_id: "",
  client_secret: "",
  grant_type: "client_credentials",
  authentication_type: "oauth2_client_credentials",
  incremental: false,
  response_root_node: "",
  cursor_parameter: "",
  headers_text: "{\n  \n}",
  count_parameter: "",
  status: "draft",
  scan_frequency: "manual",
  schedule_time_utc: "01:00",
  schedule_day_of_week: 0,
  schedule_day_of_month: 1,
  auto_compare_schemas: true,
};

function deriveConnectionName(baseUrl: string) {
  try {
    const url = new URL(baseUrl.trim());
    const path = url.pathname === "/" ? "" : url.pathname.replaceAll("/", " ").trim();
    return [url.hostname, path].filter(Boolean).join(" · ");
  } catch {
    return "API Connection";
  }
}

function parseHeaders(headersText: string) {
  if (!headersText.trim()) {
    return {};
  }

  return z.record(z.string(), z.string()).parse(JSON.parse(headersText));
}

function toPayload(values: ConnectionFormValues): APIConnectionPayload {
  const tokenUrl = values.token_url.trim() || null;
  const clientId = values.client_id.trim() || null;
  const clientSecret = values.client_secret.trim() || null;
  const inferredAuthenticationType =
    tokenUrl && clientId && clientSecret ? "oauth2_client_credentials" : values.authentication_type;

  return {
    name: values.name.trim() || deriveConnectionName(values.base_url),
    base_url: values.base_url.trim(),
    token_url: tokenUrl,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: values.grant_type.trim() || null,
    authentication_type: inferredAuthenticationType,
    incremental: values.incremental,
    response_root_node: values.response_root_node.trim() || null,
    cursor_parameter: values.cursor_parameter.trim() || null,
    headers: parseHeaders(values.headers_text),
    count_parameter: values.count_parameter.trim() || null,
    status: values.status,
    scan_frequency: values.scan_frequency,
    schedule_time_utc: values.scan_frequency === "manual" ? null : values.schedule_time_utc.trim() || null,
    schedule_day_of_week: values.scan_frequency === "weekly" ? values.schedule_day_of_week : null,
    schedule_day_of_month: values.scan_frequency === "monthly" ? values.schedule_day_of_month : null,
    auto_compare_schemas: values.auto_compare_schemas,
  };
}

function fromConnection(connection: APIConnection): ConnectionFormValues {
  return {
    name: connection.name,
    base_url: connection.base_url,
    token_url: connection.token_url ?? "",
    client_id: connection.client_id ?? "",
    client_secret: connection.client_secret ?? "",
    grant_type: connection.grant_type ?? "client_credentials",
    authentication_type: connection.authentication_type,
    incremental: connection.incremental,
    response_root_node: connection.response_root_node ?? "",
    cursor_parameter: connection.cursor_parameter ?? "",
    headers_text: JSON.stringify(connection.headers ?? {}, null, 2),
    count_parameter: connection.count_parameter ?? "",
    status: connection.status,
    scan_frequency: (connection.scan_frequency as ConnectionFormValues["scan_frequency"]) ?? "manual",
    schedule_time_utc: connection.schedule_time_utc ?? "01:00",
    schedule_day_of_week: connection.schedule_day_of_week ?? 0,
    schedule_day_of_month: connection.schedule_day_of_month ?? 1,
    auto_compare_schemas: connection.auto_compare_schemas,
  };
}

export function ConnectionManager() {
  const [connections, setConnections] = useState<APIConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<APITestResult | null>(null);
  const [activeScanJob, setActiveScanJob] = useState<ScanJob | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);

  const form = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionSchema) as Resolver<ConnectionFormValues>,
    defaultValues,
  });

  async function loadConnections() {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<APIConnection[]>("/connections");
      setConnections(data);
    } catch (fetchError) {
      setConnections([]);
      setSelectedConnectionId(null);
      form.reset(defaultValues);
      setError(
        "Unable to load saved API connections right now. You can still create a new connection below.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConnections();
  }, []);

  useEffect(() => {
    if (!activeScanJob || !["queued", "running"].includes(activeScanJob.status)) {
      return;
    }

    const timer = window.setInterval(() => {
      void apiFetch<ScanJob>(`/scanner/jobs/${activeScanJob.id}`)
        .then((job) => {
          setActiveScanJob(job);
        })
        .catch((scanError) => {
          setError(scanError instanceof Error ? scanError.message : "Failed to refresh scan progress.");
        });
    }, 2500);

    return () => window.clearInterval(timer);
  }, [activeScanJob]);

  useEffect(() => {
    if (!activeScanJob || ["queued", "running"].includes(activeScanJob.status)) {
      return;
    }

    void loadConnections();

    if (selectedConnectionId) {
      void apiFetch<ScanHistory[]>(`/scanner/connections/${selectedConnectionId}/history?limit=8`)
        .then((history) => {
          setScanHistory(history);
        })
        .catch(() => {
          // Keep the existing history view if the refresh fails.
        });
    }
  }, [activeScanJob, selectedConnectionId]);

  useEffect(() => {
    if (!selectedConnectionId) {
      setScanHistory([]);
      return;
    }

    void apiFetch<ScanHistory[]>(`/scanner/connections/${selectedConnectionId}/history?limit=8`)
      .then((history) => {
        setScanHistory(history);
      })
      .catch(() => {
        setScanHistory([]);
      });
  }, [selectedConnectionId]);

  const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId) ?? null;
  const selectedScanFrequency = form.watch("scan_frequency");

  function startCreate() {
    setSelectedConnectionId(null);
    setSuccess(null);
    setTestResult(null);
    form.reset(defaultValues);
  }

  function startEdit(connection: APIConnection) {
    setSelectedConnectionId(connection.id);
    setSuccess(null);
    setTestResult(null);
    form.reset(fromConnection(connection));
  }

  async function runConnectionValidation(values: ConnectionFormValues) {
    const payload = toPayload(values);
    const result = await apiFetch<APITestResult>("/connections/test", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setTestResult(result);
    return result;
  }

  async function onSubmit(values: ConnectionFormValues) {
    if (!values.name.trim() && values.base_url.trim()) {
      values = {
        ...values,
        name: deriveConnectionName(values.base_url),
      };
      form.setValue("name", values.name, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    setSaving(true);
    setTesting(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);

    try {
      const payload = toPayload(values);
      const data = selectedConnection
        ? await apiFetch<APIConnection>(`/connections/${selectedConnection.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await apiFetch<APIConnection>("/connections", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      const refreshed = selectedConnection
        ? connections.map((connection) => (connection.id === data.id ? data : connection))
        : [data, ...connections];

      setConnections(refreshed);
      setSelectedConnectionId(data.id);
      form.reset(fromConnection(data));

      const validationResult = await runConnectionValidation(values);
      if (validationResult.success) {
        setSuccess(
          selectedConnection
            ? "API connection updated and validated immediately."
            : "API connection created and validated immediately.",
        );
      } else {
        setError(
          `Connection saved, but validation failed immediately: ${validationResult.message}`,
        );
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save connection.");
    } finally {
      setTesting(false);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedConnection) {
      return;
    }

    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch<void>(`/connections/${selectedConnection.id}`, {
        method: "DELETE",
      });
      setConnections((current) => current.filter((connection) => connection.id !== selectedConnection.id));
      setSelectedConnectionId(null);
      form.reset(defaultValues);
      setTestResult(null);
      setSuccess("API connection deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete connection.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleTest() {
    if (!form.getValues("name").trim() && form.getValues("base_url").trim()) {
      form.setValue("name", deriveConnectionName(form.getValues("base_url")), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    const isValid = await form.trigger();
    if (!isValid) {
      return;
    }

    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await runConnectionValidation(form.getValues());
      if (!result.success) {
        setError(result.message);
      }
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Failed to test connection.");
    } finally {
      setTesting(false);
    }
  }

  async function handleScan() {
    if (!selectedConnection) {
      return;
    }

    setScanning(true);
    setError(null);
    setSuccess(null);

    try {
      const job = await apiFetch<ScanJob>(`/scanner/connections/${selectedConnection.id}/scan`, {
        method: "POST",
        body: JSON.stringify({
          response_root_override: form.getValues("response_root_node").trim() || null,
        }),
      });
      setActiveScanJob(job);
      setSuccess("Full API scan started. Progress is updating live.");
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Failed to start scan.");
    } finally {
      setScanning(false);
    }
  }

  function formatEta(seconds: number | null) {
    if (!seconds || seconds <= 0) {
      return "Calculating";
    }
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}m ${remainder}s`;
  }

  function formatTimestamp(value: string | null) {
    if (!value) {
      return "Not scheduled";
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(value));
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="rounded-[2rem] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                API Connections
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Manage target systems
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void loadConnections()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={startCreate}
                className="min-w-[148px] shrink-0 justify-center gap-2 whitespace-nowrap px-4"
              >
                <Plus className="h-4 w-4" />
                Add API
              </Button>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {loading ? (
              <div className="rounded-[1.5rem] bg-white/60 px-4 py-8 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-300">
                Loading connections...
              </div>
            ) : connections.length === 0 ? (
              <div className="rounded-[1.5rem] bg-white/60 px-4 py-8 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-300">
                No API connections yet. Add your first endpoint configuration.
              </div>
            ) : (
              connections.map((connection) => {
                const isActive = connection.id === selectedConnectionId;
                return (
                  <button
                    key={connection.id}
                    type="button"
                    onClick={() => startEdit(connection)}
                    className={`flex w-full flex-col rounded-[1.5rem] border px-4 py-4 text-left transition ${
                      isActive
                        ? "border-blue-200 bg-blue-50/80 dark:border-blue-400/30 dark:bg-blue-500/10"
                        : "border-white/60 bg-white/58 hover:bg-white/78 dark:border-white/8 dark:bg-white/5 dark:hover:bg-white/8"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-50">{connection.name}</p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          {connection.base_url}
                        </p>
                      </div>
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:bg-white/10">
                        {connection.status}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-muted">
                      <span>{connection.authentication_type}</span>
                      <span>{connection.incremental ? "Incremental" : "Full scan"}</span>
                      <span>{connection.scan_frequency}</span>
                    </div>
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      Next run: {formatTimestamp(connection.next_scheduled_scan_at)}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card className="liquid-card rounded-[2rem] p-6">
          <div className="relative z-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                  {selectedConnection ? "Edit API" : "Add API"}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  Connection profile
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleTest()}
                  disabled={testing || saving}
                  className="gap-2"
                >
                  {testing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                  Validate Connection
                </Button>
                {selectedConnection ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleScan()}
                    disabled={scanning || saving}
                    className="gap-2"
                  >
                    {scanning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Run Scan
                  </Button>
                ) : null}
                {selectedConnection ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleDelete}
                    disabled={deleting || saving}
                    className="gap-2"
                  >
                    {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="mt-5 flex items-start gap-3 rounded-[1.5rem] border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {success ? (
              <div className="mt-5 flex items-start gap-3 rounded-[1.5rem] border border-emerald-200 bg-emerald-50/80 px-4 py-4 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            ) : null}

            {testResult ? (
              <div className="mt-5 rounded-[1.5rem] bg-white/66 px-4 py-4 text-sm dark:bg-white/6">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium text-slate-900 dark:text-slate-50">
                    {testResult.success ? "Connection test passed" : "Connection test failed"}
                  </p>
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    {testResult.response_time_ms ? `${testResult.response_time_ms} ms` : "No timing"}
                  </span>
                </div>
                <p className="mt-2 text-slate-600 dark:text-slate-300">{testResult.message}</p>
              </div>
            ) : null}

            {activeScanJob && selectedConnection && activeScanJob.api_connection_id === selectedConnection.id ? (
              <div className="mt-5 rounded-[1.75rem] border border-blue-100/80 bg-blue-50/75 p-5 shadow-[0_20px_60px_-36px_rgba(37,99,235,0.45)] dark:border-blue-400/20 dark:bg-blue-500/10">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Live Scanner</p>
                    <h4 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
                      {activeScanJob.status === "completed"
                        ? "Scan completed"
                        : activeScanJob.status === "failed"
                          ? "Scan failed"
                          : "Scanning entire endpoint"}
                    </h4>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {activeScanJob.current_api ?? selectedConnection.base_url}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:bg-white/10">
                    {activeScanJob.status}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-[1.25rem] bg-white/72 px-4 py-4 dark:bg-white/6">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Records scanned</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                      {activeScanJob.records_scanned.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] bg-white/72 px-4 py-4 dark:bg-white/6">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Current page</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                      {activeScanJob.metadata.current_page ?? 0}
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] bg-white/72 px-4 py-4 dark:bg-white/6">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Speed</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                      {activeScanJob.speed_records_per_second
                        ? `${activeScanJob.speed_records_per_second.toLocaleString()}/s`
                        : "Calculating"}
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] bg-white/72 px-4 py-4 dark:bg-white/6">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Estimated remaining</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                      {formatEta(activeScanJob.estimated_seconds_remaining)}
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] bg-white/72 px-4 py-4 dark:bg-white/6">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Current cursor</p>
                    <p className="mt-2 truncate text-sm font-medium text-slate-900 dark:text-slate-50">
                      {activeScanJob.current_cursor ?? "None"}
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] bg-white/72 px-4 py-4 dark:bg-white/6">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Stored responses</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                      {activeScanJob.metadata.stored_response_count ?? 0}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.25rem] bg-white/58 px-4 py-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
                    Strategy: {activeScanJob.metadata.pagination_strategy ?? "Detecting"}
                  </div>
                  <div className="rounded-[1.25rem] bg-white/58 px-4 py-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
                    Response root: {activeScanJob.metadata.response_root ?? "Auto"}
                  </div>
                  <div className="rounded-[1.25rem] bg-white/58 px-4 py-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
                    Current record: {activeScanJob.current_record.toLocaleString()}
                  </div>
                </div>

                {activeScanJob.error_message ? (
                  <p className="mt-4 text-sm text-rose-600 dark:text-rose-300">{activeScanJob.error_message}</p>
                ) : null}
              </div>
            ) : null}

            <form className="mt-6 space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="API Name" error={form.formState.errors.name?.message}>
                  <Input {...form.register("name")} />
                </FormField>
                <FormField label="Base URL" error={form.formState.errors.base_url?.message}>
                  <Input {...form.register("base_url")} placeholder="https://api.example.com/resource" />
                </FormField>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Token URL" error={form.formState.errors.token_url?.message}>
                  <Input {...form.register("token_url")} placeholder="https://auth.example.com/oauth/token" />
                </FormField>
                <FormField label="Authentication" error={form.formState.errors.authentication_type?.message}>
                  <Select {...form.register("authentication_type")}>
                    <option value="oauth2_client_credentials">OAuth2 Client Credentials</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Auth</option>
                    <option value="api_key">API Key</option>
                    <option value="none">None</option>
                  </Select>
                </FormField>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Client ID">
                  <Input {...form.register("client_id")} />
                </FormField>
                <FormField label="Client Secret">
                  <Input type="password" {...form.register("client_secret")} />
                </FormField>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Grant Type">
                  <Input {...form.register("grant_type")} />
                </FormField>
                <FormField label="Status" error={form.formState.errors.status?.message}>
                  <Select {...form.register("status")}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="error">Error</option>
                  </Select>
                </FormField>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Scan Frequency">
                  <Select {...form.register("scan_frequency")}>
                    <option value="manual">Manual</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </Select>
                </FormField>
                <FormField label="Schedule Time (UTC)">
                  <Input {...form.register("schedule_time_utc")} placeholder="01:00" disabled={selectedScanFrequency === "manual"} />
                </FormField>
              </div>

              {selectedScanFrequency === "weekly" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Weekly Run Day">
                    <Select {...form.register("schedule_day_of_week", { valueAsNumber: true })}>
                      <option value={0}>Monday</option>
                      <option value={1}>Tuesday</option>
                      <option value={2}>Wednesday</option>
                      <option value={3}>Thursday</option>
                      <option value={4}>Friday</option>
                      <option value={5}>Saturday</option>
                      <option value={6}>Sunday</option>
                    </Select>
                  </FormField>
                  <label className="flex items-center gap-3 rounded-[1.5rem] bg-white/58 px-4 py-4 text-sm font-medium text-slate-700 dark:bg-white/5 dark:text-slate-100">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      {...form.register("auto_compare_schemas")}
                    />
                    Auto-compare schemas after each scan
                  </label>
                </div>
              ) : null}

              {selectedScanFrequency === "monthly" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Monthly Run Day">
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      {...form.register("schedule_day_of_month", { valueAsNumber: true })}
                    />
                  </FormField>
                  <label className="flex items-center gap-3 rounded-[1.5rem] bg-white/58 px-4 py-4 text-sm font-medium text-slate-700 dark:bg-white/5 dark:text-slate-100">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      {...form.register("auto_compare_schemas")}
                    />
                    Auto-compare schemas after each scan
                  </label>
                </div>
              ) : null}

              {selectedScanFrequency === "manual" || selectedScanFrequency === "daily" ? (
                <label className="flex items-center gap-3 rounded-[1.5rem] bg-white/58 px-4 py-4 text-sm font-medium text-slate-700 dark:bg-white/5 dark:text-slate-100">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    {...form.register("auto_compare_schemas")}
                  />
                  Auto-compare schemas after each scan
                </label>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Response Root">
                  <Input {...form.register("response_root_node")} placeholder="d.results or data.items" />
                </FormField>
                <FormField label="Cursor Parameter">
                  <Input {...form.register("cursor_parameter")} placeholder="cursor" />
                </FormField>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Count Parameter">
                  <Input {...form.register("count_parameter")} placeholder="count or pageSize" />
                </FormField>
                <label className="flex items-center gap-3 rounded-[1.5rem] bg-white/58 px-4 py-4 text-sm font-medium text-slate-700 dark:bg-white/5 dark:text-slate-100">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    {...form.register("incremental")}
                  />
                  Incremental API
                </label>
              </div>

              <FormField
                label="Headers"
                error={form.formState.errors.headers_text?.message}
                hint='Enter JSON, for example: {"Accept":"application/json"}'
              >
                <Textarea {...form.register("headers_text")} className="font-mono" />
              </FormField>

              {selectedConnection ? (
                <div className="rounded-[1.75rem] bg-white/62 p-5 dark:bg-white/5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Scan Schedule</p>
                      <h4 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
                        {selectedConnection.scan_frequency === "manual"
                          ? "Manual execution"
                          : `${selectedConnection.scan_frequency} automation`}
                      </h4>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      Next scheduled run: {formatTimestamp(selectedConnection.next_scheduled_scan_at)}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[1.25rem] bg-white/72 px-4 py-4 dark:bg-white/6">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Last scan</p>
                      <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-50">
                        {formatTimestamp(selectedConnection.last_scanned_at)}
                      </p>
                    </div>
                    <div className="rounded-[1.25rem] bg-white/72 px-4 py-4 dark:bg-white/6">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Last status</p>
                      <p className="mt-2 text-sm font-medium uppercase text-slate-900 dark:text-slate-50">
                        {selectedConnection.last_scan_status ?? "Not run"}
                      </p>
                    </div>
                    <div className="rounded-[1.25rem] bg-white/72 px-4 py-4 dark:bg-white/6">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Schema compare</p>
                      <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-50">
                        {selectedConnection.auto_compare_schemas ? "Enabled" : "Disabled"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedConnection ? (
                <div className="rounded-[1.75rem] bg-white/62 p-5 dark:bg-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Scan History</p>
                      <h4 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
                        Recent executions
                      </h4>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {scanHistory.length === 0 ? (
                      <div className="rounded-[1.25rem] bg-white/72 px-4 py-4 text-sm text-slate-500 dark:bg-white/6 dark:text-slate-300">
                        No scan history available yet.
                      </div>
                    ) : (
                      scanHistory.map((historyItem) => (
                        <div
                          key={historyItem.id}
                          className="rounded-[1.25rem] border border-white/70 bg-white/74 px-4 py-4 dark:border-white/10 dark:bg-white/6"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
                                {historyItem.trigger_mode} scan
                              </p>
                              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">
                                {formatTimestamp(historyItem.started_at)}
                              </p>
                            </div>
                            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:bg-white/10">
                              {historyItem.status}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-4">
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                              Records: {historyItem.records_scanned.toLocaleString()}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                              Columns: {historyItem.columns_found.toLocaleString()}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                              Added: {String(historyItem.change_summary.added_columns ?? 0)}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                              Removed: {String(historyItem.change_summary.removed_columns ?? 0)}
                            </div>
                          </div>

                          {historyItem.error_message ? (
                            <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">{historyItem.error_message}</p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <Button type="button" variant="secondary" onClick={startCreate} className="gap-2">
                  <PencilLine className="h-4 w-4" />
                  Reset Form
                </Button>
                <Button type="submit" disabled={saving || testing} className="gap-2">
                  {saving || testing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  {saving || testing
                    ? selectedConnection
                      ? "Saving and Validating..."
                      : "Creating and Validating..."
                    : selectedConnection
                      ? "Save Changes"
                      : "Save Connection"}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </section>
    </div>
  );
}
