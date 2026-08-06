---
phase: 1
title: "Foundation — Config, Avatar Loader, Style"
status: pending
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: Foundation — Config, Avatar Loader, Style

## Context Links
- Brainstorm: [`reports/brainstorm-report.md`](./reports/brainstorm-report.md)
- Reference: [`public/games/horse-racing/config.js`](../../public/games/horse-racing/config.js)
- Docs: [`docs/GAME_DEVELOPMENT.md`](../../docs/GAME_DEVELOPMENT.md)

## Overview
Create the foundational files: `config.js` (all tunable constants), `avatar-loader.js` (image cache with CORS fallback), `style.css` (OBS transparent bg), and `index.html` scaffold (load order only, no game logic).

## Requirements
- **Functional**: All gift tiers, zone thresholds, chat commands, mini-game timers in one config
- **Non-functional**: avatar-loader ≤60 lines, config ≤150 lines, no logic in config

## Architecture

### config.js — structure
```js
window.BAR_CONFIG = {
  canvas: { width: 1920, height: 1080 },
  zones: {
    danceFloor: { maxUsers: 100, yRange: [660, 1080], depthRange: [0.85, 1.0] },
    regular:    { maxUsers: 20,  yRange: [480, 660],  depthRange: [0.75, 0.88] },
    vip:        { maxUsers: 10,  yRange: [280, 480],  depthRange: [0.65, 0.78] },
    djStage:    { maxUsers: 1,   yRange: [50, 280],   depthRange: [0.55, 0.68] },
  },
  giftTiers: [
    { minCoins: 0,    maxCoins: 0,    zone: 'danceFloor', tier: 0 },
    { minCoins: 1,    maxCoins: 9,    zone: 'danceFloor', tier: 1 },
    { minCoins: 10,   maxCoins: 99,   zone: 'regular',    tier: 2 },
    { minCoins: 100,  maxCoins: 999,  zone: 'vip',        tier: 3 },
    { minCoins: 1000, maxCoins: 4999, zone: 'vip',        tier: 4 },
    { minCoins: 5000, maxCoins: Infinity, zone: 'djStage', tier: 5 },
  ],
  chatCommands: {
    joinDance: ['1', 'vào bar', 'quẩy', 'vao bar'],
    teamRed:   ['đỏ', 'do', 'red', 'whisky'],
    teamBlue:  ['xanh', 'blue', 'vodka'],
  },
  queue: { batchIntervalMs: 300, batchSize: 10, priorityMinCoins: 100 },
  character: { baseRadius: 24, nameFont: '700 12px Arial', idleBobbingAmp: 3 },
  miniGames: {
    pkVip:   { intervalMs: 5 * 60_000, durationMs: 60_000 },
    hypeBar: { maxEnergy: 1000, quayTimeDurationMs: 30_000, decayPerSec: 0 },
    redBlue: { durationMs: 10 * 60_000 },
  },
};
```

### avatar-loader.js — structure
```js
// AvatarLoader: Map<userId, HTMLImageElement | 'loading' | 'error'>
// load(userId, url) → schedules fetch, resolves from cache
// getFallback(userId, nickname) → draws colored circle + initials to offscreen canvas
```
CORS: `img.crossOrigin = 'anonymous'`. On `onerror` → mark as `'error'`, renderer uses fallback.

### index.html — load order (strict)
```html
socket.io.js → tiktok-bridge.js → config.js → avatar-loader.js →
vfx-system.js → mini-games.js → bar-engine.js → renderer.js → game.js
```

## Related Code Files
- **Create**: `public/games/virtual-bar/config.js`
- **Create**: `public/games/virtual-bar/avatar-loader.js`
- **Create**: `public/games/virtual-bar/style.css`
- **Create**: `public/games/virtual-bar/index.html` (scaffold only)

## Implementation Steps
1. Create `public/games/virtual-bar/` directory
2. Write `config.js` — zones, giftTiers, chatCommands, queue params, character params, miniGames timers
3. Write `avatar-loader.js`:
   - `const cache = new Map()` — userId → HTMLImageElement | 'loading' | 'error'
   - `function load(userId, url)` — checks cache, creates `new Image()`, sets `crossOrigin='anonymous'`, on load: cache entry = img, on error: cache entry = 'error'
   - `function get(userId)` — returns cached img or null
   - `function getFallbackCanvas(userId, nickname)` — returns OffscreenCanvas with colored circle + 2-char initials
   - `window.AvatarLoader = { load, get, getFallbackCanvas }`
4. Write `style.css` — `html,body { background:transparent; overflow:hidden }`, canvas fullscreen fixed
5. Write `index.html` — `<canvas id="barCanvas">` + script load order, no logic

## Todo
- [ ] Create directory `public/games/virtual-bar/`
- [ ] Write `config.js` with all constants
- [ ] Write `avatar-loader.js` with cache + CORS fallback
- [ ] Write `style.css` (OBS transparent)
- [ ] Write `index.html` scaffold with correct load order

## Success Criteria
- [ ] `console.log(window.BAR_CONFIG.giftTiers.length)` → 6
- [ ] `AvatarLoader.load(id, badUrl)` → after error, `AvatarLoader.get(id)` returns null, fallback canvas renders initials
- [ ] `index.html` opens in browser without JS errors (other scripts not yet present = expected)

## Risk Assessment
- CORS on TikTok avatars — mitigated by error fallback, tested with invalid URL
- Hash color for fallback: `hsl((userId.charCodeAt(0)*47) % 360, 65%, 55%)` — deterministic, visually distinct

## Next Steps
→ Phase 2: bar-engine.js reads `window.BAR_CONFIG`
