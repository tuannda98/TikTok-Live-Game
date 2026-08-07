// game.js — Bộ Tứ Chó Cảnh: Three.js video scene

import * as THREE from 'three';
import { createTopPanel, createLuatPanel, createTieuPanel } from './panels.js';

// ── Renderer / camera ─────────────────────────────────────────────────────────
const W = 720, H = 1280;
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -1000, 1000);
camera.position.z = 1;

// ── Videos ────────────────────────────────────────────────────────────────────
const VIDEO_NAMES = ['idle', 'chihuahua', 'bun', 'husky', 'begie', 'chao'];
const vids = {}, texs = {};
for (const name of VIDEO_NAMES) {
  const v = Object.assign(document.createElement('video'), {
    src: `assets/videos/${name}.mp4`, loop: name === 'idle',
    muted: true, playsInline: true, preload: 'auto',
  });
  v.setAttribute('playsinline', '');
  vids[name] = v;
  const t = new THREE.VideoTexture(v);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  texs[name] = t;
}

// ── Crossfade material ────────────────────────────────────────────────────────
const crossMat = new THREE.ShaderMaterial({
  uniforms: { texA: { value: texs.idle }, texB: { value: texs.idle }, mixAmt: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform sampler2D texA,texB;uniform float mixAmt;varying vec2 vUv;void main(){gl_FragColor=mix(texture2D(texA,vUv),texture2D(texB,vUv),mixAmt);}`,
});
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(W, H), crossMat));

// ── Video state machine ───────────────────────────────────────────────────────
let cur = 'idle', tr = null;
const q = [];
const play = (n) => { try { vids[n].currentTime = 0; } catch {} vids[n].play().catch(() => {}); };

function switchTo(name, dur = 0.28) {
  play(name);
  if (dur <= 0) {
    crossMat.uniforms.texA.value = crossMat.uniforms.texB.value = texs[name];
    crossMat.uniforms.mixAmt.value = 0;
    if (cur !== name) vids[cur].pause();
    cur = name; return;
  }
  crossMat.uniforms.texB.value = texs[name];
  crossMat.uniforms.mixAmt.value = 0;
  tr = { from: cur, to: name, elapsed: 0, dur };
}

function trigger(name) {
  if (cur === 'idle' && !tr) switchTo(name, 0.28);
  else if (cur !== name && !q.includes(name)) q.push(name);
}

for (const name of VIDEO_NAMES) {
  if (name !== 'idle') {
    vids[name].addEventListener('ended', () => {
      if (cur !== name || tr) return;
      q.length ? switchTo(q.shift(), 0) : switchTo('idle', 0.28);
    });
  }
}

// ── Gift → dog mapping ────────────────────────────────────────────────────────
const DOG_CYCLE = ['chihuahua', 'bun', 'husky', 'begie'];
let giftIdx = 0;
function giftToDog(giftName) {
  const s = String(giftName || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  if (/hoan|clap|applause|vo.?tay/.test(s)) return 'husky';
  if (/hoa|rose|hong/.test(s)) return 'chihuahua';
  if (/tiktok/.test(s)) return 'bun';
  if (/dinh|gg|perfect|top/.test(s)) return 'begie';
  return DOG_CYCLE[giftIdx++ % 4];
}

// ── Hearts pool ───────────────────────────────────────────────────────────────
const hcv = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
const hctx = hcv.getContext('2d');
hctx.fillStyle = '#ff3b6b'; hctx.beginPath();
hctx.moveTo(32, 18); hctx.bezierCurveTo(32, 8, 14, 0, 6, 14);
hctx.bezierCurveTo(-4, 30, 20, 48, 32, 58);
hctx.bezierCurveTo(44, 48, 68, 30, 58, 14);
hctx.bezierCurveTo(50, 0, 32, 8, 32, 18); hctx.fill();
const heartTex = new THREE.CanvasTexture(hcv);
heartTex.colorSpace = THREE.SRGBColorSpace;

const hearts = [];
for (let i = 0; i < 60; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthTest: false }));
  s.visible = false; s.renderOrder = 5;
  scene.add(s);
  hearts.push({ sprite: s, active: false, vy: 0, vx: 0, age: 0, maxAge: 0 });
}
let hPtr = 0;
function spawnHearts(n = 8) {
  for (let i = 0; i < n; i++) {
    const h = hearts[hPtr++ % 60];
    h.active = true; h.age = 0; h.maxAge = 1.6 + Math.random() * 1.4;
    const sz = 44 + Math.random() * 48;
    h.sprite.scale.set(sz, sz, 1);
    h.sprite.position.set((Math.random() - 0.5) * W * 0.65, -H / 2 + 40 + Math.random() * 80, 1);
    h.vy = 180 + Math.random() * 160; h.vx = (Math.random() - 0.5) * 55;
    h.sprite.material.opacity = 0; h.sprite.visible = true;
  }
}

// ── Panels ────────────────────────────────────────────────────────────────────
const topPanel = createTopPanel();
const luatPanel = createLuatPanel();
const tieuPanel = createTieuPanel();

function addOverlay(panel, key, def) {
  const saved = JSON.parse(localStorage.getItem('f4-lopphu-' + key) || 'null') || {};
  const cfg = { ...def, ...saved };
  const apply = () => { panel.group.position.set(cfg.x, cfg.y, 2); panel.group.scale.setScalar(cfg.s); };
  apply(); scene.add(panel.group);
  return { cfg, apply, key, save() { localStorage.setItem('f4-lopphu-' + key, JSON.stringify(cfg)); } };
}
const OV = {
  top: addOverlay(topPanel, 'top', { x: -186, y: 356, s: 0.6 }),
  luat: addOverlay(luatPanel, 'luat', { x: -186, y: 46, s: 0.56 }),
  tieu: addOverlay(tieuPanel, 'tieu', { x: 0, y: 548, s: 0.62 }),
};

function applyLayout(data) {
  for (const [k, ov] of Object.entries(OV)) {
    const v = data?.[k];
    if (!v) continue;
    if (typeof v.x === 'number') ov.cfg.x = v.x;
    if (typeof v.y === 'number') ov.cfg.y = v.y;
    if (typeof v.s === 'number') ov.cfg.s = v.s;
    ov.apply(); ov.save();
  }
}

// ── WebSocket /live (control channel) ────────────────────────────────────────
const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
let ws = null;
function connectWs() {
  ws = new WebSocket(`${wsProto}://${location.host}/live`);
  let beat;
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'beat' }));
    ws.send(JSON.stringify({ type: 'sceneOnline' }));
    beat = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'beat' })), 4000);
  };
  ws.onmessage = (e) => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.type === 'control') {
      if (m.key === 'liveConnect' && m.value) connectTikTok(m.value);
      else if (m.key === 'liveDisconnect') disconnectTikTok();
      else if (m.key === 'f4Chu') updateNicknames(m.value);
      else if (m.key === 'f4Layout') applyLayout(m.value);
    }
  };
  ws.onclose = () => { clearInterval(beat); setTimeout(connectWs, 3000); };
}
connectWs();

