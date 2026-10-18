const valley = (ch: string) => ch === 'P' || ch === 'S';

/** Runs of raised (knit) columns in one repeat: [start, length]. */
function raisedRuns(rib: string): [number, number][] {
  const n = rib.length;
  const first = [...rib].findIndex(valley);
  if (first < 0) return [];
  const runs: [number, number][] = [];
  let i = 0;
  while (i < n) {
    const at = (first + i) % n;
    if (valley(rib[at])) {
      i++;
      continue;
    }
    let m = 0;
    while (m < n && !valley(rib[(at + m) % n])) m++;
    runs.push([at, m]);
    i += m;
  }
  return runs;
}

const cache = new Map<string, { runs: [number, number][]; w: number }>();

/**
 * Relief across a rib, 0 at the bottom of a purl valley to 1 on a knit crest;
 * `x` is measured in stitches. Each group of knit columns forms one rounded
 * ridge that pulls in over its purl or slip neighbours until neighbouring
 * ridges meet in a crease, as relaxed ribbing does, with a faint groove
 * between the knit columns. Patterns without valleys return 1.
 */
export function ribRelief(rib: string, x: number): number {
  let hit = cache.get(rib);
  if (!hit) {
    const runs = raisedRuns(rib);
    const raised = runs.reduce((s, [, m]) => s + m, 0);
    cache.set(rib, (hit = { runs, w: runs.length ? (rib.length - raised) / runs.length / 2 : 0 }));
  }
  const { runs, w } = hit;
  if (!runs.length) return 1;
  const n = rib.length;
  const xm = ((x % n) + n) % n;
  let h = 0;
  for (const [s, m] of runs) {
    for (const off of [-n, 0, n]) {
      const d = xm - (s + off);
      const u = (d + w) / (m + 2 * w);
      if (u <= 0 || u >= 1) continue;
      let v = Math.sin(Math.PI * u) ** 0.6;
      if (d > 0.5 && d < m - 0.5) v *= 1 - 0.1 * Math.cos(Math.PI * d) ** 8;
      h = Math.max(h, v);
    }
  }
  return h;
}
