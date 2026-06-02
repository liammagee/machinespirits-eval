/* ════════════════════════════════════════════════════════════════
   techne.js — shared behaviour for techne editorial docs.

   Drop into any doc with  <script src="assets/techne.js"></script>
   just before </body>. Every feature is GUARDED and opt-in: it
   activates only if its markup is present, so this file is safe to
   load on a doc that has no rail / TOC / beacon / charts / glossary.

   Doc-specific *content* stays in the doc as declarative JSON:
     • chart data:   <script type="application/json" class="techne-chart" data-target="myChartId">{…}</script>
     • gloss aliases: <script type="application/json" id="techne-gloss-aliases">{ "inline term": "glossary-key" }</script>
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function init() {
    const root = document.documentElement;
    const body = document.body;
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

    /* ── theme toggle (opt-in: #themeToggle; theme persists regardless) ── */
    const THEME_KEY = 'techneTheme';
    function setTheme(next) {
      root.dataset.theme = next;
      if (body) body.dataset.theme = next;
      const t = document.getElementById('themeToggle');
      if (t) t.textContent = next === 'dark' ? 'Light' : 'Dark';
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) {
        /* ignore */
      }
    }
    let saved = 'light';
    try {
      saved = localStorage.getItem(THEME_KEY) || 'light';
    } catch (e) {
      /* ignore */
    }
    setTheme(saved);
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
    }

    /* ── reading progress + active-section spy (opt-in: #railProgress / .rail__nav a) ── */
    const railProgress = document.getElementById('railProgress');
    const railLinks = $$('.rail__nav a');
    const tocItems = $$('.toc__item');
    const spy = railLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
    if (railProgress || railLinks.length) {
      const update = () => {
        const top = window.scrollY || root.scrollTop;
        if (railProgress) {
          const h = root.scrollHeight - window.innerHeight;
          railProgress.style.width = (h <= 0 ? 0 : Math.min(100, Math.max(0, (top / h) * 100))) + '%';
        }
        if (spy.length) {
          let idx = 0;
          const probe = top + window.innerHeight * 0.25;
          spy.forEach((s, i) => {
            if (s.offsetTop <= probe) idx = i;
          });
          const id = spy[idx] ? spy[idx].id : '';
          railLinks.forEach((a, i) => a.classList.toggle('active', i === idx));
          tocItems.forEach((li) => li.classList.toggle('is-active', li.dataset.target === id));
        }
      };
      window.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      update();
    }

    /* ── filter chips (opt-in: [data-filter] buttons + .ev-card[data-tags]) ── */
    const filterButtons = $$('[data-filter]');
    if (filterButtons.length) {
      const cards = $$('.ev-card');
      filterButtons.forEach((btn) =>
        btn.addEventListener('click', () => {
          const f = btn.dataset.filter;
          filterButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
          cards.forEach((c) => {
            const tags = (c.dataset.tags || '').split(' ');
            c.classList.toggle('is-hidden', !(f === 'all' || tags.includes(f)));
          });
        }),
      );
    }

    /* ── TOC drawer (opt-in: #toc) ── */
    const toc = document.getElementById('toc');
    if (toc) {
      const tocToggle = document.getElementById('tocToggle');
      const tocClose = document.getElementById('tocClose');
      const tocScrim = document.getElementById('tocScrim');
      const open = () => {
        toc.setAttribute('aria-hidden', 'false');
        if (tocToggle) tocToggle.setAttribute('aria-expanded', 'true');
      };
      const close = () => {
        toc.setAttribute('aria-hidden', 'true');
        if (tocToggle) tocToggle.setAttribute('aria-expanded', 'false');
      };
      if (tocToggle)
        tocToggle.addEventListener('click', () => (toc.getAttribute('aria-hidden') === 'false' ? close() : open()));
      if (tocClose) tocClose.addEventListener('click', close);
      if (tocScrim) tocScrim.addEventListener('click', close);
      toc.addEventListener('click', (e) => {
        if (e.target.closest('a[href^="#"]') && window.matchMedia('(max-width: 91.999rem)').matches)
          setTimeout(close, 80);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && toc.getAttribute('aria-hidden') === 'false') close();
      });
    }

    /* ── inline glossary tooltips (opt-in: #glossaryList + .gl-term) ── */
    const glossaryList = document.getElementById('glossaryList');
    if (glossaryList) {
      let aliases = {};
      const aliasEl = document.getElementById('techne-gloss-aliases');
      if (aliasEl) {
        try {
          aliases = JSON.parse(aliasEl.textContent) || {};
        } catch (e) {
          /* ignore */
        }
      }
      const map = {};
      $$('.gl-row', glossaryList).forEach((row) => {
        const dt = row.querySelector('dt'),
          dd = row.querySelector('dd');
        if (!dt || !dd) return;
        const glossEl = dt.querySelector('.gloss');
        const term = dt.firstChild ? dt.firstChild.textContent.trim().toLowerCase() : '';
        const ddText = dd.textContent.trim().replace(/\s+/g, ' ');
        const gloss = glossEl ? glossEl.textContent.trim() : '';
        if (term) map[term] = { ddText, gloss };
        if (row.dataset.term) map[row.dataset.term.toLowerCase()] = { ddText, gloss };
      });
      $$('.gl-term').forEach((el) => {
        const raw = el.textContent.trim().toLowerCase();
        const entry = map[aliases[raw] || raw] || map[raw];
        if (!entry) return;
        const tip = entry.ddText.length > 220 ? entry.ddText.slice(0, 218) + '…' : entry.ddText;
        el.setAttribute('data-gloss', tip);
        el.setAttribute('tabindex', '0');
        el.title = entry.gloss + ' — ' + tip;
      });
    }

    /* ── live data layer (opt-in: #beacon; probes the poetics browser) ── */
    const beacon = document.getElementById('beacon');
    if (beacon) {
      const LIVE_HOST = window.location.protocol === 'file:' ? 'http://127.0.0.1:3466' : '';
      const LIVE_TIMEOUT_MS = 1500;
      const beaconText = beacon.querySelector('.beacon__text');
      const tocLiveDt = document.getElementById('tocLive');

      const getJSON = async (url) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), LIVE_TIMEOUT_MS);
        try {
          const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
          clearTimeout(timer);
          return res.ok ? await res.json() : null;
        } catch (e) {
          clearTimeout(timer);
          return null;
        }
      };
      const setBeacon = (state, text) => {
        beacon.setAttribute('data-state', state);
        if (beaconText) beaconText.textContent = text;
      };
      const setAllLiveText = (state, label) => {
        $$('[data-live-text]').forEach((el) => {
          el.textContent = label;
          const wrapper = el.closest('a');
          if (wrapper && wrapper.matches('[data-run-id], [data-live-target]')) wrapper.setAttribute('data-live', state);
        });
      };

      (async function hydrate() {
        setBeacon('checking', 'checking');
        setAllLiveText('checking', 'checking…');
        const runsData = await getJSON(LIVE_HOST + '/api/runs');
        const runs = runsData && Array.isArray(runsData.runs) ? runsData.runs : null;
        if (runs === null) {
          setBeacon('offline', 'offline · :3466');
          if (tocLiveDt)
            tocLiveDt.innerHTML = '127.0.0.1:3466 — <em>offline</em>. Run <code>npm run poetics:browse</code>.';
          setAllLiveText('offline', 'static');
          return;
        }
        setBeacon('live', 'live · ' + runs.length + ' runs');
        if (tocLiveDt) tocLiveDt.innerHTML = '127.0.0.1:3466 — <em>live</em>, ' + runs.length + ' runs indexed.';
        $$('[data-live-target="browser"]').forEach((card) => {
          card.setAttribute('data-live', 'live');
          const c = card.querySelector('[data-live-text]');
          if (c) c.textContent = runs.length + ' runs';
        });
        const groups = $$('[data-run-id]').reduce((acc, c) => {
          const id = c.getAttribute('data-run-id');
          (acc[id] = acc[id] || []).push(c);
          return acc;
        }, {});
        await Promise.all(
          Object.keys(groups).map(async (id) => {
            const itemsData =
              id && id !== '*'
                ? await getJSON(LIVE_HOST + '/api/items?runId=' + encodeURIComponent(id))
                : await getJSON(LIVE_HOST + '/api/items');
            const items = itemsData && Array.isArray(itemsData.items) ? itemsData.items : null;
            groups[id].forEach((c) => {
              c.setAttribute('data-live', items === null ? 'offline' : 'live');
              const counter = c.querySelector('[data-live-text]');
              if (counter) counter.textContent = items === null ? '—' : items.length + ' items';
            });
          }),
        );
      })();
    }

    /* ── grouped bar charts (opt-in: <svg class="chart" id="X"> + JSON data block) ──
       Provide data per chart with:
         <script type="application/json" class="techne-chart" data-target="X">
           { "metrics": [{"label": "…"}], "arms": [{"key":"routine","values":[…],"denom":[…]}] }
         </script>                                                                      */
    function renderGroupedChart(svgEl, data) {
      const W = 720,
        H = 280,
        padL = 130,
        padR = 24,
        padT = 12,
        padB = 36;
      const innerW = W - padL - padR,
        innerH = H - padT - padB;
      const groupH = innerH / data.metrics.length;
      const barH = (groupH - 8) / data.arms.length;
      const armColor = { routine: 'bar-routine', none: 'bar-none', 'peripeteia-only': 'bar-perip' };
      let svg = `<line class="axis-line" x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" />`;
      [0, 25, 50, 75, 100].forEach((v) => {
        const x = padL + (v / 100) * innerW;
        svg += `<line class="axis-tick" x1="${x}" y1="${padT}" x2="${x}" y2="${padT + innerH}" />`;
        svg += `<text class="axis-lbl" x="${x}" y="${padT + innerH + 16}" text-anchor="middle">${v}</text>`;
      });
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
          svg += `<text class="bar-val" x="${padL + w + 6}" y="${y + barH / 2 + 4}">${display}</text></g>`;
        });
      });
      svgEl.innerHTML = svg;
    }

    const chartSpecs = $$('script.techne-chart[data-target]')
      .map((s) => {
        const el = document.getElementById(s.dataset.target);
        let data = null;
        try {
          data = JSON.parse(s.textContent);
        } catch (e) {
          /* ignore */
        }
        return el && data ? { el, data } : null;
      })
      .filter(Boolean);
    if (chartSpecs.length) {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting || entry.target.dataset.rendered) return;
            const spec = chartSpecs.find((s) => s.el === entry.target);
            if (!spec) return;
            entry.target.dataset.rendered = '1';
            renderGroupedChart(spec.el, spec.data);
          });
        },
        { threshold: 0.15 },
      );
      chartSpecs.forEach((s) => obs.observe(s.el));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
