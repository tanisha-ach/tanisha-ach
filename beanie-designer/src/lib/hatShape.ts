import * as THREE from 'three';
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

/** Raised knit columns and sunken purl columns, so ribbing has real depth. */
function flute(g: THREE.BufferGeometry, sts: number, rib: string, depth: number) {
  if (!/[PS]/.test(rib)) return;
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = uv.getX(i) * sts;
    const c = Math.floor(x);
    const f = x - c;
    const ch = rib[((c % rib.length) + rib.length) % rib.length];
    const h = ch === 'P' ? 0.12 * Math.sin(Math.PI * f) : Math.sin(Math.PI * f) ** 0.7;
    const px = p.getX(i);
    const pz = p.getZ(i);
    const r = Math.hypot(px, pz);
    if (r < 1e-4) continue;
    const s = (r + depth * (h - 0.55)) / r;
    p.setXYZ(i, px * s, p.getY(i), pz * s);
  }
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
  const bodyStart = kind === 'rolled' ? 0 : band;
  const L = (spec.bodyIn + spec.crownIn) * k;
  const crownLen = spec.crownIn * k;

  // The crown follows the head: a softly squared dome about as tall as the head is wide.
  const a = R * 0.97;
  const c = type.crown;
  // Paired decreases spaced every 3rd round give a slightly peaked crown; quick 4-section crowns sit blunter.
  const n = c.kind === 'paired' ? (c.thirdRoundShare > 0 ? 1.85 : 2.45) : 2.2;
  const headArc = domeArc(a, R * 1.08, n);
  const dArc = Math.min(headArc, L * 0.98);
  const b = solveDome(a, dArc, n);
  const cylH = L - dArc;
  const topY = bodyStart + cylH;

  // Fabric beyond what the head fills (about 2¼" of straight sides on an adult) drapes back as slouch.
  const fitCyl = Math.max(0.4, 2.2 * (R / 3.5) - bodyStart);
  const excess = Math.max(0, cylH - fitCyl);
  const slouch = Math.min(0.5, excess / (0.85 * R) + type.slouch * 0.6);
  const pivot = bodyStart + Math.min(cylH, fitCyl);
  const span = Math.max(0.5, topY + b - pivot);

  const bend = (v: THREE.Vector3) => {
    const d = v.y - pivot;
    if (slouch <= 0 || d <= 0) return v;
    const s = Math.min(1, d / span);
    const phi = slouch * s * s;
    const swell = 1 + (0.06 + 0.1 * Math.min(1, excess / (2 * R))) * Math.sin(Math.PI * s) * Math.min(1, slouch * 3);
    const x = v.x * swell;
    const z = v.z * swell;
    v.set(x, pivot + z * Math.sin(phi) + d * Math.cos(phi) * (1 - 0.12 * slouch * s), z * Math.cos(phi) - d * Math.sin(phi));
    return v;
  };

  const rStart = kind === 'rolled' ? R * 0.985 : ribR;
  const pts: Pt[] = [];
  const steps = 48;
  for (let i = 0; i <= steps && cylH > 0; i++) {
    const t = i / steps;
    const y = t * cylH;
    let r = rStart + (R - rStart) * smooth(y / 0.9);
    r += R * 0.028 * Math.sin(Math.PI * Math.min(1, t * 1.15));
    r += (a - R) * t * t;
    pts.push([r, bodyStart + y]);
  }
  for (let i = cylH > 0 ? 1 : 0; i <= 80; i++) {
    const [r, y] = domePoint(a, b, (i / 80) * (Math.PI / 2), n);
    pts.push([Math.max(0, r), topY + y]);
  }
  const SEG = 256;
  const { points } = resample(pts, 220);
  const body = new THREE.LatheGeometry(points, SEG, Math.PI, Math.PI * 2);
  const pos = body.attributes.position as THREE.BufferAttribute;
  const uv = body.attributes.uv as THREE.BufferAttribute;
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
      f += 0.03 * Math.sin(Math.PI * Math.min(1, t * 1.1)) * Math.cos(2 * Math.PI * S * u);
    }
    v3.x *= f;
    v3.z *= f;
    bend(v3);
    pos.setXYZ(i, v3.x, v3.y, v3.z);
  }
  body.computeVertexNormals();
  weldSeam(body, points.length, SEG);

  const rib = type.brim.rib;
  const depth = Math.min(0.11, 0.3 / spec.stsPerIn);
  const ribSeg = Math.min(1200, Math.max(256, spec.brimSts * 6));
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
    addRib([
      [ribR - 0.12, 0],
      [ribR - 0.03, 0.03],
      [ribR, 0.12],
      [ribR, band],
      [ribR + 0.01, band + 0.06],
    ]);
  } else if (kind === 'hem-cuff') {
    const Ro = ribR + 0.08;
    const arc: Pt[] = [];
    for (let i = 0; i <= 12; i++) {
      const th = -Math.PI / 2 + (i / 12) * (Math.PI / 2);
      arc.push([Ro - 0.14 + 0.14 * Math.cos(th), 0.14 + 0.14 * Math.sin(th)]);
    }
    addRib([[Ro - 0.26, 0.02], ...arc, [Ro, band - 0.08], [Ro - 0.04, band], [ribR, band + 0.04]]);
  } else if (kind === 'fold-cuff') {
    if (band > 0.05)
      addRib([
        [ribR, 0],
        [ribR, band + 0.06],
      ]);
    // The fold: a half-round turning the inner layer up into a slightly flared outer cuff.
    const th = 0.13;
    const Ro = ribR + 2 * th;
    const p: Pt[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = Math.PI + (i / 14) * Math.PI;
      p.push([ribR + th + th * Math.cos(t), th + th * Math.sin(t)]);
    }
    p.push([Ro + 0.03, fold * 0.5]);
    p.push([Ro + 0.06, fold - 0.12]);
    for (let i = 1; i <= 8; i++) {
      const t = (i / 8) * Math.PI;
      p.push([Ro + 0.06 - th * (1 - Math.cos(t)), fold - 0.12 + 0.12 * Math.sin(t)]);
    }
    addRib(p);
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
