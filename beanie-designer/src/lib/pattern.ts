import type { Chart } from './chart';
import { longestFloat } from './chart';
import type { HatSpec, Placement } from './spec';

export interface PatternSection {
  title: string;
  lines: string[];
}

export interface PatternOptions {
  chart: Chart;
  palette: string[];
  placement: Placement;
  tileVertical: boolean;
  brimColor: number;
  pomPom: boolean;
}

export const colorName = (i: number) => (i === 0 ? 'MC' : `CC${i}`);

const inch = (n: number) => {
  const q = Math.round(n * 4) / 4;
  const whole = Math.floor(q);
  const frac = ['', '¼', '½', '¾'][Math.round((q - whole) * 4)];
  return `${whole || !frac ? whole : ''}${frac}"`;
};

function ribRound(rib: string): string {
  const groups: string[] = [];
  let i = 0;
  while (i < rib.length) {
    let j = i;
    while (j < rib.length && rib[j] === rib[i]) j++;
    const n = j - i;
    const word = rib[i] === 'K' ? 'k' : rib[i] === 'P' ? 'p' : 'slip ';
    groups.push(`${word}${n}`);
    i = j;
  }
  const s = groups.join(', ');
  return `*${s.charAt(0).toUpperCase()}${s.slice(1)}; repeat from * to end of round.`;
}

function adjustRound(from: number, to: number): string | null {
  if (from === to) return null;
  const d = Math.abs(to - from);
  return to > from
    ? `Next Round: Increase ${d} st${d > 1 ? 's' : ''} evenly around (m1 every ${Math.floor(from / d)} sts or so). [${to} sts]`
    : `Next Round: Decrease ${d} st${d > 1 ? 's' : ''} evenly around (k2tog every ${Math.floor(from / d)} sts or so). [${to} sts]`;
}

function chartLines(spec: HatSpec, o: PatternOptions, topDown: boolean): string[] {
  const { chart } = o;
  const rows = spec.chartRowsShown;
  const lines: string[] = [];
  const rangeTxt = topDown ? `Rounds ${rows} down to 1` : `Rounds 1–${rows}`;
  const readTxt = topDown
    ? ' Work the chart from the top row down so the motif is the right way up when the hat is worn; read every round from right to left.'
    : ' Read every round from right to left.';
  if (o.placement === 'repeat') {
    lines.push(
      `Work ${rangeTxt} of the Chart, repeating the ${chart.w}-st repeat ${spec.repeats} times around.${readTxt}`,
    );
    if (o.tileVertical) lines.push('Continue repeating the Chart rounds until the body length below is reached.');
  } else {
    const after = spec.bodySts - spec.chartStartCol - chart.w;
    lines.push(
      `Set-Up Round: With MC, k${spec.chartStartCol}, place marker, work the first chart round over the next ${chart.w} sts, place marker, k${after} with MC.`,
    );
    lines.push(`Continue working ${rangeTxt} of the Chart between the markers, with MC outside them.${readTxt}`);
  }
  const float = longestFloat(chart);
  if (float > 5) lines.push(`Note: the longest float is ${float} sts — catch floats every 4–5 sts.`);
  return lines;
}

