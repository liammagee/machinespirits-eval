import path from 'node:path';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function safeJsonForScript(value) {
  return String(value)
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e')
    .replace(/&/gu, '\\u0026')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
}

export function reportRowId(row, index, prefix = 'row', safeSlug) {
  const traceStem = row.trace ? path.basename(row.trace, path.extname(row.trace)) : '';
  return [
    prefix,
    String(index + 1).padStart(2, '0'),
    safeSlug(row.policy || 'policy'),
    `r${safeSlug(row.runIndex || 'x')}`,
    safeSlug(traceStem).slice(0, 36),
  ]
    .filter(Boolean)
    .join('-');
}

export function animatedVizRowId(row, index, safeSlug) {
  return reportRowId(row, index, 'viz', safeSlug);
}

export function animatedVizReportPayload(rows, { safeSlug, fieldRowTitle }) {
  const vizRows = rows.filter((row) => row.animatedViz?.frames?.length);
  return {
    schema: 'machinespirits.tutor-stub.report-animation.v1',
    rows: vizRows.map((row, index) => ({
      id: animatedVizRowId(row, index, safeSlug),
      title: fieldRowTitle(row),
      policy: row.policy,
      runIndex: row.runIndex,
      status: row.status,
      groundedClosure: row.groundedClosure,
      stopReason: row.stopReason || null,
      turnCount: row.turnCount,
      trace: row.trace || null,
      viz: row.animatedViz,
    })),
  };
}

export function infoTerm(label, tooltip) {
  return `<span class="info-term" tabindex="0" data-tip="${escapeHtml(tooltip)}">${escapeHtml(label)}</span>`;
}

export function renderAnimatedVizGuide() {
  const terms = [
    [
      'Field signals',
      'The learner-discourse movement surface: mastery, risk, alignment, momentum, evidence use, agency, and stance across turns.',
    ],
    [
      'Learner-DAG',
      'The tutor-side learner-DAG model: how much of the proof path appears grounded, voiced, missing, or unsupported.',
    ],
    [
      'Risk score',
      'A compact warning score for fragile progress: unsupported assertions, premature secret claims, face pressure, or rising recognition cost.',
    ],
    [
      'Derivative trace',
      'The recent path through field, DAG, and risk values. It asks whether the dialogue is moving, stalling, regressing, or converging.',
    ],
    [
      'Velocity',
      'The latest turn-to-turn change. Positive field/DAG velocity is usually good; positive risk velocity is usually bad.',
    ],
    [
      'Slope',
      'The short-window trend line. It is less twitchy than one-turn velocity and helps identify plateau or convergence.',
    ],
    ['Acceleration', 'Change in velocity. Large acceleration can mean a real phase shift or an unstable/noisy turn.'],
    [
      'Proof status',
      'The current proof-path state. Missing evidence, learner integration gap, and premature assertion are open states; grounded asserted-secret closure is shown as closed.',
    ],
    [
      'Register/style',
      'The discursive strategy selected for the tutor turn, such as precise, warm, brisk, witnessing, or a negative control register.',
    ],
    [
      'Policy distribution',
      'The policy probability spread over available registers. Continuous policies show the weighted stance blend; selected-only policies show observed frequency instead.',
    ],
    [
      'Policy Compare',
      'A variable-first replay view: choose one variable, then compare the per-turn policy means across all runs in the report.',
    ],
  ];
  return `<details class="viz-sidebar" aria-label="Turn replay explanation">
    <summary>How to read the replay</summary>
    <div class="viz-sidebar-body"><h3>Reading The Replay</h3>
    <p>
      The ${infoTerm('register policy', 'The algorithm being benchmarked, such as field, trajectory, dynamical_system, or continuous_dynamical_system.')} belongs to the
      selected eval row. The buttons choose only the ${infoTerm(
        'visual view',
        'The lens used to draw the same turn sequence; it does not change the underlying policy.',
      )}. Each frame combines ${infoTerm('field signals', terms[0][1])}, ${infoTerm('learner-DAG', terms[1][1])},
      ${infoTerm('risk', terms[2][1])}, and ${infoTerm('register/style', terms[8][1])}.
    </p>
    <dl>
      ${terms
        .map(
          ([term, description]) => `<div>
            <dt>${infoTerm(term, description)}</dt>
            <dd>${escapeHtml(description)}</dd>
          </div>`,
        )
        .join('\n')}
    </dl></div>
  </details>`;
}

