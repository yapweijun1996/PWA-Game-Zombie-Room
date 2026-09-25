import { ctx, game, room, viewport } from './state.js';
import { clamp, rand } from './utils.js';
import { t } from './i18n.js';

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

function drawGrid() {
  const W = viewport.W, H = viewport.H;
  ctx.fillStyle = '#050b08';
  ctx.fillRect(0, 0, W, H);

  const floor = ctx.createLinearGradient(room.x, room.y, room.x, room.y + room.h);
  floor.addColorStop(0, '#0f1713');
  floor.addColorStop(.55, '#0c1510');
  floor.addColorStop(1, '#0a120e');
  ctx.fillStyle = floor;
  ctx.fillRect(room.x, room.y, room.w, room.h);

  // Industrial wall frame.
  ctx.fillStyle = 'rgba(17,25,20,.95)';
  ctx.fillRect(room.x, room.y, room.w, 7);
  ctx.fillRect(room.x, room.y + room.h - 7, room.w, 7);
  ctx.fillRect(room.x, room.y, 7, room.h);
  ctx.fillRect(room.x + room.w - 7, room.y, 7, room.h);

  // Overhead lights and screen glow. ECO keeps the fixtures but avoids extra radial gradients.
  const lightXs = [room.x + room.w * .18, room.x + room.w * .5, room.x + room.w * .82];
  for (const lx of lightXs) {
    if (!game.performanceMode) {
      const beam = ctx.createRadialGradient(lx, room.y + 18, 4, lx, room.y + 18, 90);
      beam.addColorStop(0, 'rgba(121,242,154,.11)');
      beam.addColorStop(.5, 'rgba(121,242,154,.05)');
      beam.addColorStop(1, 'rgba(121,242,154,0)');
      ctx.fillStyle = beam;
      ctx.fillRect(lx - 90, room.y, 180, 110);
    }
    ctx.fillStyle = game.performanceMode ? 'rgba(200,255,214,.30)' : 'rgba(200,255,214,.45)';
    ctx.fillRect(lx - 14, room.y + 6, 28, 4);
  }

  // Deterministic grime / blood decals under entities.
  const visibleDecals = game.performanceMode ? game.decals.slice(-16) : game.decals;
  for (const d of visibleDecals) {
    if (game.performanceMode) {
      ctx.fillStyle = d.color;
    } else {
      if (!d._gradient) {
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.radius);
        g.addColorStop(0, d.color.replace('0.24', '0.34'));
        g.addColorStop(.7, d.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        d._gradient = g;
      }
      ctx.fillStyle = d._gradient;
    }
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, d.radius * 1.1, d.radius * (.65 + Math.sin(d.seed) * .12), d.seed, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hazard stripe lane.
  const stripeY = room.y + room.h * .48;
  for (let i = 0; i < 8; i++) {
    const sx = room.x + 24 + i * 52;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(232,180,92,.12)' : 'rgba(20,24,18,.28)';
    ctx.beginPath();
    ctx.moveTo(sx, stripeY + 12);
    ctx.lineTo(sx + 18, stripeY - 12);
    ctx.lineTo(sx + 34, stripeY - 12);
    ctx.lineTo(sx + 16, stripeY + 12);
    ctx.closePath();
    ctx.fill();
  }

  // Grid overlay.
  ctx.strokeStyle = 'rgba(223,255,232,.04)';
  ctx.lineWidth = 1;
  const grid = 34;
  ctx.beginPath();
  for (let x = room.x + 1; x <= room.x + room.w; x += grid) { ctx.moveTo(x, room.y); ctx.lineTo(x, room.y + room.h); }
  for (let y = room.y + 1; y <= room.y + room.h; y += grid) { ctx.moveTo(room.x, y); ctx.lineTo(room.x + room.w, y); }
  ctx.stroke();

  // Cracks / room detail.
  ctx.strokeStyle = 'rgba(114,140,121,.18)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(room.x + room.w * .12, room.y + room.h * .18);
  ctx.lineTo(room.x + room.w * .16, room.y + room.h * .24);
  ctx.lineTo(room.x + room.w * .14, room.y + room.h * .3);
  ctx.moveTo(room.x + room.w * .76, room.y + room.h * .7);
  ctx.lineTo(room.x + room.w * .8, room.y + room.h * .75);
  ctx.lineTo(room.x + room.w * .84, room.y + room.h * .72);
  ctx.stroke();

  // Edge terminals / crates.
  const panels = [
    [room.x + 14, room.y + 16, 42, 16],
    [room.x + room.w - 58, room.y + 14, 44, 18],
    [room.x + 16, room.y + room.h - 32, 54, 14]
  ];
  panels.forEach(([x, y, w, h], idx) => {
    ctx.fillStyle = 'rgba(14,22,18,.92)';
    ctx.strokeStyle = 'rgba(89,132,101,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = idx === 1 ? 'rgba(255,109,121,.55)' : 'rgba(121,242,154,.34)';
    ctx.fillRect(x + 7, y + 5, w - 14, 4);
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.fillRect(x + 6, y + h - 4, w - 12, 1);
  });

  // Service door, vents, wall pipes and floor anchors make the room feel inhabited.
  const doorW = Math.min(88, room.w * .16);
  const doorX = room.x + room.w * .5 - doorW / 2;
  ctx.fillStyle = 'rgba(8,14,11,.95)';
  ctx.strokeStyle = 'rgba(84,118,93,.35)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.roundRect(doorX, room.y + 7, doorW, 24, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(232,180,92,.34)';
  ctx.fillRect(doorX + 10, room.y + 15, doorW - 20, 3);
  ctx.fillStyle = 'rgba(121,242,154,.18)';
  ctx.fillRect(doorX + doorW - 15, room.y + 11, 5, 5);

  const ventY = room.y + room.h - 23;
  for (const vx of [room.x + room.w * .34, room.x + room.w * .68]) {
    ctx.fillStyle = 'rgba(7,12,9,.72)';
    ctx.strokeStyle = 'rgba(95,124,102,.25)';
    ctx.beginPath();
    ctx.roundRect(vx - 18, ventY, 36, 12, 3);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(134,164,140,.18)';
    ctx.lineWidth = 1;
    for (let i = -12; i <= 12; i += 6) {
      ctx.beginPath();
      ctx.moveTo(vx + i, ventY + 3);
      ctx.lineTo(vx + i, ventY + 9);
      ctx.stroke();
    }
  }

  // Pipe runs along the left wall with a few brackets.
  ctx.strokeStyle = 'rgba(73,96,80,.48)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(room.x + 10, room.y + 48);
  ctx.lineTo(room.x + 10, room.y + room.h * .72);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(131,160,137,.26)';
  ctx.lineWidth = 1;
  for (let py = room.y + 70; py < room.y + room.h * .72; py += 54) {
    ctx.beginPath();
    ctx.moveTo(room.x + 6, py);
    ctx.lineTo(room.x + 14, py);
    ctx.stroke();
  }

  // Floor anchor plates / bolts.
  const anchors = [
    [room.x + room.w * .22, room.y + room.h * .26],
    [room.x + room.w * .78, room.y + room.h * .27],
    [room.x + room.w * .24, room.y + room.h * .74],
    [room.x + room.w * .76, room.y + room.h * .74]
  ];
  for (const [ax, ay] of anchors) {
    ctx.fillStyle = 'rgba(80,105,88,.12)';
    ctx.strokeStyle = 'rgba(122,150,128,.14)';
    ctx.beginPath();
    ctx.arc(ax, ay, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(185,210,190,.18)';
    ctx.beginPath();
    ctx.arc(ax, ay, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(155, 218, 172, .19)';
  ctx.lineWidth = 2;
  ctx.strokeRect(room.x, room.y, room.w, room.h);

  // Corner brackets.
  ctx.fillStyle = 'rgba(121,242,154,.055)';
  const corner = 14;
  ctx.fillRect(room.x, room.y, corner, 2);
  ctx.fillRect(room.x, room.y, 2, corner);
  ctx.fillRect(room.x + room.w - corner, room.y, corner, 2);
  ctx.fillRect(room.x + room.w - 2, room.y, 2, corner);
  ctx.fillRect(room.x, room.y + room.h - 2, corner, 2);
  ctx.fillRect(room.x, room.y + room.h - corner, 2, corner);
  ctx.fillRect(room.x + room.w - corner, room.y + room.h - 2, corner, 2);
  ctx.fillRect(room.x + room.w - 2, room.y + room.h - corner, 2, corner);

  // Active boss warning strip + health bar.
  const boss = game.zombies.find(z => z.type === 'boss');
  if (boss) {
    const pulse = .45 + Math.sin(game.roomPhase * 8) * .12;
    ctx.fillStyle = 'rgba(255,109,121,' + pulse.toFixed(3) + ')';
    ctx.fillRect(room.x + 18, room.y + 16, room.w - 36, 8);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(room.x + 18, room.y + 28, room.w - 36, 12);
    ctx.fillStyle = '#ff6d79';
    ctx.fillRect(room.x + 18, room.y + 28, (room.w - 36) * clamp(boss.hp / boss.maxHp, 0, 1), 12);
    ctx.fillStyle = '#fbe9ec';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillText(t('bossLabel'), room.x + 22, room.y + 25);
  }

  const vignette = ctx.createRadialGradient(W / 2, room.y + room.h / 2, 28, W / 2, room.y + room.h / 2, Math.max(W, H) * .72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.59)');
  ctx.fillStyle = vignette;
  ctx.fillRect(room.x, room.y, room.w, room.h);
}

function drawPlayer(p) {
  const hurt = p.invuln > 0;
  const eco = game.performanceMode;
  const lowHp = p.hp <= 30;

  const bob = p.moving ? Math.sin(p.walkTime * 2) * 1.15 : Math.sin(p.walkTime) * .25;
  const stride = p.moving ? Math.sin(p.walkTime * 2) * 2.35 : 0;
  const recoil = p.recoil * 2.4;

  ctx.save();
  if (hurt) {
    ctx.globalAlpha = 0.72 + Math.sin(p.invuln * 28) * 0.28;
  }

  // Ground readability: shadow + subtle survivor ring.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1, .58);
  ctx.beginPath();
  ctx.arc(0, 8, 18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.34)';
  ctx.fill();
  ctx.restore();

  const ringColor = hurt ? 'rgba(255,101,118,.5)' : (lowHp ? 'rgba(255,180,50,.35)' : 'rgba(121,242,154,.2)');
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r + 8, 0, Math.PI * 2);
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = hurt || lowHp ? 2.2 : 1.5;
  ctx.stroke();

  if (p.dashTimer > 0) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.dashDirectionY, p.dashDirectionX));
    ctx.strokeStyle = '#effff2';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(-p.r - 4, -9);
    ctx.lineTo(-p.r - 25, -9);
    ctx.moveTo(-p.r - 4, 9);
    ctx.lineTo(-p.r - 25, 9);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Aiming tactical laser guide line
  if (!eco) {
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.rotate(p.aimAngle);
    ctx.strokeStyle = p.overdriveTimer > 0 ? 'rgba(105, 182, 255, 0.45)' : (p.critChance > 0 ? 'rgba(255, 214, 102, 0.35)' : 'rgba(121, 242, 154, 0.25)');
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(60, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Energy shield bubble
  if (p.shield > 0) {
    const shieldRatio = p.shield / p.maxShield;
    const isFlashing = p.shieldHitFlash > 0;
    const shieldAlpha = isFlashing ? 0.75 : shieldRatio * (0.24 + Math.sin(game.roomPhase * 3.5) * 0.08);

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
    ctx.strokeStyle = isFlashing ? '#ffffff' : `rgba(105, 182, 255, ${shieldAlpha * 2})`;
    ctx.lineWidth = isFlashing ? 2.5 : 1.4;
    ctx.stroke();

    if (!eco) {
      ctx.fillStyle = isFlashing ? 'rgba(255, 255, 255, 0.25)' : `rgba(74, 160, 255, ${shieldAlpha * 0.35})`;
      ctx.fill();
    }
  }

  // Overdrive electric aura
  if (p.overdriveTimer > 0) {
    const auraPulse = 1 + Math.sin(game.elapsed * 14) * 0.15;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (p.r + 11) * auraPulse, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(105, 182, 255, 0.75)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    if (!eco) {
      ctx.strokeStyle = '#e5f4ff';
      ctx.lineWidth = 1.2;
      for (let a = 0; a < 3; a++) {
        const ang = game.elapsed * 9 + a * ((Math.PI * 2) / 3);
        const dist = p.r + 9 + (a % 2) * 4;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, 2.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  ctx.save();
  ctx.translate(p.x, p.y + bob);
  ctx.rotate(p.aimAngle);

  // Backpack, positioned behind the torso.
  ctx.fillStyle = '#1b2920';
  ctx.strokeStyle = '#08100b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-8.5, 0, 6.5, 8.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(141,177,149,.34)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-11, -4.4);
  ctx.lineTo(-6.5, -4.4);
  ctx.moveTo(-11, 4.4);
  ctx.lineTo(-6.5, 4.4);
  ctx.stroke();

  // Boots / legs. Alternating stride makes movement legible on small screens.
  ctx.fillStyle = '#0b100d';
  ctx.strokeStyle = '#030604';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(-5.7 + stride * .25, -6.1, 4.3, 3.1, -.12, 0, Math.PI * 2);
  ctx.ellipse(-5.7 - stride * .25, 6.1, 4.3, 3.1, .12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Jacket / torso with a bright shoulder accent for instant player recognition.
  ctx.fillStyle = hurt ? '#ffc4cb' : '#dfe9e2';
  ctx.strokeStyle = '#07100b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-1, 0, 9.7, 10.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Tactical chest harness webbing
  ctx.strokeStyle = '#18241b';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-4, -6.5); ctx.lineTo(3, 6.5);
  ctx.moveTo(-4, 6.5); ctx.lineTo(3, -6.5);
  ctx.stroke();

  ctx.fillStyle = hurt ? '#ff7d89' : '#5c8065';
  ctx.beginPath();
  ctx.ellipse(-1.5, -7.4, 5.8, 2.2, -.12, 0, Math.PI * 2);
  ctx.fill();

  // Pulsing tactical shoulder beacon LED
  const beaconColor = lowHp ? '#ff6174' : (p.overdriveTimer > 0 ? '#69b6ff' : '#79f29a');
  const beaconPulse = 0.6 + Math.sin(game.roomPhase * 5) * 0.4;
  ctx.fillStyle = beaconColor;
  ctx.globalAlpha = beaconPulse;
  ctx.beginPath();
  ctx.arc(-2.4, -8.2, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Tactical Combat Helmet Shell
  ctx.fillStyle = hurt ? '#ffe0e3' : '#1e2c22';
  ctx.strokeStyle = '#050a07';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(5.4, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Helmet brow rim & ear guard
  ctx.fillStyle = '#2c3e32';
  ctx.beginPath();
  ctx.arc(4.2, 0, 6.3, Math.PI * 0.65, Math.PI * 1.35);
  ctx.lineTo(5.6, 0);
  ctx.closePath();
  ctx.fill();

  // Illuminated tactical visor / goggles
  const visorColor = p.overdriveTimer > 0 ? '#69b6ff' : (hurt ? '#ff4359' : (lowHp ? '#ffd27a' : '#79f29a'));
  ctx.fillStyle = visorColor;
  ctx.strokeStyle = '#050a07';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(7.2, -3.2, 3.4, 6.4, 1.5);
  ctx.fill();
  ctx.stroke();

  // Visor specular glass reflection
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(8.6, -2.2, 1.2, 4.4);

  // Arms supporting the weapon.
  ctx.strokeStyle = hurt ? '#f7c6cb' : '#c9d8cd';
  ctx.lineWidth = 4.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(3.8, -6.2);
  ctx.lineTo(12.8 - recoil * .25, -3.2);
  ctx.moveTo(3.8, 6.2);
  ctx.lineTo(12.8 - recoil * .25, 3.2);
  ctx.stroke();

  // Compact rifle. The bright sight makes aiming direction clear.
  ctx.translate(-recoil, 0);
  ctx.fillStyle = '#18211b';
  ctx.strokeStyle = '#050806';
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(8.5, -2.35);
  ctx.lineTo(22, -2.35);
  ctx.lineTo(25.5, -1.05);
  ctx.lineTo(25.5, 1.05);
  ctx.lineTo(22, 2.35);
  ctx.lineTo(8.5, 2.35);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#79f29a';
  ctx.fillRect(12.2, -3.6, 4.2, 1.4);
  ctx.fillStyle = '#34483a';
  ctx.fillRect(16.2, 2.1, 3.8, 4.5);

  // Muzzle flash only during an actual auto-shot.
  if (p.muzzleFlash > 0) {
    const flash = .55 + p.muzzleFlash * 5;
    const isMulti = (p.projectiles || 1) > 1;
    const isHeavy = (p.damage || 1) >= 1.6;
    ctx.save();
    ctx.translate(27, 0);
    ctx.scale(flash, flash);

    // Conical outer flare
    ctx.fillStyle = isHeavy ? '#ffd07d' : '#fff4b8';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(isMulti ? 10 : 8, isMulti ? -5 : -3.5);
    ctx.lineTo(isMulti ? 7.5 : 6.2, 0);
    ctx.lineTo(isMulti ? 10 : 8, isMulti ? 5 : 3.5);
    ctx.closePath();
    ctx.fill();

    // Hot plasma inner dart
    ctx.fillStyle = isHeavy ? '#ff6174' : '#ffbd58';
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.lineTo(6, isMulti ? -2.4 : -1.7);
    ctx.lineTo(4.6, 0);
    ctx.lineTo(6, isMulti ? 2.4 : 1.7);
    ctx.closePath();
    ctx.fill();

    // Lateral energy sparks for multi-shot weapons
    if (isMulti && !game.performanceMode) {
      ctx.strokeStyle = 'rgba(105, 182, 255, .75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(2, -4); ctx.lineTo(7, -8);
      ctx.moveTo(2, 4); ctx.lineTo(7, 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

function drawAttackTelegraph(z) {
  if (z.charge?.state !== 'windup') return;

  const isBoss = z.type === 'boss';
  const length = isBoss ? Math.hypot(room.w, room.h) : 260;
  const start = z.r + 8;
  const endX = z.x + z.charge.directionX * length;
  const endY = z.y + z.charge.directionY * length;
  const perpX = -z.charge.directionY;
  const perpY = z.charge.directionX;
  const laneHalfWidth = isBoss ? 32 : 23;
  const alpha = 0.76 + Math.sin(game.elapsed * 24) * 0.12;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'butt';
  ctx.lineWidth = laneHalfWidth * 2 + 8;
  ctx.strokeStyle = 'rgba(3, 8, 5, .88)';
  ctx.beginPath();
  ctx.moveTo(z.x + z.charge.directionX * start, z.y + z.charge.directionY * start);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#f5fff7';
  ctx.setLineDash([9, 7]);
  for (const side of [-1, 1]) {
    const offsetX = perpX * laneHalfWidth * side;
    const offsetY = perpY * laneHalfWidth * side;
    ctx.beginPath();
    ctx.moveTo(z.x + z.charge.directionX * start + offsetX, z.y + z.charge.directionY * start + offsetY);
    ctx.lineTo(endX + offsetX, endY + offsetY);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const chevronCount = Math.min(5, Math.floor((length - start) / 58));
  for (let index = 0; index < chevronCount; index++) {
    const distance = start + 34 + index * 58;
    const centerX = z.x + z.charge.directionX * distance;
    const centerY = z.y + z.charge.directionY * distance;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX - z.charge.directionX * 9 - perpX * 9, centerY - z.charge.directionY * 9 - perpY * 9);
    ctx.lineTo(centerX + z.charge.directionX * 3, centerY + z.charge.directionY * 3);
    ctx.lineTo(centerX - z.charge.directionX * 9 + perpX * 9, centerY - z.charge.directionY * 9 + perpY * 9);
    ctx.stroke();
  }

  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(z.x, z.y, z.r + 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawZombie(z) {
  const isRunner = z.type === 'runner';
  const isTank = z.type === 'tank';
  const isBoss = z.type === 'boss';
  const isFrenzy = isBoss && !!z.frenzy;
  const scale = isBoss ? 1.95 : z.r / 13;
  const bobAmp = isBoss ? 1.4 : isRunner ? 1.35 : isTank ? .55 : .9;
  const strideAmp = isBoss ? 2.8 : isRunner ? 3.15 : isTank ? 1.75 : 2.35;
  const bob = Math.sin(z.walkTime * 2) * bobAmp;
  const stride = Math.sin(z.walkTime * 2) * strideAmp;
  const attackBase = isBoss ? .24 : .18;
  const attackPhase = z.attackFlash > 0 ? Math.sin((z.attackFlash / attackBase) * Math.PI) : 0;
  const lunge = attackPhase * (isBoss ? 5.4 : isTank ? 4.4 : 3.2);
  const hit = z.hitFlash > 0;

  const outfit = isFrenzy ? '#7a1926' : (isBoss ? '#4d262f' : (isTank ? '#53685a' : (isRunner ? '#b6813d' : '#678a62')));
  const outfitDark = isFrenzy ? '#420b12' : (isBoss ? '#291117' : (isTank ? '#334239' : (isRunner ? '#6f4c24' : '#3d573d')));
  const skin = hit ? '#ffffff' : (isFrenzy ? '#fce2e5' : (isBoss ? '#b7a1a7' : (isTank ? '#a8b49b' : '#a7bc98')));
  const accent = hit ? '#ffffff' : (isFrenzy ? '#ff3b50' : (isBoss ? '#ff8a96' : (isTank ? '#a9c2ae' : (isRunner ? '#e8b45c' : '#8bc57e'))));
  const outline = '#050806';

  ctx.save();
  ctx.translate(z.x, z.y);
  ctx.scale(1, .56);
  ctx.beginPath();
  ctx.arc(0, 7 * scale, z.r * (isBoss ? 1.26 : 1.18), 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.30)';
  ctx.fill();
  ctx.restore();

  // Outer elite aura ring
  if (z.affix) {
    const auraColor = z.affix === 'frost' ? 'rgba(138, 224, 255, 0.45)' : (z.affix === 'swift' ? 'rgba(255, 214, 102, 0.45)' : 'rgba(105, 182, 255, 0.45)');
    const auraRadius = z.affix === 'frost' ? z.r + 32 : z.r + 8;
    ctx.beginPath();
    ctx.arc(z.x, z.y, auraRadius, 0, Math.PI * 2);
    ctx.strokeStyle = auraColor;
    ctx.lineWidth = z.affix === 'frost' ? 1.4 : 1.8;
    if (z.affix === 'frost') ctx.setLineDash([4, 4]);
    ctx.stroke();
    if (z.affix === 'frost') ctx.setLineDash([]);
  }

  const ringPulse = isFrenzy ? 8 + Math.sin((z.pulse || 0) * 2) * 4 : (isBoss ? 6 + Math.sin((z.pulse || 0) * 2) * 2.5 : (isTank ? 5 : 4));
  ctx.beginPath();
  ctx.arc(z.x, z.y, z.r + ringPulse, 0, Math.PI * 2);
  ctx.strokeStyle = hit ? 'rgba(255,255,255,.42)' : (isFrenzy ? 'rgba(255,46,67,.65)' : (isBoss ? 'rgba(255,109,121,.22)' : (isTank ? 'rgba(255,109,121,.16)' : 'rgba(174,205,164,.11)')));
  ctx.lineWidth = isFrenzy ? 3.2 : (isBoss ? 2.5 : (isTank ? 2 : 1.5));
  ctx.stroke();

  ctx.save();
  ctx.translate(z.x, z.y + bob);
  ctx.rotate(z.facing);
  ctx.translate(lunge, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.fillStyle = '#121713';
  ctx.strokeStyle = outline;
  ctx.lineWidth = (isBoss ? 1.8 : 1.35) * scale;
  ctx.beginPath();
  ctx.ellipse(-5.4 * scale + stride * .26, -5.2 * scale, 4.1 * scale, 2.7 * scale, -.12, 0, Math.PI * 2);
  ctx.ellipse(-5.4 * scale - stride * .26, 5.2 * scale, 4.1 * scale, 2.7 * scale, .12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const torsoX = isBoss ? -1.4 * scale : isRunner ? -1.2 * scale : -2 * scale;
  const torsoRx = isBoss ? 10.6 * scale : isTank ? 11.1 * scale : isRunner ? 7.4 * scale : 8.7 * scale;
  const torsoRy = isBoss ? 10.4 * scale : isTank ? 10.1 * scale : isRunner ? 8.4 * scale : 9.4 * scale;
  ctx.fillStyle = hit ? '#f5f7f4' : outfit;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.8 * scale;
  ctx.beginPath();
  ctx.ellipse(torsoX, 0, torsoRx, torsoRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = hit ? '#ffffff' : accent;
  if (isBoss) {
    ctx.fillRect(-6.3 * scale, -8.2 * scale, 9.5 * scale, 2.6 * scale);
    ctx.fillRect(-6.3 * scale, 5.9 * scale, 8.4 * scale, 2.1 * scale);
  } else if (isTank) {
    ctx.fillRect(-6.5 * scale, -8.3 * scale, 8.6 * scale, 2.2 * scale);
    ctx.fillRect(-6.5 * scale, 6.1 * scale, 7 * scale, 1.8 * scale);
  } else {
    ctx.beginPath();
    ctx.moveTo(-5.5 * scale, -7.4 * scale);
    ctx.lineTo(2.2 * scale, -7.4 * scale);
    ctx.lineTo(-.6 * scale, -4.5 * scale);
    ctx.lineTo(-5.8 * scale, -5.1 * scale);
    ctx.closePath();
    ctx.fill();
  }

  const armReach = (isBoss ? 14.8 : isTank ? 13.5 : 11.5) * scale + attackPhase * (isBoss ? 5.5 : 4.2);
  ctx.strokeStyle = skin;
  ctx.lineWidth = (isBoss ? 4.8 : isTank ? 5.2 : 4.1) * scale;
  ctx.beginPath();
  ctx.moveTo(2 * scale, -6.2 * scale);
  ctx.lineTo(armReach, -4.1 * scale);
  ctx.moveTo(2 * scale, 6.2 * scale);
  ctx.lineTo(armReach, 4.1 * scale);
  ctx.stroke();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.1 * scale;
  ctx.beginPath();
  ctx.moveTo(armReach - 2.5 * scale, -4.1 * scale);
  ctx.lineTo(armReach + 1.5 * scale, -4.1 * scale);
  ctx.moveTo(armReach - 2.5 * scale, 4.1 * scale);
  ctx.lineTo(armReach + 1.5 * scale, 4.1 * scale);
  ctx.stroke();

  const headX = (isBoss ? 6.3 : isTank ? 6.2 : 5.7) * scale;
  const headR = (isBoss ? 6.4 : isTank ? 6.8 : isRunner ? 5.5 : 6.1) * scale;
  ctx.fillStyle = skin;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.65 * scale;
  ctx.beginPath();
  ctx.arc(headX, 0, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = hit ? '#eeeeee' : outfitDark;
  ctx.beginPath();
  ctx.arc(headX - 1.2 * scale, 0, headR * .95, Math.PI * .62, Math.PI * 1.38);
  ctx.lineTo(headX + .4 * scale, 0);
  ctx.closePath();
  ctx.fill();

  const isBlackout = game.blackoutTimer > 0;
  const eyeX = headX + headR * .38;

  if (isBlackout) {
    const eyeColor = isFrenzy ? '#ffd700' : (isBoss ? '#ff3344' : (isRunner ? '#ffd27a' : (isTank ? '#ff7d89' : '#79f29a')));
    ctx.save();
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(eyeX, -headR * .28, Math.max(1.3, 1.45 * scale), 0, Math.PI * 2);
    ctx.arc(eyeX, headR * .28, Math.max(1.3, 1.45 * scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = hit ? '#5f6560' : (isFrenzy ? '#ffd666' : (isBoss ? '#34151c' : '#1d271f'));
    ctx.beginPath();
    ctx.arc(eyeX, -headR * .28, Math.max(1.05, 1.15 * scale), 0, Math.PI * 2);
    ctx.arc(eyeX, headR * .28, Math.max(1.05, 1.15 * scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hit ? '#777' : isBoss ? '#ff8a96' : '#526457';
    ctx.lineWidth = Math.max(1, .9 * scale);
    ctx.beginPath();
    ctx.moveTo(headX + headR * .52, -headR * .1);
    ctx.lineTo(headX + headR * .72, headR * .1);
    ctx.stroke();
  }

  if (isRunner) {
    ctx.strokeStyle = hit ? '#ffffff' : '#e8b45c';
    ctx.lineWidth = 1.6 * scale;
    ctx.beginPath();
    ctx.moveTo(-5.5 * scale, -4.8 * scale);
    ctx.lineTo(-.5 * scale, -7.3 * scale);
    ctx.stroke();
  } else if (isTank || isBoss) {
    ctx.fillStyle = hit ? '#ffffff' : isBoss ? '#2c1218' : '#29372e';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.2 * scale;
    ctx.beginPath();
    ctx.roundRect(-3.2 * scale, -10.1 * scale, 8.7 * scale, 4.1 * scale, 1.5 * scale);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-3.2 * scale, 6 * scale, 8.7 * scale, 4.1 * scale, 1.5 * scale);
    ctx.fill();
    ctx.stroke();
  }

  if (isBoss && z.entrance > 0) {
    ctx.strokeStyle = 'rgba(255,210,122,' + (z.entrance * .7).toFixed(3) + ')';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 18 + (1 - z.entrance) * 28, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  if (isBoss || isTank || z.hp < z.maxHp) {
    const bw = isBoss ? z.r * 2.3 : z.r * 1.9;
    const bh = isBoss ? 5 : isTank ? 4 : 3;
    const bx = z.x - bw / 2;
    const by = z.y - z.r - (isBoss ? 16 : 10);
    ctx.fillStyle = 'rgba(0,0,0,.54)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = hit ? '#ffffff' : isBoss ? '#ff8792' : '#ff6d79';
    ctx.fillRect(bx, by, bw * clamp(z.hp / z.maxHp, 0, 1), bh);
  }

  // Floating Elite Badge
  if (z.affix) {
    ctx.save();
    ctx.font = '900 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    let affixGlyph = '★';
    let affixColor = '#ffd27a';
    if (z.affix === 'frost') { affixGlyph = '❄️'; affixColor = '#8ae0ff'; }
    else if (z.affix === 'swift') { affixGlyph = '⚡'; affixColor = '#ffd27a'; }
    else if (z.affix === 'armored') { affixGlyph = '🛡️'; affixColor = '#69b6ff'; }
    ctx.fillStyle = affixColor;
    ctx.fillText(affixGlyph, z.x, z.y - z.r - 12);
    ctx.restore();
  }
}

function drawRoomLighting() {
  const boss = game.zombies.find(z => z.type === 'boss');
  const p = game.player;
  const eco = game.performanceMode;
  const isBlackout = game.blackoutTimer > 0;

  // Ambient darkness keeps sprites readable while letting local lights shape the room.
  ctx.save();
  ctx.beginPath();
  ctx.rect(room.x, room.y, room.w, room.h);
  ctx.clip();
  const ambientDarkness = isBlackout ? (game.blackoutTimer < 1 ? 0.25 + game.blackoutTimer * 0.6 : 0.86) : 0.12;
  ctx.fillStyle = `rgba(0, 4, 2, ${ambientDarkness})`;
  ctx.fillRect(room.x, room.y, room.w, room.h);

  ctx.globalCompositeOperation = 'screen';

  // Three ceiling lights; shut off during blackout
  if (!isBlackout) {
    const lights = eco ? [
      { x: room.x + room.w * .50, y: room.y + 24, r: 110, a: .065 }
    ] : [
      { x: room.x + room.w * .18, y: room.y + 24, r: 105, a: .11 },
      { x: room.x + room.w * .50, y: room.y + 24, r: 120, a: .10 },
      { x: room.x + room.w * .82, y: room.y + 24, r: 105, a: .11 }
    ];
    lights.forEach((light, idx) => {
      let flicker = 1;
      if (!eco && idx === 1) {
        const f = Math.sin(game.roomPhase * 7.4) + Math.sin(game.roomPhase * 17.8) * .45;
        flicker = f > 1.05 ? .38 : f < -1.15 ? .7 : 1;
      }
      const g = ctx.createRadialGradient(light.x, light.y, 4, light.x, light.y, light.r);
      g.addColorStop(0, 'rgba(178,255,197,' + (light.a * 1.8 * flicker).toFixed(3) + ')');
      g.addColorStop(.35, 'rgba(121,242,154,' + (light.a * flicker).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(121,242,154,0)');
      ctx.fillStyle = g;
      ctx.fillRect(light.x - light.r, light.y - 20, light.r * 2, light.r * 1.25);
    });
  }

  // Player tactical visibility:
  if (p) {
    if (isBlackout) {
      // Conical tactical flashlight beam
      const beamDist = eco ? 180 : 230;
      const beamSpread = 0.52;
      const fg = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, beamDist);
      fg.addColorStop(0, 'rgba(255, 248, 220, 0.45)');
      fg.addColorStop(0.35, 'rgba(225, 245, 220, 0.22)');
      fg.addColorStop(0.7, 'rgba(170, 220, 185, 0.08)');
      fg.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.arc(p.x, p.y, beamDist, p.aimAngle - beamSpread, p.aimAngle + beamSpread);
      ctx.closePath();
      ctx.fill();

      // Local halo around the survivor
      const pr = 40 + (p.muzzleFlash > 0 ? 25 : 0);
      const pg = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, pr);
      pg.addColorStop(0, p.muzzleFlash > 0 ? 'rgba(255,219,142,.35)' : 'rgba(255,255,255,.22)');
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const pr = (eco ? 68 : 92) + (p.muzzleFlash > 0 ? (eco ? 22 : 38) : 0);
      const pg = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, pr);
      pg.addColorStop(0, p.muzzleFlash > 0 ? 'rgba(255,219,142,.22)' : 'rgba(121,242,154,.09)');
      pg.addColorStop(.45, p.muzzleFlash > 0 ? 'rgba(255,189,88,.09)' : 'rgba(121,242,154,.035)');
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pg;
      ctx.fillRect(p.x - pr, p.y - pr, pr * 2, pr * 2);
    }
  }

  // Boss changes the room mood with a breathing red emergency light.
  if (boss) {
    const pulse = .10 + (Math.sin(game.roomPhase * 6.5) + 1) * .035;
    const bg = ctx.createRadialGradient(boss.x, boss.y, 12, boss.x, boss.y, 150);
    bg.addColorStop(0, 'rgba(255,109,121,' + (pulse * 1.5).toFixed(3) + ')');
    bg.addColorStop(.45, 'rgba(255,60,80,' + pulse.toFixed(3) + ')');
    bg.addColorStop(1, 'rgba(255,60,80,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(boss.x - 150, boss.y - 150, 300, 300);

    // Corner emergency lamps are disabled in ECO; the boss glow remains.
    if (!eco) {
      const corners = [
        [room.x + 18, room.y + 18],
        [room.x + room.w - 18, room.y + 18]
      ];
      for (const [cx, cy] of corners) {
        const cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 60);
        cg.addColorStop(0, 'rgba(255,85,98,.32)');
        cg.addColorStop(1, 'rgba(255,85,98,0)');
        ctx.fillStyle = cg;
        ctx.fillRect(cx - 60, cy - 60, 120, 120);
      }
    }
  }

  // Slow-moving dust motes catch the light without allocating particles.
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = eco ? 'rgba(196,224,202,.10)' : 'rgba(196,224,202,.16)';
  const dustCount = eco ? 3 : 12;
  for (let i = 0; i < dustCount; i++) {
    const fx = room.x + ((i * 83 + game.roomPhase * (11 + i % 3) * 9) % Math.max(1, room.w));
    const fy = room.y + 18 + ((i * 47 + Math.sin(game.roomPhase * .7 + i) * 24 + 9999) % Math.max(30, room.h - 36));
    const fr = i % 4 === 0 ? 1.2 : .7;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawObstacles() {
  if (!room.obstacles) return;
  for (const obs of room.obstacles) {
    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, .45)';
    ctx.beginPath();
    ctx.roundRect(obs.x - 2, obs.y + 4, obs.w + 4, obs.h + 2, 7);
    ctx.fill();

    // Heavy industrial steel chassis
    const chassisGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x, obs.y + obs.h);
    chassisGrad.addColorStop(0, '#1d2a21');
    chassisGrad.addColorStop(0.4, '#131e17');
    chassisGrad.addColorStop(1, '#0c150f');
    ctx.fillStyle = chassisGrad;
    ctx.strokeStyle = 'rgba(121, 242, 154, .32)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 6);
    ctx.fill();
    ctx.stroke();

    // Top metal cap highlight
    ctx.fillStyle = 'rgba(255, 255, 255, .07)';
    ctx.fillRect(obs.x + 3, obs.y + 2, obs.w - 6, 3);

    // Hazard stripes band across the center
    const bandY = obs.y + Math.round(obs.h * 0.38);
    const bandH = Math.round(obs.h * 0.28);
    ctx.fillStyle = 'rgba(10, 16, 12, .9)';
    ctx.fillRect(obs.x + 4, bandY, obs.w - 8, bandH);

    // Diagonal hazard slashes inside the band
    ctx.save();
    ctx.beginPath();
    ctx.rect(obs.x + 4, bandY, obs.w - 8, bandH);
    ctx.clip();
    ctx.fillStyle = 'rgba(232, 180, 92, .35)';
    for (let hx = obs.x - 6; hx < obs.x + obs.w + 12; hx += 10) {
      ctx.beginPath();
      ctx.moveTo(hx, bandY + bandH);
      ctx.lineTo(hx + 6, bandY);
      ctx.lineTo(hx + 10, bandY);
      ctx.lineTo(hx + 4, bandY + bandH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Glowing status LED indicator
    const ledX = obs.x + obs.w - 8;
    const ledY = obs.y + 7;
    const pulse = 0.55 + Math.sin(game.roomPhase * 4) * 0.35;
    ctx.fillStyle = `rgba(121, 242, 154, ${pulse})`;
    ctx.beginPath();
    ctx.arc(ledX, ledY, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Corner industrial bolts
    ctx.fillStyle = 'rgba(228, 255, 235, .25)';
    const bolts = [
      [obs.x + 4, obs.y + 5],
      [obs.x + 4, obs.y + obs.h - 5],
      [obs.x + obs.w - 4, obs.y + obs.h - 5]
    ];
    for (const [bx, by] of bolts) {
      ctx.fillRect(bx - 1, by - 1, 2, 2);
    }
  }
}

function drawHazards() {
  if (!room.hazards) return;
  const eco = game.performanceMode;
  for (const h of room.hazards) {
    ctx.save();
    ctx.translate(h.x, h.y);

    ctx.fillStyle = '#0b130e';
    ctx.strokeStyle = h.state === 'active' ? '#69b6ff' : (h.state === 'warning' ? '#e8b45c' : 'rgba(84, 118, 93, .35)');
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(0, 0, h.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, .08)';
    ctx.lineWidth = 1.2;
    for (let s = -h.r + 8; s <= h.r - 8; s += 8) {
      const w = Math.sqrt(Math.max(0, h.r * h.r - s * s)) * 0.75;
      ctx.beginPath();
      ctx.moveTo(-w, s);
      ctx.lineTo(w, s);
      ctx.stroke();
    }

    if (h.state === 'dormant') {
      ctx.fillStyle = 'rgba(18, 38, 28, .55)';
      ctx.beginPath();
      ctx.arc(0, 0, h.r * 0.72, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(105, 182, 255, .15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, h.r * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (h.state === 'warning') {
      const pulse = 0.55 + Math.sin(game.elapsed * 12) * 0.35;
      ctx.fillStyle = `rgba(232, 180, 92, ${pulse * 0.3})`;
      ctx.beginPath();
      ctx.arc(0, 0, h.r * 0.85, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(232, 180, 92, ${pulse * 0.8})`;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, h.r * 0.95, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (!eco) {
        ctx.strokeStyle = '#ffe49e';
        ctx.lineWidth = 1.2;
        const ang = game.elapsed * 8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * 6, Math.sin(ang) * 6);
        ctx.lineTo(Math.cos(ang + 0.8) * 16, Math.sin(ang + 0.8) * 16);
        ctx.stroke();
      }
    } else if (h.state === 'active') {
      if (!eco) {
        const glow = ctx.createRadialGradient(0, 0, h.r * 0.2, 0, 0, h.r * 1.35);
        glow.addColorStop(0, 'rgba(105, 182, 255, 0.45)');
        glow.addColorStop(0.6, 'rgba(74, 160, 255, 0.18)');
        glow.addColorStop(1, 'rgba(74, 160, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(-h.r * 1.35, -h.r * 1.35, h.r * 2.7, h.r * 2.7);
      }

      ctx.fillStyle = 'rgba(74, 160, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, h.r * 0.9, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#e5f4ff';
      ctx.lineWidth = 1.6;
      for (let a = 0; a < 4; a++) {
        const a1 = game.elapsed * 10 + a * (Math.PI / 2);
        const a2 = a1 + 0.7;
        const r1 = 5 + Math.sin(game.elapsed * 20 + a) * 8;
        const r2 = h.r * 0.82;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
        ctx.lineTo(Math.cos((a1 + a2) / 2) * (h.r * 0.45), Math.sin((a1 + a2) / 2) * (h.r * 0.45));
        ctx.lineTo(Math.cos(a2) * r2, Math.sin(a2) * r2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
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
    ctx.arc(b.x, b.y, b.r * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = b.isCrit ? '#fffbe8' : (b.pierce > 1 ? '#eaf4ff' : '#ffffff');
    ctx.fill();
  }

  for (const z of game.zombies) drawAttackTelegraph(z);
  for (const z of game.zombies) drawZombie(z);

  const p = game.player;
  if (p) drawPlayer(p);

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
  drawThreatRadar();
  ctx.restore();
}

function drawPickups() {
  if (!game.pickups) return;
  for (const item of game.pickups) {
    const pulse = 1 + Math.sin(item.pulse) * 0.12;
    const isExpiring = item.life < 4;
    if (isExpiring && Math.sin(game.elapsed * 18) > 0.3) {
      continue;
    }

    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.scale(pulse, pulse);

    let strokeColor = '#ff4359';
    let auraColor = 'rgba(255, 67, 89, .22)';
    let icon = '💣';
    if (item.type === 'overdrive') {
      strokeColor = '#69b6ff';
      auraColor = 'rgba(105, 182, 255, .25)';
      icon = '⚡';
    } else if (item.type === 'medkit') {
      strokeColor = '#79f29a';
      auraColor = 'rgba(121, 242, 154, .25)';
      icon = '💊';
    } else if (item.type === 'magnet') {
      strokeColor = '#d782ff';
      auraColor = 'rgba(215, 130, 255, .25)';
      icon = '🧲';
    }

    if (!game.performanceMode) {
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fillStyle = auraColor;
      ctx.fill();
    }

    ctx.fillStyle = '#0f1812';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-9, -9, 18, 18, 4);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 0, 0);

    ctx.restore();
  }
}

function drawThreatRadar() {
  const p = game.player;
  if (!p || !game.running) return;

  const minX = room.x + 14;
  const maxX = room.x + room.w - 14;
  const minY = room.y + 14;
  const maxY = room.y + room.h - 14;

  const threats = [];

  for (const z of game.zombies) {
    const isBoss = z.type === 'boss';
    const isRunner = z.type === 'runner';
    const isTank = z.type === 'tank';

    const isOffscreen = z.x < room.x || z.x > room.x + room.w || z.y < room.y || z.y > room.y + room.h;

    if (isBoss || (isOffscreen && (isRunner || isTank || z.affix))) {
      threats.push(z);
    }
  }

  if (!threats.length) return;

  for (const z of threats) {
    const isBoss = z.type === 'boss';
    const isRunner = z.type === 'runner';

    const dx = z.x - p.x;
    const dy = z.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 30) continue;

    let tMin = Infinity;
    if (dx > 0) tMin = Math.min(tMin, (maxX - p.x) / dx);
    else if (dx < 0) tMin = Math.min(tMin, (minX - p.x) / dx);

    if (dy > 0) tMin = Math.min(tMin, (maxY - p.y) / dy);
    else if (dy < 0) tMin = Math.min(tMin, (minY - p.y) / dy);

    if (tMin >= 1 && !isBoss) continue;

    const edgeX = clamp(p.x + dx * tMin, minX, maxX);
    const edgeY = clamp(p.y + dy * tMin, minY, maxY);
    const angle = Math.atan2(dy, dx);

    const freq = isBoss ? 8 : (isRunner ? 10 : 5);
    const pulse = 0.65 + Math.sin(game.roomPhase * freq) * 0.35;

    ctx.save();
    ctx.translate(edgeX, edgeY);
    ctx.rotate(angle);

    const color = isBoss ? '#ff4359' : (isRunner ? '#e5a84d' : '#7d9c75');
    const glowColor = isBoss ? 'rgba(255, 67, 89, 0.4)' : (isRunner ? 'rgba(229, 168, 77, 0.35)' : 'rgba(125, 156, 117, 0.3)');

    if (!game.performanceMode) {
      ctx.beginPath();
      ctx.arc(0, 0, isBoss ? 16 : 10, 0, Math.PI * 2);
      ctx.fillStyle = glowColor;
      ctx.fill();
    }

    ctx.fillStyle = color;
    ctx.globalAlpha = pulse;

    if (isBoss) {
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-4, -8);
      ctx.lineTo(-1, 0);
      ctx.lineTo(-4, 8);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(-10, -7);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-10, 7);
      ctx.closePath();
      ctx.fill();

      ctx.rotate(-angle);
      ctx.font = '900 8px Inter, ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#ff6174';
      ctx.fillText(t('bossLabel'), 0, -12);
    } else {
      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.lineTo(-4, -5);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fill();

      if (isRunner) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-8, -4.5);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-8, 4.5);
        ctx.closePath();
        ctx.fill();
      }

      if (z.affix) {
        ctx.rotate(-angle);
        ctx.font = '900 8px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        let glyph = '★';
        if (z.affix === 'frost') glyph = '❄️';
        else if (z.affix === 'swift') glyph = '⚡';
        else if (z.affix === 'armored') glyph = '🛡️';
        ctx.fillText(glyph, 0, -8);
      }
    }

    ctx.restore();
  }
}
