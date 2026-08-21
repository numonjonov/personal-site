/* =========================================================
   Движок терминала: разбор команд, вывод, история, языки, тема.
   Без зависимостей.
   ========================================================= */
(function () {
  'use strict';

  var SITE = window.SITE;
  var root = document.documentElement;

  var screenEl = document.getElementById('screen');
  var input    = document.getElementById('input');
  var form     = document.getElementById('form');
  var hintsBox = document.getElementById('hints');

  var LANGS = ['en', 'ru', 'uz'];
  var lang  = 'en';
  var t     = window.I18N.en;          // текущий словарь

  var history = [];                     // введённые команды
  var histPos = -1;

  /* ---------- Мелкие помощники ---------- */
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function read(k)     { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Достаёт значение по пути вида "ui.placeholder"
  function get(path) {
    return path.split('.').reduce(function (acc, key) {
      return acc && acc[key] !== undefined ? acc[key] : undefined;
    }, t);
  }

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  // Подставляет {handle} и {version} из site.js
  function fill(str) {
    return String(str)
      .replace('{handle}', esc(SITE.handle))
      .replace('{version}', esc(SITE.version || ''));
  }

  function print(node) {
    screenEl.appendChild(node);
    screenEl.scrollTop = screenEl.scrollHeight;
  }

  function printLine(cls, html) { print(el('p', 'line ' + cls, html)); }
  function printGap() { print(el('div', 'gap')); }

  // Список «ключ — значение» одинаковой ширины
  function printKV(pairs) {
    var dl = el('dl', 'kv');
    pairs.forEach(function (pair) {
      dl.appendChild(el('dt', '', esc(pair[0])));
      dl.appendChild(el('dd', '', pair[1]));   // значение уже подготовлено
    });
    print(dl);
  }

  function link(href, text, external) {
    var attrs = external ? ' target="_blank" rel="noopener"' : '';
    return '<a href="' + esc(href) + '"' + attrs + '>' + esc(text) + (external ? ' ↗' : '') + '</a>';
  }

  /* =======================================================
     КОМАНДЫ
     ======================================================= */
  var COMMANDS = {

    help: function () {
      printLine('out', esc(t.help.intro));
      printKV(t.help.rows.map(function (row) {
        return [row[0], '<span class="dim">' + esc(row[1]) + '</span>'];
      }));
      printLine('dim', esc(t.help.footer));
    },

    whoami: function () {
      print(el('p', 'banner', esc(SITE.name)));
      printLine('out', '<b>' + esc(t.whoami.role) + '</b> — ' + esc(t.whoami.line));
    },

    about: function () {
      t.about.paragraphs.forEach(function (p, i) {
        printLine(i === 0 ? 'out strong' : 'out', esc(p));
      });
      printGap();
      printKV(t.about.facts.map(function (f) { return [f[0], esc(f[1])]; }));
    },

    experience: function () {
      t.experience.items.forEach(function (item, i) {
        var date = (SITE.experience[i] || {}).date || '';
        printLine('accent', esc(date));
        printLine('out strong', esc(item.role) + ' <span class="dim">— ' + esc(item.org) + '</span>');
        printLine('out', esc(item.text));
        if (i < t.experience.items.length - 1) printGap();
      });
    },

    projects: function () {
      SITE.projects.forEach(function (proj, i) {
        var text = t.projects.items[i] || { title: '—', text: '' };

        var head = el('p', 'line proj-head');
        head.innerHTML = '<span class="accent">' + esc(proj.id) + '</span> ' +
                         '<b>' + esc(text.title) + '</b>' +
                         (proj.featured ? ' <span class="badge">' + esc(t.ui.featured) + '</span>' : '');
        print(head);

        printLine('out', esc(text.text));
        printLine('dim', '[' + proj.tags.map(esc).join(', ') + ']');

        var links = proj.links.map(function (l) {
          return link(l.url, t.projects.linkLabels[l.key] || l.key, true);
        }).join('   ');
        printLine('out', links);

        if (i < SITE.projects.length - 1) printGap();
      });
      printGap();
      printLine('dim', t.projects.note);
    },

    skills: function () {
      var rows = t.skills.groups.map(function (label, i) {
        var items = (SITE.skills[i] && SITE.skills[i].length) ? SITE.skills[i] : t.skills.extra;
        return [label, esc(items.join(', '))];
      });
      printKV(rows);
    },

    contact: function () {
      printLine('out', esc(t.contact.lead));
      printGap();

      var mail = SITE.email
        ? link('mailto:' + SITE.email, SITE.email, false)
        : '<span class="dim">—</span>';

      var rows = [[t.contact.labels.email, mail]];

      SITE.socials.forEach(function (s) {
        var shown = s.label || s.url.replace(/^https?:\/\//, '');
        rows.push([t.contact.labels[s.key] || s.key, link(s.url, shown, true)]);
      });
      printKV(rows);
    },

    lang: function (arg) {
      if (!arg) { printLine('dim', esc(t.ui.langUsage)); return; }
      if (LANGS.indexOf(arg) === -1) { printLine('err', esc(t.ui.langUsage)); return; }
      applyLang(arg, true);
    },

    theme: function (arg) {
      if (arg && arg !== 'light' && arg !== 'dark') { printLine('err', esc(t.ui.themeUsage)); return; }
      applyTheme(arg || (currentTheme() === 'dark' ? 'light' : 'dark'), true);
    },

    open: function (arg) {
      if (!arg) { printLine('dim', esc(t.ui.openUsage)); return; }

      var proj = SITE.projects.filter(function (p) { return p.id === arg; })[0];
      if (!proj || !proj.links.length) {
        printLine('err', esc(t.ui.openMissing) + ' ' + esc(arg));
        return;
      }

      var url = proj.links[0].url;
      printLine('out', esc(t.ui.opening) + ' ' + esc(proj.id) + ' → ' + esc(url));
      if (url && url !== '#') window.open(url, '_blank', 'noopener');
    },

    bg: function (arg) {
      if (!window.BG) { printLine('err', esc(t.ui.bgMissing)); return; }
      if (arg && arg !== 'on' && arg !== 'off') { printLine('err', esc(t.ui.bgUsage)); return; }

      var on = window.BG.toggle(arg ? arg === 'on' : undefined);
      printLine('out', esc(t.ui.bgChanged) + ' ' + (on ? 'on' : 'off'));
    },

    cursor: function (arg) {
      if (!window.CURSOR || !window.CURSOR.available) {
        printLine('err', esc(t.ui.cursorMissing));
        return;
      }
      if (arg && arg !== 'on' && arg !== 'off') { printLine('err', esc(t.ui.cursorUsage)); return; }

      var on = window.CURSOR.toggle(arg ? arg === 'on' : undefined);
      printLine('out', esc(t.ui.cursorChanged) + ' ' + (on ? 'on' : 'off'));
    },

    clear: function () { screenEl.innerHTML = ''; },

    sudo: function () { printLine('accent', esc(t.ui.sudo)); }
  };

  // Псевдонимы: короткие и привычные варианты
  var ALIASES = { exp: 'experience', ls: 'help', '?': 'help', me: 'whoami', cls: 'clear', mail: 'contact' };

  // Что показывать в подсказках и в автодополнении
  var VISIBLE = ['whoami', 'about', 'experience', 'projects', 'skills', 'contact', 'theme', 'bg', 'clear'];
  var COMPLETABLE = Object.keys(COMMANDS).concat(Object.keys(ALIASES));

  /* =======================================================
     ЗАПУСК КОМАНДЫ
     ======================================================= */
  function run(raw, options) {
    var line = String(raw || '').trim();
    if (!line) return;

    if (!options || options.echo !== false) {
      printLine('cmd', esc(line));
    }

    var parts = line.split(/\s+/);
    var name  = parts[0].toLowerCase();
    var arg   = (parts[1] || '').toLowerCase();

    name = ALIASES[name] || name;

    if (COMMANDS[name]) {
      COMMANDS[name](arg);
    } else {
      printLine('err', esc(t.ui.notFound) + ' ' + esc(parts[0]));
      printLine('dim', t.ui.notFoundHint);
    }

    if (name !== 'clear') printGap();
    screenEl.scrollTop = screenEl.scrollHeight;
  }

  /* =======================================================
     ЯЗЫК
     ======================================================= */
  var langSwitch  = document.getElementById('lang-switch');
  var langThumb   = langSwitch.querySelector('.lang-thumb');
  var langButtons = Array.prototype.slice.call(langSwitch.querySelectorAll('button'));
  var statusLang  = document.getElementById('status-lang');

  function moveThumb(btn) {
    langThumb.style.width = btn.offsetWidth + 'px';
    langThumb.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
  }

  function applyLang(next, announce) {
    lang = LANGS.indexOf(next) !== -1 ? next : 'en';
    t = window.I18N[lang];

    // Текст в разметке
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      var value = get(node.getAttribute('data-i18n'));
      if (typeof value === 'string') node.textContent = value;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (node) {
      var value = get(node.getAttribute('data-i18n-aria'));
      if (typeof value === 'string') node.setAttribute('aria-label', value);
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(function (node) {
      var spec = node.getAttribute('data-i18n-attr').split('|');
      var value = get(spec[1]);
      if (typeof value === 'string') node.setAttribute(spec[0], value);
    });

    root.setAttribute('lang', lang);
    statusLang.textContent = lang;

    langButtons.forEach(function (btn) {
      var active = btn.getAttribute('data-lang') === lang;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
      if (active) moveThumb(btn);
    });

    store('lang', lang);
    if (announce) { printLine('out', esc(t.ui.langChanged) + ' ' + lang); }
  }

  langSwitch.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-lang]');
    if (!btn) return;
    run('lang ' + btn.getAttribute('data-lang'));
    input.focus();
  });

  window.addEventListener('resize', function () {
    var active = langSwitch.querySelector('button.active');
    if (active) moveThumb(active);
  });

  /* =======================================================
     ТЕМА
     ======================================================= */
  var statusTheme = document.getElementById('status-theme');

  function currentTheme() {
    return root.getAttribute('data-theme') ||
           (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function applyTheme(next, announce) {
    root.setAttribute('data-theme', next);
    statusTheme.textContent = next;
    store('theme', next);
    if (announce) printLine('out', esc(t.ui.themeChanged) + ' ' + next);
  }

  document.getElementById('theme-toggle').addEventListener('click', function () {
    run('theme');
    input.focus();
  });

  /* =======================================================
     ПОДСКАЗКИ ПОД ЭКРАНОМ
     ======================================================= */
  VISIBLE.forEach(function (name) {
    var btn = el('button', '', esc(name));
    btn.type = 'button';
    btn.addEventListener('click', function () {
      run(name);
      input.focus();
    });
    hintsBox.appendChild(btn);
  });

  /* =======================================================
     ВВОД: отправка, история, автодополнение
     ======================================================= */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = input.value.trim();
    if (!value) return;

    history.push(value);
    histPos = history.length;
    input.value = '';
    run(value);
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      histPos = Math.max(0, histPos - 1);
      input.value = history[histPos];
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!history.length) return;
      histPos = Math.min(history.length, histPos + 1);
      input.value = histPos === history.length ? '' : history[histPos];
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      var typed = input.value.trim().toLowerCase();
      if (!typed) return;
      var match = COMPLETABLE.filter(function (name) { return name.indexOf(typed) === 0; });
      if (match.length === 1) {
        input.value = match[0] + ' ';
      } else if (match.length > 1) {
        printLine('cmd', esc(typed));
        printLine('dim', match.map(esc).join('   '));
        printGap();
      }
    }

    if (e.key === 'l' && e.ctrlKey) {     // привычный ctrl+L
      e.preventDefault();
      COMMANDS.clear();
    }
  });

  // Клик по пустому месту возвращает курсор в строку ввода
  document.addEventListener('click', function (e) {
    if (e.target.closest('a, button, input')) return;
    if (window.getSelection().toString()) return;     // не мешаем выделять текст
    input.focus();
  });

  /* =======================================================
     ЧАСЫ В СТАТУСНОЙ СТРОКЕ
     ======================================================= */
  document.getElementById('win-title').textContent = SITE.handle + ' — ~';

  var clock = document.getElementById('clock');
  (function tick() {
    var d = new Date();
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    clock.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    setTimeout(tick, 1000);
  })();

  /* =======================================================
     СТАРТ
     ======================================================= */
  var savedLang  = read('lang');
  var savedTheme = read('theme');

  applyLang(LANGS.indexOf(savedLang) !== -1 ? savedLang : 'en', false);
  applyTheme(savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : currentTheme(), false);

  printLine('dim', fill(t.ui.boot1));
  printLine('dim', t.ui.boot2);
  printGap();

  // Первая команда печатается сама — показывает, как всё работает
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var demo = 'whoami';

  if (reduceMotion) {
    run(demo);
    input.focus();
  } else {
    var typedLine = el('p', 'line cmd', '');
    print(typedLine);

    var i = 0;
    (function type() {
      if (i <= demo.length) {
        typedLine.textContent = demo.slice(0, i++);
        setTimeout(type, 90);
        return;
      }
      run(demo, { echo: false });
      input.focus();
    })();
  }
})();
