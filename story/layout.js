/* Pure logic for "Time sorts": story.json -> per-chapter particle slots. No DOM, no GL,
 * so node can test it (test/story.test.mjs). Modelled on stanford-theatre/site/story/layout.js.
 *
 * One dot is one thing in the Which Came First? pool, the same dot in every chapter. The
 * columns chapters stack things by kind; a scatter chapter puts every thing at its
 * percentile within its own kind, x by year (oldest 0, newest 1) and y by fame (sitelinks,
 * least 0, most 1), and lights one kind. A layout is N slots of [x, y, colour, alpha] in
 * plot space: x, y in 0..1, y up. Every number the prose prints is computed by build_story.py. */

/* The dots, in story.json's order (most famous first). */
export function dots(D) {
  return D.dots.map(([k, x, y], i) => {
    if (!D.kinds[k]) throw new Error(`dot ${i}: kind ${k}`);
    if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) throw new Error(`dot ${i}: percentile ${x},${y} outside 0..1`);
    return { i, k, kind: D.kinds[k].k, x, y };
  });
}

/* Colours are palette indices (story.js): 0 ink, 1 purple, 2 orange, 3 green, 4 blue, 5 grey. */
export const C = { ink: 0, purple: 1, orange: 2, green: 3, blue: 4, grey: 5 };

export const TOP = 0.9; // the plot's top tenth is left for the value labels

export const jit = (i, k) => (((i * 2654435761 + k * 40503) >>> 0) % 1000) / 1000 - 0.5;

export const PAD = { l: 0.08, r: 0.03, b: 0.04, t: 0.03 };
export const sx = (x) => PAD.l + x * (1 - PAD.l - PAD.r);
export const sy = (y) => PAD.b + y * (TOP - PAD.b - PAD.t);

/* A scatter chapter lights one kind (data-kind="scatter:album"). */
export function scatter(ds, D, lit) {
  if (!D.kinds.some((r) => r.k === lit && r.bands)) throw new Error(`no scatter for ${lit}`);
  const slots = new Float32Array(ds.length * 4);
  for (const d of ds) {
    const on = d.kind === lit;
    // jitter under half a percentile step of the smallest kind, so a dot stays in its rank
    slots.set([sx(d.x + jit(d.i, 1) * 0.004), sy(d.y + jit(d.i, 2) * 0.004), on ? C.purple : C.grey, on ? 1 : 0.18], d.i * 4);
  }
  return { kind: 'scatter', lit, slots };
}

/* The fewest dots a row (so the biggest dots) that still fit the tallest column under TOP,
 * with square cells in a plot of aspect a. */
export function perRow(maxN, K, a, top = TOP) {
  const barW = (1 / K) * 0.8;
  for (let k = 1; k <= 200; k++) if (Math.ceil(maxN / k) * (barW / k) * a <= top) return k;
  throw new Error(`no row width fits ${maxN} dots`);
}

/* Columns: one per kind, in story.json's order. `colour(r, D)` is the kind's colour:
 * "kinds" lights none; "verdict" lights the kinds sorted by time, greys the small ones. */
export const COLS = {
  kinds: { colour: () => C.blue },
  verdict: { colour: (r) => (r.sorted ? C.purple : 'rho' in r ? C.blue : C.grey) },
};
export function columns(ds, D, a, name) {
  const spec = COLS[name];
  if (!spec) throw new Error(`unknown columns ${name}`);
  const K = D.kinds.length, n = new Array(K).fill(0);
  for (const d of ds) n[d.k]++;
  const per = perRow(Math.max(...n), K, a), colW = 1 / K, barW = colW * 0.8, cw = barW / per, chh = cw * a;
  const slots = new Float32Array(ds.length * 4), at = new Array(K).fill(0);
  for (const d of ds) {
    const j = at[d.k]++, r = Math.floor(j / per), c = j % per;
    slots.set([d.k * colW + (colW - barW) / 2 + (c + 0.5) * cw, (r + 0.5) * chh, spec.colour(D.kinds[d.k], D), 1], d.i * 4);
  }
  return { kind: 'columns', chart: name, slots, per, cell: cw, K, count: n };
}
