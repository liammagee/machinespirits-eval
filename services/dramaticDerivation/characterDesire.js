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
  return [];
}

const PULL_THRESHOLD = { high: 0, medium: 1, low: 2 };

/**
 * The learner's first-order slot binding AT a point in the run: it opens on the
 * mirror (opens_on) and migrates to the truth as the proof advances, gated by
 * mirror_pull (high clings until the secret grounds; lower lets go sooner). Also
 * reports the overreach tension — apt to assert the current binding ahead of it.
 */
export function learnerBindingAtTurn(world, heldFacts = []) {
  const m = world?.motivation?.learner;
  const fo = m?.first_order;
  if (!fo) return null;
  const secretFact = world.secret.fact;
  const truth = secretFact[secretFact.length - 1];
  const opensOn = fo.opens_on ?? null;
  const pull = fo.mirror_pull || 'low';
  const dist = derivationDistance(world, heldFacts);
  const secretGrounded = entails(heldFacts, world.rules, secretFact);
  const threshold = PULL_THRESHOLD[pull] ?? 2;
  const migrated = secretGrounded || (Number.isFinite(dist) && dist <= threshold);
  const binding = migrated ? truth : opensOn;
  const overreachTempted = m.disposition?.overreach === 'high' && !secretGrounded && binding != null;
  return {
    binding,
    opensOn,
    truth,
    migrated,
    mirrorPull: pull,
    overreachTempted,
    derivationDistance: Number.isFinite(dist) ? dist : null,
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
