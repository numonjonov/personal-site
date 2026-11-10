/* v6 — сайт-портфолио поверх Backrooms (three.js r160 из vendor/).
   Страница обычная и скроллится. Позади неё — коридор Level 0: камера идёт
   по нему вместе со скроллом, у каждого раздела останавливается напротив
   своей записки на стене, а свет и туман перетекают между «уровнями»
   (0 Lobby → 1 Habitable Zone → 2 Pipe Dreams → 3 Electrical Station → !).
   В конце — дверь EXIT, и на странице как раз контакты.
   Все текстуры рисуются на canvas здесь же. Без WebGL сайт тот же, без фона. */
import * as THREE from '../vendor/three.module.min.js';

const doc = document, win = window, root = doc.documentElement;
const $ = id => doc.getElementById(id);
const reduced = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = win.matchMedia('(hover: none), (pointer: coarse)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => t * t * (3 - 2 * t);
root.classList.add('js');

/* ---------- Текстуры на canvas (детерминированный random — уровень всегда один) ---------- */
function rng(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- Текстуры на canvas ---------- */
function canvas2d(w, h, draw) {
  const c = doc.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}
function noise(g, w, h, amp, rand) {
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - .5) * amp;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * .8;
  }
  g.putImageData(img, 0, 0);
}
function blot(g, x, y, r, rgba) {
  const s = g.createRadialGradient(x, y, 0, x, y, r);
  s.addColorStop(0, rgba); s.addColorStop(1, rgba.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = s; g.fillRect(x - r, y - r, r * 2, r * 2);
}
function wallpaper(seed) {
  const rand = rng(seed);
  return canvas2d(256, 346, (g, w, h) => {
    g.fillStyle = '#d8c67c'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = 'rgba(150,118,40,.13)'; g.fillRect(x, 0, 2, h);
      g.fillStyle = 'rgba(255,250,215,.14)'; g.fillRect(x + 16, 0, 1, h);
    }
    g.strokeStyle = 'rgba(140,110,36,.24)'; g.lineWidth = 1.4;
    for (let y = 10; y < h + 28; y += 28) for (let x = 0; x < w; x += 32) {
      const ox = x + 8, oy = y + ((x / 32) % 2 ? 14 : 0);
      g.beginPath(); g.moveTo(ox, oy - 5); g.lineTo(ox + 4, oy); g.lineTo(ox, oy + 5); g.lineTo(ox - 4, oy); g.closePath(); g.stroke();
    }
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(70,52,12,.32)'); gr.addColorStop(.1, 'rgba(70,52,12,0)');
    gr.addColorStop(.78, 'rgba(80,58,14,0)'); gr.addColorStop(1, 'rgba(80,58,14,.42)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) blot(g, rand() * w, h * (.55 + rand() * .5), 24 + rand() * 70, `rgba(105,78,20,${(.06 + rand() * .14).toFixed(2)})`);
    for (let i = 0; i < 4; i++) {
      const x = rand() * w, len = h * (.08 + rand() * .3);
      const d = g.createLinearGradient(0, 0, 0, len);
      d.addColorStop(0, 'rgba(95,70,18,.2)'); d.addColorStop(1, 'rgba(95,70,18,0)');
      g.fillStyle = d; g.fillRect(x, 0, 1.5 + rand() * 3, len);
    }
    g.fillStyle = 'rgba(60,45,12,.5)'; g.fillRect(0, h - 5, w, 5); // плинтус
    noise(g, w, h, 14, rand);
  });
}
function carpet() {
  const rand = rng(7);
  return canvas2d(512, 512, (g, w, h) => {
    g.fillStyle = '#8f7c3f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) blot(g, rand() * w, rand() * h, 40 + rand() * 120, `rgba(70,52,16,${(.12 + rand() * .2).toFixed(2)})`);
    for (let i = 0; i < 5; i++) blot(g, rand() * w, rand() * h, 30 + rand() * 80, 'rgba(190,170,100,.12)');
    noise(g, w, h, 46, rand);
  });
}
function ceiling() {
  const rand = rng(3);
  return canvas2d(256, 256, (g, w, h) => {
    g.fillStyle = '#dcd6b6'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(80,70,40,.5)';
    for (let i = 0; i < 900; i++) g.fillRect(rand() * w, rand() * h, 1.2, 1.2);
    blot(g, rand() * w, rand() * h, 50, 'rgba(150,115,40,.25)');
    g.fillStyle = '#a9a07c';
    for (let i = 0; i <= 4; i++) { g.fillRect(i * 64 - 2, 0, 4, h); g.fillRect(0, i * 64 - 2, w, 4); }
    noise(g, w, h, 10, rand);
  });
}
function paper(note) {
  const rand = rng(note.no.charCodeAt(1) * 31);
  return canvas2d(512, 680, (g, w, h) => {
    g.fillStyle = '#efe7cd'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(70,100,170,.18)';
    for (let y = 170; y < h - 30; y += 46) g.fillRect(30, y, w - 60, 2);
    g.fillStyle = 'rgba(210,70,60,.35)'; g.fillRect(70, 0, 2, h);
    blot(g, rand() * w, h * .8, 120, 'rgba(160,130,60,.18)');
    const e = g.createLinearGradient(0, 0, w, 0);
    e.addColorStop(0, 'rgba(120,95,40,.18)'); e.addColorStop(.08, 'rgba(0,0,0,0)'); e.addColorStop(.92, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(120,95,40,.18)');
    g.fillStyle = e; g.fillRect(0, 0, w, h);
    g.save(); g.translate(w / 2, 10); g.rotate(-.05);
    g.fillStyle = 'rgba(232,222,168,.85)'; g.fillRect(-80, -12, 160, 44); g.restore();
    g.fillStyle = '#5c5333'; g.font = '30px "VT323", monospace'; g.fillText('No. ' + note.no, w - 120, 78);
    g.fillStyle = '#1f2440';
    let size = 50; g.font = `${size}px "Special Elite", monospace`;
    while (g.measureText(note.title).width > w - 120 && size > 30) { size -= 2; g.font = `${size}px "Special Elite", monospace`; }
    g.fillText(note.title, 88, 140); g.fillText(note.title, 89.5, 140.5);
    g.font = '34px "Special Elite", monospace';
    note.lines.forEach((l, i) => { const y = 210 + i * 46 + (rand() - .5) * 4; g.fillText(l, 88, y); g.fillText(l, 89, y); });
    g.fillStyle = '#9b2a20'; g.font = '30px "Special Elite", monospace';
    g.fillText('— P.N.', w - 170, h - 54);
    noise(g, w, h, 12, rand);
  });
}
function door() {
  const rand = rng(99);
  return canvas2d(256, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#4b4a40'); gr.addColorStop(.5, '#5f5d50'); gr.addColorStop(1, '#46453c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; g.strokeRect(26, 30, w - 52, 170); g.strokeRect(26, 300, w - 52, 180);
    g.fillStyle = '#16150f'; g.fillRect(84, 60, 88, 110);
    g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(84, 60); g.lineTo(130, 60); g.lineTo(84, 120); g.fill();
    g.fillStyle = '#26251f'; g.fillRect(20, 250, w - 40, 22);
    g.fillStyle = '#8e8b7a'; g.fillRect(24, 253, w - 48, 6);
    blot(g, w * .7, h * .9, 70, 'rgba(40,30,10,.35)');
    noise(g, w, h, 18, rand);
  });
}
function exitSign() {
  return canvas2d(256, 96, (g, w, h) => {
    g.fillStyle = '#1c0907'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#4a1a12'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#ff4433'; g.shadowColor = '#ff2a1a'; g.shadowBlur = 18;
    g.font = '80px "VT323", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('EXIT', w / 2, h / 2 + 4);
  });
}
function halo() {
  return canvas2d(128, 128, (g, w, h) => blot(g, w / 2, h / 2, w / 2, 'rgba(255,248,215,.9)'));
}
function smiler() {
  return canvas2d(256, 256, g => {
    g.shadowColor = '#fff'; g.shadowBlur = 22; g.fillStyle = '#fffdf2';
    g.beginPath(); g.ellipse(86, 96, 17, 9, -.15, 0, Math.PI * 2); g.ellipse(170, 96, 17, 9, .15, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(52, 140); g.quadraticCurveTo(128, 236, 204, 140); g.quadraticCurveTo(128, 186, 52, 140); g.fill();
    g.shadowBlur = 0; g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 3;
    for (let x = 66; x < 196; x += 13) { g.beginPath(); g.moveTo(x, 140); g.lineTo(x, 210); g.stroke(); }
  });
}


/* ================= Страница ================= */

/* Появление блоков */
const items = Array.from(doc.querySelectorAll('.reveal'));
const showAll = () => items.forEach(el => el.classList.add('in'));
if (reduced || !('IntersectionObserver' in win)) showAll();
else {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .08, rootMargin: '0px 0px -6% 0px' });
  items.forEach(el => io.observe(el));
  win.setTimeout(showAll, 4000); // страховка
}

