import type { SizeId } from './sizes';

/**
 * Hat styles, each modelled on a Purl Soho pattern. Proportions are stored in
 * inches per size so they translate to any gauge; the 3D model, chart and
 * written pattern all read from this config. To add a style, add an entry
 * here (and a crown style in lib/crown.ts if it needs a new decrease scheme).
 */

export type BrimKind =
  /** Single-layer rib worn straight. */
  | 'rib'
  /** Rib knit long and folded up to the outside. */
  | 'fold-cuff'
  /** Rib knit twice the depth and hemmed to the inside (double layer). */
  | 'hem-cuff'
  /** No rib — stockinette edge left to roll. */
  | 'rolled';

/**
 * Rib columns, repeated around. K = knit, P = purl, S = slipped stitch
 * (slip-stitch rib: the S column is slipped on every other round).
 */
export type RibPattern = string;

export type CrownStyle =
  /** N wedges, one k2tog at the end of each wedge. */
  | { kind: 'wedge'; sections: number; everyOtherUntilPerSection: number; endPerSection: number }
  /** Paired ssk … k2tog at the edges of each section, every other round. */
  | { kind: 'paired'; sections: number; border: 0 | 1; thirdRoundShare: number; finishTo3: boolean; shiftStart: number }
  /** Top-down: cast on at the crown and increase in wedges. */
  | { kind: 'top-down'; sections: number; everyThirdAboveIn: number };

export interface SizeSpec {
  /** Finished circumference at the body, inches. */
  circIn: number;
  /** Finished height, brim edge to crown, inches (uncuffed for fold-cuff). */
  heightIn: number;
  /**
   * Brim depth as the pattern measures it: rib length before folding (rib,
   * fold-cuff), finished cuff depth (hem-cuff, knit twice as long), or the
   * curl allowance (rolled).
   */
  brimIn: number;
}

export interface HatType {
  id: string;
  name: string;
  tagline: string;
  source: { title: string; url: string };
  construction: 'bottom-up' | 'top-down';
  /** Pattern gauge over 4 inches in stockinette. */
  gauge: { sts: number; rows: number };
  brim: {
    kind: BrimKind;
    rib: RibPattern;
    label: string;
    /** For fold-cuff: share of the rib folded up to the outside. */
    foldShare?: number;
    /** Row-gauge multiplier for the brim stitch relative to stockinette. */
    rowFactor?: number;
    /** Inches the edge curls (rolled brims). */
    rollIn?: number;
  };
  crown: CrownStyle;
  /** 0 = snug, 1 = very slouchy (crown droops to the back). */
  slouch: number;
  sizes: Record<SizeId, SizeSpec>;
  /** Sizes that were extrapolated rather than taken from the source pattern. */
  extrapolatedSizes: SizeId[];
  /** Plain-language notes on anything not stated in the source pattern. */
  assumptions: string[];
}

