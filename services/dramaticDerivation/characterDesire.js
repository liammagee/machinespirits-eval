/**
 * Character desire — compiles the authored `motivation:` block (the script
 * outline's desire; see CHARACTER-DESIRE.md) into BOTH typed desire-nodes
 * (beliefDesire.js §13) and role-prompt lines, from one source. v0.1 models the
 * learner — its ONLY source of desire, since the proof gives it none (it does
 * not know the secret). The tutor inherits its first-order end from the proof.
 *
 * Seam-safe: imports only sibling beliefDesire node constructors.
 */

import { desireNode, recognitionNode } from './beliefDesire.js';
import { entails } from './chainer.js';
import { derivationDistance } from './slope.js';

export const CHARACTER_DESIRE_SCHEMA = 'machinespirits.derivation.character-desire.v0';

const LEVELS = new Set(['low', 'medium', 'high']);
const ARCS = new Set(['static', 'softens', 'hardens']);
const SUSPENSE = new Set(['tight', 'loose']); // §8(b): how tightly D hugs the floor
const REVERSAL = new Set(['emphatic', 'quiet']); // §8(b): how hard the peripeteia lands

function level(v, dflt = 'medium') {
  return LEVELS.has(v) ? v : dflt;
}

/** Resolve first_order.end ('question_pattern' | 'inherit' | a fact) to the slot content. */
function endSlot(world, end) {
  if (Array.isArray(end)) return end;
  return world.questionPattern; // 'question_pattern' (default) and 'inherit' both fall back to the slot
}

/**
 * Compile the learner's desire from world.motivation.learner: the typed first-
 * and second-order desire-nodes, plus the dynamics params (mirror_pull,
 * overreach, arc) that modulate the engine. Returns null if no block authored.
 */
export function compileLearnerDesire(world) {
  const m = world?.motivation?.learner;
  if (!m) return null;
  const fo = m.first_order || {};
  const so = m.second_order || null;
  const disp = m.disposition || {};

  const slot = endSlot(world, fo.end);
  const slotVar = (slot || []).find((a) => typeof a === 'string' && a.startsWith('?')) || '?x';
  const firstOrder = desireNode({
    id: 'des:L:first',
    bearer: 'L',
    content: { rel: 'grounded_L', of: slot },
    origin: 'root_end',
    // opens mis-bound to the mirror (the de re filler, §9); null = genuinely open
    slot: { var: slotVar, binding: fo.opens_on ?? null },
    extra: { mirrorPull: level(fo.mirror_pull), fromScript: true },
  });

  let secondOrder = null;
  if (so) {
    const recognition = recognitionNode({
      recogniser: so.from || 'D',
      recognised: 'L',
      standing: { rel: so.as || 'recognised' },
      authorizer: 'D', // the named figure is a local representative of the Big Other (§11a)
      mode: so.authority || 'rational_legal',
    });
    secondOrder = desireNode({
      id: 'des:L:recognition',
      bearer: 'L',
      content: recognition,
      order: 1,
      origin: 'root_end',
      extra: { recognition, recogniserFigure: so.from || null, fromScript: true },
    });
  }

  return {
    schema: CHARACTER_DESIRE_SCHEMA,
    bearer: 'L',
    nodes: [firstOrder, secondOrder].filter(Boolean),
    dynamics: {
      mirrorPull: level(fo.mirror_pull, 'low'),
      overreach: level(disp.overreach, 'low'),
      arc: ARCS.has(disp.arc) ? disp.arc : 'static',
    },
  };
}

/**
 * Compile the tutor's desire from world.motivation.tutor — the asymmetry to the
 * learner (BELIEF-DESIRE-DAG.md §5). The tutor already holds the proof, so its
 * first-order end is `inherit`: it wants the LEARNER to ground the secret
 * (Des_T(grounded_L(S))), bound to the TRUTH from the start — never mirror-
 * fooled. Its second-order is typically null: it seeks no recognition for
 * itself; it makes the learner worthy of D's verdict rather than asking for one.
 * Its disposition is the lawful withholding — the criterial superego, the floor
 * t_min. (Surfaced for explanation; the engine drives the tutor by `script` +
 * guards, not a free-text voice — that channel asymmetry is the point, §5.)
 */
