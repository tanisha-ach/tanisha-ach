import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { MOTIFS, type Motif } from '../config/motifs';
import { makeChart, pickRepeatWidths, shiftChart } from '../lib/chart';
import { colorName } from '../lib/pattern';
import { MAX_COLORS, useDesign, type Tool } from '../store';
import { useSpec } from '../useSpec';
import { Icon } from './Icon';

const LABEL = 22;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

export function ChartEditor({ onGenerate }: { onGenerate?: () => void }) {
  const s = useDesign();
  const spec = useSpec();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrapW, setWrapW] = useState(600);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [activeMotif, setActiveMotif] = useState('');
  const [zoom, setZoom] = useState(1);
  const [placementOpen, setPlacementOpen] = useState(true);
  const painting = useRef(false);
  const panning = useRef(false);
  const panOrigin = useRef({ x: 0, y: 0, left: 0, top: 0 });
  const last = useRef<[number, number] | null>(null);
  const spaceDown = useRef(false);
  const { chart, palette } = s;

  const resize = useDesign((st) => st.resize);
  useEffect(() => {
    if (chart.h !== spec.bodyRows) resize(chart.w, spec.bodyRows);
  }, [spec.bodyRows, chart.h, chart.w, resize]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWrapW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const baseCell = Math.max(8, Math.min(30, Math.floor((wrapW - LABEL - 4) / chart.w)));
  const cell = Math.max(4, Math.round(baseCell * zoom));
  const cssW = chart.w * cell + LABEL;
  const cssH = chart.h * cell + LABEL;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = cssW * dpr;
    cv.height = cssH * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    for (let y = 0; y < chart.h; y++)
      for (let x = 0; x < chart.w; x++) {
        ctx.fillStyle = palette[chart.cells[y * chart.w + x]] ?? palette[0];
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    if (hover) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(hover[0] * cell, hover[1] * cell, cell, cell);
      if (s.mirror) ctx.fillRect((chart.w - 1 - hover[0]) * cell, hover[1] * cell, cell, cell);
    }
    for (let x = 0; x <= chart.w; x++) {
      ctx.strokeStyle = x % 5 === 0 ? 'rgba(43,37,34,0.38)' : 'rgba(43,37,34,0.14)';
      ctx.beginPath();
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, chart.h * cell);
      ctx.stroke();
    }
    for (let y = 0; y <= chart.h; y++) {
      ctx.strokeStyle = (chart.h - y) % 5 === 0 ? 'rgba(43,37,34,0.38)' : 'rgba(43,37,34,0.14)';
      ctx.beginPath();
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(chart.w * cell, y * cell + 0.5);
      ctx.stroke();
    }
    if (s.mirror) {
      ctx.strokeStyle = 'rgba(181,82,59,0.8)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo((chart.w * cell) / 2, 0);
      ctx.lineTo((chart.w * cell) / 2, chart.h * cell);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#8a7f77';
    ctx.font = `${Math.min(10, cell * 0.6)}px Nunito, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const every = cell < 13 ? 5 : 1;
    for (let y = 0; y < chart.h; y++) {
      const n = chart.h - y;
      if (n % every === 0 || n === 1) ctx.fillText(String(n), chart.w * cell + 5, y * cell + cell / 2);
    }
    ctx.textAlign = 'center';
    for (let x = 0; x < chart.w; x++) {
      const n = chart.w - x;
      if (n % every === 0 || n === 1) ctx.fillText(String(n), x * cell + cell / 2, chart.h * cell + 11);
    }
  }, [chart, palette, cell, cssW, cssH, hover, s.mirror]);

  const cellAt = (e: React.PointerEvent, clamp = false): [number, number] | null => {
    const r = canvasRef.current!.getBoundingClientRect();
    let x = Math.floor((e.clientX - r.left) / cell);
    let y = Math.floor((e.clientY - r.top) / cell);
    if (clamp) {
      x = Math.max(0, Math.min(chart.w - 1, x));
      y = Math.max(0, Math.min(chart.h - 1, y));
    }
    return x >= 0 && y >= 0 && x < chart.w && y < chart.h ? [x, y] : null;
  };

  const apply = (e: React.PointerEvent, first: boolean) => {
    const p = cellAt(e, !first);
    if (!p) return;
    const st = useDesign.getState();
    if (st.tool === 'pick') {
      st.set({ active: st.chart.cells[p[1] * st.chart.w + p[0]], tool: 'paint' });
      return;
    }
    if (st.tool === 'fill') {
      if (first) st.fill(p[0], p[1]);
      return;
    }
    if (first) st.beginStroke();
    const [x0, y0] = first || !last.current ? p : last.current;
    const n = Math.max(Math.abs(p[0] - x0), Math.abs(p[1] - y0));
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      st.paint(Math.round(x0 + (p[0] - x0) * t), Math.round(y0 + (p[1] - y0) * t));
    }
    last.current = p;
  };

  const applyMotif = (motif: Motif | null) => {
    if (!motif) {
      setActiveMotif('');
      s.replaceChart(makeChart(chart.w, spec.bodyRows));
      return;
    }
    setActiveMotif(motif.id);
    s.replaceChart({ w: motif.chart.w, h: spec.bodyRows, cells: resizeMotifToBody(motif.chart, spec.bodyRows) });
    if (s.placement === 'repeat') {
      const choices = pickRepeatWidths(spec.goodWidths, motif.chart.w, 5);
      if (choices.length) {
        const nearest = choices.reduce((best, x) => (Math.abs(x - motif.chart.w) < Math.abs(best - motif.chart.w) ? x : best));
        if (nearest !== motif.chart.w) s.resize(nearest, spec.bodyRows);
      }
    } else if (motif.chart.w > spec.bodySts) {
      s.resize(spec.bodySts, spec.bodyRows);
    }
    s.set({ tileVertical: false, verticalPos: 0 });
  };

  const eraseAll = () => {
    setActiveMotif('');
    s.replaceChart(makeChart(chart.w, spec.bodyRows));
  };

  const generateChart = () => {
    onGenerate?.();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
      if (e.code === 'Space') {
        spaceDown.current = true;
        e.preventDefault();
        return;
      }
      const st = useDesign.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (e.key === 'b') st.set({ tool: 'paint' });
      else if (e.key === 'g') st.set({ tool: 'fill' });
      else if (e.key === 'i') st.set({ tool: 'pick' });
      else if (e.key === 'm') st.set({ mirror: !st.mirror });
      else if (e.key === '=' || e.key === '+') {
        setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + 0.25) * 100) / 100)));
      } else if (e.key === '-' || e.key === '_') {
        setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z - 0.25) * 100) / 100)));
      } else if (e.key === '0') setZoom(1);
      else if (/^[1-6]$/.test(e.key) && +e.key <= st.palette.length) st.set({ active: +e.key - 1 });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * (e.deltaY < 0 ? 1.12 : 0.9)));
      setZoom(Math.round(next * 100) / 100);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom]);

  const tools: { id: Tool; label: string; icon: Parameters<typeof Icon>[0]['name']; key: string }[] = [
    { id: 'paint', label: 'Paint', icon: 'brush', key: 'B' },
    { id: 'fill', label: 'Fill', icon: 'bucket', key: 'G' },
    { id: 'pick', label: 'Pick', icon: 'picker', key: 'I' },
  ];

  const widthChoices = useMemo(() => {
    if (s.placement === 'repeat') return pickRepeatWidths(spec.goodWidths, chart.w, 5);
    const hi = Math.max(8, Math.min(spec.bodySts, 60));
    const lo = Math.min(8, hi);
    const steps = 5;
    const all = new Set<number>();
    for (let i = 0; i < steps; i++) {
      all.add(Math.max(4, Math.round(lo + (i / Math.max(1, steps - 1)) * (hi - lo))));
    }
    if (chart.w >= 4 && chart.w <= hi) all.add(chart.w);
    return pickRepeatWidths([...all].sort((a, b) => a - b), chart.w, 5);
  }, [s.placement, spec.goodWidths, spec.bodySts, chart.w]);
  const widthIdx = Math.max(0, widthChoices.findIndex((w) => w === chart.w));
  const sliderIdx = widthChoices.includes(chart.w)
    ? widthIdx
    : widthChoices.reduce((best, w, i) => (Math.abs(w - chart.w) < Math.abs(widthChoices[best] - chart.w) ? i : best), 0);
  const repeatsAround =
    s.placement === 'repeat' && widthChoices[sliderIdx] > 0 && spec.bodySts % widthChoices[sliderIdx] === 0
      ? spec.bodySts / widthChoices[sliderIdx]
      : s.placement === 'repeat'
        ? Math.round(spec.repeats)
        : 0;
  const paletteEl = (
    <div className="palette palette-side" role="radiogroup" aria-label="Colours">
      {palette.map((c, i) => (
        <div key={i} className={`swatch ${s.active === i ? 'on' : ''}`}>
          <button
            className="chip"
            style={{ background: c }}
            onClick={() => s.set({ active: i, tool: s.tool === 'pick' ? 'paint' : s.tool })}
            aria-label={`Use ${colorName(i)}`}
            aria-checked={s.active === i}
            role="radio"
          />
          <span className="swatch-label">{colorName(i)}</span>
          <label className="swatch-edit" title="Edit colour">
            <input type="color" value={c} onChange={(e) => s.setColor(i, e.target.value)} />
            <Icon name="pencil" size={11} />
          </label>
          {i > 0 && palette.length > 2 && (
            <button className="swatch-x" onClick={() => s.removeColor(i)} title="Remove colour">
              ×
            </button>
          )}
        </div>
      ))}
      {palette.length < MAX_COLORS && (
        <button className="add-color" onClick={s.addColor} title="Add colour">
          +
        </button>
      )}
    </div>
  );

  const panCursor = panning.current || spaceDown.current;

  return (
    <section className="card chart-card">
      <header className="card-head">
        <div>
          <h2>Design your chart</h2>
        </div>
      </header>

      <div className={`field motif-placement ${placementOpen ? '' : 'collapsed'}`}>
        <button
          type="button"
          className="collapse-head"
          aria-expanded={placementOpen}
          onClick={() => setPlacementOpen((v) => !v)}
        >
          <span className="collapse-title">
            <span className="field-label" style={{ marginBottom: 0 }}>
              Motif placement
            </span>
            {!placementOpen && (
              <span className="collapse-summary">
                {s.placement === 'repeat' ? 'Repeating' : 'Single'} · {chart.w} sts
              </span>
            )}
          </span>
          <Icon name="down" size={16} />
        </button>

        {placementOpen && (
          <div className="collapse-body">
            <label className="toggle-row">
              <span className="field-label" style={{ marginBottom: 0 }}>
                Repeat pattern around the hat
              </span>
              <button
                type="button"
                className={`toggle ${s.placement === 'repeat' ? 'on' : ''}`}
                role="switch"
                aria-checked={s.placement === 'repeat'}
                onClick={() => s.set({ placement: s.placement === 'repeat' ? 'single' : 'repeat', tileVertical: false })}
              >
                <span className="toggle-knob" />
                <span className="sr-only">{s.placement === 'repeat' ? 'On' : 'Off'}</span>
              </button>
            </label>
            <p className="muted toggle-hint">
              {s.placement === 'repeat'
                ? 'The motif tiles around the circumference.'
                : 'The motif sits once on the front; the rest is plain.'}
            </p>

            {widthChoices.length > 0 && (
              <div className="slider width-slider">
                <div className="width-slider-head">
                  <span className="field-label" style={{ marginBottom: 0 }}>
                    Motif width
                  </span>
                  {s.placement === 'repeat' && Number.isFinite(repeatsAround) && repeatsAround > 0 && (
                    <b>
                      pattern repeats {repeatsAround} time{repeatsAround === 1 ? '' : 's'} around the hat
                    </b>
                  )}
                </div>
                <div
                  className="width-steps"
                  role="radiogroup"
                  aria-label="Motif width"
                  style={
                    {
                      '--progress': `${(sliderIdx / Math.max(1, widthChoices.length - 1)) * 100}%`,
                    } as CSSProperties
                  }
                >
                  <span className="width-line" aria-hidden />
                  {widthChoices.map((w, i) => (
                    <button
                      key={w}
                      type="button"
                      role="radio"
                      className={`width-step ${i <= sliderIdx ? 'filled' : ''} ${i === sliderIdx ? 'on' : ''}`}
                      aria-checked={i === sliderIdx}
                      onClick={() => s.resize(w, spec.bodyRows)}
                    >
                      <span className="width-dot" />
                      <span className="width-num">{w}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="motif-chart">
        <div className="toolbar toolbar-inline" role="toolbar" aria-label="Chart tools">
          <div className="seg labeled compact tools-row" role="group" aria-label="Drawing tools">
            {tools.map((t) => (
              <button
                key={t.id}
                className={s.tool === t.id ? 'on' : ''}
                onClick={() => s.set({ tool: t.id })}
                title={`${t.label} (${t.key})`}
                aria-pressed={s.tool === t.id}
              >
                <Icon name={t.icon} size={15} />
                <span className="tool-label">{t.label}</span>
              </button>
            ))}
            <button
              className={s.mirror ? 'on' : ''}
              onClick={() => s.set({ mirror: !s.mirror })}
              title="Mirror painting (M)"
              aria-pressed={s.mirror}
            >
              <Icon name="mirror" size={15} />
              <span className="tool-label">Mirror</span>
            </button>
            <button onClick={s.undo} disabled={!s.past.length} title="Undo (Ctrl+Z)">
              <Icon name="undo" size={15} />
              <span className="tool-label">Undo</span>
            </button>
            <button onClick={s.redo} disabled={!s.future.length} title="Redo (Ctrl+Shift+Z)">
              <Icon name="redo" size={15} />
              <span className="tool-label">Redo</span>
            </button>
            <button onClick={eraseAll} title="Erase everything">
              <Icon name="close" size={15} />
              <span className="tool-label">Erase</span>
            </button>
            <span className="tool-divider" aria-hidden />
            <button onClick={() => s.replaceChart(shiftChart(chart, -1, 0))} title="Slide left">
              <Icon name="left" size={14} />
            </button>
            <button onClick={() => s.replaceChart(shiftChart(chart, 1, 0))} title="Slide right">
              <Icon name="right" size={14} />
            </button>
            <button onClick={() => s.replaceChart(shiftChart(chart, 0, -1))} title="Slide up">
              <Icon name="up" size={14} />
            </button>
            <button onClick={() => s.replaceChart(shiftChart(chart, 0, 1))} title="Slide down">
              <Icon name="down" size={14} />
            </button>
          </div>
        </div>

        <div className="motif-pills" role="group" aria-label="Motif presets">
          <button type="button" className={`motif-pill ${activeMotif === '' ? 'on' : ''}`} onClick={() => applyMotif(null)}>
            Blank
          </button>
          {MOTIFS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`motif-pill ${activeMotif === m.id ? 'on' : ''}`}
              onClick={() => applyMotif(m)}
            >
              {m.name}
            </button>
          ))}
        </div>

        <div className="grid-with-palette">
          <div className="grid-wrap" ref={wrapRef}>
            <canvas
              ref={canvasRef}
              style={{
                width: cssW,
                height: cssH,
                cursor: panCursor ? 'grab' : s.tool === 'pick' ? 'copy' : 'crosshair',
              }}
              onPointerDown={(e) => {
                const panMode = e.button === 1 || e.altKey || spaceDown.current;
                if (panMode) {
                  e.preventDefault();
                  const wrap = wrapRef.current;
                  if (!wrap) return;
                  panning.current = true;
                  panOrigin.current = { x: e.clientX, y: e.clientY, left: wrap.scrollLeft, top: wrap.scrollTop };
                  e.currentTarget.setPointerCapture(e.pointerId);
                  return;
                }
                if (e.button !== 0) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                painting.current = true;
                apply(e, true);
              }}
              onPointerMove={(e) => {
                if (panning.current) {
                  const wrap = wrapRef.current;
                  if (!wrap) return;
                  wrap.scrollLeft = panOrigin.current.left - (e.clientX - panOrigin.current.x);
                  wrap.scrollTop = panOrigin.current.top - (e.clientY - panOrigin.current.y);
                  return;
                }
                const p = cellAt(e);
                setHover(p);
                if (painting.current && s.tool === 'paint') apply(e, false);
              }}
              onPointerUp={() => {
                painting.current = false;
                panning.current = false;
                last.current = null;
              }}
              onPointerLeave={() => setHover(null)}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Colorwork chart grid"
            />
          </div>
          {paletteEl}
        </div>

        <div className="generate-row">
          <button type="button" className="btn primary" onClick={generateChart}>
            Generate chart <Icon name="right" />
          </button>
        </div>
      </div>
    </section>
  );
}

/** Stretch or pad a motif to the body-row height, keeping it bottom-anchored. */
function resizeMotifToBody(motif: { w: number; h: number; cells: number[] }, bodyRows: number): number[] {
  const out = new Array(motif.w * bodyRows).fill(0);
  const dy = bodyRows - motif.h;
  for (let y = 0; y < motif.h; y++)
    for (let x = 0; x < motif.w; x++) {
      const ny = y + dy;
      if (ny >= 0 && ny < bodyRows) out[ny * motif.w + x] = motif.cells[y * motif.w + x];
    }
  return out;
}
