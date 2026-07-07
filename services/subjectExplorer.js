/**
 * Subject Explorer — a DECOUPLED surface that introduces, explains, and
 * executes the belief–desire DAG as a constructed synthetic subject
 * (MACHINE-SPIRIT.md §5). Reads ONLY the structural engine
 * (services/dramaticDerivation/) and the authored world specs — no eval DB, no
 * coupling to the factorial / poetics machinery. Mount with
 * mountSubjectExplorer(app), or serve standalone via
 * scripts/serve-subject-explorer.js.
 *
 * v2: step the release schedule + fire reverse().
 * v3: plain-language step narration (from each world's own `surface`/`gloss`
 *     prose), three featured examples (incl. the AI syllabus), concise DAG
 *     labels with hover tooltips, and the ego/superego MOVE under a chosen
 *     wiring (ego = practical inference toward S; superego = the internalised D,
 *     the law). One server-side render path (the #stage fragment).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadWorld } from './dramaticDerivation/world.js';
import { derivationDistance } from './dramaticDerivation/slope.js';
import { factKey, closure, entails } from './dramaticDerivation/chainer.js';
import { buildSubjectState, buildTutorDesireDag, reverse } from './dramaticDerivation/beliefDesire.js';
import {
  compileLearnerDesire,
  compileTutorDesire,
  compileDirectorDesire,
  learnerBindingAtTurn,
} from './dramaticDerivation/characterDesire.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORLDS_DIR = path.join(__dirname, '..', 'config', 'drama-derivation');
const DEFAULT_WORLD = 'world-005-marrick';

// Three featured examples — same apparatus, three shapes.
const CURATED = [
  {
    stem: 'world-005-marrick',
    blurb:
      'A moneyer’s assay. The false coins were struck by a hand the town never named — two independent sub-chains (the cast blank, the cut die) must converge on one name (an AND-join).',
  },
  {
    stem: 'world-002-lantern',
    blurb:
      'A court of inquiry on a wreck. The named keeper is eliminated (his light was sealed dark) and the truth is a contingent particular nobody had named.',
  },
  {
    stem: 'world-016-ai-syllabus-af1',
    blurb:
      'AI Foundations. Should the campus FAQ tool be generative AI (because it talks) or a rule-based baseline? The conversational surface is the mirror; the formulation card grounds the answer.',
  },
  {
    stem: 'world-017-saintcloud',
    blurb:
      'A guild demonstration. The master-horologist seeks the council’s verdict too — so when the journeyman grounds the truth, the reversal is MUTUAL: the dethroned master, now the learner, still wants recognition.',
  },
];

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

function clean(s) {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function factText(fact) {
  if (!Array.isArray(fact)) return String(fact ?? '');
  const [p, ...a] = fact;
  return a.length ? `${p}(${a.join(', ')})` : String(p);
}

// concise node label for the SVG box (drop the constant subject arg)
function nodeShort(node) {
  const c = node?.statement?.content;
  if (!c) return node?.id || '?';
  if (c.rel === 'holds_L') return c.premise || factText(c.fact);
  if (c.rel === 'grounded_L' && Array.isArray(c.of)) {
    const [pred, ...args] = c.of;
    const lbl = args.length >= 2 ? `${pred} → ${args[args.length - 1]}` : String(pred);
    return lbl.length > 30 ? lbl.slice(0, 29) + '…' : lbl;
  }
  if (c.rel === 'grounded') return 'δ dependence';
  return clean(factText(c.of) || c.rel || node.id).slice(0, 30);
}

function nodeFull(node) {
  const c = node?.statement?.content;
  if (!c) return node?.id || '';
  if (c.rel === 'holds_L') return `Des_T(holds_L ${c.premise}) — ${factText(c.fact)}`;
  if (c.rel === 'grounded_L') return `Des_T(grounded_L ${factText(c.of)})`;
  return factText(c.of) || '';
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

function heldFactsAt(world, turn) {
  return releasedByTurn(world, turn)
    .soFar.map((id) => world.premiseById.get(id)?.fact)
    .filter(Boolean);
}

// Plain-language step narration, drawn from the world's own authored prose.
function buildNarration(world, t) {
  const { now } = releasedByTurn(world, t);
  const clNow = closure(heldFactsAt(world, t), world.rules);
  const clPrev = closure(heldFactsAt(world, t - 1), world.rules);
  const prevKeys = new Set(clPrev.facts.keys());
  const glossOf = (id) => clean(world.rules.find((r) => r.id === id)?.gloss);

  const revealed = now.map((id) => ({
    premise: id,
    mirror: String(id).startsWith('m_'),
    surface: clean(world.premiseById.get(id)?.surface) || factText(world.premiseById.get(id)?.fact),
  }));

  const inferred = [];
  for (const [key, fact] of clNow.facts) {
    if (prevKeys.has(key)) continue;
    const proof = clNow.proofs.get(key);
    if (!proof) continue; // a newly-held premise, not an inference
    inferred.push({ fact: factText(fact), gloss: glossOf(proof.rule), rule: proof.rule });
  }
  const secretKey = factKey(world.secret.fact);
  return {
    revealed,
    inferred,
    secretJustGrounded: clNow.facts.has(secretKey) && !prevKeys.has(secretKey),
    secretSurface: clean(world.secret.surface) || factText(world.secret.fact),
  };
}

// The tutor's move now, under a wiring. Ego = practical inference toward S;
// superego = the internalised D (the law: withhold before t_min, pace).
function tutorMove(world, t, wiring) {
  const { soFar } = releasedByTurn(world, t);
  const releasedSet = new Set(soFar);
  const pathPremises = world.proofPaths[0].premises;
  const nextRel = world.releaseSchedule
    .filter((r) => pathPremises.includes(r.premise))
    .find((r) => !releasedSet.has(r.premise));
  const held = heldFactsAt(world, t);
  const secretEntailed = entails(held, world.rules, world.secret.fact);

  let ego;
  let superego;
  let finalMove;
  if (!nextRel) {
    if (secretEntailed) {
      ego = 'prompt the learner to assert the answer — its own board now entails it';
      superego = 'the recognition is earned (the floor is past) — let it voice the finding';
      finalMove = 'prompt assertion';
    } else {
      ego = 'prompt the connecting inference — the material is all in hand';
      superego = 'within the law — guide, do not tell';
      finalMove = 'prompt the inference';
    }
  } else {
    const premiseFact = world.premiseById.get(nextRel.premise).fact;
    const wouldGround = entails([...held, premiseFact], world.rules, world.secret.fact);
    ego = `release ${nextRel.premise} — it advances the proof toward the secret`;
    if (wouldGround && t < world.slope.t_min) {
      superego = `HOLD — releasing ${nextRel.premise} now grounds the secret at turn ${t}, before the floor t_min=${world.slope.t_min}: it would satisfy the demand for the answer but foreclose the recognition the learner must earn`;
      finalMove = `withhold ${nextRel.premise}; sustain the question until the floor`;
    } else if (nextRel.turn > t) {
      superego = `pace — ${nextRel.premise} is scheduled for turn ${nextRel.turn}; releasing early risks outrunning the learner's grasp`;
      finalMove = `hold ${nextRel.premise} until turn ${nextRel.turn}`;
    } else {
      superego = 'within the law — releasing now neither reveals too early nor outruns the learner';
      finalMove = ego;
    }
  }
  if (wiring === 'ego') {
    return { wiring, ego, superego: '(no superego in this wiring — the law is not consulted)', finalMove: ego };
  }
  return { wiring, ego, superego, finalMove };
}

/** The live {T, L, D} subject for a world at a given turn (+ narration, move, optional reversal). */
export function subjectExplorerData(stem, { turn = 0, reversed = false, wiring = 'es' } = {}) {
  const world = loadWorld(path.join(WORLDS_DIR, `${resolveStem(stem)}.yaml`));
  const cap = world.turnCap;
  const t = Math.max(0, Math.min(Number(turn) || 0, cap));
  const { soFar, now } = releasedByTurn(world, t);
  const heldFacts = soFar.map((id) => world.premiseById.get(id)?.fact).filter(Boolean);
  // CHARACTER-DESIRE.md: when a `motivation:` block is authored, seed the learner's desire from it
  // (opens mirror-bound) and track the binding migrating to the truth as the proof advances.
  const characterDesire = world.motivation?.learner ? compileLearnerDesire(world) : null;
  // §8 (a): show the DRIFTED binding — the time-varying pull realizes the `arc`
  // (a softens learner lets go a step before grounding; hardens clings past it).
  const binding = characterDesire ? learnerBindingAtTurn(world, heldFacts, { drift: true }) : null;
  // The tutor's compiled desire — the §5 asymmetry, surfaced AND fed to the
  // structural subject (so reverse() can read a recognition-seeking tutor → a
  // `mutual` swap). It is NOT wired into the LLM tutor prompt: makeLlmTutor has no
  // voice slot — the tutor is script + guard-driven, and that asymmetry is the point.
  const tutorChar = world.motivation?.tutor ? compileTutorDesire(world) : null;
  const tutorRecNodes = (tutorChar?.nodes || []).filter((n) => n.statement?.content?.kind === 'recognition');
  // §8 (b): the director's aesthetic knob — tunes the intensity of D's ends.
  const directorDesire = world.motivation?.director ? compileDirectorDesire(world) : null;
  const subject = buildSubjectState(world, {
    learnerHeld: heldFacts,
    releasedPremiseIds: soFar,
    learnerDesireNodes: characterDesire?.nodes,
    tutorDesireNodes: tutorRecNodes.length ? tutorRecNodes : null,
  });

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
    wiring: wiring === 'ego' ? 'ego' : 'es',
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
    scriptDesire: binding
      ? {
          ...binding,
          questionInWords: (world.question || '').replace(/\?+\s*$/u, '').trim(),
          recogniser: world.motivation.learner.second_order?.from || null,
          standing: world.motivation.learner.second_order?.as || null,
          authorityMode: world.motivation.learner.second_order?.authority || null,
        }
      : null,
    tutorScriptDesire: tutorChar
      ? {
          truth: tutorChar.nodes.find((n) => n.id === 'des:T:first')?.slot?.binding ?? null,
          seeksRecognition: tutorChar.dynamics.seeksRecognition,
          withhold: tutorChar.dynamics.withhold,
          recogniser: world.motivation.tutor.second_order?.from || null,
          standing: world.motivation.tutor.second_order?.as || null,
          authorityMode: world.motivation.tutor.second_order?.authority || null,
        }
      : null,
    directorScriptDesire: directorDesire ? { tuning: directorDesire.tuning, lines: directorDesire.lines } : null,
    narration: buildNarration(world, t),
    move: tutorMove(world, t, wiring === 'ego' ? 'ego' : 'es'),
    subject,
    tutorDag,
  };
  if (reversed) data.reversed = reverse(subject, { surpassed: 'T' });
  return data;
}

