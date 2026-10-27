// Which Came First? — the page's pure logic. No DOM; imported by app.js and the test.
//
// pool.json items are [label, year, kind, sitelinks, qid, description], most famous first.
// A year below zero is BC, counted the way historians do: -140 is 140 BC.

export const ROUNDS = 10;
// Year gap for each round of a day: centuries apart first, a year or two last.
export const BANDS = [
  [150, 3000], [60, 300], [30, 120], [15, 60], [8, 30], [5, 18], [3, 10], [2, 6], [1, 4], [1, 2],
];
export const VERB = {
  discovery: 'discovered or invented', film: 'released', book: 'published', game: 'released',
  album: 'released', song: 'released', painting: 'painted', tv: 'first aired', company: 'founded',
  landmark: 'built',
};
export const KIND = {
  discovery: 'Invention or discovery', film: 'Film', book: 'Book', game: 'Video game', album: 'Album',
  song: 'Song', painting: 'Painting', tv: 'TV series', company: 'Company', landmark: 'Landmark',
};

// FNV-1a: a date string to a 32-bit seed.
export function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// mulberry32: small, fast, and the same sequence in every browser.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const item = (r) => ({ name: r[0], year: r[1], kind: r[2], fame: r[3], q: r[4], desc: r[5] || '' });

// Two of a kind is a trivia question about that kind; two kinds is the game.
export function fits(a, b, [lo, hi]) {
  const d = Math.abs(a.year - b.year);
  return a.kind !== b.kind && d >= lo && d <= hi;
}

// The pool is most famous first. Squaring a uniform draw leans every pick toward the top
// without ruling out the long tail: the median pick sits a quarter of the way down.
const draw = (r, n) => Math.floor(r() * r() * n);

// The day's pairs. Each pair is [i, j] into `items`, in the order shown (left, right).
// Nothing appears twice in a day. A band nothing fits (a tiny pool) widens until one does.
export function pairsFor(items, seedStr, n = ROUNDS) {
  const r = rng(hash(seedStr));
  const C = items.map(item);
  const used = new Set();
  const out = [];
  for (let k = 0; k < n; k++) {
    let [lo, hi] = BANDS[Math.min(k, BANDS.length - 1)];
    let pair = null;
    for (let widen = 0; !pair && widen < 6; widen++) {
      for (let t = 0; t < 4000 && !pair; t++) {
        const i = draw(r, C.length), j = draw(r, C.length);
        if (i === j || used.has(i) || used.has(j)) continue;
        if (fits(C[i], C[j], [lo, hi])) pair = r() < 0.5 ? [i, j] : [j, i];
      }
      lo = Math.max(1, Math.floor(lo / 2)); hi *= 2;
    }
    if (!pair) break;
    used.add(pair[0]); used.add(pair[1]);
    out.push(pair);
  }
  return out;
}

// Which side came first: 0 (left) or 1 (right). Ties never get picked (every band starts
// at a gap of at least a year), but count a tie as either side right.
export function firstIndex(a, b) { return a.year <= b.year ? 0 : 1; }
export function isRight(a, b, pick) { return a.year === b.year || firstIndex(a, b) === pick; }

export function fmtYear(y) {
  return y < 0 ? `${-y} BC` : String(y);
}

export function gapWords(a, b) {
  // Across the BC/AD line there is no year 0: 1 BC to AD 1 is one year.
  let d = Math.abs(a.year - b.year);
  if ((a.year < 0) !== (b.year < 0)) d -= 1;
  return d === 1 ? '1 year' : `${d.toLocaleString('en-US')} years`;
}

export function verdict(a, b) {
  const [f, s] = firstIndex(a, b) === 0 ? [a, b] : [b, a];
  return `${f.name} (${fmtYear(f.year)}) came ${gapWords(a, b)} before ${s.name} (${fmtYear(s.year)}).`;
}

export function caption(c) {
  return `${KIND[c.kind] || c.kind} · ${VERB[c.kind] || 'dated'}`;
}

// Local calendar date, so "today's ten" turns over at the player's midnight.
export function dayKey(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// The first day a daily ten was served. ?day= plays any day from here up to yesterday.
export const FIRST_DAY = '2026-10-26';

// Twenty cards had wrong years until 2026-10-28 (projects/first-years/). Days before that
// were dealt from the old list and stay as they were played: changing the list re-deals
// every day, and a saved pick is a side, so it would be marked against a different pair.
export const FIXED_FROM = '2026-10-28';
export const poolFile = (key) => (/^\d{4}-\d{2}-\d{2}$/.test(key) && key < FIXED_FROM ? 'data/pool-1.json' : 'data/pool.json');

export function prevDay(key) {
  const d = new Date(key + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

// A ?day= worth honouring: a real calendar date, FIRST_DAY or later and before `today`.
// Anything else is null, and the page plays today's ten.
export function pastDay(param, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(param || '')) return null;
  const d = new Date(param + 'T12:00:00');
  if (Number.isNaN(d.getTime()) || dayKey(d) !== param) return null;
  return param >= FIRST_DAY && param < today ? param : null;
}

// The latest day before `from` whose ten is unfinished, back to FIRST_DAY; null if none.
// `done(day)` says whether that day's ten was played to the end.
export function missedDay(from, done) {
  for (let d = prevDay(from); d >= FIRST_DAY; d = prevDay(d)) if (!done(d)) return d;
  return null;
}

export function shareText(day, marks) {
  const score = marks.filter(Boolean).length;
  return `Which Came First? ${day}: ${score}/${marks.length}\n${marks.map((m) => (m ? '🟩' : '🟥')).join('')}`;
}

// Consecutive days played, ending today or yesterday. `days` is a list of dayKeys.
export function streak(days, today) {
  const have = new Set(days);
  const d = new Date(today + 'T12:00:00');
  if (!have.has(today)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (have.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// Position of a year on the answer's timeline, 0..1 between two padded ends.
export function span(a, b) {
  const lo = Math.min(a.year, b.year), hi = Math.max(a.year, b.year);
  const pad = Math.max(1, Math.round((hi - lo) * 0.15));
  return { lo: lo - pad, hi: hi + pad, at: (y) => (y - (lo - pad)) / (hi - lo + 2 * pad) };
}
