import { ctx, game, room, viewport } from './state.js';
import { clamp, rand } from './utils.js';
import { t } from './i18n.js';

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
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.radius);
      g.addColorStop(0, d.color.replace('0.24', '0.34'));
      g.addColorStop(.7, d.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
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
  const blink = p.invuln > 0 && Math.floor(p.invuln * 18) % 2 === 0;
  if (blink) return;

  const bob = p.moving ? Math.sin(p.walkTime * 2) * 1.15 : Math.sin(p.walkTime) * .25;
  const stride = p.moving ? Math.sin(p.walkTime * 2) * 2.35 : 0;
  const recoil = p.recoil * 2.4;
  const hurt = p.invuln > 0;

  // Ground readability: shadow + subtle survivor ring.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1, .58);
  ctx.beginPath();
  ctx.arc(0, 8, 18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.34)';
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r + 8, 0, Math.PI * 2);
  ctx.strokeStyle = hurt ? 'rgba(255,101,118,.34)' : 'rgba(121,242,154,.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

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
  ctx.fillStyle = hurt ? '#ffd9dd' : '#dfe9e2';
  ctx.strokeStyle = '#07100b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-1, 0, 9.7, 10.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = hurt ? '#ff7d89' : '#79f29a';
  ctx.beginPath();
  ctx.ellipse(-1.5, -7.4, 5.8, 2.2, -.12, 0, Math.PI * 2);
  ctx.fill();

  // Head / hair: oversized slightly for mobile readability.
  ctx.fillStyle = '#efc59e';
  ctx.strokeStyle = '#07100b';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(5.2, 0, 6.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#202820';
  ctx.beginPath();
  ctx.arc(4.3, 0, 6.25, Math.PI * .62, Math.PI * 1.38);
  ctx.lineTo(5.8, 0);
  ctx.closePath();
  ctx.fill();

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
    ctx.save();
    ctx.translate(27, 0);
    ctx.scale(flash, flash);
    ctx.fillStyle = '#fff4b8';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(8, -3.5);
    ctx.lineTo(6.2, 0);
    ctx.lineTo(8, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffbd58';
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.lineTo(5.4, -1.7);
    ctx.lineTo(4.2, 0);
    ctx.lineTo(5.4, 1.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawZombie(z) {
  const isRunner = z.type === 'runner';
  const isTank = z.type === 'tank';
  const isBoss = z.type === 'boss';
  const scale = isBoss ? 1.95 : z.r / 13;
  const bobAmp = isBoss ? 1.4 : isRunner ? 1.35 : isTank ? .55 : .9;
  const strideAmp = isBoss ? 2.8 : isRunner ? 3.15 : isTank ? 1.75 : 2.35;
  const bob = Math.sin(z.walkTime * 2) * bobAmp;
  const stride = Math.sin(z.walkTime * 2) * strideAmp;
  const attackBase = isBoss ? .24 : .18;
  const attackPhase = z.attackFlash > 0 ? Math.sin((z.attackFlash / attackBase) * Math.PI) : 0;
  const lunge = attackPhase * (isBoss ? 5.4 : isTank ? 4.4 : 3.2);
  const hit = z.hitFlash > 0;

  const outfit = isBoss ? '#4d262f' : isTank ? '#53685a' : isRunner ? '#b6813d' : '#678a62';
  const outfitDark = isBoss ? '#291117' : isTank ? '#334239' : isRunner ? '#6f4c24' : '#3d573d';
  const skin = hit ? '#ffffff' : isBoss ? '#b7a1a7' : isTank ? '#a8b49b' : '#a7bc98';
  const accent = hit ? '#ffffff' : isBoss ? '#ff8a96' : isTank ? '#a9c2ae' : isRunner ? '#e8b45c' : '#8bc57e';
  const outline = '#050806';

  ctx.save();
  ctx.translate(z.x, z.y);
  ctx.scale(1, .56);
  ctx.beginPath();
  ctx.arc(0, 7 * scale, z.r * (isBoss ? 1.26 : 1.18), 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.30)';
  ctx.fill();
  ctx.restore();

  const ringPulse = isBoss ? 6 + Math.sin((z.pulse || 0) * 2) * 2.5 : isTank ? 5 : 4;
  ctx.beginPath();
  ctx.arc(z.x, z.y, z.r + ringPulse, 0, Math.PI * 2);
  ctx.strokeStyle = hit ? 'rgba(255,255,255,.42)' : isBoss ? 'rgba(255,109,121,.22)' : isTank ? 'rgba(255,109,121,.16)' : 'rgba(174,205,164,.11)';
  ctx.lineWidth = isBoss ? 2.5 : isTank ? 2 : 1.5;
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

  ctx.fillStyle = hit ? '#5f6560' : isBoss ? '#34151c' : '#1d271f';
  const eyeX = headX + headR * .38;
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
}

function drawRoomLighting() {
  const boss = game.zombies.find(z => z.type === 'boss');
  const p = game.player;
  const eco = game.performanceMode;

  // Ambient darkness keeps sprites readable while letting local lights shape the room.
  ctx.save();
  ctx.beginPath();
  ctx.rect(room.x, room.y, room.w, room.h);
  ctx.clip();
  ctx.fillStyle = 'rgba(0, 4, 2, .12)';
  ctx.fillRect(room.x, room.y, room.w, room.h);

  ctx.globalCompositeOperation = 'screen';

  // Three ceiling lights; the middle unit flickers occasionally.
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

  // Player gets a restrained local visibility pool; muzzle flash briefly warms the area.
  if (p) {
    const pr = (eco ? 68 : 92) + (p.muzzleFlash > 0 ? (eco ? 22 : 38) : 0);
    const pg = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, pr);
    pg.addColorStop(0, p.muzzleFlash > 0 ? 'rgba(255,219,142,.22)' : 'rgba(121,242,154,.09)');
    pg.addColorStop(.45, p.muzzleFlash > 0 ? 'rgba(255,189,88,.09)' : 'rgba(121,242,154,.035)');
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(p.x - pr, p.y - pr, pr * 2, pr * 2);
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

  for (const b of game.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220,255,229,.12)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = '#e7ffec';
    ctx.fill();
  }

  for (const z of game.zombies) drawZombie(z);

  const p = game.player;
  if (p) drawPlayer(p);

  for (const q of game.particles) {
    ctx.globalAlpha = clamp(q.life / q.maxLife, 0, 1);
    ctx.fillStyle = q.color;
    if (q.shape === 'dot') {
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.size * .5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
  }
  ctx.globalAlpha = 1;
  drawRoomLighting();
  ctx.restore();
}
