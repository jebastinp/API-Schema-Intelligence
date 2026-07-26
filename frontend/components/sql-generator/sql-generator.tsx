"use client";

import { ArrowDownToLine, FileCode2, GitCompareArrows, LoaderCircle, TableProperties } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiDownload, apiFetch } from "@/lib/api";
import type { APIConnection, GeneratedSQLArtifact, SchemaVersionSummary } from "@/lib/types";

export function SqlGenerator() {
  const [connections, setConnections] = useState<APIConnection[]>([]);
  const [versions, setVersions] = useState<SchemaVersionSummary[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [fromVersionId, setFromVersionId] = useState("");
  const [toVersionId, setToVersionId] = useState("");
  const [tableName, setTableName] = useState("");
  const [dialect, setDialect] = useState("postgresql");
  const [artifact, setArtifact] = useState<GeneratedSQLArtifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<"create" | "migration" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConnections() {
      setLoading(true);
      setError(null);
      try {
        const loadedConnections = await apiFetch<APIConnection[]>("/connections");
        setConnections(loadedConnections);
        setSelectedConnectionId(loadedConnections[0]?.id ?? "");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load SQL generator.");
      } finally {
        setLoading(false);
      }
    }

    void loadConnections();
  }, []);

  useEffect(() => {
    if (!selectedConnectionId) {
      setVersions([]);
      setSelectedVersionId("");
      setFromVersionId("");
      setToVersionId("");
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
        const latest = loadedVersions[0]?.id ?? "";
        const previous = loadedVersions[1]?.id ?? latest;
        setSelectedVersionId(latest);
        setToVersionId(latest);
        setFromVersionId(previous);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load schema versions.");
      } finally {
        setLoading(false);
      }
    }

    void loadVersions();
  }, [selectedConnectionId]);

  async function generateCreateSql() {
    if (!selectedConnectionId || !selectedVersionId) {
      return;
    }

    setGenerating("create");
    setError(null);
    try {
      const generated = await apiFetch<GeneratedSQLArtifact>(
        `/scanner/connections/${selectedConnectionId}/schema/${selectedVersionId}/sql/create`,
        {
          method: "POST",
          body: JSON.stringify({
            table_name: tableName.trim() || null,
            dialect,
          }),
        },
      );
      setArtifact(generated);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Failed to generate create SQL.");
    } finally {
      setGenerating(null);
    }
  }

  async function generateMigrationSql() {
    if (!selectedConnectionId || !fromVersionId || !toVersionId) {
      return;
    }

    setGenerating("migration");
    setError(null);
    try {
      const generated = await apiFetch<GeneratedSQLArtifact>(
        `/scanner/connections/${selectedConnectionId}/schema/sql/migration`,
        {
          method: "POST",
          body: JSON.stringify({
            from_version_id: fromVersionId,
            to_version_id: toVersionId,
            table_name: tableName.trim() || null,
            dialect,
          }),
        },
      );
      setArtifact(generated);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Failed to generate migration SQL.");
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <Card className="liquid-card rounded-[2rem] p-7">
          <div className="relative z-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">SQL Generator</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  Generate create-table and migration SQL from discovered schema versions.
                </h3>
              </div>
              {artifact ? (
                <Button
                  variant="secondary"
                  onClick={() => void apiDownload(`/scanner/sql/${artifact.id}/download`, artifact.artifact_name)}
                  className="gap-2"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  Download SQL
                </Button>
              ) : null}
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
              <Input value={tableName} onChange={(event) => setTableName(event.target.value)} placeholder="Custom table name" />
              <Select value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}>
                <option value="">Schema version</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.version_label} · v{version.version_number}
                  </option>
                ))}
              </Select>
              <Select value={dialect} onChange={(event) => setDialect(event.target.value)}>
                <option value="postgresql">PostgreSQL</option>
                <option value="snowflake">Snowflake</option>
                <option value="sqlserver">SQL Server</option>
              </Select>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <Button onClick={() => void generateCreateSql()} disabled={!selectedVersionId || generating !== null} className="gap-2">
                {generating === "create" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <TableProperties className="h-4 w-4" />}
                Generate Create Table SQL
              </Button>
              <Button
                variant="secondary"
                onClick={() => void generateMigrationSql()}
                disabled={!fromVersionId || !toVersionId || generating !== null}
                className="gap-2"
              >
                {generating === "migration" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <GitCompareArrows className="h-4 w-4" />}
                Generate Migration SQL
              </Button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <Select value={fromVersionId} onChange={(event) => setFromVersionId(event.target.value)}>
                <option value="">From version</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.version_label} · v{version.version_number}
                  </option>
                ))}
              </Select>
              <Select value={toVersionId} onChange={(event) => setToVersionId(event.target.value)}>
                <option value="">To version</option>
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
          </div>
        </Card>

        <Card className="rounded-[2rem] p-7">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Artifact Metadata</p>
          {loading ? (
            <div className="mt-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading generator context...
            </div>
          ) : artifact ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-[1.5rem] bg-white/60 p-5 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Artifact Name</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">{artifact.artifact_name}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.5rem] bg-white/60 p-4 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Dialect</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{artifact.dialect}</p>
                </div>
                <div className="rounded-[1.5rem] bg-white/60 p-4 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Statement Type</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{artifact.statement_type}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[1.5rem] bg-white/60 px-4 py-8 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-300">
              Generate an artifact to preview its metadata and download it.
            </div>
          )}
        </Card>
      </section>

      <Card className="rounded-[2rem] p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/80 p-3 text-primary dark:bg-white/10">
            <FileCode2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">SQL Preview</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Generated output</h3>
          </div>
        </div>

        <div className="mt-6">
          <Textarea value={artifact?.content ?? ""} readOnly className="min-h-[420px] font-mono text-xs" />
        </div>
      </Card>
    </div>
  );
}
