import { ctx, game, room, viewport } from './state.js';
import { clamp } from './utils.js';
import { t } from './i18n.js';

export function drawGrid() {
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

export function drawRoomLighting() {
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

export function drawObstacles() {
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

export function drawHazards() {
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
