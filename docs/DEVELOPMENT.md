# Hướng dẫn Phát triển

Tài liệu này hướng dẫn setup môi trường, workflow phát triển, và các quy ước code trong dự án TikTok Live Games.

---

## Mục lục

1. [Yêu cầu môi trường](#yêu-cầu-môi-trường)
2. [Cài đặt lần đầu](#cài-đặt-lần-đầu)
3. [Cấu hình Provider](#cấu-hình-provider)
4. [Chạy Development Server](#chạy-development-server)
5. [Cấu trúc project](#cấu-trúc-project)
6. [Tech Stack chi tiết](#tech-stack-chi-tiết)
7. [Quy ước code](#quy-ước-code)
8. [Debug & Testing](#debug--testing)

---

## Yêu cầu môi trường

| Công cụ | Phiên bản tối thiểu | Ghi chú |
|---|---|---|
| Node.js | 18.0.0 | Cần `--env-file` flag và `node --watch` |
| npm | 9.0+ | Đi kèm với Node.js 18 |
| Git | Bất kỳ | Clone và quản lý code |

> **Không cần** TypeScript, bundler (Webpack/Vite), hay build step nào.
> Backend là Node.js thuần ES Modules. Frontend là Vanilla JS chạy thẳng trên browser.

---

## Cài đặt lần đầu

### 1. Clone repository

```bash
git clone https://github.com/tuannda98/TikTok-Live-Game.git
cd tiktok-live-games
```

### 2. Cài dependencies

```bash
npm install
```

### 3. Tạo file cấu hình

```bash
cp .env.example .env
```

### 4. Khởi động server

```bash
npm run dev
```

Truy cập:
- Dashboard: `http://localhost:3000`
- Debugger: `http://localhost:3000/debug.html`
- Health check: `http://localhost:3000/api/health`

---

## Cấu hình Provider

Provider xác định cách kết nối đến TikTok Live. Chọn trong `.env`:

```env
TIKTOK_PROVIDER=session
```

### So sánh các Provider

#### `session` — Miễn phí, không cần API key (Khuyến nghị để bắt đầu)

```env
TIKTOK_PROVIDER=session
# Không cần thêm gì
```

Cách hoạt động: Tự fetch trang `tiktok.com/@username/live`, trích xuất `roomId` từ JSON nhúng trong HTML (`SIGI_STATE`), và lấy `ttwid` từ cookie `Set-Cookie`. Sau đó dùng các giá trị này để kết nối WebSocket trực tiếp.

Giới hạn: Đôi khi TikTok thay đổi cấu trúc trang, có thể cần cập nhật logic parse.

Tùy chọn — dùng session đã đăng nhập để ổn định hơn:
```env
TIKTOK_SESSION_ID=your_sessionid_cookie
TIKTOK_TT_IDC=your_tt-target-idc_cookie
```
Cách lấy cookie: Chrome → F12 → Application → Cookies → `https://www.tiktok.com`

---

#### `tiktool` — Free tier, cần API key từ tik.tools

```env
TIKTOK_PROVIDER=tiktool
SIGN_API_KEY=your_api_key_from_tik_tools
```

Free tier: 5,000 request/ngày · 3 stream đồng thời
Đăng ký API key: https://tik.tools/pricing

---

#### `euler` — Trả phí, cần API key từ EulerStream

```env
TIKTOK_PROVIDER=euler
SIGN_API_KEY=your_api_key_from_eulerstream
```

Yêu cầu Business plan: https://www.eulerstream.com/pricing

---

## Chạy Development Server

### Dev mode (có auto-reload)

```bash
npm run dev
```

Node.js `--watch` tự restart khi có thay đổi file `.js` trong `src/`. Thay đổi file frontend (`public/`) không cần restart — browser refresh là đủ.

### Production mode

```bash
npm start
```

### Port tùy chỉnh

```bash
PORT=8080 npm start
```

Hoặc thêm vào `.env`:
```env
PORT=8080
```

---

## Cấu trúc project

### Backend (`src/`)

```
src/
├── server.js                    # Entry point: Express + Socket.io
├── services/
│   ├── TikTokService.js         # Singleton quản lý tất cả TikTok connections
│   └── providers/
│       ├── index.js             # Factory: đọc env và tạo provider instance
│       ├── BaseTikTokProvider.js # Interface + NormalizedConnection
│       ├── TikToolProvider.js   # Provider dùng @tiktool/live
│       ├── EulerProvider.js     # Provider dùng tiktok-live-connector
│       └── SessionProvider.js  # Provider miễn phí (không cần API key)
└── lib/
    ├── tiktokEventNormalizer.js # Pure functions chuẩn hóa event payload
    └── tiktokReconnectPolicy.js # Exponential backoff helpers
```

### Frontend (`public/`)

```
public/
├── index.html          # Dashboard
├── debug.html          # Event debugger
├── css/styles.css      # Global styles
├── js/dashboard.js     # Dashboard logic
├── lib/
│   └── tiktok-bridge.js  # Client SDK (TikTokBridge singleton)
└── games/
    └── horse-racing/
        ├── index.html    # Overlay entry point
        ├── config.js     # Cấu hình game (lanes, gifts, timing)
        ├── race-engine.js # Pure state machine
        ├── game.js       # Canvas renderer + wiring
        └── style.css     # Overlay styles
```

### Docs (`docs/`)

```
docs/
├── DEVELOPMENT.md          # File này
├── GAME_DEVELOPMENT.md     # Hướng dẫn tạo game mới
├── BACKEND_DEVELOPMENT.md  # Hướng dẫn thêm tính năng backend
├── OPERATIONS.md           # Vận hành & deploy
└── GIFT_CATALOG.md         # Danh mục TikTok gift
```

---

## Tech Stack chi tiết

### Backend

| Package | Version | Vai trò |
|---|---|---|
| `express` | ^4.18.2 | HTTP server, serve static files, REST API |
| `socket.io` | ^4.7.2 | WebSocket server cho realtime events |
| `@tiktool/live` | ^2.12.1 | TikTok Live connector (tik.tools sign server) |
| `tiktok-live-connector` | ^2.4.3 | TikTok Live connector (EulerStream sign server) |

Không dùng:
- TypeScript (thuần JavaScript ES Modules)
- ORM/database (không cần lưu trữ)
- Authentication (local only, không expose public)
- Test framework (chưa có, có thể thêm)

### Frontend

- **Vanilla JavaScript** — không có framework (React/Vue/...)
- **Canvas 2D API** — vẽ track và horse
- **DOM API** — cập nhật HUD elements
- **Socket.io client** — nhận events từ server (`/socket.io/socket.io.js` được serve tự động)

### Node.js ES Modules

Project dùng `"type": "module"` trong `package.json`. Tất cả `import`/`export` dùng ES Module syntax:

```javascript
// Đúng
import express from 'express';
import { normalizeGift } from '../lib/tiktokEventNormalizer.js';
export class TikToolProvider extends BaseTikTokProvider { ... }
export default new TikTokService();

// Sai (CommonJS)
const express = require('express');
module.exports = ...;
```

> **Quan trọng**: Khi import file local, phải có `.js` extension — Node.js ES Modules không tự resolve extension.

---

## Quy ước code

### Naming

| Loại | Convention | Ví dụ |
|---|---|---|
| File | kebab-case | `tiktok-bridge.js`, `race-engine.js` |
| Class | PascalCase | `TikTokService`, `NormalizedConnection` |
| Function | camelCase | `normalizeGift`, `handleChat` |
| Constant | UPPER_SNAKE | `DEFAULTS`, `DEFAULT_UA` |
| Private method | `_` prefix | `_scheduleReconnect`, `_moveLane` |

### Comments

Dùng tiếng Anh trong code comments (JSDoc, inline). Dùng tiếng Việt trong docs (file `.md`).

```javascript
// Đúng: giải thích tại sao, không giải thích cái gì
// EulerStream emits share as a filtered social event
c.on("social", (data) => {
    if (data.displayType === "pm_mt_msg_viewer_share") {
        this.emit("share", normalizeShare(data));
    }
});

// Sai: mô tả cái đã rõ
// Loop over lanes
for (const lane of this.state.lanes) { ... }
```

### Error handling

- Chỉ catch lỗi khi cần xử lý cụ thể
- Không dùng `catch (_)` trừ trường hợp cleanup (ví dụ `disconnect()` trong destructor)
- Log lỗi với prefix `[ClassName]` để dễ trace

```javascript
// Pattern chuẩn trong TikTokService
conn.on("error", (err) => {
    console.error(`[TikTokService] Error for ${username}:`, err.message);
    io.to(username).emit("tiktok_error", { message: err.message, timestamp: Date.now() });
});
```

### Event payload

Tất cả event gửi đến client phải có `timestamp: Date.now()`. Dùng `normalizeUser()`, `normalizeChat()`, v.v. từ `tiktokEventNormalizer.js` thay vì tự tạo payload.

---

## Debug & Testing

### Event Debugger

`http://localhost:3000/debug.html` — monitor tất cả event real-time từ bất kỳ streamer nào. Dùng để:
- Discover gift name chính xác (copy vào `config.js`)
- Kiểm tra payload format
- Test kết nối provider

### Health Check

```bash
curl http://localhost:3000/api/health
```

```json
{
  "status": "ok",
  "timestamp": "2026-08-06T10:00:00.000Z",
  "stats": {
    "provider": "session",
    "activeConnections": 1,
    "connections": ["username1"],
    "rooms": { "username1": 2 }
  }
}
```

### Console Logs

Server log có prefix rõ ràng:

| Prefix | Module |
|---|---|
| `[Socket]` | `server.js` — Socket.io events |
| `[TikTokService]` | `TikTokService.js` |
| `[TikToolProvider]` | `TikToolProvider.js` |
| `[SessionProvider]` | `SessionProvider.js` |
| `[TikTokProvider]` | `providers/index.js` (factory) |
| `[HorseRacing]` | `game.js` (browser console) |
| `[TikTokBridge]` | `tiktok-bridge.js` (browser console) |
| `[RaceEngine]` | `race-engine.js` (browser console) |

### Test thủ công

Chưa có automated tests. Test flow cơ bản:

1. Chạy `npm run dev`
2. Mở `http://localhost:3000/debug.html`
3. Nhập username streamer đang LIVE
4. Kiểm tra events xuất hiện real-time
5. Mở `http://localhost:3000/games/horse-racing/index.html?id=username`
6. Kiểm tra game phản ứng với events
