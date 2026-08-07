// panels.js — Canvas UI panels: leaderboard, rules, team title

import * as THREE from 'three';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makePlane(cw, ch) {
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(cw, ch),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }),
  );
  mesh.renderOrder = 8;
  const group = new THREE.Group();
  group.add(mesh);
  return { ctx, tex, group, w: cw, h: ch };
}

// ── TOP TẶNG QUÀ ──────────────────────────────────────────────────────────────
export function createTopPanel() {
  const PW = 470, PH = 396, ROWS = 5;
  const { ctx, tex, group, w, h } = makePlane(PW, PH);

  const badges = [];
  for (let i = 1; i <= 6; i++) {
    const img = new Image();
    img.onload = draw;
    img.src = `assets/badges/${i}.png`;
    badges[i - 1] = img;
  }

  const leaderboard = new Map(); // name → coins

  function draw() {
    ctx.clearRect(0, 0, PW, PH);
    ctx.fillStyle = 'rgba(12,9,22,0.60)';
    roundRect(ctx, 0, 0, PW, PH, 24); ctx.fill();
    ctx.strokeStyle = 'rgba(255,212,120,0.55)';
    ctx.lineWidth = 3;
    roundRect(ctx, 2.5, 2.5, PW - 5, PH - 5, 22); ctx.stroke();

    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd86a';
    ctx.font = '800 34px "Segoe UI", Arial, sans-serif';
    ctx.fillText('TOP TẶNG QUÀ', 26, 40);
    ctx.strokeStyle = 'rgba(255,212,120,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(26, 66); ctx.lineTo(PW - 26, 66); ctx.stroke();

    const entries = [...leaderboard.entries()].sort((a, b) => b[1] - a[1]).slice(0, ROWS);
    const topY = 80, rowH = (PH - topY - 12) / ROWS;
    for (let i = 0; i < ROWS; i++) {
      const cy = topY + rowH * i + rowH / 2;
      const badge = badges[Math.min(5, i)];
      const bh = rowH * 0.86, bw = bh * (512 / 320);
      if (badge?.complete && badge.naturalWidth) ctx.drawImage(badge, 20, cy - bh / 2, bw, bh);
      const tx = 20 + bw + 12;
      const entry = entries[i];
      ctx.textBaseline = 'middle';
      if (entry) {
        const label = entry[0].length > 13 ? entry[0].slice(0, 12) + '…' : entry[0];
        ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
        ctx.font = '700 26px "Segoe UI", Arial, sans-serif';
        ctx.fillText(label, tx, cy);
        const coins = entry[1];
        const coinStr = coins >= 1e6 ? (coins / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
          : coins >= 1000 ? (coins / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(coins);
        ctx.textAlign = 'right'; ctx.fillStyle = '#ffd86a';
        ctx.font = '800 25px "Segoe UI", Arial, sans-serif';
        ctx.fillText('💎 ' + coinStr, PW - 22, cy);
      } else {
        ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.26)';
        ctx.font = '600 22px "Segoe UI", Arial, sans-serif';
        ctx.fillText('Chờ người tặng…', tx, cy);
      }
    }
    tex.needsUpdate = true;
  }

  draw();
  return {
    group, w: PW, h: PH,
    addToLeaderboard(name, coins) {
      leaderboard.set(name, (leaderboard.get(name) || 0) + coins);
      draw();
    },
  };
}

// ── LUẬT CHƠI ─────────────────────────────────────────────────────────────────
export function createLuatPanel() {
  const PW = 500, ROWS = 5, PH = 74 + ROWS * 54 + 16;
  const { ctx, tex, group, w, h } = makePlane(PW, PH);
  const ICON_H = 40;

  const giftImgs = {};
  for (const g of ['hoa', 'tiktok', 'hoanho', 'dinh']) {
    const img = new Image();
    img.onload = draw;
    img.src = `assets/gifts/${g}.webp`;
    giftImgs[g] = img;
  }

  let nicks = { chihuahua: 'Tí Khè', bun: 'Moi Bảnh', husky: 'Hưng Husky', begie: 'Long Mõm' };

  function drawHeart(x, y, sz) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sz / 32, sz / 32);
    ctx.fillStyle = '#ff3b6b'; ctx.beginPath();
    ctx.moveTo(0, -6); ctx.bezierCurveTo(0, -14, -18, -16, -18, -2);
    ctx.bezierCurveTo(-18, 10, 0, 18, 0, 24);
    ctx.bezierCurveTo(0, 18, 18, 10, 18, -2);
    ctx.bezierCurveTo(18, -16, 0, -14, 0, -6);
    ctx.fill(); ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, PW, PH);
    ctx.fillStyle = 'rgba(12,9,22,0.60)';
    roundRect(ctx, 0, 0, PW, PH, 24); ctx.fill();
    ctx.strokeStyle = 'rgba(120,210,255,0.55)';
    ctx.lineWidth = 3;
    roundRect(ctx, 2.5, 2.5, PW - 5, PH - 5, 22); ctx.stroke();

    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = '#8fe6ff';
    ctx.font = '800 32px "Segoe UI", Arial, sans-serif';
    ctx.fillText('LUẬT CHƠI', 26, 40);
    ctx.strokeStyle = 'rgba(120,210,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(26, 64); ctx.lineTo(PW - 26, 64); ctx.stroke();

    const rules = [
      ['hoa', 'Tặng Hoa', `${nicks.chihuahua} ra`],
      ['tiktok', 'Tặng TikTok', `${nicks.bun} ra`],
      ['hoanho', 'Tặng Hoan hô', `${nicks.husky} ra`],
      ['dinh', 'Tặng Đỉnh', `${nicks.begie} ra`],
      [null, 'Bắn tim', 'cả nhóm cúi chào'],
    ];
    let cy = 101;
    for (const [key, label, result] of rules) {
      if (key) {
        const img = giftImgs[key];
        if (img?.complete && img.naturalWidth) ctx.drawImage(img, 22, cy - ICON_H / 2, ICON_H, ICON_H);
      } else {
        drawHeart(42, cy, 34);
      }
      const tx = 22 + ICON_H + 12;
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
      ctx.font = '700 24px "Segoe UI", Arial, sans-serif';
      ctx.fillText(label, tx, cy);
      ctx.fillStyle = '#8fe6ff'; ctx.font = '800 22px "Segoe UI", Arial';
      ctx.fillText('→', tx + 158, cy);
      ctx.fillStyle = '#ffd86a'; ctx.font = '700 23px "Segoe UI", Arial, sans-serif';
      ctx.fillText(result, tx + 190, cy);
      cy += 54;
    }
    tex.needsUpdate = true;
  }

  draw();
  return {
    group, w: PW, h: PH,
    updateNicknames(n) { nicks = { ...nicks, ...n }; draw(); },
  };
}

