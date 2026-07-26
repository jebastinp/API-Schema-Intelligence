"use client";

import {
  CheckCircle2,
  CirclePause,
  Clock3,
  Database,
  FileCode2,
  GitCompareArrows,
  LoaderCircle,
  Play,
  ScanLine,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { apiFetch, getAccessToken } from "@/lib/api";
import type {
  APIConnection,
  ExportRecord,
  NotificationRecord,
  ScanDashboardJob,
  ScanHistory,
} from "@/lib/types";

type ScanSocketEvent =
  | { type: "snapshot"; jobs: ScanDashboardJob[] }
  | { type: "job_update"; job: ScanDashboardJob }
  | { type: "notification"; notification: NotificationRecord };

type RangeOption = 7 | 30 | 90;

type MetricCard = {
  label: string;
  value: string;
  detail: string;
  icon: typeof Database;
  tone: "blue" | "green" | "amber" | "red";
};

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: "success" | "warning" | "danger" | "info";
};

function formatNumber(value: number | null | undefined) {
  return (value ?? 0).toLocaleString();
}

function formatCompactNumber(value: number | null | undefined) {
  const number = value ?? 0;
  if (number >= 1_000_000) {
    return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1)}M`;
  }
  if (number >= 1_000) {
    return `${(number / 1_000).toFixed(number >= 10_000 ? 0 : 1)}K`;
  }
  return number.toLocaleString();
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Never";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatEta(seconds: number | null) {
  if (!seconds || seconds <= 0) {
    return "--";
  }
  return formatDuration(seconds);
}

function currentScanStatus(job: ScanDashboardJob) {
  return job.metadata.scan_status ?? job.status;
}

function websocketUrl(baseUrl: string, token: string) {
  const url = new URL(`${baseUrl}/api/scanner/ws`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  return url.toString();
}

function progressFromJob(job: ScanDashboardJob) {
  if (job.status === "completed") {
    return 100;
  }
  if (job.status === "queued") {
    return 0;
  }
  const speed = job.speed_records_per_second ?? 0;
  const eta = job.estimated_seconds_remaining ?? 0;
  const remaining = speed > 0 && eta > 0 ? speed * eta : 0;
  const total = job.records_scanned + remaining;
  if (total <= 0) {
    return 8;
  }
  return Math.max(4, Math.min(99, Math.round((job.records_scanned / total) * 100)));
}

function buildSeries(history: ScanHistory[], range: RangeOption) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - (range - 1));
  const bucketSize = Math.max(1, Math.ceil(range / 7));

  const buckets = Array.from({ length: 7 }, (_, index) => {
    const bucketStart = new Date(start);
    bucketStart.setDate(start.getDate() + index * bucketSize);
    const bucketEnd = new Date(bucketStart);
    bucketEnd.setDate(bucketStart.getDate() + bucketSize);
    return {
      label:
        range === 7
          ? bucketStart.toLocaleDateString(undefined, { weekday: "short" })
          : bucketStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      added: 0,
      removed: 0,
      modified: 0,
      bucketStart,
      bucketEnd,
    };
  });

  for (const item of history) {
    if (!item.completed_at) {
      continue;
    }
    const completedAt = new Date(item.completed_at);
    const bucket = buckets.find((entry) => completedAt >= entry.bucketStart && completedAt < entry.bucketEnd);
    if (!bucket) {
      continue;
    }
    bucket.added += Number(item.change_summary.added_columns ?? 0);
    bucket.removed += Number(item.change_summary.removed_columns ?? 0);
    bucket.modified +=
      Number(item.change_summary.datatype_changes ?? 0) +
      Number(item.change_summary.coverage_changes ?? 0);
  }

  return buckets;
}

function polyline(values: number[], width: number, height: number, maxValue: number) {
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - (value / Math.max(1, maxValue)) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

function metricTone(tone: MetricCard["tone"]) {
  if (tone === "green") {
    return "bg-[#ECFDF5] text-[#16A34A]";
  }
  if (tone === "amber") {
    return "bg-[#FFFBEB] text-[#D97706]";
  }
  if (tone === "red") {
    return "bg-[#FEF2F2] text-[#DC2626]";
  }
  return "bg-[#EFF6FF] text-[#2563EB]";
}

function activityTone(tone: ActivityItem["tone"]) {
  if (tone === "success") {
    return "border-[#BBF7D0] bg-[#ECFDF5] text-[#16A34A]";
  }
  if (tone === "warning") {
    return "border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]";
  }
  if (tone === "danger") {
    return "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]";
  }
  return "border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]";
}

function statusTone(status: string) {
  if (status === "completed") {
    return "bg-[#ECFDF5] text-[#16A34A]";
  }
  if (status === "running") {
    return "bg-[#EFF6FF] text-[#2563EB]";
  }
  if (status === "queued") {
    return "bg-[#F5F3FF] text-[#7C3AED]";
  }
  if (status === "failed") {
    return "bg-[#FEF2F2] text-[#DC2626]";
  }
  return "bg-[#F3F4F6] text-[#475569]";
}

function Chart({
  history,
  range,
  onRangeChange,
}: {
  history: ScanHistory[];
  range: RangeOption;
  onRangeChange: (value: RangeOption) => void;
}) {
  const series = useMemo(() => buildSeries(history, range), [history, range]);
  const maxValue = Math.max(10, ...series.flatMap((item) => [item.added, item.removed, item.modified]));
  const width = 480;
  const height = 180;
  const added = polyline(series.map((item) => item.added), width, height, maxValue);
  const removed = polyline(series.map((item) => item.removed), width, height, maxValue);
  const modified = polyline(series.map((item) => item.modified), width, height, maxValue);

  return (
    <Card className="grid min-h-[420px] grid-rows-[auto_auto_minmax(220px,1fr)_auto] rounded-[20px] p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EFF6FF] text-[#2563EB]">
            <GitCompareArrows className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-[#111827]">Schema Graph</h3>
            <p className="mt-1 text-[12px] text-[#64748B]">Added, removed, modified</p>
          </div>
        </div>
        <div className="inline-flex rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] p-1">
          {[7, 30, 90].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onRangeChange(value as RangeOption)}
              className={`rounded-[10px] px-3 py-1.5 text-[12px] font-medium ${
                range === value ? "bg-white text-[#2563EB] shadow-sm" : "text-[#64748B]"
              }`}
            >
              {value}D
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-[#64748B]">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
          Added
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
          Removed
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
          Modified
        </span>
      </div>

      <div className="mt-4 grid min-h-0 grid-cols-[28px_minmax(0,1fr)] gap-3">
        <div className="flex h-[200px] flex-col justify-between text-[11px] text-[#94A3B8]">
          {[maxValue, Math.round(maxValue * 0.66), Math.round(maxValue * 0.33), 0].map((value) => (
            <span key={value}>{value}</span>
          ))}
        </div>
        <div className="relative min-h-0">
          {[0, 0.33, 0.66, 1].map((ratio) => (
            <div
              key={ratio}
              className="absolute inset-x-0 border-t border-[#EEF2F7]"
              style={{ top: `${ratio * 180}px` }}
            />
          ))}
          <svg viewBox={`0 0 ${width} ${height}`} className="relative h-[200px] w-full overflow-visible">
            <polyline fill="none" stroke="#16A34A" strokeWidth="2.5" points={added} strokeLinecap="round" />
            <polyline fill="none" stroke="#DC2626" strokeWidth="2.5" points={removed} strokeLinecap="round" />
            <polyline fill="none" stroke="#2563EB" strokeWidth="2.5" points={modified} strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-7 text-[12px] text-[#94A3B8]">
        {series.map((item) => (
          <span key={item.label} className="text-center">
            {item.label}
          </span>
        ))}
      </div>
    </Card>
  );
}

export function LiveDashboard() {
  const [jobs, setJobs] = useState<ScanDashboardJob[]>([]);
  const [connections, setConnections] = useState<APIConnection[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeOption>(7);
  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<number | null>(null);

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      setError(null);
      const requests = [
        apiFetch<ScanDashboardJob[]>("/scanner/jobs")
          .then((loadedJobs) => setJobs(loadedJobs))
          .catch((loadError) => {
            throw loadError instanceof Error ? loadError : new Error("Failed to load scanner jobs.");
          }),
        apiFetch<APIConnection[]>("/connections")
          .then((loadedConnections) => setConnections(loadedConnections))
          .catch((loadError) => {
            throw loadError instanceof Error ? loadError : new Error("Failed to load API connections.");
          }),
        apiFetch<NotificationRecord[]>("/scanner/notifications?limit=24").then((loadedNotifications) =>
          setNotifications(loadedNotifications),
        ),
        apiFetch<ScanHistory[]>("/scanner/history?limit=40").then((loadedHistory) => setHistory(loadedHistory)),
        apiFetch<ExportRecord[]>("/scanner/exports?limit=12").then((loadedExports) => setExports(loadedExports)),
      ];

      const results = await Promise.allSettled(requests);
      const firstError = results.find((result) => result.status === "rejected");
      if (firstError?.status === "rejected") {
        setError(firstError.reason instanceof Error ? firstError.reason.message : "Failed to load dashboard.");
      }
      setLoading(false);
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    const resolvedApiBaseUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      (typeof window !== "undefined" ? window.location.origin : null);
    if (!resolvedApiBaseUrl) {
      setSocketStatus("disconnected");
      return;
    }
    const apiBaseUrl: string = resolvedApiBaseUrl;

    let active = true;

    async function connect() {
      try {
        setSocketStatus("connecting");
        const accessToken = await getAccessToken();

        if (!accessToken) {
          if (active) {
            setSocketStatus("disconnected");
          }
          return;
        }

        const socket = new WebSocket(websocketUrl(apiBaseUrl, accessToken));
        socketRef.current = socket;

        socket.onopen = () => {
          if (!active) {
            socket.close();
            return;
          }
          setSocketStatus("connected");
          heartbeatRef.current = window.setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send("ping");
            }
          }, 20000);
        };

        socket.onmessage = (event) => {
          const payload = JSON.parse(event.data) as ScanSocketEvent;
          setJobs((current) => {
            if (payload.type === "snapshot") {
              return payload.jobs;
            }
            if (payload.type !== "job_update") {
              return current;
            }
            const next = new Map(current.map((job) => [job.id, job]));
            next.set(payload.job.id, payload.job);
            return Array.from(next.values());
          });

          if (payload.type === "notification") {
            setNotifications((current) =>
              [payload.notification, ...current.filter((item) => item.id !== payload.notification.id)].slice(0, 24),
            );
          }
        };

        socket.onerror = () => {
          if (active) {
            setSocketStatus("disconnected");
          }
        };

        socket.onclose = () => {
          if (heartbeatRef.current) {
            window.clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
          }
          if (active) {
            setSocketStatus("disconnected");
          }
        };
      } catch (connectionError) {
        if (active) {
          setSocketStatus("disconnected");
          setError(
            connectionError instanceof Error
              ? connectionError.message
              : "Failed to connect to the live scanner stream.",
          );
        }
      }
    }

    void connect();

    return () => {
      active = false;
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      socketRef.current?.close();
    };
  }, []);

  const connectionMap = useMemo(
    () => new Map(connections.map((connection) => [connection.id, connection])),
    [connections],
  );

  const liveJobs = useMemo(
    () =>
      [...jobs]
        .sort((left, right) => {
          const rank = (job: ScanDashboardJob) =>
            job.status === "running" ? 0 : job.status === "queued" ? 1 : job.status === "failed" ? 2 : 3;
          return rank(left) - rank(right);
        })
        .slice(0, 8),
    [jobs],
  );

  const schemaVersions = useMemo(
    () =>
      history.reduce((set, item) => {
        if (item.schema_version_id) {
          set.add(item.schema_version_id);
        }
        return set;
      }, new Set<string>()).size,
    [history],
  );

  const totalColumns = useMemo(
    () => history.reduce((max, item) => Math.max(max, item.columns_found), 0),
    [history],
  );

  const totalSchemaChanges = useMemo(
    () =>
      history.reduce(
        (sum, item) =>
          sum +
          Number(item.change_summary.added_columns ?? 0) +
          Number(item.change_summary.removed_columns ?? 0) +
          Number(item.change_summary.datatype_changes ?? 0) +
          Number(item.change_summary.coverage_changes ?? 0),
        0,
      ),
    [history],
  );

  const sqlExports = exports.filter((item) => item.export_type === "sql");

  const metricCards: MetricCard[] = [
    {
      label: "Connected APIs",
      value: String(connections.length),
      detail: "Authenticated endpoints",
      icon: Database,
      tone: "blue",
    },
    {
      label: "Running Scans",
      value: String(jobs.filter((job) => job.status === "running" || job.status === "queued").length),
      detail: `${jobs.filter((job) => job.status === "queued").length} queued`,
      icon: ScanLine,
      tone: "green",
    },
    {
      label: "Columns",
      value: formatCompactNumber(totalColumns),
      detail: "Highest discovered count",
      icon: Sparkles,
      tone: "blue",
    },
    {
      label: "Schema Versions",
      value: String(schemaVersions),
      detail: "Persisted versions",
      icon: GitCompareArrows,
      tone: "blue",
    },
    {
      label: "Schema Changes",
      value: String(totalSchemaChanges),
      detail: "Added, removed, modified",
      icon: TriangleAlert,
      tone: "amber",
    },
    {
      label: "Generated SQL",
      value: String(sqlExports.length),
      detail: "Exported SQL artifacts",
      icon: FileCode2,
      tone: "blue",
    },
  ];

  const recentScans = useMemo(
    () =>
      history
        .filter((item) => item.completed_at)
        .sort((left, right) => new Date(right.completed_at ?? right.started_at).getTime() - new Date(left.completed_at ?? left.started_at).getTime())
        .slice(0, 10),
    [history],
  );

  const recentChanges = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [
      ...notifications.map((item): ActivityItem => ({
        id: item.id,
        title:
          item.event_type === "new_column"
            ? "Added"
            : item.event_type === "removed_column"
              ? "Removed"
              : item.event_type === "datatype_changed"
                ? "Modified"
                : item.event_type === "authentication_expired" || item.event_type === "api_failed"
                  ? "Authentication Failed"
                  : "Schema Event",
        detail:
          typeof item.metadata_json.connection_name === "string"
            ? item.metadata_json.connection_name
            : item.message,
        time: item.created_at,
        tone:
          item.event_type === "authentication_expired" || item.event_type === "api_failed"
            ? "danger"
            : item.event_type === "datatype_changed"
              ? "warning"
              : item.event_type === "removed_column"
                ? "danger"
                : "success",
      })),
      ...exports
        .filter((item) => item.export_type === "sql")
        .map((item): ActivityItem => ({
          id: `sql-${item.id}`,
          title: "Generated SQL",
          detail: String(item.metadata_json.file_name ?? "SQL artifact"),
          time: item.created_at,
          tone: "info",
        })),
    ];

    return items
      .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
      .slice(0, 10);
  }, [exports, notifications]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3 2xl:grid-cols-6">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="flex min-h-[164px] flex-col rounded-[20px] p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-[#64748B]">{card.label}</p>
                </div>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${metricTone(card.tone)}`}>
                  <Icon className="h-4.5 w-4.5" />
                </span>
              </div>
              <div className="flex-1 py-4">
                <p className="text-[32px] font-semibold leading-none tracking-[-0.05em] text-[#111827]">
                  {card.value}
                </p>
              </div>
              <p className="text-[12px] text-[#64748B]">{card.detail}</p>
            </Card>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[2fr_1.2fr]">
        <Card className="grid min-h-[420px] grid-rows-[auto_auto_minmax(160px,1fr)] rounded-[20px] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EFF6FF] text-[#2563EB]">
                <ScanLine className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-[15px] font-semibold text-[#111827]">Live Scanner</h3>
                <p className="mt-1 text-[12px] text-[#64748B]">Current API runtime status</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] px-3 py-1.5 text-[12px] font-medium text-[#64748B]">
                <span
                  className={`h-2 w-2 rounded-full ${
                    socketStatus === "connected"
                      ? "bg-[#16A34A]"
                      : socketStatus === "connecting"
                        ? "bg-[#F59E0B]"
                        : "bg-[#DC2626]"
                  }`}
                />
                {socketStatus === "connected" ? "Scanner Active" : socketStatus === "connecting" ? "Connecting" : "Disconnected"}
              </span>
              <Link
                href="/scanner"
                className="inline-flex h-9 items-center rounded-[10px] border border-[#E5E7EB] px-3 text-[12px] font-medium text-[#2563EB] hover:bg-[#F8FAFC]"
              >
                View Scan
              </Link>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[1.25fr_0.7fr_0.7fr_0.9fr_0.8fr_0.7fr_0.65fr_0.65fr_0.55fr] gap-3 border-y border-[#EEF2F7] py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
            <span>API</span>
            <span>Status</span>
            <span>Progress</span>
            <span>Page</span>
            <span>Cursor</span>
            <span>Records</span>
            <span>Speed</span>
            <span>ETA</span>
            <span>Action</span>
          </div>

          <div className="min-h-0 overflow-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center text-[14px] text-[#64748B]">
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Loading scanner state...
              </div>
            ) : liveJobs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[14px] text-[#64748B]">
                No scans have been executed yet.
              </div>
            ) : (
              <div className="divide-y divide-[#F1F5F9]">
                {liveJobs.map((job) => {
                  const progress = progressFromJob(job);
                  return (
                    <div
                      key={job.id}
                      className="grid grid-cols-[1.25fr_0.7fr_0.7fr_0.9fr_0.8fr_0.7fr_0.65fr_0.65fr_0.55fr] gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-[#111827]">
                          {job.connection_name ?? connectionMap.get(job.api_connection_id)?.name ?? "API connection"}
                        </p>
                        <p className="truncate text-[12px] text-[#64748B]">
                          {connectionMap.get(job.api_connection_id)?.base_url ?? job.current_api ?? "Unavailable"}
                        </p>
                      </div>
                      <div className="flex min-w-0 flex-col justify-center">
                        <span className={`w-fit rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone(job.status)}`}>
                          {job.status}
                        </span>
                        <span className="mt-1 truncate text-[12px] text-[#64748B]">{currentScanStatus(job)}</span>
                      </div>
                      <div className="pt-1">
                        <div className="mb-1 text-[12px] text-[#475569]">{progress}%</div>
                        <div className="h-1.5 rounded-full bg-[#E2E8F0]">
                          <div className="h-1.5 rounded-full bg-[#2563EB]" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <div className="flex min-w-0 flex-col justify-center text-[13px] text-[#475569]">
                        <span>Page {formatNumber(job.current_page)}</span>
                        <span className="text-[12px] text-[#94A3B8]">
                          {formatNumber(job.metadata.pages_scanned ?? job.current_page)} scanned
                        </span>
                      </div>
                      <div className="flex items-center text-[13px] text-[#475569]">
                        <span className="truncate">{job.current_cursor ? `${job.current_cursor.slice(0, 10)}...` : "--"}</span>
                      </div>
                      <div className="flex min-w-0 flex-col justify-center text-[13px] text-[#111827]">
                        <span>{formatCompactNumber(job.records_scanned)}</span>
                        <span className="text-[12px] text-[#94A3B8]">
                          {formatCompactNumber(job.metadata.discovered_columns ?? job.columns_found)} columns
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col justify-center text-[13px] text-[#475569]">
                        <span>{job.speed_records_per_second ? `${Math.round(job.speed_records_per_second)}/s` : "--"}</span>
                        <span className="text-[12px] text-[#94A3B8]">
                          +{formatNumber(job.metadata.new_columns_discovered ?? job.new_columns_discovered)} / -
                          {formatNumber(job.metadata.removed_columns ?? job.removed_columns)}
                        </span>
                      </div>
                      <div className="flex items-center text-[13px] text-[#475569]">{formatEta(job.estimated_seconds_remaining)}</div>
                      <div className="flex items-center">
                        <button
                          type="button"
                          disabled
                          title="Pause and resume require a backend runtime endpoint."
                          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#E5E7EB] text-[#64748B] opacity-60"
                        >
                          {job.status === "running" ? <CirclePause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Chart history={history} range={range} onRangeChange={setRange} />
      </section>

      <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[2fr_1.2fr]">
        <Card className="grid min-h-[320px] grid-rows-[auto_minmax(160px,1fr)] rounded-[20px] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EFF6FF] text-[#2563EB]">
                <Clock3 className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-[15px] font-semibold text-[#111827]">Recent Scans</h3>
                <p className="mt-1 text-[12px] text-[#64748B]">Completed scan executions</p>
              </div>
            </div>
            <Link href="/scan-history" className="text-[12px] font-medium text-[#2563EB]">
              View all
            </Link>
          </div>

          <div className="mt-4 min-h-0 overflow-auto">
            {recentScans.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[14px] text-[#64748B]">
                No recent scans.
              </div>
            ) : (
              <div className="space-y-3">
                {recentScans.map((item) => (
                  <div key={item.id} className="rounded-[12px] border border-[#EEF2F7] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-[14px] font-semibold text-[#111827]">
                        {connectionMap.get(item.api_connection_id)?.name ?? "API connection"}
                      </p>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-3 text-[12px] text-[#64748B]">
                      <span>{formatCompactNumber(item.records_scanned)} records</span>
                      <span>{formatCompactNumber(item.columns_found)} columns</span>
                      <span>{item.schema_version_id ? "Versioned" : "Not versioned"}</span>
                      <span className="text-right">{formatDateTime(item.completed_at ?? item.started_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="grid min-h-[320px] grid-rows-[auto_minmax(160px,1fr)] rounded-[20px] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EFF6FF] text-[#2563EB]">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-[15px] font-semibold text-[#111827]">Recent Changes</h3>
                <p className="mt-1 text-[12px] text-[#64748B]">Schema alerts and SQL generation</p>
              </div>
            </div>
            <Link href="/notifications" className="text-[12px] font-medium text-[#2563EB]">
              View all
            </Link>
          </div>

          <div className="mt-4 min-h-0 overflow-auto pr-1">
            {recentChanges.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[14px] text-[#64748B]">
                No recent changes.
              </div>
            ) : (
              <div className="space-y-3">
                {recentChanges.map((item) => (
                  <div key={item.id} className="grid grid-cols-[40px_minmax(0,1fr)_64px] gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] border ${activityTone(item.tone)}`}>
                      {item.tone === "success" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : item.tone === "danger" ? (
                        <TriangleAlert className="h-4 w-4" />
                      ) : item.tone === "warning" ? (
                        <TriangleAlert className="h-4 w-4" />
                      ) : (
                        <FileCode2 className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-[#111827]">{item.title}</p>
                      <p className="truncate text-[12px] text-[#64748B]">{item.detail}</p>
                    </div>
                    <div className="pt-1 text-right text-[12px] text-[#94A3B8]">{formatTime(item.time)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </section>

      {error ? (
        <div className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13px] text-[#B91C1C]">
          {error}
        </div>
      ) : null}
    </div>
  );
}