/* Наклон панелей за мышью: 3D-поворот и блик лампы */
if (!coarse && !reduced) {
  doc.querySelectorAll('[data-tilt]').forEach(el => {
    const max = el.classList.contains('paper') ? 5 : 7;
    el.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.classList.add('hot');
      el.style.setProperty('--rx', ((.5 - y) * max).toFixed(2) + 'deg');
      el.style.setProperty('--ry', ((x - .5) * max * 1.3).toFixed(2) + 'deg');
      el.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('hot');
      el.style.removeProperty('--rx'); el.style.removeProperty('--ry');
    });
  });
}

/* Уровни: что показывает HUD и каким светом горит коридор */
const THEMES = [
  { lvl: 'LEVEL 0', name: 'THE LOBBY', fog: 0x8f7f44, wall: 0xffffff, lamp: 0xfffbe6, light: 0xffefc0, sky: 0xfff2c4, ground: 0x5c4a1e, hemi: 1.7, li: 5.5, density: .05, acc: [214, 196, 122] },
  { lvl: 'LEVEL 1', name: 'HABITABLE ZONE', fog: 0x46453f, wall: 0x8e8d86, lamp: 0xf4f7ff, light: 0xe8eeff, sky: 0xe6ecf5, ground: 0x34332e, hemi: 1.5, li: 6.5, density: .055, acc: [208, 212, 216] },
  { lvl: 'LEVEL 2', name: 'PIPE DREAMS', fog: 0x2a1b0e, wall: 0x7a5434, lamp: 0xffb366, light: 0xff9a40, sky: 0xffc890, ground: 0x2a1a0a, hemi: .62, li: 7, density: .065, acc: [255, 152, 72] },
  { lvl: 'LEVEL 3', name: 'ELECTRICAL STATION', fog: 0x0f151c, wall: 0x56616d, lamp: 0xb4d8ff, light: 0x9cc8ff, sky: 0xbcd4ff, ground: 0x0c1018, hemi: .5, li: 7, density: .07, acc: [140, 192, 255] },
  { lvl: 'LEVEL !', name: 'RUN FOR YOUR LIFE', fog: 0x2c0605, wall: 0xb06a5c, lamp: 0xff5444, light: 0xff3020, sky: 0xff8070, ground: 0x200404, hemi: .72, li: 7, density: .06, acc: [255, 72, 52] },
];
const SECTIONS = ['top', 'about', 'work', 'skills', 'experience', 'contact'].map(id => $(id));
const SEC_LEVEL = [0, 0, 1, 2, 3, 4];
const navLinks = Array.from(doc.querySelectorAll('.top nav a'));

