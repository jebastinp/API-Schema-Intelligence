"use client";

import { Bell, BellRing, LoaderCircle, MailCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { NotificationRecord } from "@/lib/types";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function NotificationsCenter() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadNotifications() {
    setLoading(true);
    setError(null);
    try {
      const loadedNotifications = await apiFetch<NotificationRecord[]>("/scanner/notifications?limit=50");
      setNotifications(loadedNotifications);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  );

  async function updateReadState(notificationId: string, isRead: boolean) {
    setUpdating(notificationId);
    setError(null);
    try {
      const updated = await apiFetch<NotificationRecord>(`/scanner/notifications/${notificationId}`, {
        method: "PUT",
        body: JSON.stringify({ is_read: isRead }),
      });
      setNotifications((current) =>
        current.map((notification) => (notification.id === notificationId ? updated : notification)),
      );
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update notification.");
    } finally {
      setUpdating(null);
    }
  }

  async function markAllRead() {
    setUpdating("all");
    setError(null);
    try {
      const updated = await apiFetch<NotificationRecord[]>("/scanner/notifications/read-all", {
        method: "POST",
      });
      const updatedMap = new Map(updated.map((notification) => [notification.id, notification]));
      setNotifications((current) =>
        current.map((notification) => updatedMap.get(notification.id) ?? notification),
      );
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to mark notifications as read.");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="liquid-card rounded-[2rem] p-7">
          <div className="relative z-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Notifications</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  Track scan warnings, failures, and operational events.
                </h3>
              </div>
              <Button variant="secondary" onClick={() => void markAllRead()} disabled={updating !== null} className="gap-2">
                {updating === "all" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
                Mark All Read
              </Button>
            </div>

            {error ? (
              <div className="mt-5 rounded-[1.5rem] border border-rose-200 bg-rose-50/80 px-4 py-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                {error}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Total Events", value: notifications.length, icon: Bell },
                { label: "Unread", value: unreadCount, icon: BellRing },
                {
                  label: "Read",
                  value: notifications.length - unreadCount,
                  icon: MailCheck,
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
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Queue Status</p>
          {loading ? (
            <div className="mt-6 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading notification queue...
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="rounded-[1.5rem] bg-white/60 p-5 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Most Recent Event</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {notifications[0]?.title ?? "No events yet"}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                  {notifications[0] ? formatDate(notifications[0].created_at) : "Notifications will appear after scan activity"}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-white/60 p-5 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Delivery State</p>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                  Notification state is persisted server-side and can be acknowledged individually or in bulk.
                </p>
              </div>
            </div>
          )}
        </Card>
      </section>

      <Card className="rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Event Stream</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Operational notifications
            </h3>
          </div>
          <Button variant="secondary" onClick={() => void loadNotifications()} className="gap-2">
            <Bell className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {notifications.length === 0 ? (
            <div className="rounded-[1.5rem] bg-white/60 px-4 py-8 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-300">
              No notifications are available yet.
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className="rounded-[1.5rem] border border-white/60 bg-white/58 px-4 py-4 dark:border-white/8 dark:bg-white/5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary dark:bg-white/10">
                        {notification.level}
                      </span>
                      <span className="text-xs uppercase tracking-[0.16em] text-muted">{notification.event_type}</span>
                    </div>
                    <p className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-50">{notification.title}</p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{notification.message}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{formatDate(notification.created_at)}</p>
                  </div>
                  <Button
                    variant={notification.is_read ? "ghost" : "secondary"}
                    onClick={() => void updateReadState(notification.id, !notification.is_read)}
                    disabled={updating === notification.id}
                    className="gap-2"
                  >
                    {updating === notification.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
                    {notification.is_read ? "Mark Unread" : "Mark Read"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
