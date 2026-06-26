/**
 * Subject Explorer — a DECOUPLED surface that introduces, explains, and
 * executes the belief–desire DAG as a constructed synthetic subject
 * (MACHINE-SPIRIT.md §5). It reads ONLY the structural engine
 * (services/dramaticDerivation/beliefDesire.js) and the authored world specs —
 * no eval DB, no coupling to the factorial / poetics machinery. Mount it into
 * any Express app with mountSubjectExplorer(app), or serve it standalone via
 * scripts/serve-subject-explorer.js.
 *
 * v1: a static render of one world's {T, L, D} subject. v2: step the release
 * schedule + fire reverse(). v3: the ego/superego engagement made interactive.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadWorld } from './dramaticDerivation/world.js';
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

function worldFile(stem) {
  const safe = path.basename(String(stem || DEFAULT_WORLD)).replace(/[^a-z0-9-]/gi, '');
  const file = path.join(WORLDS_DIR, `${safe}.yaml`);
  return fs.existsSync(file) ? file : path.join(WORLDS_DIR, `${DEFAULT_WORLD}.yaml`);
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

/** The data behind the surface: the live {T, L, D} subject for a world. */
export function subjectExplorerData(stem) {
  const world = loadWorld(worldFile(stem));
  // default render state: alpha sub-chain closed (the AND-join gap), beta untouched
  const held = ['p_alloy', 'p_crucible', 'p_caster'].map((id) => world.premiseById.get(id)?.fact).filter(Boolean);
  const subject = buildSubjectState(world, {
    learnerHeld: held,
    releasedPremiseIds: ['p_alloy', 'p_crucible', 'p_caster'],
  });
  const tutorDag = buildTutorDesireDag(world);
  const reversed = reverse(subject, { surpassed: 'T' });
  return {
    world: {
      id: world.id,
      title: world.title,
      question: world.question,
      secret: factText(world.secret.fact),
      mirror: world.mirror ? factText(world.mirror.fact) : null,
      tMin: world.slope.t_min,
    },
    subject,
    tutorDag,
    reversed,
    heldPremises: ['p_alloy', 'p_crucible', 'p_caster'],
  };
}

// --- a minimal layered SVG of a desire-DAG (depth columns) -----------------
function dagSvg(dag) {
  if (!dag?.nodes?.length) return '<p class="muted">(no desire-DAG)</p>';
  const depth = new Map();
  const setDepth = (id, d) => depth.set(id, Math.max(depth.get(id) ?? 0, d));
  setDepth(dag.root, 0);
  // edges go parent(end) -> child(sub-goal); push children deeper than parents
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
  const boxW = 140;
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
      const leaf = n.leaf;
      return `<g><rect x="${p.x}" y="${p.y}" width="${boxW}" height="${boxH}" rx="6" class="${leaf ? 'leaf' : 'inner'}"/><text x="${p.x + boxW / 2}" y="${p.y + boxH / 2 + 4}" text-anchor="middle">${esc(labelFor(n))}</text></g>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${width} ${height}" class="dag" role="img"><title>tutor desire-DAG</title>${edgeSvg}${nodeSvg}</svg>`;
}

function card(title, body) {
  return `<section class="card"><h3>${esc(title)}</h3>${body}</section>`;
}

