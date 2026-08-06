/**
 * renderer.js — Virtual Bar Canvas 2D renderer.
 * Faux-3D perspective scene: converging floor, raised zone platforms,
 * neon glow, DJ booth, dynamic disco-ball rays.
 *
 * @module games/virtual-bar/renderer
 */

((global) => {
  let _cfg, _bg;

  // ── Perspective helpers ───────────────────────────────────────────────────
  // Gentle perspective: max 200px shrink at top, full width at bottom (y=1080).
  // Keeps zones wide and readable while still showing depth.
  function _ex(y) { return Math.round(200 * (1 - y / 1080)); }

  // Fill a perspective trapezoid spanning y0→y1
  function _trap(cx, y0, y1, fill) {
    cx.beginPath();
    cx.moveTo(_ex(y0), y0); cx.lineTo(1920 - _ex(y0), y0);
    cx.lineTo(1920 - _ex(y1), y1); cx.lineTo(_ex(y1), y1);
    cx.closePath();
    cx.fillStyle = fill; cx.fill();
  }

  // Stroke a perspective trapezoid edge (horizontal neon line)
  function _neon(cx, y, color, blur, alpha) {
    const lx = _ex(y);
    cx.save();
    cx.strokeStyle = color; cx.lineWidth = 2.5;
    cx.globalAlpha = alpha;
    cx.shadowColor = color; cx.shadowBlur = blur;
    cx.beginPath(); cx.moveTo(lx, y); cx.lineTo(1920 - lx, y); cx.stroke();
    cx.restore();
  }

  // ── Static background (built once at 1920×1080) ──────────────────────────
  function _buildBg() {
    const W = 1920, H = 1080;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const cx = c.getContext('2d');

    // 1. Base atmosphere — dark nightclub with visible purple tint
    const atm = cx.createLinearGradient(0, 0, 0, H);
    atm.addColorStop(0,    '#1a0040');
    atm.addColorStop(0.18, '#1e0048');
    atm.addColorStop(0.7,  '#0e0030');
    atm.addColorStop(1,    '#080020');
    cx.fillStyle = atm; cx.fillRect(0, 0, W, H);

    // 2. Zone surfaces — perspective trapezoids back→front
    // Config zone gaps (260-280, 460-480, 640-660) become step faces.

    // DJ Stage (y 60–260) — hot magenta-purple
    const djG = cx.createLinearGradient(0, 60, 0, 260);
    djG.addColorStop(0, 'rgba(160, 0, 100, 0.95)');
    djG.addColorStop(1, 'rgba(110, 0,  75, 0.70)');
    _trap(cx, 60, 260, djG);

    // DJ→VIP step face (y 260–280) — bright magenta riser
    const djRiser = cx.createLinearGradient(0, 260, 0, 280);
    djRiser.addColorStop(0, 'rgba(220, 0, 130, 0.95)');
    djRiser.addColorStop(1, 'rgba(120, 0,  70, 0.40)');
    _trap(cx, 260, 280, djRiser);

    // VIP Zone (y 280–460) — deep violet
    const vipG = cx.createLinearGradient(0, 280, 0, 460);
    vipG.addColorStop(0, 'rgba(55, 0, 160, 0.90)');
    vipG.addColorStop(1, 'rgba(35, 0, 120, 0.65)');
    _trap(cx, 280, 460, vipG);

    // VIP→Regular step face (y 460–480)
    const vipRiser = cx.createLinearGradient(0, 460, 0, 480);
    vipRiser.addColorStop(0, 'rgba(130, 0, 255, 0.90)');
    vipRiser.addColorStop(1, 'rgba( 60, 0, 120, 0.30)');
    _trap(cx, 460, 480, vipRiser);

    // Regular Zone (y 480–640) — dark teal-navy
    const regG = cx.createLinearGradient(0, 480, 0, 640);
    regG.addColorStop(0, 'rgba(0, 35, 110, 0.88)');
    regG.addColorStop(1, 'rgba(0, 25,  80, 0.60)');
    _trap(cx, 480, 640, regG);

    // Regular→Dance floor step face (y 640–660)
    const regRiser = cx.createLinearGradient(0, 640, 0, 660);
    regRiser.addColorStop(0, 'rgba(0, 90, 220, 0.88)');
    regRiser.addColorStop(1, 'rgba(0, 40,  90, 0.28)');
    _trap(cx, 640, 660, regRiser);

    // Dance Floor (y 660–1072) — dark reflective slate
    const dfG = cx.createLinearGradient(0, 660, 0, 1072);
    dfG.addColorStop(0, 'rgba(14, 14, 50, 0.85)');
    dfG.addColorStop(1, 'rgba( 8,  8, 32, 0.55)');
    _trap(cx, 660, 1072, dfG);

    // 3. Zone boundary neon glows
    _neon(cx, 260, '#ff00bb', 22, 0.90); // DJ Stage bottom
    _neon(cx, 280, '#ff00bb',  8, 0.45); // VIP top
    _neon(cx, 460, '#9900ff', 18, 0.85); // VIP bottom
    _neon(cx, 480, '#9900ff',  6, 0.40); // Regular top
    _neon(cx, 640, '#0099ff', 14, 0.80); // Regular bottom
    _neon(cx, 660, '#0099ff',  5, 0.35); // Dance floor top

    // 4. Perspective grid — dance floor
    cx.save();
    cx.strokeStyle = 'rgba(60, 80, 200, 0.14)'; cx.lineWidth = 1;
    // Horizontal rings
    for (let y = 680; y <= 1060; y += 80) {
      cx.beginPath(); cx.moveTo(_ex(y), y); cx.lineTo(1920 - _ex(y), y); cx.stroke();
    }
    // Converging verticals (from floor-top edge down to bottom)
    const fLeft = _ex(660), fRight = 1920 - fLeft;
    for (let i = 0; i <= 14; i++) {
      const xTop = fLeft + (i / 14) * (fRight - fLeft);
      cx.beginPath(); cx.moveTo(xTop, 660); cx.lineTo(960, 0); cx.stroke();
    }
    cx.restore();

    // 5. VIP perspective grid (subtle, shows floor of VIP platform)
    cx.save();
    cx.strokeStyle = 'rgba(80, 0, 180, 0.08)'; cx.lineWidth = 1;
    for (let y = 300; y <= 450; y += 50) {
      cx.beginPath(); cx.moveTo(_ex(y), y); cx.lineTo(1920 - _ex(y), y); cx.stroke();
    }
    cx.restore();

    // 6. DJ Stage 3D booth + disco ball
    _drawDJBooth(cx);

    // 7. VIP decorations — sofas + velvet rope
    _drawVIP(cx);

    // 8. Regular zone — bar counter
    _drawBarCounter(cx);

    // 9. Ceiling neon strip + spotlight cones
    const strip = cx.createLinearGradient(0, 0, W, 0);
    ['#ff0080', '#7700ff', '#00ccff', '#7700ff', '#ff0080'].forEach((col, i) =>
      strip.addColorStop(i / 4, col)
    );
    cx.fillStyle = strip;
    cx.fillRect(0, 0, W, 5);
    cx.globalAlpha = 0.18; cx.fillRect(0, 5, W, 28); cx.globalAlpha = 1;

    // Spotlight cones (semi-transparent triangles from ceiling)
    [W * 0.22, W * 0.50, W * 0.78].forEach((x, i) => {
      cx.save();
      cx.globalAlpha = 0.06;
      cx.fillStyle = ['#ff0088', '#ffffff', '#8800ff'][i];
      cx.beginPath(); cx.moveTo(x, 0);
      cx.lineTo(x - 250, H * 0.72); cx.lineTo(x + 250, H * 0.72);
      cx.closePath(); cx.fill();
      cx.restore();
    });

    // 10. Zone labels (at the back-top corner of each zone)
    [
      [60,  260, '🎧  DJ STAGE',    '#ffd700'],
      [280, 460, '💎  KHU VIP',     '#cc88ff'],
      [480, 640, '🍺  KHU THƯỜNG', '#80d4ff'],
      [660, 1072,'💃  SÀN NHẢY',   '#999'   ],
    ].forEach(([y0, , label, color]) => {
      cx.save();
      cx.globalAlpha = 0.68;
      cx.fillStyle = color;
      cx.font = '700 14px "Segoe UI",Arial,sans-serif';
      cx.textAlign = 'left'; cx.textBaseline = 'top';
      cx.shadowColor = color; cx.shadowBlur = 6;
      cx.fillText(label, _ex(y0) + 22, y0 + 12);
      cx.restore();
    });

    return c;
  }

  function _drawDJBooth(cx) {
    // Disco ball hung from ceiling
    cx.save();
    cx.globalAlpha = 0.80;
    const ball = cx.createRadialGradient(954, 28, 0, 960, 35, 24);
    ball.addColorStop(0, '#e8e8f0'); ball.addColorStop(0.45, '#8a8aaa'); ball.addColorStop(1, '#2a2a40');
    cx.fillStyle = ball; cx.beginPath(); cx.arc(960, 35, 24, 0, Math.PI * 2); cx.fill();
    // Facet grid
    cx.strokeStyle = 'rgba(0,0,0,0.25)'; cx.lineWidth = 1;
    for (let a = 0; a < 180; a += 20) {
      const ra = a * Math.PI / 180;
      cx.beginPath(); cx.arc(960, 35, 24, ra, ra + 0.01); // horizontal ring approx
      cx.moveTo(960 + Math.cos(ra) * 24, 35 + Math.sin(ra) * 24);
      cx.lineTo(960 - Math.cos(ra) * 24, 35 - Math.sin(ra) * 24);
      cx.stroke();
    }
    // Hang wire
    cx.strokeStyle = 'rgba(255,255,255,0.3)'; cx.lineWidth = 1.5;
    cx.beginPath(); cx.moveTo(960, 0); cx.lineTo(960, 11); cx.stroke();
    cx.restore();

    // DJ console — 3D box illusion
    cx.save();
    cx.globalAlpha = 0.88;
    // Box top face (trapezoid perspective)
    cx.fillStyle = '#260030';
    cx.beginPath();
    cx.moveTo(842, 82); cx.lineTo(1078, 82); cx.lineTo(1058, 118); cx.lineTo(862, 118);
    cx.closePath(); cx.fill();
    cx.strokeStyle = '#ff00aa'; cx.lineWidth = 1.5;
    cx.shadowColor = '#ff00aa'; cx.shadowBlur = 8; cx.stroke(); cx.shadowBlur = 0;
    // Box front face
    cx.fillStyle = '#180020';
    cx.fillRect(862, 118, 196, 72);
    cx.strokeStyle = '#ff00aa'; cx.lineWidth = 1.5; cx.strokeRect(862, 118, 196, 72);
    // Knobs on top face
    [[908, 98], [960, 96], [1012, 98]].forEach(([x, y], i) => {
      cx.beginPath(); cx.arc(x, y, 8, 0, Math.PI * 2);
      cx.fillStyle = ['#ff0080', '#00ffcc', '#ffaa00'][i]; cx.fill();
    });
    // VU-meter strip on front face
    cx.fillStyle = '#000'; cx.fillRect(870, 134, 180, 20);
    for (let i = 0; i < 13; i++) {
      cx.fillStyle = i < 5 ? '#00dd44' : i < 9 ? '#ffcc00' : '#ff2200';
      cx.fillRect(872 + i * 13, 136, 11, 16);
    }
    // Pitch-fader lines
    cx.strokeStyle = 'rgba(255,255,255,0.2)'; cx.lineWidth = 1;
    [140, 170].forEach(y => {
      cx.beginPath(); cx.moveTo(870, y); cx.lineTo(1050, y); cx.stroke();
    });
    cx.restore();

    // Left/right speaker stacks
    [656, 1220].forEach(x => {
      cx.save(); cx.globalAlpha = 0.60;
      // Cabinet
      cx.fillStyle = '#111'; cx.fillRect(x, 82, 52, 148);
      cx.strokeStyle = '#333'; cx.lineWidth = 1.5; cx.strokeRect(x, 82, 52, 148);
      // Top face (3D)
      cx.fillStyle = '#1a1a1a';
      cx.beginPath();
      cx.moveTo(x, 82); cx.lineTo(x + 52, 82);
      cx.lineTo(x + 44, 72); cx.lineTo(x + 8, 72);
      cx.closePath(); cx.fill();
      // Speaker cones
      [[x + 26, 110], [x + 26, 155], [x + 26, 200]].forEach(([bx, by]) => {
        cx.beginPath(); cx.arc(bx, by, 17, 0, Math.PI * 2); cx.fillStyle = '#1c1c1c'; cx.fill();
        cx.beginPath(); cx.arc(bx, by, 11, 0, Math.PI * 2); cx.fillStyle = '#2a2a2a'; cx.fill();
        cx.beginPath(); cx.arc(bx, by, 5, 0, Math.PI * 2);
        cx.fillStyle = x < 960 ? '#00ffcc44' : '#ff008844'; cx.fill();
      });
      cx.restore();
    });

    // Stage monitor wedges at DJ booth base
    [860, 1020].forEach(x => {
      cx.save(); cx.globalAlpha = 0.50;
      cx.fillStyle = '#0a0010';
      cx.beginPath();
      cx.moveTo(x, 200); cx.lineTo(x + 40, 200); cx.lineTo(x + 50, 230); cx.lineTo(x - 10, 230);
      cx.closePath(); cx.fill();
      cx.strokeStyle = '#330055'; cx.lineWidth = 1; cx.stroke();
      cx.restore();
    });
  }

  function _drawVIP(cx) {
    // Velvet rope at VIP front edge (y ≈ 458)
    cx.save();
    cx.globalAlpha = 0.65;
    const ry = 458, lx = _ex(ry) + 15, rx = 1920 - lx;
    // Rope posts
    [lx + 18, lx + 260, rx - 260, rx - 18].forEach(x => {
      cx.fillStyle = '#c8a84b';
      cx.fillRect(x - 5, ry - 38, 10, 44);
      cx.beginPath(); cx.arc(x, ry - 42, 9, 0, Math.PI * 2);
      cx.fillStyle = '#e8c860'; cx.fill();
    });
    // Rope line (catenary approximation — 3 segments)
    cx.strokeStyle = '#c8a84b'; cx.lineWidth = 3;
    cx.shadowColor = '#e8c860'; cx.shadowBlur = 5;
    [[lx + 18, lx + 260], [lx + 260, rx - 260], [rx - 260, rx - 18]].forEach(([x1, x2]) => {
      const midX = (x1 + x2) / 2;
      cx.beginPath(); cx.moveTo(x1, ry - 36);
      cx.quadraticCurveTo(midX, ry - 20, x2, ry - 36);
      cx.stroke();
    });
    cx.shadowBlur = 0;
    cx.restore();

    // VIP sofas (3 semi-ellipses along VIP floor)
    [[580, 375], [960, 360], [1340, 375]].forEach(([sx, sy]) => {
      cx.save(); cx.globalAlpha = 0.52;
      // Sofa back
      cx.fillStyle = '#20005a'; cx.strokeStyle = '#6600cc'; cx.lineWidth = 2;
      cx.beginPath(); cx.ellipse(sx, sy - 14, 58, 16, 0, Math.PI, 0); cx.fill(); cx.stroke();
      // Sofa seat
      cx.fillStyle = '#2a0070';
      cx.beginPath(); cx.ellipse(sx, sy + 4, 62, 18, 0, 0, Math.PI * 2); cx.fill();
      cx.strokeStyle = '#7700ee'; cx.stroke();
      cx.restore();
    });

    // VIP floor glow (radial ambient under the sofas)
    cx.save(); cx.globalAlpha = 0.12;
    const vg = cx.createRadialGradient(960, 380, 0, 960, 380, 500);
    vg.addColorStop(0, '#9900ff'); vg.addColorStop(1, 'transparent');
    cx.fillStyle = vg; cx.fillRect(0, 280, 1920, 200);
    cx.restore();
  }

  function _drawBarCounter(cx) {
    // Bar counter top surface at back of Regular zone (y ≈ 496)
    const by = 496, lx = _ex(by) + 12, rx = 1920 - lx;
    cx.save(); cx.globalAlpha = 0.58;

    // Counter surface (perspective trapezoid, thin)
    const ctG = cx.createLinearGradient(0, by, 0, by + 24);
    ctG.addColorStop(0, '#0e2a40'); ctG.addColorStop(1, '#081822');
    _trap(cx, by, by + 24, ctG);
    cx.strokeStyle = '#00aacc'; cx.lineWidth = 1.5;
    cx.beginPath(); cx.moveTo(lx, by); cx.lineTo(rx, by); cx.stroke();
    // Neon under-counter strip
    cx.strokeStyle = '#00ccff'; cx.lineWidth = 1;
    cx.shadowColor = '#00ccff'; cx.shadowBlur = 6;
    cx.beginPath(); cx.moveTo(lx, by + 24); cx.lineTo(rx, by + 24); cx.stroke();
    cx.shadowBlur = 0;

    // Bottle silhouettes behind counter
    cx.fillStyle = '#004466';
    for (let i = 0; i < 10; i++) {
      const bx = lx + 50 + i * ((rx - lx - 100) / 10);
      const bh = 28 + (i % 3) * 8;
      cx.fillRect(bx, by - bh, 7, bh);
      cx.beginPath(); cx.arc(bx + 3.5, by - bh - 5, 5, Math.PI, 0); cx.fill();
    }
    // Glass shimmers
    cx.strokeStyle = 'rgba(0, 200, 255, 0.3)'; cx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const gx = lx + 100 + i * 120;
      cx.beginPath(); cx.arc(gx, by + 10, 10, 0, Math.PI * 2); cx.stroke();
    }
    cx.restore();
  }

  // ── Avatar circle ─────────────────────────────────────────────────────────

  function _avatar(ctx, u, cx, cy, r) {
    const img = global.AvatarLoader?.get(u.userId);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    if (img) {
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    } else {
      const fb = global.AvatarLoader?.getFallbackCanvas(u.userId, u.nickname, r * 2);
      if (fb) ctx.drawImage(fb, cx - r, cy - r, r * 2, r * 2);
      else { ctx.fillStyle = '#444'; ctx.fill(); }
    }
    ctx.restore();
    // Zone-tinted border ring
    const ring = { djStage: '#ffd700', vip: '#cc88ff', regular: 'rgba(255,255,255,0.7)', danceFloor: 'rgba(255,255,255,0.45)' };
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = ring[u.zone] ?? 'rgba(255,255,255,0.5)';
    ctx.lineWidth = u.zone === 'djStage' ? 3.5 : u.zone === 'vip' ? 2.5 : 1.5;
    ctx.stroke();
  }

  function _character(ctx, u, frameTime) {
    // Stronger depth scale — makes far zones visually smaller
    const scale = 0.44 + u.depth * 0.56;
    const r     = _cfg.character.baseRadius * scale;
    const amp   = _cfg.character.idleBobbingAmp;
    const bob   = u.animState === 'dancing'
      ? Math.sin(frameTime * 0.003 + u.userId.charCodeAt(0) * 0.7) * amp * scale : 0;
    const bow   = u.animState === 'bowing' ? r * 0.35 : 0;
    const pulse = u.animState === 'celebrating' ? 1 + Math.sin(frameTime * 0.012) * 0.13 : 1;
    const cx    = u.pos.x, cy = u.pos.y + bob + bow;

    // Ground shadow ellipse
    ctx.save();
    ctx.globalAlpha = 0.28 * u.depth;
    ctx.beginPath(); ctx.ellipse(cx, cy + r + 3, r * 0.85, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();

    // Prestige glow ring for VIP / DJ
    if (u.zone === 'djStage' || u.zone === 'vip') {
      const glowColor = u.zone === 'djStage' ? '#ffd700' : '#cc88ff';
      ctx.save();
      ctx.strokeStyle = glowColor; ctx.lineWidth = 8 * scale; ctx.globalAlpha = 0.30;
      ctx.beginPath(); ctx.arc(cx, cy, r + 5 * scale, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // Scale pulse for celebrating
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(pulse, pulse); ctx.translate(-cx, -cy);
    _avatar(ctx, u, cx, cy, r);
    ctx.restore();

    // Crown (VIP / DJ Stage)
    if (u.zone === 'vip' || u.zone === 'djStage') {
      ctx.font = `${Math.round(13 * scale)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('👑', cx, cy - r - 2);
    }

    // Team badge dot
    if (u.team) {
      ctx.beginPath(); ctx.arc(cx + r * 0.72, cy - r * 0.72, 5 * scale, 0, Math.PI * 2);
      ctx.fillStyle = _cfg.teamColors[u.team]; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    }

    // Nickname
    const ns = Math.max(0.68, scale);
    ctx.font = `700 ${Math.round(11 * ns)}px "Segoe UI",Arial,sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.70)';
    ctx.fillText(u.nickname, cx + 1, cy + r + 4);
    ctx.fillStyle = '#fff';
    ctx.fillText(u.nickname, cx, cy + r + 3);
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  function _hud(ctx, es, ms) {
    _leaderboard(ctx, es);
    _hypeBar(ctx, ms.hypeBar);
    if (ms.pkVip.state === 'active') _pkVip(ctx, ms.pkVip);
    if (ms.redBlue.active)           _redBlue(ctx, ms.redBlue);
  }

  function _leaderboard(ctx, es) {
    const top = es.leaderboard.slice(0, 5);
    if (!top.length) return;
    const px = 1718, py = 18, bw = 194, rh = 36;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.beginPath(); ctx.roundRect(px, py, bw, 10 + top.length * rh, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    ctx.stroke();
    top.forEach((uid, i) => {
      const u = es.users.get(uid); if (!u) return;
      const ry = py + 10 + i * rh;
      ctx.font = '700 12px "Segoe UI",Arial,sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(`${['🥇','🥈','🥉','4️⃣','5️⃣'][i]} ${u.nickname.slice(0, 11)}`, px + 8, ry + rh / 2);
      ctx.fillStyle = '#ffd700'; ctx.textAlign = 'right';
      ctx.fillText(`${u.totalCoinsSpent}💎`, px + bw - 8, ry + rh / 2);
    });
    ctx.restore();
  }

  function _hypeBar(ctx, h) {
    const bx = 760, by = 1048, bw = 400, bh = 20;
    const fill = h.quayActive ? bw : (h.energy / h.maxEnergy) * bw;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill();
    const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, '#ff4477'); grad.addColorStop(1, '#ffcc00');
    ctx.fillStyle = h.quayActive ? '#ffd700' : grad;
    ctx.globalAlpha = h.quayActive ? 0.7 + Math.sin(Date.now() * 0.01) * 0.3 : 1;
    if (fill > 0) { ctx.beginPath(); ctx.roundRect(bx, by, fill, bh, 10); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.font = '700 11px "Segoe UI",Arial,sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
    ctx.fillText(h.quayActive ? '🔥 QUẨY TIME!' : `${Math.round(h.energy)} / ${h.maxEnergy} 🔥`, bx + bw / 2, by + bh / 2);
    ctx.restore();
  }

  function _pkVip(ctx, pk) {
    ctx.save();
    ctx.fillStyle = 'rgba(70,0,70,0.78)'; ctx.beginPath(); ctx.roundRect(760, 8, 400, 62, 8); ctx.fill();
    ctx.strokeStyle = '#ff00aa'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = '700 18px "Segoe UI",Arial,sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700'; ctx.textBaseline = 'middle';
    ctx.fillText(`⚔️ PK BÀN VIP — ${Math.ceil(pk.timer / 1000)}s`, 960, 39);
    ctx.restore();
  }

  function _redBlue(ctx, rb) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.68)'; ctx.beginPath(); ctx.roundRect(18, 398, 168, 90, 8); ctx.fill();
    ctx.font = '700 13px "Segoe UI",Arial,sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff4444'; ctx.textAlign = 'left'; ctx.fillText(`🔴  ${rb.teams.red.coins}💎`, 28, 426);
    ctx.fillStyle = '#4488ff'; ctx.fillText(`🔵  ${rb.teams.blue.coins}💎`, 28, 452);
    ctx.fillStyle = '#aaa'; ctx.fillText(`⏱  ${Math.ceil(rb.timer / 60000)}m còn lại`, 28, 472);
    ctx.restore();
  }

  // ── Per-frame dynamic overlay ─────────────────────────────────────────────

  function _dynamicOverlay(ctx, ms, frameTime) {
    // Rotating disco ball rays
    const angle = (frameTime * 0.0006) % (Math.PI * 2);
    ctx.save(); ctx.globalAlpha = 0.07;
    for (let i = 0; i < 14; i++) {
      const a = angle + (i / 14) * Math.PI * 2;
      const len = 600;
      ctx.strokeStyle = ['#ff00aa','#00ffcc','#ffaa00','#00aaff','#ff4400'][i % 5];
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(960, 35);
      ctx.lineTo(960 + Math.cos(a) * len, 35 + Math.sin(a) * len * 0.65);
      ctx.stroke();
    }
    ctx.restore();

    // Quẩy Time: pulsing neon floor
    if (ms.hypeBar.quayActive) {
      const t = 0.10 + Math.sin(frameTime * 0.016) * 0.07;
      ctx.save(); ctx.globalAlpha = t;
      const fg = ctx.createLinearGradient(0, 660, 0, 1080);
      fg.addColorStop(0, '#ff0088'); fg.addColorStop(0.5, '#aa00ff'); fg.addColorStop(1, 'transparent');
      ctx.fillStyle = fg; ctx.fillRect(0, 660, 1920, 420);
      ctx.restore();
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  global.Renderer = {
    init(canvas, config) {
      _cfg = config;
      _bg  = _buildBg();
    },

    draw(ctx, es, ms, frameTime) {
      const w = ctx.canvas.width, h = ctx.canvas.height;
      ctx.drawImage(_bg, 0, 0, w, h);

      _dynamicOverlay(ctx, ms, frameTime);

      const users = Array.from(es.users.values());
      users.forEach(u => {
        u.pos.x += (u.targetPos.x - u.pos.x) * _cfg.character.tweenSpeed;
        u.pos.y += (u.targetPos.y - u.pos.y) * _cfg.character.tweenSpeed;
      });
      users.sort((a, b) => a.pos.y - b.pos.y).forEach(u => _character(ctx, u, frameTime));

      _hud(ctx, es, ms);
      global.VFXSystem?.draw(ctx);
    },
  };
})(window);
