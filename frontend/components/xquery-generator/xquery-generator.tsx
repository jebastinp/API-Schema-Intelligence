"use client";

import { ArrowDownToLine, GitBranchPlus, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiDownload, apiFetch } from "@/lib/api";
import type { APIConnection, GeneratedXQueryArtifact, SchemaVersionSummary } from "@/lib/types";

export function XQueryGenerator() {
  const [connections, setConnections] = useState<APIConnection[]>([]);
  const [versions, setVersions] = useState<SchemaVersionSummary[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [namingConvention, setNamingConvention] = useState("parent_prefix");
  const [separator, setSeparator] = useState("_");
  const [rootElementName, setRootElementName] = useState("rows");
  const [rowElementName, setRowElementName] = useState("row");
  const [artifact, setArtifact] = useState<GeneratedXQueryArtifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
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
        setError(loadError instanceof Error ? loadError.message : "Failed to load XQuery generator.");
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

  async function generateXQuery() {
    if (!selectedConnectionId || !selectedVersionId) {
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const generated = await apiFetch<GeneratedXQueryArtifact>(
        `/scanner/connections/${selectedConnectionId}/schema/${selectedVersionId}/xquery`,
        {
          method: "POST",
          body: JSON.stringify({
            naming_convention: namingConvention,
            separator,
            root_element_name: rootElementName.trim() || "rows",
            row_element_name: rowElementName.trim() || "row",
            emit_child_mapping_comments: true,
          }),
        },
      );
      setArtifact(generated);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Failed to generate XQuery.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="liquid-card rounded-[2rem] p-7">
          <div className="relative z-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">XQuery Generator</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  Produce Informatica-ready XQuery with duplicate-safe field naming.
                </h3>
              </div>
              {artifact ? (
                <Button
                  variant="secondary"
                  onClick={() => void apiDownload(`/scanner/xquery/${artifact.id}/download`, artifact.artifact_name)}
                  className="gap-2"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  Download XQuery
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
              <Select value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}>
                <option value="">Schema version</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.version_label} · v{version.version_number}
                  </option>
                ))}
              </Select>
              <Select value={namingConvention} onChange={(event) => setNamingConvention(event.target.value)}>
                <option value="parent_prefix">Parent Prefix</option>
                <option value="snake_case">Snake Case</option>
                <option value="camelCase">Camel Case</option>
                <option value="PascalCase">Pascal Case</option>
              </Select>
              <Input value={separator} onChange={(event) => setSeparator(event.target.value)} placeholder="Separator" />
              <Input
                value={rootElementName}
                onChange={(event) => setRootElementName(event.target.value)}
                placeholder="Root element"
              />
              <Input
                value={rowElementName}
                onChange={(event) => setRowElementName(event.target.value)}
                placeholder="Row element"
              />
            </div>

            <div className="mt-6">
              <Button onClick={() => void generateXQuery()} disabled={!selectedVersionId || generating} className="gap-2">
                {generating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate XQuery
              </Button>
            </div>

            {error ? (
              <div className="mt-5 rounded-[1.5rem] border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                {error}
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="rounded-[2rem] p-7">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Collection Mappings</p>
          {loading ? (
            <div className="mt-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading generator context...
            </div>
          ) : artifact ? (
            <div className="mt-6 space-y-3">
              {artifact.collection_mappings.map((mapping) => (
                <div
                  key={`${mapping.path}:${mapping.loop_variable}`}
                  className="rounded-[1.5rem] border border-white/60 bg-white/58 px-4 py-4 dark:border-white/8 dark:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-50">{mapping.path}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                        {mapping.element_name} / {mapping.item_element_name}
                      </p>
                    </div>
                    <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:bg-white/10">
                      depth {mapping.depth}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    loop variable <span className="font-mono">{mapping.loop_variable}</span>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[1.5rem] bg-white/60 px-4 py-8 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-300">
              Generate XQuery to inspect child collection loops and nested mappings.
            </div>
          )}
        </Card>
      </section>

      <Card className="rounded-[2rem] p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/80 p-3 text-primary dark:bg-white/10">
            <GitBranchPlus className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">XQuery Preview</p>
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
