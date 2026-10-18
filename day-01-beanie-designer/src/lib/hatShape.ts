import * as THREE from 'three';
import { ribRelief } from './rib';
import type { HatSpec } from './spec';

type Pt = [number, number];

export interface HatShape {
  /** Worn radius at the body, inches (the hat stretched onto its head size). */
  R: number;
  /** Vertical shrink from that stretch, applied to knitted lengths. */
  k: number;
  body: THREE.BufferGeometry;
  brims: { geo: THREE.BufferGeometry; purl?: boolean }[];
  /** Pom-pom centre and radius. */
  pom: THREE.Vector3;
  pomR: number;
  bounds: THREE.Box3;
  /** Slouch angle in radians, for reporting. */
  slouch: number;
}

/** Resample a polyline (r, y) to evenly spaced points so lathe v ∝ arc length. */
function resample(pts: Pt[], n: number): { points: THREE.Vector2[]; length: number } {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  const out: THREE.Vector2[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = (i / (n - 1)) * L;
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const t = (d - cum[j]) / (cum[j + 1] - cum[j] || 1);
    out.push(new THREE.Vector2(pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t));
  }
  return { points: out, length: L };
}

/** Superellipse crown: n < 2 is slightly peaked, n > 2 blunter and squarer. */
function domePoint(a: number, b: number, th: number, n: number): Pt {
  const c = Math.cos(th);
  const s = Math.sin(th);
  return [a * Math.sign(c) * Math.abs(c) ** (2 / n), b * Math.abs(s) ** (2 / n)];
}

function domeArc(a: number, b: number, n: number) {
  let L = 0;
  let prev = domePoint(a, b, 0, n);
  for (let i = 1; i <= 96; i++) {
    const p = domePoint(a, b, (i / 96) * (Math.PI / 2), n);
    L += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return L;
}

/** Dome height whose arc matches the given fabric length. */
function solveDome(a: number, arc: number, n: number) {
  let lo = 0.08 * a;
  let hi = 4 * a;
  if (domeArc(a, lo, n) >= arc) return lo;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (domeArc(a, mid, n) < arc) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

/** Lathe normals are split at the seam; average each pair so the back has no visible line. */
function weldSeam(g: THREE.BufferGeometry, rows: number, segments: number) {
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let j = 0; j < rows; j++) {
    const a = j;
    const b = segments * rows + j;
    const x = n.getX(a) + n.getX(b);
    const y = n.getY(a) + n.getY(b);
    const z = n.getZ(a) + n.getZ(b);
    const len = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / len, y / len, z / len);
    n.setXYZ(b, x / len, y / len, z / len);
  }
}

/** Raised knit columns and sunken purl/slip columns, so ribbing has real depth. */
function flute(g: THREE.BufferGeometry, sts: number, rib: string, depth: number) {
  if (!/[PS]/.test(rib)) return;
  const grouped = rib.length > 1;
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = uv.getX(i) * sts;
    let h: number;
    if (grouped) h = ribRelief(rib, x);
    else {
      const c = Math.floor(x);
      const f = x - c;
      h = Math.sin(Math.PI * f) ** 0.7;
    }
    const px = p.getX(i);
    const pz = p.getZ(i);
    const r = Math.hypot(px, pz);
    if (r < 1e-4) continue;
    const s = (r + depth * (h - 0.55)) / r;
    p.setXYZ(i, px * s, p.getY(i), pz * s);
  }
}