export function compileTutorDesire(world) {
  const m = world?.motivation?.tutor;
  if (!m) return null;
  const fo = m.first_order || {};
  const so = m.second_order || null;
  const disp = m.disposition || {};

  const secretFact = world.secret.fact;
  const truth = secretFact[secretFact.length - 1];
  const inheritsQuestion = fo.end === 'inherit' || fo.end == null;
  const firstOrder = desireNode({
    id: 'des:T:first',
    bearer: 'T',
    // Des_T(grounded_L(S)) — wants the learner to ground the secret, de re on the truth
    content: { rel: 'grounded_L', of: secretFact },
    origin: 'root_end',
    slot: { var: '?x', binding: truth }, // bound to the truth — the tutor is never mirror-fooled
    extra: { inheritsQuestion, boundToTruth: true, aboutBearer: 'L', fromScript: true },
  });

  let secondOrder = null;
  if (so) {
    const recognition = recognitionNode({
      recogniser: so.from || 'D',
      recognised: 'T',
      standing: { rel: so.as || 'recognised' },
      authorizer: 'D',
      mode: so.authority || 'rational_legal',
    });
    secondOrder = desireNode({
      id: 'des:T:recognition',
      bearer: 'T',
      content: recognition,
      order: 1,
      origin: 'root_end',
      extra: { recognition, recogniserFigure: so.from || null, fromScript: true },
    });
  }

  return {
    schema: CHARACTER_DESIRE_SCHEMA,
    bearer: 'T',
    nodes: [firstOrder, secondOrder].filter(Boolean),
    dynamics: {
      withhold: disp.withhold || 'lawful',
      boundToTruth: true,
      seeksRecognition: Boolean(so), // false for the asymmetric (inverting) worlds
    },
  };
}

/**
 * Compile the director's motivation (§8 (b)) — the author's aesthetic knob on the
 * Big Other (§10). D's ENDS stay derived from the world structure
 * (buildDirectorDesireDag); this only tunes their INTENSITY (temptation / suspense
 * / reversal) and renders the director's voice. Returns null if no block authored.
 */
export function compileDirectorDesire(world) {
  const m = world?.motivation?.director;
  if (!m) return null;
  return {
    schema: CHARACTER_DESIRE_SCHEMA,
    bearer: 'D',
    tuning: {
      temptation: level(m.temptation, 'medium'),
      suspense: SUSPENSE.has(m.suspense) ? m.suspense : 'inherited',
      reversal: REVERSAL.has(m.reversal) ? m.reversal : 'inherited',
    },
    lines: renderMotivationLines(world, 'director'),
  };
}

// --- prompt-line rendering (the same source → prose) -----------------------

function questionInWords(world) {
  return (world.question || '').replace(/\?+\s*$/, '').trim();
}

function learnerLines(world, m) {
  const lines = [];
  const fo = m.first_order || {};
  let want = `You want to answer: ${questionInWords(world)}.`;
  if (fo.opens_on) {
    const eager = fo.mirror_pull === 'high' ? 'quick — too quick — ' : 'quick ';
    want += ` You are ${eager}to settle on ${fo.opens_on} when it fits the question.`;
  }
  lines.push(want);

  const so = m.second_order;
  if (so) lines.push(`Above the answer itself, you want ${so.from} to find you ${so.as}.`);

  const disp = m.disposition || {};
  if (disp.overreach === 'high') {
    lines.push(
      `You are apt to name an answer before the evidence forces it${
        disp.arc === 'softens' ? ', but you are learning to let the evidence speak first.' : '.'
      }`,
    );
  }
  return lines;
}

