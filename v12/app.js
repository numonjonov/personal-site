/* v12 — по мотивам aboutluca.com. three.js r160 из vendor/, всё остальное своё.

   Сцена: процедурная пустыня из ~115 тыс. песчинок — матовые серые
   «пушинки» (каждая из четырёх мягких долей, своя раскладка), освещение по
   нормали рельефа без бликов; серый воздух, редкие звёзды, метеор с
   пунктирным хвостом, сфера-фонарик за курсором, тексты в пространстве.
   Камера едет по пути над дюнами, скролл виртуальный, с инерцией.

   Эффекты:
   - вход: песчинки поднимаются из-под рельефа с задержкой по расстоянию;
   - мышь: воронка в экранных координатах с рваным (шумовым) краем —
     песок расступается и подсвечивается фонариком;
   - часть песчинок еле заметно дрейфует, редкие пылинки поднимаются вверх;
   - близкие к камере частицы — крупное мягкое боке, дальние тонут в тумане;
   - тексты: расшифровка по символам (перебор глифов), дрожь срезов строк,
     RGB-расщепление, обратный глитч, когда камера проехала;
   - bloom: выделение ярких мест → размытие в двух масштабах → сложение,
     дымка над горизонтом и еле заметные вертикальные полосы в небе,
     плёночное зерно, мягкая виньетка, слабая аберрация от скорости. */
import * as THREE from '../vendor/three.module.min.js';

