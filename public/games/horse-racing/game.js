/**
 * game.js
 * Horse Racing — Canvas renderer + TikTokBridge wiring.
 *
 * Vai trò: Nhận state từ RaceEngine, vẽ track + horse lên Canvas,
 * và cập nhật DOM HUD (flag, gift legend, event feed, winner overlay).
 *
 * Không chứa game logic — mọi tính toán state đều ở race-engine.js.
 * File này chỉ: đọc state → vẽ → lặp lại.
 *
 * @module games/horse-racing/game
 */

(() => {
	// ==========================================
	// STEP 1: KHỞI TẠO ENGINE VÀ CANVAS
	// ==========================================

	// Đọc config từ config.js (được load trước trong index.html)
	const config = window.RACE_CONFIG;

	// Tạo state machine với config — engine không có DOM, chỉ quản lý state
	const engine = new RaceEngine(config);

	const canvas = document.getElementById("raceCanvas");
	const ctx = canvas.getContext("2d");

	// Các phần tử HUD trong DOM (cập nhật bằng JS, không vẽ lên Canvas)
	const phaseBanner = document.getElementById("phaseBanner");
	const phaseText = document.getElementById("phaseText");
	const phaseTimer = document.getElementById("phaseTimer");
	const laneLabelsDiv = document.getElementById("laneLabels");
	const eventFeedDiv = document.getElementById("eventFeed");
	const winnerOverlay = document.getElementById("winnerOverlay");
	const winnerEmoji = document.getElementById("winnerEmoji");
	const winnerName = document.getElementById("winnerName");
	const winnerSupporters = document.getElementById("winnerSupporters");

	// ==========================================
	// STEP 2: RESIZE CANVAS THEO VIEWPORT
	// OBS Browser Source có kích thước cố định (thường 1920×1080).
	// Canvas phải khớp viewport để vẽ đúng tỉ lệ.
	// ==========================================
	function resize() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}
	window.addEventListener("resize", resize);
	resize();

	// ==========================================
	// STEP 3: NỐI TIKTOK EVENTS → RACE ENGINE
	// TikTokBridge nhận event từ server qua Socket.io,
	// sau đó chuyển vào engine để cập nhật state game.
	// ==========================================
	TikTokBridge.on("gift", (data) => engine.handleGift(data));
	TikTokBridge.on("chat", (data) => engine.handleChat(data));
	TikTokBridge.on("like", (data) => engine.handleLike(data));

	// ==========================================
	// STEP 4: TẠO LANE LABELS TRONG DOM
	// Mỗi lane có một div chứa: flag, tên nước, số vote, % tiến độ,
	// và danh sách emoji gift cho lane đó (từ tất cả tier).
	// ==========================================
	function buildLaneLabels() {
		laneLabelsDiv.innerHTML = "";
		config.lanes.forEach((lane) => {
			const el = document.createElement("div");
			el.className = "lane-label";
			el.id = `lane-label-${lane.id}`;
			el.style.borderLeftColor = lane.color;

			// Get gift emojis for this lane across all tiers
			const giftEmojis = config.getLaneGiftEmojis(lane.id).join(" ");
			const voteNum = lane.id + 1; // 1-indexed for viewers

			el.innerHTML =
				`<div class="lane-top">` +
				`<span class="lane-flag">${lane.flag}</span> ` +
				`<span class="lane-name">${lane.name}</span> ` +
				`<span class="lane-vote">Type ${voteNum}</span>` +
				`<span class="lane-dist">0%</span>` +
				`</div>` +
				`<div class="lane-gifts">${giftEmojis}</div>`;
			laneLabelsDiv.appendChild(el);
		});
	}
	buildLaneLabels();

	// Rebuild lane labels sau mỗi race (reset về waiting phase)
	engine.on("phaseChange", ({ phase }) => {
		if (phase === "waiting") buildLaneLabels();
	});

	// ==========================================
	// STEP 5: RENDER LOOP
	// requestAnimationFrame gọi frame() ~60fps.
	// Mỗi frame: tick engine (xử lý phase timeout) → vẽ Canvas → cập nhật DOM HUD.
	// ==========================================
	let lastFeedCount = 0;

	function frame() {
		// tick() xử lý phase transitions (vd: countdown hết → chuyển sang racing)
		const state = engine.tick();
		// Vẽ track, horse, finish line lên Canvas
		drawTrack(state);
		// Cập nhật DOM: phase banner, timer, % tiến độ, event feed, winner overlay
		updateHUD(state);
		requestAnimationFrame(frame);
	}

	// ==========================================
	// STEP 6: VẼ TRACK TRÊN CANVAS
	// ==========================================
	function drawTrack(state) {
		const W = canvas.width;
		const H = canvas.height;
		const laneCount = state.lanes.length;

		// Clear
		ctx.clearRect(0, 0, W, H);

		// Track dimensions
		const trackTop = H * 0.15;
		const trackBottom = H * 0.85;
		const trackHeight = trackBottom - trackTop;
		const laneH = trackHeight / laneCount;
		const trackLeft = 275; // space for wider lane labels with gift icons
		const trackRight = W - 60; // extra margin for FINISH label
		const trackWidth = trackRight - trackLeft;

		// Draw track background
		ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
		ctx.beginPath();
		ctx.roundRect(
			trackLeft - 10,
			trackTop - 10,
			trackWidth + 20,
			trackHeight + 20,
			12,
		);
		ctx.fill();

		// Draw lanes
		state.lanes.forEach((lane, i) => {
			const y = trackTop + i * laneH;

			// Lane stripe (alternating)
			if (i % 2 === 0) {
				ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
				ctx.fillRect(trackLeft, y, trackWidth, laneH);
			}

			// Lane divider
			if (i > 0) {
				ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
				ctx.lineWidth = 1;
				ctx.setLineDash([8, 8]);
				ctx.beginPath();
				ctx.moveTo(trackLeft, y);
				ctx.lineTo(trackRight, y);
				ctx.stroke();
				ctx.setLineDash([]);
			}

			// Progress bar
			const progress = Math.min(lane.distance / config.finishLine, 1);
			const barWidth = trackWidth * progress;
			ctx.fillStyle = lane.color + "40"; // semi-transparent
			ctx.fillRect(trackLeft, y + 4, barWidth, laneH - 8);

			// Horse position
			const horseX = trackLeft + barWidth;
			const horseY = y + laneH / 2;

			// Horse circle (lane color)
			ctx.beginPath();
			ctx.arc(horseX, horseY, laneH * 0.3, 0, Math.PI * 2);
			ctx.fillStyle = lane.color;
			ctx.fill();
			ctx.strokeStyle = "#fff";
			ctx.lineWidth = 2;
			ctx.stroke();

			// Country flag emoji on the horse
			const flagSize = Math.round(laneH * 0.4);
			ctx.font = `${flagSize}px serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(lane.flag, horseX, horseY);
		});

		// Finish line
		ctx.strokeStyle = "rgba(255, 215, 0, 0.6)";
		ctx.lineWidth = 3;
		ctx.setLineDash([12, 6]);
		ctx.beginPath();
		ctx.moveTo(trackRight, trackTop - 5);
		ctx.lineTo(trackRight, trackBottom + 5);
		ctx.stroke();
		ctx.setLineDash([]);

		// Finish label
		ctx.fillStyle = "#ffd700";
		ctx.font = "bold 14px sans-serif";
		ctx.textAlign = "center";
		ctx.fillText("🏁 FINISH", trackRight, trackTop - 15);
	}

	// ==========================================
	// STEP 7: CẬP NHẬT DOM HUD
	// Canvas vẽ track. DOM HUD hiển thị: phase banner, timer, % lane, event feed, winner.
	// Tách Canvas và DOM để dễ style và thay đổi layout.
	// ==========================================
	function updateHUD(state) {
		// Phase text
		const phaseLabels = {
			waiting: "🏇 Waiting for gifts to start...",
			countdown: "⏳ Race starting in...",
			racing: "🏁 RACE IN PROGRESS!",
			finished: "🎉 RACE FINISHED!",
			cooldown: "⏳ Next race soon...",
		};
		phaseText.textContent = phaseLabels[state.phase] || state.phase;

		// Phase timer
		const remaining = engine.phaseRemaining();
		if (remaining !== Infinity && remaining > 0) {
			phaseTimer.textContent = Math.ceil(remaining / 1000) + "s";
		} else {
			phaseTimer.textContent = "";
		}

		// Countdown pulse animation
		if (state.phase === "countdown") {
			phaseBanner.classList.add("countdown");
		} else {
			phaseBanner.classList.remove("countdown");
		}

		// Lane labels (progress %)
		state.lanes.forEach((lane) => {
			const el = document.getElementById(`lane-label-${lane.id}`);
			if (el) {
				const pct = Math.round((lane.distance / config.finishLine) * 100);
				el.querySelector(".lane-dist").textContent = pct + "%";
			}
		});

		// Event feed
		if (state.recentEvents.length !== lastFeedCount) {
			lastFeedCount = state.recentEvents.length;
			renderFeed(state.recentEvents.slice(0, 8));
		}

		// Winner overlay
		if (state.phase === "finished" && state.winner) {
			showWinner(state.winner);
		} else {
			winnerOverlay.classList.add("hidden");
		}
	}

	function renderFeed(events) {
		eventFeedDiv.innerHTML = "";
		events.forEach((evt) => {
			const el = document.createElement("div");
			el.className = "feed-item " + evt.type;
			if (evt.type === "gift") {
				el.textContent = `${evt.giftEmoji} ${evt.nickname} → ${evt.laneFlag} (+${evt.distance})`;
			} else if (evt.type === "vote") {
				el.textContent = `💬 ${evt.nickname} → ${evt.laneFlag} (+${evt.distance})`;
			} else if (evt.type === "chat") {
				el.textContent = `💬 ${evt.nickname}: ${evt.text}`;
			} else if (evt.type === "like") {
				el.textContent = `❤️ ${evt.nickname} +${evt.count}`;
			}
			eventFeedDiv.appendChild(el);
		});
	}

	function showWinner(winner) {
		winnerOverlay.classList.remove("hidden");
		winnerEmoji.textContent = winner.flag;
		winnerName.textContent = winner.name + " WINS!";
		winnerName.style.color = winner.color;

		// Top 3 supporters
		const supporters = Array.from(winner.supporters.values())
			.sort((a, b) => b.totalContrib - a.totalContrib)
			.slice(0, 3);

		if (supporters.length > 0) {
			winnerSupporters.textContent =
				"Top supporters: " +
				supporters.map((s) => `${s.nickname} (${s.totalContrib})`).join(", ");
		} else {
			winnerSupporters.textContent = "";
		}
	}

	// ==========================================
	// STEP 8: BẮT ĐẦU RENDER LOOP
	// TikTokBridge tự kết nối khi URL có ?id=username (xem tiktok-bridge.js).
	// Game bắt đầu ngay — ở trạng thái WAITING cho đến khi nhận gift/chat đầu tiên.
	// ==========================================
	requestAnimationFrame(frame);
	console.log(
		"[HorseRacing] Game loaded, waiting for TikTokBridge connection...",
	);
})();
