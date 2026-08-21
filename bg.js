/* =========================================================
   Фон: коридор из рамок, уходящий вглубь экрана.

   Рамки стоят на разной глубине z и едут на зрителя: ближняя
   растворяется, на её место с дальнего конца встаёт новая.
   Проекция перспективная — дальние рамки сходятся в точку.
   Курсор двигает эту точку схода, поэтому коридор наклоняется
   вслед за мышью. Никаких библиотек, обычный canvas.

   Наружу отдаёт window.BG.toggle() / window.BG.isOn() —
   ими пользуется команда bg в терминале.
   ========================================================= */
(function () {
  'use strict';

  var canvas = document.getElementById('bg');
  if (!canvas || !canvas.getContext) return;

  var ctx    = canvas.getContext('2d');
  var root   = document.documentElement;
  var win    = document.getElementById('window');
  var status = document.getElementById('status-bg');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse       = window.matchMedia('(pointer: coarse)').matches;

  var W = 0, H = 0, dpr = 1;
  var frame = null;
  var running = false;      // сейчас рисуем
  var enabled = true;       // включено пользователем (команда bg)

  /* =======================================================
     СЦЕНА
     ======================================================= */
  var FRAMES = 24;          // сколько рамок в коридоре
  var FAR    = 8;           // длина коридора по глубине
  var HALF   = 0.95;        // половина стороны рамки (на узком экране меньше)
  var SPEED  = 0.009;       // насколько рамки едут за кадр

  var rings = [];

  function buildTunnel() {
    rings = [];
    for (var i = 0; i < FRAMES; i++) {
      rings.push({ z: (i / FRAMES) * FAR, accent: i % 5 === 0 });
    }
  }

  buildTunnel();

  var CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

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

    // На телефоне рамки короче, иначе в кадр влезает всего одна
    HALF = W < 720 ? 0.72 : 0.95;
  }

  /* =======================================================
     МЫШЬ
     ======================================================= */
  var pointer = { x: 0.5, y: 0.5, active: false };
  var camX = 0, camY = 0;                 // текущая точка схода
  var targetX = 0, targetY = 0;           // куда она стремится
  var drift = 0;

  /* --- Гироскоп: наклон телефона двигает точку схода --- */
  var tiltOn = false;
  var tiltSupported = 'DeviceOrientationEvent' in window;
  var needsPermission = tiltSupported &&
                        typeof window.DeviceOrientationEvent.requestPermission === 'function';

  function onOrientation(e) {
    if (e.gamma === null && e.beta === null) return;

    // gamma — наклон вбок (-90..90), beta — вперёд-назад (-180..180).
    // Телефон в руке обычно наклонён примерно на 45°, это и считаем нулём.
    var gamma = Math.max(-35, Math.min(35, e.gamma || 0));
    var beta  = Math.max(-35, Math.min(35, (e.beta || 45) - 45));

    // Множители небольшие: на телефоне даже лёгкий наклон заметен,
    // а на большом коридор улетает за край экрана
    pointer.active = true;
    targetX = (gamma / 35) * -0.85;
    targetY = (beta / 35) * -0.6;
  }

  function tilt(on) {
    if (!tiltSupported) return Promise.resolve('unsupported');

    if (!on) {
      window.removeEventListener('deviceorientation', onOrientation);
      tiltOn = false;
      pointer.active = false;
      targetX = 0; targetY = 0;
      return Promise.resolve('off');
    }

    var attach = function () {
      window.addEventListener('deviceorientation', onOrientation);
      tiltOn = true;
      return 'on';
    };

    // iOS спрашивает разрешение и только по действию пользователя
    if (needsPermission) {
      return window.DeviceOrientationEvent.requestPermission()
        .then(function (state) { return state === 'granted' ? attach() : 'denied'; })
        .catch(function () { return 'denied'; });
    }

    return Promise.resolve(attach());
  }

  if (!coarse) {
    window.addEventListener('mousemove', function (e) {
      pointer.x = e.clientX / W;
      pointer.y = e.clientY / H;
      pointer.active = true;

      // Курсор уводит точку схода в противоположную сторону —
      // получается, что заглядываешь в коридор сбоку
      targetX = (pointer.x - 0.5) * -1.6;
      targetY = (pointer.y - 0.5) * -1.1;

      tiltWindow();
    }, { passive: true });

    window.addEventListener('mouseleave', function () {
      pointer.active = false;
      targetX = 0;
      targetY = 0;
      tiltWindow(true);
    });
  }

  /* --- Окно тоже слегка наклоняется --- */
  function tiltWindow(reset) {
    if (!win || reduceMotion || coarse || !running) return;

    if (reset || !pointer.active) { win.style.transform = ''; return; }

    // Углы намеренно маленькие: на большем повороте текст мылится
    var ry = (pointer.x - 0.5) * 1.8;
    var rx = (pointer.y - 0.5) * -1.2;

    win.style.transform =
      'perspective(1400px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
  }

  /* =======================================================
     ОТРИСОВКА
     ======================================================= */
  var FOCAL = 2.6;                        // чем меньше, тем резче перспектива
  var cx = 0, cy = 0, scale = 1;

  var bufA = [{}, {}, {}, {}];
  var bufB = [{}, {}, {}, {}];

  function corners(ring, out) {
    var persp = FOCAL / (FOCAL + ring.z);

    // Точка схода уезжает тем сильнее, чем дальше рамка
    var shiftX = camX * ring.z * 0.42;
    var shiftY = camY * ring.z * 0.42;

    for (var k = 0; k < 4; k++) {
      out[k].x = cx + (CORNERS[k][0] * HALF + shiftX) * persp * scale;
      out[k].y = cy + (CORNERS[k][1] * HALF + shiftY) * persp * scale;
    }
    return persp;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    cx = W / 2;
    cy = H / 2;
    scale = Math.max(W, H) * 0.5;

    var text = colors.text;
    var accent = colors.accent;

    // от дальних к ближним, чтобы ближние ложились сверху
    var order = rings.slice().sort(function (a, b) { return b.z - a.z; });
    var hasPrev = false;
    var prev = bufA, curr = bufB, swap;

    for (var i = 0; i < order.length; i++) {
      var ring = order[i];

      var depth = 1 - ring.z / FAR;                 // 1 — вплотную, 0 — в конце коридора
      var fade  = Math.min(1, ring.z / 0.9);        // ближняя рамка растворяется
      var alpha = (0.09 + depth * 0.5) * fade;
      if (alpha <= 0.01) { hasPrev = false; continue; }

      corners(ring, curr);
      var col = ring.accent ? accent : text;

      /* --- рамка --- */
      ctx.lineWidth = ring.accent ? 1.6 : 1;
      ctx.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(curr[0].x, curr[0].y);
      for (var k = 1; k < 4; k++) ctx.lineTo(curr[k].x, curr[k].y);
      ctx.closePath();
      ctx.stroke();

      /* --- рельсы между соседними рамками --- */
      if (hasPrev) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(' + text[0] + ',' + text[1] + ',' + text[2] + ',' +
                          (alpha * 0.5).toFixed(3) + ')';
        ctx.beginPath();
        for (k = 0; k < 4; k++) {
          ctx.moveTo(prev[k].x, prev[k].y);
          ctx.lineTo(curr[k].x, curr[k].y);
        }
        ctx.stroke();
      }

      /* --- точки в углах --- */
      var size = 1.6 + depth * 3.4;
      ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' +
                      Math.min(1, alpha * 1.7).toFixed(3) + ')';
      for (k = 0; k < 4; k++) {
        ctx.fillRect(curr[k].x - size / 2, curr[k].y - size / 2, size, size);
      }

      swap = prev; prev = curr; curr = swap;
      hasPrev = true;
    }
  }

  function loop() {
    for (var i = 0; i < rings.length; i++) {
      rings[i].z -= SPEED;
      if (rings[i].z <= 0) rings[i].z += FAR;
    }

    // без мыши коридор еле заметно покачивается сам
    drift += 0.0022;
    if (!pointer.active) {
      targetX = Math.sin(drift) * 0.16;
      targetY = Math.cos(drift * 0.8) * 0.1;
    }

    camX += (targetX - camX) * 0.06;
    camY += (targetY - camY) * 0.06;

    draw();
    frame = requestAnimationFrame(loop);
  }

  /* =======================================================
     УПРАВЛЕНИЕ
     ======================================================= */
  function allowed() { return enabled; }

  function showStatus() {
    if (!status) return;
    status.textContent = enabled ? 'on' : 'off';
  }

  function start() {
    enabled = true;
    if (!allowed()) { stopDrawing(); return; }
    if (running) { showStatus(); return; }

    running = true;
    canvas.hidden = false;
    readColors();
    resize();
    showStatus();

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
    showStatus();
  }

  function stop() {
    enabled = false;
    stopDrawing();
  }

  window.addEventListener('resize', function () {
    if (!enabled) return;
    if (!allowed()) { stopDrawing(); return; }
    if (!running)   { start(); return; }

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
    tiltSupported: function () { return tiltSupported && coarse; },
    tiltOn: function () { return tiltOn; },
    tilt: tilt,
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
