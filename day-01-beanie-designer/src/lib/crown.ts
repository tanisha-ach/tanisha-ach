import type { CrownStyle } from '../config/hatTypes';

/** A column of shaping stitches repeated in every section of the crown. */
export interface ShapingMark {
  /** Stitch offset from the section start (negative = from the section end). */
  offset: number;
  lean: 'left' | 'right';
}

export interface CrownPlan {
  /** Stitches on the needles where crown shaping begins (bottom-up) or ends (top-down). */
  sts: number;
  /** Number of rounds in the crown. */
  rows: number;
  /** Stitches left to cinch (bottom-up) or cast on (top-down). */
  endSts: number;
  /** Shaping rounds, 0-indexed from the start of the crown (knitting order). */
  shapingRows: number[];
  /** Shaping lines, for drawing the wedges. */
  visualSections: number;
  marks: ShapingMark[];
  /** Written instructions, one round or step per entry. */
  steps: string[];
}

/** Multiple (and remainder) the stitch count must satisfy entering the crown. */
export function crownMultiple(style: CrownStyle): { mult: number; rem: number } {
  switch (style.kind) {
    case 'wedge':
      return { mult: style.sections, rem: 0 };
    case 'paired':
      // Pairs of decreases finish neatly on an odd count per section.
      return style.finishTo3 ? { mult: style.sections, rem: 0 } : { mult: style.sections * 2, rem: style.sections };
    case 'top-down':
      return { mult: style.sections, rem: 0 };
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

export function planCrown(style: CrownStyle, sts: number, stsPerIn: number): CrownPlan {
  switch (style.kind) {
    case 'wedge':
      return planWedge(style, sts);
    case 'paired':
      return planPaired(style, sts);
    case 'top-down':
      return planTopDown(style, sts, stsPerIn);
  }
}

function planWedge(style: Extract<CrownStyle, { kind: 'wedge' }>, sts: number): CrownPlan {
  const S = style.sections;
  const s = Math.round(sts / S);
  const switchAt = Math.min(style.everyOtherUntilPerSection, s);
  const slow = s - switchAt;
  const fast = switchAt - style.endPerSection;
  const shapingRows: number[] = [];
  let r = 0;
  for (let i = 0; i < slow; i++, r += 2) shapingRows.push(r);
  for (let i = 0; i < fast; i++, r += 1) shapingRows.push(r);
  const steps = [`Set-Up Round: *K${s}, place marker; repeat from * to end of round. [${S} sections of ${s} sts]`];
  if (slow > 0) {
    steps.push(`Decrease Round: *Knit to 2 sts before marker, k2tog, slip marker; repeat from * to end. [${S} sts decreased]`);
    steps.push('Next Round: Knit.');
    if (slow > 1) steps.push(`Repeat the last 2 rounds ${plural(slow - 1, 'more time')}. [${switchAt * S} sts remain]`);
  }
  if (fast > 0) {
    steps.push(`Work the Decrease Round every round ${times(fast)}. [${style.endPerSection * S} sts remain]`);
  }
  return {
    sts: s * S,
    rows: r,
    endSts: style.endPerSection * S,
    shapingRows,
    visualSections: S,
    marks: [{ offset: -1, lean: 'right' }],
    steps,
  };
}

function planPaired(style: Extract<CrownStyle, { kind: 'paired' }>, sts: number): CrownPlan {
  const S = style.sections;
  const s = Math.round(sts / S);
  const minPer = style.finishTo3 ? 4 : 3;
  const D = Math.max(1, Math.floor((s - minPer) / 2));
  const after = s - 2 * D;
  const n3 = Math.max(0, Math.round((D - 1) * style.thirdRoundShare));
  const n2 = D - 1 - n3;
  const shapingRows = [0];
  let r = 0;
  for (let i = 0; i < n3; i++) shapingRows.push((r += 3));
  for (let i = 0; i < n2; i++) shapingRows.push((r += 2));
  let rows = r + (style.finishTo3 ? 1 : 2);
  let endSts = after * S;
  const finish = after === 5 ? 'K1, s2kp, k1' : after === 4 ? 'K1, k2tog, k1' : null;
  if (style.finishTo3 && finish) rows += 1;

  const b = style.border;
  const dec = b
    ? `*K1, ssk, knit to 3 sts before marker, k2tog, k1, slip marker; repeat from * to end.`
    : `[Ssk, knit to 2 sts before marker, k2tog, slip marker] ${S} times.`;
  const steps: string[] = [];
  if (style.shiftStart) {
    steps.push(`Set-Up: Remove end-of-round marker, k${style.shiftStart}, and place the end-of-round marker here.`);
  }
  steps.push(`Set-Up Round: *K${s}, place marker; repeat from * to end of round. [${S} sections of ${s} sts]`);
  steps.push(`Decrease Round: ${dec} [${2 * S} sts decreased]`);
  if (n3 > 0 || n2 > 0) {
    if (style.thirdRoundShare > 0) {
      const parts = [];
      if (n3) parts.push(`every 3rd round ${plural(n3, 'more time')}`);
      if (n2) parts.push(`${n3 ? 'then ' : ''}every 2nd round ${times(n2)}`);
      steps.push(`Repeat the Decrease Round ${parts.join(', ')}. [${after * S} sts remain]`);
    } else {
      steps.push('Next Round: Knit.');
      steps.push(`Repeat the last 2 rounds ${plural(D - 1, 'more time')}. [${after * S} sts remain]`);
    }
  } else if (!style.thirdRoundShare) {
    steps.push('Next Round: Knit.');
  }
  if (style.finishTo3 && finish) {
    steps.push(`Next Round: *${finish}; repeat from * to end of round. [${3 * S} sts remain]`);
    endSts = 3 * S;
  }
  return {
    sts: s * S,
    rows,
    endSts,
    shapingRows,
    visualSections: S,
    marks: [
      { offset: b, lean: 'left' },
      { offset: -1 - b, lean: 'right' },
    ],
    steps,
  };
}

function planTopDown(style: Extract<CrownStyle, { kind: 'top-down' }>, sts: number, stsPerIn: number): CrownPlan {
  const S = style.sections;
  const target = Math.max(S * 3, Math.round(sts / S) * S);
  const switchSts = Math.max(S * 2, Math.round((style.everyThirdAboveIn * stsPerIn) / S) * S);
  const k1 = (Math.min(target, switchSts) - 2 * S) / S;
  const k2 = Math.max(0, (target - switchSts) / S);
  const needles = S / 2;
  const shapingRows = [0];
  let r = 0;
  for (let i = 0; i < k1; i++) shapingRows.push((r += 2));
  for (let i = 0; i < k2; i++) shapingRows.push((r += 3));
  const firstStop = Math.min(target, switchSts);
  const steps = [
    `Cast ${S} sts onto ${needles} double-pointed needles (${S / needles} per needle). Place marker and join to work in the round.`,
    `Round 1: [Kfb] ${S} times. [${2 * S} sts]`,
    'Round 2: Knit.',
    `Round 3: *K1, RLI, knit to last st on needle, LLI; repeat for each needle. [${S} sts increased]`,
  ];
  if (k1 > 1) steps.push(`Repeat Rounds 2 and 3 ${plural(k1 - 1, 'more time')}. [${firstStop} sts]`);
  if (k2 > 0) {
    steps.push('Next 2 Rounds: Knit.');
    steps.push(`Next Round: Work Round 3 (increase). [${firstStop + S} sts]`);
    if (k2 > 1) steps.push(`Repeat the last 3 rounds ${plural(k2 - 1, 'more time')}. [${target} sts]`);
  }
  return {
    sts: target,
    rows: r + 1,
    endSts: S,
    shapingRows,
    visualSections: needles,
    marks: [
      { offset: 1, lean: 'right' },
      { offset: -2, lean: 'left' },
    ],
    steps,
  };
}
