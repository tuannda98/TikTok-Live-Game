---
title: "Virtual Bar Game (Sàn Bar Ảo)"
description: "TikTok Live overlay: viewers spawn Chibi avatars in faux-3D virtual bar, zone elevation based on gift value, 3 concurrent mini-games"
status: pending
priority: P1
effort: 3d
tags: [game, canvas, tiktok, overlay]
blockedBy: []
blocks: []
created: 2026-08-06
---

# Virtual Bar Game — Implementation Plan

## Overview

New game at `public/games/virtual-bar/`. 8-module Canvas 2D overlay for OBS.
Viewers spawn as Chibi-style circle-avatar characters on a faux-3D bar scene.
Gift value determines zone (Dance Floor → Regular → VIP → DJ Stage).
3 mini-games run concurrently: PK VIP seat war, Hype Bar energy fill, Red vs Blue team battle.

Brainstorm report: [`reports/brainstorm-report.md`](./reports/brainstorm-report.md)

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Foundation — Config, Avatar Loader, Style](./phase-01-foundation.md) | Pending |
| 2 | [Bar Engine — State Machine & Queues](./phase-02-bar-engine.md) | Pending |
| 3 | [Mini-games — PK VIP, Hype Bar, Red vs Blue](./phase-03-mini-games.md) | Pending |
| 4 | [VFX System — Particles, Banners, Flash](./phase-04-vfx-system.md) | Pending |
| 5 | [Renderer — Faux-3D Canvas + HUD](./phase-05-renderer.md) | Pending |
| 6 | [Wiring & Integration — game.js + Dashboard](./phase-06-wiring.md) | Pending |

## Dependencies

- `TikTokBridge` events: gift, chat, like (already in `public/lib/tiktok-bridge.js`)
- No server changes needed — pure frontend game
- Follows horse-racing patterns: `config.js` + engine + `game.js` split
- Avatar CORS fallback required (TikTok profile pictures frequently block crossOrigin)
