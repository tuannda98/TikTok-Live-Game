# Hướng dẫn Phát triển Backend

Tài liệu này hướng dẫn cách thêm tính năng mới cho backend: provider mới, REST API endpoint, Socket.io event, và mở rộng TikTokService.

---

## Mục lục

1. [Kiến trúc Backend](#kiến-trúc-backend)
2. [Provider System](#provider-system)
3. [Thêm Provider mới](#thêm-provider-mới)
4. [Thêm REST API Endpoint](#thêm-rest-api-endpoint)
5. [Thêm Socket.io Event](#thêm-socketio-event)
6. [Mở rộng TikTokService](#mở-rộng-tiktokservice)
7. [Thêm Event Type mới](#thêm-event-type-mới)
8. [Cấu hình và Environment Variables](#cấu-hình-và-environment-variables)

---

## Kiến trúc Backend

```
server.js          — Express + Socket.io entry point
    │
    ├── TikTokService (singleton)
    │       │
    │       └── Provider (được chọn qua TIKTOK_PROVIDER env)
    │               ├── TikToolProvider   (@tiktool/live)
    │               ├── EulerProvider     (tiktok-live-connector)
    │               └── SessionProvider   (no-key, tự fetch roomId)
    │
    └── lib/
            ├── tiktokEventNormalizer.js   (pure functions)
            └── tiktokReconnectPolicy.js   (pure functions)
```

### Luồng xử lý khi client kết nối

```
1. Client gửi socket event "join-room" với username
2. server.js nhận → validate → socket.join(username) → TikTokService.connect(username, io)
3. TikTokService kiểm tra connections.has(username):
   - Có rồi → reuse, trả về true
   - Chưa có → provider.createConnection(username) → conn.connect()
4. Các event từ TikTok → NormalizedConnection emit → TikTokService relay → io.to(username).emit()
5. Client nhận event qua tiktok-bridge.js
```

---

## Provider System

Provider là lớp abstraction cho các TikTok connector library khác nhau. Mọi provider đều implement cùng interface, cho phép swap không cần sửa code logic.

### Interface (BaseTikTokProvider.js)

```javascript
// NormalizedConnection — EventEmitter trả về từ createConnection()
// Phải emit các events:
//   connected  { roomId: string, timestamp: number }
//   disconnected
//   error      Error
//   chat       { user, comment, timestamp }
//   like       { user, likeCount, totalLikeCount, timestamp }
//   share      { user, timestamp }
//   gift       { user, giftId, giftName, giftValue, repeatCount, giftType, timestamp }

class NormalizedConnection extends EventEmitter {
  async connect() { throw new Error("not implemented") }
  disconnect() { throw new Error("not implemented") }
}

class BaseTikTokProvider {
  get name() { return "base" }  // tên hiển thị trong logs
  createConnection(username) { throw new Error("not implemented") }
}
```

### User object shape

```javascript
{
  uniqueId: string,          // TikTok user ID (dùng làm key)
  nickname: string,          // Tên hiển thị
  profilePictureUrl: string  // URL avatar
}
```

Dùng `normalizeUser(raw)` từ `tiktokEventNormalizer.js` để tạo user object chuẩn từ raw data của bất kỳ library nào.

---

## Thêm Provider mới

### Bước 1: Tạo file provider

Tạo `src/services/providers/MyProvider.js`:

```javascript
/**
 * MyProvider.js
 *
 * Provider sử dụng [tên library/service].
 * [Chi phí và yêu cầu API key nếu có]
 *
 * Required env: MY_API_KEY
 */

import { BaseTikTokProvider, NormalizedConnection } from "./BaseTikTokProvider.js";
import {
  normalizeChat,
  normalizeGift,
  normalizeLike,
  normalizeShare,
} from "../../lib/tiktokEventNormalizer.js";

class MyConnection extends NormalizedConnection {
  constructor(username, apiKey) {
    super();
    // Khởi tạo client của library
    this._client = new SomeLibrary({ username, apiKey });
  }

  async connect() {
    const c = this._client;

    // Map events của library sang NormalizedConnection events
    c.on("connected", (state) => {
      this.emit("connected", { roomId: state.roomId, timestamp: Date.now() });
    });

    c.on("disconnected", () => this.emit("disconnected"));

    c.on("error", (err) => {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    });

    // Dùng normalizers để chuẩn hóa payload
    c.on("chat",  (data) => this.emit("chat",  normalizeChat(data)));
    c.on("like",  (data) => this.emit("like",  normalizeLike(data)));
    c.on("share", (data) => this.emit("share", normalizeShare(data)));
    c.on("gift",  (data) => this.emit("gift",  normalizeGift(data)));

    // Kết nối
    await c.connect();
  }

  disconnect() {
    try {
      this._client.disconnect();
    } catch (_) {
      // Ignore cleanup errors
    }
  }
}

export class MyProvider extends BaseTikTokProvider {
  constructor() {
    super();
    this._apiKey = process.env.MY_API_KEY;
    if (!this._apiKey) {
      throw new Error("MY_API_KEY is required for MyProvider.");
    }
  }

  get name() { return "myprovider"; }

  createConnection(username) {
    return new MyConnection(username, this._apiKey);
  }
}
```

### Bước 2: Đăng ký provider trong factory

Sửa `src/services/providers/index.js`:

```javascript
import { TikToolProvider } from "./TikToolProvider.js";
import { EulerProvider } from "./EulerProvider.js";
import { SessionProvider } from "./SessionProvider.js";
import { MyProvider } from "./MyProvider.js";  // Thêm dòng này

const PROVIDERS = {
  tiktool:    TikToolProvider,
  euler:      EulerProvider,
  session:    SessionProvider,
  myprovider: MyProvider,  // Thêm dòng này
};
```

### Bước 3: Cập nhật `.env.example`

```env
# MyProvider — [mô tả ngắn]
# Đăng ký API key tại: https://...
# TIKTOK_PROVIDER=myprovider
# MY_API_KEY=your_api_key_here
```

### Bước 4: Test

```bash
TIKTOK_PROVIDER=myprovider MY_API_KEY=xxx npm start
```

Kiểm tra log: `[TikTokProvider] Using provider: myprovider`

---

## Thêm REST API Endpoint

Thêm route vào `src/server.js`:

```javascript
/**
 * Lấy danh sách games đang active
 * @route GET /api/games
 */
app.get("/api/games", (req, res) => {
  // Truy cập TikTokService nếu cần
  const stats = tiktokService.getStats();

  res.json({
    games: ["horse-racing"],
    activeRooms: stats.connections,
  });
});
```

### Middleware

```javascript
// Rate limiting (nếu cần)
import rateLimit from "express-rate-limit";

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 phút
  max: 60,              // 60 request/phút
});
app.use("/api/", apiLimiter);

// Validate request body
app.post("/api/something", express.json(), (req, res) => {
  const { field } = req.body;
  if (!field) return res.status(400).json({ error: "field is required" });
  // ...
});
```

---

## Thêm Socket.io Event

### Client → Server (nhận lệnh từ client)

Thêm trong block `io.on("connection", (socket) => { ... })` của `server.js`:

```javascript
/**
 * Lệnh mới từ client
 */
socket.on("my-command", (payload) => {
  const { username, data } = payload;
  if (!username) {
    socket.emit("command-error", { message: "username required" });
    return;
  }

  // Xử lý lệnh
  tiktokService.doSomething(username);

  // Trả kết quả cho client gửi lệnh
  socket.emit("command-result", { success: true });

  // Broadcast đến tất cả trong room
  io.to(username).emit("room-update", { data });
});
```

### Server → Client (broadcast event)

Có hai cách emit:

```javascript
// Chỉ gửi cho socket hiện tại
socket.emit("event-name", payload);

// Gửi cho TẤT CẢ client trong room (kể cả socket hiện tại)
io.to(username).emit("event-name", payload);

// Gửi cho TẤT CẢ client trong room TRỪ socket hiện tại
socket.to(username).emit("event-name", payload);
```

> **Quan trọng**: Luôn dùng `io.to(username).emit()` khi relay TikTok events để đảm bảo data isolation.

---

## Mở rộng TikTokService

### Thêm method mới

```javascript
// Trong class TikTokService (TikTokService.js)

/**
 * Gửi message đến tất cả client của một streamer.
 * @param {string} username
 * @param {string} event
 * @param {object} payload
 */
broadcastToRoom(username, event, payload) {
  if (!this.connections.has(username)) {
    throw new Error(`No active connection for ${username}`);
  }
  this.io.to(username).emit(event, payload);
}
```

> **Lưu ý**: `TikTokService` hiện không lưu `io` instance. Nếu cần `io` trong method mới, cần refactor để inject `io` vào constructor hoặc truyền qua parameter.

### Lưu trữ state theo room

TikTokService có thể lưu thêm data theo username:

```javascript
constructor() {
  // ... existing code

  // Thêm map mới nếu cần lưu state per-room
  /** @type {Map<string, object>} */
  this.roomState = new Map();
}

setRoomState(username, state) {
  this.roomState.set(username, { ...state, updatedAt: Date.now() });
}

getRoomState(username) {
  return this.roomState.get(username) || null;
}
```

### Cleanup khi disconnect

Khi disconnect, dọn dẹp state liên quan:

```javascript
disconnect(username) {
  this.reconnectState.delete(username);
  this.roomState.delete(username);  // Dọn state mới thêm

  if (this.connections.has(username)) {
    const { connection } = this.connections.get(username);
    connection.disconnect();
    this.connections.delete(username);
  }
}
```

---

## Thêm Event Type mới

Ví dụ thêm event `follow` (khi có người follow stream):

### Bước 1: Thêm normalizer

Trong `src/lib/tiktokEventNormalizer.js`:

```javascript
/**
 * Normalize follow event.
 * @param {Object} raw
 * @returns {{user: Object, timestamp: number}}
 */
export function normalizeFollow(raw) {
  return {
    user: normalizeUser(raw),
    timestamp: Date.now(),
  };
}
```

### Bước 2: Emit trong provider

Trong mỗi provider hỗ trợ follow event:

```javascript
// TikToolProvider.js
import { normalizeFollow } from "../../lib/tiktokEventNormalizer.js";

// Trong connect():
c.on("follow", (data) => this.emit("follow", normalizeFollow(data)));
```

### Bước 3: Relay trong TikTokService

```javascript
// TikTokService.js, trong connect():
conn.on("follow", (payload) => {
  this.updateActivity(username);
  io.to(username).emit("tiktok_follow", payload);
  console.log(`[${username}] Follow from ${payload.user.nickname}`);
});
```

### Bước 4: Relay trong tiktok-bridge.js

```javascript
// public/lib/tiktok-bridge.js
// Thêm vào constructor:
this.eventHandlers = {
  // ... existing events
  follow: [],  // Thêm event mới
};

// Thêm vào connect():
this.socket.on("tiktok_follow", (data) => this._dispatch("follow", data));
```

### Bước 5: Dùng trong game

```javascript
TikTokBridge.on("follow", (data) => {
  console.log(`${data.user.nickname} đã follow!`);
});
```

---

## Cấu hình và Environment Variables

### File `.env`

Đọc bởi Node.js `--env-file=.env` trong npm scripts. Không cần package `dotenv`.

```env
# Provider
TIKTOK_PROVIDER=session        # session | tiktool | euler

# API Key (bắt buộc với tiktool và euler)
SIGN_API_KEY=your_key_here

# Session cookie (optional, chỉ dùng với TIKTOK_PROVIDER=session)
TIKTOK_SESSION_ID=sessionid_cookie_value
TIKTOK_TT_IDC=tt_target_idc_value

# Server
PORT=3000
```

### Đọc env trong code

```javascript
// Đọc trực tiếp từ process.env
const apiKey = process.env.SIGN_API_KEY;
const port = parseInt(process.env.PORT || "3000", 10);
```

### Thêm env var mới

1. Thêm vào `.env.example` với comment tiếng Việt giải thích:

```env
# MY_NEW_VAR — Mô tả biến này dùng để làm gì
# Giá trị mặc định: xxx
# MY_NEW_VAR=default_value
```

2. Validate khi startup (trong provider constructor hoặc khi module load):

```javascript
const myVar = process.env.MY_NEW_VAR;
if (!myVar) {
  throw new Error("MY_NEW_VAR is required. See .env.example for details.");
}
```

> **Fail-fast**: Throw error ngay khi khởi động nếu thiếu config bắt buộc — tốt hơn là lỗi khi runtime.
