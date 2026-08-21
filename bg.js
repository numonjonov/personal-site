/* =========================================================
   Фон: объёмная решётка точек, которая живёт от мыши.

   Сцена — куб из точек в координатах x/y/z. Курсор задаёт углы
   поворота, точки проецируются с перспективой: ближние крупные
   и яркие, дальние мелкие и бледные. Когда мышь рядом с точкой,
   точка разгорается.

   Наружу отдаёт window.BG.toggle() / window.BG.isOn() —
   ими пользуется команда bg в терминале.
   ========================================================= */
(function () {
  'use strict';

  var canvas = document.getElementById('bg');
  if (!canvas || !canvas.getContext) return;

  var ctx  = canvas.getContext('2d');
  var root = document.documentElement;
  var win  = document.getElementById('window');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse       = window.matchMedia('(pointer: coarse)').matches;
  var narrow       = window.matchMedia('(max-width: 720px)');

  var W = 0, H = 0, dpr = 1;
  var frame = null;
  var running = false;      // сейчас рисуем
  var enabled = true;       // включено пользователем (команда bg)

  /* =======================================================
     СЦЕНА: точки решётки и рёбра вдоль глубины
     ======================================================= */
  var GRID = { x: 11, y: 7, z: 6 };
  var nodes = [];
  var columns = [];          // индексы точек, стоящих друг за другом по z

  function buildGrid() {
    nodes = [];
    columns = [];

    var stepX = 3.4 / (GRID.x - 1);
    var stepY = 2.2 / (GRID.y - 1);
    var stepZ = 3.0 / (GRID.z - 1);

    for (var ix = 0; ix < GRID.x; ix++) {
      for (var iy = 0; iy < GRID.y; iy++) {
        var column = [];

        for (var iz = 0; iz < GRID.z; iz++) {
          column.push(nodes.length);
          nodes.push({
            x: -1.7 + ix * stepX,
            y: -1.1 + iy * stepY,
            z: -1.5 + iz * stepZ,
            accent: (ix + iy + iz) % 19 === 0,
            glow: 0                      // насколько точка разогрета курсором
          });
        }
        columns.push(column);
      }
    }
  }

  buildGrid();

  /* =======================================================
     ЦВЕТА ИЗ ТЕМЫ
     ======================================================= */
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

  /* =======================================================
     РАЗМЕР ХОЛСТА
     ======================================================= */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;

    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* =======================================================
     МЫШЬ
     ======================================================= */
  var pointer = { x: 0.5, y: 0.5, active: false };      // 0..1 по экрану
  var targetRx = 0, targetRy = 0;
  var rx = 0, ry = 0;
  var drift = 0;

  if (!coarse) {
    window.addEventListener('mousemove', function (e) {
      pointer.x = e.clientX / W;
      pointer.y = e.clientY / H;
      pointer.active = true;

      // Курсор задаёт углы: уходим от центра — сцена доворачивается
      targetRy = (pointer.x - 0.5) * 1.15;
      targetRx = (pointer.y - 0.5) * -0.75;

      tiltWindow();
    }, { passive: true });

    window.addEventListener('mouseleave', function () {
      pointer.active = false;
      targetRx = 0;
      targetRy = 0;
      tiltWindow(true);
    });
  }

  /* --- Окно терминала тоже слегка наклоняется --- */
  function tiltWindow(reset) {
    if (!win || reduceMotion || coarse || !enabled) return;

    if (reset || !pointer.active) {
      win.style.transform = '';
      return;
    }

    // Углы намеренно маленькие: на большем повороте текст в окне мылится
    var ty = (pointer.x - 0.5) * 1.6;      // градусы
    var tx = (pointer.y - 0.5) * -1.1;

    win.style.transform =
      'perspective(1400px) rotateX(' + tx.toFixed(2) + 'deg) rotateY(' + ty.toFixed(2) + 'deg)';
  }

  /* =======================================================
     ПРОЕКЦИЯ
     ======================================================= */
  var view = { cx: 0, cy: 0, scale: 1, focal: 3.4, sinX: 0, cosX: 1, sinY: 0, cosY: 1 };

  function project(p, out) {
    var x1 = p.x * view.cosY - p.z * view.sinY;
    var z1 = p.x * view.sinY + p.z * view.cosY;

    var y2 = p.y * view.cosX - z1 * view.sinX;
    var z2 = p.y * view.sinX + z1 * view.cosX;

    var persp = view.focal / (view.focal + z2);

    out.x = view.cx + x1 * persp * view.scale;
    out.y = view.cy + y2 * persp * view.scale;
    out.z = z2;
    out.p = persp;
    return out;
  }

  var pa = { x: 0, y: 0, z: 0, p: 1 };
  var pb = { x: 0, y: 0, z: 0, p: 1 };
  var screenPos = [];                                   // куда спроецировалась каждая точка

  function draw() {
    ctx.clearRect(0, 0, W, H);

    view.cx = W / 2;
    view.cy = H / 2;
    view.scale = Math.max(W, H) * 0.42;
    view.sinY = Math.sin(ry); view.cosY = Math.cos(ry);
    view.sinX = Math.sin(rx); view.cosX = Math.cos(rx);

    var text = colors.text;
    var accent = colors.accent;

    var mouseX = pointer.x * W;
    var mouseY = pointer.y * H;
    var reach = Math.min(W, H) * 0.22;                  // радиус подсветки вокруг курсора

    var i, j;

    /* --- проецируем все точки и считаем подсветку --- */
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var pos = screenPos[i] || (screenPos[i] = { x: 0, y: 0, z: 0, p: 1 });
      project(node, pos);

      var target = 0;
      if (pointer.active) {
        var dx = pos.x - mouseX;
        var dy = pos.y - mouseY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < reach) target = 1 - dist / reach;
      }

      // разгорается быстро, гаснет плавно
      node.glow += (target - node.glow) * (target > node.glow ? 0.25 : 0.06);
    }

    /* --- рёбра вдоль глубины: они и создают ощущение объёма --- */
    ctx.lineWidth = 1;

    for (i = 0; i < columns.length; i++) {
      var column = columns[i];

      for (j = 0; j < column.length - 1; j++) {
        var a = screenPos[column[j]];
        var b = screenPos[column[j + 1]];
        var glow = Math.max(nodes[column[j]].glow, nodes[column[j + 1]].glow);

        var depth = 1 - (a.z + 1.6) / 3.4;               // 1 — ближе, 0 — дальше
        var alpha = (0.05 + depth * 0.13) + glow * 0.4;
        if (alpha < 0.02) continue;

        var lc = glow > 0.35 ? accent : text;
        ctx.strokeStyle = 'rgba(' + lc[0] + ',' + lc[1] + ',' + lc[2] + ',' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    /* --- точки поверх рёбер --- */
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var p = screenPos[i];

      if (p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) continue;

      var d = 1 - (p.z + 1.6) / 3.4;
      var base = 0.14 + d * 0.42;
      var size = (0.9 + d * 1.7) * p.p + n.glow * 2.6;
      var col  = (n.accent || n.glow > 0.45) ? accent : text;

      ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' +
                      Math.min(1, base + n.glow * 0.65).toFixed(3) + ')';
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
  }

  function loop() {
    // Без мыши сцена еле заметно дышит сама
    drift += 0.0016;
    if (!pointer.active) {
      targetRy = Math.sin(drift) * 0.16;
      targetRx = Math.cos(drift * 0.7) * 0.09;
    }

    ry += (targetRy - ry) * 0.06;
    rx += (targetRx - rx) * 0.06;

    draw();
    frame = requestAnimationFrame(loop);
  }

  /* =======================================================
     УПРАВЛЕНИЕ
     ======================================================= */
  // На узких экранах окно занимает всё место — фона не видно, не рисуем
  function wanted() { return enabled && !narrow.matches; }

  function start() {
    enabled = true;
    if (!wanted()) { stopDrawing(); return; }
    if (running) return;

    running = true;
    canvas.hidden = false;
    readColors();
    resize();

    if (reduceMotion) { draw(); return; }
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(loop);
  }

  function stopDrawing() {
    running = false;
    cancelAnimationFrame(frame);
    if (W && H) ctx.clearRect(0, 0, W, H);
    canvas.hidden = true;
    if (win) win.style.transform = '';
  }

  function stop() {
    enabled = false;
    stopDrawing();
  }

  var onNarrowChange = function () { if (enabled) start(); };
  if (narrow.addEventListener) narrow.addEventListener('change', onNarrowChange);
  else if (narrow.addListener) narrow.addListener(onNarrowChange);

  window.addEventListener('resize', function () {
    if (!enabled) return;
    if (!wanted()) { stopDrawing(); return; }
    if (!running)  { start(); return; }

    resize();
    if (reduceMotion) draw();
  });

  document.addEventListener('visibilitychange', function () {
    if (!running || reduceMotion) return;
    if (document.hidden) cancelAnimationFrame(frame);
    else frame = requestAnimationFrame(loop);
  });

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