const doc = document, win = window, root = doc.documentElement;
const $ = id => doc.getElementById(id);
const reduced = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = win.matchMedia('(hover: none), (pointer: coarse)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function canWebGL() {
  try { const c = doc.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
}
if (canWebGL()) { root.classList.add('gl-on'); start().catch(err => { console.error(err); root.classList.remove('gl-on'); }); }

/* ================= Рельеф (JS: позиции и нормали песчинок) ================= */
const P = new Uint8Array(512);
{ let s = 1337; const p = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (a, b) => P[(P[a & 255] + b) & 255] / 255;
  const u = fade(xf), v = fade(yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
const fbm = (x, y) => vnoise(x, y) * .55 + vnoise(x * 2.1 + 7, y * 2.1) * .28 + vnoise(x * 4.3, y * 4.3 + 3) * .17;
const pathX = z => Math.sin(z * .035) * 5 + Math.sin(z * .011 + 1) * 4;
function terrain(x, z) {
  const warp = vnoise(x * .04 + 3, z * .04) * 6;
  const crest = 1 - Math.abs(Math.sin(x * .2 + z * .07 + warp));          // гребни дюн
  const dunes = Math.pow(crest, 2.4) * (1 + .7 * vnoise(x * .03, z * .03 + 9));
  const hills = vnoise(x * .018 - 4, z * .018) * 2.8;
  const detail = fbm(x * .12, z * .12) * .32;
  const dx = x - pathX(z), valley = Math.exp(-(dx * dx) / 60) * 1.3;    // ложбина под путём камеры
  return dunes * 2.5 + hills * 1.25 + detail - valley;
}

/* ================= Шейдеры ================= */
// Simplex 3D — Ian McEwan, Ashima Arts (MIT)
const SNOISE = `
vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0; vec4 s1 = floor(b1) * 2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

const SAND_VS = `
uniform float uTime, uSize, uPixel, uIntro, uAspect, uMouseR, uMouseF;
uniform vec2 uMouse;
uniform vec3 uCam;
attribute vec3 aNormal;
attribute float aRnd, aRnd2, aSize;
uniform vec3 uLightDir;
varying float vAlpha, vBlur, vLight, vDust, vGrey;
varying vec2 vRot;
varying vec4 vLA, vLB, vLR;
${SNOISE}
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec3 p = position;

  // intro: grains rise from under the dunes, near ones first
  float dCam = length(p.xz - uCam.xz);
  float delay = clamp(dCam / 70.0, 0.0, 1.0) * 0.5 + aRnd * 0.22;
  float mp = smoothstep(delay, delay + 0.28, uIntro);
  p.y -= (1.0 - mp) * (1.5 + aRnd2 * 3.5);

  // half of the grains drift a little
  if (aRnd2 > 0.5) {
    float t = uTime * 0.05 + aRnd * 10.0;
    p += vec3(snoise(vec3(p.xz * 0.3, t)), snoise(vec3(p.zx * 0.3, t + 10.0)), snoise(vec3(p.xz * 0.3 + 5.0, t + 20.0))) * mix(0.01, 0.05, aRnd);
  }
  // rare dust motes rise and fade
  float dust = step(0.9955, fract(aRnd * 91.7 + aRnd2 * 13.1));
  float ft = fract(uTime * mix(0.006, 0.016, aRnd) + aRnd2);
  p.y += dust * ft * mix(2.0, 6.0, aRnd2);
  vDust = dust * (1.0 - ft) * smoothstep(0.0, 0.08, ft);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / max(clip.w, 0.0001);

  // mouse: crater with a ragged edge
  vLight = 0.0;
  vec2 d = ndc - uMouse; d.x *= uAspect;
  if (length(d) < uMouseR * 1.8 && uMouseF > 0.001) {
    vec2 wd = d + vec2(snoise(vec3(ndc * 3.0, aRnd * 10.0)), snoise(vec3(ndc.yx * 4.5 + vec2(7.3, 1.9), aRnd2 * 10.0))) * 0.05;
    float r = uMouseR * (1.0 + 0.22 * snoise(vec3(ndc * 5.0, uTime * 0.25)));
    float inf = pow(1.0 - smoothstep(0.0, r, length(wd)), 1.35) * uMouseF;
    vec2 dir = normalize(wd + vec2(1e-4));
    float k = -mv.z;
    mv.xy += vec2(dir.x / uAspect, dir.y) * inf * 0.16 * k;   // push in screen plane
    mv.y += inf * 0.03 * k;
    mv.z -= inf * 0.6;                                         // and a little deeper
    vLight = inf;
  }
  gl_Position = projectionMatrix * mv;

  float dist = -mv.z;
  float nearB = 1.0 - smoothstep(0.7, 4.5, dist);              // bokeh near camera
  float size = uSize * aSize * uPixel / max(dist, 0.1);
  size *= 1.0 + nearB * 2.2 + vDust * 1.5;
  gl_PointSize = clamp(size, 1.0, 72.0);
  vBlur = nearB;

  // fog far away, fade at the lens, intro
  vAlpha = (1.0 - smoothstep(12.0, 50.0, dist)) * smoothstep(0.25, 0.9, dist) * mp;

  // the orb lights sand near the cursor
  vec2 sd = gl_Position.xy / gl_Position.w - uMouse; sd.x *= uAspect;
  vLight = max(vLight, exp(-dot(sd, sd) * 10.0) * uMouseF);

  // invisible grains (fog, behind the lens) cost no pixels at all
  if (vAlpha < 0.003) { gl_PointSize = 0.0; gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }

  // everything that is the same for every pixel of a grain is done here once:
  // matte grey light and the layout of the four soft lobes
  vec3 N = normalize(normalMatrix * aNormal), L = normalize(uLightDir);
  float diff = clamp((dot(N, L) + 0.4) / 1.4, 0.0, 1.0);
  vGrey = mix(0.56, 0.82, aRnd2) * (0.62 + 0.38 * diff);
  vRot = vec2(cos(aRnd * 6.2831853), sin(aRnd * 6.2831853));
  vLA = (vec4(hash12(vec2(aRnd * 53.0, 0.0)), hash12(vec2(aRnd2 * 71.0, 7.0)), hash12(vec2(aRnd * 53.0, 1.0)), hash12(vec2(aRnd2 * 71.0, 8.0))) - 0.5) * 0.2;
  vLB = (vec4(hash12(vec2(aRnd * 53.0, 2.0)), hash12(vec2(aRnd2 * 71.0, 9.0)), hash12(vec2(aRnd * 53.0, 3.0)), hash12(vec2(aRnd2 * 71.0, 10.0))) - 0.5) * 0.2;
  vec4 r = mix(vec4(0.1), vec4(0.17), vec4(hash12(vec2(0.0, aRnd * 13.0)), hash12(vec2(3.1, aRnd * 13.0)), hash12(vec2(6.2, aRnd * 13.0)), hash12(vec2(9.3, aRnd * 13.0))));
  vLR = 1.0 / (r * r);
}`;

const SAND_FS = `
uniform float uExposure;
varying float vAlpha, vBlur, vLight, vDust, vGrey;
varying vec2 vRot;
varying vec4 vLA, vLB, vLR;
void main() {
  // fluffy grain: a clump of 4 soft lobes (layout comes from the vertex shader),
  // plus a faint halo; near the lens it melts into a flat soft disc
  vec2 pc = gl_PointCoord - 0.5;
  vec2 pp = vec2(vRot.x * pc.x - vRot.y * pc.y, vRot.y * pc.x + vRot.x * pc.y);
  float d2 = dot(pp, pp);
  float a;
  if (vBlur > 0.98) {
    a = (1.0 - smoothstep(0.18, 0.5, sqrt(d2))) * 0.42;
  } else {
    vec2 q0 = pp - vLA.xy, q1 = pp - vLA.zw, q2 = pp - vLB.xy, q3 = pp - vLB.zw;
    vec4 e = exp(-vec4(dot(q0, q0), dot(q1, q1), dot(q2, q2), dot(q3, q3)) * vLR);
    float lobes = max(max(e.x, e.y), max(e.z, e.w));
    float halo = exp(-d2 * 16.0) * 0.32;
    a = max(lobes, halo) * (1.0 - smoothstep(0.16, 0.25, d2));
    a = mix(a, (1.0 - smoothstep(0.18, 0.5, sqrt(d2))) * 0.42, vBlur);
  }
  if (a * vAlpha < 0.01) discard;

  vec3 col = vec3(vGrey, vGrey * 0.995, vGrey * 0.985);
  col += vLight * 0.7;
  col += vDust * 0.35;
  gl_FragColor = vec4(col * uExposure, a * vAlpha * 0.9 * (1.0 - 0.45 * vBlur));
}`;

const STAR_VS = `
uniform float uTime, uPixel, uIntro;
attribute float aRnd;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.55 + 0.45 * sin(uTime * (0.6 + aRnd * 2.2) + aRnd * 40.0);
  gl_PointSize = clamp((1.0 + aRnd * 1.6) * uPixel / 900.0, 1.0, 4.0);
  vA = tw * (0.12 + aRnd * 0.3) * smoothstep(0.3, 1.0, uIntro);
}`;
const STAR_FS = `
varying float vA;
void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(0.95), vA * (1.0 - d * 2.0)); }`;

// meteor: a head and a dotted tail; aT = 0 at the head, 1 at the end of the tail
const MET_VS = `
uniform float uPixel;
attribute float aT, aVis;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float head = 1.0 - smoothstep(0.0, 0.05, aT);
  gl_PointSize = clamp((mix(2.6, 1.1, aT) + head * 3.5) * uPixel / 700.0, 1.0, 9.0);
  vA = aVis * pow(1.0 - aT, 1.6) * (0.5 + head * 0.5);
}`;
const MET_FS = `
varying float vA;
void main() { vec2 p = gl_PointCoord - 0.5; float a = exp(-dot(p, p) * 18.0) * vA; if (a < 0.004) discard; gl_FragColor = vec4(vec3(0.93), a); }`;

const TEXT_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const TEXT_FS = `
uniform sampler2D uTex;
uniform float uReveal, uTime, uBright, uVis;
uniform vec2 uGrid;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 g = vec2(vUv.x, 1.0 - vUv.y) * uGrid;      // glyph grid
  vec2 cell = floor(g);
  float order = (cell.x / uGrid.x) * 0.72 + (cell.y / max(uGrid.y, 1.0)) * 0.12 + hash(cell) * 0.26;
  float t = uReveal * 1.38 - order;              // <0 hidden, 0..0.16 decoding, >0.16 settled
  float alive = (1.0 - smoothstep(0.9, 1.0, uReveal)) * step(0.001, uReveal);
  float tick = floor(uTime * 20.0);
  vec2 uv = vUv;

  // row slice jitter while alive
  float band = floor(vUv.y * uGrid.y * 3.0);
  uv.x += (hash(vec2(band, tick)) - 0.5) * 0.05 * alive * step(0.72, hash(vec2(band, tick + 3.0)));

  // decoding: borrow a glyph from a random cell
  float decoding = step(0.0, t) * (1.0 - step(0.16, t));
  if (decoding > 0.5) {
    vec2 rc = floor(vec2(hash(cell + tick), hash(cell.yx + tick * 1.7)) * uGrid);
    vec2 gg = (rc + fract(g)) / uGrid;
    uv = vec2(gg.x, 1.0 - gg.y);
  }
  float off = 0.0035 * (alive + decoding);
  float r = texture2D(uTex, uv + vec2(off, 0.0)).a;
  float gc = texture2D(uTex, uv).a;
  float b = texture2D(uTex, uv - vec2(off, 0.0)).a;
  float a = max(max(r, gc), b) * step(0.0, t);
  a *= mix(1.0, 0.35 + 0.65 * hash(cell + tick * 3.1), decoding);
  // soft dark halo around the glyphs: 12 taps of alpha about one cell wide,
  // so the line stays readable over bright dunes (premultiplied output)
  vec2 cs = 1.0 / uGrid;
  float halo = 0.0;
  for (int i = 0; i < 12; i++) {
    float an = float(i) * 0.5236;
    vec2 o = vec2(cos(an), sin(an)) * cs * vec2(0.9, 0.7);
    halo += texture2D(uTex, vUv + o).a + texture2D(uTex, vUv + o * 0.45).a;
  }
  halo = smoothstep(0.0, 0.3, halo / 24.0) * 0.62 * smoothstep(0.0, 0.5, uReveal);
  vec3 col = vec3(r, gc, b) * uBright;
  gl_FragColor = vec4(col * a, a + halo * (1.0 - a)) * uVis;   // uVis: gone before the camera reaches the plane
}`;

const ORB_FS = `
varying vec2 vUv; uniform float uI;
void main() {
  float d = length(vUv - 0.5);
  float core = exp(-d * d * 900.0), glow = exp(-d * d * 60.0) * 0.35;
  gl_FragColor = vec4(vec3(1.0, 0.98, 0.95) * (core * 3.0 + glow), (core + glow) * uI);
}`;

/* постобработка */
const FS_TRI = `varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BRIGHT_FS = `
uniform sampler2D tSrc; uniform float uTh; varying vec2 vUv;
void main() { vec3 c = texture2D(tSrc, vUv).rgb; float l = dot(c, vec3(0.299, 0.587, 0.114)); gl_FragColor = vec4(c * smoothstep(uTh, uTh + 0.35, l), 1.0); }`;
const BLUR_FS = `
uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
  c += texture2D(tSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;
const COMP_FS = `
uniform sampler2D tScene, tB1, tB2; uniform float uBloom, uTime, uCA, uFade; uniform vec2 uRes;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float h1(float x){ return fract(sin(x * 127.1) * 43758.5453); }
float vn1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
void main() {
  vec2 c = vUv - 0.5; float r2 = dot(c, c);
  vec2 ca = c * r2 * uCA;
  vec3 s = vec3(texture2D(tScene, vUv + ca).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv - ca).b);
  vec3 bl = texture2D(tB1, vUv).rgb * 0.7 + texture2D(tB2, vUv).rgb * 1.2;
  // atmosphere: matte grey, the air is lighter towards the middle of the frame
  // and in a soft band over the horizon; faint vertical streaks hang in the sky
  float hz = 1.0 - smoothstep(0.0, 0.3, abs(vUv.y - 0.5));
  vec3 bg = mix(vec3(0.088), vec3(0.106), smoothstep(0.0, 1.0, vUv.y)) + hz * 0.022;
  bg += exp(-dot(c * vec2(1.3, 2.2), c * vec2(1.3, 2.2)) * 5.0) * 0.024;
  float aspect = uRes.x / uRes.y;
  float streak = vn1(vUv.x * aspect * 14.0 + 3.0) * 0.6 + vn1(vUv.x * aspect * 41.0 + uTime * 0.03) * 0.4;
  bg += (streak - 0.5) * 0.014 * smoothstep(0.25, 0.95, vUv.y);
  // the sand is added on top of the air, so far grains sink into the haze
  vec3 col = bg + s * 0.92 + bl * uBloom;
  col *= 1.0 - r2 * 0.5;                                      // vignette
  col += (hash(vUv * uRes + fract(uTime) * 100.0) - 0.5) * 0.032;   // grain
  gl_FragColor = vec4(mix(vec3(0.0824), col, uFade), 1.0);
}`;

/* ================= Тексты ================= */
const CHAPTERS = [
  { t: .025, label: 'intro', head: 'SCROLL TO EXPLORE', side: 0 },
  { t: .17, label: 'about', head: 'BACKEND', side: -1,
    lines: ["I don't build websites.", 'I build the layer underneath.', 'Services that talk to a core', 'banking system on Oracle —', 'and keep talking at 3 a.m.'] },
  { t: .37, label: 'work', head: 'WORK', side: 1,
    lines: ['01  uz-status     uptime for Uzbekistan', '02  exchange      zero dependencies', '03  tgagent       gemini → groq fallback', '04  tekstlybot    speech-to-text in 256 MB', '05  plusline      bots that take payments', '06  downloader    send a link, get the file', '07  myid · e-key  bank integrations'] },
  { t: .57, label: 'stack', head: 'STACK', side: -1,
    lines: ['java 21/17 · spring boot · security', 'oracle · pl/sql · postgresql · sqlite', 'python 3.11 · docker · linux · systemd', 'prometheus · caddy · github actions'] },
  { t: .76, label: 'log', head: 'TASHKENT', side: 1,
    lines: ['2025 — present', 'backend engineer at a commercial bank', 'iABS · MyID · e-key / DVS on WebLogic', 'PL/SQL where the logic belongs'] },
  { t: .94, label: 'contact', head: "LET'S TALK", side: 0 },
];

function textCanvas(lines, font, size, cellW, lineH, padX = 20, padY = 16) {
  const cols = Math.max(...lines.map(l => [...l].length));
  const c = doc.createElement('canvas');
  c.width = Math.ceil(cols * cellW + padX * 2); c.height = Math.ceil(lines.length * lineH + padY * 2);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.font = `${font}`; g.textBaseline = 'middle'; g.textAlign = 'center';
  lines.forEach((l, r) => [...l].forEach((ch, i) => g.fillText(ch, padX + (i + .5) * cellW, padY + (r + .5) * lineH)));
  return { canvas: c, cols, rows: lines.length, padX, padY, cellW, lineH };
}

/* ================= Запуск ================= */
async function start() {
  const gate = $('gate'), gateBtn = $('gate-btn'), gl = $('gate-l'), gr = $('gate-r');
  const setLoad = p => { gl.style.width = gr.style.width = (p * 28) + 'vw'; };
  setLoad(.05);

  if (doc.fonts && doc.fonts.load) {
    await Promise.race([
      Promise.all(['italic 600 120px "Chakra Petch"', '400 40px "IBM Plex Mono"'].map(f => doc.fonts.load(f))),
      new Promise(r => win.setTimeout(r, 3000)),
    ]).catch(() => {});
  }
  setLoad(.3);
  await new Promise(r => win.setTimeout(r, 30));

  const canvas = $('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const dpr = Math.min(win.devicePixelRatio || 1, coarse ? 1.25 : 1.6);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, win.innerWidth / win.innerHeight, .05, 200);

  /* ---- путь камеры ---- */
  const pts = [];
  for (let z = 10; z >= -122; z -= 5.5) {
    const x = pathX(z);
    let hmax = -1e9;
    for (let ox = -3; ox <= 3; ox += 1) for (let oz = -6; oz <= 6; oz += 1) hmax = Math.max(hmax, terrain(x + ox, z + oz));
    pts.push(new THREE.Vector3(x, hmax + 1.2, z));
  }
  // высоты сглаживаются только вверх: ложбины между дюнами заполняются, вершины
  // скругляются за счёт соседей. Иначе камера ныряет в ложбину и взгляд
  // дёргается на ±25° за пару шагов скролла (так было между LOG и LET'S TALK)
  const raw = pts.map(p => p.y), ys = raw.slice();
  for (let it = 0; it < 24; it++) {
    for (let i = 1; i < ys.length - 1; i++) ys[i] = Math.max(raw[i], ys[i], (ys[i - 1] + ys[i] * 2 + ys[i + 1]) / 4);
  }
  pts.forEach((p, i) => { p.y = ys[i]; });
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  // кадр камеры в точке пути t: позиция над песком с запасом + точка взгляда
  const probe = new THREE.Vector3();
  const curveLen = curve.getLength();
  function camAt(t, pos, lk) {
    // весь скролл 0…1 растянут на путь 0…0.985 — без упора: раньше камера
    // на скорости врезалась в clamp(.985) и вставала за один кадр (рывок в
    // конце перехода к LET'S TALK)
    t = clamp(t, 0, 1) * .985;
    curve.getPointAt(t, pos);
    // точка взгляда за концом пути продлевается по касательной, а не упирается
    const ta = t + .03;
    if (ta <= 1) curve.getPointAt(ta, lk);
    else { curve.getPointAt(1, lk); curve.getTangentAt(1, probe); lk.addScaledVector(probe, (ta - 1) * curveLen); }
    // Покадровой «страховки над песком» больше нет: пробы рельефа попадали на
    // острые гребни, и высота на отдельных кадрах подскакивала на 2–9 см, а
    // взгляд — на 1–1.4° (мелкая тряска). Запас высоты заложен в сам путь
    // (hmax вокруг точки + сглаживание вверх); проверка — выборкой __v12.camAt (CLAUDE.md).
    // наклон взгляда держим в пределах −9°…+3°: камера плывёт, а не кивает
    const h = Math.hypot(lk.x - pos.x, lk.z - pos.z);
    lk.y = pos.y + clamp(lk.y - pos.y, -.16 * h, .05 * h) - .12;
  }

  /* ---- песок ---- */
  const N = coarse ? 55000 : 115000;
  const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), r1 = new Float32Array(N), r2 = new Float32Array(N), sz = new Float32Array(N);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N; i++) {
    const z = 14 - rnd() * 158;
    const u = rnd() * 2 - 1;
    const x = pathX(z) + Math.sign(u) * Math.pow(Math.abs(u), 1.2) * 34;
    const y = terrain(x, z);
    const e = .15, hx = terrain(x + e, z) - terrain(x - e, z), hz = terrain(x, z + e) - terrain(x, z - e);
    const nx = -hx, ny = 2 * e, nz = -hz, nl = Math.hypot(nx, ny, nz);
    pos.set([x, y, z], i * 3); nor.set([nx / nl, ny / nl, nz / nl], i * 3);
    r1[i] = rnd(); r2[i] = rnd();
    sz[i] = rnd() < .03 ? 1.8 + rnd() * 1.4 : .55 + rnd() * .9;
    if ((i & 16383) === 0) { setLoad(.3 + .5 * i / N); await new Promise(r => win.setTimeout(r, 0)); }
  }
  const sandGeo = new THREE.BufferGeometry();
  sandGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sandGeo.setAttribute('aNormal', new THREE.BufferAttribute(nor, 3));
  sandGeo.setAttribute('aRnd', new THREE.BufferAttribute(r1, 1));
  sandGeo.setAttribute('aRnd2', new THREE.BufferAttribute(r2, 1));
  sandGeo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  const mouseNdc = new THREE.Vector2(0, 0);
  const sandU = {
    uTime: { value: 0 }, uSize: { value: .12 }, uPixel: { value: 1 }, uIntro: { value: reduced ? 1 : 0 },
    uAspect: { value: 1 }, uMouse: { value: mouseNdc }, uMouseR: { value: .2 }, uMouseF: { value: 0 },
    uCam: { value: new THREE.Vector3() }, uLightDir: { value: new THREE.Vector3(.55, .7, .15).normalize() }, uExposure: { value: .6 },
  };
  const sand = new THREE.Points(sandGeo, new THREE.ShaderMaterial({
    vertexShader: SAND_VS, fragmentShader: SAND_FS, uniforms: sandU,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  }));
  sand.frustumCulled = false;
  if (location.hostname === "localhost") win.__v12 = { sandU, met: () => met, camAt, terrain, curve };
  scene.add(sand);

  /* ---- звёзды ---- */
  const SN = 420, sp = new Float32Array(SN * 3), sr = new Float32Array(SN);
  for (let i = 0; i < SN; i++) {
    const th = rnd() * Math.PI * 2, ph = rnd() * .45 + .05, R = 90;
    sp.set([Math.cos(th) * Math.cos(ph) * R, Math.sin(ph) * R + 4, Math.sin(th) * Math.cos(ph) * R - 55], i * 3);
    sr[i] = rnd();
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  starGeo.setAttribute('aRnd', new THREE.BufferAttribute(sr, 1));
  const starU = { uTime: sandU.uTime, uPixel: sandU.uPixel, uIntro: sandU.uIntro };
  scene.add(new THREE.Points(starGeo, new THREE.ShaderMaterial({ vertexShader: STAR_VS, fragmentShader: STAR_FS, uniforms: starU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));

  /* ---- метеор: раз в 6–14 с через небо, пунктирный хвост ---- */
  const MN = 56, mPos = new Float32Array(MN * 3), mT = new Float32Array(MN), mVis = new Float32Array(MN);
  for (let i = 0; i < MN; i++) mT[i] = i / (MN - 1);
  const metGeo = new THREE.BufferGeometry();
  metGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3).setUsage(THREE.DynamicDrawUsage));
  metGeo.setAttribute('aT', new THREE.BufferAttribute(mT, 1));
  metGeo.setAttribute('aVis', new THREE.BufferAttribute(mVis, 1).setUsage(THREE.DynamicDrawUsage));
  const meteor = new THREE.Points(metGeo, new THREE.ShaderMaterial({ vertexShader: MET_VS, fragmentShader: MET_FS, uniforms: { uPixel: sandU.uPixel }, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  meteor.frustumCulled = false; scene.add(meteor);
  const met = { start: 5, dur: 1.5, x0: 0, y0: 0, vx: 0, vy: 0 };
  const mO = new THREE.Vector3(), mR = new THREE.Vector3(), mU = new THREE.Vector3(), mF = new THREE.Vector3();
  function stepMeteor(time, fade) {
    let tau = time - met.start;
    if (tau > met.dur + .8) {                       // новый пролёт
      met.start = time + 6 + Math.random() * 8; met.dur = 1.2 + Math.random() * .8;
      const s = Math.random() < .5 ? -1 : 1;
      met.x0 = s * (16 + Math.random() * 22); met.y0 = 15 + Math.random() * 9;
      met.vx = -s * (22 + Math.random() * 12); met.vy = -(2 + Math.random() * 4);
      tau = time - met.start;
    }
    // дуга в плоскости на 60 м перед камерой, по её горизонту
    const e = camera.matrixWorld.elements;
    mR.set(e[0], 0, e[2]).normalize(); mF.set(-e[8], 0, -e[10]).normalize(); mU.set(0, 1, 0);
    mO.copy(camera.position).addScaledVector(mF, 60);
    for (let i = 0; i < MN; i++) {
      const ti = clamp(tau - mT[i] * .55, 0, met.dur);
      const x = met.x0 + met.vx * ti, y = met.y0 + met.vy * ti - 1.6 * ti * ti;
      mPos[i * 3] = mO.x + mR.x * x; mPos[i * 3 + 1] = mO.y + y; mPos[i * 3 + 2] = mO.z + mR.z * x;
      const alive = tau - mT[i] * .55 > 0 && tau - mT[i] * .55 < met.dur;
      mVis[i] = alive ? fade * smooth(0, .25, tau) * (1 - smooth(met.dur - .35, met.dur, tau - mT[i] * .55)) : 0;
    }
    metGeo.attributes.position.needsUpdate = true; metGeo.attributes.aVis.needsUpdate = true;
  }

  /* ---- фонарик ---- */
  const orbU = { uI: { value: 0 } };
  const orb = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ vertexShader: TEXT_VS, fragmentShader: ORB_FS, uniforms: orbU, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  orb.scale.setScalar(.9); orb.renderOrder = 5; scene.add(orb);

  /* ---- тексты ---- */
  setLoad(.85);
  const texts = [];
  // текст ставится в кадр камеры в момент чтения (t): на расстоянии dist перед ней,
  // со сдвигом вбок и вверх, лицом к камере и с лёгким разворотом — как вывеска в пустыне
  const cPos = new THREE.Vector3(), cLook = new THREE.Vector3(), frameObj = new THREE.PerspectiveCamera(); // камера: lookAt смотрит по -Z, как у настоящей
  // blk — ширина всего блока главы (заголовок + абзац), shift — сдвиг блока вбок,
  // align — место надписи внутри блока. На узком экране блок уходит к центру и
  // уменьшается, пока не влезет в горизонтальный угол обзора (placeTexts).
  const mkText = (tc, worldW, bright, at, dist, shift, align, up, tilt, blk) => {
    const tex = new THREE.CanvasTexture(tc.canvas);
    tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const w = worldW, h = worldW * tc.canvas.height / tc.canvas.width;
    const u = { uTex: { value: tex }, uReveal: { value: 0 }, uTime: sandU.uTime, uBright: { value: bright }, uVis: { value: 1 },
      uGrid: { value: new THREE.Vector2(tc.canvas.width / tc.cellW, tc.canvas.height / tc.lineH) } };
    // premultiplied: цвет букв плюс тёмный ореол, который приглушает песок за строкой
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({ vertexShader: TEXT_VS, fragmentShader: TEXT_FS, uniforms: u, transparent: true, depthWrite: false, depthTest: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor }));
    m.renderOrder = 4;
    scene.add(m);
    // базис настоящей камеры в точке чтения (с наклоном вниз): надпись стоит
    // в одном и том же месте кадра, как бы ни шёл рельеф
    camAt(at, cPos, cLook);
    frameObj.position.copy(cPos); frameObj.lookAt(cLook); frameObj.updateMatrixWorld();
    const e = frameObj.matrixWorld.elements;
    return { mesh: m, u, at, dist, shift, align, up, tilt, blk, o: cPos.clone(), q: frameObj.quaternion.clone(),
      r: new THREE.Vector3(e[0], e[1], e[2]), v: new THREE.Vector3(e[4], e[5], e[6]), f: new THREE.Vector3(-e[8], -e[9], -e[10]) };
  };
  const placeTexts = aspect => {
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * aspect;  // полуширина кадра на 1 м дальности
    const wide = clamp((aspect - .7) / .6, 0, 1);                                // 0 — телефон, 1 — десктоп
    texts.forEach(x => {
      const s = Math.min(1, half * x.dist * 2 * .88 / x.blk);
      x.mesh.scale.setScalar(s);
      x.mesh.position.copy(x.o).addScaledVector(x.f, x.dist)
        .addScaledVector(x.r, x.shift * wide + x.align * s).addScaledVector(x.v, x.up * s);
      x.mesh.quaternion.copy(x.q);
      x.mesh.rotateY(x.tilt * wide);
    });
  };
  CHAPTERS.forEach(ch => {
    const hc = textCanvas([ch.head], 'italic 600 120px "Chakra Petch", sans-serif', 120, 104, 150, 104, 150);
    const headW = Math.max(2.4, ch.head.length * .46);
    const sx = ch.side * 1.7;
    let lw = 0, lc = null;
    if (ch.lines) {
      lc = textCanvas(ch.lines, '400 40px "IBM Plex Mono", monospace', 40, 24.2, 58, 24.2, 58);
      lw = Math.max(...ch.lines.map(l => l.length)) * .1;
    }
    const blk = Math.max(headW, lw) + .5;
    texts.push(mkText(hc, headW, 1.25, ch.t, 9, sx, -ch.side * .3, ch.lines ? 1.05 : .55, ch.side * -.2, blk));
    if (lc) texts.push(mkText(lc, lw, 1, ch.t + .004, 8.4, sx, ch.side * (lw / 2 - headW / 2) * .5, -.05, ch.side * -.28, blk));
  });
  if (win.__v12) Object.assign(win.__v12, { texts, camera, renderer, scene, getCur: () => cur });

  /* ---- постобработка ---- */
  const half = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const rtOpts = { type: half, depthBuffer: false, stencilBuffer: false };
  const rtScene = new THREE.WebGLRenderTarget(1, 1, { ...rtOpts, depthBuffer: true });
  const rtBright = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  const rtA = new THREE.WebGLRenderTarget(1, 1, rtOpts), rtB = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  const rtC = new THREE.WebGLRenderTarget(1, 1, rtOpts), rtD = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const postScene = new THREE.Scene(), postCam = new THREE.Camera();
  const quad = new THREE.Mesh(tri); quad.frustumCulled = false; postScene.add(quad);
  const brightM = new THREE.ShaderMaterial({ vertexShader: FS_TRI, fragmentShader: BRIGHT_FS, uniforms: { tSrc: { value: null }, uTh: { value: .26 } }, depthTest: false });
  const blurM = new THREE.ShaderMaterial({ vertexShader: FS_TRI, fragmentShader: BLUR_FS, uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }, depthTest: false });
  const compM = new THREE.ShaderMaterial({ vertexShader: FS_TRI, fragmentShader: COMP_FS, depthTest: false,
    uniforms: { tScene: { value: rtScene.texture }, tB1: { value: rtA.texture }, tB2: { value: rtC.texture }, uBloom: { value: 1.1 }, uTime: { value: 0 }, uCA: { value: .02 }, uFade: { value: reduced ? 1 : 0 }, uRes: { value: new THREE.Vector2() } } });
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(postScene, postCam); };

  function resize() {
    const w = win.innerWidth, h = win.innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const W = Math.floor(w * dpr), H = Math.floor(h * dpr);
    rtScene.setSize(W, H); rtBright.setSize(W >> 1, H >> 1);
    rtA.setSize(W >> 2, H >> 2); rtB.setSize(W >> 2, H >> 2);
    rtC.setSize(W >> 3, H >> 3); rtD.setSize(W >> 3, H >> 3);
    sandU.uPixel.value = H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    sandU.uAspect.value = w / h;
    compM.uniforms.uRes.value.set(W, H);
    placeTexts(w / h);
  }
  resize();
  win.addEventListener('resize', resize);
  // всё, что нужно видеокарте, — заранее: текстуры глав и шейдеры. Иначе каждая
  // глава грузит свою текстуру в момент появления, и переход между главами
  // дёргается (5–16 мс на кадр — как раз перед LET'S TALK)
  texts.forEach(x => renderer.initTexture(x.u.uTex.value));
  renderer.compile(scene, camera);

  /* ---- ввод: виртуальный скролл с инерцией, мышь ---- */
  let target = 0, cur = 0, vel = 0, entered = false;
  const addScroll = d => { if (entered) target = clamp(target + d, 0, 1); };
  win.addEventListener('wheel', e => { e.preventDefault(); addScroll(e.deltaY * (e.deltaMode === 1 ? 30 : 1) * .00011); }, { passive: false });
  let ty = null;
  win.addEventListener('touchstart', e => { ty = e.touches[0].clientY; }, { passive: true });
  win.addEventListener('touchmove', e => { if (ty === null) return; const y = e.touches[0].clientY; addScroll((ty - y) * .0004); ty = y; }, { passive: true });
  win.addEventListener('touchend', () => { ty = null; });
  doc.addEventListener('keydown', e => {
    if (!entered) { if (e.key === 'Enter' && !gateBtn.disabled) enter(); return; }
    if (root.classList.contains('text-mode')) return;
    const k = { ArrowDown: .03, PageDown: .08, ' ': .08, ArrowUp: -.03, PageUp: -.08 }[e.key];
    if (k) { e.preventDefault(); addScroll(k); }
    if (e.key === 'Home') target = 0;
    if (e.key === 'End') target = 1;
  });
  const mouseT = new THREE.Vector2(0, 0); let mouseOn = 0, mouseAt = 0;
  win.addEventListener('pointermove', e => {
    mouseT.set(e.clientX / win.innerWidth * 2 - 1, -(e.clientY / win.innerHeight) * 2 + 1);
    mouseAt = performance.now();
  }, { passive: true });

  /* ---- интерфейс ---- */
  const ruler = $('ruler'), fill = $('ruler-fill'), outro = $('outro'), wavePath = $('wave-path');
  CHAPTERS.forEach((ch, i) => {
    const b = doc.createElement('button'); b.type = 'button';
    b.innerHTML = `<span>${ch.label}</span>${String(i + 1).padStart(2, '0')}`;
    b.style.position = 'absolute'; b.style.right = '0'; b.style.top = `calc(${(ch.t / .96 * 100).toFixed(1)}% - 7px)`;
    b.addEventListener('click', () => { target = i === CHAPTERS.length - 1 ? 1 : clamp(ch.t - .006, 0, 1); });
    ruler.appendChild(b); ch.btn = b;
  });
  $('talk').addEventListener('click', () => { target = 1; });
  $('home').addEventListener('click', e => { e.preventDefault(); target = 0; });
  $('text-link').addEventListener('click', e => { e.preventDefault(); root.classList.add('text-mode'); win.scrollTo(0, 0); });
  $('text-back').addEventListener('click', e => { e.preventDefault(); root.classList.remove('text-mode'); });

  /* ---- вход ---- */
  setLoad(1);
  gateBtn.textContent = 'ENTER'; gateBtn.disabled = false; gateBtn.classList.add('ready');
  let introStart = -1;
  function enter() {
    if (entered) return;
    entered = true; introStart = performance.now();
    gate.classList.add('out'); root.classList.add('entered');
  }
  gateBtn.addEventListener('click', enter);

  /* ---- кадр ---- */
  const camPos = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3(), ray = new THREE.Vector3(), camFwd = new THREE.Vector3(), tmpV = new THREE.Vector3();
  let last = 0, time = 0, wavePh = 0;
  function frame(t) {
    win.requestAnimationFrame(frame);
    if (doc.hidden || root.classList.contains('text-mode')) { last = 0; return; }
    const dt = Math.min(.05, last ? (t - last) / 1000 : .016); last = t; time += dt;

    // скролл с инерцией — критически демпфированная пружина, а не простое
    // догоняние: у догоняния скорость скачет на каждом щелчке колеса, и полёт
    // идёт толчками (особенно заметно на длинном пустом участке LOG → LET'S TALK).
    // У пружины скорость непрерывна; шаг дробится до 1/120 с для устойчивости.
    if (reduced) { cur = target; vel = 0; }
    else {
      const W = 4.2;
      for (let left = dt; left > 1e-6; left -= 1 / 120) {
        const h = Math.min(left, 1 / 120);
        vel += (W * W * (target - cur) - 2 * W * vel) * h;
        cur += vel * h;
      }
      if (Math.abs(target - cur) < 1e-5 && Math.abs(vel) < 1e-5) { cur = target; vel = 0; }
    }

    // вход: песок поднимается, камера опускается, сцена проявляется
    const intro = introStart < 0 ? 0 : (reduced ? 1 : clamp((t - introStart) / 3600, 0, 1));
    const ie = 1 - Math.pow(1 - intro, 3);
    sandU.uIntro.value = reduced ? 1 : Math.min(1, intro * 1.15);
    compM.uniforms.uFade.value = reduced ? 1 : smooth(0, .35, intro);

    // камера по пути + взгляд вперёд + лёгкий параллакс от мыши
    const ct = clamp(cur, 0, 1);
    camAt(ct, camPos, look);
    camPos.y += (1 - ie) * 3.2;
    camera.position.copy(camPos);
    camera.lookAt(look);
    mouseNdc.lerp(mouseT, 1 - Math.exp(-dt * 7));
    camera.rotateY(-mouseNdc.x * .06); camera.rotateX(mouseNdc.y * .035);
    sandU.uCam.value.copy(camPos);

    // фонарик: точка на луче курсора, в 5 единицах от камеры
    const active = performance.now() - mouseAt < 2500 && !coarse;
    mouseOn += ((active && entered ? 1 : 0) - mouseOn) * (1 - Math.exp(-dt * 3));
    camera.updateMatrixWorld();
    ray.set(mouseNdc.x, mouseNdc.y, .5).unproject(camera).sub(camera.position).normalize();
    orb.position.copy(camera.position).addScaledVector(ray, 5);
    orb.quaternion.copy(camera.quaternion);
    orbU.uI.value = mouseOn * ie;
    sandU.uMouseF.value = mouseOn * ie;
    sandU.uTime.value = time;
    if (!reduced) stepMeteor(time, ie);

    // тексты: проявляются на подлёте, глитчем уходят, когда проехали
    // при быстром скролле глитч не успевает отыграть, поэтому надпись ещё и гаснет
    // по глубине: к 5 м перед камерой её уже нет, сквозь буквы камера не пролетает
    const ce = camera.matrixWorld.elements;
    camFwd.set(-ce[8], -ce[9], -ce[10]);
    texts.forEach(x => {
      const d = x.at - cur;
      const want = (d < .065 && d > -.03 && intro > .35) ? 1 : 0;
      const u = x.u.uReveal;
      u.value = reduced ? want : clamp(u.value + Math.sign(want - u.value) * dt * (want ? .85 : 1.4), 0, 1);
      const depth = tmpV.copy(x.mesh.position).sub(camera.position).dot(camFwd);
      x.u.uVis.value = smooth(5, 7.4, depth);
      x.mesh.visible = u.value > 0 && depth > 5;
    });

    // постобработка: сцена → яркое → размытие ×2 масштаба → сложение
    const speed = Math.min(1, Math.abs(vel) * 6);
    compM.uniforms.uCA.value = .003 + speed * .05;
    compM.uniforms.uBloom.value = .85 + speed * .3;
    compM.uniforms.uTime.value = time;
    renderer.setRenderTarget(rtScene); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
    brightM.uniforms.tSrc.value = rtScene.texture; pass(brightM, rtBright);
    blurM.uniforms.tSrc.value = rtBright.texture; blurM.uniforms.uDir.value.set(1 / rtA.width, 0); pass(blurM, rtA);
    blurM.uniforms.tSrc.value = rtA.texture; blurM.uniforms.uDir.value.set(0, 1 / rtA.height); pass(blurM, rtB);
    blurM.uniforms.tSrc.value = rtB.texture; blurM.uniforms.uDir.value.set(2 / rtA.width, 0); pass(blurM, rtA);
    blurM.uniforms.tSrc.value = rtA.texture; blurM.uniforms.uDir.value.set(0, 2 / rtA.height); pass(blurM, rtB);
    blurM.uniforms.tSrc.value = rtB.texture; blurM.uniforms.uDir.value.set(1 / rtC.width, 0); pass(blurM, rtC);
    blurM.uniforms.tSrc.value = rtC.texture; blurM.uniforms.uDir.value.set(0, 1 / rtC.height); pass(blurM, rtD);
    blurM.uniforms.tSrc.value = rtD.texture; blurM.uniforms.uDir.value.set(2 / rtC.width, 0); pass(blurM, rtC);
    blurM.uniforms.tSrc.value = rtC.texture; blurM.uniforms.uDir.value.set(0, 2 / rtC.height); pass(blurM, rtD);
    compM.uniforms.tB1.value = rtB.texture; compM.uniforms.tB2.value = rtD.texture;
    pass(compM, null);

    // интерфейс: шкала, финальная панель, «волна» от скорости
    fill.style.height = (clamp(cur / .96, 0, 1) * 100).toFixed(2) + '%';
    let on = 0; CHAPTERS.forEach((ch, i) => { if (cur >= ch.t - .04) on = i; });
    CHAPTERS.forEach((ch, i) => ch.btn.classList.toggle('on', i === on));
    const showOutro = cur > .955;
    if (outro.hidden === showOutro) outro.hidden = !showOutro;
    wavePh += dt * (2 + speed * 10);
    const amp = 1.2 + speed * 4.5;
    wavePath.setAttribute('d', `M1 6 Q 6.5 ${(6 - Math.sin(wavePh) * amp).toFixed(2)} 12 6 T 23 6`);
  }
  win.requestAnimationFrame(frame);
}
