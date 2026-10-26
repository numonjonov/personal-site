/* numonjonov.com — весь движок в одном файле, без зависимостей.
   Разделы-вкладки, печать терминала, scramble заголовков, бинарный фон,
   курсор, мобильное меню, форма контакта с лог-выводом.
   Всё, что движется, выключается при prefers-reduced-motion. */
(function () {
  'use strict';
  const doc = document, win = window;
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  doc.documentElement.classList.add('js');

  const $ = (s, r) => (r || doc).querySelector(s);
  const $$ = (s, r) => Array.from((r || doc).querySelectorAll(s));

  /* ====================== Разделы ====================== */
  const sections = $$('main > [data-section]');
  const navLinks = $$('[data-nav]');
  const header = $('.site-header');
  const menuBtn = $('.menu-btn');
  const siteTitle = doc.title;

  function sectionOf(hash) {
    const id = (hash || '').replace(/^#/, '') || 'home';
    return sections.some(s => s.dataset.section === id) ? id : 'home';
  }

  function show(id, push) {
    if (!sections.length) return;
    sections.forEach(s => {
      const on = s.dataset.section === id;
      s.classList.toggle('is-active', on);
      s.toggleAttribute('aria-hidden', !on);
    });
    navLinks.forEach(a => {
      const on = a.dataset.nav === id;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    doc.body.dataset.section = id;
    closeMenu();
    if (push) history.pushState(null, '', id === 'home' ? location.pathname + location.search : '#' + id);
    win.scrollTo(0, 0);
    // body тоже несёт data-section — ищем только внутри main
    const active = sections.find(s => s.dataset.section === id);
    const label = $('[data-title]', active);
    doc.title = id === 'home' ? siteTitle : (label ? label.dataset.title + ' — ' : '') + siteTitle.split(' — ')[0];
    scrambleIn(active);
  }

  if (sections.length) {
    doc.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"], a[href*="#"]');
      if (!a || a.target === '_blank') return;
      const url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname) return;
      const id = sectionOf(url.hash);
      e.preventDefault();
      show(id, true);
    });
    win.addEventListener('popstate', () => show(sectionOf(location.hash), false));
    show(sectionOf(location.hash), false);
  }

  /* ====================== Меню на телефоне ====================== */
  function closeMenu() {
    if (!header) return;
    header.classList.remove('open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
  }
  if (menuBtn && header) {
    menuBtn.addEventListener('click', () => {
      const open = header.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    doc.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  }

  /* ====================== Терминал ====================== */
  /* Строки лежат в разметке. Печатаются только команды (.cmd), по 45 мс на
     символ; ответы появляются целиком. Печать идёт, пока терминал в кадре. */
  const term = $('[data-terminal]');
  if (term) {
    const rows = $$(':scope > div', term);
    const script = rows.map(r => ({ el: r, cmd: r.classList.contains('cmd'), text: r.textContent }));
    const caret = doc.createElement('span');
    caret.className = 'caret'; caret.textContent = '_'; caret.setAttribute('aria-hidden', 'true');

    const finish = () => {
      rows.forEach(r => r.classList.add('shown'));
      term.removeAttribute('data-typing');
      const last = rows[rows.length - 1];
      if (last) last.appendChild(caret);
    };

    if (reduced.matches) finish();
    else {
      term.setAttribute('data-typing', '');
      let i = 0, pos = 0, timer = 0, running = false;
      const step = () => {
        timer = 0;
        if (i >= script.length) { finish(); return; }
        const line = script[i];
        line.el.classList.add('shown');
        if (!line.cmd) { line.el.textContent = line.text; i++; timer = win.setTimeout(step, 120); return; }
        pos++;
        line.el.textContent = line.text.slice(0, pos);
        line.el.appendChild(caret);
        if (pos >= line.text.length) { i++; pos = 0; timer = win.setTimeout(step, 350); }
        else timer = win.setTimeout(step, 45);
      };
      const start = () => { if (!running) { running = true; if (!timer) timer = win.setTimeout(step, 400); } };
      const pause = () => { running = false; win.clearTimeout(timer); timer = 0; };
      if ('IntersectionObserver' in win) {
        new IntersectionObserver(es => es.forEach(e => e.isIntersecting && !doc.hidden ? start() : pause())).observe(term);
      } else start();
      doc.addEventListener('visibilitychange', () => doc.hidden ? pause() : start());
    }
  }

  /* ====================== Scramble ====================== */
  /* Заголовок собирается слева направо из мусорных глифов за 1.1 с.
     Нерешённые глифы цветные, решённые наследуют цвет темы.
     data-loop — бесконечный цикл: 2.4 с держим, 1.8 с рассыпаем. */
  const GLYPHS = '!<>-_\\/[]{}=+*^?#';
  const PALETTE = ['#00ff41', '#00ff41', '#00ff41', '#00ff41', '#00ff41', '#00e5ff', '#00e5ff', '#00e5ff', '#00e5ff', '#518dff', '#518dff', '#518dff', '#c084fc', '#c084fc', '#c084fc', '#ffffff'];
  const ONCE = 1100, CYCLE = 4200, HOLD = 2400;

  function prepare(el) {
    if (el.dataset.ready) return;
    el.dataset.ready = '1';
    const text = el.textContent;
    el.dataset.text = text;
    el.textContent = '';
    const sr = doc.createElement('span'); sr.className = 'sr-only'; sr.textContent = text;
    const vis = doc.createElement('span'); vis.setAttribute('aria-hidden', 'true');
    for (const ch of text) { const s = doc.createElement('span'); s.dataset.c = ''; s.textContent = ch; vis.appendChild(s); }
    el.append(vis, sr);
    el._spans = Array.from(vis.children);
    el._glyphs = Array.from(text);
  }

  function paint(el, progress) {
    const g = el._glyphs, n = g.length, revealed = Math.floor(Math.max(0, Math.min(1, progress)) * n);
    el._spans.forEach((s, i) => {
      const ch = g[i];
      if (i < revealed || /\s/.test(ch)) { s.textContent = ch; s.style.removeProperty('--c'); return; }
      const r = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      s.textContent = r;
      s.style.setProperty('--c', PALETTE[(r.codePointAt(0) * 7 + i * 17) % PALETTE.length]);
    });
  }

  function animateOnce(el) {
    if (el.dataset.done || reduced.matches) { el.dataset.done = '1'; return; }
    prepare(el);
    if (el._timer) return;
    const t0 = performance.now();
    const tick = () => {
      const p = (performance.now() - t0) / ONCE;
      if (p >= 1 || doc.hidden) { paint(el, 1); clearInterval(el._timer); el._timer = 0; el.dataset.done = '1'; return; }
      paint(el, p);
    };
    tick();
    el._timer = setInterval(tick, 70);
  }

  function animateLoop(el, on) {
    prepare(el);
    clearInterval(el._timer); el._timer = 0; paint(el, 1);
    if (!on || reduced.matches) return;
    const t0 = performance.now();
    el._timer = setInterval(() => {
      const phase = (performance.now() - t0) % CYCLE;
      paint(el, phase < HOLD ? 1 : (phase - HOLD) / (CYCLE - HOLD));
    }, 70);
  }

  function scrambleIn(root) {
    if (!root) return;
    $$('.scramble', root).forEach(el => {
      if (el.hasAttribute('data-loop')) return;
      // ждём, пока элемент попадёт в кадр
      if (!('IntersectionObserver' in win)) { animateOnce(el); return; }
      if (el._io) return;
      el._io = new IntersectionObserver(es => {
        if (es.some(e => e.isIntersecting)) { animateOnce(el); el._io.disconnect(); el._io = null; }
      }, { threshold: .1 });
      el._io.observe(el);
    });
  }
  // страницы без разделов (кейсы, 404) — запускаем для всего документа
  if (!sections.length) scrambleIn(doc);
  // на странице с разделами show() уже вызвал scrambleIn для активного

  $$('.scramble[data-loop]').forEach(el => {
    if (!('IntersectionObserver' in win)) { animateLoop(el, true); return; }
    new IntersectionObserver(es => animateLoop(el, es.some(e => e.isIntersecting) && !doc.hidden), { threshold: .1 }).observe(el);
  });
  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) $$('.scramble[data-loop]').forEach(el => animateLoop(el, false));
  });

  /* ====================== Карточки: пульс рамки в кадре ====================== */
  const cards = $$('.card-btn');
  if (cards.length && 'IntersectionObserver' in win) {
    const io = new IntersectionObserver(es => es.forEach(e => e.target.toggleAttribute('data-visible', e.isIntersecting)), { threshold: .1 });
    cards.forEach(c => io.observe(c));
  }

  /* ====================== Бинарное поле ====================== */
  /* Два кадра в секунду, ячейки по кеглю шрифта, нули и единицы из атласа. */
  const matrix = $('#matrix');
  if (matrix && matrix.getContext) {
    const ctx = matrix.getContext('2d');
    const atlas = doc.createElement('canvas'), ink = atlas.getContext('2d');
    let w = 0, h = 0, cell = 12, ratio = 1, timer = 0;
    const size = () => {
      const b = matrix.getBoundingClientRect(), st = win.getComputedStyle(matrix);
      const r = Math.min(win.devicePixelRatio || 1, 1.5);
      if (w === b.width && h === b.height && ratio === r) return;
      w = b.width; h = b.height; ratio = r;
      cell = parseFloat(st.fontSize) || 12;
      matrix.width = Math.ceil(w * ratio); matrix.height = Math.ceil(h * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      atlas.width = Math.ceil(cell * ratio) * 2; atlas.height = Math.ceil(cell * ratio);
      ink.setTransform(ratio, 0, 0, ratio, 0, 0);
      ink.font = cell + 'px ' + st.fontFamily; ink.fillStyle = st.color; ink.textBaseline = 'top';
      ink.fillText('0', 0, 0); ink.fillText('1', atlas.width / ratio / 2, 0);
    };
    const paintMatrix = () => {
      timer = 0;
      if (doc.hidden) return;
      size();
      ctx.clearRect(0, 0, w, h);
      const tw = atlas.width / 2;
      for (let y = 0; y < h; y += cell)
        for (let x = 0; x < w; x += cell)
          ctx.drawImage(atlas, Math.random() < .5 ? 0 : tw, 0, tw, atlas.height, x, y, cell, cell);
      if (!reduced.matches) timer = win.setTimeout(paintMatrix, 500);
    };
    const resume = () => { win.clearTimeout(timer); timer = 0; if (!doc.hidden) paintMatrix(); };
    resume();
    doc.addEventListener('visibilitychange', resume);
    reduced.addEventListener('change', resume);
    win.addEventListener('resize', () => { if (!timer) paintMatrix(); }, { passive: true });
  }

  /* ====================== Курсор ====================== */
  /* Точка следует за мышью сразу, рамка догоняет с инерцией.
     Только мышь: на тач, при reduced-motion и по Tab — системный курсор. */
  const cur = $('#cursor');
  if (cur) {
    const point = $('.pt', cur), halo = $('.halo', cur);
    const fine = win.matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0, active = false, x = 0, y = 0, tx = 0, ty = 0, last = 0, lastTarget = null;
    const allowed = () => fine.matches && !reduced.matches;
    const hide = () => {
      active = false; last = 0; lastTarget = null;
      doc.body.removeAttribute('data-custom-cursor');
      cur.removeAttribute('data-visible'); cur.removeAttribute('data-interactive');
      win.cancelAnimationFrame(frame); frame = 0;
    };
    const draw = t => {
      const k = 1 - Math.pow(.72, Math.min(64, last ? t - last : 16.67) / 16.67);
      last = t;
      x += (tx - x) * k; y += (ty - y) * k;
      point.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0)';
      halo.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      if (active && Math.hypot(tx - x, ty - y) > .1) frame = win.requestAnimationFrame(draw);
      else { frame = 0; last = 0; }
    };
    const interactive = target => {
      if (target === lastTarget) return;
      lastTarget = target;
      const c = target instanceof Element ? target.closest('a,button,input,textarea,select,summary,label,[role="button"]') : null;
      cur.toggleAttribute('data-interactive', !!c && !c.matches(':disabled,[aria-disabled="true"]'));
    };
    const move = e => {
      if (!allowed() || e.pointerType !== 'mouse') { hide(); return; }
      tx = e.clientX; ty = e.clientY;
      if (!active) { x = tx; y = ty; active = true; doc.body.setAttribute('data-custom-cursor', ''); cur.setAttribute('data-visible', ''); }
      interactive(e.target);
      if (!frame) frame = win.requestAnimationFrame(draw);
    };
    const ripple = (px, py) => {
      const r = doc.createElement('span'); r.className = 'ripple';
      r.style.left = px + 'px'; r.style.top = py + 'px';
      cur.appendChild(r);
      r.addEventListener('animationend', () => r.remove(), { once: true });
    };
    doc.addEventListener('pointermove', move, { passive: true });
    doc.addEventListener('pointerover', e => { if (active) interactive(e.target); }, { passive: true });
    doc.addEventListener('pointerdown', e => { if (allowed() && e.pointerType === 'mouse') { move(e); ripple(e.clientX, e.clientY); } }, { passive: true });
    doc.addEventListener('pointerout', e => { if (!e.relatedTarget) hide(); });
    doc.addEventListener('keydown', e => { if (e.key === 'Tab') hide(); });
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) hide(); });
    win.addEventListener('blur', hide);
    fine.addEventListener('change', () => { if (!allowed()) hide(); });
    reduced.addEventListener('change', () => { if (!allowed()) hide(); });
  }

  /* ====================== Форма контакта ====================== */
  /* Бэкенда нет: письмо собирается и отдаётся почтовому клиенту через
     mailto. Всё, что происходит, пишется в terminal.log справа. */
  const form = $('#contact-form');
  const log = $('#contact-log');
  const say = lines => {
    if (!log) return;
    [].concat(lines).forEach(t => { const d = doc.createElement('div'); d.textContent = t; log.insertBefore(d, log.lastElementChild); });
    while (log.children.length > 11) log.removeChild(log.firstElementChild);
    log.scrollTop = log.scrollHeight;
  };
  if (form) {
    form.addEventListener('input', e => {
      const f = e.target; if (!f.name || f.type === 'hidden') return;
      const v = f.value;
      say('> ' + f.name + '_updated: "' + v.slice(0, 20) + (v.length > 20 ? '…' : '') + '"');
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (form.website && form.website.value) return; // ловушка для ботов
      const btn = $('button[type="submit"]', form);
      const name = form.name.value.trim(), email = form.email.value.trim(), message = form.message.value.trim();
      btn.disabled = true;
      btn.innerHTML = '<span class="spin"></span>' + btn.dataset.busy;
      say(['> processing_message...', '> validating_input...', '> composing_email...']);
      const subject = 'Message from ' + name + ' via numonjonov.com';
      const body = message + '\n\n— ' + name + ' <' + email + '>';
      win.setTimeout(() => {
        location.href = 'mailto:' + form.dataset.to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        say(['> handed_to_mail_client: ok', '> if nothing opened — write to ' + form.dataset.to]);
        btn.disabled = false;
        btn.innerHTML = btn.dataset.idle;
      }, 700);
    });
  }
})();
