import { ctx, game, room } from './state.js';
import { clamp } from './utils.js';
import { getSpitEndpoint, SPITTER_CONFIG } from './ranged-combat.js';

export function drawPlayer(p) {
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

export function drawAttackTelegraph(z) {
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

export function drawSpitter(z) {
  ctx.save();
  ctx.translate(z.x, z.y);
  ctx.rotate(z.spit?.state === 'windup' ? Math.atan2(z.spit.directionY, z.spit.directionX) : z.facing);
  const color = z.hitFlash > 0 ? '#ffffff' : '#9345a9';
  ctx.fillStyle = '#41224b';
  ctx.strokeStyle = '#180e1c';
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-8, side * 9, 8, 4, side * 0.3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.strokeStyle = '#27142e';
  ctx.beginPath();
  ctx.ellipse(-3, 0, 11, 12, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#f9d8ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(z.r + 4, 0);
  ctx.lineTo(-z.r, -z.r);
  ctx.lineTo(-z.r * 0.55, 0);
  ctx.lineTo(-z.r, z.r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(1, -6, 4, 3);
  ctx.fillRect(1, 3, 4, 3);
  if (z.spit?.state === 'windup') {
    ctx.strokeStyle = '#ffd479';
    ctx.beginPath();
    ctx.arc(0, 0, z.r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - z.spit.timer / SPITTER_CONFIG.windup));
    ctx.stroke();
  }
  ctx.restore();
}

export function drawRangedThreats() {
  ctx.save();
  ctx.beginPath();
  ctx.rect(room.x, room.y, room.w, room.h);
  ctx.clip();
  // Draw after room lighting: visibility of incoming attacks is part of the combat contract.
  for (const z of game.zombies) {
    if (z.spit?.state !== 'windup') continue;
    ctx.save();
    ctx.strokeStyle = '#140b1b';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(z.x, z.y);
    const end = getSpitEndpoint(z, room);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.strokeStyle = '#f9c7ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.stroke();
    ctx.restore();
  }
  for (const b of game.enemyProjectiles) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = '#f18bff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(b.r + 3, 0);
    ctx.lineTo(0, -b.r);
    ctx.lineTo(-b.r - 3, 0);
    ctx.lineTo(0, b.r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export function drawZombie(z) {
  if (z.type === 'spitter') { drawSpitter(z); return; }
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
