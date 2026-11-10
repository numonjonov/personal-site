/* v13 — по мотивам elliott.mangham.dev, код и макеты свои.
   - загрузка: линия растёт, на ней отметки 0…80 % с фиолетовыми точками;
   - абзацы: каждое слово в своей маске; колесо/клавиши уводят слова вверх и
     вводят следующий абзац снизу в другом месте экрана;
   - лента: мини-макеты проектов (640×400, HTML), серые до наведения, едет
     сама, колесо её подталкивает; при наведении — большой предпросмотр по
     центру (раскрытие clip-path), фиолетовая плашка за курсором, Enter — кейс;
   - курсор — фиолетовая точка с инерцией, часы Ташкента.
   На узких экранах и тач — обычная прокрутка: абзацы проявляются по мере
   появления, лента листается пальцем, предпросмотра нет. */
(() => {
  const doc = document, root = doc.documentElement, $ = id => doc.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const deskQ = matchMedia('(min-width: 900px) and (hover: hover)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ================= мини-макеты проектов ================= */
  // детерминированный «случайный» ряд, чтобы макеты не менялись от загрузки к загрузке
  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const M = 'font-family:var(--mono)';

  function uptimeRows() {
    const r = rng(11), names = ['gov portal', 'tax service', 'payments', 'cards', 'rail tickets', 'post'];
    return names.map(n => {
      let bars = '';
      for (let i = 0; i < 56; i++) {
        const x = r(); const c = x > .985 ? '#e5484d' : x > .955 ? '#f5b83d' : '#30c47a';
        bars += `<i style="display:block;width:5px;height:22px;border-radius:1px;background:${c}"></i>`;
      }
      const up = (99 + r() * .98).toFixed(2);
      return `<div style="display:flex;align-items:center;gap:14px;margin-top:11px"><span style="${M};font-size:12px;width:96px;color:#c9ccd1">${n}</span><span style="display:flex;gap:2px">${bars}</span><span style="${M};font-size:11px;color:#8a9099">${up}%</span></div>`;
    }).join('');
  }
  function sparkline(seed, w, h) {
    const r = rng(seed); let y = h * .55, pts = [];
    for (let i = 0; i <= 40; i++) { y = clamp(y + (r() - .46) * h * .12, h * .1, h * .9); pts.push(`${(i / 40 * w).toFixed(1)},${(h - y).toFixed(1)}`); }
    return pts.join(' ');
  }
  function wave() {
    const r = rng(5); let s = '';
    for (let i = 0; i < 64; i++) { const a = Math.abs(Math.sin(i * .37) * .6 + (r() - .5) * .7); s += `<i style="display:block;width:4px;border-radius:2px;height:${(8 + a * 70).toFixed(0)}px;background:#ff7a1a"></i>`; }
    return s;
  }

  const PROJECTS = [
    { slug: 'uz-status', href: '/work/uz-status.html', cap: 'Public uptime monitor for the services Uzbekistan runs on — Java 21, Spring Boot, PostgreSQL.',
      shot: () => `<div class="shot" style="background:#0f1115;color:#e8eaed"><div class="bar-top"><i></i><i></i><i></i>uz-status<span>last 56 days</span></div>
        <div style="padding:16px 28px"><div style="font:500 32px/1 var(--sans);letter-spacing:-.02em">Uzbekistan, up or down.</div>
        <div style="${M};font-size:12px;color:#8a9099;margin-top:7px">checked every minute · public, no login</div>${uptimeRows()}</div></div>` },
    { slug: 'exchange', href: '/work/exchange.html', cap: 'Currency tracker with zero dependencies — hand-written Telegram client, hand-drawn SVG and PNG charts.',
      shot: () => `<div class="shot" style="background:#f3f0e8;color:#141414"><div class="bar-top"><i></i><i></i><i></i>exchange<span>stdlib only</span></div>
        <div style="padding:14px 28px"><div style="display:flex;gap:8px">${['USD', 'EUR', 'RUB', 'KZT'].map((c, i) => `<span style="${M};font-size:12px;padding:3px 8px;border:1px solid #141414;${i === 0 ? 'background:#141414;color:#f3f0e8' : ''}">${c}</span>`).join('')}</div>
        <div style="font:500 44px/1 var(--sans);letter-spacing:-.03em;margin-top:18px">USD → UZS</div>
        <svg width="584" height="190" viewBox="0 0 584 190" style="display:block;margin-top:16px"><polyline points="${sparkline(3, 584, 190)}" fill="none" stroke="#2457ff" stroke-width="3"/><line x1="0" y1="189" x2="584" y2="189" stroke="#141414" stroke-opacity=".2"/></svg>
        <div style="${M};font-size:11px;opacity:.6;margin-top:6px">0 dependencies · one file · runs on a cron</div></div></div>` },
    { slug: 'tgagent', href: '/work/tgagent.html', cap: 'Telegram Business agent in plain Java — no Spring, no bot library; two-provider fallback and SQLite memory.',
      shot: () => `<div class="shot" style="background:#17212b;color:#e9eef3"><div class="bar-top" style="background:#232e3c"><i></i><i></i><i></i>Business chat<span>assistant on</span></div>
        <div style="padding:22px 28px;display:flex;flex-direction:column;gap:12px;font-size:17px">
        <div style="align-self:flex-start;max-width:62%;background:#182533;border:1px solid #2b3a4a;padding:10px 14px;border-radius:14px 14px 14px 4px">Can you move my call to Friday?</div>
        <div style="align-self:flex-end;max-width:62%;background:#2b5278;padding:10px 14px;border-radius:14px 14px 4px 14px">Done — Friday, 11:00. I sent you the new invite.</div>
        <div style="align-self:flex-start;max-width:62%;background:#182533;border:1px solid #2b3a4a;padding:10px 14px;border-radius:14px 14px 14px 4px">Perfect, thanks!</div>
        <div style="align-self:center;${M};font-size:11px;padding:4px 10px;border-radius:999px;background:#1f3d2b;color:#5fe39a;margin-top:8px">gemini → timeout → groq · answered in 1.4 s</div></div></div>` },
    { slug: 'tekstlybot', href: '/work/tekstlybot.html', cap: 'Telegram media bot moved to a worker queue — ffmpeg, whisper.cpp, a 256 MB heap ceiling.',
      shot: () => `<div class="shot" style="background:#111;color:#f1f1f1"><div class="bar-top"><i></i><i></i><i></i>tekstlybot<span>voice → text</span></div>
        <div style="padding:20px 28px"><div style="display:flex;align-items:center;gap:3px;height:90px">${wave()}</div>
        <div style="font-size:19px;line-height:1.35;margin-top:22px">“…so the meeting moves to Thursday, and the report goes out <span style="background:#ff7a1a;color:#111;padding:0 3px">before lunch</span>.”</div>
        <div style="${M};font-size:11px;color:#9a9a9a;margin-top:26px">heap</div><div style="height:8px;background:#2a2a2a;margin-top:6px"><div style="width:83%;height:100%;background:#ff7a1a"></div></div>
        <div style="${M};font-size:11px;color:#9a9a9a;margin-top:6px">212 / 256 MB · ogg → wav → text</div></div></div>` },
    { slug: 'plusline', href: '/work/plusline.html', cap: 'plusline / keyline — two Telegram shop bots on one aiogram codebase: catalogue, photo albums, search, no cart.',
      shot: () => `<div class="shot" style="background:#eef3f8;color:#10202f"><div class="bar-top" style="background:#fff"><i></i><i></i><i></i>plusline_bot<span>catalogue</span></div>
        <div style="padding:20px 28px"><div style="display:flex;gap:8px">${['Phones', 'New', 'Used', 'Search'].map((t, i) => `<span style="${M};font-size:12px;padding:5px 10px;border-radius:999px;${i === 0 ? 'background:#2aabee;color:#fff' : 'background:#fff;color:#10202f'}">${t}</span>`).join('')}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px">${[['128 GB', 'used · like new'], ['256 GB', 'new'], ['64 GB', 'used'], ['512 GB', 'new'], ['128 GB', 'new'], ['256 GB', 'used']].map(([a, b], i) => `<div style="background:#fff;border-radius:10px;padding:8px;box-shadow:0 4px 12px rgba(16,32,47,.06)"><div style="height:58px;border-radius:6px;background:linear-gradient(135deg,${i % 2 ? '#c9d9ea' : '#d9e6d4'},#f4f7fa)"></div><div style="font-weight:500;font-size:14px;margin-top:6px">Phone · ${a}</div><div style="${M};font-size:10px;color:#7b8a99">${b}</div></div>`).join('')}</div>
        <div style="margin-top:14px;text-align:center;background:#2aabee;color:#fff;padding:9px;border-radius:10px;font-weight:500;font-size:14px">Ask a manager</div></div></div>` },
    { slug: 'downloader', href: '/work/downloader.html', cap: 'Universal Telegram download bot — one dispatcher over yt-dlp and gallery-dl.',
      shot: () => `<div class="shot" style="background:#0b0b0b;color:#eaeaea"><div class="bar-top"><i></i><i></i><i></i>downloader<span>send a link</span></div>
        <div style="padding:22px 28px"><div style="border:1px solid #333;padding:12px 14px;${M};font-size:13px;color:#888">https://… paste a link<span style="float:right;color:#c6ff3d">↵</span></div>
        ${[['video.mp4', 82], ['audio.m4a', 100], ['cover.jpg', 100], ['clip.mp4', 37]].map(([f, p]) => `<div style="margin-top:18px;${M};font-size:12px;display:flex;justify-content:space-between"><span>${f}</span><span style="color:${p === 100 ? '#c6ff3d' : '#888'}">${p === 100 ? 'done ✓' : p + '%'}</span></div><div style="height:4px;background:#222;margin-top:6px"><div style="width:${p}%;height:100%;background:#c6ff3d"></div></div>`).join('')}</div></div>` },
    { slug: 'myid', href: '/work/myid.html', cap: 'MyID · e-key — work projects at a commercial bank. Closed source, no public details.',
      shot: () => `<div class="shot" style="background:#0e2524;color:#dff7f5"><div class="bar-top"><i></i><i></i><i></i>MyID · e-key<span>work project</span></div>
        <div style="padding:30px 28px;position:relative"><div style="filter:blur(5px);opacity:.55">${[78, 54, 88, 40, 70, 62, 84].map((w, i) => `<div style="height:12px;width:${w}%;background:${i % 3 ? '#2c5a57' : '#00a19a'};border-radius:3px;margin-top:14px"></div>`).join('')}</div>
        <div style="position:absolute;inset:0;display:grid;place-items:center"><div style="text-align:center"><div style="width:46px;height:38px;margin:0 auto;border:3px solid #00c2b8;border-radius:6px;position:relative"><i style="position:absolute;left:8px;right:8px;top:-20px;height:20px;border:3px solid #00c2b8;border-bottom:0;border-radius:14px 14px 0 0"></i></div>
        <div style="${M};font-size:13px;margin-top:14px;letter-spacing:.06em">CLOSED SOURCE</div><div style="${M};font-size:11px;opacity:.6;margin-top:4px">in production · details stay inside the bank</div></div></div></div></div>` },
  ];
  const LOG = [
    ['2025 — now', 'Backend engineer at a commercial bank in Tashkent.'],
    ['systems', 'iABS · MyID wrapper · e-key on WebLogic.'],
    ['database', 'PL/SQL where the logic belongs, next to the data.'],
    ['stack', 'Java 21/17 · Spring Boot · Spring Security · Docker.'],
    ['status', 'Open to work — remote or on site.'],
  ];

  /* ================= лента ================= */
  const trackP = $('track-projects'), trackL = $('track-log');
  const cardHTML = (p, i, clone) => `<a class="card" href="${p.href}" data-i="${i}"${clone ? ' aria-hidden="true" tabindex="-1"' : ''} aria-label="${p.slug}">${p.shot()}</a>`;
  const logHTML = (l, clone) => `<div class="log-card"${clone ? ' aria-hidden="true"' : ''}><span>${l[0]}</span>${l[1]}</div>`;
  function fillTracks(desk) {
    // на десктопе набор повторяется, чтобы лента ехала бесконечно
    const reps = desk ? 3 : 1;
    let p = '', l = '';
    for (let k = 0; k < reps; k++) { p += PROJECTS.map((x, i) => cardHTML(x, i, k > 0)).join(''); l += LOG.map(x => logHTML(x, k > 0)).join(''); }
    trackP.innerHTML = p; trackL.innerHTML = l;
    fitShots();
  }
  function fitShots() {
    doc.querySelectorAll('.card').forEach(c => { const s = c.querySelector('.shot'); if (s) s.style.transform = `scale(${c.clientWidth / 640})`; });
  }

  /* ================= абзацы: слова в масках ================= */
  const paras = [...doc.querySelectorAll('.para')];
  function split(el) {
    const out = [];
    [...el.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { out.push(doc.createTextNode(' ')); return; }
          out.push(part);
        });
      } else out.push(n);
    });
    el.textContent = '';
    let i = 0;
    out.forEach(x => {
      if (x instanceof Text) { el.appendChild(x); return; }
      const w = doc.createElement('span'), wi = doc.createElement('span');
      w.className = 'w'; wi.className = 'wi';
      if (typeof x === 'string') wi.textContent = x; else wi.appendChild(x);
      wi.style.setProperty('--d', (i * .016).toFixed(3) + 's');
      w.appendChild(wi); el.appendChild(w); i++;
    });
  }
  paras.forEach(split);

  /* ================= режим ================= */
  let desk = deskQ.matches;
  fillTracks(desk);
  deskQ.addEventListener('change', () => location.reload());
  addEventListener('resize', fitShots);

  // часы Ташкента
  const clock = $('clock');
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' });
  const tick = () => { clock.textContent = fmt.format(new Date()); };
  tick(); setInterval(tick, 10000);

  // вкладки
  const tabs = [...doc.querySelectorAll('.tabs button')];
  let activeTrack = trackP;
  tabs.forEach(b => b.addEventListener('click', () => {
    tabs.forEach(x => x.setAttribute('aria-selected', String(x === b)));
    const t = b.dataset.tab;
    trackP.hidden = t !== 'projects'; trackL.hidden = t !== 'log';
    activeTrack = t === 'projects' ? trackP : trackL;
    mx = 0; hidePreview();
    if (!desk) $('strip').scrollLeft = 0;
  }));

  /* ================= загрузка ================= */
  const loader = $('loader'), line = $('loader-line'), marks = $('loader-marks');
  [0, 20, 40, 60, 80].forEach(p => { const s = doc.createElement('span'); s.textContent = p + '%'; s.dataset.p = p; s.style.left = `calc(${p * .98}% + 16px)`; marks.appendChild(s); });
  const markEls = [...marks.children];
  function runLoader() {
    return new Promise(res => {
      if (reduced) { res(); return; }
      const dur = 1500, t0 = performance.now();
      const fontsReady = doc.fonts ? doc.fonts.ready : Promise.resolve();
      let fontsOk = false, done = false;
      fontsReady.then(() => { fontsOk = true; });
      setTimeout(() => { fontsOk = true; }, 2500);             // шрифты не дождались — идём дальше
      const finish = () => { if (!done) { done = true; res(); } };
      setTimeout(finish, 5000);                                 // вкладка в фоне, кадры не идут — всё равно открыть
      const step = t => {
        let k = clamp((t - t0) / dur, 0, 1);
        if (!fontsOk) k = Math.min(k, .8);                       // ждём шрифты на 80 %
        const e = 1 - Math.pow(1 - k, 2.2);
        line.style.width = (e * 92) + '%';
        markEls.forEach(m => m.classList.toggle('on', e * 92 >= +m.dataset.p * .98));
        if (k < 1) requestAnimationFrame(step); else setTimeout(finish, 220);
      };
      requestAnimationFrame(step);
    });
  }

  /* ================= десктоп: сцена ================= */
  let idx = 0, busy = false, acc = 0, accT = 0;
  const meter = $('meter');
  function show(n) {
    n = clamp(n, 0, paras.length - 1);
    if (n === idx && paras[n].classList.contains('on')) return;
    const old = paras[idx];
    if (old !== paras[n]) {
      old.classList.remove('on'); old.classList.add('out');
      setTimeout(() => {                                      // назад вниз без анимации
        old.querySelectorAll('.wi').forEach(w => { w.style.transition = 'none'; });
        old.classList.remove('out'); void old.offsetWidth;
        old.querySelectorAll('.wi').forEach(w => { w.style.transition = ''; });
      }, 760);
    }
    idx = n; busy = true;
    setTimeout(() => paras[n].classList.add('on'), old === paras[n] ? 0 : 180);
    setTimeout(() => { busy = false; }, 900);
    meter.style.width = ((n + 1) / paras.length * 100) + '%';
  }

  // лента: позиция, скорость, подталкивание колесом
  let mx = 0, mv = 0, base = 34, over = false;
  const strip = $('strip');

  // курсор и плашка
  const dot = $('dot'), pill = $('pill'), hint = $('hint');
  let px = innerWidth / 2, py = innerHeight / 2, dx = px, dy = py, lx = px, ly = py;

  // предпросмотр
  const preview = $('preview'), screen = $('preview-screen'), cap = $('preview-cap');
  let hot = null, readyT = 0, hideT = 0;
  function showPreview(card) {
    clearTimeout(hideT);
    if (hot === card) return;
    if (hot) hot.classList.remove('hot');
    hot = card; card.classList.add('hot');
    const p = PROJECTS[+card.dataset.i];
    const wasOn = preview.classList.contains('on');
    preview.classList.remove('ready'); clearTimeout(readyT);
    screen.innerHTML = p.shot();
    const s = screen.querySelector('.shot'); s.style.transform = `scale(${preview.clientWidth / 640})`;
    cap.textContent = p.cap;
    preview.classList.add('on');
    readyT = setTimeout(() => preview.classList.add('ready'), wasOn ? 140 : 420);
    pill.textContent = `${String(+card.dataset.i + 1).padStart(2, '0')} — ${p.slug}`;
    pill.classList.add('on'); hint.classList.add('on');
  }
  function hidePreview() {
    if (hot) hot.classList.remove('hot');
    hot = null; clearTimeout(readyT);
    preview.classList.remove('on', 'ready'); pill.classList.remove('on'); hint.classList.remove('on');
  }

  function startDesk() {
    addEventListener('wheel', e => {
      e.preventDefault();
      const d = e.deltaY * (e.deltaMode === 1 ? 30 : 1);
      mv += d * .9;                                            // лента получает толчок
      const now = performance.now();
      if (now - accT > 260) acc = 0;
      accT = now; acc += d;
      if (!busy && Math.abs(acc) > 70) { show(idx + Math.sign(acc)); acc = 0; }
    }, { passive: false });
    addEventListener('keydown', e => {
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); if (!busy) show(idx + 1); }
      if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); if (!busy) show(idx - 1); }
      if (e.key === 'Enter' && hot) location.href = hot.href;
      if (e.key === 'Escape') hidePreview();
    });
    strip.addEventListener('pointerover', e => { const c = e.target.closest('.card'); if (c) showPreview(c); });
    strip.addEventListener('pointerenter', () => { over = true; });
    strip.addEventListener('pointerleave', () => { over = false; hideT = setTimeout(hidePreview, 60); });
    addEventListener('pointermove', e => {
      px = e.clientX; py = e.clientY; dot.classList.remove('off');
      dot.classList.toggle('big', !!(e.target.closest && e.target.closest('a, button, .note')));
    }, { passive: true });
    doc.addEventListener('pointerleave', () => dot.classList.add('off'));

    let last = performance.now();
    const loop = t => {
      const dt = Math.min(.05, (t - last) / 1000); last = t;
      // лента: базовая скорость гаснет под курсором, толчки колеса затухают
      const want = over ? 0 : base;
      mv += (0 - mv) * (1 - Math.exp(-dt * 2.2));
      const v = (reduced ? 0 : want) + mv;
      mx -= v * dt;
      const half = activeTrack.scrollWidth / 3;
      if (half > 0) { mx %= half; if (mx > 0) mx -= half; }
      activeTrack.style.transform = `translate3d(${mx.toFixed(2)}px,0,0)`;
      // точка и плашка с инерцией
      const k1 = 1 - Math.exp(-dt * 22), k2 = 1 - Math.exp(-dt * 12);
      dx += (px - dx) * k1; dy += (py - dy) * k1;
      lx += (px - lx) * k2; ly += (py - ly) * k2;
      dot.style.transform = `translate3d(${dx}px,${dy}px,0)`;
      pill.style.transform = `translate3d(${lx + 14}px,${ly - 30}px,0)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ================= узкие экраны: проявление по мере прокрутки ================= */
  function startFlow() {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } }), { threshold: .25 });
    paras.forEach(p => io.observe(p));
  }

  runLoader().then(() => {
    loader.classList.add('done');
    doc.body.classList.add('in');
    doc.querySelectorAll('.cols .col').forEach((c, i) => c.style.setProperty('--d', (i * .07) + 's'));
    if (desk) { startDesk(); setTimeout(() => show(0), 250); }
    else startFlow();
  });
})();