export function writePattern(spec: HatSpec, o: PatternOptions): PatternSection[] {
  const { type, size, dims } = spec;
  const topDown = type.construction === 'top-down';
  const sections: PatternSection[] = [];
  const colors = o.palette.map((c, i) => `${colorName(i)}: ${c.toUpperCase()}`);

  sections.push({
    title: `${type.name} — ${size.name}`,
    lines: [
      `Fits a head of ${size.head[0]}–${size.head[1]}".`,
      `Finished circumference: ${inch(spec.finishedCircIn)} (${spec.bodySts} sts). Finished height: ${inch(spec.wornHeightIn)}${type.brim.kind === 'fold-cuff' ? ' with the cuff folded' : ''}.`,
      `Gauge: ${spec.stsPerIn * 4} sts and ${spec.rowsPerIn * 4} rounds = 4" in stockinette (the source pattern uses ${type.gauge.sts} sts and ${type.gauge.rows} rounds).`,
      `Colours — ${colors.join(' · ')}`,
      `Proportions from ${type.source.title}: ${type.source.url}`,
      ...type.assumptions.map((a) => `Note: ${a}`),
      ...(type.extrapolatedSizes.includes(size.id)
        ? [`Note: the ${size.name} size is not in the source pattern; its measurements are interpolated from neighbouring sizes.`]
        : []),
    ],
  });

  const bc = colorName(o.brimColor);
  const plainBefore = spec.chartStartRow;
  const plainAfter = Math.max(0, spec.bodyRows - spec.chartStartRow - spec.chartRowsShown);

  if (topDown) {
    const crown = [...spec.crown.steps];
    crown[0] = crown[0].replace('Cast', `With MC, cast`);
    const adj = adjustRound(spec.crown.sts, spec.bodySts);
    if (adj) crown.push(adj);
    sections.push({ title: 'Crown', lines: crown });
    const body: string[] = [];
    if (!o.tileVertical || o.placement === 'single') {
      if (plainAfter) body.push(`With MC, knit ${plainAfter} rounds.`);
    }
    body.push(...chartLines(spec, o, true));
    body.push(
      `With ${bc}, knit every round until the piece measures ${inch(dims.heightIn + (type.brim.rollIn ?? 0))} from the cast-on edge with the edge unrolled (the edge rolls about ${inch(type.brim.rollIn ?? 0.5)}).`,
    );
    body.push('Bind off all stitches loosely knitwise.');
    sections.push({ title: 'Body', lines: body });
  } else {
    const brim: string[] = [];
    if (type.brim.kind === 'hem-cuff') {
      brim.push(`With scrap yarn, use a Provisional Cast On to cast on ${spec.brimSts} sts. Place marker and join to work in the round.`);
      brim.push(`Change to ${bc}. Round 1: Knit.`);
      brim.push(`Round 2: ${ribRound(type.brim.rib).replace('slip 1', 'slip 1 purlwise wyib')}`);
      brim.push(
        `Repeat Rounds 1 and 2 until the piece measures ${inch(dims.brimIn * 2)} from the cast-on edge (about ${spec.brimRows} rounds), ending with Round 2.`,
      );
      brim.push(
        'Hem: Fold the cast-on edge up inside the cuff. Slip the provisional stitches onto a spare needle, removing the scrap yarn. Holding the needles parallel, knit together 1 st from the front needle with 1 st from the back needle all the way around.',
      );
    } else {
      brim.push(`With ${bc}, cast on ${spec.brimSts} sts (Long Tail Cast On). Place marker and join to work in the round, being careful not to twist.`);
      brim.push(`Round 1: ${ribRound(type.brim.rib)}`);
      brim.push(`Repeat Round 1 until the piece measures ${inch(dims.brimIn)} from the cast-on edge (about ${spec.brimRows} rounds).`);
    }
    const adj = adjustRound(spec.brimSts, spec.bodySts);
    if (adj) brim.push(adj);
    sections.push({ title: type.brim.kind === 'hem-cuff' ? 'Cuff' : 'Brim', lines: brim });

    const body: string[] = [];
    if (plainBefore && (!o.tileVertical || o.placement === 'single')) body.push(`With MC, knit ${plainBefore} rounds.`);
    body.push(...chartLines(spec, o, false));
    const from = type.brim.kind === 'hem-cuff' ? 'the folded edge of the cuff' : 'the cast-on edge';
    body.push(
      `With MC, knit every round until the piece measures ${inch(dims.heightIn - spec.crownIn)} from ${from}, or ${inch(spec.crownIn)} less than the desired height.`,
    );
    const adj2 = adjustRound(spec.bodySts, spec.crown.sts);
    if (adj2) body.push(adj2);
    sections.push({ title: 'Body', lines: body });

    sections.push({
      title: 'Crown',
      lines: [
        'Change to double-pointed needles (or Magic Loop) when the stitches no longer reach around.',
        ...spec.crown.steps,
        `Cut the yarn, thread the tail through the remaining ${spec.crown.endSts} sts, pull taut and take the tail to the inside.`,
      ],
    });
  }

  const finishing = ['Weave in all ends and wet block gently.'];
  if (type.brim.kind === 'fold-cuff') finishing.push(`Fold the brim up ${inch(spec.foldIn)} to the outside to form the cuff.`);
  if (o.pomPom) finishing.push('Make a 3" pom-pom and sew it securely to the top of the crown.');
  sections.push({ title: 'Finishing', lines: finishing });

  sections.push({
    title: 'At a glance',
    lines: [
      `${topDown ? 'Cast on at crown' : 'Cast on'}: ${topDown ? spec.crown.endSts : spec.brimSts} sts`,
      `Body: ${spec.bodySts} sts × ${spec.bodyRows} rounds`,
      `${type.brim.kind === 'rolled' ? 'Rolled edge' : 'Brim'}: ${type.brim.label}${spec.brimRows ? `, ${spec.brimRows} rounds` : ''}`,
      topDown
        ? `Crown: ${spec.crown.rows} rounds, increasing ${spec.crown.endSts} → ${spec.crown.sts} sts`
        : `Crown: ${spec.crown.rows} rounds, decreasing ${spec.crown.sts} → ${spec.crown.endSts} sts in ${spec.crown.visualSections} sections`,
    ],
  });
  return sections;
}

export const patternToText = (sections: PatternSection[]) =>
  sections.map((s) => `${s.title.toUpperCase()}\n${s.lines.map((l) => `  ${l}`).join('\n')}`).join('\n\n');
