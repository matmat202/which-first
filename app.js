// Which Came First? — the page. Pure logic lives in first-logic.js.
import * as L from './first-logic.js';

const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: play on, unsaved */ } },
};

let POOL = null, C = [];
let game = null; // { key, day, practice, pairs, picks }

// `past` is an earlier day's ten (from ?day=): saved, shareable, outside the streak.
function start(practice, past = null) {
  const day = past || L.dayKey();
  const key = practice ? `practice-${Date.now().toString(36)}` : day;
  game = { key, day, practice, past: !!past && !practice, pairs: L.pairsFor(POOL.items, key), picks: practice ? [] : store.get('wf:' + day, []) };
  $('daily').hidden = !practice && !game.past;
  render();
}

function save() {
  if (game.practice) return;
  store.set('wf:' + game.day, game.picks);
  if (game.picks.length === game.pairs.length && !game.past) {
    const days = store.get('wf:days', []);
    if (!days.includes(game.day)) { days.push(game.day); store.set('wf:days', days.slice(-400)); }
  }
}

const pairAt = (k) => game.pairs[k].map((i) => C[i]);
const marks = () => game.picks.map((p, k) => { const [a, b] = pairAt(k); return L.isRight(a, b, p); });

function render() {
  const k = game.picks.length, done = k >= game.pairs.length;
  // A finished round stays on screen until Next; `showing` is the round whose answer is up.
  const showing = game.showing ?? null;
  $('play').hidden = done && showing == null;
  $('end').hidden = !($('play').hidden);
  drawMarks(showing ?? k);
  if (!$('play').hidden) drawRound(showing ?? k, showing != null);
  if (!$('end').hidden) drawEnd();
}

function drawMarks(now) {
  const m = marks();
  $('marks').replaceChildren(...game.pairs.map((_, k) => {
    const li = document.createElement('li');
    if (k < m.length) { li.className = m[k] ? 'y' : 'n'; li.title = m[k] ? 'right' : 'wrong'; }
    if (k === now) li.classList.add('now');
    return li;
  }));
  $('marks').setAttribute('aria-label', `${m.filter(Boolean).length} right of ${m.length} so far`);
}

function drawRound(k, answered) {
  const [a, b] = pairAt(k);
  $('round').textContent = `${game.practice ? 'Practice · ' : game.past ? `${game.day} · ` : ''}Round ${k + 1} of ${game.pairs.length}`;
  const btns = [...$('pick').querySelectorAll('button')];
  [a, b].forEach((c, i) => {
    const el = btns[i];
    el.querySelector('b').textContent = c.name;
    el.querySelector('small').textContent = L.caption(c);
    el.querySelector('.desc').textContent = c.desc;
    el.querySelector('.lat').textContent = answered ? L.fmtYear(c.year) : '';
    el.disabled = answered;
    el.classList.toggle('right', answered && L.firstIndex(a, b) === i);
    el.classList.toggle('wrong', answered && game.picks[k] === i && !L.isRight(a, b, i));
    el.setAttribute('aria-label', answered ? `${c.name}, ${L.caption(c)}: ${L.fmtYear(c.year)}` : `${c.name}, ${L.caption(c)}`);
  });
  if (answered) {
    const right = L.isRight(a, b, game.picks[k]);
    $('out').replaceChildren();
    const tag = document.createElement('b');
    tag.className = right ? 'y' : 'n';
    tag.textContent = right ? 'Right. ' : 'Not quite. ';
    $('out').append(tag, L.verdict(a, b));
    drawLine(a, b);
    $('map').hidden = false;
    $('next').hidden = false;
    $('next').textContent = k + 1 >= game.pairs.length ? 'See your score' : 'Next';
  } else {
    $('out').textContent = '';
    $('map').hidden = true;
    $('next').hidden = true;
  }
}

function pick(i) {
  if (!game || game.showing != null || game.picks.length >= game.pairs.length) return;
  game.showing = game.picks.length;
  game.picks.push(i);
  save();
  render();
  $('next').focus({ preventScroll: true });
}

function next() {
  if (game.showing == null) return;
  game.showing = null;
  render();
  const first = $('pick').querySelector('button');
  if (!$('play').hidden) first.focus({ preventScroll: true }); else $('share').focus({ preventScroll: true });
}

