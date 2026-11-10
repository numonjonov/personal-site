/* v5 — линза за курсором, появление по скроллу, подсветка активного пункта.
   Всё движение выключается при prefers-reduced-motion. */
(function () {
  'use strict';
  const doc = document, win = window;
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  doc.documentElement.classList.add('js');

  /* ---------- Появление ---------- */
  const items = Array.from(doc.querySelectorAll('.reveal, .sec'));
  const showAll = () => items.forEach(el => el.classList.add('in'));
  if (reduced.matches || !('IntersectionObserver' in win)) showAll();
  else {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: .08, rootMargin: '0px 0px -5% 0px' });
    items.forEach(el => io.observe(el));
    win.setTimeout(showAll, 2500); // страховка: если наблюдатель не сработал, страница всё равно видна
  }

  /* ---------- Активный пункт шапки ---------- */
  const links = Array.from(doc.querySelectorAll('.bar nav a'));
  const secs = links.map(a => doc.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (secs.length && 'IntersectionObserver' in win) {
    const spy = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-40% 0px -55% 0px' });
    secs.forEach(s => spy.observe(s));
  }

  /* ---------- Линза ---------- */
  /* Цель — положение мыши, линза догоняет с инерцией и на ходу
     вытягивается по направлению движения, как капля. Над ссылками
     и кнопками чуть раздувается. Только мышь: на тач, при
     reduced-motion и после Tab линза прячется. */
  const lens = doc.getElementById('lens');
  if (!lens) return;
  const SIZE = 180; // тот же размер, что в .lens и в фильтре #lg

  /* Карта смещения для feDisplacementMap: R — сдвиг по x, G — по y,
     128 — «не двигать». Внутри круга фон тянется к центру: в середине
     слабо (лёгкое увеличение), к кромке всё сильнее — так ведёт себя
     выпуклое стекло. За кругом карта нейтральна. */
  const map = doc.getElementById('lg-map');
  if (map) {
    const c = doc.createElement('canvas');
    c.width = c.height = SIZE;
    const g = c.getContext('2d');
    const img = g.createImageData(SIZE, SIZE), d = img.data;
    const R = SIZE / 2, BEZEL = .62; // доля радиуса, где начинается загиб кромки
    for (let py = 0; py < SIZE; py++) {
      for (let px = 0; px < SIZE; px++) {
        const dx = px + .5 - R, dy = py + .5 - R, dist = Math.hypot(dx, dy), r = dist / R;
        let ox = 0, oy = 0;
        if (r < 1 && dist > 0) {
          const edge = r > BEZEL ? Math.pow((r - BEZEL) / (1 - BEZEL), 2) : 0;
          const f = .4 * r + .6 * edge; // 0 в центре, 1 на самой кромке
          ox = -dx / dist * f; oy = -dy / dist * f;
          // последний пиксель кромки плавно гасим, чтобы не было ступеньки
          const fade = Math.min(1, (1 - r) * R / 1.5);
          ox *= fade; oy *= fade;
        }
        const i = (py * SIZE + px) * 4;
        d[i] = 128 + ox * 127; d[i + 1] = 128 + oy * 127; d[i + 2] = 128; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    map.setAttribute('href', c.toDataURL());
  }

  const fine = win.matchMedia('(hover: hover) and (pointer: fine)');
  const allowed = () => fine.matches && !reduced.matches;
  let x = 0, y = 0, tx = 0, ty = 0, frame = 0, active = false, last = 0;
  let stretch = 0, angle = 0, grow = 1, growTo = 1;

  const hide = () => {
    active = false; last = 0; stretch = 0;
    lens.removeAttribute('data-visible');
    win.cancelAnimationFrame(frame); frame = 0;
  };
  const draw = t => {
    const dt = Math.min(64, last ? t - last : 16.67) / 16.67;
    last = t;
    const k = 1 - Math.pow(.8, dt);
    const px = x, py = y;
    x += (tx - x) * k; y += (ty - y) * k;

    // скорость → растяжение вдоль направления движения
    const vx = (x - px) / dt, vy = (y - py) / dt, speed = Math.hypot(vx, vy);
    if (speed > .3) angle = Math.atan2(vy, vx);
    const target = Math.min(.22, speed * .012);
    stretch += (target - stretch) * (1 - Math.pow(.75, dt));
    grow += (growTo - grow) * (1 - Math.pow(.8, dt));

    const a = angle * 180 / Math.PI;
    lens.style.transform =
      'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)' +
      ' rotate(' + a.toFixed(1) + 'deg)' +
      ' scale(' + (grow * (1 + stretch)).toFixed(3) + ',' + (grow * (1 - stretch * .6)).toFixed(3) + ')' +
      ' rotate(' + (-a).toFixed(1) + 'deg)';

    const settled = Math.hypot(tx - x, ty - y) < .2 && stretch < .002 && Math.abs(growTo - grow) < .002;
    if (active && !settled) frame = win.requestAnimationFrame(draw);
    else { frame = 0; last = 0; }
  };
  const kick = () => { if (active && !frame) frame = win.requestAnimationFrame(draw); };
  const move = e => {
    if (!allowed() || e.pointerType !== 'mouse') { hide(); return; }
    tx = e.clientX; ty = e.clientY;
    if (!active) { x = tx; y = ty; active = true; lens.setAttribute('data-visible', ''); }
    kick();
  };
  const over = e => {
    const hot = e.target instanceof Element && e.target.closest('a, button');
    growTo = hot ? 1.18 : 1;
    kick();
  };
  doc.addEventListener('pointermove', move, { passive: true });
  doc.addEventListener('pointerover', over, { passive: true });
  doc.addEventListener('pointerout', e => { if (!e.relatedTarget) hide(); });
  doc.addEventListener('keydown', e => { if (e.key === 'Tab') hide(); });
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) hide(); });
  win.addEventListener('blur', hide);
  fine.addEventListener('change', () => { if (!allowed()) hide(); });
  reduced.addEventListener('change', () => { if (!allowed()) hide(); });
})();
