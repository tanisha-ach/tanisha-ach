export interface QuantizeOptions {
  colors: number;
  /** 0–255 luminance cut-off, used when colors === 2 and mode is 'threshold'. */
  threshold: number;
  mode: 'threshold' | 'cluster';
  invert: boolean;
  /** Map to these colours instead of returning the image's own colours. */
  palette?: string[];
}

export interface QuantizeResult {
  cells: number[];
  palette: string[];
}

type RGB = [number, number, number];
const lum = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const hexToRgb = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = ([r, g, b]: RGB) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const dist = (a: RGB, b: RGB) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Downsample in halving steps so thin lines survive the reduction. */
export function sampleImage(img: HTMLImageElement, w: number, h: number): RGB[] {
  let src: CanvasImageSource = img;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  while (sw / 2 > w * 2 && sh / 2 > h * 2) {
    const c = document.createElement('canvas');
    c.width = Math.round(sw / 2);
    c.height = Math.round(sh / 2);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, c.width, c.height);
    src = c;
    sw = c.width;
    sh = c.height;
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const out: RGB[] = [];
  for (let i = 0; i < w * h; i++) out.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
  return out;
}

export function otsuThreshold(px: RGB[]): number {
  const hist = new Array(256).fill(0);
  for (const p of px) hist[Math.round(lum(p))]++;
  const total = px.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let t = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB || wB === total) continue;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / (total - wB);
    const between = wB * (total - wB) * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      t = i;
    }
  }
  return t;
}

function kmeans(px: RGB[], k: number): RGB[] {
  // Farthest-point seeding keeps the result deterministic and picks out accent colours.
  const centers: RGB[] = [px.reduce((a, b) => (lum(a) > lum(b) ? a : b))];
  while (centers.length < k) {
    let far = px[0];
    let farD = -1;
    for (const p of px) {
      const d = Math.min(...centers.map((c) => dist(c, p)));
      if (d > farD) {
        farD = d;
        far = p;
      }
    }
    centers.push([...far] as RGB);
  }
  for (let it = 0; it < 12; it++) {
    const acc = centers.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      let bi = 0;
      for (let i = 1; i < k; i++) if (dist(p, centers[i]) < dist(p, centers[bi])) bi = i;
      acc[bi][0] += p[0];
      acc[bi][1] += p[1];
      acc[bi][2] += p[2];
      acc[bi][3]++;
    }
    acc.forEach((a, i) => {
      if (a[3]) centers[i] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
    });
  }
  return centers;
}

export function quantize(px: RGB[], o: QuantizeOptions): QuantizeResult {
  if (o.colors <= 2 && o.mode === 'threshold') {
    const cells = px.map((p) => (lum(p) < o.threshold !== o.invert ? 1 : 0));
    const palette = o.palette?.slice(0, 2) ?? ['#f3ebdd', '#2f3b52'];
    return { cells, palette };
  }
  // Lightest cluster becomes the main colour.
  let centers = kmeans(px, o.colors).sort((a, b) => lum(b) - lum(a));
  if (o.invert) centers = centers.reverse();
  if (o.palette) {
    // Match clusters to the user's colours by lightness rank.
    const pal = o.palette.slice(0, o.colors).map(hexToRgb);
    const order = pal.map((c, i) => ({ c, i })).sort((a, b) => lum(b.c) - lum(a.c));
    if (o.invert) order.reverse();
    const palette = o.palette.slice();
    const idxOf = centers.map((_, i) => order[Math.min(i, order.length - 1)].i);
    const cells = px.map((p) => {
      let bi = 0;
      for (let i = 1; i < centers.length; i++) if (dist(p, centers[i]) < dist(p, centers[bi])) bi = i;
      return idxOf[bi];
    });
    return { cells, palette };
  }
  const cells = px.map((p) => {
    let bi = 0;
    for (let i = 1; i < centers.length; i++) if (dist(p, centers[i]) < dist(p, centers[bi])) bi = i;
    return bi;
  });
  return { cells, palette: centers.map(rgbToHex) };
}
