/* v8 — страница + 3D-глобус (three.js r160 из vendor/).
   Глобус — белая «глина»: рельеф континентов строится здесь же из контуров
   суши Natural Earth (vendor/land-110m.json, TopoJSON) — карта высот и
   карта нормалей рисуются на canvas. Вокруг летает самолётик с тенью,
   Tashkent отмечен точкой. Крутится мышью/пальцем, клик — домой. */
import * as THREE from '../vendor/three.module.min.js';

const doc = document, win = window, root = doc.documentElement;
const $ = id => doc.getElementById(id);
const reduced = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
root.classList.add('js');

/* ---------- Строки: появляются при загрузке и по скроллу ---------- */
const lines = Array.from(doc.querySelectorAll('.line'));
if (reduced || !('IntersectionObserver' in win)) lines.forEach(l => l.classList.add('in'));
else {
  let order = 0;
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target; io.unobserve(el);
    win.setTimeout(() => el.classList.add('in'), 90 * (order++ % 6));
    win.setTimeout(() => { order = 0; }, 600);
  }), { rootMargin: '0px 0px -8% 0px' });
  lines.forEach(l => io.observe(l));
  win.setTimeout(() => lines.forEach(l => l.classList.add('in')), 3500);
}

/* ---------- Пункты списков темнеют по мере скролла ---------- */
const fades = Array.from(doc.querySelectorAll('.fade'));
let fadeQueued = false;
function updateFades() {
  fadeQueued = false;
  const vh = win.innerHeight;
  fades.forEach(el => {
    const top = el.getBoundingClientRect().top;
    const t = reduced ? 1 : Math.min(1, Math.max(0, (vh * .92 - top) / (vh * .3)));
    el.style.setProperty('--t', t.toFixed(3));
  });
}
const queueFades = () => { if (!fadeQueued) { fadeQueued = true; win.requestAnimationFrame(updateFades); } };
win.addEventListener('scroll', queueFades, { passive: true });
win.addEventListener('resize', queueFades);
updateFades();

/* ---------- Почта: клик — копировать ---------- */
doc.querySelectorAll('[data-copy]').forEach(btn => {
  const tip = btn.querySelector('.tip');
  btn.addEventListener('click', async () => {
    const text = btn.dataset.copy;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { /* нет доступа к буферу */ }
    if (!ok) { win.location.href = 'mailto:' + text; return; }
    tip.textContent = 'copied ✓'; btn.classList.add('done');
    win.setTimeout(() => { tip.textContent = 'click to copy'; btn.classList.remove('done'); }, 1600);
  });
});

/* ================= Глобус ================= */
const TASHKENT = { lat: 41.31, lon: 69.24 };
const canWebGL = () => {
  try { const c = doc.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
};
if (canWebGL()) buildGlobe().catch(err => { console.error(err); root.classList.remove('has-globe'); });

/* Широта/долгота → точка на единичной сфере (та же развёртка, что у SphereGeometry) */
function toVec(lat, lon, r = 1) {
  const phi = (lon + 180) / 180 * Math.PI, theta = (90 - lat) / 180 * Math.PI;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta) * r, Math.cos(theta) * r, Math.sin(phi) * Math.sin(theta) * r);
}

/* TopoJSON суши → белые материки на чёрном, равнопромежуточная проекция */
async function landMask(W, H) {
  const topo = await fetch('../vendor/land-110m.json').then(r => r.json());
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
  const arc = i => (i >= 0 ? arcs[i] : arcs[~i].slice().reverse());
  const ring = idx => idx.reduce((pts, i, k) => pts.concat(k ? arc(i).slice(1) : arc(i)), []);
  const obj = topo.objects.land;
  const polys = [];
  (obj.type === 'GeometryCollection' ? obj.geometries : [obj]).forEach(g => {
    if (g.type === 'Polygon') polys.push(g.arcs); else if (g.type === 'MultiPolygon') polys.push(...g.arcs);
  });
  const c = doc.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  polys.forEach(p => {
    g.beginPath();
    p.forEach(idx => {
      let prev = null;
      ring(idx).forEach(([lon, lat]) => {
        const x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H;
        if (prev === null) g.moveTo(x, y);
        else if (Math.abs(x - prev) > W / 2) g.moveTo(x, y); // шов на 180°
        else g.lineTo(x, y);
        prev = x;
      });
      g.closePath();
    });
    g.fill('evenodd');
  });
  return c;
}

