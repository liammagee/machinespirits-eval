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
  return {
    schema: AB_ARM_SCHEMA,
    id: armId,
    label: String(definition.label || armId),
    summary: String(definition.summary || ''),
    baseline: Boolean(definition.baseline),
    features,
    lengthTargetChars,
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
  const content = [directive, ...retained.map((block) => block.text), residue].filter(Boolean).join('\n\n');
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
    // Kept out of advisoryChars: the length note carries no planner content, and
    // folding it in would make the control look mildly instrumented in reports.
    lengthDirectiveChars: directive ? directive.length : 0,
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
