/* v30 — по мотивам ECHO (github.com/Jishnu09-siuu/ECHO-WEBSITE): механика
   повторена своим кодом, картинки рисуются здесь же, контент свой.
   - загрузка: точка бежит по волнистой орбите вокруг знака, потом круг схлопывается;
   - первый экран: силуэт-бюст (рельеф → свет на canvas), заголовок с металлом;
   - about: карточка растёт по прокрутке до полного экрана, слова разъезжаются,
     фон — генеративная «звёздная ночь» (мазки по потоковому полю), внутри
     карточки — луч прожектора с пылью и парящий монолит;
   - опыт: вертикальная прокрутка двигает ленту вбок, текст-призрак — параллакс;
   - проекты: аккордеон-карусель, поверх — WebGL-линза (three.js) под курсором;
   - кейсы: 3D-барабан с инерцией (колесо, перетаскивание, клавиши);
   - услуги: аккордеон; окна проекта и контакта; уведомления. */
import * as THREE from '../vendor/three.module.min.js';

const doc = document, win = window, root = doc.documentElement, $ = id => doc.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(hover: none), (pointer: coarse)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = t => 1 - Math.pow(1 - t, 3);
const rngOf = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

/* ============================== контент ============================== */
const PROJECTS = [
  { slug: 'uz-status', name: 'uz-status', href: '/work/uz-status.html', viz: 'uptime', kind: 'Monitoring', status: 'Live',
    info: 'Public uptime monitor for the services Uzbekistan runs on — probes every minute, incident history, open API.', role: 'Solo — design, build, deploy', stack: 'Java 21 · Spring Boot · PostgreSQL · Docker', tag: 'up or down, every minute',
    theme: { bg: '#0f1115', fg: '#e8eaed', ac: '#30c47a', mid: '#262b33' } },
  { slug: 'exchange', name: 'exchange', href: '/work/exchange.html', viz: 'chart', kind: 'Data tool', status: 'Running',
    info: 'Currency tracker with zero dependencies — hand-written Telegram client, hand-drawn SVG and PNG charts.', role: 'Solo — design, build, run', stack: 'Python 3.11 · stdlib only · SQLite', tag: 'standard library only',
    theme: { bg: '#f3f0e8', fg: '#141414', ac: '#2457ff', mid: '#d9d3c4' } },
  { slug: 'tgagent', name: 'tgagent', href: '/work/tgagent.html', viz: 'chat', kind: 'Assistant', status: 'Running',
    info: 'Telegram Business agent in plain Java — no Spring, no bot library; a two-provider fallback and SQLite memory.', role: 'Solo — design, build, run', stack: 'Java · SQLite · Gemini · Groq', tag: 'answers while you sleep',
    theme: { bg: '#17212b', fg: '#e9eef3', ac: '#5fe39a', mid: '#2b5278' } },
  { slug: 'tekstlybot', name: 'tekstlybot', href: '/work/tekstlybot.html', viz: 'wave', kind: 'Media bot', status: 'Running',
    info: 'Telegram media bot moved from blocking handlers to a worker queue — ffmpeg, whisper.cpp and a 256 MB heap ceiling.', role: 'Solo — design, build, run', stack: 'Java · ffmpeg · whisper.cpp · SQLite', tag: 'voice in, text out',
    theme: { bg: '#111111', fg: '#f1f1f1', ac: '#ff7a1a', mid: '#2a2a2a' } },
  { slug: 'plusline', name: 'plusline / keyline', href: '/work/plusline.html', viz: 'shop', kind: 'Shop bots', status: 'Running',
    info: 'Two Telegram shop bots on one aiogram codebase — a JSON catalogue with atomic writes, photo albums, search, no cart.', role: 'Solo — design, build, run', stack: 'Python · aiogram 3 · JSON', tag: 'two shops, one codebase',
    theme: { bg: '#eef3f8', fg: '#10202f', ac: '#2aabee', mid: '#d4e2ee' } },
  { slug: 'downloader', name: 'downloader', href: '/work/downloader.html', viz: 'dl', kind: 'Utility bot', status: 'Running',
    info: 'Universal Telegram download bot — one dispatcher over yt-dlp and gallery-dl; extractor breakage is operations, not bugs.', role: 'Solo — design, build, run', stack: 'Python · yt-dlp · gallery-dl', tag: 'send a link, get the file',
    theme: { bg: '#0b0b0b', fg: '#eaeaea', ac: '#c6ff3d', mid: '#222222' } },
];

