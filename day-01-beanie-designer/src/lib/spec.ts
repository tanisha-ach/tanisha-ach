import { getHatType, type HatType, type SizeSpec } from '../config/hatTypes';
import { getSize, type HatSize } from '../config/sizes';
import type { Chart } from './chart';
import { crownMultiple, planCrown, type CrownPlan } from './crown';

export type Placement = 'repeat' | 'single';

export interface DesignInput {
  hatTypeId: string;
  sizeId: string;
  gauge: { sts: number; rows: number };
  chart: Chart;
  placement: Placement;
  /** 0 = chart sits at the bottom of the body, 1 = at the top. */
  verticalPos: number;
  tileVertical: boolean;
}

export interface HatSpec {
  type: HatType;
  size: HatSize;
  dims: SizeSpec;
  stsPerIn: number;
  rowsPerIn: number;
  targetSts: number;
  /** Bottom-up: cast-on. Top-down: stitches at the end of the crown. */
  brimSts: number;
  bodySts: number;
  crown: CrownPlan;
  /** Knitted brim rounds (fold-cuff/rib: full rib; hem-cuff: both layers). */
  brimRows: number;
  /** Physical height of the brim band as worn, inches (0 for rolled). */
  brimBandIn: number;
  /** For fold-cuff: rib folded up to the outside, inches. */
  foldIn: number;
  bodyRows: number;
  bodyIn: number;
  crownIn: number;
  /** Finished height as worn, inches. */
  wornHeightIn: number;
  finishedCircIn: number;
  repeats: number;
  chartStartCol: number;
  chartStartRow: number;
  chartRowsShown: number;
  goodWidths: number[];
  warnings: string[];
}

const nearest = (target: number, mult: number, rem = 0, min = mult) =>
  Math.max(min, Math.round((target - rem) / mult) * mult + rem);

export function computeSpec(input: DesignInput): HatSpec {
  const type = getHatType(input.hatTypeId);
  const size = getSize(input.sizeId);
  const dims = type.sizes[size.id];
  const stsPerIn = input.gauge.sts / 4;
  const rowsPerIn = input.gauge.rows / 4;
  const { chart } = input;
  const warnings: string[] = [];

  const targetSts = dims.circIn * stsPerIn;
  const cm = crownMultiple(type.crown);
  let bodySts: number;
  if (input.placement === 'repeat') {
    bodySts = nearest(targetSts, chart.w, 0, chart.w);
  } else {
    bodySts = nearest(targetSts, cm.mult, cm.rem);
    if (chart.w > bodySts) warnings.push(`The chart is ${chart.w} sts wide but the hat only has ${bodySts} sts around.`);
  }
  // Cast on a multiple of the rib; an adjustment round reaches the body count, as the source patterns do.
  const brimSts = type.construction === 'top-down' ? bodySts : nearest(bodySts, type.brim.rib.length);
  const crownSts = nearest(bodySts, cm.mult, cm.rem, cm.mult + cm.rem);
  const crown = planCrown(type.crown, crownSts, stsPerIn);
  const crownIn = crown.rows / rowsPerIn;

  let brimRows = 0;
  let brimBandIn = 0;
  let foldIn = 0;
  switch (type.brim.kind) {
    case 'rib':
      brimRows = Math.round(dims.brimIn * rowsPerIn);
      brimBandIn = dims.brimIn;
      break;
    case 'fold-cuff':
      brimRows = Math.round(dims.brimIn * rowsPerIn);
      foldIn = dims.brimIn * (type.brim.foldShare ?? 0.5);
      brimBandIn = dims.brimIn - foldIn;
      break;
    case 'hem-cuff':
      brimRows = Math.round(2 * dims.brimIn * rowsPerIn * (type.brim.rowFactor ?? 1));
      brimBandIn = dims.brimIn;
      break;
    case 'rolled':
      brimRows = 0;
      brimBandIn = 0;
      break;
  }

  // Body = everything between the brim band and the crown, in knitted length.
  const rollIn = type.brim.kind === 'rolled' ? (type.brim.rollIn ?? 0.5) : 0;
  const bodyIn = Math.max(0.5, dims.heightIn + rollIn - brimBandIn - foldIn - crownIn);
  const bodyRows = Math.max(2, Math.round(bodyIn * rowsPerIn));
  const wornHeightIn = dims.heightIn - foldIn;

  const finishedCircIn = bodySts / stsPerIn;
  const drift = finishedCircIn / dims.circIn - 1;
  if (input.placement === 'repeat' && Math.abs(drift) > 0.04) {
    warnings.push(
      `${chart.w}-st repeats make the hat ${Math.abs(drift * 100).toFixed(0)}% ${drift > 0 ? 'bigger' : 'smaller'} than the pattern's ${dims.circIn}" — try one of the suggested widths.`,
    );
  }

  const repeats = input.placement === 'repeat' ? bodySts / chart.w : 1;
  const chartStartCol = Math.floor(bodySts / 2 - chart.w / 2);
  const chartRowsShown = Math.min(chart.h, bodyRows);
  if (chart.h > bodyRows)
    warnings.push(`The chart has ${chart.h} rows but the body only has ${bodyRows}; the top rows are cut off.`);
  const chartStartRow = Math.round(Math.max(0, bodyRows - chart.h) * input.verticalPos);

  const goodWidths: number[] = [];
  for (let w = 4; w <= 40; w++) {
    const n = nearest(targetSts, w, 0, w);
    if (Math.abs(n / targetSts - 1) <= 0.025) goodWidths.push(w);
  }

  return {
    type,
    size,
    dims,
    stsPerIn,
    rowsPerIn,
    targetSts,
    brimSts,
    bodySts,
    crown,
    brimRows,
    brimBandIn,
    foldIn,
    bodyRows,
    bodyIn,
    crownIn,
    wornHeightIn,
    finishedCircIn,
    repeats,
    chartStartCol,
    chartStartRow,
    chartRowsShown,
    goodWidths,
    warnings,
  };
}

/** Palette index of a body stitch; row 0 = first body round above the brim. */
export function bodyCell(spec: HatSpec, chart: Chart, placement: Placement, tile: boolean, col: number, row: number): number {
  let rr = row - spec.chartStartRow;
  if (placement === 'repeat' && tile) rr = ((rr % chart.h) + chart.h) % chart.h;
  if (rr < 0 || rr >= chart.h) return 0;
  let cc = col - spec.chartStartCol;
  if (placement === 'repeat') cc = ((cc % chart.w) + chart.w) % chart.w;
  else if (cc < 0 || cc >= chart.w) return 0;
  return chart.cells[(chart.h - 1 - rr) * chart.w + cc];
}
