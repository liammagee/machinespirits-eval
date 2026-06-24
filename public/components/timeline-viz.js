/*
 * timeline-viz.js — interactive milestone timeline for /timeline.
 *
 * Reads the server payload `window.__TL` (today + computed milestones + GitHub
 * events) and renders a time-axis visualisation into #tl-viz, with a control bar
 * (#tl-controls) of options that persist to localStorage. Defaults reproduce the
 * shipped look: horizontal axis, GitHub events off, focused detail, colour by
 * state. The milestone-edit modal stays owned by TIMELINE_JS — this module only
 * emits `.ms__edit` buttons, which that handler picks up via delegation.
 */
(function () {
  const TL = window.__TL;
  const root = document.getElementById('tl-viz');
  const bar = document.getElementById('tl-controls');
  if (!TL || !root) return;

  const DEFAULTS = { layout: 'horizontal', events: 'off', detail: 'focused', colorBy: 'state' };
  const KEY = 'ms.timeline.opts';
  const opts = (function () {
    let o = {};
    try {
      o = JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      o = {};
    }
    return Object.assign({}, DEFAULTS, o);
  })();
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(opts));
    } catch (e) {
      /* private mode / quota — non-fatal */
    }
  }

  const M = TL.milestones || [];
  const EV = TL.events || [];
  const DAY = 86400000;
  const todayMs = Date.parse(TL.today);
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  const STATE_C = { done: '--moss', track: '--ochre', plan: '--ink-4', over: '--brick' };
  const STATE_SOFT = { done: '--moss-soft', track: '--ochre-soft', plan: '--paper-2', over: '--brick-soft' };
  const STATE_DEEP = { done: '--moss-deep', track: '--ochre-d', plan: '--ink-3', over: '--brick-d' };
  const STATUS_C = { done: '--indigo', active: '--moss', planned: '--ink-4' };
  const STATUS_SOFT = { done: '--indigo-soft', active: '--moss-soft', planned: '--paper-2' };
  const STATUS_DEEP = { done: '--indigo', active: '--moss-deep', planned: '--ink-3' };
  const STATE_LABEL = { done: 'complete', track: 'in progress', plan: 'not started', over: 'overdue' };
  const STATUS_LABEL = { done: 'done', active: 'active', planned: 'planned' };

  function cvar(m) {
    return 'var(' + (opts.colorBy === 'status' ? STATUS_C[m.status] || '--ink-4' : STATE_C[m.state]) + ')';
  }
  function softVar(m) {
    return 'var(' + (opts.colorBy === 'status' ? STATUS_SOFT[m.status] || '--paper-2' : STATE_SOFT[m.state]) + ')';
  }
  function deepVar(m) {
    return 'var(' + (opts.colorBy === 'status' ? STATUS_DEEP[m.status] || '--ink-3' : STATE_DEEP[m.state]) + ')';
  }
  function stateLabel(m) {
    return opts.colorBy === 'status' ? STATUS_LABEL[m.status] || m.status : STATE_LABEL[m.state];
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtShort(iso) {
    if (!iso) return 'no target';
    const p = String(iso).split('-');
    return +p[2] + ' ' + (MON[+p[1] - 1] || '');
  }
  function whenText(m) {
    if (m.days == null) return 'no target date';
    if (m.days === 0) return 'due today';
    return m.days > 0 ? 'in ' + m.days + ' day' + (m.days === 1 ? '' : 's') : Math.abs(m.days) + ' days ago';
  }
  function progressText(m) {
    if (m.total === 0) return 'no items assigned yet';
    if (m.state === 'done')
      return m.days != null && m.days > 0
        ? 'all ' + m.total + ' items done — ahead of the ' + fmtShort(m.target) + ' target'
        : 'all ' + m.total + ' items done';
    return m.pct + '% · ' + m.done + '/' + m.total + ' items done';
  }

  let focus = 0;

  /* ---- detail (focused card or expanded grid) ----------------------------- */
  function cardHtml(m, full) {
    const ship = m.tag
      ? ' · shipped ' +
        (m.tagUrl
          ? '<a href="' + esc(m.tagUrl) + '" target="_blank" rel="noopener">' + esc(m.tag) + '</a>'
          : esc(m.tag))
      : '';
    let items = '';
    if (full) {
      items =
        m.items && m.items.length
          ? '<ul class="tlv-items">' +
            m.items
              .map(function (i) {
                return (
                  '<li><span class="tl-st tl-st--' +
                  esc(i.status) +
                  '">' +
                  esc(i.status) +
                  '</span> <span class="tl-id">' +
                  esc(i.id) +
                  '</span> ' +
                  esc(i.title) +
                  '</li>'
                );
              })
              .join('') +
            '</ul>'
          : '<div class="tl-empty">no items yet — assign some on the board</div>';
    }
    return (
      '<div class="tlv-card" style="--c:' +
      cvar(m) +
      '">' +
      '<div class="tlv-card__h"><h3 class="tlv-card__t">' +
      esc(m.title) +
      '</h3>' +
      '<span class="tlv-pill" style="background:' +
      softVar(m) +
      ';color:' +
      deepVar(m) +
      '">' +
      esc(stateLabel(m)) +
      '</span>' +
      '<span class="tlv-when">' +
      esc(fmtShort(m.target)) +
      ' · ' +
      esc(whenText(m)) +
      '</span>' +
      '<button class="ms__edit" data-id="' +
      esc(m.id) +
      '">edit</button></div>' +
      '<div class="tlv-bar"><i style="width:' +
      m.pct +
      '%"></i></div>' +
      '<div class="tlv-sub">' +
      esc(progressText(m)) +
      esc(ship ? '' : '') +
      ship +
      '</div>' +
      (m.description ? '<div class="tlv-desc">' + esc(m.description) + '</div>' : '') +
      items +
      '</div>'
    );
  }
  function renderDetail() {
    const host = document.getElementById('tl-detail');
    if (!host) return;
    if (opts.detail === 'expanded') {
      host.className = 'tlv-grid-cards';
      host.innerHTML = M.map(function (m) {
        return cardHtml(m, true);
      }).join('');
    } else {
      host.className = '';
      host.innerHTML = M.length ? cardHtml(M[focus], false) : '<div class="tl-empty">No milestones yet.</div>';
    }
  }
  function setFocus(i) {
    focus = i;
    if (opts.detail === 'focused') renderDetail();
    const nodes = root.querySelectorAll('[data-i]');
    Array.prototype.forEach.call(nodes, function (n) {
      n.classList.toggle('dim', +n.getAttribute('data-i') !== i);
    });
  }

  /* ---- horizontal axis ---------------------------------------------------- */
  function renderHorizontal() {
    const W = 1000,
      PADX = 70,
      axisY = 150,
      R = 18,
      LANE_H = 34,
      C = 2 * Math.PI * R;
    const dates = [todayMs];
    M.forEach(function (m) {
      if (m.target) dates.push(Date.parse(m.target));
    });
    if (opts.events === 'on')
      EV.forEach(function (ev) {
        if (ev.date) dates.push(Date.parse(ev.date));
      });
    let min = Math.min.apply(null, dates),
      max = Math.max.apply(null, dates);
    const pad = Math.max((max - min) * 0.06, 3 * DAY);
    min -= pad;
    max += pad;
    function X(ms) {
      return PADX + ((ms - min) / (max - min)) * (W - 2 * PADX);
    }

    // greedy lane-packing: stack labels into as many rows as needed so they
    // never overlap (the full title still shows in the tooltip + detail card).
    function disp(t) {
      return t.length > 24 ? t.slice(0, 23) + '…' : t;
    }
    const laid = M.map(function (m, i) {
      const lx = m.target ? X(Date.parse(m.target)) : X(max);
      const label = disp(m.title);
      const wide = Math.max(label.length, (fmtShort(m.target) + ' · ' + m.pct + '%').length) * 6.6 + 10;
      return { m: m, i: i, x: lx, label: label, half: wide / 2, lane: 0 };
    });
    const laneRight = [];
    laid.forEach(function (n) {
      let l = 0;
      while (l < laneRight.length && n.x - n.half < laneRight[l] + 10) l++;
      n.lane = l;
      laneRight[l] = n.x + n.half;
    });
    const laneCount = Math.max(1, laneRight.length);
    const H = axisY + 42 + laneCount * LANE_H + 14;

    let s =
      '<svg viewBox="0 0 ' +
      W +
      ' ' +
      H +
      '" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Horizontal milestone timeline with a today marker; milestones to the right of today are still upcoming.">';

    // month gridlines + labels
    const d = new Date(min);
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    while (d.getTime() <= max) {
      const mx = X(d.getTime());
      if (mx > PADX - 4 && mx < W - PADX + 4) {
        s +=
          '<line class="tlv-grid" x1="' +
          mx.toFixed(1) +
          '" y1="42" x2="' +
          mx.toFixed(1) +
          '" y2="' +
          (H - 12) +
          '"/>';
        s += '<text class="tlv-month" x="' + (mx + 5).toFixed(1) + '" y="34">' + MON[d.getUTCMonth()] + '</text>';
      }
      d.setUTCMonth(d.getUTCMonth() + 1);
    }

    s +=
      '<line class="tlv-axis" x1="' + PADX + '" y1="' + axisY + '" x2="' + (W - PADX + 24) + '" y2="' + axisY + '"/>';
    s +=
      '<polygon points="' +
      (W - PADX + 24) +
      ',' +
      axisY +
      ' ' +
      (W - PADX + 16) +
      ',' +
      (axisY - 4) +
      ' ' +
      (W - PADX + 16) +
      ',' +
      (axisY + 4) +
      '" fill="var(--rule)"/>';

    // GitHub events lane
    if (opts.events === 'on' && EV.length) {
      EV.forEach(function (ev) {
        if (!ev.date) return;
        const ex = X(Date.parse(ev.date));
        s +=
          '<line class="tlv-ev-line" x1="' +
          ex.toFixed(1) +
          '" y1="100" x2="' +
          ex.toFixed(1) +
          '" y2="' +
          (axisY - 6) +
          '"/>';
        s +=
          '<path class="tlv-ev" transform="translate(' +
          ex.toFixed(1) +
          ',96)" d="M0,-6 L6,0 L0,6 L-6,0 Z"><title>' +
          esc((ev.kind || 'event') + ': ' + ev.label + ' · ' + ev.date) +
          '</title></path>';
      });
      s += '<text class="tlv-month" x="' + PADX + '" y="84">github releases</text>';
    }

    // today
    const tx = X(todayMs);
    s +=
      '<line class="tlv-today" x1="' + tx.toFixed(1) + '" y1="44" x2="' + tx.toFixed(1) + '" y2="' + (H - 12) + '"/>';
    s += '<circle class="tlv-pulse" cx="' + tx.toFixed(1) + '" cy="' + axisY + '" r="5"/>';
    s += '<circle cx="' + tx.toFixed(1) + '" cy="' + axisY + '" r="4.5" fill="var(--ink)"/>';
    s +=
      '<text class="tlv-dlabel" x="' +
      (tx + 7).toFixed(1) +
      '" y="40" style="fill:var(--ink);font-weight:600">today</text>';
    s +=
      '<text class="tlv-dlabel" x="' +
      (tx + 7).toFixed(1) +
      '" y="' +
      (H - 4) +
      '" style="fill:var(--ink-4)">' +
      fmtShort(TL.today) +
      '</text>';

    // milestone nodes (labels packed into the lanes computed above)
    laid.forEach(function (n) {
      const m = n.m;
      const i = n.i;
      const x = n.x;
      const ty = axisY + 42 + n.lane * LANE_H;
      const off = (C * (1 - m.pct / 100)).toFixed(1);
      s += '<g class="tlv-node" data-i="' + i + '" style="--c:' + cvar(m) + '"><title>' + esc(m.title) + '</title>';
      s +=
        '<line class="tlv-grid" x1="' +
        x.toFixed(1) +
        '" y1="' +
        (axisY + R + 2) +
        '" x2="' +
        x.toFixed(1) +
        '" y2="' +
        (ty - 13) +
        '"/>';
      s += '<circle class="tlv-track" cx="' + x.toFixed(1) + '" cy="' + axisY + '" r="' + R + '"/>';
      s +=
        '<circle class="tlv-ring" cx="' +
        x.toFixed(1) +
        '" cy="' +
        axisY +
        '" r="' +
        R +
        '" transform="rotate(-90 ' +
        x.toFixed(1) +
        ' ' +
        axisY +
        ')" stroke-dasharray="' +
        C.toFixed(1) +
        '" stroke-dashoffset="' +
        C.toFixed(1) +
        '" data-off="' +
        off +
        '"/>';
      s += '<circle class="tlv-dot" cx="' + x.toFixed(1) + '" cy="' + axisY + '" r="4.5"/>';
      s +=
        '<text class="tlv-tlabel" x="' +
        x.toFixed(1) +
        '" y="' +
        ty +
        '" text-anchor="middle" style="fill:var(--ink)">' +
        esc(n.label) +
        '</text>';
      s +=
        '<text class="tlv-dlabel" x="' +
        x.toFixed(1) +
        '" y="' +
        (ty + 14) +
        '" text-anchor="middle" style="fill:var(--ink-4)">' +
        esc(fmtShort(m.target)) +
        ' · ' +
        m.pct +
        '%</text>';
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + axisY + '" r="26" fill="transparent"/>';
      s += '</g>';
    });

    s += '</svg>';
    root.innerHTML = '<div class="tl-viz-scroll">' + s + '</div>';
  }

  /* ---- vertical rail ------------------------------------------------------ */
  function renderVertical() {
    const rows = M.map(function (m, i) {
      const ship = m.tag ? ' · shipped ' + esc(m.tag) : '';
      return (
        '<div class="tlv-v__row tlv-node" data-i="' +
        i +
        '" style="--c:' +
        cvar(m) +
        '">' +
        '<span class="tlv-v__node"></span>' +
        '<div class="tlv-v__h"><span class="tlv-v__t">' +
        esc(m.title) +
        '</span>' +
        '<span class="tlv-pill" style="background:' +
        softVar(m) +
        ';color:' +
        deepVar(m) +
        '">' +
        esc(stateLabel(m)) +
        '</span>' +
        '<span class="tlv-v__date">' +
        esc(fmtShort(m.target)) +
        ' · ' +
        esc(whenText(m)) +
        '</span></div>' +
        '<div class="tlv-bar"><i style="width:' +
        m.pct +
        '%"></i></div>' +
        '<div class="tlv-sub">' +
        esc(progressText(m)) +
        esc(ship) +
        '</div>' +
        '</div>'
      );
    });
    const head =
      '<div class="tlv-v__row tlv-v__today"><span class="tlv-v__node"></span>' +
      '<div class="tlv-v__h"><span class="tlv-v__t" style="color:var(--ink)">today</span>' +
      '<span class="tlv-v__date">' +
      fmtShort(TL.today) +
      '</span></div>' +
      '<div class="tlv-sub">everything below is dated after today</div></div>';
    root.innerHTML = '<div class="tlv-v"><span class="tlv-v__spine"></span>' + head + rows.join('') + '</div>';
  }

  /* ---- control bar -------------------------------------------------------- */
  const SEGS = [
    {
      key: 'layout',
      label: 'layout',
      opts: [
        ['horizontal', 'horizontal'],
        ['vertical', 'vertical'],
      ],
    },
    {
      key: 'events',
      label: 'github events',
      opts: [
        ['off', 'off'],
        ['on', 'on'],
      ],
    },
    {
      key: 'detail',
      label: 'detail',
      opts: [
        ['focused', 'focused'],
        ['expanded', 'expanded'],
      ],
    },
    {
      key: 'colorBy',
      label: 'colour',
      opts: [
        ['state', 'by state'],
        ['status', 'by status'],
      ],
    },
  ];
  function buildControls() {
    if (!bar) return;
    bar.innerHTML = SEGS.map(function (seg) {
      const btns = seg.opts
        .map(function (o) {
          return (
            '<button type="button" data-seg="' +
            seg.key +
            '" data-val="' +
            o[0] +
            '" class="' +
            (opts[seg.key] === o[0] ? 'on' : '') +
            '">' +
            o[1] +
            '</button>'
          );
        })
        .join('');
      return (
        '<span class="tl-segwrap"><span class="tl-seg__lab">' +
        seg.label +
        '</span><span class="tl-seg">' +
        btns +
        '</span></span>'
      );
    }).join('');
  }
  function syncControls() {
    if (!bar) return;
    Array.prototype.forEach.call(bar.querySelectorAll('button[data-seg]'), function (b) {
      b.classList.toggle('on', opts[b.getAttribute('data-seg')] === b.getAttribute('data-val'));
    });
    const det = document.getElementById('tl-detail');
    if (det) det.style.display = opts.layout === 'vertical' && opts.detail === 'focused' ? 'none' : '';
  }

  /* ---- wire + render ------------------------------------------------------ */
  function render() {
    if (opts.layout === 'vertical') renderVertical();
    else renderHorizontal();
    renderDetail();
    syncControls();
    Array.prototype.forEach.call(root.querySelectorAll('[data-i]'), function (n) {
      const i = +n.getAttribute('data-i');
      n.addEventListener('mouseenter', function () {
        setFocus(i);
      });
      n.addEventListener('click', function () {
        setFocus(i);
      });
    });
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        Array.prototype.forEach.call(root.querySelectorAll('.tlv-ring'), function (r) {
          r.style.strokeDashoffset = r.getAttribute('data-off');
        });
      });
    });
  }

  /* ---- compact mode (embedded on /board) --------------------------------- */
  // A short band that doubles as the milestone filter: each node bridges to the
  // hidden `.ms-mini` chip the board already wires, so the filter/URL logic is
  // untouched. We only mirror the active milestone back onto the node.
  function renderCompact() {
    const W = 1000,
      PADX = 64,
      axisY = 50,
      R = 13,
      LANE_H = 30,
      C = 2 * Math.PI * R;
    const dates = [todayMs];
    M.forEach(function (m) {
      if (m.target) dates.push(Date.parse(m.target));
    });
    let min = Math.min.apply(null, dates),
      max = Math.max.apply(null, dates);
    const pad = Math.max((max - min) * 0.06, 3 * DAY);
    min -= pad;
    max += pad;
    const X = function (ms) {
      return PADX + ((ms - min) / (max - min)) * (W - 2 * PADX);
    };
    const disp = function (t) {
      return t.length > 22 ? t.slice(0, 21) + '…' : t;
    };
    const laid = M.map(function (m, i) {
      const lx = m.target ? X(Date.parse(m.target)) : X(max);
      const label = disp(m.title);
      return { m: m, i: i, x: lx, label: label, half: (Math.max(label.length, 7) * 6.2 + 8) / 2, lane: 0 };
    });
    const laneRight = [];
    laid.forEach(function (n) {
      let l = 0;
      while (l < laneRight.length && n.x - n.half < laneRight[l] + 10) l++;
      n.lane = l;
      laneRight[l] = n.x + n.half;
    });
    const H = axisY + 28 + Math.max(1, laneRight.length) * LANE_H;
    let s =
      '<svg viewBox="0 0 ' +
      W +
      ' ' +
      H +
      '" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Compact milestone timeline; click a milestone to filter the board.">';
    const d = new Date(min);
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    while (d.getTime() <= max) {
      const mx = X(d.getTime());
      if (mx > PADX - 4 && mx < W - PADX + 4) {
        s +=
          '<line class="tlv-grid" x1="' + mx.toFixed(1) + '" y1="20" x2="' + mx.toFixed(1) + '" y2="' + (H - 8) + '"/>';
        s += '<text class="tlv-month" x="' + (mx + 4).toFixed(1) + '" y="16">' + MON[d.getUTCMonth()] + '</text>';
      }
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    s += '<line class="tlv-axis" x1="' + PADX + '" y1="' + axisY + '" x2="' + (W - PADX) + '" y2="' + axisY + '"/>';
    const tx = X(todayMs);
    s += '<line class="tlv-today" x1="' + tx.toFixed(1) + '" y1="24" x2="' + tx.toFixed(1) + '" y2="' + (H - 8) + '"/>';
    s += '<circle class="tlv-pulse" cx="' + tx.toFixed(1) + '" cy="' + axisY + '" r="4"/>';
    s += '<circle cx="' + tx.toFixed(1) + '" cy="' + axisY + '" r="4" fill="var(--ink)"/>';
    s +=
      '<text class="tlv-dlabel" x="' +
      (tx + 6).toFixed(1) +
      '" y="16" style="fill:var(--ink);font-weight:600">today</text>';
    laid.forEach(function (n) {
      const m = n.m;
      const x = n.x;
      const ty = axisY + 26 + n.lane * LANE_H;
      const off = (C * (1 - m.pct / 100)).toFixed(1);
      s +=
        '<g class="tlv-node tlv-fnode" data-i="' +
        n.i +
        '" data-ms="' +
        esc(m.id) +
        '" style="--c:' +
        cvar(m) +
        '"><title>' +
        esc(m.title) +
        ' · ' +
        esc(stateLabel(m)) +
        ' · ' +
        m.pct +
        '%</title>';
      s += '<circle class="tlv-halo" cx="' + x.toFixed(1) + '" cy="' + axisY + '" r="' + (R + 5) + '"/>';
      s +=
        '<line class="tlv-grid" x1="' +
        x.toFixed(1) +
        '" y1="' +
        (axisY + R + 1) +
        '" x2="' +
        x.toFixed(1) +
        '" y2="' +
        (ty - 11) +
        '"/>';
      s += '<circle class="tlv-track" cx="' + x.toFixed(1) + '" cy="' + axisY + '" r="' + R + '"/>';
      s +=
        '<circle class="tlv-ring" cx="' +
        x.toFixed(1) +
        '" cy="' +
        axisY +
        '" r="' +
        R +
        '" transform="rotate(-90 ' +
        x.toFixed(1) +
        ' ' +
        axisY +
        ')" stroke-dasharray="' +
        C.toFixed(1) +
        '" stroke-dashoffset="' +
        C.toFixed(1) +
        '" data-off="' +
        off +
        '"/>';
      s += '<circle class="tlv-dot" cx="' + x.toFixed(1) + '" cy="' + axisY + '" r="3.5"/>';
      s +=
        '<text class="tlv-tlabel" x="' +
        x.toFixed(1) +
        '" y="' +
        ty +
        '" text-anchor="middle" style="fill:var(--ink);font-size:11px">' +
        esc(n.label) +
        '</text>';
      s +=
        '<text class="tlv-dlabel" x="' +
        x.toFixed(1) +
        '" y="' +
        (ty + 12) +
        '" text-anchor="middle" style="fill:var(--ink-4);font-size:10px">' +
        m.pct +
        '%</text>';
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + axisY + '" r="' + (R + 7) + '" fill="transparent"/></g>';
    });
    s += '</svg>';
    root.innerHTML = '<div class="tl-viz-scroll">' + s + '</div>';
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        Array.prototype.forEach.call(root.querySelectorAll('.tlv-ring'), function (r) {
          r.style.strokeDashoffset = r.getAttribute('data-off');
        });
      });
    });
  }
  function activeMilestone() {
    const on = document.querySelector('.ms-mini[data-filter-kind="milestone"].on');
    if (on) {
      const f = on.getAttribute('data-filter');
      return f && f !== '__none' ? f : null;
    }
    try {
      return new URL(window.location.href).searchParams.get('milestone');
    } catch (e) {
      return null;
    }
  }
  function syncActive() {
    const id = activeMilestone();
    Array.prototype.forEach.call(root.querySelectorAll('.tlv-fnode'), function (n) {
      n.classList.toggle('on', n.getAttribute('data-ms') === id);
    });
  }
  function wireCompact() {
    const escSel = function (v) {
      return window.CSS && CSS.escape ? CSS.escape(v) : String(v).replace(/"/g, '\\"');
    };
    Array.prototype.forEach.call(root.querySelectorAll('.tlv-fnode'), function (n) {
      n.addEventListener('click', function () {
        const btn = document.querySelector(
          '.ms-mini[data-filter-kind="milestone"][data-filter="' + escSel(n.getAttribute('data-ms')) + '"]',
        );
        if (btn) btn.click();
        syncActive();
      });
    });
    document.addEventListener('click', function (ev) {
      const c = ev.target && ev.target.closest ? ev.target.closest('[data-filter]') : null;
      if (c && !root.contains(c)) window.setTimeout(syncActive, 0);
    });
    syncActive();
  }

  if (TL.compact) {
    renderCompact();
    wireCompact();
    return;
  }

  if (bar) {
    buildControls();
    bar.addEventListener('click', function (ev) {
      const b = ev.target && ev.target.closest ? ev.target.closest('button[data-seg]') : null;
      if (!b) return;
      opts[b.getAttribute('data-seg')] = b.getAttribute('data-val');
      save();
      render();
    });
  }
  render();
})();
