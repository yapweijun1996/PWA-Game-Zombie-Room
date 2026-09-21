export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
export function dist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
export function rand(min, max) { return Math.random() * (max - min) + min; }

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
