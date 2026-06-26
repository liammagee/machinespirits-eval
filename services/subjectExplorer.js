/**
 * Subject Explorer — a DECOUPLED surface that introduces, explains, and
 * executes the belief–desire DAG as a constructed synthetic subject
 * (MACHINE-SPIRIT.md §5). It reads ONLY the structural engine
 * (services/dramaticDerivation/) and the authored world specs — no eval DB, no
 * coupling to the factorial / poetics machinery. Mount it into any Express app
 * with mountSubjectExplorer(app), or serve it standalone via
 * scripts/serve-subject-explorer.js.
 *
 * v2: step the release schedule (watch the learner's beliefs accrue, the
 * tutor's desire-DAG light up as leaves are fulfilled, the secret ground) and
 * fire reverse(). The page is chrome + a re-renderable #stage fragment served
 * by /api/subject/:world/stage so there is ONE (server-side) render path.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadWorld } from './dramaticDerivation/world.js';
import { derivationDistance } from './dramaticDerivation/slope.js';
import { factKey } from './dramaticDerivation/chainer.js';
import { buildSubjectState, buildTutorDesireDag, reverse } from './dramaticDerivation/beliefDesire.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORLDS_DIR = path.join(__dirname, '..', 'config', 'drama-derivation');
const DEFAULT_WORLD = 'world-005-marrick';

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function listWorlds() {
  return fs
    .readdirSync(WORLDS_DIR)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => f.replace(/\.yaml$/, ''))
    .sort();
}

function resolveStem(stem) {
  const safe = path.basename(String(stem || DEFAULT_WORLD)).replace(/[^a-z0-9-]/gi, '');
  return fs.existsSync(path.join(WORLDS_DIR, `${safe}.yaml`)) ? safe : DEFAULT_WORLD;
}

function factText(fact) {
  if (!Array.isArray(fact)) return String(fact ?? '');
  const [p, ...a] = fact;
  return a.length ? `${p}(${a.join(', ')})` : String(p);
}

function labelFor(node) {
  const c = node?.statement?.content;
  if (!c) return node?.id || '?';
  if (c.rel === 'holds_L') return c.premise || factText(c.fact);
  if (c.rel === 'grounded_L') return factText(c.of);
  if (c.rel === 'grounded') return `δ: ${c.of?.who ? `truthBearer(${c.of.who})` : 'dependence'}`;
  if (c.kind === 'recognition') return `Rec_${c.recogniser}(${c.recognised})`;
  return node.label || c.rel || node.id;
}

function releasedByTurn(world, turn) {
  const soFar = [];
  const now = [];
  for (const r of world.releaseSchedule) {
    if (r.turn <= turn) soFar.push(r.premise);
    if (r.turn === turn) now.push(r.premise);
  }
  return { soFar, now };
}

/** The live {T, L, D} subject for a world at a given turn (+ optional reversal). */
export function subjectExplorerData(stem, { turn = 0, reversed = false } = {}) {
  const world = loadWorld(path.join(WORLDS_DIR, `${resolveStem(stem)}.yaml`));
  const cap = world.turnCap;
  const t = Math.max(0, Math.min(Number(turn) || 0, cap));
  const { soFar, now } = releasedByTurn(world, t);
  const heldFacts = soFar.map((id) => world.premiseById.get(id)?.fact).filter(Boolean);
  const subject = buildSubjectState(world, { learnerHeld: heldFacts, releasedPremiseIds: soFar });

  // fulfillment: which tutor-desire nodes the learner's current closure satisfies
  const heldKeys = new Set(subject.L.belief.nodes.map((n) => factKey(n.statement.content)));
  const tutorDag = buildTutorDesireDag(world);
  for (const n of tutorDag.nodes) {
    const c = n.statement.content;
    if (c.rel === 'holds_L') n.fulfilled = soFar.includes(c.premise);
    else if (c.rel === 'grounded_L') n.fulfilled = heldKeys.has(factKey(c.of));
    else n.fulfilled = false;
  }
  const dist = derivationDistance(world, heldFacts);

  const data = {
    world: {
      id: world.id,
      title: world.title,
      question: world.question,
      secret: factText(world.secret.fact),
      mirror: world.mirror ? factText(world.mirror.fact) : null,
      tMin: world.slope.t_min,
      turnCap: cap,
    },
    turn: t,
    releaseSchedule: world.releaseSchedule.map((r) => ({
      turn: r.turn,
      premise: r.premise,
      via: r.via,
      path: !String(r.premise).startsWith('m_'),
    })),
    releasedNow: now,
    releasedSoFar: soFar,
    derivationDistance: Number.isFinite(dist) ? dist : null,
    secretGrounded: subject.L.belief.secretGrounded,
    subject,
    tutorDag,
  };
  if (reversed) data.reversed = reverse(subject, { surpassed: 'T' });
  return data;
}

