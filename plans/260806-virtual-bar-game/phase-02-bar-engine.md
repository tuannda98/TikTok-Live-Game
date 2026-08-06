---
phase: 2
title: "Bar Engine — State Machine & Queues"
status: pending
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 2: Bar Engine — State Machine & Queues

## Context Links
- Config: `public/games/virtual-bar/config.js` (Phase 1)
- Reference engine: [`public/games/horse-racing/race-engine.js`](../../public/games/horse-racing/race-engine.js)
- Brainstorm: [`reports/brainstorm-report.md`](./reports/brainstorm-report.md)

## Overview
Pure state machine — no DOM, no Canvas. Manages UserObject lifecycle, zone transitions, priority/normal queue processing, leaderboard, and exposes state for renderer + mini-games to consume.

## Requirements
- **Functional**: spawn user, move zones on gift, evict LRU from dance floor at capacity, leaderboard sorted by totalCoinsSpent, queue batching 300ms
- **Non-functional**: ≤180 lines, zero DOM/Canvas references, `tick()` safe to call every rAF

## Architecture

### UserObject schema
```js
{
  userId, nickname,
  zone: 'danceFloor' | 'regular' | 'vip' | 'djStage',
  pos: { x: 0, y: 0 },        // current canvas coords (tweened by renderer)
  targetPos: { x: 0, y: 0 },  // destination coords assigned by engine
  depth: 1.0,                  // 0.55–1.0; drives renderer scale
  animState: 'idle' | 'dancing' | 'celebrating' | 'bowing',
  animTimer: 0,                // ms remaining in current animState
  totalCoinsSpent: 0,
  team: 'red' | 'blue' | null,
  lastActive: 0,               // Date.now() on last interaction
  dirty: true,                 // renderer re-draws if true
}
```

### State object
```js
this.state = {
  users: new Map(),            // userId → UserObject
  zones: {
    danceFloor: { slots: [] }, // ordered list of userIds currently in zone
    regular:    { slots: [] },
    vip:        { slots: [] },
    djStage:    { slots: [] },
  },
  leaderboard: [],             // top 10 userIds sorted by totalCoinsSpent
  priorityQueue: [],           // { type, userId, coins, data }[] — gifts ≥ 100
  normalQueue: [],             // same shape — rest
  _normalBatchTimer: null,
};
```

### Key methods
```js
class BarEngine {
  constructor(config) {}          // stores config, calls reset()
  reset() {}                      // clears all state
  tick(dtMs) {}                   // called every rAF; ticks animTimers, drains priorityQueue
  handleGift(data) {}             // routes to priority or normal queue
  handleChat(data) {}             // join command → spawnUser; team commands → setTeam
  handleLike(data) {}             // treat like free interaction → danceFloor spawn
  _enqueue(type, data) {}         // decides priority vs normal
  _processPriority() {}           // drains entire priority queue each tick
  _processNormalBatch() {}        // setTimeout 300ms loop, processes batchSize items
  _spawnUser(userId, data) {}     // creates UserObject, assigns danceFloor slot
  _moveZone(userId, newZone) {}   // updates zone.slots, assigns targetPos, marks dirty
  _evictLRU(zone) {}              // removes least-recently-active user when zone at capacity
  _assignSlotPosition(userId) {} // picks targetPos x,y within zone yRange
  _updateLeaderboard() {}         // rebuilds top-10 array
  getState() { return this.state; }
}
window.BarEngine = BarEngine;
```

### Queue routing logic
```
handleGift(data):
  coins = data.giftValue * data.repeatCount
  if coins >= config.queue.priorityMinCoins:
    priorityQueue.push({ type:'gift', userId, coins, data })
  else:
    normalQueue.push({ type:'gift', userId, coins, data })
```

### Zone transition logic
```
_applyGiftTier(userId, coins):
  tier = config.giftTiers.findLast(t => coins >= t.minCoins)
  targetZone = tier.zone
  currentZone = user.zone
  if zoneRank(targetZone) > zoneRank(currentZone):
    _moveZone(userId, targetZone)
  if tier.tier === 4: _applyDaigaEffect(userId)   // push others + scale
  if tier.tier === 5: _applyBaoToanSan(userId)    // all bow
  miniGames.onGift(userId, coins, user.team)       // feed all mini-games
```

### Slot position algorithm
Each zone has a y-range and x-spread. Characters are placed at random offsets within zone bounds, stored as `targetPos`. On zone change, new `targetPos` assigned; renderer tweens `pos` toward it.

## Related Code Files
- **Create**: `public/games/virtual-bar/bar-engine.js`
- **Read**: `public/games/horse-racing/race-engine.js` (pattern reference)
- **Read**: `public/games/virtual-bar/config.js`

## Implementation Steps
1. Scaffold `BarEngine` class with constructor + `reset()`
2. Implement `_spawnUser` — create UserObject, assign `danceFloor` slot, call `AvatarLoader.load()`
3. Implement `_moveZone` — remove from old zone slots, add to new, call `_evictLRU` if needed, assign `targetPos`
4. Implement `_assignSlotPosition` — random x within `[100, 1820]`, random y within zone's `yRange`, compute `depth` from y
5. Implement `_evictLRU` — find user in zone with oldest `lastActive`, call `_moveZone(userId, 'danceFloor')` or remove if dance floor full
6. Implement `handleGift` + `handleChat` + `handleLike` event handlers
7. Implement `_enqueue` routing (priority vs normal threshold)
8. Implement `_processPriority` (called in `tick()`)
9. Implement `_processNormalBatch` (setTimeout loop, clears itself when queue empty)
10. Implement `_updateLeaderboard` — `Array.from(users.values()).sort((a,b) => b.totalCoinsSpent - a.totalCoinsSpent).slice(0,10)`
11. Implement `tick(dtMs)` — tick animTimers, drain priority queue, update dirty flags
12. Expose `window.BarEngine = BarEngine`

## Todo
- [ ] Scaffold class + reset()
- [ ] spawnUser + AvatarLoader.load() call
- [ ] moveZone + evictLRU + slot position
- [ ] Gift/chat/like handlers
- [ ] Queue routing + priority drain + normal batch
- [ ] leaderboard update
- [ ] tick() with animTimer countdown
- [ ] window.BarEngine export

## Success Criteria
- [ ] `new BarEngine(BAR_CONFIG)` without errors
- [ ] `engine.handleChat({user:{uniqueId:'u1',nickname:'Test'}, comment:'1'})` → user appears in `state.zones.danceFloor.slots`
- [ ] `engine.handleGift({user:{...}, giftValue:100, repeatCount:1})` → user moves to `state.zones.vip.slots`
- [ ] Dance floor at 100 users → 101st comment triggers eviction of oldest user
- [ ] Leaderboard sorted correctly after multiple gifts

## Risk Assessment
- animTimer ticking in `tick()` must use `dtMs` not wall clock — renderer passes delta
- `_processNormalBatch` timer must be cleared in `reset()` to avoid ghost processing after game reset
- CORS avatar load is async — engine doesn't wait; renderer uses fallback until img ready
