/* v10 — по мотивам noth.in. three.js r160 из vendor/ только для 3D-сцены.
   Прелоадер 000→100, вордмарк по ширине экрана с подъёмом букв, появление
   блоков, карточка растёт при скролле, внутри — «надутые» объекты (фольга,
   хром, резина, глянец) и буквы PAHLAVON на орбитах. Рваные повторы
   «talks to old systems» с параллаксом и глитчем. Часы Ташкента. */
import * as THREE from '../vendor/three.module.min.js';

const doc = document, win = window, root = doc.documentElement;
const $ = id => doc.getElementById(id);
const reduced = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = win.matchMedia('(hover: none), (pointer: coarse)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
root.classList.add('js');

/* ---------- Вордмарк: буквы по отдельности и подгонка по ширине ---------- */
const marks = Array.from(doc.querySelectorAll('[data-fit]'));
marks.forEach(el => {
  const text = el.textContent;
  el.textContent = '';
  [...text].forEach((c, i) => {
    const s = doc.createElement('span'); s.className = 'ch'; s.textContent = c;
    s.style.transitionDelay = (i * 45) + 'ms';
    el.appendChild(s);
  });
});
function fitMarks() {
  marks.forEach(el => {
    el.style.fontSize = '100px';
    const w = el.scrollWidth, box = el.parentElement.clientWidth;
    if (w > 0) el.style.fontSize = (100 * box / w).toFixed(2) + 'px';
  });
}
fitMarks();
win.addEventListener('resize', fitMarks);
if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fitMarks);

/* ---------- Прелоадер: один раз за сессию ---------- */
const loader = $('loader');
let seen = false;
try { seen = sessionStorage.getItem('v10-seen') === '1'; sessionStorage.setItem('v10-seen', '1'); } catch (e) { /* без хранилища */ }
function ready() { root.classList.add('ready'); }
if (reduced || seen) { loader.classList.add('gone'); ready(); }
else {
  const n = $('loader-n'), t0 = performance.now(), dur = 1100;
  const tick = t => {
    const p = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3);
    n.textContent = String(Math.round(e * 100)).padStart(3, '0');
    if (p < 1) win.requestAnimationFrame(tick);
    else {
      win.setTimeout(() => { loader.classList.add('done'); ready(); }, 180);
      win.setTimeout(() => loader.classList.add('gone'), 1200);
    }
  };
  win.requestAnimationFrame(tick);
  win.setTimeout(() => { if (!loader.classList.contains('done')) { loader.classList.add('done', 'gone'); ready(); } }, 4000);
}

/* ---------- Появление блоков ---------- */
const reveals = Array.from(doc.querySelectorAll('.reveal'));
if (reduced || !('IntersectionObserver' in win)) reveals.forEach(r => r.classList.add('in'));
else {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, sib = el.parentElement ? Array.from(el.parentElement.children).indexOf(el) : 0;
    el.style.transitionDelay = (Math.min(sib, 6) * 70) + 'ms';
    el.classList.add('in'); io.unobserve(el);
  }), { rootMargin: '0px 0px -8% 0px' });
  reveals.forEach(r => io.observe(r));
  win.setTimeout(() => reveals.forEach(r => r.classList.add('in')), 6000);
}

/* ---------- Меню на телефоне ---------- */
const menu = $('menu'), menuBtn = $('menu-btn');
menuBtn.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});
menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { menu.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }));

/* ---------- Часы Ташкента ---------- */
const clockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false });
const clockEl = $('clock');
const setClock = () => { clockEl.textContent = clockFmt.format(new Date()); };
setClock(); win.setInterval(setClock, 15000);

/* ---------- Скролл: растущая карточка и рваные повторы ---------- */
const reel = $('reel'), card = $('reel-card');
const echoes = Array.from(doc.querySelectorAll('.echoes p'));
const glitches = Array.from(doc.querySelectorAll('[data-glitch]'));
let queued = false;
function onScroll() {
  queued = false;
  const vh = win.innerHeight;
  const r = reel.getBoundingClientRect();
  const p = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
  const e = 1 - Math.pow(1 - clamp(p * 1.5, 0, 1), 3);
  card.style.setProperty('--s', reduced ? '1' : (.62 + .38 * e).toFixed(4));
  card.style.borderRadius = (reduced ? 8 : 18 - 12 * e).toFixed(1) + 'px';
  if (!reduced) echoes.forEach(el => {
    const b = el.getBoundingClientRect(), d = parseFloat(el.dataset.depth) || .3;
    el.style.transform = `translate3d(0, ${((b.top + b.height / 2 - vh / 2) * -d * .35).toFixed(1)}px, 0)`;
  });
}
win.addEventListener('scroll', () => { if (!queued) { queued = true; win.requestAnimationFrame(onScroll); } }, { passive: true });
win.addEventListener('resize', onScroll);
onScroll();

