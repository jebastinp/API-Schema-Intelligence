"use client";

import { Activity, Clock3, LoaderCircle, Play, Radio, Rows3, Workflow } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import type { APIConnection, ScanDashboardJob, ScanHistory, ScanJob } from "@/lib/types";

function formatDate(value: string | null) {
  if (!value) {
    return "In progress";
  }
  return new Date(value).toLocaleString();
}

function formatCount(value: number | null | undefined) {
  return (value ?? 0).toLocaleString();
}

function scanStatusLabel(job: ScanDashboardJob | null) {
  return job?.metadata.scan_status ?? job?.status ?? "Idle";
}

function totalRecordsLabel(job: ScanDashboardJob | null) {
  return job?.metadata.total_records_known
    ? formatCount(job?.metadata.total_records)
    : "Unknown";
}

export function ScannerControlCenter() {
  const [connections, setConnections] = useState<APIConnection[]>([]);
  const [jobs, setJobs] = useState<ScanDashboardJob[]>([]);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [responseRootOverride, setResponseRootOverride] = useState("");
  const [pageSize, setPageSize] = useState("250");
  const [startingCursor, setStartingCursor] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadState = useCallback(async (connectionId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [loadedConnections, loadedJobs] = await Promise.all([
        apiFetch<APIConnection[]>("/connections"),
        apiFetch<ScanDashboardJob[]>("/scanner/jobs"),
      ]);
      setConnections(loadedConnections);
      const nextConnectionId = connectionId ?? selectedConnectionId ?? loadedConnections[0]?.id ?? "";
      setSelectedConnectionId(nextConnectionId);
      setJobs(loadedJobs);
      if (nextConnectionId) {
        const loadedHistory = await apiFetch<ScanHistory[]>(
          `/scanner/connections/${nextConnectionId}/history?limit=12`,
        );
        setHistory(loadedHistory);
      } else {
        setHistory([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load scanner state.");
    } finally {
      setLoading(false);
    }
  }, [selectedConnectionId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    if (!selectedConnectionId) {
      setHistory([]);
      return;
    }

    async function loadHistory() {
      try {
        const loadedHistory = await apiFetch<ScanHistory[]>(
          `/scanner/connections/${selectedConnectionId}/history?limit=12`,
        );
        setHistory(loadedHistory);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load scan history.");
      }
    }

    void loadHistory();
  }, [selectedConnectionId]);

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.id === selectedConnectionId) ?? null,
    [connections, selectedConnectionId],
  );

  const connectionJobs = useMemo(
    () => jobs.filter((job) => job.api_connection_id === selectedConnectionId),
    [jobs, selectedConnectionId],
  );

  const activeJob =
    connectionJobs.find((job) => job.status === "running" || job.status === "queued") ??
    connectionJobs[0] ??
    null;

  async function startScan() {
    if (!selectedConnectionId) {
      return;
    }

    setStarting(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        response_root_override: responseRootOverride.trim() || null,
        page_size: pageSize.trim() ? Number(pageSize) : null,
        starting_cursor: startingCursor.trim() || null,
        trigger_mode: "manual",
      };
      const scanJob = await apiFetch<ScanJob>(`/scanner/connections/${selectedConnectionId}/scan`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSuccess(`Scan job ${scanJob.id} queued successfully.`);
      await loadState(selectedConnectionId);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to start scan.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.04fr_0.96fr]">
        <Card className="liquid-card rounded-[2rem] p-7">
          <div className="relative z-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                  Scanner
                </p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  Start scans, resume from cursors, and monitor runtime throughput.
                </h3>
              </div>
              <Button onClick={() => void startScan()} disabled={!selectedConnectionId || starting} className="gap-2">
                {starting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Start Scan
              </Button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <Select value={selectedConnectionId} onChange={(event) => setSelectedConnectionId(event.target.value)}>
                <option value="">Select connection</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
              </Select>
              <Input
                value={responseRootOverride}
                onChange={(event) => setResponseRootOverride(event.target.value)}
                placeholder="Response root override"
              />
              <Input value={pageSize} onChange={(event) => setPageSize(event.target.value)} placeholder="Page size" />
              <Input
                value={startingCursor}
                onChange={(event) => setStartingCursor(event.target.value)}
                placeholder="Starting cursor"
              />
            </div>

            {error ? (
              <div className="mt-5 rounded-[1.5rem] border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="mt-5 rounded-[1.5rem] border border-emerald-200 bg-emerald-50/80 px-4 py-4 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                {success}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              {[
                { label: "Records Scanned", value: formatCount(activeJob?.records_scanned), icon: Rows3 },
                { label: "Columns Found", value: formatCount(activeJob?.columns_found), icon: Workflow },
                { label: "Current Page", value: formatCount(activeJob?.current_page), icon: Activity },
                {
                  label: "Pages Scanned",
                  value: formatCount(activeJob?.metadata.pages_scanned),
                  icon: Clock3,
                },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-[1.5rem] bg-white/68 p-4 dark:bg-white/6">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="rounded-[2rem] p-7">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Current Job</p>
          {loading ? (
            <div className="mt-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading scanner runtime...
            </div>
          ) : activeJob ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-[1.5rem] bg-white/60 p-5 dark:bg-white/5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Connection</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
                      {activeJob.connection_name ?? selectedConnection?.name ?? "Unknown"}
                    </p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                      {activeJob.metadata.scan_scope ?? "Scanning entire API..."}
                    </p>
                  </div>
                  <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:bg-white/10">
                    {scanStatusLabel(activeJob)}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[1.5rem] bg-white/60 p-4 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Current Scan Status</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{scanStatusLabel(activeJob)}</p>
                </div>
                <div className="rounded-[1.5rem] bg-white/60 p-4 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Total Records</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{totalRecordsLabel(activeJob)}</p>
                </div>
                <div className="rounded-[1.5rem] bg-white/60 p-4 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Current Cursor</p>
                  <p className="mt-2 break-all text-sm text-slate-700 dark:text-slate-200">
                    {activeJob.current_cursor ?? "Not set"}
                  </p>
                </div>
                <div className="rounded-[1.5rem] bg-white/60 p-4 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Current API</p>
                  <p className="mt-2 break-all text-sm text-slate-700 dark:text-slate-200">
                    {activeJob.current_api ?? selectedConnection?.base_url ?? "Unavailable"}
                  </p>
                </div>
                <div className="rounded-[1.5rem] bg-white/60 p-4 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Speed</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    {formatCount(activeJob.speed_records_per_second)} records/sec
                  </p>
                </div>
                <div className="rounded-[1.5rem] bg-white/60 p-4 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">ETA</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    {activeJob.estimated_seconds_remaining ? `${activeJob.estimated_seconds_remaining}s` : "--"}
                  </p>
                </div>
                <div className="rounded-[1.5rem] bg-white/60 p-4 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">New Columns</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    {formatCount(activeJob.metadata.new_columns_discovered ?? activeJob.new_columns_discovered)}
                  </p>
                </div>
                <div className="rounded-[1.5rem] bg-white/60 p-4 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Removed Columns</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    {formatCount(activeJob.metadata.removed_columns ?? activeJob.removed_columns)}
                  </p>
                </div>
                <div className="rounded-[1.5rem] bg-white/60 p-4 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Pages Scanned</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    {formatCount(activeJob.metadata.pages_scanned)}
                  </p>
                </div>
              </div>
              {activeJob.error_message ? (
                <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                  {activeJob.error_message}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 rounded-[1.5rem] bg-white/60 px-4 py-8 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-300">
              No scan jobs have been created for this connection yet.
            </div>
          )}
        </Card>
      </section>

      <Card className="rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Recent Scan History</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Runtime outcomes and schema version creation
            </h3>
          </div>
          <Button variant="secondary" onClick={() => void loadState(selectedConnectionId)} className="gap-2">
            <Radio className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {history.length === 0 ? (
            <div className="rounded-[1.5rem] bg-white/60 px-4 py-8 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-300">
              No completed scan history is available yet.
            </div>
          ) : (
            history.map((entry) => (
              <div
                key={entry.id}
                className="grid gap-4 rounded-[1.5rem] border border-white/60 bg-white/58 px-4 py-4 dark:border-white/8 dark:bg-white/5 lg:grid-cols-[1.15fr_0.85fr]"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:bg-white/10">
                      {entry.status}
                    </span>
                    <span className="text-xs uppercase tracking-[0.16em] text-muted">{entry.trigger_mode}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
                    Started {formatDate(entry.started_at)} and completed {formatDate(entry.completed_at)}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Records</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
                      {formatCount(entry.records_scanned)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Columns</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
                      {formatCount(entry.columns_found)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Schema Version</p>
                    <p className="mt-2 break-all text-sm text-slate-700 dark:text-slate-200">
                      {entry.schema_version_id ?? "Not created"}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
