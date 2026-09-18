/* ============================================================
   numonjonov.com — поведение
   Один файл на весь сайт. Каждый блок молча выходит, если своих
   элементов на странице нет: страницы кейсов подключают тот же
   файл, а сцены с частицами и гигантского заголовка там нет.

   Библиотек нет намеренно. Плавный скролл, зерно и частицы здесь
   занимают меньше места, чем заняли бы GSAP и Lenis вместе, и
   делают ровно то, что нужно этому сайту.
   ============================================================ */

(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch  = matchMedia('(hover: none)').matches;

  var root   = document.documentElement;
  var view   = document.getElementById('view');
  var spacer = document.getElementById('spacer');

  /* Подмену скролла трансформом включаем только на мыши. На тачскрине
     она всегда даёт рывки: браузер прячет адресную строку, высота
     вьюпорта скачет и борется с инерцией пальца. Там — родной скролл,
     а сцены считаются от window.scrollY как есть. */
  var smooth = !reduce && !touch;

  if (!reduce) root.classList.add('js');
  if (smooth)  root.classList.add('smooth');

  /* =========================================================
     Плавный скролл
     Страница не прокручивается сама: высоту держит распорка,
     а содержимое подтягивается к позиции с коэффициентом.
     Отсюда ощущение веса — картинка догоняет колесо.
     ========================================================= */
  var target = 0, current = 0, maxScroll = 0;

  function measure() {
    if (!view) return;
    var h = view.getBoundingClientRect().height;
    if (smooth) spacer.style.height = h + 'px';
    maxScroll = Math.max(0, (smooth ? h : document.body.scrollHeight) - innerHeight);
  }
  addEventListener('resize', measure);
  measure();
  // Шрифты приходят позже и меняют высоту страницы — пересчитываем.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () {
    measure();
    for (var i = 0; i < spoilers.length; i++) sizeSpoiler(spoilers[i]);
  });

  /* =========================================================
     Плёночное зерно
     Шум рисуется в маленький буфер и растягивается на экран.
     Перерисовка раз в ~80 мс, а не каждый кадр: глаз разницы
     не видит, нагрузка падает примерно вчетверо.
     ========================================================= */
  var gc = document.getElementById('grain');
  var g  = gc && !reduce ? gc.getContext('2d') : null;
  var GW = 190, GH = 130, grainAt = 0;

  function drawGrain(now) {
    if (!g || now - grainAt < 80) return;
    grainAt = now;

    gc.width = GW; gc.height = GH;
    var img = g.createImageData(GW, GH), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = 200 + Math.random() * 55;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 26;
    }
    g.putImageData(img, 0, 0);
  }

  /* =========================================================
     Частицы
     Название проекта рисуется в скрытый буфер, пиксели с
     заливкой становятся точками. Каждая помнит место в букве
     и свою точку разлёта.
     ========================================================= */
  /* Цвет чернил для canvas-слоёв. Раньше каждый рисующий модуль сам
     звал getComputedStyle(root) — чтение custom property сразу после
     записи форсирует синхронный пересчёт стилей, и так три раза за
     кадр. Теперь один кеш: пишет frame(), читают все остальные. */
  var inkColor = '10,10,10';

  var pc = document.getElementById('particles');
  var p  = pc && !reduce ? pc.getContext('2d') : null;
  var parts = [], word = 'UZ-STATUS';
  var holding = false, px = -9999, py = -9999;
  var RADIUS = 130;

  // Для putImageData ниже: буфер и масштаб храним отдельно, раз сама
  // отрисовка больше не идёт через ctx.setTransform + fillRect.
  var partsDpr = 1, partsImgData = null;

  function buildParticles() {
    if (!p) return;
    var rect = pc.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    partsDpr = Math.min(devicePixelRatio || 1, 2);
    pc.width  = Math.floor(rect.width  * partsDpr);
    pc.height = Math.floor(rect.height * partsDpr);
    partsImgData = p.createImageData(pc.width, pc.height);

    var w = rect.width, h = rect.height;

    var off = document.createElement('canvas');
    off.width = Math.floor(w); off.height = Math.floor(h);
    var o = off.getContext('2d');

    // Кегль подбираем так, чтобы слово заняло ~82% ширины поля
    var size = 120;
    o.font = '400 ' + size + 'px "Archivo Black", Impact, sans-serif';
    var measured = o.measureText(word).width || 1;
    size = Math.min(size * (w * 0.82) / measured, h * 0.52);

    o.font = '400 ' + size + 'px "Archivo Black", Impact, sans-serif';
    o.textAlign = 'center'; o.textBaseline = 'middle';
    o.fillStyle = '#000';
    o.fillText(word, w / 2, h / 2);

    var data = o.getImageData(0, 0, off.width, off.height).data;
    var step = w > 900 ? 4 : 5;

    parts = [];
    for (var y = 0; y < off.height; y += step) {
      for (var x = 0; x < off.width; x += step) {
        if (data[(y * off.width + x) * 4 + 3] < 128) continue;
        parts.push({
          hx: x, hy: y,                                  // дом — точка в букве
          sx: Math.random() * w, sy: Math.random() * h,  // точка разлёта
          x: Math.random() * w,  y: Math.random() * h,
          on: false                                      // уже протёрта?
        });
      }
    }
  }

  /* Раньше каждая частица рисовалась своим fillRect — для крупного слова
     на широком экране это тысячи вызовов Canvas2D на каждый из 60 кадров
     в секунду, без троттлинга (движение частиц должно быть плавным, тут
     не приторможенный шум спойлера). Позиции по-прежнему считаются
     каждый кадр (это просто арифметика), а сама отрисовка теперь —
     один putImageData поверх заранее заполненного буфера пикселей.
     putImageData работает в физических пикселях канваса, поэтому здесь
     координаты частиц (CSS px) умножаются на partsDpr. */
  function drawParticles() {
    if (!p || !partsImgData) return;
    var rect = pc.getBoundingClientRect();

    // Поле за экраном не рисуем — кадр экономится целиком
    if (rect.bottom < -200 || rect.top > innerHeight + 200) return;

    var W = pc.width, H = pc.height;
    if (!W || !H) return;

    var data = partsImgData.data;
    data.fill(0);

    var rgb = inkColor.split(',');
    var r0 = +rgb[0], g0 = +rgb[1], b0 = +rgb[2];

    // Размер точки в физических пикселях — тот же 1.6 CSS px, что рисовал
    // старый fillRect(x, y, 1.6, 1.6) через масштабирующий transform.
    var size = Math.max(1, Math.min(Math.round(1.6 * partsDpr), W, H));
    var maxX = W - size, maxY = H - size;

    for (var i = 0; i < parts.length; i++) {
      var q = parts[i], tx, ty, k;

      // Протёртая частица остаётся дома, пока кнопка зажата: иначе
      // слово не собрать — хвост разлетается быстрее, чем доводишь
      // курсор до конца строки.
      if (holding && !q.on && Math.hypot(q.hx - px, q.hy - py) < RADIUS) q.on = true;

      if (q.on) { tx = q.hx; ty = q.hy; k = 0.2; }
      else      { tx = q.sx; ty = q.sy; k = 0.035; }

      q.x += (tx - q.x) * k;
      q.y += (ty - q.y) * k;

      var dx = Math.max(0, Math.min(maxX, Math.round(q.x * partsDpr)));
      var dy = Math.max(0, Math.min(maxY, Math.round(q.y * partsDpr)));

      for (var by = 0; by < size; by++) {
        var row = (dy + by) * W;
        for (var bx = 0; bx < size; bx++) {
          var idx = (row + dx + bx) * 4;
          data[idx] = r0; data[idx + 1] = g0; data[idx + 2] = b0; data[idx + 3] = 255;
        }
      }
    }

    p.putImageData(partsImgData, 0, 0);
  }

  if (p) {
    var toLocal = function (e) {
      var r = pc.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
    };

    pc.addEventListener('pointerdown', function (e) {
      holding = true; toLocal(e);
      try { pc.setPointerCapture(e.pointerId); } catch (err) { /* не критично */ }
    });
    pc.addEventListener('pointermove', toLocal);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      pc.addEventListener(ev, function () {
        holding = false;
        for (var i = 0; i < parts.length; i++) parts[i].on = false;
      });
    });

    addEventListener('resize', buildParticles);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildParticles);
  }

  function setWord(w) {
    if (!p || w === word) return;
    word = w;

    var label = document.getElementById('trace-name');
    if (label) label.textContent = w;

    /* Кнопки переключаем здесь, а не в обработчике клика: слово меняет
       ещё и наведение на строку индекса, и без этой синхронизации на
       сцене оказывался один проект, а нажатой висела кнопка другого. */
    if (tabs) {
      [].forEach.call(tabs.querySelectorAll('button'), function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.word === w));
      });
    }

    buildParticles();
  }

  var tabs = document.getElementById('tabs');

  if (tabs) {
    tabs.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (btn) setWord(btn.dataset.word);
    });
  }

  // Наведение на строку индекса меняет слово на сцене
  var workList = document.getElementById('work');
  if (workList && !touch) {
    workList.addEventListener('pointerover', function (e) {
      var a = e.target.closest('a[data-word]');
      if (a) setWord(a.dataset.word);
    });
  }

  /* =========================================================
     Схема на первом экране
     Узел в центре, лучи к подписям. Два слоя: чем занимаюсь —
     плотным начертанием, какой я в работе — бледным. Курсор
     притягивает ближние лучи и оставляет за собой пунктир.
     ========================================================= */
  var wc = document.getElementById('spokes');
  var w2 = wc && !reduce ? wc.getContext('2d') : null;

  // Первый слой — ремесло, второй — характер. Порядок задаёт
  // расположение по кругу, так что чередование не случайно:
  // плотные подписи не должны сбиваться в одну сторону.
  var SPOKES = [
    { t: 'JAVA',          bold: true  },
    { t: 'docker',        bold: false },
    { t: 'SPRING BOOT',   bold: true  },
    { t: 'postgresql',    bold: false },
    { t: 'ORACLE',        bold: true  },
    { t: 'python',        bold: false },
    { t: 'PL/SQL',        bold: true  },
    { t: 'jwt',           bold: false },
    { t: 'MYID',          bold: true  },
    { t: 'weblogic',      bold: false },
    { t: 'E-KEY',         bold: true  },
    { t: 'maven',         bold: false },
    { t: 'IABS',          bold: true  },
    { t: 'nginx',         bold: false },
    { t: 'UZ-STATUS',     bold: true  },
    { t: 'junit',         bold: false },
    { t: 'TELEGRAM BOTS', bold: true  }
  ];

  var spokes = [], trail = [], hubX = 0, hubY = 0, radius = 0;
  var TRAIL_MAX = 44;
  var compact = false;          // узкий экран: только плотный слой, мельче кегль

  function labelFont(bold) {
    var size = compact ? (bold ? 11 : 9) : (bold ? 14 : 11);
    return (bold ? '700 ' : '400 ') + size + 'px "Space Grotesk", system-ui, sans-serif';
  }

  function buildSpokes() {
    if (!w2) return;
    var rect = wc.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    var dpr = Math.min(devicePixelRatio || 1, 2);
    wc.width  = Math.floor(rect.width  * dpr);
    wc.height = Math.floor(rect.height * dpr);
    w2.setTransform(dpr, 0, 0, dpr, 0, 0);

    hubX = rect.width / 2;
    hubY = rect.height / 2;

    /* Узкий экран не вмещает тринадцать подписей: они наезжают друг на
       друга и уходят за край. Тогда остаётся только плотный слой —
       семь слов про ремесло — и кегль помельче. Отключать схему целиком
       нельзя: на телефоне первый экран и так самый скучный. */
    compact = rect.width < 760;
    var list = compact ? SPOKES.filter(function (x) { return x.bold; }) : SPOKES;

    /* Радиус ограничен не только экраном, но и самой длинной подписью:
       луч, дотянувшийся до края, увёл бы своё слово за пределы окна. */
    w2.font = labelFont(true);
    var widest = 0;
    for (var k = 0; k < list.length; k++) {
      widest = Math.max(widest, w2.measureText(list[k].t).width);
    }
    radius = Math.max(56, Math.min(
      Math.min(rect.width, rect.height) * 0.4,
      rect.width / 2 - widest - (compact ? 26 : 34)
    ));

    spokes = list.map(function (item, i) {
      var a = (i / list.length) * Math.PI * 2 - Math.PI / 2;
      return {
        t: item.t, bold: item.bold,
        base: a,                                   // угол покоя
        a: a,                                      // текущий угол
        drift: (Math.random() - 0.5) * 0.00022,    // медленное вращение
        len: item.bold ? 0.82 + Math.random() * 0.16 : 0.5 + Math.random() * 0.22,
        reach: 0                                   // насколько вытянут курсором
      };
    });
  }

  function drawSpokes(fade) {
    if (!w2) return;
    var rect = wc.getBoundingClientRect();
    var w = rect.width, h = rect.height;

    w2.clearRect(0, 0, w, h);
    if (fade <= 0.01 || !spokes.length) { trail.length = 0; return; }

    var ink = inkColor;
    var hasPointer = !touch && mx > 0;

    // Угол и удалённость курсора относительно узла
    var pa = 0, pd = 0;
    if (hasPointer) {
      pa = Math.atan2(my - hubY, mx - hubX);
      pd = Math.min(1, Math.hypot(mx - hubX, my - hubY) / radius);
    }

    var i, sp;

    for (i = 0; i < spokes.length; i++) {
      sp = spokes[i];
      sp.base += sp.drift;

      var bend = 0, near = 0;
      if (hasPointer) {
        // Разница углов, приведённая к диапазону -PI..PI
        var diff = pa - sp.base;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        near = Math.max(0, 1 - Math.abs(diff) / 0.85);
        bend = diff * near * 0.55;                 // луч доворачивается к курсору
      }

      sp.a += (sp.base + bend - sp.a) * 0.08;
      sp.reach += ((near * pd * 0.3) - sp.reach) * 0.08;

      var len = radius * (sp.len + sp.reach);
      var ex = hubX + Math.cos(sp.a) * len;
      var ey = hubY + Math.sin(sp.a) * len;

      var alpha = (sp.bold ? 0.55 + near * 0.45 : 0.2 + near * 0.3) * fade;
      w2.strokeStyle = 'rgba(' + ink + ',' + alpha.toFixed(3) + ')';
      w2.lineWidth = sp.bold ? 1 + near * 0.9 : 0.8;
      w2.beginPath();
      w2.moveTo(hubX, hubY);
      w2.lineTo(ex, ey);
      w2.stroke();

      // Подпись на конце луча, отодвинутая наружу
      var right = Math.cos(sp.a) >= 0;
      var pad = compact ? 7 : 10;
      w2.font = labelFont(sp.bold);
      w2.textAlign = right ? 'left' : 'right';
      w2.textBaseline = 'middle';
      w2.fillStyle = 'rgba(' + ink + ',' +
        ((sp.bold ? 0.85 + near * 0.15 : 0.3 + near * 0.35) * fade).toFixed(3) + ')';
      w2.fillText(sp.bold ? sp.t : sp.t.toUpperCase(), ex + (right ? pad : -pad), ey);
    }

    // След курсора — пунктир из квадратов, как в чертеже
    if (hasPointer) {
      var last = trail[trail.length - 1];
      if (!last || Math.hypot(last.x - mx, last.y - my) > 7) {
        trail.push({ x: mx, y: my });
        if (trail.length > TRAIL_MAX) trail.shift();
      }
      for (i = 0; i < trail.length; i++) {
        var k = i / trail.length;                  // хвост бледнее головы
        var sz = 1.4 + k * 1.6;
        w2.fillStyle = 'rgba(' + ink + ',' + (k * 0.55 * fade).toFixed(3) + ')';
        w2.fillRect(trail[i].x - sz / 2, trail[i].y - sz / 2, sz, sz);
      }
    } else if (trail.length) {
      trail.length = 0;
    }

    // Узел последним, чтобы лучи уходили под него
    var hub = compact ? 8 : 11;
    w2.fillStyle = 'rgba(' + ink + ',' + (0.95 * fade).toFixed(3) + ')';
    w2.fillRect(hubX - hub / 2, hubY - hub / 2, hub, hub);
  }

  if (w2) {
    addEventListener('resize', buildSpokes);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildSpokes);
  }

  /* =========================================================
     Свой курсор
     ========================================================= */
  var cur = document.getElementById('cursor');
  var cx = innerWidth / 2, cy = innerHeight / 2, mx = cx, my = cy;
  var hudCoord = document.getElementById('hud-coord');

  if (!touch && !reduce) {
    addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (hudCoord) {
        hudCoord.textContent =
          'X ' + String(Math.round(mx)).padStart(4, '0') +
          ' Y ' + String(Math.round(my)).padStart(4, '0');
      }
    }, { passive: true });

    if (cur) document.addEventListener('pointerover', function (e) {
      var hit = e.target.closest('#particles, .work a, .mail, .note, .btn, .tabs button, #menu a');
      cur.classList.toggle('wide', !!hit);
      if (!hit) return;
      cur.querySelector('.lbl').textContent =
        e.target.closest('#particles') ? 'HOLD' :
        e.target.closest('.mail')      ? 'WRITE' :
        e.target.closest('.work a')    ? 'OPEN'  : 'GO';
    });
  }

  /* =========================================================
     Экраны за HUD-строками (см. #hud-scrim-top/bot в styles.css)
     Их высота меряется с реальных .hud-top/.hud-bot, а не задаётся
     константой: она меняется от ширины экрана (на узких — hud-right
     переносится на отдельную строку), от масштаба системного шрифта,
     и вообще от любой правки текста в шапке. ResizeObserver держит её
     точной без ручной подгонки на каждое такое изменение.
     ========================================================= */
  (function () {
    var top = document.getElementById('hud-scrim-top');
    var bot = document.getElementById('hud-scrim-bot');
    var topRow = document.querySelector('.hud-top');
    var botRow = document.querySelector('.hud-bot');
    if (!top || !bot || !topRow || !botRow) return;

    function sync() {
      root.style.setProperty('--hud-top-h', topRow.getBoundingClientRect().height + 'px');
      root.style.setProperty('--hud-bot-h', botRow.getBoundingClientRect().height + 'px');
    }

    sync();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync);

    if ('ResizeObserver' in window) {
      new ResizeObserver(sync).observe(topRow);
      new ResizeObserver(sync).observe(botRow);
    } else {
      // Старые браузеры: хотя бы на смену ширины экрана — сюда же
      // попадает и поворот телефона.
      addEventListener('resize', sync);
    }
  })();

  /* =========================================================
     Линейка слева
     ========================================================= */
  var rulerBox = document.getElementById('ruler');
  if (rulerBox) {
    var html = '';
    for (var ry = 0; ry < 2400; ry += 20) {
      var big = ry % 100 === 0;
      html += '<i class="' + (big ? 'big' : '') + '" style="top:' + ry + 'px"></i>';
      if (big && ry) html += '<b style="top:' + ry + 'px">' + ry + '</b>';
    }
    rulerBox.innerHTML = html;
  }

  /* =========================================================
     Полноэкранное меню
     ========================================================= */
  var menuBtn = document.getElementById('menu-btn');
  var menu = document.getElementById('menu');

  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () { toggleMenu(menu.hidden); });
    menu.addEventListener('click', function (e) { if (e.target.tagName === 'A') toggleMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { toggleMenu(false); menuBtn.focus(); }
    });
    matchMedia('(min-width: 900px)').addEventListener('change', function (e) {
      if (e.matches) toggleMenu(false);
    });
  }

  function toggleMenu(open) {
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
    // Пока меню открыто, фон скроллиться не должен
    document.body.style.overflow = open ? 'hidden' : '';
  }

  /* =========================================================
     Спойлер
     Заглушка на месте ненаписанного текста: россыпь мерцающих
     точек. Перенесено из v1 (spoiler.js) — там так помечались
     разделы, до которых не дошли руки.

     Мерцание даёт именно пересыпание точек заново каждый кадр,
     а не их движение. Сетку из CSS для этого не взять: там точки
     всегда стоят рядами, а нужен случайный шум.
     ========================================================= */
  var SP_DENSITY = 0.07;    // точек на пиксель площади — как в v1
  var SP_FPS = 22;          // реже 60: спокойнее для глаза и дешевле
  var spoilers = [], spoilerAt = 0;

  function buildSpoilers() {
    spoilers = [];

    // Пустая заглушка: под точками ничего нет
    [].forEach.call(document.querySelectorAll('.spoiler'), function (el) {
      addSpoiler(el, el);
    });

    /* Блок с текстом: точки лежат поверх и никуда не деваются.
       Раскрытия нет намеренно — это визуальная метка, а не спойлер
       из мессенджера. Сам текст остаётся в разметке: он нужен поиску
       и скринридеру, прячется только цветом, поэтому блок сохраняет
       ровно ту же высоту, а канвас точно совпадает с его площадью. */
    [].forEach.call(document.querySelectorAll('.spoilered'), function (box) {
      var content = box.querySelector('.sp-content');
      if (!content) return;
      box.classList.add('is-hidden');
      addSpoiler(box, box);
    });
  }

  /* host — элемент, по которому меряем площадь; mount — куда класть канвас */
  function addSpoiler(host, mount) {
    var cv = mount.querySelector('canvas');
    if (!cv) {
      cv = document.createElement('canvas');
      cv.setAttribute('aria-hidden', 'true');
      mount.appendChild(cv);
    }
    var item = { el: host, cv: cv, ctx: cv.getContext('2d'), w: 0, h: 0, dpr: 0, count: 0, done: false };
    sizeSpoiler(item);
    spoilers.push(item);
    if (reduce) paintSpoiler(item);   // без анимации — один статичный кадр
    return item;
  }

  function sizeSpoiler(item) {
    var r = item.el.getBoundingClientRect();
    var dpr = Math.min(devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(r.width));
    var h = Math.max(1, Math.round(r.height));
    if (item.w === w && item.h === h && item.dpr === dpr) return;

    item.w = w; item.h = h; item.dpr = dpr;
    item.cv.width = Math.round(w * dpr);
    item.cv.height = Math.round(h * dpr);
    item.count = Math.round(w * h * SP_DENSITY);

    /* Буфер под шум пересоздаём только при реальном ресайзе, не на
       каждой отрисовке — см. paintSpoiler ниже за тем, почему он
       вообще нужен. */
    item.imgData = item.ctx.createImageData(item.cv.width, item.cv.height);
  }

  /* Раньше здесь был цикл fillRect на каждую точку (для крупного блока —
     до ~12 000 отдельных вызовов Canvas2D за один пересып, 22 раза в
     секунду, да ещё со сменой globalAlpha перед каждым, что не даёт
     браузеру ничего склеить в пачку). Теперь шум собирается один раз
     в обычный typed array и уходит на экран одним putImageData —
     на порядки дешевле при той же плотности точек. putImageData не
     учитывает transform канваса, поэтому координаты здесь сразу
     в физических пикселях (device pixels), не в CSS-пикселях. */
  function paintSpoiler(item) {
    var W = item.cv.width, H = item.cv.height;
    if (!W || !H) return;

    var data = item.imgData.data;
    data.fill(0);   // быстрый нативный memset, а не Uint8ClampedArray(...) заново

    var rgb = inkColor.split(',');
    var r0 = +rgb[0], g0 = +rgb[1], b0 = +rgb[2];

    // Блок dpr×dpr эмулирует тот же 1-CSS-пиксельный квадрат, что рисовал
    // старый fillRect(x, y, 1, 1) — иначе точки на retina-экране станут
    // вчетверо мельче и шум поредеет визуально.
    var block = Math.max(1, Math.min(Math.round(item.dpr) || 1, W, H));
    var maxX = W - block, maxY = H - block;

    for (var i = 0; i < item.count; i++) {
      var alpha = (0.25 + Math.random() * 0.75) * 255;
      var x0 = (Math.random() * (maxX + 1)) | 0;
      var y0 = (Math.random() * (maxY + 1)) | 0;

      for (var by = 0; by < block; by++) {
        var row = (y0 + by) * W;
        for (var bx = 0; bx < block; bx++) {
          var idx = (row + x0 + bx) * 4;
          data[idx] = r0; data[idx + 1] = g0; data[idx + 2] = b0; data[idx + 3] = alpha;
        }
      }
    }

    item.ctx.putImageData(item.imgData, 0, 0);
  }

  function drawSpoilers(now) {
    if (reduce || !spoilers.length || now - spoilerAt < 1000 / SP_FPS) return;
    spoilerAt = now;

    for (var i = 0; i < spoilers.length; i++) {
      var item = spoilers[i];
      if (item.done) continue;                             // раскрыт — рисовать нечего
      var r = item.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;   // за экраном не пересыпаем
      sizeSpoiler(item);
      paintSpoiler(item);
    }
  }

  addEventListener('resize', function () {
    for (var i = 0; i < spoilers.length; i++) sizeSpoiler(spoilers[i]);
  });

  /* =========================================================
     Появление блоков по скроллу
     Прячем только после того, как скрипт точно работает: класс
     js стоит выше. Страховочный таймер на случай, когда вкладка
     открыта в фоне и наблюдатель не срабатывает.
     ========================================================= */
  (function () {
    var items = document.querySelectorAll('.up');
    if (!items.length || reduce || !('IntersectionObserver' in window)) return;

    var safety = setTimeout(showAll, 2500);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);   // иначе блок дёргается при обратной прокрутке
      });
    }, { rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { io.observe(el); });
    addEventListener('pagehide', function () { clearTimeout(safety); });

    function showAll() { items.forEach(function (el) { el.classList.add('in'); }); }
  })();

  /* =========================================================
     Один кадр на всё: скролл, инверсия, HUD, зерно, частицы,
     курсор. Отдельные rAF-циклы конкурировали бы между собой.
     ========================================================= */
  var PAPER_LIGHT = [232, 232, 230], INK_LIGHT = [10, 10, 10];
  var PAPER_DARK  = [8, 8, 8],       INK_DARK  = [233, 233, 231];

  var giant = document.getElementById('giant');
  var bar = document.getElementById('progress');
  var hudSect = document.getElementById('hud-sect');
  var hudCount = document.getElementById('hud-count');
  var navLinks = [].slice.call(document.querySelectorAll('#hud-nav a[href^="#"]'));

  var SECTIONS = [
    { id: 'hero',       label: '01 / Intro' },
    { id: 'about',      label: '02 / About' },
    { id: 'index',      label: '03 / Work' },
    { id: 'trace',      label: '04 / Trace' },
    { id: 'stack',      label: '05 / Stack' },
    { id: 'experience', label: '06 / Experience' },
    { id: 'notes',      label: '07 / Notes' },
    { id: 'contact',    label: '08 / Contact' }
  ].filter(function (s) { return document.getElementById(s.id); });

  var lastLabel = '', lastNav = null, lastInv = -1;
  var heroEl = document.getElementById('hero');
  var idxEl  = document.getElementById('index');
  // Секции — тоже один раз, а не document.getElementById в цикле каждый кадр
  var sectionEls = SECTIONS.map(function (s) { return document.getElementById(s.id); });

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function frame(now) {
    // — скролл
    if (smooth) {
      target = scrollY;
      current += (target - current) * 0.085;
      if (Math.abs(target - current) < 0.05) current = target;
      view.style.transform = 'translate3d(0,' + (-current) + 'px,0)';
    } else {
      current = scrollY;
    }

    // — первый экран уезжает вглубь
    var hp = clamp01(current / innerHeight);
    if (giant) {
      giant.style.transform = 'scale(' + (1 + hp * 0.45) + ')';
      giant.style.opacity = String(1 - hp * 1.15);
    }
    /* Схема проявляется, когда уходит заголовок: первый экран читается
       в два такта. Появляется рано (с 0.12), чтобы её не пропустил тот,
       кто прокрутил чуть-чуть.

       Гаснет по нижнему краю первого экрана, а не по кратности вьюпорта:
       канвас зафиксирован на весь экран, и привязка к hp оставляла его
       поверх раздела About на невысоких окнах. */
    var sf = 0;
    if (heroEl) {
      /* Гаснет по тому, сколько осталось до нижнего края первого экрана:
         канвас зафиксирован на весь вьюпорт, и к приходу раздела About
         он обязан быть чистым, иначе схема ляжет поверх текста. */
      var left = heroEl.offsetTop + heroEl.offsetHeight - current - innerHeight;
      sf = Math.min(
        clamp01((hp - 0.2) / 0.3),
        clamp01(left / (innerHeight * 0.35))
      );
    }
    drawSpokes(sf);

    // — инверсия листа: цвета не переключаются классом, а
    //   интерполируются по позиции. Лист темнеет постепенно.
    var idx = idxEl;
    if (idx) {
      var startAt = idx.offsetTop - innerHeight * 0.55;
      var inv = clamp01((current - startAt) / (innerHeight * 0.5));

      /* setProperty на :root форсирует пересчёт стилей всего документа —
         дальше по кадру ждут ещё восемь offsetTop, которым нужен чистый
         layout, так что грязные стили от этой записи бьют по ним же.
         Пишем только когда инверсия реально сдвинулась хотя бы на 1/255
         (иначе округлённый rgb() и так не изменится), а вне диапазона
         перехода (inv === 0 или === 1) — не пишем вообще. */
      if (Math.abs(inv - lastInv) > 1 / 255) {
        lastInv = inv;
        var paperStr =
          Math.round(lerp(PAPER_LIGHT[0], PAPER_DARK[0], inv)) + ',' +
          Math.round(lerp(PAPER_LIGHT[1], PAPER_DARK[1], inv)) + ',' +
          Math.round(lerp(PAPER_LIGHT[2], PAPER_DARK[2], inv));
        inkColor =
          Math.round(lerp(INK_LIGHT[0], INK_DARK[0], inv)) + ',' +
          Math.round(lerp(INK_LIGHT[1], INK_DARK[1], inv)) + ',' +
          Math.round(lerp(INK_LIGHT[2], INK_DARK[2], inv));

        var st = root.style;
        st.setProperty('--paper', paperStr);
        st.setProperty('--ink', inkColor);
        // На чёрном зерно должно светлеть, а не затемнять
        if (gc) gc.style.mixBlendMode = inv > 0.5 ? 'screen' : 'multiply';
      }
    }

    // — HUD
    if (bar) bar.style.width = (maxScroll ? (current / maxScroll) * 100 : 0) + '%';

    var seen = SECTIONS[0], line = current + innerHeight * 0.4;
    for (var i = 0; i < SECTIONS.length; i++) {
      var el = sectionEls[i];
      if (el && el.offsetTop <= line) seen = SECTIONS[i];
    }
    if (seen && seen.label !== lastLabel) {
      lastLabel = seen.label;
      if (hudSect) hudSect.textContent = seen.label;

      var link = navLinks.filter(function (a) { return a.getAttribute('href') === '#' + seen.id; })[0];
      if (lastNav) lastNav.removeAttribute('aria-current');
      if (link) link.setAttribute('aria-current', 'true');
      lastNav = link || null;
    }

    if (hudCount && idx) {
      // Число записей берём из самого списка, а не константой: добавили
      // проект — счётчик обязан сойтись сам.
      var total = workList ? workList.children.length : 0;
      var n = Math.round(clamp01((current - idx.offsetTop + innerHeight * 0.6) / innerHeight) * total);
      hudCount.textContent = String(Math.min(total, Math.max(0, n))).padStart(2, '0') +
        ' — ' + String(total).padStart(2, '0') + ' index';
    }

    // — курсор
    if (cur && !touch && !reduce) {
      cx = lerp(cx, mx, 0.2); cy = lerp(cy, my, 0.2);
      cur.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
    }

    drawGrain(now);
    drawParticles();
    drawSpoilers(now);

    requestAnimationFrame(frame);
  }

  if (reduce) {
    buildSpoilers();               // статичный кадр, без мерцания
  } else {
    buildParticles();
    buildSpokes();
    buildSpoilers();
    requestAnimationFrame(frame);
  }

  /* Якоря: прокручиваем сами, сглаживание делает основной цикл. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href') === '#') return;
    var el = document.querySelector(a.getAttribute('href'));
    if (!el) return;
    e.preventDefault();
    scrollTo({ top: el.offsetTop, behavior: reduce ? 'auto' : 'smooth' });
  });
})();
