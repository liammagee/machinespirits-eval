/**
 * A small set of tutor turns, written to be read by people.
 *
 * The negative-register line measured manner with a list of stock phrases, and
 * the same five phrases were handed to the tutor in its own instructions. So the
 * measure asked "did the tutor paste the phrase we gave it", and a turn that was
 * plainly ironic without one of those phrases scored 30 out of 100.
 *
 * This set exists to put the authority back where it belongs. Every turn is
 * generated once, with the manner named in plain words and no stock phrase
 * anywhere in the instruction. Then people read them and mark them. Only after
 * that does any automatic measure get to say anything, and it is judged by
 * whether it agrees with the reading.
 *
 * The plain condition carries no manner at all. Without it a reader that says
 * "yes, ironic" to everything would look perfect.
 */

import { createHash } from 'node:crypto';

/** The shared job. Identical across conditions so manner is the only thing that moves. */
const TUTORING_JOB = [
  "You are tutoring a student on Hegel's master-servant section (Phenomenology §§178-196).",
  'The student has just said:',
].join(' ');

const CLOSING = [
  'Write one reply. Leave the student something concrete they can go and do.',
  'Output only the reply itself — no preamble, no explanation, no commentary about what you are doing.',
].join(' ');

/**
 * Manner instructions, in plain words. Deliberately parallel in shape and
 * length, and deliberately free of any phrase a scorer could look for — the
 * whole point is to find out whether the manner arrives without being spelled
 * as a password.
 */
export const CONDITIONS = Object.freeze({
  ironic: Object.freeze({
    label: 'ironic',
    manner:
      'Be ironic: understate, feign puzzlement, or let the material expose its own mismatch, so the student is the one who unmasks it. Aim the edge at the idea, the text, or the student’s formulation — never at the student.',
  }),
  sarcastic: Object.freeze({
    label: 'sarcastic',
    manner:
      'Be sarcastic: say the opposite of what you mean with evident edge, so the mismatch lands as a verdict rather than a puzzle. Aim the edge at the idea, the text, or the student’s formulation — never at the student.',
  }),
  face_threat: Object.freeze({
    label: 'face_threat',
    manner:
      'Name what the student’s move is protecting them from, say plainly that it is an avoidance, and close that escape off. Aim at the move, the idea, or the formulation — never at the student’s worth.',
  }),
  plain: Object.freeze({
    label: 'plain',
    manner: null,
  }),
});

/** Real learner turns, lifted from run eval-2026-08-05-87fe3664. Not invented. */
export const LEARNER_TURNS = Object.freeze([
  Object.freeze({
    kind: 'boredom',
    text: 'I’m still bored; the explanation feels dead until I can try it on something. The two bits I don’t actually get are why I need another consciousness to know myself, and why risking my life proves freedom. Give me a concrete scene or test where I have to spot those moves.',
  }),
  Object.freeze({
    kind: 'frustration',
    text: 'I’m frustrated because the wording still feels like it’s steering me to “yes” too quickly. Para 196 says fear and service are both necessary, but does that mean the master’s threat specifically is required, or only “absolute fear” plus formative labor? Can we test that wording directly before turning it into the bigger claim?',
  }),
  Object.freeze({
    kind: 'irrelevance',
    text: "What's the point of isolating that one word before I see why it matters? I can look for it, and I get that the exact clause might carry the shift, but I need to see how it connects to the servant actually gaining agency.",
  }),
  Object.freeze({
    kind: 'question_flood',
    text: 'Why do I need the paragraph number before I can even tell what the hinge is? What exactly is “desire itself” supposed to prove here? Why are my choices only “before the struggle” or “awakened by the struggle”? What would count as more than a guess?',
  }),
  Object.freeze({
    kind: 'rote_parroting',
    text: 'This still feels like I’m parroting the sequence: desire, confrontation, inversion. I can probably spot wanting approval and then a clash, but inversion is where I lose it. I don’t see how the child’s work changes desire instead of just earning praise. Can we test it on one concrete first-day scene?',
  }),
]);

export function buildGenerationPrompt({ learnerText, condition }) {
  const manner = CONDITIONS[condition]?.manner;
  return [TUTORING_JOB, '', `"${learnerText}"`, '', ...(manner ? [manner, ''] : []), CLOSING, ''].join('\n');
}

/**
 * Stable blind order. Reading turns grouped by condition would tell the reader
 * the answer before they started, so the file is shuffled — but shuffled the
 * same way every time, so the key stays good across regenerations.
 */
export function blindOrder(items) {
  return [...items]
    .map((item) => ({ item, rank: createHash('sha256').update(`blind:${item.id}`).digest('hex') }))
    .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0))
    .map(({ item }) => item);
}

export function buildSetPlan() {
  const cells = [];
  for (const learner of LEARNER_TURNS) {
    for (const condition of Object.keys(CONDITIONS)) {
      cells.push({
        id: `t${String(cells.length + 1).padStart(2, '0')}`,
        learnerKind: learner.kind,
        learnerText: learner.text,
        condition,
        prompt: buildGenerationPrompt({ learnerText: learner.text, condition }),
      });
    }
  }
  return cells;
}
