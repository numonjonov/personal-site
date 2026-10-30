/* numonjonov.com — документация проектов.
   Открывается на numonjonov.com/<slug> (список) и /<slug>/<путь>.md (документ).
   Файлы читаются из GitHub прямо в браузере (git trees + contents API),
   рендер — vendor/marked.min.js и vendor/highlight.min.js, подгружаются
   только когда адрес совпал с проектом из docs/projects.js.
   Владелец вводит fine-grained PAT (кнопка key) — он хранится в этом браузере
   и даёт чтение приватных репозиториев и кнопку edit: правка в textarea
   с предпросмотром, сохранение = коммит через Contents API.
   Никакого бэкенда: сайт статический, GitHub Pages.

   Оформление — прежний «чертёж» сайта (docs/docs.css). Скрипт сам строит
   всё тело страницы: чертёжную рамку с линейкой, зерно, свой курсор,
   полосу прогресса — и выключает терминальный styles.css, если тот
   подключён (404.html). Терминальный main.js на этих страницах не грузится. */
(function () {
  'use strict';
  const doc = document, win = window, root = doc.documentElement;
  const PROJECTS = win.DOCS_PROJECTS || [];
  const dec = s => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  const segs = location.pathname.split('/').filter(Boolean).map(dec);
  const project = segs.length ? PROJECTS.find(p => p.slug === segs[0]) : null;
  if (!project || !doc.body) return;

  const API = 'https://api.github.com';
  const VENDOR = ['/vendor/marked.min.js', '/vendor/highlight.min.js', '/vendor/highlight-powershell.min.js'];
  const FONTS = 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@400;500;700&display=swap';
  const SITE = 'Pahlavon Numonjonov';
  const KEY = 'docs.token';
  const base = '/' + project.slug;
  const repo = project.repo, branch = project.branch || 'main';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, r) => (r || doc).querySelector(s);
  const $$ = (s, r) => Array.from((r || doc).querySelectorAll(s));
  const encPath = p => p.split('/').map(encodeURIComponent).join('/');
  const state = { files: null, user: null, dirty: false, editor: null };
  let main;

  /* ====================== Хранилище ====================== */
  const mem = {
    get(k, s) { try { return (s || localStorage).getItem(k); } catch (e) { return null; } },
    set(k, v, s) { try { (s || localStorage).setItem(k, v); } catch (e) { /* приватный режим или переполнено — живём без кэша */ } },
    del(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const token = () => mem.get(KEY) || mem.get(KEY, sessionStorage) || '';

  /* ====================== GitHub API ====================== */
  async function gh(url, opt) {
    opt = opt || {};
    const h = Object.assign({ Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, opt.headers || {});
    const t = token();
    if (t) h.Authorization = 'Bearer ' + t;
    const r = await fetch(API + url, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined });
    if (!r.ok) {
      const e = new Error('GitHub ' + r.status);
      e.status = r.status;
      e.remaining = r.headers.get('x-ratelimit-remaining');
      try { e.detail = (await r.json()).message; } catch (x) { /* тело не json */ }
      throw e;
    }
    return opt.raw ? r.text() : r.json();
  }

  function describe(e) {
    if (e.status === 401) return { title: 'Key rejected (401)', text: 'GitHub did not accept the stored key. Enter a new fine-grained token with Contents access to ' + repo + '.', key: true };
    if (e.status === 404 && !token()) return { title: 'Private repository', text: repo + ' is not readable without a key. Only the owner can open these docs: enter a fine-grained token (Contents: read, or read & write to edit).', key: true };
    if (e.status === 404) return { title: 'Not found (404)', text: 'Branch ' + branch + ' or repository ' + repo + ' was not found, or the key has no access to it.', key: true };
    if (e.status === 403 && e.remaining === '0') return { title: 'API limit reached (403)', text: 'GitHub allows 60 anonymous requests per hour. Wait, or enter a key: with it the limit is 5000.', key: true };
    if (e.status === 403) return { title: 'Forbidden (403)', text: e.detail || 'The key has no permission for this operation.', key: true };
    if (e.status === 409 || e.status === 422) return { title: 'Conflict', text: e.detail || 'The file changed in the repository after it was opened. Reload, then repeat your changes.' };
    if (e instanceof TypeError) return { title: 'Network', text: 'Could not reach api.github.com: ' + e.message };
    return { title: 'Error', text: (e.detail || e.message || String(e)) };
  }

  function excluded(path) {
    return (project.exclude || []).some(x => x.endsWith('/') ? path.startsWith(x) : path === x);
  }

  async function loadTree(force) {
    const key = 'docs.tree.' + repo + '@' + branch;
    if (!force) {
      const c = mem.get(key, sessionStorage);
      if (c) { try { const o = JSON.parse(c); if (Date.now() - o.t < 180000) return o.files; } catch (e) { /* битый кэш */ } }
    }
    const data = await gh('/repos/' + repo + '/git/trees/' + encodeURIComponent(branch) + '?recursive=1');
    const files = data.tree
      .filter(n => n.type === 'blob' && /\.md$/i.test(n.path) && !excluded(n.path))
      .map(n => ({ path: n.path, sha: n.sha, size: n.size || 0 }));
    mem.set(key, JSON.stringify({ t: Date.now(), files }), sessionStorage);
    return files;
  }

  async function loadFile(file) {
    const key = 'docs.blob.' + file.sha;
    const c = mem.get(key, sessionStorage);
    if (c !== null) return c;
    const text = await gh('/repos/' + repo + '/contents/' + encPath(file.path) + '?ref=' + encodeURIComponent(branch),
      { raw: true, headers: { Accept: 'application/vnd.github.raw+json' } });
    mem.set(key, text, sessionStorage);
    return text;
  }

  function b64utf8(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  async function saveFile(file, content, message) {
    const res = await gh('/repos/' + repo + '/contents/' + encPath(file.path), {
      method: 'PUT',
      body: { message, content: b64utf8(content), sha: file.sha, branch },
    });
    const sha = res.content.sha;
    file.sha = sha; file.size = new TextEncoder().encode(content).length;
    mem.set('docs.blob.' + sha, content, sessionStorage);
    mem.set('docs.tree.' + repo + '@' + branch, JSON.stringify({ t: Date.now(), files: state.files }), sessionStorage);
    mem.del('docs.draft.' + repo + '/' + file.path);
    return res.commit && res.commit.sha;
  }

  async function whoami() {
    if (!token()) { state.user = null; return null; }
    if (state.user) return state.user;
    try { state.user = (await gh('/user')).login; } catch (e) { state.user = null; if (e.status === 401) state.badKey = true; }
    return state.user;
  }

  /* ====================== Markdown ====================== */
  const LANG = { plsql: 'sql', 'pl/sql': 'sql', oracle: 'sql', sqlplus: 'sql', tsql: 'sql', mysql: 'sql', pgsql: 'sql', postgresql: 'sql', postgres: 'sql',
    sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash', ps: 'powershell', ps1: 'powershell', pwsh: 'powershell',
    js: 'javascript', ts: 'typescript', yml: 'yaml', html: 'xml', htm: 'xml', svg: 'xml', txt: 'plaintext', text: 'plaintext', log: 'plaintext', http: 'plaintext' };
  let slugs;
  function slug(text) {
    let s = text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[`*_~[\]()]/g, '').trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'section';
    const n = slugs.get(s) || 0; slugs.set(s, n + 1);
    return n ? s + '-' + n : s;
  }
  let configured = false;
  function setupMarked() {
    if (configured) return; configured = true;
    marked.use({
      gfm: true,
      renderer: {
        heading(tok) {
          const id = slug(tok.text);
          return '<h' + tok.depth + ' id="' + esc(id) + '"><a class="anchor" href="#' + esc(id) + '" aria-hidden="true">#</a>' + this.parser.parseInline(tok.tokens) + '</h' + tok.depth + '>\n';
        },
        code(tok) {
          const raw = (tok.lang || '').trim().split(/\s+/)[0].toLowerCase();
          const lang = LANG[raw] || raw;
          let html, cls = 'hljs';
          if (lang && win.hljs && hljs.getLanguage(lang)) { html = hljs.highlight(tok.text, { language: lang, ignoreIllegals: true }).value; cls += ' language-' + esc(lang); }
          else html = esc(tok.text);
          return '<pre><div class="code-head"><span>' + esc(raw || 'text') + '</span><button type="button" class="copy" aria-label="Copy code">copy</button></div><code class="' + cls + '">' + html + '</code></pre>\n';
        },
        listitem(tok) {
          const inner = this.parser.parse(tok.tokens, !!tok.loose);
          const box = tok.task ? '<input type="checkbox" disabled' + (tok.checked ? ' checked' : '') + '> ' : '';
          return '<li' + (tok.task ? ' class="task"' : '') + '>' + box + inner + '</li>\n';
        },
      },
    });
  }
  function renderMarkdown(md) {
    setupMarked();
    slugs = new Map();
    return marked.parse(md.replace(/^﻿/, ''), { async: false })
      .replace(/<table>/g, '<div class="tbl"><table>').replace(/<\/table>/g, '</table></div>');
  }

  /* ссылки: относительные .md — внутрь приложения, картинки — на raw.githubusercontent, внешние — в новой вкладке */
  function fixLinks(rootEl, docPath) {
    const dir = docPath.includes('/') ? docPath.slice(0, docPath.lastIndexOf('/') + 1) : '';
    const resolve = rel => {
      const parts = (dir + rel).split('/'), out = [];
      for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.' && p !== '') out.push(p); }
      return out.join('/');
    };
    $$('a[href]', rootEl).forEach(a => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || a.classList.contains('anchor')) return;
      if (/^[a-z]+:/i.test(href) || href.startsWith('//')) { a.target = '_blank'; a.rel = 'noopener'; return; }
      const m = href.match(/^([^#?]*\.md)(#.*)?$/i);
      if (m) { a.setAttribute('href', base + '/' + encPath(resolve(m[1])) + (m[2] || '')); a.dataset.docs = '1'; return; }
      a.setAttribute('href', 'https://github.com/' + repo + '/blob/' + branch + '/' + encPath(resolve(href)));
      a.target = '_blank'; a.rel = 'noopener';
    });
    $$('img[src]', rootEl).forEach(img => {
      const src = img.getAttribute('src');
      if (/^[a-z]+:/i.test(src) || src.startsWith('//') || src.startsWith('data:')) return;
      img.src = 'https://raw.githubusercontent.com/' + repo + '/' + branch + '/' + encPath(resolve(src));
    });
  }

  function meta(text) {
    const lines = text.replace(/^﻿/, '').split(/\r?\n/);
    let title = '', desc = '', inCode = false, inComment = false;
    for (const raw of lines) {
      const l = raw.trim();
      if (inComment) { if (l.includes('-->')) inComment = false; continue; }
      if (l.startsWith('<!--')) { if (!l.includes('-->')) inComment = true; continue; }
      if (l.startsWith('```') || l.startsWith('~~~')) { inCode = !inCode; continue; }
      if (inCode || !l) continue;
      if (!title) {
        const m = l.match(/^#\s+(.+?)\s*#*$/); if (m) { title = m[1]; continue; }
        // файл без «# Заголовок», но первая строка — жирная целиком: считаем её заголовком
        if (!desc && /^\*\*[^*]+\*\*$/.test(l)) { title = l; continue; }
      }
      if (/^(#{1,6}\s|[-*_]{3,}$|\||<|!\[|\[.*\]:|[-*+]\s|\d+\.\s|>)/.test(l) && !title) continue;
      if (/^(#{1,6}\s|[-*_]{3,}$|<|\[.*\]:)/.test(l)) continue;
      desc = l; break;
    }
    const clean = s => s.replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]*)\*\*/g, '$1').replace(/\*([^*]*)\*/g, '$1').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/^[|>\s-]+|\s*\|$/g, '').trim();
    desc = clean(desc); if (desc.length > 180) desc = desc.slice(0, 177).replace(/\s+\S*$/, '') + '…';
    return { title: clean(title), desc, lines: lines.length };
  }
  const niceName = path => path.split('/').pop().replace(/\.md$/i, '').replace(/[_-]+/g, ' ');

  /* ====================== Каркас страницы (чертёж) ====================== */
  function loadScript(src) {
    return new Promise((ok, fail) => { const s = doc.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(new Error('cannot load ' + src)); doc.head.appendChild(s); });
  }
  let vendorReady;
  function ensureVendor() {
    if (!vendorReady) vendorReady = VENDOR.reduce((p, src) => p.then(() => loadScript(src)), Promise.resolve());
    return vendorReady;
  }

  function shell() {
    root.dataset.docs = '1';
    if (!reduce) root.classList.add('js');
    // терминальный styles.css (если это 404.html) — выключаем, оформление целиком в docs.css
    $$('link[rel="stylesheet"]').forEach(l => { if (/(^|\/)styles\.css/.test(l.getAttribute('href') || '')) l.disabled = true; });
    if (!$('link[href^="' + FONTS.slice(0, 40) + '"]')) {
      ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'].forEach(h => { const l = doc.createElement('link'); l.rel = 'preconnect'; l.href = h; if (h.includes('gstatic')) l.crossOrigin = ''; doc.head.appendChild(l); });
      const f = doc.createElement('link'); f.rel = 'stylesheet'; f.href = FONTS; doc.head.appendChild(f);
    }
    doc.body.removeAttribute('class'); doc.body.removeAttribute('data-custom-cursor'); doc.body.removeAttribute('data-section');
    const boot = $('#docs-boot'); if (boot) boot.remove();   // страница была скрыта до старта скрипта (404.html, заглушки)
    doc.body.innerHTML =
      '<a class="skip" href="#main">Skip to content</a>' +
      '<canvas id="grain" aria-hidden="true"></canvas>' +
      '<div id="cursor" aria-hidden="true"><span class="lbl">GO</span></div>' +
      '<div id="progress" aria-hidden="true"></div>' +
      '<div id="hud-scrim-top" aria-hidden="true"></div><div id="hud-scrim-bot" aria-hidden="true"></div>' +
      '<div class="hud">' +
        '<div class="ruler" id="ruler" aria-hidden="true"></div>' +
        '<span class="corner tl" aria-hidden="true"></span><span class="corner tr" aria-hidden="true"></span>' +
        '<span class="corner bl" aria-hidden="true"></span><span class="corner br" aria-hidden="true"></span>' +
        '<div class="hud-row hud-top">' +
          '<a class="mono" href="/">' + SITE + '</a>' +
          '<nav class="hud-nav mono" aria-label="Sections"><a href="/">Site</a><a href="' + base + '" id="hud-docs">Docs</a><a href="https://github.com/' + esc(repo) + '" target="_blank" rel="noopener">GitHub</a></nav>' +
          '<span class="hud-right mono"><span>Documentation</span><br /><span class="dim">' + esc(project.slug) + '</span></span>' +
        '</div>' +
        '<div class="hud-row hud-bot mono" aria-hidden="true"><span class="faint">' + esc(repo) + ' @ ' + esc(branch) + '</span><span class="faint" id="hud-coord">X 0000 Y 0000</span></div>' +
      '</div>' +
      '<main id="main">' +
        '<nav class="docs-crumbs mono" id="docs-crumbs" aria-label="Breadcrumb"></nav>' +
        '<div id="docs-view"><p class="docs-loading mono">loading ' + esc(repo) + '</p></div>' +
      '</main>' +
      '<dialog class="docs-dialog" id="docs-key">' +
      '<form method="dialog" id="docs-key-form">' +
      '<h2>GitHub key</h2>' +
      '<p>Fine-grained personal access token with <b>Contents</b> permission (read, or read &amp; write to edit) for the repositories listed in <code>docs/projects.js</code>. It stays in this browser only and is sent to api.github.com, nowhere else.</p>' +
      '<div class="field"><label class="mono" for="docs-key-input">token</label><input id="docs-key-input" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></div>' +
      '<label class="check"><input type="checkbox" id="docs-key-remember" checked> remember on this device (otherwise until the tab closes)</label>' +
      '<div class="err" id="docs-key-err"></div>' +
      '<div class="actions"><button type="button" class="btn btn-s" data-act="forget">forget key</button><button type="button" class="btn btn-s" data-act="cancel">cancel</button><button type="submit" class="btn btn-s btn-solid">use key</button></div>' +
      '</form></dialog>';
    main = $('#main');
    doc.title = project.title + ' — docs — ' + SITE;

    main.addEventListener('click', onClick);
    $('#docs-key-form').addEventListener('submit', onKeySubmit);
    $('#docs-key').addEventListener('click', e => { const act = e.target.dataset && e.target.dataset.act; if (act === 'cancel') $('#docs-key').close(); if (act === 'forget') { mem.del(KEY); state.user = null; state.badKey = false; $('#docs-key').close(); render(); } });
    win.addEventListener('popstate', () => { if (!leaveEditor()) { history.pushState(null, '', state.editor.url); return; } render(); });
    win.addEventListener('beforeunload', e => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
    doc.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && state.editor) { e.preventDefault(); state.editor.save(); }
    });
    engine();
  }

  /* Зерно, курсор, прогресс, линейка, координаты — как на прежнем сайте, без плавного скролла. */
  function engine() {
    const rulerBox = $('#ruler');
    if (rulerBox) {
      let html = '';
      for (let ry = 0; ry < 2400; ry += 20) {
        const big = ry % 100 === 0;
        html += '<i class="' + (big ? 'big' : '') + '" style="top:' + ry + 'px"></i>';
        if (big && ry) html += '<b style="top:' + ry + 'px">' + ry + '</b>';
      }
      rulerBox.innerHTML = html;
    }
    // экраны за строками HUD: высота меряется с реальных строк
    const topRow = $('.hud-top'), botRow = $('.hud-bot');
    const sync = () => {
      root.style.setProperty('--hud-top-h', topRow.getBoundingClientRect().height + 'px');
      root.style.setProperty('--hud-bot-h', botRow.getBoundingClientRect().height + 'px');
    };
    sync();
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(sync);
    if ('ResizeObserver' in win) { new ResizeObserver(sync).observe(topRow); new ResizeObserver(sync).observe(botRow); }
    else win.addEventListener('resize', sync);

    if (reduce) return;
    // зерно: шум в маленький буфер, растянутый на экран, раз в ~80 мс
    const gc = $('#grain'), g = gc.getContext('2d');
    const GW = 190, GH = 130;
    let grainAt = 0;
    // курсор
    const cur = $('#cursor'), lbl = $('.lbl', cur), coord = $('#hud-coord');
    let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;
    if (!touch) {
      win.addEventListener('pointermove', e => {
        mx = e.clientX; my = e.clientY;
        if (coord) coord.textContent = 'X ' + String(Math.round(mx)).padStart(4, '0') + ' Y ' + String(Math.round(my)).padStart(4, '0');
      }, { passive: true });
      doc.addEventListener('pointerover', e => {
        const hit = e.target.closest('a, button, summary, label');
        cur.classList.toggle('wide', !!hit);
        if (hit) lbl.textContent = hit.closest('.docs-list') ? 'OPEN' : hit.matches('[data-key], .btn-solid') ? 'OK' : hit.closest('.toc') ? 'JUMP' : 'GO';
      });
    }
    const progress = $('#progress');
    const frame = now => {
      if (now - grainAt >= 80) {
        grainAt = now;
        gc.width = GW; gc.height = GH;
        const img = g.createImageData(GW, GH), d = img.data;
        for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = 200 + Math.random() * 55; d[i + 3] = 26; }
        g.putImageData(img, 0, 0);
      }
      if (!touch) { cx += (mx - cx) * .35; cy += (my - cy) * .35; cur.style.transform = 'translate(' + cx + 'px,' + cy + 'px)'; }
      const max = doc.documentElement.scrollHeight - innerHeight;
      progress.style.width = (max > 0 ? Math.min(1, scrollY / max) * 100 : 0) + '%';
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  function route() {
    const s = location.pathname.split('/').filter(Boolean).slice(1).map(dec);
    let path = s.join('/');
    if (path === 'index.html') path = '';
    return { path, edit: new URLSearchParams(location.search).has('edit') };
  }

  function go(url) { history.pushState(null, '', url); render(); }

  function onClick(e) {
    const copy = e.target.closest('button.copy');
    if (copy) {
      const code = copy.closest('pre').querySelector('code');
      navigator.clipboard.writeText(code.innerText).then(() => { copy.textContent = 'copied'; setTimeout(() => { copy.textContent = 'copy'; }, 1200); }, () => { copy.textContent = 'failed'; });
      return;
    }
    const keyBtn = e.target.closest('[data-key]');
    if (keyBtn) { openKey(); return; }
    const refresh = e.target.closest('[data-refresh]');
    if (refresh) { mem.del('docs.tree.' + repo + '@' + branch); render(true); return; }
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.hash && url.search === location.search) {
      // якорь внутри документа — без перезагрузки
      const el = doc.getElementById(dec(url.hash.slice(1)));
      if (el) { e.preventDefault(); history.pushState(null, '', url.hash); el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }); }
      return;
    }
    if (url.pathname === base || url.pathname.startsWith(base + '/')) {
      e.preventDefault();
      if (!leaveEditor()) return;
      go(url.pathname + url.search + url.hash);
    }
  }

  function openKey() {
    const d = $('#docs-key');
    $('#docs-key-input').value = '';
    $('#docs-key-err').textContent = state.badKey ? 'The stored key was rejected by GitHub.' : '';
    $('[data-act="forget"]', d).hidden = !token();
    d.showModal();
  }
  async function onKeySubmit(e) {
    e.preventDefault();
    const v = $('#docs-key-input').value.trim();
    if (!v) return;
    mem.del(KEY);
    mem.set(KEY, v, $('#docs-key-remember').checked ? localStorage : sessionStorage);
    state.user = null; state.badKey = false;
    const login = await whoami();
    if (!login) { $('#docs-key-err').textContent = 'GitHub rejected this token.'; mem.del(KEY); return; }
    $('#docs-key').close();
    mem.del('docs.tree.' + repo + '@' + branch);
    render(true);
  }

  function leaveEditor() {
    if (!state.dirty) { state.editor = null; return true; }
    if (confirm('Discard unsaved changes?')) { state.dirty = false; state.editor = null; return true; }
    return false;
  }

  function crumbs(r) {
    const parts = ['<a href="/">numonjonov.com</a>', '<span class="sep">/</span>', '<a href="' + base + '">' + esc(project.slug) + '</a>'];
    if (r.path) {
      const bits = r.path.split('/');
      bits.forEach((b, i) => {
        parts.push('<span class="sep">/</span>');
        parts.push(i === bits.length - 1 ? '<span>' + esc(b) + '</span>' : '<span class="dim">' + esc(b) + '</span>');
      });
    }
    parts.push('<span class="grow"></span>');
    if (state.user) parts.push('<span class="who dim">key <b>@' + esc(state.user) + '</b></span>');
    parts.push('<button type="button" class="btn btn-s" data-key>' + (token() ? 'key' : 'key…') + '</button>');
    parts.push('<button type="button" class="btn btn-s" data-refresh title="Reload the file list from GitHub">reload</button>');
    $('#docs-crumbs').innerHTML = parts.join('');
    const hd = $('#hud-docs'); if (hd) { if (r.path) hd.removeAttribute('aria-current'); else hd.setAttribute('aria-current', 'page'); }
  }

  /* ====================== Экраны ====================== */
  let renderId = 0;
  async function render(force) {
    const id = ++renderId;
    const r = route();
    const view = $('#docs-view');
    await whoami();
    crumbs(r);
    try {
      await ensureVendor();
      if (!state.files || force) { view.innerHTML = '<p class="docs-loading mono">git ls-tree ' + esc(repo) + '@' + esc(branch) + '</p>'; state.files = await loadTree(force); }
      if (id !== renderId) return;
      if (!r.path) { renderList(view); return; }
      const file = state.files.find(f => f.path === r.path);
      if (!file) { renderMsg(view, 'No such file', '<code>' + esc(r.path) + '</code> is not in ' + esc(repo) + '@' + esc(branch) + '. <a href="' + base + '">Back to the list.</a>', false); return; }
      view.innerHTML = '<p class="docs-loading mono">cat ' + esc(file.path) + '</p>';
      const text = await loadFile(file);
      if (id !== renderId) return;
      doc.title = (meta(text).title || file.path) + ' — ' + project.title + ' — ' + SITE;
      if (r.edit) renderEditor(view, file, text); else renderDoc(view, file, text, r);
    } catch (e) {
      if (id !== renderId) return;
      const d = describe(e);
      renderMsg(view, d.title, esc(d.text), true, d.key);
    }
  }

  function renderMsg(view, title, html, isErr, key) {
    view.innerHTML = '<div class="docs-msg' + (isErr ? ' err' : '') + '"><h2>' + esc(title) + '</h2><p>' + html + '</p>' +
      '<div class="actions">' + (key ? '<button type="button" class="btn btn-solid" data-key>Enter key</button>' : '') + '<a class="btn" href="' + base + '">All docs</a><a class="btn" href="/">Home</a></div></div>';
  }

  function fmtSize(n) { return n < 1024 ? n + ' B' : (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB'; }

  function renderList(view) {
    const featured = project.featured || [];
    const files = state.files.slice().sort((a, b) => {
      const fa = featured.indexOf(a.path), fb = featured.indexOf(b.path);
      if (fa !== -1 || fb !== -1) return (fa === -1 ? 1e9 : fa) - (fb === -1 ? 1e9 : fb);
      const da = a.path.includes('/') ? a.path.slice(0, a.path.lastIndexOf('/')) : '', db = b.path.includes('/') ? b.path.slice(0, b.path.lastIndexOf('/')) : '';
      if (da !== db) return da === '' ? -1 : db === '' ? 1 : da.localeCompare(db);
      return a.path.localeCompare(b.path);
    });
    const groups = new Map();
    files.forEach(f => {
      const isF = featured.includes(f.path);
      const dir = isF ? '' : (f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) + '/' : '');
      const g = isF ? 'Featured' : dir || 'Root';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(f);
    });
    const access = token() ? (state.user ? 'Owner — @' + state.user : 'Key set') : 'Read-only, no key';
    let html = '<header class="page-head"><a class="back mono" href="/">&larr; numonjonov.com</a>' +
      '<h1>' + esc(project.title) + '</h1><p class="page-sub">' + esc(project.description || '') + '</p>' +
      '<dl class="page-meta mono">' +
      '<div><dt class="dim">Repository</dt><dd><a href="https://github.com/' + esc(repo) + '" target="_blank" rel="noopener">' + esc(repo) + '</a></dd></div>' +
      '<div><dt class="dim">Branch</dt><dd>' + esc(branch) + '</dd></div>' +
      '<div><dt class="dim">Documents</dt><dd>' + files.length + ' markdown files</dd></div>' +
      '<div><dt class="dim">Access</dt><dd>' + esc(access) + '</dd></div>' +
      '</dl></header>';
    if (!files.length) html += '<p class="dim">No markdown files in this repository.</p>';
    let n = 0;
    groups.forEach((list, g) => {
      html += '<section class="docs-group"><h2 class="mono"><span>' + esc(g) + '</span><span class="dim">' + list.length + '</span></h2><ul class="docs-list">';
      list.forEach(f => {
        const m = cachedMeta(f);
        n += 1;
        html += '<li><a href="' + base + '/' + encPath(f.path) + '" data-path="' + esc(f.path) + '">' +
          '<span class="num mono">' + String(n).padStart(2, '0') + '</span>' +
          '<span class="title' + (m ? '' : ' pending') + '">' + esc(m ? (m.title || niceName(f.path)) : niceName(f.path)) + '</span>' +
          '<span class="desc">' + esc(m ? m.desc : '') + '</span>' +
          '<span class="meta mono"><span class="name">' + esc(f.path) + '</span><span class="size">' + (m ? m.lines + ' lines · ' : '') + fmtSize(f.size) + '</span></span></a></li>';
      });
      html += '</ul></section>';
    });
    view.innerHTML = html;
    win.scrollTo(0, 0);
    fillMeta(files);
  }

  function cachedMeta(f) {
    const c = mem.get('docs.meta.' + f.sha);
    if (c) { try { return JSON.parse(c); } catch (e) { /* ignore */ } }
    return null;
  }
  async function fillMeta(files) {
    const todo = files.filter(f => !cachedMeta(f));
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const f = todo[i++];
        try {
          const m = meta(await loadFile(f));
          mem.set('docs.meta.' + f.sha, JSON.stringify(m));
          const a = $('#docs-view a[data-path="' + CSS.escape(f.path) + '"]');
          if (!a) continue;
          const t = $('.title', a); t.textContent = m.title || niceName(f.path); t.classList.remove('pending');
          $('.desc', a).textContent = m.desc;
          $('.size', a).textContent = m.lines + ' lines · ' + fmtSize(f.size);
        } catch (e) { return; }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }

  function renderDoc(view, file, text, r) {
    const html = renderMarkdown(text);
    const m = meta(text);
    const title = m.title || niceName(file.path);
    const canEdit = !!token();
    view.innerHTML = '<header class="page-head"><a class="back mono" href="' + base + '">&larr; All docs</a>' +
      '<h1 class="' + (title.length > 28 ? 'long' : '') + '">' + esc(title) + '</h1>' +
      (m.desc ? '<p class="page-sub">' + esc(m.desc) + '</p>' : '') +
      '<dl class="page-meta mono">' +
      '<div><dt class="dim">File</dt><dd>' + esc(file.path) + '</dd></div>' +
      '<div><dt class="dim">Size</dt><dd>' + m.lines + ' lines · ' + fmtSize(file.size) + '</dd></div>' +
      '<div><dt class="dim">Source</dt><dd><a href="https://github.com/' + esc(repo) + '/blob/' + esc(branch) + '/' + encPath(file.path) + '" target="_blank" rel="noopener">' + esc(repo) + '@' + esc(branch) + '</a></dd></div>' +
      '<div><dt class="dim">Access</dt><dd>' + (canEdit ? 'Owner, editable' : 'Read-only') + '</dd></div>' +
      '</dl>' +
      '<div class="page-actions">' + (canEdit ? '<a class="btn" href="' + base + '/' + encPath(file.path) + '?edit">Edit</a>' : '<button type="button" class="btn" data-key title="Enter a key to edit">Edit — key needed</button>') + '</div>' +
      '</header>' +
      '<div class="doc">' +
      '<aside class="doc-side"><details open><summary class="mono">Contents</summary><ol class="toc" id="docs-toc"></ol></details></aside>' +
      '<article class="doc-main"><div class="md" id="docs-md">' + html + '</div></article></div>';
    const md = $('#docs-md');
    // первый h1 уже вынесен в шапку страницы
    const h1 = md.firstElementChild;
    if (h1 && h1.tagName === 'H1' && m.title && h1.textContent.replace(/^#/, '').trim() === m.title) h1.remove();
    fixLinks(md, file.path);
    buildToc(md, $('#docs-toc'));
    if (win.innerWidth < 1024) $('.doc-side details').open = false;
    if (location.hash) { const el = doc.getElementById(dec(location.hash.slice(1))); if (el) { el.scrollIntoView({ block: 'start' }); return; } }
    win.scrollTo(0, 0);
  }

  let spy;
  function buildToc(md, toc) {
    const hs = $$('h1, h2, h3, h4', md);
    if (!hs.length) { toc.innerHTML = '<li class="empty">No headings</li>'; return; }
    const min = Math.min.apply(null, hs.map(h => +h.tagName[1]));
    toc.innerHTML = hs.map(h => '<li class="d' + (+h.tagName[1] - min + 2) + '"><a href="#' + esc(h.id) + '">' + esc(h.textContent.replace(/^#\s*/, '')) + '</a></li>').join('');
    const links = $$('a', toc);
    if (spy) win.removeEventListener('scroll', spy);
    let tick = false;
    spy = () => {
      if (tick) return; tick = true;
      requestAnimationFrame(() => {
        tick = false;
        const top = (parseFloat(root.style.getPropertyValue('--hud-top-h')) || 40) + 48;
        let cur = -1;
        hs.forEach((h, i) => { if (h.getBoundingClientRect().top <= top) cur = i; });
        links.forEach((a, i) => a.classList.toggle('active', i === cur));
        if (cur >= 0 && !doc.hidden) {
          const side = toc.closest('.doc-side'), rect = links[cur].getBoundingClientRect(), box = side.getBoundingClientRect();
          if (rect.top < box.top || rect.bottom > box.bottom) links[cur].scrollIntoView({ block: 'nearest' });
        }
      });
    };
    win.addEventListener('scroll', spy, { passive: true });
    spy();
  }

  /* ====================== Редактор ====================== */
  function renderEditor(view, file, text) {
    const draftKey = 'docs.draft.' + repo + '/' + file.path;
    const draft = mem.get(draftKey);
    const url = base + '/' + encPath(file.path) + '?edit';
    view.innerHTML = '<header class="page-head"><a class="back mono" href="' + base + '/' + encPath(file.path) + '">&larr; Back to the document</a>' +
      '<h1 class="long">Edit</h1><p class="page-sub">Changes are committed to <b>' + esc(repo) + '@' + esc(branch) + '</b> under your GitHub account. Ctrl+S saves.</p></header>' +
      '<div class="ed">' +
      '<div class="ed-bar mono"><span class="path">' + esc(file.path) + '</span>' +
      '<input id="ed-msg" type="text" placeholder="Commit message (optional)" maxlength="200">' +
      '<span class="state" id="ed-state"></span>' +
      '<button type="button" class="btn btn-s btn-solid" id="ed-save">Save</button>' +
      '<a class="btn btn-s" href="' + base + '/' + encPath(file.path) + '" id="ed-cancel">Cancel</a></div>' +
      '<div class="ed-panes"><textarea id="ed-text" spellcheck="false" aria-label="Markdown source"></textarea>' +
      '<div class="ed-preview"><div class="md" id="ed-preview"></div></div></div></div>';
    const ta = $('#ed-text'), pv = $('#ed-preview'), st = $('#ed-state'), btn = $('#ed-save');
    let original = text;
    ta.value = draft !== null && draft !== text ? draft : text;
    const setState = (cls, msg) => { st.className = 'state ' + cls; st.textContent = msg; };
    const update = () => {
      state.dirty = ta.value !== original;
      setState(state.dirty ? 'dirty' : '', state.dirty ? 'unsaved' : 'no changes');
      if (state.dirty) mem.set(draftKey, ta.value); else mem.del(draftKey);
      pv.innerHTML = renderMarkdown(ta.value);
      fixLinks(pv, file.path);
    };
    let timer;
    ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(update, 250); });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const s = ta.selectionStart, en = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
        ta.selectionStart = ta.selectionEnd = s + 2;
        ta.dispatchEvent(new Event('input'));
      }
    });
    update();
    if (draft !== null && draft !== text) setState('dirty', 'draft restored');

    const save = async () => {
      if (btn.disabled) return;
      if (ta.value === original) { setState('', 'no changes'); return; }
      btn.disabled = true; setState('', 'committing…');
      const msg = $('#ed-msg').value.trim() || ('Update ' + file.path.split('/').pop() + ' via numonjonov.com');
      try {
        const sha = await saveFile(file, ta.value, msg);
        original = ta.value; state.dirty = false;
        setState('', 'committed ' + (sha ? sha.slice(0, 7) : ''));
        mem.set('docs.meta.' + file.sha, JSON.stringify(meta(ta.value)));
        setTimeout(() => { state.editor = null; go(base + '/' + encPath(file.path)); }, 600);
      } catch (e) {
        const d = describe(e);
        setState('err', d.title + ': ' + d.text);
        if (e.status === 409 || e.status === 422) {
          // файл в репозитории ушёл вперёд — забираем свежий sha, правки остаются в textarea
          try { state.files = await loadTree(true); const f = state.files.find(x => x.path === file.path); if (f) { file.sha = f.sha; original = await loadFile(f); setState('err', 'File changed on GitHub; latest version loaded as base — review and save again.'); } } catch (x) { /* покажем исходную ошибку */ }
        }
      } finally { btn.disabled = false; }
    };
    btn.addEventListener('click', save);
    state.editor = { save, url };
    ta.focus();
    win.scrollTo(0, 0);
  }

  /* ====================== Старт ====================== */
  shell();
  render();
  // для отладки из консоли: DOCS.render(markdown) → html, DOCS.meta(markdown) → {title, desc, lines}
  win.DOCS = { render: md => ensureVendor().then(() => renderMarkdown(md)), meta, project };
})();
