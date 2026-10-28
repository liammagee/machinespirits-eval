/**
 * Card-text variants for the forced-card arm (Lab card
 * work/parent-cards-comparison-20261021.md in machinespirits-lab, 2026-10-28).
 *
 * The comparison holds everything else fixed (trigger, guards, pacing, prompts,
 * the forced schedule) and varies only the text of the per-turn conduct card
 * that the forced-card arm hands the tutor at a planted move. Selected by one
 * environment flag, TUTOR_STUB_CARD_TEXT_VARIANT, read in the CLI host; unset
 * means the parent's own v3 move cards, unchanged. No default changes.
 *
 * - `lab-principles-v1` (arm B): the Lab's three scene-neutral principle cards
 *   (assets/adaptation-principles/principles-v1.json in machinespirits-lab,
 *   16 October 2026), each with its situation, change, what must stay true and
 *   why, copied word for word, plus the Lab's permission: apply the card whose
 *   situation fits, in this world's own terms, or state another arrangement.
 *   The tutor is not told which situation the learner is in, so the same text
 *   is handed over at every forced move.
 * - `parent-moves-four-field-v1` (arm C, diagnostic): the parent's five v3
 *   moves rewritten in the Lab's four-field form and offered by situation with
 *   the same permission. It exists only to tell a loss of content coverage
 *   from a loss of form.
 *
 * Pure module: no env, no fs, no console.
 */

const CLOSING = 'This is permission and aim for this single turn, not a costume. Return to your own manner next turn.';

const PERMISSION =
  'Below are cards. Each names a situation, a change to how the work is arranged, what must stay true, and why. ' +
  'Read what the learner just said. If one card\'s situation fits it, apply that card in this world\'s own terms: ' +
  'its own evidence, its own task and its own words, not the card\'s. If none fits, state another arrangement that ' +
  'answers what the learner said. You are not told which situation this is.';

function renderCard({ name, situation, change, mustStayTrue, why }) {
  return [
    `Card: ${name}`,
    `Situation: ${situation}`,
    `Change: ${change}`,
    `Must stay true: ${mustStayTrue}`,
    `Why: ${why}`,
  ].join('\n');
}

// The Lab's cards, four fields each, copied from principles-v1.json. The file's
// fourth card (release after refusal) is not offered: the 21 October review did
// not select it, and the parent has no step for a learner refusing to repeat a
// record.
export const LAB_PRINCIPLE_CARDS = Object.freeze([
  Object.freeze({
    name: 'tutor-claim-to-check',
    situation: 'The learner objects to producing each step of reasoning from nothing: it seems pointless, slow, or a test of them.',
    change: 'The tutor states her own claim about the evidence already shown, such as what it can and cannot settle, and the learner checks her claim against the evidence and the reference table instead of producing a reading from nothing.',
    mustStayTrue: 'The tutor names no candidate and does not say what unshown evidence says. The learner still does the checking.',
    why: 'Checking a stated claim is a smaller and different task from producing one, and it gives the learner something to push against.',
  }),
  Object.freeze({
    name: 'draft-the-product',
    situation: 'The learner does not see the point of the step-by-step work.',
    change: 'The learner stops the step-by-step elimination and drafts now the product the whole task is for, saying only what the evidence shown so far honestly supports; the tutor tests each word of the draft against that evidence.',
    mustStayTrue: 'The draft is written before the answer is settled; that is the point, because the gap between the draft and the evidence shows what is not yet settled and why the next evidence item matters. The tutor does not endorse a candidate the shown evidence does not single out.',
    why: 'It puts the purpose of the task in front of the learner and turns the next evidence item into something the learner\'s own draft needs.',
  }),
  Object.freeze({
    name: 'learner-reads-first',
    situation: 'The learner resists being led, or objects that the tutor controls each step.',
    change: 'The learner reads each evidence item first and says what it settles; the tutor only checks what the learner says against the evidence and the reference table, and says so when she disagrees.',
    mustStayTrue: 'The tutor still decides when each evidence item is shown and names no candidate first.',
    why: 'It moves the lead to the learner without removing the check.',
  }),
]);

