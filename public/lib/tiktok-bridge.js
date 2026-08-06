/**
 * tiktok-bridge.js
 * Client-side SDK kết nối HTML5 game với TikTok Live events qua Socket.io.
 *
 * Cách dùng:
 * 1. Thêm script vào game's index.html (sau socket.io.js)
 * 2. Tự kết nối nếu URL có ?id=username, hoặc gọi TikTokBridge.connect(username)
 * 3. TikTokBridge.on('gift', (data) => { ... }) để nhận events
 *
 * Events: chat, gift, like, share, connected, disconnected, reconnecting, error
 *
 * Singleton: window.TikTokBridge — chỉ có một instance cho toàn trang.
 */
((global) => {
	class TikTokBridge {
		constructor() {
			// Socket.io connection — null cho đến khi connect() được gọi
			this.socket = null;
			this.username = null;

			// Map event name → danh sách callback
			// Mỗi on() call thêm một callback vào danh sách — tất cả đều được gọi
			this.eventHandlers = {
				chat: [],
				gift: [],
				like: [],
				share: [],
				connected: [],
				disconnected: [],
				reconnecting: [],
				error: [],
			};

			// Guard: chỉ cho phép connect() được gọi một lần
			this.isInitialized = false;

			// Auto-connect: nếu URL có ?id=username hoặc ?username=username,
			// tự kết nối khi trang load xong (sau khi DOM và scripts sẵn sàng)
			window.addEventListener("load", () => {
				const params = new URLSearchParams(window.location.search);
				const user = params.get("id") || params.get("username");
				if (user) {
					console.log(`[TikTokBridge] Auto-connecting for user: ${user}`);
					this.connect(user);
				}
			});
		}

		/**
		 * Kết nối đến Socket.io server và tham gia room của streamer.
		 *
		 * Flow:
		 *   1. Kết nối Socket.io → server
		 *   2. Emit "join-room" với username
		 *   3. Server join socket vào room và bắt đầu/reuse TikTok connection
		 *   4. Các TikTok events (tiktok_chat, tiktok_gift, ...) được relay tới game
		 *
		 * @param {string} username - TikTok username của streamer
		 * @param {string} serverUrl - Socket.io server URL (mặc định: cùng origin)
		 */
		connect(username, serverUrl = window.location.origin) {
			// Guard: không kết nối lại nếu đã init, hoặc username rỗng
			if (this.isInitialized || !username) return;

			this.username = username;

			// Bước 1: Kết nối Socket.io đến server
			this.socket = io(serverUrl);

			// Bước 2: Khi socket kết nối thành công → join room của streamer
			this.socket.on("connect", () => {
				console.log("[TikTokBridge] Connected to server");
				this.socket.emit("join-room", username);
			});

			// Bước 3: Server confirm đã join room → dispatch "connected" cho game
			this.socket.on("room-joined", (data) => {
				console.log(`[TikTokBridge] Joined room: ${data.room}`);
				this._dispatch("connected", data);
			});

			// Bước 4: Relay TikTok events từ server đến game callbacks
			// Server emit "tiktok_*" → Bridge dispatch event name ngắn gọn cho game
			this.socket.on("tiktok_chat", (data) => this._dispatch("chat", data));
			this.socket.on("tiktok_gift", (data) => this._dispatch("gift", data));
			this.socket.on("tiktok_like", (data) => this._dispatch("like", data));
			this.socket.on("tiktok_share", (data) => this._dispatch("share", data));

			// Xử lý trạng thái kết nối TikTok (không phải kết nối socket)
			this.socket.on("tiktok_disconnected", () => {
				console.log("[TikTokBridge] TikTok disconnected");
				this._dispatch("disconnected");
			});

			this.socket.on("tiktok_reconnecting", (data) => {
				console.log(
					`[TikTokBridge] Reconnecting attempt ${data.attempt} in ${data.delayMs}ms`,
				);
				this._dispatch("reconnecting", data);
			});

			this.socket.on("tiktok_error", (data) => {
				console.error("[TikTokBridge] Error:", data.message);
				this._dispatch("error", data);
			});

			// Lỗi khi join room (vd: streamer không live)
			this.socket.on("connection-error", (err) => {
				console.error("[TikTokBridge] Connection error:", err.message);
				this._dispatch("error", err);
			});

			this.isInitialized = true;
		}

		/**
		 * Register event handler
		 * @param {string} event 'chat', 'gift', 'like', 'share', 'connected', 'disconnected', 'reconnecting', 'error'
		 * @param {function} callback
		 */
		on(event, callback) {
			if (this.eventHandlers[event]) {
				this.eventHandlers[event].push(callback);
			}
		}

		_dispatch(event, data) {
			if (this.eventHandlers[event]) {
				this.eventHandlers[event].forEach((handler) => {
					try {
						handler(data);
					} catch (e) {
						console.error(`[TikTokBridge] Error in ${event} handler:`, e);
					}
				});
			}
		}
	}

	// Export to global scope
	global.TikTokBridge = new TikTokBridge();
})(window);
