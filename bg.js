/* =========================================================
   Фон: точечная сфера в 3D на canvas. Без библиотек —
   точки хранятся как x/y/z, поворачиваются матрицами и
   проецируются на плоскость с перспективой.

   Наружу отдаёт window.BG.toggle() / window.BG.isOn() —
   ими пользуется команда bg в терминале.
   ========================================================= */
(function () {
  'use strict';

  var canvas = document.getElementById('bg');
  if (!canvas || !canvas.getContext) return;

  var ctx  = canvas.getContext('2d');
  var root = document.documentElement;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;

  var W = 0, H = 0, dpr = 1;
  var points = [];
  var frame = null;
  var running = false;      // сейчас рисуем
  var enabled = true;       // включено пользователем (команда bg)

  /* ---------- Точки на сфере: спираль Фибоначчи даёт ровное распределение ---------- */
  function buildSphere(count) {
    var list = [];
    var golden = Math.PI * (3 - Math.sqrt(5));

    for (var i = 0; i < count; i++) {
      var y = 1 - (i / (count - 1)) * 2;        // от 1 до -1
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var a = golden * i;

      list.push({
        x: Math.cos(a) * r,
        y: y,
        z: Math.sin(a) * r,
        accent: i % 23 === 0                     // редкие красные точки
      });
    }
    return list;
  }

  /* ---------- Каркас: параллели и меридианы ---------- */
  function buildWireframe() {
    var lines = [];
    var seg = 44;                                // точек в одной линии
    var i, j, lat, r, y, lon;

    // параллели
    var lats = [-58, -29, 0, 29, 58];
    for (i = 0; i < lats.length; i++) {
      lat = lats[i] * Math.PI / 180;
      y = Math.sin(lat);
      r = Math.cos(lat);

      var ring = [];
      for (j = 0; j <= seg; j++) {
        var a = (j / seg) * Math.PI * 2;
        ring.push({ x: Math.cos(a) * r, y: y, z: Math.sin(a) * r });
      }
      lines.push(ring);
    }

    // меридианы
    for (i = 0; i < 6; i++) {
      lon = (i / 6) * Math.PI * 2;
      var mer = [];
      for (j = 0; j <= seg; j++) {
        var b = -Math.PI / 2 + (j / seg) * Math.PI;
        mer.push({
          x: Math.cos(b) * Math.cos(lon),
          y: Math.sin(b),
          z: Math.cos(b) * Math.sin(lon)
        });
      }
      lines.push(mer);
    }

    return lines;
  }

  var wire = buildWireframe();

  /* ---------- Цвета берём из темы, а не хардкодим ---------- */
  var colors = { text: [20, 19, 15], accent: [200, 16, 46] };

  function parseColor(value) {
    value = String(value).trim();

    var hex = value.replace('#', '');
    if (/^[0-9a-f]{6}$/i.test(hex)) {
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }

    var m = value.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }

  function readColors() {
    var style = getComputedStyle(root);
    colors.text   = parseColor(style.getPropertyValue('--text'))   || colors.text;
    colors.accent = parseColor(style.getPropertyValue('--accent')) || colors.accent;
  }

  /* ---------- Размер холста с учётом плотности экрана ---------- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;

    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var wanted = W < 720 ? 200 : 420;
    if (points.length !== wanted) points = buildSphere(wanted);
  }

  /* ---------- Поворот: собственный ход + лёгкая реакция на курсор ---------- */
  var ry = 0, rx = -0.22;
  var targetX = 0, targetY = 0;
  var offsetX = 0, offsetY = 0;

  if (!coarse && !reduceMotion) {
    window.addEventListener('mousemove', function (e) {
      targetX = (e.clientY / H - 0.5) * 0.5;
      targetY = (e.clientX / W - 0.5) * 0.7;
    }, { passive: true });
  }

  // Общая математика проекции: поворот вокруг двух осей + перспектива
  var view = { cx: 0, cy: 0, scale: 1, focal: 3.1, sinY: 0, cosY: 1, sinX: 0, cosX: 1 };

  function project(p, out) {
    var x1 = p.x * view.cosY - p.z * view.sinY;
    var z1 = p.x * view.sinY + p.z * view.cosY;

    var y2 = p.y * view.cosX - z1 * view.sinX;
    var z2 = p.y * view.sinX + z1 * view.cosX;

    var persp = view.focal / (view.focal - z2);

    out.x = view.cx + x1 * persp * view.scale;
    out.y = view.cy + y2 * persp * view.scale;
    out.z = z2;                                  // -1 — дальше всего, 1 — ближе всего
    out.p = persp;
    return out;
  }

  var pa = { x: 0, y: 0, z: 0, p: 1 };
  var pb = { x: 0, y: 0, z: 0, p: 1 };

  function draw() {
    ctx.clearRect(0, 0, W, H);

    view.cx = W / 2;
    view.cy = H / 2;
    view.scale = Math.min(W, H) * 0.62;

    var ax = rx + offsetX;
    var ay = ry + offsetY;
    view.sinY = Math.sin(ay); view.cosY = Math.cos(ay);
    view.sinX = Math.sin(ax); view.cosX = Math.cos(ax);

    var c = colors.text;
    var i, j;

    /* --- каркас: рисуем только переднюю половину, задняя скрыта --- */
    ctx.lineWidth = 1;

    for (i = 0; i < wire.length; i++) {
      var line = wire[i];

      for (j = 0; j < line.length - 1; j++) {
        project(line[j], pa);
        project(line[j + 1], pb);

        var mid = (pa.z + pb.z) / 2;
        if (mid < -0.05) continue;               // отсекаем изнанку сферы

        var depth = (mid + 1) / 2;
        ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' +
                          (0.04 + depth * 0.22).toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    }

    /* --- точки поверх каркаса --- */
    for (i = 0; i < points.length; i++) {
      var pt = points[i];
      project(pt, pa);

      var d = (pa.z + 1) / 2;
      var alpha = 0.08 + d * 0.55;
      var size  = (0.7 + d * 1.6) * pa.p;
      var col   = pt.accent ? colors.accent : c;

      ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + alpha.toFixed(3) + ')';
      ctx.fillRect(pa.x - size / 2, pa.y - size / 2, size, size);
    }
  }

  function loop() {
    ry += 0.0018;
    rx = -0.22 + Math.sin(ry * 0.6) * 0.1;

    offsetX += (targetX - offsetX) * 0.045;
    offsetY += (targetY - offsetY) * 0.045;

    draw();
    frame = requestAnimationFrame(loop);
  }

  /* ---------- Управление ---------- */
  // На узких экранах окно терминала занимает всё место, сферы всё равно
  // не видно — там не рисуем вовсе, чтобы не тратить батарею.
  var narrow = window.matchMedia('(max-width: 720px)');

  function wanted() { return enabled && !narrow.matches; }

  function start() {
    enabled = true;
    if (!wanted()) { stopDrawing(); return; }
    if (running) return;

    running = true;
    canvas.hidden = false;
    readColors();
    resize();

    if (reduceMotion) { draw(); return; }        // без движения — один статичный кадр
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(loop);
  }

  function stopDrawing() {
    running = false;
    cancelAnimationFrame(frame);
    if (W && H) ctx.clearRect(0, 0, W, H);
    canvas.hidden = true;
  }

  function stop() {
    enabled = false;
    stopDrawing();
  }

  // Поворот телефона или изменение окна может пересечь границу 720px
  var onNarrowChange = function () { if (enabled) start(); };
  if (narrow.addEventListener) narrow.addEventListener('change', onNarrowChange);
  else if (narrow.addListener) narrow.addListener(onNarrowChange);

  window.addEventListener('resize', function () {
    if (!enabled) return;

    // Пересекли границу 720px — включаемся или гасимся
    if (!wanted()) { stopDrawing(); return; }
    if (!running)  { start(); return; }

    resize();
    if (reduceMotion) draw();
  });

  // Не крутим сферу, пока вкладка не видна
  document.addEventListener('visibilitychange', function () {
    if (!running || reduceMotion) return;
    if (document.hidden) {
      cancelAnimationFrame(frame);
    } else {
      frame = requestAnimationFrame(loop);
    }
  });

  // Смена темы — перечитать цвета
  new MutationObserver(function () {
    if (running) { readColors(); if (reduceMotion) draw(); }
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  window.BG = {
    isOn: function () { return enabled; },
    toggle: function (on) {
      var next = on === undefined ? !enabled : !!on;
      if (next) start(); else stop();
      try { localStorage.setItem('bg', next ? 'on' : 'off'); } catch (e) {}
      return next;
    }
  };

  var saved = null;
  try { saved = localStorage.getItem('bg'); } catch (e) {}
  if (saved !== 'off') start(); else stop();
})();
