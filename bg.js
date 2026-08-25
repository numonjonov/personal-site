/* =========================================================
   Фон: несколько вариантов на выбор, один активен за раз.

   Это временный переключалка для сравнения — набери в терминале
   bg tunnel | stars | matrix | horizon | web, чтобы переключиться
   вживую. bg on/off по-прежнему включает/выключает фон целиком.
   Когда выберете вариант, лишнее вычищаем и оставляем один.

   На экранах уже 720px фон не рисуется: там окно терминала занимает
   всё место и фона всё равно не видно.

   Наружу отдаёт window.BG.toggle() / window.BG.isOn() /
   window.BG.setVariant() — ими пользуется команда bg в терминале.
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
  var narrow       = window.matchMedia('(max-width: 720px)');

  var W = 0, H = 0, dpr = 1;
  var frame = null;
  var running = false;      // сейчас рисуем
  var enabled = true;       // включено пользователем (команда bg)

  var VARIANTS = ['tunnel', 'stars', 'matrix', 'meteor', 'horizon', 'web'];
  var variant = 'meteor';

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

  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }

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
  var pointer = { x: 0.5, y: 0.5, active: false };
  var camX = 0, camY = 0;                 // сглаженное положение указателя (-1..1)
  var targetX = 0, targetY = 0;
  var drift = 0;

  if (!coarse) {
    window.addEventListener('mousemove', function (e) {
      pointer.x = e.clientX / W;
      pointer.y = e.clientY / H;
      pointer.active = true;

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

  /* --- Окно тоже слегка наклоняется — только в варианте "tunnel" --- */
  function tiltWindow(reset) {
    if (!win || reduceMotion || coarse || !running || variant !== 'tunnel') {
      if (win && win.style.transform) win.style.transform = '';
      return;
    }
    if (reset || !pointer.active) { win.style.transform = ''; return; }

    var ry = (pointer.x - 0.5) * 1.8;
    var rx = (pointer.y - 0.5) * -1.2;
    win.style.transform =
      'perspective(1400px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
  }

  /* =========================================================
     ВАРИАНТ 1 — TUNNEL: коридор из рамок, уходящий вглубь экрана
     ========================================================= */
  var tunnel = (function () {
    var FRAMES = 24, FAR = 8, HALF = 0.95, SPEED = 0.009, FOCAL = 2.6;
    var CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    var rings = [], cx = 0, cy = 0, scale = 1;
    var bufA = [{}, {}, {}, {}], bufB = [{}, {}, {}, {}];

    function build() {
      rings = [];
      for (var i = 0; i < FRAMES; i++) rings.push({ z: (i / FRAMES) * FAR, accent: i % 5 === 0 });
    }
    build();

    function corners(ring, out) {
      var persp = FOCAL / (FOCAL + ring.z);
      var shiftX = camX * ring.z * 0.42, shiftY = camY * ring.z * 0.42;
      for (var k = 0; k < 4; k++) {
        out[k].x = cx + (CORNERS[k][0] * HALF + shiftX) * persp * scale;
        out[k].y = cy + (CORNERS[k][1] * HALF + shiftY) * persp * scale;
      }
    }

    return {
      tick: function () {
        for (var i = 0; i < rings.length; i++) {
          rings[i].z -= SPEED;
          if (rings[i].z <= 0) rings[i].z += FAR;
        }
      },
      draw: function () {
        cx = W / 2; cy = H / 2; scale = Math.max(W, H) * 0.5;
        var text = colors.text, accent = colors.accent;
        var order = rings.slice().sort(function (a, b) { return b.z - a.z; });
        var hasPrev = false, prev = bufA, curr = bufB, swap;

        for (var i = 0; i < order.length; i++) {
          var ring = order[i];
          var depth = 1 - ring.z / FAR;
          var fade  = Math.min(1, ring.z / 0.9);
          var alpha = (0.09 + depth * 0.5) * fade;
          if (alpha <= 0.01) { hasPrev = false; continue; }

          corners(ring, curr);
          var col = ring.accent ? accent : text;

          ctx.lineWidth = ring.accent ? 1.6 : 1;
          ctx.strokeStyle = rgba(col, alpha);
          ctx.beginPath();
          ctx.moveTo(curr[0].x, curr[0].y);
          for (var k = 1; k < 4; k++) ctx.lineTo(curr[k].x, curr[k].y);
          ctx.closePath();
          ctx.stroke();

          if (hasPrev) {
            ctx.lineWidth = 1;
            ctx.strokeStyle = rgba(text, alpha * 0.5);
            ctx.beginPath();
            for (k = 0; k < 4; k++) { ctx.moveTo(prev[k].x, prev[k].y); ctx.lineTo(curr[k].x, curr[k].y); }
            ctx.stroke();
          }

          var size = 1.6 + depth * 3.4;
          ctx.fillStyle = rgba(col, Math.min(1, alpha * 1.7));
          for (k = 0; k < 4; k++) ctx.fillRect(curr[k].x - size / 2, curr[k].y - size / 2, size, size);

          swap = prev; prev = curr; curr = swap;
          hasPrev = true;
        }
      }
    };
  })();

  /* =========================================================
     ВАРИАНТ 2 — STARS: звёздное поле с параллаксом по глубине
     ========================================================= */
  var stars = (function () {
    var N = 160, pts = [], t = 0;
    function build() {
      pts = [];
      for (var i = 0; i < N; i++) {
        pts.push({ x: Math.random(), y: Math.random(), z: Math.random(), tw: Math.random() * Math.PI * 2, accent: i % 11 === 0 });
      }
    }
    build();

    return {
      tick: function () { t += 0.02; },
      draw: function () {
        var px = camX * 26, py = camY * 26;
        for (var i = 0; i < N; i++) {
          var s = pts[i];
          var depth = 0.3 + s.z * 1.4;
          var x = s.x * W + px * depth, y = s.y * H + py * depth;
          var tw = 0.35 + Math.abs(Math.sin(t * 2 + s.tw)) * 0.65;
          var size = 0.6 + s.z * 2.2;
          ctx.fillStyle = rgba(s.accent ? colors.accent : colors.text, (0.15 + s.z * 0.55) * tw);
          ctx.fillRect(x, y, size, size);
        }
      }
    };
  })();

  /* =========================================================
     ВАРИАНТ 3 — MATRIX: приглушённый "матричный" дождь
     ========================================================= */
  var matrix = (function () {
    var STEP = 16, cols = 0, drops = [];
    var chars = '01アイウエオカキクケコサシスセソ';

    function build() {
      cols = Math.max(1, Math.floor(W / STEP));
      drops = new Array(cols).fill(0).map(function () { return Math.random() * -40; });
    }
    build();

    return {
      onResize: build,
      tick: function () {},
      draw: function () {
        ctx.font = '13px monospace';
        for (var i = 0; i < cols; i++) {
          var x = i * STEP, y = drops[i] * STEP;
          var c = chars[Math.floor(Math.random() * chars.length)];
          var head = Math.random() < 0.05;
          ctx.fillStyle = head ? rgba(colors.accent, 0.85) : rgba(colors.text, Math.max(0, 0.4 - (y / H) * 0.3));
          ctx.fillText(c, x, y);
          drops[i]++;
          if (y > H + 40 && Math.random() > 0.978) drops[i] = Math.random() * -20;
        }
      }
    };
  })();

  /* =========================================================
     ВАРИАНТ — METEOR: звёзды, падающие вниз с хвостом (по мотивам matrix)
     ========================================================= */
  var meteor = (function () {
    var N = 70, list = [];

    function spawn(m, first) {
      m.x    = Math.random() * (W || 800);
      m.y    = first ? Math.random() * (H || 600) : -20 - Math.random() * 120;
      m.z    = Math.random();                       // глубина: медленные/тусклые ↔ быстрые/яркие
      m.len  = 14 + m.z * 46;
      m.accent = Math.random() < 0.09;
      return m;
    }

    function build() {
      list = [];
      for (var i = 0; i < N; i++) list.push(spawn({}, true));
    }
    build();

    return {
      onResize: build,
      tick: function () {
        for (var i = 0; i < N; i++) {
          var m = list[i];
          var speed = 1.4 + m.z * 5.2;
          m.y += speed;
          m.x += camX * speed * 0.18;                 // ветер вслед за указателем/наклоном
          if (m.y - m.len > H) spawn(m, false);
        }
      },
      draw: function () {
        for (var i = 0; i < N; i++) {
          var m = list[i];
          var speed = 1.4 + m.z * 5.2;
          var dx = camX * speed * 0.18, dy = speed;
          var norm = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          var ux = dx / norm, uy = dy / norm;
          var col = m.accent ? colors.accent : colors.text;
          var alpha = 0.18 + m.z * 0.6;

          ctx.strokeStyle = rgba(col, alpha * 0.5);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x - ux * m.len, m.y - uy * m.len);
          ctx.stroke();

          var head = 0.8 + m.z * 1.6;
          ctx.fillStyle = rgba(col, Math.min(1, alpha * 1.6));
          ctx.fillRect(m.x - head / 2, m.y - head / 2, head, head);
        }
      }
    };
  })();

  /* =========================================================
     ВАРИАНТ 4 — HORIZON: уходящая сетка пола
     ========================================================= */
  var horizon = (function () {
    var t = 0;
    return {
      tick: function () { t += 0.006; },
      draw: function () {
        var h = H * 0.42;
        var vx = W / 2 + camX * 40;

        var N = 17;
        for (var i = 0; i <= N; i++) {
          var f = i / N;
          ctx.strokeStyle = rgba(colors.text, 0.08 + 0.05 * Math.abs(f - 0.5));
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(f * W, H);
          ctx.lineTo(vx, h);
          ctx.stroke();
        }

        for (var j = 0; j < 14; j++) {
          var p = ((j / 14 + t) % 1);
          var y = h + Math.pow(p, 2.4) * (H - h);
          var a = 0.05 + p * 0.32;
          ctx.strokeStyle = (j % 5 === 0) ? rgba(colors.accent, a) : rgba(colors.text, a);
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
      }
    };
  })();

  /* =========================================================
     ВАРИАНТ 5 — WEB: узлы с линиями связи
     ========================================================= */
  var web = (function () {
    var N = 46, pts = [];
    function build() {
      pts = [];
      for (var i = 0; i < N; i++) {
        pts.push({
          x: Math.random() * (W || 800), y: Math.random() * (H || 600),
          vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15,
          accent: i % 8 === 0
        });
      }
    }
    build();

    return {
      onResize: build,
      tick: function () {
        for (var i = 0; i < N; i++) {
          var p = pts[i];
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > W) p.vx *= -1;
          if (p.y < 0 || p.y > H) p.vy *= -1;
        }
      },
      draw: function () {
        var px = camX * W * 0.12, py = camY * H * 0.12;
        for (var i = 0; i < N; i++) {
          for (var j = i + 1; j < N; j++) {
            var a = pts[i], b = pts[j];
            var dx = a.x - b.x, dy = a.y - b.y;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d < 130) {
              ctx.strokeStyle = rgba(colors.text, (1 - d / 130) * 0.22);
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(a.x + px, a.y + py);
              ctx.lineTo(b.x + px, b.y + py);
              ctx.stroke();
            }
          }
        }
        for (var k = 0; k < N; k++) {
          var p = pts[k];
          ctx.fillStyle = rgba(p.accent ? colors.accent : colors.text, 0.75);
          ctx.fillRect(p.x + px - 1, p.y + py - 1, 2, 2);
        }
      }
    };
  })();

  var RENDERERS = { tunnel: tunnel, stars: stars, matrix: matrix, meteor: meteor, horizon: horizon, web: web };

  function onResize() {
    resize();
    var r = RENDERERS[variant];
    if (r.onResize) r.onResize();
  }

  /* =======================================================
     ЦИКЛ
     ======================================================= */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    RENDERERS[variant].draw();
  }

  function loop() {
    drift += 0.0022;
    if (!pointer.active) {
      targetX = Math.sin(drift) * 0.16;
      targetY = Math.cos(drift * 0.8) * 0.1;
    }
    camX += (targetX - camX) * 0.06;
    camY += (targetY - camY) * 0.06;

    RENDERERS[variant].tick();
    draw();
    frame = requestAnimationFrame(loop);
  }

  /* =======================================================
     УПРАВЛЕНИЕ
     ======================================================= */
  function allowed() { return enabled && !narrow.matches; }

  function showStatus() {
    if (!status) return;
    status.textContent = !enabled ? 'off' : (running ? variant : 'auto');
  }

  function start() {
    enabled = true;
    if (!allowed()) { stopDrawing(); return; }
    if (running) { showStatus(); return; }

    running = true;
    canvas.hidden = false;
    readColors();
    resize();
    var r = RENDERERS[variant];
    if (r.onResize) r.onResize();
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

  function setVariant(name) {
    if (VARIANTS.indexOf(name) === -1) return false;
    variant = name;
    if (!running) { start(); return true; }
    var r = RENDERERS[variant];
    if (r.onResize) r.onResize();
    tiltWindow(true);
    showStatus();
    return true;
  }

  function cycle() {
    var next = VARIANTS[(VARIANTS.indexOf(variant) + 1) % VARIANTS.length];
    if (!enabled) { try { localStorage.setItem('bg', 'on'); } catch (e) {} }
    setVariant(next);
    if (!running) start();          // например, звали cycle() после bg off
    return next;
  }

  var onNarrowChange = function () { if (enabled) start(); };
  if (narrow.addEventListener) narrow.addEventListener('change', onNarrowChange);
  else if (narrow.addListener) narrow.addListener(onNarrowChange);

  window.addEventListener('resize', function () {
    if (!enabled) return;
    if (!allowed()) { stopDrawing(); return; }
    if (!running)   { start(); return; }

    onResize();
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
    },
    variants: VARIANTS.slice(),
    variant: function () { return variant; },
    setVariant: setVariant,
    cycle: cycle
  };

  var saved = null;
  try { saved = localStorage.getItem('bg'); } catch (e) {}
  if (saved !== 'off') start(); else stop();
})();
