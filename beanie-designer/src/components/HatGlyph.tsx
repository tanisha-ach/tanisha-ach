import type { HatType } from '../config/hatTypes';

/** Small line drawing of each hat silhouette, derived from its proportions. */
export function HatGlyph({ type }: { type: HatType }) {
  const d = type.sizes['adult-m'];
  const h = Math.min(1, d.heightIn / 13);
  const top = 44 - 34 * h;
  const brim = type.brim.kind === 'rolled' ? 0 : Math.min(14, (type.brim.kind === 'fold-cuff' ? d.brimIn / 2 : d.brimIn) * 3.2);
  const body = `M10 44 L10 ${top + 10} Q10 ${top} 26 ${top} Q42 ${top} 42 ${top + 10} L42 44 Z`;
  return (
    <svg className="glyph" viewBox="0 0 52 50" aria-hidden>
      <path d={body} />
      {brim > 0 && (
        <rect
          x={type.brim.kind === 'rib' ? 10 : 8.5}
          y={44 - brim}
          width={type.brim.kind === 'rib' ? 32 : 35}
          height={brim}
          rx={type.brim.kind === 'rib' ? 0 : 2}
          className="glyph-brim"
        />
      )}
      {brim > 0 &&
        Array.from({ length: 7 }, (_, i) => (
          <line key={i} x1={13 + i * 4.3} x2={13 + i * 4.3} y1={44 - brim + 1.5} y2={42.5} className="glyph-rib" />
        ))}
      {type.brim.kind === 'rolled' && <rect x={8.5} y={42} width={35} height={4} rx={2} className="glyph-brim" />}
    </svg>
  );
}