/* Карта высот: мягкие материки + немного «гор»; карта нормалей — по её градиенту */
function reliefMaps(mask) {
  const W = 1024, H = 512;
  const hc = doc.createElement('canvas'); hc.width = W; hc.height = H;
  const g = hc.getContext('2d');
  g.filter = 'blur(5px)'; g.drawImage(mask, 0, 0, W, H);
  g.filter = 'blur(1.5px)'; g.globalAlpha = .55; g.drawImage(mask, 0, 0, W, H);
  g.filter = 'none'; g.globalAlpha = 1;
  const img = g.getImageData(0, 0, W, H), d = img.data;
  const h = new Float32Array(W * H);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const bumps = Array.from({ length: 900 }, () => [rnd() * W, rnd() * H, 3 + rnd() * 12, rnd() * .35]);
  for (let i = 0; i < W * H; i++) h[i] = d[i * 4] / 255 * .8;
  bumps.forEach(([bx, by, br, ba]) => {
    for (let y = Math.max(0, by - br | 0); y < Math.min(H, by + br); y++) for (let x = Math.max(0, bx - br | 0); x < Math.min(W, bx + br); x++) {
      const k = y * W + x, q = 1 - Math.hypot(x - bx, y - by) / br;
      if (q > 0 && h[k] > .2) h[k] += ba * q * q * h[k];
    }
  });
  const height = doc.createElement('canvas'); height.width = W; height.height = H;
  const nrm = doc.createElement('canvas'); nrm.width = W; nrm.height = H;
  const hImg = height.getContext('2d').createImageData(W, H), nImg = nrm.getContext('2d').createImageData(W, H);
  const S = 3.2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x, v = Math.min(1, h[k]) * 255;
    hImg.data[k * 4] = hImg.data[k * 4 + 1] = hImg.data[k * 4 + 2] = v; hImg.data[k * 4 + 3] = 255;
    const l = h[y * W + (x + W - 1) % W], r = h[y * W + (x + 1) % W];
    const u = h[Math.max(0, y - 1) * W + x], dn = h[Math.min(H - 1, y + 1) * W + x];
    let nx = -(r - l) * S, ny = (dn - u) * S, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    nImg.data[k * 4] = (nx * .5 + .5) * 255; nImg.data[k * 4 + 1] = (ny * .5 + .5) * 255; nImg.data[k * 4 + 2] = (nz * .5 + .5) * 255; nImg.data[k * 4 + 3] = 255;
  }
  height.getContext('2d').putImageData(hImg, 0, 0);
  nrm.getContext('2d').putImageData(nImg, 0, 0);
  return { height, nrm };
}

/* Самолётик из примитивов, нос по +z */
function makePlane(mat) {
  const p = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.017, .085, 6, 12), mat); body.rotation.x = Math.PI / 2; p.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(.15, .005, .032), mat); wing.position.z = .006; p.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(.055, .004, .018), mat); tail.position.z = -.05; p.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(.004, .03, .022), mat); fin.position.set(0, .016, -.05); p.add(fin);
  return p;
}

