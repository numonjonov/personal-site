/* v7 — Captain Clark ведёт по сайту (three.js r160 из vendor/).
   Комната Backrooms 26×20 м, на стенах шесть досок — по одной на раздел.
   Клик в навигации справа (или #hash) → капитан идёт к доске раздела,
   камера встаёт к стене фронтально, и HTML-раздел ложится ровно на
   прямоугольник доски (проекция её углов). На узком экране раздел — лист
   снизу. Без WebGL — обычная страница. Фигурка собрана из примитивов,
   текстуры рисуются на canvas. */
import * as THREE from '../vendor/three.module.min.js';

const doc = document, win = window, root = doc.documentElement;
const $ = id => doc.getElementById(id);
const reduced = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = win.matchMedia('(hover: none), (pointer: coarse)').matches;
const sleep = ms => new Promise(r => win.setTimeout(r, ms));

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
function wallpaper(seed, ratio) {
  const rand = rng(seed);
  return canvas2d(256, Math.round(256 * ratio), (g, w, h) => {
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
    gr.addColorStop(0, 'rgba(70,52,12,.3)'); gr.addColorStop(.1, 'rgba(70,52,12,0)');
    gr.addColorStop(.8, 'rgba(80,58,14,0)'); gr.addColorStop(1, 'rgba(80,58,14,.4)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) blot(g, rand() * w, h * (.6 + rand() * .4), 24 + rand() * 60, `rgba(105,78,20,${(.05 + rand() * .1).toFixed(2)})`);
    g.fillStyle = 'rgba(60,45,12,.5)'; g.fillRect(0, h - 5, w, 5);
    noise(g, w, h, 12, rand);
  });
}
function boardFace(title, no) {
  return canvas2d(1024, 652, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#221d12'); gr.addColorStop(1, '#14110a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(227,207,126,.5)'; g.lineWidth = 3; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#e3cf7e'; g.font = '500 34px "Geist Mono", monospace'; g.fillText(no, 70, 120);
    g.fillStyle = '#f3ecd6'; g.font = '800 150px "Bricolage Grotesque", sans-serif';
    g.fillText(title, 64, 280);
    g.fillStyle = 'rgba(243,236,214,.18)';
    for (let i = 0; i < 6; i++) g.fillRect(70, 360 + i * 38, 520 + ((i * 137) % 300), 12);
  });
}
function shadowBlob() {
  return canvas2d(128, 128, (g, w, h) => blot(g, w / 2, h / 2, w / 2, 'rgba(0,0,0,.55)'));
}

