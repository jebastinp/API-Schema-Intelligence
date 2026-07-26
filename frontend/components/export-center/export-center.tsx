"use client";

import {
  ArrowDownToLine,
  FileCode2,
  FileJson2,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Sheet,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { apiDownload, apiFetch } from "@/lib/api";
import type { APIConnection, ExportRecord, SchemaVersionSummary } from "@/lib/types";

const exportTypes = [
  { key: "sql", label: "SQL", icon: FileCode2, accent: "text-blue-600" },
  { key: "xquery", label: "XQuery", icon: Sparkles, accent: "text-emerald-600" },
  { key: "csv", label: "CSV", icon: FileText, accent: "text-slate-700" },
  { key: "excel", label: "Excel", icon: FileSpreadsheet, accent: "text-emerald-700" },
  { key: "json_schema", label: "JSON Schema", icon: FileJson2, accent: "text-amber-600" },
  { key: "markdown", label: "Markdown", icon: Sheet, accent: "text-violet-600" },
] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function ExportCenter() {
  const [connections, setConnections] = useState<APIConnection[]>([]);
  const [versions, setVersions] = useState<SchemaVersionSummary[]>([]);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        const [loadedConnections, loadedExports] = await Promise.all([
          apiFetch<APIConnection[]>("/connections"),
          apiFetch<ExportRecord[]>("/scanner/exports"),
        ]);
        setConnections(loadedConnections);
        setExports(loadedExports);
        if (loadedConnections[0]) {
          setSelectedConnectionId(loadedConnections[0].id);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load export center.");
      } finally {
        setLoading(false);
      }
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!selectedConnectionId) {
      setVersions([]);
      setSelectedVersionId("");
      return;
    }

    async function loadVersions() {
      setLoading(true);
      setError(null);
      try {
        const loadedVersions = await apiFetch<SchemaVersionSummary[]>(
          `/scanner/connections/${selectedConnectionId}/schema/versions`,
        );
        setVersions(loadedVersions);
        setSelectedVersionId(loadedVersions[0]?.id ?? "");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load schema versions.");
      } finally {
        setLoading(false);
      }
    }

    void loadVersions();
  }, [selectedConnectionId]);

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? null,
    [selectedVersionId, versions],
  );

  async function handleExport(exportType: (typeof exportTypes)[number]["key"]) {
    if (!selectedConnectionId || !selectedVersionId) {
      return;
    }

    setBusyType(exportType);
    setError(null);
    try {
      const exportRecord = await apiFetch<ExportRecord>(
        `/scanner/connections/${selectedConnectionId}/schema/${selectedVersionId}/exports`,
        {
          method: "POST",
          body: JSON.stringify({
            export_type: exportType,
          }),
        },
      );
      setExports((current) => [exportRecord, ...current.filter((item) => item.id !== exportRecord.id)]);
      await apiDownload(`/scanner/exports/${exportRecord.id}/download`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Failed to generate export.");
    } finally {
      setBusyType(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <Card className="liquid-card rounded-[2rem] p-7">
          <div className="relative z-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                  Export Center
                </p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  Generate delivery-ready schema artifacts with one click.
                </h3>
              </div>
              <div className="rounded-2xl bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 dark:bg-white/8 dark:text-slate-100">
                {selectedVersion ? selectedVersion.version_label : "Generate Output"}
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <Select value={selectedConnectionId} onChange={(event) => setSelectedConnectionId(event.target.value)}>
                <option value="">Select API Connection</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
              </Select>
              <Select value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}>
                <option value="">Select Schema Version</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.version_label} · v{version.version_number}
                  </option>
                ))}
              </Select>
            </div>

            {error ? (
              <div className="mt-5 rounded-[1.5rem] border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                {error}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {exportTypes.map(({ key, label, icon: Icon, accent }) => {
                const busy = busyType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void handleExport(key)}
                    disabled={!selectedVersionId || busy}
                    className="rounded-[1.75rem] border border-white/60 bg-white/60 p-5 text-left transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/8 dark:bg-white/5 dark:hover:bg-white/8"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className={`rounded-2xl bg-white/80 p-3 dark:bg-white/10 ${accent}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-50">{label}</p>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                          Generate and download {label} immediately.
                        </p>
                      </div>
                      {busy ? <LoaderCircle className="h-5 w-5 animate-spin text-primary" /> : <ArrowDownToLine className="h-5 w-5 text-slate-400" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="rounded-[2rem] p-7">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
            Export Status
          </p>
          {loading ? (
            <div className="mt-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading export metadata...
            </div>
          ) : selectedVersion ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-[1.5rem] bg-white/60 px-4 py-4 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Version</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {selectedVersion.version_label}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-white/60 px-4 py-4 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Recent Exports</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {exports.length}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-white/60 px-4 py-4 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">One-click delivery</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Each export is persisted to the backend export store and immediately downloaded.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[1.5rem] bg-white/60 px-4 py-8 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-300">
              Select a schema version to enable exports.
            </div>
          )}
        </Card>
      </section>

      <Card className="rounded-[2rem] p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
              Recent Exports
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Download history
            </h3>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {exports.length === 0 ? (
            <div className="rounded-[1.5rem] bg-white/60 px-4 py-8 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-300">
              No exports have been generated yet.
            </div>
          ) : (
            exports.map((exportRecord) => (
              <button
                key={exportRecord.id}
                type="button"
                onClick={() => void apiDownload(`/scanner/exports/${exportRecord.id}/download`)}
                className="flex w-full items-center justify-between rounded-[1.5rem] border border-white/60 bg-white/58 px-4 py-4 text-left transition hover:bg-white/80 dark:border-white/8 dark:bg-white/5 dark:hover:bg-white/8"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-50">
                    {String(exportRecord.metadata_json.file_name ?? exportRecord.export_type)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    {exportRecord.export_type.toUpperCase()} · {formatDate(exportRecord.created_at)}
                  </p>
                </div>
                <ArrowDownToLine className="h-5 w-5 text-slate-400" />
              </button>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