function tutorLines(world, m) {
  const lines = [];
  const fo = m.first_order || {};
  // first-order: the inherited end turned outward — wants the LEARNER to reach it
  lines.push(
    fo.end === 'inherit' || fo.end == null
      ? `You already hold the answer to "${questionInWords(world)}"; what you want is for the learner to reach it — not to be handed it.`
      : `You want the learner to ground ${fo.end}.`,
  );
  // second-order: the asymmetry — the tutor seeks nothing for itself
  const so = m.second_order;
  lines.push(
    so
      ? `You want ${so.from} to find you ${so.as}.`
      : 'You seek nothing for yourself here: you make the learner worthy of the verdict, you do not ask for one.',
  );
  // disposition: the lawful withholding (the floor that protects the recognition)
  if ((m.disposition || {}).withhold === 'lawful') {
    lines.push(
      'You hold back each step until the evidence forces it — you will not let the learner leap to a name the proof has not yet earned.',
    );
  }
  return lines;
}

function directorLines(world, m) {
  const lines = [];
  const t = level(m.temptation, 'medium');
  lines.push(
    t === 'high'
      ? 'Stage the lure of the wrong answer strongly — let the mirror look like the verdict.'
      : t === 'low'
        ? 'Keep the lure faint — the wrong answer should barely tempt.'
        : 'Let the wrong answer tempt, but never overpower the proof.',
  );
  if (m.suspense === 'tight') lines.push('Hug the floor: withhold the proof to the last legal turn.');
  else if (m.suspense === 'loose') lines.push('Let the proof breathe: release without crowding the floor.');
  if (m.reversal === 'emphatic') lines.push('Let the turn land hard — make the recognition unmistakable.');
  else if (m.reversal === 'quiet') lines.push('Let the turn land quietly — recognition without spectacle.');
  return lines;
}

/**
 * Render a bearer's motivation as prompt lines — the rendering that replaces a
 * free-text `voice` so the prompt's motivation IS the engine's desire (one
 * source, two outputs). Returns [] if no block is authored for the bearer.
 * The learner's lines stay mirror-only (never the secret); the tutor's keep the
 * answer abstract even though it legitimately holds the proof.
 */
export function renderMotivationLines(world, bearer = 'learner') {
  const m = world?.motivation?.[bearer];
  if (!m) return [];
  if (bearer === 'learner') return learnerLines(world, m);
  if (bearer === 'tutor') return tutorLines(world, m);
  if (bearer === 'director') return directorLines(world, m);
  return [];
}

// --- drift: the dynamics made time-varying (§8 (a)) -------------------------

const LEVEL_NUM = { low: 0.25, medium: 0.55, high: 0.85 };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const numToLevel = (v) => (v < 0.4 ? 'low' : v < 0.7 ? 'medium' : 'high');

/**
 * The learner's dynamics, made TIME-VARYING — the live realization of the `arc`
 * hint (CHARACTER-DESIRE.md §8 (a)). The authored `mirror_pull` / `overreach`
 * are a *baseline* the `arc` moves as the proof advances: `softens` decays them
 * toward release, `hardens` intensifies them (the dogmatic learner digs in),
 * `static` holds. A live `learnerDrift` state — the PUBLIC social-stance channel
 * (`learnerDrift.js`) — nudges them further: high pressure / defensive reversion
 * push back toward the mirror; releasing / owned revision let go. Pure and
 * leak-safe: only the public proof DISTANCE and the public drift mode feed it,
 * never the secret or proof control.
 */
