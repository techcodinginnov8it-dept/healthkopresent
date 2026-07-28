"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

type DeviceStatus = {
  cameraAvailable: boolean;
  microphoneAvailable: boolean;
  permissionState: PermissionState | "unknown";
  message: string | null;
};

type PendingIceCandidate = RTCIceCandidateInit | RTCIceCandidate;

type RoomPresence = {
  role?: "doctor" | "patient";
  joinedAt?: number;
};

function getMediaErrorMessage(err: unknown) {
  if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
    return "Camera or microphone permission was blocked. Allow access in your browser, then rejoin the consultation.";
  }

  if (
    err instanceof DOMException &&
    (err.name === "NotFoundError" || err.name === "DevicesNotFoundError" || err.name === "OverconstrainedError")
  ) {
    return "Media devices were not found. Connect a camera or microphone and try again.";
  }

  return err instanceof Error
    ? err.message
    : "Failed to access camera or microphone. Please check permissions.";
}

function getInsecureContextMessage() {
  return "Camera and microphone require a secure browser context. Use localhost on this computer or open the consultation through an HTTPS tunnel on your phone.";
}

function getEmptyDeviceStatus(): DeviceStatus {
  return {
    cameraAvailable: false,
    microphoneAvailable: false,
    permissionState: "unknown",
    message: null,
  };
}

