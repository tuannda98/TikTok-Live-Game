# Brainstorm Report — Virtual Bar Game (Sàn Bar Ảo)

**Date:** 2026-08-06
**Status:** Design Approved → Proceed to /plan

---

## Problem Statement

Build a TikTok Live overlay game "Sàn Bar Ảo" — viewers interact via gifts/comments to spawn Chibi avatars that move across a faux-3D virtual bar. Zone level = social status = gift value. 3 concurrent mini-games (PK VIP, Hype Bar, Red vs Blue) drive engagement and revenue.

---

## Requirements (Confirmed)

- **Rendering**: Canvas 2D pure (consistent with horse-racing pattern)
- **Characters**: Circle avatar (TikTok profilePicture) + initials fallback on CORS fail
- **Layout**: Faux-3D isometric perspective (1920×1080 OBS overlay)
- **Scope**: Full spec v1 — all 3 mini-games + all 6 gift tiers
- **Event routing**: One gift feeds ALL active mini-games simultaneously
- **Animation**: Smooth tween transitions between zones, sin-wave dance, scale pulse

---

## Final Architecture

### File Structure
```
public/games/virtual-bar/
├── index.html          # Entry, strict load order
├── config.js           # Zones, gift tiers, chat commands, timers (~150 ln)
├── avatar-loader.js    # Image cache + CORS fallback (~60 ln)
├── vfx-system.js       # Particles, banners, flash, strobe (~160 ln)
├── mini-games.js       # PK VIP + Hype Bar + Red vs Blue state machines (~180 ln)
├── bar-engine.js       # User state machine + priority/normal queues (~180 ln)
├── renderer.js         # Canvas: faux-3D zones + character draw + HUD (~190 ln)
└── style.css           # OBS transparent bg
```

### Core Data Structures

**UserObject:**
```js
{
  userId, nickname,
  avatarImg: HTMLImageElement | null,
  zone: 'dance' | 'regular' | 'vip' | 'dj',
  pos: {x, y}, targetPos: {x, y},
  depth: 0.0–1.0,           // scale = 0.75 + depth * 0.25
  animState: 'idle' | 'dancing' | 'celebrating' | 'bowing',
  animTimer: 0,
  totalCoinsSpent: 0,
  team: 'red' | 'blue' | null,
  lastActive: timestamp
}
```

**State (bar-engine.js):**
```js
{
  users: Map<userId, UserObject>,
  zones: { dance: {slots:[]}, regular: {slots:[]}, vip: {slots:[]}, dj: {slots:[]} },
  leaderboard: [],       // sorted by totalCoinsSpent
  priorityQueue: [],     // gifts >= 100 coins → process next frame
  normalQueue: [],       // rest → batch 300ms
  miniGames: { pkVip, hypeBar, redBlue }
}
```

### Queue System
- **Priority Queue**: gifts ≥ 100 xu → immediate (interrupt), processed next rAF tick
- **Normal Queue**: rest → `setTimeout(processNormalBatch, 300)`, max 10/batch

### Zone Layout (faux-3D, 1920×1080)
```
y=50–280    DJ Stage    depth=0.6  scale=0.75
y=280–480   VIP Zone    depth=0.75 scale=0.85
y=480–660   Regular     depth=0.88 scale=0.92
y=660–1080  Dance Floor depth=1.0  scale=1.0
```
Z-sorting: painter's algorithm — sort users by `pos.y` ascending, draw back-to-front.

### Gift Tier → Action Matrix
| Tier | Coins | Zone | VFX |
|------|-------|------|-----|
| 0 | Free | spawn dance | Heart float |
| 1 | 1–9 | dance anim 5s | Confetti burst |
| 2 | 10–99 | → regular | Money rain |
| 3 | 100–999 | → vip | Airhorn + champagne tower |
| 4 | 1k–4.9k | Đại Gia: push others, scale 1.5x | Strobe flash + banner |
| 5 | ≥5k | Bao Toàn Sàn: all bow, DJ transform | Lights off 3s → laser show |

### Mini-games
- **PK VIP**: auto-trigger every 5min, 60s countdown, highest gift-coins wins seat
- **Hype Bar**: always active, 0/1000 energy, fills on any gift → Quẩy Time 30s
- **Red vs Blue**: MC-activated, comment "đỏ"/"xanh" for team, 10min battle

### Event Routing
```
Gift received → engine.applyTier(user, coins)
             → hypeBar.addEnergy(coins)             // always
             → if pkVip.active: pkVip.score(userId, coins)
             → if redBlue.active: redBlue.addCoins(user.team, coins)
```

---

## Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| CORS on TikTok avatars | `crossOrigin="anonymous"` + onerror → hashColor circle + initials |
| 100 chars @ 60fps | Dirty flag per char, background on offscreen canvas drawn once |
| Mini-game state conflicts | Isolated state objects, sequential fan-out per gift |
| File >200 lines | renderer.js = draw calls only, no state logic |

---

## Decisions Locked

1. Canvas 2D pure (no DOM hybrid)
2. Avatar = circle crop + initials fallback
3. All 3 mini-games in v1
4. Gift feeds all active mini-games simultaneously
5. Smooth tween transitions
6. Faux-3D isometric perspective