// глитч: в последней строке каждого повтора меняются символы
if (!reduced && glitches.length) {
  const glyphs = 'Pj(è!!”.U§hsjkj.k.rh';
  const base = glitches.map(g => g.textContent);
  win.setInterval(() => {
    glitches.forEach((g, i) => {
      if (Math.random() < .5) { g.textContent = base[i]; return; }
      g.textContent = [...base[i]].map(c => (c !== ' ' && Math.random() < .55 ? glyphs[(Math.random() * glyphs.length) | 0] : c)).join('');
    });
  }, 140);
}

/* ================= 3D-сцена в карточке ================= */
function canWebGL() {
  try { const c = doc.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
}
if (canWebGL()) {
  // строим, только когда карточка подъезжает к экрану
  const io = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); buildScene().catch(err => console.error(err)); }
  }, { rootMargin: '600px 0px' });
  io.observe(reel);
}

/* шум для «надутых» и мятых поверхностей */
function hash(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
    l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v),
    w) * 2 - 1;
}
function displace(geo, fn) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    v.addScaledVector(n, fn(n, v));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

async function buildScene() {
  if (doc.fonts && doc.fonts.load) await Promise.race([doc.fonts.load('900 100px Archivo'), new Promise(r => win.setTimeout(r, 2000))]).catch(() => {});
  const box = $('reel-canvas');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, coarse ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  box.appendChild(renderer.domElement);
  root.classList.add('has-3d');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 60);
  camera.position.set(0, 0, 10);

  // окружение для отражений: тёмная «студия» со световыми панелями
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x060608);
  const panel = (w, h, x, y, z, k, tint = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  panel(14, 4, 0, 9, 2, 3.2);            // софтбокс сверху
  panel(3, 12, -10, 1, 3, 2.2);          // полоса слева
  panel(3, 12, 10, 0, -2, 1.4, 0xdfe6ff); // полоса справа, холоднее
  panel(10, 3, 0, -8, 4, .6, 0xffd6e2);  // тёплый отражатель снизу
  panel(6, 6, 4, 3, 10, 1.6);            // за камерой
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, .03).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-4, 6, 6); scene.add(key);

  const world = new THREE.Group(); scene.add(world);
  const things = [];
  const add = (mesh, x, y, z, s = 1, spin = .2) => {
    mesh.position.set(x, y, z); mesh.scale.setScalar(s);
    mesh.userData = { base: mesh.position.clone(), spin, phase: Math.random() * 6 };
    world.add(mesh); things.push(mesh); return mesh;
  };

  // 1. мятая синяя фольга
  const foil = displace(new THREE.IcosahedronGeometry(1.2, 14), n =>
    .2 * vnoise(n.x * 1.8, n.y * 1.8, n.z * 1.8) + .14 * Math.abs(vnoise(n.x * 4 + 3, n.y * 4, n.z * 4)) - .06 * Math.abs(vnoise(n.x * 7, n.y * 7 + 7, n.z * 7)));
  add(new THREE.Mesh(foil, new THREE.MeshStandardMaterial({ color: 0x2b4bff, metalness: 1, roughness: .2, flatShading: true })), -.75, -.35, .2, 1, .12);

  // 2. чёрные глянцевые «шары»-капсулы звездой
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0e, metalness: .3, roughness: .12, clearcoat: 1, clearcoatRoughness: .08 });
  const star = new THREE.Group();
  [0, 1.15, 2.3].forEach(a => {
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(.3, 1.05, 16, 32), gloss);
    c.rotation.z = a; c.position.set(Math.cos(a + 1.57) * .45, Math.sin(a + 1.57) * .45, 0); star.add(c);
  });
  add(star, .25, .85, -1.2, 1, .1);

  // 3. хромированный «надутый» узел
  add(new THREE.Mesh(new THREE.TorusKnotGeometry(.5, .21, 220, 40, 2, 3), new THREE.MeshStandardMaterial({ color: 0xe8e8ec, metalness: 1, roughness: .08 })), 1.75, .95, .1, .85, .25);

  // 4. розовый резиновый мяч с мелкой фактурой
  const ball = displace(new THREE.SphereGeometry(.56, 128, 96), n => .035 * vnoise(n.x * 9, n.y * 9, n.z * 9) + .02 * vnoise(n.x * 23, n.y * 23, n.z * 23));
  add(new THREE.Mesh(ball, new THREE.MeshPhysicalMaterial({ color: 0xe9879e, roughness: .62, metalness: 0, sheen: 1, sheenColor: new THREE.Color(0xffd1dc) })), 1.45, -.45, .6, 1, .18);

  // 5. серебряная конфета в обёртке
  const silver = new THREE.MeshStandardMaterial({ color: 0xcfd2d8, metalness: 1, roughness: .18, flatShading: true });
  const candy = new THREE.Group();
  const body = displace(new THREE.SphereGeometry(.4, 48, 32), n => .03 * vnoise(n.x * 8, n.y * 8, n.z * 8)); body.scale(1.25, .9, .9);
  candy.add(new THREE.Mesh(body, silver));
  [-1, 1].forEach(s => {
    const twist = displace(new THREE.ConeGeometry(.3, .42, 14, 6, true), (n, v) => .03 * vnoise(v.x * 12, v.y * 12, v.z * 12));
    const m = new THREE.Mesh(twist, silver); m.rotation.z = s * Math.PI / 2; m.position.x = s * .62; candy.add(m);
  });
  candy.rotation.z = -.5;
  add(candy, 1.25, -1.55, .3, 1, .3);

  // 6. буквы PAHLAVON на орбитах
  const letters = [];
  const word = 'PAHLAVON';
  [...word].forEach((ch, i) => {
    const c = doc.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.font = '900 200px Archivo, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, 128, 140);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    const s = .45 + Math.random() * .35; sp.scale.set(s, s, 1);
    sp.material.rotation = (Math.random() - .5) * .9;
    sp.userData = { a: i / word.length * Math.PI * 2 + Math.random() * .3, rx: 2.9 + Math.random() * .8, rz: 1.6 + Math.random() * .6, y: (Math.random() - .5) * 2.6, sp: .18 + Math.random() * .1, tilt: (Math.random() - .5) * .02 };
    world.add(sp); letters.push(sp);
  });

  /* перетаскивание: вращение с инерцией; мышь — лёгкий наклон */
  let rotY = 0, vel = 0, dragging = false, lastX = 0, mx = 0, my = 0;
  box.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; box.classList.add('drag'); try { box.setPointerCapture(e.pointerId); } catch (err) { /* синтетика */ } });
  box.addEventListener('pointermove', e => {
    const r = box.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - .5; my = (e.clientY - r.top) / r.height - .5;
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX; rotY += dx * .006; vel = dx * .006 * 60;
  });
  const up = () => { dragging = false; box.classList.remove('drag'); };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);

  const resize = () => {
    const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.position.z = w / h < 1 ? 15 : 10; // на узком экране отъезжаем
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(box); resize();

  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(box);

  let last = 0, time = 0, smx = 0, smy = 0;
  function frame(t) {
    win.requestAnimationFrame(frame);
    if (!visible || doc.hidden) { last = 0; return; }
    const dt = Math.min(.05, last ? (t - last) / 1000 : .016); last = t;
    if (!reduced) time += dt;
    if (!dragging) { vel *= Math.exp(-dt * 2.2); rotY += (vel + (reduced ? 0 : .12)) * dt; }
    smx += (mx - smx) * (1 - Math.exp(-dt * 3)); smy += (my - smy) * (1 - Math.exp(-dt * 3));
    world.rotation.y = rotY + smx * .35;
    world.rotation.x = smy * .2;
    things.forEach(m => {
      const u = m.userData;
      m.position.y = u.base.y + Math.sin(time * .9 + u.phase) * .08;
      m.rotation.y += u.spin * dt * (reduced ? 0 : 1);
      m.rotation.x = Math.sin(time * .5 + u.phase) * .15;
    });
    letters.forEach(l => {
      const u = l.userData; u.a += u.sp * dt * (reduced ? 0 : 1);
      l.position.set(Math.cos(u.a) * u.rx, u.y + Math.sin(time * .7 + u.a * 2) * .15, Math.sin(u.a) * u.rz);
      l.material.rotation += u.tilt * (reduced ? 0 : 1);
    });
    renderer.render(scene, camera);
  }
  win.requestAnimationFrame(frame);
}