// The answer on a timeline: both years as ticks on one line, so the gap is something seen.
function drawLine(a, b) {
  const W = 600, H = 64, x0 = 16, x1 = W - 16, y = 30;
  const sp = L.span(a, b);
  const X = (yr) => x0 + sp.at(yr) * (x1 - x0);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Timeline: ${a.name} ${L.fmtYear(a.year)}, ${b.name} ${L.fmtYear(b.year)}`);
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); svg.append(e); return e; };
  el('line', { class: 'axis', x1: x0, x2: x1, y1: y, y2: y });
  const f = L.firstIndex(a, b);
  el('line', { class: 'gap', x1: X(Math.min(a.year, b.year)), x2: X(Math.max(a.year, b.year)), y1: y, y2: y });
  [a, b].forEach((c, i) => {
    const cls = i ? 'b' : 'a', cx = X(c.year);
    el('circle', { class: cls, cx, cy: y, r: 7 });
    const t = el('text', { class: cls, x: cx, y: i === f ? y - 14 : y + 26,
      'text-anchor': cx < W * 0.2 ? 'start' : cx > W * 0.8 ? 'end' : 'middle' });
    t.textContent = `${L.fmtYear(c.year)}`;
  });
  $('map').replaceChildren(svg);
}

function drawEnd() {
  const m = marks(), score = m.filter(Boolean).length;
  $('endday').textContent = game.practice ? 'Practice ten' : `${game.past ? 'Earlier' : 'Today\'s'} ten · ${game.day}`;
  $('score').textContent = `${score} / ${m.length}`;
  const s = L.streak(store.get('wf:days', []), game.day);
  $('streak').textContent = game.practice ? 'Practice rounds do not count toward your streak.'
    : game.past ? 'Earlier days do not count toward your streak.'
    : `${s === 1 ? 'First day of a streak' : `${s}-day streak`}. A new ten tomorrow.`;
  $('share').hidden = game.practice;
  const miss = game.practice ? null : L.missedDay(game.day, (k) => store.get('wf:' + k, []).length >= game.pairs.length);
  $('earlier').hidden = !miss;
  if (miss) { $('earlier').href = `?day=${miss}`; $('earlier').textContent = miss === L.prevDay(L.dayKey()) ? "Missed yesterday? Play yesterday's ten" : `Play the ten from ${miss}`; }
  $('copied').textContent = '';
  $('recap').replaceChildren(...game.pairs.map((_, k) => {
    const [a, b] = pairAt(k);
    const li = document.createElement('li');
    const mk = document.createElement('span'); mk.className = 'm ' + (m[k] ? 'y' : 'n'); mk.textContent = m[k] ? '✓' : '✗';
    mk.setAttribute('aria-label', m[k] ? 'right' : 'wrong');
    const [n, so] = L.firstIndex(a, b) === 0 ? [a, b] : [b, a];
    const t = document.createElement('span'); t.className = 't'; t.textContent = `${n.name} before ${so.name}`;
    const d = document.createElement('span'); d.className = 'd'; d.textContent = `${L.fmtYear(n.year)} vs ${L.fmtYear(so.year)}`;
    li.append(mk, t, d);
    return li;
  }));
}

async function share() {
  const text = L.shareText(game.day, marks()) + '\nhttps://matmat202.github.io/which-first/';
  try { await navigator.clipboard.writeText(text); $('copied').textContent = 'Copied.'; }
  catch { $('copied').textContent = text; }
}

$('pick').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) pick(Number(b.dataset.i)); });
$('next').addEventListener('click', next);
$('share').addEventListener('click', share);
$('practice').addEventListener('click', () => start(true));
$('daily').addEventListener('click', () => { if (location.search) history.replaceState(null, '', location.pathname); start(false); });
document.addEventListener('keydown', (e) => {
  if (!game || e.metaKey || e.ctrlKey || e.altKey) return;
  if (game.showing == null && !$('play').hidden) {
    if (e.key === 'ArrowLeft' || e.key === '1') { e.preventDefault(); pick(0); }
    else if (e.key === 'ArrowRight' || e.key === '2') { e.preventDefault(); pick(1); }
  } else if (game.showing != null && (e.key === 'Enter' || e.key === ' ')) {
    // handled here even when Next has focus, so Enter is one path, not a click that may or may not fire
    e.preventDefault(); next();
  }
});

fetch('data/pool.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((p) => {
  POOL = p; C = p.items.map(L.item);
  $('count').textContent = C.length.toLocaleString('en-US');
  start(false, L.pastDay(new URLSearchParams(location.search).get('day'), L.dayKey()));
}).catch((e) => {
  $('round').textContent = '';
  $('out').textContent = `Could not load the list (${e.message}). Reload to try again.`;
});
