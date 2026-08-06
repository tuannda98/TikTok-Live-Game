---
phase: 6
title: "Wiring & Integration — game.js + Dashboard"
status: pending
priority: P1
effort: "2h"
dependencies: [2, 3, 4, 5]
---

# Phase 6: Wiring & Integration — game.js + Dashboard

## Context Links
- Engine: `public/games/virtual-bar/bar-engine.js`
- Mini-games: `public/games/virtual-bar/mini-games.js`
- VFX: `public/games/virtual-bar/vfx-system.js`
- Renderer: `public/games/virtual-bar/renderer.js`
- Dashboard: [`public/index.html`](../../public/index.html)
- Bridge SDK: [`public/lib/tiktok-bridge.js`](../../public/lib/tiktok-bridge.js)
- Reference wiring: [`public/games/horse-racing/game.js`](../../public/games/horse-racing/game.js)

## Overview
`game.js` is the entry point — wires `TikTokBridge` events → `BarEngine` + `MiniGames`, subscribes to mini-game events → `VFXSystem` triggers, and runs the `requestAnimationFrame` render loop. Also adds the game card to `public/index.html` dashboard.

## Requirements
- **Functional**: full event wiring, rAF loop at 60fps, mini-game → VFX event bridge, reconnect handling
- **Non-functional**: ≤120 lines, duplicate-run guard (`window.__BAR_RUNNING`), no business logic in game.js

## Architecture

### game.js structure
```js
(() => {
  // 1. Guard: no duplicate runs
  if (window.__BAR_RUNNING) return;
  if (!window.TikTokBridge || !window.BAR_CONFIG || !window.BarEngine /* ... */) {
    console.warn('[VirtualBar] Missing dependencies'); return;
  }
  window.__BAR_RUNNING = true;

  // 2. Init canvas
  const canvas = document.getElementById('barCanvas');
  const ctx = canvas.getContext('2d');
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize);
  resize();

  // 3. Init modules
  const engine = new BarEngine(window.BAR_CONFIG);
  const miniGames = new MiniGames(window.BAR_CONFIG);
  Renderer.init(canvas, engine, miniGames);

  // 4. TikTokBridge event wiring
  TikTokBridge.on('gift', data => engine.handleGift(data));
  TikTokBridge.on('chat', data => engine.handleChat(data));
  TikTokBridge.on('like', data => engine.handleLike(data));
  TikTokBridge.on('connected', () => console.log('[VirtualBar] Connected'));
  TikTokBridge.on('disconnected', () => { /* show overlay */ });

  // 5. Mini-game → VFX event bridge
  miniGames.on('pkVipWinner', ({ userId, nickname }) => {
    VFXSystem.trigger('bannerText', { text: `👑 ${nickname} chiếm Bàn VIP!` });
    engine.moveToVip(userId);
  });
  miniGames.on('quayTime', () => {
    VFXSystem.trigger('quayTimeBanner', {});
    engine.setAllDancing();
  });
  miniGames.on('redBlueResult', ({ winner, teams }) => {
    VFXSystem.trigger('teamWin', { team: winner });
    VFXSystem.trigger('bannerText', { text: `Team ${winner === 'red' ? 'Đỏ 🔴' : 'Xanh 🔵'} thắng!` });
  });

  // 6. Engine → VFX tier effects bridge
  engine.on('giftTier', ({ tier, userId, coins, x, y }) => {
    const effects = ['heartFloat','confettiBurst','moneyRain','champagnePop','strobeFlash','blackoutLaser'];
    VFXSystem.trigger(effects[tier], { x, y, userId, coins });
    if (tier === 4) VFXSystem.trigger('bannerText', { text: `💰 ${engine.getNickname(userId)} bao trọn Bàn VIP!` });
  });

  // 7. rAF render loop
  let lastTime = 0;
  function frame(now) {
    const dtMs = Math.min(now - lastTime, 50); // cap at 50ms
    lastTime = now;
    engine.tick(dtMs);
    miniGames.tick(dtMs);
    VFXSystem.tick(dtMs);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    Renderer.draw(ctx, engine.getState(), miniGames.getState());
    requestAnimationFrame(frame);
  }
  document.fonts.ready.then(() => requestAnimationFrame(frame));
})();
```

