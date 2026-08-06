---
phase: 4
title: "VFX System — Particles, Banners, Flash"
status: pending
priority: P2
effort: "3h"
dependencies: [1]
---

# Phase 4: VFX System — Particles, Banners, Flash

## Context Links
- Config: `public/games/virtual-bar/config.js` (Phase 1)
- Reference particle system: [`public/games/horse-racing/game.js`](../../public/games/horse-racing/game.js) (lines ~40–80)
- Gift tier actions: [`reports/brainstorm-report.md`](./reports/brainstorm-report.md)

## Overview
Self-contained VFX module. Renderer calls `VFXSystem.draw(ctx)` each frame. Engine/mini-games trigger effects via `VFXSystem.trigger(type, opts)`. No state outside this module.

## Requirements
- **Functional**: 6 effect types matching gift tiers + mini-game events
- **Non-functional**: ≤160 lines, particle pool capped at 500, all effects auto-expire

## Architecture

### Effect types
| Trigger | Effect |
|---------|--------|
| Tier 0–1 (free/small) | `'heartFloat'` — hearts rise from character position |
| Tier 1 (1–9 xu) | `'confettiBurst'` — colored confetti at position |
| Tier 2 (10–99 xu) | `'moneyRain'` — dollar signs fall from top |
| Tier 3 (100–999 xu) | `'champagnePop'` — gold particles burst + airhorn label |
| Tier 4 (1k–4.9k xu) | `'strobeFlash'` + `'bannerText'` — screen flash + scrolling text |
| Tier 5 (≥5k xu) | `'blackoutLaser'` — 3s blackout then laser burst |
| Quẩy Time | `'quayTimeBanner'` — pulsing "QUẨY TIME 🔥" banner |
| Red vs Blue result | `'teamWin'` — winner-colored particle shower |

### Module interface
```js
const VFXSystem = {
  particles: [],       // shared pool, max 500
  overlays: [],        // screen-level effects: flash, blackout, banner

  trigger(type, opts) {},   // adds effect to particles/overlays
  tick(dtMs) {},            // advances all particles + overlay timers
  draw(ctx) {},             // draws particles then overlays (called by renderer)
  _emit(x, y, preset, count) {},  // internal: push N particles from preset
};
window.VFXSystem = VFXSystem;
```

### Particle schema
```js
{ x, y, vx, vy, life, decay, size, color, shape: 'circle'|'rect'|'heart'|'text', text }
```

### Overlay schema (screen-level effects)
```js
{ type: 'flash'|'blackout'|'banner', timer, duration, color, text, alpha }
```

### Key VFX implementations

**confettiBurst(x, y)**: emit 15 particles, random colors, fan spread upward, decay 0.025

**moneyRain()**: emit 20 `'text'` particles with `text:'💵'` or `'$'`, from random x at y=0, fall down (vy=2–5)

**strobeFlash()**: push overlay `{ type:'flash', duration:800, color:'#fff', alpha:0.7 }` — renderer draws white rect over canvas, fades alpha over duration

**blackoutLaser(nickname)**: push overlay `{ type:'blackout', duration:3000 }` → after 3s auto-transition to `{ type:'flash', color:'#f0f', duration:2000 }` + emit 200 radial particles from center

**bannerText(text)**: push overlay `{ type:'banner', text, duration:4000 }` — scrolls right-to-left across screen

**quayTimeBanner()**: `bannerText('🔥 QUẨY TIME! 🔥')` with larger font + pulse scale effect

### draw() order
1. Draw particles (sorted none — order doesn't matter for particles)
2. Draw overlays on top (flash/blackout = full-canvas rect, banner = text at fixed y)

## Related Code Files
- **Create**: `public/games/virtual-bar/vfx-system.js`
- **Read**: `public/games/horse-racing/game.js` (particle system reference ~line 40)

## Implementation Steps
1. Create `VFXSystem` object with `particles[]`, `overlays[]`
2. Implement `_emit(x, y, preset, count)` — push particles from preset config
3. Implement `tick(dtMs)` — advance all particle positions, decay life, splice dead; advance overlay timers, remove expired
4. Implement `draw(ctx)` — loop particles (draw by shape), loop overlays (flash rect / banner text)
5. Implement each trigger type: `heartFloat`, `confettiBurst`, `moneyRain`, `champagnePop`, `strobeFlash`, `bannerText`, `blackoutLaser`, `quayTimeBanner`, `teamWin`
6. Cap particle pool at 500 — on overflow splice oldest
7. Export `window.VFXSystem = VFXSystem`

## Todo
- [ ] VFXSystem object scaffold + particle/overlay arrays
- [ ] _emit() with preset configs
- [ ] tick() — particle physics + overlay timer
- [ ] draw() — particles + overlays
- [ ] heartFloat + confettiBurst
- [ ] moneyRain + champagnePop
- [ ] strobeFlash + bannerText
- [ ] blackoutLaser (3s blackout → laser)
- [ ] quayTimeBanner + teamWin
- [ ] Particle pool cap at 500

## Success Criteria
- [ ] `VFXSystem.trigger('confettiBurst', {x:960, y:540})` → particles array grows
- [ ] After enough `tick()` calls, all particles decay and array empties
- [ ] `blackoutLaser` overlay: `timer` counts down correctly in `tick()`
- [ ] `draw(ctx)` called with a real canvas ctx — no JS errors

## Risk Assessment
- `bannerText` scroll: use `overlay.x` starting at `canvas.width`, decrement by `speed*dtMs` each tick — keep within VFX module, renderer just calls `draw()`
- Blackout 3s then laser: implement as two sequential overlay pushes — first push blackout, at expiry push laser flash. Simple state machine within the overlay object via `phase: 'dark'|'laser'`
