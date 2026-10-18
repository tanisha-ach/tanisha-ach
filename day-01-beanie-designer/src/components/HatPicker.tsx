import { useState, type CSSProperties } from 'react';
import { HAT_TYPES } from '../config/hatTypes';
import { HAT_SIZES } from '../config/sizes';
import { useDesign } from '../store';
import { useSpec } from '../useSpec';
import { HatGlyph } from './HatGlyph';
import { Icon } from './Icon';

export function HatPicker({ locked = false }: { locked?: boolean }) {
  const s = useDesign();
  const spec = useSpec();
  const [open, setOpen] = useState(true);
  const sizeIdx = Math.max(0, HAT_SIZES.findIndex((z) => z.id === s.sizeId));
  const hat = HAT_TYPES.find((t) => t.id === s.hatTypeId);
  const hatName = hat?.name ?? 'Beanie';

  if (locked) {
    return (
      <div className="hat-picker-panel locked">
        <div className="collapse-head locked-head">
          <span className="collapse-title">
            <span className="field-label" style={{ marginBottom: 0 }}>
              Beanie type & size
            </span>
            <span className="collapse-summary">
              {hatName} · {spec.size.name} · {spec.size.head[0]}–{spec.size.head[1]}"
            </span>
          </span>
        </div>
        <p className="muted lock-hint">Edit the chart to change type or size.</p>
      </div>
    );
  }

  return (
    <div className={`hat-picker-panel ${open ? '' : 'collapsed'}`}>
      <button
        type="button"
        className="collapse-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="collapse-title">
          <span className="field-label" style={{ marginBottom: 0 }}>
            Beanie type & size
          </span>
          {!open && (
            <span className="collapse-summary">
              {hatName} · {spec.size.name}
            </span>
          )}
        </span>
        <Icon name="down" size={16} />
      </button>

      {open && (
        <div className="collapse-body">
          <div className="field">
            <span className="field-label">Beanie type</span>
            <div className="type-grid type-grid-compact">
              {HAT_TYPES.map((t) => (
                <button
                  key={t.id}
                  className={`type-card compact ${s.hatTypeId === t.id ? 'on' : ''}`}
                  onClick={() => s.setHatType(t.id)}
                  aria-pressed={s.hatTypeId === t.id}
                >
                  <HatGlyph type={t} />
                  <span className="type-name">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="width-slider-head">
              <span className="field-label" style={{ marginBottom: 0 }}>
                Size
              </span>
              <b>
                {spec.size.name} · {spec.size.head[0]}–{spec.size.head[1]}"
              </b>
            </div>
            <div
              className="width-steps size-steps"
              role="radiogroup"
              aria-label="Size"
              style={
                {
                  '--progress': `${(sizeIdx / Math.max(1, HAT_SIZES.length - 1)) * 100}%`,
                } as CSSProperties
              }
            >
              <span className="width-line" aria-hidden />
              {HAT_SIZES.map((z, i) => (
                <button
                  key={z.id}
                  type="button"
                  role="radio"
                  className={`width-step ${i <= sizeIdx ? 'filled' : ''} ${i === sizeIdx ? 'on' : ''}`}
                  aria-checked={i === sizeIdx}
                  onClick={() => s.set({ sizeId: z.id })}
                  title={`${z.name} ${z.head[0]}–${z.head[1]}"`}
                >
                  <span className="width-dot" />
                  <span className="width-num">{z.name.replace('Adult ', '')}</span>
                </button>
              ))}
            </div>
            {spec.type.extrapolatedSizes.includes(spec.size.id) && (
              <p className="note note-compact" title="This size isn't in the source pattern — measurements are interpolated.">
                Size interpolated from pattern proportions
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
