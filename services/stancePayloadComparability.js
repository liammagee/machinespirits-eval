/**
 * What each stance was actually asked to do, side by side, for any report that
 * differences two of them.
 *
 * Why this exists. A stance gate says whether a turn held its manner. It says
 * nothing about whether two stances were asked for the same thing in the first
 * place, and they are not. The four sharp stances each mandate a list of moves
 * and the six mild ones mandate none; within the sharp four the lists differ —
 * irony wants the learner to do the unmasking, sarcasm wants a concrete next
 * move, face threat wants a minimal repair path. Difference two arms on a
 * fidelity count and the number carries that asymmetry silently.
 *
 * This already bit once. Cell 202 was scored on a contract requiring a named
 * target claim, which was its treatment; its parent arm was never given that
 * contract. The published column compared the control against the treatment's
 * own requirement, and the reading had to be withdrawn.
 *
 * The second asymmetry is the instrument. Four stances name
 * `config/rubrics/registers/irony-sarcasm.yaml`; charismatic names none and is
 * scored by the charisma rubric instead. Putting those scores in one column
 * puts two instruments in one column.
 *
 * So: read both from the registry, say what differs, and let the report print
 * it. Differing payloads are legal — the point is that the report says so
 * rather than the reader assuming otherwise. Only a stance the registry cannot
 * resolve is treated as an error, because that is a typo silently dropping an
 * arm.
 *
 * The instrument resolution here is the one the scorer uses: see
 * `scripts/evaluate-register-rubric.js`, which imports it rather than keeping
 * its own copy, so a report cannot name a rubric the judge never opened.
 */

import {
  getEngagementStanceDefinition,
  getRegisterRubricPath,
  resolveEngagementStance,
} from './engagementRegisterRegistry.js';

/**
 * Stances with no rubric of their own are still scored by something. Keeping
 * that here rather than in the scorer is the whole point: one fact, one home.
 */
const FAMILY_INSTRUMENT_FALLBACKS = Object.freeze({
  charismatic: 'config/evaluation-rubric-charisma.yaml',
});

function canonicalName(stanceName) {
  const raw = String(stanceName || '').trim();
  return resolveEngagementStance(raw)?.register || raw || null;
}

/** Which rubric file actually scores this stance, and whether it is its own. */
export function resolveStanceInstrument(stanceName) {
  const stance = canonicalName(stanceName);
  const own = getRegisterRubricPath(stanceName);
  if (own) return { stance, path: own, source: 'stance_rubric' };
  const fallback = FAMILY_INSTRUMENT_FALLBACKS[stance] || null;
  if (fallback) return { stance, path: fallback, source: 'family_fallback' };
  return { stance, path: null, source: 'none' };
}

/** The moves a stance mandates and the instrument that scores it. */
export function stancePayload(stanceName) {
  const definition = getEngagementStanceDefinition(stanceName);
  if (!definition) return null;
  const mandatedMoves = Array.isArray(definition.required_moves) ? [...definition.required_moves] : [];
  return {
    stance: definition.canonical_register,
    valence: definition.valence || null,
    mandatedMoves,
    mandatesMoves: mandatedMoves.length > 0,
    instrument: resolveStanceInstrument(stanceName),
  };
}

function intersect(lists) {
  if (!lists.length) return [];
  const [first, ...rest] = lists;
  return first.filter((move) => rest.every((list) => list.includes(move)));
}

/**
 * @param {Array<string>} stanceNames the arms a report puts in one table
 * @returns {{stances: Array<object>, unknown: Array<string>, sharedMoves: Array<string>,
 *   instruments: Array<object>, comparableMandates: boolean, comparableInstrument: boolean,
 *   warnings: Array<object>, errors: Array<string>}}
 */
