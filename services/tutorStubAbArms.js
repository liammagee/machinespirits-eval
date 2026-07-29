/**
 * Instrumentation arms for the tutor A/B harness.
 *
 * The speaking tutor receives its augmentation as discrete labelled blocks in
 * the final user message of the frozen first-draft request. Every block is
 * delimited by `[<header>]` and `[End <header lowercased>]`, and the only
 * residue outside the blocks is the learner's own utterance. That makes the
 * instrumentation an addressable projection over a frozen request rather than
 * something that can only be varied by rerunning the dialogue.
 *
 * An arm therefore selects a subset of features. Dropping a feature removes its
 * block from the request; it never changes the public prefix, the learner text,
 * the world, or the rubric the candidate is graded against.
 */

const AB_ARM_SCHEMA = 'machinespirits.tutor-stub.ab-arm.v1';
const AB_REQUEST_PROJECTION_SCHEMA = 'machinespirits.tutor-stub.ab-request-projection.v1';

export const TUTOR_STUB_AB_ARM_SCHEMA = AB_ARM_SCHEMA;
export const TUTOR_STUB_AB_REQUEST_PROJECTION_SCHEMA = AB_REQUEST_PROJECTION_SCHEMA;

/**
 * Feature registry.
 *
 * `blocks` lists every opening header the tutor stub has used for this slot.
 * More than one header can name the same slot: the first-draft performance
 * contract is currently rendered under `[Tutor-only host plan]`, while older
 * fixtures still carry `[Tutor-only first-draft performance contract]`, and
 * `refreshTutorStubFrozenFirstDraftRequest` treats the two as one replaceable
 * block. Splitting them into two features would let an arm claim it dropped the
 * contract while the contract was still in the request under its other name.
 *
 * `guards` names the deterministic audits the feature is meant to satisfy —
 * recorded for reporting only. The A/B rubric always runs the reference guard
 * set, so dropping a feature makes its guard harder to satisfy rather than
 * switching the guard off.
 */
export const TUTOR_STUB_AB_FEATURES = Object.freeze(
  [
    {
      id: 'context_continuity',
      blocks: ['Tutor context continuity'],
      label: 'Context continuity note',
      summary: 'Tells the speaker that the full public prefix was replayed in order.',
      guards: [],
    },
    {
      id: 'evidence_window',
      blocks: ['Tutor-only public evidence window'],
      label: 'Public evidence window',
      summary: 'The committed/due evidence boundary for this turn: what may and may not be said.',
      guards: ['leak', 'dramaticRelease'],
    },
    {
      id: 'learner_classifier',
      blocks: ['Tutor-only learner classifier'],
      label: 'Learner classifier',
      summary: 'Discourse move, evidence use, epistemic stance, and immediate pedagogical need.',
      guards: [],
    },
    {
      id: 'learner_dag',
      blocks: ['Tutor-only redacted learner-DAG model'],
      label: 'Learner proof DAG',
      summary: 'Redacted proof-DAG model of the learner: coverage, bottleneck, grounded facts, hypotheses.',
      guards: [],
    },
    {
      id: 'human_scaffold',
      blocks: ['Tutor-only human discourse scaffold'],
      label: 'Human discourse scaffold',
      summary: 'Defeasible scaffold: current branch, local question, warrant frame, proof debt.',
      guards: ['humanScaffold', 'questionSupport'],
    },
    {
      id: 'first_draft_contract',
      blocks: ['Tutor-only host plan', 'Tutor-only first-draft performance contract'],
      label: 'First-draft performance contract',
      summary: 'The turn contract: part, action, composition slots, progression, sources to realise.',
      guards: ['responseComposition', 'actorialRealization'],
    },
  ].map((feature) =>
    Object.freeze({ ...feature, blocks: Object.freeze(feature.blocks), guards: Object.freeze(feature.guards) }),
  ),
);

const FEATURE_BY_ID = new Map(TUTOR_STUB_AB_FEATURES.map((feature) => [feature.id, feature]));
const FEATURE_BY_BLOCK = new Map(
  TUTOR_STUB_AB_FEATURES.flatMap((feature) => feature.blocks.map((block) => [block, feature])),
);

export const TUTOR_STUB_AB_FEATURE_IDS = Object.freeze(TUTOR_STUB_AB_FEATURES.map((feature) => feature.id));

/** Guard keys the shared rubric can hold pinned across arms. */
export const TUTOR_STUB_AB_GUARD_KEYS = Object.freeze([
  'leak',
  'humanScaffold',
  'questionSupport',
  'dramaticRelease',
  'actorialRealization',
  'responseComposition',
  'repetition',
  'dialogueClosure',
]);

