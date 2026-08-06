/**
 * SessionProvider.js
 *
 * Provider hoàn toàn MIỄN PHÍ — không cần API key từ service bên ngoài.
 *
 * Cơ chế hoạt động:
 *   1. Fetch trang `tiktok.com/@username/live` như một browser thông thường
 *   2. Trích xuất roomId từ JSON nhúng trong HTML (thẻ <script id="SIGI_STATE">)
 *   3. Trích xuất ttwid từ Set-Cookie header của response
 *   4. Truyền roomId + ttwid vào @tiktool/live dưới dạng "presets" —
 *      thư viện bỏ qua sign server, kết nối trực tiếp WebSocket của TikTok
 *
 * Rủi ro: TikTok đôi khi thay đổi cấu trúc HTML hoặc tên cookie.
 * Nếu kết nối thất bại, kiểm tra log [SessionProvider] để debug.
 *
 * Env vars (optional):
 *   TIKTOK_SESSION_ID — sessionid cookie từ TikTok đã đăng nhập trên browser
 *   TIKTOK_TT_IDC     — tt-target-idc cookie (bắt buộc đi kèm SESSION_ID)
 *
 * Chế độ có session: kết nối ổn định hơn, vào được members-only live.
 * Chế độ không session (anonymous): phần lớn live public đều dùng được.
 */

import { TikTokLive } from "@tiktool/live";
import { BaseTikTokProvider, NormalizedConnection } from "./BaseTikTokProvider.js";
import {
	normalizeChat,
	normalizeGift,
	normalizeLike,
	normalizeShare,
} from "../../lib/tiktokEventNormalizer.js";

const DEFAULT_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Lấy roomId và ttwid trực tiếp từ trang TikTok Live.
 * Không cần API key — chỉ là HTTP request thông thường.
 *
 * Bước 1: Fetch HTML của trang live
 * Bước 2: Trích ttwid từ Set-Cookie header
 * Bước 3: Trích roomId từ JSON nhúng trong thẻ SIGI_STATE
 *
 * @param {string} username
 * @param {string} [sessionCookie] - Optional: "sessionid=xxx; tt-target-idc=yyy"
 * @returns {Promise<{roomId: string, ttwid: string}>}
 */
async function fetchTikTokPresets(username, sessionCookie) {
	// Giả lập browser để TikTok không block request
	const headers = {
		"User-Agent": DEFAULT_UA,
		"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		"Accept-Language": "en-US,en;q=0.9",
	};
	if (sessionCookie) {
		headers["Cookie"] = sessionCookie;
	}

	// Bước 1: Fetch trang live
	const response = await fetch(`https://www.tiktok.com/@${username}/live`, { headers });

	if (!response.ok) {
		throw new Error(`Failed to fetch TikTok live page: HTTP ${response.status}`);
	}

	// Bước 2: Trích ttwid từ Set-Cookie header
	// Dùng getSetCookie() thay vì get("set-cookie") để tránh split nhầm
	// trên dấu phẩy trong giá trị cookie (vd: expires=Tue, 01 Jan 2030...)
	let ttwid = "";
	const setCookies = typeof response.headers.getSetCookie === "function"
		? response.headers.getSetCookie()
		: (response.headers.get("set-cookie") || "").split(/,(?=[^ ])/);
	for (const cookie of setCookies) {
		if (cookie.trimStart().startsWith("ttwid=")) {
			ttwid = cookie.trim().split(";")[0].split("=").slice(1).join("=");
			break;
		}
	}

	// Bước 3: Trích roomId từ JSON trong thẻ <script id="SIGI_STATE">
	// TikTok nhúng toàn bộ app state vào thẻ này — roomId nằm trong đó
	let roomId = "";
	const html = await response.text();
	const sigiMatch = html.match(/id="SIGI_STATE"[^>]*>([^<]+)/);
	if (sigiMatch) {
		try {
			// Re-stringify để flatten rồi dùng regex tìm roomId
			const jsonStr = JSON.stringify(JSON.parse(sigiMatch[1]));
			const m = jsonStr.match(/"roomId"\s*:\s*"(\d+)"/);
			if (m) roomId = m[1];
		} catch {
			// ignore parse error — roomId sẽ là "" và lỗi sẽ được throw bên dưới
		}
	}

	// Log preview HTML để debug nếu parse thất bại (TikTok thay đổi cấu trúc)
	console.log("[SessionProvider] HTML preview:", html.slice(0, 1000).replace(/\s+/g, " "));
	console.log(`[SessionProvider] Presets: roomId=${roomId || "(none)"}, ttwid=${ttwid ? "✅" : "❌ not found"}`);

	if (!roomId) {
		throw new Error(`@${username} is not currently live (or profile is private).`);
	}

	return { roomId, ttwid };
}

class SessionConnection extends NormalizedConnection {
	constructor(username, sessionCookie) {
		super();
		this._username = username;
		this._sessionCookie = sessionCookie;
		this._client = null;
	}

	async connect() {
		console.log(`[SessionProvider] Fetching presets for @${this._username} directly from TikTok...`);

		// Bước 1: Lấy roomId + ttwid từ trang TikTok (không qua sign server)
		const { roomId, ttwid } = await fetchTikTokPresets(this._username, this._sessionCookie);

		console.log(`[SessionProvider] Got roomId=${roomId}, ttwid=✅ (no sign server used)`);

		// Bước 2: Khởi tạo @tiktool/live với roomId + ttwid đã biết sẵn
		// apiKey syntactically bắt buộc nhưng không được gọi — thư viện bỏ qua
		// sign server khi đã có roomId + sessionId (ttwid đóng vai trò session token)
		this._client = new TikTokLive({
			uniqueId: this._username,
			apiKey: "session-provider-no-key",
			roomId,
			sessionId: ttwid,
		});

		const c = this._client;

		c.on("roomInfo", (state) => {
			this.emit("connected", { roomId: state.roomId, timestamp: Date.now() });
		});

		c.on("disconnected", () => this.emit("disconnected"));

		c.on("error", (err) => {
			this.emit("error", err instanceof Error ? err : new Error(String(err)));
		});

		c.on("chat",  (data) => this.emit("chat",  normalizeChat(data)));
		c.on("like",  (data) => this.emit("like",  normalizeLike(data)));
		c.on("share", (data) => this.emit("share", normalizeShare(data)));
		c.on("gift",  (data) => this.emit("gift",  normalizeGift(data)));

		await c.connect();
	}

	disconnect() {
		this._client?.disconnect();
	}
}

export class SessionProvider extends BaseTikTokProvider {
	constructor() {
		super();
		const sessionId = process.env.TIKTOK_SESSION_ID;
		const ttTargetIdc = process.env.TIKTOK_TT_IDC;

		// Build cookie string for authenticated access (optional)
		if (sessionId && ttTargetIdc) {
			this._sessionCookie = `sessionid=${sessionId}; tt-target-idc=${ttTargetIdc}`;
			console.log("[SessionProvider] Authenticated mode: using TikTok session cookie");
		} else if (sessionId) {
			console.warn("[SessionProvider] TIKTOK_SESSION_ID set but TIKTOK_TT_IDC missing — running anonymous");
			this._sessionCookie = null;
		} else {
			this._sessionCookie = null;
			console.log("[SessionProvider] Anonymous mode: fetching ttwid from TikTok page");
		}
	}

	get name() { return "session"; }

	createConnection(username) {
		return new SessionConnection(username, this._sessionCookie);
	}
}
