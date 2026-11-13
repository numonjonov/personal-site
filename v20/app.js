/* v20 — по мотивам fojcikdominik.com: механика и визуал повторены своим кодом,
   контент свой, чужих ассетов нет (портрет, макеты, город, улица — процедурные).

   Устройство:
   - пять «миров» (своя сцена и камера у каждого): портрет, белая галерея
     экранов-проектов, синий город (about), ночная улица (contact) и студия
     (открытый проект). Прокрутка 0…1 ведёт камеру по миру, на стыках миры
     меняются горизонтальными полосами помех (MIX_FS);
   - портрет — тысячи кубиков (InstancedMesh): глубина и свет из рельефа
     бюста (или из фото, если указано data-portrait у холста), строки
     иногда «съезжают», голова следит за мышью/гироскопом; за ним —
     квадродерево того же портрета, нарисованное линиями на изогнутой стене;
   - проекты — изогнутые экраны с макетами, нарисованными на canvas; клик
     (или #slug в адресе) открывает студию: большой экран, боковые экраны,
     миниатюры, Esc/close — назад;
   - поверх всего ЭЛТ-проход (CRT_FS): изгиб кинескопа, RGB-разводы,
     сканлайны, зерно, полоса срыва строк, свечение (bright → blur).
   three.js r160 из /vendor/. */
import * as THREE from '../vendor/three.module.min.js';