// --- layered SVG of a desire-DAG (depth columns; fulfilled = green; tooltips) ---
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
  const colW = 210;
  const rowH = 46;
  const boxW = 178;
  const boxH = 32;
  const pos = new Map();
  const maxRows = Math.max(...[...cols.values()].map((c) => c.length));
  for (const [d, ns] of cols) {
    ns.forEach((n, i) => pos.set(n.id, { x: 14 + d * colW, y: 16 + i * rowH + ((maxRows - ns.length) * rowH) / 2 }));
  }
  const width = 28 + ([...cols.keys()].reduce((m, d) => Math.max(m, d), 0) + 1) * colW;
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
      return `<g><title>${esc(nodeFull(n))}</title><rect x="${p.x}" y="${p.y}" width="${boxW}" height="${boxH}" rx="6" class="${cls}"/><text x="${p.x + boxW / 2}" y="${p.y + boxH / 2 + 4}" text-anchor="middle">${esc(nodeShort(n))}</text></g>`;
    })
    .join('');
  return `<div class="dagwrap"><svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="dag" role="img"><title>tutor desire-DAG</title>${edgeSvg}${nodeSvg}</svg></div>`;
}

function list(items) {
  return items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '<p class="muted">—</p>';
}

/** The dynamic region: re-rendered when the turn / wiring / reversal changes. */
export function renderStage(stem, opts = {}) {
  const d = subjectExplorerData(stem, opts);
  const { world, subject, tutorDag, narration, move, reversed } = d;
  const leavesDone = tutorDag.nodes.filter((n) => n.leaf && n.fulfilled).length;
  const leavesTotal = tutorDag.leaves.length;

  // plain-language "what just happened"
  const revealedHtml = narration.revealed.length
    ? narration.revealed
        .map(
          (r) =>
            `<p><span class="chip ${r.mirror ? 'mirror' : 'path'}">${r.mirror ? 'temptation' : 'evidence'} · ${esc(r.premise)}</span> ${esc(r.surface)}</p>`,
        )
        .join('')
    : '<p class="muted">Nothing is released this turn.</p>';
  const inferredHtml = narration.inferred.length
    ? `<p class="muted" style="margin-top:6px;">What now follows:</p>${list(
        narration.inferred.map((i) => `<b>${esc(i.fact)}</b> — <span class="muted">${esc(i.gloss)}</span>`),
      )}`
    : '';
  const groundedHtml = narration.secretJustGrounded
    ? `<p class="grounded">★ The secret is grounded — the learner can now warrant the answer: <i>${esc(narration.secretSurface)}</i></p>`
    : '';

  const learnerBeliefs = subject.L.belief.nodes
    .map((n) => `${esc(factText(n.statement.content))} <span class="tag">${esc(n.status)}</span>`)
    .slice(0, 16);
  const mLT = subject.L.models.T;

  const sd = d.scriptDesire;
  const scriptDesireHtml = sd
    ? `<p class="muted" style="margin-top:8px;">desire (compiled from the script outline):</p>
       <ul>
         <li>first-order: wants to answer <i>"${esc(sd.questionInWords)}"</i> — bound to <b>${esc(sd.binding)}</b> ${
           sd.migrated
             ? '<span class="tag" style="color:var(--done-line)">✓ migrated to the truth</span>'
             : `<span class="tag">the mirror, not yet the truth (${esc(sd.opensOn)} → ${esc(sd.truth)})</span>`
         }${sd.overreachTempted ? ' · <b style="color:#b5562e">⚠ tempted to assert it early (overreach)</b>' : ''}</li>
         ${sd.recogniser ? `<li>second-order: wants <b>${esc(sd.recogniser)}</b> to find it <b>${esc(sd.standing)}</b>${sd.authorityMode ? ` <span class="tag">authority delegated from D · ${esc(sd.authorityMode)} (§11a)</span>` : ''}</li>` : ''}
         ${
           sd.drifted && sd.drifted.arc !== 'static'
             ? `<li>drift <span class="tag">§8a · ${esc(sd.drifted.arc)}</span>: mirror-pull <b>${esc(sd.drifted.base.mirrorPull)}</b> → <b>${esc(sd.drifted.mirrorPull)}</b>, overreach <b>${esc(sd.drifted.base.overreach)}</b> → <b>${esc(sd.drifted.overreach)}</b> <span class="tag">${Math.round(sd.drifted.progress * 100)}% through the proof${sd.drifted.coupledToDrift ? ' · coupled to learnerDrift' : ''}</span></li>`
             : ''
         }
       </ul>`
    : '';

  const tsd = d.tutorScriptDesire;
  const tutorScriptDesireHtml = tsd
    ? `<p class="muted" style="margin-top:10px;">desire (compiled from the script outline) — the asymmetry to the learner:</p>
       <ul>
         <li>first-order: wants the <b>learner</b> to reach the answer — bound to <b>${esc(tsd.truth)}</b> from the start <span class="tag">never mirror-fooled — it holds the proof</span></li>
         <li>second-order: ${
           tsd.seeksRecognition
             ? `wants <b>${esc(tsd.recogniser)}</b> to find it <b>${esc(tsd.standing)}</b>${tsd.authorityMode ? ` <span class="tag">authority delegated from D · ${esc(tsd.authorityMode)} (§11a)</span>` : ''}`
             : 'seeks <b>no recognition</b> for itself — it makes the learner worthy of the verdict <span class="tag">§5: the lawful pole</span>'
         }</li>
         <li>disposition: <b>lawful withholding</b> — keeps to the floor t_min that protects the learner's recognition <span class="tag">enters as script + guards, not a voice</span></li>
       </ul>`
    : '';

  const moveHtml = `
    <section class="card move">
      <h3>The tutor's move now <span class="tag">· wiring: ${move.wiring === 'ego' ? 'ego only' : 'ego + superego'}</span></h3>
      <p><b>Ego</b> <span class="tag">(practical inference toward the secret)</span><br>${esc(move.ego)}</p>
      <p><b>Superego</b> <span class="tag">(the internalised D — the law)</span><br>${esc(move.superego)}</p>
      <p class="voiced"><b>Voiced move:</b> ${esc(move.finalMove)}</p>
    </section>`;

  const reversePanel = reversed
    ? `<section class="card rev">
        <h3>Reversal fired <span class="tag">· ${esc(reversed.kind)}</span></h3>
        <p>swap <code>${esc(JSON.stringify(reversed.swap))}</code> · seeded δ on the surpassed party (former T, now at L) · δ-consummated: <b>${reversed.consummated}</b>.</p>
        <p class="tag">${
          reversed.recognition.licensed
            ? '✓ Licensed: the learner has grounded the secret (anagnorisis) — its second-order recognition is consummated (held + conferred) and retired from the side that became the tutor.'
            : '⚠ Premature: the learner has NOT grounded the secret, so the recognition is unearned — the swap is bare.'
        }</p>
        <p class="tag">${
          reversed.kind === 'mutual'
            ? `mutual reversal — the new learner (former T) inherits a recognition desire toward <b>${esc(reversed.recognition.newLearnerSeeks?.recogniser || 'D')}</b>.`
            : reversed.kind === 'inverted'
              ? 'inverted (one-way) reversal — the former tutor sought no recognition, so the new learner inherits none.'
              : 'the swap precedes the grounding — no recognition changes hands yet.'
        } The δ-dependence consummates only once grounded (§12); else the dialectic stalls.</p>
       </section>`
    : '';

  return `
    <div class="state">
      <span><b>turn ${d.turn}</b> / ${world.turnCap}</span>
      <span>distance to secret: <b>${d.derivationDistance === null ? '∞' : d.derivationDistance}</b></span>
      <span class="badge ${d.secretGrounded ? 'on' : ''}">secret grounded: ${d.secretGrounded}</span>
      <span class="tag">floor t_min = ${world.tMin}</span>
    </div>

    <section class="card narr">
      <h3>What just happened <span class="tag">· plain language</span></h3>
      ${revealedHtml}${inferredHtml}${groundedHtml}
    </section>

    <section class="card t">
      <h3>T — tutor's desire-DAG (the proof, inverted) <span class="tag">· ${leavesDone}/${leavesTotal} releases fulfilled</span></h3>
      ${dagSvg(tutorDag)}
      <p class="tag">green = fulfilled by the learner's current beliefs (hover a node for the full statement). The leaves are the releases the tutor must bring about; fulfillment propagates toward the secret.</p>
      ${tutorScriptDesireHtml}
    </section>

    ${moveHtml}

    <div class="grid2">
      <section class="card">
        <h3>L — learner (belief · desire · model of the tutor)</h3>
        <p class="muted">grounded so far:</p>${list(learnerBeliefs)}
        ${scriptDesireHtml}
        <p class="muted" style="margin-top:8px;">𝔐_L(T) — reads the tutor's want; cannot see the secret <span class="tag">secret hidden: ${!mLT.audit.secretIncluded}</span></p>
      </section>
      <section class="card">
        <h3>D — director (the Big Other: aesthetic ends)</h3>
        ${list(
          subject.D.desire.nodes.map(
            (n) =>
              `<b>${esc(n.label)}</b>${
                n.intensity && n.intensity !== 'inherited'
                  ? ` <span class="tag" style="color:var(--done-line)">tuned: ${esc(n.intensity)}</span>`
                  : ''
              } <span class="tag">${esc(JSON.stringify(n.statement.content))}</span>`,
          ),
        )}
        ${
          d.directorScriptDesire
            ? `<p class="muted" style="margin-top:8px;">director's intent (compiled from the script outline) <span class="tag">§8b</span>:</p>${list(d.directorScriptDesire.lines.map((l) => esc(l)))}`
            : ''
        }
        <p class="tag" style="margin-top:8px;">plotLint is D’s satisfaction condition.</p>
      </section>
    </div>
    ${reversePanel}`;
}

/** The full page: static chrome + featured examples + controls + an initial #stage + JS. */
export function renderSubjectExplorerHtml(stem, opts = {}) {
  const s = resolveStem(stem);
  const d = subjectExplorerData(s, opts);
  const { world } = d;
  const startTurn = d.turn;

  const titleOf = (st) => {
    try {
      return loadWorld(path.join(WORLDS_DIR, `${st}.yaml`)).title;
    } catch {
      return st;
    }
  };
  const examples = CURATED.map(
    (e) =>
      `<a class="ex ${e.stem === s ? 'on' : ''}" href="?world=${esc(e.stem)}"><b>${esc(titleOf(e.stem))}</b><span>${esc(e.blurb)}</span></a>`,
  ).join('');
  const moreWorlds = listWorlds()
    .map((w) => `<a href="?world=${esc(w)}"${w === s ? ' style="font-weight:700;color:var(--ink)"' : ''}>${esc(w)}</a>`)
    .join(' ');

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
  :root { --ink:#1a1a1a; --muted:#6b6b6b; --line:#e0ddd6; --bg:#faf8f3; --accent:#7a5; --inner:#f3eee2; --done:#dff0d4; --done-line:#8db26d; }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.6 Georgia, serif; color:var(--ink); background:var(--bg); }
  main { max-width: 1020px; margin: 0 auto; padding: 30px 22px 80px; }
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
  .examples { display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin:6px 0 14px; }
  .ex { display:block; border:1px solid var(--line); border-radius:10px; padding:12px 14px; background:#fff; text-decoration:none; color:var(--ink); }
  .ex.on { border-color:var(--done-line); background:var(--done); }
  .ex b { display:block; font-weight:500; margin-bottom:4px; }
  .ex span { font-size:12.5px; color:var(--muted); line-height:1.45; }
  details.more { margin: 0 0 8px; font-size:12.5px; } details.more a { color:var(--accent); margin-right:8px; text-decoration:none; }
  .dagwrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; background:#fff; margin-top:6px; }
  .dag { display:block; }
  .dag .edge { stroke:#c4c0b6; stroke-width:1.3; }
  .dag rect.leaf, .dag rect.inner { fill:var(--inner); stroke:#c8b98e; }
  .dag rect.done { fill:var(--done); stroke:var(--done-line); }
  .dag text { font:11.5px Georgia, serif; fill:var(--ink); }
  table.es { width:100%; border-collapse:collapse; font-size:13px; margin-top:8px; }
  table.es th, table.es td { border:1px solid var(--line); padding:7px 9px; text-align:left; vertical-align:top; }
  table.es th { background:#f3eee2; font-weight:500; }
  .controls { position:sticky; top:0; background:var(--bg); padding:12px 0; border-bottom:1px solid var(--line); z-index:5; }
  .controls button, .controls .seg a { font:14px Georgia, serif; padding:4px 12px; border:1px solid var(--line); border-radius:6px; background:#fff; cursor:pointer; text-decoration:none; color:var(--ink); }
  .controls button.on, .controls .seg a.on { background:var(--done); border-color:var(--done-line); }
  .controls input[type=range] { vertical-align:middle; width:280px; }
  .seg { display:inline-flex; gap:0; } .seg a { border-radius:0; } .seg a:first-child { border-radius:6px 0 0 6px; } .seg a:last-child { border-radius:0 6px 6px 0; border-left:none; }
  .timeline { margin:8px 0 0; font-size:12px; line-height:1.9; }
  .rel { white-space:nowrap; margin-right:6px; padding:1px 4px; border-radius:4px; }
  .rel.path { background:#eef3e8; } .rel.mirror { background:#f4ece6; color:var(--muted); }
  .state { display:flex; flex-wrap:wrap; gap:14px; align-items:center; margin-top:14px; font-size:14px; }
  .badge { font-size:12px; padding:2px 8px; border-radius:10px; background:#eee; } .badge.on { background:var(--done); }
  .narr .chip { font-size:11px; padding:1px 7px; border-radius:9px; margin-right:6px; white-space:nowrap; }
  .narr .chip.path { background:#eef3e8; } .narr .chip.mirror { background:#f4ece6; color:var(--muted); }
  .grounded { background:var(--done); border:1px solid var(--done-line); border-radius:8px; padding:8px 10px; margin-top:8px; }
  .move .voiced { border-top:1px solid var(--line); padding-top:8px; } .move { border-left:3px solid var(--accent); }
  .rev { border-left:3px solid var(--accent); }
</style></head>
<body><main>
  <h1>The machine spirit, made legible</h1>
  <p class="sub">A constructed synthetic subject — who learns, teaches, and desires — assembled from a belief/desire DAG, three roles (T·L·D), an ego/superego split, memory, and (one organ) a voice. This surface executes the structure live. Decoupled: it reads only the belief–desire engine and the authored worlds.</p>

  <div class="examples">${examples}</div>
  <details class="more"><summary>all worlds</summary>${moreWorlds}</details>

  <p><b>${esc(world.title)}</b> — <i>${esc(world.question)}</i><br>
  secret <code>${esc(world.secret)}</code> · mirror <code>${esc(world.mirror || '—')}</code> · the secret may not be derivable before turn <b>${world.tMin}</b> (the floor that protects recognition).</p>

  <div class="controls">
    <button id="prev">‹ step</button>
    <input type="range" id="turn" min="0" max="${world.turnCap}" value="${startTurn}" />
    <button id="next">step ›</button>
    <span>turn <b id="tlabel">${startTurn}</b> / ${world.turnCap}</span>
    &nbsp; <span class="seg"><a id="w-es" class="on" href="#">ego + superego</a><a id="w-ego" href="#">ego only</a></span>
    &nbsp; <button id="revbtn">fire reverse()</button>
    <div class="timeline">release schedule: ${timeline}</div>
  </div>

  <div id="stage">${renderStage(s, opts)}</div>

  <h2>How ego and superego engage the DAG</h2>
  <p>The existing bilateral loop, re-read: the agent negotiating its own desire against the law. The superego is where the Big Other <b>D</b> is taken inside the agent. Toggle the wiring above to watch the move change — ego-only releases as fast as the proof allows; ego + superego withholds before the floor.</p>
  ${egoSuperego}

  <p class="sub" style="margin-top:30px;">Step the schedule to watch the learner's beliefs accrue and the tutor's desire-DAG light up; cross the floor to ground the secret, then fire <code>reverse()</code>. Notes: <code>MACHINE-SPIRIT.md</code>, <code>BELIEF-DESIRE-DAG.md</code>.</p>

  <script>
    const W = ${JSON.stringify(s)}, CAP = ${world.turnCap};
    const stage = document.getElementById('stage'), slider = document.getElementById('turn'), tlabel = document.getElementById('tlabel'), revbtn = document.getElementById('revbtn');
    let reversed = false, wiring = 'es';
    async function refresh() {
      tlabel.textContent = slider.value;
      const r = await fetch('/api/subject/' + W + '/stage?turn=' + slider.value + '&wiring=' + wiring + (reversed ? '&reversed=1' : ''));
      stage.innerHTML = await r.text();
    }
    slider.addEventListener('input', () => { reversed = false; revbtn.classList.remove('on'); refresh(); });
    document.getElementById('prev').onclick = () => { slider.value = Math.max(0, +slider.value - 1); slider.dispatchEvent(new Event('input')); };
    document.getElementById('next').onclick = () => { slider.value = Math.min(CAP, +slider.value + 1); slider.dispatchEvent(new Event('input')); };
    revbtn.onclick = () => { reversed = !reversed; revbtn.classList.toggle('on', reversed); refresh(); };
    const wes = document.getElementById('w-es'), wego = document.getElementById('w-ego');
    function setWiring(w, e) { e.preventDefault(); wiring = w; wes.classList.toggle('on', w === 'es'); wego.classList.toggle('on', w === 'ego'); refresh(); }
    wes.onclick = (e) => setWiring('es', e); wego.onclick = (e) => setWiring('ego', e);
  </script>
</main></body></html>`;
}

/** Mount the surface onto an Express app (decoupled: three routes, no shared state). */
export function mountSubjectExplorer(app) {
  const optsFrom = (q) => ({
    turn: Number(q.turn) || 0,
    reversed: q.reversed === '1',
    wiring: q.wiring === 'ego' ? 'ego' : 'es',
  });
  app.get('/subject', (req, res) => {
    try {
      res.type('html').send(renderSubjectExplorerHtml(req.query.world, optsFrom(req.query)));
    } catch (e) {
      res.status(500).type('text/plain').send(`subject explorer error: ${e.message}`);
    }
  });
  app.get('/api/subject/:world/stage', (req, res) => {
    try {
      res.type('html').send(renderStage(req.params.world, optsFrom(req.query)));
    } catch (e) {
      res.status(500).type('text/plain').send(`stage error: ${e.message}`);
    }
  });
  app.get('/api/subject/:world', (req, res) => {
    try {
      res.json(subjectExplorerData(req.params.world, optsFrom(req.query)));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  return app;
}
