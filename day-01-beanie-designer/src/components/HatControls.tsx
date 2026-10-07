import { HAT_TYPES } from '../config/hatTypes';
import { HAT_SIZES } from '../config/sizes';
import { colorName } from '../lib/pattern';
import { useDesign } from '../store';
import { useSpec } from '../useSpec';
import { Icon } from './Icon';
import { HatGlyph } from './HatGlyph';

const fmt = (n: number) => (Math.round(n * 4) / 4).toString().replace('.25', '¼').replace('.5', '½').replace('.75', '¾');

export function HatControls() {
  const s = useDesign();
  const spec = useSpec();
  const type = spec.type;

  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2>Hat</h2>
          <p className="muted">Styles follow Purl Soho patterns; numbers update with your gauge.</p>
        </div>
      </header>

      <div className="field">
        <span className="field-label">Style</span>
        <div className="type-grid">
          {HAT_TYPES.map((t) => (
            <button
              key={t.id}
              className={`type-card ${s.hatTypeId === t.id ? 'on' : ''}`}
              onClick={() => s.setHatType(t.id)}
              aria-pressed={s.hatTypeId === t.id}
            >
              <HatGlyph type={t} />
              <span className="type-name">{t.name}</span>
              <span className="type-tag">{t.tagline}</span>
            </button>
          ))}
        </div>
        <a className="source-link" href={type.source.url} target="_blank" rel="noreferrer">
          <Icon name="external" size={13} /> {type.source.title}
        </a>
        {type.assumptions.length > 0 && <p className="note">{type.assumptions.join(' ')}</p>}
      </div>

      <div className="field">
        <span className="field-label">Size</span>
        <div className="seg seg-wide" role="radiogroup" aria-label="Size">
          {HAT_SIZES.map((z) => (
            <button
              key={z.id}
              className={s.sizeId === z.id ? 'on' : ''}
              onClick={() => s.set({ sizeId: z.id })}
              role="radio"
              aria-checked={s.sizeId === z.id}
            >
              <span>{z.name}</span>
              <small>
                {z.head[0]}–{z.head[1]}"
              </small>
            </button>
          ))}
        </div>
        {type.extrapolatedSizes.includes(spec.size.id) && (
          <p className="note">This size isn't in the source pattern — measurements are interpolated.</p>
        )}
      </div>

      <div className="field">
        <div className="field-row">
          <span className="field-label">Gauge over 4"</span>
          <label className="check">
            <input
              type="checkbox"
              checked={s.usePatternGauge}
              onChange={(e) =>
                s.set({ usePatternGauge: e.target.checked, ...(e.target.checked ? { gauge: { ...type.gauge } } : {}) })
              }
            />
            Use pattern gauge
          </label>
        </div>
        <div className="gauge">
          <label>
            <input
              type="number"
              step={0.5}
              min={8}
              max={48}
              value={s.gauge.sts}
              onChange={(e) => s.set({ usePatternGauge: false, gauge: { ...s.gauge, sts: Math.max(8, +e.target.value || 8) } })}
            />
            stitches
          </label>
          <label>
            <input
              type="number"
              step={0.5}
              min={8}
              max={64}
              value={s.gauge.rows}
              onChange={(e) => s.set({ usePatternGauge: false, gauge: { ...s.gauge, rows: Math.max(8, +e.target.value || 8) } })}
            />
            rounds
          </label>
        </div>
      </div>

      <div className="stats">
        <div>
          <b>{type.construction === 'top-down' ? spec.crown.endSts : spec.brimSts}</b>
          <span>{type.construction === 'top-down' ? 'cast on at crown' : 'cast on'}</span>
        </div>
        <div>
          <b>{spec.bodySts}</b>
          <span>sts around</span>
        </div>
        <div>
          <b>{spec.brimRows + spec.bodyRows + spec.crown.rows}</b>
          <span>rounds total</span>
        </div>
        <div>
          <b>
            {fmt(spec.finishedCircIn)}" × {fmt(spec.wornHeightIn)}"
          </b>
          <span>finished</span>
        </div>
      </div>

      <div className="field">
        <span className="field-label">Motif placement</span>
        <div className="seg seg-wide" role="radiogroup" aria-label="Motif placement">
          <button
            className={s.placement === 'repeat' ? 'on' : ''}
            onClick={() => s.set({ placement: 'repeat' })}
            role="radio"
            aria-checked={s.placement === 'repeat'}
          >
            Repeat around
          </button>
          <button
            className={s.placement === 'single' ? 'on' : ''}
            onClick={() => s.set({ placement: 'single' })}
            role="radio"
            aria-checked={s.placement === 'single'}
          >
            Once on the front
          </button>
        </div>
        {s.placement === 'repeat' && (
          <>
            <label className="check">
              <input type="checkbox" checked={s.tileVertical} onChange={(e) => s.set({ tileVertical: e.target.checked })} />
              Also repeat up the body (all-over pattern)
            </label>
            {spec.goodWidths.length > 0 && (
              <div className="widths">
                <span className="muted">Repeat widths that fit this size:</span>
                {spec.goodWidths.map((w) => (
                  <button key={w} className={`pill ${w === s.chart.w ? 'on' : ''}`} onClick={() => s.resize(w, s.chart.h)}>
                    {w}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {!(s.placement === 'repeat' && s.tileVertical) && (
          <label className="slider">
            <span>Height on the body</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={s.verticalPos}
              onChange={(e) => s.set({ verticalPos: +e.target.value })}
            />
          </label>
        )}
      </div>

      <div className="field two">
        <label className="mini">
          <span className="field-label">{type.brim.kind === 'rolled' ? 'Edge colour' : 'Brim colour'}</span>
          <select className="select" value={s.brimColor} onChange={(e) => s.set({ brimColor: +e.target.value })}>
            {s.palette.map((_, i) => (
              <option key={i} value={i}>
                {colorName(i)}
              </option>
            ))}
          </select>
        </label>
        <label className="mini">
          <span className="field-label">Pom-pom</span>
          <select
            className="select"
            value={s.pomPom ? s.pomColor : -1}
            onChange={(e) =>
              +e.target.value < 0 ? s.set({ pomPom: false }) : s.set({ pomPom: true, pomColor: +e.target.value })
            }
          >
            <option value={-1}>None</option>
            {s.palette.map((_, i) => (
              <option key={i} value={i}>
                {colorName(i)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {spec.warnings.length > 0 && (
        <ul className="warnings">
          {spec.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
