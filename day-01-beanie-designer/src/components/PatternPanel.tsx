import { useMemo, useState } from 'react';
import { download } from '../lib/chartExport';
import type { HatSpec } from '../lib/spec';
import { videoForTechnique } from '../lib/techniqueVideos';
import { Icon } from './Icon';
import { usePatternText } from './PatternDialog';

const TERM_KEY: { term: string; meaning: string }[] = [
  { term: 'sts', meaning: 'stitches' },
  { term: 'rnd', meaning: 'one full circle of knitting' },
  { term: 'MC', meaning: 'main colour (background)' },
  { term: 'CC', meaning: 'contrast colour' },
  { term: 'k', meaning: 'knit' },
  { term: 'p', meaning: 'purl' },
  { term: 'k2tog', meaning: 'knit 2 together (decrease)' },
  { term: 'm1', meaning: 'make 1 (increase)' },
  { term: '/', meaning: 'decrease on the crown chart' },
];

function expandAbbreviations(line: string) {
  return line.replace(/\bwyib\b/gi, 'with yarn in back').replace(/\bwyif\b/gi, 'with yarn in front');
}

function parseDetailLines(lines: string[]) {
  const details: { label: string; value: string }[] = [];
  const notes: string[] = [];
  let source: string | null = null;

  for (const l of lines) {
    if (l.startsWith('Fits a head')) details.push({ label: 'Fit', value: l.replace(/^Fits a head of\s*/i, '') });
    else if (l.startsWith('Finished circumference')) details.push({ label: 'Finished size', value: l });
    else if (l.startsWith('Gauge:')) details.push({ label: 'Gauge', value: l.replace(/^Gauge:\s*/i, '') });
    else if (l.startsWith('Colours')) details.push({ label: 'Colours', value: l.replace(/^Colours\s*[—–-]\s*/i, '') });
    else if (l.startsWith('Proportions from')) source = l;
    else if (l.startsWith('Note:')) notes.push(l.replace(/^Note:\s*/i, ''));
    else details.push({ label: 'Detail', value: l });
  }
  return { details, notes, source };
}

function stitchTechniques(spec: HatSpec, instructionText: string): string[] {
  const techs: string[] = ['Knit in the round', 'Reading a colorwork chart', 'Stranded colorwork (carrying floats)'];
  const rib = spec.type.brim.rib;
  if (rib.includes('P')) techs.push('Knit/purl ribbing');
  if (rib.includes('S')) techs.push('Slip stitches purlwise with yarn in back');
  if (spec.type.brim.kind === 'hem-cuff') techs.push('Provisional cast-on', 'Hemming a cuff');
  if (spec.type.brim.kind === 'fold-cuff') techs.push('Folding a cuff');
  if (spec.type.brim.kind === 'rolled') techs.push('Leaving a rolled stockinette edge');
  if (/k2tog/i.test(instructionText)) techs.push('k2tog decreases');
  if (/\bssk\b/i.test(instructionText)) techs.push('ssk decreases');
  if (/m1|RLI|LLI|Kfb/i.test(instructionText)) techs.push('Increases (m1 / RLI / LLI / kfb)');
  if (/Magic Loop|double-pointed/i.test(instructionText)) techs.push('Double-pointed needles or Magic Loop');
  return [...new Set(techs)];
}

function isRoundLine(line: string) {
  return /^(Round\s+\d+|Next Round|Set-Up Round|Repeat Round)/i.test(line);
}

