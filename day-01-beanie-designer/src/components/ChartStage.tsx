import { useEffect, useMemo, useRef, useState } from 'react';
import { renderChartPng } from '../lib/chartExport';
import { useDesign } from '../store';
import { useSpec } from '../useSpec';

const ZOOM_MIN = 0.75;
const ZOOM_MAX = 3;

export function ChartStage() {
  const chart = useDesign((s) => s.chart);
  const palette = useDesign((s) => s.palette);
  const spec = useSpec();
  const [zoom, setZoom] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panning = useRef(false);
  const panOrigin = useRef({ x: 0, y: 0, left: 0, top: 0 });
  const chartUrl = useMemo(() => renderChartPng(chart, palette, spec), [chart, palette, spec]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => {
        const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * (e.deltaY < 0 ? 1.12 : 0.9)));
        return Math.round(next * 100) / 100;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const nudgeZoom = (dir: 1 | -1) => {
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + dir * 0.25) * 100) / 100)));
  };

  return (
    <div className="chart-stage">
      <div className="chart-stage-bar">
        <span className="field-label" style={{ marginBottom: 0 }}>
          Colorwork chart
        </span>
        <div className="seg compact pattern-zoom-seg" role="group" aria-label="Chart zoom">
          <button type="button" onClick={() => nudgeZoom(-1)} disabled={zoom <= ZOOM_MIN} title="Zoom out">
            −
          </button>
          <button type="button" onClick={() => setZoom(1)} title="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={() => nudgeZoom(1)} disabled={zoom >= ZOOM_MAX} title="Zoom in">
            +
          </button>
        </div>
      </div>
      <div
        className="chart-stage-preview"
        ref={wrapRef}
        onPointerDown={(e) => {
          if (e.button !== 0 && e.button !== 1) return;
          const wrap = wrapRef.current;
          if (!wrap || zoom <= 1) return;
          panning.current = true;
          panOrigin.current = { x: e.clientX, y: e.clientY, left: wrap.scrollLeft, top: wrap.scrollTop };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!panning.current) return;
          const wrap = wrapRef.current;
          if (!wrap) return;
          wrap.scrollLeft = panOrigin.current.left - (e.clientX - panOrigin.current.x);
          wrap.scrollTop = panOrigin.current.top - (e.clientY - panOrigin.current.y);
        }}
        onPointerUp={() => {
          panning.current = false;
        }}
      >
        <img
          src={chartUrl}
          alt="Colorwork chart"
          style={{ width: `${zoom * 100}%`, maxWidth: 'none', cursor: zoom > 1 ? 'grab' : 'default' }}
          draggable={false}
        />
      </div>
    </div>
  );
}