// ── TIÊU ĐỀ (Team name + slogan) ─────────────────────────────────────────────
export function createTieuPanel() {
  const PW = 640, PH = 150;
  const { ctx, tex, group } = makePlane(PW, PH);
  let teamName = 'F4 Báo Thủ Online';
  let slogan = 'Bốn anh em, một cái mõm — không ngán khu phố nào.';

  function autoSize(text, maxW, initSz, weight) {
    let sz = initSz;
    while (sz > 12) {
      ctx.font = `${weight} ${sz}px "Segoe UI", Arial, sans-serif`;
      if (ctx.measureText(text).width <= maxW) break;
      sz -= 2;
    }
    return sz;
  }

  function draw() {
    ctx.clearRect(0, 0, PW, PH);
    ctx.fillStyle = 'rgba(12,9,22,0.58)';
    roundRect(ctx, 0, 0, PW, PH, 30); ctx.fill();
    ctx.strokeStyle = 'rgba(255,120,60,0.6)'; ctx.lineWidth = 3;
    roundRect(ctx, 3, 3, PW - 6, PH - 6, 27); ctx.stroke();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cx = PW / 2;
    autoSize(teamName, PW - 60, 62, '900');
    const grad = ctx.createLinearGradient(0, 30, 0, 96);
    grad.addColorStop(0, '#ffe08a'); grad.addColorStop(1, '#ff7a2f');
    ctx.lineJoin = 'round'; ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(teamName, cx, 58);
    ctx.fillStyle = grad; ctx.fillText(teamName, cx, 58);
    autoSize(slogan, PW - 56, 26, '600');
    ctx.fillStyle = '#e7e0ff'; ctx.fillText(slogan, cx, 116);
    tex.needsUpdate = true;
  }

  draw();
  return {
    group, w: PW, h: PH,
    update({ tenNhom, khauHieu } = {}) {
      if (typeof tenNhom === 'string') teamName = tenNhom;
      if (typeof khauHieu === 'string') slogan = khauHieu;
      draw();
    },
  };
}
