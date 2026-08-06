# Hướng dẫn Vận hành

Tài liệu này hướng dẫn deploy, monitor, và vận hành TikTok Live Games server.

---

## Mục lục

1. [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
2. [Cài đặt Production](#cài-đặt-production)
3. [Cấu hình môi trường](#cấu-hình-môi-trường)
4. [Chạy với PM2](#chạy-với-pm2)
5. [Cấu hình Nginx](#cấu-hình-nginx)
6. [Monitor và Logging](#monitor-và-logging)
7. [Troubleshooting](#troubleshooting)
8. [Bảo mật](#bảo-mật)

---

## Yêu cầu hệ thống

| Resource | Tối thiểu | Khuyến nghị |
|---|---|---|
| CPU | 1 vCore | 2 vCore |
| RAM | 512 MB | 1 GB |
| Disk | 1 GB | 5 GB (cho logs) |
| OS | Ubuntu 20.04+ / macOS 12+ | Ubuntu 22.04 LTS |
| Node.js | 18.0.0 | 20 LTS |
| Port | 3000 (hoặc tùy chỉnh) | — |

---

## Cài đặt Production

### 1. Cài Node.js

```bash
# Ubuntu (dùng NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Kiểm tra
node --version  # v20.x.x
npm --version   # 10.x.x
```

### 2. Clone và cài dependencies

```bash
git clone https://github.com/tuannda98/TikTok-Live-Game.git
cd tiktok-live-games
npm install --production
```

### 3. Tạo file `.env`

```bash
cp .env.example .env
nano .env
```

Điền các giá trị thực. Xem [Cấu hình môi trường](#cấu-hình-môi-trường) bên dưới.

### 4. Test chạy thủ công

```bash
npm start
```

Kiểm tra output:
```
TikTok Live Games - Open Source Platform
Server running at: → http://localhost:3000
```

Truy cập `http://your-server-ip:3000/api/health` để confirm.

---

## Cấu hình môi trường

Tạo file `.env` với các biến sau:

```env
# ==========================================
# TIKTOK PROVIDER
# ==========================================
# session  — Miễn phí, không cần API key (phù hợp cho cá nhân)
# tiktool  — Free tier từ tik.tools (cần SIGN_API_KEY)
# euler    — Trả phí từ EulerStream (cần SIGN_API_KEY)
TIKTOK_PROVIDER=session

# API key (bỏ qua nếu dùng session provider)
# SIGN_API_KEY=your_key_here

# ==========================================
# SERVER
# ==========================================
PORT=3000

# ==========================================
# SESSION PROVIDER (optional)
# Chỉ cần nếu TIKTOK_PROVIDER=session và muốn kết nối ổn định hơn
# ==========================================
# TIKTOK_SESSION_ID=your_sessionid_cookie
# TIKTOK_TT_IDC=your_tt-target-idc_cookie
```

---

## Chạy với PM2

PM2 là process manager giữ server chạy liên tục và tự restart khi crash.

### Cài PM2

```bash
npm install -g pm2
```

### Tạo file cấu hình PM2

Tạo `ecosystem.config.js` ở thư mục project:

```javascript
module.exports = {
  apps: [{
    name: "tiktok-live-games",
    script: "src/server.js",

    // Đọc .env file
    env_file: ".env",

    // Node.js options
    node_args: "--env-file=.env",

    // Restart tự động khi crash
    autorestart: true,
    watch: false,

    // Giới hạn memory (restart nếu vượt quá)
    max_memory_restart: "500M",

    // Log
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    out_file: "logs/out.log",
    error_file: "logs/error.log",
    merge_logs: true,
  }]
};
```

> **Lưu ý**: `node --env-file=.env` yêu cầu Node.js 18.3+. Nếu cần hỗ trợ phiên bản cũ hơn, dùng package `dotenv`.

### Tạo thư mục logs

```bash
mkdir -p logs
```

### Khởi động với PM2

```bash
pm2 start ecosystem.config.js
pm2 save              # Lưu danh sách process
pm2 startup           # Tự start khi reboot
# Chạy lệnh mà PM2 in ra để enable startup
```

### Các lệnh PM2 hay dùng

```bash
pm2 status            # Xem trạng thái tất cả process
pm2 logs tiktok-live-games  # Xem logs real-time
pm2 restart tiktok-live-games  # Restart server
pm2 stop tiktok-live-games     # Dừng server
pm2 delete tiktok-live-games   # Xóa process
pm2 monit             # Dashboard monitor
```

### Deploy code mới

```bash
git pull origin main
npm install --production
pm2 restart tiktok-live-games
```

---

## Cấu hình Nginx

Dùng Nginx làm reverse proxy để: ẩn port, hỗ trợ HTTPS, WebSocket.

### Cài Nginx

```bash
sudo apt-get install -y nginx
```

### Cấu hình site

Tạo `/etc/nginx/sites-available/tiktok-live-games`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # WebSocket support (bắt buộc cho Socket.io)
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # HTTP requests
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Enable site

```bash
sudo ln -s /etc/nginx/sites-available/tiktok-live-games /etc/nginx/sites-enabled/
sudo nginx -t    # Kiểm tra config
sudo systemctl reload nginx
```

### HTTPS với Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot tự động cập nhật cấu hình Nginx để dùng HTTPS và tự renew certificate.

---

## Monitor và Logging

### Health Check endpoint

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-08-06T10:00:00.000Z",
  "stats": {
    "provider": "session",
    "activeConnections": 3,
    "connections": ["streamer_a", "streamer_b", "streamer_c"],
    "rooms": {
      "streamer_a": 2,
      "streamer_b": 1,
      "streamer_c": 1
    }
  }
}
```

### Xem logs real-time

```bash
# PM2 logs
pm2 logs tiktok-live-games --lines 100

# Log file trực tiếp
tail -f logs/out.log
tail -f logs/error.log
```

### Log format

Server log dùng prefix để dễ filter:

```
[Socket] Client connected: abc123
[TikTokService] Creating new connection for: streamer_name
[SessionProvider] Fetching presets for @streamer_name directly from TikTok...
[SessionProvider] Got roomId=123456789, ttwid=✅ (no sign server used)
[TikTokService] Connected to live: streamer_name (room 123456789)
[streamer_name] Gift from viewer: Rose ×1 (small, 1💎)
[TikTokService] Auto-disconnect streamer_name (inactive 305s)
```

### Cron health check

Tạo script `/usr/local/bin/check-tiktok-games.sh`:

```bash
#!/bin/bash
HEALTH=$(curl -sf http://localhost:3000/api/health 2>/dev/null)
if [ $? -ne 0 ]; then
  echo "[$(date)] Server down, restarting..."
  pm2 restart tiktok-live-games
fi
```

```bash
chmod +x /usr/local/bin/check-tiktok-games.sh
# Thêm vào crontab: kiểm tra mỗi 5 phút
(crontab -l; echo "*/5 * * * * /usr/local/bin/check-tiktok-games.sh") | crontab -
```

---

## Troubleshooting

### Server không start

**Kiểm tra Node.js version:**
```bash
node --version  # Phải >= 18
```

**Kiểm tra port đã bị dùng chưa:**
```bash
lsof -i :3000
# Nếu có process khác, kill hoặc đổi PORT trong .env
```

**Xem chi tiết lỗi:**
```bash
npm start 2>&1 | head -50
```

---

### Không kết nối được TikTok

**Streamer không LIVE:**
```
Cannot connect to streamer. Make sure they are currently streaming!
```
→ Kiểm tra streamer có đang live không.

**Session provider lỗi parse:**
```
[SessionProvider] HTML preview: <!DOCTYPE html>...
@username is not currently live (or profile is private).
```
→ TikTok có thể đã thay đổi cấu trúc HTML. Xem phần `fetchTikTokPresets` trong `SessionProvider.js` để cập nhật regex.

**Tiktool API key hết quota:**
```
[TikTokService] Error for username: API rate limit exceeded
```
→ Kiểm tra quota trên dashboard tik.tools. Free tier: 5,000 req/ngày.

---

### WebSocket không kết nối

**CORS error trong browser:**
Server đang cho phép `origin: "*"` — nếu vẫn bị CORS, kiểm tra Nginx có pass `Upgrade` header không.

**Socket.io timeout:**
Kiểm tra Nginx config có phần `proxy_set_header Upgrade $http_upgrade` và `Connection "upgrade"` không.

---

### Memory tăng cao

Server có thể rò memory nếu connections không được cleanup đúng. Kiểm tra:

```bash
curl http://localhost:3000/api/stats
```

Nếu `activeConnections` tăng mãi không giảm, có thể `checkInactiveConnections()` không hoạt động. Kiểm tra log có dòng `Auto-disconnect` không.

Restart tạm thời:
```bash
pm2 restart tiktok-live-games
```

---

## Bảo mật

### Server local (dùng cho OBS cá nhân)

Nếu chỉ chạy locally cho bản thân:
- Giữ nguyên cấu hình hiện tại
- Không cần expose ra internet
- OBS Browser Source kết nối qua `localhost:3000`

### Expose ra internet

Nếu muốn nhiều người dùng cùng lúc:

**Dùng HTTPS:**
TikTok không cho phép kết nối từ HTTP page. OBS Browser Source chạy Chromium — thường chấp nhận localhost HTTP.

**Rate limiting:**
Thêm rate limit cho Socket.io để tránh spam join-room:

```javascript
// server.js — thêm giới hạn join-room per socket
const joinCount = new Map();
socket.on("join-room", async (username) => {
  const count = joinCount.get(socket.id) || 0;
  if (count >= 5) {
    socket.emit("error", { message: "Too many room joins" });
    return;
  }
  joinCount.set(socket.id, count + 1);
  // ... xử lý tiếp
});
```

**Không expose debug.html:**
Trang debug.html cho thấy tất cả events — nên block nếu expose server public.

```nginx
# Nginx: block debug.html với auth
location /debug.html {
    auth_basic "Debug";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://localhost:3000;
}
```

**Không commit `.env`:**
File `.env` đã được liệt kê trong `.gitignore`. Kiểm tra trước khi push:
```bash
git status  # .env không được xuất hiện
```
