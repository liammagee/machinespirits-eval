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

// --- prompt-line rendering (the same source → prose) -----------------------

function questionInWords(world) {
  return (world.question || '').replace(/\?+\s*$/, '').trim();
}

/**
 * Render a bearer's motivation as prompt lines — the rendering that replaces a
 * free-text `voice` so the prompt's motivation IS the engine's desire (one
 * source, two outputs). Returns [] if no block is authored for the bearer.
 */
export function renderMotivationLines(world, bearer = 'learner') {
  const m = world?.motivation?.[bearer];
  if (!m || bearer !== 'learner') return [];
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
