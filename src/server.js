/**
 * server.js
 * Main entry point - Express + Socket.io Server
 *
 * MULTI-TENANT ARCHITECTURE:
 * - Each streamer = 1 isolated Socket.io Room
 * - Room ID = TikTok username
 * - Data isolation: Streamer A cannot see Streamer B's data
 *
 * @module server
 */

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdir, writeFile } from "fs/promises";
import ytdl from "@distube/ytdl-core";
import tiktokService from "./services/TikTokService.js";
import { attachSanNhayWs } from "./services/sanNhayWs.js";

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ==========================================
// SERVER INITIALIZATION
// ==========================================
const app = express();
const server = createServer(app);

// Socket.io with CORS enabled for development
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

// ==========================================
// SÀN NHẢY LIVE — YouTube streaming proxy
// In-memory map: `kind:key` → ytUrl (cleared on restart)
// Virtual files: /games/san-nhay/assets/audio/_yt_<key>.webm
//                /games/san-nhay/assets/video/_yt_<key>.mp4
// Route MUST be registered before express.static
// ==========================================

const ytStreamMap = new Map();

function ytKey(url) {
  return Buffer.from(url).toString("base64url").slice(0, 20);
}

app.get(
  "/games/san-nhay/assets/:kind(audio|video)/:filename",
  async (req, res, next) => {
    const { kind, filename } = req.params;
    if (!filename.startsWith("_yt_")) return next();

    const key = filename.replace(/^_yt_/, "").replace(/\.[^.]+$/, "");
    const ytUrl = ytStreamMap.get(`${kind}:${key}`);
    if (!ytUrl) return res.status(404).json({ error: "Stream not registered — prepare first" });

    try {
      const info = await ytdl.getInfo(ytUrl);
      let fmt;
      if (kind === "audio") {
        fmt = ytdl.chooseFormat(info.formats, { filter: "audioonly", quality: "highestaudio" });
      } else {
        try {
          fmt = ytdl.chooseFormat(info.formats, {
            filter: (f) => f.container === "mp4" && f.hasVideo && f.hasAudio,
            quality: "highest",
          });
        } catch {
          fmt = ytdl.chooseFormat(info.formats, {
            filter: (f) => f.hasVideo && f.hasAudio,
            quality: "highest",
          });
        }
      }

      res.setHeader("Content-Type", fmt.mimeType?.split(";")[0] || (kind === "audio" ? "audio/webm" : "video/mp4"));
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Accept-Ranges", "none");

      const stream = ytdl.downloadFromInfo(info, { format: fmt });
      stream.pipe(res);
      req.on("close", () => stream.destroy());
    } catch (err) {
      console.error("[SanNhay] yt-stream error:", err.message);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  }
);

// ==========================================
// MIDDLEWARE & STATIC FILES
// ==========================================

// Serve static files from public directory
app.use(express.static(join(__dirname, "../public")));

// Parse JSON body
app.use(express.json());

// ==========================================
// API ROUTES
// ==========================================

/**
 * Health check endpoint
 * @route GET /api/health
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    stats: tiktokService.getStats(),
  });
});

/**
 * Get connection statistics
 * @route GET /api/stats
 */
app.get("/api/stats", (req, res) => {
  res.json(tiktokService.getStats());
});

// ==========================================
// SOCKET.IO - REALTIME CONNECTION HANDLING
// ==========================================

io.on("connection", (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  /**
   * JOIN ROOM HANDLER
   *
   * IMPORTANT - DATA ISOLATION:
   * - Each client joins a room based on streamer's username
   * - Client only receives events from their subscribed streamer
   * - Ensures data isolation between different streamers
   */
  socket.on("join-room", async (username) => {
    // Validate username
    if (!username || typeof username !== "string") {
      socket.emit("error", { message: "Invalid username" });
      return;
    }

    // Normalize username (lowercase, trimmed)
    const normalizedUsername = username.toLowerCase().trim();

    // Store username in socket instance for disconnect handling
    socket.tiktokUsername = normalizedUsername;

    // Join Socket.io room
    socket.join(normalizedUsername);
    console.log(`[Socket] ${socket.id} joined room: ${normalizedUsername}`);

    // Update room client tracking
    tiktokService.addClientToRoom(normalizedUsername);

    // Connect to TikTok Live (reuses existing connection if available)
    try {
      const connected = await tiktokService.connect(normalizedUsername, io);
      if (connected) {
        socket.emit("room-joined", {
          room: normalizedUsername,
          message: `Joined room: ${normalizedUsername}`,
        });
      } else {
        socket.emit("connection-error", {
          message: `Cannot connect to ${normalizedUsername}'s live. Make sure they are currently streaming!`,
        });
      }
    } catch (error) {
      console.error(`[Socket] Error connecting to TikTok: ${error.message}`);
      socket.emit("connection-error", {
        message: error.message,
      });
    }
  });

  /**
   * LEAVE ROOM HANDLER
   */
  socket.on("leave-room", (username) => {
    if (username) {
      const normalizedUsername = username.toLowerCase().trim();
      socket.leave(normalizedUsername);
      tiktokService.removeClientFromRoom(normalizedUsername);
      console.log(`[Socket] ${socket.id} left room: ${normalizedUsername}`);
    }
  });

  /**
   * DISCONNECT HANDLER
   *
   * When client disconnects, update room count.
   * If room is empty for too long, TikTokService will auto-disconnect.
   */
  socket.on("disconnect", () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);

    if (socket.tiktokUsername) {
      tiktokService.removeClientFromRoom(socket.tiktokUsername);
    }
  });

  /**
   * Debug: Ping-pong for connection testing
   */
  socket.on("ping", () => {
    socket.emit("pong", { timestamp: Date.now() });
  });
});

