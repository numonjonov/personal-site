/* v9 — по мотивам hancore.dev. Без библиотек.
   Вход: печатается настоящий код этого сайта (main.js, v6–v8/app.js),
   клавиатура подсвечивает клавиши, две руки-скелета «нажимают» их.
   Enter → рабочий стол: колесо проектов слева (скролл, перетаскивание, ↑↓),
   терминал fish в центре (раздел проигрывается командами, «призрак»
   допечатывает), ASCII-глаз справа следит за курсором, статус-строка,
   «:» — командная строка. Разделы берутся из article.item в index.html. */

const doc = document, win = window, root = doc.documentElement;
const $ = id => doc.getElementById(id);
const reduced = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => win.innerWidth <= 820;
const sleep = ms => new Promise(r => win.setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
root.classList.add('js');

let colors = {};
function readColors() {
  const cs = getComputedStyle(root);
  ['bg', 'ink', 'dim', 'faint', 'line', 'hot', 'green'].forEach(k => { colors[k] = cs.getPropertyValue('--' + k).trim(); });
}
readColors();

function fit(c) {
  const r = c.getBoundingClientRect(), dpr = Math.min(2, win.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w: r.width, h: r.height };
}

/* ================= Клавиатура и руки ================= */
const ROWS = [
  ['esc', '`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', '←'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", '↵'],
  ['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', '⇧'],
];
const OFFS = [0, 1.5, 1.8, 1.2];
const SHIFTED = { '!': '1', '@': '2', '#': '3', $: '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', _: '-', '+': '=', '{': '[', '}': ']', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '~': '`', '|': '\\' };
const FINGER = {}; // клавиша → [рука, палец] (0 большой … 4 мизинец)
[['`1qaz⇧esc', 0, 4], ['2wsx', 0, 3], ['3edc', 0, 2], ['45rtfgvb', 0, 1], ['67yuhjnm', 1, 1], ['8ik,', 1, 2], ['9ol.', 1, 3], ["0-=p[];'/↵←", 1, 4]]
  .forEach(([keys, hand, f]) => (keys === '`1qaz⇧esc' ? ['`', '1', 'q', 'a', 'z', '⇧', 'esc'] : [...keys]).forEach(k => { FINGER[k] = [hand, f]; }));
FINGER[' '] = [1, 0];

const keys = (() => {
  const c = $('keys');
  const lit = new Map();              // клавиша → яркость подсветки
  const hands = [0, 1].map(() => ({ pts: null, target: null, hold: 0 }));
  let layout = null, dirty = true;

  function build(w, h) {
    const kw = Math.min(w / 15.5, h * .165), x0 = (w - 15 * kw) / 2, y0 = kw * .5;
    const pos = {};
    ROWS.forEach((row, r) => row.forEach((k, i) => {
      const x = x0 + (OFFS[r] + i) * kw + (r === 0 ? 0 : 0), y = y0 + r * kw * .95;
      if (!(k in pos) || k === '⇧') pos[k === '⇧' && i > 0 ? '⇧r' : k] = { x, y, k };
    }));
    pos[' '] = { x: x0 + 7.5 * kw, y: y0 + 4 * kw * .95, k: 'space' };
    // руки: запястья внизу, пальцы на домашнем ряду
    const homes = [['a', 's', 'd', 'f'], ['j', 'k', 'l', ';']];
    const rest = homes.map((hk, hi) => {
      const tips = [hi === 0 ? { x: x0 + 6.2 * kw, y: pos[' '].y } : { x: x0 + 8.8 * kw, y: pos[' '].y }];
      (hi === 0 ? [...hk].reverse() : hk).forEach(k => tips.push({ x: pos[k].x, y: pos[k].y + kw * .15 }));
      const wrist = { x: hi === 0 ? x0 + 5.2 * kw : x0 + 9.8 * kw, y: h + kw * .2 };
      return { wrist, tips };
    });
    layout = { kw, pos, rest };
    hands.forEach((hd, hi) => {
      const r = rest[hi];
      hd.target = clone(r); hd.pts = clone(r);
    });
  }
  const clone = r => ({ wrist: { ...r.wrist }, tips: r.tips.map(t => ({ ...t })) });

  function press(ch) {
    if (!layout) return;
    let k = ch;
    if (ch === '\n') k = '↵';
    else if (ch === ' ' || ch === '\t') k = ' ';
    else if (SHIFTED[ch]) { k = SHIFTED[ch]; lit.set('⇧', 1); }
    else if (/[A-Z]/.test(ch)) { k = ch.toLowerCase(); lit.set('⇧', 1); }
    else k = ch.toLowerCase();
    const p = layout.pos[k];
    if (!p) return;
    lit.set(k, 1); dirty = true;
    const f = FINGER[k]; if (!f) return;
    const [hi, fi] = f, hd = hands[hi], r = layout.rest[hi];
    const tip = r.tips[fi], sx = (p.x - tip.x) * .3, sy = (p.y - tip.y) * .3;
    hd.target = { wrist: { x: r.wrist.x + sx, y: r.wrist.y + sy }, tips: r.tips.map((t, i) => (i === fi ? { x: p.x, y: p.y } : { x: t.x + sx, y: t.y + sy * .6 })) };
    hd.hold = .13; hd.active = fi; hd.resting = false;
  }

  function draw(dt) {
    if (!c.offsetParent && getComputedStyle(c).display === 'none') return;
    const { g, w, h } = fit(c);
    if (!layout || layout.w !== w || layout.h !== h) { build(w, h); layout.w = w; layout.h = h; }
    let moving = dirty;
    const k = 1 - Math.exp(-dt * 22);
    hands.forEach((hd, hi) => {
      hd.hold -= dt;
      if (hd.hold <= 0 && !hd.resting) { hd.target = clone(layout.rest[hi]); hd.active = -1; hd.resting = true; }
      const mv = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y; if (Math.abs(dx) + Math.abs(dy) > .05) moving = true; a.x += dx * k; a.y += dy * k; };
      mv(hd.pts.wrist, hd.target.wrist); hd.pts.tips.forEach((t, i) => mv(t, hd.target.tips[i]));
    });
    lit.forEach((v, key) => { const nv = v - dt * 3.2; if (nv <= 0) lit.delete(key); else lit.set(key, nv); moving = true; });
    if (!moving) return;
    dirty = false;

    g.clearRect(0, 0, w, h);
    g.font = `${Math.round(layout.kw * .42)}px "IBM Plex Mono", monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    Object.entries(layout.pos).forEach(([key, p]) => {
      const v = lit.get(key === '⇧r' ? '⇧' : key) || 0;
      g.globalAlpha = .28 + v * .72;
      g.fillStyle = v > .05 ? colors.ink : colors.dim;
      g.fillText(p.k, p.x, p.y);
      if (v > .05) { g.strokeStyle = colors.ink; g.globalAlpha = v; g.strokeRect(p.x - layout.kw * .38, p.y - layout.kw * .38, layout.kw * .76, layout.kw * .76); }
    });
    g.globalAlpha = 1;

    const boxes = [];
    hands.forEach((hd, hi) => {
      const { wrist, tips } = hd.pts;
      const mcps = tips.map((t, i) => ({ x: wrist.x + (t.x - wrist.x) * (i ? .5 : .42), y: wrist.y + (t.y - wrist.y) * (i ? .5 : .55) }));
      g.strokeStyle = colors.ink; g.fillStyle = colors.ink; g.lineWidth = .8; g.globalAlpha = .75;
      g.beginPath();
      mcps.forEach((m, i) => { g.moveTo(wrist.x, wrist.y); g.lineTo(m.x, m.y); });
      mcps.forEach((m, i) => { i ? g.lineTo(m.x, m.y) : g.moveTo(m.x, m.y); });
      const pts = [wrist, ...mcps];
      tips.forEach((t, i) => {
        const m = mcps[i], bend = (hi ? -1 : 1) * (i === 0 ? 4 : 2);
        const pip = { x: m.x + (t.x - m.x) * .4 + bend, y: m.y + (t.y - m.y) * .4 };
        const dip = { x: m.x + (t.x - m.x) * .72 + bend * .5, y: m.y + (t.y - m.y) * .72 };
        g.moveTo(m.x, m.y); g.lineTo(pip.x, pip.y); g.lineTo(dip.x, dip.y); g.lineTo(t.x, t.y);
        pts.push(pip, dip, t);
      });
      g.stroke();
      pts.forEach(p => g.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4));
      if (hd.active >= 0) { const t = tips[hd.active]; g.fillRect(t.x - 2.5, t.y - 2.5, 5, 5); }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      pts.forEach(p => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
      y1 = Math.min(y1, h - 1);
      g.globalAlpha = .4; g.strokeRect(x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 8);
      g.globalAlpha = .8; g.font = '9px "IBM Plex Mono", monospace'; g.textAlign = hi ? 'left' : 'right';
      g.fillText(`['hand${hi}:u'] ${(wrist.x / w).toFixed(7)}`, hi ? x1 + 10 : x0 - 10, y0 + 2);
      boxes.push({ x0: x0 - 6, x1: x1 + 6, y: (y0 + y1) / 2 + 10 });
    });
    if (boxes.length === 2) { g.globalAlpha = .35; g.beginPath(); g.moveTo(boxes[0].x1, boxes[0].y); g.lineTo(boxes[1].x0, boxes[1].y); g.stroke(); }
    g.globalAlpha = 1;
  }
  return { press, draw, wake: () => { dirty = true; layout = null; } };
})();

/* ================= Вход: печать настоящего кода сайта ================= */
const KW = /\b(const|let|var|function|return|if|else|for|while|new|import|from|export|await|async|try|catch|class|of|in|typeof|null|true|false|this|break)\b/g;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const kw = s => s.replace(KW, '<span class="k">$1</span>').replace(/\b([A-Z][A-Za-z0-9]{2,})\b/g, '<span class="t">$1</span>');
function hl(line) {
  const ci = line.indexOf('//'), cmt = ci >= 0 && !/['"`]/.test(line.slice(0, ci)) ? ci : -1;
  const code = cmt >= 0 ? line.slice(0, cmt) : line, com = cmt >= 0 ? line.slice(cmt) : '';
  let out = '', last = 0, m;
  const re = /('[^']*'?|"[^"]*"?|`[^`]*`?)/g;
  while ((m = re.exec(code))) { out += kw(esc(code.slice(last, m.index))) + `<span class="s">${esc(m[0])}</span>`; last = m.index + m[0].length; }
  return out + kw(esc(code.slice(last))) + (com ? `<span class="c">${esc(com)}</span>` : '');
}

let introRun = 0;
async function runIntro() {
  const run = ++introRun;
  const codeEl = $('code'), fileEl = $('code-file'), pathEl = $('vim-path'), posEl = $('vim-pos');
  const files = ['/main.js', '/v8/app.js', '/v7/app.js', '/v6/app.js'];
  let fi = Math.floor(Math.random() * files.length);
  while (run === introRun) {
    const file = files[fi++ % files.length];
    let text = '';
    try { text = await (await fetch(file)).text(); } catch (e) { text = 'const engineer = "backend";\n// talks to old systems\n'; }
    if (run !== introRun) return;
    const all = text.replace(/\r/g, '').split('\n');
    const start = Math.max(0, Math.floor(Math.random() * Math.max(1, all.length - 70)));
    const chunk = all.slice(start, start + 60);
    fileEl.textContent = `// —— personal-site${file} ——`;
    pathEl.textContent = `~/personal-site${file}`;
    const lh = parseFloat(getComputedStyle(codeEl).lineHeight) || 18;
    const shown = [];
    for (let li = 0; li < chunk.length && run === introRun; li++) {
      const full = chunk[li];
      const no = start + li + 1;
      shown.push({ no, html: '' });
      const max = Math.max(4, Math.floor(codeEl.clientHeight / lh) - 1);
      for (let ci = 0; ci <= full.length && run === introRun; ci++) {
        const ch = full[ci - 1];
        shown[shown.length - 1].html = hl(full.slice(0, ci));
        const vis = shown.slice(-max);
        codeEl.innerHTML = vis.map((l, i) => `<span class="n">${l.no}</span>${l.html}${i === vis.length - 1 ? '<span class="caret"></span>' : ''}`).join('\n');
        posEl.textContent = `${no}:${ci + 1} ${li < 3 ? 'Top' : Math.round(li / chunk.length * 100) + '%'}`;
        if (ch && ch !== ' ') keys.press(ch);
        if (reduced) continue;
        await sleep(ch === ' ' && /^\s*$/.test(full.slice(0, ci)) ? 4 : 26 + Math.random() * 48);
      }
      keys.press('\n');
      if (reduced && li > 30) break;
      await sleep(reduced ? 0 : 60);
    }
    await sleep(900);
  }
}

/* ================= Рабочий стол ================= */
const items = Array.from(doc.querySelectorAll('article.item'));
const wheelLis = Array.from(doc.querySelectorAll('#wheel-list li'));
const ids = items.map(a => a.id);
let current = -1, wheelPos = 0, wheelTarget = 0;
let ghostTyping = false, lastMouse = 0, mx = win.innerWidth / 2, my = win.innerHeight / 2;
let gh = null;

function enterDesk(id) {
  introRun++;
  root.classList.add('desk-on');
  keys.wake();
  show(ids.includes(id) ? id : 'about', true);
}
function leaveDesk() {
  root.classList.remove('desk-on');
  history.replaceState(null, '', location.pathname);
  current = -1; showToken++;
  keys.wake();
  runIntro();
}

/* --- живые данные GitHub (кэш на сессию) --- */
async function loadGitHub() {
  try { const c = sessionStorage.getItem('v9-gh'); if (c) gh = JSON.parse(c); } catch (e) { /* без кэша */ }
  if (!gh) {
    try {
      const u = await (await fetch('https://api.github.com/users/numonjonov')).json();
      const r = await (await fetch('https://api.github.com/users/numonjonov/repos?sort=pushed&per_page=1')).json();
      if (u && u.public_repos != null) {
        gh = { repos: String(u.public_repos), since: String(u.created_at).slice(0, 4), push: r && r[0] ? `${r[0].name} · ${String(r[0].pushed_at).slice(0, 10)}` : '' };
        try { sessionStorage.setItem('v9-gh', JSON.stringify(gh)); } catch (e) { /* ок */ }
      }
    } catch (e) { /* остаются значения из разметки */ }
  }
  if (!gh) return;
  doc.querySelectorAll('[data-gh]').forEach(el => { const v = gh[el.dataset.gh]; if (v) el.textContent = v; });
  if (current >= 0) renderStatus(items[current]);
}

/* --- статус-строка --- */
function renderStatus(art) {
  const dl = $('status-stats');
  const pairs = (art.dataset.stats || '').split('|').filter(Boolean).map(s => s.split(':'));
  const val = v => (v === 'gh-repos' ? (gh && gh.repos) || '21' : v === 'gh-since' ? (gh && gh.since) || '2022' : v);
  dl.innerHTML = pairs.map(([k, v], i) => `<div><dt>${k}</dt><dd class="${i === 0 ? 'hot' : ''}">${esc(val(v))}</dd></div>`).join('') +
    '<div><dt>EYE</dt><dd id="st-eye">idle</dd></div><div><dt>GHOST</dt><dd id="st-ghost">idle</dd></div>';
}

/* --- терминал: раздел проигрывается командами --- */
let showToken = 0;
async function show(id, fromStart) {
  const idx = ids.indexOf(id);
  if (idx < 0 || (idx === current && !fromStart)) return;
  current = idx; wheelTarget = idx;
  const token = ++showToken;
  const art = items[idx];
  if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  wheelLis.forEach((li, i) => li.classList.toggle('on', i === idx));
  if (narrow()) { const a = wheelLis[idx]; a && a.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }); }
  const path = art.dataset.path || '~', branch = art.dataset.branch;
  $('term-title').textContent = `fish — ${path} · numonjonov`;
  renderStatus(art);

  const body = $('term-body');
  const view = art.cloneNode(true);
  view.removeAttribute('id'); view.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  view.querySelector('h2.sr')?.remove();
  const prompt = () => {
    const p = doc.createElement('p'); p.className = 'pr';
    p.innerHTML = `pahlavon@dev <i>${esc(path)}</i>${branch ? ` <em>(${esc(branch)})</em>` : ''}`;
    return p;
  };
  const steps = Array.from(view.querySelectorAll(':scope > .step'));
  steps.forEach(st => { st.prepend(prompt()); st.querySelector('.cmd').dataset.text = st.querySelector('.cmd').textContent; });
  // листалка shots
  view.querySelectorAll('.shots').forEach(s => {
    const figs = Array.from(s.querySelectorAll('figure'));
    figs[0] && figs[0].classList.add('on');
    if (figs.length < 2) return;
    const nav = doc.createElement('div'); nav.className = 'shot-nav';
    figs.forEach((f, i) => { const b = doc.createElement('button'); b.type = 'button'; b.textContent = i + 1; if (!i) b.classList.add('on'); b.addEventListener('click', () => setShot(s, i)); nav.appendChild(b); });
    const hint = doc.createElement('span'); hint.textContent = '←→ shot'; nav.appendChild(hint);
    s.appendChild(nav);
  });
  body.replaceChildren(view);
  body.scrollTop = 0;
  const plot = view.querySelector('.plot');
  if (plot) drawPlot(plot, token);

  if (reduced) { finishPrompt(view); return; }
  steps.forEach(st => { st.querySelector('.cmd').textContent = ''; st.querySelector('.out').classList.add('hide'); st.classList.add('hide'); });
  ghostTyping = true;
  for (const st of steps) {
    if (token !== showToken) return;
    st.classList.remove('hide');
    const cmd = st.querySelector('.cmd'), text = cmd.dataset.text;
    cmd.classList.add('typing');
    await sleep(160);
    for (let i = 1; i <= text.length; i++) {
      if (token !== showToken) return;
      cmd.textContent = text.slice(0, i); keys.press(text[i - 1]);
      await sleep(30 + Math.random() * 55);
    }
    keys.press('\n'); cmd.classList.remove('typing');
    await sleep(140);
    st.querySelector('.out').classList.remove('hide');
    body.scrollTop = body.scrollHeight;
    await sleep(260);
  }
  ghostTyping = false;
  if (token === showToken) { finishPrompt(view); body.scrollTop = 0; }
}
function finishPrompt(view) {
  const art = items[current];
  const p = doc.createElement('p'); p.className = 'pr';
  p.innerHTML = `pahlavon@dev <i>${esc(art.dataset.path || '~')}</i>`;
  const c = doc.createElement('p'); c.className = 'cmd typing';
  view.append(p, c);
}
function setShot(s, i) {
  const figs = s.querySelectorAll('figure'), btns = s.querySelectorAll('.shot-nav button');
  const n = figs.length; i = (i + n) % n;
  figs.forEach((f, k) => f.classList.toggle('on', k === i));
  btns.forEach((b, k) => b.classList.toggle('on', k === i));
  s.dataset.i = i;
}
function stepShot(d) {
  const s = $('term-body').querySelector('.shots'); if (!s) return;
  setShot(s, (+s.dataset.i || 0) + d);
}