### engine.on('giftTier') — add to BarEngine
`BarEngine` must emit a `'giftTier'` event after computing tier + moving zone:
```js
// Inside _applyGiftTier after moveZone:
this._emit('giftTier', { tier, userId, coins, x: user.pos.x, y: user.pos.y });
```
This is a 2-line addition to bar-engine.js, not a new file.

### engine.setAllDancing() — add to BarEngine
Sets `animState = 'dancing'` for all users (triggered by Quẩy Time):
```js
setAllDancing() {
  this.state.users.forEach(u => { u.animState = 'dancing'; u.animTimer = 30_000; });
}
```

### engine.moveToVip(userId) — add to BarEngine
Alias for `_moveZone(userId, 'vip')` — called from PK VIP winner event.

### engine.getNickname(userId)
```js
getNickname(userId) { return this.state.users.get(userId)?.nickname ?? userId; }
```

### Dashboard card (public/index.html)
Add game card in the games grid:
```html
<div class="game-card" data-game="virtual-bar" data-entry="index.html" data-param="id">
  <div class="game-icon">🍸</div>
  <div class="game-info">
    <h3>Sàn Bar Ảo</h3>
    <p>Bar sôi động — quà to lên zone VIP, đua top DJ Stage</p>
  </div>
  <div class="game-status available">Có sẵn</div>
</div>
```

## Related Code Files
- **Create**: `public/games/virtual-bar/game.js`
- **Modify**: `public/index.html` (add game card)
- **Modify**: `public/games/virtual-bar/bar-engine.js` (add `giftTier` event emit, `setAllDancing`, `moveToVip`, `getNickname`)

## Implementation Steps
1. Write `game.js` with duplicate guard + canvas init + module init
2. Wire `TikTokBridge` events → `engine` handlers
3. Wire `miniGames.on()` events → `VFXSystem.trigger()` + engine side-effects
4. Wire `engine.on('giftTier')` → `VFXSystem.trigger()` per tier
5. Add `document.fonts.ready.then(...)` rAF loop start
6. Add 4 small methods to `bar-engine.js`: `on()`, `_emit()`, `setAllDancing()`, `moveToVip()`, `getNickname()`
7. Add game card to `public/index.html`
8. Test full flow: open `index.html?id=test`, check no console errors

## Todo
- [ ] Write game.js (duplicate guard, canvas, module init)
- [ ] TikTokBridge → engine wiring
- [ ] miniGames events → VFX + engine side-effects
- [ ] engine giftTier event → VFX per tier
- [ ] rAF loop with dtMs cap + fonts.ready guard
- [ ] Add on()/emit()/_emit() to BarEngine
- [ ] Add setAllDancing() + moveToVip() + getNickname() to BarEngine
- [ ] Dashboard game card in public/index.html
- [ ] Smoke test: no console errors on load

## Success Criteria
- [ ] Game loads at `http://localhost:3000/games/virtual-bar/index.html?id=test` with no JS errors
- [ ] rAF loop runs at ~60fps (check with `performance.now()` logging)
- [ ] TikTokBridge gift event → character moves zone (visible in canvas)
- [ ] Dashboard card appears and URL generated correctly
- [ ] VFX effect fires on gift receipt

## Risk Assessment
- `document.fonts.ready` may resolve before fonts used in canvas — verify first draw doesn't show fallback fonts
- `dtMs` capped at 50ms prevents spiral of death on tab-hidden resume; keep cap in place
- BarEngine needs `on()`/`_emit()` pattern added in Phase 2 if not already — this phase adds it if missed; treat as additive not breaking
