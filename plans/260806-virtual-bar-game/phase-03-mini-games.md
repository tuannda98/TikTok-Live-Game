---
phase: 3
title: "Mini-games — PK VIP, Hype Bar, Red vs Blue"
status: pending
priority: P1
effort: "4h"
dependencies: [2]
---

# Phase 3: Mini-games — PK VIP, Hype Bar, Red vs Blue

## Context Links
- Config: `public/games/virtual-bar/config.js` (Phase 1)
- Bar engine calls `miniGames.onGift()`: [`phase-02-bar-engine.md`](./phase-02-bar-engine.md)
- Brainstorm decisions: [`reports/brainstorm-report.md`](./reports/brainstorm-report.md)

## Overview
Three concurrent mini-game state machines in one module. All share gift events simultaneously (not exclusive). Expose read-only state for renderer HUD and emit events for VFX system via a simple listener pattern.

## Requirements
- **Functional**: PK VIP auto-triggers every 5min, 60s battle; Hype Bar always fills on any gift, Quẩy Time 30s; Red vs Blue MC-activated, 10min, team comment assignment
- **Non-functional**: ≤180 lines total, pure logic (no DOM/Canvas), `tick(dtMs)` safe every rAF

## Architecture

### Module interface
```js
class MiniGames {
  constructor(config) {}
  tick(dtMs) {}                        // advance all timers
  onGift(userId, coins, team) {}       // fan-out to all 3 mini-games
  onTeamAssign(userId, team) {}        // user picked red or blue
  activateRedBlue() {}                 // MC trigger (from game.js or config auto-start)
  getState() {}                        // returns { pkVip, hypeBar, redBlue }
  on(event, cb) {}                     // 'pkVipWinner', 'quayTime', 'redBlueResult'
}
window.MiniGames = MiniGames;
```

### PK VIP state machine
```
States: idle → active → resolving → cooldown → idle

idle:
  intervalTimer counts down from config.miniGames.pkVip.intervalMs
  → fires: reset competitor scores, set state = active, emit 'pkVipStart'

active (60s):
  each onGift(userId, coins): competitors[userId] = (competitors[userId]||0) + coins
  timer expires → winner = max(competitors), set state = resolving, emit 'pkVipWinner'

resolving (3s):
  engine moves winner to VIP zone (caller handles this via event)
  → set state = cooldown

cooldown (5min = same as interval):
  → set state = idle, reset intervalTimer
```

### Hype Bar state machine
```
State: { energy: 0, quayActive: false, quayTimer: 0, intervalSinceLastGift: 0 }

onGift(coins):
  energy = Math.min(maxEnergy, energy + coins)
  if energy >= maxEnergy && !quayActive:
    quayActive = true, quayTimer = quayTimeDurationMs, energy = 0
    emit 'quayTime'

tick(dtMs):
  if quayActive:
    quayTimer -= dtMs
    if quayTimer <= 0: quayActive = false, emit 'quayTimeEnd'
```
No energy decay (per spec — only fills, never drains between gifts).

### Red vs Blue state machine
```
State: { active: false, teams: { red: {coins:0, members:[]}, blue: {coins:0, members:[]} }, timer: 0 }

activateRedBlue():
  active = true, timer = durationMs, reset teams, emit 'redBlueStart'

onTeamAssign(userId, team):
  if active: teams[team].members.push(userId)

onGift(userId, coins, team):
  if active && team: teams[team].coins += coins

tick(dtMs):
  if active:
    timer -= dtMs
    if timer <= 0:
      winner = teams.red.coins >= teams.blue.coins ? 'red' : 'blue'
      active = false, emit 'redBlueResult', { winner, teams }
```

### Event fan-out in onGift
```js
onGift(userId, coins, team) {
  this._pkVipOnGift(userId, coins);
  this._hypeBarOnGift(coins);
  this._redBlueOnGift(userId, coins, team);
}
```

## Related Code Files
- **Create**: `public/games/virtual-bar/mini-games.js`
- **Read**: `public/games/virtual-bar/config.js`

## Implementation Steps
1. Scaffold `MiniGames` class with constructor, internal `_listeners` map, `on(event,cb)`, `_emit(event,data)` helpers
2. Implement PK VIP: `_pkVipTick(dtMs)`, `_pkVipOnGift(userId, coins)`, full state transition
3. Implement Hype Bar: `_hypeBarOnGift(coins)`, `_hypeBarTick(dtMs)`, Quẩy Time trigger
4. Implement Red vs Blue: `activateRedBlue()`, `onTeamAssign()`, `_redBlueOnGift()`, `_redBlueTick(dtMs)`
5. Implement `tick(dtMs)` — calls all 3 sub-tickers
6. Implement `onGift(userId, coins, team)` — fans out to all 3
7. Implement `getState()` — returns shallow snapshot of all 3 states (renderer reads this)
8. Export `window.MiniGames = MiniGames`

## Todo
- [ ] Scaffold class + listener helpers
- [ ] PK VIP state machine + timer
- [ ] Hype Bar fill + Quẩy Time trigger
- [ ] Red vs Blue activate + team gift tracking + end
- [ ] tick() fan-out to all 3
- [ ] onGift() fan-out
- [ ] getState() snapshot
- [ ] window.MiniGames export

## Success Criteria
- [ ] `mg.onGift('u1', 1000, null)` → `mg.getState().hypeBar.energy` increases
- [ ] After 1000 total coins → `'quayTime'` event fires, `hypeBar.quayActive === true`
- [ ] PK VIP: after `pkVip.intervalTimer` expires → `competitors` reset, state becomes `'active'`
- [ ] `mg.activateRedBlue()` → `mg.getState().redBlue.active === true`
- [ ] Red vs Blue: after `durationMs` passes in `tick()` → `'redBlueResult'` event with winner

## Risk Assessment
- PK VIP cooldown = same as interval (5min) — keep simple, no separate cooldown timer; just reuse intervalTimer
- Quẩy Time must not retrigger while already active — guard `if (!quayActive)` before firing
- Red vs Blue members array could have duplicates if user comments team twice — use `Set` instead of array
