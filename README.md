# TikTok Live Games

Nền tảng mã nguồn mở tạo game overlay tương tác cho TikTok Live. Người xem gửi gift để điều khiển game real-time — thiết kế cho stream 24/7 với OBS.

<img width="2938" height="1654" alt="image" src="https://github.com/user-attachments/assets/7fe6231f-8a9b-450b-8490-b38d775a0645" />

## Tính năng

- **Multi-tenant** — Nhiều streamer dùng cùng lúc, dữ liệu hoàn toàn cách ly
- **Provider System** — Chọn giữa 3 provider TikTok (session miễn phí / tiktool / euler)
- **TikTok Bridge SDK** — Client-side library kết nối HTML5 game với TikTok Live
- **Event Normalizer** — Payload đồng nhất cho mọi loại event (chat/gift/like/share)
- **Auto-Reconnect** — Exponential backoff với jitter (tối đa 5 lần thử)
- **OBS Ready** — Transparent overlay cho phần mềm stream
- **Event Debugger** — Monitor real-time để discover gift name và test

## Game hiện có

### Horse Racing
Gift-powered horse race với 5 lane theo quốc gia. Người xem gửi gift để đẩy con ngựa của nước mình về đích.

- **5 Lane**: 🇻🇳 Vietnam · 🇹🇭 Thailand · 🇮🇩 Indonesia · 🇲🇾 Malaysia · 🇨🇳 China
- **Gift → Lane Mapping**: Mỗi gift name gắn với một lane (cấu hình trong `config.js`)
- **4 Gift Tier**: 1/5/10/99 coin — mỗi tier có 5 gift (một gift/lane)
- **Chat Vote**: Gõ tên nước hoặc số 1–5 để vote cho lane
- **Auto-Reset**: Race tự lặp (Waiting → Countdown → Racing → Finished → Cooldown)
- **Supporter Tracking**: Top 3 người đóng góp nhiều nhất hiện trên overlay khi kết thúc

## Quick Start

### Yêu cầu
- Node.js 18+
- npm

### Cài đặt

```bash
git clone https://github.com/tuannda98/TikTok-Live-Game.git
cd tiktok-live-games
npm install
cp .env.example .env
npm start
```

### Chạy lần đầu (không cần API key)

File `.env` mặc định dùng `TIKTOK_PROVIDER=session` — hoàn toàn miễn phí, không cần đăng ký.

### Sử dụng

1. Mở dashboard: `http://localhost:3000`
2. Nhập TikTok username của streamer đang LIVE
3. Chọn game **Horse Racing**
4. Click **Generate Game Link**
5. Copy URL overlay
6. Thêm vào OBS làm **Browser Source**
7. Người xem gửi gift để chơi!

> Streamer phải đang LIVE thì mới kết nối được.

### Event Debugger

Truy cập `http://localhost:3000/debug.html` để xem tất cả TikTok event real-time. Dùng để discover gift name chính xác khi cấu hình lane mapping.

---

## Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Runtime | Node.js >= 18 (ES Modules) |
| HTTP Server | Express 4.18 |
| WebSocket | Socket.io 4.7 |
| TikTok (primary) | `@tiktool/live` ^2.12.1 (tik.tools) |
| TikTok (alternative) | `tiktok-live-connector` ^2.4.3 (EulerStream) |
| TikTok (free/no-key) | SessionProvider — tự fetch roomId từ trang TikTok |
| Game frontend | Vanilla JS — Canvas 2D + DOM |
| Styling | Custom CSS (dark theme, glassmorphism) |
| Build | Không cần build step — Node.js thuần |

---

## Cấu trúc project

```
tiktok-live-games/
├── src/                                   # Backend Node.js
│   ├── server.js                          # Express + Socket.io entry point (port 3000)
│   ├── services/
│   │   ├── TikTokService.js               # Singleton: quản lý connections, rooms, reconnect
│   │   └── providers/
│   │       ├── index.js                   # Provider factory (đọc TIKTOK_PROVIDER env)
│   │       ├── BaseTikTokProvider.js      # Interface + NormalizedConnection base class
│   │       ├── TikToolProvider.js         # @tiktool/live (tik.tools, free tier)
│   │       ├── EulerProvider.js           # tiktok-live-connector (EulerStream, paid)
│   │       └── SessionProvider.js        # Miễn phí, fetch roomId từ trang TikTok
│   └── lib/
│       ├── tiktokEventNormalizer.js       # Pure functions chuẩn hóa TikTok events
│       └── tiktokReconnectPolicy.js       # Exponential backoff utilities
├── public/                                # Static frontend (Express serve)
│   ├── index.html                         # Dashboard chọn game và tạo overlay URL
│   ├── debug.html                         # Live event monitor/debugger
│   ├── css/styles.css                     # Dark theme, glassmorphism
│   ├── js/dashboard.js                    # Dashboard logic (tạo URL)
│   ├── lib/tiktok-bridge.js               # Client-side SDK: Socket.io → game events
│   └── games/
│       └── horse-racing/
│           ├── index.html                 # OBS overlay entry point
│           ├── config.js                  # Lanes, gift tiers, race config
│           ├── race-engine.js             # Pure state machine (không có DOM)
│           ├── game.js                    # Canvas renderer + bridge wiring
│           └── style.css                  # Overlay styles (transparent background)
├── docs/
│   ├── DEVELOPMENT.md                     # Hướng dẫn phát triển và cài đặt môi trường
│   ├── GAME_DEVELOPMENT.md                # Hướng dẫn tạo game mới
│   ├── BACKEND_DEVELOPMENT.md             # Hướng dẫn phát triển tính năng backend
│   ├── OPERATIONS.md                      # Hướng dẫn vận hành và deploy
│   └── GIFT_CATALOG.md                    # Danh mục TikTok gift theo giá
├── .env.example                           # Template cấu hình
└── package.json
```

