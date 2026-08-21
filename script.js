/* =========================================================
   Personal website — vanilla JS, no dependencies.
   Разделы: язык, тема, меню, прокрутка, анимации, копирование почты.
   ========================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* приватный режим */ }
  }
  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  /* =======================================================
     ЯЗЫК — английский по умолчанию, выбор запоминается
     ======================================================= */
  var LANGS = ['en', 'ru', 'uz'];
  var langSwitch  = document.getElementById('lang-switch');
  var langThumb   = langSwitch.querySelector('.lang-thumb');
  var langButtons = Array.prototype.slice.call(langSwitch.querySelectorAll('button'));
  var dict = window.I18N.en;

  function moveThumb(btn) {
    langThumb.style.width = btn.offsetWidth + 'px';
    langThumb.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
  }

  function applyLang(lang) {
    dict = window.I18N[lang] || window.I18N.en;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var value = dict[el.getAttribute('data-i18n')];
      if (typeof value === 'string') el.textContent = value;
    });

    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var value = dict[el.getAttribute('data-i18n-aria')];
      if (value) el.setAttribute('aria-label', value);
    });

    var description = document.querySelector('meta[name="description"]');
    if (description && dict['meta.description']) {
      description.setAttribute('content', dict['meta.description']);
    }

    root.setAttribute('lang', lang);

    langButtons.forEach(function (btn) {
      var active = btn.getAttribute('data-lang') === lang;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
      if (active) moveThumb(btn);
    });

    startRoles();
  }

  var savedLang = read('lang');
  var initialLang = LANGS.indexOf(savedLang) !== -1 ? savedLang : 'en';

  langSwitch.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-lang]');
    if (!btn) return;
    var lang = btn.getAttribute('data-lang');
    applyLang(lang);
    store('lang', lang);
  });

  window.addEventListener('resize', function () {
    var active = langSwitch.querySelector('button.active');
    if (active) moveThumb(active);
  });

  /* =======================================================
     HERO — слова печатаются по очереди
     ======================================================= */
  var roleEl = document.getElementById('role');
  var roleTimer = null;

  function startRoles() {
    clearTimeout(roleTimer);

    var roles = dict['hero.roles'] || window.I18N.en['hero.roles'];
    if (!roles || !roles.length) return;

    // Если система просит меньше анимации — просто показываем первое слово
    if (reduceMotion) {
      roleEl.textContent = roles[0];
      return;
    }

    var wordIndex = 0;
    var charIndex = 0;
    var deleting = false;

    (function tick() {
      var word = roles[wordIndex];
      charIndex += deleting ? -1 : 1;
      roleEl.textContent = word.slice(0, charIndex);

      var delay = deleting ? 45 : 85;

      if (!deleting && charIndex === word.length) {
        deleting = true;
        delay = 1600;                       // пауза на дописанном слове
      } else if (deleting && charIndex === 0) {
        deleting = false;
        wordIndex = (wordIndex + 1) % roles.length;
        delay = 320;
      }

      roleTimer = setTimeout(tick, delay);
    })();
  }

  applyLang(initialLang);

  /* =======================================================
     ТЕМА — по умолчанию системная, ручной выбор запоминается
     ======================================================= */
  var savedTheme = read('theme');
  if (savedTheme === 'dark' || savedTheme === 'light') root.setAttribute('data-theme', savedTheme);

  document.getElementById('theme-toggle').addEventListener('click', function () {
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var current = root.getAttribute('data-theme') || (systemDark ? 'dark' : 'light');
    var next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    store('theme', next);
  });

  /* =======================================================
     МОБИЛЬНОЕ МЕНЮ
     ======================================================= */
  var menuToggle = document.getElementById('menu-toggle');
  var nav = document.getElementById('nav');

  function closeMenu() {
    nav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }

  menuToggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });

  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') closeMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  /* =======================================================
     ПРОКРУТКА — шапка, прогресс-бар, кнопка «наверх»
     ======================================================= */
  var header   = document.getElementById('header');
  var progress = document.getElementById('scroll-progress');
  var toTop    = document.getElementById('to-top');
  var ticking  = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(function () {
      var y = window.scrollY;
      var max = document.documentElement.scrollHeight - window.innerHeight;

      header.classList.toggle('scrolled', y > 8);
      progress.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
      toTop.classList.toggle('show', y > 500);

      ticking = false;
    });
  }

  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* =======================================================
     ПОЯВЛЕНИЕ БЛОКОВ — с небольшой задержкой друг за другом
     ======================================================= */
  var revealables = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        var siblings = Array.prototype.slice.call(entry.target.parentNode.children);
        var order = siblings.filter(function (el) { return el.classList.contains('reveal'); })
                            .indexOf(entry.target);

        entry.target.style.transitionDelay = Math.max(0, order) * 80 + 'ms';
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    revealables.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('visible'); });
  }

  /* =======================================================
     СЧЁТЧИКИ — цифры набегают, когда попадают в экран
     ======================================================= */
  var counters = document.querySelectorAll('.counter');

  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;

    if (reduceMotion) { el.textContent = String(target); return; }

    var duration = 1400;
    var start = null;

    function frame(now) {
      if (start === null) start = now;
      var p = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);          // ease-out-cubic
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  if ('IntersectionObserver' in window) {
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        counterObserver.unobserve(entry.target);
      });
    }, { threshold: 0.6 });

    counters.forEach(function (el) { counterObserver.observe(el); });
  } else {
    counters.forEach(function (el) { el.textContent = el.getAttribute('data-count'); });
  }

  /* =======================================================
     ЧАСЫ В ШАПКЕ HERO — техническая деталь
     ======================================================= */
  var clock = document.getElementById('clock');

  function tickClock() {
    var d = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    clock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  tickClock();
  setInterval(tickClock, 1000);

  /* =======================================================
     КОПИРОВАНИЕ ПОЧТЫ + всплывающее уведомление
     ======================================================= */
  var toast = document.getElementById('toast');
  var toastTimer = null;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  document.getElementById('copy-mail').addEventListener('click', function () {
    var mail = this.getAttribute('data-mail');
    var done = function () { showToast(dict['contact.copied'] || 'Email copied'); };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(mail).then(done, fallback);
    } else {
      fallback();
    }

    // Запасной способ для http:// и старых браузеров
    function fallback() {
      var input = document.createElement('textarea');
      input.value = mail;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* ничего не делаем */ }
      document.body.removeChild(input);
    }
  });

  /* =======================================================
     ПОДСВЕТКА ПУНКТА МЕНЮ ДЛЯ ТЕКУЩЕЙ СЕКЦИИ
     ======================================================= */
  var navLinks = {};
  document.querySelectorAll('.nav a').forEach(function (link) {
    navLinks[link.getAttribute('href').slice(1)] = link;
  });

  if ('IntersectionObserver' in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = navLinks[entry.target.id];
        if (!link || !entry.isIntersecting) return;
        Object.keys(navLinks).forEach(function (id) { navLinks[id].classList.remove('active'); });
        link.classList.add('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    document.querySelectorAll('main section[id]').forEach(function (section) {
      navObserver.observe(section);
    });
  }

  /* =======================================================
     ГОД В ПОДВАЛЕ
     ======================================================= */
  document.getElementById('year').textContent = new Date().getFullYear();
})();
