"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChatAttachment, ChatMessage, DashboardRole, RealtimeEvent } from "@/lib/dashboard/types";
import { formatTimeNow } from "@/lib/dashboard/format";

type SessionState<TAppointment> = {
  activeAppointment: TAppointment | null;
  status: "idle" | "waiting" | "connected" | "ended";
  isCameraOn: boolean;
  isMicOn: boolean;
  isScreenSharing: boolean;
  counterpartCameraOn: boolean;
  counterpartMicOn: boolean;
  counterpartScreenSharing: boolean;
  isSpeakerReady: boolean;
  connectedAt: number | null;
  roomId: string;
  accessToken: string;
  messages: ChatMessage[];
  transcriptTurns: Array<{
    id: string;
    speaker: string;
    role: "doctor" | "patient" | "system";
    text: string;
    timestamp: string;
  }>;
};

const idleState = {
  activeAppointment: null,
  status: "idle",
  isCameraOn: true,
  isMicOn: true,
  isScreenSharing: false,
  counterpartCameraOn: true,
  counterpartMicOn: true,
  counterpartScreenSharing: false,
  isSpeakerReady: true,
  connectedAt: null,
  roomId: "",
  accessToken: "",
  messages: [],
  transcriptTurns: [],
} satisfies SessionState<{ id: string; notes?: string | null; prescription?: string | null }>;

function getInitialState<TAppointment>(persistKey?: string): SessionState<TAppointment> {
  if (!persistKey || typeof window === "undefined") {
    return idleState as SessionState<TAppointment>;
  }

  try {
    const saved = window.sessionStorage.getItem(persistKey);
    if (!saved) {
      return idleState as SessionState<TAppointment>;
    }

    const parsed = JSON.parse(saved) as Partial<SessionState<TAppointment>>;
    if (!parsed.activeAppointment || !parsed.roomId || (parsed.status !== "waiting" && parsed.status !== "connected")) {
      return idleState as SessionState<TAppointment>;
    }

    return {
      ...(idleState as SessionState<TAppointment>),
      ...parsed,
      status: parsed.status,
    };
  } catch {
    return idleState as SessionState<TAppointment>;
  }
}

