# Hướng dẫn Phát triển Game

Tài liệu này hướng dẫn cách tạo một game mới cho nền tảng TikTok Live Games — từ cấu trúc file, wiring với TikTok events, đến publish overlay lên OBS.

---

## Mục lục

1. [Kiến trúc game](#kiến-trúc-game)
2. [Tạo game mới — Step by step](#tạo-game-mới--step-by-step)
3. [TikTok Bridge SDK](#tiktok-bridge-sdk)
4. [Event Reference](#event-reference)
5. [Thêm game vào Dashboard](#thêm-game-vào-dashboard)
6. [Best practices cho OBS Overlay](#best-practices-cho-obs-overlay)
7. [Ví dụ game đơn giản — Counter Game](#ví-dụ-game-đơn-giản--counter-game)
8. [Phân tích Horse Racing Game](#phân-tích-horse-racing-game)
9. [Tùy chỉnh Horse Racing](#tùy-chỉnh-horse-racing)

---

## Kiến trúc game

Mỗi game là một tập file HTML/CSS/JS tĩnh trong `public/games/{tên-game}/`. Game nhận dữ liệu từ TikTok Live thông qua `tiktok-bridge.js`.

```
TikTok Live
    ↓
Server (Socket.io)
    ↓
tiktok-bridge.js  ←  tự kết nối khi load nếu URL có ?id=username
    ↓
TikTokBridge.on("gift", callback)
TikTokBridge.on("chat", callback)
    ↓
Game Logic (state machine / renderer)
    ↓
Canvas 2D / DOM
```

### Nguyên tắc thiết kế

**Tách biệt logic và rendering:**
Nên tách game engine (state machine, không có DOM) khỏi renderer (Canvas/DOM). Tham khảo `race-engine.js` và `game.js` trong Horse Racing.

**Game là pure frontend:**
Game không cần gọi API server. Toàn bộ dữ liệu TikTok đến qua `TikTokBridge.on(...)`. Server chỉ là WebSocket gateway.

**Overlay cho OBS:**
Game chạy trong browser source của OBS. Nền phải trong suốt (`background: transparent`). Không có scrollbar, không có UI tương tác (chỉ xem).

---

## Tạo game mới — Step by step

### Bước 1: Tạo thư mục game

```bash
mkdir public/games/ten-game
```

Cấu trúc file gợi ý:

```
public/games/ten-game/
├── index.html      # Entry point (dùng làm Browser Source trong OBS)
├── game.js         # Logic game + renderer
├── style.css       # Styles (nền transparent, không scrollbar)
└── config.js       # Cấu hình có thể thay đổi (optional)
```

### Bước 2: Tạo `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tên Game - TikTok Live</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <!-- Game canvas hoặc DOM elements ở đây -->
  <canvas id="gameCanvas"></canvas>

  <!-- HUD elements (nếu cần) -->
  <div id="hud"></div>

  <!-- SDK: phải load trước game.js -->
  <script src="/socket.io/socket.io.js"></script>
  <script src="/lib/tiktok-bridge.js"></script>

  <!-- Logic game -->
  <script src="game.js"></script>
</body>
</html>
```

### Bước 3: Tạo `style.css`

```css
/* Bắt buộc: nền trong suốt để OBS chromakey hoạt động */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  /* QUAN TRỌNG: background transparent cho OBS overlay */
  background: transparent;
  overflow: hidden;
}

#gameCanvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
```

### Bước 4: Tạo `game.js`

```javascript
(() => {
  // Setup canvas
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  // Resize canvas theo viewport
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  // ==========================================
  // GAME STATE
  // ==========================================
  const state = {
    score: 0,
    // ... state khác
  };

  // ==========================================
  // TIKTOK EVENTS → GAME LOGIC
  // ==========================================

  // Gift: người xem gửi gift
  TikTokBridge.on("gift", (data) => {
    // data.giftName, data.giftValue, data.giftType, data.user.nickname
    state.score += data.giftValue;
    console.log(`[Game] Gift từ ${data.user.nickname}: ${data.giftName} (+${data.giftValue})`);
  });

  // Chat: người xem gõ lệnh
  TikTokBridge.on("chat", (data) => {
    // data.comment (lowercase, trimmed), data.user.nickname
    const cmd = data.comment.trim().toLowerCase();
    if (cmd === "up") {
      // xử lý lệnh
    }
  });

  // Like: người xem nhấn like
  TikTokBridge.on("like", (data) => {
    // data.likeCount, data.totalLikeCount, data.user
  });

  // Share: người xem share stream
  TikTokBridge.on("share", (data) => {
    // data.user
  });

  // Trạng thái kết nối
  TikTokBridge.on("connected", () => {
    console.log("[Game] Đã kết nối TikTok Live");
  });

  TikTokBridge.on("disconnected", () => {
    console.log("[Game] Mất kết nối TikTok Live");
  });

  TikTokBridge.on("error", (data) => {
    console.error("[Game] Lỗi:", data.message);
  });

  // ==========================================
  // RENDER LOOP
  // ==========================================
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Vẽ game ở đây
    ctx.fillStyle = "#fff";
    ctx.font = "48px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`Score: ${state.score}`, canvas.width / 2, canvas.height / 2);
  }

  function frame() {
    draw();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  console.log("[Game] Đã tải, đợi TikTokBridge kết nối...");
})();
```

### Bước 5: Thêm vào Dashboard

Xem [Thêm game vào Dashboard](#thêm-game-vào-dashboard) bên dưới.

### Bước 6: Test

```
http://localhost:3000/games/ten-game/index.html?id=username_streamer
```

---

## TikTok Bridge SDK

`tiktok-bridge.js` là singleton `window.TikTokBridge`. Nó tự kết nối khi trang load nếu URL có `?id=username` hoặc `?username=username`.

### Auto-connect (URL params)

```
/games/ten-game/index.html?id=username_streamer
```

Bridge tự gọi `TikTokBridge.connect("username_streamer")` khi `window.load` fire.

### Manual connect

```javascript
// Nếu không dùng URL param
TikTokBridge.connect("username_streamer");

// Custom server URL (nếu server chạy port khác)
TikTokBridge.connect("username_streamer", "http://localhost:8080");
```

### Lắng nghe events

```javascript
TikTokBridge.on(eventName, callback);
```

Có thể gọi `on()` nhiều lần cho cùng event — tất cả callback đều được gọi.

---

## Event Reference

Tất cả event đều có `timestamp: number`.

### `gift`

```javascript
TikTokBridge.on("gift", (data) => {
  data.user.uniqueId        // string — TikTok ID
  data.user.nickname        // string — tên hiển thị
  data.user.profilePictureUrl // string — URL avatar
  data.giftId               // number — ID gift trong TikTok
  data.giftName             // string — tên gift (vd: "Rose", "TikTok")
  data.giftValue            // number — giá diamond (1 diamond = 0.5 coin)
  data.repeatCount          // number — số lần gửi liên tiếp (combo)
  data.giftType             // "small" | "medium" | "large"
  //   "small"  < 10 diamonds
  //   "medium" 10-99 diamonds
  //   "large"  >= 100 diamonds
  data.timestamp            // number — Unix ms
});
```

### `chat`

```javascript
TikTokBridge.on("chat", (data) => {
  data.user.uniqueId   // string
  data.user.nickname   // string
  data.comment         // string — lowercase, trimmed
  data.timestamp       // number
});
```

### `like`

```javascript
TikTokBridge.on("like", (data) => {
  data.user.uniqueId      // string
  data.user.nickname      // string
  data.likeCount          // number — số like trong batch này
  data.totalLikeCount     // number — tổng like toàn stream
  data.timestamp          // number
});
```

### `share`

```javascript
TikTokBridge.on("share", (data) => {
  data.user.uniqueId   // string
  data.user.nickname   // string
  data.timestamp       // number
});
```

### `connected`

```javascript
TikTokBridge.on("connected", (data) => {
  data.room   // string — tên room (= username)
});
```

### `disconnected` · `reconnecting` · `error`

```javascript
TikTokBridge.on("disconnected", () => { /* mất kết nối */ });

TikTokBridge.on("reconnecting", (data) => {
  data.attempt   // number — lần thử thứ mấy (1-5)
  data.delayMs   // number — thời gian chờ (ms)
});

TikTokBridge.on("error", (data) => {
  data.message   // string — mô tả lỗi
});
```

---

## Thêm game vào Dashboard

Dashboard (`public/index.html`) hiển thị danh sách game dưới dạng card. Thêm game card:

```html
<!-- public/index.html -->
<div class="game-card" data-game="ten-game" data-entry="index.html" data-param="id">
  <div class="game-icon">🎮</div>
  <div class="game-info">
    <h3>Tên Game</h3>
    <p>Mô tả ngắn về game</p>
  </div>
  <div class="game-status available">Có sẵn</div>
</div>
```

Thuộc tính `data-*`:

| Attribute | Giá trị | Ý nghĩa |
|---|---|---|
| `data-game` | `ten-game` | Tên thư mục trong `public/games/` |
| `data-entry` | `index.html` | File HTML entry point |
| `data-param` | `id` | Query param tên username (thường là `id`) |

Dashboard sẽ tạo URL: `/games/{data-game}/{data-entry}?{data-param}={username}`

---

## Best practices cho OBS Overlay

### Nền trong suốt

OBS Browser Source hỗ trợ nền trong suốt — KHÔNG cần chromakey.

```css
html, body {
  background: transparent !important;
  overflow: hidden;
}
```

### Kích thước cố định

OBS Browser Source có width/height cố định (thường 1920×1080). Thiết kế game cho 1920×1080, dùng relative units để scale:

```javascript
// Trong game.js
function resize() {
  canvas.width = window.innerWidth;   // = OBS source width
  canvas.height = window.innerHeight; // = OBS source height
}
window.addEventListener("resize", resize);
resize();
```

### Font rendering

OBS dùng Chromium embedded. Có thể dùng Google Fonts nếu máy có internet, hoặc dùng system fonts an toàn hơn:

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
```

### Performance

- Dùng `requestAnimationFrame` cho render loop (không dùng `setInterval`)
- Tránh `ctx.clearRect` trên vùng lớn nếu không cần thiết — clear đúng vùng cần vẽ
- Giữ DOM mutation tối thiểu trong render loop — batch update DOM
- Canvas 2D đủ cho game overlay (không cần WebGL trừ khi có effect phức tạp)

### Xử lý mất kết nối

Khi TikTok Live kết thúc, game không bị crash — hiển thị trạng thái chờ hoặc thông báo:

```javascript
TikTokBridge.on("disconnected", () => {
  // Hiển thị "Đang kết nối lại..." thay vì màn hình trắng
  showReconnectingOverlay();
});

TikTokBridge.on("reconnecting", ({ attempt, delayMs }) => {
  updateStatus(`Kết nối lại (${attempt}/5)...`);
});
```

---

## Ví dụ game đơn giản — Counter Game

Game đơn giản nhất: đếm số gift nhận được theo loại.

### `public/games/counter/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Gift Counter</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: transparent; overflow: hidden; font-family: Arial, sans-serif; }
    .counter { position: fixed; top: 20px; right: 20px; text-align: right; }
    .item { color: white; font-size: 24px; text-shadow: 0 2px 4px rgba(0,0,0,0.8); margin: 8px 0; }
    .count { font-size: 36px; font-weight: bold; }
    .small { color: #aaa; }
    .medium { color: #4af; }
    .large { color: #fa0; }
  </style>
</head>
<body>
  <div class="counter">
    <div class="item small">Nhỏ: <span class="count" id="small">0</span></div>
    <div class="item medium">Vừa: <span class="count" id="medium">0</span></div>
    <div class="item large">Lớn: <span class="count" id="large">0</span></div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script src="/lib/tiktok-bridge.js"></script>
  <script>
    const counts = { small: 0, medium: 0, large: 0 };

    TikTokBridge.on("gift", (data) => {
      const type = data.giftType; // "small" | "medium" | "large"
      counts[type] = (counts[type] || 0) + data.repeatCount;
      document.getElementById(type).textContent = counts[type];
    });
  </script>
</body>
</html>
```

---

## Phân tích Horse Racing Game

Horse Racing là game phức tạp nhất hiện có. Kiến trúc tách biệt rõ ràng.

### Luồng data

```
TikTokBridge.on("gift")  →  engine.handleGift(data)
TikTokBridge.on("chat")  →  engine.handleChat(data)
TikTokBridge.on("like")  →  engine.handleLike(data)
                                    ↓
                            RaceEngine (state machine)
                            state.phase, state.lanes[].distance
                                    ↓
                        requestAnimationFrame(frame)
                                    ↓
                            engine.tick()  (phase transitions)
                                    ↓
                            drawTrack(state)  (Canvas)
                            updateHUD(state)  (DOM)
```

### State Machine phases

```
WAITING
  └── first gift/chat → COUNTDOWN (10s)
                           └── countdown ends → RACING (max 120s)
                                                  ├── horse reaches 1000 → FINISHED (8s)
                                                  └── timeout → FINISHED (winner = leader)
                                                                   └── after 8s → COOLDOWN (5s)
                                                                                    └── after 5s → WAITING (reset)
```

### File `config.js`

Chứa toàn bộ cấu hình có thể thay đổi mà không cần sửa code logic:
- `lanes[]` — danh sách lane và alias chat
- `giftTiers[]` — mapping gift name → lane index
- `phases` — thời gian mỗi phase
- `finishLine` — khoảng cách để thắng (1000 units)
- `giftToDistance(value)` — công thức tính movement

---

## Tùy chỉnh Horse Racing

### Đổi quốc gia/lane

Sửa mảng `lanes` trong `config.js`:

```javascript
lanes: [
  { id: 0, name: "Brazil",  flag: "🇧🇷", color: "#00AA00", aliases: ["br", "brazil"] },
  { id: 1, name: "USA",     flag: "🇺🇸", color: "#0044FF", aliases: ["us", "usa", "america"] },
  { id: 2, name: "Japan",   flag: "🇯🇵", color: "#FF0000", aliases: ["jp", "japan"] },
  { id: 3, name: "Korea",   flag: "🇰🇷", color: "#FF6600", aliases: ["kr", "korea"] },
  { id: 4, name: "India",   flag: "🇮🇳", color: "#FF9900", aliases: ["in", "india"] },
],
```

### Đổi gift mapping

Sử dụng debug.html để xem gift name chính xác, sau đó cập nhật `giftTiers`:

```javascript
giftTiers: [
  {
    coins: 1,
    gifts: [
      { name: "Tên gift cho Brazil", emoji: "🎁" },
      { name: "Tên gift cho USA",    emoji: "🎁" },
      // ...
    ],
  },
  // ...
],
```

### Thay đổi thời gian race

```javascript
phases: {
  countdown: { duration: 15_000 }, // 15 giây thay vì 10
  racing:    { duration: 180_000 }, // 3 phút thay vì 2
  finished:  { duration: 10_000 }, // 10 giây show winner
  cooldown:  { duration: 3_000 },  // nghỉ 3 giây
},
```

### Thay đổi công thức movement

```javascript
// Tuyến tính (không diminishing returns)
giftToDistance(giftValue) {
  return giftValue * 10;
},

// Logarithmic (càng expensive gift càng ít lợi thế)
giftToDistance(giftValue) {
  return Math.round(10 * Math.log2(giftValue + 1));
},
```

### Thay đổi finish line

```javascript
finishLine: 500,  // race ngắn hơn
finishLine: 2000, // race dài hơn
```