/* --- плоттер для whoami: рельеф «PN» из контурных линий + разрез A-A --- */
function drawPlot(plot, token) {
  const ridge = plot.querySelector('.ridge'), section = plot.querySelector('.section');
  const { g, w, h } = fit(ridge);
  // маска букв
  const m = doc.createElement('canvas'); m.width = Math.round(w); m.height = Math.round(h);
  const mg = m.getContext('2d');
  mg.fillStyle = '#000'; mg.fillRect(0, 0, m.width, m.height);
  mg.fillStyle = '#fff'; mg.font = `600 ${Math.round(h * .78)}px Archivo, sans-serif`;
  mg.textAlign = 'center'; mg.textBaseline = 'middle';
  mg.filter = 'blur(3px)'; mg.fillText('PN', m.width * .56, m.height * .6);
  const md = mg.getImageData(0, 0, m.width, m.height).data;
  const at = (x, y) => md[(Math.min(m.height - 1, Math.max(0, y | 0)) * m.width + Math.min(m.width - 1, Math.max(0, x | 0))) * 4] / 255;
  const lines = 40, gap = (h - 40) / lines, amp = gap * 5.5;
  const secRow = 21;
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const noise = Array.from({ length: lines }, () => Array.from({ length: Math.ceil(w / 3) + 2 }, () => rnd()));
  const t0 = performance.now(), dur = reduced ? 0 : 1600;
  const profile = [];

  function frame(t) {
    if (token !== showToken || !ridge.isConnected) return;
    const p = dur ? clamp((t - t0) / dur, 0, 1) : 1;
    g.clearRect(0, 0, w, h);
    g.lineWidth = .8;
    const drawn = Math.floor(lines * p);
    for (let r = 0; r < drawn; r++) {
      const y0 = 24 + r * gap + gap;
      const line = new Path2D();
      for (let x = 20, i = 0; x <= w - 8; x += 3, i++) {
        const v = at(x, y0 - gap * 1.5);
        const y = y0 - v * amp - (v > .05 ? noise[r][i] * 2.5 : noise[r][i] * .8);
        i ? line.lineTo(x, y) : line.moveTo(x, y);
        if (r === secRow) profile[i] = v;
      }
      // заливка под линией прячет линии позади, обводится только сама линия
      const fill = new Path2D(line); fill.lineTo(w - 8, h); fill.lineTo(20, h); fill.closePath();
      g.fillStyle = colors.bg; g.fill(fill);
      g.strokeStyle = colors.ink; g.globalAlpha = r === secRow ? .95 : .6; g.stroke(line); g.globalAlpha = 1;
    }
    // разрез A-A, размерная линия, дерево
    g.fillStyle = colors.ink; g.strokeStyle = colors.ink; g.font = '9px "IBM Plex Mono", monospace';
    const ys = 24 + secRow * gap + gap;
    if (drawn > secRow) {
      g.setLineDash([6, 3, 1, 3]); g.globalAlpha = .7;
      g.beginPath(); g.moveTo(10, ys); g.lineTo(w - 4, ys); g.stroke(); g.setLineDash([]);
      g.fillText('A', 4, ys - 4); g.fillText('A', w - 10, ys - 4);
    }
    g.globalAlpha = .7;
    g.beginPath(); g.moveTo(w * .3, 14); g.lineTo(w * .82, 14); g.moveTo(w * .3, 10); g.lineTo(w * .3, 18); g.moveTo(w * .82, 10); g.lineTo(w * .82, 18); g.stroke();
    g.textAlign = 'center'; g.fillStyle = colors.bg; g.fillRect(w * .56 - 26, 8, 52, 12); g.fillStyle = colors.ink; g.fillText('backend', w * .56, 17);
    g.textAlign = 'left';
    tree(g, 40, h - 8, -Math.PI / 2, gap * 3.4, 6, p);
    g.fillText(`reached ${Math.round(p * lines)} / ${lines}`, w - 120, h - 6);
    g.globalAlpha = 1;
    // профиль разреза
    if (section && profile.length) {
      const s = fit(section);
      s.g.clearRect(0, 0, s.w, s.h);
      s.g.beginPath(); s.g.moveTo(0, s.h);
      profile.forEach((v, i) => s.g.lineTo(i / (profile.length - 1) * s.w, s.h - 4 - v * (s.h - 10)));
      s.g.lineTo(s.w, s.h); s.g.closePath(); s.g.fillStyle = colors.ink; s.g.globalAlpha = .85; s.g.fill(); s.g.globalAlpha = 1;
    }
    if (p < 1) win.requestAnimationFrame(frame);
  }
  win.requestAnimationFrame(frame);
}
function tree(g, x, y, a, len, depth, p) {
  if (depth <= 0 || p <= 0) return;
  const grow = Math.min(1, p * 1.4 - (6 - depth) * .12);
  if (grow <= 0) return;
  const x2 = x + Math.cos(a) * len * grow, y2 = y + Math.sin(a) * len * grow;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
  if (grow < 1) return;
  tree(g, x2, y2, a - .42, len * .68, depth - 1, p);
  tree(g, x2, y2, a + .36, len * .7, depth - 1, p);
}