/* Скролл → параметр p от 0 (hero) до 5 (contact), кусочно по разделам */
let anchors = [];
function measure() {
  const max = Math.max(1, root.scrollHeight - win.innerHeight);
  anchors = SECTIONS.map((s, i) => i === 0 ? 0 : s.getBoundingClientRect().top + win.scrollY - win.innerHeight * .3);
  anchors[anchors.length - 1] = Math.min(anchors[anchors.length - 1], max);
  for (let i = 1; i < anchors.length; i++) anchors[i] = clamp(anchors[i], anchors[i - 1] + 1, Math.max(anchors[i - 1] + 1, max));
}
function scrollParam() {
  const y = win.scrollY;
  for (let i = 0; i < anchors.length - 1; i++) {
    if (y < anchors[i + 1]) return i + clamp((y - anchors[i]) / (anchors[i + 1] - anchors[i]), 0, 1);
  }
  return anchors.length - 1;
}
/* Уровень как дробное число: переход начинается в последней трети пути к разделу */
function levelOf(p) {
  const i = Math.min(Math.floor(p), SEC_LEVEL.length - 1), f = p - i;
  const a = SEC_LEVEL[i], b = SEC_LEVEL[Math.min(i + 1, SEC_LEVEL.length - 1)];
  return a + (b - a) * smooth(clamp((f - .55) / .45, 0, 1));
}
measure();
win.addEventListener('resize', measure);
win.addEventListener('load', measure);
if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(measure);
if ('ResizeObserver' in win) new ResizeObserver(measure).observe($('main'));