const BLOCK_PATTERN = /^\[(?<header>[^\]\n]+)\]\n(?<body>[\s\S]*?)\n\[End (?<closing>[^\]\n]+)\]$/gmu;

export function tutorStubAbFeature(id) {
  const feature = FEATURE_BY_ID.get(String(id || '').trim());
  if (!feature) throw new Error(`unknown tutor A/B feature ${id}`);
  return feature;
}

/**
 * Split a frozen final user message into its advisory blocks and the residue.
 *
 * Fails closed on an unrecognised block: silently keeping an unknown advisory
 * would let an arm report "instrumentation off" while still carrying private
 * planner context into the speaker.
 */
export function parseTutorStubAdvisoryBlocks(content) {
  const text = String(content ?? '');
  const blocks = [];
  const unknownBlocks = [];
  let residue = '';
  let cursor = 0;
  BLOCK_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(BLOCK_PATTERN)) {
    const header = match.groups.header;
    const closing = match.groups.closing;
    if (closing.toLowerCase() !== header.toLowerCase()) {
      throw new Error(`advisory block "${header}" is closed by "${closing}"`);
    }
    const feature = FEATURE_BY_BLOCK.get(header);
    if (!feature) unknownBlocks.push(header);
    residue += text.slice(cursor, match.index);
    cursor = match.index + match[0].length;
    blocks.push({
      featureId: feature?.id || null,
      header,
      body: match.groups.body,
      text: match[0],
    });
  }
  residue = `${residue}${text.slice(cursor)}`.replace(/\n{3,}/gu, '\n\n').trim();
  return { blocks, residue, unknownBlocks };
}

/**
 * Length control.
 *
 * Every advisory that lowers the failure count also lengthens the reply, and
 * several audits check for something the reply is missing, so a longer reply has
 * more room to contain it. An arm can therefore ask for a target reply length
 * and nothing else: same learner text, same system prompt, no advisory blocks,
 * one sentence naming a character count. If that arm scores like the contract
 * arm, the contract was buying length; if it scores like the bare tutor, the
 * contract was buying content.
 *
 * The directive is deliberately unbracketed. Advisory blocks are `[header]` /
 * `[End header]` delimited and `parseTutorStubAdvisoryBlocks` fails closed on an
 * unregistered header, so a bracketed length note would be indistinguishable
 * from instrumentation to anything that re-reads the projected request.
 */
function lengthDirective(chars) {
  return `Write a reply of about ${chars} characters.`;
}

/**
 * Plan control.
 *
 * The first-draft contract is the one block that moves the score, and it does
 * two things at once: it hands the speaker a plan for the turn, and it fills
 * that plan with this turn's own content — which part to play, which exhibit to
 * name, which line to quote, what limit to state. An arm carrying a plan with
 * none of that content separates the two. If it scores like the contract, the
 * gain was having a plan; if it scores like the bare tutor, the gain was ours.
 *
 * So this text is fixed. It is the same on every turn of every scenario, which
 * is what makes it content-free: it cannot carry anything about the turn it is
 * attached to. It keeps the contract's shape — an opening line naming a
 * four-sentence paragraph and its ordered slots, a voice line, one line per
 * slot, a closing rule about staying in voice — and fills it with teaching
 * advice that would be as true of any lesson on any subject.
 *
 * The closing rule is matched deliberately. Without it the control would break
 * frame and lose rules for a reason that has nothing to do with the comparison.
 *
 * It runs about 1000 characters against the contract's 1300-2800, so it is not
 * a length match. `length_target_chars` is the arm that answers length.
 *
 * Unbracketed, for the same reason as the length note: `[header]` blocks are
 * instrumentation, and `parseTutorStubAdvisoryBlocks` fails closed on a header
 * it does not know.
 */
const GENERIC_PLAN = [
  'Write one paragraph: four unlabeled, unquoted sentences, each at most 23 words. Follow OPEN > CHECK > OFFER > ASK. Never merge them.',
  'VOICE — Write to an intelligent adult beginner. Standard common words, one idea per sentence, no lists, no headings, no labels.',
  'OPEN — Take up what the learner just said, in your own words, so they can hear that they were read. Never use generic praise.',
  'CHECK — Say plainly which part of what they wrote holds and which part does not hold yet. Give the reason in the same sentence.',
  'OFFER — Give them one concrete thing to look at, weigh, or try next. Prefer something already in front of them to something new.',
  'ASK — End with one question they could answer from what they already have. One question only, and make it a real one.',
  'PACE — Do one thing per turn. A turn that does one thing well beats a turn that covers everything.',
  'Use one voice. Never announce roles, strategy, analysis, or method. Do not restate the conversation, list options, or give the answer.',
].join('\n');

