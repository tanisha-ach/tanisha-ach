import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getHatType } from './config/hatTypes';
import { MOTIFS } from './config/motifs';
import { floodFill, makeChart, resizeChart, type Chart } from './lib/chart';
import type { Placement } from './lib/spec';

export type Tool = 'paint' | 'fill' | 'pick';

export const DEFAULT_PALETTE = ['#f3ebdd', '#2f3b52', '#b5523b', '#e2b04a', '#6e8b74', '#8a5a83'];
export const MAX_COLORS = 6;

interface DesignState {
  chart: Chart;
  palette: string[];
  active: number;
  tool: Tool;
  mirror: boolean;
  past: Chart[];
  future: Chart[];

  hatTypeId: string;
  sizeId: string;
  usePatternGauge: boolean;
  gauge: { sts: number; rows: number };
  placement: Placement;
  verticalPos: number;
  tileVertical: boolean;
  brimColor: number;
  pomPom: boolean;
  pomColor: number;
  showHead: boolean;

  set: (p: Partial<DesignState>) => void;
  beginStroke: () => void;
  paint: (x: number, y: number) => void;
  fill: (x: number, y: number) => void;
  replaceChart: (c: Chart, palette?: string[]) => void;
  resize: (w: number, h: number) => void;
  undo: () => void;
  redo: () => void;
  setHatType: (id: string) => void;
  setColor: (i: number, hex: string) => void;
  addColor: () => void;
  removeColor: (i: number) => void;
}

const initialType = getHatType('plain-rib');

export const useDesign = create<DesignState>()(
  persist(
    (set, get) => ({
      chart: MOTIFS[0].chart,
      palette: DEFAULT_PALETTE.slice(0, 3),
      active: 1,
      tool: 'paint',
      mirror: false,
      past: [],
      future: [],

      hatTypeId: initialType.id,
      sizeId: 'adult-m',
      usePatternGauge: true,
      gauge: { ...initialType.gauge },
      placement: 'repeat',
      verticalPos: 0.5,
      tileVertical: false,
      brimColor: 0,
      pomPom: false,
      pomColor: 1,
      showHead: false,

      set: (p) => set(p),
      beginStroke: () => set((s) => ({ past: [...s.past.slice(-79), s.chart], future: [] })),
      paint: (x, y) =>
        set((s) => {
          const { chart, active, mirror } = s;
          const cells = chart.cells.slice();
          cells[y * chart.w + x] = active;
          if (mirror) cells[y * chart.w + (chart.w - 1 - x)] = active;
          return { chart: { ...chart, cells } };
        }),
      fill: (x, y) => {
        get().beginStroke();
        set((s) => ({ chart: floodFill(s.chart, x, y, s.active) }));
      },
      replaceChart: (c, palette) =>
        set((s) => ({ past: [...s.past.slice(-79), s.chart], future: [], chart: c, ...(palette ? { palette } : {}) })),
      resize: (w, h) => set((s) => ({ past: [...s.past, s.chart], future: [], chart: resizeChart(s.chart, w, h) })),
      undo: () =>
        set((s) =>
          s.past.length ? { chart: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.chart, ...s.future] } : {},
        ),
      redo: () =>
        set((s) => (s.future.length ? { chart: s.future[0], future: s.future.slice(1), past: [...s.past, s.chart] } : {})),
      setHatType: (id) =>
        set((s) => {
          const t = getHatType(id);
          return { hatTypeId: id, ...(s.usePatternGauge ? { gauge: { ...t.gauge } } : {}) };
        }),
      setColor: (i, hex) => set((s) => ({ palette: s.palette.map((c, j) => (j === i ? hex : c)) })),
      addColor: () =>
        set((s) =>
          s.palette.length >= MAX_COLORS
            ? {}
            : {
                palette: [...s.palette, DEFAULT_PALETTE.find((c) => !s.palette.includes(c)) ?? '#999999'],
                active: s.palette.length,
              },
        ),
      removeColor: (i) =>
        set((s) => {
          if (i === 0 || s.palette.length <= 2) return {};
          const remap = (v: number) => (v === i ? 0 : v > i ? v - 1 : v);
          return {
            palette: s.palette.filter((_, j) => j !== i),
            chart: { ...s.chart, cells: s.chart.cells.map(remap) },
            active: Math.min(s.active, s.palette.length - 2),
            brimColor: remap(s.brimColor),
            pomColor: remap(s.pomColor),
          };
        }),
    }),
    {
      name: 'beanie-designer',
      version: 1,
      partialize: ({ past: _p, future: _f, tool: _t, ...rest }) => rest,
    },
  ),
);

export const blankChart = (w: number, h: number) => makeChart(w, h);
