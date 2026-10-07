import { useEffect, useMemo, useState } from 'react';
import { patternToText, writePattern } from '../lib/pattern';
import { download } from '../lib/chartExport';
import { useDesign } from '../store';
import { useSpec } from '../useSpec';
import { Icon } from './Icon';

export function usePatternText() {
  const spec = useSpec();
  const s = useDesign();
  const sections = useMemo(
    () =>
      writePattern(spec, {
        chart: s.chart,
        palette: s.palette,
        placement: s.placement,
        tileVertical: s.tileVertical,
        brimColor: s.brimColor,
        pomPom: s.pomPom,
      }),
    [spec, s.chart, s.palette, s.placement, s.tileVertical, s.brimColor, s.pomPom],
  );
  return { spec, sections, text: patternToText(sections) };
}

export function PatternDialog({ onClose }: { onClose: () => void }) {
  const { spec, sections, text } = usePatternText();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div className="scrim" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal aria-label="Written pattern" onClick={(e) => e.stopPropagation()}>
        <header className="dialog-head">
          <div>
            <p className="eyebrow">Written pattern</p>
            <h2>{sections[0].title}</h2>
          </div>
          <div className="row-actions">
            <button
              className="btn ghost"
              onClick={() => {
                navigator.clipboard?.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Icon name="copy" /> {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              className="btn primary"
              onClick={() =>
                download(
                  URL.createObjectURL(new Blob([text], { type: 'text/plain' })),
                  `${spec.type.id}-${spec.size.id}-pattern.txt`,
                )
              }
            >
              <Icon name="download" /> .txt
            </button>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
        </header>
        <div className="dialog-body">
          {sections.map((sec, i) => (
            <section key={sec.title} className={i === 0 ? 'intro' : ''}>
              {i > 0 && <h3>{sec.title}</h3>}
              {sec.lines.map((l, j) => {
                const m = l.match(/^([^:]{2,40}):\s(.*)$/);
                return (
                  <p key={j}>
                    {m && i > 0 && i < sections.length - 1 ? (
                      <>
                        <b>{m[1]}:</b> {m[2]}
                      </>
                    ) : l.startsWith('Proportions from') ? (
                      <a href={spec.type.source.url} target="_blank" rel="noreferrer">
                        {l}
                      </a>
                    ) : (
                      l
                    )}
                  </p>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