// ── Socket.io (TikTok events) ─────────────────────────────────────────────────
let socket = null, curUser = null;
function connectTikTok(username) {
  username = String(username).replace(/^@/, '').toLowerCase().trim();
  if (!username) return;
  if (socket) { socket.emit('leave-room', curUser); socket.disconnect(); socket = null; }
  curUser = username;
  socket = window.io(location.origin);
  socket.on('connect', () => socket.emit('join-room', username));
  socket.on('tiktok_gift', (p) => {
    if (p.repeatEnd === false) return; // skip intermediate combo events
    const dog = giftToDog(p.giftName);
    trigger(dog);
    const coins = Math.max(0, (p.giftValue || 1)) * Math.max(1, (p.repeatCount || 1));
    topPanel.addToLeaderboard(p.user?.nickname || '?', coins);
  });
  socket.on('tiktok_like', (p) => {
    const n = Math.min(26, 8 + Math.max(1, p.likeCount || 1));
    spawnHearts(n);
    triggerChao();
  });
  socket.on('room-joined', () => sendWsStatus(true, `Đã kết nối @${username}`));
  socket.on('connection-error', (e) => sendWsStatus(false, e?.message || 'Lỗi kết nối TikTok'));
}
function disconnectTikTok() {
  if (socket) { socket.emit('leave-room', curUser); socket.disconnect(); socket = null; }
  curUser = null;
  sendWsStatus(false, 'Đã ngắt kết nối TikTok');
}
function sendWsStatus(connected, message) {
  if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'status', connected, message }));
}

let lastChao = 0;
function triggerChao() {
  const now = performance.now();
  if (now - lastChao > 5000) { lastChao = now; trigger('chao'); }
}

function updateNicknames(data) {
  if (!data) return;
  luatPanel.updateNicknames(data);
  tieuPanel.update(data);
}

// ── Keyboard shortcuts (demo / test) ─────────────────────────────────────────
const DEMO_NAMES = ['Minh', 'Lan', 'Tuấn', 'Hà', 'Bảo', 'Ngọc', 'Khoa'];
const KEY_MAP = { Digit1: 'chihuahua', Digit2: 'bun', Digit3: 'husky', Digit4: 'begie' };
window.addEventListener('keydown', (e) => {
  const dog = KEY_MAP[e.code];
  if (dog) {
    trigger(dog);
    const name = DEMO_NAMES[Math.random() * DEMO_NAMES.length | 0];
    topPanel.addToLeaderboard(name, 5 + (Math.random() * 95 | 0));
    return;
  }
  if (e.code === 'KeyH') { trigger('chao'); spawnHearts(14); }
});

// ── Animation loop ────────────────────────────────────────────────────────────
let last = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  if (tr) {
    tr.elapsed += dt;
    const m = Math.min(1, tr.elapsed / tr.dur);
    crossMat.uniforms.mixAmt.value = m;
    if (m >= 1) {
      crossMat.uniforms.texA.value = crossMat.uniforms.texB.value;
      crossMat.uniforms.mixAmt.value = 0;
      if (tr.from !== tr.to) vids[tr.from].pause();
      cur = tr.to; tr = null;
    }
  }
  for (const t of Object.values(texs)) t.needsUpdate = true;
  for (const h of hearts) {
    if (!h.active) continue;
    h.age += dt;
    const p = h.age / h.maxAge;
    if (p >= 1) { h.active = false; h.sprite.visible = false; continue; }
    h.sprite.position.y += h.vy * dt;
    h.sprite.position.x += h.vx * dt + Math.sin(h.age * 3.5) * 20 * dt;
    h.sprite.material.opacity = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
vids.idle.play().catch(() => {});
