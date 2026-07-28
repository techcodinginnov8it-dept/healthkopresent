"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import type { RealtimeEvent } from "@/lib/dashboard/types";

const DASHBOARD_CHANNEL = "healthko:dashboard";

export type RealtimeConnectionState = "connected" | "reconnecting" | "offline";

function getConnectionSnapshot(): RealtimeConnectionState {
  return navigator.onLine ? "connected" : "offline";
}

export function useDashboardRealtime(onEvent?: (event: RealtimeEvent) => void) {
  const connectionState = useSyncExternalStore<RealtimeConnectionState>(
    (onStoreChange) => {
      window.addEventListener("online", onStoreChange);
      window.addEventListener("offline", onStoreChange);

      return () => {
        window.removeEventListener("online", onStoreChange);
        window.removeEventListener("offline", onStoreChange);
      };
    },
    getConnectionSnapshot,
    () => "connected"
  );
  const [reconnectState, setReconnectState] = useState<RealtimeConnectionState | null>(null);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [socketReady, setSocketReady] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onEventRef = useRef(onEvent);
  const seenEventKeysRef = useRef(new Set<string>());
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const getEventKey = useCallback((event: RealtimeEvent) => {
    if (event.type === "message:new") {
      return `message:new:${event.messageId}`;
    }

    return null;
  }, []);

  const commitEvent = useCallback(
    (event: RealtimeEvent) => {
      const key = getEventKey(event);
      if (key && seenEventKeysRef.current.has(key)) {
        return;
      }

      if (key) {
        seenEventKeysRef.current.add(key);
        if (seenEventKeysRef.current.size > 300) {
          const oldestKey = seenEventKeysRef.current.values().next().value;
          if (oldestKey) {
            seenEventKeysRef.current.delete(oldestKey);
          }
        }
      }

      setLastEvent(event);
      onEventRef.current?.(event);
    },
    [getEventKey]
  );

  useEffect(() => {
    const channel = supabase.channel(DASHBOARD_CHANNEL, {
      config: {
        broadcast: { self: false },
      },
    });
    channelRef.current = channel;

    const handleMessage = ({ payload }: { payload: RealtimeEvent }) => {
      console.log("[Realtime] Received dashboard:event", payload.type, "actorRole:", payload.actorRole);
      commitEvent(payload);
    };

    channel.on("broadcast", { event: "dashboard:event" }, handleMessage);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setReconnectState(null);
        setSocketReady(true);
        return;
      }

      if (status === "TIMED_OUT" || status === "CLOSED" || status === "CHANNEL_ERROR") {
        setReconnectState("offline");
        setSocketReady(false);
      }
    });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setSocketReady(false);
    };
  }, [commitEvent, supabase]);

  const publish = useCallback(
    (event: RealtimeEvent) => {
      console.log("[Realtime] Publishing dashboard:event", event.type, "actorRole:", event.actorRole);
      commitEvent(event);
      void channelRef.current?.send({
        type: "broadcast",
        event: "dashboard:event",
        payload: event,
      });
    },
    [commitEvent]
  );

  const simulateReconnect = useCallback(() => {
    setReconnectState("reconnecting");
    window.setTimeout(() => setReconnectState(null), 900);
  }, []);

  const joinVideoRoom = useCallback((_roomId: string, _role: "doctor" | "patient") => {
    // Video signaling now joins through the Supabase room channel in useWebRTC.
  }, []);

  const endVideoRoom = useCallback((roomId: string) => {
    const channel = supabase.channel(`healthko:webrtc:${roomId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    void channel.send({
      type: "broadcast",
      event: "webrtc:session-ended",
      payload: { roomId },
    });
  }, [supabase]);

  return {
    connectionState: reconnectState || connectionState,
    socketReady,
    lastEvent,
    publish,
    joinVideoRoom,
    endVideoRoom,
    getSocket: () => null,
    simulateReconnect,
  };
}

