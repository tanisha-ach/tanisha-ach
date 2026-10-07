import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { HatSpec } from '../lib/spec';
import { drawBody, drawRib } from '../lib/texture';
import { useDesign } from '../store';
import { useSpec } from '../useSpec';
import { Icon } from './Icon';

type Pt = [number, number];

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

const quarterEllipse = (a: number, b: number) => (Math.PI / 4) * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

/** Dome height whose quarter-ellipse arc matches the knitted crown length. */
function domeHeight(a: number, arc: number) {
  let lo = 0.08 * a;
  let hi = 4 * a;
  if (quarterEllipse(a, lo) >= arc) return lo;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (quarterEllipse(a, mid) < arc) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function lathe(pts: Pt[], vScale = false) {
  const { points, length } = resample(pts, Math.max(24, Math.round(pts.length * 1.5)));
  const g = new THREE.LatheGeometry(points, 180, Math.PI, Math.PI * 2);
  if (vScale) {
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * length);
  }
  return g;
}

function useCanvasTexture(canvas: HTMLCanvasElement | null, srgb: boolean, repeatT = false) {
  const tex = useMemo(() => {
    if (!canvas) return null;
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = repeatT ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas, srgb, repeatT]);
  useEffect(() => () => tex?.dispose(), [tex]);
  return tex;
}

function fuzzCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#777';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const v = 90 + Math.floor(Math.random() * 160);
    ctx.strokeStyle = `rgba(${v},${v},${v},0.6)`;
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const a = Math.random() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
    ctx.stroke();
  }
  return c;
}