const doc = document, win = window, root = doc.documentElement;
const $ = id => doc.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(hover: none), (pointer: coarse)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function canWebGL() {
  try { const c = doc.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
if (canWebGL()) start().catch(err => { console.error(err); root.classList.remove('has-gl'); });
else root.classList.remove('has-gl');

/* ============================== контент ============================== */
const PROJECTS = [
  { slug: 'uz-status', name: 'uz-status', href: '/work/uz-status.html', viz: 'uptime',
    info: 'Public uptime monitor for the services Uzbekistan runs on — probes every minute, incident history, open API.',
    role: ['Design', 'Build', 'Deploy'], stack: 'Java 21 · Spring Boot · PostgreSQL · Docker', tag: 'up or down, every minute',
    theme: { bg: '#0f1115', fg: '#e8eaed', ac: '#30c47a', mid: '#262b33' },
    log: ['$ ./run.sh', 'probe payments ........ up   212 ms', 'probe tax portal ...... up   388 ms', 'probe marketplace ..... DOWN timeout', 'rollup hourly → folded, raw deleted', 'cycle complete, 0 escaped exceptions'] },
  { slug: 'exchange', name: 'exchange', href: '/work/exchange.html', viz: 'chart',
    info: 'Currency tracker with zero dependencies — hand-written Telegram client, hand-drawn SVG and PNG charts.',
    role: ['Design', 'Build', 'Run'], stack: 'Python 3.11 · stdlib only · SQLite', tag: 'standard library only',
    theme: { bg: '#f3f0e8', fg: '#141414', ac: '#2457ff', mid: '#d9d3c4' },
    log: ['$ python -m exchange fetch', 'central bank ........ ok', 'exchange offices .... ok', 'chart → usd_uzs.svg (hand-drawn)', 'alert → telegram (hand-written client)', 'third-party packages: 0'] },
  { slug: 'tgagent', name: 'tgagent', href: '/work/tgagent.html', viz: 'chat',
    info: 'Telegram Business agent in plain Java — no Spring, no bot library; a two-provider fallback and SQLite memory.',
    role: ['Design', 'Build', 'Run'], stack: 'Java · SQLite · Gemini · Groq', tag: 'answers while you sleep',
    theme: { bg: '#17212b', fg: '#e9eef3', ac: '#5fe39a', mid: '#2b5278' },
    log: ['$ java -jar tgagent.jar', 'business_connection ...... ok', 'gemini → timeout', 'fallback → groq ........... ok', 'memory → sqlite', 'no spring, no bot library'] },
  { slug: 'tekstlybot', name: 'tekstlybot', href: '/work/tekstlybot.html', viz: 'wave',
    info: 'Telegram media bot moved from blocking handlers to a worker queue — ffmpeg, whisper.cpp and a 256 MB heap ceiling.',
    role: ['Design', 'Build', 'Run'], stack: 'Java · ffmpeg · whisper.cpp · SQLite', tag: 'voice in, text out',
    theme: { bg: '#111111', fg: '#f1f1f1', ac: '#ff7a1a', mid: '#2a2a2a' },
    log: ['$ java -Xmx256m -jar tekstly.jar', 'queue ............ ready', 'ffmpeg  ogg → wav 16 kHz', 'whisper.cpp → text', 'heap under 256 MB', 'job done'] },
  { slug: 'plusline', name: 'plusline / keyline', href: '/work/plusline.html', viz: 'shop',
    info: 'Two Telegram shop bots on one aiogram codebase — a JSON catalogue with atomic writes, photo albums, search, no cart.',
    role: ['Design', 'Build', 'Run'], stack: 'Python · aiogram 3 · JSON', tag: 'two shops, one codebase',
    theme: { bg: '#eef3f8', fg: '#10202f', ac: '#2aabee', mid: '#d4e2ee' },
    log: ['$ python bot.py --shop plusline', 'catalogue.json ........ loaded', 'write → .tmp → rename (atomic)', 'media group → album', 'search → results', 'no cart — a manager takes over'] },
  { slug: 'downloader', name: 'downloader', href: '/work/downloader.html', viz: 'dl',
    info: 'Universal Telegram download bot — one dispatcher over yt-dlp and gallery-dl; extractor breakage is operations, not bugs.',
    role: ['Design', 'Build', 'Run'], stack: 'Python · yt-dlp · gallery-dl', tag: 'send a link, get the file',
    theme: { bg: '#0b0b0b', fg: '#eaeaea', ac: '#c6ff3d', mid: '#222222' },
    log: ['$ python -m downloader', 'link → dispatcher', 'yt-dlp ........ video ok', 'gallery-dl .... images ok', 'extractor broke → ops, not a bug', 'files sent'] },
];

/* ============================== макеты на canvas ============================== */
const SANS = '"Arial Black", "Helvetica Neue", Arial, sans-serif', MONO = 'ui-monospace, "Cascadia Mono", Consolas, monospace';
function vizDraw(g, p, x, y, w, h) {
  const T = p.theme, r = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(p.slug.length * 977 + 13);
  g.save();
  if (p.viz === 'uptime') {
    const rows = ['payments', 'tax portal', 'marketplace', 'cards', 'rail tickets', 'post'], rh = h / rows.length;
    rows.forEach((n, k) => {
      const yy = y + k * rh;
      g.fillStyle = T.fg; g.globalAlpha = .75; g.font = `500 ${Math.round(rh * .32)}px ${MONO}`; g.fillText(n, x, yy + rh * .62); g.globalAlpha = 1;
      const bx = x + w * .26, bw = w * .64, nb = 44, step = bw / nb;
      for (let i = 0; i < nb; i++) { const q = r(); g.fillStyle = q > .975 ? '#e5484d' : q > .94 ? '#f5b83d' : T.ac; g.fillRect(bx + i * step, yy + rh * .2, step * .7, rh * .6); }
      g.fillStyle = T.fg; g.globalAlpha = .55; g.fillText((99 + r() * .98).toFixed(2) + '%', x + w * .92, yy + rh * .62); g.globalAlpha = 1;
    });
  } else if (p.viz === 'chart') {
    g.strokeStyle = T.fg; g.globalAlpha = .18; g.lineWidth = 1.5;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(x, y + i * h / 4); g.lineTo(x + w, y + i * h / 4); g.stroke(); }
    g.globalAlpha = 1; g.strokeStyle = T.ac; g.lineWidth = 6; g.beginPath();
    let v = h * .55;
    for (let i = 0; i <= 60; i++) { v = clamp(v + (r() - .47) * h * .09, h * .08, h * .92); const px = x + i / 60 * w, py = y + h - v; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
  } else if (p.viz === 'chat') {
    const msgs = [[0, 'Can you move my call to Friday?'], [1, 'Done — Friday, 11:00. New invite sent.'], [0, 'Perfect, thanks!'], [1, 'Anything else for this week?']];
    let yy = y; const fs = Math.round(h * .07);
    g.font = `500 ${fs}px ${MONO}`;
    msgs.forEach(([me, t]) => {
      const tw = g.measureText(t).width + fs * 1.4, bh = fs * 2.1, bx = me ? x + w - tw : x;
      g.fillStyle = me ? T.mid : '#202b36'; roundRect(g, bx, yy, tw, bh, fs * .7); g.fill();
      g.fillStyle = T.fg; g.fillText(t, bx + fs * .7, yy + bh * .64); yy += bh + fs * .7;
    });
    g.fillStyle = '#1f3d2b'; roundRect(g, x + w * .28, yy + fs * .3, w * .44, fs * 1.6, fs * .8); g.fill();
    g.fillStyle = T.ac; g.font = `500 ${Math.round(fs * .78)}px ${MONO}`; g.textAlign = 'center'; g.fillText('gemini → timeout → groq', x + w * .5, yy + fs * 1.4); g.textAlign = 'left';
  } else if (p.viz === 'wave') {
    const n = 72, bw = w / n;
    for (let i = 0; i < n; i++) { const a = Math.abs(Math.sin(i * .33) * .6 + (r() - .5) * .8); const bh = h * (.08 + a * .6); g.fillStyle = T.ac; roundRect(g, x + i * bw, y + h * .4 - bh / 2, bw * .6, bh, bw * .3); g.fill(); }
    g.fillStyle = T.fg; g.font = `500 ${Math.round(h * .07)}px ${MONO}`; g.fillText('“…the report goes out before lunch.”', x, y + h * .9);
  } else if (p.viz === 'shop') {
    const cols = 3, rows = 2, gw = w / cols, gh = h / rows;
    for (let k = 0; k < cols * rows; k++) {
      const cx = x + (k % cols) * gw, cy = y + Math.floor(k / cols) * gh;
      g.fillStyle = '#ffffff'; roundRect(g, cx + 8, cy + 8, gw - 16, gh - 16, 14); g.fill();
      g.fillStyle = k % 2 ? '#c9d9ea' : '#d9e6d4'; roundRect(g, cx + 22, cy + 22, gw - 44, (gh - 16) * .55, 10); g.fill();
      g.fillStyle = T.fg; g.font = `700 ${Math.round(gh * .1)}px ${SANS}`; g.fillText(['128 GB', '256 GB', '64 GB', '512 GB', 'TKL', '75%'][k], cx + 24, cy + gh * .78);
      g.globalAlpha = .55; g.font = `500 ${Math.round(gh * .07)}px ${MONO}`; g.fillText(k % 3 ? 'new' : 'used', cx + 24, cy + gh * .9); g.globalAlpha = 1;
    }
  } else if (p.viz === 'dl') {
    const items = [['video.mp4', .82], ['audio.m4a', 1], ['gallery/ 12 images', 1], ['clip.mp4', .37]], rh = h / items.length;
    items.forEach(([f, q], k) => {
      const yy = y + k * rh; g.font = `500 ${Math.round(rh * .24)}px ${MONO}`;
      g.fillStyle = T.fg; g.fillText(f, x, yy + rh * .38);
      g.fillStyle = q === 1 ? T.ac : '#888'; g.textAlign = 'right'; g.fillText(q === 1 ? 'done ✓' : Math.round(q * 100) + '%', x + w, yy + rh * .38); g.textAlign = 'left';
      g.fillStyle = '#262626'; g.fillRect(x, yy + rh * .52, w, rh * .1); g.fillStyle = T.ac; g.fillRect(x, yy + rh * .52, w * q, rh * .1);
    });
  }
  g.restore();
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function fitFont(g, text, maxW, size, weight = 900, fam = SANS) { let s = size; g.font = `${weight} ${s}px ${fam}`; while (g.measureText(text).width > maxW && s > 20) { s -= 4; g.font = `${weight} ${s}px ${fam}`; } return s; }

// три кадра на проект: первый экран сайта, интерфейс крупно, терминал
function drawSlide(p, kind) {
  const W = 1280, H = 800, c = doc.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), T = p.theme;
  if (kind === 2) {
    g.fillStyle = '#0c0d0e'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1b1d20'; g.fillRect(0, 0, W, 54);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((cc, i) => { g.fillStyle = cc; g.beginPath(); g.arc(34 + i * 26, 27, 8, 0, 7); g.fill(); });
    g.fillStyle = '#8a9099'; g.font = `500 22px ${MONO}`; g.fillText(`${p.slug} — logs`, 130, 35);
    g.font = `500 34px ${MONO}`;
    p.log.forEach((l, i) => { g.fillStyle = i === 0 ? T.ac : (/DOWN|broke|timeout/.test(l) ? '#ff6b6b' : '#d6dade'); g.fillText(l, 60, 140 + i * 82); });
    g.fillStyle = T.ac; g.fillRect(60, 140 + p.log.length * 82 - 28, 18, 34);
    return c;
  }
  g.fillStyle = T.bg; g.fillRect(0, 0, W, H);
  // шапка «сайта»
  g.fillStyle = T.fg; g.font = `700 22px ${MONO}`; g.fillText(p.name, 48, 52);
  g.globalAlpha = .65; g.textAlign = 'right'; g.fillText('work    about    contact', W - 48, 52); g.textAlign = 'left'; g.globalAlpha = 1;
  if (kind === 0) {
    const s = fitFont(g, p.name.toUpperCase(), W - 96, 210);
    g.fillStyle = T.fg; g.fillText(p.name.toUpperCase(), 44, 110 + s * .82);
    g.font = `500 28px ${MONO}`; g.globalAlpha = .7; g.fillText(p.tag, 48, 130 + s * .82 + 36); g.globalAlpha = 1;
    vizDraw(g, p, 48, 230 + s * .82, W - 96, H - (230 + s * .82) - 50);
  } else {
    g.fillStyle = T.ac; roundRect(g, 48, 92, 240, 44, 22); g.fill();
    g.fillStyle = T.bg; g.font = `700 20px ${MONO}`; g.fillText(p.stack.split(' · ')[0], 66, 121);
    vizDraw(g, p, 48, 170, W - 96, H - 230);
  }
  return c;
}
function slideTex(c) { const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; }
function thumbURL(c) { const t = doc.createElement('canvas'); t.width = 100; t.height = 62; t.getContext('2d').drawImage(c, 0, 0, 100, 62); return t.toDataURL('image/jpeg', .7); }

/* ============================== портрет ============================== */
// рельеф бюста: голова, шея, плечи, уши и лёгкие черты лица — без чьей-либо внешности
function bustField(GW, GH) {
  const z = new Float32Array(GW * GH);
  const g = (u, v, cu, cv, su, sv) => Math.exp(-(((u - cu) / su) ** 2) - (((v - cv) / sv) ** 2));
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const u = (i + .5 - GW / 2) / (GH / 2), v = (GH / 2 - (j + .5)) / (GH / 2);
    let best = 0;
    // голова: к подбородку уже
    const a = .36 * (1 - .26 * smooth(.36, .0, v)), qh = (u / a) ** 2 + ((v - .33) / .47) ** 2;
    if (qh < 1) {
      let zh = .34 * Math.sqrt(1 - qh);
      zh += .075 * g(u, v, 0, .3, .05, .1);                          // нос
      zh -= .045 * (g(u, v, -.13, .43, .065, .04) + g(u, v, .13, .43, .065, .04)); // глазницы
      zh += .02 * (g(u, v, -.13, .49, .08, .022) + g(u, v, .13, .49, .08, .022));       // брови
      zh -= .025 * g(u, v, 0, .16, .09, .018);                          // рот
      zh += .02 * g(u, v, 0, .05, .08, .045);                            // подбородок
      best = Math.max(best, zh);
    }
    const qe = Math.min(((u - .36) / .04) ** 2, ((u + .36) / .04) ** 2) + ((v - .38) / .085) ** 2;
    if (qe < 1) best = Math.max(best, .11 * Math.sqrt(1 - qe));         // уши
    if (Math.abs(u) < .2 && v < .02 && v > -.28) best = Math.max(best, .2 * Math.sqrt(1 - (u / .19) ** 2)); // шея
    const qs = (u / 1.12) ** 2 + ((v + .9) / .66) ** 2;
    if (qs < 1) best = Math.max(best, .42 * Math.sqrt(1 - qs) - .04);   // плечи
    z[j * GW + i] = best;
  }
  return z;
}
async function portraitData(GW, GH) {
  const url = $('gl').dataset.portrait;
  let depth, shade, mask = new Uint8Array(GW * GH);
  if (url) {
    // фото (лучше на тёмном фоне): яркость → глубина и свет
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    const c = doc.createElement('canvas'); c.width = GW; c.height = GH; const g = c.getContext('2d');
    const k = Math.max(GW / img.width, GH / img.height); g.drawImage(img, (GW - img.width * k) / 2, (GH - img.height * k) / 2, img.width * k, img.height * k);
    const px = g.getImageData(0, 0, GW, GH).data; depth = new Float32Array(GW * GH); shade = new Float32Array(GW * GH);
    for (let i = 0; i < GW * GH; i++) { const l = (px[i * 4] * .3 + px[i * 4 + 1] * .59 + px[i * 4 + 2] * .11) / 255; shade[i] = l; depth[i] = .05 + l * .35; mask[i] = l > .06 ? 1 : 0; }
    return { depth, shade, mask };
  }
  depth = bustField(GW, GH); shade = new Float32Array(GW * GH);
  const L = new THREE.Vector3(.85, .35, .45).normalize(), n = new THREE.Vector3(), sx = 2 / GH;
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const k = j * GW + i, d = depth[k]; if (d <= .008) continue;
    mask[k] = 1;
    const dx = (depth[j * GW + Math.min(GW - 1, i + 1)] - depth[j * GW + Math.max(0, i - 1)]) / (2 * sx);
    const dy = (depth[Math.max(0, j - 1) * GW + i] - depth[Math.min(GH - 1, j + 1) * GW + i]) / (2 * sx);
    n.set(-dx, -dy, 1).normalize();
    const lam = Math.max(0, n.dot(L)), rim = Math.pow(1 - n.z, 2.2);
    shade[k] = clamp(Math.pow(lam, 1.6) * .95 + rim * .18, 0, 1);
  }
  return { depth, shade, mask };
}
// квадродерево по портрету: мелкие клетки там, где больше деталей
function quadtreeCanvas(data, GW, GH) {
  const S = 256, ox = (S - GW) >> 1, oy = Math.max(0, ((S - GH) >> 1) - 18);
  const val = new Float32Array(S * S);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const k = j * GW + i; val[(j + oy) * S + i + ox] = data.mask[k] ? data.shade[k] * .8 + data.depth[k] : 0; }
  const I = new Float64Array((S + 1) * (S + 1)), I2 = new Float64Array((S + 1) * (S + 1));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = val[y * S + x], k = (y + 1) * (S + 1) + x + 1;
    I[k] = v + I[k - 1] + I[k - S - 1] - I[k - S - 2]; I2[k] = v * v + I2[k - 1] + I2[k - S - 1] - I2[k - S - 2];
  }
  const sum = (A, x, y, s) => A[(y + s) * (S + 1) + x + s] - A[y * (S + 1) + x + s] - A[(y + s) * (S + 1) + x] + A[y * (S + 1) + x];
  const C = 2048, sc = C / S, c = doc.createElement('canvas'); c.width = c.height = C;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, C, C);
  g.strokeStyle = 'rgba(210,228,245,.9)';
  const node = (x, y, s) => {
    const n = s * s, m = sum(I, x, y, s) / n, vr = sum(I2, x, y, s) / n - m * m;
    if (s > 2 && vr > .0009 * (s > 32 ? .4 : 1)) { const h = s >> 1; node(x, y, h); node(x + h, y, h); node(x, y + h, h); node(x + h, y + h, h); return; }
    g.lineWidth = s >= 32 ? 5 : s >= 8 ? 3 : 2;
    g.strokeRect(x * sc + 1, y * sc + 1, s * sc - 2, s * sc - 2);
  };
  for (let y = 0; y < S; y += 32) for (let x = 0; x < S; x += 32) node(x, y, 32);
  return c;
}

