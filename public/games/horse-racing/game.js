/**
 * game.js — Horse Racing canvas renderer + HUD wiring.
 * Reads state from RaceEngine, draws track scene on Canvas,
 * and updates DOM HUD elements.
 */

(() => {
  // Guard: skip if already running OR missing required dependencies
  if (window.__HORSE_RUNNING) {
    console.warn('[HorseRacing] Already running — skipping duplicate load.');
    return;
  }
  if (!window.TikTokBridge || !window.RACE_CONFIG || !window.RaceEngine) {
    console.warn('[HorseRacing] Missing dependencies (TikTokBridge / RACE_CONFIG / RaceEngine), aborting.');
    return;
  }
  window.__HORSE_RUNNING = true;

  const config = window.RACE_CONFIG;
  const engine = new RaceEngine(config);
  const canvas = document.getElementById('raceCanvas');
  const ctx    = canvas.getContext('2d');

  const phaseBanner      = document.getElementById('phaseBanner');
  const phaseIcon        = document.getElementById('phaseIcon');
  const phaseText        = document.getElementById('phaseText');
  const phaseTimer       = document.getElementById('phaseTimer');
  const laneLabelsDiv    = document.getElementById('laneLabels');
  const eventFeedDiv     = document.getElementById('eventFeed');
  const winnerOverlay    = document.getElementById('winnerOverlay');
  const winnerEmoji      = document.getElementById('winnerEmoji');
  const winnerName       = document.getElementById('winnerName');
  const winnerSupporters = document.getElementById('winnerSupporters');

  // ── PRE-GENERATE STARS ────────────────────────────
  const STARS = Array.from({ length: 100 }, () => ({
    x:       Math.random(),
    y:       Math.random() * 0.52,
    r:       Math.random() * 1.6 + 0.3,
    a:       Math.random() * 0.65 + 0.2,
    phase:   Math.random() * Math.PI * 2,
    speed:   Math.random() * 0.025 + 0.008,
  }));

  // ── PARTICLE SYSTEM ───────────────────────────────
  const particles = [];

  function emitBurst(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = Math.random() * 3.5 + 1;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed * 0.4 - speed * 0.6,
        vy: Math.sin(angle) * speed * 0.5,
        size:  Math.random() * 4 + 2,
        color,
        life:  1,
        decay: Math.random() * 0.03 + 0.025,
      });
    }
    if (particles.length > 400) particles.splice(0, particles.length - 400);
  }

  function tickParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x  += p.vx;
      p.y  += p.vy;
      p.vx *= 0.92;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life * 0.75;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // ── CONFETTI ──────────────────────────────────────
  const CONFETTI_COLORS = ['#FFCC00', '#ff4466', '#44ff88', '#4488ff', '#ff88ff', '#ffffff'];
  const confetti = [];
  let confettiActive  = false;
  let confettiFrames  = 0;

  function spawnConfetti(W) {
    if (confettiFrames++ % 2 !== 0) return;
    for (let i = 0; i < 10; i++) {
      confetti.push({
        x:        Math.random() * W,
        y:        -16,
        vx:       (Math.random() - 0.5) * 7,
        vy:       Math.random() * 3 + 1.5,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.25,
        color:    CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        w:        Math.random() * 10 + 5,
        h:        Math.random() * 6 + 3,
      });
    }
    if (confetti.length > 500) confetti.splice(0, confetti.length - 500);
  }

  function tickDrawConfetti(H) {
    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i];
      c.x        += c.vx;
      c.y        += c.vy;
      c.vy       += 0.12;
      c.rotation += c.rotSpeed;
      if (c.y > H + 20) { confetti.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
  }

  // ── RESIZE ────────────────────────────────────────
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    updateLaneLabelPositions();
  }
  window.addEventListener('resize', resize);
  resize();

  // ── TIKTOK EVENTS ─────────────────────────────────
  TikTokBridge.on('gift', d => engine.handleGift(d));
  TikTokBridge.on('chat', d => engine.handleChat(d));
  TikTokBridge.on('like', d => engine.handleLike(d));

  // ── ENGINE EVENTS ─────────────────────────────────
  engine.on('phaseChange', ({ phase }) => {
    if (phase === 'waiting') {
      buildLaneLabels();
      updateLaneLabelPositions();
      winnerOverlay.classList.add('hidden');
    }
    if (phase === 'finished') {
      confettiActive = true;
      confettiFrames = 0;
      setTimeout(() => { confettiActive = false; confetti.length = 0; }, 7000);
      // Show winner from event — not relying on per-frame check
      if (engine.state.winner) showWinner(engine.state.winner);
    }
    if (phase === 'cooldown') {
      winnerOverlay.classList.add('hidden');
    }
  });

  // Emit burst particles at horse position when it moves
  engine.on('horseMove', ({ horse }) => {
    const W  = canvas.width;
    const H  = canvas.height;
    const n  = engine.state.horses.length;
    const TL = 296, TR = W - 58;
    const TT = H * 0.13, TH = (H * 0.91) - TT;
    const LH = TH / n;

    const progress = Math.min(horse.distance / config.finishLine, 1);
    const TW = TR - TL;
    const r  = LH * 0.31;
    const hx = TL + r + (TW - 2 * r) * progress;
    const hy = TT + horse.id * LH + LH / 2;

    emitBurst(hx, hy, horse.color, 10);
  });

  // ── LANE LABEL POSITIONING ────────────────────────
  function updateLaneLabelPositions() {
    const H  = canvas.height;
    const n  = config.horses.length;
    const TT = H * 0.13;
    const TH = H * 0.91 - TT;
    const LH = TH / n;
    config.horses.forEach(horse => {
      const el = document.getElementById(`lane-label-${horse.id}`);
      if (el) el.style.top = (TT + horse.id * LH + LH / 2) + 'px';
    });
  }

  // ── LANE LABELS BUILD ─────────────────────────────
  function buildLaneLabels() {
    laneLabelsDiv.innerHTML = '';
    config.horses.forEach(horse => {
      const el    = document.createElement('div');
      el.className = 'lane-label';
      el.id        = `lane-label-${horse.id}`;
      el.style.borderLeftColor = horse.color;

      const gifts   = config.getHorseGiftEmojis(horse.id).join('');
      const voteNum = horse.id + 1;

      // Progress bar gradient uses horse color
      el.innerHTML = `
        <div class="lane-header">
          <span class="lane-rank" id="rank-${horse.id}">#${voteNum}</span>
          <span class="lane-flag">${horse.icon}</span>
          <span class="lane-name">${horse.name}</span>
          <span class="lane-vote-badge">TYPE ${voteNum}</span>
        </div>
        <div class="lane-progress-track">
          <div class="lane-progress-bar" id="bar-${horse.id}"
               style="width:0%; background: linear-gradient(90deg, ${horse.color}66, ${horse.color})"></div>
        </div>
        <div class="lane-footer">
          <span class="lane-dist" id="dist-${horse.id}">0%</span>
          <div class="lane-gifts">${gifts}</div>
        </div>`;
      laneLabelsDiv.appendChild(el);
    });
  }
  buildLaneLabels();
  updateLaneLabelPositions();

  // ── MAIN LOOP ─────────────────────────────────────
  let animTime = 0;

  function frame() {
    const state = engine.tick();
    animTime += 0.05;
    drawScene(state);
    updateHUD(state);
    requestAnimationFrame(frame);
  }

  // ── CANVAS SCENE ──────────────────────────────────
  function drawScene(state) {
    const W = canvas.width;
    const H = canvas.height;
    const n = state.horses.length;
    ctx.clearRect(0, 0, W, H);

    // Layout constants
    const TL = 296;            // track left
    const TR = W - 58;         // track right (leaves room for checkered line)
    const TT = H * 0.13;       // track top
    const TB = H * 0.91;       // track bottom
    const TW = TR - TL;
    const TH = TB - TT;
    const LH = TH / n;

    drawBackground(W, H, TT);
    drawTrackBase(TL, TT, TW, TH, n, LH);

    // Rank order for leader crown
    const sorted  = [...state.horses].sort((a, b) => b.distance - a.distance);
    const rankMap  = {};
    sorted.forEach((h, i) => { rankMap[h.id] = i + 1; });

    drawFinishLine(TR, TT, TB);
    drawMilestones(TL, TR, TT, TB);

    state.horses.forEach(horse => {
      drawHorse(horse, rankMap[horse.id], state.phase, TL, TR, TT, LH);
    });

    tickParticles();
    drawParticles();

    if (confettiActive) {
      spawnConfetti(W);
      tickDrawConfetti(H);
    }
  }

  function drawBackground(W, H, trackTop) {
    // Sky — covers entire canvas
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0,    'rgba(3, 6, 20, 0.97)');
    sky.addColorStop(0.5,  'rgba(8, 11, 34, 0.95)');
    sky.addColorStop(0.85, 'rgba(12, 18, 50, 0.95)');
    sky.addColorStop(1,    'rgba(8, 22, 8, 0.97)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Ground strip — below the track
    const groundY = H * 0.93;
    const gnd = ctx.createLinearGradient(0, groundY, 0, H);
    gnd.addColorStop(0, 'rgba(10, 28, 10, 0.97)');
    gnd.addColorStop(1, 'rgba(4, 14, 4, 0.99)');
    ctx.fillStyle = gnd;
    ctx.fillRect(0, groundY, W, H - groundY);

    // Stars
    STARS.forEach(s => {
      const t = Math.sin(animTime * s.speed * 20 + s.phase);
      const a = s.a * (0.55 + 0.45 * t);
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220, 220, 255, ${a})`;
      ctx.fill();
    });

    // Stadium light cones — 3 spots from top
    [[0.18, 0], [0.5, 0], [0.82, 0]].forEach(([fx, fy]) => {
      const g = ctx.createRadialGradient(fx * W, fy, 0, fx * W, fy, H * 0.8);
      g.addColorStop(0, 'rgba(240, 235, 190, 0.07)');
      g.addColorStop(1, 'rgba(240, 235, 190, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });

    // Crowd silhouette — undulating bumps just above track
    const crowdBase = trackTop - 10;
    ctx.beginPath();
    ctx.moveTo(0, crowdBase + 30);
    for (let x = 0; x <= W; x += 12) {
      const bump = Math.sin(x * 0.09 + animTime * 0.25) * 7
                 + Math.sin(x * 0.15 + 1.3)            * 4;
      ctx.lineTo(x, crowdBase + bump);
    }
    ctx.lineTo(W, trackTop + 5);
    ctx.lineTo(0, trackTop + 5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fill();
  }

  function drawTrackBase(TL, TT, TW, TH, n, LH) {
    // Outer container shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    roundRect(TL - 10, TT - 10, TW + 20, TH + 20, 14);
    ctx.fill();

    // Outer border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Lane fills
    for (let i = 0; i < n; i++) {
      const y = TT + i * LH;
      ctx.fillStyle = i % 2 === 0
        ? 'rgba(255, 255, 255, 0.022)'
        : 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(TL, y, TW, LH);

      // Lane separator
      if (i > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.lineWidth = 1;
        ctx.setLineDash([10, 12]);
        ctx.beginPath();
        ctx.moveTo(TL, y);
        ctx.lineTo(TL + TW, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // Start label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('START', TL, TT - 8);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(TL, TT);
    ctx.lineTo(TL, TT + TH);
    ctx.stroke();
  }

  function drawHorse(horse, rank, phase, TL, TR, TT, LH) {
    const progress = Math.min(horse.distance / config.finishLine, 1);
    const TW  = TR - TL;
    const r   = LH * 0.31;
    const laneY  = TT + horse.id * LH;
    const centerY = laneY + LH / 2;
    // Offset by r so horse left-edge aligns with start line and right-edge with finish line
    const hx = TL + r + (TW - 2 * r) * progress;

    // Progress glow trail
    if (progress > 0) {
      const barW = TW * progress;
      const grad = ctx.createLinearGradient(TL, 0, TL + barW, 0);
      grad.addColorStop(0,   horse.color + '0a');
      grad.addColorStop(0.6, horse.color + '22');
      grad.addColorStop(1,   horse.color + '55');
      ctx.fillStyle = grad;
      const pad = LH * 0.14;
      ctx.fillRect(TL, laneY + pad, barW, LH - pad * 2);
    }

    // Gentle idle bob
    const bob = Math.sin(animTime * (7 + horse.id * 0.7)) * (LH * 0.065);
    const hy  = centerY + bob;

    // Leader glow ring
    if (rank === 1 && progress > 0.03) {
      ctx.save();
      ctx.shadowBlur  = 22;
      ctx.shadowColor = horse.color;
      ctx.strokeStyle = horse.color + 'cc';
      ctx.lineWidth   = 2.5;
      ctx.beginPath();
      ctx.arc(hx, hy, r + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Horse circle body
    const fill = ctx.createRadialGradient(hx - r * 0.25, hy - r * 0.3, 0, hx, hy, r);
    fill.addColorStop(0, horse.color + 'ee');
    fill.addColorStop(1, horse.color + '99');
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Flag emoji
    const fs = Math.round(r * 1.1);
    ctx.font          = `${fs}px serif`;
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillStyle     = '#fff';
    ctx.fillText(horse.icon, hx, hy);

    // Leader crown
    if (rank === 1 && progress > 0.03) {
      const crownSize = Math.round(r * 0.7);
      ctx.font         = `${crownSize}px serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('👑', hx, hy - r - 2);
    }
  }

  function drawFinishLine(TR, TT, TB) {
    const sq = 14;
    const rows = Math.ceil((TB - TT) / sq);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 2; col++) {
        ctx.fillStyle = (row + col) % 2 === 0
          ? 'rgba(10, 10, 10, 0.92)'
          : 'rgba(255, 255, 255, 0.90)';
        ctx.fillRect(TR + col * sq, TT + row * sq, sq, sq);
      }
    }
    // Finish label
    ctx.save();
    ctx.shadowColor = '#FFCC00';
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = '#FFCC00';
    ctx.font        = 'bold 13px system-ui, sans-serif';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('🏁 FINISH', TR + sq, TT - 8);
    ctx.restore();
  }

  function drawMilestones(TL, TR, TT, TB) {
    const TW = TR - TL;
    [0.25, 0.5, 0.75].forEach(pct => {
      const x = TL + TW * pct;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(x, TT);
      ctx.lineTo(x, TB);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle    = 'rgba(255, 255, 255, 0.22)';
      ctx.font         = '11px system-ui, sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${pct * 100 | 0}%`, x, TT - 5);
      ctx.restore();
    });
  }

  // ── HUD UPDATE ────────────────────────────────────
  const PHASE_LABELS = {
    waiting:   { icon: '🏇', text: 'Waiting for gifts...' },
    countdown: { icon: '⏳', text: 'Race starting in' },
    racing:    { icon: '🏁', text: 'Race in progress' },
    finished:  { icon: '🎉', text: 'Race finished!' },
    cooldown:  { icon: '⏳', text: 'Next race soon...' },
  };

  // ── TOAST FEED ─────────────────────────────────────
  const TOAST_DURATION = 5000;
  const TOAST_MAX      = 8;

  function pushToast(text, type) {
    const el = document.createElement('div');
    el.className = `feed-item ${type}`;
    el.textContent = text;
    eventFeedDiv.insertBefore(el, eventFeedDiv.firstChild);

    // Auto-dismiss after TOAST_DURATION
    setTimeout(() => {
      el.classList.add('dismissing');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, TOAST_DURATION);

    // Cap visible toasts (remove oldest non-dismissing)
    const live = eventFeedDiv.querySelectorAll('.feed-item:not(.dismissing)');
    if (live.length > TOAST_MAX) live[live.length - 1].remove();
  }

  function toastFromEvent(evt) {
    switch (evt.type) {
      case 'gift': pushToast(`${evt.giftEmoji} ${evt.nickname} → ${evt.horseIcon} +${evt.distance}pt`, 'gift'); break;
      case 'vote': pushToast(`🗳️ ${evt.nickname} voted ${evt.horseIcon} +${evt.distance}pt`,          'vote'); break;
      case 'chat': pushToast(`💬 ${evt.nickname}: ${evt.text}`,                                        'chat'); break;
      case 'like': pushToast(`❤️ ${evt.nickname} liked ×${evt.count}`,                                'like'); break;
    }
  }

  // Fired once per new event — no array diff in the frame loop
  let lastToastTs = 0;

  function updateHUD(state) {
    const label = PHASE_LABELS[state.phase] || { icon: '', text: state.phase };
    phaseIcon.textContent = label.icon;
    phaseText.textContent = label.text;

    const rem = engine.phaseRemaining();
    phaseTimer.textContent = (rem !== Infinity && rem > 0)
      ? Math.ceil(rem / 1000) + 's'
      : '';

    phaseBanner.className = 'phase-banner ' + state.phase;

    // Rank order for lane cards
    const sorted  = [...state.horses].sort((a, b) => b.distance - a.distance);
    const rankMap  = {};
    sorted.forEach((h, i) => { rankMap[h.id] = i + 1; });

    state.horses.forEach(horse => {
      const pct  = Math.round((horse.distance / config.finishLine) * 100);
      const rank = rankMap[horse.id];

      const distEl  = document.getElementById(`dist-${horse.id}`);
      const barEl   = document.getElementById(`bar-${horse.id}`);
      const rankEl  = document.getElementById(`rank-${horse.id}`);
      const labelEl = document.getElementById(`lane-label-${horse.id}`);

      if (distEl)  distEl.textContent   = pct + '%';
      if (barEl)   barEl.style.width    = pct + '%';
      if (rankEl)  {
        rankEl.textContent = '#' + rank;
        rankEl.className   = 'lane-rank' + (rank <= 3 ? ` rank-${rank}` : '');
      }
      if (labelEl) {
        labelEl.classList.toggle('leading', rank === 1 && pct > 0);
      }
    });

    // Push new events as toasts (iterate oldest-first so newest ends up on top)
    const newEvts = [];
    for (const e of state.recentEvents) {
      if (e.timestamp <= lastToastTs) break;
      newEvts.push(e);
    }
    if (newEvts.length > 0) {
      lastToastTs = newEvts[0].timestamp;
      for (let i = newEvts.length - 1; i >= 0; i--) toastFromEvent(newEvts[i]);
    }
  }

  function showWinner(winner) {
    winnerOverlay.classList.remove('hidden');
    winnerEmoji.textContent   = winner.icon;
    winnerName.textContent    = winner.name + ' WINS!';
    winnerName.style.color       = winner.color;
    winnerName.style.textShadow  = `0 0 40px ${winner.color}, 0 0 80px ${winner.color}55, 0 4px 20px rgba(0,0,0,0.8)`;

    const supporters = Array.from(winner.supporters.values())
      .sort((a, b) => b.totalContrib - a.totalContrib)
      .slice(0, 3);

    winnerSupporters.textContent = supporters.length > 0
      ? supporters.map((s, i) => `${['🥇','🥈','🥉'][i]} ${s.nickname} (${s.totalContrib}pts)`).join('  ·  ')
      : '';
  }

  // ── UTILITY ───────────────────────────────────────
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── START ─────────────────────────────────────────
  requestAnimationFrame(frame);
  console.log('[HorseRacing] Game loaded, waiting for TikTokBridge...');
})();
