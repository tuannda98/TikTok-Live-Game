/**
 * sanNhayWs.js
 * Raw WebSocket handler for the Sàn Nhảy LIVE game at /live path.
 *
 * The game uses two separate WebSocket connections to ws://host/live:
 *   1. Control link — sends {type:"beat"} heartbeats and {type:"control",...} messages
 *   2. LiveClient  — sends {type:"connect", username} and receives TikTok events
 *
 * This service routes both on the same `/live` path and distinguishes them by
 * the first message they send.
 *
 * @module services/sanNhayWs
 */

import { WebSocketServer, WebSocket } from "ws";
import provider from "./providers/index.js";

/** @param {import('http').Server} server */
export function attachSanNhayWs(server) {
  const wss = new WebSocketServer({ noServer: true });

  // Route only /live upgrades to this WSS; Socket.io handles the rest
  server.on("upgrade", (req, socket, head) => {
    const path = req.url?.split("?")[0];
    if (path === "/live") {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    }
  });

  wss.on("connection", (ws, req) => {
    let role = null; // "control" | "live"
    let tiktokConn = null;

    // Send session-active immediately so the scene unlocks its UI
    _send(ws, { type: "session", state: "active", remainingMs: null });
    _send(ws, { type: "quyenChu", ok: true });

    // Broadcast a message to every OTHER connected client
    ws._broadcast = (obj) => {
      for (const client of wss.clients) {
        if (client !== ws) _send(client, obj);
      }
    };

    ws.on("message", async (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      // ── Identify role on first meaningful message ────────────────────────
      if (!role) {
        role = msg.type === "connect" ? "live" : "control";
      }

      if (role === "live") {
        await _handleLive(ws, msg, (conn) => { tiktokConn = conn; });
      } else {
        _handleControl(ws, msg, wss);
      }
    });

    ws.on("close", () => {
      if (tiktokConn) {
        try { tiktokConn.disconnect(); } catch { /* ignore */ }
        tiktokConn = null;
      }
    });
  });

  console.log("[SanNhay] WebSocket /live handler attached");
}

// ─────────────────────────────────────────────────────────────────────────────

function _send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

/**
 * Handle a control-link connection.
 * In standalone mode the game echoes control messages back to itself so the
 * scene's onControl handler can receive liveConnect / liveDisconnect etc.
 */
function _handleControl(ws, msg, wss) {
  if (msg.type === "beat") return; // heartbeat — ignore

  if (msg.type === "control") {
    // Echo back to ALL open clients (control links and scene share the page)
    for (const client of wss.clients) {
      _send(client, msg);
    }
  }
  // activate / clock / other messages: no-op in standalone
}

/**
 * Handle a LiveClient connection.
 * {type:"connect", username} → connect TikTok, relay events.
 */
async function _handleLive(ws, msg, setConn) {
  if (msg.type !== "connect" || !msg.username) return;

  const username = String(msg.username).replace(/^@/, "").toLowerCase().trim();
  _send(ws, { type: "status", connected: false, message: "Đang kết nối TikTok…" });

  let conn;
  try {
    conn = provider.createConnection(username);
    setConn(conn);
  } catch (err) {
    _send(ws, { type: "status", connected: false, message: `Lỗi: ${err.message}` });
    return;
  }

  const broadcast = (obj) => {
    // Send to LiveClient itself AND all other connections (control pages)
    _send(ws, obj);
    if (ws._broadcast) ws._broadcast(obj);
  };

  conn.on("connected", () => {
    broadcast({ type: "status", connected: true, message: "Đã kết nối TikTok Live ✓" });
  });

  conn.on("disconnected", () => {
    broadcast({ type: "status", connected: false, message: "Mất kết nối TikTok" });
  });

  conn.on("error", (err) => {
    broadcast({ type: "status", connected: false, message: `Lỗi: ${err.message}` });
  });

  conn.on("chat", (p) => {
    _send(ws, {
      type: "chat",
      userId: p.user.uniqueId,
      nickname: p.user.nickname,
      avatarUrl: p.user.profilePictureUrl,
      text: p.comment,
    });
  });

  conn.on("gift", (p) => {
    _send(ws, {
      type: "gift",
      userId: p.user.uniqueId,
      nickname: p.user.nickname,
      avatarUrl: p.user.profilePictureUrl,
      diamonds: p.giftValue,
      giftName: p.giftName,
      repeatCount: p.repeatCount,
    });
  });

  conn.on("like", (p) => {
    _send(ws, {
      type: "like",
      userId: p.user.uniqueId,
      nickname: p.user.nickname,
      avatarUrl: p.user.profilePictureUrl,
      count: p.likeCount,
    });
  });

  conn.on("share", (p) => {
    _send(ws, {
      type: "social",
      userId: p.user.uniqueId,
      nickname: p.user.nickname,
      avatarUrl: p.user.profilePictureUrl,
    });
  });

  try {
    await conn.connect();
  } catch (err) {
    _send(ws, { type: "status", connected: false, message: `Lỗi: ${err.message}` });
  }
}
