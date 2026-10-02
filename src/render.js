import { ctx, game, room, viewport } from './state.js';
import { clamp, rand } from './utils.js';
import { t } from './i18n.js';
import { getSpitEndpoint, SPITTER_CONFIG } from './ranged-combat.js';
import { drawGrid, drawRoomLighting, drawObstacles, drawHazards } from './render-scene.js';
import { drawPlayer, drawZombie, drawAttackTelegraph, drawRangedThreats } from './render-actors.js';
import { drawPickups, drawThreatRadar } from './render-hud.js';

const BULLET_TRAIL_SPEC = {
  crit: [[0, 'rgba(255, 214, 102, 0)'], [0.5, 'rgba(255, 180, 50, 0.45)'], [1, '#fff6d6']],
  pierce: [[0, 'rgba(105, 182, 255, 0)'], [0.5, 'rgba(74, 160, 255, 0.45)'], [1, '#e5f3ff']],
  normal: [[0, 'rgba(121, 242, 154, 0)'], [0.5, 'rgba(121, 242, 154, 0.45)'], [1, '#ffffff']]
};
const BULLET_TRAIL_SPRITE_W = 64;
const BULLET_TRAIL_SPRITE_H = 16;
let bulletTrailSprites = null;

function getBulletTrailSprites() {
  if (bulletTrailSprites) return bulletTrailSprites;
  bulletTrailSprites = {};
  for (const key in BULLET_TRAIL_SPEC) {
    const c = document.createElement('canvas');
    c.width = BULLET_TRAIL_SPRITE_W;
    c.height = BULLET_TRAIL_SPRITE_H;
    const sctx = c.getContext('2d');
    const g = sctx.createLinearGradient(0, 0, BULLET_TRAIL_SPRITE_W, 0);
    for (const [stop, color] of BULLET_TRAIL_SPEC[key]) g.addColorStop(stop, color);
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, BULLET_TRAIL_SPRITE_W, BULLET_TRAIL_SPRITE_H);
    bulletTrailSprites[key] = c;
  }
  return bulletTrailSprites;
}

export function draw() {
  const W = viewport.W, H = viewport.H, dpr = viewport.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const shake = game.cameraShake > 0 ? game.cameraShake * 7 : 0;
  const sx = shake ? rand(-shake, shake) : 0;
  const sy = shake ? rand(-shake, shake) : 0;
  ctx.save();
  ctx.translate(sx, sy);
  drawGrid();
  drawHazards();
  drawObstacles();
  drawPickups();

  for (const o of game.orbs) {
    const glow = 1 + Math.sin(o.pulse) * .12;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r * 2.1 * glow, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(74, 160, 255, .12)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r * glow, 0, Math.PI * 2);
    ctx.fillStyle = '#6eb7ff';
    ctx.fill();
  }

  const trailSprites = getBulletTrailSprites();
  for (const b of game.bullets) {
    const speed = Math.hypot(b.vx, b.vy) || 1;
    const nx = b.vx / speed;
    const ny = b.vy / speed;
    const trailLen = b.isCrit ? 26 : (b.damage > 1.3 ? 20 : 15);
    const lineWidth = b.isCrit ? 5 : (b.damage > 1.3 ? 4 : 2.8);
    const spriteKey = b.isCrit ? 'crit' : (b.pierce > 1 ? 'pierce' : 'normal');

    // Tapered energy tracer beam (pre-rendered sprite, transformed per bullet)
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(ny, nx));
    ctx.drawImage(trailSprites[spriteKey], -trailLen, -lineWidth / 2, trailLen, lineWidth);
    ctx.restore();

    // Luminous halo
    if (!game.performanceMode) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = b.isCrit ? 'rgba(255, 214, 102, .25)' : (b.pierce > 1 ? 'rgba(105, 182, 255, .25)' : 'rgba(220, 255, 229, .18)');
      ctx.fill();
    }

    // Hot plasma core
    ctx.beginPath();
    if (b.path === 'scatter') {
      ctx.moveTo(b.x, b.y - b.r * 1.2);
      ctx.lineTo(b.x + b.r * 1.2, b.y);
      ctx.lineTo(b.x, b.y + b.r * 1.2);
      ctx.lineTo(b.x - b.r * 1.2, b.y);
      ctx.closePath();
    } else ctx.arc(b.x, b.y, b.r * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = b.isCrit ? '#fffbe8' : (b.pierce > 1 ? '#eaf4ff' : '#ffffff');
    ctx.fill();
  }

  for (const z of game.zombies) drawAttackTelegraph(z);
  for (const z of game.zombies) drawZombie(z);

  const p = game.player;
  if (p) drawPlayer(p);
  if (p?.build?.burstTimer > 0) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aimAngle);
    ctx.strokeStyle = '#ffd27a';
    ctx.lineWidth = 2;
    for (const offset of [0, 6]) {
      ctx.beginPath();
      ctx.moveTo(-p.r - 6 - offset, -7);
      ctx.lineTo(-p.r - offset, 0);
      ctx.lineTo(-p.r - 6 - offset, 7);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const q of game.particles) {
    ctx.globalAlpha = clamp(q.life / q.maxLife, 0, 1);
    if (q.shape === 'limb') {
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.rot || 0);
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.roundRect(-q.size * 1.6, -q.size * 0.45, q.size * 3.2, q.size * 0.9, q.size * 0.45);
      ctx.fill();
      ctx.fillStyle = '#f0f4e6';
      ctx.beginPath();
      ctx.arc(-q.size * 1.6, 0, q.size * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b32434';
      ctx.beginPath();
      ctx.arc(q.size * 1.6, 0, q.size * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (q.shape === 'bone') {
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.rot || 0);
      ctx.fillStyle = '#e8eedb';
      ctx.fillRect(-q.size * 0.4, -q.size * 1.1, q.size * 0.8, q.size * 2.2);
      ctx.restore();
    } else if (q.shape === 'arc') {
      ctx.save();
      ctx.strokeStyle = '#e5f4ff';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      const midX = (q.x + q.tx) / 2 + (Math.sin(q.life * 45) * 10);
      const midY = (q.y + q.ty) / 2 + (Math.cos(q.life * 45) * 10);
      ctx.lineTo(midX, midY);
      ctx.lineTo(q.tx, q.ty);
      ctx.stroke();
      ctx.restore();
    } else if (q.shape === 'dot') {
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.size * .5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
  }
  ctx.globalAlpha = 1;

  // Floating combat damage numbers
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const ft of game.floatingTexts) {
    const alpha = clamp(ft.life / ft.maxLife, 0, 1);
    const progress = 1 - ft.life / ft.maxLife;
    const popScale = progress < 0.15 ? 1 + (0.15 - progress) * 2.2 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ft.x, ft.y);
    ctx.scale(popScale, popScale);
    ctx.font = `950 ${ft.size}px Inter, ui-sans-serif, system-ui, sans-serif`;
    if (!game.performanceMode) {
      ctx.lineWidth = ft.isCrit ? 3.5 : 2.5;
      ctx.strokeStyle = ft.stroke;
      ctx.strokeText(ft.text, 0, 0);
    }
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  drawRoomLighting();
  drawRangedThreats();
  drawThreatRadar();
  ctx.restore();
}