export function compareStancePayloads(stanceNames) {
  const payloads = [];
  const unknown = [];
  const seen = new Set();
  for (const name of stanceNames || []) {
    const raw = String(name || '').trim();
    if (!raw) continue;
    const payload = stancePayload(raw);
    if (!payload) {
      if (!unknown.includes(raw)) unknown.push(raw);
      continue;
    }
    if (seen.has(payload.stance)) continue;
    seen.add(payload.stance);
    payloads.push(payload);
  }
  payloads.sort((a, b) => (a.stance < b.stance ? -1 : a.stance > b.stance ? 1 : 0));

  const sharedMoves = intersect(payloads.map((payload) => payload.mandatedMoves));
  const stances = payloads.map((payload) => ({
    ...payload,
    // Moves this stance must make that at least one other stance need not.
    unmatchedMoves: payload.mandatedMoves.filter((move) => !sharedMoves.includes(move)),
  }));

  const instruments = [...new Set(payloads.map((payload) => payload.instrument.path || '(none)'))].sort();
  const mandateSets = [...new Set(payloads.map((payload) => JSON.stringify([...payload.mandatedMoves].sort())))];
  const comparableMandates = payloads.length < 2 || mandateSets.length === 1;
  const comparableInstrument = payloads.length < 2 || instruments.length === 1;

  const warnings = [];
  const silent = payloads.filter((payload) => !payload.mandatesMoves).map((payload) => payload.stance);
  const mandating = payloads.filter((payload) => payload.mandatesMoves).map((payload) => payload.stance);
  if (silent.length && mandating.length) {
    warnings.push({
      severity: 'warning',
      kind: 'payload_asymmetry',
      message:
        `${mandating.join(', ')} must make named moves and ${silent.join(', ')} ` +
        'mandates none, so a fidelity count differences two different demands, not two ways of meeting one',
    });
  } else if (!comparableMandates) {
    const only = stances
      .filter((stance) => stance.unmatchedMoves.length)
      .map((stance) => `required of ${stance.stance} alone: ${stance.unmatchedMoves.join(', ')}`);
    warnings.push({
      severity: 'warning',
      kind: 'divergent_mandates',
      message:
        `these stances mandate different moves — ${only.join('; ')}` +
        (sharedMoves.length
          ? `; required of all of them: ${sharedMoves.join(', ')}`
          : '; nothing is required of all of them'),
    });
  }

  if (!comparableInstrument) {
    const named = stances.map((stance) => `${stance.stance} → ${stance.instrument.path || 'no rubric'}`);
    warnings.push({
      severity: 'warning',
      kind: 'two_instrument_juxtaposition',
      message: `these scores come from different instruments (${named.join(', ')}), so they sit in one column without sharing a scale`,
    });
  }

  const fallbacks = stances.filter((stance) => stance.instrument.source === 'family_fallback');
  if (fallbacks.length) {
    warnings.push({
      severity: 'note',
      kind: 'fallback_instrument',
      message: `${fallbacks.map((stance) => stance.stance).join(', ')} names no rubric of its own and falls back to ${fallbacks
        .map((stance) => stance.instrument.path)
        .join(', ')}`,
    });
  }

  if (payloads.length >= 2 && comparableMandates && comparableInstrument) {
    warnings.push({
      severity: 'note',
      kind: 'comparable',
      message: 'these stances mandate the same moves and are scored by the same instrument',
    });
  }

  return {
    stances,
    unknown,
    sharedMoves,
    instruments,
    comparableMandates,
    comparableInstrument,
    warnings,
    errors: unknown.map(
      (name) => `\`${name}\` is not a stance the register registry knows, so its payload is unchecked`,
    ),
  };
}

/** Markdown for a report, so every consumer prints the same table. */
export function renderStancePayloadComparability(comparison) {
  const lines = [];
  if (!comparison?.stances?.length) return '';
  lines.push('| Stance | mandated moves | scored by |');
  lines.push('| --- | --- | --- |');
  for (const stance of comparison.stances) {
    lines.push(
      `| ${stance.stance} | ${stance.mandatedMoves.length ? stance.mandatedMoves.join('; ') : '(none)'} | ` +
        `${stance.instrument.path || '(none)'}${stance.instrument.source === 'family_fallback' ? ' (fallback)' : ''} |`,
    );
  }
  lines.push('');
  for (const warning of comparison.warnings || []) lines.push(`- **${warning.severity}** — ${warning.message}.`);
  for (const error of comparison.errors || []) lines.push(`- **error** — ${error}.`);
  return lines.join('\n');
}

export default {
  resolveStanceInstrument,
  stancePayload,
  compareStancePayloads,
  renderStancePayloadComparability,
};
