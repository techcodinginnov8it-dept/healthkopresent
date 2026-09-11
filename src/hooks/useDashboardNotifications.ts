"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { notificationFromRealtimeEvent } from "@/lib/dashboard/notifications";
import type { DashboardNotification, DashboardRole, RealtimeEvent } from "@/lib/dashboard/types";

function sortNotifications(notifications: DashboardNotification[]) {
  return [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function useDashboardNotifications({
  role,
  initialNotifications,
  realtimeEvent,
}: {
  role: DashboardRole;
  initialNotifications: DashboardNotification[];
  realtimeEvent: RealtimeEvent | null;
}) {
  const initialSnapshot = useMemo(
    () => sortNotifications(initialNotifications),
    [initialNotifications]
  );
  const [readAtById, setReadAtById] = useState<Record<string, string>>({});
  const [realtimeNotifications, addRealtimeNotification] = useReducer(
    (current: DashboardNotification[], notification: DashboardNotification) => {
      if (current.some((item) => item.id === notification.id)) {
        return current;
      }

      return sortNotifications([notification, ...current]).slice(0, 25);
    },
    []
  );

  useEffect(() => {
    if (!realtimeEvent) {
      return;
    }

    const notification = notificationFromRealtimeEvent(realtimeEvent, role);
    if (!notification) {
      return;
    }

    const realtimeNotification = {
      ...notification,
      id: `realtime:${notification.id}`,
      readAt: null,
    };

    addRealtimeNotification(realtimeNotification);
  }, [realtimeEvent, role]);

  const notifications = useMemo(() => {
    const seenIds = new Set<string>();
    // Also deduplicate by appointmentId+kind so the same booking never shows
    // twice (once from the initial seed and once from the realtime event).
    // Realtime notifications are sorted first so they win when there is a tie.
    const seenApptKeys = new Set<string>();

    return sortNotifications([...realtimeNotifications, ...initialSnapshot])
      .filter((item) => {
        if (seenIds.has(item.id)) return false;
        if (item.appointmentId) {
          const key = `${item.kind ?? "system"}:${item.appointmentId}`;
          if (seenApptKeys.has(key)) return false;
          seenApptKeys.add(key);
        }
        seenIds.add(item.id);
        return true;
      })
      .map((item) => ({ ...item, readAt: readAtById[item.id] || item.readAt }));
  }, [initialSnapshot, readAtById, realtimeNotifications]);
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return {
    notifications,
    unreadCount,
    markAllRead: () => {
      const readAt = new Date().toISOString();
      setReadAtById((current) => ({
        ...current,
        ...Object.fromEntries(notifications.map((item) => [item.id, item.readAt ? new Date(item.readAt).toISOString() : readAt])),
      }));
    },
  };
}