---

## Kiến trúc hệ thống

### Data Flow

```
TikTok Live
    │
    ▼
[Provider Layer]  ←  TIKTOK_PROVIDER env
  ├── SessionProvider   (miễn phí, fetch roomId)
  ├── TikToolProvider   (@tiktool/live + tik.tools API key)
  └── EulerProvider     (tiktok-live-connector + EulerStream API key)
    │
    │  NormalizedConnection (EventEmitter)
    │  Events: connected / chat / gift / like / share / disconnected / error
    ▼
TikTokService (Singleton)
  ├── connections: Map<username, {connection, lastActivity}>
  ├── roomClients: Map<username, clientCount>
  └── reconnectState: Map<username, {attempting, attempt}>
    │
    │  io.to(username).emit("tiktok_*", payload)
    ▼
Socket.io Rooms  (Room ID = TikTok username)
    │
    ▼
tiktok-bridge.js (Client SDK)
  └── TikTokBridge.on("gift" | "chat" | "like" | "share", callback)
    │
    ▼
Game (Canvas 2D + DOM)
  ├── RaceEngine (pure state machine)
  └── game.js (renderer)
```

### Multi-tenant Isolation

Mỗi streamer có một Socket.io Room riêng (Room ID = TikTok username). Event chỉ broadcast đến đúng room.

```
TikTokService
  ├── io.to("streamer_a").emit() → [Overlay A của streamer_a]
  ├── io.to("streamer_b").emit() → [Overlay B của streamer_b]
  └── io.to("streamer_c").emit() → [Overlay C của streamer_c]
```

### Connection Lifecycle

```
join-room(username)
    │
    ├─ connections.has(username)? → Reuse existing → return true
    │
    └─ Tạo mới → provider.createConnection(username)
                      │
                      ▼
               conn.connect()
                      │
               ┌──────┴──────┐
            success        error
               │               │
          Relay events      return false
               │
           disconnected?
               │
       clients > 0? → _scheduleReconnect()
                           │
                    Exponential backoff
                    (5 attempts max)
```

---

## Provider System

| Provider | `TIKTOK_PROVIDER` | Chi phí | Yêu cầu |
|---|---|---|---|
| SessionProvider | `session` | Miễn phí | Không cần gì |
| TikToolProvider | `tiktool` | Free tier (5k req/ngày, 3 stream) | `SIGN_API_KEY` từ tik.tools |
| EulerProvider | `euler` | Trả phí (Business plan) | `SIGN_API_KEY` từ eulerstream.com |

Xem chi tiết: [docs/BACKEND_DEVELOPMENT.md](docs/BACKEND_DEVELOPMENT.md)

---

## API Reference

### REST Endpoints

| Endpoint | Method | Mô tả |
|---|---|---|
| `/api/health` | GET | Health check + stats |
| `/api/stats` | GET | Thống kê connections |

### Socket.io Events

**Client → Server:**

| Event | Payload | Mô tả |
|---|---|---|
| `join-room` | `username: string` | Tham gia room của streamer |
| `leave-room` | `username: string` | Rời room |
| `ping` | — | Kiểm tra kết nối |

**Server → Client:**

| Event | Payload chính | Mô tả |
|---|---|---|
| `room-joined` | `{ room }` | Đã vào room thành công |
| `tiktok_connected` | `{ roomId, timestamp }` | Kết nối TikTok thành công |
| `tiktok_chat` | `{ user, comment, timestamp }` | Tin nhắn chat |
| `tiktok_gift` | `{ user, giftId, giftName, giftValue, repeatCount, giftType, timestamp }` | Gift nhận được |
| `tiktok_like` | `{ user, likeCount, totalLikeCount, timestamp }` | Like/heart |
| `tiktok_share` | `{ user, timestamp }` | Chia sẻ |
| `tiktok_reconnecting` | `{ attempt, delayMs, timestamp }` | Đang thử kết nối lại |
| `tiktok_disconnected` | `{ timestamp }` | Mất kết nối |
| `tiktok_error` | `{ message, timestamp }` | Lỗi |
| `connection-error` | `{ message }` | Lỗi khi join room |

