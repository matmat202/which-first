/* The scrolling story: each <section class="step"> names a layout in data-kind; as the
 * reader scrolls from one step to the next, every dot flies from the old layout to the
 * new one. Numbers in the prose are not typed in: a <b data-fact="..."> is filled from
 * story.json, so the text cannot drift from the chart. Modelled on stanford-theatre/story. */
import { dots, scatter, columns, sx, sy, TOP } from './layout.js';
import { createPoints } from './gl.js';

// 0 ink, 1 purple, 2 orange, 3 green, 4 blue, 5 grey
const PAL = [[0.09, 0.13, 0.16], [0.36, 0.23, 0.56], [0.76, 0.32, 0.12], [0.07, 0.48, 0.31], [0.16, 0.47, 0.84], [0.72, 0.71, 0.75]];

const fmt = (n) => n.toLocaleString('en-US');
/* A median year can be a half (1944.5): print it as "1944–45". */
export const yr = (v) => (Number.isInteger(v) ? String(v) : `${Math.floor(v)}–${String(Math.ceil(v)).slice(2)}`);
/* rho with a real minus sign, two places. */
export const rho = (v) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(2)}`;
/* A permutation p: "fewer than 1 in 2,000" when no shuffle reached it. */
export const pval = (p, perm) => (p === 0 ? `fewer than 1 in ${fmt(perm)}` : `${fmt(Math.round(p * perm))} in ${fmt(perm)}`);
export const PLURAL = { film: 'films', discovery: 'discoveries', book: 'books', album: 'albums', game: 'games',
  company: 'companies', painting: 'paintings', song: 'songs', landmark: 'landmarks', tv: 'TV series' };

export const kindOf = (D, k) => {
  const r = D.kinds.find((x) => x.k === k);
  if (!r) throw new Error(`no kind ${k}`);
  return r;
};

/* "rho:album" -> "−0.33". Unknown kinds throw: a typo must not render as blank. */
export function fact(D, spec) {
  const [f, a, b] = spec.split(':');
  const K = a ? kindOf(D, a) : null;
  const need = (v) => { if (v === undefined || v === null) throw new Error(`fact ${spec}: no value`); return v; };
  switch (f) {
    case 'n': return fmt(D.n);
    case 'nkinds': return fmt(D.kinds.length);
    case 'fetched': return D.fetched;
    case 'perm': return fmt(D.perm);
    case 'min': return fmt(D.min);
    case 'elements': return fmt(D.elements);
    case 'discwith': return rho(D.discwith);
    case 'count': return fmt(K.n);
    case 'used': return fmt(K.used);
    case 'rho': return rho(need(K.rho));
    case 'p': return pval(need(K.p), D.perm);
    case 'topq': return yr(need(K.topq));
    case 'botq': return yr(need(K.botq));
    case 'q': return fmt(need(K.q));
    case 'topt': return need(K.top)[Number(b)].t;
    case 'topy': return String(need(K.top)[Number(b)].y);
    case 'oldest': return String(K.oldest);
    case 'small': return D.small.map((k) => `${PLURAL[k]} (${kindOf(D, k).n})`).join(', ');
    default: throw new Error(`unknown fact ${spec}`);
  }
}

/* data-kind -> layout: "kinds", "verdict", or "scatter:<kind>" */
export function layoutFor(step, ds, D, aspect) {
  const [k, lit] = step.dataset.kind.split(':');
  if (k === 'scatter') return scatter(ds, D, lit);
  return columns(ds, D, aspect, k);
}

/* Column labels: the kind's plural. On the verdict chart the value is rho, else the count. */
export const labels = (D) => D.kinds.map((r) => PLURAL[r.k]);
export function value(D, chart, i) {
  const r = D.kinds[i];
  if (chart !== 'verdict') return fmt(r.n);
  return 'rho' in r ? rho(r.rho) : '–';
}

async function main() {
  const D = await (await fetch('story.json')).json();
  for (const el of document.querySelectorAll('[data-fact]')) el.textContent = fact(D, el.dataset.fact);
  const ds = dots(D);

  const steps = [...document.querySelectorAll('.step')];
  const canvas = document.getElementById('gl');
  const plot = document.getElementById('plot');
  const axes = document.getElementById('axes');

  let layouts = [];
  const relayout = () => {
    const a = plot.clientWidth / Math.max(1, plot.clientHeight);
    layouts = steps.map((s) => layoutFor(s, ds, D, a));
    window.__story = { dots: ds.length, layouts: layouts.map((l) => ({ kind: l.kind, per: l.per })) };
  };
  relayout();

  const pts = createPoints(canvas, ds.length, PAL);
  if (!pts) { document.body.classList.add('nogl'); return; }
  const dpr = Math.min(2, devicePixelRatio || 1);
  let shown = -1;
  const resize = () => {
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    relayout();
    shown = -1;
  };
  resize();
  addEventListener('resize', resize);

  const progress = () => {
    const line = innerHeight * 0.5;
    let i = 0;
    for (let k = 0; k < steps.length; k++) if (steps[k].getBoundingClientRect().top < line) i = k;
    const next = steps[i + 1];
    if (!next) return { i, t: 0 };
    const top = next.getBoundingClientRect().top;
    return { i, t: Math.min(1, Math.max(0, 1 - (top - line) / (innerHeight - line))) };
  };

  const units = {
    kinds: 'famous things in the pool, by kind',
    verdict: 'rank correlation of year with fame (− means older is more famous)',
  };
  const drawAxes = (lay, kind) => {
    const html = [];
    if (lay.kind === 'columns') {
      const narrow = plot.clientWidth < 600;
      labels(D).forEach((lab, i) => {
        const x = ((i + 0.5) / lay.K) * 100, r = D.kinds[i];
        const short = narrow ? lab.replace('TV series', 'TV').replace('discoveries', 'discov.').replace('companies', 'cos.').replace('paintings', 'paint.').replace('landmarks', 'landm.') : lab;
        html.push(`<span class="tick${narrow ? ' tilt' : ''}" style="left:${x}%">${short}</span>`);
        const cls = lay.chart === 'verdict' && r.sorted ? 'val' : lay.chart === 'verdict' ? 'val ink' : 'val';
        html.push(`<span class="${cls}" style="left:${x}%">${value(D, lay.chart, i)}</span>`);
      });
      html.push(`<span class="unit">${units[lay.chart]}</span>`);
    } else {
      // the scatter: the lit kind's years under quarters of the x axis, fame up the side,
      // the median fame of each fifth of the years, and the flat line of "age does not matter"
      const r = kindOf(D, lay.lit), X = (v) => sx(v) * 100, Y = (v) => (1 - sy(v)) * 100;
      r.ticks.forEach((v, i) => html.push(`<span class="tick" style="left:${X(i / 4)}%">${v}</span>`));
      html.push(`<span class="ytick" style="top:${Y(1)}%">most<br>famous</span>`);
      html.push(`<span class="ytick" style="top:${Y(0)}%">least</span>`);
      const pts = r.bands.map((b) => `${X(b.x)},${Y(b.fame)}`).join(' ');
      html.push(`<svg class="lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline class="pace" points="${X(0)},${Y(0.5)} ${X(1)},${Y(0.5)}"/><polyline class="med" points="${pts}"/></svg>`);
      html.push(`<span class="key"><i class="med"></i>median fame, each fifth of the ${PLURAL[r.k]} by year`
        + `<br><i class="pace"></i>if age made no difference</span>`);
      html.push(`<span class="unit">x: year, oldest to newest · y: fame among ${PLURAL[r.k]} (Wikipedia languages)</span>`);
    }
    axes.innerHTML = html.join('');
    axes.dataset.kind = kind;
  };

  const t0 = performance.now();
  const frame = () => {
    const { i, t } = progress();
    const j = Math.min(i + 1, steps.length - 1);
    const A = layouts[i], Bl = layouts[j];
    pts.set(A.slots, Bl.slots);
    const cur = t > 0.5 ? j : i;
    if (cur !== shown) {
      shown = cur;
      drawAxes(layouts[cur], steps[cur].dataset.kind);
      document.body.dataset.step = cur;
    }
    axes.style.opacity = String(Math.abs(t - 0.5) * 2);
    const r = plot.getBoundingClientRect();
    const sz = (l) => (l.kind === 'columns' ? Math.max(2, l.cell * r.width * 0.86) : Math.max(4, r.width / 110));
    const size = sz(A) + (sz(Bl) - sz(A)) * t;
    pts.draw({ t, time: (performance.now() - t0) / 1000, size, rect: [r.left, r.top, r.width, r.height], dpr });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

if (typeof document !== 'undefined') main().catch((e) => {
  document.body.classList.add('failed');
  document.getElementById('err').textContent = String(e.message || e);
  console.error(e);
});

export { TOP };