/* HUD: часы, уровень, глубина, акцентный цвет страницы */
const hudClock = $('clock'), hudLvl = $('lvl'), hudName = $('lvl-name'), hudDepth = $('depth');
const t0 = performance.now();
let shownLevel = -1, shownSec = -1, shownAcc = '', shownClock = -1;
let scrambleId = 0;
function scramble(el, text) {
  win.clearInterval(scrambleId);
  if (reduced) { el.textContent = text; return; }
  const glyphs = '▓▒░#%&@$01'; let n = 0;
  const id = scrambleId = win.setInterval(() => {
    n++;
    el.textContent = text.split('').map((ch, i) => (ch === ' ' || i < n * 2) ? ch : glyphs[(Math.random() * glyphs.length) | 0]).join('');
    if (n * 2 >= text.length) { win.clearInterval(id); el.textContent = text; }
  }, 35);
}
function updatePage(p, L, depth) {
  const lvl = Math.round(L);
  if (lvl !== shownLevel) {
    const first = shownLevel < 0;
    shownLevel = lvl;
    hudLvl.textContent = THEMES[lvl].lvl;
    scramble(hudName, THEMES[lvl].name);
    if (!first && !reduced) { root.classList.remove('glitch'); void root.offsetWidth; root.classList.add('glitch'); }
  }
  const sec = Math.min(SECTIONS.length - 1, Math.floor(p + .25));
  if (sec !== shownSec) {
    shownSec = sec;
    const id = SECTIONS[sec].id;
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
  }
  const i = Math.min(Math.floor(L), THEMES.length - 1), f = L - i;
  const A = THEMES[i].acc, B = THEMES[Math.min(i + 1, THEMES.length - 1)].acc;
  const acc = A.map((v, k) => Math.round(v + (B[k] - v) * f)).join(', ');
  if (acc !== shownAcc) { shownAcc = acc; root.style.setProperty('--acc', acc); }
  hudDepth.textContent = 'DEPTH ' + String(Math.round(depth)).padStart(3, '0') + ' M';
  const s = Math.floor((performance.now() - t0) / 1000);
  if (s !== shownClock) {
    shownClock = s;
    hudClock.textContent = [s / 3600, s / 60 % 60, s % 60].map(v => String(Math.floor(v)).padStart(2, '0')).join(':');
  }
}

/* Зерно плёнки — один раз, двигает его CSS */
{
  const c = doc.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d'), img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  root.style.setProperty('--noise', `url(${c.toDataURL()})`);
}

/* ================= 3D-коридор ================= */

/* Карта: коридор в две клетки (4 м) с северного конца на южный, по бокам
   случайные комнаты. # стена, . пол, o тёмная комната, N стена с запиской,
   X — дверь EXIT в северном торце. Клетка 2 м. */
