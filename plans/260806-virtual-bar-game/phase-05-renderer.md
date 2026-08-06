---
phase: 5
title: "Renderer — Faux-3D Canvas + HUD"
status: pending
priority: P1
effort: "5h"
dependencies: [1, 2, 4]
---

# Phase 5: Renderer — Faux-3D Canvas + HUD

## Context Links
- Config: `public/games/virtual-bar/config.js`
- Engine state shape: [`phase-02-bar-engine.md`](./phase-02-bar-engine.md)
- VFX draw API: [`phase-04-vfx-system.md`](./phase-04-vfx-system.md)
- Mini-game state shape: [`phase-03-mini-games.md`](./phase-03-mini-games.md)
- Reference renderer: [`public/games/horse-racing/game.js`](../../public/games/horse-racing/game.js)

## Overview
Canvas 2D renderer — reads engine state + mini-game state each frame, draws faux-3D bar background (once to offscreen canvas), tweens character positions, draws all characters z-sorted, draws HUD (leaderboard, Hype Bar, mini-game timers), then delegates VFX to `VFXSystem.draw(ctx)`. ≤190 lines.

## Requirements
- **Functional**: faux-3D perspective bar, z-sorted characters, avatar circle + fallback, zone-based depth/scale, HUD with leaderboard + hype bar + PK countdown + Red vs Blue scoreboard
- **Non-functional**: background drawn once to offscreen canvas; only dirty characters re-drawn each frame; `draw()` called from `requestAnimationFrame`

## Architecture

### Faux-3D bar layout (1920×1080)

Background is painted once to `offscreenBg` canvas. It consists of:
- Dark gradient floor (`#0a0a14` → `#1a0a2e`) filling full canvas
- 4 zone "platforms" drawn as trapezoids (wider at bottom = closer) with distinct colors
- Zone dividers: subtle glowing horizontal lines
- Bar/DJ equipment silhouettes at back (simple rectangles, neon glow)
- Ambient neon light pools in each zone

```
Zone visual bands (approximate canvas y):
  0–50:   ceiling / lights strip (neon pink/purple)
  50–280:  DJ Stage — dark purple platform, small stage bounding box, disco ball icon
  280–480: VIP Zone — deep blue platform, sofa shapes drawn as simple trapezoids
  480–660: Regular Zone — muted teal, bar counter line along bottom edge
  660–1080: Dance Floor — darkest, widest area, subtle grid lines for floor perspective
```

### Character rendering (per user)
```
scale = 0.75 + user.depth * 0.25      // depth 0.55 → scale ≈0.89; depth 1.0 → scale 1.0
radius = config.character.baseRadius * scale   // 18–24px

Draw order (per character):
  1. Shadow ellipse at (pos.x, pos.y + radius*0.9)
  2. Circle clip region at (pos.x, pos.y)
  3. drawImage(avatarImg, ...) — or fillStyle=hashColor + initials text if no img
  4. White border ring (2px stroke)
  5. Nickname text below circle (scale-adjusted font)
  6. Team badge dot (red/blue) if team assigned
  7. VIP crown emoji above circle if zone === 'vip' || 'djStage'
```

### Tween logic (in renderer, not engine)
```js
const TWEEN_SPEED = 0.08;  // lerp factor per frame
function tweenCharacters(users, dtMs) {
  users.forEach(u => {
    u.pos.x += (u.targetPos.x - u.pos.x) * TWEEN_SPEED;
    u.pos.y += (u.targetPos.y - u.pos.y) * TWEEN_SPEED;
  });
}
```
Snap when `Math.abs(diff) < 0.5`.

### Z-sort (painter's algorithm)
```js
const sorted = [...state.users.values()].sort((a, b) => a.pos.y - b.pos.y);
sorted.forEach(u => drawCharacter(ctx, u));
```
Characters with lower `pos.y` (further back) drawn first.

### Dance animation (sin-wave bob)
```js
const bob = Math.sin(performance.now() * 0.003 + userIndex * 0.7) * config.character.idleBobbingAmp;
// offset draw y by bob when animState === 'dancing'
```

### HUD elements (drawn after characters, before VFX)

**Leaderboard** (top-right, semi-transparent panel):
- Top 5 from `state.leaderboard`
- Each row: rank number, avatar circle (20px), nickname, coin total

**Hype Bar** (bottom-center):
- Horizontal bar `0 / maxEnergy`, glowing fill color
- Pulsing when `hypeBar.quayActive`

**PK VIP countdown** (top-center, only when `pkVip.state === 'active'`):
- Countdown seconds + top 2 competitor names + coins

**Red vs Blue scoreboard** (left side, only when `redBlue.active`):
- Team Đỏ vs Team Xanh — coin totals + member counts + time remaining

## Related Code Files
- **Create**: `public/games/virtual-bar/renderer.js`
- **Read**: `public/games/horse-racing/game.js` (particle + draw patterns)
- **Read**: `public/games/virtual-bar/config.js`

## Implementation Steps
1. Create `offscreenBg` canvas, draw static bar background once in `initBackground()`
2. Implement `initBackground()` — gradient fill, zone trapezoids, zone labels, neon accents
3. Implement `tweenCharacters(users)` — lerp pos → targetPos each frame
4. Implement `drawCharacter(ctx, user, index)` — shadow, avatar circle, name, badges
5. Implement `_drawAvatarCircle(ctx, user, x, y, r)` — try drawImage, fallback to colored circle + initials
6. Implement `drawScene(ctx, state)` — blit offscreen bg, tween, z-sort, draw all chars
7. Implement `drawHUD(ctx, engineState, mgState)` — leaderboard, hype bar, PK countdown, red/blue board
8. Implement main `draw(ctx, engine, miniGames)` entry: `drawScene → drawHUD → VFXSystem.draw(ctx)`
9. Export `window.Renderer = { init, draw }`

## Todo
- [ ] offscreenBg canvas + initBackground() static bar art
- [ ] tweenCharacters() lerp
- [ ] drawCharacter() — shadow + avatar circle + name + badges
- [ ] _drawAvatarCircle() with fallback
- [ ] z-sort + scene draw loop
- [ ] HUD: leaderboard panel
- [ ] HUD: hype bar
- [ ] HUD: PK VIP countdown
- [ ] HUD: Red vs Blue scoreboard
- [ ] draw() entry point calling VFXSystem.draw()
- [ ] window.Renderer export

## Success Criteria
- [ ] Background renders without errors on blank canvas
- [ ] 10 users at different y-positions render in correct z-order (back ones behind front ones)
- [ ] Avatar fallback: user with no avatar img shows colored circle + initials
- [ ] Tween: after targetPos changes, pos converges within ~20 frames
- [ ] HUD elements visible at expected screen positions

## Risk Assessment
- Offscreen canvas: use `document.createElement('canvas')` not `OffscreenCanvas` — OffscreenCanvas lacks full 2D API in some OBS Chromium versions
- Avatar circle clip: use `ctx.save() / ctx.restore()` around clip to avoid leaking clip state to other draw calls
- HUD font: load before first draw — use `document.fonts.ready` in game.js before starting rAF loop
