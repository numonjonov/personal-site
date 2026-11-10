/* v11 — по мотивам bleibtgleich.dev. Без библиотек.
   «Капли»: каждое слово в .goo получает свой SVG-фильтр — размытие
   (по горизонтали сильнее) + порог прозрачности. Пока размытие большое,
   слово — чёрная капля; по мере скролла оно стягивается в буквы, слова
   одно за другим. Когда слово собралось, фильтр снимается — текст чистый.
   Плюс: пролетающие карточки работ, счётчик, процент скролла, меню,
   пять цветовых тем (квадрат слева вверху), прелоадер в процентах. */
(function () {
  'use strict';
  var doc = document, win = window, root = doc.documentElement;
  var $ = function (id) { return doc.getElementById(id); };
  var reduced = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var NS = 'http://www.w3.org/2000/svg';
  root.classList.add('js');

  /* ---------- Темы ---------- */
  var theme = 0;
  try { theme = +(sessionStorage.getItem('v11-theme') || 0); } catch (e) { /* без хранилища */ }
  var applyTheme = function () {
    if (theme) root.setAttribute('data-theme', String(theme)); else root.removeAttribute('data-theme');
    var m = doc.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', getComputedStyle(doc.body || root).getPropertyValue('--bg').trim() || '#fff');
  };
  applyTheme();
  $('theme-dot').addEventListener('click', function () {
    theme = (theme + 1) % 5;
    try { sessionStorage.setItem('v11-theme', String(theme)); } catch (e) { /* ок */ }
    applyTheme();
  });

  /* ---------- Капли: разбиваем на слова, у каждого свой фильтр ---------- */
  var defs = $('goo-defs');
  var words = [];   // { el, blur, last }
  var groups = [];  // { el, words: [...], intro }
  var n = 0;
  function makeFilter(id) {
    var f = doc.createElementNS(NS, 'filter');
    f.setAttribute('id', id);
    f.setAttribute('x', '-60%'); f.setAttribute('y', '-120%');
    f.setAttribute('width', '220%'); f.setAttribute('height', '340%');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    var b = doc.createElementNS(NS, 'feGaussianBlur');
    b.setAttribute('stdDeviation', '0 0');
    var m = doc.createElementNS(NS, 'feColorMatrix');
    m.setAttribute('type', 'matrix');
    m.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9');
    f.appendChild(b); f.appendChild(m); defs.appendChild(f);
    return b;
  }
  function split(node, list) {
    Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
      if (ch.nodeType === 3) {
        var parts = ch.textContent.split(/(\s+)/);
        var frag = doc.createDocumentFragment();
        parts.forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(doc.createTextNode(p)); return; }
          var s = doc.createElement('span'); s.className = 'w'; s.textContent = p;
          frag.appendChild(s); list.push(s);
        });
        node.replaceChild(frag, ch);
      } else if (ch.nodeType === 1) split(ch, list);
    });
  }
  Array.prototype.forEach.call(doc.querySelectorAll('.goo'), function (g) {
    var list = [];
    split(g, list);
    var ws = list.map(function (el) {
      var id = 'g' + (n++);
      return { el: el, id: id, blur: makeFilter(id), last: -1 };
    });
    words = words.concat(ws);
    groups.push({ el: g, words: ws, intro: g.classList.contains('name') });
  });

  // a = 1 — капля, a = 0 — чистое слово
  function setWord(w, a) {
    var q = Math.round(a * 100) / 100;
    if (q === w.last) return;
    w.last = q;
    if (q <= 0.01) {
      w.el.style.filter = 'none'; w.el.style.transform = 'none';
      return;
    }
    var size = parseFloat(getComputedStyle(w.el).fontSize) || 80;
    var k = size / 100;
    w.blur.setAttribute('stdDeviation', (q * 30 * k).toFixed(2) + ' ' + (q * 10 * k).toFixed(2));
    w.el.style.filter = 'url(#' + w.id + ')';
    w.el.style.transform = 'translate3d(' + (-q * 0.12).toFixed(3) + 'em,' + (q * 0.08).toFixed(3) + 'em,0) scaleX(' + (1 + q * 0.18).toFixed(3) + ')';
  }
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
  function stagger(g, p) {
    var ws = g.words, len = ws.length, step = len > 1 ? 0.45 / (len - 1) : 0;
    ws.forEach(function (w, i) {
      var pi = clamp((p - i * step) / 0.5, 0, 1);
      setWord(w, 1 - ease(pi));
    });
  }

  /* ---------- Прелоадер и сборка имени ---------- */
  var introStart = -1;
  function startIntro() { introStart = performance.now(); }
  var loader = $('loader'), seen = false;
  try { seen = sessionStorage.getItem('v11-seen') === '1'; sessionStorage.setItem('v11-seen', '1'); } catch (e) { /* ок */ }
  if (reduced || seen) { loader.classList.add('gone'); startIntro(); }
  else {
    var ln = $('loader-n'), t0 = performance.now();
    var tick = function (t) {
      var p = clamp((t - t0) / 1000, 0, 1);
      ln.textContent = Math.round(ease(p) * 100) + '%';
      if (p < 1) win.requestAnimationFrame(tick);
      else { loader.classList.add('done'); startIntro(); win.setTimeout(function () { loader.classList.add('gone'); }, 700); }
    };
    win.requestAnimationFrame(tick);
    win.setTimeout(function () { if (introStart < 0) { loader.classList.add('done', 'gone'); startIntro(); } }, 3500);
  }

  /* ---------- Скролл: капли, карточки, счётчик, процент ---------- */
  var work = doc.querySelector('.work'), flyers = Array.prototype.slice.call(doc.querySelectorAll('.flyers li'));
  var counter = $('counter'), progress = $('progress');
  var queued = false;
  function frame() {
    queued = false;
    var vh = win.innerHeight;
    groups.forEach(function (g) {
      if (reduced) { g.words.forEach(function (w) { setWord(w, 0); }); return; }
      var p;
      if (g.intro) p = introStart < 0 ? 0 : clamp((performance.now() - introStart) / 1300, 0, 1);
      else {
        var r = g.el.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) return;
        p = clamp((vh * 0.92 - r.top) / (vh * 0.62), 0, 1);
      }
      stagger(g, p);
    });
    if (work) {
      var wr = work.getBoundingClientRect();
      var wp = clamp(-wr.top / Math.max(1, wr.height - vh), 0, 1);
      flyers.forEach(function (li, i) {
        var sp = parseFloat(li.style.getPropertyValue('--sp')) || 1;
        var y = reduced ? 0 : (0.45 - wp) * vh * 1.5 * sp;
        li.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0) rotate(' + (reduced ? 0 : ((i % 2 ? 1 : -1) * (wp - .5) * 6)).toFixed(2) + 'deg)';
      });
    }
    if (counter) {
      var cr = counter.getBoundingClientRect();
      var cp = clamp((vh - cr.top) / (vh * 0.8), 0, 1);
      counter.textContent = String(Math.round(cp * 99)).padStart(2, '0');
    }
    var max = Math.max(1, root.scrollHeight - vh);
    progress.textContent = Math.round(clamp(win.scrollY / max, 0, 1) * 100) + '%';
  }
  var request = function () { if (!queued) { queued = true; win.requestAnimationFrame(frame); } };
  win.addEventListener('scroll', request, { passive: true });
  win.addEventListener('resize', function () { words.forEach(function (w) { w.last = -1; }); request(); });
  // имя собирается по таймеру — крутим кадры, пока интро не закончится
  (function introLoop() {
    frame();
    if (introStart < 0 || performance.now() - introStart < 1500) win.requestAnimationFrame(introLoop);
  })();

  /* ---------- Меню ---------- */
  var menu = $('menu'), pill = $('menu-pill');
  function setMenu(open) {
    menu.hidden = !open;
    pill.textContent = open ? 'Close' : 'Menu';
    pill.setAttribute('aria-expanded', String(open));
    doc.body.style.overflow = open ? 'hidden' : '';
    if (open) { var a = menu.querySelector('a'); if (a) a.focus({ preventScroll: true }); }
  }
  pill.addEventListener('click', function () { setMenu(menu.hidden); });
  $('foot-menu').addEventListener('click', function (e) { e.preventDefault(); setMenu(true); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); pill.focus(); } });
})();