const C = 2, H = 2.7, EYE = 1.6, COLS = 12, ROWS = 66;
const grid = Array.from({ length: ROWS }, () => Array(COLS).fill('#'));
for (let r = 1; r < ROWS - 1; r++) grid[r][5] = grid[r][6] = '.';
const rooms = [];
{
  const gr = rng(2026);
  for (let r = ROWS - 6; r > 5;) {
    const h = 2 + Math.floor(gr() * 3);
    const sides = gr() < .3 ? [-1, 1] : [gr() < .5 ? -1 : 1];
    sides.forEach(side => {
      const depth = 2 + Math.floor(gr() * 3);
      const c0 = side < 0 ? 5 - depth : 7, c1 = side < 0 ? 4 : 6 + depth;
      for (let y = r - h + 1; y <= r; y++) for (let x = c0; x <= c1; x++) grid[y][x] = '.';
      if (h >= 3 && depth >= 3) grid[r - 1][side < 0 ? c0 + 1 : c1 - 1] = '#';
      rooms.push({ c0, c1, r0: r - h + 1, r1: r, side });
    });
    r -= h + 2 + Math.floor(gr() * 4);
  }
}
grid[0][5] = grid[0][6] = 'X';

/* Остановки камеры: по одной на раздел. Записки висят в 5 м впереди */
const Z0 = (ROWS - 1.5) * C, Z1 = C + 2.6;
const STOPS = SECTIONS.map((_, k) => Z0 + (Z1 - Z0) * k / (SECTIONS.length - 1));
const WALL_NOTES = [
  null,
  { no: '01', title: 'WHO BUILT THIS', lines: ['backend engineer,', 'a bank in Tashkent.', 'Java · Spring · Oracle', 'talks to old systems.'] },
  { no: '02', title: 'THINGS I SHIPPED', lines: ['uz-status — uptime', 'exchange — 0 deps', 'tgagent, tekstlybot', '+ bots, bots, bots'] },
  { no: '03', title: 'INVENTORY', lines: ['Java 21 / 17', 'Spring Boot, PL/SQL', 'Postgres, SQLite', 'Docker, Linux, CI'] },
  { no: '04', title: 'WHERE I WORK', lines: ['2025 — present', 'core banking: iABS', 'MyID, e-key / DVS', 'JavaEE on WebLogic'] },
  null,
];
const notesAt = [];
WALL_NOTES.forEach((note, k) => {
  if (!note) return;
  const side = k % 2 ? -1 : 1;             // -1 запад (слева по ходу), 1 восток
  const r = Math.floor((STOPS[k] - 5) / C), c = side < 0 ? 4 : 7;
  grid[r][c] = 'N'; grid[r - 1][c] = grid[r + 1][c] = '#'; // ровная стена вокруг записки
  notesAt.push({ note, r, c, side, stop: STOPS[k] });
});

/* Тёмная комната с «улыбакой» — та, что ближе всего к уровню 2 */
const darkRoom = rooms.filter(rm => rm.c1 - rm.c0 >= 1)
  .sort((a, b) => Math.abs((a.r0 + a.r1) / 2 * C - STOPS[3] - 9) - Math.abs((b.r0 + b.r1) / 2 * C - STOPS[3] - 9))[0];
if (darkRoom) for (let y = darkRoom.r0; y <= darkRoom.r1; y++) for (let x = darkRoom.c0; x <= darkRoom.c1; x++) if (grid[y][x] === '.') grid[y][x] = 'o';

const cell = (c, r) => (r < 0 || r >= ROWS || c < 0 || c >= COLS) ? '#' : grid[r][c];
const isOpen = (c, r) => { const ch = cell(c, r); return ch === '.' || ch === 'o'; };
const DIRS = [[0, -1], [-1, 0], [1, 0], [0, 1]];

