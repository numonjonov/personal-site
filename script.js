/* Personal website — small vanilla-JS layer, no dependencies. */
(function () {
  'use strict';

  var root = document.documentElement;

  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }
  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  /* ---------- Language: English by default, choice is remembered ---------- */
  var LANGS = ['en', 'ru', 'uz'];
  var langSwitch = document.getElementById('lang-switch');
  var langButtons = langSwitch.querySelectorAll('button');

  function applyLang(lang) {
    var dict = window.I18N[lang] || window.I18N.en;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var value = dict[el.getAttribute('data-i18n')];
      if (value) el.textContent = value;
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
    });
  }

  var savedLang = read('lang');
  applyLang(LANGS.indexOf(savedLang) !== -1 ? savedLang : 'en');

  langSwitch.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-lang]');
    if (!btn) return;
    var lang = btn.getAttribute('data-lang');
    applyLang(lang);
    store('lang', lang);
  });

  /* ---------- Theme: follows the system, manual choice is remembered ---------- */
  var savedTheme = read('theme');
  if (savedTheme === 'dark' || savedTheme === 'light') root.setAttribute('data-theme', savedTheme);

  document.getElementById('theme-toggle').addEventListener('click', function () {
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var current = root.getAttribute('data-theme') || (systemDark ? 'dark' : 'light');
    var next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    store('theme', next);
  });

  /* ---------- Mobile menu ---------- */
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

  /* ---------- Header border on scroll ---------- */
  var header = document.getElementById('header');
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 8); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Reveal blocks on scroll ---------- */
  var revealables = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealables.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('visible'); });
  }

  /* ---------- Highlight the nav item of the current section ---------- */
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

  /* ---------- Footer year ---------- */
  document.getElementById('year').textContent = new Date().getFullYear();
})();