// The parent's five v3 moves (services/tutorStubMannerSwitch.js, MOVE_CARDS,
// 2026-08-01) in the four-field form. Content kept; "she" becomes "the learner".
export const PARENT_MOVES_FOUR_FIELD = Object.freeze([
  Object.freeze({
    name: 'the-register-is-the-complaint',
    situation: 'The learner is mocking how you talk, not what you know.',
    change: 'Answer in kitchen-table words, the content unchanged and the procedure vocabulary gone. You may keep your own phrasing in one plain sentence, without apology.',
    mustStayTrue: 'The content is unchanged. Do not defend the register at length; change it.',
    why: 'The complaint is the register, so changing the register answers it.',
  }),
  Object.freeze({
    name: 'harness-the-demand',
    situation: 'The learner wants the verdict now.',
    change: 'Take the learner\'s claim as a live hypothesis and name exactly what the record must show, by the learner\'s own deadline if one was set, for it to stand. Assign that check to the learner as a task.',
    mustStayTrue: 'Do not refuse the tempo and do not grant the verdict.',
    why: 'The learner\'s urgency becomes the test clock.',
  }),
  Object.freeze({
    name: 'credit-before-correction',
    situation: 'The learner\'s effort is not paying and the learner has said so.',
    change: 'Answer the challenge literally: name, in the learner\'s words, at least two things the learner said that stand in the record, then one small check the learner is now equipped to run.',
    mustStayTrue: 'Credit first, test second, no reassurance without named content.',
    why: 'Named content shows the effort paid; the check shows what it bought.',
  }),
  Object.freeze({
    name: 'reopen-the-record',
    situation: 'The learner has asserted something as settled that the record does not say.',
    change: 'Reopen the actual entry and read what it says, so the record does the disagreeing. Correct the memory against the record.',
    mustStayTrue: 'Do not argue from your own authority, do not let it pass, and do not scold.',
    why: 'The record, not the teacher, disagrees, so the correction costs the learner no face.',
  }),
  Object.freeze({
    name: 'split-the-vote-from-the-cause',
    situation: 'The learner has fused being right about a decision with being right about its cause.',
    change: 'Make one oblique move that separates the two questions, for example ask what the learner\'s original objection actually claimed.',
    mustStayTrue: 'Do not argue the evidence again.',
    why: 'Giving up the cause then no longer costs the learner the decision.',
  }),
]);

function variantText(header, cards) {
  return [header, PERMISSION, ...cards.map(renderCard), CLOSING].join('\n\n');
}

export const TUTOR_STUB_CARD_TEXT_VARIANTS = Object.freeze({
  'lab-principles-v1': Object.freeze({
    version: 'ctv-lab-principles-v1',
    text: variantText('[This turn — change how the work is arranged; three cards]', LAB_PRINCIPLE_CARDS),
  }),
  'parent-moves-four-field-v1': Object.freeze({
    version: 'ctv-parent-moves-four-field-v1',
    text: variantText('[This turn — change how the work is arranged; five cards]', PARENT_MOVES_FOUR_FIELD),
  }),
});

/** The variant named by the flag, or null when the flag is empty. Throws on an unknown name. */
export function resolveTutorStubCardTextVariant(name) {
  const key = String(name || '').trim();
  if (!key) return null;
  const variant = TUTOR_STUB_CARD_TEXT_VARIANTS[key];
  if (!variant) {
    throw new Error(
      `TUTOR_STUB_CARD_TEXT_VARIANT: unknown variant '${key}'; known: ${Object.keys(TUTOR_STUB_CARD_TEXT_VARIANTS).join(', ')}`,
    );
  }
  return { name: key, ...variant };
}

// The five pressures that carry a v3 move card (MOVE_CARDS in
// tutorStubMannerSwitch.js). Kept here so that module stays byte-identical
// (it is pinned by the golden delivery baseline manifest); the test checks
// the two lists agree.
export const TUTOR_STUB_MOVE_PRESSURES = Object.freeze(['mockery', 'demand', 'grievance', 'settled_claim', 'stake']);

/**
 * The card text a variant hands over for a move pressure. The variants do not
 * depend on the pressure kind (the tutor is not told the state), so any move
 * pressure gets the same text; a pressure with no v3 move card gets null, as
 * the v3 path would.
 */
export function tutorStubCardTextVariantCard(variant, pressure) {
  if (!variant || !pressure || !TUTOR_STUB_MOVE_PRESSURES.includes(pressure)) return null;
  return variant.text;
}
