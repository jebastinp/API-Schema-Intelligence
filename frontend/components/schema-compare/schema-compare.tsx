"use client";

import {
  ArrowRight,
  FileDiff,
  GitCompareArrows,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  Waves,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import type { APIConnection, SchemaDiffEntry, SchemaVersionDiff, SchemaVersionSummary } from "@/lib/types";

type ChangeFilter = "all" | "added" | "removed" | "datatype_changed" | "coverage_changed";

function changePill(changeType: string) {
  switch (changeType) {
    case "added":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200";
    case "removed":
      return "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200";
    case "datatype_changed":
      return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200";
    default:
      return "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200";
  }
}

function diffLineStyle(line: string) {
  if (line.startsWith("+ ")) {
    return "bg-emerald-50/80 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-100";
  }
  if (line.startsWith("- ")) {
    return "bg-rose-50/80 text-rose-800 dark:bg-rose-500/10 dark:text-rose-100";
  }
  if (line.startsWith("~ ")) {
    return "bg-amber-50/80 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100";
  }
  return "bg-slate-950 text-slate-100";
}

function formatCoverage(value: number | null) {
  if (value === null || value === undefined) {
    return "N/A";
  }
  return `${value.toFixed(2)}%`;
}

function DiffDetail({ change }: { change: SchemaDiffEntry }) {
  return (
    <div className="rounded-[1.5rem] border border-white/60 bg-white/60 p-4 dark:border-white/8 dark:bg-white/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-50">{change.display_name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{change.column_path}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{change.summary}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${changePill(
            change.change_type,
          )}`}
        >
          {change.change_type.replaceAll("_", " ")}
        </span>
      </div>

      {(change.previous_data_type || change.new_data_type || change.previous_coverage_percent !== null || change.new_coverage_percent !== null) ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-[1.25rem] bg-white/70 px-4 py-4 dark:bg-white/6">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Datatype</p>
            <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-50">
              {change.previous_data_type ?? "None"} <ArrowRight className="mx-1 inline h-3 w-3" />
              {change.new_data_type ?? "None"}
            </p>
          </div>
          <div className="rounded-[1.25rem] bg-white/70 px-4 py-4 dark:bg-white/6">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Coverage</p>
            <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-50">
              {formatCoverage(change.previous_coverage_percent)} <ArrowRight className="mx-1 inline h-3 w-3" />
              {formatCoverage(change.new_coverage_percent)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SchemaCompare() {
  const [connections, setConnections] = useState<APIConnection[]>([]);
  const [versions, setVersions] = useState<SchemaVersionSummary[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [fromVersionId, setFromVersionId] = useState("");
  const [toVersionId, setToVersionId] = useState("");
  const [compareResult, setCompareResult] = useState<SchemaVersionDiff | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ChangeFilter>("all");
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConnections() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<APIConnection[]>("/connections");
        setConnections(data);
        if (data[0]) {
          setSelectedConnectionId(data[0].id);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load connections.");
      } finally {
        setLoading(false);
      }
    }

    void loadConnections();
  }, []);

  useEffect(() => {
    if (!selectedConnectionId) {
      setVersions([]);
      setFromVersionId("");
      setToVersionId("");
      setCompareResult(null);
      return;
    }

    async function loadVersions() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<SchemaVersionSummary[]>(
          `/scanner/connections/${selectedConnectionId}/schema/versions`,
        );
        setVersions(data);
        setCompareResult(null);
        if (data.length >= 2) {
          setToVersionId(data[0].id);
          setFromVersionId(data[1].id);
        } else if (data[0]) {
          setToVersionId(data[0].id);
          setFromVersionId(data[0].id);
        } else {
          setToVersionId("");
          setFromVersionId("");
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load schema versions.");
      } finally {
        setLoading(false);
      }
    }

    void loadVersions();
  }, [selectedConnectionId]);

  useEffect(() => {
    if (!selectedConnectionId || !fromVersionId || !toVersionId || fromVersionId === toVersionId) {
      setCompareResult(null);
      return;
    }

    async function compare() {
      setComparing(true);
      setError(null);
      try {
        const result = await apiFetch<SchemaVersionDiff>(
          `/scanner/connections/${selectedConnectionId}/schema-compare?from_version_id=${fromVersionId}&to_version_id=${toVersionId}`,
        );
        setCompareResult(result);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to compare schema versions.");
      } finally {
        setComparing(false);
      }
    }

    void compare();
  }, [fromVersionId, selectedConnectionId, toVersionId]);

  const visibleChanges = useMemo(() => {
    const changes = compareResult?.changes ?? [];
    return changes.filter((change) => {
      if (filter !== "all" && change.change_type !== filter) {
        return false;
      }
      const normalized = query.trim().toLowerCase();
      if (!normalized) {
        return true;
      }
      return (
        change.display_name.toLowerCase().includes(normalized) ||
        change.column_path.toLowerCase().includes(normalized) ||
        change.summary.toLowerCase().includes(normalized)
      );
    });
  }, [compareResult, filter, query]);

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="liquid-card rounded-[2rem] p-7">
          <div className="relative z-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                  Schema Compare
                </p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  Compare two schema versions and identify structural changes.
                </h3>
              </div>
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-3">
              <Select value={selectedConnectionId} onChange={(event) => setSelectedConnectionId(event.target.value)}>
                <option value="">Select connection</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
              </Select>
              <Select value={fromVersionId} onChange={(event) => setFromVersionId(event.target.value)}>
                <option value="">Old version</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.version_label} · v{version.version_number}
                  </option>
                ))}
              </Select>
              <Select value={toVersionId} onChange={(event) => setToVersionId(event.target.value)}>
                <option value="">New version</option>
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

            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              {[
                { label: "Added", value: compareResult?.summary.added ?? 0, icon: Plus, tone: "text-emerald-600" },
                { label: "Removed", value: compareResult?.summary.removed ?? 0, icon: Minus, tone: "text-rose-600" },
                {
                  label: "Datatype Changes",
                  value: compareResult?.summary.datatype_changed ?? 0,
                  icon: FileDiff,
                  tone: "text-amber-600",
                },
                {
                  label: "Coverage Changes",
                  value: compareResult?.summary.coverage_changed ?? 0,
                  icon: Waves,
                  tone: "text-blue-600",
                },
              ].map(({ label, value, icon: Icon, tone }) => (
                <div key={label} className="rounded-[1.5rem] bg-white/68 p-4 dark:bg-white/6">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
                    <Icon className={`h-4 w-4 ${tone}`} />
                  </div>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="rounded-[2rem] p-7">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Version Pair</p>
          {loading ? (
            <div className="mt-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading comparison setup...
            </div>
          ) : compareResult ? (
            <div className="mt-6 space-y-5">
              <div className="rounded-[1.5rem] bg-white/60 p-5 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">From</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {compareResult.from_version.version_label}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                  Version {compareResult.from_version.version_number}
                </p>
              </div>
              <div className="flex items-center justify-center">
                <div className="rounded-full bg-blue-50 p-3 text-primary dark:bg-blue-500/10">
                  <GitCompareArrows className="h-5 w-5" />
                </div>
              </div>
              <div className="rounded-[1.5rem] bg-white/60 p-5 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">To</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {compareResult.to_version.version_label}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                  Version {compareResult.to_version.version_number}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[1.5rem] bg-white/60 px-4 py-8 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-300">
              Select two different schema versions to generate a comparison.
            </div>
          )}
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.94fr_1.06fr]">
        <Card className="rounded-[2rem] p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                Schema Comparison
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Schema Differences
              </h3>
            </div>
            {comparing ? (
              <div className="inline-flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 dark:bg-white/8 dark:text-slate-100">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Comparing
              </div>
            ) : null}
          </div>

            <div className="mt-6 overflow-hidden rounded-[1.75rem] bg-slate-950">
            <div className="border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.22em] text-slate-400">
              Schema Comparison
            </div>
            <div className="max-h-[640px] overflow-auto font-mono text-sm">
              {((compareResult?.lines && compareResult.lines.length > 0)
                ? compareResult.lines
                : ["No schema differences found."]).map((line, index) => (
                <div
                  key={`${index}-${line}`}
                  className={`flex gap-4 px-4 py-2 ${diffLineStyle(line)}`}
                >
                  <span className="w-10 shrink-0 text-right text-slate-400">{index + 1}</span>
                  <code className="min-w-0 break-all">{line}</code>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[2rem] p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                  Change Review
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  Added, removed, and modified schema paths
                </h3>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search changed fields"
                  className="pl-11"
                />
              </div>
              <div>
                <Select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as ChangeFilter)}
                  className="px-4"
                >
                  <option value="all">All changes</option>
                  <option value="added">Added</option>
                  <option value="removed">Removed</option>
                  <option value="datatype_changed">Datatype changed</option>
                  <option value="coverage_changed">Coverage changed</option>
                </Select>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            {visibleChanges.length === 0 ? (
              <Card className="rounded-[2rem] p-6">
                <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
                  <LoaderCircle className={`h-4 w-4 ${comparing ? "animate-spin" : ""}`} />
                  {comparing ? "Building comparison..." : "No changes matched the current filters."}
                </div>
              </Card>
            ) : (
              visibleChanges.map((change) => <DiffDetail key={`${change.change_type}-${change.column_path}`} change={change} />)
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
