import type { Chart } from './chart';
import { bodyCell, type HatSpec, type Placement } from './spec';

export type StitchKind = 'knit' | 'purl' | 'slip';

function parseColor(css: string): [number, number, number] {
  if (css.startsWith('#')) {
    const n = parseInt(css.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const [r, g, b] = css.match(/\d+/g)!.map(Number);
  return [r, g, b];
}

/** Lighten (amt > 0) or darken (amt < 0) a #hex or rgb() colour. */
export function shade(css: string, amt: number): string {
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const [r, g, b] = parseColor(css).map(f);
  return `rgb(${r},${g},${b})`;
}

const spriteCache = new Map<string, HTMLCanvasElement>();

/**
 * One stitch as a small sprite. `color === null` draws the height map used
 * for the bump texture instead of the colour map.
 */
function sprite(kind: StitchKind, color: string | null, w: number, h: number, flip: boolean, lean = 0): HTMLCanvasElement {
  const key = `${kind}|${color}|${w}|${h}|${flip}|${lean}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, w);
  cv.height = Math.max(1, h);
  const ctx = cv.getContext('2d')!;
  const bump = color === null;
  ctx.fillStyle = bump ? '#262626' : shade(color, kind === 'purl' ? -0.28 : -0.42);
  ctx.fillRect(0, 0, w, h);

  if (kind === 'purl') {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
    g.addColorStop(0, bump ? '#8a8a8a' : shade(color, 0.04));
    g.addColorStop(1, bump ? '#3a3a3a' : shade(color, -0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.5, w * 0.52, h * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.save();
    if (flip) {
      ctx.translate(0, h);
      ctx.scale(1, -1);
    }
    if (lean) {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(lean);
      ctx.translate(-w / 2, -h / 2);
    }
    const hi = kind === 'slip' ? 0.16 : 0.1;
    for (const side of [-1, 1]) {
      const cx = w / 2 + side * w * 0.22;
      const g = ctx.createRadialGradient(cx, h * 0.45, 0, cx, h * 0.5, Math.max(w, h) * 0.55);
      g.addColorStop(0, bump ? '#f2f2f2' : shade(color, hi));
      g.addColorStop(0.6, bump ? '#b4b4b4' : color);
      g.addColorStop(1, bump ? '#555' : shade(color, -0.25));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, h * 0.5, w * 0.27, h * 0.66, side * -0.62, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  spriteCache.set(key, cv);
  if (spriteCache.size > 4000) spriteCache.clear();
  return cv;
}

function canvasPair(w: number, h: number) {
  const make = () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  return { color: make(), bump: make() };
}

function cellWidth(sts: number) {
  return Math.max(6, Math.min(18, Math.floor(4096 / sts)));
}

/** Body + crown texture. Canvas bottom = first body round, top = crown tip. */
export function drawBody(
  target: { color: HTMLCanvasElement; bump: HTMLCanvasElement } | null,
  spec: HatSpec,
  chart: Chart,
  palette: string[],
  placement: Placement,
  tile: boolean,
) {
  const N = spec.bodySts;
  const cw = cellWidth(N);
  // Square pixels per inch keep stitches at their true width:height ratio.
  const pxPerIn = spec.stsPerIn * cw;
  const W = N * cw;
  const H = Math.min(4096, Math.round((spec.bodyIn + spec.crownIn) * pxPerIn));
  const scale = H / ((spec.bodyIn + spec.crownIn) * pxPerIn);
  const out = target && target.color.width === W && target.color.height === H ? target : canvasPair(W, H);
  const c = out.color.getContext('2d')!;
  const b = out.bump.getContext('2d')!;
  const flip = spec.type.construction === 'top-down';
  const bodyPx = spec.bodyIn * pxPerIn * scale;
  const mc = palette[0];

  const rowY = (i: number, n: number, span: number, base: number) => {
    const y0 = Math.round(base - ((i + 1) * span) / n);
    const y1 = Math.round(base - (i * span) / n);
    return [y0, Math.max(1, y1 - y0)] as const;
  };

  for (let r = 0; r < spec.bodyRows; r++) {
    const [y, h] = rowY(r, spec.bodyRows, bodyPx, H);
    for (let col = 0; col < N; col++) {
      const idx = bodyCell(spec, chart, placement, tile, col, r);
      const color = palette[idx] ?? mc;
      c.drawImage(sprite('knit', color, cw, h, flip), col * cw, y);
      b.drawImage(sprite('knit', null, cw, h, flip), col * cw, y);
    }
  }

  const { crown } = spec;
  const crownPx = H - bodyPx;
  const secW = N / crown.visualSections;
  const markCols = new Map<number, number>();
  for (let s = 0; s < crown.visualSections; s++) {
    const start = Math.round(s * secW);
    const end = Math.round((s + 1) * secW);
    for (const m of crown.marks) {
      const col = m.offset >= 0 ? start + m.offset : end + m.offset;
      markCols.set(((col % N) + N) % N, m.lean === 'left' ? -0.32 : 0.32);
    }
  }
  const shaping = new Set(crown.shapingRows);
  for (let i = 0; i < crown.rows; i++) {
    const fromBottom = flip ? crown.rows - 1 - i : i;
    const [y, h] = rowY(fromBottom, crown.rows, crownPx, H - bodyPx);
    for (let col = 0; col < N; col++) {
      const lean = markCols.get(col);
      const isMark = lean !== undefined && shaping.has(i);
      const color = lean !== undefined ? shade(mc, isMark ? -0.12 : -0.05) : mc;
      const sp = sprite('knit', color, cw, h, flip, isMark ? lean : 0);
      c.drawImage(sp, col * cw, y);
      b.drawImage(sprite('knit', null, cw, h, flip, isMark ? lean : 0), col * cw, y);
    }
  }
  return out;
}

/** One inch of rib (or plain purl) around the full circumference, tiled vertically on the mesh. */
export function drawRib(sts: number, rowsPerIn: number, rib: string, color: string) {
  const cw = cellWidth(sts);
  let rows = Math.max(2, Math.round(rowsPerIn));
  if (rib.includes('S') && rows % 2) rows += 1;
  const rh = Math.max(4, Math.round(cw * 0.8));
  const out = canvasPair(sts * cw, rows * rh);
  const c = out.color.getContext('2d')!;
  const b = out.bump.getContext('2d')!;
  for (let r = 0; r < rows; r++) {
    const y = (rows - 1 - r) * rh;
    for (let col = 0; col < sts; col++) {
      const k = rib[col % rib.length];
      if (k === 'S') {
        if (r % 2 === 0) {
          c.drawImage(sprite('slip', color, cw, rh * 2, false), col * cw, y - rh);
          b.drawImage(sprite('slip', null, cw, rh * 2, false), col * cw, y - rh);
        }
        continue;
      }
      const kind: StitchKind = k === 'P' ? 'purl' : 'knit';
      const col2 = kind === 'purl' && rib.length > 1 ? shade(color, -0.06) : color;
      c.drawImage(sprite(kind, col2, cw, rh, false), col * cw, y);
      b.drawImage(sprite(kind, null, cw, rh, false), col * cw, y);
    }
  }
  if (rib.length > 1) {
    // Purl columns sit behind the knit ribs.
    b.globalCompositeOperation = 'multiply';
    for (let col = 0; col < sts; col++) {
      if (rib[col % rib.length] !== 'P') continue;
      b.fillStyle = '#5a5a5a';
      b.fillRect(col * cw, 0, cw, rows * rh);
    }
    b.globalCompositeOperation = 'source-over';
  }
  return { ...out, rowsPerInch: rows };
}