function canWebGL() {
  try { const c = doc.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
}

let hasScene = false;
if (canWebGL()) {
  try { buildScene(); hasScene = true; } catch (err) { console.error(err); }
}
if (!hasScene) {
  // без 3D страница всё равно знает уровни и красит акцент
  const loop = () => { const p = scrollParam(); updatePage(p, levelOf(p), 0); win.requestAnimationFrame(loop); };
  win.requestAnimationFrame(loop);
}

function buildScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: !coarse, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, coarse ? 1 : 1.25));
  renderer.setSize(win.innerWidth, win.innerHeight);
  $('stage').appendChild(renderer.domElement);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = (c, rx, ry) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    if (rx) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
    return t;
  };

  const T = THEMES.map(t => ({
    fog: new THREE.Color(t.fog), wall: new THREE.Color(t.wall), lamp: new THREE.Color(t.lamp),
    light: new THREE.Color(t.light), sky: new THREE.Color(t.sky), ground: new THREE.Color(t.ground),
    hemi: t.hemi, li: t.li, density: t.density,
  }));
  const scene = new THREE.Scene();
  scene.background = T[0].fog.clone();
  scene.fog = new THREE.FogExp2(T[0].fog.clone(), T[0].density);
  const camera = new THREE.PerspectiveCamera(70, win.innerWidth / win.innerHeight, .05, 90);
  camera.rotation.order = 'YXZ';
  const hemi = new THREE.HemisphereLight(T[0].sky, T[0].ground, T[0].hemi);
  scene.add(hemi);

  /* стены: только клетки, что граничат с полом */
  const wallGeo = new THREE.BoxGeometry(C, H, C);
  const wallMats = [11, 47, 83].map(s => new THREE.MeshLambertMaterial({ map: tex(wallpaper(s)) }));
  const buckets = [[], [], []], pick = rng(5);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (isOpen(c, r) || !DIRS.some(([dx, dz]) => isOpen(c + dx, r + dz))) continue;
    buckets[Math.floor(pick() * 3)].push([c, r]);
  }
  const m4 = new THREE.Matrix4();
  buckets.forEach((list, i) => {
    const mesh = new THREE.InstancedMesh(wallGeo, wallMats[i], list.length);
    list.forEach(([c, r], k) => mesh.setMatrixAt(k, m4.makeTranslation((c + .5) * C, H / 2, (r + .5) * C)));
    scene.add(mesh);
  });

  const W = COLS * C, D = ROWS * C;
  const floorMat = new THREE.MeshLambertMaterial({ map: tex(carpet(), W / 4, D / 4) });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, D / 2); scene.add(floor);
  const ceilMat = new THREE.MeshLambertMaterial({ map: tex(ceiling(), W / 2, D / 2) });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilMat);
  ceil.rotation.x = Math.PI / 2; ceil.position.set(W / 2, H, D / 2); scene.add(ceil);
  const tinted = [...wallMats, floorMat, ceilMat];

  /* лампы: по оси коридора каждые 4 м и в комнатах; часть мертва, три мерцают */
  const litMat = new THREE.MeshBasicMaterial({ color: 0xfffbe6 });
  const deadMat = new THREE.MeshBasicMaterial({ color: 0x5d584a });
  const haloMat = new THREE.SpriteMaterial({ map: tex(halo()), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .42 });
  const lamps = [], lr = rng(21);
  const addLamp = (x, z, along, dead) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(along ? .6 : 1.2, .05, along ? 1.2 : .6), dead ? deadMat : litMat);
    mesh.position.set(x, H - .025, z); scene.add(mesh);
    if (dead) return;
    const glow = new THREE.Sprite(haloMat);
    glow.position.set(x, H - .12, z); glow.scale.set(2.2, 1.3, 1); scene.add(glow);
    lamps.push({ x, z, mesh, glow, k: 1, flick: null });
  };
  for (let r = 1; r < ROWS - 1; r += 2) addLamp(6 * C, (r + .5) * C, true, lr() < .06);
  for (let r = 1; r < ROWS - 1; r += 2) for (let c = 1; c < COLS - 1; c += 2) {
    if (c === 5 || !isOpen(c, r)) continue;
    addLamp((c + .5) * C, (r + .5) * C, false, cell(c, r) === 'o' || lr() < .1);
  }
  [8, 19, 31].map(i => lamps[i]).filter(Boolean).forEach(l => {
    l.mesh.material = litMat.clone(); l.glow.material = haloMat.clone(); l.flick = { t: 0, on: true };
  });
  const POOL = coarse ? 4 : 7;
  const pool = Array.from({ length: POOL }, () => {
    const L = new THREE.PointLight(0xffefc0, 0, 9, 1.7);
    L.position.y = H - .35; scene.add(L); return { L, lamp: null };
  });
  let poolT = 0;
  const assignPool = (px, pz) => {
    const near = lamps.slice().sort((a, b) => ((a.x - px) ** 2 + (a.z - pz) ** 2) - ((b.x - px) ** 2 + (b.z - pz) ** 2));
    pool.forEach((p, i) => { p.lamp = near[i] || null; if (p.lamp) p.L.position.set(p.lamp.x, H - .35, p.lamp.z); });
  };

  /* записки на стенах */
  const noteGeo = new THREE.PlaneGeometry(.46, .61);
  notesAt.forEach(({ note, r, c, side }) => {
    const map = tex(paper(note));
    const mesh = new THREE.Mesh(noteGeo, new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .12 }));
    const dx = -side; // записка смотрит в коридор
    mesh.position.set((c + .5) * C + dx * (C / 2 + .012), 1.45, (r + .5) * C);
    mesh.rotation.set(0, Math.atan2(dx, 0), (lr() - .5) * .1);
    scene.add(mesh);
  });

  /* дверь EXIT в северном торце */
  {
    const x = 6 * C, z = C + .012;
    const dm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.15), new THREE.MeshLambertMaterial({ map: tex(door()) }));
    dm.position.set(x, 1.075, z); scene.add(dm);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(.66, .25), new THREE.MeshBasicMaterial({ map: tex(exitSign()), fog: false }));
    sign.position.set(x, 2.4, z + .01); scene.add(sign);
    const red = new THREE.PointLight(0xff3322, 4, 8, 1.5);
    red.position.set(x, 2.2, z + .6); scene.add(red);
  }

  /* тёмная комната: чёрный полупрозрачный объём (видны только внутренние грани)
     и «улыбака», которая светится сквозь туман */
  let smile = null;
  if (darkRoom) {
    const { c0, c1, r0, r1, side } = darkRoom;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry((c1 - c0 + 1) * C - .02, H - .02, (r1 - r0 + 1) * C - .02),
      new THREE.MeshBasicMaterial({ color: 0x0b0903, transparent: true, opacity: .84, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    box.position.set((c0 + c1 + 1) / 2 * C, H / 2, (r0 + r1 + 1) / 2 * C); box.renderOrder = 1; scene.add(box);
    const far = side < 0 ? c0 : c1;
    smile = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(smiler()), transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    smile.position.set((far + .5) * C, 1.7, (r0 + r1 + 1) / 2 * C); smile.scale.set(.8, .8, 1); smile.renderOrder = 2;
    scene.add(smile);
  }

  /* гул ламп — только по кнопке, WebAudio без файлов */
  const AC = win.AudioContext || win.webkitAudioContext;
  const sndBtn = $('snd');
  let ac = null, hum = null, humOn = false;
  if (AC) {
    sndBtn.hidden = false;
    sndBtn.addEventListener('click', () => {
      if (!ac) {
        ac = new AC(); hum = ac.createGain(); hum.gain.value = 0;
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300;
        hum.connect(lp); lp.connect(ac.destination);
        [[60, 'sine', .5], [120, 'sawtooth', .2], [180, 'sine', .1], [240, 'square', .02]].forEach(([f, type, v]) => {
          const o = ac.createOscillator(); o.type = type; o.frequency.value = f;
          const g = ac.createGain(); g.gain.value = v; o.connect(g); g.connect(hum); o.start();
        });
      }
      humOn = !humOn;
      if (humOn) ac.resume();
      hum.gain.setTargetAtTime(humOn ? .05 : 0, ac.currentTime, .15);
      sndBtn.textContent = humOn ? 'Hum: on' : 'Hum: off';
      sndBtn.setAttribute('aria-pressed', String(humOn));
    });
  }

  /* мышь чуть поворачивает голову */
  let mx = 0, my = 0, smx = 0, smy = 0;
  if (!coarse) win.addEventListener('pointermove', e => { mx = e.clientX / win.innerWidth - .5; my = e.clientY / win.innerHeight - .5; }, { passive: true });

  win.addEventListener('resize', () => {
    camera.aspect = win.innerWidth / win.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(win.innerWidth, win.innerHeight);
  });

  const zAt = p => {
    const i = Math.min(Math.floor(p), STOPS.length - 2), f = clamp(p - i, 0, 1);
    return STOPS[i] + (STOPS[i + 1] - STOPS[i]) * smooth(f);
  };
  let camZ = reduced ? Z0 : zAt(scrollParam()), bob = 0, last = 0;
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();
  const mix = (key, i, f) => tmpA.copy(T[i][key]).lerp(T[Math.min(i + 1, T.length - 1)][key], f);

  function tick(t) {
    win.requestAnimationFrame(tick);
    const dt = Math.min(.05, last ? (t - last) / 1000 : .016); last = t;
    const p = scrollParam(), L = levelOf(p);

    // камера: едет к точке раздела, у записки поворачивает голову к ней
    const tz = reduced ? Z0 : zAt(p);
    const prev = camZ;
    camZ += (tz - camZ) * (1 - Math.exp(-dt * 3.2));
    const speed = Math.abs(camZ - prev) / dt;
    bob += dt * Math.min(speed, 4) * 2.4;
    let look = 0;
    notesAt.forEach(n => { const d = (camZ - n.stop) / 5; look += -n.side * .55 * Math.exp(-d * d); });
    smx += (mx - smx) * (1 - Math.exp(-dt * 4)); smy += (my - smy) * (1 - Math.exp(-dt * 4));
    const amp = reduced ? 0 : .035 * Math.min(1, speed / 2.5);
    camera.position.set(6 * C + Math.sin(camZ * .13) * .35, EYE + Math.abs(Math.sin(bob)) * amp, camZ);
    camera.rotation.set(-.03 - smy * .12, look - smx * .3, reduced ? 0 : Math.sin(bob) * amp * .3);

    // уровень: туман, свет, тон стен
    const i = Math.min(Math.floor(L), T.length - 1), f = L - i, nx = Math.min(i + 1, T.length - 1);
    scene.fog.color.copy(mix('fog', i, f)); scene.background.copy(scene.fog.color);
    scene.fog.density = T[i].density + (T[nx].density - T[i].density) * f;
    hemi.color.copy(mix('sky', i, f)); hemi.groundColor.copy(mix('ground', i, f));
    hemi.intensity = T[i].hemi + (T[nx].hemi - T[i].hemi) * f;
    tmpB.copy(mix('wall', i, f)); tinted.forEach(m => m.color.copy(tmpB));
    const lampCol = mix('lamp', i, f).clone();
    litMat.color.copy(lampCol); haloMat.color.copy(lampCol);
    const lightCol = mix('light', i, f).clone(), li = T[i].li + (T[nx].li - T[i].li) * f;

    // мерцание и пул ламп у камеры
    lamps.forEach(l => {
      if (!l.flick) return;
      if (reduced) { l.mesh.material.color.copy(lampCol); l.glow.material.color.copy(lampCol); return; }
      const fl = l.flick; fl.t -= dt;
      if (fl.t <= 0) { fl.on = !fl.on; fl.t = fl.on ? (Math.random() < .7 ? .04 + Math.random() * .12 : 1 + Math.random() * 3) : .03 + Math.random() * .1; }
      l.k = fl.on ? 1 : .08;
      l.mesh.material.color.copy(lampCol).multiplyScalar(fl.on ? 1 : .35);
      l.glow.material.color.copy(lampCol); l.glow.material.opacity = .42 * l.k;
    });
    poolT -= dt;
    if (poolT <= 0) { poolT = .2; assignPool(camera.position.x, camZ - 3); }
    pool.forEach(pl => { pl.L.color.copy(lightCol); pl.L.intensity = pl.lamp ? li * pl.lamp.k : 0; });

    if (smile) {
      const d = Math.hypot(smile.position.x - camera.position.x, smile.position.z - camZ);
      smile.material.opacity = clamp((d - 4) / 4, 0, 1) * clamp((24 - d) / 6, 0, 1) * (reduced || Math.random() > .03 ? .9 : .25);
    }

    updatePage(p, L, Z0 - camZ);
    renderer.render(scene, camera);
  }
  win.requestAnimationFrame(tick);
}
