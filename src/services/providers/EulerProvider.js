/**
 * EulerProvider.js
 *
 * Provider implementation using tiktok-live-connector/legacy (EulerStream).
 * Requires Business plan for webcast signing — https://www.eulerstream.com/pricing
 *
 * Required env: SIGN_API_KEY (EulerStream API key)
 */

import { WebcastPushConnection } from "tiktok-live-connector/legacy";
import { SignConfig } from "tiktok-live-connector";
import { BaseTikTokProvider, NormalizedConnection } from "./BaseTikTokProvider.js";
import {
	normalizeChat,
	normalizeGift,
	normalizeLike,
	normalizeShare,
} from "../../lib/tiktokEventNormalizer.js";

// Apply API key to EulerStream global config on module load
if (process.env.SIGN_API_KEY) {
	SignConfig.apiKey = process.env.SIGN_API_KEY;
	SignConfig.cachedInstance = undefined;
}

class EulerConnection extends NormalizedConnection {
	constructor(username) {
		super();
		this._client = new WebcastPushConnection(username, {
			processInitialData: true,
			enableExtendedGiftInfo: true,
		});
	}

	async connect() {
		const c = this._client;

		c.on("connected", (state) => {
			this.emit("connected", { roomId: state.roomId, timestamp: Date.now() });
		});

		c.on("disconnected", () => this.emit("disconnected"));

		c.on("error", (err) => {
			const message = err?.exception?.message || err?.message || String(err);
			this.emit("error", new Error(message));
		});

		c.on("chat", (data) => this.emit("chat", normalizeChat(data)));
		c.on("like", (data) => this.emit("like", normalizeLike(data)));

		// EulerStream emits share as a filtered social event
		c.on("social", (data) => {
			if (data.displayType === "pm_mt_msg_viewer_share") {
				this.emit("share", normalizeShare(data));
			}
		});

		c.on("gift", (data) => this.emit("gift", normalizeGift(data)));

		await c.connect();
	}

	disconnect() {
		try { this._client.disconnect(); } catch (_) {}
	}
}

export class EulerProvider extends BaseTikTokProvider {
	get name() { return "euler"; }

	createConnection(username) {
		return new EulerConnection(username);
	}
}