function HatModel({ spec }: { spec: HatSpec }) {
  const chart = useDesign((s) => s.chart);
  const palette = useDesign((s) => s.palette);
  const placement = useDesign((s) => s.placement);
  const tile = useDesign((s) => s.tileVertical);
  const brimColor = useDesign((s) => s.brimColor);
  const pomPom = useDesign((s) => s.pomPom);
  const pomColor = useDesign((s) => s.pomColor);
  const showHead = useDesign((s) => s.showHead);

  const { type } = spec;
  const R = (spec.finishedCircIn * 1.06) / (2 * Math.PI);
  const kind = type.brim.kind;
  const ribR = R * 0.975;

  const bodyStart = kind === 'rolled' ? 0 : kind === 'hem-cuff' ? spec.dims.brimIn : spec.brimBandIn;
  // Worn on a head, the upper body rounds over with the crown, so the dome
  // takes up more fabric than the crown shaping alone.
  const totalArc = spec.bodyIn + spec.crownIn;
  const domeA = R * 0.985;
  const domeArc = Math.max(spec.crownIn, Math.min(quarterEllipse(domeA, R * 0.9), totalArc * 0.85));
  const domeH = domeHeight(domeA, domeArc);
  const cylH = Math.max(0, totalArc - domeArc);
  const topY = bodyStart + cylH;
  const slouch = type.slouch;

  const deform = useMemo(() => {
    const ys = bodyStart + cylH * 0.5;
    const span = topY + domeH - ys;
    return (v: THREE.Vector3) => {
      if (!slouch || v.y <= ys) return v;
      const t = (v.y - ys) / span;
      v.z -= slouch * R * 0.9 * t * t;
      v.y -= slouch * R * 0.3 * t * t;
      return v;
    };
  }, [bodyStart, cylH, topY, domeH, slouch, R]);

  const bodyGeo = useMemo(() => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push([R * (1 + 0.012 * Math.sin(Math.PI * t)) - (R - domeA) * t, bodyStart + t * cylH]);
    }
    for (let i = 1; i <= 60; i++) {
      const th = (i / 60) * (Math.PI / 2);
      pts.push([Math.max(0, domeA * Math.cos(th)), topY + domeH * Math.sin(th)]);
    }
    const { points } = resample(pts, 200);
    const g = new THREE.LatheGeometry(points, 200, Math.PI, Math.PI * 2);
    if (slouch) {
      const p = g.attributes.position as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        deform(v.fromBufferAttribute(p, i));
        p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
    }
    return g;
  }, [R, domeA, bodyStart, cylH, topY, domeH, slouch, deform]);

  const brimGeos = useMemo(() => {
    const out: { geo: THREE.BufferGeometry; purl?: boolean }[] = [];
    if (kind === 'rib') {
      out.push({
        geo: lathe(
          [
            [ribR - 0.1, 0],
            [ribR - 0.02, 0.03],
            [ribR, 0.1],
            [ribR, spec.brimBandIn],
            [R, spec.brimBandIn + 0.05],
          ],
          true,
        ),
      });
    } else if (kind === 'hem-cuff') {
      const Ro = R * 1.025;
      const arc: Pt[] = [];
      for (let i = 0; i <= 10; i++) {
        const th = -Math.PI / 2 + (i / 10) * (Math.PI / 2);
        arc.push([Ro - 0.14 + 0.14 * Math.cos(th), 0.14 + 0.14 * Math.sin(th)]);
      }
      out.push({ geo: lathe([[Ro - 0.25, 0.02], ...arc, [Ro, spec.dims.brimIn - 0.05], [R, spec.dims.brimIn + 0.02]], true) });
    } else if (kind === 'fold-cuff') {
      out.push({
        geo: lathe(
          [
            [ribR, 0],
            [ribR, spec.brimBandIn + 0.05],
          ],
          true,
        ),
      });
      // The fold: a half-round turning the inner rib layer up into the outer cuff.
      const Ro = R * 1.065;
      const r = (Ro - ribR) / 2;
      const pts: Pt[] = [];
      for (let i = 0; i <= 14; i++) {
        const th = Math.PI + (i / 14) * Math.PI;
        pts.push([ribR + r + r * Math.cos(th), r + r * Math.sin(th)]);
      }
      pts.push([Ro, spec.foldIn - 0.1]);
      pts.push([Ro - 0.05, spec.foldIn]);
      pts.push([ribR + 0.02, spec.foldIn + 0.02]);
      out.push({ geo: lathe(pts, true) });
    } else {
      const tube = 0.22;
      const g = new THREE.TorusGeometry(R + tube * 0.45, tube, 20, 200);
      g.rotateX(-Math.PI / 2);
      g.translate(0, tube * 0.7, 0);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 2 * Math.PI * tube);
      out.push({ geo: g, purl: true });
    }
    return out;
  }, [kind, R, ribR, spec.brimBandIn, spec.foldIn, spec.dims.brimIn]);

  // Body texture: redraw on the next frame so dragging across the chart stays smooth.
  const [bodyCanvas, setBodyCanvas] = useState<{ color: HTMLCanvasElement; bump: HTMLCanvasElement } | null>(null);
  const pending = useRef(0);
  const colorTexRef = useRef<THREE.Texture | null>(null);
  const bumpTexRef = useRef<THREE.Texture | null>(null);
  useEffect(() => {
    cancelAnimationFrame(pending.current);
    pending.current = requestAnimationFrame(() => {
      setBodyCanvas((prev) => {
        const next = drawBody(prev, spec, chart, palette, placement, tile);
        if (next === prev) {
          if (colorTexRef.current) colorTexRef.current.needsUpdate = true;
          if (bumpTexRef.current) bumpTexRef.current.needsUpdate = true;
          return prev;
        }
        return { ...next };
      });
    });
    return () => cancelAnimationFrame(pending.current);
  }, [spec, chart, palette, placement, tile]);
  const bodyColor = useCanvasTexture(bodyCanvas?.color ?? null, true);
  const bodyBump = useCanvasTexture(bodyCanvas?.bump ?? null, false);
  colorTexRef.current = bodyColor;
  bumpTexRef.current = bodyBump;

  const brimHex = palette[brimColor] ?? palette[0];
  const rib = useMemo(
    () => drawRib(spec.brimSts, spec.rowsPerIn * (type.brim.rowFactor ?? 1), type.brim.rib, brimHex),
    [spec.brimSts, spec.rowsPerIn, type.brim.rowFactor, type.brim.rib, brimHex],
  );
  const purl = useMemo(() => drawRib(spec.bodySts, spec.rowsPerIn, 'P', brimHex), [spec.bodySts, spec.rowsPerIn, brimHex]);
  const ribColor = useCanvasTexture(rib.color, true, true);
  const ribBump = useCanvasTexture(rib.bump, false, true);
  const purlColor = useCanvasTexture(purl.color, true, true);
  const purlBump = useCanvasTexture(purl.bump, false, true);

  const fuzz = useMemo(() => fuzzCanvas(), []);
  const fuzzTex = useCanvasTexture(fuzz, false, true);
  if (fuzzTex) fuzzTex.repeat.set(3, 3);
  const pomGeo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1.5, 6);
    const p = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n =
        0.5 * Math.sin(v.x * 9.1 + v.y * 3) * Math.cos(v.y * 8.3 - v.z * 2) +
        0.5 * Math.sin(v.z * 23.7 + v.x * 11) * Math.cos(v.y * 19.1);
      v.multiplyScalar(1 + 0.035 * n);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const pomPos = useMemo(() => deform(new THREE.Vector3(0, topY + domeH + 0.8, 0)), [deform, topY, domeH]);

  const headR = R * 0.95;
  const fabric = {
    roughness: 0.92,
    sheen: 1,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color('#ffffff'),
    side: THREE.DoubleSide,
  };

  return (
    <group>
      {bodyColor && (
        <mesh geometry={bodyGeo} castShadow receiveShadow>
          <meshPhysicalMaterial map={bodyColor} bumpMap={bodyBump} bumpScale={1.4} {...fabric} />
        </mesh>
      )}
      {brimGeos.map(({ geo, purl: isPurl }, i) => (
        <mesh key={i} geometry={geo} castShadow receiveShadow>
          <meshPhysicalMaterial
            map={isPurl ? purlColor : ribColor}
            bumpMap={isPurl ? purlBump : ribBump}
            bumpScale={1.6}
            {...fabric}
          />
        </mesh>
      ))}
      {pomPom && (
        <mesh geometry={pomGeo} position={pomPos} castShadow>
          <meshPhysicalMaterial
            color={palette[pomColor] ?? palette[0]}
            roughness={1}
            sheen={1}
            sheenRoughness={0.5}
            sheenColor={palette[pomColor] ?? palette[0]}
            bumpMap={fuzzTex}
            bumpScale={6}
          />
        </mesh>
      )}
      {showHead && (
        <mesh position={[0, 0.9, 0]} scale={[headR, headR * 1.18, headR]} receiveShadow>
          <sphereGeometry args={[1, 64, 48]} />
          <meshStandardMaterial color="#d9cfc4" roughness={0.85} />
        </mesh>
      )}
    </group>
  );
}