/* ============================== шейдеры ============================== */
const VOX_VS = `
attribute vec3 aCell;   // x, y, глубина
attribute vec2 aInfo;   // свет, строка
uniform float uTime, uCell, uGlitch, uIntro;
varying float vShade, vFace;
float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
void main() {
  vec3 p = position;
  p.z = (p.z + 0.5) * aCell.z;
  p.xy *= uCell * 0.86;
  vec3 wp = vec3(aCell.xy, 0.0) + p;
  float row = aInfo.y, tk = floor(uTime * 9.0);
  float g = step(0.992 - uGlitch * 0.25, h1(row * 0.731 + tk * 1.37));
  wp.x += g * (h1(row + tk * 3.1) - 0.5) * 0.9;
  float rr = h1(aCell.x * 13.1 + aCell.y * 7.7);
  float k = smoothstep(rr * 0.6, rr * 0.6 + 0.4, uIntro);
  wp.z += (1.0 - k) * (2.0 + rr * 8.0);
  vShade = aInfo.x * k;
  vec3 n = normalize(normalMatrix * normal);
  vFace = n.z > 0.5 ? 1.0 : (n.x > 0.5 ? 0.62 : (n.y > 0.5 ? 0.78 : 0.4));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.0);
}`;
const VOX_FS = `
uniform vec3 uTint, uDark;
varying float vShade, vFace;
void main() {
  vec3 col = mix(uDark, uTint, vShade) * vFace;
  col += uTint * pow(vShade, 6.0) * 0.35;
  gl_FragColor = vec4(col, 1.0);
}`;
const WALL_VS = `varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WALL_FS = `
uniform sampler2D uMap; uniform float uTime, uIntro;
varying vec2 vUv; varying vec3 vP;
void main() {
  float l = texture2D(uMap, vUv).r;
  vec2 c = vUv - vec2(0.5, 0.55);
  float spot = exp(-dot(c * vec2(1.6, 1.1), c * vec2(1.6, 1.1)) * 5.0);
  float flick = 0.92 + 0.08 * sin(uTime * 7.0 + vP.y * 2.0);
  vec3 col = vec3(0.62, 0.72, 0.8) * l * (0.16 + 0.7 * spot) * flick * uIntro;
  gl_FragColor = vec4(col, 1.0);
}`;
const SCREEN_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SCREEN_FS = `
uniform sampler2D uMap; uniform float uTime, uGlitch, uHover, uBright, uAspect;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  // скруглённые углы и рамка-кинескоп
  vec2 q = abs(uv - 0.5) * vec2(uAspect, 1.0); vec2 hs = vec2(0.5 * uAspect, 0.5) - 0.04;
  float rd = length(max(q - hs + 0.06, 0.0)) - 0.06;
  if (rd > 0.0) discard;
  float bez = smoothstep(-0.028, -0.018, rd);
  float band = floor(uv.y * 30.0), tk = floor(uTime * 24.0);
  uv.x += uGlitch * (h(vec2(band, tk)) - 0.5) * 0.12 * step(0.55, h(vec2(band * 1.7, tk)));
  vec3 col = texture2D(uMap, uv).rgb * uBright;
  col *= 0.9 + 0.1 * sin(uv.y * 900.0);
  col += uHover * 0.06;
  col = mix(col, vec3(0.03), bez);
  gl_FragColor = vec4(col, 1.0);
}`;
const CITY_VS = `
varying vec3 vW; varying vec3 vN; varying float vId;
void main() {
  vec4 wp = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
    vN = normalize(mat3(instanceMatrix) * normal);
  #else
    vN = normal;
  #endif
  vId = float(gl_InstanceID);
  wp = modelMatrix * wp; vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const CITY_FS = `
uniform vec3 uFogC; uniform vec3 uCam; uniform float uTime;
varying vec3 vW; varying vec3 vN; varying float vId;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 n = normalize(vN);
  vec3 base = vec3(0.12, 0.26, 0.4);
  float lit = 0.55 + 0.45 * max(dot(n, normalize(vec3(0.4, 0.9, 0.25))), 0.0);
  vec3 col = base * lit;
  if (n.y < 0.5) {
    float along = abs(n.x) > 0.5 ? vW.z : vW.x;
    vec2 cell = vec2(floor(along * 2.2), floor(vW.y * 2.6));
    vec2 f = vec2(fract(along * 2.2), fract(vW.y * 2.6));
    float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.25, f.y) * step(f.y, 0.75);
    float on = step(0.62, h(cell + vId * 3.1));
    col = mix(col, vec3(0.86, 0.9, 0.95), win * on);
    col = mix(col, base * 0.5, win * (1.0 - on) * 0.6);
  } else {
    col *= 1.15;
  }
  float d = length(vW - uCam);
  col = mix(col, uFogC, smoothstep(14.0, 40.0, d));
  gl_FragColor = vec4(col, 1.0);
}`;
const FS_TRI = `varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const MIX_FS = `
uniform sampler2D tA, tB; uniform float uMix, uTime, uSeed;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  float band = floor(uv.y * 26.0);
  float thr = uMix * 1.35 - h(vec2(band, uSeed)) * 0.35;
  float useB = step(0.5, thr);
  float edge = 1.0 - smoothstep(0.0, 0.22, abs(thr - 0.5));
  float tk = floor(uTime * 24.0);
  uv.x += (h(vec2(band, tk)) - 0.5) * 0.18 * edge;
  vec3 a = texture2D(tA, uv).rgb, b = texture2D(tB, uv).rgb;
  vec3 col = mix(a, b, useB);
  col += edge * (h(vec2(floor(uv.y * 700.0), tk)) - 0.5) * 0.5;
  gl_FragColor = vec4(col, 1.0);
}`;
const BRIGHT_FS = `uniform sampler2D tSrc; varying vec2 vUv; void main(){ vec3 c = texture2D(tSrc, vUv).rgb; float l = dot(c, vec3(.299,.587,.114)); gl_FragColor = vec4(c * smoothstep(.55, .95, l), 1.0); }`;
const BLUR_FS = `
uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb * .227027;
  c += texture2D(tSrc, vUv + uDir * 1.3846).rgb * .316216; c += texture2D(tSrc, vUv - uDir * 1.3846).rgb * .316216;
  c += texture2D(tSrc, vUv + uDir * 3.2308).rgb * .070270; c += texture2D(tSrc, vUv - uDir * 3.2308).rgb * .070270;
  gl_FragColor = vec4(c, 1.0);
}`;
const CRT_FS = `
uniform sampler2D tSrc, tBloom; uniform vec2 uRes; uniform float uTime, uBarrel, uVel, uTear, uFade, uDim, uBloomK;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float r2 = dot(c, c);
  vec2 uv = (c * (1.0 + uBarrel * r2) * (1.0 - uBarrel * 0.35)) * 0.5 + 0.5;
  // полоса срыва строк
  float by = fract(uTime * 0.09 + h(vec2(floor(uTime * 0.6), 3.0)));
  float inB = smoothstep(0.0, 0.015, uv.y - by) * (1.0 - smoothstep(0.05, 0.075, uv.y - by));
  float line = floor(uv.y * uRes.y * 0.5);
  uv.x += inB * uTear * (h(vec2(line, floor(uTime * 30.0))) - 0.5) * 0.09;
  vec2 dc = (uv - 0.5) * (0.0035 + r2 * 0.004 + uVel * 0.02);
  vec3 col = vec3(texture2D(tSrc, uv + dc).r, texture2D(tSrc, uv).g, texture2D(tSrc, uv - dc).b);
  col += texture2D(tBloom, uv).rgb * uBloomK;
  col += inB * uTear * 0.12;
  col *= 0.93 + 0.07 * sin(uv.y * uRes.y * 1.3 + uTime * 6.0);
  col += (h(uv * uRes + fract(uTime) * 91.0) - 0.5) * 0.07;
  vec2 e = smoothstep(vec2(0.0), vec2(0.01), uv) * (1.0 - smoothstep(vec2(0.99), vec2(1.0), uv));
  col *= e.x * e.y;
  col *= 1.0 - 0.42 * r2 * 0.5;
  col *= uDim;
  gl_FragColor = vec4(col * uFade, 1.0);
}`;

/* ============================== геометрия ============================== */
// изогнуть плоскость как экран кинескопа: центр ближе, края дальше
function bendPlane(w, h, R1, R2) {
  const geo = new THREE.PlaneGeometry(w, h, 40, 24), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -(x * x) / (2 * R1) - (y * y) / (2 * R2)); }
  geo.computeVertexNormals(); return geo;
}

/* ============================== запуск ============================== */
async function start() {
  const loaderFill = $('loader-fill'), setLoad = k => { loaderFill.style.width = (k * 100).toFixed(0) + '%'; };
  const tick = () => new Promise(r => setTimeout(r, 0));
  setLoad(.05);
  if (doc.fonts && doc.fonts.load) await Promise.race([Promise.all(['700 20px Silkscreen', '700 20px Doto'].map(f => doc.fonts.load(f))), new Promise(r => setTimeout(r, 2500))]).catch(() => {});
  setLoad(.2);

  THREE.ColorManagement.enabled = false;
  const canvas = $('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const dpr = Math.min(devicePixelRatio || 1, coarse ? 1.25 : 1.5);
  renderer.setPixelRatio(dpr);
  const small = innerWidth < 760;
  const W0 = { time: { value: 0 } };

  /* ---------- мир 1: портрет ---------- */
  const hero = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(32, 1, .1, 100) };
  hero.scene.background = new THREE.Color(0x000000);
  const GW = small ? 70 : 104, GH = small ? 88 : 130;
  const pdata = await portraitData(GW, GH); setLoad(.35); await tick();
  const cells = []; for (let k = 0; k < GW * GH; k++) if (pdata.mask[k]) cells.push(k);
  const PH = 5.2, cell = PH / GH;
  const aCell = new Float32Array(cells.length * 3), aInfo = new Float32Array(cells.length * 2);
  cells.forEach((k, n) => {
    const i = k % GW, j = (k / GW) | 0;
    aCell[n * 3] = (i + .5 - GW / 2) * cell; aCell[n * 3 + 1] = (GH / 2 - j - .5) * cell; aCell[n * 3 + 2] = .04 + pdata.depth[k] * PH * .55;
    aInfo[n * 2] = pdata.shade[k]; aInfo[n * 2 + 1] = j;
  });
  const vgeo = new THREE.BoxGeometry(1, 1, 1);
  vgeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 3));
  vgeo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(aInfo, 2));
  const voxU = { uTime: W0.time, uCell: { value: cell }, uGlitch: { value: 0 }, uIntro: { value: reduced ? 1 : 0 }, uTint: { value: new THREE.Color(0.52, 0.74, 0.9) }, uDark: { value: new THREE.Color(0.012, 0.03, 0.05) } };
  const vox = new THREE.InstancedMesh(vgeo, new THREE.ShaderMaterial({ vertexShader: VOX_VS, fragmentShader: VOX_FS, uniforms: voxU }), cells.length);
  vox.frustumCulled = false;
  const bust = new THREE.Group(); bust.add(vox); bust.position.set(0, -.35, 0); hero.scene.add(bust);
  setLoad(.45); await tick();
  const qc = quadtreeCanvas(pdata, GW, GH); setLoad(.55); await tick();
  const qTex = new THREE.CanvasTexture(qc); qTex.anisotropy = 4;
  const wallU = { uMap: { value: qTex }, uTime: W0.time, uIntro: { value: reduced ? 1 : 0 } };
  const wallL = 1.5, wall = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 15, 64, 1, true, Math.PI - wallL / 2, wallL), new THREE.ShaderMaterial({ vertexShader: WALL_VS, fragmentShader: WALL_FS, uniforms: wallU, side: THREE.BackSide }));
  wall.position.set(0, .4, -1); hero.scene.add(wall);

  /* ---------- мир 2: белая галерея экранов ---------- */
  const gal = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(42, 1, .1, 120) };
  gal.scene.background = new THREE.Color(0xf1f1f0); gal.scene.fog = new THREE.Fog(0xf1f1f0, 7, 26);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 120), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -1.9, -30); gal.scene.add(floor);
  const slides = [], screens = [];
  gal.spacing = 5.2;   // шаг между экранами; на узком экране больше (см. resize)
  for (let i = 0; i < PROJECTS.length; i++) {
    const p = PROJECTS[i];
    const cs = [0, 1, 2].map(k => drawSlide(p, k));
    slides.push({ canv: cs, tex: cs.map(slideTex), thumbs: cs.map(thumbURL) });
    setLoad(.55 + .2 * (i + 1) / PROJECTS.length); await tick();
  }
  const sgeo = bendPlane(3.4, 2.125, 4.2, 7);
  const bgeo = bendPlane(3.52, 2.24, 4.2, 7);
  PROJECTS.forEach((p, i) => {
    const u = { uMap: { value: slides[i].tex[0] }, uTime: W0.time, uGlitch: { value: 0 }, uHover: { value: 0 }, uBright: { value: 1.0 }, uAspect: { value: 1.6 } };
    const m = new THREE.Mesh(sgeo, new THREE.ShaderMaterial({ vertexShader: SCREEN_VS, fragmentShader: SCREEN_FS, uniforms: u }));
    const back = new THREE.Mesh(bgeo, new THREE.MeshBasicMaterial({ color: 0x0a0a0a })); back.position.z = -.03;
    const grp = new THREE.Group(); grp.add(back, m);
    const side = i % 2 ? 1 : -1;
    grp.position.set(side * .55, (i % 3 - 1) * .18, -i * gal.spacing);
    grp.rotation.set(0, -side * .14, side * .03);
    m.userData.i = i; gal.scene.add(grp);
    screens.push({ mesh: m, grp, u, hover: 0, glitch: 0 });
  });

  /* ---------- мир 3: синий город сверху (about) ---------- */
  const city = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(50, 1, .5, 200) };
  city.scene.background = new THREE.Color(0x04101c);
  const NB = small ? 18 : 26, blocks = [];
  for (let gx = -NB / 2; gx < NB / 2; gx++) for (let gz = -NB / 2; gz < NB / 2; gz++) {
    if (Math.abs(gx) % 4 === 0 || Math.abs(gz) % 5 === 0) continue;   // улицы
    if (rnd() < .12) continue;
    const hgt = 1 + Math.pow(rnd(), 1.8) * 9;
    blocks.push([gx * 1.25 + (rnd() - .5) * .2, hgt, gz * 1.25 + (rnd() - .5) * .2, .9 + rnd() * .35, .9 + rnd() * .35]);
  }
  const cityU = { uFogC: { value: new THREE.Color(0x04101c) }, uCam: { value: new THREE.Vector3() }, uTime: W0.time };
  const cityMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.ShaderMaterial({ vertexShader: CITY_VS, fragmentShader: CITY_FS, uniforms: cityU }), blocks.length);
  const mtx = new THREE.Matrix4(), q0 = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  blocks.forEach((b, k) => { mtx.compose(pv.set(b[0], b[1] / 2, b[2]), q0, sv.set(b[3], b[1], b[4])); cityMesh.setMatrixAt(k, mtx); });
  cityMesh.frustumCulled = false; city.scene.add(cityMesh);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ color: 0x0b2236 })); street.rotation.x = -Math.PI / 2; city.scene.add(street);
  const NDB = 260, debris = new THREE.InstancedMesh(new THREE.BoxGeometry(.18, .06, .12), new THREE.MeshBasicMaterial({ color: 0xcfe0f0 }), NDB);
  const dbData = Array.from({ length: NDB }, () => [(rnd() - .5) * 26, 1 + rnd() * 9, (rnd() - .5) * 26, rnd() * 6.28]);
  city.scene.add(debris);

  /* ---------- мир 4: ночная улица (contact) ---------- */
  const alley = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(55, 1, .1, 120) };
  alley.scene.background = new THREE.Color(0x0b0302); alley.scene.fog = new THREE.FogExp2(0x0e0403, .055);
  alley.scene.add(new THREE.AmbientLight(0x552218, 1.1));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 90), new THREE.MeshLambertMaterial({ color: 0x1f100b })); ground.rotation.x = -Math.PI / 2; ground.position.z = -35; alley.scene.add(ground);
  const wallMats = [0x3a1a12, 0x2c120c, 0x4a2216, 0x24100b].map(c => new THREE.MeshLambertMaterial({ color: c }));
  const box = new THREE.BoxGeometry(1, 1, 1);
  // мелочи фасадов одним InstancedMesh: тёмные короба (кондиционеры, балконы, трубы) и тёплые окна
  const props = [], wins = [], signs = [];
  for (const side of [-1, 1]) for (let z = 4; z > -70;) {
    const d = 2 + rnd() * 3.5, h = 4 + rnd() * 7, inset = rnd() * .6, face = side * (2.15 + inset);
    const b = new THREE.Mesh(box, wallMats[(rnd() * 4) | 0]); b.scale.set(2.2, h, d); b.position.set(face + side * 1.1, h / 2, z - d / 2); alley.scene.add(b);
    for (let k = 0, n = 2 + (rnd() * 5 | 0); k < n; k++) props.push([face - side * (.12 + rnd() * .25), .6 + rnd() * (h - 1), z - rnd() * d, .25 + rnd() * .5, .2 + rnd() * .5, .3 + rnd() * .7]);
    for (let fy = 2.6; fy < h - .6; fy += 1.15) for (let fz = z - .5; fz > z - d + .3; fz -= .9) if (rnd() < .45) wins.push([face - side * .01, fy, fz, rnd()]);
    if (rnd() < .85) signs.push([face - side * (.25 + rnd() * .15), 1.3 + rnd() * 2.8, z - d * rnd(), .9 + rnd() * 1.6, .35 + rnd() * .45, (rnd() * 5) | 0]);
    z -= d + .05;
  }
  const propMesh = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: 0x2a1610 }), props.length);
  props.forEach((q, k) => { mtx.compose(pv.set(q[0], q[1], q[2]), q0, sv.set(q[3], q[4], q[5])); propMesh.setMatrixAt(k, mtx); });
  const winMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(.5, .62), new THREE.MeshBasicMaterial({ color: 0xffffff }), wins.length);
  const wc = new THREE.Color(), qL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), qR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
  wins.forEach((q, k) => { mtx.compose(pv.set(q[0], q[1], q[2]), q[0] < 0 ? qL : qR, sv.set(1, 1, 1)); winMesh.setMatrixAt(k, mtx); winMesh.setColorAt(k, wc.setHSL(.06 + q[3] * .05, .9, .18 + q[3] * .32)); });
  const SIGN_C = [0xff2a1a, 0xffb02e, 0xfff1d0, 0xff5a3c, 0x7cf2ff];
  const signMesh = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff }), signs.length);
  signs.forEach((q, k) => { mtx.compose(pv.set(q[0], q[1], q[2]), q0, sv.set(.07, q[3], q[4])); signMesh.setMatrixAt(k, mtx); signMesh.setColorAt(k, wc.setHex(SIGN_C[q[5]])); });
  alley.scene.add(propMesh, winMesh, signMesh);
  // фонари: вдоль стен и гирляндами поперёк улицы
  const lanterns = new THREE.Group(), lanGeo = new THREE.SphereGeometry(.24, 16, 12);
  const lanRed = new THREE.MeshLambertMaterial({ color: 0x6a1206, emissive: 0xff2a12, emissiveIntensity: .8 }), lanWhite = new THREE.MeshLambertMaterial({ color: 0x6a5a4a, emissive: 0xfff0d8, emissiveIntensity: .75 });
  for (let z = 2; z > -60; z -= 1.4 + rnd() * 1.6) {
    for (const side of [-1, 1]) if (rnd() < .6) { const l = new THREE.Mesh(lanGeo, rnd() < .75 ? lanRed : lanWhite); l.scale.y = 1.3; l.position.set(side * (1.55 + rnd() * .25), 2.2 + rnd() * .9, z); lanterns.add(l); }
    if (rnd() < .35) for (let x = -1.4; x <= 1.41; x += .7) { const l = new THREE.Mesh(lanGeo, lanRed); l.scale.setScalar(.55); l.position.set(x, 3.9 - Math.cos(x * .9) * .3, z - .5); lanterns.add(l); }
  }
  alley.scene.add(lanterns);
  const aLights = [2, -6, -14, -22].map(z => { const L = new THREE.PointLight(0xff5a2a, 28, 12, 1.5); L.position.set(0, 3, z); alley.scene.add(L); return L; });

  /* ---------- мир 5: студия (открытый проект) ---------- */
  const studio = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(48, 1, .1, 120) };
  studio.scene.background = new THREE.Color(0x070707); studio.scene.fog = new THREE.Fog(0x070707, 10, 34);
  studio.scene.add(new THREE.AmbientLight(0xffffff, .6));
  const room = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 44), new THREE.MeshLambertMaterial({ color: 0x2a2a2a, side: THREE.BackSide })); room.position.set(0, 2.5, -10); studio.scene.add(room);
  for (let z = 4; z > -32; z -= 3.2) { const beam = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x111111 })); beam.scale.set(18, .4, .5); beam.position.set(0, 5.6, z); studio.scene.add(beam); }
  const gridC = doc.createElement('canvas'); gridC.width = 128; gridC.height = 96; const gg = gridC.getContext('2d');
  gg.fillStyle = '#fff'; gg.fillRect(0, 0, 128, 96); gg.fillStyle = '#7a7a7a';
  for (let x = 0; x <= 128; x += 16) gg.fillRect(x - 1, 0, 2, 96); for (let y = 0; y <= 96; y += 16) gg.fillRect(0, y - 1, 128, 2);
  const softTex = new THREE.CanvasTexture(gridC);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x222222 }), panelMat = new THREE.MeshBasicMaterial({ map: softTex });
  const softbox = (x, z, ry) => {
    const s = new THREE.Group();
    for (let k = 0; k < 3; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.6), legMat); const a = k * 2.09; leg.position.set(Math.cos(a) * .35, .7, Math.sin(a) * .35); leg.rotation.set(Math.sin(a) * .25, 0, -Math.cos(a) * .25); s.add(leg); }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 2.2), legMat); pole.position.y = 2.1; s.add(pole);
    const panel = new THREE.Mesh(box, [legMat, legMat, legMat, legMat, panelMat, legMat]); panel.scale.set(1.5, 1, .18); panel.position.y = 3.2; panel.rotation.x = .35; s.add(panel);
    s.position.set(x, -1.2, z); s.rotation.y = ry; studio.scene.add(s);
    const L = new THREE.PointLight(0xffffff, 16, 10, 1.4); L.position.set(x, 2.4, z + .8); studio.scene.add(L);
  };
  softbox(-2.9, -4.4, .75); softbox(2.9, -4.4, -.75); softbox(-5.2, -10.5, .45); softbox(5.2, -10.5, -.45);
  const studioScreens = [
    { pos: [0, 1.25, -7.2], ry: 0, w: 5.4 },
    { pos: [-5.1, 1.2, -6.2], ry: .62, w: 3.8 },
    { pos: [5.1, 1.2, -6.2], ry: -.62, w: 3.8 },
  ].map(d => {
    const u = { uMap: { value: slides[0].tex[0] }, uTime: W0.time, uGlitch: { value: 0 }, uHover: { value: 0 }, uBright: { value: 1.05 }, uAspect: { value: 1.6 } };
    const m = new THREE.Mesh(bendPlane(d.w, d.w / 1.6, 30, 60), new THREE.ShaderMaterial({ vertexShader: SCREEN_VS, fragmentShader: SCREEN_FS, uniforms: u }));
    m.position.set(...d.pos); m.rotation.y = d.ry; studio.scene.add(m); return { m, u };
  });
  const tripod = new THREE.Mesh(box, legMat); tripod.scale.set(.06, 2.4, .06); tripod.position.set(0, -.6, -7.3); studio.scene.add(tripod);
  setLoad(.9); await tick();

  /* ---------- постобработка ---------- */
  const rtOpt = { depthBuffer: true, type: THREE.UnsignedByteType };
  const rtA = new THREE.WebGLRenderTarget(1, 1, rtOpt), rtB = new THREE.WebGLRenderTarget(1, 1, rtOpt), rtM = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const rtH = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }), rtQ1 = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }), rtQ2 = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const post = new THREE.Scene(), postCam = new THREE.Camera(), quad = new THREE.Mesh(tri); quad.frustumCulled = false; post.add(quad);
  const mixM = new THREE.ShaderMaterial({ vertexShader: FS_TRI, fragmentShader: MIX_FS, depthTest: false, uniforms: { tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uTime: W0.time, uSeed: { value: 1 } } });
  const brightM = new THREE.ShaderMaterial({ vertexShader: FS_TRI, fragmentShader: BRIGHT_FS, depthTest: false, uniforms: { tSrc: { value: null } } });
  const blurM = new THREE.ShaderMaterial({ vertexShader: FS_TRI, fragmentShader: BLUR_FS, depthTest: false, uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } } });
  const crtM = new THREE.ShaderMaterial({ vertexShader: FS_TRI, fragmentShader: CRT_FS, depthTest: false, uniforms: { tSrc: { value: null }, tBloom: { value: rtQ2.texture }, uRes: { value: new THREE.Vector2() }, uTime: W0.time, uBarrel: { value: .06 }, uVel: { value: 0 }, uTear: { value: 0 }, uFade: { value: 0 }, uDim: { value: 1 }, uBloomK: { value: .85 } } });
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(post, postCam); };
  const worlds = [hero, gal, city, alley, studio];

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    worlds.forEach(o => { o.cam.aspect = w / h; o.cam.updateProjectionMatrix(); });
    const W = Math.floor(w * dpr), H = Math.floor(h * dpr);
    rtA.setSize(W, H); rtB.setSize(W, H); rtM.setSize(W, H);
    rtH.setSize(W >> 1, H >> 1); rtQ1.setSize(W >> 2, H >> 2); rtQ2.setSize(W >> 2, H >> 2);
    crtM.uniforms.uRes.value.set(W, H);
    // на узком экране портрет и экраны чуть дальше
    const narrow = w / h < .8;
    // дистанция камеры — по горизонтальному углу обзора, чтобы экран целиком влезал и на узком телефоне
    const fitD = (cam, halfW) => halfW / (Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect);
    hero.base = narrow ? 15.5 : 11.5;
    gal.base = Math.max(5.3, fitD(gal.cam, 1.95));
    studio.near = Math.max(1.6, -7.2 + fitD(studio.cam, 3.1));
    // предыдущий экран не должен оказаться между камерой и текущим
    gal.spacing = Math.max(5.2, gal.base + 2.6);
    screens.forEach((s, i) => { s.grp.position.z = -i * gal.spacing; });
    gal.scene.fog.near = gal.base + 1.5; gal.scene.fog.far = gal.base + gal.spacing * 2 + 8;
  }
  resize(); addEventListener('resize', resize);
  renderer.compile(hero.scene, hero.cam); renderer.compile(gal.scene, gal.cam);
  setLoad(1);

  /* ============================== состояние и ввод ============================== */
  let target = 0, cur = 0, vel = 0, ready = false, menuOpen = false;
  let detail = -1, dMix = 0, dTarget = 0, mainSlide = 0;
  const mouse = new THREE.Vector2(), mouseT = new THREE.Vector2(), ndc = new THREE.Vector2(-9, -9);
  const segs = { h2g: [.1, .15], g2c: [.62, .67], c2a: [.84, .89] };
  const galL = p => clamp((p - .1) / (.67 - .1), 0, 1);
  const stopP = i => .1 + (.1 + i * (.8 / (PROJECTS.length - 1))) * (.67 - .1);
  const GO = { home: 0, work: stopP(0), about: .7, contact: 1 };
  const busy = () => menuOpen || detail >= 0 || !ready;
  const addScroll = d => { if (!busy()) target = clamp(target + d, 0, 1); };

  addEventListener('wheel', e => { e.preventDefault(); addScroll(e.deltaY * (e.deltaMode === 1 ? 30 : 1) * .00009); }, { passive: false });
  let ty = null, tx0 = 0, ty0 = 0, tMoved = false;
  addEventListener('touchstart', e => { ty = ty0 = e.touches[0].clientY; tx0 = e.touches[0].clientX; tMoved = false; }, { passive: true });
  addEventListener('touchmove', e => { if (ty === null) return; const y = e.touches[0].clientY; if (Math.abs(y - ty0) > 8) tMoved = true; addScroll((ty - y) * .00042); ty = y; }, { passive: true });
  addEventListener('touchend', e => { if (!tMoved && ready && detail < 0 && !menuOpen && e.changedTouches[0]) { setNdc(tx0, ty0); const h = pick(); if (h >= 0) openProject(h); } ty = null; });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (detail >= 0) closeProject(); else if (menuOpen) setMenu(false); return; }
    if (busy()) { if (detail >= 0 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) setSlide((mainSlide + (e.key === 'ArrowRight' ? 1 : 2)) % 3); return; }
    const k = { ArrowDown: .025, PageDown: .07, ' ': .07, ArrowUp: -.025, PageUp: -.07, End: 1, Home: -1 }[e.key];
    if (k) { e.preventDefault(); addScroll(k); }
    if (e.key === 'Enter' && hoverI >= 0) openProject(hoverI);
  });
  const setNdc = (x, y) => ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    mouseT.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); setNdc(e.clientX, e.clientY);
    label.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 14}px)`;
  }, { passive: true });
  canvas.addEventListener('click', () => { if (hoverI >= 0 && detail < 0 && !menuOpen) openProject(hoverI); });

  // гироскоп на телефоне — только с согласия
  const gate = $('gate');
  const onOrient = e => { if (e.gamma == null) return; mouseT.set(clamp(e.gamma / 30, -1, 1), clamp((e.beta - 45) / 30, -1, 1)); };
  function closeGate(allow) {
    gate.hidden = true;
    if (!allow) return;
    const D = win.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') D.requestPermission().then(s => { if (s === 'granted') addEventListener('deviceorientation', onOrient); }).catch(() => {});
    else addEventListener('deviceorientation', onOrient);
  }
  $('gate-yes').addEventListener('click', () => closeGate(true));
  $('gate-no').addEventListener('click', () => closeGate(false));

  // меню и переходы по разделам
  const menuBtn = $('menu-btn');
  function setMenu(open) { menuOpen = open; root.classList.toggle('menu-open', open); menuBtn.setAttribute('aria-expanded', String(open)); }
  menuBtn.addEventListener('click', () => setMenu(!menuOpen));
  doc.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); setMenu(false); if (detail >= 0) closeProject();
    target = GO[a.dataset.go] ?? 0; history.replaceState(null, '', '#' + a.dataset.go);
  }));

  // навигатор проектов слева
  const wnOl = $('wn-ol'), wnDot = $('wn-dot');
  PROJECTS.forEach((p, i) => { const li = doc.createElement('li'); const b = doc.createElement('button'); b.type = 'button'; b.textContent = `[${String(i + 1).padStart(2, '0')}] ${p.name}`; b.addEventListener('click', () => { target = stopP(i); }); li.appendChild(b); wnOl.appendChild(li); });
  const wnBtns = [...wnOl.querySelectorAll('button')];

  /* ---------- открытый проект ---------- */
  const dName = $('d-name'), dInfo = $('d-info'), dRole = $('d-role'), dStack = $('d-stack'), dLink = $('d-link'), dThumbs = $('d-thumbs');
  const closeBtn = $('close-btn'), uiDetail = $('ui-detail');
  function setSlide(k) {
    mainSlide = k;
    const i = detail; if (i < 0) return;
    studioScreens[0].u.uMap.value = slides[i].tex[k];
    studioScreens[1].u.uMap.value = slides[i].tex[(k + 1) % 3];
    studioScreens[2].u.uMap.value = slides[i].tex[(k + 2) % 3];
    studioScreens.forEach(s => { s.u.uGlitch.value = 1; });
    [...dThumbs.children].forEach((b, n) => b.classList.toggle('on', n === k));
  }
  function openProject(i, push = true) {
    detail = i; dTarget = 1; hoverI = -1; label.classList.remove('on'); canvas.style.cursor = '';
    const p = PROJECTS[i];
    dName.textContent = p.name; dInfo.textContent = p.info; dRole.innerHTML = p.role.join('<br>'); dStack.textContent = p.stack; dLink.href = p.href;
    dThumbs.innerHTML = '';
    slides[i].thumbs.forEach((u, k) => { const b = doc.createElement('button'); b.type = 'button'; b.style.backgroundImage = `url(${u})`; b.setAttribute('aria-label', `Image ${k + 1}`); b.addEventListener('click', () => setSlide(k)); dThumbs.appendChild(b); });
    setSlide(0);
    root.classList.add('detail-open'); closeBtn.tabIndex = 0; closeBtn.removeAttribute('aria-hidden'); uiDetail.removeAttribute('aria-hidden');
    if (push) history.pushState(null, '', '#' + p.slug);
    target = cur = stopP(i);
  }
  function closeProject(push = true) {
    if (detail < 0) return;
    dTarget = 0; root.classList.remove('detail-open'); closeBtn.tabIndex = -1; closeBtn.setAttribute('aria-hidden', 'true'); uiDetail.setAttribute('aria-hidden', 'true');
    if (push) history.pushState(null, '', '#work');
  }
  closeBtn.addEventListener('click', () => closeProject());
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    const i = PROJECTS.findIndex(p => p.slug === h);
    if (i >= 0) { if (detail !== i) openProject(i, false); return; }
    if (detail >= 0) closeProject(false);
    if (h in GO && ready) target = GO[h];
  }
  addEventListener('popstate', route); addEventListener('hashchange', route);

  /* ---------- наведение на экраны ---------- */
  const label = $('label'), ray = new THREE.Raycaster();
  let hoverI = -1;
  function pick() {
    const gl = galL(cur);
    if (cur < .13 || cur > .64) return -1;
    ray.setFromCamera(ndc, gal.cam);
    const hit = ray.intersectObjects(screens.map(s => s.mesh), false)[0];
    return hit && hit.distance < 14 ? hit.object.userData.i : -1;
  }

  /* ---------- загрузка закончилась ---------- */
  await new Promise(r => setTimeout(r, 250));
  $('loader').classList.add('out');
  root.classList.add('ready');
  if (coarse && win.DeviceOrientationEvent && !reduced) gate.hidden = false;
  let introT = -1;
  ready = true;
  const startHash = decodeURIComponent(location.hash.slice(1));
  if (PROJECTS.some(p => p.slug === startHash)) route();
  else if (startHash in GO) { target = cur = GO[startHash]; }

  /* ============================== кадр ============================== */
  const uiHero = $('ui-hero'), uiWork = $('work-nav'), uiAbout = $('ui-about'), uiContact = $('ui-contact');
  const aboutPanels = [...uiAbout.querySelectorAll('.about-panel')];
  const tmpV = new THREE.Vector3();
  let last = 0, time = 0, tearT = 0, mixSeed = 1;
  function camGallery(L, t) {
    const n = PROJECTS.length, f = clamp((L - .1) / .8, 0, 1) * (n - 1), i0 = Math.min(n - 2, Math.floor(f)), fr = f - i0;
    const e = i0 + smooth(.22, .78, fr);                // задержка у каждого экрана
    const z = -e * gal.spacing + gal.base;
    const sx = lerp(screens[i0].grp.position.x, screens[i0 + 1].grp.position.x, e - i0);   // камера держит экран по центру
    const sy = lerp(screens[i0].grp.position.y, screens[i0 + 1].grp.position.y, e - i0);
    const enter = smooth(0, .1, L);                     // вход сверху: белый пол поднимается
    gal.cam.position.set(sx * .85 + mouse.x * .25, sy + lerp(3.2, .05, enter) + mouse.y * .15, z + lerp(3, 0, enter));
    gal.cam.lookAt(sx, sy + lerp(-.6, 0, enter), z - gal.base);
    gal.cam.rotation.z += Math.sin(t * .4) * .006;
    return Math.round(e);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (doc.hidden) { last = 0; return; }
    const dt = Math.min(.05, last ? (now - last) / 1000 : .016); last = now; time += dt; W0.time.value = time;
    if (introT < 0) introT = now;
    const intro = reduced ? 1 : clamp((now - introT) / 2600, 0, 1);

    // скролл: критически демпфированная пружина
    if (reduced) { cur = target; vel = 0; }
    else for (let left = dt; left > 1e-6; left -= 1 / 120) { const h = Math.min(left, 1 / 120); vel += (16 * (target - cur) - 8 * vel) * h; cur += vel * h; }
    mouse.lerp(mouseT, 1 - Math.exp(-dt * 4));

    // какие миры на экране
    let A = hero, B = null, mixK = 0;
    const p = cur;
    if (p < segs.h2g[0]) A = hero;
    else if (p < segs.h2g[1]) { A = hero; B = gal; mixK = smooth(segs.h2g[0], segs.h2g[1], p); }
    else if (p < segs.g2c[0]) A = gal;
    else if (p < segs.g2c[1]) { A = gal; B = city; mixK = smooth(segs.g2c[0], segs.g2c[1], p); }
    else if (p < segs.c2a[0]) A = city;
    else if (p < segs.c2a[1]) { A = city; B = alley; mixK = smooth(segs.c2a[0], segs.c2a[1], p); }
    else A = alley;

    // открытый проект поверх
    dMix += (dTarget - dMix) * (1 - Math.exp(-dt * 3.2));
    if (dTarget === 0 && dMix < .002 && detail >= 0) detail = -1;
    if (detail >= 0 || dMix > .002) { B = studio; if (A !== gal) A = gal; mixK = dMix; }

    // --- портрет ---
    if (A === hero || B === hero) {
      voxU.uIntro.value = intro; wallU.uIntro.value = smooth(.2, 1, intro);
      const hl = clamp(p / .15, 0, 1);
      bust.rotation.y = mouse.x * .42 + Math.sin(time * .35) * .06;
      bust.rotation.x = -mouse.y * .16;
      voxU.uGlitch.value = clamp(Math.abs(vel) * 4 + smooth(.3, 1, hl), 0, 1);
      hero.cam.position.set(mouse.x * .3, .2 - hl * 1.4, hero.base - hl * 3);
      hero.cam.lookAt(0, -hl * 1.2, 0);
    }
    // --- галерея ---
    let stop = 0;
    if (A === gal || B === gal) {
      stop = camGallery(galL(p), time);
      gal.cam.updateMatrixWorld();
      const hi = (detail < 0 && !menuOpen && !coarse) ? pick() : -1;
      if (hi !== hoverI) {
        hoverI = hi; canvas.style.cursor = hi >= 0 ? 'pointer' : '';
        if (hi >= 0) { label.textContent = `${String(hi + 1).padStart(2, '0')} — ${PROJECTS[hi].name} · open`; label.classList.add('on'); } else label.classList.remove('on');
      }
      screens.forEach((s, i) => {
        s.hover += ((i === hoverI ? 1 : 0) - s.hover) * (1 - Math.exp(-dt * 8));
        s.u.uHover.value = s.hover;
        const dz = Math.abs(gal.cam.position.z - gal.base - s.grp.position.z);
        s.u.uGlitch.value = clamp(Math.abs(vel) * 3 + smooth(1.2, 3.2, dz) * .5, 0, 1);
        s.grp.position.y = (i % 3 - 1) * .18 + Math.sin(time * .6 + i) * .04;
      });
    } else if (hoverI >= 0) { hoverI = -1; label.classList.remove('on'); canvas.style.cursor = ''; }
    // --- город ---
    if (A === city || B === city) {
      const L = clamp((p - .62) / (.89 - .62), 0, 1), ang = L * 1.6 + time * .02;
      const R = lerp(9, 5, L), H = lerp(26, 17, L);
      city.cam.position.set(Math.cos(ang) * R + mouse.x, H, Math.sin(ang) * R - mouse.y);
      city.cam.up.set(Math.cos(ang + 1.9), 0, Math.sin(ang + 1.9));
      city.cam.lookAt(0, 0, 0);
      cityU.uCam.value.copy(city.cam.position);
      dbData.forEach((d, k) => { mtx.compose(pv.set(d[0], d[1] + Math.sin(time * .5 + k) * .3, d[2]), q0.setFromAxisAngle(tmpV.set(0, 1, 0), d[3] + time * .3), sv.set(1, 1, 1)); debris.setMatrixAt(k, mtx); });
      debris.instanceMatrix.needsUpdate = true;
    }
    // --- улица ---
    if (A === alley || B === alley) {
      const L = clamp((p - .84) / .16, 0, 1);
      const z = lerp(6, -9, smooth(0, 1, L));
      alley.cam.position.set(mouse.x * .35 + Math.sin(time * .3) * .08, 1.55 + mouse.y * .15, z);
      alley.cam.lookAt(mouse.x * .8, 1.7 + mouse.y * .3, z - 10);
      alley.cam.rotation.z += lerp(.25, 0, smooth(0, .6, L));
      aLights.forEach((Lt, k) => { Lt.intensity = 26 + Math.sin(time * 3 + k * 2) * 4; });
    }
    // --- студия ---
    if (B === studio) {
      studio.cam.position.set(mouse.x * .6, 1.3 + mouse.y * .25, lerp(studio.near + 2.9, studio.near, smooth(0, 1, dMix)));
      studio.cam.lookAt(mouse.x * .4, 1.15, -7);
      studioScreens.forEach(s => { s.u.uGlitch.value = Math.max(0, s.u.uGlitch.value - dt * 2.5); });
    }

    // --- отрисовка ---
    renderer.setRenderTarget(rtA); renderer.render(A.scene, A.cam);
    let src = rtA;
    if (B && mixK > .001) {
      renderer.setRenderTarget(rtB); renderer.render(B.scene, B.cam);
      if (mixK > .999) src = rtB;
      else {
        if (mixK < .02) mixSeed = Math.random() * 100;
        mixM.uniforms.tA.value = rtA.texture; mixM.uniforms.tB.value = rtB.texture; mixM.uniforms.uMix.value = mixK; mixM.uniforms.uSeed.value = mixSeed;
        pass(mixM, rtM); src = rtM;
      }
    }
    brightM.uniforms.tSrc.value = src.texture; pass(brightM, rtH);
    blurM.uniforms.tSrc.value = rtH.texture; blurM.uniforms.uDir.value.set(1 / rtQ1.width, 0); pass(blurM, rtQ1);
    blurM.uniforms.tSrc.value = rtQ1.texture; blurM.uniforms.uDir.value.set(0, 1 / rtQ1.height); pass(blurM, rtQ2);
    const trans = (B && mixK > .001 && mixK < .999) ? 1 : 0;
    const speed = clamp(Math.abs(vel) * 3, 0, 1);
    tearT += ((trans ? 1 : speed * .8 + .06) - tearT) * (1 - Math.exp(-dt * 6));
    crtM.uniforms.tSrc.value = src.texture;
    crtM.uniforms.uBarrel.value = .07 + speed * .2 + trans * .18 + (A === gal && B !== studio ? .05 : 0);
    crtM.uniforms.uVel.value = speed; crtM.uniforms.uTear.value = tearT;
    crtM.uniforms.uFade.value = smooth(0, .25, intro);
    crtM.uniforms.uDim.value = menuOpen ? .55 : 1;
    // белая галерея и так светлая — свечение там слабее, иначе всё пересвечено
    const whiteK = (A === gal && B !== studio) ? (B ? 1 - mixK : 1) : (B === gal ? mixK : 0);
    crtM.uniforms.uBloomK.value = lerp(.85, .18, whiteK);
    pass(crtM, null);

    // --- интерфейс поверх ---
    const det = smooth(.4, 1, dMix);
    show(uiHero, smooth(.35, .8, intro) * (1 - smooth(.04, .1, p)) * (1 - det));
    show(uiWork, smooth(.14, .18, p) * (1 - smooth(.6, .64, p)) * (1 - det));
    if (A === gal && B !== studio && stop !== lastStop) { lastStop = stop; wnBtns.forEach((b, i) => b.classList.toggle('on', i === stop)); wnDot.style.translate = `0 ${wnBtns[stop].parentElement.offsetTop}px`; }
    const cL = clamp((p - .62) / .27, 0, 1);
    show(uiAbout, smooth(.66, .7, p) * (1 - smooth(.84, .87, p)) * (1 - det));
    aboutPanels[0].classList.toggle('on', cL > .16 && cL < .55);
    aboutPanels[1].classList.toggle('on', cL >= .55 && cL < .93);
    show(uiContact, smooth(.92, .97, p) * (1 - det));
    show(uiDetail, det); show(closeBtn, det);
  }
  // прозрачность + скрытие: невидимые ссылки и кнопки не должны ловить клики
  let lastStop = -1, lastSec = '';
  const menuLinks = [...doc.querySelectorAll('.menu-list a[data-go]')];
  setInterval(() => {   // текущий раздел подсвечен в меню инверсией
    const s = cur < .1 ? 'home' : cur < .62 ? 'work' : cur < .89 ? 'about' : 'contact';
    if (s !== lastSec) { lastSec = s; menuLinks.forEach(a => a.classList.toggle('on', a.dataset.go === s)); }
  }, 250);
  function show(el, o) { el.style.opacity = o.toFixed(3); el.style.visibility = o > .01 ? 'visible' : 'hidden'; }
  requestAnimationFrame(frame);
  if (location.hostname === 'localhost') win.__v20 = { get cur() { return cur; }, set target(v) { target = v; }, openProject, closeProject, renderer, PROJECTS };
}