// --- a minimal layered SVG of a desire-DAG (depth columns; fulfilled = green) ---
function dagSvg(dag) {
  if (!dag?.nodes?.length) return '<p class="muted">(no desire-DAG)</p>';
  const depth = new Map();
  const setDepth = (id, d) => depth.set(id, Math.max(depth.get(id) ?? 0, d));
  setDepth(dag.root, 0);
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 50) {
    changed = false;
    for (const e of dag.edges) {
      const d = (depth.get(e.from) ?? 0) + 1;
      if (d > (depth.get(e.to) ?? 0)) {
        setDepth(e.to, d);
        changed = true;
      }
    }
  }
  const cols = new Map();
  for (const n of dag.nodes) {
    const d = depth.get(n.id) ?? 0;
    if (!cols.has(d)) cols.set(d, []);
    cols.get(d).push(n);
  }
  const colW = 168;
  const rowH = 44;
  const boxW = 142;
  const boxH = 30;
  const pos = new Map();
  const maxRows = Math.max(...[...cols.values()].map((c) => c.length));
  for (const [d, ns] of cols) {
    ns.forEach((n, i) => pos.set(n.id, { x: 16 + d * colW, y: 16 + i * rowH + ((maxRows - ns.length) * rowH) / 2 }));
  }
  const width = 32 + ([...cols.keys()].reduce((m, d) => Math.max(m, d), 0) + 1) * colW;
  const height = 32 + maxRows * rowH;
  const edgeSvg = dag.edges
    .map((e) => {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      if (!a || !b) return '';
      return `<line x1="${a.x + boxW}" y1="${a.y + boxH / 2}" x2="${b.x}" y2="${b.y + boxH / 2}" class="edge"/>`;
    })
    .join('');
  const nodeSvg = dag.nodes
    .map((n) => {
      const p = pos.get(n.id);
      if (!p) return '';
      const cls = (n.fulfilled ? 'done ' : '') + (n.leaf ? 'leaf' : 'inner');
      return `<g><rect x="${p.x}" y="${p.y}" width="${boxW}" height="${boxH}" rx="6" class="${cls}"/><text x="${p.x + boxW / 2}" y="${p.y + boxH / 2 + 4}" text-anchor="middle">${esc(labelFor(n))}</text></g>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${width} ${height}" class="dag" role="img"><title>tutor desire-DAG</title>${edgeSvg}${nodeSvg}</svg>`;
}

function list(items) {
  return items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '<p class="muted">—</p>';
}

/** The dynamic region: re-rendered each time the turn (or reversal) changes. */
export function renderStage(stem, opts = {}) {
  const d = subjectExplorerData(stem, opts);
  const { world, subject, tutorDag, reversed } = d;
  const leavesDone = tutorDag.nodes.filter((n) => n.leaf && n.fulfilled).length;
  const leavesTotal = tutorDag.leaves.length;
  const nowText = d.releasedNow.length
    ? d.releasedNow.map((p) => `<code>${esc(p)}</code>`).join(' ')
    : '<span class="muted">nothing</span>';

  const learnerBeliefs = subject.L.belief.nodes
    .map((n) => `${esc(factText(n.statement.content))} <span class="tag">${esc(n.status)}</span>`)
    .slice(0, 16);
  const learnerDesires = subject.L.desire.nodes.map(
    (n) => `${esc(labelFor(n))} <span class="tag">order ${n.statement.order}</span>`,
  );
  const mLT = subject.L.models.T;

  const reversePanel = reversed
    ? `<section class="card rev">
        <h3>Reversal fired</h3>
        <p>swap <code>${esc(JSON.stringify(reversed.swap))}</code> · seeded <code>${esc(labelFor(reversed.seeded))}</code> on the surpassed party (former T, now at L) · consummated: <b>${reversed.consummated}</b>.</p>
        <p class="tag">${d.secretGrounded ? 'Licensed: the learner has grounded the secret (anagnorisis) — the trigger that enables peripeteia (§12).' : '⚠ Premature: the learner has NOT yet grounded the secret, so the trigger (anagnorisis) is unmet — the swap is bare.'} Consummates only once δ (the dependence) is grounded; else the dialectic is stalled / inverted.</p>
       </section>`
    : '';

  return `
    <div class="state">
      <span><b>turn ${d.turn}</b> / ${world.turnCap}</span>
      <span>just released: ${nowText}</span>
      <span>derivation distance to S: <b>${d.derivationDistance === null ? '∞' : d.derivationDistance}</b></span>
      <span class="badge ${d.secretGrounded ? 'on' : ''}">secret grounded: ${d.secretGrounded}</span>
      <span class="tag">floor t_min = ${world.tMin}</span>
    </div>

    <section class="card t">
      <h3>T — tutor's desire-DAG (the proof, inverted) · <span class="tag">${leavesDone}/${leavesTotal} releases fulfilled</span></h3>
      ${dagSvg(tutorDag)}
      <p class="tag">green = fulfilled by the learner's current beliefs. As you step, the leaves (releases) light up and fulfillment propagates toward the secret.</p>
    </section>

    <div class="grid2">
      <section class="card">
        <h3>L — learner (belief · desire · model of the tutor)</h3>
        <p class="muted">grounded so far:</p>${list(learnerBeliefs)}
        <p class="muted" style="margin-top:8px;">desires:</p>${list(learnerDesires)}
        <p class="muted" style="margin-top:8px;">𝔐_L(T) — reads the tutor's want; cannot see S <span class="tag">secret hidden: ${!mLT.audit.secretIncluded}</span>:</p>${list(mLT.inferredDesires.map((x) => esc(labelFor(x))))}
      </section>
      <section class="card">
        <h3>D — director (the Big Other: aesthetic ends)</h3>
        ${list(subject.D.desire.nodes.map((n) => `<b>${esc(n.label)}</b> <span class="tag">${esc(JSON.stringify(n.statement.content))}</span>`))}
        <p class="tag" style="margin-top:8px;">plotLint is D’s satisfaction condition.</p>
      </section>
    </div>
    ${reversePanel}`;
}

/** The full page: static chrome + controls + an initial #stage + the stepper JS. */
export function renderSubjectExplorerHtml(stem, opts = {}) {
  const s = resolveStem(stem);
  const d = subjectExplorerData(s, opts);
  const { world } = d;
  const worlds = listWorlds();
  const startTurn = d.turn;

  const timeline = d.releaseSchedule
    .map((r) => `<span class="rel ${r.path ? 'path' : 'mirror'}">t${r.turn} <code>${esc(r.premise)}</code></span>`)
    .join(' ');

  const egoSuperego = `
    <table class="es">
      <tr><th>organ</th><th>reads / writes</th><th>is</th></tr>
      <tr><td><b>ego</b></td><td>belief-DAG 𝔅 + first-order desire (acts by practical inference)</td><td>the desiring, acting organ (orexis)</td></tr>
      <tr><td><b>superego</b></td><td>second-order desire + recognition + the law (slope, no-leak)</td><td>the internalised <b>D</b> — the Big Other taken inside</td></tr>
      <tr><td><b>revision</b></td><td>the ego move bent by the superego critique</td><td>the move actually voiced</td></tr>
    </table>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Subject Explorer — ${esc(world.title)}</title>
<style>
  :root { --ink:#1a1a1a; --muted:#6b6b6b; --line:#e0ddd6; --bg:#faf8f3; --accent:#7a5; --leaf:#f3eee2; --inner:#f3eee2; --done:#dff0d4; --done-line:#8db26d; }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.6 Georgia, serif; color:var(--ink); background:var(--bg); }
  main { max-width: 1000px; margin: 0 auto; padding: 30px 22px 80px; }
  h1 { font-size: 26px; font-weight: 500; margin: 0 0 4px; }
  h2 { font-size: 19px; font-weight: 500; margin: 30px 0 10px; }
  h3 { font-size: 15.5px; font-weight: 500; margin: 0 0 10px; }
  p { margin: 0 0 10px; }
  .sub { color: var(--muted); margin-bottom: 16px; }
  .card { border:1px solid var(--line); border-radius:10px; padding:14px 16px; background:#fff; margin-top:14px; }
  .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap:14px; }
  ul { margin:0; padding-left: 18px; } li { margin: 2px 0; }
  .tag { color: var(--muted); font-size: 12px; }
  .muted { color: var(--muted); }
  code { background:#f0ece2; padding:1px 5px; border-radius:4px; font-size:12.5px; }
  .dag { width:100%; height:auto; border:1px solid var(--line); border-radius:8px; background:#fff; margin-top:6px; }
  .dag .edge { stroke:#c4c0b6; stroke-width:1.3; }
  .dag rect.leaf, .dag rect.inner { fill:var(--inner); stroke:#c8b98e; }
  .dag rect.done { fill:var(--done); stroke:var(--done-line); }
  .dag text { font:12px Georgia, serif; fill:var(--ink); }
  table.es { width:100%; border-collapse:collapse; font-size:13px; margin-top:8px; }
  table.es th, table.es td { border:1px solid var(--line); padding:7px 9px; text-align:left; vertical-align:top; }
  table.es th { background:#f3eee2; font-weight:500; }
  nav.worlds { margin: 6px 0 10px; font-size:13px; } nav.worlds a { color:var(--accent); margin-right:10px; text-decoration:none; }
  .controls { position:sticky; top:0; background:var(--bg); padding:12px 0; border-bottom:1px solid var(--line); z-index:5; }
  .controls button { font:14px Georgia, serif; padding:4px 12px; border:1px solid var(--line); border-radius:6px; background:#fff; cursor:pointer; }
  .controls button.on { background:var(--done); border-color:var(--done-line); }
  .controls input[type=range] { vertical-align:middle; width:300px; }
  .timeline { margin:8px 0 0; font-size:12px; line-height:1.9; }
  .rel { white-space:nowrap; margin-right:6px; padding:1px 4px; border-radius:4px; }
  .rel.path { background:#eef3e8; } .rel.mirror { background:#f4ece6; color:var(--muted); }
  .state { display:flex; flex-wrap:wrap; gap:14px; align-items:center; margin-top:14px; font-size:14px; }
  .badge { font-size:12px; padding:2px 8px; border-radius:10px; background:#eee; }
  .badge.on { background:var(--done); }
  .rev { border-left:3px solid var(--accent); }
</style></head>
<body><main>
  <h1>The machine spirit, made legible</h1>
  <p class="sub">A constructed synthetic subject — who learns, teaches, and desires — assembled from a belief/desire DAG, three roles (T·L·D), an ego/superego split, memory, and (one organ) a voice. This surface executes the structure live. Decoupled: it reads only the belief–desire engine and the authored worlds.</p>

  <nav class="worlds">world: ${worlds.map((w) => `<a href="?world=${esc(w)}"${w === s ? ' style="font-weight:700;color:var(--ink)"' : ''}>${esc(w)}</a>`).join('')}</nav>

  <p><b>${esc(world.title)}</b> — <i>${esc(world.question)}</i><br>
  secret <code>${esc(world.secret)}</code> · mirror <code>${esc(world.mirror || '—')}</code> · the secret may not be derivable before turn <b>${world.tMin}</b> (the floor that protects recognition).</p>

  <div class="controls">
    <button id="prev">‹ step</button>
    <input type="range" id="turn" min="0" max="${world.turnCap}" value="${startTurn}" />
    <button id="next">step ›</button>
    <span>turn <b id="tlabel">${startTurn}</b> / ${world.turnCap}</span>
    &nbsp;&nbsp;<button id="revbtn">fire reverse()</button>
    <div class="timeline">release schedule: ${timeline}</div>
  </div>

  <div id="stage">${renderStage(s, opts)}</div>

  <h2>How ego and superego engage the DAG</h2>
  <p>The existing bilateral loop, re-read: the agent negotiating its own desire against the law. The superego is where the Big Other <b>D</b> is taken inside the agent.</p>
  ${egoSuperego}

  <p class="sub" style="margin-top:30px;">Step the schedule to watch the learner's beliefs accrue and the tutor's desire-DAG light up; cross turn ${world.tMin}+ to ground the secret, then fire <code>reverse()</code> (anagnorisis licenses peripeteia). Notes: <code>MACHINE-SPIRIT.md</code>, <code>BELIEF-DESIRE-DAG.md</code>.</p>

  <script>
    const W = ${JSON.stringify(s)}, CAP = ${world.turnCap};
    const stage = document.getElementById('stage'), slider = document.getElementById('turn'), tlabel = document.getElementById('tlabel'), revbtn = document.getElementById('revbtn');
    let reversed = false;
    async function refresh() {
      tlabel.textContent = slider.value;
      const r = await fetch('/api/subject/' + W + '/stage?turn=' + slider.value + (reversed ? '&reversed=1' : ''));
      stage.innerHTML = await r.text();
    }
    slider.addEventListener('input', () => { reversed = false; revbtn.classList.remove('on'); refresh(); });
    document.getElementById('prev').onclick = () => { slider.value = Math.max(0, +slider.value - 1); slider.dispatchEvent(new Event('input')); };
    document.getElementById('next').onclick = () => { slider.value = Math.min(CAP, +slider.value + 1); slider.dispatchEvent(new Event('input')); };
    revbtn.onclick = () => { reversed = !reversed; revbtn.classList.toggle('on', reversed); refresh(); };
  </script>
</main></body></html>`;
}

/** Mount the surface onto an Express app (decoupled: three routes, no shared state). */
export function mountSubjectExplorer(app) {
  app.get('/subject', (req, res) => {
    try {
      res.type('html').send(renderSubjectExplorerHtml(req.query.world, { turn: Number(req.query.turn) || 0 }));
    } catch (e) {
      res.status(500).type('text/plain').send(`subject explorer error: ${e.message}`);
    }
  });
  app.get('/api/subject/:world/stage', (req, res) => {
    try {
      res
        .type('html')
        .send(
          renderStage(req.params.world, { turn: Number(req.query.turn) || 0, reversed: req.query.reversed === '1' }),
        );
    } catch (e) {
      res.status(500).type('text/plain').send(`stage error: ${e.message}`);
    }
  });
  app.get('/api/subject/:world', (req, res) => {
    try {
      res.json(
        subjectExplorerData(req.params.world, {
          turn: Number(req.query.turn) || 0,
          reversed: req.query.reversed === '1',
        }),
      );
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  return app;
}
