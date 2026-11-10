/* v6 — Level 0 из Backrooms на three.js (vendor/three.module.min.js, r160).
   Ходишь по жёлтым комнатам от первого лица, читаешь пять записок на стенах
   (это разделы текстовой версии) и ищешь красный EXIT — за ним контакты.
   Все текстуры рисуются на canvas здесь же, картинок и моделей нет.
   Без WebGL, по #text или если что-то упало — текстовая версия. */
import * as THREE from '../vendor/three.module.min.js';

const doc = document, win = window, root = doc.documentElement;
const $ = id => doc.getElementById(id);
const reduced = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = win.matchMedia('(hover: none), (pointer: coarse)').matches;
const sleep = ms => new Promise(r => win.setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Текстовая версия ---------- */
let stopGame = null;
function canWebGL() {
  try { const c = doc.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
}
function goText() {
  if (stopGame) { stopGame(); stopGame = null; }
  root.classList.remove('is-3d', 'playing');
  if (canWebGL()) $('to-3d').hidden = false;
}
doc.querySelectorAll('[data-text-link]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  history.replaceState(null, '', '#text');
  goText();
  win.scrollTo(0, 0);
}));
$('to-3d').addEventListener('click', () => { location.href = location.pathname; });
win.addEventListener('hashchange', () => { if (location.hash === '#text' && root.classList.contains('is-3d')) goText(); });

if (location.hash === '#text' || !canWebGL()) goText();
else {
  root.classList.add('is-3d');
  boot().catch(err => { console.error(err); goText(); });
}

/* ---------- Карта уровня ----------
   Клетка 2 м. # — стена, . — пол, S — старт, a…e — стена с запиской,
   X — стена с дверью EXIT, o — тёмная комната (лампы мертвы), m — там же «улыбака». */
const MAP = [
  '##########################',
  '#S...#......#.......#....#',
  '#....#......a.......#....#',
  '#....#..##......##..#....#',
  '#.......##......##.......#',
  '#....................##..#',
  '###b##...######......##..#',
  '#........#....#..........#',
  '#........#....#...####...#',
  '#..##....#....c...#oo#...#',
  '#..##.............#mo....#',
  '#.......####......####...#',
  '#.......#..#.............#',
  '####....#..#....##...#####',
  '#.......d..#....##.......#',
  '#..............e.........#',
  '#...##.............##....#',
  '#...##....#####....##....X',
  '#.........#####..........#',
  '##########################',
];
/* Что написано на самих записках; полный текст — в разделе с тем же id */
const NOTES = {
  b: { id: 'about', no: '01', title: 'WHO BUILT THIS', lines: ['backend engineer,', 'a bank in Tashkent.', 'Java · Spring · Oracle', 'talks to old systems.'] },
  a: { id: 'work', no: '02', title: 'THINGS I SHIPPED', lines: ['uz-status — uptime', 'exchange — 0 deps', 'tgagent, tekstlybot', '+ bots, bots, bots'] },
  c: { id: 'skills', no: '03', title: 'TOOLS I CARRY', lines: ['Java 21 / 17', 'Spring Boot, PL/SQL', 'Postgres, SQLite', 'Docker, Linux, CI'] },
  d: { id: 'experience', no: '04', title: 'WHERE I WORK', lines: ['2025 — present', 'core banking: iABS', 'MyID, e-key / DVS', 'JavaEE on WebLogic'] },
  e: { id: 'contact', no: '05', title: 'HOW TO REACH ME', lines: ['telegram:', '@CustomAnnotation', 'the EXIT is east,', 'under the red light.'] },
};
const C = 2, H = 2.7, EYE = 1.6, RAD = .28;
const ROWS = MAP.length, COLS = MAP[0].length;
const OPEN = new Set(['.', 'S', 'o', 'm']);
const cell = (c, r) => (r < 0 || r >= ROWS || c < 0 || c >= COLS) ? '#' : MAP[r][c];
const isOpen = (c, r) => OPEN.has(cell(c, r));
const solidAt = (x, z) => !isOpen(Math.floor(x / C), Math.floor(z / C));
const blocked = (x, z) => solidAt(x - RAD, z - RAD) || solidAt(x + RAD, z - RAD) || solidAt(x - RAD, z + RAD) || solidAt(x + RAD, z + RAD);
const DIRS = [[0, -1], [-1, 0], [1, 0], [0, 1]]; // N, W, E, S — куда смотрит записка
const faceOf = (c, r) => DIRS.find(([dx, dz]) => isOpen(c + dx, r + dz));
MAP.forEach((row, i) => { if (row.length !== COLS) console.warn('v6: map row', i, 'has length', row.length); });