export const HAT_TYPES: HatType[] = [
  {
    id: 'plain-rib',
    name: 'Plain hat with rib',
    tagline: 'The classic: k2, p2 rib and a stockinette body worked bottom-up.',
    source: {
      title: 'Purl Soho — Hat In The Round',
      url: 'https://www.purlsoho.com/create/2015/07/06/learn-to-knit-a-hat-in-the-round-kit/',
    },
    construction: 'bottom-up',
    gauge: { sts: 18, rows: 24 },
    brim: { kind: 'rib', rib: 'KKPP', label: 'k2, p2 rib' },
    crown: { kind: 'wedge', sections: 8, everyOtherUntilPerSection: 5, endPerSection: 1 },
    slouch: 0,
    sizes: {
      baby: { circIn: 13.25, heightIn: 6.5, brimIn: 1.25 },
      toddler: { circIn: 15, heightIn: 7, brimIn: 1.5 },
      child: { circIn: 16.75, heightIn: 7.75, brimIn: 1.5 },
      'adult-s': { circIn: 18.5, heightIn: 8.25, brimIn: 1.75 },
      'adult-m': { circIn: 19.5, heightIn: 8.5, brimIn: 1.75 },
      'adult-l': { circIn: 20.5, heightIn: 9, brimIn: 1.75 },
    },
    extrapolatedSizes: ['baby', 'adult-m'],
    assumptions: [
      'The full instructions are a paid booklet; only sizes, finished circumference, gauge and the k2, p2 rib are published.',
      'Rib depth, total height and the 8-wedge crown are standard proportions, not taken from the booklet.',
    ],
  },
  {
    id: 'plain-no-rib',
    name: 'Plain hat, no rib',
    tagline: 'Knit top-down from a 6-wedge crown; the stockinette edge rolls.',
    source: {
      title: 'Purl Soho — Essential Hat, Mitten + Hand Warmer Set',
      url: 'https://www.purlsoho.com/create/2019/09/20/essential-hat-mitten-and-hand-warmer-set/',
    },
    construction: 'top-down',
    gauge: { sts: 18, rows: 28 },
    brim: { kind: 'rolled', rib: 'K', label: 'rolled stockinette edge', rollIn: 0.5 },
    crown: { kind: 'top-down', sections: 6, everyThirdAboveIn: 16 },
    slouch: 0,
    sizes: {
      baby: { circIn: 12, heightIn: 6.5, brimIn: 0.5 },
      toddler: { circIn: 14.75, heightIn: 7.5, brimIn: 0.5 },
      child: { circIn: 16, heightIn: 8.5, brimIn: 0.5 },
      'adult-s': { circIn: 18.75, heightIn: 9, brimIn: 0.5 },
      'adult-m': { circIn: 19.5, heightIn: 9.5, brimIn: 0.5 },
      'adult-l': { circIn: 20, heightIn: 10, brimIn: 0.5 },
    },
    extrapolatedSizes: ['adult-m'],
    assumptions: [],
  },
  {
    id: 'short-rib',
    name: 'Short hat with rib',
    tagline: 'A shallow hat with a hemmed, double-layer slip-stitch rib cuff.',
    source: {
      title: 'Purl Soho — Classic Hat + Mittens in Wigeon',
      url: 'https://www.purlsoho.com/create/2024/02/05/classic-hat-mittens-in-wigeon/',
    },
    construction: 'bottom-up',
    gauge: { sts: 28, rows: 36 },
    brim: { kind: 'hem-cuff', rib: 'KKS', label: 'k2, slip 1 rib, hemmed', rowFactor: 46 / 36 },
    crown: { kind: 'paired', sections: 5, border: 1, thirdRoundShare: 0.33, finishTo3: true, shiftStart: 0 },
    slouch: 0,
    sizes: {
      baby: { circIn: 13.75, heightIn: 5.75, brimIn: 2.25 },
      toddler: { circIn: 15.5, heightIn: 6.25, brimIn: 2.5 },
      child: { circIn: 17.25, heightIn: 7, brimIn: 3 },
      'adult-s': { circIn: 19.25, heightIn: 8, brimIn: 3 },
      'adult-m': { circIn: 20.5, heightIn: 8.5, brimIn: 3 },
      'adult-l': { circIn: 22.25, heightIn: 9.25, brimIn: 3 },
    },
    extrapolatedSizes: ['baby', 'toddler'],
    assumptions: [],
  },
  {
    id: 'cuffed',
    name: 'Hat with cuff',
    tagline: 'Tall p2, k2 ribbed brim folded up into a cuff; 4-section crown.',
    source: {
      title: 'Purl Soho — Giving Hat',
      url: 'https://www.purlsoho.com/create/2025/12/06/giving-hat/',
    },
    construction: 'bottom-up',
    gauge: { sts: 17.5, rows: 25 },
    brim: { kind: 'fold-cuff', rib: 'PPKK', label: 'p2, k2 rib, folded', foldShare: 0.5 },
    crown: { kind: 'paired', sections: 4, border: 0, thirdRoundShare: 0, finishTo3: false, shiftStart: 3 },
    slouch: 0.18,
    sizes: {
      baby: { circIn: 13.75, heightIn: 10, brimIn: 3.5 },
      toddler: { circIn: 15.5, heightIn: 10.5, brimIn: 4 },
      child: { circIn: 17.5, heightIn: 11.5, brimIn: 4.5 },
      'adult-s': { circIn: 19.25, heightIn: 12.25, brimIn: 5 },
      'adult-m': { circIn: 20.25, heightIn: 12.75, brimIn: 5 },
      'adult-l': { circIn: 21, heightIn: 13.25, brimIn: 5 },
    },
    extrapolatedSizes: ['adult-m'],
    assumptions: ['The pattern does not say how far to fold the cuff; the model folds about half the ribbing.'],
  },
];

export const getHatType = (id: string): HatType => HAT_TYPES.find((t) => t.id === id) ?? HAT_TYPES[0];
