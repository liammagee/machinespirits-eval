  /* ════════════════════════════════════════════════════════════════
     Live, data-driven layer. Probes the poetics browser at :3466.
     ════════════════════════════════════════════════════════════════ */

  /* When served from the Express browser itself, fetch same-origin (relative).
     When opened via file://, fall back to the absolute host. */
  const LIVE_HOST   = window.location.protocol === 'file:' ? 'http://127.0.0.1:3466' : '';
  const LIVE_TIMEOUT_MS = 1500;

  const root = document.documentElement;
  const body = document.body;
  const themeToggle  = document.getElementById('themeToggle');
  const railProgress = document.getElementById('railProgress');
  const beacon       = document.getElementById('beacon');
  const beaconText   = beacon.querySelector('.beacon__text');
  const tocLiveDt    = document.getElementById('tocLive');

  /* ── theme ───────────────────────────────────────── */
  function setTheme(next) {
    root.dataset.theme = next;
    body.dataset.theme = next;
    themeToggle.textContent = next === 'dark' ? 'Light' : 'Dark';
    try { localStorage.setItem('dramaticArcTheme', next); } catch (e) {}
  }
  setTheme((function () { try { return localStorage.getItem('dramaticArcTheme') || 'light'; } catch (e) { return 'light'; } })());
  themeToggle.addEventListener('click', () => {
    setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  /* ── rail progress + active section highlighting ─── */
  const railLinks = Array.from(document.querySelectorAll('.rail__nav a'));
  const tocItems  = Array.from(document.querySelectorAll('.toc__item'));
  const sections  = railLinks
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  function updateProgress() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const percent = scrollHeight <= 0 ? 0 : Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
    railProgress.style.width = percent + '%';

    let activeIdx = 0;
    const probe = window.scrollY + window.innerHeight * 0.25;
    sections.forEach((sec, i) => {
      if (sec.offsetTop <= probe) activeIdx = i;
    });
    const activeId = sections[activeIdx] ? sections[activeIdx].id : '';
    railLinks.forEach((a, i) => a.classList.toggle('active', i === activeIdx));
    tocItems.forEach((li) => {
      li.classList.toggle('is-active', li.dataset.target === activeId);
    });
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  /* ── evidence filters ────────────────────────────── */
  const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
  const evidenceCards = Array.from(document.querySelectorAll('.ev-card'));
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      filterButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      evidenceCards.forEach((card) => {
        const tags = (card.dataset.tags || '').split(' ');
        const show = filter === 'all' || tags.includes(filter);
        card.classList.toggle('is-hidden', !show);
      });
    });
  });

  /* ── TOC drawer ──────────────────────────────────── */
  const toc       = document.getElementById('toc');
  const tocScrim  = document.getElementById('tocScrim');
  const tocToggle = document.getElementById('tocToggle');
  const tocClose  = document.getElementById('tocClose');

  function openToc()  {
    toc.setAttribute('aria-hidden', 'false');
    tocToggle.setAttribute('aria-expanded', 'true');
  }
  function closeToc() {
    toc.setAttribute('aria-hidden', 'true');
    tocToggle.setAttribute('aria-expanded', 'false');
  }
  tocToggle.addEventListener('click', () => {
    toc.getAttribute('aria-hidden') === 'false' ? closeToc() : openToc();
  });
  tocClose.addEventListener('click', closeToc);
  tocScrim.addEventListener('click', closeToc);
  toc.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (a) {
      // close drawer on selection (mobile)
      if (window.matchMedia('(max-width: 91.999rem)').matches) {
        setTimeout(closeToc, 80);
      }
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toc.getAttribute('aria-hidden') === 'false') closeToc();
  });

  /* ── inline glossary tooltips ────────────────────── */
  function buildGlossaryMap() {
    const map = {};
    document.querySelectorAll('#glossaryList .gl-row').forEach((row) => {
      const dt = row.querySelector('dt');
      const dd = row.querySelector('dd');
      if (!dt || !dd) return;
      // primary term key (dt text without the .gloss suffix)
      const glossEl = dt.querySelector('.gloss');
      const term = dt.firstChild ? dt.firstChild.textContent.trim().toLowerCase() : '';
      const ddText = dd.textContent.trim().replace(/\s+/g, ' ');
      const gloss = glossEl ? glossEl.textContent.trim() : '';
      if (term) map[term] = { ddText, gloss };
      if (row.dataset.term) map[row.dataset.term.toLowerCase()] = { ddText, gloss };
    });
    return map;
  }
  function hydrateTooltips() {
    const map = buildGlossaryMap();
    // explicit alias mapping for inline dfn forms → glossary keys
    const aliases = {
      'stuck point': 'aporia',
      'adaptive-responsiveness': 'adaptive-responsiveness',
      'four-critic rule': 'four-critic-rule',
      'change of teaching move': 'habit-break',
      'low-organic': 'low-organic',
      'branch-local pressure': 'branch-local-pressure',
      'ego–superego': 'ego-superego',
      'ego-superego': 'ego-superego',
      'ending-shape': 'habit-break',
    };
    document.querySelectorAll('.gl-term').forEach((dfn) => {
      const raw = dfn.textContent.trim().toLowerCase();
      const key = aliases[raw] || raw;
      const entry = map[key];
      if (!entry) return;
      const tip = entry.ddText.length > 220 ? entry.ddText.slice(0, 218) + '…' : entry.ddText;
      dfn.setAttribute('data-gloss', tip);
      dfn.setAttribute('tabindex', '0');
      dfn.title = entry.gloss + ' — ' + tip;
    });
  }
  hydrateTooltips();

  /* ── live data layer ─────────────────────────────── */
  async function probeBrowser() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
    try {
      const res = await fetch(LIVE_HOST + '/api/runs', { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (!res.ok) throw new Error('bad status ' + res.status);
      const data = await res.json();
      return Array.isArray(data.runs) ? data.runs : [];
    } catch (e) {
      clearTimeout(timer);
      return null;
    }
  }

  async function fetchItems(runId) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
    try {
      const url = runId && runId !== '*'
        ? LIVE_HOST + '/api/items?runId=' + encodeURIComponent(runId)
        : LIVE_HOST + '/api/items';
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (!res.ok) throw new Error('bad status ' + res.status);
      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    } catch (e) {
      clearTimeout(timer);
      return null;
    }
  }

  function setBeacon(state, text) {
    beacon.setAttribute('data-state', state);
    beaconText.textContent = text;
    beacon.title = state === 'live'
      ? 'Poetics browser reachable at 127.0.0.1:3466 — click to open'
      : state === 'offline'
        ? 'Poetics browser not running. Start it with: node scripts/browse-poetics-scripts.js'
        : 'Probing 127.0.0.1:3466 for the poetics browser…';
  }

  function setAllLiveText(state, label) {
    document.querySelectorAll('[data-live-text]').forEach((el) => {
      const card = el.closest('[data-run-id], [data-live-target]');
      if (!card) {
        el.textContent = label;
        return;
      }
      el.textContent = label;
      const wrapper = el.closest('a');
      if (wrapper) wrapper.setAttribute('data-live', state);
    });
  }

  async function hydrateLive() {
    setBeacon('checking', 'checking');
    setAllLiveText('checking', 'checking…');
    const runs = await probeBrowser();
    if (runs === null) {
      setBeacon('offline', 'offline · :3466');
      tocLiveDt.innerHTML = '127.0.0.1:3466 — <em>offline</em>. Run <code>node scripts/browse-poetics-scripts.js</code>.';
      setAllLiveText('offline', 'static');
      return;
    }
    setBeacon('live', 'live · ' + runs.length + ' runs');
    tocLiveDt.innerHTML = '127.0.0.1:3466 — <em>live</em>, ' + runs.length + ' runs indexed.';

    // generic "browser" target (no runId): show total runs
    document.querySelectorAll('[data-live-target="browser"]').forEach((card) => {
      card.setAttribute('data-live', 'live');
      const counter = card.querySelector('[data-live-text]');
      if (counter) counter.textContent = runs.length + ' runs';
    });

    // per-card runId lookups (parallel)
    const cards = Array.from(document.querySelectorAll('[data-run-id]'));
    const groups = cards.reduce((acc, c) => {
      const id = c.getAttribute('data-run-id');
      (acc[id] = acc[id] || []).push(c);
      return acc;
    }, {});

    const ids = Object.keys(groups);
    await Promise.all(ids.map(async (id) => {
      const items = await fetchItems(id);
      const els = groups[id];
      if (items === null) {
        els.forEach((c) => {
          c.setAttribute('data-live', 'offline');
          const counter = c.querySelector('[data-live-text]');
          if (counter) counter.textContent = '—';
        });
        return;
      }
      els.forEach((c) => {
        c.setAttribute('data-live', 'live');
        const counter = c.querySelector('[data-live-text]');
        if (counter) counter.textContent = items.length + ' items';
      });
    }));
  }

  hydrateLive();

  /* ── SVG bar chart ───────────────────────────────── */
  function renderGroupedChart(svgEl, data) {
    // data: { metrics: [{ label, fmt? }], arms: [{ key, label, values: [n0,n1,n2,n3], denom?: [d0,d1,d2,d3] }] }
    const W = 720, H = 280;
    const padL = 130, padR = 24, padT = 12, padB = 36;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const m = data.metrics.length;
    const groupH = innerH / m;
    const barH   = (groupH - 8) / data.arms.length;

    const armColor = { routine: 'bar-routine', none: 'bar-none', 'peripeteia-only': 'bar-perip' };

    let svg = '';

    // baseline + ticks
    svg += `<line class="axis-line" x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" />`;
    [0, 25, 50, 75, 100].forEach((v) => {
      const x = padL + (v / 100) * innerW;
      svg += `<line class="axis-tick" x1="${x}" y1="${padT}" x2="${x}" y2="${padT + innerH}" />`;
      svg += `<text class="axis-lbl" x="${x}" y="${padT + innerH + 16}" text-anchor="middle">${v}</text>`;
    });

    // groups
    data.metrics.forEach((metric, mi) => {
      const groupTop = padT + mi * groupH;
      svg += `<text class="metric-lbl" x="${padL - 12}" y="${groupTop + groupH / 2 + 4}" text-anchor="end">${metric.label}</text>`;

      data.arms.forEach((arm, ai) => {
        const v = arm.values[mi];
        const denom = arm.denom ? arm.denom[mi] : null;
        const pct = denom ? (v / denom) * 100 : v;
        const w = Math.max(2, (pct / 100) * innerW);
        const y = groupTop + 4 + ai * barH;
        const cls = armColor[arm.key] || 'bar-routine';
        const display = denom ? `${v}/${denom}` : `${v}`;
        const delay = (mi * 0.06 + ai * 0.04).toFixed(2);
        svg += `<g class="bar anim" style="animation-delay:${delay}s">`;
        svg += `<rect class="bar-rect ${cls}" x="${padL}" y="${y}" width="${w}" height="${Math.max(8, barH - 3)}"></rect>`;
        svg += `<text class="bar-val" x="${padL + w + 6}" y="${y + (barH / 2) + 4}">${display}</text>`;
        svg += `</g>`;
      });
    });

    svgEl.innerHTML = svg;
  }

  const d42Data = {
    metrics: [
      { label: 'recognition (/5)' },
      { label: 'avg action' },
      { label: 'avg tutor mechanism' },
      { label: 'avg mechanism quality' },
    ],
    arms: [
      { key: 'routine',         label: 'routine',         values: [0, 60, 35, 35], denom: [5, null, null, null] },
      { key: 'none',            label: 'none',            values: [0, 65, 25, 25], denom: [5, null, null, null] },
      { key: 'peripeteia-only', label: 'peripeteia-only', values: [4, 80, 80, 80], denom: [5, null, null, null] },
    ],
  };

  const stratData = {
    metrics: [
      { label: 'recognition (% of rows)' },
      { label: 'avg action' },
      { label: 'avg tutor mechanism' },
      { label: 'avg quality' },
    ],
    arms: [
      { key: 'routine',         label: 'routine',         values: [46, 70.8, 53.1, 49.0], denom: [100, null, null, null] },
      { key: 'none',            label: 'none',            values: [63, 65.6, 44.8, 46.9], denom: [100, null, null, null] },
      { key: 'peripeteia-only', label: 'peripeteia-only', values: [100, 87.5, 68.8, 56.3], denom: [100, null, null, null] },
    ],
  };

  const chartD42   = document.getElementById('chartD42');
  const chartStrat = document.getElementById('chartStrat');

  // render once visible (so the bar-grow animation lands when seen)
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || entry.target.dataset.rendered) return;
      entry.target.dataset.rendered = '1';
      if (entry.target.id === 'chartD42')   renderGroupedChart(entry.target, d42Data);
      if (entry.target.id === 'chartStrat') renderGroupedChart(entry.target, stratData);
    });
  }, { threshold: 0.15 });
  observer.observe(chartD42);
  observer.observe(chartStrat);
