import type { Chart } from './chart';
import { colorName } from './pattern';
import type { HatSpec } from './spec';

/** A printable chart in the style of a pattern page: numbered grid plus key. */
export function renderChartPng(chart: Chart, palette: string[], spec: HatSpec): string {
  const cell = Math.max(14, Math.min(28, Math.floor(900 / Math.max(chart.w, chart.h))));
  const pad = 48;
  const gridW = chart.w * cell;
  const gridH = chart.h * cell;
  const keyW = 220;
  const W = pad * 2 + gridW + 40 + keyW;
  const H = Math.max(pad * 2 + 70 + gridH + 30, 420);
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const ctx = c.getContext('2d')!;
  ctx.scale(2, 2);
  ctx.fillStyle = '#fffdf9';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#2b2522';
  ctx.font = '600 22px Fraunces, Georgia, serif';
  ctx.fillText(`${spec.size.name} chart — ${spec.type.name}`, pad, pad + 4);
  ctx.font = '13px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#6b625c';
  const repeatTxt = spec.repeats > 1 ? `${spec.repeats} repeats around` : 'worked once, centred on the front';
  ctx.fillText(`${chart.w} sts × ${chart.h} rounds · ${repeatTxt} · ${spec.bodySts} sts in the body`, pad, pad + 26);

  const gx = pad;
  const gy = pad + 60;
  for (let y = 0; y < chart.h; y++)
    for (let x = 0; x < chart.w; x++) {
      ctx.fillStyle = palette[chart.cells[y * chart.w + x]] ?? palette[0];
      ctx.fillRect(gx + x * cell, gy + y * cell, cell, cell);
    }
  ctx.strokeStyle = 'rgba(40,30,25,0.35)';
  ctx.lineWidth = 0.6;
  for (let x = 0; x <= chart.w; x++) {
    ctx.lineWidth = x % 5 === 0 || x === chart.w ? 1.1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(gx + x * cell, gy);
    ctx.lineTo(gx + x * cell, gy + gridH);
    ctx.stroke();
  }
  for (let y = 0; y <= chart.h; y++) {
    ctx.lineWidth = (chart.h - y) % 5 === 0 ? 1.1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(gx, gy + y * cell);
    ctx.lineTo(gx + gridW, gy + y * cell);
    ctx.stroke();
  }

  ctx.fillStyle = '#6b625c';
  ctx.font = `${Math.min(11, cell * 0.55)}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  for (let y = 0; y < chart.h; y++) ctx.fillText(String(chart.h - y), gx + gridW + 6, gy + y * cell + cell / 2);
  ctx.textAlign = 'center';
  for (let x = 0; x < chart.w; x++) ctx.fillText(String(chart.w - x), gx + x * cell + cell / 2, gy + gridH + 12);

  const kx = gx + gridW + 48;
  let ky = gy;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2b2522';
  ctx.font = '600 15px Fraunces, Georgia, serif';
  ctx.fillText('KEY', kx, ky + 6);
  ky += 28;
  ctx.font = '13px Inter, system-ui, sans-serif';
  palette.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(kx, ky, 18, 18);
    ctx.strokeStyle = 'rgba(40,30,25,0.5)';
    ctx.strokeRect(kx + 0.5, ky + 0.5, 17, 17);
    ctx.fillStyle = '#2b2522';
    ctx.fillText(`${colorName(i)}  ${col.toUpperCase()}`, kx + 28, ky + 9);
    ky += 28;
  });
  ky += 12;
  ctx.fillStyle = '#6b625c';
  const notes = [
    'Read every round right to left.',
    spec.type.construction === 'top-down' ? 'Top-down: work from the top row down.' : 'Work from round 1 (bottom) up.',
    `Crown: ${spec.crown.rows} rounds, ${spec.crown.visualSections} sections.`,
  ];
  for (const n of notes) {
    ctx.fillText(n, kx, ky);
    ky += 20;
  }
  return c.toDataURL('image/png');
}

export function download(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
