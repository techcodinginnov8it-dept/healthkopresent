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

        // 2. Create peer connection with STUN + TURN fallback
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

        // 3. Create transceivers in strict deterministic order (video index 0, audio index 1)
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        const videoTransceiver = pc.addTransceiver("video", {
          direction: videoTrack ? "sendrecv" : "recvonly",
          streams: stream && stream.getTracks().length > 0 ? [stream] : [],
        });

        const audioTransceiver = pc.addTransceiver("audio", {
          direction: audioTrack ? "sendrecv" : "recvonly",
          streams: stream && stream.getTracks().length > 0 ? [stream] : [],
        });

        if (videoTrack) {
          await videoTransceiver.sender.replaceTrack(videoTrack);
        }

        if (audioTrack) {
          await audioTransceiver.sender.replaceTrack(audioTrack);
        }

        pc.oniceconnectionstatechange = () => {
          const state = pcRef.current?.iceConnectionState;
          console.log("[WebRTC] ICE connection state:", state);
          if (state === "failed") {
            console.warn("[WebRTC] ICE failed — restarting ICE");
            void pcRef.current?.restartIce();
          }
          if (state === "disconnected") {
            // Give it 3s to recover before forcing a restart
            window.setTimeout(() => {
              if (pcRef.current?.iceConnectionState === "disconnected") {
                console.warn("[WebRTC] ICE still disconnected after 3s — restarting");
                void pcRef.current.restartIce();
              }
            }, 3000);
          }
        };

        // 4. Listen for remote stream tracks
        pc.ontrack = (event) => {
          console.log("[WebRTC] ontrack fired, streams:", event.streams.length, "track:", event.track.kind);
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
            remoteStreamRef.current = event.streams[0];
            return;
          }

          const existingTracks = remoteStreamRef.current?.getTracks() || [];
          if (existingTracks.some((track) => track.id === event.track.id)) {
            return;
          }

          const nextStream = new MediaStream([...existingTracks, event.track]);
          remoteStreamRef.current = nextStream;
          setRemoteStream(nextStream);
        };

        pc.onconnectionstatechange = () => {
          if (pcRef.current) {
            const state = pcRef.current.connectionState;
            console.log("[WebRTC] Connection state:", state);
            setConnectionState(state);
          }
        };

        // 5. Signal ICE candidates to the other peer
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const activeSocket = getSocket();
            if (!activeSocket?.connected) {
              return;
            }
            console.log("[WebRTC] Sending ICE candidate");
            activeSocket.emit("webrtc:ice-candidate", { roomId, candidate: event.candidate });
          }
        };

        const createAndSendOffer = async () => {
          const currentPc = pcRef.current;
          const activeSocket = getSocket();
          if (!currentPc || currentPc.signalingState !== "stable") {
            console.log("[WebRTC] Skipping offer — state:", currentPc?.signalingState);
            return;
          }
          if (!activeSocket?.connected) {
            setError("Camera is ready. Waiting for realtime signaling to reconnect...");
            return;
          }

          console.log("[WebRTC] Doctor creating offer");
          const offer = await currentPc.createOffer();
          await currentPc.setLocalDescription(offer);
          activeSocket.emit("webrtc:offer", { roomId, offer });
          console.log("[WebRTC] Offer sent");
        };

        const scheduleDoctorOffer = (delay = 250) => {
          if (role !== "doctor") {
            return;
          }

          if (offerTimerRef.current) {
            window.clearTimeout(offerTimerRef.current);
          }

          console.log(`[WebRTC] Scheduling doctor offer in ${delay}ms`);
          offerTimerRef.current = window.setTimeout(() => {
            offerTimerRef.current = null;
            void createAndSendOffer().catch((err: unknown) => {
              console.error("[WebRTC] Error creating scheduled doctor offer:", err);
            });
          }, delay);
        };

        // 6. Setup signaling listeners
        const flushPendingIceCandidates = async () => {
          const currentPc = pcRef.current;
          if (!currentPc?.remoteDescription) {
            return;
          }

          const candidates = pendingIceCandidatesRef.current.splice(0);
          console.log(`[WebRTC] Flushing ${candidates.length} pending ICE candidates`);
          for (const candidate of candidates) {
            try {
              await currentPc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err: unknown) {
              console.error("[WebRTC] Error adding queued ICE candidate:", err);
            }
          }
        };

        // Wait until socket is actually connected before registering listeners
        const setupSignaling = (activeSocket: ReturnType<typeof getSocket>) => {
          if (!activeSocket) return;

          // Remove stale listeners from any previous run before re-adding
          activeSocket.off("webrtc:offer");
          activeSocket.off("webrtc:answer");
          activeSocket.off("webrtc:ice-candidate");
          activeSocket.off("webrtc:peer-ready");
          activeSocket.off("webrtc:peer-ready-request");
          activeSocket.off("webrtc:session-ended");

          activeSocket.on("webrtc:offer", async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
            try {
              const currentPc = pcRef.current;
              if (!currentPc) return;
              const offerCollision = currentPc.signalingState !== "stable";

              if (offerCollision && role === "doctor") {
                console.log("[WebRTC] Doctor ignoring offer collision");
                return;
              }

              if (offerCollision) {
                console.log("[WebRTC] Rolling back local description due to offer collision");
                await currentPc.setLocalDescription({ type: "rollback" });
              }

              console.log("[WebRTC] Received offer, creating answer");
              await currentPc.setRemoteDescription(new RTCSessionDescription(offer));
              const answer = await currentPc.createAnswer();
              await currentPc.setLocalDescription(answer);
              activeSocket.emit("webrtc:answer", { roomId, answer });
              console.log("[WebRTC] Answer sent");
              await flushPendingIceCandidates();
            } catch (err: unknown) {
              console.error("[WebRTC] Error setting offer / creating answer:", err);
            }
          });

          activeSocket.on("webrtc:answer", async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
            try {
              const currentPc = pcRef.current;
              if (!currentPc) return;
              if (currentPc.signalingState !== "have-local-offer") {
                console.log("[WebRTC] Ignoring answer in state:", currentPc.signalingState);
                return;
              }

              console.log("[WebRTC] Received answer, setting remote description");
              await currentPc.setRemoteDescription(new RTCSessionDescription(answer));
              await flushPendingIceCandidates();
            } catch (err: unknown) {
              console.error("[WebRTC] Error setting answer:", err);
            }
          });

          activeSocket.on("webrtc:ice-candidate", async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
            try {
              const currentPc = pcRef.current;
              if (!currentPc) return;
              if (!currentPc.remoteDescription) {
                console.log("[WebRTC] Queuing ICE candidate (no remote description yet)");
                pendingIceCandidatesRef.current.push(candidate);
                return;
              }

              await currentPc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err: unknown) {
              console.error("[WebRTC] Error adding ICE candidate:", err);
            }
          });

          activeSocket.on("webrtc:peer-ready", ({ role: peerRole }: { role: string }) => {
            console.log("[WebRTC] peer-ready from:", peerRole, "my role:", role);
            if (role !== "doctor" || peerRole !== "patient") {
              return;
            }
            scheduleDoctorOffer(500);
          });

          activeSocket.on("webrtc:peer-ready-request", () => {
            console.log("[WebRTC] Got peer-ready-request, emitting peer-ready and scheduling offer");
            activeSocket.emit("webrtc:peer-ready", { roomId, role });
            scheduleDoctorOffer(800);
          });

          activeSocket.on("webrtc:session-ended", () => {
            onRemoteSessionEndedRef.current?.();
          });

          // 7. Join the room and announce presence
          activeSocket.emit("webrtc:join-room", { roomId });
          activeSocket.emit("webrtc:peer-ready", { roomId, role });
          // Broadcast a ready-request so any already-connected peer re-announces
          activeSocket.emit("webrtc:peer-ready-request", { roomId });
          // Doctor sends the initial offer after a short delay to let the patient set up listeners
          scheduleDoctorOffer(1500);
        };

        const activeSocket = getSocket();
        if (!activeSocket) {
          setError("Camera is ready. Waiting for realtime signaling to reconnect...");
          return;
        }

        if (activeSocket.connected) {
          setupSignaling(activeSocket);
        } else {
          // Socket is not yet connected — wait for it, then set up signaling
          console.log("[WebRTC] Socket not yet connected, waiting for connect event");
          activeSocket.once("connect", () => {
            console.log("[WebRTC] Socket connected, setting up signaling");
            setupSignaling(getSocket());
          });
        }

      } catch (err: unknown) {
        console.warn("[WebRTC] Initialization failed:", err);
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
