/**
 * avatar-loader.js — TikTok avatar image cache with CORS fallback.
 * Renderer calls get() each frame; load() is fire-and-forget.
 *
 * @module games/virtual-bar/avatar-loader
 */

((global) => {
  // Map<userId, HTMLImageElement | 'loading' | 'error'>
  const cache = new Map();

  // Deterministic hue from userId string
  function _hashColor(userId) {
    let h = 0;
    for (let i = 0; i < userId.length; i++) h = (h * 47 + userId.charCodeAt(i)) & 0xffff;
    return `hsl(${h % 360}, 65%, 55%)`;
  }

  // Returns 2-char display initials from nickname
  function _initials(nickname) {
    return (nickname || '?').slice(0, 2).toUpperCase();
  }

  /**
   * Kick off image load for a user. Safe to call multiple times (no-op if cached).
   * @param {string} userId
   * @param {string} url — TikTok profile picture URL
   */
  function load(userId, url) {
    if (cache.has(userId)) return;
    if (!url) { cache.set(userId, 'error'); return; }

    cache.set(userId, 'loading');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => cache.set(userId, img);
    img.onerror = () => cache.set(userId, 'error');
    img.src = url;
  }

  /**
   * Returns the cached HTMLImageElement, or null if not ready / failed.
   * @param {string} userId
   * @returns {HTMLImageElement | null}
   */
  function get(userId) {
    const entry = cache.get(userId);
    return entry instanceof HTMLImageElement ? entry : null;
  }

  /**
   * Draws a colored circle with initials onto a small offscreen canvas.
   * Renderer uses this when get() returns null.
   * @param {string} userId
   * @param {string} nickname
   * @param {number} [size=48]
   * @returns {HTMLCanvasElement}
   */
  function getFallbackCanvas(userId, nickname, size = 48) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const cx = c.getContext('2d');
    const r = size / 2;

    cx.beginPath();
    cx.arc(r, r, r, 0, Math.PI * 2);
    cx.fillStyle = _hashColor(userId);
    cx.fill();

    cx.fillStyle = 'rgba(255,255,255,0.92)';
    cx.font = `700 ${Math.round(size * 0.38)}px "Segoe UI", Arial, sans-serif`;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(_initials(nickname), r, r);

    return c;
  }

  global.AvatarLoader = { load, get, getFallbackCanvas };
})(window);