/* ============================== макеты проектов на canvas ============================== */
const SANS = '"Plus Jakarta Sans", "Arial Black", Arial, sans-serif', MONO = 'ui-monospace, "Cascadia Mono", Consolas, monospace';
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function vizDraw(g, p, x, y, w, h) {
  const T = p.theme, r = rngOf(p.slug.length * 977 + 13);
  g.save();
  if (p.viz === 'uptime') {
    const rows = ['payments', 'tax portal', 'marketplace', 'cards', 'rail tickets'], rh = h / rows.length;
    rows.forEach((n, k) => {
      const yy = y + k * rh; g.fillStyle = T.fg; g.globalAlpha = .75; g.font = `500 ${Math.round(rh * .3)}px ${MONO}`; g.fillText(n, x, yy + rh * .6); g.globalAlpha = 1;
      const bx = x + w * .26, bw = w * .64, nb = 40, st = bw / nb;
      for (let i = 0; i < nb; i++) { const q = r(); g.fillStyle = q > .975 ? '#e5484d' : q > .94 ? '#f5b83d' : T.ac; g.fillRect(bx + i * st, yy + rh * .2, st * .7, rh * .55); }
    });
  } else if (p.viz === 'chart') {
    g.strokeStyle = T.fg; g.globalAlpha = .16; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(x, y + i * h / 4); g.lineTo(x + w, y + i * h / 4); g.stroke(); }
    g.globalAlpha = 1; g.strokeStyle = T.ac; g.lineWidth = 7; g.beginPath(); let v = h * .55;
    for (let i = 0; i <= 60; i++) { v = clamp(v + (r() - .47) * h * .09, h * .08, h * .92); const px = x + i / 60 * w, py = y + h - v; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
  } else if (p.viz === 'chat') {
    const msgs = [[0, 'Can you move my call to Friday?'], [1, 'Done — Friday, 11:00.'], [0, 'Perfect, thanks!']]; let yy = y; const fs = Math.round(h * .085); g.font = `500 ${fs}px ${MONO}`;
    msgs.forEach(([me, t]) => { const tw = g.measureText(t).width + fs * 1.4, bh = fs * 2.1, bx = me ? x + w - tw : x; g.fillStyle = me ? T.mid : '#202b36'; roundRect(g, bx, yy, tw, bh, fs * .7); g.fill(); g.fillStyle = T.fg; g.fillText(t, bx + fs * .7, yy + bh * .64); yy += bh + fs * .8; });
  } else if (p.viz === 'wave') {
    const n = 64, bw = w / n; for (let i = 0; i < n; i++) { const a = Math.abs(Math.sin(i * .33) * .6 + (r() - .5) * .8), bh = h * (.1 + a * .7); g.fillStyle = T.ac; roundRect(g, x + i * bw, y + h * .5 - bh / 2, bw * .6, bh, bw * .3); g.fill(); }
  } else if (p.viz === 'shop') {
    const cols = 3, rows = 2, gw = w / cols, gh = h / rows;
    for (let k = 0; k < 6; k++) { const cx = x + (k % cols) * gw, cy = y + Math.floor(k / cols) * gh; g.fillStyle = '#fff'; roundRect(g, cx + 8, cy + 8, gw - 16, gh - 16, 14); g.fill(); g.fillStyle = k % 2 ? '#c9d9ea' : '#d9e6d4'; roundRect(g, cx + 22, cy + 22, gw - 44, (gh - 16) * .55, 10); g.fill(); g.fillStyle = T.fg; g.font = `800 ${Math.round(gh * .11)}px ${SANS}`; g.fillText(['128 GB', '256 GB', '64 GB', '512 GB', 'TKL', '75%'][k], cx + 24, cy + gh * .82); }
  } else if (p.viz === 'dl') {
    const items = [['video.mp4', .82], ['audio.m4a', 1], ['gallery/', 1], ['clip.mp4', .37]], rh = h / items.length;
    items.forEach(([f, q], k) => { const yy = y + k * rh; g.font = `500 ${Math.round(rh * .24)}px ${MONO}`; g.fillStyle = T.fg; g.fillText(f, x, yy + rh * .38); g.fillStyle = '#262626'; g.fillRect(x, yy + rh * .52, w, rh * .12); g.fillStyle = T.ac; g.fillRect(x, yy + rh * .52, w * q, rh * .12); });
  }
  g.restore();
}
function drawSlide(p) {
  const W = 1280, H = 900, c = doc.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), T = p.theme;
  g.fillStyle = T.bg; g.fillRect(0, 0, W, H);
  g.fillStyle = T.fg; g.font = `700 22px ${MONO}`; g.fillText(p.name, 48, 52);
  g.globalAlpha = .6; g.textAlign = 'right'; g.fillText('work    about    contact', W - 48, 52); g.textAlign = 'left'; g.globalAlpha = 1;
  let s = 200; g.font = `800 ${s}px ${SANS}`; while (g.measureText(p.name.toUpperCase()).width > W - 96 && s > 40) { s -= 6; g.font = `800 ${s}px ${SANS}`; }
  g.fillText(p.name.toUpperCase(), 44, 100 + s * .8);
  g.font = `500 28px ${MONO}`; g.globalAlpha = .7; g.fillText(p.tag, 48, 140 + s * .8); g.globalAlpha = 1;
  vizDraw(g, p, 48, 200 + s * .8, W - 96, H - (200 + s * .8) - 50);
  return c;
}

