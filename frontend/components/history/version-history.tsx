"use client";

import { Clock3, GitCompareArrows, LoaderCircle, Radar, Rows3 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import type { APIConnection, ScanHistory, SchemaVersionSummary } from "@/lib/types";

function formatDate(value: string | null) {
  if (!value) {
    return "Pending";
  }
  return new Date(value).toLocaleString();
}

export function VersionHistory() {
  const [connections, setConnections] = useState<APIConnection[]>([]);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [versions, setVersions] = useState<SchemaVersionSummary[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(async (connectionId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const loadedConnections = await apiFetch<APIConnection[]>("/connections");
      setConnections(loadedConnections);
      const nextConnectionId = connectionId ?? selectedConnectionId ?? loadedConnections[0]?.id ?? "";
      setSelectedConnectionId(nextConnectionId);

      if (nextConnectionId) {
        const [loadedHistory, loadedVersions] = await Promise.all([
          apiFetch<ScanHistory[]>(`/scanner/connections/${nextConnectionId}/history?limit=25`),
          apiFetch<SchemaVersionSummary[]>(`/scanner/connections/${nextConnectionId}/schema/versions`),
        ]);
        setHistory(loadedHistory);
        setVersions(loadedVersions);
      } else {
        setHistory([]);
        setVersions([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load version history.");
    } finally {
      setLoading(false);
    }
  }, [selectedConnectionId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    if (selectedConnectionId) {
      void loadState(selectedConnectionId);
    }
  }, [loadState, selectedConnectionId]);

  const latestVersion = versions[0] ?? null;
  const previousVersion = versions[1] ?? null;
  const completedScans = useMemo(() => history.filter((item) => item.status === "completed"), [history]);

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="liquid-card rounded-[2rem] p-7">
          <div className="relative z-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Version History</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  Review completed scans and the schema versions they produced.
                </h3>
              </div>
              <Button variant="secondary" onClick={() => void loadState(selectedConnectionId)} className="gap-2">
                <Clock3 className="h-4 w-4" />
                Refresh History
              </Button>
            </div>

            <div className="mt-6">
              <Select value={selectedConnectionId} onChange={(event) => setSelectedConnectionId(event.target.value)}>
                <option value="">Select connection</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
              </Select>
            </div>

            {error ? (
              <div className="mt-5 rounded-[1.5rem] border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                {error}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Scan Runs", value: history.length, icon: Radar },
                { label: "Completed", value: completedScans.length, icon: Rows3 },
                { label: "Schema Versions", value: versions.length, icon: GitCompareArrows },
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
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Current Version Pair</p>
          {loading ? (
            <div className="mt-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading version summary...
            </div>
          ) : latestVersion ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-[1.5rem] bg-white/60 p-5 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Latest Version</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">{latestVersion.version_label}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Version {latestVersion.version_number}</p>
              </div>
              <div className="rounded-[1.5rem] bg-white/60 p-5 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Previous Version</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {previousVersion?.version_label ?? "No previous version"}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                  {previousVersion ? `Version ${previousVersion.version_number}` : "Compare after the next completed scan"}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[1.5rem] bg-white/60 px-4 py-8 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-300">
              No schema versions have been created yet.
            </div>
          )}
        </Card>
      </section>

      <Card className="rounded-[2rem] p-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Scan Timeline</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Execution history
          </h3>
        </div>

        <div className="mt-6 space-y-3">
          {history.length === 0 ? (
            <div className="rounded-[1.5rem] bg-white/60 px-4 py-8 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-300">
              No historical scans are available yet.
            </div>
          ) : (
            history.map((entry) => (
              <div
                key={entry.id}
                className="rounded-[1.5rem] border border-white/60 bg-white/58 px-4 py-4 dark:border-white/8 dark:bg-white/5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                      <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">{entry.records_scanned}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">Columns</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">{entry.columns_found}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">Version</p>
                      <p className="mt-2 break-all text-sm text-slate-700 dark:text-slate-200">
                        {entry.schema_version_id ?? "Not captured"}
                      </p>
                    </div>
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
