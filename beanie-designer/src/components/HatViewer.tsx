import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { buildHatShape, type HatShape } from '../lib/hatShape';
import type { HatSpec } from '../lib/spec';
import { drawBody, drawRib } from '../lib/texture';
import { useDesign } from '../store';
import { useSpec } from '../useSpec';
import { Icon } from './Icon';

const FOV = 32;

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

const FABRIC = {
  roughness: 0.94,
  sheen: 0.7,
  sheenRoughness: 0.55,
  sheenColor: new THREE.Color('#fff6ee'),
  side: THREE.DoubleSide,
};

function HatModel({ spec, shape }: { spec: HatSpec; shape: HatShape }) {
  const chart = useDesign((s) => s.chart);
  const palette = useDesign((s) => s.palette);
  const placement = useDesign((s) => s.placement);
  const tile = useDesign((s) => s.tileVertical);
  const brimColor = useDesign((s) => s.brimColor);
  const pomPom = useDesign((s) => s.pomPom);
  const pomColor = useDesign((s) => s.pomColor);
  const { type } = spec;

  useEffect(
    () => () => {
      shape.body.dispose();
      shape.brims.forEach((b) => b.geo.dispose());
    },
    [shape],
  );

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
    const g = new THREE.IcosahedronGeometry(1, 6);
    const p = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n =
        0.5 * Math.sin(v.x * 13.6 + v.y * 4.5) * Math.cos(v.y * 12.4 - v.z * 3) +
        0.5 * Math.sin(v.z * 35.5 + v.x * 16.5) * Math.cos(v.y * 28.6);
      v.multiplyScalar(1 + 0.035 * n);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    // Heads are oval, a little deeper than they are wide.
    <group scale={[0.97, 1, 1.03]}>
      {bodyColor && (
        <mesh geometry={shape.body} castShadow receiveShadow>
          <meshPhysicalMaterial map={bodyColor} bumpMap={bodyBump} bumpScale={1.6} {...FABRIC} />
        </mesh>
      )}
      {shape.brims.map(({ geo, purl: isPurl }, i) => (
        <mesh key={i} geometry={geo} castShadow receiveShadow>
          <meshPhysicalMaterial
            map={isPurl ? purlColor : ribColor}
            bumpMap={isPurl ? purlBump : ribBump}
            bumpScale={1.8}
            {...FABRIC}
          />
        </mesh>
      ))}
      {pomPom && (
        <mesh geometry={pomGeo} position={shape.pom} scale={shape.pomR} castShadow>
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
    </group>
  );
}

/** Keeps every style and size framed the same way, keeping the current orbit angle. */
function CameraRig({ bounds }: { bounds: THREE.Box3 }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  useEffect(() => {
    if (!controls) return;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const fit = Math.max(size.y, Math.max(size.x, size.z) * 0.9);
    const dist = (fit / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2))) * 1.55 + Math.max(size.x, size.z) / 2;
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0.42, 1);
    dir.normalize();
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(dir, dist);
    controls.minDistance = dist * 0.55;
    controls.maxDistance = dist * 2;
    controls.update();
  }, [bounds, camera, controls]);
  return null;
}

export function HatViewer() {
  const spec = useSpec();
  const [autoRotate, setAutoRotate] = useState(() => !new URLSearchParams(location.search).has('still'));
  const shape = useMemo(() => buildHatShape(spec), [spec]);

  return (
    <div className="viewer">
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ position: [11, 8.5, 16], fov: FOV }}
        gl={{ preserveDrawingBuffer: true, antialias: true, toneMappingExposure: 1.05 }}
      >
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[-7, 14, 10]}
          intensity={1.9}
          color="#fff4e8"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
        />
        <directionalLight position={[9, 5, 6]} intensity={0.45} color="#e7eeff" />
        <directionalLight position={[2, 8, -12]} intensity={0.9} color="#ffe2cc" />
        <Environment resolution={128}>
          <Lightformer intensity={1.6} position={[-4, 9, 8]} scale={[14, 7, 1]} color="#fff3e6" />
          <Lightformer intensity={0.7} position={[-10, 2, 0]} rotation-y={Math.PI / 2} scale={[10, 10, 1]} color="#ffe8d6" />
          <Lightformer intensity={0.6} position={[10, 1, -2]} rotation-y={-Math.PI / 2} scale={[10, 10, 1]} color="#e2eaff" />
          <Lightformer intensity={0.5} position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[20, 20, 1]} color="#f1e6db" />
        </Environment>
        <HatModel spec={spec} shape={shape} />
        <ContactShadows position={[0, -0.12, 0]} opacity={0.38} blur={2.4} scale={shape.R * 6} far={6} resolution={512} />
        <OrbitControls
          makeDefault
          enablePan={false}
          maxPolarAngle={Math.PI * 0.6}
          autoRotate={autoRotate}
          autoRotateSpeed={1.1}
          onStart={() => setAutoRotate(false)}
        />
        <CameraRig bounds={shape.bounds} />
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
      </div>
      <div className="viewer-legend">
        <span>
          <i className="lg brim" /> {spec.type.brim.label}
        </span>
        <span>
          <i className="lg body" /> {spec.finishedCircIn.toFixed(1)}" around · {spec.wornHeightIn.toFixed(1)}" tall
        </span>
        <span>
          <i className="lg crown" /> crown {spec.crown.rows} rnds · {spec.crown.visualSections}{' '}
          {spec.type.construction === 'top-down' ? 'increase sections' : 'decrease sections'}
        </span>
      </div>
    </div>
  );
}