/* ============================== силуэт-бюст ============================== */
// рельеф безликого бюста → свет: тёмная фигура с мягким светом сверху и контровым по краю
function bustCanvas(W, H) {
  const c = doc.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  // 1) силуэт: череп, челюсть, уши, шея, трапеции и плечи
  const X = u => W / 2 + u * W / 2, Y = v => v * H;
  g.fillStyle = '#000';
  g.beginPath(); g.ellipse(X(0), Y(.29), W * .172, H * .168, 0, 0, 7); g.fill();
  g.beginPath(); g.moveTo(X(-.34), Y(.29)); g.bezierCurveTo(X(-.35), Y(.43), X(-.22), Y(.52), X(0), Y(.535)); g.bezierCurveTo(X(.22), Y(.52), X(.35), Y(.43), X(.34), Y(.29)); g.closePath(); g.fill();
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(X(s * .335), Y(.355), W * .024, H * .044, s * .25, 0, 7); g.fill(); }
  g.beginPath(); g.moveTo(X(-.165), Y(.44)); g.lineTo(X(-.175), Y(.6));
  g.bezierCurveTo(X(-.3), Y(.655), X(-.66), Y(.66), X(-.84), Y(.735)); g.bezierCurveTo(X(-.96), Y(.79), X(-1.02), Y(.9), X(-1.02), Y(1.01));
  g.lineTo(X(1.02), Y(1.01)); g.bezierCurveTo(X(1.02), Y(.9), X(.96), Y(.79), X(.84), Y(.735)); g.bezierCurveTo(X(.66), Y(.66), X(.3), Y(.655), X(.175), Y(.6));
  g.lineTo(X(.165), Y(.44)); g.closePath(); g.fill();
  const src = g.getImageData(0, 0, W, H).data, N = W * H, M = new Float32Array(N);
  for (let k = 0; k < N; k++) M[k] = src[k * 4 + 3] / 255;
  // 2) рельеф: размытая маска → «подушка», две шкалы
  const blur = (a, r) => {
    const t = new Float32Array(N), o = Float32Array.from(a), w = 2 * r + 1;
    for (let it = 0; it < 3; it++) {
      for (let j = 0; j < H; j++) { let s = 0; const row = j * W; for (let i = -r; i <= r; i++) s += o[row + clamp(i, 0, W - 1)]; for (let i = 0; i < W; i++) { t[row + i] = s / w; s += o[row + Math.min(W - 1, i + r + 1)] - o[row + Math.max(0, i - r)]; } }
      for (let i = 0; i < W; i++) { let s = 0; for (let j = -r; j <= r; j++) s += t[clamp(j, 0, H - 1) * W + i]; for (let j = 0; j < H; j++) { o[j * W + i] = s / w; s += t[Math.min(H - 1, j + r + 1) * W + i] - t[Math.max(0, j - r) * W + i]; } }
    }
    return o;
  };
  const B1 = blur(M, Math.round(W * .05)), B2 = blur(M, Math.round(W * .014)), Z = new Float32Array(N), depth = W * .17;
  for (let k = 0; k < N; k++) Z[k] = M[k] * (Math.sqrt(B1[k]) * .7 + Math.sqrt(B2[k]) * .3) * depth;
  // 3) свет: слабый ключ слева сверху + контровой по краю (сильнее справа), фигура почти чёрная
  const img = g.createImageData(W, H), d = img.data, L = [-.55, .6, .58], ln = Math.hypot(...L);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; if (M[k] < .002) continue;
    const dx = (Z[j * W + Math.min(W - 1, i + 1)] - Z[j * W + Math.max(0, i - 1)]) / 2, dy = (Z[Math.max(0, j - 1) * W + i] - Z[Math.min(H - 1, j + 1) * W + i]) / 2;
    const nl = Math.hypot(dx, dy, 1), nx = -dx / nl, ny = -dy / nl, nz = 1 / nl;
    const lam = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / ln);
    const rim = Math.pow(1 - nz, 2.2) * (.45 + .55 * smooth(-.6, .8, nx * .85 + ny * .35));
    const v = j / H, fall = 1 - .55 * smooth(.55, 1, v);
    const n = ((Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1) - .5;
    const val = clamp((.03 + Math.pow(lam, 3) * .3 + rim * .78) * fall + n * .025, 0, 1) * 255;
    d[k * 4] = val; d[k * 4 + 1] = val; d[k * 4 + 2] = Math.min(255, val * 1.03 + 1); d[k * 4 + 3] = M[k] * 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
/* ============================== «звёздная ночь»: мазки по потоковому полю ============================== */
function noise2(x, y) { const s = Math.sin(x * 1.7 + Math.sin(y * 1.3)) + Math.sin(y * 1.9 + Math.sin(x * .7) * 1.4) + Math.sin((x + y) * .9); return s / 3; }
async function starryNight(c, W, H) {
  c.width = W; c.height = H; const g = c.getContext('2d'), r = rngOf(42);
  g.fillStyle = '#0b0b0d'; g.fillRect(0, 0, W, H);
  const stars = Array.from({ length: 9 }, () => [r() * W, r() * H * .55, (20 + r() * 50) * W / 1600]);
  // вихри вокруг звёзд + общий поток
  const field = (x, y) => {
    let a = noise2(x / W * 4, y / H * 4) * Math.PI;
    for (const [sx, sy, sr] of stars) { const dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy); const w = Math.exp(-d / (sr * 3)); a = lerp(a, Math.atan2(dy, dx) + Math.PI / 2, w); }
    return a;
  };
  const N = Math.round(W * H / 220);
  g.lineCap = 'round';
  for (let k = 0; k < N; k++) {
    let x = r() * W, y = r() * H;
    const yn = y / H, bright = .18 + .5 * (1 - yn) * r();
    g.strokeStyle = `rgba(${200 + r() * 55 | 0},${200 + r() * 55 | 0},${205 + r() * 50 | 0},${bright})`;
    g.lineWidth = (1 + r() * 2.2) * W / 1600;
    g.beginPath(); g.moveTo(x, y);
    const len = 6 + r() * 10;
    for (let s = 0; s < len; s++) { const a = field(x, y); x += Math.cos(a) * 3 * W / 1600; y += Math.sin(a) * 3 * W / 1600; g.lineTo(x, y); }
    g.stroke();
    if ((k & 2047) === 0) await new Promise(res => setTimeout(res, 0));
  }
  // светила
  for (const [sx, sy, sr] of stars) { const rg = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 1.6); rg.addColorStop(0, 'rgba(255,255,255,.95)'); rg.addColorStop(.35, 'rgba(235,235,240,.45)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.beginPath(); g.arc(sx, sy, sr * 1.6, 0, 7); g.fill(); }
  // горы (Чимган) и город внизу
  g.fillStyle = '#050506'; g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 6) { const h = H * (.88 - .15 * Math.pow(Math.max(0, Math.sin(x / W * 3.1 + .4)), 1.4) - .05 * noise2(x / W * 9, 1) - .03 * Math.sin(x / W * 40)); g.lineTo(x, h); }
  g.lineTo(W, H); g.fill();
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${.15 + r() * .5})`; g.fillRect(r() * W, H * (.92 + r() * .07), 1.5 * W / 1600, 1.5 * W / 1600); }
}

/* ============================== запуск ============================== */
init();
async function init() {
  const first = !sessionStorage.getItem('v30-seen');
  const pre = $('pre'), preNum = $('pre-num'), preC = $('pre-c');
  let preT0 = performance.now(), preDone = false;
  // загрузка: точка на волнистой орбите
  if (!reduced && first) {
    const g = preC.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
    preC.width = preC.height = 240 * dpr; g.scale(dpr, dpr);
    const loop = t => {
      if (preDone) return;
      const k = (t - preT0) / 1000; g.clearRect(0, 0, 240, 240);
      const R = th => 84 + 7 * Math.sin(6 * th + k * 2.2);
      g.strokeStyle = 'rgba(13,13,13,.14)'; g.lineWidth = 1; g.beginPath();
      for (let i = 0; i <= 180; i++) { const th = i / 180 * Math.PI * 2, rr = R(th); i ? g.lineTo(120 + Math.cos(th) * rr, 120 + Math.sin(th) * rr) : g.moveTo(120 + Math.cos(th) * rr, 120 + Math.sin(th) * rr); }
      g.stroke();
      for (let j = 0; j < 14; j++) { const th = k * 2.1 - j * .07, rr = R(th); g.fillStyle = `rgba(13,13,13,${(1 - j / 14) * .9})`; g.beginPath(); g.arc(120 + Math.cos(th) * rr, 120 + Math.sin(th) * rr, 4.2 - j * .25, 0, 7); g.fill(); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  const setP = v => { preNum.textContent = String(Math.round(v * 100)).padStart(2, '0'); };

  // шрифты и картинки
  if (doc.fonts && doc.fonts.load) await Promise.race([doc.fonts.load('800 40px "Plus Jakarta Sans"'), new Promise(r => setTimeout(r, 2500))]).catch(() => {});
  setP(.25);
  const slides = PROJECTS.map(drawSlide); setP(.5);
  const thumbs = slides.map(c => c.toDataURL('image/jpeg', .82));
  const bust = $('bust'); const bc = bustCanvas(coarse ? 320 : 440, coarse ? 400 : 550);
  bust.width = bc.width; bust.height = bc.height; bust.getContext('2d').drawImage(bc, 0, 0); setP(.7);

  // загрузка уходит
  const minT = first && !reduced ? 1500 : 0;
  await new Promise(r => setTimeout(r, Math.max(0, minT - (performance.now() - preT0))));
  setP(1); sessionStorage.setItem('v30-seen', '1');
  preDone = true; pre.classList.add('out'); setTimeout(() => pre.remove(), 1200);
  if (!first || reduced) pre.remove();

  setupNav(); setupReveal(); setupHero(bust); setupAbout(); setupMarquee(); setupExperience();
  setupCarousel(slides, thumbs); setupDrum(thumbs); setupAccordion(); setupModals(thumbs); setupCopy();
}

/* ---------- навигация: подсветка раздела, мобильное меню ---------- */
function setupNav() {
  const links = [...doc.querySelectorAll('.pill a')], ids = links.map(a => a.getAttribute('href').slice(1));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ids.forEach(id => { const el = $(id); if (el) io.observe(el); });
  const burger = $('burger'), set = o => { root.classList.toggle('drawer-open', o); burger.setAttribute('aria-expanded', String(o)); };
  burger.addEventListener('click', () => set(!root.classList.contains('drawer-open')));
  $('drawer').addEventListener('click', e => { if (e.target.closest('a') || e.target === $('drawer')) set(false); });
}

/* ---------- появление: и при повторном возвращении ---------- */
function setupReveal() {
  const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('in', e.isIntersecting)), { threshold: .15 });
  doc.querySelectorAll('.rv').forEach((el, i) => { el.style.transitionDelay = (el.closest('.hero') ? i * .08 : 0) + 's'; io.observe(el); });
}

/* ---------- первый экран: бюст двигается за мышью и уходит вниз при прокрутке ---------- */
function setupHero(bust) {
  let mx = 0, my = 0, cx = 0, cy = 0;
  if (!coarse) addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  const ht = doc.querySelector('.hero-t');
  const tick = () => {
    cx = lerp(cx, mx, .06); cy = lerp(cy, my, .06);
    const s = Math.min(scrollY, innerHeight) / innerHeight;
    if (!reduced) {
      const k = innerWidth > 900 ? 1 : .25; bust.style.transform = `translate(${cx * -18}px, ${s * 120 * k + cy * -10}px) scale(${1 + s * .06 * k})`;
      ht.style.transform = `translate(${cx * 10}px, ${s * -60}px)`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- about: растущая карточка ---------- */
function setupAbout() {
  const sec = $('about'), stick = sec.querySelector('.ab-stick'), card = $('ab-card'), bg = $('ab-bg'), media = $('ab-media');
  const w1 = $('ab-w1'), w2 = $('ab-w2'), hint = $('ab-hint'), kk = $('ab-k');
  // фон рисуется один раз, частями, чтобы не подвесить страницу
  const bw = Math.min(1600, Math.round(innerWidth * Math.min(1.5, devicePixelRatio || 1))), bh = Math.round(bw * innerHeight / innerWidth);
  starryNight(bg, bw, bh);
  // внутри карточки: луч прожектора, пыль, парящий монолит
  const mg = media.getContext('2d'), dust = Array.from({ length: 140 }, () => [Math.random(), Math.random(), Math.random()]);
  const t0 = performance.now();
  const visible = () => { const b = sec.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight; };
  function drawMedia(t) {
    const W = media.clientWidth, H = media.clientHeight, dpr = Math.min(1.5, devicePixelRatio || 1);
    if (media.width !== Math.round(W * dpr) || media.height !== Math.round(H * dpr)) { media.width = Math.round(W * dpr); media.height = Math.round(H * dpr); }
    const g = mg; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#030303'; g.fillRect(0, 0, W, H);
    // луч сверху справа
    const ox = W * .78, oy = -H * .08, tx = W * .45, ty = H * .78;
    const ang = Math.atan2(ty - oy, tx - ox), len = Math.hypot(tx - ox, ty - oy) * 1.2, spread = .2 + Math.sin(t * .4) * .01;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      const sp = spread * (1 + k * .5), a0 = ang - sp, a1 = ang + sp;
      const lg = g.createRadialGradient(ox, oy, 0, ox, oy, len); lg.addColorStop(0, `rgba(255,255,255,${.22 / (k + 1)})`); lg.addColorStop(.7, `rgba(255,255,255,${.06 / (k + 1)})`); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg; g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, len, a0, a1); g.closePath(); g.fill();
    }
    // пыль в луче
    for (const p of dust) {
      const y = ((p[1] + t * .012 * (.5 + p[2])) % 1) * H, x = p[0] * W;
      const along = ((x - ox) * Math.cos(ang) + (y - oy) * Math.sin(ang)), perp = Math.abs(-(x - ox) * Math.sin(ang) + (y - oy) * Math.cos(ang));
      const inBeam = Math.max(0, 1 - perp / (along * Math.tan(spread * 1.4) + 1));
      if (inBeam <= 0) continue;
      g.fillStyle = `rgba(255,255,255,${inBeam * (.25 + p[2] * .6)})`; g.beginPath(); g.arc(x, y, .6 + p[2] * 1.6, 0, 7); g.fill();
    }
    g.restore();
    // монолит: вращающаяся призма, освещённая лучом
    const cx = tx, cy = ty - H * .22 + Math.sin(t * .8) * H * .015, s = Math.min(W, H) * .12, rot = t * .35;
    const P = []; for (const yy of [-1.6, 1.6]) for (let k = 0; k < 4; k++) { const a = rot + k * Math.PI / 2; P.push([Math.cos(a) * s * .55, yy * s * .55, Math.sin(a) * s * .55]); }
    const pr = ([x, y, z]) => [cx + x * (1 + z / 900), cy + y * (1 + z / 900) - z * .15];
    for (let k = 0; k < 4; k++) {
      const a = rot + k * Math.PI / 2 + Math.PI / 4, nz = Math.sin(a), nx = Math.cos(a); if (nz < -.05) continue;
      const q = [P[k], P[(k + 1) % 4], P[4 + (k + 1) % 4], P[4 + k]].map(pr), lit = clamp(.08 + .55 * Math.max(0, nx * .6 + nz * .4), 0, 1);
      const fgr = g.createLinearGradient(0, q[0][1], 0, q[3][1]), cc = v => `rgb(${clamp(v, 0, 1) * 255 | 0},${clamp(v, 0, 1) * 255 | 0},${clamp(v * 1.02, 0, 1) * 255 | 0})`; fgr.addColorStop(0, cc(lit * 1.35)); fgr.addColorStop(1, cc(lit * .35));
      g.fillStyle = fgr; g.beginPath(); q.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); g.strokeStyle = `rgba(255,255,255,${.12 + lit * .5})`; g.lineWidth = 1; g.stroke();
    }
    // тень-отблеск на полу
    const fg = g.createRadialGradient(tx, ty + H * .1, 0, tx, ty + H * .1, W * .25); fg.addColorStop(0, 'rgba(255,255,255,.12)'); fg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = fg; g.fillRect(0, 0, W, H);
  }
  const tick = now => {
    requestAnimationFrame(tick);
    if (!visible()) return;
    const r = sec.getBoundingClientRect(), total = sec.offsetHeight - innerHeight;
    const p = clamp(-r.top / total, 0, 1), e = ease(smooth(0, .75, p));
    const W = innerWidth, H = innerHeight;
    card.style.setProperty('--cw', lerp(Math.min(300, W * .6), W * .94, e) + 'px');
    card.style.setProperty('--ch', lerp(Math.min(400, H * .5), H * .88, e) + 'px');
    card.style.setProperty('--cr', lerp(26, 18, e) + 'px');
    card.style.setProperty('--tx', smooth(.72, .92, p).toFixed(3));
    stick.style.setProperty('--sp', (e * W * .5) + 'px');
    stick.style.setProperty('--bgb', lerp(6, 0, e) + 'px'); stick.style.setProperty('--bgl', lerp(.55, .32, e).toFixed(3));
    const fade = 1 - smooth(.45, .7, p); w1.style.opacity = w2.style.opacity = fade; hint.style.opacity = kk.style.opacity = 1 - smooth(.05, .3, p);
    drawMedia((now - t0) / 1000);
  };
  requestAnimationFrame(tick);
}

/* ---------- бегущая строка: время + скорость прокрутки ---------- */
function setupMarquee() {
  const m = $('marq'); m.textContent = m.textContent.repeat(3);
  let x = 0, lastY = scrollY;
  const tick = () => { const dy = scrollY - lastY; lastY = scrollY; if (!reduced) { x -= .6 + Math.abs(dy) * .4; const w = m.scrollWidth / 3; if (-x > w) x += w; m.style.transform = `translate3d(${x}px,0,0)`; } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

/* ---------- опыт: вертикальная прокрутка → лента вбок ---------- */
function setupExperience() {
  const sec = $('experience'), track = $('exp-track'), g1 = $('g1'), g2 = $('g2'), tabs = ['tab-a', 'tab-b', 'tab-c'].map($), panels = [...track.children];
  const size = () => { const extra = Math.max(0, track.scrollWidth - innerWidth); sec.style.height = (innerHeight + extra) + 'px'; return extra; };
  let extra = size(); addEventListener('resize', () => { extra = size(); });
  const tick = () => {
    const r = sec.getBoundingClientRect(), p = clamp(-r.top / Math.max(1, extra), 0, 1);
    track.style.transform = `translate3d(${-p * extra}px,0,0)`;
    g1.style.transform = `translate3d(${-p * extra * .35}px,0,0)`; g2.style.transform = `translate3d(${p * extra * .2 - extra * .1}px,0,0)`;
    let on = 0; panels.forEach((pn, i) => { const b = pn.getBoundingClientRect(); if (b.left < innerWidth * .5) on = i; });
    tabs.forEach((t, i) => t.classList.toggle('on', i === Math.max(0, on - 1)));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- проекты: аккордеон-карусель + WebGL-линза ---------- */
const LENS_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const LENS_FS = `
uniform sampler2D uTex; uniform vec2 uSize, uMouse; uniform float uHover, uTime, uWave, uTexAspect, uOn;
varying vec2 vUv;
void main() {
  vec2 px = vUv * uSize;
  // скруглённые углы 22px
  float cr = min(22.0, min(uSize.x, uSize.y) * 0.3);
  vec2 q = abs(px - uSize * 0.5) - (uSize * 0.5 - cr);
  if (length(max(q, 0.0)) > cr) discard;
  // заполнение «cover» по аспекту картинки
  // по высоте — по центру, по ширине — от левого края (название слайда не режется)
  float ca = uSize.x / uSize.y; vec2 uv = vUv;
  if (ca > uTexAspect) uv.y = (vUv.y - 0.5) * uTexAspect / ca + 0.5; else uv.x = vUv.x * ca / uTexAspect;
  // жидкая волна, пока карточка меняет ширину
  uv.x += sin(vUv.y * 9.0 + uTime * 5.0) * 0.012 * uWave;
  uv.y += sin(vUv.x * 7.0 - uTime * 4.0) * 0.006 * uWave;
  // линза под курсором: увеличение, рябь, расслоение цвета на краю
  vec2 d = px - uMouse; float dist = length(d); float R = min(uSize.y * 0.36, 150.0);
  float k = smoothstep(R, 0.0, dist) * uHover;
  vec2 dir = d / uSize;
  float rip = sin(dist * 0.08 - uTime * 6.0) * 0.006 * k;
  vec2 base = uv - dir * k * 0.22 + rip;
  float edge = smoothstep(0.2, 0.9, k) * (1.0 - smoothstep(0.9, 1.0, k));
  vec3 col;
  col.r = texture2D(uTex, base + dir * 0.018 * edge).r;
  col.g = texture2D(uTex, base).g;
  col.b = texture2D(uTex, base - dir * 0.018 * edge).b;
  col += k * 0.06;
  // неактивные — приглушены
  col *= mix(0.72, 1.0, uOn);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, mix(0.35, 1.0, uOn));
  // затемнение снизу под подпись
  col *= 1.0 - smoothstep(0.55, 1.0, 1.0 - vUv.y) * 0.45 * uOn;
  gl_FragColor = vec4(col, 1.0);
}`;
function setupCarousel(slides, thumbs) {
  const fc = $('fc'), cap = $('fc-cap'), glc = $('fc-gl');
  const cards = PROJECTS.map((p, i) => {
    const b = doc.createElement('button'); b.type = 'button'; b.className = 'fc-card' + (i === 0 ? ' on' : '');
    b.style.backgroundImage = `url(${thumbs[i]})`; b.setAttribute('aria-label', `${p.name} — ${p.kind}`);
    b.innerHTML = `<span class="fc-lab" style="z-index:3"><b>${p.name}</b><span>${p.kind} ↗</span></span>`;
    fc.appendChild(b); return b;
  });
  let active = 0;
  const setActive = i => { active = i; cards.forEach((c, k) => c.classList.toggle('on', k === i)); cap.textContent = `${String(i + 1).padStart(2, '0')} / ${String(PROJECTS.length).padStart(2, '0')} — ${PROJECTS[i].info}`; };
  setActive(0);
  cards.forEach((c, i) => {
    c.addEventListener('click', () => { if (active === i) openProject(i); else setActive(i); });
    if (!coarse) c.addEventListener('pointerenter', () => setActive(i));
    c.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); cards[(i + 1) % cards.length].focus(); setActive((i + 1) % cards.length); } if (e.key === 'ArrowLeft') { e.preventDefault(); const j = (i + cards.length - 1) % cards.length; cards[j].focus(); setActive(j); } });
  });

  // WebGL поверх: те же карточки, но с линзой и жидкой волной
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: glc, alpha: true, antialias: true }); } catch (e) { return; }
  THREE.ColorManagement.enabled = false; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  fc.classList.add('gl-on');
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10);
  const geo = new THREE.PlaneGeometry(1, 1);
  if (location.hostname === "localhost") win.__v30 = { renderer, scene, cam };
  const quads = slides.map(s => {
    const tex = new THREE.CanvasTexture(s); tex.anisotropy = 4;
    const u = { uTex: { value: tex }, uSize: { value: new THREE.Vector2() }, uMouse: { value: new THREE.Vector2(-999, -999) }, uHover: { value: 0 }, uTime: { value: 0 }, uWave: { value: 0 }, uTexAspect: { value: s.width / s.height }, uOn: { value: 0 } };
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: LENS_VS, fragmentShader: LENS_FS, uniforms: u, transparent: true, side: THREE.DoubleSide }));
    scene.add(m); return { m, u, w: 0 };
  });
  let mouse = { x: -999, y: -999, in: false }; const t0 = performance.now();
  const visible = () => { const b = fc.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight; };
  fc.addEventListener('pointermove', e => { const r = fc.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top, in: true }; });
  fc.addEventListener('pointerleave', () => { mouse.in = false; });
  const tick = now => {
    requestAnimationFrame(tick);
    if (!visible()) return;
    const fr = fc.getBoundingClientRect(), W = fr.width, H = fr.height;
    if (glc.width !== Math.round(W * renderer.getPixelRatio())) { renderer.setSize(W, H, false); }
    cam.right = W; cam.bottom = H; cam.updateProjectionMatrix();
    const t = (now - t0) / 1000;
    cards.forEach((c, i) => {
      const r = c.getBoundingClientRect(), q = quads[i], x = r.left - fr.left, y = r.top - fr.top;
      q.m.position.set(x + r.width / 2, y + r.height / 2, 0); q.m.scale.set(r.width, -r.height, 1);
      q.u.uSize.value.set(r.width, r.height);
      const inside = mouse.in && mouse.x > x && mouse.x < x + r.width && mouse.y > y && mouse.y < y + r.height;
      q.u.uMouse.value.set(mouse.x - x, mouse.y - y);
      q.u.uHover.value = lerp(q.u.uHover.value, inside && !coarse ? 1 : 0, .12);
      q.u.uWave.value = lerp(q.u.uWave.value, clamp(Math.abs(r.width + r.height - q.w) / 6, 0, 1), .2); q.w = r.width + r.height;
      q.u.uOn.value = lerp(q.u.uOn.value, i === active ? 1 : 0, .1);
      q.u.uTime.value = t;
    });
    renderer.render(scene, cam);
  };
  requestAnimationFrame(tick);
}

/* ---------- кейсы: 3D-барабан ---------- */
function setupDrum(thumbs) {
  const drum = $('drum'), ring = $('ring'), list = $('drum-list'), nameEl = $('drum-n'), N = PROJECTS.length, step = 360 / N;
  const cards = PROJECTS.map((p, i) => { const d = doc.createElement('div'); d.className = 'd-card'; d.style.backgroundImage = `url(${thumbs[i]})`; d.dataset.i = i; ring.appendChild(d); return d; });
  const items = PROJECTS.map((p, i) => { const li = doc.createElement('li'); li.textContent = p.name; li.addEventListener('click', () => goTo(i)); list.appendChild(li); return li; });
  let rot = 0, vel = 0, target = null, dragging = false, lastX = 0, moved = 0, activeI = -1;
  const R = () => Math.min(drum.clientWidth, drum.clientHeight) * (drum.clientWidth < 520 ? .3 : .36);
  const nearest = () => ((Math.round(-rot / step) % N) + N) % N;
  const goTo = i => { const cur = nearest(); let d = i - cur; if (d > N / 2) d -= N; if (d < -N / 2) d += N; target = Math.round(rot / step) * step - d * step; };
  drum.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; moved = 0; target = null; drum.setPointerCapture(e.pointerId); });
  drum.addEventListener('pointermove', e => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx); vel = dx * .35; rot += vel; });
  drum.addEventListener('pointerup', e => {
    dragging = false;
    if (moved < 6) { const el = doc.elementsFromPoint(e.clientX, e.clientY).find(x => x.classList && x.classList.contains('d-card')); if (el) { const i = +el.dataset.i; if (i === nearest()) openProject(i); else goTo(i); } }
  });
  drum.addEventListener('pointercancel', () => { dragging = false; });
  drum.addEventListener('wheel', e => { e.preventDefault(); target = null; vel -= (e.deltaY + e.deltaX) * .045; }, { passive: false });
  drum.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goTo((nearest() + 1) % N); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goTo((nearest() + N - 1) % N); }
    if (e.key === 'Enter') openProject(nearest());
  });
  const tick = () => {
    if (!dragging) {
      if (target !== null) { rot = lerp(rot, target, .12); if (Math.abs(rot - target) < .05) { rot = target; target = null; } }
      else { rot += vel; vel *= .93; if (Math.abs(vel) < .08) { vel = 0; target = Math.round(rot / step) * step; } }
    }
    const r = R();
    cards.forEach((c, i) => {
      const a = i * step + rot, rad = a * Math.PI / 180, front = (Math.cos(rad) + 1) / 2;
      c.style.transform = `rotateX(14deg) rotateZ(${a}deg) translateY(${-r}px) translateZ(${front * 70}px) scale(${.86 + front * .22})`;
      c.style.zIndex = String(Math.round(front * 100));
    });
    const n = nearest();
    if (n !== activeI) { activeI = n; cards.forEach((c, i) => c.classList.toggle('on', i === n)); items.forEach((li, i) => li.classList.toggle('on', i === n)); nameEl.textContent = PROJECTS[n].name; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- услуги: аккордеон (одна открыта) ---------- */
function setupAccordion() {
  const items = [...doc.querySelectorAll('.acc-i')];
  const open = i => items.forEach((it, k) => { const o = k === i && !it.classList.contains('open'); it.classList.toggle('open', o); it.querySelector('.acc-h').setAttribute('aria-expanded', String(o)); });
  items.forEach((it, i) => it.querySelector('.acc-h').addEventListener('click', () => open(i)));
  open(0);
}

/* ---------- окна: проект и контакт ---------- */
let openProject = () => {};
function setupModals(thumbs) {
  const pm = $('pm'), cm = $('cm'); let lastFocus = null;
  const show = m => { lastFocus = doc.activeElement; m.hidden = false; requestAnimationFrame(() => m.classList.add('on')); m.querySelector('.modal-x').focus(); doc.body.style.overflow = 'hidden'; };
  const hide = m => { m.classList.remove('on'); doc.body.style.overflow = ''; setTimeout(() => { m.hidden = true; }, 450); if (lastFocus) lastFocus.focus(); };
  openProject = i => {
    const p = PROJECTS[i];
    $('pm-img').style.backgroundImage = `url(${thumbs[i]})`; $('pm-k').textContent = `${String(i + 1).padStart(2, '0')} · ${p.kind.toUpperCase()}`;
    $('pm-t').textContent = p.name; $('pm-d').textContent = p.info; $('pm-r').textContent = p.role; $('pm-s').textContent = p.stack; $('pm-st').textContent = p.status; $('pm-a').href = p.href;
    show(pm);
  };
  [pm, cm].forEach(m => { m.addEventListener('click', e => { if (e.target === m || e.target.closest('.modal-x')) hide(m); }); });
  addEventListener('keydown', e => { if (e.key === 'Escape') [pm, cm].forEach(m => { if (!m.hidden) hide(m); }); });
  doc.querySelectorAll('[data-contact]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); show(cm); }));
}

/* ---------- копирование почты + уведомление ---------- */
function toast(text) {
  const t = doc.createElement('div'); t.className = 'toast'; t.textContent = text; $('toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 2400);
}
function setupCopy() {
  doc.querySelectorAll('.copy-mail').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText('pahlavon@numonjonov.com'); toast('Email copied — pahlavon@numonjonov.com'); }
    catch (e) { location.href = 'mailto:pahlavon@numonjonov.com'; }
  }));
}