export const TUTOR_STUB_AB_GENERIC_PLAN = GENERIC_PLAN;

/**
 * Due-line control — the mirror image of the plan control.
 *
 * The generic plan keeps the contract's wrapping and strips the turn's own
 * content. This keeps the one piece of content the speaker cannot infer — the
 * finding the world file opens at this turn — and strips every word of
 * wrapping. If it scores like the contract, the hidden fact alone was the gain
 * and the staging around it is dead weight; if it scores like the bare tutor,
 * the staging is doing real work beyond delivery.
 *
 * Two lines, nothing else. The first names the finding as newly open and
 * leaves the release decision with the speaker — an instruction to release
 * would be the contract's release slot back under another name. On a turn
 * where nothing is due the arm adds nothing at all, so its prompt there is
 * byte-identical to the baseline's and its quiet turns double as a
 * sampling-noise floor.
 *
 * Unbracketed, like the length note and the generic plan, and it must never
 * use the contract's slot vocabulary — a test holds it to that.
 */
const DUE_LINE_INTRO = 'Newly open to you in this inquiry — yours to bring in now, later, or hold back:';

export const TUTOR_STUB_AB_DUE_LINE_INTRO = DUE_LINE_INTRO;

/**
 * The due line for one frozen turn, or null when the world file opens nothing.
 *
 * Reads the same release frame the deterministic rules and the schedule-shown
 * judge read, and only the public surface sentence of each entry — the premise
 * ids, the concealed answer term and the learner model never enter a prompt.
 */
function dueLineFor(bundle) {
  const release = bundle?.frames?.dramaticRelease;
  if (release?.active !== true) return null;
  const surfaces = (release.entries || []).map((entry) => String(entry?.surface || '').trim()).filter(Boolean);
  if (!surfaces.length) return null;
  return [DUE_LINE_INTRO, ...surfaces.map((surface) => `- ${surface}`)].join('\n');
}

function normalizeLengthTarget(value, label) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
  return value;
}

function normalizeFeatureList(value, label) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) throw new Error(`${label} must be a list of feature ids`);
  const ids = value.map((entry) => String(entry || '').trim());
  for (const id of ids) tutorStubAbFeature(id);
  return [...new Set(ids)];
}

/**
 * Resolve an arm definition into an explicit, ordered feature selection.
 *
 * `features: all` keeps every registered feature; `features: none` keeps none.
 * An explicit list is the selection. `drop` removes from whatever was selected,
 * which is the readable way to write a single-feature ablation.
 */
export function resolveTutorStubAbArm(id, definition = {}) {
  const armId = String(id || '').trim();
  if (!armId) throw new Error('arm requires an id');
  const raw = definition.features;
  let selected;
  if (raw === undefined || raw === 'all') selected = [...TUTOR_STUB_AB_FEATURE_IDS];
  else if (raw === 'none') selected = [];
  else selected = normalizeFeatureList(raw, `arm ${armId}.features`) || [];
  const dropped = normalizeFeatureList(definition.drop, `arm ${armId}.drop`) || [];
  const kept = new Set(selected.filter((featureId) => !dropped.includes(featureId)));
  const features = TUTOR_STUB_AB_FEATURE_IDS.filter((featureId) => kept.has(featureId));
  const learnerFraming =
    definition.learner_framing === undefined ? features.length > 0 : Boolean(definition.learner_framing);
  const lengthTargetChars = normalizeLengthTarget(definition.length_target_chars, `arm ${armId}.length_target_chars`);
  if (lengthTargetChars !== null && definition.baseline) {
    throw new Error(`baseline arm ${armId} must not carry a length target`);
  }
  const genericPlan = definition.generic_plan === true;
  if (genericPlan && definition.baseline) {
    throw new Error(`baseline arm ${armId} must not carry a generic plan`);
  }
  // A generic plan beside the real one is not a control of anything: the
  // speaker would hold two plans naming different slots for the same paragraph.
  if (genericPlan && features.includes('first_draft_contract')) {
    throw new Error(`arm ${armId} cannot carry the generic plan and the first-draft contract together`);
  }
  const dueLine = definition.due_line === true;
  if (dueLine && definition.baseline) {
    throw new Error(`baseline arm ${armId} must not carry the due line`);
  }
  // The contract's release slot already carries this turn's finding; a second
  // copy in a second voice is not an ablation of anything.
  if (dueLine && features.includes('first_draft_contract')) {
    throw new Error(`arm ${armId} cannot carry the due line and the first-draft contract together`);
  }
  return {
    schema: AB_ARM_SCHEMA,
    id: armId,
    label: String(definition.label || armId),
    summary: String(definition.summary || ''),
    baseline: Boolean(definition.baseline),
    features,
    lengthTargetChars,
    genericPlan,
    dueLine,
    omitted: TUTOR_STUB_AB_FEATURE_IDS.filter((featureId) => !kept.has(featureId)),
    learnerFraming,
    guardsClaimed: [...new Set(features.flatMap((featureId) => tutorStubAbFeature(featureId).guards))].sort(),
  };
}

