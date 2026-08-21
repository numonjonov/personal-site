/* =========================================================
   Свой курсор в духе терминала.

   Вместо системной стрелки — прямоугольная каретка, как в
   консоли, и рамка, которая догоняет её с задержкой. Над
   ссылками и кнопками рамка раскрывается, над текстом
   каретка становится тонкой чертой.

   Наружу отдаёт window.CURSOR.toggle() / window.CURSOR.isOn() —
   ими пользуется команда cursor в терминале.
   ========================================================= */
(function () {
  'use strict';

  var root = document.documentElement;

  // На тачскрине курсора нет — и трогать нечего
  if (window.matchMedia('(pointer: coarse)').matches) {
    window.CURSOR = {
      available: false,                       // терминал по этому флагу скажет «недоступно»
      isOn: function () { return false; },
      toggle: function () { return false; }
    };
    return;
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var caret = document.createElement('div');
  caret.className = 'cursor-caret';

  var ring = document.createElement('div');
  ring.className = 'cursor-ring';

  document.body.appendChild(ring);
  document.body.appendChild(caret);

  var x = window.innerWidth / 2,  y = window.innerHeight / 2;   // где мышь
  var rx = x, ry = y;                                           // где рамка
  var enabled = true;
  var visible = false;
  var frame = null;

  var TEXT_SELECTOR = 'input, textarea, .screen, .line, p, dt, dd, h1, h2';
  var TAP_SELECTOR  = 'a, button, [role="button"]';

  function place() {
    caret.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    ring.style.transform  = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
  }

  function loop() {
    // Рамка догоняет каретку — отсюда ощущение веса
    rx += (x - rx) * 0.18;
    ry += (y - ry) * 0.18;
    place();
    frame = requestAnimationFrame(loop);
  }

  function show() {
    if (visible) return;
    visible = true;
    caret.classList.add('is-visible');
    ring.classList.add('is-visible');
  }

  function hide() {
    visible = false;
    caret.classList.remove('is-visible');
    ring.classList.remove('is-visible');
  }

  function onMove(e) {
    x = e.clientX;
    y = e.clientY;

    if (reduceMotion) { rx = x; ry = y; place(); }
    show();

    var target = e.target;
    var tap  = target.closest && target.closest(TAP_SELECTOR);
    var text = !tap && target.closest && target.closest(TEXT_SELECTOR);

    ring.classList.toggle('is-tap', !!tap);
    caret.classList.toggle('is-text', !!text);
  }

  function start() {
    enabled = true;
    root.setAttribute('data-cursor', 'on');

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', hide);
    document.addEventListener('mouseenter', show);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);

    if (!reduceMotion) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(loop);
    }
    place();
  }

  function stop() {
    enabled = false;
    root.removeAttribute('data-cursor');
    hide();

    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseleave', hide);
    document.removeEventListener('mouseenter', show);
    document.removeEventListener('mousedown', onDown);
    document.removeEventListener('mouseup', onUp);

    cancelAnimationFrame(frame);
  }

  function onDown() { ring.classList.add('is-down'); }
  function onUp()   { ring.classList.remove('is-down'); }

  window.CURSOR = {
    available: true,
    isOn: function () { return enabled; },
    toggle: function (on) {
      var next = on === undefined ? !enabled : !!on;
      if (next) start(); else stop();
      try { localStorage.setItem('cursor', next ? 'on' : 'off'); } catch (e) {}
      return next;
    }
  };

  var saved = null;
  try { saved = localStorage.getItem('cursor'); } catch (e) {}
  if (saved !== 'off') start(); else stop();
})();