/* Детерминированный random, чтобы уровень был одним и тем же */
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

/* ---------- Сборка и игра ---------- */
async function boot() {
  if (touch) root.classList.add('touch');
  if (touch) $('hint').textContent = 'Left thumb — move · right thumb — look · tap READ to open a note';

  // зерно для плёнки — один раз, дальше его двигает CSS
  const n = canvas2d(160, 160, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
  });
  root.style.setProperty('--noise', `url(${n.toDataURL()})`);

  // записки рисуются шрифтами — ждём их, но не дольше 3 секунд
  if (doc.fonts && doc.fonts.load) {
    await Promise.race([
      Promise.all([doc.fonts.load('40px "Special Elite"'), doc.fonts.load('40px "VT323"')]),
      sleep(3000),
    ]).catch(() => {});
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 1.5));
  renderer.setSize(win.innerWidth, win.innerHeight);
  const canvas = renderer.domElement;
  $('stage').appendChild(canvas);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = (c, rx, ry) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    if (rx) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
    return t;
  };

  const FOG = 0x8f7f44;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.FogExp2(FOG, .052);
  const camera = new THREE.PerspectiveCamera(72, win.innerWidth / win.innerHeight, .05, 80);
  camera.rotation.order = 'YXZ';
  scene.add(new THREE.HemisphereLight(0xfff2c4, 0x5c4a1e, 1.7));

  /* стены: только те клетки, что граничат с полом; три варианта обоев */
  const wallGeo = new THREE.BoxGeometry(C, H, C);
  const wallMats = [11, 47, 83].map(s => new THREE.MeshLambertMaterial({ map: tex(wallpaper(s)) }));
  const buckets = [[], [], []];
  const pick = rng(5);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (isOpen(c, r)) continue;
    if (!DIRS.some(([dx, dz]) => isOpen(c + dx, r + dz))) continue;
    buckets[Math.floor(pick() * 3)].push([c, r]);
  }
  const walls = [];
  const m4 = new THREE.Matrix4();
  buckets.forEach((list, i) => {
    const mesh = new THREE.InstancedMesh(wallGeo, wallMats[i], list.length);
    list.forEach(([c, r], k) => mesh.setMatrixAt(k, m4.makeTranslation((c + .5) * C, H / 2, (r + .5) * C)));
    scene.add(mesh); walls.push(mesh);
  });

  const W = COLS * C, D = ROWS * C;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: tex(carpet(), W / 4, D / 4) }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, D / 2); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: tex(ceiling(), W / 2, D / 2) }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(W / 2, H, D / 2); scene.add(ceil);

  /* лампы: сетка через клетку, часть мертва, две мерцают */
  const lampGeo = new THREE.BoxGeometry(1.2, .05, .6);
  const litMat = new THREE.MeshBasicMaterial({ color: 0xfffbe6 });
  const deadMat = new THREE.MeshBasicMaterial({ color: 0x6d6754 });
  const haloTex = tex(halo());
  const haloMat = new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .42 });
  const lamps = [];
  const lr = rng(21);
  for (let r = 1; r < ROWS; r += 2) for (let c = 1; c < COLS; c += 2) {
    if (!isOpen(c, r)) continue;
    const ch = cell(c, r);
    const dead = ch === 'o' || ch === 'm' || lr() < .08;
    const x = (c + .5) * C, z = (r + .5) * C;
    const mesh = new THREE.Mesh(lampGeo, dead ? deadMat : litMat);
    mesh.position.set(x, H - .025, z); scene.add(mesh);
    if (dead) continue;
    const glow = new THREE.Sprite(haloMat);
    glow.position.set(x, H - .12, z); glow.scale.set(2.4, 1.4, 1); scene.add(glow);
    lamps.push({ x, z, mesh, glow, k: 1, flick: null });
  }
  // мерцают две лампы: одна видна почти со старта, вторая в глубине
  [lamps.find(l => l.x > 10 && l.z > 6), lamps[lamps.length - 6]].filter(Boolean).forEach(l => {
    l.mesh.material = litMat.clone(); l.glow.material = haloMat.clone();
    l.flick = { t: 0, on: true };
  });

  /* пул точечных ламп: светят только ближайшие к игроку */
  const POOL = touch ? 4 : 7, LI = 5.5;
  const pool = Array.from({ length: POOL }, () => {
    const L = new THREE.PointLight(0xffefc0, 0, 9, 1.7);
    L.position.y = H - .35; scene.add(L); return { L, lamp: null };
  });
  let poolT = 0;
  function assignPool(px, pz) {
    const near = lamps.slice().sort((a, b) => ((a.x - px) ** 2 + (a.z - pz) ** 2) - ((b.x - px) ** 2 + (b.z - pz) ** 2));
    pool.forEach((p, i) => { const l = near[i]; p.lamp = l; if (l) p.L.position.set(l.x, H - .35, l.z); });
  }

  /* записки и дверь */
  const usables = [];
  const noteGeo = new THREE.PlaneGeometry(.46, .61);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const ch = cell(c, r), note = NOTES[ch];
    if (!note && ch !== 'X') continue;
    const f = faceOf(c, r);
    if (!f) { console.warn('v6: nothing faces', ch); continue; }
    const [dx, dz] = f, off = C / 2 + .012;
    const x = (c + .5) * C + dx * off, z = (r + .5) * C + dz * off, ry = Math.atan2(dx, dz);
    if (note) {
      const map = tex(paper(note));
      const mat = new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .1 });
      const mesh = new THREE.Mesh(noteGeo, mat);
      mesh.position.set(x, 1.42, z); mesh.rotation.set(0, ry, (lr() - .5) * .1);
      mesh.userData = { kind: 'note', note }; note.mesh = note.mesh || mesh; note.read = false;
      scene.add(mesh); usables.push(mesh);
    } else {
      const dm = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 2.1), new THREE.MeshLambertMaterial({ map: tex(door()) }));
      dm.position.set(x, 1.05, z); dm.rotation.y = ry; dm.userData = { kind: 'exit' };
      scene.add(dm); usables.push(dm);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(.62, .23), new THREE.MeshBasicMaterial({ map: tex(exitSign()), fog: false }));
      sign.position.set(x + dx * .01, 2.36, z + dz * .01); sign.rotation.y = ry; scene.add(sign);
      const red = new THREE.PointLight(0xff3322, 3.2, 6, 1.6);
      red.position.set(x + dx * .5, 2.2, z + dz * .5); scene.add(red);
    }
  }
  const notes = Object.values(NOTES).filter(n => n.mesh);

  /* «улыбака» в тёмной комнате: светится сквозь туман, тает, если подойти */
  let smile = null;
  MAP.forEach((row, r) => { const c = row.indexOf('m'); if (c >= 0) smile = { x: (c + .5) * C, z: (r + .5) * C }; });
  const smileSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(smiler()), transparent: true, depthWrite: false, fog: false, opacity: 0 }));
  if (smile) { smileSprite.position.set(smile.x, 1.7, smile.z); smileSprite.scale.set(.85, .85, 1); smileSprite.renderOrder = 2; scene.add(smileSprite); }

  /* тёмная комната: внутри стоит чёрный полупрозрачный объём. Видны только его
     внутренние грани, поэтому снаружи комната тёмная, а войдёшь — темнеет всё */
  const dark = [];
  MAP.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'o' || ch === 'm') dark.push([c, r]); }));
  if (dark.length) {
    const cs = dark.map(d => d[0]), rs = dark.map(d => d[1]);
    const c0 = Math.min(...cs), c1 = Math.max(...cs) + 1, r0 = Math.min(...rs), r1 = Math.max(...rs) + 1;
    const shade = new THREE.Mesh(
      new THREE.BoxGeometry((c1 - c0) * C - .02, H - .02, (r1 - r0) * C - .02),
      new THREE.MeshBasicMaterial({ color: 0x0b0903, transparent: true, opacity: .82, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    shade.position.set((c0 + c1) / 2 * C, H / 2, (r0 + r1) / 2 * C);
    shade.renderOrder = 1; scene.add(shade);
  }

  /* ---------- Игрок ---------- */
  let px = 0, pz = 0;
  MAP.forEach((row, r) => { const c = row.indexOf('S'); if (c >= 0) { px = (c + .5) * C; pz = (r + .5) * C; } });
  const first = NOTES.b.mesh.position;
  let yaw = Math.atan2(-(first.x - px), -(first.z - pz)) + .35, pitch = -.04;
  let vx = 0, vz = 0, bob = 0, stamina = 1, lastStep = 0, playTime = 0, idle = 0;
  const keys = new Set();
  const joy = { x: 0, y: 0 };
  let state = 'menu', started = false, target = null, dragging = false;

  const hud = $('hud'), prompt = $('prompt'), promptText = $('prompt-text');
  const startScr = $('start'), escapeScr = $('escape'), enterBtn = $('enter');
  const dialog = $('note'), noteBody = $('note-body');
  function setState(s) {
    state = s;
    root.classList.toggle('playing', s === 'play' || s === 'read');
    startScr.hidden = s !== 'menu';
    escapeScr.hidden = s !== 'escaped';
    if (s === 'play') audio.resume(); else if (s !== 'read') audio.pause();
  }

  let toastT = 0;
  function toast(msg, ms = 2800) {
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    win.clearTimeout(toastT); toastT = win.setTimeout(() => t.classList.remove('on'), ms);
  }
  const found = () => notes.filter(n => n.read).length;
  const updateCount = () => { $('count').textContent = `${found()}/${notes.length}`; };
  updateCount();

  /* ---------- Звук: гул ламп и шаги по ковролину (WebAudio, без файлов) ---------- */
  const audio = (() => {
    let ac = null, master = null, hum = null, buf = null, muted = false;
    const ensure = () => {
      if (ac) return;
      const AC = win.AudioContext || win.webkitAudioContext; if (!AC) return;
      ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : .6; master.connect(ac.destination);
      hum = ac.createGain(); hum.gain.value = .03;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      hum.connect(lp); lp.connect(master);
      [[60, 'sine', .5], [120, 'sawtooth', .22], [180, 'sine', .12], [240, 'square', .025], [360, 'sawtooth', .02]].forEach(([f, type, v]) => {
        const o = ac.createOscillator(); o.type = type; o.frequency.value = f + (Math.random() - .5) * .4;
        const g = ac.createGain(); g.gain.value = v; o.connect(g); g.connect(hum); o.start();
      });
      buf = ac.createBuffer(1, ac.sampleRate * .25, ac.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    };
    return {
      start() { ensure(); if (ac) ac.resume(); },
      resume() { if (ac && ac.state === 'suspended') ac.resume(); },
      pause() { if (ac && ac.state === 'running') ac.suspend(); },
      level(v) { if (hum) hum.gain.setTargetAtTime(v, ac.currentTime, .3); },
      step(loud) {
        if (!ac || muted) return;
        const t = ac.currentTime, s = ac.createBufferSource(); s.buffer = buf;
        const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380 + Math.random() * 160;
        const g = ac.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.32 * loud, t + .012); g.gain.exponentialRampToValueAtTime(.001, t + .17);
        s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + .22);
      },
      toggle() {
        muted = !muted; if (master) master.gain.setTargetAtTime(muted ? 0 : .6, ac.currentTime, .05);
        $('snd').firstChild.textContent = muted ? 'SOUND OFF ' : 'SOUND ON ';
      },
      close() { if (ac) ac.close(); },
    };
  })();

  /* ---------- Вход, пауза, чтение, выход ---------- */
  const lockable = !touch && 'requestPointerLock' in canvas;
  const locked = () => doc.pointerLockElement === canvas;
  function lock() {
    if (!lockable) return;
    try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* остаёмся на перетаскивании */ }
  }
  function play() {
    audio.start();
    setState('play');
    lock();
    if (!started) {
      started = true;
      toast(touch ? 'Find 5 notes. Then find the EXIT.' : 'Find 5 notes. Then find the EXIT.', 3600);
    }
    enterBtn.textContent = 'Resume';
  }
  function pause() {
    if (state !== 'play') return;
    $('start-tag').textContent = '❚❚ PAUSED · LEVEL 0 · THE LOBBY';
    setState('menu');
    enterBtn.focus({ preventScroll: true });
  }
  function use() {
    if (state !== 'play' || !target) return;
    const u = target.userData;
    if (u.kind === 'note') openNote(u.note); else openExit();
  }
  function openNote(note) {
    setState('read');
    if (!note.read) {
      note.read = true; note.mesh.material.emissiveIntensity = 0; updateCount();
      const left = notes.length - found();
      win.setTimeout(() => toast(left ? `Note ${found()}/${notes.length}` : 'All notes found. The EXIT is east, under the red light.', 3200), 50);
    }
    const sec = $(note.id);
    noteBody.replaceChildren(...Array.from(sec.children).map(n => n.cloneNode(true)));
    const h = noteBody.querySelector('h2'); if (h) h.id = 'note-title';
    if (doc.exitPointerLock) doc.exitPointerLock();
    keys.clear();
    dialog.showModal();
    dialog.querySelector('.sheet').scrollTop = 0;
  }
  dialog.addEventListener('close', () => { if (state === 'read') { setState('play'); lock(); } });
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); }); // клик мимо листа
  function openExit() {
    const s = Math.floor(playTime);
    $('escape-stats').textContent = `Time in Level 0: ${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s · notes read: ${found()} of ${notes.length}. Here is how to reach the person who built it.`;
    if (doc.exitPointerLock) doc.exitPointerLock();
    keys.clear();
    setState('escaped');
    $('stay').focus({ preventScroll: true });
  }
  enterBtn.addEventListener('click', play);
  $('stay').addEventListener('click', play);
  $('pause-btn').addEventListener('click', pause);
  prompt.addEventListener('click', use);

  doc.addEventListener('pointerlockchange', () => { if (!locked() && state === 'play') pause(); });
  canvas.addEventListener('click', () => {
    if (state !== 'play') return;
    if (lockable && !locked()) lock(); else use();
  });
  canvas.addEventListener('mousedown', () => { if (!locked()) dragging = true; });
  win.addEventListener('mouseup', () => { dragging = false; });
  doc.addEventListener('mousemove', e => {
    if (state !== 'play' || !(locked() || dragging)) return;
    yaw -= e.movementX * .0022; pitch = clamp(pitch - e.movementY * .0022, -1.35, 1.35);
  });
  doc.addEventListener('keydown', e => {
    if (state === 'menu' && (e.code === 'Enter' || e.code === 'Space') && doc.activeElement === doc.body) { e.preventDefault(); play(); return; }
    if (state !== 'play') return;
    if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'KeyF') { e.preventDefault(); use(); return; }
    if (e.code === 'KeyM') { audio.toggle(); return; }
    if (e.code === 'Escape') { pause(); return; }
    if (/^(Key[WASD]|Arrow|Shift)/.test(e.code)) { e.preventDefault(); keys.add(e.code); }
  });
  doc.addEventListener('keyup', e => keys.delete(e.code));
  win.addEventListener('blur', () => { keys.clear(); pause(); });
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) pause(); });

  /* тач: левый палец — джойстик, правый — взгляд */
  const stick = $('stick'), knob = stick.firstElementChild;
  let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || state !== 'play') return;
    if (stickId === null && e.clientX < win.innerWidth * .45) {
      stickId = e.pointerId; sx = e.clientX; sy = e.clientY;
      stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; stick.classList.add('on');
    } else if (lookId === null) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* синтетические события */ }
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId === stickId) {
      let dx = (e.clientX - sx) / 50, dy = (e.clientY - sy) / 50;
      const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
      joy.x = dx; joy.y = dy; knob.style.transform = `translate(${dx * 36}px,${dy * 36}px)`;
    } else if (e.pointerId === lookId) {
      yaw -= (e.clientX - lx) * .0055; pitch = clamp(pitch - (e.clientY - ly) * .0055, -1.3, 1.3);
      lx = e.clientX; ly = e.clientY;
    }
  });
  const release = e => {
    if (e.pointerId === stickId) { stickId = null; joy.x = joy.y = 0; stick.classList.remove('on'); knob.style.transform = ''; }
    if (e.pointerId === lookId) lookId = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  function resize() {
    camera.aspect = win.innerWidth / win.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(win.innerWidth, win.innerHeight);
  }
  win.addEventListener('resize', resize);

  /* ---------- Кадр ---------- */
  const ray = new THREE.Raycaster(); ray.far = 2.7;
  const center = new THREE.Vector2(0, 0);
  const rayTargets = usables.concat(walls);
  const clock = $('clock'), staminaBar = $('stamina');
  let frame = 0, last = 0, clockShown = -1;

  function tick(t) {
    frame = win.requestAnimationFrame(tick);
    const dt = Math.min(.05, last ? (t - last) / 1000 : .016); last = t;

    if (state === 'play') {
      playTime += dt;
      const k = id => keys.has(id) ? 1 : 0;
      let f = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown') - joy.y;
      let s = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft') + joy.x;
      const m = Math.hypot(f, s); if (m > 1) { f /= m; s /= m; }
      const wantRun = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && f > 0;
      const running = wantRun && stamina > .02;
      stamina = clamp(stamina + (running ? -.22 : (wantRun ? .05 : .14)) * dt, 0, 1);
      const speed = running ? 5 : 2.8;
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      const tx = (-sin * f + cos * s) * speed, tz = (-cos * f - sin * s) * speed;
      const a = 1 - Math.exp(-dt * 10);
      vx += (tx - vx) * a; vz += (tz - vz) * a;
      const nx = px + vx * dt, nz = pz + vz * dt;
      if (!blocked(nx, pz)) px = nx; else vx = 0;
      if (!blocked(px, nz)) pz = nz; else vz = 0;
      const sp = Math.hypot(vx, vz);
      if (sp > .3) {
        bob += dt * sp * 2.3;
        const step = Math.floor(bob / Math.PI);
        if (step !== lastStep) { lastStep = step; audio.step(running ? 1 : .7); }
      } else bob += (Math.round(bob / Math.PI) * Math.PI - bob) * a;
      staminaBar.style.transform = `scaleX(${stamina.toFixed(3)})`;
      const sec = Math.floor(playTime);
      if (sec !== clockShown) {
        clockShown = sec;
        clock.textContent = [sec / 3600, sec / 60 % 60, sec % 60].map(v => String(Math.floor(v)).padStart(2, '0')).join(':');
      }
    } else if (!started && !reduced) {
      idle += dt; yaw += Math.sin(idle * .25) * dt * .06; // на стартовом экране камера чуть дышит
    }

    const bobAmp = reduced ? 0 : .045 * Math.min(1, Math.hypot(vx, vz) / 3);
    camera.position.set(px, EYE + Math.abs(Math.sin(bob)) * bobAmp - bobAmp * .5, pz);
    camera.rotation.set(pitch, yaw, reduced ? 0 : Math.sin(bob) * bobAmp * .25);

    // свет: пул ламп у игрока, мерцание, гул громче под лампой
    poolT -= dt;
    if (poolT <= 0) { poolT = .25; assignPool(px, pz); }
    lamps.forEach(l => {
      if (!l.flick || reduced) return;
      const fl = l.flick; fl.t -= dt;
      if (fl.t <= 0) {
        fl.on = !fl.on;
        fl.t = fl.on ? (Math.random() < .7 ? .04 + Math.random() * .12 : 1 + Math.random() * 3) : .03 + Math.random() * .1;
      }
      l.k = fl.on ? 1 : .08;
      l.mesh.material.color.setScalar(fl.on ? 1 : .35);
      l.glow.material.opacity = .42 * l.k;
    });
    let nearest = 99;
    pool.forEach(p => {
      if (!p.lamp) { p.L.intensity = 0; return; }
      p.L.intensity = LI * p.lamp.k;
      nearest = Math.min(nearest, Math.hypot(p.lamp.x - px, p.lamp.z - pz));
    });
    audio.level(.02 + .05 * clamp(1 - nearest / 6, 0, 1));

    if (smile) {
      const d = Math.hypot(smile.x - px, smile.z - pz);
      const flick = reduced ? 1 : (Math.random() < .03 ? .3 : 1);
      smileSprite.material.opacity = clamp((d - 3.5) / 3, 0, 1) * .9 * flick;
    }

    // на что смотрим
    target = null;
    if (state === 'play') {
      ray.setFromCamera(center, camera);
      const hit = ray.intersectObjects(rayTargets, false)[0];
      if (hit && hit.object.userData.kind) target = hit.object;
    }
    hud.classList.toggle('can-use', !!target);
    if (target) {
      const u = target.userData;
      promptText.textContent = u.kind === 'exit' ? 'Open EXIT' : `Read note ${u.note.no}`;
    }

    renderer.render(scene, camera);
  }

  stopGame = () => {
    state = 'off'; // обработчики клавиш остаются, но больше ничего не делают
    win.cancelAnimationFrame(frame);
    if (doc.exitPointerLock && locked()) doc.exitPointerLock();
    audio.close();
    renderer.dispose();
    canvas.remove();
    win.removeEventListener('resize', resize);
  };

  // отладка только на локальном сервере: __level0.goto(колонка, строка, угол)
  if (location.hostname === 'localhost') {
    win.__level0 = { goto(c, r, a = yaw) { px = (c + .5) * C; pz = (r + .5) * C; yaw = a; vx = vz = 0; } };
  }

  frame = win.requestAnimationFrame(tick);
  enterBtn.disabled = false;
  enterBtn.textContent = 'Enter Level 0';
  setState('menu');
}
