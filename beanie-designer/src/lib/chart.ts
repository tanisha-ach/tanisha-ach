export interface Chart {
  w: number;
  h: number;
  /** Palette indices, row-major, row 0 = top row of the chart. */
  cells: number[];
}

export const makeChart = (w: number, h: number, fill = 0): Chart => ({ w, h, cells: new Array(w * h).fill(fill) });

export const chartFromRows = (rows: string[], key: Record<string, number> = { '.': 0, '#': 1, o: 2 }): Chart => {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const cells: number[] = [];
  for (const row of rows) for (let x = 0; x < w; x++) cells.push(key[row[x] ?? '.'] ?? 0);
  return { w, h, cells };
};

export function resizeChart(c: Chart, w: number, h: number): Chart {
  const out = makeChart(w, h);
  // Keep the chart anchored bottom-centre, the way knitters read it.
  const dx = Math.floor((w - c.w) / 2);
  const dy = h - c.h;
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) out.cells[ny * w + nx] = c.cells[y * c.w + x];
    }
  return out;
}

export function shiftChart(c: Chart, dx: number, dy: number): Chart {
  const out = makeChart(c.w, c.h);
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      const sx = (x - dx + c.w) % c.w;
      const sy = (y - dy + c.h) % c.h;
      out.cells[y * c.w + x] = c.cells[sy * c.w + sx];
    }
  return out;
}

export const flipChart = (c: Chart): Chart => {
  const out = makeChart(c.w, c.h);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) out.cells[y * c.w + x] = c.cells[y * c.w + (c.w - 1 - x)];
  return out;
};

export function floodFill(c: Chart, x: number, y: number, color: number): Chart {
  const target = c.cells[y * c.w + x];
  if (target === color) return c;
  const cells = c.cells.slice();
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= c.w || cy >= c.h) continue;
    const i = cy * c.w + cx;
    if (cells[i] !== target) continue;
    cells[i] = color;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return { ...c, cells };
}

/** Longest run of one colour in any chart row — long floats need catching. */
export function longestFloat(c: Chart): number {
  let best = 0;
  for (let y = 0; y < c.h; y++) {
    const row = c.cells.slice(y * c.w, y * c.w + c.w);
    if (new Set(row).size < 2) continue;
    // Rows wrap around the hat, so scan the row twice.
    let run = 1;
    for (let x = 1; x < c.w * 2; x++) {
      run = row[x % c.w] === row[(x - 1) % c.w] ? run + 1 : 1;
      best = Math.max(best, Math.min(run, c.w));
    }
  }
  return best;
}
