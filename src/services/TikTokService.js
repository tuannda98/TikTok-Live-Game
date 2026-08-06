/**
 * TikTokService.js
 * Manages TikTok Live connections for multiple streamers (Multi-tenant)
 *
 * IMPORTANT - DATA ISOLATION:
 * - Each streamer has their own Socket.io Room (Room ID = username)
 * - Data from Streamer A will NEVER be sent to Streamer B
 * - Uses io.to(username).emit() to send to the CORRECT room only
 *
 * Provider is selected via TIKTOK_PROVIDER env var (default: tiktool).
 * To switch: change TIKTOK_PROVIDER in .env — no code changes needed.
 *
 * @module services/TikTokService
 */

import provider from "./providers/index.js";
import { getDelay, shouldRetry, sleep } from "../lib/tiktokReconnectPolicy.js";

class TikTokService {
	constructor() {
		if (TikTokService.instance) {
			return TikTokService.instance;
		}
		TikTokService.instance = this;

		/** @type {Map<string, {connection: import('./providers/BaseTikTokProvider.js').NormalizedConnection, lastActivity: number}>} */
		this.connections = new Map();

		/** @type {Map<string, number>} */
		this.roomClients = new Map();

		/** @type {Map<string, {attempting: boolean, attempt: number}>} */
		this.reconnectState = new Map();

		this.cleanupInterval = setInterval(
			() => this.checkInactiveConnections(),
			60000,
		);
	}

	/**
	 * Connect to a streamer's TikTok Live.
	 * Reuses existing connection if one already exists for this username.
	 *
	 * @param {string} username - TikTok username (also used as Room ID)
	 * @param {import('socket.io').Server} io
	 * @returns {Promise<boolean>}
	 */
	async connect(username, io) {
		if (this.connections.has(username)) {
			console.log(`[TikTokService] Reusing existing connection for: ${username}`);
			this.connections.get(username).lastActivity = Date.now();
			return true;
		}

		console.log(`[TikTokService] Creating new connection for: ${username}`);

		try {
			const conn = provider.createConnection(username);

			this.connections.set(username, { connection: conn, lastActivity: Date.now() });
			this.reconnectState.delete(username);

			// ── Connection lifecycle ──────────────────────────────────────────

			conn.on("connected", ({ roomId }) => {
				console.log(`[TikTokService] Connected to live: ${username} (room ${roomId})`);
				io.to(username).emit("tiktok_connected", { roomId, timestamp: Date.now() });
			});

			conn.on("disconnected", () => {
				console.log(`[TikTokService] Disconnected from: ${username}`);
				this.connections.delete(username);
				io.to(username).emit("tiktok_disconnected", { timestamp: Date.now() });

				if (this.getClientCount(username) > 0) {
					this._scheduleReconnect(username, io);
				}
			});

			conn.on("error", (err) => {
				console.error(`[TikTokService] Error for ${username}:`, err.message);
				io.to(username).emit("tiktok_error", { message: err.message, timestamp: Date.now() });
			});

			// ── Data events (payloads already normalized by provider) ─────────

			conn.on("chat", (payload) => {
				this.updateActivity(username);
				io.to(username).emit("tiktok_chat", payload);
			});

			conn.on("like", (payload) => {
				this.updateActivity(username);
				io.to(username).emit("tiktok_like", payload);
				console.log(`[${username}] Like from ${payload.user.nickname}: ×${payload.likeCount}`);
			});

			conn.on("share", (payload) => {
				this.updateActivity(username);
				io.to(username).emit("tiktok_share", payload);
				console.log(`[${username}] Share from ${payload.user.nickname}`);
			});

			conn.on("gift", (payload) => {
				this.updateActivity(username);
				io.to(username).emit("tiktok_gift", payload);
				console.log(`[${username}] Gift from ${payload.user.nickname}: ${payload.giftName} ×${payload.repeatCount} (${payload.giftType}, ${payload.giftValue}💎)`);
			});

			await conn.connect();
			return true;
		} catch (error) {
			console.error(`[TikTokService] Cannot connect to ${username}:`, error.message);
			this.connections.delete(username);
			return false;
		}
	}

	/**
	 * Exponential-backoff reconnect loop.
	 * Skips if a loop is already running for this username.
	 */
	async _scheduleReconnect(username, io) {
		const state = this.reconnectState.get(username);
		if (state?.attempting) return;

		let attempt = 0;
		this.reconnectState.set(username, { attempting: true, attempt });

		while (shouldRetry(attempt)) {
			if (this.getClientCount(username) === 0) {
				console.log(`[TikTokService] Reconnect aborted for ${username}: 0 clients`);
				break;
			}
			if (this.connections.has(username)) {
				console.log(`[TikTokService] Reconnect aborted for ${username}: already connected`);
				break;
			}

			const delay = getDelay(attempt);
			console.log(`[TikTokService] Reconnect attempt ${attempt + 1} for ${username} in ${delay}ms`);
			io.to(username).emit("tiktok_reconnecting", {
				attempt: attempt + 1,
				delayMs: delay,
				timestamp: Date.now(),
			});

			await sleep(delay);

			const ok = await this.connect(username, io);
			if (ok) {
				console.log(`[TikTokService] Reconnected to ${username} on attempt ${attempt + 1}`);
				this.reconnectState.delete(username);
				return;
			}

			attempt++;
			this.reconnectState.set(username, { attempting: true, attempt });
		}

		console.error(`[TikTokService] Reconnect failed for ${username} after ${attempt} attempts`);
		io.to(username).emit("tiktok_error", {
			message: `Reconnect failed after ${attempt} attempts. Streamer may have ended the live.`,
			timestamp: Date.now(),
		});
		this.reconnectState.delete(username);
	}

	/**
	 * Disconnect a streamer and cancel any pending reconnect.
	 * @param {string} username
	 */
	disconnect(username) {
		this.reconnectState.delete(username);

		if (this.connections.has(username)) {
			const { connection } = this.connections.get(username);
			connection.disconnect();
			this.connections.delete(username);
			console.log(`[TikTokService] Disconnected: ${username}`);
		}
	}

	updateActivity(username) {
		if (this.connections.has(username)) {
			this.connections.get(username).lastActivity = Date.now();
		}
	}

	addClientToRoom(username) {
		const count = this.roomClients.get(username) || 0;
		this.roomClients.set(username, count + 1);
		console.log(`[TikTokService] Room ${username}: ${count + 1} clients`);
	}

	removeClientFromRoom(username) {
		const count = this.roomClients.get(username) || 0;
		if (count > 0) {
			this.roomClients.set(username, count - 1);
			console.log(`[TikTokService] Room ${username}: ${count - 1} clients`);
		}
	}

	getClientCount(username) {
		return this.roomClients.get(username) || 0;
	}

	checkInactiveConnections() {
		const TIMEOUT = 5 * 60 * 1000;
		const now = Date.now();

		for (const [username, data] of this.connections.entries()) {
			const timeSinceActivity = now - data.lastActivity;
			if (this.getClientCount(username) === 0 && timeSinceActivity > TIMEOUT) {
				console.log(`[TikTokService] Auto-disconnect ${username} (inactive ${Math.round(timeSinceActivity / 1000)}s)`);
				this.disconnect(username);
			}
		}
	}

	getStats() {
		return {
			provider: provider.name,
			activeConnections: this.connections.size,
			connections: Array.from(this.connections.keys()),
			rooms: Object.fromEntries(this.roomClients),
		};
	}
}

export default new TikTokService();
