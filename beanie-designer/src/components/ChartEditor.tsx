import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MOTIFS } from '../config/motifs';
import { flipChart, longestFloat, makeChart, shiftChart } from '../lib/chart';
import { colorName } from '../lib/pattern';
import { MAX_COLORS, useDesign, type Tool } from '../store';
import { useSpec } from '../useSpec';
import { Icon } from './Icon';

const LABEL = 22;

export function ChartEditor() {
  const s = useDesign();
  const spec = useSpec();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrapW, setWrapW] = useState(600);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const painting = useRef(false);
  const last = useRef<[number, number] | null>(null);
  const { chart, palette } = s;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWrapW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cell = Math.max(8, Math.min(30, Math.floor((wrapW - LABEL - 4) / chart.w)));
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
    ctx.font = `${Math.min(10, cell * 0.6)}px Inter, system-ui, sans-serif`;
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
    // Mid-stroke, clamp to the edge so fast drags past the grid still reach the last cell.
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
    // Fill in cells skipped between pointer events on a fast drag.
    const [x0, y0] = first || !last.current ? p : last.current;
    const n = Math.max(Math.abs(p[0] - x0), Math.abs(p[1] - y0));
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      st.paint(Math.round(x0 + (p[0] - x0) * t), Math.round(y0 + (p[1] - y0) * t));
    }
    last.current = p;
  };

  const onKey = useCallback((e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
    const st = useDesign.getState();
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) st.redo();
      else st.undo();
    } else if (e.key === 'b') st.set({ tool: 'paint' });
    else if (e.key === 'g') st.set({ tool: 'fill' });
    else if (e.key === 'i') st.set({ tool: 'pick' });
    else if (e.key === 'm') st.set({ mirror: !st.mirror });
    else if (/^[1-6]$/.test(e.key) && +e.key <= st.palette.length) st.set({ active: +e.key - 1 });
  }, []);
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  const tools: { id: Tool; label: string; icon: Parameters<typeof Icon>[0]['name']; key: string }[] = [
    { id: 'paint', label: 'Paint', icon: 'brush', key: 'B' },
    { id: 'fill', label: 'Fill', icon: 'bucket', key: 'G' },
    { id: 'pick', label: 'Pick colour', icon: 'picker', key: 'I' },
  ];
  const float = longestFloat(chart);

  return (
    <section className="card chart-card">
      <header className="card-head">
        <div>
          <h2>Colorwork chart</h2>
          <p className="muted">
            {chart.w} sts × {chart.h} rounds ·{' '}
            {s.placement === 'repeat' ? `${spec.repeats} repeats around ${spec.bodySts} sts` : 'placed once on the front'}
          </p>
        </div>
        <select
          className="select"
          aria-label="Load a motif"
          value=""
          onChange={(e) => {
            const m = MOTIFS.find((m) => m.id === e.target.value);
            if (m) s.replaceChart(m.chart);
            else if (e.target.value === 'blank') s.replaceChart(makeChart(chart.w, chart.h));
          }}
        >
          <option value="" disabled>
            Load motif…
          </option>
          {MOTIFS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.chart.w}×{m.chart.h})
            </option>
          ))}
          <option value="blank">Blank chart</option>
        </select>
      </header>

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Tool">
          {tools.map((t) => (
            <button
              key={t.id}
              className={s.tool === t.id ? 'on' : ''}
              onClick={() => s.set({ tool: t.id })}
              title={`${t.label} (${t.key})`}
              aria-pressed={s.tool === t.id}
            >
              <Icon name={t.icon} />
            </button>
          ))}
          <button
            className={s.mirror ? 'on' : ''}
            onClick={() => s.set({ mirror: !s.mirror })}
            title="Mirror painting (M)"
            aria-pressed={s.mirror}
          >
            <Icon name="mirror" />
          </button>
        </div>
        <div className="seg" role="group" aria-label="History">
          <button onClick={s.undo} disabled={!s.past.length} title="Undo (Ctrl+Z)">
            <Icon name="undo" />
          </button>
          <button onClick={s.redo} disabled={!s.future.length} title="Redo (Ctrl+Shift+Z)">
            <Icon name="redo" />
          </button>
        </div>
        <div className="seg" role="group" aria-label="Transform">
          <button onClick={() => s.replaceChart(shiftChart(chart, -1, 0))} title="Shift left">
            <Icon name="left" />
          </button>
          <button onClick={() => s.replaceChart(shiftChart(chart, 1, 0))} title="Shift right">
            <Icon name="right" />
          </button>
          <button onClick={() => s.replaceChart(shiftChart(chart, 0, -1))} title="Shift up">
            <Icon name="up" />
          </button>
          <button onClick={() => s.replaceChart(shiftChart(chart, 0, 1))} title="Shift down">
            <Icon name="down" />
          </button>
          <button onClick={() => s.replaceChart(flipChart(chart))} title="Flip horizontally">
            <Icon name="flip" />
          </button>
        </div>
        <div className="dims">
          <label>
            W
            <input
              type="number"
              min={2}
              max={Math.max(2, s.placement === 'single' ? spec.bodySts : 60)}
              value={chart.w}
              onChange={(e) =>
                s.resize(Math.max(2, Math.min(s.placement === 'single' ? spec.bodySts : 60, +e.target.value || 2)), chart.h)
              }
            />
          </label>
          <label>
            H
            <input
              type="number"
              min={1}
              max={spec.bodyRows}
              value={chart.h}
              onChange={(e) => s.resize(chart.w, Math.max(1, Math.min(120, +e.target.value || 1)))}
            />
          </label>
        </div>
      </div>

      <div className="palette" role="radiogroup" aria-label="Colours">
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

      <div className="grid-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          style={{ width: cssW, height: cssH, cursor: s.tool === 'pick' ? 'copy' : 'crosshair' }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            painting.current = true;
            apply(e, true);
          }}
          onPointerMove={(e) => {
            const p = cellAt(e);
            setHover(p);
            if (painting.current && s.tool === 'paint') apply(e, false);
          }}
          onPointerUp={() => {
            painting.current = false;
            last.current = null;
          }}
          onPointerLeave={() => setHover(null)}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Colorwork chart grid"
        />
      </div>
      <div className="chart-foot">
        <span>
          {hover
            ? `Stitch ${chart.w - hover[0]}, round ${chart.h - hover[1]}`
            : 'Click or drag to paint. Charts read right to left, bottom to top.'}
        </span>
        {float > 5 && <span className="warn-pill">Longest float {float} sts</span>}
      </div>
    </section>
  );
}
