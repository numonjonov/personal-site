/* Внутренние страницы в стиле главной (v12): живой фон, расшифровка заголовков,
   проявление блоков, прогресс чтения. Без библиотек.
   Фон — дюны из точек на 2D-canvas: высоты от суммы синусов (гребни как на
   главной), перспективная проекция, туман по дальности; камера медленно едет
   вперёд и чуть быстрее — при прокрутке; у курсора песок подсвечивается и
   расступается. 30 кадров в секунду, пауза в скрытой вкладке; при
   prefers-reduced-motion — один статичный кадр. */
(() => {
  const doc = document, root = doc.documentElement;
  root.classList.add('js');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= фон ================= */
  const cv = doc.getElementById('bg');
  if (cv && cv.getContext) {
    const g = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, f = 1, horizon = 0;
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      f = H * .95; horizon = H * .6;
    };
    resize(); addEventListener('resize', resize);

    // стабильные «случайные» смещения точек
    let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // у каждой песчинки — своя глубина (zi) и место поперёк кадра (u); камера едет
    // вперёд, песчинка подъезжает и, пройдя под камерой, уходит в дальний туман
    const N = 4200, ZR = 64, zNear = 1.4, dots = [];
    for (let i = 0; i < N; i++) dots.push({ zi: rnd(), u: rnd(), s: .6 + rnd() * .9 });
    const dust = Array.from({ length: 40 }, () => ({ x: rnd(), y: rnd(), v: .2 + rnd() * .6, s: .6 + rnd() }));

    const height = (x, z) => {
      const crest = 1 - Math.abs(Math.sin(x * .19 + z * .08 + Math.sin(z * .05) * 2));
      return Math.pow(crest, 2.4) * 1.5 + Math.sin(x * .05 + 1.3) * Math.cos(z * .04) * .9 - Math.exp(-x * x / 40) * .7;
    };

    let mx = -999, my = -999, light = 0, lightT = 0, t0 = performance.now(), last = 0;
    addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mx = e.clientX; my = e.clientY; lightT = 1; } }, { passive: true });
    doc.addEventListener('pointerleave', () => { lightT = 0; });

    const draw = now => {
      const t = (now - t0) / 1000;
      light += (lightT - light) * .08;
      const camH = 2.3, travel = (reduced ? 0 : t * .35) + scrollY * .012;
      g.clearRect(0, 0, W, H);
      // воздух: светлее над горизонтом
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#141414'); sky.addColorStop(.58, '#1d1d1d'); sky.addColorStop(.62, '#191919'); sky.addColorStop(1, '#121212');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);

      for (const d of dots) {
        const z = zNear + (((d.zi * ZR - travel) % ZR) + ZR) % ZR;
        const x = (d.u - .5) * 2 * (z * (W / f) * .6 + 1);
        const y = height(x, z + travel);                 // мировая глубина песчинки постоянна
        let sx = W / 2 + x / z * f, sy = horizon + (camH - y) / z * f;
        if (sy < 0 || sy > H + 20 || sx < -20 || sx > W + 20) continue;
        const fog = Math.max(0, 1 - z / ZR);
        let s = Math.min(9, d.s * 5 / Math.pow(z, .75));
        let a = fog * fog * .6 * Math.min(1, (z - zNear) / 1.2) * (s > 3 ? .45 : 1);
        // фонарик: подсветка и воронка вокруг курсора
        if (light > .01) {
          const dx = sx - mx, dy = sy - my, dd = Math.hypot(dx, dy), R = 120;
          if (dd < R * 1.6) {
            const k = (1 - Math.min(1, dd / (R * 1.6))) * light;
            a += k * .5;
            if (dd < R) { const push = (1 - dd / R) * 18 * light; sx += dx / (dd + .01) * push; sy += dy / (dd + .01) * push; }
          }
        }
        if (a < .02) continue;
        g.globalAlpha = Math.min(1, a);
        g.fillStyle = '#d8d6d0';
        if (s < 1.6) g.fillRect(sx, sy, s, s);
        else { g.beginPath(); g.arc(sx, sy, s / 2, 0, 6.283); g.fill(); }
      }
      // пыль в воздухе
      for (const p of dust) {
        const yy = ((p.y - (reduced ? 0 : t * .01 * p.v)) % 1 + 1) % 1;
        g.globalAlpha = .18 * Math.sin(yy * Math.PI);
        g.fillRect(p.x * W, yy * H * .8, p.s, p.s);
      }
      // свечение фонарика
      if (light > .01) {
        const rg = g.createRadialGradient(mx, my, 0, mx, my, 160);
        rg.addColorStop(0, `rgba(255,253,248,${.08 * light})`); rg.addColorStop(1, 'rgba(255,253,248,0)');
        g.globalAlpha = 1; g.fillStyle = rg; g.fillRect(mx - 160, my - 160, 320, 320);
        g.fillStyle = `rgba(255,253,248,${.9 * light})`; g.beginPath(); g.arc(mx, my, 2.2, 0, 6.283); g.fill();
      }
      g.globalAlpha = 1;
    };
    if (reduced) { draw(performance.now()); addEventListener('resize', () => draw(performance.now())); }
    else {
      const loop = now => {
        requestAnimationFrame(loop);
        if (doc.hidden || now - last < 31) return;
        last = now; draw(now);
      };
      requestAnimationFrame(loop);
    }
  }

  /* ================= расшифровка заголовков ================= */
  const GLYPHS = '!<>-_\\/[]{}=+*^?#%$01ABCDEFGHKXZ';
  function decode(el) {
    if (el.dataset.dec) return; el.dataset.dec = '1';
    const text = el.textContent;
    if (reduced || !text.trim()) return;
    el.setAttribute('aria-label', text);
    el.dataset.txt = text;
    const chars = [...text], n = chars.length, start = performance.now(), dur = 380 + n * 28;
    const tick = now => {
      if (!el.dataset.txt) return;                              // уже дописан (например, перед печатью)
      const k = Math.min(1, (now - start) / dur);
      let out = '';
      for (let i = 0; i < n; i++) {
        const c = chars[i];
        if (c === ' ' || k * 1.25 > i / n + .25) out += c;
        else if (k * 1.25 > i / n) out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
        else out += ' ';
      }
      el.textContent = out;
      if (k < 1) requestAnimationFrame(tick); else finish(el);
    };
    requestAnimationFrame(tick);
  }
  function finish(el) {
    if (!el.dataset.txt) return;
    el.textContent = el.dataset.txt; delete el.dataset.txt; el.removeAttribute('aria-label');
  }
  // на бумагу — только итоговый текст, без мусорных глифов и скрытых блоков
  addEventListener('beforeprint', () => {
    doc.querySelectorAll('[data-txt]').forEach(finish);
    doc.querySelectorAll('.rv').forEach(el => el.classList.add('in'));
  });
  // h1 — сразу; у h2 расшифровывается только текст (номер раздела — в CSS)
  doc.querySelectorAll('h1').forEach(h => decode(h.querySelector('.scramble') || h));

  /* ================= проявление по мере прокрутки ================= */
  const targets = doc.querySelectorAll('.case-head > *, .case-body > *, .case-next, .cv > *');
  targets.forEach(el => el.classList.add('rv'));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    if (e.target.tagName === 'H2') decode(e.target);
    io.unobserve(e.target);
  }), { rootMargin: '0px 0px -8% 0px' });
  targets.forEach(el => io.observe(el));

  /* ================= прогресс чтения ================= */
  const bar = doc.getElementById('progress');
  if (bar) {
    const upd = () => { const max = root.scrollHeight - innerHeight; bar.style.height = (max > 0 ? Math.min(1, scrollY / max) * 100 : 100) + '%'; };
    addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
  }
})();
