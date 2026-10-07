import { useMemo } from 'react';
import { computeSpec } from './lib/spec';
import { useDesign } from './store';

export function useSpec() {
  const hatTypeId = useDesign((s) => s.hatTypeId);
  const sizeId = useDesign((s) => s.sizeId);
  const gauge = useDesign((s) => s.gauge);
  const chart = useDesign((s) => s.chart);
  const placement = useDesign((s) => s.placement);
  const verticalPos = useDesign((s) => s.verticalPos);
  const tileVertical = useDesign((s) => s.tileVertical);
  // Only the chart's dimensions affect the spec; repainting cells shouldn't recompute it.
  const { w, h } = chart;
  return useMemo(
    () => computeSpec({ hatTypeId, sizeId, gauge, chart: { w, h, cells: [] }, placement, verticalPos, tileVertical }),
    [hatTypeId, sizeId, gauge, w, h, placement, verticalPos, tileVertical],
  );
}