export function renderAnimatedVizSection(rows, { safeSlug, fieldRowTitle }) {
  const payload = animatedVizReportPayload(rows, { safeSlug, fieldRowTitle });
  if (!payload.rows.length) {
    return '<p class="sub">No turn-by-turn visualization frames were found in these traces.</p>';
  }
  return `<div class="viz-player" id="tutor-stub-viz-player">
    <div class="viz-layout">
      <div class="viz-main">
        <div class="viz-toolbar">
          <label class="viz-select-label viz-run-control"><span>Policy Run</span><select data-viz-run></select></label>
          <div class="viz-control-group viz-view-control">
            <span class="viz-group-label">View</span>
            <div class="viz-mode-buttons" role="tablist" aria-label="Visualization view">
              <button type="button" role="tab" aria-selected="false" aria-controls="tutor-stub-viz-canvas" data-viz-mode="state">State Snapshot</button>
              <button type="button" role="tab" aria-selected="true" aria-controls="tutor-stub-viz-canvas" data-viz-mode="field" class="active">Interaction Field</button>
              <button type="button" role="tab" aria-selected="false" aria-controls="tutor-stub-viz-canvas" data-viz-mode="trajectory">Derivative Trace</button>
              <button type="button" role="tab" aria-selected="false" aria-controls="tutor-stub-viz-canvas" data-viz-mode="dynamics">System Model</button>
              <button type="button" role="tab" aria-selected="false" aria-controls="tutor-stub-viz-canvas" data-viz-mode="registers">Register Lens</button>
              <button type="button" role="tab" aria-selected="false" aria-controls="tutor-stub-viz-canvas" data-viz-mode="compare">Policy Compare</button>
            </div>
          </div>
          <label class="viz-select-label viz-variable-control"><span>Variable</span><select data-viz-variable></select></label>
          <div class="viz-control-group viz-playback-control">
            <span class="viz-group-label">Playback</span>
            <div class="viz-step-buttons" aria-label="Turn playback controls">
              <button type="button" data-viz-prev>Prev</button>
              <button type="button" data-viz-play>Play</button>
              <button type="button" data-viz-reset>Reset</button>
              <button type="button" data-viz-next>Next</button>
            </div>
          </div>
          <label class="viz-range-label viz-turn-control"><span>Turn</span><input type="range" min="0" value="0" step="1" data-viz-range></label>
        </div>
        <div class="viz-help-strip" data-viz-help></div>
        <div class="viz-canvas-wrap"><canvas id="tutor-stub-viz-canvas" data-viz-canvas></canvas></div>
        <div class="viz-readout" data-viz-readout aria-live="polite"></div>
      </div>
      ${renderAnimatedVizGuide()}
    </div>
  </div>
  <script type="application/json" id="tutor-stub-viz-data">${safeJsonForScript(JSON.stringify(payload))}</script>
  <script>
  (function () {
    var root = document.getElementById('tutor-stub-viz-player');
    var dataNode = document.getElementById('tutor-stub-viz-data');
    if (!root || !dataNode) return;
    var payload;
    try {
      payload = JSON.parse(dataNode.textContent || '{}');
    } catch (error) {
      return;
    }
    var rows = payload.rows || [];
    if (!rows.length) return;
    var canvas = root.querySelector('[data-viz-canvas]');
    var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return;
    var select = root.querySelector('[data-viz-run]');
    var range = root.querySelector('[data-viz-range]');
    var readout = root.querySelector('[data-viz-readout]');
    var helpStrip = root.querySelector('[data-viz-help]');
    var playButton = root.querySelector('[data-viz-play]');
    var resetButton = root.querySelector('[data-viz-reset]');
    var variableSelect = root.querySelector('[data-viz-variable]');
    var modeButtons = Array.prototype.slice.call(root.querySelectorAll('[data-viz-mode]'));
    var activeRow = rows[0];
    var activeIndex = 0;
    var mode = 'field';
    var compareVariableKey = 'coverage';
    var timer = null;
    var viewLabels = {
      state: 'State Snapshot',
      field: 'Interaction Field',
      trajectory: 'Derivative Trace',
      dynamics: 'System Model',
      registers: 'Register Lens',
      compare: 'Policy Compare'
    };
    var palette = {
      learnerMastery: '#0A0A0A',
      learnerRisk: '#E63946',
      tutorAlignment: '#0057B8',
      jointMomentum: '#D98E04',
      field: '#009B72',
      dag: '#0057B8',
      risk: '#E63946'
    };
    var policyOrder = ['bland', 'random', 'state', 'field', 'trajectory', 'dynamic', 'dynamical_system', 'empirical_dynamical_system', 'continuous_dynamical_system', 'continuous_empirical_dynamical_system', 'negative'];
    var policyPalette = {
      bland: '#0A0A0A',
      random: '#737373',
      state: '#0057B8',
      field: '#009B72',
      trajectory: '#6B4EFF',
      dynamic: '#D72670',
      dynamical_system: '#D98E04',
      empirical_dynamical_system: '#F2B705',
      continuous_dynamical_system: '#8A5A00',
      continuous_empirical_dynamical_system: '#B88700',
      negative: '#E63946'
    };
    var compareVariables = [
      {
        key: 'coverage',
        label: 'Evidence Coverage',
        group: 'Learner-DAG',
        value: function (frame) { return (frame.field && frame.field.coverage) ?? (frame.state && frame.state.dag && frame.state.dag.bestPathCoverage); },
        display: function (value) { return pct(value); }
      },
      {
        key: 'learnerMastery',
        label: 'Learner Mastery',
        group: 'Field',
        value: function (frame) { return frame.field && frame.field.learnerMastery; },
        display: format
      },
      {
        key: 'learnerRisk',
        label: 'Learner Risk',
        group: 'Field',
        lowerBetter: true,
        value: function (frame) { return frame.field && frame.field.learnerRisk; },
        display: format
      },
      {
        key: 'tutorAlignment',
        label: 'Tutor Alignment',
        group: 'Field',
        value: function (frame) { return frame.field && frame.field.tutorAlignment; },
        display: format
      },
      {
        key: 'jointMomentum',
        label: 'Joint Momentum',
        group: 'Field',
        value: function (frame) { return frame.field && frame.field.jointMomentum; },
        display: format
      },
      {
        key: 'conceptual',
        label: 'Conceptual Engagement',
        group: 'Classifier',
        value: function (frame) { return frame.state && frame.state.classifier && frame.state.classifier.scores && frame.state.classifier.scores.conceptual; },
        display: format
      },
      {
        key: 'epistemicReadiness',
        label: 'Epistemic Readiness',
        group: 'Classifier',
        value: function (frame) { return frame.state && frame.state.classifier && frame.state.classifier.scores && frame.state.classifier.scores.epistemicReadiness; },
        display: format
      },
      {
        key: 'missingPremises',
        label: 'Missing Premises',
        group: 'Learner-DAG',
        lowerBetter: true,
        value: function (frame) {
          var count = frame.state && frame.state.dag ? Number(frame.state.dag.missingPremiseCount) : NaN;
          return Number.isFinite(count) ? Math.max(0, Math.min(1, count / 8)) : null;
        },
        display: function (value) {
          var number = Number(value);
          return Number.isFinite(number) ? Math.round(number * 8) + ' missing' : 'n/a';
        }
      }
    ];
    var registerOrder = ['plain', 'precise', 'brisk', 'warm', 'witnessing', 'charismatic', 'ironic', 'sarcastic', 'face_threat'];
    var registerMeta = {
      plain: { label: 'Plain', group: 'clarify', color: '#0A0A0A', note: 'plain-language re-entry' },
      precise: { label: 'Precise', group: 'warrant', color: '#0057B8', note: 'distinction or proof step' },
      brisk: { label: 'Brisk', group: 'pace', color: '#D98E04', note: 'faster stepwise movement' },
      warm: { label: 'Warm', group: 'repair', color: '#E63946', note: 'readiness and affect repair' },
      witnessing: { label: 'Witnessing', group: 'recognition', color: '#009B72', note: 'acknowledge learner position' },
      charismatic: { label: 'Charismatic', group: 'disrupt', color: '#6B4EFF', note: 'interrupt stuck low agency' },
      ironic: { label: 'Ironic', group: 'negative/probe', color: '#737373', note: 'mismatch cue' },
      sarcastic: { label: 'Sarcastic', group: 'negative/probe', color: '#000000', note: 'hostile challenge probe' },
      face_threat: { label: 'Face threat', group: 'negative/probe', color: '#D72670', note: 'status-pressure probe' }
    };

    function finite(value, fallback) {
      var number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    function clamp01(value) {
      return Math.max(0, Math.min(1, finite(value, 0)));
    }

    function format(value) {
      var number = Number(value);
      return Number.isFinite(number) ? number.toFixed(3) : 'n/a';
    }

    function pct(value) {
      var number = Number(value);
      return Number.isFinite(number) ? Math.round(number * 100) + '%' : 'n/a';
    }

    function metaForRegister(register) {
      var key = String(register || 'none');
      return registerMeta[key] || {
        label: key.replace(/_/g, ' ').replace(/\\b\\w/g, function (match) { return match.toUpperCase(); }),
        group: 'other',
        color: '#0A0A0A',
        note: 'unclassified register'
      };
    }

    function registerLabel(register) {
      var meta = metaForRegister(register);
      return meta.label + (register && meta.label.toLowerCase().replace(/ /g, '_') !== register ? ' (' + register + ')' : '');
    }

    function viewLabel(key) {
      return viewLabels[key] || key || 'View';
    }

    function escapeReadoutHtml(value) {
      return String(value || '').replace(/[&<>"]/g, function (char) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;'
        }[char];
      });
    }

    function proofStatus(value) {
      return value === 'grounded_asserted_secret' ? 'closed' : value || 'open';
    }

    function eventChips(events) {
      var list = (events || []).slice(0, 6);
      if (!list.length) return '<span class="event-chip event-none">none</span>';
      return list.map(function (event) {
        return '<span class="event-chip">' + escapeReadoutHtml(proofStatus(event)) + '</span>';
      }).join('');
    }

    function truncateText(value, maxWidth) {
      var raw = String(value || '');
      if (ctx.measureText(raw).width <= maxWidth) return raw;
      var suffix = '...';
      var textValue = raw;
      while (textValue.length > 1 && ctx.measureText(textValue + suffix).width > maxWidth) {
        textValue = textValue.slice(0, -1);
      }
      return textValue + suffix;
    }

    function currentFrames() {
      return (activeRow.viz && activeRow.viz.frames) || [];
    }

    function compareFrameCount() {
      return rows.reduce(function (max, row) {
        return Math.max(max, ((row.viz && row.viz.frames) || []).length);
      }, 0);
    }

    function activeFrameCount() {
      return mode === 'compare' ? compareFrameCount() : currentFrames().length;
    }

    function currentFrame() {
      var frames = currentFrames();
      return frames[Math.max(0, Math.min(activeIndex, frames.length - 1))] || null;
    }

    function compareVariable() {
      return compareVariables.find(function (variable) { return variable.key === compareVariableKey; }) || compareVariables[0];
    }

    function policyRank(policy) {
      var index = policyOrder.indexOf(String(policy || ''));
      return index === -1 ? policyOrder.length : index;
    }

    function policyColor(policy, index) {
      var key = String(policy || '');
      var fallback = ['#0A0A0A', '#0057B8', '#009B72', '#E63946', '#6B4EFF', '#D98E04', '#D72670', '#737373'];
      return policyPalette[key] || fallback[index % fallback.length];
    }

    function policyGroups() {
      var groups = {};
      rows.forEach(function (row) {
        var key = row.policy || 'unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
      });
      return Object.keys(groups)
        .sort(function (left, right) {
          return policyRank(left) - policyRank(right) || left.localeCompare(right);
        })
        .map(function (policy, index) {
          return {
            policy: policy,
            rows: groups[policy],
            color: policyColor(policy, index),
          };
        });
    }

    function frameForRow(row, index) {
      var frames = (row.viz && row.viz.frames) || [];
      return frames[index] || null;
    }

    function meanFinite(values) {
      var finiteValues = values.map(Number).filter(Number.isFinite);
      if (!finiteValues.length) return null;
      return finiteValues.reduce(function (sum, value) { return sum + value; }, 0) / finiteValues.length;
    }

    function valueForPolicyAt(group, index, variable) {
      return meanFinite(
        group.rows.map(function (row) {
          var frame = frameForRow(row, index);
          return frame ? variable.value(frame) : null;
        }),
      );
    }

    function resizeCanvas() {
      var rect = canvas.getBoundingClientRect();
      var ratio = window.devicePixelRatio || 1;
      var width = Math.max(320, Math.floor(rect.width));
      var height = Math.max(320, Math.floor(rect.height));
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    }

    function clear(width, height) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(230,57,70,0.08)';
      ctx.fillRect(0, 0, width, 10);
      ctx.fillStyle = 'rgba(10,10,10,0.06)';
      for (var gx = 0; gx < width; gx += 56) ctx.fillRect(gx, 0, 1, height);
      for (var gy = 0; gy < height; gy += 56) ctx.fillRect(0, gy, width, 1);
    }

    function text(value, x, y, options) {
      var opts = options || {};
      ctx.fillStyle = opts.color || '#0A0A0A';
      ctx.font = (opts.weight ? opts.weight + ' ' : '') + (opts.size || 12) + 'px "Source Serif 4", Georgia, serif';
      ctx.textAlign = opts.align || 'left';
      ctx.textBaseline = opts.baseline || 'alphabetic';
      ctx.fillText(String(value), x, y);
    }

    function rectBar(label, value, x, y, width, color) {
      var bounded = clamp01(value);
      ctx.fillStyle = '#F4F4F5';
      ctx.fillRect(x, y, width, 12);
      ctx.fillStyle = color || '#0A0A0A';
      ctx.fillRect(x, y, width * bounded, 12);
      text(label, x, y - 4, { color: '#0A0A0A', size: 11, weight: '700' });
      text(format(value), x + width + 8, y + 10, { color: '#525252', size: 11 });
    }

    function labeledBar(label, value, x, y, width, color, valueLabel) {
      var bounded = clamp01(value);
      ctx.fillStyle = '#F4F4F5';
      ctx.fillRect(x, y, width, 14);
      ctx.fillStyle = color || '#0A0A0A';
      ctx.fillRect(x, y, width * bounded, 14);
      text(truncateText(label, width - 46), x, y - 5, { color: '#0A0A0A', size: 11, weight: '700' });
      text(valueLabel || pct(value), x + width + 8, y + 11, { color: '#525252', size: 11 });
    }

    function drawPlotLegend(series, x, y, maxWidth) {
      text('key', x, y, { color: '#0A0A0A', size: 11, weight: '700' });
      var cursorX = x + 34;
      var cursorY = y;
      series.forEach(function (item) {
        var labelWidth = ctx.measureText(item.label).width + 34;
        if (cursorX + labelWidth > x + maxWidth && cursorX > x + 34) {
          cursorX = x + 34;
          cursorY += 19;
        }
        ctx.fillStyle = item.color;
        ctx.fillRect(cursorX, cursorY - 10, 12, 12);
        ctx.strokeStyle = '#0A0A0A';
        ctx.lineWidth = 1;
        ctx.strokeRect(cursorX, cursorY - 10, 12, 12);
        text(item.label, cursorX + 17, cursorY, { color: '#0A0A0A', size: 11, weight: '700' });
        cursorX += labelWidth;
      });
    }

    function drawTurnAxis(frames, x, y, width, height) {
      var count = Math.max(1, frames.length - 1);
      var baseline = y + height;
      var tickEvery = Math.max(1, Math.ceil(frames.length / 6));
      ctx.strokeStyle = '#0A0A0A';
      ctx.lineWidth = 1;
      for (var index = 0; index < frames.length; index += 1) {
        var tx = x + (index / count) * width;
        ctx.beginPath();
        ctx.moveTo(tx, baseline);
        ctx.lineTo(tx, baseline + 7);
        ctx.stroke();
        if (frames.length <= 8 || index === 0 || index === frames.length - 1 || index % tickEvery === 0) {
          text(String(frames[index].turn || index + 1), tx, baseline + 21, {
            color: '#525252',
            size: 10,
            align: 'center'
          });
        }
      }
      text('turns', x + width / 2, baseline + 41, { color: '#0A0A0A', size: 11, weight: '700', align: 'center' });
    }

    function drawPlot(series, options) {
      var opts = options || {};
      var frames = opts.frames || currentFrames();
      var x = opts.x || 44;
      var y = opts.y || 58;
      var width = opts.width || 640;
      var height = opts.height || 240;
      var count = Math.max(1, frames.length - 1);
      ctx.strokeStyle = '#E4E4E7';
      ctx.lineWidth = 1;
      for (var grid = 0; grid <= 4; grid += 1) {
        var gy = y + height - (grid / 4) * height;
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.lineTo(x + width, gy);
        ctx.stroke();
        text((grid / 4).toFixed(2), x - 8, gy + 4, { color: '#525252', size: 10, align: 'right' });
      }
      text('score (0-1)', x, y - 11, { color: '#525252', size: 10, weight: '700' });
      drawPlotLegend(series, opts.legendX || x + 138, opts.legendY || y - 33, opts.legendWidth || width - 138);
      ctx.strokeStyle = 'rgba(10,10,10,0.08)';
      ctx.lineWidth = 1;
      for (var turnGrid = 0; turnGrid < frames.length; turnGrid += 1) {
        var tx = x + (turnGrid / count) * width;
        ctx.beginPath();
        ctx.moveTo(tx, y);
        ctx.lineTo(tx, y + height);
        ctx.stroke();
      }
      ctx.strokeStyle = '#0A0A0A';
      ctx.strokeRect(x, y, width, height);
      series.forEach(function (item, seriesIndex) {
        var points = [];
        var started = false;
        ctx.beginPath();
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.lineWidth || 3.5;
        ctx.setLineDash(item.dash || []);
        for (var index = 0; index <= activeIndex && index < frames.length; index += 1) {
          var rawValue = item.value(frames[index], index);
          var numericValue = Number(rawValue);
          if (!Number.isFinite(numericValue)) continue;
          var value = clamp01(numericValue);
          var px = x + (index / count) * width;
          var py = y + height - value * height;
          points.push({ x: px, y: py, active: index === activeIndex });
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          }
          else ctx.lineTo(px, py);
        }
        if (started) ctx.stroke();
        ctx.setLineDash([]);
        points.forEach(function (point) {
          ctx.beginPath();
          ctx.fillStyle = point.active ? item.color : '#FFFFFF';
          ctx.strokeStyle = item.color;
          ctx.lineWidth = point.active ? 3 : 2;
          ctx.arc(point.x, point.y, point.active ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      });
      drawTurnAxis(frames, x, y, width, height);
      var cursorX = x + (Math.max(0, Math.min(activeIndex, count)) / count) * width;
      ctx.strokeStyle = '#E63946';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cursorX, y);
      ctx.lineTo(cursorX, y + height);
      ctx.stroke();
    }

    function drawState(frame, width, height) {
      text('State Snapshot', 28, 34, { size: 18, weight: '700' });
      var scores = (frame.state.classifier && frame.state.classifier.scores) || {};
      rectBar('conceptual', scores.conceptual, 38, 82, width * 0.36, '#0057B8');
      rectBar('readiness', scores.epistemicReadiness, 38, 126, width * 0.36, '#009B72');
      rectBar('surface', scores.learnerSurface, 38, 170, width * 0.36, '#D98E04');
      rectBar('coverage', frame.state.dag.bestPathCoverage, 38, 214, width * 0.36, '#E63946');
      var rightX = width * 0.52;
      text('DAG', rightX, 82, { size: 13, weight: '700' });
      text('proof status: ' + proofStatus(frame.state.dag.bottleneck), rightX, 112, { color: '#0A0A0A' });
      text('grounded: ' + frame.state.dag.groundedCount + '   missing: ' + frame.state.dag.missingPremiseCount, rightX, 140, { color: '#0A0A0A' });
      text('unsupported: ' + frame.state.dag.unsupportedAssertionCount, rightX, 168, { color: '#0A0A0A' });
      text('request: ' + ((frame.state.classifier && frame.state.classifier.requestType) || 'unknown'), rightX, 214, { color: '#0A0A0A' });
      text('move: ' + ((frame.state.classifier && frame.state.classifier.discourseMove) || 'unknown'), rightX, 242, { color: '#0A0A0A' });
    }

    function drawField(frame, width, height) {
      text('Interaction Field', 28, 34, { size: 18, weight: '700' });
      drawPlot([
        { label: 'mastery', color: palette.learnerMastery, lineWidth: 4, value: function (row) { return row.field.learnerMastery; } },
        { label: 'risk', color: palette.learnerRisk, dash: [9, 5], lineWidth: 4, value: function (row) { return row.field.learnerRisk; } },
        { label: 'alignment', color: palette.tutorAlignment, dash: [2, 5], value: function (row) { return row.field.tutorAlignment; } },
        { label: 'momentum', color: palette.jointMomentum, dash: [12, 4, 2, 4], value: function (row) { return row.field.jointMomentum; } }
      ], { x: 54, y: 88, width: width - 108, height: height - 178, legendX: 210, legendY: 52, legendWidth: width - 250 });
    }

    function drawTrajectory(frame, width, height) {
      text('Derivative Trace', 28, 34, { size: 18, weight: '700' });
      drawPlot([
        { label: 'field', color: palette.field, lineWidth: 4, value: function (row) { return row.trajectory.field.current; } },
        { label: 'dag', color: palette.dag, dash: [2, 5], value: function (row) { return row.trajectory.dag.current; } },
        { label: 'risk', color: palette.risk, dash: [9, 5], lineWidth: 4, value: function (row) { return row.trajectory.risk.current; } }
      ], { x: 54, y: 88, width: width * 0.58, height: height - 178, legendX: 230, legendY: 52, legendWidth: width * 0.5 });
      var x = width * 0.7;
      var y = 82;
      text('velocity / slope / acceleration', x, y - 24, { color: '#0A0A0A', size: 12, weight: '700' });
      ['field', 'dag', 'risk'].forEach(function (key, index) {
        var metric = frame.trajectory[key] || {};
        var yy = y + index * 76;
        text(key, x, yy, { color: palette[key], size: 13, weight: '700' });
        text('v ' + format(metric.velocity), x, yy + 24, { color: '#0A0A0A' });
        text('s ' + format(metric.slope), x + 86, yy + 24, { color: '#0A0A0A' });
        text('a ' + format(metric.acceleration), x + 172, yy + 24, { color: '#0A0A0A' });
      });
    }

    function drawPolicyCompare(width, height) {
      var variable = compareVariable();
      var groups = policyGroups();
      var maxFrames = Math.max(1, compareFrameCount());
      var frames = Array.from({ length: maxFrames }, function (_, index) {
        return { turn: index + 1 };
      });
      text('Policy Compare', 28, 34, { size: 18, weight: '700' });
      text(variable.label + ' · ' + variable.group + (variable.lowerBetter ? ' · lower is better' : ''), 28, 58, {
        color: '#525252',
        size: 12,
        weight: '700'
      });
      drawPlot(
        groups.map(function (group) {
          return {
            label: group.policy + (group.rows.length > 1 ? ' (' + group.rows.length + ')' : ''),
            color: group.color,
            lineWidth: group.policy === activeRow.policy ? 4.5 : 3,
            dash: group.policy === 'random' ? [2, 5] : group.policy === 'negative' ? [9, 5] : [],
            value: function (_point, index) {
              return valueForPolicyAt(group, index, variable);
            },
          };
        }),
        {
          frames: frames,
          x: 54,
          y: 104,
          width: width - 108,
          height: height - 202,
          legendX: 210,
          legendY: 72,
          legendWidth: width - 250,
        },
      );
    }

    function drawHeatmap(object, x, y, width, cellHeight) {
      var entries = Object.entries(object || {});
      if (!entries.length) {
        text('no vector data', x, y + 18, { color: '#525252' });
        return;
      }
      entries.forEach(function (entry, index) {
        var key = entry[0];
        var value = clamp01(entry[1]);
        var yy = y + index * cellHeight;
        var heatColors = ['#F4F4F5', '#DDEBFF', '#DDF7EE', '#FFF1B8', '#FFE0EE', '#FBE3E5'];
        ctx.fillStyle = heatColors[Math.min(heatColors.length - 1, Math.floor(value * heatColors.length))];
        ctx.fillRect(x, yy, width, cellHeight - 3);
        text(key, x + 8, yy + cellHeight - 10, { color: '#0A0A0A', size: 11 });
        text(format(value), x + width - 8, yy + cellHeight - 10, { color: '#0A0A0A', size: 11, align: 'right' });
      });
    }

    function drawDynamics(frame, width, height) {
      text('System Model', 28, 34, { size: 18, weight: '700' });
      text('source: ' + (frame.dynamics.source || 'unknown'), 28, 56, { color: '#525252', size: 12 });
      drawHeatmap(frame.dynamics.stateVector || {}, 34, 82, width * 0.46, 22);
      var rightX = width * 0.56;
      text('attractors / derivatives', rightX, 82, { size: 13, weight: '700' });
      var bars = Object.keys(frame.dynamics.attractors || {}).length ? frame.dynamics.attractors : frame.dynamics.derivativeVector;
      Object.entries(bars || {}).slice(0, 12).forEach(function (entry, index) {
        rectBar(entry[0], Math.abs(finite(entry[1], 0)), rightX, 116 + index * 24, width * 0.28, index % 2 ? '#0057B8' : '#E63946');
      });
    }

    function registerKeysForRun() {
      var seen = {};
      currentFrames().forEach(function (frame) {
        if (frame.selectedRegister) seen[frame.selectedRegister] = true;
        (frame.register.distribution || []).forEach(function (entry) {
          if (entry.register) seen[entry.register] = true;
        });
        Object.keys(frame.register.scores || {}).forEach(function (key) {
          seen[key] = true;
        });
      });
      return Object.keys(seen).sort(function (left, right) {
        var leftIndex = registerOrder.indexOf(left);
        var rightIndex = registerOrder.indexOf(right);
        leftIndex = leftIndex === -1 ? 999 : leftIndex;
        rightIndex = rightIndex === -1 ? 999 : rightIndex;
        return leftIndex - rightIndex || left.localeCompare(right);
      });
    }

    function registerCountsThrough(index) {
      var counts = {};
      currentFrames().slice(0, index + 1).forEach(function (frame) {
        var key = frame.selectedRegister || 'none';
        counts[key] = (counts[key] || 0) + 1;
      });
      return counts;
    }

    function drawRegisterTimeline(frames, x, y, width, height) {
      text('selection timeline', x, y - 12, { color: '#0A0A0A', size: 12, weight: '700' });
      ctx.fillStyle = '#F4F4F5';
      ctx.fillRect(x, y, width, height);
      var count = Math.max(1, frames.length);
      frames.forEach(function (row, index) {
        var meta = metaForRegister(row.selectedRegister);
        var start = x + (index / count) * width;
        var end = x + ((index + 1) / count) * width;
        ctx.fillStyle = meta.color;
        ctx.fillRect(start, y, Math.max(1, end - start + 0.5), height);
      });
      var cursorX = x + ((activeIndex + 0.5) / count) * width;
      ctx.strokeStyle = '#E63946';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cursorX, y - 5);
      ctx.lineTo(cursorX, y + height + 5);
      ctx.stroke();
      ctx.strokeStyle = '#0A0A0A';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);
      text('1', x, y + height + 18, { color: '#525252', size: 10 });
      text(String(frames.length), x + width, y + height + 18, { color: '#525252', size: 10, align: 'right' });
    }

    function drawRegisterLegend(keys, x, y, width, height) {
      text('key', x, y, { size: 13, weight: '700' });
      var rowHeight = 34;
      keys.slice(0, Math.floor((height - 30) / rowHeight)).forEach(function (key, index) {
        var meta = metaForRegister(key);
        var yy = y + 26 + index * rowHeight;
        ctx.fillStyle = meta.color;
        ctx.fillRect(x, yy - 10, 12, 12);
        text(meta.label, x + 18, yy, { color: '#0A0A0A', size: 12, weight: '700' });
        text(truncateText(meta.group + ' | ' + meta.note, width - 18), x + 18, yy + 16, { color: '#525252', size: 10 });
      });
    }

    function drawCurrentRegisterCard(frame, x, y, width) {
      var meta = metaForRegister(frame.selectedRegister);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, y, width, 108);
      ctx.strokeStyle = '#0A0A0A';
      ctx.strokeRect(x, y, width, 108);
      ctx.fillStyle = meta.color;
      ctx.fillRect(x + 12, y + 18, 18, 18);
      text('current register', x + 12, y + 14, { color: '#525252', size: 11 });
      text(meta.label, x + 40, y + 32, { color: '#0A0A0A', size: 16, weight: '700' });
      text(String(frame.selectedRegister || 'none'), x + 40, y + 52, { color: '#525252', size: 11 });
      text('register policy: ' + (frame.register.policy || activeRow.policy || 'unknown'), x + 12, y + 78, { color: '#0A0A0A', size: 11 });
      text('kind: ' + meta.group, x + 12, y + 96, { color: '#0A0A0A', size: 11 });
    }

    function drawRegisters(frame, width, height) {
      text('Register Lens', 28, 34, { size: 18, weight: '700' });
      var frames = currentFrames();
      var keys = registerKeysForRun();
      var leftX = 34;
      var rightWidth = Math.min(300, Math.max(230, width * 0.28));
      var rightX = width - rightWidth - 28;
      var leftWidth = Math.max(320, rightX - leftX - 28);
      drawCurrentRegisterCard(frame, rightX, 62, rightWidth);
      drawRegisterLegend(keys, rightX, 196, rightWidth, height - 210);
      drawRegisterTimeline(frames, leftX, 78, leftWidth, 54);

      var rows = frame.register.distribution || [];
      var hasPolicyDistribution = frame.register.distributionSource === 'policy_distribution' && rows.length > 1;
      var y = 182;
      var barWidth = leftWidth - 76;
      if (hasPolicyDistribution) {
        text('current probability distribution', leftX, y - 24, { color: '#0A0A0A', size: 12, weight: '700' });
        rows.slice(0, 9).forEach(function (entry, index) {
          var meta = metaForRegister(entry.register);
          var selected = entry.register === frame.selectedRegister;
          labeledBar(
            meta.label + (selected ? '  selected' : ''),
            entry.probability,
            leftX,
            y + index * 30,
            barWidth,
            selected ? '#0A0A0A' : meta.color,
            pct(entry.probability),
          );
        });
      } else {
        var counts = registerCountsThrough(activeIndex);
        var total = Math.max(1, activeIndex + 1);
        text('selection frequency through this turn', leftX, y - 24, { color: '#0A0A0A', size: 12, weight: '700' });
        keys
          .map(function (key) {
            return { register: key, count: counts[key] || 0 };
          })
          .filter(function (entry) {
            return entry.count > 0;
          })
          .sort(function (left, right) {
            return right.count - left.count || registerOrder.indexOf(left.register) - registerOrder.indexOf(right.register);
          })
          .slice(0, 9)
          .forEach(function (entry, index) {
            var meta = metaForRegister(entry.register);
            labeledBar(
              meta.label,
              entry.count / total,
              leftX,
              y + index * 30,
              barWidth,
              meta.color,
              entry.count + '/' + total,
            );
          });
      }
      text('source: ' + frame.register.distributionSource, leftX, height - 26, { color: '#525252', size: 11 });
    }

    function updateReadout(frame) {
      if (!readout || !frame) return;
      var meta = metaForRegister(frame.selectedRegister || 'none');
      var registerKey = frame.selectedRegister || 'none';
      var bottleneck = proofStatus(frame.field && frame.field.bottleneck);
      var learner = (frame.snippets && frame.snippets.learner) || '';
      var tutor = (frame.snippets && frame.snippets.tutor) || '';
      readout.innerHTML = [
        '<div class="viz-readout-head">',
          '<strong>' + escapeReadoutHtml(activeRow.title) + '</strong>',
          '<span>turn ' + escapeReadoutHtml(frame.turn) + '/' + escapeReadoutHtml(activeRow.viz.turnCount) + '</span>',
          '<span>view ' + escapeReadoutHtml(viewLabel(mode)) + '</span>',
        '</div>',
        '<div class="viz-readout-grid">',
          '<section class="readout-card readout-style" style="--style-color:' + escapeReadoutHtml(meta.color) + '">',
            '<span class="readout-label">style / register</span>',
            '<strong><span class="style-swatch"></span>' + escapeReadoutHtml(meta.label) + '</strong>',
            '<em>' + escapeReadoutHtml(registerKey) + ' · ' + escapeReadoutHtml(meta.group) + ' · ' + escapeReadoutHtml(meta.note) + '</em>',
          '</section>',
          '<section class="readout-card readout-bottleneck">',
            '<span class="readout-label">proof status</span>',
            '<strong>' + escapeReadoutHtml(bottleneck) + '</strong>',
          '</section>',
          '<section class="readout-card readout-events">',
            '<span class="readout-label">events</span>',
            '<div class="event-list">' + eventChips(frame.events) + '</div>',
          '</section>',
        '</div>',
        '<div class="viz-readout-lines">',
          '<p><span class="snippet-label learner">learner</span><span>' + escapeReadoutHtml(learner) + '</span></p>',
          '<p><span class="snippet-label tutor">tutor</span><span>' + escapeReadoutHtml(tutor) + '</span></p>',
        '</div>'
      ].join('');
    }

    function updateCompareReadout() {
      if (!readout) return;
      var variable = compareVariable();
      var groups = policyGroups();
      var values = groups
        .map(function (group) {
          var value = valueForPolicyAt(group, activeIndex, variable);
          return {
            policy: group.policy,
            color: group.color,
            runs: group.rows.length,
            value: value,
          };
        })
        .filter(function (entry) {
          return Number.isFinite(Number(entry.value));
        });
      var sorted = values.slice().sort(function (left, right) {
        return variable.lowerBetter ? left.value - right.value : right.value - left.value;
      });
      var leader = sorted[0] || null;
      var low = values.length ? Math.min.apply(null, values.map(function (entry) { return entry.value; })) : null;
      var high = values.length ? Math.max.apply(null, values.map(function (entry) { return entry.value; })) : null;
      var spread = Number.isFinite(high) && Number.isFinite(low) ? high - low : null;
      readout.innerHTML = [
        '<div class="viz-readout-head">',
          '<strong>Policy comparison</strong>',
          '<span>turn ' + escapeReadoutHtml(activeIndex + 1) + '/' + escapeReadoutHtml(compareFrameCount()) + '</span>',
          '<span>variable ' + escapeReadoutHtml(variable.label) + '</span>',
        '</div>',
        '<div class="viz-readout-grid">',
          '<section class="readout-card readout-style" style="--style-color:' + escapeReadoutHtml(leader ? leader.color : '#0A0A0A') + '">',
            '<span class="readout-label">leading policy</span>',
            '<strong><span class="style-swatch"></span>' + escapeReadoutHtml(leader ? leader.policy : 'n/a') + '</strong>',
            '<em>' + escapeReadoutHtml(leader ? variable.display(leader.value) : 'no policy has a value at this turn') + '</em>',
          '</section>',
          '<section class="readout-card">',
            '<span class="readout-label">comparison rule</span>',
            '<strong>' + escapeReadoutHtml(variable.lowerBetter ? 'lower is better' : 'higher is better') + '</strong>',
            '<em>policy mean when multiple runs exist</em>',
          '</section>',
          '<section class="readout-card">',
            '<span class="readout-label">spread</span>',
            '<strong>' + escapeReadoutHtml(format(spread)) + '</strong>',
            '<em>high minus low at this turn</em>',
          '</section>',
        '</div>',
        '<div class="viz-readout-lines">',
          sorted.slice(0, 9).map(function (entry) {
            return '<p><span class="snippet-label tutor" style="background:' + escapeReadoutHtml(entry.color) + '">' +
              escapeReadoutHtml(entry.policy) +
              '</span><span>' + escapeReadoutHtml(variable.display(entry.value)) +
              (entry.runs > 1 ? ' · mean of ' + escapeReadoutHtml(entry.runs) + ' runs' : '') +
              '</span></p>';
          }).join('') || '<p><span class="snippet-label tutor">none</span><span>No policy has this variable at the current turn.</span></p>',
        '</div>'
      ].join('');
    }

    function helpTextForMode() {
      if (mode === 'state') {
        return 'View: State Snapshot. Shows the current classifier and learner-DAG snapshot, including request type, proof coverage, missing premises, and proof status.';
      }
      if (mode === 'trajectory') {
        return 'View: Derivative Trace. Shows field, DAG, and risk movement over recent turns. v/s/a are velocity, slope, and acceleration.';
      }
      if (mode === 'dynamics') {
        return 'View: System Model. Shows state-vector axes and derivative/attractor signals when the selected register policy emits them.';
      }
      if (mode === 'registers') {
        return 'View: Register Lens. Shows selected tutor register/style over time; bars show either policy probabilities or observed frequency for selected-only policies.';
      }
      if (mode === 'compare') {
        return 'View: Policy Compare. Select one variable and animate policy means against each other turn by turn. If a policy has several runs, its line is the per-turn mean.';
      }
      return 'View: Interaction Field. Shows mastery, risk, tutor alignment, and joint momentum across turns.';
    }

    function draw() {
      var width = canvas.clientWidth || 960;
      var height = canvas.clientHeight || 420;
      clear(width, height);
      if (mode === 'compare') {
        drawPolicyCompare(width, height);
        text('turn ' + (activeIndex + 1), width - 28, 34, { align: 'right', color: '#525252', size: 12, weight: '700' });
        updateCompareReadout();
        return;
      }
      var frame = currentFrame();
      if (!frame) return;
      if (mode === 'state') drawState(frame, width, height);
      else if (mode === 'trajectory') drawTrajectory(frame, width, height);
      else if (mode === 'dynamics') drawDynamics(frame, width, height);
      else if (mode === 'registers') drawRegisters(frame, width, height);
      else drawField(frame, width, height);
      text('turn ' + frame.turn, width - 28, 34, { align: 'right', color: '#525252', size: 12, weight: '700' });
      updateReadout(frame);
    }

    function syncControls() {
      var count = activeFrameCount();
      range.max = String(Math.max(0, count - 1));
      range.value = String(activeIndex);
      modeButtons.forEach(function (button) {
        var selected = button.getAttribute('data-viz-mode') === mode;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
        button.setAttribute('tabindex', selected ? '0' : '-1');
      });
      if (select) {
        select.disabled = mode === 'compare';
        var selectBox = select.closest ? select.closest('label') : null;
        if (selectBox) selectBox.classList.toggle('viz-control-disabled', mode === 'compare');
      }
      if (variableSelect) {
        variableSelect.disabled = mode !== 'compare';
        var variableBox = variableSelect.closest ? variableSelect.closest('label') : null;
        if (variableBox) variableBox.classList.toggle('viz-control-disabled', mode !== 'compare');
      }
      if (helpStrip) helpStrip.textContent = helpTextForMode();
      if (playButton) playButton.textContent = timer ? 'Pause' : 'Play';
    }

    function setIndex(value) {
      var count = activeFrameCount();
      activeIndex = Math.max(0, Math.min(Number(value) || 0, Math.max(0, count - 1)));
      syncControls();
      draw();
    }

    function stop() {
      if (timer) window.clearInterval(timer);
      timer = null;
      syncControls();
    }

    rows.forEach(function (row, index) {
      var option = document.createElement('option');
      option.value = String(index);
      option.textContent = 'policy ' + row.policy + ' · run ' + row.runIndex + ' · ' + row.turnCount + 't · ' + row.status;
      select.appendChild(option);
    });
    compareVariables.forEach(function (variable) {
      var option = document.createElement('option');
      option.value = variable.key;
      option.textContent = variable.label + ' · ' + variable.group + (variable.lowerBetter ? ' · lower better' : '');
      variableSelect.appendChild(option);
    });
    variableSelect.value = compareVariableKey;
    select.addEventListener('change', function () {
      stop();
      activeRow = rows[Number(select.value) || 0] || rows[0];
      setIndex(0);
    });
    variableSelect.addEventListener('change', function () {
      compareVariableKey = variableSelect.value || 'coverage';
      draw();
    });
    range.addEventListener('input', function () {
      stop();
      setIndex(range.value);
    });
    root.querySelector('[data-viz-prev]').addEventListener('click', function () {
      stop();
      setIndex(activeIndex - 1);
    });
    root.querySelector('[data-viz-next]').addEventListener('click', function () {
      stop();
      setIndex(activeIndex + 1);
    });
    playButton.addEventListener('click', function () {
      if (timer) {
        stop();
        return;
      }
      timer = window.setInterval(function () {
        var count = activeFrameCount();
        if (activeIndex >= count - 1) {
          stop();
          return;
        }
        setIndex(activeIndex + 1);
      }, 850);
      syncControls();
    });
    resetButton.addEventListener('click', function () {
      stop();
      setIndex(0);
    });
    modeButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        mode = button.getAttribute('data-viz-mode') || 'field';
        setIndex(activeIndex);
      });
    });
    window.tutorStubVizSelect = function (id, turn) {
      var index = rows.findIndex(function (row) { return row.id === id; });
      if (index < 0) return;
      stop();
      activeRow = rows[index];
      select.value = String(index);
      mode = 'field';
      setIndex(Math.max(0, Number(turn || 1) - 1));
      root.classList.add('viz-jump-active');
      window.setTimeout(function () { root.classList.remove('viz-jump-active'); }, 900);
    };
    if (window.ResizeObserver) {
      new ResizeObserver(resizeCanvas).observe(canvas);
    }
    window.addEventListener('resize', resizeCanvas);
    syncControls();
    resizeCanvas();
  })();
  </script>`;
}