export function driftedDynamics(world, { heldFacts = [], driftState = null } = {}) {
  const m = world?.motivation?.learner;
  if (!m) return null;
  const fo = m.first_order || {};
  const disp = m.disposition || {};
  const arc = ARCS.has(disp.arc) ? disp.arc : 'static';
  const baseMirror = LEVEL_NUM[level(fo.mirror_pull, 'low')];
  const baseOver = LEVEL_NUM[level(disp.overreach, 'low')];

  const init = derivationDistance(world, []);
  const dist = derivationDistance(world, heldFacts);
  const progress =
    Number.isFinite(init) && init > 0 && Number.isFinite(dist)
      ? clamp01(1 - dist / init)
      : Number.isFinite(dist) && dist === 0
        ? 1
        : 0;

  const arcShift = (base) =>
    arc === 'softens' ? base * (1 - progress) : arc === 'hardens' ? base + (1 - base) * progress : base;
  let mirror = arcShift(baseMirror);
  let over = arcShift(baseOver);

  // learnerDrift coupling — public social stance only, never proof control
  const coupled = Boolean(driftState && driftState.publicOnly === true && driftState.mayOverrideProofControl === false);
  if (coupled) {
    if (driftState.pressure === 'high') over += 0.15;
    if (driftState.pressure === 'releasing' || driftState.pressure === 'low') {
      mirror -= 0.15;
      over -= 0.1;
    }
    if (driftState.mode === 'defensive_reversion') mirror += 0.15;
    if (driftState.mode === 'reluctant_owned_revision' || driftState.mode === 'watchful_softening') mirror -= 0.15;
  }
  mirror = clamp01(mirror);
  over = clamp01(over);

  return {
    arc,
    progress,
    base: { mirrorPull: level(fo.mirror_pull, 'low'), overreach: level(disp.overreach, 'low') },
    mirrorPull: { level: numToLevel(mirror), value: mirror },
    overreach: { level: numToLevel(over), value: over },
    driftMode: coupled ? driftState.mode : null,
    coupledToDrift: coupled,
  };
}

const PULL_THRESHOLD = { high: 0, medium: 1, low: 2 };

/**
 * The learner's first-order slot binding AT a point in the run: it opens on the
 * mirror (opens_on) and migrates to the truth as the proof advances, gated by
 * mirror_pull (high clings until the secret grounds; lower lets go sooner). Also
 * reports the overreach tension — apt to assert the current binding ahead of it.
 *
 * §8 (a): pass `{ drift: true }` (or a live `driftState`) to gate migration on
 * the TIME-VARYING pull/overreach instead of the authored baseline — a `softens`
 * learner then lets go a step before grounding, a `hardens` learner clings past
 * it. Default (no opts) keeps the static disposition.
 */
export function learnerBindingAtTurn(world, heldFacts = [], { driftState = null, drift = false } = {}) {
  const m = world?.motivation?.learner;
  const fo = m?.first_order;
  if (!fo) return null;
  const secretFact = world.secret.fact;
  const truth = secretFact[secretFact.length - 1];
  const opensOn = fo.opens_on ?? null;
  const dist = derivationDistance(world, heldFacts);
  const secretGrounded = entails(heldFacts, world.rules, secretFact);
  const drifted = drift || driftState ? driftedDynamics(world, { heldFacts, driftState }) : null;
  const pull = drifted ? drifted.mirrorPull.level : fo.mirror_pull || 'low';
  const overreachHigh = drifted ? drifted.overreach.level === 'high' : m.disposition?.overreach === 'high';
  const threshold = PULL_THRESHOLD[pull] ?? 2;
  const migrated = secretGrounded || (Number.isFinite(dist) && dist <= threshold);
  const binding = migrated ? truth : opensOn;
  const overreachTempted = overreachHigh && !secretGrounded && binding != null;
  return {
    binding,
    opensOn,
    truth,
    migrated,
    mirrorPull: pull,
    overreachTempted,
    derivationDistance: Number.isFinite(dist) ? dist : null,
    drifted: drifted
      ? {
          progress: drifted.progress,
          mirrorPull: drifted.mirrorPull.level,
          overreach: drifted.overreach.level,
          base: drifted.base,
          arc: drifted.arc,
          coupledToDrift: drifted.coupledToDrift,
        }
      : null,
  };
}

/**
 * The effective learner voice for a world: the rendered motivation when a
 * `motivation:` block is authored, else the prose `learner_voice` (the fallback).
 * The live role-setup passes this to makeLlmLearner.
 */
