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

  // На телефоне фокус в поле ввода поднимает экранную клавиатуру,
  // поэтому возвращаем курсор в строку только там, где есть мышь
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function focusInput() {
    if (!coarse) input.focus();
  }

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

  // Добавляет узел на экран сразу, без очереди — для строки, которая
  // печатается вручную посимвольно (runTyped), ей нельзя ждать своей очереди.
  function appendNow(node) {
    screenEl.appendChild(node);
    screenEl.scrollTop = screenEl.scrollHeight;
  }

  // Очередь вывода: результат команды всплывает строка за строкой,
  // а не выводится разом. Свой ввод пользователя (первая строка в
  // пустой очереди) появляется практически без задержки.
  var outQueue = [];
  var outTimer = null;
  var idleCallbacks = [];      // ждут, пока очередь опустеет (например, фокус в поле ввода)

  function pumpQueue() {
    if (outTimer) return;

    if (!outQueue.length) {
      var callbacks = idleCallbacks;
      idleCallbacks = [];
      callbacks.forEach(function (cb) { cb(); });
      return;
    }

    appendNow(outQueue.shift());
    outTimer = setTimeout(function () { outTimer = null; pumpQueue(); }, reduceMotion ? 0 : 45);
  }

  function print(node) {
    outQueue.push(node);
    pumpQueue();
  }

  // Выполняет cb сразу, если вывод уже закончился, иначе — когда закончится
  function whenIdle(cb) {
    if (!outQueue.length && !outTimer) cb();
    else idleCallbacks.push(cb);
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

  function link(href, text, external, innerHtml) {
    var attrs = external ? ' target="_blank" rel="noopener"' : '';
    var inner = innerHtml || esc(text);
    return '<a href="' + esc(href) + '"' + attrs + '>' + inner + (external ? ' ↗' : '') + '</a>';
  }

  /* Блок «шума» шириной в chars символов — выглядит как спойлер в Телеграме.
     Раскрывать нечего: под ним нет текста, это заглушка на месте будущего.
     Сами точки рисует spoiler.js. */
  function noise(chars) {
    return '<span class="spoiler" aria-hidden="true" style="width:' + chars + 'ch"></span>';
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
      printLine('out', '<b>' + esc(t.whoami.role) + '</b>' + (t.whoami.line ? ' — ' + esc(t.whoami.line) : ''));
    },

    about: function () {
      var hide = SITE.about && SITE.about.spoiler;
      t.about.paragraphs.forEach(function (p, i) {
        printLine(i === 0 ? 'out strong' : 'out', hide ? noise(p.length) : esc(p));
      });
      printGap();
      printKV(t.about.facts.map(function (f) { return [f[0], esc(f[1])]; }));
    },

    experience: function () {
      t.experience.items.forEach(function (item, i) {
        var date = (SITE.experience[i] || {}).date || '';
        if (date) printLine('accent', esc(date));
        printLine('out strong', esc(item.role) + (item.org ? ' <span class="dim">— ' + esc(item.org) + '</span>' : ''));
        if (item.text) printLine('out', esc(item.text));
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
        var group = SITE.skills[i] || [];
        var items = group.items || group;               // допускаем и простой массив
        if (!items.length) items = t.skills.extra;

        var text = items.join(', ');
        return [label, group.spoiler ? noise(text.length) : esc(text)];
      });
      printKV(rows);
    },

    contact: function () {
      if (t.contact.lead) { printLine('out', esc(t.contact.lead)); printGap(); }

      var mail = SITE.email
        ? link('mailto:' + SITE.email, SITE.email, false)
        : '<span class="dim">—</span>';

      var rows = [[t.contact.labels.email, mail]];

      SITE.socials.forEach(function (s) {
        var html;
        if (s.spoilerChars) {
          html = link(s.url, null, true, esc(s.label) + noise(s.spoilerChars));
        } else {
          html = link(s.url, s.label || s.url.replace(/^https?:\/\//, ''), true);
        }
        rows.push([t.contact.labels[s.key] || s.key, html]);
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

      if (arg && window.BG.variants.indexOf(arg) !== -1) {
        window.BG.setVariant(arg);
        printLine('out', 'bg → ' + arg);
        return;
      }
      if (arg === 'on' || arg === 'off') {
        var on = window.BG.toggle(arg === 'on');
        printLine('out', esc(t.ui.bgChanged) + ' ' + (on ? 'on' : 'off'));
        return;
      }
      if (arg) {
        printLine('err', esc(t.ui.bgUsage) + ' | ' + window.BG.variants.join(' | '));
        return;
      }

      // без аргумента — кнопка в подсказках и голая команда листают стили по кругу
      printLine('out', 'bg → ' + window.BG.cycle());
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

    clear: function () {
      outQueue = [];
      if (outTimer) { clearTimeout(outTimer); outTimer = null; }
      var callbacks = idleCallbacks; idleCallbacks = [];
      screenEl.innerHTML = '';
      callbacks.forEach(function (cb) { cb(); });
    },

    sudo: function () { printLine('accent', esc(t.ui.sudo)); }
  };

  // Псевдонимы: короткие и привычные варианты
  var ALIASES = { exp: 'experience', ls: 'help', '?': 'help', me: 'whoami', cls: 'clear', mail: 'contact' };

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
  }

  // Печатает команду посимвольно, как будто её набирают на клавиатуре,
  // и только потом выполняет. Используется везде, где команда запускается
  // не самим пользователем с клавиатуры, а кликом — кнопки, язык, тема.
  function runTyped(command, done) {
    if (reduceMotion) {
      run(command);
      whenIdle(done || function () {});
      return;
    }

    var line = el('p', 'line cmd', '');
    appendNow(line);

    var i = 0;
    (function type() {
      if (i <= command.length) {
        line.textContent = command.slice(0, i++);
        setTimeout(type, 55);
        return;
      }
      run(command, { echo: false });
      whenIdle(done || function () {});
    })();
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
    runTyped('lang ' + btn.getAttribute('data-lang'), focusInput);
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
    runTyped('theme', focusInput);
  });

  /* =======================================================
     ПОДСКАЗКИ ПОД ЭКРАНОМ
     ======================================================= */
  VISIBLE.forEach(function (name) {
    var btn = el('button', '', esc(name));
    btn.type = 'button';
    btn.addEventListener('click', function () {
      runTyped(name, focusInput);
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

  // Клик по пустому месту возвращает курсор в строку ввода.
  // На телефоне не трогаем: там это открывало бы клавиатуру при каждом тапе.
  if (!coarse) {
    document.addEventListener('click', function (e) {
      if (e.target.closest('a, button, input')) return;
      if (window.getSelection().toString()) return;   // не мешаем выделять текст
      input.focus();
    });
  }

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
     ПАСХАЛКА: KONAMI-КОД
     Работает в любом месте страницы, не только в поле ввода —
     классика жанра. При совпадении печатает одну строку, как sudo.
     ======================================================= */
  var KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
                'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  var konamiPos = 0;

  document.addEventListener('keydown', function (e) {
    var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if (key === KONAMI[konamiPos]) {
      konamiPos++;
      if (konamiPos === KONAMI.length) {
        konamiPos = 0;
        printLine('accent', esc(t.ui.konami));
        printGap();
      }
    } else {
      // если этот же символ мог бы начать код заново — не сбрасываем совсем
      konamiPos = (key === KONAMI[0]) ? 1 : 0;
    }
  });

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
  runTyped('whoami');
})();
