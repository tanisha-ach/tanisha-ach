import { lazy, Suspense, useState } from 'react';
import { ChartEditor } from './components/ChartEditor';
import { HatControls } from './components/HatControls';
import { Icon } from './components/Icon';
import { ImageImport } from './components/ImageImport';
import { PatternDialog, usePatternText } from './components/PatternDialog';
import { download, renderChartPng } from './lib/chartExport';
import { useDesign } from './store';

const HatViewer = lazy(() => import('./components/HatViewer').then((m) => ({ default: m.HatViewer })));

export default function App() {
  const [showPattern, setShowPattern] = useState(false);
  const { spec, sections } = usePatternText();
  const chart = useDesign((s) => s.chart);
  const palette = useDesign((s) => s.palette);
  const glance = sections[sections.length - 1];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            <svg viewBox="0 0 32 32">
              <path d="M5 24V16a11 11 0 0 1 22 0v8z" />
              <rect x="4" y="22" width="24" height="6" rx="2" />
              <circle cx="16" cy="4.5" r="3" />
            </svg>
          </span>
          <div>
            <h1>Beanie Designer</h1>
            <p>Colorwork hat studio</p>
          </div>
        </div>
        <div className="row-actions">
          <button
            className="btn ghost"
            onClick={() => download(renderChartPng(chart, palette, spec), `${spec.type.id}-${spec.size.id}-chart.png`)}
          >
            <Icon name="download" /> Chart PNG
          </button>
          <button className="btn primary" onClick={() => setShowPattern(true)}>
            <Icon name="doc" /> Written pattern
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="left">
          <ChartEditor />
          <HatControls />
          <ImageImport />
        </div>
        <div className="right">
          <div className="viewer-card">
            <Suspense fallback={<div className="viewer loading">Loading 3D preview…</div>}>
              <HatViewer />
            </Suspense>
          </div>
          <div className="glance card">
            {glance.lines.map((l) => {
              const [k, v] = l.split(': ');
              return (
                <div key={l}>
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      {showPattern && <PatternDialog onClose={() => setShowPattern(false)} />}
    </div>
  );
}