/* ---------- Captain Clark: пират с деревянной ногой, из примитивов ---------- */
function makeClark() {
  const M = c => new THREE.MeshLambertMaterial({ color: c });
  const coat = M(0x7e1f1b), trim = M(0xd8b24a), skin = M(0xe0b089), hair = M(0x2a1a10),
    black = M(0x15110e), shirt = M(0xece2cc), wood = M(0x8a5a2b), pants = M(0x2b2621), boot = M(0x1b1511);
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  const g = new THREE.Group();
  const upper = new THREE.Group(); g.add(upper);

  // левая нога — сапог, правая — деревянная
  const legL = new THREE.Group(); legL.position.set(-.13, .95, 0); g.add(legL);
  legL.add(mesh(new THREE.CylinderGeometry(.1, .09, .6, 10), pants, 0, -.3, 0));
  legL.add(mesh(new THREE.CylinderGeometry(.11, .12, .3, 10), boot, 0, -.75, 0));
  legL.add(mesh(new THREE.BoxGeometry(.2, .1, .32), boot, 0, -.9, .06));
  const legR = new THREE.Group(); legR.position.set(.13, .95, 0); g.add(legR);
  legR.add(mesh(new THREE.CylinderGeometry(.1, .085, .42, 10), pants, 0, -.21, 0));
  legR.add(mesh(new THREE.CylinderGeometry(.08, .07, .06, 10), wood, 0, -.44, 0));
  legR.add(mesh(new THREE.CylinderGeometry(.05, .032, .5, 8), wood, 0, -.7, 0));

  // камзол, рубаха, пояс с пряжкой, эполеты
  upper.add(mesh(new THREE.CylinderGeometry(.3, .43, 1.2, 18), coat, 0, 1.15, 0));
  upper.add(mesh(new THREE.BoxGeometry(.22, .5, .03), shirt, 0, 1.48, .31));
  upper.add(mesh(new THREE.CylinderGeometry(.385, .39, .09, 18), black, 0, .99, 0));
  upper.add(mesh(new THREE.BoxGeometry(.12, .09, .03), trim, 0, .99, .39));
  [-1, 1].forEach(s => upper.add(mesh(new THREE.BoxGeometry(.2, .05, .16), trim, s * .3, 1.76, 0)));
  for (let i = 0; i < 3; i++) upper.add(mesh(new THREE.SphereGeometry(.025, 8, 6), trim, .19, 1.55 - i * .14, .33));

  // руки на шарнирах в плечах
  const arm = s => {
    const a = new THREE.Group(); a.position.set(s * .37, 1.7, 0); upper.add(a);
    a.add(mesh(new THREE.CylinderGeometry(.085, .075, .62, 10), coat, 0, -.31, 0));
    a.add(mesh(new THREE.CylinderGeometry(.095, .095, .08, 10), trim, 0, -.6, 0));
    a.add(mesh(new THREE.SphereGeometry(.07, 10, 8), skin, 0, -.69, 0));
    return a;
  };
  const armL = arm(1), armR = arm(-1); // armR — правая рука капитана (слева для зрителя)

  // голова: борода, нос, глаз, повязка
  upper.add(mesh(new THREE.CylinderGeometry(.08, .09, .1, 10), skin, 0, 1.8, 0));
  const head = new THREE.Group(); head.position.set(0, 1.97, 0); upper.add(head);
  head.add(mesh(new THREE.SphereGeometry(.18, 16, 12), skin));
  const beard = mesh(new THREE.SphereGeometry(.185, 16, 10, 0, Math.PI * 2, Math.PI * .57, Math.PI * .43), hair, 0, -.01, .02);
  beard.scale.set(1, 1.25, 1.08); head.add(beard);
  head.add(mesh(new THREE.BoxGeometry(.16, .035, .04), hair, 0, -.035, .17));
  head.add(mesh(new THREE.SphereGeometry(.035, 8, 6), skin, 0, .0, .185));
  head.add(mesh(new THREE.SphereGeometry(.024, 8, 6), black, -.065, .05, .16));
  const patch = mesh(new THREE.CylinderGeometry(.045, .045, .02, 12), black, .065, .05, .165);
  patch.rotation.x = Math.PI / 2; head.add(patch);
  const strap = mesh(new THREE.TorusGeometry(.183, .008, 6, 32), black, 0, .07, 0);
  strap.rotation.set(Math.PI / 2, .35, 0); head.add(strap);
  // треуголка с золотой кромкой и черепом
  head.add(mesh(new THREE.CylinderGeometry(.45, .45, .02, 3), trim, 0, .145, 0));
  head.add(mesh(new THREE.CylinderGeometry(.43, .43, .07, 3), black, 0, .17, 0));
  head.add(mesh(new THREE.CylinderGeometry(.17, .2, .2, 14), black, 0, .27, 0));
  head.add(mesh(new THREE.SphereGeometry(.04, 8, 6), shirt, 0, .27, .19));

  return { g, upper, head, legL, legR, armL, armR };
}

