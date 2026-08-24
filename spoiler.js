/* =========================================================
   Заглушка «здесь пока пусто» в духе спойлера из Телеграма:
   россыпь мерцающих точек вместо текста, который ещё не написан.

   Раскрывать нечего — под точками нет спрятанного текста, это
   просто визуальная заглушка на месте будущего контента.

   Разметку ставит terminal.js — <span class="spoiler" style="width:Nch">.
   Здесь только сам «шум»: на каждый такой span кладётся canvas,
   и общий цикл каждый кадр пересыпает точки заново. Именно
   пересыпание, а не движение, даёт то самое мерцание.

   Сетку из CSS для этого не взять: там точки всегда стоят
   рядами, а нужен именно случайный рассыпанный шум.
   ========================================================= */
(function () {
  'use strict';

  var DENSITY = 0.07;   // точек на пиксель площади — как в телеграмовском спойлере
  var FPS     = 22;     // реже 60: так спокойнее для глаза и дешевле
  var DOT     = 1;      // сторона точки в CSS-пикселях

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var items = [];        // { el, canvas, ctx, w, h, dpr, count }
  var frame = null;
  var last  = 0;

  /* Цвет точек берём из темы — в светлой теме он тёмный, в тёмной светлый */
  function dotColor() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--text');
    return v.trim() || '#fff';
  }
  var color = dotColor();

  function attach(el) {
    if (el.__spoiler) return;

    var canvas = document.createElement('canvas');
    canvas.className = 'spoiler-noise';
    canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(canvas);

    var item = { el: el, canvas: canvas, ctx: canvas.getContext('2d'), w: 0, h: 0 };
    el.__spoiler = item;
    items.push(item);

    resize(item);
    if (reduceMotion) paint(item);       // без анимации — просто один кадр
  }

  function resize(item) {
    var r   = item.el.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var w   = Math.max(1, Math.round(r.width));
    var h   = Math.max(1, Math.round(r.height));

    if (item.w === w && item.h === h && item.dpr === dpr) return;

    item.w = w; item.h = h; item.dpr = dpr;
    item.canvas.width  = Math.round(w * dpr);
    item.canvas.height = Math.round(h * dpr);
    item.canvas.style.width  = w + 'px';
    item.canvas.style.height = h + 'px';
    item.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    item.count = Math.round(w * h * DENSITY);
  }

  function paint(item) {
    var ctx = item.ctx, w = item.w, h = item.h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;

    for (var i = 0; i < item.count; i++) {
      ctx.globalAlpha = 0.25 + Math.random() * 0.75;
      ctx.fillRect(Math.random() * w, Math.random() * h, DOT, DOT);
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    frame = requestAnimationFrame(loop);
    if (now - last < 1000 / FPS) return;
    last = now;

    // заодно чистим записи для узлов, которых уже нет на экране (clear, смена языка…)
    for (var i = items.length - 1; i >= 0; i--) {
      if (!items[i].el.isConnected) { items.splice(i, 1); continue; }
      resize(items[i]);
      paint(items[i]);
    }
  }

  function scan() {
    var found = document.querySelectorAll('.spoiler');
    for (var i = 0; i < found.length; i++) attach(found[i]);

    if (!reduceMotion && items.length && !frame) frame = requestAnimationFrame(loop);
    if (!items.length && frame) { cancelAnimationFrame(frame); frame = null; }
  }

  /* Спойлеры появляются вместе с выводом команд, поэтому следим за экраном */
  var pending = null;
  new MutationObserver(function () {
    clearTimeout(pending);
    pending = setTimeout(scan, 16);
  }).observe(document.body, { childList: true, subtree: true });

  /* Тема переключается — пересчитываем цвет точек */
  new MutationObserver(function () { color = dotColor(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', function () { color = dotColor(); });

  window.addEventListener('resize', scan);

  scan();
})();
