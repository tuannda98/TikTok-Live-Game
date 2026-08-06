/**
 * config.js — Virtual Bar Game configuration.
 * All tunable constants live here. No logic, no DOM.
 *
 * @module games/virtual-bar/config
 */

window.BAR_CONFIG = {
  canvas: { width: 1920, height: 1080 },

  // ── ZONES ────────────────────────────────────────────────────────────────
  // yRange: [top, bottom] canvas pixel range for the zone
  // depthRange: [back, front] depth scalar (drives character scale)
  zones: {
    danceFloor: { maxUsers: 100, yRange: [660, 1060], depthRange: [0.85, 1.0]  },
    regular:    { maxUsers: 20,  yRange: [480, 640],  depthRange: [0.74, 0.87] },
    vip:        { maxUsers: 10,  yRange: [280, 460],  depthRange: [0.63, 0.76] },
    djStage:    { maxUsers: 1,   yRange: [60,  260],  depthRange: [0.52, 0.65] },
  },

  // ── GIFT TIERS ───────────────────────────────────────────────────────────
  // Ordered ascending. Engine uses findLast(t => coins >= t.minCoins).
  giftTiers: [
    { tier: 0, minCoins: 0,    maxCoins: 0,        zone: 'danceFloor', animState: 'dancing'     },
    { tier: 1, minCoins: 1,    maxCoins: 9,        zone: 'danceFloor', animState: 'celebrating' },
    { tier: 2, minCoins: 10,   maxCoins: 99,       zone: 'regular',    animState: 'celebrating' },
    { tier: 3, minCoins: 100,  maxCoins: 999,      zone: 'vip',        animState: 'celebrating' },
    { tier: 4, minCoins: 1000, maxCoins: 4999,     zone: 'vip',        animState: 'celebrating' },
    { tier: 5, minCoins: 5000, maxCoins: Infinity, zone: 'djStage',    animState: 'celebrating' },
  ],

  // ── CHAT COMMANDS ────────────────────────────────────────────────────────
  chatCommands: {
    joinDance: ['1', 'vào bar', 'vao bar', 'quẩy', 'quay'],
    teamRed:   ['đỏ', 'do', 'red', 'whisky'],
    teamBlue:  ['xanh', 'blue', 'vodka'],
  },

  // ── QUEUE ────────────────────────────────────────────────────────────────
  queue: {
    batchIntervalMs:  300,
    batchSize:        10,
    priorityMinCoins: 100,  // gifts >= this value bypass normal queue
  },

  // ── CHARACTER VISUALS ────────────────────────────────────────────────────
  character: {
    baseRadius:       24,
    nameFont:         '700 12px "Segoe UI", Arial, sans-serif',
    idleBobbingAmp:   3,    // pixels of vertical bob in dance animation
    tweenSpeed:       0.10, // lerp factor per frame (0.08–0.12)
    celebDurationMs:  3000, // how long 'celebrating' state lasts before → 'dancing'
    bowDurationMs:    4000, // how long 'bowing' state lasts (tier 5 "all bow")
  },

  // ── MINI-GAMES ───────────────────────────────────────────────────────────
  miniGames: {
    pkVip: {
      intervalMs:  5 * 60_000,  // idle period between PK rounds
      durationMs:  60_000,       // 60s battle window
    },
    hypeBar: {
      maxEnergy:          1000,
      quayTimeDurationMs: 30_000,
    },
    redBlue: {
      durationMs: 10 * 60_000,  // 10-minute battle
    },
  },

  // ── COLOURS ──────────────────────────────────────────────────────────────
  // Used by renderer for zone tints and HUD accents
  zoneColors: {
    danceFloor: '#0d0d1a',
    regular:    '#0a1520',
    vip:        '#120a2e',
    djStage:    '#1a0520',
  },
  teamColors: {
    red:  '#ff4444',
    blue: '#4488ff',
  },
};