/* ---------- Сцена ---------- */
function canWebGL() {
  try { const c = doc.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
}
if (canWebGL()) {
  root.classList.add('is-3d');
  boot().catch(err => { console.error(err); root.classList.remove('is-3d'); });
}

async function boot() {
  if (doc.fonts && doc.fonts.load) {
    await Promise.race([
      Promise.all(['800 40px "Bricolage Grotesque"', '500 20px "Geist Mono"'].map(f => doc.fonts.load(f))),
      sleep(2500),
    ]).catch(() => {});
  }

  const RW = 26, RD = 20, RH = 3.6;           // комната: x 0…26, z 0…20
  const BW = 4.4, BH = 3.0, BY = 1.85;        // доска на стене
  const STATIONS = {
    home:       { title: 'Home',       no: '00', c: [RW / 2, 0],  n: [0, 1] },
    about:      { title: 'About',      no: '01', c: [0, 6],       n: [1, 0] },
    work:       { title: 'Work',       no: '02', c: [0, 14],      n: [1, 0] },
    skills:     { title: 'Skills',     no: '03', c: [RW, 6],      n: [-1, 0] },
    experience: { title: 'Experience', no: '04', c: [RW, 14],     n: [-1, 0] },
    contact:    { title: 'Contact',    no: '05', c: [RW / 2, RD], n: [0, -1] },
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, coarse ? 1.25 : 1.5));
  renderer.setSize(win.innerWidth, win.innerHeight);
  $('stage').appendChild(renderer.domElement);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = (c, rx, ry) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    if (rx) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
    return t;
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6f6235);
  scene.fog = new THREE.Fog(0x6f6235, 18, 46);
  const camera = new THREE.PerspectiveCamera(45, win.innerWidth / win.innerHeight, .05, 120);
  scene.add(new THREE.HemisphereLight(0xfff2c4, 0x5c4a1e, 1.5));

  // стены — четыре плоскости внутрь комнаты
  const wallTex = (len) => tex(wallpaper(13, RH / 2), len / 2, 1);
  const wall = (len, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, RH), new THREE.MeshLambertMaterial({ map: wallTex(len) }));
    m.position.set(x, RH / 2, z); m.rotation.y = ry; scene.add(m);
  };
  wall(RW, RW / 2, 0, 0); wall(RW, RW / 2, RD, Math.PI);
  wall(RD, 0, RD / 2, Math.PI / 2); wall(RD, RW, RD / 2, -Math.PI / 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), new THREE.MeshLambertMaterial({ map: tex(carpet(), RW / 4, RD / 4) }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(RW / 2, 0, RD / 2); scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), new THREE.MeshLambertMaterial({ map: tex(ceiling(), RW / 2, RD / 2) }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(RW / 2, RH, RD / 2); scene.add(ceil);

  // лампы на потолке и четыре общих источника
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfffbe6 });
  const haloMat = new THREE.SpriteMaterial({ map: tex(halo()), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .4 });
  const lampGeo = new THREE.BoxGeometry(1.2, .05, .6);
  for (let x = 3; x < RW; x += 4) for (let z = 2; z < RD; z += 4) {
    const l = new THREE.Mesh(lampGeo, lampMat); l.position.set(x, RH - .025, z); scene.add(l);
    const s = new THREE.Sprite(haloMat); s.position.set(x, RH - .12, z); s.scale.set(2.2, 1.3, 1); scene.add(s);
  }
  [[6.5, 5], [19.5, 5], [6.5, 15], [19.5, 15]].forEach(([x, z]) => {
    const L = new THREE.PointLight(0xffefc0, 9, 16, 1.4); L.position.set(x, RH - .4, z); scene.add(L);
  });

  // доски
  for (const [id, st] of Object.entries(STATIONS)) {
    const [cx, cz] = st.c, [nx, nz] = st.n;
    st.center = new THREE.Vector3(cx + nx * .07, BY, cz + nz * .07);
    st.normal = new THREE.Vector3(nx, 0, nz);
    st.right = new THREE.Vector3(nz, 0, -nx);
    const ry = Math.atan2(nx, nz);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(BW + .18, BH + .18, .06), new THREE.MeshLambertMaterial({ color: 0x2a2416 }));
    frame.position.set(cx + nx * .03, BY, cz + nz * .03); frame.rotation.y = ry; scene.add(frame);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), new THREE.MeshBasicMaterial({ map: tex(boardFace(st.title, st.no)) }));
    face.position.copy(st.center); face.rotation.y = ry; scene.add(face);
    const spot = new THREE.PointLight(0xfff0c8, 4, 7, 1.6);
    spot.position.set(cx + nx * 1.4, RH - .3, cz + nz * 1.4); scene.add(spot);
    // где встаёт капитан: справа от доски, чуть впереди
    st.stand = new THREE.Vector3(cx, 0, cz).addScaledVector(st.right, BW / 2 + .45).addScaledVector(st.normal, 1.3);
    st.corners = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([a, b]) =>
      st.center.clone().addScaledVector(st.right, a * BW / 2).add(new THREE.Vector3(0, b * BH / 2, 0)));
    st.el = $(id);
  }

  // капитан и пятно тени под ним
  const clark = makeClark();
  clark.g.position.set(RW / 2, 0, RD / 2 + 1);
  clark.g.rotation.y = Math.PI;
  scene.add(clark.g);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: tex(shadowBlob()), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = .012; scene.add(blob);

  /* ---------- Кадр камеры у доски ----------
     Камера смотрит на доску строго фронтально, а смещение кадра
     (setViewOffset) ставит доску в нужное место экрана. */
  const railW = () => (win.innerWidth < 760 ? 0 : 280);
  function framing(st) {
    const vw = win.innerWidth, vh = win.innerHeight, narrow = vw < 760;
    const fov = narrow ? 60 : 42;
    const tanH = Math.tan(fov * Math.PI / 360) * (vw / vh);
    let bw, px, py;
    if (narrow) { bw = vw * .6; px = vw * .4; py = vh * .19; }
    else {
      const area = vw - railW() - 72;
      bw = Math.min(area * .76, (vh - 120) * BW / BH);
      px = 36 + bw / 2; py = vh * .46;
    }
    const d = BW * vw / (bw * 2 * tanH);
    return {
      pos: st.center.clone().addScaledVector(st.normal, d),
      look: st.center.clone(),
      ox: vw / 2 - px, oy: vh / 2 - py, fov,
    };
  }
  function chase() {
    const p = clark.g.position, yaw = clark.g.rotation.y;
    const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const pos = p.clone().addScaledVector(f, -4.6).add(new THREE.Vector3(0, 2.9, 0));
    pos.x = Math.min(RW - .4, Math.max(.4, pos.x)); pos.z = Math.min(RD - .4, Math.max(.4, pos.z));
    return { pos, look: p.clone().add(new THREE.Vector3(0, 1.3, 0)).addScaledVector(f, 1.6), ox: 0, oy: 0, fov: win.innerWidth < 760 ? 62 : 50 };
  }

  /* ---------- Навигация ---------- */
  const links = Array.from(doc.querySelectorAll('.rail ol a'));
  const bubble = $('bubble'), status = $('status');
  let target = null, walking = false, shown = null, bubbleT = 0;
  const camPos = new THREE.Vector3(RW / 2, 3.2, RD - .6), camLook = new THREE.Vector3(RW / 2, 1.4, RD / 2);
  let camOx = 0, camOy = 0, camFov = 50;

  function hidePanel() {
    if (shown) { shown.el.classList.remove('show'); shown.el.setAttribute('aria-hidden', 'true'); shown = null; }
  }
  function go(id, instant) {
    const st = STATIONS[id] || STATIONS.home;
    if (target === st && !walking) return;
    target = st; hidePanel();
    links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
    status.textContent = `Captain Clark is walking to ${st.title}.`;
    bubble.textContent = st.el.dataset.say || '';
    bubbleT = 0;
    if (instant || reduced) {
      clark.g.position.copy(st.stand); walking = false;
      clark.g.rotation.y = faceYaw(st);
      const f = framing(st); camPos.copy(f.pos); camLook.copy(f.look); camOx = f.ox; camOy = f.oy; camFov = f.fov;
    } else walking = true;
  }
  const faceYaw = st => {
    // лицом к зрителю, корпус чуть развёрнут к доске
    const d = st.normal.clone().addScaledVector(st.right, -.55).normalize();
    return Math.atan2(d.x, d.z);
  };
  const fromHash = () => (location.hash || '#home').slice(1);
  win.addEventListener('hashchange', () => go(fromHash()));
  links.forEach(a => a.addEventListener('click', e => {
    // повторный клик по тому же разделу всё равно ведёт капитана
    if (a.getAttribute('href') === location.hash) { e.preventDefault(); go(fromHash()); }
  }));

  win.addEventListener('resize', () => {
    renderer.setSize(win.innerWidth, win.innerHeight);
    camera.aspect = win.innerWidth / win.innerHeight;
  });

  /* ---------- Кадр ---------- */
  const v = new THREE.Vector3();
  const SPEED = 3.4;
  let ph = 0, last = 0;
  const angLerp = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

  function tick(t) {
    win.requestAnimationFrame(tick);
    const dt = Math.min(.05, last ? (t - last) / 1000 : .016); last = t;
    const p = clark.g.position;

    // ходьба
    let moving = false;
    if (walking && target) {
      v.copy(target.stand).sub(p); v.y = 0;
      const dist = v.length();
      if (dist < .05) { walking = false; p.copy(target.stand); }
      else {
        moving = true;
        const step = Math.min(dist, SPEED * dt * Math.min(1, dist / .6 + .3));
        p.addScaledVector(v.normalize(), step);
        clark.g.rotation.y = angLerp(clark.g.rotation.y, Math.atan2(v.x, v.z), 1 - Math.exp(-dt * 10));
      }
    } else if (target) {
      clark.g.rotation.y = angLerp(clark.g.rotation.y, faceYaw(target), 1 - Math.exp(-dt * 6));
    }

    // анимация: шаг вразвалку на деревянной ноге, жест рукой у доски
    const arrived = target && !walking;
    if (moving) ph += dt * 9; else ph += (Math.round(ph / Math.PI) * Math.PI - ph) * (1 - Math.exp(-dt * 8));
    const s = Math.sin(ph);
    clark.legL.rotation.x = s * .55;
    clark.legR.rotation.x = -s * .4;
    clark.upper.position.y = Math.abs(s) * .05;
    clark.g.rotation.z = moving ? Math.sin(ph) * .05 : 0;
    clark.armL.rotation.x = -s * .5;
    const point = arrived ? 1 : 0, kArm = 1 - Math.exp(-dt * 6);
    clark.armR.rotation.x += ((moving ? s * .5 : -.35 * point) - clark.armR.rotation.x) * kArm;
    clark.armR.rotation.z += ((-1.75 * point) - clark.armR.rotation.z) * kArm;
    clark.head.rotation.y = arrived ? Math.sin(t / 1400) * .12 - .2 : 0;
    clark.upper.scale.y = 1 + (moving ? 0 : Math.sin(t / 700) * .006);
    blob.position.x = p.x; blob.position.z = p.z;

    // камера: следом за капитаном, у доски — фронтальный кадр
    const want = arrived ? framing(target) : chase();
    const k = reduced ? 1 : 1 - Math.exp(-dt * (arrived ? 2.6 : 3.2));
    camPos.lerp(want.pos, k); camLook.lerp(want.look, k);
    camOx += (want.ox - camOx) * k; camOy += (want.oy - camOy) * k; camFov += (want.fov - camFov) * k;
    camera.position.copy(camPos); camera.lookAt(camLook);
    camera.fov = camFov; camera.aspect = win.innerWidth / win.innerHeight;
    camera.setViewOffset(win.innerWidth, win.innerHeight, camOx, camOy, win.innerWidth, win.innerHeight);
    camera.updateProjectionMatrix();

    // доска с текстом: когда камера встала — кладём раздел на прямоугольник доски
    const settled = arrived && camPos.distanceTo(want.pos) < .04 && Math.abs(camOx - want.ox) < 1 && Math.abs(camOy - want.oy) < 1;
    if (settled) {
      const el = target.el;
      if (win.innerWidth >= 760) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        target.corners.forEach(c => {
          v.copy(c).project(camera);
          const x = (v.x + 1) / 2 * win.innerWidth, y = (1 - v.y) / 2 * win.innerHeight;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        });
        el.style.left = x0.toFixed(1) + 'px'; el.style.top = y0.toFixed(1) + 'px';
        el.style.width = (x1 - x0).toFixed(1) + 'px'; el.style.height = (y1 - y0).toFixed(1) + 'px';
      } else el.removeAttribute('style');
      if (shown !== target) {
        shown = target; el.classList.add('show'); el.removeAttribute('aria-hidden');
        el.scrollTop = 0;
        status.textContent = `${target.title} is on the wall.`;
        if (doc.activeElement && doc.activeElement.closest && doc.activeElement.closest('.rail')) el.focus({ preventScroll: true });
      }
    }

    // реплика над головой: пока идёт и ещё секунду после
    bubbleT = settled ? bubbleT + dt : 0;
    const talk = target && bubble.textContent && bubbleT < 1.4;
    if (talk) {
      v.copy(p).add(new THREE.Vector3(0, 2.75, 0)).project(camera);
      if (v.z < 1) {
        bubble.style.left = ((v.x + 1) / 2 * win.innerWidth).toFixed(1) + 'px';
        bubble.style.top = ((1 - v.y) / 2 * win.innerHeight).toFixed(1) + 'px';
      }
    }
    bubble.classList.toggle('on', !!talk);

    renderer.render(scene, camera);
  }

  Object.values(STATIONS).forEach(st => st.el.setAttribute('aria-hidden', 'true'));
  go(fromHash());
  win.requestAnimationFrame(tick);
}