**User object:** `{ uniqueId, nickname, profilePictureUrl }`

**Gift type:** `"small"` (< 10 diamonds) · `"medium"` (10–99) · `"large"` (≥ 100)

---

## TikTok Bridge SDK

Client-side SDK xử lý kết nối Socket.io và dispatch event cho game.

### Auto-Connect

Bridge tự kết nối nếu URL có param `?id=username` hoặc `?username=username`.

### API

```javascript
// Kết nối thủ công
TikTokBridge.connect(username, serverUrl);

// Lắng nghe events
TikTokBridge.on("gift", (data) => {
  console.log(data.giftName, data.giftValue, data.giftType);
});

TikTokBridge.on("chat", (data) => {
  console.log(data.user.uniqueId, data.comment);
});

// Events: chat, gift, like, share, connected, disconnected, reconnecting, error
```

---

## Thêm Game Mới

Xem hướng dẫn chi tiết: [docs/GAME_DEVELOPMENT.md](docs/GAME_DEVELOPMENT.md)

Tóm tắt nhanh:
1. Tạo `public/games/{tên-game}/` với file `index.html`
2. Include SDK:
   ```html
   <script src="/socket.io/socket.io.js"></script>
   <script src="/lib/tiktok-bridge.js"></script>
   ```
3. Lắng nghe events:
   ```javascript
   TikTokBridge.on("gift", (data) => { /* logic game */ });
   TikTokBridge.on("chat", (data) => { /* parse lệnh */ });
   ```
4. Thêm game card vào `public/index.html`:
   ```html
   <div class="game-card" data-game="tên-game" data-entry="index.html" data-param="id">
     <!-- nội dung card -->
   </div>
   ```

---

## Cấu hình Horse Racing

### Lane Setup (`config.js`)

```javascript
lanes: [
  { id: 0, name: "Vietnam",   flag: "🇻🇳", color: "#FF4444", aliases: ["vn", "vietnam"] },
  { id: 1, name: "Thailand",  flag: "🇹🇭", color: "#4488FF", aliases: ["th", "thailand"] },
  { id: 2, name: "Indonesia", flag: "🇮🇩", color: "#44DD44", aliases: ["id", "indonesia"] },
  { id: 3, name: "Malaysia",  flag: "🇲🇾", color: "#FFCC00", aliases: ["my", "malaysia"] },
  { id: 4, name: "China",     flag: "🇨🇳", color: "#CC44FF", aliases: ["cn", "china"] },
]
```

### Gift Tiers

Index trong mảng `gifts` = index lane (0=VN, 1=TH, 2=ID, 3=MY, 4=CN):

| Tier | VN | TH | ID | MY | CN |
|---|---|---|---|---|---|
| 1 coin | Rose 🌹 | GG ✌️ | Ice Cream Cone 🍦 | Finger Heart 🫰 | TikTok 🎵 |
| 5 coin | Hand Heart 💕 | Little Crown 👑 | Butterfly 🦋 | Love You 💗 | Wishing Bottle 🧴 |
| 10 coin | Perfume 💐 | Doughnut 🍩 | Cap 🧢 | Paper Crane 🕊️ | Sunglasses 🕶️ |
| 99 coin | Garland 🏵️ | Singing Mic 🎤 | Star ⭐ | Concert 🎸 | Lock and Key 🔐 |

### Công thức Gift → Distance

```
distance = 5 + 3 × √(diamondValue)
```

| Diamond | Distance |
|---|---|
| 1 | 8 units |
| 10 | 14 units |
| 99 | 35 units |

### Race Phases

```
WAITING → COUNTDOWN (10s) → RACING (max 120s) → FINISHED (8s) → COOLDOWN (5s) → WAITING
```

---

## Development

Xem [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) để biết hướng dẫn đầy đủ.

```bash
npm run dev    # Dev mode với auto-reload
npm start      # Production
```

---

## Links

- [Hướng dẫn phát triển](docs/DEVELOPMENT.md)
- [Phát triển game mới](docs/GAME_DEVELOPMENT.md)
- [Phát triển tính năng backend](docs/BACKEND_DEVELOPMENT.md)
- [Vận hành & Deploy](docs/OPERATIONS.md)
- [Danh mục Gift TikTok](docs/GIFT_CATALOG.md)

---

## License

MIT — xem file LICENSE để biết chi tiết.
