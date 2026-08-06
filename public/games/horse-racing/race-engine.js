/**
 * race-engine.js
 * Pure state machine for Horse Racing.
 * NO DOM, NO Canvas — just data in, state out.
 *
 * Phases: WAITING → COUNTDOWN → RACING → FINISHED → COOLDOWN → WAITING
 *
 * Engine đọc config.horses, config.resolveGift(), config.resolveCommand()
 * để xử lý event — không có logic hard-code nào ở đây.
 *
 * @module games/horse-racing/race-engine
 */

class RaceEngine {
	constructor(config) {
		this.config = config;
		this.listeners = {};
		this.reset();
	}

	// ==========================================
	// STATE
	// ==========================================

	reset() {
		this.state = {
			phase: "waiting",
			phaseStartedAt: Date.now(),
			horses: this.config.horses.map((horse) => ({
				...horse,
				distance: 0,
				supporters: new Map(), // uniqueId → { nickname, totalContrib }
			})),
			winner: null,
			raceCount: this.state?.raceCount || 0,
			recentEvents: [],
		};
		this._emit("phaseChange", { phase: "waiting" });
	}

	// ==========================================
	// PHASE TRANSITIONS
	// ==========================================

	_setPhase(nextPhase) {
		this.state.phase = nextPhase;
		this.state.phaseStartedAt = Date.now();
		this._emit("phaseChange", { phase: nextPhase });
	}

	phaseElapsed() {
		return Date.now() - this.state.phaseStartedAt;
	}

	phaseRemaining() {
		const dur = this.config.phases[this.state.phase]?.duration ?? Infinity;
		if (dur === Infinity) return Infinity;
		return Math.max(0, dur - this.phaseElapsed());
	}

	// ==========================================
	// TICK — call from requestAnimationFrame
	// ==========================================

	tick() {
		const { phase } = this.state;
		const remaining = this.phaseRemaining();

		if (phase === "countdown" && remaining <= 0) {
			this._setPhase("racing");
		} else if (phase === "racing" && remaining <= 0) {
			this._resolveWinner();
		} else if (phase === "finished" && remaining <= 0) {
			this._setPhase("cooldown");
		} else if (phase === "cooldown" && remaining <= 0) {
			this.state.raceCount++;
			this.reset();
		}

		return this.state;
	}

	// ==========================================
	// EVENT HANDLERS
	// ==========================================

	/**
	 * Xử lý gift event.
	 * Config.resolveGift() quyết định ngựa nào nhận điểm.
	 */
	handleGift(data) {
		const { phase } = this.state;

		if (phase === "waiting") {
			this._setPhase("countdown");
		}

		if (phase === "countdown" || phase === "racing") {
			const horseId = this.config.resolveGift(data.giftName, data.giftId);
			const distance = this.config.giftToDistance(data.giftValue);

			this._moveHorse(horseId, distance, data.user, {
				type: "gift",
				giftName: data.giftName || "",
				giftEmoji: this.config.getGiftEmoji(data.giftName),
			});

			if (phase === "racing") this._checkFinish();
		}
	}

	/**
	 * Xử lý chat event.
	 * Config.resolveCommand() quyết định action (vote, v.v.)
	 */
	handleChat(data) {
		const { phase } = this.state;
		const text = (data.comment || "").trim();

		const cmd = this.config.resolveCommand(text);

		if (cmd) {
			if (phase === "waiting") {
				this._setPhase("countdown");
			}

			if (phase === "countdown" || phase === "racing") {
				if (cmd.action === "vote") {
					const distance = this.config.voteDistance || 3;
					const horse = this.state.horses[cmd.horseId];
					this._moveHorse(cmd.horseId, distance, data.user, {
						type: "vote",
						comment: text,
						horseIcon: horse?.icon || "",
					});
					if (phase === "racing") this._checkFinish();
				}
			}
		} else {
			// Không khớp command nào — hiển thị trên feed
			this._addRecentEvent({
				type: "chat",
				nickname: data.user.nickname,
				text,
			});
		}
	}

	handleLike(data) {
		this._addRecentEvent({
			type: "like",
			nickname: data.user.nickname,
			count: data.likeCount,
		});
	}

	// ==========================================
	// INTERNAL
	// ==========================================

	_moveHorse(horseId, distance, user, eventExtra) {
		const horse = this.state.horses[horseId];
		if (!horse) return;

		horse.distance = Math.min(horse.distance + distance, this.config.finishLine);

		const existing = horse.supporters.get(user.uniqueId);
		if (existing) {
			existing.totalContrib += distance;
		} else {
			horse.supporters.set(user.uniqueId, {
				nickname: user.nickname,
				totalContrib: distance,
			});
		}

		if (eventExtra.type === "vote") {
			this._addRecentEvent({
				type: "vote",
				nickname: user.nickname,
				horseIcon: eventExtra.horseIcon,
				horseName: horse.name,
				distance,
				comment: eventExtra.comment,
			});
		} else {
			this._addRecentEvent({
				type: "gift",
				nickname: user.nickname,
				horseIcon: horse.icon,
				horseName: horse.name,
				distance,
				giftName: eventExtra.giftName,
				giftEmoji: eventExtra.giftEmoji,
			});
		}

		this._emit("horseMove", { horseId, distance, horse, user });
	}

	_checkFinish() {
		for (const horse of this.state.horses) {
			if (horse.distance >= this.config.finishLine) {
				this.state.winner = horse;
				this._setPhase("finished");
				this._emit("raceFinished", { winner: horse });
				return;
			}
		}
	}

	_resolveWinner() {
		let best = this.state.horses[0];
		for (const horse of this.state.horses) {
			if (horse.distance > best.distance) best = horse;
		}
		this.state.winner = best;
		this._setPhase("finished");
		this._emit("raceFinished", { winner: best });
	}

	_addRecentEvent(evt) {
		evt.timestamp = Date.now();
		this.state.recentEvents.unshift(evt);
		if (this.state.recentEvents.length > 20) {
			this.state.recentEvents.length = 20;
		}
	}

	// ==========================================
	// EVENT EMITTER
	// ==========================================

	on(event, fn) {
		(this.listeners[event] ??= []).push(fn);
	}

	_emit(event, data) {
		(this.listeners[event] || []).forEach((fn) => {
			try {
				fn(data);
			} catch (e) {
				console.error(`[RaceEngine] Error in ${event} listener:`, e);
			}
		});
	}
}

if (typeof module !== "undefined" && module.exports) {
	module.exports = RaceEngine;
} else {
	window.RaceEngine = RaceEngine;
}
