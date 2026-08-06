/**
 * vfx-system.js — Particle effects, banners, flash/blackout overlays.
 * Renderer calls VFXSystem.draw(ctx) each frame after drawing characters.
 *
 * @module games/virtual-bar/vfx-system
 */

((global) => {
  const MAX_PARTICLES = 500;

  // ── Particle presets ─────────────────────────────────────────────────────
  const PRESETS = {
    confetti: { shapes: ['rect'], colors: ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff922b'], size: [6,12], speed: [3,6], spread: Math.PI * 2 },
    heart:    { shapes: ['text'], text: '❤️',  colors: ['#ff6b6b'], size: [16,22], speed: [1,3], spread: Math.PI / 3 },
    money:    { shapes: ['text'], text: '💵',  colors: ['#51cf66'], size: [18,26], speed: [2,5], spread: 0.4 },
    gold:     { shapes: ['circle'], colors: ['#ffd700','#ffab00','#fff8e1'], size: [4,9],  speed: [4,8], spread: Math.PI * 2 },
    laser:    { shapes: ['rect'], colors: ['#f03','#0ff','#f0f','#ff0'], size: [3,6], speed: [6,14], spread: Math.PI * 2 },
    team:     { shapes: ['circle'], colors: null /* set at trigger time */, size: [5,10], speed: [4,9], spread: Math.PI * 2 },
  };

  function _rnd(min, max) { return min + Math.random() * (max - min); }

  function _makeParticle(x, y, preset, colorOverrides) {
    const colors = colorOverrides || preset.colors;
    const angle  = _rnd(0, preset.spread) - preset.spread / 2 - Math.PI / 2;
    const speed  = _rnd(...preset.speed);
    return {
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - _rnd(1, 3),
      size:  _rnd(...preset.size),
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: preset.shapes[0],
      text:  preset.text || null,
      life:  1,
      decay: _rnd(0.015, 0.035),
    };
  }

  function _emit(particles, x, y, presetKey, count, colorOverrides) {
    const preset = PRESETS[presetKey];
    for (let i = 0; i < count; i++) particles.push(_makeParticle(x, y, preset, colorOverrides));
    if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
  }

  // ── VFXSystem singleton ──────────────────────────────────────────────────
  const VFXSystem = {
    particles: [],
    overlays:  [],

    trigger(type, opts = {}) {
      const { x = 960, y = 540, team, text, userId, coins } = opts;
      switch (type) {
        case 'heartFloat':
          _emit(this.particles, x, y, 'heart', 5);
          break;
        case 'confettiBurst':
          _emit(this.particles, x, y, 'confetti', 15);
          break;
        case 'moneyRain':
          for (let i = 0; i < 20; i++) _emit(this.particles, _rnd(100, 1820), 0, 'money', 1);
          break;
        case 'champagnePop':
          _emit(this.particles, x, y, 'gold', 40);
          this._pushBanner('🍾 Tháp Champagne! 🍾', 3000);
          break;
        case 'strobeFlash':
          this.overlays.push({ type: 'flash', timer: 800, duration: 800, color: '#ffffff', alpha: 0.75 });
          break;
        case 'bannerText':
          this._pushBanner(text || '', 4000);
          break;
        case 'blackoutLaser':
          this.overlays.push({ type: 'blackout', timer: 3000, duration: 3000, phase: 'dark', _x: x, _y: y });
          break;
        case 'quayTimeBanner':
          this._pushBanner('🔥 QUẨY TIME! 🔥', 30000, true);
          break;
        case 'teamWin': {
          const color = team === 'red' ? ['#ff4444','#ff8888'] : ['#4488ff','#88bbff'];
          for (let i = 0; i < 80; i++) _emit(this.particles, _rnd(0, 1920), _rnd(0, 400), 'team', 1, color);
          break;
        }
      }
    },

    _pushBanner(text, duration, pulse = false) {
      this.overlays.push({ type: 'banner', text, timer: duration, duration, x: 1980, pulse, pulsePhase: 0 });
    },

    tick(dtMs) {
      // Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x  += p.vx; p.y += p.vy;
        p.vy += 0.15; // gravity
        p.vx *= 0.98;
        p.life -= p.decay;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
      // Overlays
      for (let i = this.overlays.length - 1; i >= 0; i--) {
        const o = this.overlays[i];
        o.timer -= dtMs;
        if (o.type === 'banner') { o.x -= dtMs * 0.35; o.pulsePhase += dtMs * 0.004; }
        if (o.type === 'blackout' && o.phase === 'dark' && o.timer <= 0) {
          _emit(this.particles, 960, 540, 'laser', 200);
          o.phase = 'laser';
          o.type  = 'flash';
          o.color = '#ff00ff';
          o.alpha = 0.8;
          o.timer = 2000; o.duration = 2000;
        }
        if (o.timer <= 0 && !(o.type === 'blackout' && o.phase === 'dark')) this.overlays.splice(i, 1);
      }
    },

    draw(ctx) {
      // Draw particles
      this.particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life * 0.9);
        if (p.shape === 'text' && p.text) {
          ctx.font = `${p.size}px serif`;
          ctx.fillText(p.text, p.x, p.y);
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        } else { // rect
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 0.5);
        }
        ctx.restore();
      });

      // Draw overlays
      this.overlays.forEach(o => {
        ctx.save();
        const progress = o.timer / o.duration; // 1→0
        if (o.type === 'flash') {
          ctx.fillStyle = o.color || '#ffffff';
          ctx.globalAlpha = o.alpha * progress;
          ctx.fillRect(0, 0, 1920, 1080);
        } else if (o.type === 'blackout') {
          ctx.fillStyle = '#000';
          ctx.globalAlpha = 0.96;
          ctx.fillRect(0, 0, 1920, 1080);
        } else if (o.type === 'banner') {
          const scale = o.pulse ? 1 + Math.sin(o.pulsePhase) * 0.08 : 1;
          ctx.font = `${Math.round(52 * scale)}px "Segoe UI", Arial, sans-serif`;
          ctx.fillStyle = '#ffd700';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 4;
          ctx.textBaseline = 'middle';
          ctx.globalAlpha = Math.min(1, progress * 3);
          ctx.strokeText(o.text, o.x, 80);
          ctx.fillText(o.text, o.x, 80);
        }
        ctx.restore();
      });
    },
  };

  global.VFXSystem = VFXSystem;
})(window);
