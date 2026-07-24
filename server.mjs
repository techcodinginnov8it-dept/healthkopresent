import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import next from "next";
import { Server } from "socket.io";
import env from "@next/env";

env.loadEnvConfig(process.cwd());

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "::";
const port = Number.parseInt(process.env.PORT || "3000", 10);
const httpsPort = Number.parseInt(process.env.HTTPS_PORT || "", 10);
const httpsPfxPath = process.env.HTTPS_PFX_PATH;
const httpsPfxPassphrase = process.env.HTTPS_PFX_PASSPHRASE || "";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

function getLanAddresses() {
  return Object.values(networkInterfaces())
    .flatMap((networkInterface) => networkInterface ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => address.address);
}

function logReady(protocol, listenPort) {
  console.log(`> Healthko ready on ${protocol}://${hostname}:${listenPort}`);

  if (hostname === "0.0.0.0" || hostname === "::") {
    for (const address of getLanAddresses()) {
      console.log(`> LAN access: ${protocol}://${address}:${listenPort}`);
    }
  }
}

function attachSocketServer(server) {
  const io = new Server(server, {
  path: "/api/socket",
  cors: {
    origin: true,
    methods: ["GET", "POST"],
  },
});

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id} (total: ${io.engine.clientsCount})`);

    socket.on("dashboard:event", (event) => {
      console.log(`[Socket] dashboard:event from ${socket.id} type=${event?.type} actorRole=${event?.actorRole} appointmentId=${event?.appointmentId}`);
      socket.broadcast.emit("dashboard:event", event);
    });

    // ── WebRTC room membership (role-aware) ─────────────────────────────────
    // roomMembers: roomId → { doctor: socketId|null, patient: socketId|null }
    // This lets the server directly tell the doctor when BOTH peers are in the room.
    function getRoomSlot(roomId) {
      if (!io.roomMembers) io.roomMembers = new Map();
      if (!io.roomMembers.has(roomId)) io.roomMembers.set(roomId, { doctor: null, patient: null });
      return io.roomMembers.get(roomId);
    }

    socket.on("webrtc:join-room", ({ roomId, role }) => {
      if (typeof roomId !== "string" || !roomId) return;
      socket.join(roomId);
      console.log(`[Socket] ${socket.id} (${role}) joined room: ${roomId}`);

      const slot = getRoomSlot(roomId);
      if (role === "doctor" || role === "patient") {
        slot[role] = socket.id;
      }

      // Tell the doctor to make an offer as soon as both peers are present (only once per connection pair)
      const pairKey = `${slot.doctor}:${slot.patient}`;
      if (slot.doctor && slot.patient && slot.lastOfferedPair !== pairKey) {
        slot.lastOfferedPair = pairKey;
        console.log(`[Socket] Both peers in room ${roomId} — telling doctor to make offer`);
        io.to(slot.doctor).emit("webrtc:make-offer");
      }

      // Also relay a "peer-joined" event so the other side knows someone arrived
      socket.to(roomId).emit("webrtc:peer-joined", { role: role ?? "unknown" });
    });

    socket.on("webrtc:offer", ({ roomId, offer }) => {
      if (typeof roomId === "string" && roomId) {
        socket.to(roomId).emit("webrtc:offer", { offer });
      }
    });

    socket.on("webrtc:answer", ({ roomId, answer }) => {
      if (typeof roomId === "string" && roomId) {
        socket.to(roomId).emit("webrtc:answer", { answer });
      }
    });

    socket.on("webrtc:ice-candidate", ({ roomId, candidate }) => {
      if (typeof roomId === "string" && roomId) {
        socket.to(roomId).emit("webrtc:ice-candidate", { candidate });
      }
    });

    socket.on("webrtc:session-ended", ({ roomId }) => {
      if (typeof roomId === "string" && roomId) {
        socket.to(roomId).emit("webrtc:session-ended");
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} reason=${reason} (total: ${io.engine.clientsCount})`);
      // Clean up room membership so the slot can be reused on reconnect
      if (io.roomMembers) {
        for (const [, slot] of io.roomMembers.entries()) {
          if (slot.doctor === socket.id) slot.doctor = null;
          if (slot.patient === socket.id) slot.patient = null;
        }
      }
    });
  });
}

function attachNextHandler(server) {
  server.on("request", (req, res) => {
  if (req.url?.startsWith("/api/socket")) {
    return;
  }

  handle(req, res);
  });
}

const httpServer = createServer();
attachSocketServer(httpServer);
attachNextHandler(httpServer);

httpServer.listen(port, hostname, () => logReady("http", port));

if (httpsPfxPath && Number.isFinite(httpsPort)) {
  const httpsServer = createHttpsServer({
    pfx: readFileSync(httpsPfxPath),
    passphrase: httpsPfxPassphrase,
  });
  attachSocketServer(httpsServer);
  attachNextHandler(httpsServer);
  httpsServer.listen(httpsPort, hostname, () => logReady("https", httpsPort));
}
