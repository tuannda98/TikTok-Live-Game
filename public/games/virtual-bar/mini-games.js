/**
 * mini-games.js — Three concurrent mini-game state machines.
 * PK VIP (seat war) + Hype Bar (energy fill) + Red vs Blue (team battle).
 * Pure logic: no DOM, no Canvas. All 3 receive every gift simultaneously.
 *
 * @module games/virtual-bar/mini-games
 */

(() => {
  class MiniGames {
    constructor(config) {
      this.config = config;
      this._listeners = {};
      this._initStates();
    }

    _initStates() {
      const { pkVip, hypeBar, redBlue } = this.config.miniGames;
      this._pk = {
        state: 'idle',       // 'idle' | 'active' | 'resolving'
        intervalTimer: pkVip.intervalMs,
        battleTimer:   0,
        competitors:   new Map(), // userId → coins
      };
      this._hype = {
        energy:      0,
        maxEnergy:   hypeBar.maxEnergy,
        quayActive:  false,
        quayTimer:   0,
      };
      this._rb = {
        active:  false,
        timer:   0,
        teams: {
          red:  { coins: 0, members: new Set() },
          blue: { coins: 0, members: new Set() },
        },
      };
    }

    // ── Event system ──────────────────────────────────────────────────────

    on(event, cb) { (this._listeners[event] = this._listeners[event] || []).push(cb); }
    _emit(event, data) { (this._listeners[event] || []).forEach(cb => cb(data)); }

    // ── Public API ────────────────────────────────────────────────────────

    /** Fan-out a gift to all 3 mini-games simultaneously. */
    onGift(userId, coins, team) {
      this._pkOnGift(userId, coins);
      this._hypeOnGift(coins);
      this._rbOnGift(userId, coins, team);
    }

    /** User picked a team via chat. */
    onTeamAssign(userId, team) {
      if (!this._rb.active) return;
      this._rb.teams[team]?.members.add(userId);
    }

    /** MC or auto-trigger: start a 10-min Red vs Blue battle. */
    activateRedBlue() {
      if (this._rb.active) return;
      this._rb.active = true;
      this._rb.timer  = this.config.miniGames.redBlue.durationMs;
      this._rb.teams.red  = { coins: 0, members: new Set() };
      this._rb.teams.blue = { coins: 0, members: new Set() };
      this._emit('redBlueStart', {});
    }

    /** Advance all timers. Call from rAF tick. */
    tick(dtMs) {
      this._pkTick(dtMs);
      this._hypeTick(dtMs);
      this._rbTick(dtMs);
    }

    /** Read-only snapshot for renderer HUD. */
    getState() {
      return {
        pkVip: {
          state:       this._pk.state,
          timer:       this._pk.battleTimer,
          competitors: Array.from(this._pk.competitors.entries())
            .sort((a, b) => b[1] - a[1]).slice(0, 3),
        },
        hypeBar: {
          energy:     this._hype.energy,
          maxEnergy:  this._hype.maxEnergy,
          quayActive: this._hype.quayActive,
          quayTimer:  this._hype.quayTimer,
        },
        redBlue: {
          active: this._rb.active,
          timer:  this._rb.timer,
          teams: {
            red:  { coins: this._rb.teams.red.coins,  members: this._rb.teams.red.members.size  },
            blue: { coins: this._rb.teams.blue.coins, members: this._rb.teams.blue.members.size },
          },
        },
      };
    }

    // ── PK VIP ────────────────────────────────────────────────────────────

    _pkOnGift(userId, coins) {
      if (this._pk.state !== 'active') return;
      this._pk.competitors.set(userId, (this._pk.competitors.get(userId) || 0) + coins);
    }

    _pkTick(dtMs) {
      const cfg = this.config.miniGames.pkVip;
      if (this._pk.state === 'idle') {
        this._pk.intervalTimer -= dtMs;
        if (this._pk.intervalTimer <= 0) {
          this._pk.state = 'active';
          this._pk.battleTimer = cfg.durationMs;
          this._pk.competitors.clear();
          this._emit('pkVipStart', {});
        }
      } else if (this._pk.state === 'active') {
        this._pk.battleTimer -= dtMs;
        if (this._pk.battleTimer <= 0) {
          this._resolvePk();
        }
      } else if (this._pk.state === 'resolving') {
        // Brief resolving pause handled by game.js via event; reset after interval
        this._pk.state = 'idle';
        this._pk.intervalTimer = cfg.intervalMs;
      }
    }

    _resolvePk() {
      const entries = Array.from(this._pk.competitors.entries());
      if (!entries.length) { this._pk.state = 'resolving'; return; }
      const [winnerId, coins] = entries.reduce((best, cur) => cur[1] > best[1] ? cur : best);
      this._pk.state = 'resolving';
      this._emit('pkVipWinner', { userId: winnerId, coins });
    }

    // ── Hype Bar ──────────────────────────────────────────────────────────

    _hypeOnGift(coins) {
      if (this._hype.quayActive) return;
      this._hype.energy = Math.min(this._hype.maxEnergy, this._hype.energy + coins);
      if (this._hype.energy >= this._hype.maxEnergy) {
        this._hype.quayActive = true;
        this._hype.quayTimer  = this.config.miniGames.hypeBar.quayTimeDurationMs;
        this._hype.energy     = 0;
        this._emit('quayTime', {});
      }
    }

    _hypeTick(dtMs) {
      if (!this._hype.quayActive) return;
      this._hype.quayTimer -= dtMs;
      if (this._hype.quayTimer <= 0) {
        this._hype.quayActive = false;
        this._hype.quayTimer  = 0;
        this._emit('quayTimeEnd', {});
      }
    }

    // ── Red vs Blue ───────────────────────────────────────────────────────

    _rbOnGift(userId, coins, team) {
      if (!this._rb.active || !team) return;
      const t = this._rb.teams[team];
      if (t) { t.coins += coins; t.members.add(userId); }
    }

    _rbTick(dtMs) {
      if (!this._rb.active) return;
      this._rb.timer -= dtMs;
      if (this._rb.timer <= 0) {
        this._rb.active = false;
        const { red, blue } = this._rb.teams;
        const winner = red.coins >= blue.coins ? 'red' : 'blue';
        this._emit('redBlueResult', { winner, teams: { red: { coins: red.coins }, blue: { coins: blue.coins } } });
      }
    }
  }

  window.MiniGames = MiniGames;
})();
