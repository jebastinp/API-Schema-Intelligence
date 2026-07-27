"use client";

import { Bell, Menu, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { DashboardNav } from "@/components/layout/dashboard-nav";
import { RouteProgress } from "@/components/layout/route-progress";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import type { NotificationRecord } from "@/lib/types";

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Overview of API Schema Intelligence",
  },
  "/connections": {
    title: "API Connections",
    subtitle: "Manage authenticated API endpoints and scan configuration",
  },
  "/scanner": {
    title: "Live Scanner",
    subtitle: "Start scans, resume from cursors, and monitor runtime throughput",
  },
  "/scan-history": {
    title: "Scan History",
    subtitle: "Review runtime outcomes and operational scan activity",
  },
  "/explorer": {
    title: "Schema Explorer",
    subtitle: "Inspect discovered fields, paths, and intelligence details",
  },
  "/compare": {
    title: "Schema Compare",
    subtitle: "Track added, removed, and changed schema fields",
  },
  "/history": {
    title: "Version History",
    subtitle: "Review schema versions and their evolution timeline",
  },
  "/field-intelligence": {
    title: "Field Intelligence",
    subtitle: "Analyze field coverage, data types, and mapping details",
  },
  "/sql-generator": {
    title: "SQL Generator",
    subtitle: "Generate create-table and migration SQL from schema versions",
  },
  "/xquery-generator": {
    title: "XQuery Generator",
    subtitle: "Generate Informatica-ready XQuery mappings from schema versions",
  },
  "/exports": {
    title: "Exports",
    subtitle: "Generate and download schema deliverables",
  },
  "/notifications": {
    title: "Notifications",
    subtitle: "Operational alerts for schema, scan, and authentication events",
  },
  "/settings": {
    title: "Settings",
    subtitle: "Configure platform preferences and scanner rules",
  },
};

function initialsFromEmail(email: string) {
  const cleaned = email.split("@")[0]?.trim() || "U";
  return cleaned.slice(0, 1).toUpperCase();
}

function displayNameFromEmail(email: string) {
  const cleaned = email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "User";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function DashboardShell({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const meta = pageMeta[pathname] ?? pageMeta["/dashboard"];
  const initials = useMemo(() => initialsFromEmail(email), [email]);
  const name = useMemo(() => displayNameFromEmail(email), [email]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isDashboard = pathname === "/dashboard";

  useEffect(() => {
    async function loadNotifications() {
      try {
        const records = await apiFetch<NotificationRecord[]>("/scanner/notifications?limit=24");
        setUnreadNotifications(records.filter((record) => !record.is_read).length);
      } catch {
        setUnreadNotifications(0);
      }
    }

    void loadNotifications();
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-[#0F172A]/35 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] border-r border-[#E5E7EB] bg-[#FFFFFF] transition-transform duration-200 lg:z-30 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <DashboardNav onNavigate={() => setMobileNavOpen(false)} />
      </aside>

      <div className="min-h-screen lg:ml-[280px]">
        <div className="min-h-screen">
          <header className="sticky top-0 z-20 border-b border-[#E5E7EB] bg-[#F8FAFC]/95 px-4 backdrop-blur-sm sm:px-5 lg:px-6">
            <RouteProgress />
            <div className="flex min-h-[72px] flex-col gap-3 py-3 lg:grid lg:h-[72px] lg:grid-cols-[minmax(220px,1fr)_minmax(280px,420px)_auto] lg:items-center lg:gap-6 lg:py-0">
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  onClick={() => setMobileNavOpen((current) => !current)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#E5E7EB] bg-white text-[#334155] lg:hidden"
                  aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
                >
                  {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>
                <div className="min-w-0">
                  <h1
                    className={`truncate font-semibold tracking-[-0.04em] text-[#111827] ${
                      isDashboard ? "text-[24px] leading-[1.05] sm:text-[28px]" : "text-[22px] leading-[1.1] sm:text-[24px]"
                    }`}
                  >
                    {meta.title}
                  </h1>
                  <p className="mt-1 truncate text-[12px] text-[#64748B] sm:text-[13px]">{meta.subtitle}</p>
                </div>
              </div>

              <div className="flex min-w-0 items-center justify-center lg:justify-center">
                <div className="relative w-full max-w-[420px]">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                  <Input
                    placeholder="Search APIs, Fields, SQL, XQuery, Versions..."
                    className="h-[44px] rounded-[14px] border-[#E5E7EB] bg-white pl-10 pr-4 text-[14px] shadow-none focus:border-[#93C5FD] focus:ring-[#DBEAFE]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                <Link
                  href="/notifications"
                  className="relative flex h-10 w-10 items-center justify-center rounded-[12px] border border-[#E5E7EB] bg-white text-[#64748B] transition hover:border-[#BFDBFE] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadNotifications > 0 ? (
                    <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-[#2563EB] px-1 text-[10px] font-semibold text-white">
                      {unreadNotifications}
                    </span>
                  ) : null}
                </Link>

                <div className="flex items-center gap-3 rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2563EB] text-[13px] font-semibold text-white">
                    {initials}
                  </div>
                  <div className="hidden text-left xl:block">
                    <p className="text-[14px] font-medium text-[#111827]">{name}</p>
                    <p className="text-[12px] text-[#64748B]">Admin</p>
                  </div>
                </div>

                <Link
                  href="/connections"
                  className="inline-flex h-[44px] min-w-[160px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[14px] bg-[#2563EB] px-4 text-[13px] font-medium text-white shadow-[0_10px_20px_-12px_rgba(37,99,235,0.5)] transition hover:bg-[#1D4ED8] sm:min-w-[182px] sm:px-5"
                >
                  <Plus className="h-4 w-4" />
                  Add API Connection
                </Link>
              </div>
            </div>
          </header>

          <main
            className={`min-h-[calc(100vh-72px)] bg-[#F8FAFC] px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6 ${
              isDashboard ? "overflow-visible" : "overflow-y-auto"
            }`}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
