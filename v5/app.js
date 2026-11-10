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
  /* Цель — положение мыши, линза догоняет с инерцией. Только мышь:
     на тач, при reduced-motion и после Tab линза прячется. */
  const lens = doc.getElementById('lens');
  if (!lens) return;
  const fine = win.matchMedia('(hover: hover) and (pointer: fine)');
  const allowed = () => fine.matches && !reduced.matches;
  let x = 0, y = 0, tx = 0, ty = 0, frame = 0, active = false, last = 0;

  const hide = () => {
    active = false; last = 0;
    lens.removeAttribute('data-visible');
    win.cancelAnimationFrame(frame); frame = 0;
  };
  const draw = t => {
    const k = 1 - Math.pow(.82, Math.min(64, last ? t - last : 16.67) / 16.67);
    last = t;
    x += (tx - x) * k; y += (ty - y) * k;
    lens.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    if (active && Math.hypot(tx - x, ty - y) > .2) frame = win.requestAnimationFrame(draw);
    else { frame = 0; last = 0; }
  };
  const move = e => {
    if (!allowed() || e.pointerType !== 'mouse') { hide(); return; }
    tx = e.clientX; ty = e.clientY;
    if (!active) { x = tx; y = ty; active = true; lens.setAttribute('data-visible', ''); }
    if (!frame) frame = win.requestAnimationFrame(draw);
  };
  doc.addEventListener('pointermove', move, { passive: true });
  doc.addEventListener('pointerout', e => { if (!e.relatedTarget) hide(); });
  doc.addEventListener('keydown', e => { if (e.key === 'Tab') hide(); });
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) hide(); });
  win.addEventListener('blur', hide);
  fine.addEventListener('change', () => { if (!allowed()) hide(); });
  reduced.addEventListener('change', () => { if (!allowed()) hide(); });
})();