/**
 * Project a frozen request down to one arm's feature selection.
 *
 * The system prompt, the public message prefix, and the learner utterance are
 * invariant. Only the advisory blocks in the final user message vary.
 */
export function projectTutorStubAbRequest({ bundle, arm } = {}) {
  if (!bundle?.request?.messages?.length) throw new Error('A/B request projection requires a frozen bundle request');
  if (!arm?.features) throw new Error('A/B request projection requires a resolved arm');
  const messages = structuredClone(bundle.request.messages);
  const latest = messages.at(-1);
  if (!latest || latest.role !== 'user') throw new Error('frozen request does not end in a user message');
  const parsed = parseTutorStubAdvisoryBlocks(latest.content);
  if (parsed.unknownBlocks.length) {
    throw new Error(`frozen request carries unregistered advisory blocks: ${parsed.unknownBlocks.join(', ')}`);
  }
  const keep = new Set(arm.features);
  const retained = parsed.blocks.filter((block) => keep.has(block.featureId));
  const learnerText = String(bundle.learnerText || '').trim();
  const residue = arm.learnerFraming ? parsed.residue || `Learner says:\n${learnerText}` : learnerText;
  // The length note sits where the advisory blocks sit, ahead of the learner
  // text, so position is not one of the things that varies between arms.
  const lengthTargetChars = arm.lengthTargetChars ?? null;
  const directive = lengthTargetChars === null ? null : lengthDirective(lengthTargetChars);
  // Same position as the real plan it stands in for, ahead of the learner text.
  const genericPlan = arm.genericPlan === true ? GENERIC_PLAN : null;
  // Null on a quiet turn, so the arm's prompt there is the baseline's prompt.
  const dueLine = arm.dueLine === true ? dueLineFor(bundle) : null;
  const content = [directive, genericPlan, dueLine, ...retained.map((block) => block.text), residue]
    .filter(Boolean)
    .join('\n\n');
  latest.content = content;
  return {
    schema: AB_REQUEST_PROJECTION_SCHEMA,
    armId: arm.id,
    systemPrompt: bundle.request.systemPrompt,
    messages,
    latest,
    history: messages.slice(0, -1),
    presentFeatures: parsed.blocks.map((block) => block.featureId).filter(Boolean),
    retainedFeatures: retained.map((block) => block.featureId),
    strippedFeatures: parsed.blocks
      .map((block) => block.featureId)
      .filter((featureId) => featureId && !keep.has(featureId)),
    requestedFeatures: [...arm.features],
    learnerFraming: arm.learnerFraming,
    lengthTargetChars,
    genericPlan: genericPlan !== null,
    dueLine: dueLine !== null,
    // Kept out of advisoryChars: neither the length note nor the generic plan
    // carries any planner content, and folding either in would make a control
    // look mildly instrumented in reports. The due line does carry one piece of
    // planner content, so it gets its own count rather than hiding in either.
    lengthDirectiveChars: directive ? directive.length : 0,
    genericPlanChars: genericPlan ? genericPlan.length : 0,
    dueLineChars: dueLine ? dueLine.length : 0,
    advisoryChars: retained.reduce((total, block) => total + block.text.length, 0),
    requestChars: content.length,
  };
}

/**
 * The guard set the shared rubric runs for every arm.
 *
 * Pinning to the reference bundle is what makes the comparison meaningful: an
 * arm that drops the evidence window is still judged on whether it leaked.
 * `repetition` is excluded when the frozen prefix carries no prior tutor text,
 * because the source run could not have enabled it either.
 */
export function resolveTutorStubAbGuardSet(referenceGuards = {}) {
  const pinned = { enabled: false };
  for (const key of TUTOR_STUB_AB_GUARD_KEYS) pinned[key] = referenceGuards?.[key] === true;
  pinned.enabled = TUTOR_STUB_AB_GUARD_KEYS.some((key) => pinned[key]);
  return pinned;
}

export function describeTutorStubAbFeatures() {
  return TUTOR_STUB_AB_FEATURES.map((feature) => ({
    id: feature.id,
    label: feature.label,
    summary: feature.summary,
    blocks: [...feature.blocks],
    guards: [...feature.guards],
  }));
}
