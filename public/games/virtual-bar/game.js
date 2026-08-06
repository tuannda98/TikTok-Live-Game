/**
 * game.js — Virtual Bar entry point.
 * Wires TikTokBridge events → BarEngine + MiniGames, bridges mini-game events
 * to VFXSystem, and runs the requestAnimationFrame render loop.
 *
 * @module games/virtual-bar/game
 */

(() => {
  if (window.__BAR_RUNNING) { console.warn('[VirtualBar] Already running'); return; }
  if (!window.TikTokBridge || !window.BAR_CONFIG || !window.BarEngine ||
      !window.MiniGames || !window.VFXSystem || !window.Renderer) {
    console.warn('[VirtualBar] Missing dependencies — aborting');
    return;
  }
  window.__BAR_RUNNING = true;

  // ── Canvas setup ──────────────────────────────────────────────────────────

  const canvas = document.getElementById('barCanvas');
  const ctx    = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth  || document.documentElement.clientWidth  || 1920;
    canvas.height = window.innerHeight || document.documentElement.clientHeight || 1080;
    Renderer.init(canvas, BAR_CONFIG);
  }
  window.addEventListener('resize', resize);
  resize();

  // ── Module init ───────────────────────────────────────────────────────────

  const engine    = new BarEngine(BAR_CONFIG);
  const miniGames = new MiniGames(BAR_CONFIG);
  engine.setMiniGames(miniGames);

  // ── TikTokBridge → Engine ─────────────────────────────────────────────────

  TikTokBridge.on('gift', data => engine.handleGift(data));
  TikTokBridge.on('chat', data => engine.handleChat(data));
  TikTokBridge.on('like', data => engine.handleLike(data));

  TikTokBridge.on('connected',    () => console.log('[VirtualBar] TikTok connected'));
  TikTokBridge.on('disconnected', () => console.log('[VirtualBar] TikTok disconnected'));
  TikTokBridge.on('error',        d  => console.error('[VirtualBar] TikTok error:', d.message));

  // ── Engine giftTier → VFX ─────────────────────────────────────────────────

  const TIER_VFX = ['heartFloat', 'confettiBurst', 'moneyRain', 'champagnePop', 'strobeFlash', 'blackoutLaser'];

  engine.on('giftTier', ({ tier, userId, coins, x, y }) => {
    VFXSystem.trigger(TIER_VFX[tier] || 'confettiBurst', { x, y, userId, coins });
    if (tier === 4) VFXSystem.trigger('bannerText', { text: `💰 ${engine.getNickname(userId)} bao trọn Bàn VIP!` });
  });

  // ── Mini-game events → Engine side-effects + VFX ──────────────────────────

  miniGames.on('pkVipStart', () => {
    VFXSystem.trigger('bannerText', { text: '⚔️ PK BÀN VIP BẮT ĐẦU! Gửi quà ngay!' });
  });

  miniGames.on('pkVipWinner', ({ userId, coins }) => {
    const name = engine.getNickname(userId);
    engine.moveToVip(userId);
    VFXSystem.trigger('champagnePop', { x: 960, y: 400 });
    VFXSystem.trigger('bannerText', { text: `👑 ${name} chiếm Bàn VIP! (${coins}💎)` });
  });

  miniGames.on('quayTime', () => {
    engine.setAllDancing();
    VFXSystem.trigger('quayTimeBanner', {});
    VFXSystem.trigger('strobeFlash', {});
  });

  miniGames.on('redBlueStart', () => {
    VFXSystem.trigger('bannerText', { text: '🔴 vs 🔵 — Comment ĐỎ hoặc XANH để chọn team!' });
  });

  miniGames.on('redBlueResult', ({ winner, teams }) => {
    const winLabel = winner === 'red' ? '🔴 Team Đỏ (Whisky)' : '🔵 Team Xanh (Vodka)';
    VFXSystem.trigger('teamWin', { team: winner });
    VFXSystem.trigger('bannerText', { text: `${winLabel} THẮNG! 🎉` });
  });

  // ── Render loop ───────────────────────────────────────────────────────────

  let lastTime = 0;

  function frame(now) {
    const dtMs = Math.min(now - lastTime, 50); // cap at 50ms to avoid spiral-of-death on tab resume
    lastTime = now;

    engine.tick(dtMs);
    miniGames.tick(dtMs);
    VFXSystem.tick(dtMs);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    Renderer.draw(ctx, engine.getState(), miniGames.getState(), now);

    requestAnimationFrame(frame);
  }

  // ── Test mode: spawn demo characters when ?id=test ───────────────────────

  if (new URLSearchParams(location.search).get('id') === 'test') {
    const NAMES = [
      'Minh_Dance', 'Linh', 'Hải', 'An', 'Tuấn', 'Hương',
      'Phong', 'Khánh', 'Ngân', 'Bảo', 'Trang', 'Huy',
      'Quân', 'Mai', 'Đức', 'Thu', 'Long', 'Yến',
    ];

    function _fake(id, name) {
      return { user: { uniqueId: id, nickname: name, profilePictureUrl: '' } };
    }

    // Dance floor crowd (chat join command)
    NAMES.forEach((n, i) => engine.handleChat({ ..._fake(`u${i}`, n), comment: '1' }));

    // Regular zone (10–99 coins)
    [['r0','Regular_Alex', 30], ['r1','Regular_Sam', 80]].forEach(([id, n, v]) =>
      engine.handleGift({ ..._fake(id, n), giftValue: v, repeatCount: 1 })
    );

    // VIP zone (100–999 coins)
    [['v0','💎VIP_Rose', 300], ['v1','💎VIP_King', 800]].forEach(([id, n, v]) =>
      engine.handleGift({ ..._fake(id, n), giftValue: v, repeatCount: 1 })
    );

    // DJ Stage (≥5000 coins)
    engine.handleGift({ ..._fake('dj0', '🎧 DJ_Boss'), giftValue: 5000, repeatCount: 1 });

    // Team assignments for a few dancers
    [['u0','đỏ'],['u1','xanh'],['u2','đỏ'],['u3','xanh'],['u4','đỏ']].forEach(([id, cmd]) =>
      engine.handleChat({ ..._fake(id, ''), comment: cmd })
    );

    // Celebrating state on a few users so all animation states are visible
    setTimeout(() => {
      engine.handleGift({ ..._fake('u5', 'Hương'), giftValue: 5, repeatCount: 2 });
      engine.handleGift({ ..._fake('u6', 'Phong'), giftValue: 8, repeatCount: 1 });
    }, 800);

    // Periodic new arrivals — simulates live stream trickling in
    let _seq = NAMES.length;
    setInterval(() => {
      engine.handleChat({ ..._fake(`live_${_seq}`, `Viewer${_seq++}`), comment: '1' });
    }, 2500);

    // Periodic small gifts — keeps animations alive
    setInterval(() => {
      const uid = `u${Math.floor(Math.random() * NAMES.length)}`;
      engine.handleGift({ ..._fake(uid, engine.getNickname(uid)), giftValue: 1, repeatCount: 1 });
    }, 1800);

    console.log('[VirtualBar] Test mode: spawned demo characters');
  }

  // Wait for fonts before first draw so text renders correctly
  document.fonts.ready.then(() => {
    console.log('[VirtualBar] Starting render loop');
    requestAnimationFrame(frame);
  });
})();
