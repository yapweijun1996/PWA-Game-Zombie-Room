// Draws a shareable run summary card (PNG) from the values the defeat screen shows.
const WIDTH = 1080;
const HEIGHT = 1350;
const FONT = 'Inter, ui-sans-serif, system-ui, sans-serif';

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function fitText(ctx, text, maxWidth, size, weight = 900) {
  let current = size;
  ctx.font = `${weight} ${current}px ${FONT}`;
  while (current > 18 && ctx.measureText(text).width > maxWidth) {
    current -= 2;
    ctx.font = `${weight} ${current}px ${FONT}`;
  }
}

// card: { title, rank, score, stats: [{ label, value }], build: [string], cause, url }
export function drawShareCard(card) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');

  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, '#0b1a10');
  background.addColorStop(1, '#040806');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = 'rgba(121, 242, 154, .07)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= WIDTH; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
  for (let y = 0; y <= HEIGHT; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#79f29a';
  ctx.font = `950 54px ${FONT}`;
  ctx.fillText('🧟 ZOMBIE ROOM', WIDTH / 2, 120);
  ctx.fillStyle = '#ffffff';
  fitText(ctx, card.title, WIDTH - 160, 96, 950);
  ctx.fillText(card.title, WIDTH / 2, 240);

  ctx.fillStyle = '#86efac';
  ctx.font = `950 190px ${FONT}`;
  ctx.fillText(String(card.score), WIDTH / 2, 420);

  roundedRect(ctx, WIDTH / 2 - 260, 540, 520, 84, 42);
  ctx.fillStyle = 'rgba(255, 214, 102, .14)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 214, 102, .7)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ffe39a';
  fitText(ctx, card.rank, 480, 44, 950);
  ctx.fillText(card.rank, WIDTH / 2, 584);

  const columnWidth = (WIDTH - 160) / card.stats.length;
  card.stats.forEach((stat, index) => {
    const x = 80 + columnWidth * (index + .5);
    ctx.fillStyle = '#ffffff';
    ctx.font = `950 64px ${FONT}`;
    ctx.fillText(String(stat.value), x, 720);
    ctx.fillStyle = 'rgba(236, 246, 239, .62)';
    fitText(ctx, stat.label.toUpperCase(), columnWidth - 16, 26, 800);
    ctx.fillText(stat.label.toUpperCase(), x, 778);
  });

  if (card.cause) {
    ctx.fillStyle = '#ffb4bd';
    card.cause.split('\n').slice(0, 2).forEach((line, index) => {
      fitText(ctx, line, WIDTH - 160, 34, 800);
      ctx.fillText(line, WIDTH / 2, 860 + index * 48);
    });
  }

  ctx.fillStyle = '#a8d7ef';
  const buildLines = [];
  let line = '';
  ctx.font = `800 32px ${FONT}`;
  for (const item of card.build.slice(0, 9)) {
    const next = line ? line + '  ·  ' + item : item;
    if (ctx.measureText(next).width > WIDTH - 160 && line) { buildLines.push(line); line = item; }
    else line = next;
  }
  if (line) buildLines.push(line);
  buildLines.slice(0, 3).forEach((text, index) => ctx.fillText(text, WIDTH / 2, 1000 + index * 50));

  ctx.fillStyle = 'rgba(236, 246, 239, .55)';
  ctx.font = `800 28px ${FONT}`;
  ctx.fillText(card.url, WIDTH / 2, HEIGHT - 80);
  return canvas;
}

export function shareCardBlob(card) {
  return new Promise(resolve => drawShareCard(card).toBlob(resolve, 'image/png'));
}
