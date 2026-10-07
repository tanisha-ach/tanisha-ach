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
  const keyH = 60 + 40 + palette.length * 28 + 72 + 40 + spec.crown.rows * 10 + 40;
  const H = Math.max(pad * 2 + 70 + gridH + 30, pad + keyH);
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
  drawCrownSection(ctx, spec, kx, ky + 12, keyW + 10, H - ky - pad);
  return c.toDataURL('image/png');
}

type Mark = '/' | '\\' | '+';

/** Stitch widths and shaping symbols for one crown section, listed bottom (body side) to top. */
export function crownSectionRows(spec: HatSpec): { w: number; marks: [number, Mark][] }[] {
  const { crown, type } = spec;
  const style = type.crown;
  const shaping = new Set(crown.shapingRows);
  const rows: { w: number; marks: [number, Mark][] }[] = [];
  if (style.kind === 'top-down') {
    const per = crown.endSts / crown.visualSections;
    let w = per;
    const order: { w: number; marks: [number, Mark][] }[] = [];
    for (let i = 0; i < crown.rows; i++) {
      const marks: [number, Mark][] = [];
      if (i === 0) {
        w *= 2;
        for (let x = 0; x < w; x += 2) marks.push([x, '+']);
      } else if (shaping.has(i)) {
        w += 2;
        marks.push([1, '+'], [w - 2, '+']);
      }
      order.push({ w, marks });
    }
    return order.reverse();
  }
  let w = crown.sts / crown.visualSections;
  const end = crown.endSts / crown.visualSections;
  for (let i = 0; i < crown.rows; i++) {
    const marks: [number, Mark][] = [];
    if (shaping.has(i)) {
      if (style.kind === 'wedge') {
        w -= 1;
        marks.push([w - 1, '/']);
      } else if (style.kind === 'paired') {
        w -= 2;
        marks.push([style.border, '\\'], [w - 1 - style.border, '/']);
      }
    } else if (i === crown.rows - 1 && w > end) {
      w = end;
      marks.push([Math.floor(w / 2), '/']);
    }
    rows.push({ w, marks });
  }
  return rows;
}

function drawCrownSection(ctx: CanvasRenderingContext2D, spec: HatSpec, x: number, y: number, maxW: number, maxH: number) {
  const rows = crownSectionRows(spec);
  const widest = Math.max(...rows.map((r) => r.w));
  const cell = Math.max(4, Math.min(16, Math.floor((maxW - 40) / widest), Math.floor((maxH - 70) / rows.length)));
  ctx.fillStyle = '#2b2522';
  ctx.font = '600 15px Fraunces, Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(`CROWN — 1 of ${spec.crown.visualSections} sections`, x, y + 4);
  const top = y + 22;
  const mc = '#f3ebdd';
  rows.forEach((r, i) => {
    const ry = top + (rows.length - 1 - i) * cell;
    const ox = x + ((widest - r.w) * cell) / 2;
    for (let c = 0; c < r.w; c++) {
      ctx.fillStyle = mc;
      ctx.fillRect(ox + c * cell, ry, cell, cell);
      ctx.strokeStyle = 'rgba(40,30,25,0.3)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(ox + c * cell, ry, cell, cell);
    }
    ctx.strokeStyle = '#2b2522';
    ctx.lineWidth = 1.2;
    for (const [c, m] of r.marks) {
      const cx = ox + c * cell;
      ctx.beginPath();
      if (m === '/') {
        ctx.moveTo(cx + cell * 0.2, ry + cell * 0.8);
        ctx.lineTo(cx + cell * 0.8, ry + cell * 0.2);
      } else if (m === '\\') {
        ctx.moveTo(cx + cell * 0.2, ry + cell * 0.2);
        ctx.lineTo(cx + cell * 0.8, ry + cell * 0.8);
      } else {
        ctx.moveTo(cx + cell * 0.5, ry + cell * 0.2);
        ctx.lineTo(cx + cell * 0.5, ry + cell * 0.8);
        ctx.moveTo(cx + cell * 0.2, ry + cell * 0.5);
        ctx.lineTo(cx + cell * 0.8, ry + cell * 0.5);
      }
      ctx.stroke();
    }
  });
  const ly = top + rows.length * cell + 18;
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#6b625c';
  const legend =
    spec.type.crown.kind === 'top-down'
      ? '+ increase (kfb, RLI or LLI)'
      : spec.type.crown.kind === 'wedge'
        ? '/ k2tog'
        : '\\ ssk    / k2tog';
  ctx.fillText(legend, x, ly);
}

export function download(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
