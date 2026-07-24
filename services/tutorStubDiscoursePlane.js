export const TUTOR_STUB_DISCOURSE_PLANE_SCHEMA = 'machinespirits.tutor-stub.discourse-plane.v1';

const DISCOURSE_PLANES = new Set(['object', 'instructional_meta', 'mixed']);
const META_REQUEST_TYPES = new Set(['plain_language_request', 'plain_simplification_followup']);
const META_LANGUAGE_PATTERN =
  /\b(?:clarif(?:y|ication)|explain|follow(?:ing)?|mean(?:ing)?|plain(?:er)?|rephras(?:e|ing)|restate|simpl(?:e|er|ify|ification)|translate|understand|word(?:ing|s)?)\b/iu;
const INSTRUCTIONAL_FORM_PATTERN =
  /\b(?:explanation|instructions?|language|phrasing|sentence|wording|words?|what\s+you\s+(?:mean|said|wrote)|your\s+(?:answer|explanation|point|reply|response|wording))\b/iu;
const NATURAL_META_REQUEST_PATTERN =
  /\b(?:can|could|would|will)\s+(?:you|we)\b[^.!?]{0,90}\b(?:rephras|restat|simpl|translat)\w*\b|\b(?:can|could|would|will)\s+you\b[^.!?]{0,40}\b(?:clarif|explain|unpack)\w*\s+(?:that|this|it|what\s+you\s+(?:mean|said|wrote)|your\s+(?:answer|explanation|point|reply|response|wording)|the\s+(?:explanation|language|phrasing|sentence|wording))\b|\bi\s+(?:am|[’']m)\s+not\s+following(?:\s+(?:that|this|it|what\s+you\s+(?:mean|said|wrote)|your\s+(?:explanation|point|reply|wording)|the\s+(?:explanation|language|wording)))?(?=[.!?]|$)|\bi\s+(?:do not|don[’']t)\s+understand(?:\s+(?:that|this|it|what\s+you\s+(?:mean|said|wrote)|your\s+(?:explanation|point|reply|wording)|the\s+(?:explanation|language|wording)))?(?=[.!?]|$)|\bwhat\s+does\b[^.!?]{1,100}\bmean\b|\b(?:say|put)\s+(?:that|this|it)\s+in\s+(?:plain|simpler)\s+(?:language|words)\b|\bsimpl(?:ify|er)\b[^.!?]{0,50}\b(?:explanation|language|wording|words)\b/iu;

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function controlledPlane(value) {
  const normalized = oneLine(value)
    .toLowerCase()
    .replace(/[\s-]+/gu, '_');
  return DISCOURSE_PLANES.has(normalized) ? normalized : null;
}

