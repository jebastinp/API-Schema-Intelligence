"use client";

import {
  Binary,
  Braces,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Database,
  FileCode2,
  LoaderCircle,
  RefreshCw,
  Search,
  Sparkles,
  Waves,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import type {
  APIConnection,
  DiscoveredColumn,
  SchemaFieldExplorer,
  SchemaVersion,
  SchemaVersionSummary,
} from "@/lib/types";

type ExplorerNode = {
  id: string;
  label: string;
  column: DiscoveredColumn | null;
  children: ExplorerNode[];
};

function segmentLabel(displayName: string) {
  return displayName.split(".").at(-1) ?? displayName;
}

function buildTree(columns: DiscoveredColumn[]) {
  const nodeMap = new Map<string, ExplorerNode>();
  const scalarColumns = columns.filter((column) => !column.is_array && !column.is_object && column.display_name);
  const roots: ExplorerNode[] = [];

  const ensureGroup = (path: string): ExplorerNode => {
    const existing = nodeMap.get(path);
    if (existing) {
      return existing;
    }
    const node: ExplorerNode = {
      id: `group:${path}`,
      label: segmentLabel(path),
      column: null,
      children: [],
    };
    nodeMap.set(path, node);
    const lastDotIndex = path.lastIndexOf(".");
    const parentPath = lastDotIndex >= 0 ? path.slice(0, lastDotIndex) : null;
    if (parentPath) {
      ensureGroup(parentPath).children.push(node);
    } else {
      roots.push(node);
    }
    return node;
  };

  for (const column of scalarColumns) {
    const node: ExplorerNode = {
      id: column.column_path,
      label: segmentLabel(column.display_name),
      column,
      children: [],
    };
    const parentPath = column.display_parent_path;
    if (parentPath) {
      ensureGroup(parentPath).children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: ExplorerNode[]) => {
    nodes.sort((left, right) => left.label.localeCompare(right.label));
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);
  return roots;
}

function flattenNodeIds(nodes: ExplorerNode[]) {
  const ids: string[] = [];
  const walk = (entries: ExplorerNode[]) => {
    for (const entry of entries) {
      ids.push(entry.id);
      walk(entry.children);
    }
  };
  walk(nodes);
  return ids;
}

function firstLeafId(nodes: ExplorerNode[]): string | null {
  for (const node of nodes) {
    if (node.column) {
      return node.id;
    }
    const childLeaf = firstLeafId(node.children);
    if (childLeaf) {
      return childLeaf;
    }
  }
  return null;
}

function filterTree(nodes: ExplorerNode[], query: string): ExplorerNode[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return nodes;
  }

  const filterNode = (node: ExplorerNode): ExplorerNode | null => {
    const matches =
      node.label.toLowerCase().includes(normalized) ||
      (node.column?.display_name.toLowerCase().includes(normalized) ?? false) ||
      (node.column?.column_path.toLowerCase().includes(normalized) ?? false);
    const children = node.children
      .map(filterNode)
      .filter((child): child is ExplorerNode => child !== null);
    if (!matches && children.length === 0) {
      return null;
    }
    return {
      ...node,
      children,
    };
  };

  return nodes.map(filterNode).filter((node): node is ExplorerNode => node !== null);
}

function formatValue(value: number | string | null | undefined, fallback = "N/A") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  }
  return value;
}