/* --- колесо проектов --- */
const wheel = $('wheel'), wheelFx = $('wheel-fx');
const STEP = .2, R = 560;
let bursts = null;
function makeBursts() {
  let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  bursts = [];
  for (let a = -3; a < ids.length * STEP + 3; a += .045 + rnd() * .09) {
    const n = 3 + Math.floor(rnd() * (rnd() < .2 ? 26 : 8));
    const rays = Array.from({ length: n }, () => ({ ang: Math.PI + (rnd() - .5) * 2.2, len: 6 + rnd() * rnd() * 70, dot: rnd() < .5 }));
    bursts.push({ a, rays });
  }
}
function drawWheel() {
  if (narrow()) return;
  const { g, w, h } = fit(wheelFx);
  if (!bursts) makeBursts();
  const cx = w * .3 - R, cy = h / 2;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = colors.ink; g.fillStyle = colors.ink; g.lineWidth = 1.1;
  g.beginPath(); g.arc(cx, cy, R, -.9, .9); g.globalAlpha = .9; g.stroke();
  g.lineWidth = .6;
  bursts.forEach(b => {
    const th = b.a - wheelPos * STEP;
    if (Math.abs(th) > .85) return;
    const px = cx + Math.cos(th) * R, py = cy + Math.sin(th) * R;
    const fade = 1 - Math.abs(th) / .85;
    g.globalAlpha = .75 * fade;
    g.beginPath();
    b.rays.forEach(r => {
      const ex = px + Math.cos(r.ang + th) * r.len, ey = py + Math.sin(r.ang + th) * r.len;
      g.moveTo(px, py); g.quadraticCurveTo((px + ex) / 2 + 3, (py + ey) / 2 - 3, ex, ey);
    });
    g.stroke();
    b.rays.forEach(r => { if (r.dot) { const ex = px + Math.cos(r.ang + th) * r.len * 1.08, ey = py + Math.sin(r.ang + th) * r.len * 1.08; g.fillRect(ex, ey, 1.3, 1.3); } });
  });
  g.globalAlpha = 1;
  wheelLis.forEach((li, i) => {
    const th = (i - wheelPos) * STEP;
    const vis = Math.abs(th) < .8;
    li.style.opacity = vis ? (1 - Math.abs(th) / .8 * .75).toFixed(3) : '0';
    li.style.pointerEvents = vis ? '' : 'none';
    const x = cx + Math.cos(th) * R + 12, y = cy + Math.sin(th) * R - 28;
    li.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(th * 57.3 * .55).toFixed(2)}deg)`;
  });
}
let dragY = null, dragStart = 0, dragMoved = 0;
wheel.addEventListener('wheel', e => {
  if (narrow()) return;
  e.preventDefault();
  const now = performance.now(); if (now - (wheel.lastWheel || 0) < 160) return; wheel.lastWheel = now;
  const d = Math.sign(e.deltaY);
  if (d) select(clamp(Math.round(wheelTarget) + d, 0, ids.length - 1));
}, { passive: false });
wheel.addEventListener('pointerdown', e => {
  if (narrow() || e.button) return;
  dragY = e.clientY; dragStart = wheelPos; dragMoved = 0;
  wheel.classList.add('drag');
});
win.addEventListener('pointermove', e => {
  mx = e.clientX; my = e.clientY; lastMouse = performance.now();
  if (dragY === null) return;
  const dy = e.clientY - dragY; dragMoved = Math.max(dragMoved, Math.abs(dy));
  wheelPos = wheelTarget = clamp(dragStart - dy / 110, -.4, ids.length - .6);
});
win.addEventListener('pointerup', () => {
  if (dragY === null) return;
  dragY = null; wheel.classList.remove('drag');
  if (dragMoved > 4) select(clamp(Math.round(wheelTarget), 0, ids.length - 1));
});
wheelLis.forEach((li, i) => li.querySelector('a').addEventListener('click', e => {
  e.preventDefault();
  if (dragMoved > 4) return;
  select(i);
}));
function select(i) { wheelTarget = i; show(ids[i]); }

/* --- ASCII-глаз --- */
const eye = (() => {
  const c = $('eye'), read = $('eye-read');
  let src = 'public static void main(String[] args) { return repository.findAll(); } SELECT * FROM accounts WHERE status = 1; ';
  fetch('/v8/app.js').then(r => r.text()).then(t => { src = t.replace(/[^\x21-\x7e]+/g, ' '); }).catch(() => {});
  let px = 0, py = 0, open = 1, blinkAt = performance.now() + 2500, blinkT = -1, acc = 0;
  return {
    draw(dt, t) {
      if (narrow()) return;
      acc += dt; if (acc < 1 / 24) return; acc = 0;
      const { g, w, h } = fit(c);
      const r = c.getBoundingClientRect(), ex = r.left + w / 2, ey = r.top + h / 2;
      const dx = mx - ex, dy = my - ey, dist = Math.hypot(dx, dy) + 160;
      px += (dx / dist - px) * .25; py += (dy / dist - py) * .25;
      if (t > blinkAt && blinkT < 0) blinkT = 0;
      if (blinkT >= 0) { blinkT += 1 / 24; open = Math.abs(Math.cos(Math.min(1, blinkT / .22) * Math.PI)); if (blinkT > .22) { blinkT = -1; open = 1; blinkAt = t + 2500 + Math.random() * 4500; } }
      g.clearRect(0, 0, w, h);
      g.font = '7px "IBM Plex Mono", monospace'; g.textBaseline = 'top';
      // миндалина: резкий контур, бледный белок, плотная радужка с прожилками, пустой зрачок
      const cw = 4.2, chh = 6, a = w * .47, b = h * .4 * Math.max(.04, open);
      const icx = w / 2 + px * a * .36, icy = h / 2 + py * b * .28;
      const ri = h * .26, rp = h * (.09 + .015 * Math.sin(t / 900));
      let k = Math.floor(t / 120) % Math.max(1, src.length - 400);
      for (let y = 0; y < h; y += chh) for (let x = 0; x < w; x += cw) {
        const nx = (x + cw / 2 - w / 2) / a, ny = (y + chh / 2 - h / 2);
        const lim = b * (1 - nx * nx) * (1 - .15 * nx * nx);
        if (Math.abs(nx) > 1 || Math.abs(ny) > lim) continue;
        const ch = src[k++ % src.length];
        const ex = x + cw / 2 - icx, ey = y + chh / 2 - icy, d = Math.hypot(ex, ey);
        if (d < rp) continue;
        const edge = 1 - Math.abs(ny) / Math.max(1, lim);
        if (d < ri) {
          const streak = .55 + .45 * Math.abs(Math.sin(Math.atan2(ey, ex) * 7));
          g.globalAlpha = (d < rp + 4 || d > ri - 4) ? 1 : .55 + .4 * streak;
          g.fillStyle = colors.ink;
        } else {
          g.globalAlpha = edge < .2 ? .85 : .16 + .12 * (1 - edge);
          g.fillStyle = edge < .2 ? colors.ink : colors.dim;
        }
        g.fillText(ch, x, y);
      }
      if (open > .3) { g.globalAlpha = .9; g.fillStyle = colors.ink; g.fillRect(icx - rp * .45, icy - rp * .55, 2.2, 2.2); }
      g.globalAlpha = 1;
      if (read) read.textContent = `['pupil:u'] ${(rp / ri).toFixed(7)}\n${(.5 + px / 2).toFixed(7)}\n${(.5 + py / 2).toFixed(7)}\n${open < 1 ? 'blink' : 'None'}`;
    },
  };
})();

/* --- командная строка «:» --- */
const cmdForm = $('cmdline'), cmdInput = $('cmd-input');
function openCmd() { cmdForm.hidden = false; cmdInput.value = ''; cmdInput.focus(); }
function closeCmd() { cmdForm.hidden = true; cmdInput.blur(); }
function say(cmd, html) {
  const body = $('term-body'), wrap = doc.createElement('div'); wrap.className = 'step';
  wrap.innerHTML = `<p class="pr">pahlavon@dev <i>~</i></p><p class="cmd">${esc(cmd)}</p><div class="out">${html}</div>`;
  body.appendChild(wrap); body.scrollTop = body.scrollHeight;
}
cmdForm.addEventListener('submit', e => {
  e.preventDefault();
  const v = cmdInput.value.trim().replace(/^:/, ''), w = v.toLowerCase();
  closeCmd();
  if (!v) return;
  const alias = { whoami: 'about', about: 'about', work: 'uz-status', stack: 'stack', skills: 'stack', log: 'log', experience: 'log', links: 'links', contact: 'links', 'e-key': 'myid' };
  const id = alias[w] || (ids.includes(w) ? w : null);
  if (id) { select(ids.indexOf(id)); return; }
  if (w === 'help') say(':help', '<dl class="kv"><dt>:whoami</dt><dd>about me</dd><dt>:&lt;project&gt;</dt><dd>uz-status, exchange, tgagent, tekstlybot, plusline, downloader, myid</dd><dt>:stack :log :links</dt><dd>stack, experience, contact</dd><dt>:theme</dt><dd>light / dark</dd><dt>:gh</dt><dd>open github</dd><dt>:q</dt><dd>back to the intro</dd></dl>');
  else if (w === 'theme') { root.classList.toggle('light'); readColors(); keys.wake(); drawWheel.done = false; if (current >= 0) show(ids[current], true); }
  else if (w === 'gh' || w === 'github') win.open('https://github.com/numonjonov', '_blank', 'noopener');
  else if (w === 'q' || w === 'quit' || w === 'exit') leaveDesk();
  else say(':' + v, `<p>fish: Unknown command: ${esc(v)} — try <em>:help</em></p>`);
});
cmdInput.addEventListener('keydown', e => { if (e.key === 'Escape') closeCmd(); });

/* --- клавиатура страницы --- */
doc.addEventListener('keydown', e => {
  if (e.target === cmdInput || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key.length === 1) keys.press(e.key);
  if (!root.classList.contains('desk-on')) {
    if (e.key === 'Enter') { e.preventDefault(); enterDesk('about'); }
    return;
  }
  if (e.key === ':') { e.preventDefault(); openCmd(); }
  else if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); select(clamp(current + 1, 0, ids.length - 1)); }
  else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); select(clamp(current - 1, 0, ids.length - 1)); }
  else if (e.key === 'ArrowRight') stepShot(1);
  else if (e.key === 'ArrowLeft') stepShot(-1);
  else if (e.key === 'Enter' && doc.activeElement === doc.body) {
    const go = $('term-body').querySelector('.go, .links a');
    if (go) go.click();
  }
});
$('enter').addEventListener('click', () => enterDesk('about'));
win.addEventListener('hashchange', () => {
  const id = norm(location.hash.slice(1));
  if (!ids.includes(id)) return;
  if (!root.classList.contains('desk-on')) enterDesk(id); else select(ids.indexOf(id));
});
$('term-body').addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (a) { e.preventDefault(); const id = a.getAttribute('href').slice(1); if (ids.includes(id)) select(ids.indexOf(id)); }
});

/* --- часы Ташкента --- */
const clockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

/* --- главный цикл --- */
let last = 0, clockAcc = 1;
function loop(t) {
  win.requestAnimationFrame(loop);
  const dt = Math.min(.05, last ? (t - last) / 1000 : .016); last = t;
  keys.draw(dt);
  if (root.classList.contains('desk-on')) {
    const before = wheelPos;
    if (dragY === null) wheelPos += (wheelTarget - wheelPos) * (reduced ? 1 : 1 - Math.exp(-dt * 9));
    if (Math.abs(before - wheelPos) > .0005 || !drawWheel.done) { drawWheel(); drawWheel.done = true; }
    eye.draw(dt, t);
    clockAcc += dt;
    if (clockAcc >= .5) {
      clockAcc = 0;
      $('clock').textContent = clockFmt.format(new Date());
      const se = $('st-eye'), sg = $('st-ghost');
      if (se) se.textContent = performance.now() - lastMouse < 1500 ? 'tracking' : ghostTyping ? 'focused' : 'idle';
      if (sg) sg.textContent = ghostTyping ? 'typing' : 'idle';
    }
  }
}
win.addEventListener('resize', () => { keys.wake(); drawWheel.done = false; });

/* --- старт --- */
loadGitHub();
const ALIAS = { work: 'uz-status', contact: 'links', experience: 'log', skills: 'stack', home: 'about' };
const norm = h => ALIAS[h] || h;
const startId = norm(location.hash.slice(1));
if (ids.includes(startId)) enterDesk(startId); else runIntro();
win.requestAnimationFrame(loop);