function instructionalMetaTarget(learnerText = '') {
  const text = oneLine(learnerText);
  const quoted = text.match(/[“"]([^”"]{1,100})[”"]/u)?.[1] || text.match(/[‘']([^’']{1,100})[’']/u)?.[1];
  if (quoted && !META_LANGUAGE_PATTERN.test(quoted)) {
    return { kind: 'named_phrase', surface: oneLine(quoted), source: 'learner_quote' };
  }
  const meaning = text.match(/\bwhat\s+does\s+(.{1,100}?)\s+mean\b/iu)?.[1];
  if (meaning) return { kind: 'named_phrase', surface: oneLine(meaning), source: 'meaning_question' };
  const named = text.match(/\b(?:explain|rephrase|restate|translate)\s+(.{1,100}?)(?:[?.!]|$)/iu)?.[1];
  if (named && !/^(?:it|that|this|again)$/iu.test(oneLine(named))) {
    return { kind: 'named_phrase', surface: oneLine(named), source: 'learner_request' };
  }
  return { kind: 'latest_tutor_turn', surface: null, source: 'dialogue_context' };
}

/**
 * Resolve whether the learner is contributing to the inquiry itself or asking
 * for a repair to the current explanation. The deterministic result is
 * authoritative: model output is evidence for the classification, not a
 * licence to reinterpret a wording request as a proof proposition.
 */
export function resolveTutorStubDiscoursePlane({ learnerText = '', classification = null, sideArc = null } = {}) {
  const turn = classification?.turn || {};
  const requestedPlane = controlledPlane(turn.discourse_plane || turn.discoursePlane);
  const requestType = oneLine(turn.request_type);
  const discourseMove = oneLine(turn.discourse_move);
  const evidenceUse = oneLine(turn.evidence_use);
  const sideArcType = oneLine(sideArc?.type || turn?.human_discourse?.side_arc?.type);
  const naturalMetaRequest = NATURAL_META_REQUEST_PATTERN.test(learnerText);
  const surfaceMetaVisible = Boolean(naturalMetaRequest || INSTRUCTIONAL_FORM_PATTERN.test(learnerText));
  const classifiedMetaRequest = Boolean(
    META_REQUEST_TYPES.has(requestType) ||
    ['instructional_meta', 'mixed'].includes(requestedPlane) ||
    sideArcType === 'clarification_or_plain_language' ||
    discourseMove === 'repair_request',
  );
  const metaSignal = Boolean(naturalMetaRequest || (classifiedMetaRequest && surfaceMetaVisible));
  const objectContribution = Boolean(
    evidenceUse &&
    evidenceUse !== 'none' &&
    !['repeats_setup'].includes(evidenceUse) &&
    ['claim', 'hypothesis', 'inference', 'evidence_adoption'].includes(discourseMove),
  );
  const plane = metaSignal
    ? objectContribution || requestedPlane === 'mixed'
      ? 'mixed'
      : 'instructional_meta'
    : 'object';
  const proofEffect = plane === 'instructional_meta' ? 'none' : 'candidate';
  return {
    schema: TUTOR_STUB_DISCOURSE_PLANE_SCHEMA,
    plane,
    meta_target: plane === 'object' ? null : instructionalMetaTarget(learnerText),
    proof_effect: proofEffect,
    freeze_learner_dag: proofEffect === 'none',
    freeze_clue_release: proofEffect === 'none',
    reason:
      plane === 'instructional_meta'
        ? 'The learner is asking for a repair to the explanation, not contributing a proposition to the inquiry.'
        : plane === 'mixed'
          ? 'The turn combines an instructional repair request with an object-level contribution.'
          : 'The turn is directed at the subject matter or inquiry itself.',
    signals: {
      requested_plane: requestedPlane,
      request_type: requestType || null,
      discourse_move: discourseMove || null,
      evidence_use: evidenceUse || null,
      side_arc_type: sideArcType || null,
      surface_meta_visible: surfaceMetaVisible,
      meta_language_visible: metaSignal,
      object_contribution_visible: objectContribution,
    },
  };
}

/**
 * An instructional repair cannot mutate the public proof record. Preserve the
 * extractor provenance and its side-arc description, but neutralize every
 * proof-changing field before the trusted learner-record applier sees it.
 */
export function freezeTutorStubLearnerRecordUpdateForDiscoursePlane({ update = null, discoursePlane = null } = {}) {
  if (discoursePlane?.freeze_learner_dag !== true) return update;
  const source = update && typeof update === 'object' && !Array.isArray(update) ? update : {};
  const humanDiscourse = source.human_discourse || source.humanDiscourse || {};
  const sideArc = humanDiscourse.side_arc || humanDiscourse.sideArc || {};
  const frozenHumanDiscourse = {
    ...humanDiscourse,
    proof_status: 'side_arc',
    proofStatus: 'side_arc',
    side_arc: {
      ...sideArc,
      detected: true,
      type: 'instructional_meta',
      reason: discoursePlane.reason,
    },
  };
  return {
    ...source,
    adopt: [],
    retract: [],
    derive: [],
    hypothesis: null,
    assert_answer: null,
    assertAnswer: null,
    human_discourse: frozenHumanDiscourse,
    humanDiscourse: frozenHumanDiscourse,
    discourse_plane: structuredClone(discoursePlane),
    proof_update_suppressed: true,
  };
}
