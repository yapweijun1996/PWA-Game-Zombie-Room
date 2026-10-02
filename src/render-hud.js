import { ctx, game, room } from './state.js';
import { clamp } from './utils.js';
import { t } from './i18n.js';

export function drawPickups() {
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

export function drawThreatRadar() {
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

    if (isBoss || (isOffscreen && (isRunner || isTank || z.type === 'spitter' || z.affix))) {
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
