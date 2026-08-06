/**
 * config.js
 * Horse Racing — toàn bộ cấu hình game ở đây.
 *
 * Để tùy chỉnh game, chỉ cần sửa file này:
 *   1. horses   — tên, icon, màu của từng ngựa
 *   2. giftRules  — gift nào → ngựa nào nhận điểm
 *   3. chatCommands — lệnh chat nào → action gì
 *   4. phases   — thời gian từng giai đoạn
 *   5. finishLine / voteDistance / giftToDistance — cơ chế tính điểm
 *
 * @module games/horse-racing/config
 */

const CONFIG = {
	// ==========================================
	// 1. HORSES — tên, icon (emoji), màu
	// ==========================================
	horses: [
		{ id: 0, name: "Vietnam",   icon: "🇻🇳", color: "#FF4444" },
		{ id: 1, name: "Thailand",  icon: "🇹🇭", color: "#4488FF" },
		{ id: 2, name: "Indonesia", icon: "🇮🇩", color: "#44DD44" },
		{ id: 3, name: "Malaysia",  icon: "🇲🇾", color: "#FFCC00" },
		{ id: 4, name: "China",     icon: "🇨🇳", color: "#CC44FF" },
	],

	// ==========================================
	// 2. GIFT RULES — gift nào vào ngựa nào
	//
	// giftName : tên chính xác của gift trên TikTok (dùng debug.html để xem)
	// horseId  : id của ngựa trong mảng horses bên trên (0-4)
	// emoji    : emoji hiển thị trong event feed
	// ==========================================
	giftRules: [
		// --- 1 coin ---
		{ giftName: "Rose",           horseId: 0, emoji: "🌹" },
		{ giftName: "GG",             horseId: 1, emoji: "✌️" },
		{ giftName: "Ice Cream Cone", horseId: 2, emoji: "🍦" },
		{ giftName: "Finger Heart",   horseId: 3, emoji: "🫰" },
		{ giftName: "TikTok",         horseId: 4, emoji: "🎵" },
		{ giftName: "Headphone",      horseId: 1, emoji: "🎧" },
		{ giftName: "You're awesome", horseId: 4, emoji: "☀️" },
		// --- 5 coins ---
		{ giftName: "Hand Heart",     horseId: 0, emoji: "💕" },
		{ giftName: "Little Crown",   horseId: 1, emoji: "👑" },
		{ giftName: "Butterfly",      horseId: 2, emoji: "🦋" },
		{ giftName: "Love You",       horseId: 3, emoji: "💗" },
		{ giftName: "Wishing Bottle", horseId: 4, emoji: "🧴" },
		// --- 10 coins ---
		{ giftName: "Perfume",        horseId: 0, emoji: "💐" },
		{ giftName: "Doughnut",       horseId: 1, emoji: "🍩" },
		{ giftName: "Cap",            horseId: 2, emoji: "🧢" },
		{ giftName: "Paper Crane",    horseId: 3, emoji: "🕊️" },
		{ giftName: "Sunglasses",     horseId: 4, emoji: "🕶️" },
		// --- 99 coins ---
		{ giftName: "Garland",        horseId: 0, emoji: "🏵️" },
		{ giftName: "Singing Mic",    horseId: 1, emoji: "🎤" },
		{ giftName: "Star",           horseId: 2, emoji: "⭐" },
		{ giftName: "Concert",        horseId: 3, emoji: "🎸" },
		{ giftName: "Lock and Key",   horseId: 4, emoji: "🔐" },
	],

	// ==========================================
	// 3. CHAT COMMANDS — lệnh chat → action
	//
	// keywords : danh sách từ khóa (không phân biệt hoa thường)
	// action   : "vote" = cộng điểm cho ngựa
	// horseId  : id ngựa nhận điểm (theo mảng horses)
	// ==========================================
	chatCommands: [
		{ keywords: ["1", "vn", "vietnam", "viet"],          action: "vote", horseId: 0 },
		{ keywords: ["2", "th", "tl", "thailand", "thai"],   action: "vote", horseId: 1 },
		{ keywords: ["3", "id", "indonesia", "indo"],        action: "vote", horseId: 2 },
		{ keywords: ["4", "my", "ml", "malaysia", "malay"],  action: "vote", horseId: 3 },
		{ keywords: ["5", "cn", "china", "trung quoc"],      action: "vote", horseId: 4 },
	],

	// ==========================================
	// 4. PHASES & TIMING (ms)
	// ==========================================
	phases: {
		waiting:   { duration: Infinity },
		countdown: { duration: 10_000 },
		racing:    { duration: 120_000 },
		finished:  { duration: 8_000 },
		cooldown:  { duration: 5_000 },
	},

	// ==========================================
	// 5. CƠ CHẾ TÍNH ĐIỂM
	// ==========================================

	/** Khoảng cách cần đạt để thắng */
	finishLine: 1000,

	/** Điểm cộng khi vote bằng chat */
	voteDistance: 3,

	/**
	 * Công thức chuyển đổi giá trị gift (coins) → điểm di chuyển.
	 * Diminishing returns: gift đắt hơn tốt hơn nhưng không tuyến tính.
	 */
	giftToDistance(coins) {
		return Math.round(5 + 3 * Math.sqrt(coins));
	},

	// ==========================================
	// INTERNAL HELPERS — không cần chỉnh
	// ==========================================

	/**
	 * Tìm horseId từ tên gift. Fallback: giftId % số ngựa.
	 * @returns {number} horseId
	 */
	resolveGift(giftName, giftId) {
		if (!this._giftMap) {
			this._giftMap = {};
			for (const rule of this.giftRules) {
				this._giftMap[rule.giftName.toLowerCase()] = rule.horseId;
			}
		}
		const key = (giftName || "").toLowerCase();
		if (key && this._giftMap[key] !== undefined) {
			return this._giftMap[key];
		}
		return Math.abs(giftId || 0) % this.horses.length;
	},

	/**
	 * Tìm command từ text chat.
	 * @returns {{ action: string, horseId: number } | null}
	 */
	resolveCommand(text) {
		if (!this._commandMap) {
			this._commandMap = {};
			for (const cmd of this.chatCommands) {
				for (const kw of cmd.keywords) {
					this._commandMap[kw.toLowerCase()] = cmd;
				}
			}
		}
		const key = (text || "").toLowerCase().trim();
		return this._commandMap[key] ?? null;
	},

	/**
	 * Lấy emoji của gift theo tên (cho event feed).
	 * @returns {string}
	 */
	getGiftEmoji(giftName) {
		if (!this._emojiMap) {
			this._emojiMap = {};
			for (const rule of this.giftRules) {
				this._emojiMap[rule.giftName.toLowerCase()] = rule.emoji;
			}
		}
		return this._emojiMap[(giftName || "").toLowerCase()] || "🎁";
	},

	/**
	 * Lấy tất cả emoji gift của một ngựa (cho HUD legend).
	 * @returns {string[]}
	 */
	getHorseGiftEmojis(horseId) {
		return this.giftRules
			.filter((r) => r.horseId === horseId)
			.map((r) => r.emoji);
	},
};

if (typeof module !== "undefined" && module.exports) {
	module.exports = CONFIG;
} else {
	window.RACE_CONFIG = CONFIG;
}