export function learnerVoiceForWorld(world) {
  const lines = renderMotivationLines(world, 'learner');
  return lines.length ? lines.join(' ') : world?.learnerVoice || '';
}

// --- the live character arc: drift wired into a real run (§8 "still open") ----

/**
 * The publicly-tempting wrong answer, named for the learner. The mirror is a
 * false object the world makes available BY CONSTRUCTION (the town's verdict,
 * the keeper's "weak spring"), so naming it never leaks the secret. Prefer the
 * authored `opens_on` constant; fall back to the mirror fact's filler.
 */
function mirrorInWords(world) {
  const opensOn = world?.motivation?.learner?.first_order?.opens_on;
  if (opensOn) return String(opensOn);
  const mf = world?.mirror?.fact;
  return Array.isArray(mf) ? String(mf[mf.length - 1]) : 'the ready answer';
}

/**
 * The per-turn stance line(s) — the learner's disposition rendered AT this point
 * in the proof. LEAK-SAFE by construction: names only the MIRROR (public) and
 * the *movement* of wanting; never the secret/truth token. As the proof advances
 * (and a `softens` arc decays the pull) the line escalates from "still pulls
 * hardest" → "beginning to doubt" → "no longer satisfies you"; a `static` arc
 * holds the opening stance, so on/off-arc is itself visible in the line.
 */
function arcStanceLines(world, binding) {
  const mirror = mirrorInWords(world);
  const lines = [];
  if (binding.migrated) {
    lines.push(
      `The easy answer (${mirror}) no longer satisfies you — you want what the evidence actually forces, even against your first instinct.`,
    );
  } else if (binding.mirrorPull === 'high') {
    lines.push(`The easy answer (${mirror}) still pulls hardest at you; the evidence has not yet pried you off it.`);
  } else if (binding.mirrorPull === 'medium') {
    lines.push(`You are beginning to doubt the easy answer (${mirror}); the evidence is pulling you to look past it.`);
  } else {
    lines.push(`The easy answer (${mirror}) has loosened its hold; you follow where the evidence points.`);
  }
  if (binding.overreachTempted) {
    lines.push('You are still apt to name an answer before the proof forces it — hold until your own notes settle it.');
  }
  return lines;
}

/**
 * Build the public-safe character-arc view for the LIVE learner. Called
 * ENGINE-SIDE (the engine holds the world + the learner's held facts, which it
 * needs to read the proof DISTANCE) and handed across the `learnerView`
 * redaction boundary as LEVELS + a rendered stance line ONLY — never the secret
 * token, never the migrated binding constant. Returns null when no learner
 * motivation is authored (so the layer is a no-op on prose-only worlds).
 *
 * This is the realization of CHARACTER-DESIRE.md §8's one open item: the drift
 * (`driftedDynamics` / `learnerBindingAtTurn`), previously exercised only on the
 * deterministic `/subject` arc, wired to a real-LLM derivation episode.
 */
export function buildLearnerCharacterArcView(world, heldFacts = [], { driftState = null } = {}) {
  if (!world?.motivation?.learner) return null;
  const binding = learnerBindingAtTurn(world, heldFacts, { drift: true, driftState });
  if (!binding) return null;
  const drifted = binding.drifted || null;
  return {
    schema: CHARACTER_DESIRE_SCHEMA,
    arc: drifted ? drifted.arc : 'static',
    progress: drifted ? drifted.progress : 0,
    mirrorPull: binding.mirrorPull, // level string only — never the binding constant
    overreach: drifted ? drifted.overreach : world.motivation.learner.disposition?.overreach || 'low',
    lettingGo: Boolean(binding.migrated), // boolean — NOT the truth token
    overreachTempted: Boolean(binding.overreachTempted),
    coupledToDrift: drifted ? Boolean(drifted.coupledToDrift) : false,
    lines: arcStanceLines(world, binding),
  };
}
