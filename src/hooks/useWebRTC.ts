"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

type DeviceStatus = {
  cameraAvailable: boolean;
  microphoneAvailable: boolean;
  permissionState: PermissionState | "unknown";
  message: string | null;
};

type PendingIceCandidate = RTCIceCandidateInit | RTCIceCandidate;

function getMediaErrorMessage(err: unknown) {
  if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
    return "Camera or microphone permission was blocked. Allow access in your browser, then rejoin the consultation.";
  }

  if (
    err instanceof DOMException &&
    (err.name === "NotFoundError" || err.name === "DevicesNotFoundError" || err.name === "OverconstrainedError")
  ) {
    return "No matching camera or microphone was found. You can still receive the other participant's stream, or connect a device and rejoin.";
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
  getSocket,
  isCameraOn,
  isMicOn,
  isActive,
  signalingReady = true,
  onRemoteSessionEnded,
}: {
  roomId: string;
  role: "doctor" | "patient";
  getSocket: () => Socket | null;
  isCameraOn: boolean;
  isMicOn: boolean;
  isActive: boolean;
  signalingReady?: boolean;
  onRemoteSessionEnded?: () => void;
}) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraDeviceId, setCameraDeviceId] = useState("");
  const [microphoneDeviceId, setMicrophoneDeviceId] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(() => getEmptyDeviceStatus());

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const offerTimerRef = useRef<number | null>(null);
  const mediaStateRef = useRef({ isCameraOn, isMicOn });
  const onRemoteSessionEndedRef = useRef(onRemoteSessionEnded);
  const pendingIceCandidatesRef = useRef<PendingIceCandidate[]>([]);

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
        message:
          cameraAvailable || microphoneAvailable
            ? null
            : "No camera or microphone was detected. Connect a device or check browser permissions.",
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

  const cleanup = useCallback((socket?: Socket | null) => {
    if (offerTimerRef.current) {
      window.clearTimeout(offerTimerRef.current);
      offerTimerRef.current = null;
    }

    socket?.off("webrtc:offer");
    socket?.off("webrtc:answer");
    socket?.off("webrtc:ice-candidate");
    socket?.off("webrtc:peer-ready");
    socket?.off("webrtc:peer-ready-request");
    socket?.off("webrtc:session-ended");

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    remoteStreamRef.current = null;
    pendingIceCandidatesRef.current = [];

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setConnectionState("new");
  }, []);

  useEffect(() => {
    window.queueMicrotask(() => {
      void refreshDevices();
    });

    if (!navigator.mediaDevices?.addEventListener) {
      return;
    }

    const handleDeviceChange = () => {
      void refreshDevices();
      setError("Camera or microphone devices changed. Rechecking media connection...");
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [refreshDevices]);

  // Sync camera track enabled state
  useEffect(() => {
    mediaStateRef.current.isCameraOn = isCameraOn;
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isCameraOn;
      });
    }
  }, [isCameraOn, localStream]);

  // Sync microphone track enabled state
  useEffect(() => {
    mediaStateRef.current.isMicOn = isMicOn;
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMicOn;
      });
    }
  }, [isMicOn, localStream]);

  // Handle initialization and signaling lifecycle
  useEffect(() => {
    if (!isActive || !roomId) {
      window.queueMicrotask(() => {
        cleanup();
        setError(null);
      });
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

    async function init() {
      try {
        setError(null);

        // 1. Get user media when available. Missing local devices should not prevent receiving the remote stream.
        const stream = await getLocalMedia();
        setLocalStream(stream);
        localStreamRef.current = stream;
        void refreshDevices();

        // Apply current toggle state immediately
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

        // 2. Create peer connection
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

        // 3. Add local tracks using addTrack (simpler and more compatible than addTransceiver)
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // 4. ICE state monitoring
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

        // 5. Remote track handler — always create new MediaStream ref so React re-renders
        pc.ontrack = (event) => {
          console.log("[WebRTC] ontrack:", event.track.kind, "streams:", event.streams.length);
          const incoming = event.streams?.[0];
          if (incoming) {
            const fresh = new MediaStream(incoming.getTracks());
            console.log("[WebRTC] Remote tracks:", fresh.getTracks().map((t) => t.kind).join(", "));
            remoteStreamRef.current = fresh;
            setRemoteStream(fresh);
          } else {
            // No stream in SDP — manually assemble
            const existing = remoteStreamRef.current?.getTracks() ?? [];
            if (existing.some((t) => t.id === event.track.id)) return;
            const next = new MediaStream([...existing, event.track]);
            remoteStreamRef.current = next;
            setRemoteStream(next);
          }
        };

        // 6. Connection state
        pc.onconnectionstatechange = () => {
          console.log("[WebRTC] Connection state:", pc.connectionState);
          setConnectionState(pc.connectionState);
        };

        // 7. ICE candidate forwarding
        pc.onicecandidate = ({ candidate }) => {
          if (!candidate) return;
          const sock = getSocket();
          if (!sock?.connected) return;
          sock.emit("webrtc:ice-candidate", { roomId, candidate });
        };

        // ── Signaling helpers ───────────────────────────────────────────────

        const flushIceQueue = async () => {
          if (!pc.remoteDescription) return;
          const queue = pendingIceCandidatesRef.current.splice(0);
          console.log(`[WebRTC] Flushing ${queue.length} queued ICE candidates`);
          for (const c of queue) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); }
            catch (e) { console.warn("[WebRTC] addIceCandidate error:", e); }
          }
        };

        /** Doctor creates and sends an offer — called by server instruction */
        const makeOffer = async () => {
          if (role !== "doctor") return;
          const sock = getSocket();
          if (!sock?.connected) return;

          // Rollback any stale local offer before re-offering
          if (pc.signalingState === "have-local-offer") {
            console.log("[WebRTC] Rolling back stale offer before re-negotiation");
            try { await pc.setLocalDescription({ type: "rollback" }); }
            catch (e) { console.warn("[WebRTC] Rollback error:", e); }
          }
          if (pc.signalingState !== "stable") {
            console.log("[WebRTC] Cannot offer in state:", pc.signalingState);
            return;
          }

          console.log("[WebRTC] Doctor creating offer");
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sock.emit("webrtc:offer", { roomId, offer });
          console.log("[WebRTC] Offer sent");
        };

        // ── Socket signaling listeners ──────────────────────────────────────

        const setupSignaling = (sock: ReturnType<typeof getSocket>) => {
          if (!sock) return;

          // Clear any stale listeners from previous run
          sock.off("webrtc:make-offer");
          sock.off("webrtc:peer-joined");
          sock.off("webrtc:offer");
          sock.off("webrtc:answer");
          sock.off("webrtc:ice-candidate");
          sock.off("webrtc:session-ended");

          // Server tells doctor both peers are present → create offer
          sock.on("webrtc:make-offer", () => {
            console.log("[WebRTC] Received make-offer from server");
            void makeOffer().catch((e) => console.error("[WebRTC] makeOffer error:", e));
          });

          // Patient receives offer → create answer
          sock.on("webrtc:offer", async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
            if (role === "doctor") {
              console.log("[WebRTC] Doctor ignoring offer (not the answerer)");
              return;
            }
            try {
              console.log("[WebRTC] Patient received offer (state:", pc.signalingState, ")");
              // If already in have-remote-offer or have-local-offer, rollback first to allow clean re-negotiation
              if (pc.signalingState !== "stable") {
                console.log("[WebRTC] Rolling back non-stable state before applying offer");
                try {
                  await pc.setLocalDescription({ type: "rollback" });
                } catch (rbErr) {
                  console.warn("[WebRTC] Rollback failed:", rbErr);
                }
              }

              await pc.setRemoteDescription(new RTCSessionDescription(offer));

              // Verify remote description was set and we are in have-remote-offer state
              if (pc.signalingState !== "have-remote-offer") {
                console.warn("[WebRTC] Expected have-remote-offer after setRemoteDescription, got:", pc.signalingState);
                return;
              }

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              sock.emit("webrtc:answer", { roomId, answer });
              console.log("[WebRTC] Answer sent successfully");
              await flushIceQueue();
            } catch (e) {
              console.error("[WebRTC] Error creating/setting answer:", e);
            }
          });

          // Doctor receives answer → complete handshake
          sock.on("webrtc:answer", async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
            if (role !== "doctor") return;
            try {
              if (pc.signalingState !== "have-local-offer") {
                console.log("[WebRTC] Ignoring answer in state:", pc.signalingState);
                return;
              }
              console.log("[WebRTC] Doctor received answer");
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
              await flushIceQueue();
            } catch (e) {
              console.error("[WebRTC] Error setting answer:", e);
            }
          });

          // ICE candidates — queue until remote description is ready
          sock.on("webrtc:ice-candidate", async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
            try {
              if (!pc.remoteDescription) {
                pendingIceCandidatesRef.current.push(candidate);
                return;
              }
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn("[WebRTC] addIceCandidate error:", e);
            }
          });

          sock.on("webrtc:session-ended", () => {
            onRemoteSessionEndedRef.current?.();
          });

          // Join the room — server tracks role and triggers make-offer when both present
          sock.emit("webrtc:join-room", { roomId, role });
          console.log("[WebRTC] Joined room as", role);
        };

        const activeSocket = getSocket();
        if (!activeSocket) {
          setError("Camera is ready. Waiting for realtime signaling to reconnect...");
          return;
        }

        if (activeSocket.connected) {
          setupSignaling(activeSocket);
        } else {
          console.log("[WebRTC] Socket not yet connected — waiting for connect");
          activeSocket.once("connect", () => {
            console.log("[WebRTC] Socket connected — setting up signaling");
            setupSignaling(getSocket());
          });
        }

      } catch (err: unknown) {
        console.warn("[WebRTC] Init failed:", err);
        setError(getMediaErrorMessage(err));
      }
    }

    init();

    return () => {
      cleanup(getSocket());
    };
  }, [cameraDeviceId, cleanup, getSocket, isActive, microphoneDeviceId, refreshDevices, role, roomId, signalingReady]);



  return {
    localStream,
    remoteStream,
    connectionState,
    error,
    devices,
    cameraDeviceId,
    microphoneDeviceId,
    deviceStatus,
    setCameraDeviceId,
    setMicrophoneDeviceId,
    refreshDevices,
  };
}