/** Closed double-layer cuff: inner face, rounded hem fold, outer face, top roll. */
function doubleCuffPts(ribR: number, yTop: number, th: number, ease = 0.05): Pt[] {
  const ro0 = ribR + 2 * th;
  const ro1 = ro0 - ease;
  const p: Pt[] = [];
  for (let i = 0; i <= 10; i++) p.push([ribR, yTop - ((yTop - th) * i) / 10]);
  for (let i = 1; i <= 16; i++) {
    const t = Math.PI + (i / 16) * Math.PI;
    p.push([ribR + th + th * Math.cos(t), th + th * Math.sin(t)]);
  }
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    p.push([ro0 + (ro1 - ro0) * t + 0.025 * Math.sin(Math.PI * t), th + (yTop - th) * t]);
  }
  for (let i = 1; i <= 16; i++) {
    const t = (i / 16) * Math.PI;
    p.push([ro1 - th + th * Math.cos(t), yTop + th * Math.sin(t)]);
  }
  return p;
}

/** Hemmed double cuff that stays close to the body radius — soft fold, not a can. */
function hemCuffPts(ribR: number, h: number): Pt[] {
  const Ro = ribR + 0.09;
  const rB = Math.min(0.16, h * 0.12);
  const rT = Math.min(0.1, h * 0.08);
  const p: Pt[] = [[Ro - 0.22, 0.03]];
  for (let i = 0; i <= 14; i++) {
    const t = -Math.PI / 2 + (i / 14) * (Math.PI / 2);
    p.push([Ro - rB + rB * Math.cos(t), rB + rB * Math.sin(t)]);
  }
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    p.push([Ro + 0.02 * Math.sin(Math.PI * t), rB + (h - rT - rB) * t]);
  }
  p.push([Ro - 0.03, h], [ribR, h + 0.03]);
  return p;
}

/** Single-layer rib band with rounded top and bottom edges. */
function ribBandPts(ribR: number, h: number, th: number): Pt[] {
  const rad = Math.min(th * 0.5, h * 0.28);
  const ri = ribR;
  const ro = ribR + 2 * rad;
  const p: Pt[] = [];
  p.push([ri, h - rad]);
  p.push([ri, rad]);
  for (let i = 1; i <= 14; i++) {
    const t = Math.PI + (i / 14) * Math.PI;
    p.push([ri + rad + rad * Math.cos(t), rad + rad * Math.sin(t)]);
  }
  p.push([ro, h - rad]);
  for (let i = 1; i <= 14; i++) {
    const t = (i / 14) * Math.PI;
    p.push([ro - rad + rad * Math.cos(t), h - rad + rad * Math.sin(t)]);
  }
  return p;
}

function latheFrom(pts: Pt[], segments: number, vScale: number, n = Math.max(32, pts.length * 2)) {
  const { points, length } = resample(pts, n);
  const g = new THREE.LatheGeometry(points, segments, Math.PI, Math.PI * 2);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * length * vScale);
  return { g, rows: points.length };
}

