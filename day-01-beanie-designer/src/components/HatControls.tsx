import { useDesign } from '../store';
import { useSpec } from '../useSpec';

export function HatControls() {
  const s = useDesign();
  const spec = useSpec();
  const type = spec.type;
  const g = { sts: spec.stsPerIn * 4, rows: spec.rowsPerIn * 4 };

  return (
    <section className="card">
      <div className="field">
        <div className="field-row">
          <span className="field-label">Your gauge over 4"</span>
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
              min={6}
              max={48}
              value={g.sts}
              onChange={(e) => s.set({ usePatternGauge: false, gauge: { ...g, sts: Math.max(6, +e.target.value || 6) } })}
            />
            stitches
          </label>
          <label>
            <input
              type="number"
              step={0.5}
              min={6}
              max={64}
              value={g.rows}
              onChange={(e) => s.set({ usePatternGauge: false, gauge: { ...g, rows: Math.max(6, +e.target.value || 6) } })}
            />
            rounds
          </label>
        </div>
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
