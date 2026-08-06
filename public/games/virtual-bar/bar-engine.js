/**
 * bar-engine.js — Virtual Bar state machine.
 * Pure logic: no DOM, no Canvas. Manages users, zones, queues, leaderboard.
 *
 * @module games/virtual-bar/bar-engine
 */

(() => {
  const ZONE_RANK = { danceFloor: 0, regular: 1, vip: 2, djStage: 3 };

  class BarEngine {
    constructor(config) {
      this.config = config;
      this._listeners = {};
      this._miniGames = null;
      this.reset();
    }

    reset() {
      clearTimeout(this.state?._normalBatchTimer);
      this.state = {
        users: new Map(),
        zones: { danceFloor: { slots: [] }, regular: { slots: [] }, vip: { slots: [] }, djStage: { slots: [] } },
        leaderboard: [],
        priorityQueue: [],
        normalQueue: [],
        _normalBatchTimer: null,
      };
    }

    // ── Event system ──────────────────────────────────────────────────────

    on(event, cb) { (this._listeners[event] = this._listeners[event] || []).push(cb); }
    _emit(event, data) { (this._listeners[event] || []).forEach(cb => cb(data)); }
    setMiniGames(mg) { this._miniGames = mg; }

    // ── Public API ────────────────────────────────────────────────────────

    handleGift(data) {
      const { uniqueId: userId, nickname, profilePictureUrl } = data.user;
      const coins = (data.giftValue || 1) * (data.repeatCount || 1);
      this._ensureUser(userId, nickname, profilePictureUrl);
      this._enqueue({ type: 'gift', userId, coins });
    }

    handleChat(data) {
      const { uniqueId: userId, nickname, profilePictureUrl } = data.user;
      const cmd = (data.comment || '').trim().toLowerCase();
      const { joinDance, teamRed, teamBlue } = this.config.chatCommands;
      if (joinDance.includes(cmd)) {
        this._ensureUser(userId, nickname, profilePictureUrl);
        this._enqueue({ type: 'chat', userId, coins: 0 });
        return;
      }
      const u = this.state.users.get(userId);
      if (!u) return;
      if (teamRed.includes(cmd))  { u.team = 'red';  this._miniGames?.onTeamAssign(userId, 'red'); }
      if (teamBlue.includes(cmd)) { u.team = 'blue'; this._miniGames?.onTeamAssign(userId, 'blue'); }
    }

    handleLike(data) {
      const { uniqueId: userId, nickname, profilePictureUrl } = data.user;
      this._ensureUser(userId, nickname, profilePictureUrl);
    }

    tick(dtMs) {
      this._processPriority();
      this.state.users.forEach(u => {
        if (u.animTimer > 0) {
          u.animTimer -= dtMs;
          if (u.animTimer <= 0) { u.animTimer = 0; u.animState = 'dancing'; u.dirty = true; }
        }
      });
    }

    getState()            { return this.state; }
    getNickname(userId)   { return this.state.users.get(userId)?.nickname ?? userId; }
    moveToVip(userId)     { if (this.state.users.has(userId)) this._moveZone(userId, 'vip'); }
    setAllDancing()       { this.state.users.forEach(u => { u.animState = 'dancing'; u.animTimer = 0; u.dirty = true; }); }

    // ── Internal ──────────────────────────────────────────────────────────

    _ensureUser(userId, nickname, profilePictureUrl) {
      if (!this.state.users.has(userId)) {
        this._spawnUser(userId, nickname, profilePictureUrl);
      } else {
        this.state.users.get(userId).lastActive = Date.now();
      }
    }

    _spawnUser(userId, nickname, profilePictureUrl) {
      const user = {
        userId, nickname, zone: 'danceFloor',
        pos: { x: 0, y: 0 }, targetPos: { x: 0, y: 0 }, depth: 1.0,
        animState: 'dancing', animTimer: 0,
        totalCoinsSpent: 0, team: null, lastActive: Date.now(), dirty: true,
      };
      this.state.users.set(userId, user);
      this._addToZone(userId, 'danceFloor');
      this._assignSlotPosition(userId);
      user.pos = { ...user.targetPos };
      window.AvatarLoader?.load(userId, profilePictureUrl);
    }

    _enqueue(item) {
      if (item.coins >= this.config.queue.priorityMinCoins) {
        this.state.priorityQueue.push(item);
      } else {
        this.state.normalQueue.push(item);
        if (!this.state._normalBatchTimer) {
          this.state._normalBatchTimer = setTimeout(() => {
            this.state._normalBatchTimer = null;
            this._processNormalBatch();
          }, this.config.queue.batchIntervalMs);
        }
      }
    }

    _processNormalBatch() {
      this.state.normalQueue.splice(0, this.config.queue.batchSize).forEach(item => this._applyItem(item));
      if (this.state.normalQueue.length) {
        this.state._normalBatchTimer = setTimeout(() => {
          this.state._normalBatchTimer = null;
          this._processNormalBatch();
        }, this.config.queue.batchIntervalMs);
      }
    }

    _processPriority() {
      while (this.state.priorityQueue.length) this._applyItem(this.state.priorityQueue.shift());
    }

    _applyItem(item) {
      const user = this.state.users.get(item.userId);
      if (!user) return;
      user.lastActive = Date.now();
      if (item.type === 'gift') this._applyGiftTier(item.userId, item.coins);
      else { user.animState = 'dancing'; user.dirty = true; }
    }

    _applyGiftTier(userId, coins) {
      const user = this.state.users.get(userId);
      if (!user) return;
      user.totalCoinsSpent += coins;

      const tiers = this.config.giftTiers;
      let tier = tiers[0];
      for (let i = tiers.length - 1; i >= 0; i--) {
        if (coins >= tiers[i].minCoins) { tier = tiers[i]; break; }
      }

      if (ZONE_RANK[tier.zone] > ZONE_RANK[user.zone]) this._moveZone(userId, tier.zone);
      user.animState = 'celebrating';
      user.animTimer = this.config.character.celebDurationMs;
      user.dirty = true;

      if (tier.tier === 4) this._applyDaigaEffect(userId);
      if (tier.tier === 5) this._applyBaoToanSan(userId);

      this._updateLeaderboard();
      this._miniGames?.onGift(userId, coins, user.team);
      this._emit('giftTier', { tier: tier.tier, userId, coins, x: user.targetPos.x, y: user.targetPos.y });
    }

    _applyDaigaEffect(userId) {
      [...this.state.zones.vip.slots]
        .filter(id => id !== userId)
        .forEach(id => this._moveZone(id, 'regular'));
    }

    _applyBaoToanSan(userId) {
      const bowMs = this.config.character.bowDurationMs;
      this.state.users.forEach((u, id) => {
        if (id !== userId) { u.animState = 'bowing'; u.animTimer = bowMs; u.dirty = true; }
      });
    }

    _moveZone(userId, newZone) {
      const user = this.state.users.get(userId);
      if (!user || user.zone === newZone) return;
      this._removeFromZone(userId, user.zone);
      user.zone = newZone;
      this._addToZone(userId, newZone);
      this._assignSlotPosition(userId);
      user.dirty = true;
    }

    _addToZone(userId, zoneName) {
      const zone = this.state.zones[zoneName];
      if (zone.slots.length >= this.config.zones[zoneName].maxUsers) this._evictLRU(zoneName);
      zone.slots.push(userId);
    }

    _removeFromZone(userId, zoneName) {
      const s = this.state.zones[zoneName].slots;
      const i = s.indexOf(userId);
      if (i !== -1) s.splice(i, 1);
    }

    _evictLRU(zoneName) {
      const slots = this.state.zones[zoneName].slots;
      if (!slots.length) return;
      let oldest = slots[0], oldestTime = Infinity;
      slots.forEach(id => {
        const t = this.state.users.get(id)?.lastActive ?? Infinity;
        if (t < oldestTime) { oldest = id; oldestTime = t; }
      });
      if (zoneName === 'danceFloor') {
        this._removeFromZone(oldest, zoneName);
        this.state.users.delete(oldest);
      } else {
        this._moveZone(oldest, 'danceFloor');
      }
    }

    _assignSlotPosition(userId) {
      const user = this.state.users.get(userId);
      if (!user) return;
      const zCfg = this.config.zones[user.zone];
      const [yMin, yMax] = zCfg.yRange;
      const [dMin, dMax] = zCfg.depthRange;
      const y = yMin + Math.random() * (yMax - yMin);
      const depth = dMin + ((y - yMin) / (yMax - yMin)) * (dMax - dMin);
      user.targetPos = { x: 120 + Math.random() * 1680, y };
      user.depth = depth;
    }

    _updateLeaderboard() {
      this.state.leaderboard = Array.from(this.state.users.values())
        .sort((a, b) => b.totalCoinsSpent - a.totalCoinsSpent)
        .slice(0, 10)
        .map(u => u.userId);
    }
  }

  window.BarEngine = BarEngine;
})();