// ==========================================
// SÀN NHẢY LIVE — media upload endpoint
// POST /games/san-nhay/upload?kind=audio|video&name=filename
// ==========================================

const ALLOWED_KINDS = { audio: true, video: true };

app.post(
  "/games/san-nhay/upload",
  express.raw({ type: "*/*", limit: "300mb" }),
  async (req, res) => {
    const { kind, name } = req.query;
    if (!ALLOWED_KINDS[kind] || !name) {
      return res.status(400).json({ error: "kind must be audio or video, name required" });
    }
    const safeName = String(name)
      .replace(/[^a-zA-Z0-9._\-()\[\] ]/g, "_")
      .slice(0, 200);
    const dir = join(__dirname, "../public/games/san-nhay/assets", kind);
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, safeName), req.body);
      res.json({ name: safeName });
    } catch (err) {
      console.error("[SanNhay] upload error:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// ==========================================
// SÀN NHẢY LIVE — YouTube prepare endpoint
// POST /games/san-nhay/yt-prepare?kind=audio|video&url=<youtubeUrl>
// Returns virtual filename; actual streaming happens via the route above
// ==========================================

app.post("/games/san-nhay/yt-prepare", async (req, res) => {
  const { kind, url } = req.query;
  if (!ALLOWED_KINDS[kind] || !url) {
    return res.status(400).json({ error: "kind must be audio or video, url required" });
  }
  if (!ytdl.validateURL(url)) {
    return res.status(400).json({ error: "URL YouTube không hợp lệ" });
  }
  try {
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title
      .replace(/[^a-zA-Z0-9._\-()\[\] ]/g, "_")
      .slice(0, 100);

    let ext;
    if (kind === "audio") {
      const fmt = ytdl.chooseFormat(info.formats, { filter: "audioonly", quality: "highestaudio" });
      ext = fmt.container || "webm";
    } else {
      try {
        const fmt = ytdl.chooseFormat(info.formats, {
          filter: (f) => f.container === "mp4" && f.hasVideo && f.hasAudio,
        });
        ext = fmt.container || "mp4";
      } catch {
        ext = "mp4";
      }
    }

    const key = ytKey(url);
    ytStreamMap.set(`${kind}:${key}`, url);

    res.json({ name: `_yt_${key}.${ext}`, title });
  } catch (err) {
    console.error("[SanNhay] yt-prepare error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SÀN NHẢY LIVE — raw WebSocket on /live
// ==========================================

attachSanNhayWs(server);

// ==========================================
// START SERVER
// ==========================================

server.listen(PORT, () => {
  console.log(`
    TikTok Live Games - Open Source Platform
    Server running at: → http://localhost:${PORT}
    `);
});

// Graceful shutdown handler
process.on("SIGINT", () => {
  console.log("\n[Server] Shutting down...");

  // Disconnect all TikTok connections
  const stats = tiktokService.getStats();
  stats.connections.forEach((username) => {
    tiktokService.disconnect(username);
  });

  server.close(() => {
    console.log("[Server] Goodbye!");
    process.exit(0);
  });
});