export function useConsultationSession<TAppointment extends { id: string; notes?: string | null; prescription?: string | null }>({
  role,
  publish,
  persistKey,
}: {
  role: DashboardRole;
  publish: (event: RealtimeEvent) => void;
  persistKey?: string;
}) {
  const storageKey = useMemo(() => persistKey || `healthko:${role}:active-consultation`, [persistKey, role]);
  const [hasLoadedStoredState, setHasLoadedStoredState] = useState(false);
  const [state, setState] = useState<SessionState<TAppointment>>(idleState as SessionState<TAppointment>);

  useEffect(() => {
    window.queueMicrotask(() => {
      setState(getInitialState<TAppointment>(storageKey));
      setHasLoadedStoredState(true);
    });
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") {
      return;
    }

    if (!hasLoadedStoredState) {
      return;
    }

    if (!state.activeAppointment || !state.roomId || (state.status !== "waiting" && state.status !== "connected")) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

    window.sessionStorage.setItem(storageKey, JSON.stringify(state));
  }, [hasLoadedStoredState, state, storageKey]);

  const openWaitingRoom = useCallback(
    (appointment: TAppointment) => {
      setState((current) => ({
        ...current,
        activeAppointment: appointment,
        status: "waiting",
        connectedAt: null,
        isScreenSharing: false,
        counterpartScreenSharing: false,
        roomId: "",
        accessToken: "",
        messages: [
          {
            id: `${appointment.id}-waiting-room`,
            sender: role,
            kind: "system",
            text:
              role === "doctor"
                ? "Secure room is staged. Start the consultation when you are ready."
                : "Waiting room opened. Complete your device checks while the doctor starts the consultation.",
            time: formatTimeNow(),
          },
        ],
      }));
    },
    [role]
  );

  const enterAuthorizedRoom = useCallback(
    (appointment: TAppointment, roomId: string, accessToken: string, nextStatus: SessionState<TAppointment>["status"] = "connected") => {
      setState((current) => ({
        ...current,
        activeAppointment: appointment,
        status: nextStatus,
        connectedAt: nextStatus === "connected" ? Date.now() : null,
        isScreenSharing: false,
        counterpartScreenSharing: false,
        roomId,
        accessToken,
        messages: [
          ...current.messages,
          {
            id: `${appointment.id}-room-authorized-${Date.now()}`,
            sender: role,
            kind: "system",
            text: nextStatus === "waiting" ? "Secure room opened. Waiting for the patient to join." : "Secure WebRTC room access authorized.",
            time: formatTimeNow(),
          },
        ],
      }));
    },
    [role]
  );

  const endSession = useCallback((broadcast = true) => {
    const appointment = state.activeAppointment;

    if (broadcast && appointment) {
      publish({
        type: "session:ended",
        appointmentId: appointment.id,
        actorRole: role,
      });
    }

      setState((current) => {
        return {
          ...current,
          activeAppointment: null,
          status: "ended",
          connectedAt: null,
          isScreenSharing: false,
          counterpartScreenSharing: false,
          roomId: "",
          accessToken: "",
        };
    });
  }, [publish, role, state.activeAppointment]);

  const toggleCamera = useCallback(() => {
    const isCameraOn = !state.isCameraOn;
    if (state.activeAppointment) {
        publish({
          type: "media:updated",
          appointmentId: state.activeAppointment.id,
          actorRole: role,
          cameraOn: isCameraOn,
          micOn: state.isMicOn,
          screenSharing: state.isScreenSharing,
        });
      }

    setState((current) => {
      if (current.isCameraOn === isCameraOn) {
        return current;
      }

      return { ...current, isCameraOn };
    });
  }, [publish, role, state.activeAppointment, state.isCameraOn, state.isMicOn]);

  const toggleMic = useCallback(() => {
    const isMicOn = !state.isMicOn;
    if (state.activeAppointment) {
        publish({
          type: "media:updated",
          appointmentId: state.activeAppointment.id,
          actorRole: role,
          cameraOn: state.isCameraOn,
          micOn: isMicOn,
          screenSharing: state.isScreenSharing,
        });
      }

    setState((current) => {
      if (current.isMicOn === isMicOn) {
        return current;
      }

      return { ...current, isMicOn };
    });
  }, [publish, role, state.activeAppointment, state.isCameraOn, state.isMicOn]);

  const setScreenSharing = useCallback(
    (isScreenSharing: boolean) => {
      if (state.activeAppointment) {
        publish({
          type: "media:updated",
          appointmentId: state.activeAppointment.id,
          actorRole: role,
          cameraOn: state.isCameraOn,
          micOn: state.isMicOn,
          screenSharing: isScreenSharing,
        });
      }

      setState((current) => {
        if (current.isScreenSharing === isScreenSharing) {
          return current;
        }

        return { ...current, isScreenSharing };
      });
    },
    [publish, role, state.activeAppointment, state.isCameraOn, state.isMicOn]
  );

  const toggleSpeaker = useCallback(() => {
    setState((current) => ({ ...current, isSpeakerReady: !current.isSpeakerReady }));
  }, []);

  const sendMessage = useCallback(
    (text: string, attachment?: ChatAttachment) => {
      const trimmed = text.trim();
      if (!trimmed && !attachment) {
        return;
      }

      const appointment = state.activeAppointment;
      if (!appointment) {
        return;
      }

      const message: ChatMessage = {
        id: `${appointment.id}-${role}-${Date.now()}`,
        sender: role,
        kind: "user",
        text: trimmed || (attachment ? `Shared ${attachment.name}` : ""),
        time: formatTimeNow(),
        attachment,
      };

      const chatTurn = {
        id: `chat-${message.id}`,
        speaker: role === "doctor" ? "Doctor" : "Patient",
        role: role as "doctor" | "patient",
        text: message.text,
        timestamp: message.time,
      };

      publish({
        type: "message:new",
        appointmentId: appointment.id,
        actorRole: role,
        messageId: message.id,
        text: message.text,
        time: message.time,
        attachment,
      });

      setState((current) => {
        if (!current.activeAppointment || current.activeAppointment.id !== appointment.id || current.messages.some((item) => item.id === message.id)) {
          return current;
        }

        const updatedTurns = current.transcriptTurns.some((t) => t.id === chatTurn.id)
          ? current.transcriptTurns
          : [...current.transcriptTurns, chatTurn];

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`healthko:transcript:${appointment.id}`, JSON.stringify(updatedTurns));
          } catch {}
        }

        return {
          ...current,
          messages: [...current.messages, message],
          transcriptTurns: updatedTurns,
        };
      });
    },
    [publish, role, state.activeAppointment]
  );

  const addTranscriptTurn = useCallback(
    (turn: { id: string; speaker: string; role: "doctor" | "patient" | "system"; text: string; timestamp: string }) => {
      const apptId = state.activeAppointment?.id;
      if (!turn || !turn.text?.trim() || !apptId) return;

      publish({
        type: "transcript:turn",
        appointmentId: apptId,
        actorRole: role,
        turn,
      });

      setState((current) => {
        if (current.transcriptTurns.some((t) => t.id === turn.id)) return current;
        const updated = [...current.transcriptTurns, turn];
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`healthko:transcript:${apptId}`, JSON.stringify(updated));
          } catch {}
        }
        return {
          ...current,
          transcriptTurns: updated,
        };
      });
    },
    [publish, role, state.activeAppointment?.id]
  );

  const receiveRealtimeEvent = useCallback((event: RealtimeEvent | null) => {
    if (!event) {
      return;
    }

    if (
      event.type === "notification:new" ||
      event.type === "doctor:availability-updated" ||
      event.type === "doctor:status-updated" ||
      event.type === "auth:concurrent-login"
    ) {
      return;
    }

    setState((current) => {
      if (!current.activeAppointment || current.activeAppointment.id !== event.appointmentId) {
        return current;
      }

      if (event.actorRole === role) {
        return current;
      }

      if (event.type === "session:ended") {
        return {
          ...current,
          activeAppointment: null,
          status: "ended",
          roomId: "",
          accessToken: "",
          messages: [
            ...current.messages,
            {
              id: `${event.appointmentId}-ended-${Date.now()}`,
              sender: event.actorRole,
              kind: "system",
              text: "The consultation was ended.",
              time: formatTimeNow(),
            },
          ],
        };
      }

      if (event.type === "media:updated") {
        return {
          ...current,
          counterpartCameraOn: event.cameraOn,
          counterpartMicOn: event.micOn,
          counterpartScreenSharing: event.screenSharing,
        };
      }

      if (event.type === "session:joined") {
        return {
          ...current,
          status: "connected",
          connectedAt: Date.now(),
          messages: [
            ...current.messages,
            {
              id: `${event.appointmentId}-joined-${Date.now()}`,
              sender: event.actorRole,
              kind: "system",
              text: "Participant joined the live consultation room.",
              time: formatTimeNow(),
            },
          ],
        };
      }

      if (event.type === "appointment:updated") {
        return {
          ...current,
          activeAppointment: current.activeAppointment
            ? {
                ...current.activeAppointment,
                notes: event.notes !== undefined ? event.notes : current.activeAppointment.notes,
                prescription: event.prescription !== undefined ? event.prescription : current.activeAppointment.prescription,
              }
            : null,
        };
      }

      if (event.type === "transcript:turn") {
        if (!event.turn || !event.turn.text?.trim()) return current;
        if (current.transcriptTurns.some((t) => t.id === event.turn.id)) return current;
        const updated = [...current.transcriptTurns, event.turn];
        if (typeof window !== "undefined" && event.appointmentId) {
          try {
            localStorage.setItem(`healthko:transcript:${event.appointmentId}`, JSON.stringify(updated));
          } catch {}
        }
        return {
          ...current,
          transcriptTurns: updated,
        };
      }

      if (event.type !== "message:new") {
        return current;
      }

      if (current.messages.some((message) => message.id === event.messageId)) {
        return current;
      }

      const chatTurn = {
        id: `chat-${event.messageId}`,
        speaker: event.actorRole === "doctor" ? "Doctor" : "Patient",
        role: event.actorRole as "doctor" | "patient",
        text: event.text,
        timestamp: event.time,
      };
      const updatedTurns = current.transcriptTurns.some((t) => t.id === chatTurn.id)
        ? current.transcriptTurns
        : [...current.transcriptTurns, chatTurn];

      if (typeof window !== "undefined" && event.appointmentId) {
        try {
          localStorage.setItem(`healthko:transcript:${event.appointmentId}`, JSON.stringify(updatedTurns));
        } catch {}
      }

      return {
        ...current,
        messages: [
          ...current.messages,
          {
            id: event.messageId,
            sender: event.actorRole,
            kind: "user",
            text: event.text,
            time: event.time,
            attachment: event.attachment,
          },
        ],
        transcriptTurns: updatedTurns,
      };
    });
  }, [role]);

  return {
    ...state,
    startSession: openWaitingRoom,
    openWaitingRoom,
    enterAuthorizedRoom,
    endSession,
    toggleCamera,
    toggleMic,
    toggleSpeaker,
    setScreenSharing,
    sendMessage,
    addTranscriptTurn,
    receiveMessage: receiveRealtimeEvent,
    receiveRealtimeEvent,
  };
}
