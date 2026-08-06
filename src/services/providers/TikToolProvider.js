/**
 * TikToolProvider.js
 *
 * Provider implementation using @tiktool/live (tik.tools).
 * Free tier: 5,000 req/day, 3 concurrent streams — https://tik.tools/pricing
 *
 * Required env: SIGN_API_KEY
 */

import { TikTokLive } from "@tiktool/live";
import { BaseTikTokProvider, NormalizedConnection } from "./BaseTikTokProvider.js";
import {
	normalizeChat,
	normalizeGift,
	normalizeLike,
	normalizeShare,
} from "../../lib/tiktokEventNormalizer.js";

class TikToolConnection extends NormalizedConnection {
	constructor(username, apiKey) {
		super();
		this._client = new TikTokLive({ uniqueId: username, apiKey });
	}

	async connect() {
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
		this._client.disconnect();
	}
}

export class TikToolProvider extends BaseTikTokProvider {
	constructor() {
		super();
		this._apiKey = process.env.SIGN_API_KEY;
		if (!this._apiKey) {
			throw new Error("SIGN_API_KEY is required for TikToolProvider. Get a free key at https://tik.tools/pricing");
		}
	}

	get name() { return "tiktool"; }

	createConnection(username) {
		return new TikToolConnection(username, this._apiKey);
	}
}
