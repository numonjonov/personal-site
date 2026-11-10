/* v6 — обычный сайт-портфолио с 3D-фоном (three.js r160 из vendor/).
   Позади страницы — длинный коридор в тёплом свете ламп. При скролле камера
   плавно едет по нему вперёд, мышь чуть поворачивает взгляд. Панели на
   странице наклоняются за курсором. Текстуры рисуются на canvas здесь же.
   Без WebGL остаётся тот же сайт на градиенте. */
import * as THREE from '../vendor/three.module.min.js';

const doc = document, win = window, root = doc.documentElement;
const reduced = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = win.matchMedia('(hover: none), (pointer: coarse)').matches;
root.classList.add('js');

/* ---------- Появление блоков ---------- */
const items = Array.from(doc.querySelectorAll('.reveal'));
const showAll = () => items.forEach(el => el.classList.add('in'));
if (reduced || !('IntersectionObserver' in win)) showAll();
else {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .08, rootMargin: '0px 0px -6% 0px' });
  items.forEach(el => io.observe(el));
  win.setTimeout(showAll, 3000); // страховка
}

/* ---------- Активный пункт меню ---------- */
const links = Array.from(doc.querySelectorAll('.top nav a'));
const secs = links.map(a => doc.querySelector(a.getAttribute('href'))).filter(Boolean);
if ('IntersectionObserver' in win) {
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  secs.forEach(s => spy.observe(s));
}

/* ---------- 3D-наклон панелей за мышью ---------- */
if (!coarse && !reduced) {
  doc.querySelectorAll('[data-tilt]').forEach(el => {
    el.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.classList.add('hot');
      el.style.setProperty('--rx', ((.5 - y) * 6).toFixed(2) + 'deg');
      el.style.setProperty('--ry', ((x - .5) * 8).toFixed(2) + 'deg');
      el.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('hot');
      el.style.removeProperty('--rx'); el.style.removeProperty('--ry');
    });
  });
}

/* ---------- Текстуры на canvas ---------- */
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
function halo() {
  return canvas2d(128, 128, (g, w, h) => blot(g, w / 2, h / 2, w / 2, 'rgba(255,248,215,.9)'));
}

/* ---------- 3D-фон ---------- */
function canWebGL() {
  try { const c = doc.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
}
if (canWebGL()) {
  try { buildScene(); } catch (err) { console.error(err); }
}

function buildScene() {
  /* Коридор: ось в две клетки по 2 м, по бокам проёмы в комнаты.
     Детерминированный random — коридор всегда один и тот же. */
  const C = 2, H = 2.7, EYE = 1.6, COLS = 12, ROWS = 60;
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(1));
  for (let r = 1; r < ROWS - 1; r++) grid[r][5] = grid[r][6] = 0;
  const gr = rng(2026);
  for (let r = ROWS - 6; r > 4;) {
    const h = 2 + Math.floor(gr() * 3);
    const sides = gr() < .3 ? [-1, 1] : [gr() < .5 ? -1 : 1];
    sides.forEach(side => {
      const depth = 2 + Math.floor(gr() * 3);
      const c0 = side < 0 ? 5 - depth : 7, c1 = side < 0 ? 4 : 6 + depth;
      for (let y = r - h + 1; y <= r; y++) for (let x = c0; x <= c1; x++) grid[y][x] = 0;
      if (h >= 3 && depth >= 3) grid[r - 1][side < 0 ? c0 + 1 : c1 - 1] = 1;
    });
    r -= h + 2 + Math.floor(gr() * 4);
  }
  const isOpen = (c, r) => r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c] === 0;
  const DIRS = [[0, -1], [-1, 0], [1, 0], [0, 1]];

  const renderer = new THREE.WebGLRenderer({ antialias: !coarse, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, coarse ? 1 : 1.25));
  renderer.setSize(win.innerWidth, win.innerHeight);
  doc.getElementById('stage').appendChild(renderer.domElement);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = (c, rx, ry) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    if (rx) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
    return t;
  };

  const FOG = 0x6f6235;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.FogExp2(FOG, .055);
  const camera = new THREE.PerspectiveCamera(68, win.innerWidth / win.innerHeight, .05, 80);
  camera.rotation.order = 'YXZ';
  scene.add(new THREE.HemisphereLight(0xfff2c4, 0x5c4a1e, 1.6));

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
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: tex(carpet(), W / 4, D / 4) }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, D / 2); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: tex(ceiling(), W / 2, D / 2) }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(W / 2, H, D / 2); scene.add(ceil);

  /* лампы по оси коридора и в комнатах; светят ближайшие к камере */
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfffbe6 });
  const haloMat = new THREE.SpriteMaterial({ map: tex(halo()), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .4 });
  const lamps = [];
  const addLamp = (x, z, along) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(along ? .6 : 1.2, .05, along ? 1.2 : .6), lampMat);
    mesh.position.set(x, H - .025, z); scene.add(mesh);
    const glow = new THREE.Sprite(haloMat);
    glow.position.set(x, H - .12, z); glow.scale.set(2.2, 1.3, 1); scene.add(glow);
    lamps.push({ x, z });
  };
  for (let r = 1; r < ROWS - 1; r += 2) addLamp(6 * C, (r + .5) * C, true);
  for (let r = 1; r < ROWS - 1; r += 2) for (let c = 1; c < COLS - 1; c += 2) if (c !== 5 && isOpen(c, r)) addLamp((c + .5) * C, (r + .5) * C, false);
  const pool = Array.from({ length: coarse ? 4 : 7 }, () => {
    const L = new THREE.PointLight(0xffefc0, 5.5, 9, 1.7); L.position.y = H - .35; scene.add(L); return L;
  });
  const assignPool = z => {
    const near = lamps.slice().sort((a, b) => ((a.x - 12) ** 2 + (a.z - z) ** 2) - ((b.x - 12) ** 2 + (b.z - z) ** 2));
    pool.forEach((L, i) => { const l = near[i]; if (l) L.position.set(l.x, H - .35, l.z); });
  };

  /* камера: скролл страницы → путь по коридору, мышь → лёгкий поворот */
  const Z0 = (ROWS - 1.5) * C, Z1 = 6 * C;
  const progress = () => {
    const max = root.scrollHeight - win.innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, win.scrollY / max)) : 0;
  };
  let mx = 0, my = 0, smx = 0, smy = 0;
  if (!coarse) win.addEventListener('pointermove', e => { mx = e.clientX / win.innerWidth - .5; my = e.clientY / win.innerHeight - .5; }, { passive: true });
  win.addEventListener('resize', () => {
    camera.aspect = win.innerWidth / win.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(win.innerWidth, win.innerHeight);
  });

  let camZ = Z0 + (Z1 - Z0) * progress(), last = 0, poolZ = Infinity;
  function tick(t) {
    win.requestAnimationFrame(tick);
    const dt = Math.min(.05, last ? (t - last) / 1000 : .016); last = t;
    const tz = reduced ? Z0 : Z0 + (Z1 - Z0) * progress();
    camZ += (tz - camZ) * (1 - Math.exp(-dt * 2.5));
    const k = 1 - Math.exp(-dt * 3);
    smx += (mx - smx) * k; smy += (my - smy) * k;
    camera.position.set(6 * C + Math.sin(camZ * .11) * .3, EYE, camZ);
    camera.rotation.set(-.04 - smy * .1, -smx * .35 + Math.sin(camZ * .07) * .05, 0);
    if (Math.abs(camZ - poolZ) > .5) { poolZ = camZ; assignPool(camZ - 3); }
    renderer.render(scene, camera);
  }
  win.requestAnimationFrame(tick);
}