function list(items) {
  return `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
}

/** The full standalone HTML page. */
export function renderSubjectExplorerHtml(stem) {
  const d = subjectExplorerData(stem);
  const { world, subject, tutorDag, reversed } = d;
  const worlds = listWorlds();

  const learnerBeliefs = subject.L.belief.nodes
    .map((n) => `${esc(factText(n.statement.content))} <span class="tag">${esc(n.status)}</span>`)
    .slice(0, 12);
  const learnerDesires = subject.L.desire.nodes.map(
    (n) =>
      `${esc(labelFor(n))} <span class="tag">order ${n.statement.order}${n.origin === 'root_end' ? '' : ' · ' + n.origin}</span>`,
  );
  const directorEnds = subject.D.desire.nodes.map(
    (n) => `<b>${esc(n.label)}</b> — ${esc(JSON.stringify(n.statement.content))}`,
  );
  const mLT = subject.L.models.T;

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
  :root { --ink:#1a1a1a; --muted:#6b6b6b; --line:#e0ddd6; --bg:#faf8f3; --accent:#7a5; --leaf:#eef3e8; --inner:#f3eee2; }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.65 Georgia, serif; color:var(--ink); background:var(--bg); }
  main { max-width: 980px; margin: 0 auto; padding: 32px 22px 80px; }
  h1 { font-size: 26px; font-weight: 500; margin: 0 0 4px; }
  h2 { font-size: 19px; font-weight: 500; margin: 34px 0 10px; }
  h3 { font-size: 16px; font-weight: 500; margin: 0 0 10px; }
  p { margin: 0 0 12px; }
  .sub { color: var(--muted); margin-bottom: 18px; }
  .grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .card { border:1px solid var(--line); border-radius:10px; padding:14px 16px; background:#fff; }
  .card.t { grid-column: 1 / -1; }
  ul { margin:0; padding-left: 18px; } li { margin: 2px 0; }
  .tag { color: var(--muted); font-size: 12px; }
  .muted { color: var(--muted); }
  code { background:#f0ece2; padding:1px 5px; border-radius:4px; font-size:13px; }
  .dag { width:100%; height:auto; border:1px solid var(--line); border-radius:8px; background:#fff; margin-top:8px; }
  .dag .edge { stroke:#bbb; stroke-width:1.3; }
  .dag rect.leaf { fill:var(--leaf); stroke:#9bb787; } .dag rect.inner { fill:var(--inner); stroke:#c8b98e; }
  .dag text { font:12px Georgia, serif; fill:var(--ink); }
  table.es { width:100%; border-collapse:collapse; font-size:13.5px; }
  table.es th, table.es td { border:1px solid var(--line); padding:7px 9px; text-align:left; vertical-align:top; }
  table.es th { background:#f3eee2; font-weight:500; }
  nav.worlds { margin: 8px 0 24px; font-size:13px; }
  nav.worlds a { color:var(--accent); margin-right:10px; text-decoration:none; }
  nav.worlds a.on { font-weight:700; color:var(--ink); }
  .rev { border-left:3px solid var(--accent); padding-left:14px; }
</style></head>
<body><main>
  <h1>The machine spirit, made legible</h1>
  <p class="sub">A constructed synthetic subject — who learns, teaches, and desires — assembled from a belief/desire DAG, three roles, an ego/superego split, memory, and (one organ) a voice. This surface executes the structure live. It is decoupled: it reads only the belief–desire engine and the authored worlds.</p>

  <nav class="worlds">world: ${worlds.map((w) => `<a class="${w === (subject.world?.replace(/_/g, '-') || DEFAULT_WORLD) || w === DEFAULT_WORLD ? '' : ''}" href="?world=${esc(w)}">${esc(w)}</a>`).join('')}</nav>

  <h2>The world it is thrown into</h2>
  <p><b>${esc(world.title)}</b> — <i>${esc(world.question)}</i><br>
  secret <code>${esc(world.secret)}</code> · mirror <code>${esc(world.mirror || '—')}</code> · the secret may not be derivable before turn <b>${world.tMin}</b> (the floor that protects recognition).</p>

  <h2>The subject: three bearers and the DAG</h2>
  <div class="grid">
    ${card(
      'T — tutor (desire-DAG = the proof, inverted)',
      `<p class="muted">root: <code>${esc(labelFor(tutorDag.nodes.find((n) => n.id === tutorDag.root)))}</code>. The leaves are the releases the tutor must bring about — its practical syllogism toward the secret.</p>${dagSvg(tutorDag)}<p class="tag">leaves: ${tutorDag.leaves.map((l) => `<code>${esc(l)}</code>`).join(' ')}</p>`,
    )}
  </div>
  <div class="grid" style="margin-top:14px;">
    ${card('L — learner (belief + desire + a model of the tutor)', `<p class="muted">grounded so far (α closed, β open):</p>${list(learnerBeliefs)}<p class="muted" style="margin-top:8px;">its desires:</p>${list(learnerDesires)}<p class="muted" style="margin-top:8px;">𝔐_L(T) — what it reads the tutor as wanting (public-only; cannot see S):</p>${list(mLT.inferredDesires.map((x) => esc(labelFor(x)) + ` <span class="tag">secret hidden: ${!mLT.audit.secretIncluded}</span>`))}`)}
    ${card('D — director (the Big Other: aesthetic ends)', list(directorEnds) + `<p class="tag" style="margin-top:8px;">plotLint is D’s satisfaction condition.</p>`)}
  </div>

  <h2>How ego and superego engage the DAG</h2>
  <p>The existing bilateral loop, re-read: the agent negotiating its own desire against the law. The superego is where the Big Other <b>D</b> is taken inside the agent.</p>
  ${egoSuperego}

  <h2>Reversal — the subject turning itself over</h2>
  <div class="rev">
  <p>When the learner grounds the secret and is recognised, roles can reverse. <code>reverse()</code> swaps <b>T ↔ L</b> (D fixed) and seeds the <b>dependence proposition δ</b> on the surpassed party — necessary, not sufficient: it consummates only once δ is grounded.</p>
  <p class="tag">swap ${esc(JSON.stringify(reversed.swap))} · seeded <code>${esc(labelFor(reversed.seeded))}</code> · consummated: ${reversed.consummated}</p>
  </div>

  <p class="sub" style="margin-top:34px;">v1 (static). Next: step the release schedule and re-render; fire <code>reverse()</code> interactively; pick an ego/superego wiring and see the move it would produce. Notes: <code>MACHINE-SPIRIT.md</code>, <code>BELIEF-DESIRE-DAG.md</code>.</p>
</main></body></html>`;
}

/** Mount the surface onto an Express app (decoupled: two routes, no shared state). */
export function mountSubjectExplorer(app) {
  app.get('/subject', (req, res) => {
    try {
      res.type('html').send(renderSubjectExplorerHtml(req.query.world));
    } catch (e) {
      res.status(500).type('text/plain').send(`subject explorer error: ${e.message}`);
    }
  });
  app.get('/api/subject/:world', (req, res) => {
    try {
      res.json(subjectExplorerData(req.params.world));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  return app;
}