function NodeRow({
  node,
  depth,
  expanded,
  selectedId,
  onToggle,
  onSelect,
}: {
  node: ExplorerNode;
  depth: number;
  expanded: Set<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (node.column) {
            onSelect(node.id);
            return;
          }
          onToggle(node.id);
        }}
        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${
          isSelected
            ? "bg-blue-50 text-slate-900 shadow-[0_10px_28px_-20px_rgba(37,99,235,0.45)] dark:bg-blue-500/10 dark:text-slate-50"
            : "text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-white/8"
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        <span className="flex h-5 w-5 items-center justify-center">
          {hasChildren ? (
            <span
              onClick={(event) => {
                event.stopPropagation();
                onToggle(node.id);
              }}
              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-slate-500 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-white/10"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          ) : null}
        </span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-primary dark:bg-white/10">
          {node.column?.is_array ? (
            <Waves className="h-4 w-4" />
          ) : node.column?.is_object ? (
            <Braces className="h-4 w-4" />
          ) : (
            <Binary className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{node.label}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {node.column?.display_name ?? node.label}
          </p>
        </div>
      </button>

      {hasChildren && isExpanded ? (
        <div className="mt-1">
          {node.children.map((child) => (
            <NodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SchemaExplorer() {
  const [connections, setConnections] = useState<APIConnection[]>([]);
  const [versions, setVersions] = useState<SchemaVersionSummary[]>([]);
  const [schema, setSchema] = useState<SchemaVersion | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [selectedFieldPath, setSelectedFieldPath] = useState<string | null>(null);
  const [fieldDetails, setFieldDetails] = useState<SchemaFieldExplorer | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [loading, setLoading] = useState(true);
  const [fieldLoading, setFieldLoading] = useState(false);
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
      setSchema(null);
      setSelectedVersionId("");
      setSelectedFieldPath(null);
      setFieldDetails(null);
      return;
    }

    async function loadSchemaVersionState() {
      setLoading(true);
      setError(null);
      try {
        const [loadedVersions, latestSchema] = await Promise.all([
          apiFetch<SchemaVersionSummary[]>(`/scanner/connections/${selectedConnectionId}/schema/versions`),
          apiFetch<SchemaVersion>(`/scanner/connections/${selectedConnectionId}/schema/latest`),
        ]);
        setVersions(loadedVersions);
        if (loadedVersions.length === 0) {
          setSchema(null);
          setSelectedVersionId("");
          setSelectedFieldPath(null);
          setFieldDetails(null);
          return;
        }
        setSchema(latestSchema);
        setSelectedVersionId(latestSchema.id);
        setSelectedFieldPath(null);
        setFieldDetails(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load schema explorer.");
      } finally {
        setLoading(false);
      }
    }

    void loadSchemaVersionState();
  }, [selectedConnectionId]);

  useEffect(() => {
    if (!selectedConnectionId || !selectedVersionId) {
      return;
    }
    if (schema?.id === selectedVersionId) {
      return;
    }

    async function loadSchema() {
      setLoading(true);
      setError(null);
      try {
        const loadedSchema = await apiFetch<SchemaVersion>(
          `/scanner/connections/${selectedConnectionId}/schema/${selectedVersionId}`,
        );
        setSchema(loadedSchema);
        setSelectedFieldPath(null);
        setFieldDetails(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load schema version.");
      } finally {
        setLoading(false);
      }
    }

    void loadSchema();
  }, [schema?.id, selectedConnectionId, selectedVersionId]);

  const tree = useMemo(() => buildTree(schema?.columns ?? []), [schema]);
  const filteredTree = useMemo(() => filterTree(tree, deferredQuery), [deferredQuery, tree]);

  useEffect(() => {
    if (!tree.length) {
      setExpanded(new Set());
      setSelectedFieldPath(null);
      setFieldDetails(null);
      return;
    }

    const nextExpanded = new Set<string>();
    const seed = (nodes: ExplorerNode[], depth = 0) => {
      for (const node of nodes) {
        if (depth < 2) {
          nextExpanded.add(node.id);
        }
        seed(node.children, depth + 1);
      }
    };
    seed(tree);
    setExpanded(nextExpanded);
    if (!selectedFieldPath || selectedFieldPath.startsWith("group:")) {
      setSelectedFieldPath(firstLeafId(tree));
    }
  }, [tree, selectedVersionId, selectedFieldPath]);

  useEffect(() => {
    if (!selectedConnectionId || !selectedVersionId || !selectedFieldPath) {
      return;
    }
    const connectionId = selectedConnectionId;
    const versionId = selectedVersionId;
    const fieldPath = selectedFieldPath;

    async function loadFieldDetails() {
      setFieldLoading(true);
      setError(null);
      try {
        const detail = await apiFetch<SchemaFieldExplorer>(
          `/scanner/connections/${connectionId}/schema/${versionId}/field?column_path=${encodeURIComponent(fieldPath)}`,
        );
        setFieldDetails(detail);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load field details.");
      } finally {
        setFieldLoading(false);
      }
    }

    void loadFieldDetails();
  }, [selectedConnectionId, selectedFieldPath, selectedVersionId]);

  function toggleNode(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(flattenNodeIds(tree)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? null;

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="liquid-card rounded-[2rem] p-7">
          <div className="relative z-10">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                  Schema Explorer
                </p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  Browse and inspect discovered API fields, nested objects, arrays, and schema hierarchy.
                </h3>
              </div>
              <div className="grid max-w-[680px] gap-3 md:grid-cols-2">
                <Select value={selectedConnectionId} onChange={(event) => setSelectedConnectionId(event.target.value)}>
                  <option value="">Select connection</option>
                  {connections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name}
                    </option>
                  ))}
                </Select>
                <Select value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}>
                  <option value="">Select version</option>
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.version_label} · v{version.version_number}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search fields, paths, collections"
                  className="pl-11"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  title="Expand All"
                  aria-label="Expand All"
                  className="rounded-2xl bg-white/70 p-3 text-slate-700 transition hover:bg-white dark:bg-white/8 dark:text-slate-100"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  title="Collapse All"
                  aria-label="Collapse All"
                  className="rounded-2xl bg-white/70 p-3 text-slate-700 transition hover:bg-white dark:bg-white/8 dark:text-slate-100"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  title="Refresh"
                  aria-label="Refresh"
                  className="rounded-2xl bg-white/70 p-3 text-slate-700 transition hover:bg-white dark:bg-white/8 dark:text-slate-100"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {error ? (
              <div className="mt-5 flex items-start justify-between gap-4 rounded-[1.5rem] border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                <div>
                  <p className="font-medium">Unable to load schema.</p>
                  <p className="mt-1">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700"
                >
                  Retry
                </button>
              </div>
            ) : null}

            <div className="mt-6 rounded-[1.75rem] bg-white/62 p-4 dark:bg-white/5">
              {loading ? (
                <div className="flex items-center gap-3 px-3 py-10 text-sm text-slate-500 dark:text-slate-300">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Loading schema tree...
                </div>
              ) : !selectedConnectionId ? (
                <div className="px-3 py-10 text-sm text-slate-500 dark:text-slate-300">
                  Select an API connection to browse discovered schema.
                </div>
              ) : !schema ? (
                <div className="px-3 py-10 text-sm text-slate-500 dark:text-slate-300">
                  No schema has been discovered for this connection yet. Run a scan to load fields and hierarchy.
                </div>
              ) : filteredTree.length === 0 ? (
                <div className="px-3 py-10 text-sm text-slate-500 dark:text-slate-300">
                  No fields matched the current search.
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredTree.map((node) => (
                    <NodeRow
                      key={node.id}
                      node={node}
                      depth={0}
                      expanded={expanded}
                      selectedId={selectedFieldPath}
                      onToggle={toggleNode}
                      onSelect={setSelectedFieldPath}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="rounded-[2rem] p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                Field Inspector
              </p>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                {fieldDetails ? fieldDetails.display_name : "Field Details"}
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                {fieldDetails?.column_path ?? "Select a field from the schema tree to view detailed schema information."}
              </p>
            </div>
            {selectedVersion ? (
              <div className="rounded-2xl bg-white/70 px-4 py-3 text-sm font-medium text-slate-700 dark:bg-white/8 dark:text-slate-100">
                {selectedVersion.version_label}
              </div>
            ) : null}
          </div>

          {fieldLoading ? (
            <div className="mt-8 flex items-center gap-3 rounded-[1.5rem] bg-white/62 px-4 py-8 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-300">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading field details...
            </div>
          ) : fieldDetails ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Coverage", fieldDetails.coverage_percent !== null ? `${fieldDetails.coverage_percent.toFixed(2)}%` : "N/A"],
                  ["Datatype", fieldDetails.data_type],
                  ["Occurrences", formatValue(fieldDetails.occurrences)],
                  ["Example", fieldDetails.example_value ?? "N/A"],
                  ["Max Length", formatValue(fieldDetails.maximum_length)],
                  ["Unique Count", formatValue(fieldDetails.unique_count)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[1.5rem] bg-white/65 p-4 dark:bg-white/6">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
                    <p className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-50">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-[1.75rem] bg-white/65 p-5 dark:bg-white/6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-blue-50 p-3 text-primary dark:bg-blue-500/10">
                      <FileCode2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">SQL</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Column Preview</p>
                    </div>
                  </div>
                  <pre className="mt-4 overflow-x-auto rounded-[1.25rem] bg-slate-950 px-4 py-4 text-sm text-sky-100">
                    <code>{fieldDetails.sql_preview}</code>
                  </pre>
                </div>

                <div className="rounded-[1.75rem] bg-white/65 p-5 dark:bg-white/6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-blue-50 p-3 text-primary dark:bg-blue-500/10">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">XQuery</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Mapping Preview</p>
                    </div>
                  </div>
                  <pre className="mt-4 overflow-x-auto rounded-[1.25rem] bg-slate-950 px-4 py-4 text-sm text-emerald-100">
                    <code>{fieldDetails.xquery_preview || "No XQuery mapping preview for this node."}</code>
                  </pre>
                </div>
              </div>

              <Card className="rounded-[1.75rem] p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-blue-50 p-3 text-primary dark:bg-blue-500/10">
                    <Database className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">History</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">Schema evolution</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {fieldDetails.history.length === 0 ? (
                    <div className="rounded-[1.25rem] bg-white/60 px-4 py-4 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-300">
                      No recorded history for this field yet.
                    </div>
                  ) : (
                    fieldDetails.history.map((entry) => (
                      <div
                        key={`${entry.from_version_id}-${entry.to_version_id}-${entry.change_type}`}
                        className="rounded-[1.25rem] bg-white/60 px-4 py-4 dark:bg-white/5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-50">{entry.summary}</p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                              {entry.from_version_label} → {entry.to_version_label}
                            </p>
                          </div>
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:bg-blue-500/10">
                            {entry.change_type.replaceAll("_", " ")}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          ) : (
            <div className="mt-8 rounded-[1.5rem] bg-white/62 px-4 py-8 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-300">
              <p className="font-medium text-slate-900 dark:text-slate-50">
                Select a field from the schema tree to view
              </p>
              <div className="mt-3 space-y-1">
                <p>• Data Type</p>
                <p>• Path</p>
                <p>• SQL Column</p>
                <p>• XQuery Mapping</p>
                <p>• Coverage</p>
                <p>• First Seen</p>
                <p>• Last Seen</p>
                <p>• Sample Values</p>
              </div>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
