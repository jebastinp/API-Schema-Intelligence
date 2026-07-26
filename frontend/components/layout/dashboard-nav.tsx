"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  Bell,
  Database,
  Download,
  FileBarChart2,
  FileCode2,
  FileJson2,
  GitCompareArrows,
  History,
  LayoutDashboard,
  LogOut,
  Radar,
  ScanSearch,
  Settings2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import { hasPublicSupabaseEnv } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { APIConnection, NotificationRecord, ScanDashboardJob } from "@/lib/types";
import logoFull from "@/logo/logo_custom.png";

type NavItem = {
  label: string;
  href: Route;
  icon: typeof LayoutDashboard;
  countKey?: "connections" | "running" | "notifications";
};

const navigationSections: Array<{ heading: string; items: NavItem[] }> = [
  {
    heading: "Overview",
    items: [{ label: "Overview", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    heading: "Discover & Scan",
    items: [
      { label: "API Connections", href: "/connections", icon: Database, countKey: "connections" },
      { label: "Live Scanner", href: "/scanner", icon: Radar, countKey: "running" },
      { label: "Scan History", href: "/scan-history", icon: History },
      { label: "Schema Explorer", href: "/explorer", icon: ScanSearch },
    ],
  },
  {
    heading: "Analyze",
    items: [
      { label: "Schema Compare", href: "/compare", icon: GitCompareArrows },
      { label: "Version History", href: "/history", icon: History },
      { label: "Field Intelligence", href: "/field-intelligence", icon: FileBarChart2 },
    ],
  },
  {
    heading: "Generate",
    items: [
      { label: "SQL Generator", href: "/sql-generator", icon: FileCode2 },
      { label: "XQuery Generator", href: "/xquery-generator", icon: FileJson2 },
      { label: "Exports", href: "/exports", icon: Download },
    ],
  },
  {
    heading: "Manage",
    items: [
      { label: "Notifications", href: "/notifications", icon: Bell, countKey: "notifications" },
      { label: "Settings", href: "/settings", icon: Settings2 },
    ],
  },
];

export function DashboardNav() {
  const pathname = usePathname();
  const [connections, setConnections] = useState<APIConnection[]>([]);
  const [jobs, setJobs] = useState<ScanDashboardJob[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    async function loadCounts() {
      try {
        const [loadedConnections, loadedJobs, loadedNotifications] = await Promise.all([
          apiFetch<APIConnection[]>("/connections"),
          apiFetch<ScanDashboardJob[]>("/scanner/jobs"),
          apiFetch<NotificationRecord[]>("/scanner/notifications?limit=12"),
        ]);
        setConnections(loadedConnections);
        setJobs(loadedJobs);
        setNotifications(loadedNotifications);
      } catch {
        // Keep sidebar counts best-effort only.
      }
    }

    void loadCounts();
  }, []);

  const counts = useMemo(
    () => ({
      connections: connections.length,
      running: jobs.filter((job) => job.status === "running" || job.status === "queued").length,
      notifications: notifications.filter((notification) => !notification.is_read).length,
    }),
    [connections, jobs, notifications],
  );

  async function handleSignOut() {
    setSigningOut(true);
    const redirectNow = () => {
      window.location.replace("/login");
    };

    if (!hasPublicSupabaseEnv()) {
      redirectNow();
      return;
    }

    const supabase = createSupabaseBrowserClient();

    void Promise.race([
      supabase.auth.signOut(),
      new Promise((resolve) => window.setTimeout(resolve, 250)),
    ]).finally(() => {
      redirectNow();
    });
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex h-[92px] shrink-0 items-center justify-start border-b border-[#E5E7EB] bg-white px-5">
        <div className="h-[68px] w-[236px] shrink-0 overflow-hidden">
          <img
            src={logoFull.src}
            alt="Schema Studio"
            width={236}
            height={68}
            className="block h-full w-full object-cover object-left"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-between px-3 pb-4">
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-4 pt-4">
            {navigationSections.map((section, index) => (
              <div key={section.heading} className={index === 0 ? "" : "border-t border-[#F1F5F9] pt-4"}>
                <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                  {section.heading}
                </p>
                <nav className="mt-1.5 space-y-1">
                  {section.items.map(({ label, href, icon: Icon, countKey }) => {
                    const active = pathname === href;
                    const count = countKey ? counts[countKey] : null;

                    return (
                      <Link
                        key={label}
                        href={href}
                        className={`flex items-center justify-between rounded-[12px] px-3 py-2 text-[13px] font-medium transition ${
                          active
                            ? "border border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_10px_20px_-18px_rgba(37,99,235,0.55)]"
                            : "border border-transparent text-[#334155] hover:border-[#E5E7EB] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className={`h-[15px] w-[15px] ${active ? "text-[#2563EB]" : "text-[#64748B]"}`} />
                          {label}
                        </span>
                        {typeof count === "number" && count > 0 ? (
                          <span className="rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-semibold text-[#64748B]">
                            {count}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </div>
        <div className="shrink-0 border-t border-[#F1F5F9] pt-3">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-[13px] font-medium text-[#334155] transition hover:border-[#E5E7EB] hover:bg-[#F8FAFC] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-[15px] w-[15px] text-[#64748B]" />
            {signingOut ? "Signing Out..." : "Sign Out"}
          </button>
        </div>
      </div>
    </div>
  );
}