export function useWebRTC({
  roomId,
  role,
  isCameraOn,
  isMicOn,
  isActive,
  onRemoteSessionEnded,
}: {
  roomId: string;
  role: "doctor" | "patient";
  isCameraOn: boolean;
  isMicOn: boolean;
  isActive: boolean;
  onRemoteSessionEnded?: () => void;
}) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [error, setError] = useState<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraDeviceId, setCameraDeviceId] = useState("");
  const [microphoneDeviceId, setMicrophoneDeviceId] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(() => getEmptyDeviceStatus());

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const screenShareStreamRef = useRef<MediaStream | null>(null);
  const screenShareTrackRef = useRef<MediaStreamTrack | null>(null);
  const offerTimerRef = useRef<number | null>(null);
  const mediaStateRef = useRef({ isCameraOn, isMicOn });
  const onRemoteSessionEndedRef = useRef(onRemoteSessionEnded);
  const pendingIceCandidatesRef = useRef<PendingIceCandidate[]>([]);
  const roomChannelRef = useRef<RealtimeChannel | null>(null);
  const hasRemotePeerRef = useRef(false);
  const hasOfferBeenSentRef = useRef(false);
  const supabase = useRef(createClient());

  useEffect(() => {
    onRemoteSessionEndedRef.current = onRemoteSessionEnded;
  }, [onRemoteSessionEnded]);

  const refreshDevices = useCallback(async () => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      const message = getInsecureContextMessage();
      setDeviceStatus({
        cameraAvailable: false,
        microphoneAvailable: false,
        permissionState: "unknown",
        message,
      });
      return [];
    }

    if (!navigator.mediaDevices?.enumerateDevices) {
      setDeviceStatus({
        cameraAvailable: false,
        microphoneAvailable: false,
        permissionState: "unknown",
        message: "This browser cannot enumerate camera or microphone devices.",
      });
      return [];
    }

    try {
      const availableDevices = await navigator.mediaDevices.enumerateDevices();
      const cameraAvailable = availableDevices.some((device) => device.kind === "videoinput");
      const microphoneAvailable = availableDevices.some((device) => device.kind === "audioinput");
      let permissionState: DeviceStatus["permissionState"] = "unknown";

      try {
        const cameraPermission = await navigator.permissions?.query?.({ name: "camera" as PermissionName });
        const microphonePermission = await navigator.permissions?.query?.({ name: "microphone" as PermissionName });
        permissionState =
          cameraPermission?.state === "denied" || microphonePermission?.state === "denied"
            ? "denied"
            : cameraPermission?.state === "granted" || microphonePermission?.state === "granted"
              ? "granted"
              : "prompt";
      } catch {
        permissionState = "unknown";
      }

      setDevices(availableDevices);
      setDeviceStatus({
        cameraAvailable,
        microphoneAvailable,
        permissionState,
        message: null,
      });

      return availableDevices;
    } catch (err: unknown) {
      const message = getMediaErrorMessage(err);
      setDeviceStatus({
        cameraAvailable: false,
        microphoneAvailable: false,
        permissionState: "unknown",
        message,
      });
      return [];
    }
  }, []);

  const cleanup = useCallback(async () => {
    if (offerTimerRef.current) {
      window.clearTimeout(offerTimerRef.current);
      offerTimerRef.current = null;
    }

    if (roomChannelRef.current) {
      await supabase.current.removeChannel(roomChannelRef.current);
      roomChannelRef.current = null;
    }

    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach((track) => track.stop());
      screenShareStreamRef.current = null;
    }

    screenShareTrackRef.current = null;
    videoSenderRef.current = null;
    setIsScreenSharing(false);
    setScreenShareStream(null);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    remoteStreamRef.current = null;
    pendingIceCandidatesRef.current = [];
    hasRemotePeerRef.current = false;
    hasOfferBeenSentRef.current = false;

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setConnectionState("new");
  }, []);

  const replaceOutgoingVideoTrack = useCallback(async (track: MediaStreamTrack | null) => {
    const sender =
      videoSenderRef.current ||
      pcRef.current?.getSenders().find((candidate) => candidate.track?.kind === "video") ||
      null;

    if (!sender) {
      throw new Error("Video sender is not ready yet.");
    }

    videoSenderRef.current = sender;
    await sender.replaceTrack(track);
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (!screenShareStreamRef.current && !screenShareTrackRef.current) {
      return false;
    }

    const stream = screenShareStreamRef.current;
    const track = screenShareTrackRef.current;
    screenShareStreamRef.current = null;
    screenShareTrackRef.current = null;
    setIsScreenSharing(false);
    setScreenShareStream(null);

    if (stream) {
      stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
    }

    const cameraTrack = localStreamRef.current?.getVideoTracks().find((mediaTrack) => mediaTrack.readyState === "live") ?? null;

    try {
      await replaceOutgoingVideoTrack(cameraTrack);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to restore camera after screen sharing.";
      setError(message);
      return false;
    }

    if (track) {
      track.onended = null;
    }

    return true;
  }, [replaceOutgoingVideoTrack]);

  const startScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      return true;
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError(getInsecureContextMessage());
      return false;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Your browser does not support screen sharing.");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const [screenTrack] = stream.getVideoTracks();

      if (!screenTrack) {
        stream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
        setError("Screen sharing did not provide a video track.");
        return false;
      }

      screenShareStreamRef.current?.getTracks().forEach((mediaTrack) => mediaTrack.stop());
      screenShareStreamRef.current = stream;
      screenShareTrackRef.current = screenTrack;
      setScreenShareStream(stream);
      setIsScreenSharing(true);

      screenTrack.onended = () => {
        void stopScreenShare();
      };

      try {
        await replaceOutgoingVideoTrack(screenTrack);
      } catch (err: unknown) {
        await stopScreenShare();
        const message = err instanceof Error ? err.message : "Failed to switch to screen sharing.";
        setError(message);
        return false;
      }

      return true;
    } catch (err: unknown) {
      const message =
        err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
          ? "Screen sharing permission was blocked. Allow it in your browser, then try again."
          : err instanceof Error
            ? err.message
            : "Failed to start screen sharing.";
      setError(message);
      return false;
    }
  }, [isScreenSharing, replaceOutgoingVideoTrack, stopScreenShare]);

  useEffect(() => {
    window.queueMicrotask(() => {
      void refreshDevices();
    });

    if (!navigator.mediaDevices?.addEventListener) {
      return;
    }

    const handleDeviceChange = () => {
      void refreshDevices();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [refreshDevices]);

  useEffect(() => {
    mediaStateRef.current.isCameraOn = isCameraOn;
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isCameraOn;
      });
    }
  }, [isCameraOn, localStream]);

  useEffect(() => {
    mediaStateRef.current.isMicOn = isMicOn;
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMicOn;
      });
    }
  }, [isMicOn, localStream]);

  useEffect(() => {
    if (!isActive || !roomId) {
      void cleanup().then(() => setError(null));
      return;
    }

    async function getLocalMedia() {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        const message = getInsecureContextMessage();
        setError(message);
        setDeviceStatus({
          cameraAvailable: false,
          microphoneAvailable: false,
          permissionState: "unknown",
          message,
        });
        return new MediaStream();
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        const message = "This browser cannot access camera or microphone devices. Use a current browser on localhost or HTTPS.";
        setError(message);
        setDeviceStatus({
          cameraAvailable: false,
          microphoneAvailable: false,
          permissionState: "unknown",
          message,
        });
        return new MediaStream();
      }

      const buildConstraints = (includeVideo: boolean, includeAudio: boolean): MediaStreamConstraints => ({
        video: includeVideo
          ? {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: "user",
              ...(cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : {}),
            }
          : false,
        audio: includeAudio ? (microphoneDeviceId ? { deviceId: { exact: microphoneDeviceId } } : true) : false,
      });

      try {
        return await navigator.mediaDevices.getUserMedia(buildConstraints(true, true));
      } catch (err: unknown) {
        const message = getMediaErrorMessage(err);
        setError(message);

        if (
          err instanceof DOMException &&
          (err.name === "NotFoundError" || err.name === "DevicesNotFoundError" || err.name === "OverconstrainedError")
        ) {
          try {
            return await navigator.mediaDevices.getUserMedia(buildConstraints(false, true));
          } catch {
            try {
              return await navigator.mediaDevices.getUserMedia(buildConstraints(true, false));
            } catch {
              return new MediaStream();
            }
          }
        }

        return new MediaStream();
      }
    }

    async function flushIceQueue(pc: RTCPeerConnection) {
      if (!pc.remoteDescription) return;
      const queue = pendingIceCandidatesRef.current.splice(0);
      console.log(`[WebRTC] Flushing ${queue.length} queued ICE candidates`);
      for (const candidate of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn("[WebRTC] addIceCandidate error:", err);
        }
      }
    }

    async function init() {
      try {
        setError(null);

        const stream = await getLocalMedia();
        setLocalStream(stream);
        localStreamRef.current = stream;
        void refreshDevices();

        stream.getVideoTracks().forEach((track) => {
          track.enabled = mediaStateRef.current.isCameraOn;
          track.onended = () => {
            setError("Camera disconnected or stopped. Reconnect the camera or switch devices.");
            void refreshDevices();
          };
        });
        stream.getAudioTracks().forEach((track) => {
          track.enabled = mediaStateRef.current.isMicOn;
          track.onended = () => {
            setError("Microphone disconnected or stopped. Reconnect the microphone or switch devices.");
            void refreshDevices();
          };
        });

        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
          ],
          iceTransportPolicy: "all",
          bundlePolicy: "max-bundle",
          rtcpMuxPolicy: "require",
        });
        pcRef.current = pc;

        stream.getTracks().forEach((track) => {
          const sender = pc.addTrack(track, stream);
          if (track.kind === "video") {
            videoSenderRef.current = sender;
          }
        });

        pc.oniceconnectionstatechange = () => {
          const state = pc.iceConnectionState;
          console.log("[WebRTC] ICE state:", state);
          if (state === "failed") {
            console.warn("[WebRTC] ICE failed — restarting");
            void pc.restartIce();
          }
          if (state === "disconnected") {
            window.setTimeout(() => {
              if (pc.iceConnectionState === "disconnected") {
                console.warn("[WebRTC] ICE still disconnected after 3s — restarting");
                void pc.restartIce();
              }
            }, 3000);
          }
        };

        pc.ontrack = (event) => {
          console.log("[WebRTC] ontrack:", event.track.kind, "streams:", event.streams.length);
          const incoming = event.streams?.[0];
          if (incoming) {
            const fresh = new MediaStream(incoming.getTracks());
            console.log("[WebRTC] Remote tracks:", fresh.getTracks().map((t) => t.kind).join(", "));
            remoteStreamRef.current = fresh;
            setRemoteStream(fresh);
          } else {
            const existing = remoteStreamRef.current?.getTracks() ?? [];
            if (existing.some((track) => track.id === event.track.id)) return;
            const next = new MediaStream([...existing, event.track]);
            remoteStreamRef.current = next;
            setRemoteStream(next);
          }
        };

        pc.onconnectionstatechange = () => {
          console.log("[WebRTC] Connection state:", pc.connectionState);
          setConnectionState(pc.connectionState);
        };

        const makeOffer = async () => {
          if (role !== "doctor" || hasOfferBeenSentRef.current) return;
          if (pc.signalingState !== "stable") {
            console.log("[WebRTC] Cannot offer in state:", pc.signalingState);
            return;
          }

          console.log("[WebRTC] Doctor creating offer");
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          hasOfferBeenSentRef.current = true;
          void roomChannelRef.current?.send({
            type: "broadcast",
            event: "webrtc:offer",
            payload: { roomId, offer },
          });
          console.log("[WebRTC] Offer sent");
        };

        const channel = supabase.current.channel(`healthko:webrtc:${roomId}`, {
          config: {
            broadcast: { self: false },
            presence: { enabled: true, key: role },
          },
        });
        roomChannelRef.current = channel;

        channel.on("presence", { event: "sync" }, () => {
          const presenceState = channel.presenceState<RoomPresence>();
          hasRemotePeerRef.current = Object.values(presenceState).some((entries) =>
            entries.some((entry) => entry.role && entry.role !== role)
          );

          if (role === "doctor" && hasRemotePeerRef.current) {
            void makeOffer().catch((err) => console.error("[WebRTC] makeOffer error:", err));
          }
        });

        channel.on("broadcast", { event: "webrtc:offer" }, async ({ payload }: { payload: { offer: RTCSessionDescriptionInit } }) => {
          if (role === "doctor") {
            console.log("[WebRTC] Doctor ignoring offer (not the answerer)");
            return;
          }

          try {
            console.log("[WebRTC] Patient received offer (state:", pc.signalingState, ")");
            if (pc.signalingState !== "stable") {
              console.log("[WebRTC] Rolling back non-stable state before applying offer");
              try {
                await pc.setLocalDescription({ type: "rollback" });
              } catch (rbErr) {
                console.warn("[WebRTC] Rollback failed:", rbErr);
              }
            }

            await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));

            if (pc.signalingState !== "have-remote-offer") {
              console.warn("[WebRTC] Expected have-remote-offer after setRemoteDescription, got:", pc.signalingState);
              return;
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            void channel.send({
              type: "broadcast",
              event: "webrtc:answer",
              payload: { roomId, answer },
            });
            console.log("[WebRTC] Answer sent successfully");
            await flushIceQueue(pc);
          } catch (err) {
            console.error("[WebRTC] Error creating/setting answer:", err);
          }
        });

        channel.on("broadcast", { event: "webrtc:answer" }, async ({ payload }: { payload: { answer: RTCSessionDescriptionInit } }) => {
          if (role !== "doctor") return;
          try {
            if (pc.signalingState !== "have-local-offer") {
              console.log("[WebRTC] Ignoring answer in state:", pc.signalingState);
              return;
            }
            console.log("[WebRTC] Doctor received answer");
            await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
            await flushIceQueue(pc);
          } catch (err) {
            console.error("[WebRTC] Error setting answer:", err);
          }
        });

        channel.on("broadcast", { event: "webrtc:ice-candidate" }, async ({ payload }: { payload: { candidate: RTCIceCandidateInit } }) => {
          try {
            if (!pc.remoteDescription) {
              pendingIceCandidatesRef.current.push(payload.candidate);
              return;
            }
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (err) {
            console.warn("[WebRTC] addIceCandidate error:", err);
          }
        });

        channel.on("broadcast", { event: "webrtc:session-ended" }, () => {
          onRemoteSessionEndedRef.current?.();
        });

        channel.subscribe(async (status) => {
          if (status !== "SUBSCRIBED") {
            return;
          }

          const trackStatus = await channel.track({
            role,
            joinedAt: Date.now(),
          });
          console.log("[WebRTC] Joined room as", role, "track status:", trackStatus);

          const presenceState = channel.presenceState<RoomPresence>();
          hasRemotePeerRef.current = Object.values(presenceState).some((entries) =>
            entries.some((entry) => entry.role && entry.role !== role)
          );

          if (role === "doctor" && hasRemotePeerRef.current) {
            void makeOffer().catch((err) => console.error("[WebRTC] makeOffer error:", err));
          }
        });

        pc.onicecandidate = ({ candidate }) => {
          if (!candidate) return;
          void channel.send({
            type: "broadcast",
            event: "webrtc:ice-candidate",
            payload: { roomId, candidate },
          });
        };
      } catch (err: unknown) {
        console.warn("[WebRTC] Init failed:", err);
        setError(getMediaErrorMessage(err));
      }
    }

    void init();

    return () => {
      void cleanup();
    };
  }, [cameraDeviceId, cleanup, isActive, microphoneDeviceId, refreshDevices, roomId, role]);

  return {
    localStream,
    remoteStream,
    connectionState,
    error,
    isScreenSharing,
    screenShareStream,
    screenShareSupported: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia),
    devices,
    cameraDeviceId,
    microphoneDeviceId,
    deviceStatus,
    setCameraDeviceId,
    setMicrophoneDeviceId,
    refreshDevices,
    startScreenShare,
    stopScreenShare,
  };
}

