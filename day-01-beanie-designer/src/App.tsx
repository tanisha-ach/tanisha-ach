import { lazy, Suspense, useEffect, useState } from 'react';
import logo from './assets/logo.png';
import { ChartEditor } from './components/ChartEditor';
import { ChartStage } from './components/ChartStage';
import { HatPicker } from './components/HatPicker';
import { Icon } from './components/Icon';
import { PatternPanel } from './components/PatternPanel';
import { usePatternText } from './components/PatternDialog';
import { download, renderChartPng } from './lib/chartExport';
import { useDesign } from './store';

const HatViewer = lazy(() => import('./components/HatViewer').then((m) => ({ default: m.HatViewer })));

type ViewTab = 'chart' | 'model';

export default function App() {
  const [shareMsg, setShareMsg] = useState('');
  const [showPattern, setShowPattern] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>('model');
  const { spec } = usePatternText();
  const chart = useDesign((s) => s.chart);
  const palette = useDesign((s) => s.palette);

  useEffect(() => {
    setViewTab(showPattern ? 'chart' : 'model');
  }, [showPattern]);

  const shareLink = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Beanie Designer', url, text: 'Check out this beanie design' });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareMsg('Link copied');
      window.setTimeout(() => setShareMsg(''), 2000);
    } catch {
      setShareMsg('Couldn’t share');
      window.setTimeout(() => setShareMsg(''), 2000);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">
            <img src={logo} alt="" width={42} height={42} />
          </span>
          <div>
            <h1>Beanie Designer</h1>
          </div>
        </div>
        <div className="row-actions">
          <button
            className="btn ghost"
            onClick={() => download(renderChartPng(chart, palette, spec), `${spec.type.id}-${spec.size.id}-chart.png`)}
          >
            <Icon name="download" /> Save chart
          </button>
          <button className="btn primary" onClick={shareLink}>
            <Icon name="external" /> {shareMsg || 'Share link'}
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="left">
          {showPattern ? (
            <PatternPanel onEdit={() => setShowPattern(false)} />
          ) : (
            <ChartEditor onGenerate={() => setShowPattern(true)} />
          )}
        </div>
        <div className="right">
          <div className="viewer-card">
            <HatPicker locked={showPattern} />
            {showPattern && (
              <div className="viewer-tabs" role="tablist" aria-label="Preview">
                <button
                  type="button"
                  role="tab"
                  className={viewTab === 'chart' ? 'on' : ''}
                  aria-selected={viewTab === 'chart'}
                  onClick={() => setViewTab('chart')}
                >
                  Chart
                </button>
                <button
                  type="button"
                  role="tab"
                  className={viewTab === 'model' ? 'on' : ''}
                  aria-selected={viewTab === 'model'}
                  onClick={() => setViewTab('model')}
                >
                  3D model
                </button>
              </div>
            )}
            <div className="viewer-stage">
              {showPattern && viewTab === 'chart' ? (
                <ChartStage />
              ) : (
                <Suspense fallback={<div className="viewer loading">Warming up the needles…</div>}>
                  <HatViewer />
                </Suspense>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