export function HatViewer() {
  const spec = useSpec();
  const [autoRotate, setAutoRotate] = useState(true);
  const showHead = useDesign((s) => s.showHead);
  const set = useDesign((s) => s.set);
  const R = (spec.finishedCircIn * 1.06) / (2 * Math.PI);
  const floor = showHead ? 0.9 - R * 0.95 * 1.18 : -0.15;
  const midY = (spec.wornHeightIn + floor) / 2;

  return (
    <div className="viewer">
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ position: [0, midY + 7, 23], fov: 34 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[10, 16, 12]} intensity={1.7} castShadow shadow-mapSize={[2048, 2048]} />
        <directionalLight position={[-12, 6, -6]} intensity={0.5} color="#ffd9c2" />
        <Environment resolution={128}>
          <Lightformer intensity={2} position={[0, 8, 8]} scale={[12, 6, 1]} />
          <Lightformer intensity={0.8} position={[-10, 2, 0]} rotation-y={Math.PI / 2} scale={[10, 10, 1]} color="#ffe8d6" />
          <Lightformer intensity={0.6} position={[10, 0, -4]} rotation-y={-Math.PI / 2} scale={[10, 10, 1]} color="#dfe8ff" />
        </Environment>
        <HatModel spec={spec} />
        <ContactShadows position={[0, floor - 0.05, 0]} opacity={0.3} blur={2.6} scale={22} far={8} />
        <OrbitControls
          target={[0, midY, 0]}
          enablePan={false}
          maxPolarAngle={Math.PI * 0.62}
          minDistance={10}
          maxDistance={48}
          autoRotate={autoRotate}
          autoRotateSpeed={1.1}
          onStart={() => setAutoRotate(false)}
        />
      </Canvas>
      <div className="viewer-overlay">
        <span className="badge">{spec.type.name}</span>
        <span className="badge subtle">
          {spec.size.name} · {spec.bodySts} sts · {spec.brimRows + spec.bodyRows + spec.crown.rows} rnds
        </span>
      </div>
      <div className="viewer-controls">
        <button className={`btn ghost small ${autoRotate ? 'on' : ''}`} onClick={() => setAutoRotate((v) => !v)}>
          <Icon name="rotate" /> {autoRotate ? 'Spinning' : 'Spin'}
        </button>
        <button className={`btn ghost small ${showHead ? 'on' : ''}`} onClick={() => set({ showHead: !showHead })}>
          Head form
        </button>
      </div>
      <div className="viewer-legend">
        <span>
          <i className="lg brim" /> {spec.type.brim.label}
        </span>
        <span>
          <i className="lg body" /> body {spec.bodyRows} rnds
        </span>
        <span>
          <i className="lg crown" /> crown {spec.crown.rows} rnds · {spec.crown.visualSections}{' '}
          {spec.type.construction === 'top-down' ? 'increase sections' : 'decrease sections'}
        </span>
      </div>
    </div>
  );
}
