/**
 * BaseTikTokProvider.js
 *
 * Defines the contract that all TikTok provider implementations must follow.
 *
 * NormalizedConnection is an EventEmitter that every provider returns from
 * createConnection(). It always emits the same events with the same payload
 * shapes, regardless of which underlying library is used.
 *
 * Emitted events:
 *   connected  { roomId: string, timestamp: number }
 *   disconnected
 *   error      Error
 *   chat       { user, comment, timestamp }
 *   like       { user, likeCount, totalLikeCount, timestamp }
 *   share      { user, timestamp }
 *   gift       { user, giftId, giftName, giftValue, repeatCount, giftType, timestamp }
 */

import { EventEmitter } from "events";

export class NormalizedConnection extends EventEmitter {
	/** @returns {Promise<void>} */
	async connect() {
		throw new Error("connect() not implemented");
	}

	disconnect() {
		throw new Error("disconnect() not implemented");
	}
}

export class BaseTikTokProvider {
	/** Human-readable provider name shown in logs */
	get name() {
		return "base";
	}

	/**
	 * @param {string} username
	 * @returns {NormalizedConnection}
	 */
	createConnection(username) {
		throw new Error("createConnection() not implemented");
	}
}
