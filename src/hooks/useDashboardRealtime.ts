"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeEvent } from "@/lib/dashboard/types";

const CHANNEL_NAME = "healthko-dashboard-realtime";

type ConnectionState = "connected" | "reconnecting" | "offline";

export function useDashboardRealtime(onEvent?: (event: RealtimeEvent) => void) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(() => {
    if (typeof navigator === "undefined") {
      return "connected";
    }

    return navigator.onLine ? "connected" : "offline";
  });
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);

  const channel = useMemo(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      return null;
    }

    return new BroadcastChannel(CHANNEL_NAME);
  }, []);

  useEffect(() => {
    const goOnline = () => setConnectionState("connected");
    const goOffline = () => setConnectionState("offline");

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!channel) {
      return;
    }

    const handleMessage = (message: MessageEvent<RealtimeEvent>) => {
      const event = message.data as RealtimeEvent;
      setLastEvent(event);
      onEvent?.(event);
    };

    channel.addEventListener("message", handleMessage);

    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
    };
  }, [channel, onEvent]);

  const publish = useCallback(
    (event: RealtimeEvent) => {
      setLastEvent(event);
      onEvent?.(event);
      channel?.postMessage(event);
    },
    [channel, onEvent]
  );

  const simulateReconnect = useCallback(() => {
    setConnectionState("reconnecting");
    window.setTimeout(() => setConnectionState("connected"), 900);
  }, []);

  return {
    connectionState,
    lastEvent,
    publish,
    simulateReconnect,
  };
}