export function PatternPanel({ onEdit }: { onEdit: () => void }) {
  const { spec, sections, text } = usePatternText();
  const [copied, setCopied] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);

  const intro = sections[0];
  const instructionSections = useMemo(
    () => sections.filter((s, i) => i > 0 && s.title !== 'At a glance'),
    [sections],
  );
  const { details, notes, source } = useMemo(() => parseDetailLines(intro?.lines ?? []), [intro]);
  const techniques = useMemo(
    () => stitchTechniques(spec, instructionSections.flatMap((s) => s.lines).join('\n')),
    [spec, instructionSections],
  );

  const renderLineBody = (l: string) => {
    const line = expandAbbreviations(l);
    const m = line.match(/^([^:]{2,40}):\s(.*)$/);
    const round = isRoundLine(line);
    if (m && round) {
      return (
        <>
          <b className="round-label">{m[1]}</b>
          <span>{m[2]}</span>
        </>
      );
    }
    if (m) {
      return (
        <>
          <b>{m[1]}:</b> {m[2]}
        </>
      );
    }
    return line;
  };

  let step = 0;

  return (
    <section className="card chart-card pattern-panel">
      <header className="card-head">
        <div>
          <p className="eyebrow">Your knitting pattern</p>
          <h2>{intro?.title ?? 'Pattern'}</h2>
        </div>
        <div className="row-actions">
          <button type="button" className="btn ghost" onClick={onEdit}>
            <Icon name="pencil" /> Edit chart
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              navigator.clipboard?.writeText(expandAbbreviations(text));
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Icon name="copy" /> {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              download(
                URL.createObjectURL(new Blob([expandAbbreviations(text)], { type: 'text/plain' })),
                `${spec.type.id}-${spec.size.id}-pattern.txt`,
              )
            }
          >
            <Icon name="download" /> Save
          </button>
        </div>
      </header>

      <section className="pattern-block pattern-details">
        <header className="pattern-block-head">
          <h3>Pattern details</h3>
          <p className="muted pattern-section-lede">Everything you need before casting on.</p>
        </header>
        <dl className="detail-grid">
          {details.map((d) => (
            <div key={d.label + d.value} className="detail-row">
              <dt>{d.label}</dt>
              <dd>{d.value}</dd>
            </div>
          ))}
          <div className="detail-row techniques-row">
            <dt>Techniques</dt>
            <dd>
              <ul className="technique-bullets">
                {techniques.map((t) => {
                  const href = videoForTechnique(t);
                  return (
                    <li key={t}>
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer">
                          {t}
                          <Icon name="external" size={12} />
                        </a>
                      ) : (
                        t
                      )}
                    </li>
                  );
                })}
              </ul>
            </dd>
          </div>
          {source && (
            <div className="detail-row">
              <dt>Source</dt>
              <dd>
                Proportions from{' '}
                <a href={spec.type.source.url} target="_blank" rel="noreferrer">
                  {spec.type.source.title}
                </a>
              </dd>
            </div>
          )}
        </dl>
        {notes.length > 0 && (
          <ul className="pattern-notes">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </section>

      <section className={`pattern-block pattern-term-key ${keyOpen ? 'open' : ''}`}>
        <button type="button" className="collapse-head pattern-key-toggle" aria-expanded={keyOpen} onClick={() => setKeyOpen((v) => !v)}>
          <span className="collapse-title">
            <span className="field-label" style={{ marginBottom: 0 }}>
              Knitting terms
            </span>
            {!keyOpen && <span className="collapse-summary">sts, MC, k2tog, and more</span>}
          </span>
          <Icon name="down" size={16} />
        </button>
        {keyOpen && (
          <dl>
            {TERM_KEY.map((row) => (
              <div key={row.term} className="term-row">
                <dt>{row.term}</dt>
                <dd>{row.meaning}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <div className="pattern-instructions">
        <header className="pattern-block-head">
          <h3>Instructions</h3>
          <p className="muted pattern-section-lede">Follow the sections in order, from cast-on to finishing.</p>
        </header>

        {instructionSections.map((sec, i) => (
          <section key={sec.title} id={`pattern-step-${i + 1}`} className="instruction-section">
            <header className="instruction-head">
              <h4>{sec.title}</h4>
            </header>
            <div className="instruction-lines">
              {sec.lines.map((l, j) => {
                step += 1;
                const n = step;
                const round = isRoundLine(expandAbbreviations(l));
                return (
                  <div key={j} className={`step-row ${round ? 'round-line' : ''}`}>
                    <span className="step-marker">Step {n}</span>
                    <div className="step-body">{renderLineBody(l)}</div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