export function buildHatShape(spec: HatSpec): HatShape {
  const { type, size } = spec;
  const kind = type.brim.kind;

  // Worn on the head it was sized for, the hat stretches to that circumference and gets a little shorter.
  const headCirc = (size.head[0] + size.head[1]) / 2;
  const wornCirc = Math.max(spec.finishedCircIn, headCirc * 0.98);
  const R = wornCirc / (2 * Math.PI) + 0.05;
  const stretch = wornCirc / spec.finishedCircIn;
  const k = Math.max(0.85, Math.min(1, 1 - 0.45 * (stretch - 1)));

  const ribR = R * 0.955;
  const fold = spec.foldIn * k;
  const band = (kind === 'hem-cuff' ? spec.dims.brimIn : spec.brimBandIn) * k;
  // A single-layer rib reads as a painted stripe unless it has a little extra depth.
  const visBand = kind === 'rib' ? Math.max(band * 1.4, Math.min(1.85 * k, 0.52 * R)) : band;
  const bodyStart = kind === 'rolled' ? 0 : visBand;
  const L = (spec.bodyIn + spec.crownIn) * k;
  const crownLen = spec.crownIn * k;

  // Fold-cuff and the plain rib band share the smooth tapered body; the short
  // hemmed hat keeps its taller worn dome so the cuff does not swallow it.
  const foldCuff = kind === 'fold-cuff';
  const ribBand = kind === 'rib';
  const shaped = foldCuff || ribBand;
  const th = Math.max(0.15, Math.min(ribBand ? 0.38 : 0.24, (ribBand ? 2.2 : 2.8) / spec.stsPerIn));
  // With the whole rib folded the body rises straight out of the cuff; otherwise it grows out of the bare rib.
  const bareRib = foldCuff && band > fold + 0.05;

  // The crown follows the head: a softly squared dome about as tall as the head is wide.
  const a = R * (shaped ? 0.94 : 0.97);
  const c = type.crown;
  // Paired decreases spaced every 3rd round give a slightly peaked crown; a folded cuff sits blunter.
  const n = foldCuff ? 2.15 : c.kind === 'paired' ? (c.thirdRoundShare > 0 ? 1.85 : 2.45) : 2.2;
  const headArc = domeArc(a, R * 1.08, n);
  const dArc = Math.min(headArc, L * 0.98);
  const b = solveDome(a, dArc, n);
  const cylH = L - dArc;
  const topY = bodyStart + cylH;

  // Fabric beyond what the head fills (about 2¼" of straight sides on an adult) drapes back as slouch.
  const fitCyl = Math.max(0.4, 2.2 * (R / 3.5) - bodyStart);
  const excess = Math.max(0, cylH - fitCyl);
  // Shaped bodies are one smooth taper, so slouch is a gentle lean rather than a bulge.
  const slouch = Math.min(shaped ? 0.3 : 0.5, excess / (0.85 * R) + type.slouch * 0.6);
  const pivot = bodyStart + Math.min(cylH, fitCyl);
  const span = Math.max(0.5, topY + b - pivot);
  const swellAmt = shaped ? 0.015 : 0.06 + 0.1 * Math.min(1, excess / (2 * R));

  const bend = (v: THREE.Vector3) => {
    const d = v.y - pivot;
    if (slouch <= 0 || d <= 0) return v;
    const s = Math.min(1, d / span);
    const phi = slouch * s * s;
    const swell = 1 + swellAmt * Math.sin(Math.PI * s) * Math.min(1, slouch * 3);
    const x = v.x * swell;
    const z = v.z * swell;
    v.set(x, pivot + z * Math.sin(phi) + d * Math.cos(phi) * (1 - 0.12 * slouch * s), z * Math.cos(phi) - d * Math.sin(phi));
    return v;
  };

  const rStart = kind === 'rolled' ? R * 0.985 : ribR;
  const pts: Pt[] = [];
  // Hidden skirt tucked down inside the folded cuff's top roll. The hemmed
  // short hat keeps the body sitting on the cuff so its worn height stays.
  const skirt = foldCuff && !bareRib ? 1.5 * th : 0;
  if (skirt) pts.push([R - 0.02, bodyStart - skirt]);
  const steps = 48;
  for (let i = 0; i <= steps && cylH > 0; i++) {
    const t = i / steps;
    const y = t * cylH;
    let r: number;
    if (shaped && !bareRib) r = R + (a - R) * t * t;
    else {
      r = rStart + (R - rStart) * smooth(y / 0.9);
      if (!shaped) r += R * 0.028 * Math.sin(Math.PI * Math.min(1, t * 1.15));
      r += (a - R) * t * t;
    }
    pts.push([r, bodyStart + y]);
  }
  for (let i = cylH > 0 ? 1 : 0; i <= 80; i++) {
    const [r, y] = domePoint(a, b, (i / 80) * (Math.PI / 2), n);
    pts.push([Math.max(0, r), topY + y]);
  }
  const SEG = 256;
  const { points, length: bodyLen } = resample(pts, 220);
  const body = new THREE.LatheGeometry(points, SEG, Math.PI, Math.PI * 2);
  const pos = body.attributes.position as THREE.BufferAttribute;
  const uv = body.attributes.uv as THREE.BufferAttribute;
  if (skirt)
    for (let i = 0; i < uv.count; i++) uv.setY(i, Math.max(0, (uv.getY(i) * bodyLen - skirt) / (bodyLen - skirt)));
  const S = spec.crown.visualSections;
  const crown0 = 1 - crownLen / L;
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    const u = uv.getX(i);
    const v = uv.getY(i);
    const phi = u * Math.PI * 2;
    // Crown decreases form soft ridges; the rest gets a little hand-knit unevenness.
    let f = 1 + 0.006 * Math.sin(5 * phi + 7 * v) * Math.sin(2 * phi + 1.3);
    if (v > crown0) {
      const t = (v - crown0) / (1 - crown0);
      f += (shaped ? 0.012 : 0.03) * Math.sin(Math.PI * Math.min(1, t * 1.1)) * Math.cos(2 * Math.PI * S * u);
    }
    v3.x *= f;
    v3.z *= f;
    bend(v3);
    pos.setXYZ(i, v3.x, v3.y, v3.z);
  }
  body.computeVertexNormals();
  weldSeam(body, points.length, SEG);
  if (skirt) {
    // Soft occlusion where the body disappears into the cuff.
    const col = new Float32Array(pos.count * 3);
    const shadeIn = 0.45 / bodyLen;
    for (let i = 0; i < pos.count; i++) col.fill(0.72 + 0.28 * smooth(uv.getY(i) / shadeIn), i * 3, i * 3 + 3);
    body.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }

  const rib = type.brim.rib;
  // Grouped knit/purl or knit/slip ribs share one rounded ridge per knit run.
  const depth = rib.includes('P')
    ? Math.min(0.08, 0.6 / spec.stsPerIn)
    : rib.includes('S')
      ? Math.min(0.032, 0.22 / spec.stsPerIn)
      : Math.min(0.11, 0.3 / spec.stsPerIn);
  const ribSeg = Math.min(1600, Math.max(256, spec.brimSts * 8));
  const vScale = 1 / k;
  const brims: HatShape['brims'] = [];
  const addRib = (p: Pt[]) => {
    const { g, rows } = latheFrom(p, ribSeg, vScale);
    flute(g, spec.brimSts, rib, depth);
    g.computeVertexNormals();
    weldSeam(g, rows, ribSeg);
    brims.push({ geo: g });
  };

  if (kind === 'rib') {
    addRib(ribBandPts(ribR, visBand, th));
  } else if (kind === 'hem-cuff') {
    addRib(hemCuffPts(ribR, visBand));
  } else if (kind === 'fold-cuff') {
    if (bareRib)
      addRib([
        [ribR, fold - th],
        [ribR, band + 0.06],
      ]);
    addRib(doubleCuffPts(ribR, fold - th, th));
  } else {
    const tube = Math.max(0.16, Math.min(0.34, 0.12 + 0.55 / spec.stsPerIn));
    const g = new THREE.TorusGeometry(R * 0.965 + tube * 0.2, tube, 24, 256);
    g.rotateX(-Math.PI / 2);
    g.translate(0, tube * 0.75, 0);
    const tuv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < tuv.count; i++) tuv.setY(i, tuv.getY(i) * 2 * Math.PI * tube);
    brims.push({ geo: g, purl: true });
  }

  const tip = bend(new THREE.Vector3(0, topY + b, 0));
  const up = new THREE.Vector3(0, Math.cos(slouch), -Math.sin(slouch));
  const pomR = Math.max(0.95, Math.min(1.55, (1.5 * R) / 3.6));
  const pom = tip.clone().addScaledVector(up, pomR * 0.55);

  body.computeBoundingBox();
  const bounds = body.boundingBox!.clone();
  bounds.expandByPoint(new THREE.Vector3(R + 0.3, 0, R + 0.3));
  bounds.expandByPoint(new THREE.Vector3(-R - 0.3, -0.1, -R - 0.3));

  return { R, k, body, brims, pom, pomR, bounds, slouch };
}
