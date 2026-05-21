"use client";

import { useCallback, useState } from "react";
import type { ChatMessage, DashboardRole, RealtimeEvent } from "@/lib/dashboard/types";
import { formatTimeNow } from "@/lib/dashboard/format";

type SessionState<TAppointment> = {
  activeAppointment: TAppointment | null;
  status: "idle" | "waiting" | "connected" | "ended";
  isCameraOn: boolean;
  isMicOn: boolean;
  messages: ChatMessage[];
};

export function useConsultationSession<TAppointment extends { id: string }>({
  role,
  publish,
}: {
  role: DashboardRole;
  publish: (event: RealtimeEvent) => void;
}) {
  const [state, setState] = useState<SessionState<TAppointment>>({
    activeAppointment: null,
    status: "idle",
    isCameraOn: true,
    isMicOn: true,
    messages: [],
  });

  const startSession = useCallback(
    (appointment: TAppointment) => {
      setState((current) => ({
        ...current,
        activeAppointment: appointment,
        status: "waiting",
        messages: [
          {
            id: `${appointment.id}-system-start`,
            sender: role,
            text:
              role === "doctor"
                ? "Clinical room opened. Waiting for patient connection."
                : "Waiting room opened. Your doctor will join shortly.",
            time: formatTimeNow(),
          },
        ],
      }));

      publish({ type: "session:joined", appointmentId: appointment.id, actorRole: role });

      window.setTimeout(() => {
        setState((current) => ({
          ...current,
          status: current.activeAppointment?.id === appointment.id ? "connected" : current.status,
        }));
      }, 900);
    },
    [publish, role]
  );

  const endSession = useCallback(() => {
    setState((current) => {
      if (current.activeAppointment) {
        publish({
          type: "session:ended",
          appointmentId: current.activeAppointment.id,
          actorRole: role,
        });
      }

      return {
        ...current,
        activeAppointment: null,
        status: "ended",
      };
    });
  }, [publish, role]);

  const toggleCamera = useCallback(() => {
    setState((current) => ({ ...current, isCameraOn: !current.isCameraOn }));
  }, []);

  const toggleMic = useCallback(() => {
    setState((current) => ({ ...current, isMicOn: !current.isMicOn }));
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      setState((current) => {
        if (!current.activeAppointment) {
          return current;
        }

        const message: ChatMessage = {
          id: `${current.activeAppointment.id}-${Date.now()}`,
          sender: role,
          text: trimmed,
          time: formatTimeNow(),
        };

        publish({
          type: "message:new",
          appointmentId: current.activeAppointment.id,
          actorRole: role,
          text: trimmed,
        });

        return {
          ...current,
          messages: [...current.messages, message],
        };
      });
    },
    [publish, role]
  );

  const receiveMessage = useCallback((event: RealtimeEvent) => {
    if (event.type !== "message:new") {
      return;
    }

    setState((current) => {
      if (!current.activeAppointment || current.activeAppointment.id !== event.appointmentId) {
        return current;
      }

      if (event.actorRole === role) {
        return current;
      }

      return {
        ...current,
        messages: [
          ...current.messages,
          {
            id: `${event.appointmentId}-${Date.now()}`,
            sender: event.actorRole,
            text: event.text,
            time: formatTimeNow(),
          },
        ],
      };
    });
  }, [role]);

  return {
    ...state,
    startSession,
    endSession,
    toggleCamera,
    toggleMic,
    sendMessage,
    receiveMessage,
  };
}