async function buildGlobe() {
  root.classList.add('has-globe');
  const fig = $('globe'), box = $('globe-canvas'), label = $('pin-label');
  const { height, nrm } = reliefMaps(await landMask(2048, 1024));

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  box.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 50);
  camera.position.set(0, 0, 4.7);

  scene.add(new THREE.AmbientLight(0xfaf8f5, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(-3, 3.2, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, .6); rim.position.set(3, -1, -2); scene.add(rim);

  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const clay = new THREE.MeshPhongMaterial({
    color: 0xf0eeeb, specular: 0x000000, shininess: 0,
    normalMap: tex(nrm), normalScale: new THREE.Vector2(1.7, 1.7),
    displacementMap: tex(height), displacementScale: .04,
  });
  const tilt = new THREE.Group(); scene.add(tilt);
  const spin = new THREE.Group(); tilt.add(spin);
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(1, 220, 110), clay));

  // Tashkent: чёрная точка и расходящееся кольцо
  const home = toVec(TASHKENT.lat, TASHKENT.lon);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(.022, 16, 12), new THREE.MeshBasicMaterial({ color: 0x0a0a0a }));
  dot.position.copy(home).multiplyScalar(1.03); spin.add(dot);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.03, .036, 40), new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, side: THREE.DoubleSide }));
  ring.position.copy(home).multiplyScalar(1.031); ring.lookAt(home.clone().multiplyScalar(2)); spin.add(ring);

  // самолётик на наклонной орбите и его тень на поверхности
  const plane = makePlane(new THREE.MeshPhongMaterial({ color: 0xf0eeeb, specular: 0x888888, shininess: 18 }));
  plane.scale.setScalar(1.6); scene.add(plane);
  const sc = doc.createElement('canvas'); sc.width = sc.height = 64;
  const sg = sc.getContext('2d'), grd = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,.22)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = grd; sg.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(.13, .13), new THREE.MeshBasicMaterial({ map: tex(sc), transparent: true, depthWrite: false }));
  scene.add(shadow);
  const orbit = new THREE.Quaternion().setFromEuler(new THREE.Euler(.5, 0, .32));
  const R = 1.22;

  // ориентация: Tashkent к зрителю, северное полушарие чуть к нам
  const homeYaw = -Math.atan2(home.x, home.z);
  tilt.rotation.x = .42;
  spin.rotation.y = homeYaw + .9;
  let target = homeYaw, vel = 0, dragging = false, moved = 0, lastX = 0, idle = 0;

  // перетаскивание с инерцией; клик без сдвига — «домой»
  box.addEventListener('pointerdown', e => {
    dragging = true; moved = 0; lastX = e.clientX; vel = 0; target = null;
    box.classList.add('drag');
    try { box.setPointerCapture(e.pointerId); } catch (err) { /* синтетические события */ }
  });
  box.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx);
    spin.rotation.y += dx * .008; vel = dx * .008 * 60;
  });
  const up = () => {
    if (!dragging) return;
    dragging = false; box.classList.remove('drag'); idle = 0;
    if (moved < 4) { vel = 0; target = homeYaw; } // клик — вернуться к Ташкенту
  };
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', up);

  const resize = () => {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(box); resize();

  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(box);

  const v = new THREE.Vector3(), fwd = new THREE.Vector3(), up3 = new THREE.Vector3();
  const nearest = (a, b) => { let d = b - a; d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2; return a + d; };
  let ang = 0, last = 0, ready = false;

  function frame(t) {
    win.requestAnimationFrame(frame);
    if (!visible || doc.hidden) { last = 0; return; }
    const dt = Math.min(.05, last ? (t - last) / 1000 : .016); last = t;

    // вращение: к цели (Ташкент), инерция после броска, медленный автоповорот
    if (!dragging) {
      if (target !== null) {
        const goal = nearest(spin.rotation.y, target);
        spin.rotation.y += (goal - spin.rotation.y) * (1 - Math.exp(-dt * (reduced ? 60 : 2.2)));
        if (Math.abs(goal - spin.rotation.y) < .002) { target = null; idle = 0; }
      } else {
        vel *= Math.exp(-dt * 2.5);
        idle += dt;
        spin.rotation.y += (vel + (reduced ? 0 : .07 * Math.min(1, idle / 2))) * dt;
      }
    }

    // самолётик: по орбите, нос по касательной, крен внутрь
    if (!reduced) ang += dt * .32;
    v.set(Math.cos(ang) * R, 0, Math.sin(ang) * R).applyQuaternion(orbit);
    fwd.set(-Math.sin(ang), 0, Math.cos(ang)).applyQuaternion(orbit);
    up3.copy(v).normalize();
    plane.position.copy(v); plane.up.copy(up3); plane.lookAt(v.clone().add(fwd)); plane.rotateZ(-.22);
    shadow.position.copy(up3).multiplyScalar(1.05); shadow.lookAt(up3.clone().multiplyScalar(3));

    // кольцо у точки «дышит»
    const pulse = reduced ? .5 : (t / 1600) % 1;
    ring.scale.setScalar(1 + pulse * 1.6); ring.material.opacity = .6 * (1 - pulse);

    renderer.render(scene, camera);

    // подпись Tashkent: только когда точка на видимой стороне
    dot.getWorldPosition(v);
    const facing = v.clone().normalize().dot(camera.position.clone().normalize());
    v.project(camera);
    label.style.left = ((v.x + 1) / 2 * box.clientWidth).toFixed(1) + 'px';
    label.style.top = ((1 - v.y) / 2 * box.clientHeight).toFixed(1) + 'px';
    label.classList.toggle('on', facing > .25);

    if (!ready) { ready = true; fig.classList.add('ready'); }
  }
  win.requestAnimationFrame(frame);
}
