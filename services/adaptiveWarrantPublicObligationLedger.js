/**
 * Persistent public-obligation ledger for the adaptive warrant gate.
 *
 * Action-family contracts describe the uptake expected after a tutor move.
 * This ledger describes a different normative object: a concrete public result
 * the learner has asked the tutor to supply. The debt survives action-family
 * changes and can be discharged only by a target-matching answer, a valid
 * accountable deferral, transfer, or withdrawal.
 *
 * All observations are derived from public surface text and delivered public
 * evidence. Controlled classifier labels may corroborate a surface act, but
 * never create an obligation by themselves.
 */

export const ADAPTIVE_WARRANT_PUBLIC_SPEECH_ACT_SCHEMA = 'machinespirits.adaptation-refinement.public-speech-act.v1';
export const ADAPTIVE_WARRANT_PUBLIC_OBLIGATION_SCHEMA = 'machinespirits.adaptation-refinement.public-obligation.v1';
export const ADAPTIVE_WARRANT_PUBLIC_OBLIGATION_LEDGER_SCHEMA =
  'machinespirits.adaptation-refinement.public-obligation-ledger.v1';
export const ADAPTIVE_WARRANT_PUBLIC_OBLIGATION_DELIVERY_SCHEMA =
  'machinespirits.adaptation-refinement.public-obligation-delivery.v1';

const EVIDENCE_CUE =
  /\b(?:assay|balance|clue|comparison|dies?|entry|evidence|exhibit|fact|flaw|graver|line|link|log|mark|match|metal|reading|record|result|ring|sample|shilling|test|tool|touchstone|trace|weight|witness)\b/iu;
const LEARNER_PROPOSAL =
  /(?:\b(?:i (?:can|could|intend to|propose|should|want to|will|would)|i['’]d|i['’]ll|let me|my (?:first|next) (?:move|step|test)|we (?:can|could|should|will|would))\b.{0,100}\b(?:check|compare|enter|examine|inspect|listen|look|record|test|weigh)\b|\b(?:let['’]?s|let us|(?:can|could|may|might|should|would) (?:i|we))\s+(?:first\s+)?(?:check|compare|enter|examine|inspect|listen|look|record|test|weigh)\b|\bi want\b.{0,80}\b(?:checked|compared|entered|examined|inspected|recorded|tested|weighed)\b)/iu;
const DIRECTED_TEST_PROPOSAL =
  /(?:^|[.!?;]\s*)(?:(?:can|could|will|would) you\s+(?:please\s+)?|please\s+)?(?:check|compare|examine|inspect|test|weigh)\b/iu;
const DIRECTED_TEST_RESULT_CLAUSE =
  /\b(?:if|whether)\b.{0,90}\b(?:finds?|found|indicates?|matches?|reads?|records?|reveals?|says?|shows?|weighs?)\b/iu;
const RESULT_REQUEST =
  /(?:\bread (?:it|that|this) aloud\b|\bwhat(?:['’]s| is) (?:the )?(?:next )?(?:clue|evidence|exhibit|result)\b|\bwhat (?:did|do|does|is|was|were)\b.{0,90}\b(?:leave|mark|match|read|record|reveal|say|show|weigh)\b|\bwhat (?:is|was) (?:the )?[^.!?]{0,70}\b(?:entry|line|log|reading|record|trace)\b|\bwhat (?:[a-z-]+ ){0,3}(?:evidence|mark|match|reading|record|result|trace)\b|(?:^|[.!?]\s*)\b(?:do|does|did|is|was|were)\b.{0,90}\b(?:match|recorded|show)\b|(?:^|[.!?]\s*)\bhas\b.{0,90}\b(?:been )?(?:entered|recorded|shown|supplied)\b|\b(?:can|could|will|would) you\b.{0,100}\b(?:check|give|identify|provide|read|record|report|show|supply|tell)\b|\bplease\b.{0,80}\b(?:check|enter|give|identify|provide|read|record|report|show|supply|tell)\b|(?:^|[.!?]\s*)\b(?:check|enter|give|identify|provide|read|record|report|show|supply|tell)\b)/iu;
const DIRECTED_RESULT_CLAUSE =
  /(?:^|[;.!?]\s*)(?:what(?:['’]s| is) (?:the )?(?:next )?(?:clue|evidence|exhibit|result)\b|what\b.{0,80}\b(?:did|do|does|is|was|were|leave|mark|match|read|record|reveal|say|show|weigh)\b|has\b.{0,90}\b(?:been )?(?:entered|recorded|shown|supplied)\b|(?:can|could|will|would) you\b|please\b|(?:check|enter|give|identify|provide|read|record|report|show|supply|tell)\b)/iu;
const CRITERION_QUESTION =
  /(?:\bwhat (?:public )?(?:evidence|exhibit|fact|mark|result|test) (?:can|could|might|would)\b.{0,100}\b(?:establish|identify|link|place|prove|put|show|tie)\b|\bwhat (?:could|might|should|would) (?:the )?(?:next )?(?:clue|evidence|exhibit|result|test) need to\b.{0,60}\b(?:establish|identify|link|place|prove|put|show|tie)\b)/iu;
const INTERPRETATION_QUESTION =
  /\bwhat\b.{0,60}\b(?:evidence|exhibit|fact|mark|reading|record|result|trace|weight)\b.{0,40}\bmean(?:s|ing)?\b/iu;
const SELECTION_QUESTION =
  /(?:\b(?:what|which)\b.{0,80}\b(?:(?:should|would|could|can|do) (?:i|we)|(?:i|we) (?:should|would|could|can)|(?:first|next))|\b(?:can|could|will|would) you\s+choose\s+which\b|\b(?:(?:can|could|will|would) you\s+|please\s+)?(?:choose|tell) me\b.{0,70}(?:\bwhat to\s+(?:check|compare|examine|inspect|test|weigh)\s+(?:first|next)\b|\bthe\s+(?:first|next)\s+(?:check|comparison|exhibit|test)\b))\s*[.?!]*$/iu;
const TUTOR_SELECTION_DIRECTIVE = /\b(?:can|could|will|would) you\s+(?:please\s+)?choose\s+(?:which|what)\b/iu;
const WORDING_REQUEST =
  /(?:\b(?:can|could|will|would) you\b.{0,70}\b(?:give|provide|show|tell) me\b.{0,30}\b(?:exact|first|next|opening)?\s*(?:line|phrase|sentence|wording)\b|\b(?:give|provide|show|tell) me\b.{0,30}\b(?:exact|first|next|opening)?\s*(?:line|phrase|sentence|wording)\b|\bhow (?:can|could|should|would) i\b.{0,55}\b(?:phrase|say|state|word|write)\b)/iu;
const LEARNER_RECORD_ENTRY_REQUEST =
  /\b(?:(?:can|could|will|would) you\s+(?:please\s+)?|do you want me to\s+|(?:can|could|may|should|would) i\s+|i['’]ll\s+|i will\s+|i can\s+|let me\s+)(?:add|enter|include|note|put|record|write)\s+(?:only\s+)?(?:that|this)\b/iu;
const WITHDRAWAL = /\b(?:disregard that|forget that|never mind(?: that)?|withdraw (?:that|the request))\b/iu;
const TRANSFER =
  /\b(?:i(?:['’]ll| will) (?:check|compare|inspect|test) .{0,60}? myself|leave .{0,60}?(?:comparison|test) to me)\b/iu;
const UNAVAILABLE_RESULT =
  /\b(?:cannot|can['’]t|no|not|nothing|unavailable|unknown|unrecorded|unshown)\b.{0,45}\b(?:answer|comparison|evidence|entry|match|reading|record|result|yet)\b|\b(?:answer|comparison|evidence|entry|match|reading|record|result)\b.{0,35}\b(?:cannot|can['’]t|missing|not (?:available|public|recorded|shown)|unavailable|unknown|yet)\b/iu;
const CONCRETE_NEXT_STEP =
  /\b(?:after|at|by|once|until|when)\b.{0,80}\b(?:available|check|compare|enter|examine|inspect|public|record|release|released|test|turn)\b|\bnext (?:public )?(?:clue|comparison|exhibit|step|test|turn)\b/iu;
const ANSWER_RELATION =
  /\b(?:establishes?|finds?|found|indicates?|indicated|leaves?|left|matches?|matched|reads?|reveals?|revealed|shows?|showed|sounds?|sounded|weighs?|weighed)\b\s+([^.!?]{1,120})/iu;
const COPULAR_RESULT_RELATION =
  /\b(?:comparison|entry|mark|match|reading|record|result|test|weight)\s+(?:is|was|reads?)\s+([^.!?]{1,120})/iu;
const NON_ANSWER_VALUE_TERMS = new Set(
  'checking comparison concern evidence issue matter question record relation result test thing topic unknown worth'.split(
    ' ',
  ),
);

const TARGET_METHOD_TERMS = new Set(
  'alloy assay balance check compare comparison cupel date dates die dross evidence entry examine exhibit fact flaw graver inspect link log mark match material metal name names public reading record result ring sample shilling show silver sound sounds test tie time times tool touchstone trace weigh weighing weight witness'.split(
    ' ',
  ),
);

const TARGET_STOPWORDS = new Set(
  'about activity actual after and answer any anyone are available been before can condition could current did distinctive do does evidence establish established establishes first for from give has have how into its last leave line may might more need needed next not now only once our please prove proves public question record release released report result reveal revealed reveals say says should show showed showing shows some somebody someone still than that the their them then there these they this those through under until was were what when where which while who will with would write you your tell tells'.split(
    ' ',
  ),
);

const TARGET_TERM_ALIASES = Object.freeze({
  clipped: 'clip',
  clipping: 'clip',
  comparisons: 'comparison',
  dies: 'die',
  entries: 'entry',
  exhibits: 'exhibit',
  marks: 'mark',
  matched: 'match',
  matches: 'match',
  matching: 'match',
  readings: 'reading',
  records: 'record',
  results: 'result',
  samples: 'sample',
  tests: 'test',
  tools: 'tool',
  traces: 'trace',
  tying: 'tie',
  weighed: 'weigh',
  weighing: 'weigh',
  weights: 'weight',
  witnesses: 'witness',
});

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function classificationTurn(classification) {
  return classification?.turn || classification?.classifier || classification || {};
}

function contentTerms(value) {
  const rawTerms =
    oneLine(value)
      .toLowerCase()
      .match(/\b[a-z](?:[a-z0-9]|-(?=[a-z0-9])){2,}\b/gu) || [];
  return [
    ...new Set(
      rawTerms
        .flatMap((term) => [term, ...term.split('-').filter((part) => /^[a-z]{3,}$/u.test(part))])
        .filter((term) => term && !term.endsWith('-') && !TARGET_STOPWORDS.has(term))
        .map((term) => TARGET_TERM_ALIASES[term] || term),
    ),
  ];
}

function targetKind(surface) {
  const lower = surface.toLowerCase();
  if (/\b(?:alloy|assay|cupel|metal|silver|touchstone)\b/u.test(lower)) return 'material_or_assay_result';
  if (/\b(?:balance|ring|sound|weight|weigh)\b/u.test(lower)) return 'weight_or_ring_result';
  if (/\b(?:compare|comparison|cross-exhibit|link|match|tie)\b/u.test(lower)) return 'comparison_result';
  if (/\b(?:die|flaw|graver|mark|tool|cut)\b/u.test(lower)) return 'mark_or_tool_result';
  if (/\b(?:entry|log|record|witness)\b/u.test(lower)) return 'record_entry';
  return 'public_exhibit_result';
}

function targetSubjectTerms(publicTerms) {
  return contentTerms((publicTerms || []).join(' '))
    .filter((term) => !TARGET_METHOD_TERMS.has(term))
    .slice(0, 6);
}

function requiredTargetComponents(surface, kind) {
  if (kind !== 'weight_or_ring_result') return [];
  const lower = surface.toLowerCase();
  return [
    /\b(?:balance|weight|weigh|weighing|reading)\b/u.test(lower)
      ? { id: 'weight_reading', terms: ['balance', 'weight', 'weigh', 'weighing', 'reading'] }
      : null,
    /\b(?:ring|sound)\b/u.test(lower) ? { id: 'ring_sound', terms: ['ring', 'sound'] } : null,
  ].filter(Boolean);
}

function publicTarget(surface) {
  const kind = targetKind(surface);
  const publicTerms = contentTerms(surface).slice(0, 16);
  const subjectTerms = targetSubjectTerms(publicTerms);
  return {
    kind,
    // Method synonyms are already collapsed by `kind`; the signature keeps
    // only public subject terms so reminders such as "balance result" and
    // "weight reading" coalesce without merging two differently named items.
    signature: `${kind}:${subjectTerms.slice(0, 4).sort().join('|') || 'generic'}`,
    public_terms: publicTerms,
    subject_terms: subjectTerms,
    required_components: requiredTargetComponents(surface, kind),
    source_surface: oneLine(surface),
  };
}

function semanticPublicTarget(target) {
  if (!target) return null;
  const kind = String(target.kind || 'public_exhibit_result');
  const targetId = String(target.target_id || '').trim();
  const publicIdentifierIds = [...new Set((target.public_identifier_ids || []).map(String))].sort();
  const publicTerms = contentTerms([targetId, ...publicIdentifierIds].join(' '))
    .filter(
      (term) =>
        !term.startsWith('target-') &&
        !term.startsWith('public-id-') &&
        !['target', 'public', 'id'].includes(term),
    )
    .slice(0, 16);
  const subjectTerms = targetSubjectTerms(publicTerms);
  const valueComponents = (target.requested_value_types || []).map((valueType) => ({
    id: `requested_${String(valueType)}`,
    terms: [String(valueType)],
    value_type: String(valueType),
  }));
  const declaredComponents = (target.component_ids || []).map((component) => ({
    id: String(component),
    terms: [],
  }));
  if (targetId === 'unspecified') {
    return {
      kind: 'public_exhibit_result',
      signature: 'public_exhibit_result:generic_evidence_request',
      target_id: null,
      catalogue_target_named: false,
      public_identifier_ids: [],
      public_terms: ['evidence'],
      subject_terms: [],
      requested_value_types: [...new Set((target.requested_value_types || []).map(String))],
      required_components: mergeRequiredComponents(valueComponents, declaredComponents),
      source_surface: 'generic evidence request',
      semantic_target: clone(target),
    };
  }
  return {
    kind,
    signature: `${kind}:${targetId}`,
    target_id: targetId,
    catalogue_target_named: true,
    public_identifier_ids: publicIdentifierIds,
    public_terms: publicTerms,
    subject_terms: subjectTerms,
    requested_value_types: [...new Set((target.requested_value_types || []).map(String))],
    required_components: mergeRequiredComponents(valueComponents, declaredComponents),
    source_surface: targetId,
    semantic_target: clone(target),
  };
}

function speechActFromSemanticEvents({ learnerText = '', classification = null, semanticEventExtraction } = {}) {
  if (!semanticEventExtraction) return null;
  const accepted = (semanticEventExtraction.events || []).filter((event) => event?.validation?.status === 'accepted');
  const disposition = accepted.find((event) => ['withdrawal', 'transfer_to_learner'].includes(event.speech_act));
  const precedence = [
    'tutor_directed_public_result_request',
    'learner_proposed_test',
    'criterion_question',
    'tutor_selection_request',
    'learner_record_entry_request',
    'learner_wording_request',
    'withdrawal',
    'transfer_to_learner',
  ];
  const selected = precedence.map((kind) => accepted.find((event) => event.speech_act === kind)).find(Boolean) || null;
  const kind = selected?.speech_act || 'other';
  return {
    schema: ADAPTIVE_WARRANT_PUBLIC_SPEECH_ACT_SCHEMA,
    kind,
    creates_obligation: kind === 'tutor_directed_public_result_request',
    target: semanticPublicTarget(selected?.target || null),
    surface: oneLine(learnerText) || null,
    prior_obligation_disposition: disposition?.speech_act || null,
    corroborating_classifier_move: classificationTurn(classification).discourse_move || null,
    semantic_event_ids: accepted.map((event) => event.event_id),
    semantic_extraction_status: semanticEventExtraction.extraction_status || null,
  };
}

function publicSpeechClauses(surface) {
  return oneLine(surface)
    .split(/(?<=[.!?;])\s+/u)
    .map(oneLine)
    .filter(Boolean);
}

function directedResultRequestSurface(surface) {
  const clauses = publicSpeechClauses(surface);
  return (
    clauses
      .filter(
        (clause) =>
          EVIDENCE_CUE.test(clause) &&
          RESULT_REQUEST.test(clause) &&
          !CRITERION_QUESTION.test(clause) &&
          !INTERPRETATION_QUESTION.test(clause) &&
          !SELECTION_QUESTION.test(clause),
      )
      .at(-1) || null
  );
}

function mergeRequiredComponents(left = [], right = []) {
  const byId = new Map();
  for (const component of [...left, ...right]) {
    if (component?.id && !byId.has(component.id)) byId.set(component.id, clone(component));
  }
  return [...byId.values()];
}

function targetsEquivalent(left, right) {
  if (!left || !right || left.kind !== right.kind) return false;
  if (left.signature === right.signature) return true;
  const leftSubjects = new Set(left.subject_terms || targetSubjectTerms(left.public_terms || []));
  const rightSubjects = new Set(right.subject_terms || targetSubjectTerms(right.public_terms || []));
  if (!leftSubjects.size || !rightSubjects.size) return leftSubjects.size === rightSubjects.size;
  return leftSubjects.size === rightSubjects.size && [...leftSubjects].every((term) => rightSubjects.has(term));
}

const REFERENTIAL_REMINDER_CUE = /\b(?:again|it|matching|same|still|that|this|those|when (?:it|that)|yet)\b/iu;

function targetKindNamedInSurface(kind, surface) {
  const source = oneLine(surface).toLowerCase();
  if (kind === 'weight_or_ring_result') return /\b(?:balance|ring|sound|weight|weigh)\b/u.test(source);
  if (kind === 'material_or_assay_result') {
    return /\b(?:alloy|assay|cupel|dross|metal|silver|touchstone)\b/u.test(source);
  }
  if (kind === 'mark_or_tool_result') return /\b(?:die|flaw|graver|mark|tool|cut)\b/u.test(source);
  if (kind === 'comparison_result') return /\b(?:compare|comparison|link|match|tie)\b/u.test(source);
  if (kind === 'record_entry') return /\b(?:entry|log|record|witness)\b/u.test(source);
  return EVIDENCE_CUE.test(source);
}

function referentialReminderCandidate(rows, speechAct) {
  const target = speechAct?.target;
  const targetSubjects = target?.subject_terms || targetSubjectTerms(target?.public_terms || []);
  if (targetSubjects.length || !REFERENTIAL_REMINDER_CUE.test(speechAct?.surface || '')) return null;

  const surfaceTerms = new Set(contentTerms(speechAct.surface));
  const candidates = rows
    .filter(
      (row) =>
        ['open', 'overdue', 'reactivated', 'deferred'].includes(row.status) &&
        targetKindNamedInSurface(row.target?.kind, speechAct.surface),
    )
    .map((row) => {
      const subjects = row.target?.subject_terms || targetSubjectTerms(row.target?.public_terms || []);
      return {
        row,
        overlap: subjects.filter((term) => surfaceTerms.has(term)).length,
      };
    })
    .filter(({ overlap }) => overlap > 0)
    .sort((left, right) => right.overlap - left.overlap || blockingOrder(left.row, right.row));

  if (!candidates.length) return null;
  if (candidates.length > 1 && candidates[0].overlap === candidates[1].overlap) return null;
  return candidates[0].row;
}

/**
 * Classify the learner's public speech act. Surface patterns are deliberately
 * precision-first: a plan to perform a test is not a request that the tutor
 * provide its result.
 */
export function classifyAdaptiveWarrantPublicSpeechAct({
  learnerText = '',
  classification = null,
  semanticEventExtraction = null,
} = {}) {
  const semanticAct = speechActFromSemanticEvents({ learnerText, classification, semanticEventExtraction });
  if (semanticAct) return semanticAct;
  const surface = oneLine(learnerText);
  const turn = classificationTurn(classification);
  const withdrawalMatch = surface.match(WITHDRAWAL);
  const transferMatch = withdrawalMatch ? null : surface.match(TRANSFER);
  const priorObligationDisposition = withdrawalMatch ? 'withdrawal' : transferMatch ? 'transfer_to_learner' : null;
  const dispositionMatch = withdrawalMatch || transferMatch;
  const operativeSurface = dispositionMatch
    ? oneLine(
        surface.slice(Number(dispositionMatch.index || 0) + dispositionMatch[0].length).replace(/^[,;:!?.\s-]+/u, ''),
      )
    : surface;
  const base = {
    schema: ADAPTIVE_WARRANT_PUBLIC_SPEECH_ACT_SCHEMA,
    kind: 'other',
    creates_obligation: false,
    target: null,
    surface: surface || null,
    prior_obligation_disposition: priorObligationDisposition,
    corroborating_classifier_move: turn.discourse_move || null,
  };
  if (!surface) return base;
  if (!operativeSurface && priorObligationDisposition) {
    const dispositionTarget = EVIDENCE_CUE.test(dispositionMatch?.[0] || '') ? publicTarget(dispositionMatch[0]) : null;
    return { ...base, kind: priorObligationDisposition, target: dispositionTarget };
  }

  const directedResultSurface = directedResultRequestSurface(operativeSurface);
  const recordEntryMatch = operativeSurface.match(LEARNER_RECORD_ENTRY_REQUEST);
  const directedResultStart = directedResultSurface ? operativeSurface.lastIndexOf(directedResultSurface) : -1;
  const recordEntryEnd = recordEntryMatch ? Number(recordEntryMatch.index || 0) + recordEntryMatch[0].length : -1;
  const laterDirectedResultClause = directedResultStart >= 0 && directedResultStart > recordEntryEnd;

  // A criterion question asks what kind of evidence would establish a link;
  // it is not yet asking the tutor to supply a completed test result.
  if (
    EVIDENCE_CUE.test(operativeSurface) &&
    (CRITERION_QUESTION.test(operativeSurface) || INTERPRETATION_QUESTION.test(operativeSurface))
  ) {
    return { ...base, kind: 'criterion_question', target: publicTarget(operativeSurface) };
  }
  if (
    EVIDENCE_CUE.test(operativeSurface) &&
    (TUTOR_SELECTION_DIRECTIVE.test(operativeSurface) || SELECTION_QUESTION.test(operativeSurface))
  ) {
    return { ...base, kind: 'tutor_selection_request', target: publicTarget(operativeSurface) };
  }
  // A request to enter the learner's explicit proposition in the shared
  // record is a writable public act, not a request that the tutor discover or
  // reveal an unknown result. Keep this before RESULT_REQUEST, whose general
  // "could you record" branch intentionally covers requests for missing data.
  if (recordEntryMatch && !laterDirectedResultClause) {
    return { ...base, kind: 'learner_record_entry_request', target: null };
  }
  // Requests for copyable wording about an already-public statement are not
  // requests that the tutor perform or reveal a new evidence-producing test.
  // Keep them out of the cross-turn result-debt ledger even when the quoted
  // sentence contains words such as "record", "evidence", or "line".
  if (WORDING_REQUEST.test(operativeSurface)) {
    return { ...base, kind: 'learner_wording_request', target: null };
  }

  // A direct result clause wins over an earlier proposal in the same turn:
  // “I would compare the dies; has a match been recorded?” contains both acts
  // and the second one creates a public tutor obligation.
  const proposal = EVIDENCE_CUE.test(operativeSurface) && LEARNER_PROPOSAL.test(operativeSurface);
  const directedTestProposal =
    EVIDENCE_CUE.test(operativeSurface) &&
    DIRECTED_TEST_PROPOSAL.test(operativeSurface) &&
    !DIRECTED_TEST_RESULT_CLAUSE.test(operativeSurface);
  const resultRequest =
    Boolean(directedResultSurface) || (EVIDENCE_CUE.test(operativeSurface) && RESULT_REQUEST.test(operativeSurface));
  if (resultRequest && !directedTestProposal && (!proposal || DIRECTED_RESULT_CLAUSE.test(operativeSurface))) {
    return {
      ...base,
      kind: 'tutor_directed_public_result_request',
      creates_obligation: true,
      target: publicTarget(directedResultSurface || operativeSurface),
    };
  }
  if (proposal || directedTestProposal) {
    return { ...base, kind: 'learner_proposed_test', target: publicTarget(operativeSurface) };
  }
  return priorObligationDisposition
    ? {
        ...base,
        kind: priorObligationDisposition,
        target: EVIDENCE_CUE.test(operativeSurface) ? publicTarget(operativeSurface) : null,
      }
    : base;
}

function targetTermsMatch(target, text, { kindFallback = true } = {}) {
  if (target?.catalogue_target_named === false) return EVIDENCE_CUE.test(oneLine(text));
  const terms = new Set(contentTerms(text));
  const subjectTerms = target?.subject_terms || targetSubjectTerms(target?.public_terms || []);
  // A named target must remain named. Kind-level words such as "match" or
  // "comparison" cannot discharge a different obligation of the same type.
  if (subjectTerms.length) return subjectTerms.every((term) => terms.has(term));
  const publicShared = (target?.public_terms || []).filter((term) => terms.has(term)).length;
  const progressionTerms = target?.progression_terms || [];
  const progressionShared = progressionTerms.filter((term) => terms.has(term)).length;
  if (publicShared >= 2 || (progressionTerms.length > 0 && progressionShared >= Math.min(2, progressionTerms.length))) {
    return true;
  }
  if (!kindFallback) return false;
  const source = oneLine(text).toLowerCase();
  if (target?.kind === 'weight_or_ring_result') return /\b(?:balance|ring|sound|weight|weigh)\b/u.test(source);
  if (target?.kind === 'material_or_assay_result') {
    return /\b(?:alloy|assay|cupel|dross|metal|silver|touchstone)\b/u.test(source);
  }
  if (target?.kind === 'mark_or_tool_result') return /\b(?:die|flaw|graver|mark|tool|cut)\b/u.test(source);
  if (target?.kind === 'comparison_result') return /\b(?:compare|comparison|link|match|tie)\b/u.test(source);
  if (target?.kind === 'record_entry') return /\b(?:entry|log|record|witness)\b/u.test(source);
  return publicShared >= 1;
}

function answerBearingRelation(text) {
  const source = oneLine(text);
  const relation = source.match(ANSWER_RELATION) || source.match(COPULAR_RESULT_RELATION);
  if (!relation) return false;
  return contentTerms(relation[1]).some((term) => !NON_ANSWER_VALUE_TERMS.has(term));
}

function targetScopedClaim(text, target, predicate) {
  return oneLine(text)
    .split(/[.!?;]+/u)
    .map(oneLine)
    .filter(Boolean)
    .some((clause) => targetTermsMatch(target, clause) && predicate(clause));
}

function concreteNextStepForTarget(text, target) {
  const clauses = oneLine(text)
    .split(/[.!?;]+/u)
    .map(oneLine)
    .filter(Boolean);
  const targetSubjects = new Set(target?.subject_terms || targetSubjectTerms(target?.public_terms || []));
  for (let index = 0; index < clauses.length; index += 1) {
    const unavailableClause = clauses[index];
    if (!targetTermsMatch(target, unavailableClause) || !UNAVAILABLE_RESULT.test(unavailableClause)) continue;
    for (const conditionClause of clauses.slice(index, index + 2)) {
      if (!CONCRETE_NEXT_STEP.test(conditionClause)) continue;
      if (!targetSubjects.size) return true;
      const foreignSubjects = targetSubjectTerms(contentTerms(conditionClause)).filter(
        (term) => !targetSubjects.has(term),
      );
      if (!foreignSubjects.length) return true;
    }
  }
  return false;
}

function componentAnswerBearing(text, component, target) {
  const source = oneLine(text);
  if (component?.value_type === 'time') {
    return /\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:noon|midnight)\b/iu.test(source);
  }
  if (component?.value_type === 'date') {
    return /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/iu.test(source);
  }
  if (component?.value_type === 'name') {
    return /(?:^|[,:;]\s+|\b(?:was|is|by|from|shows?|lists?|names?)\s+)[A-Z][\p{L}'’-]{2,}/u.test(source);
  }
  if (component?.value_type === 'weight') {
    return /\b\d+(?:\.\d+)?\s*(?:g|kg|grams?|kilograms?|oz|ounces?|lb|pounds?)\b/iu.test(source);
  }
  if (component?.value_type === 'match_status') {
    return /\b(?:matches?|matched|no match|does not match|did not match|different)\b/iu.test(source);
  }
  // `other`, `record_text`, and future unlisted value types describe the
  // requested answer shape; they are not words the tutor must utter. Score
  // them by the same target-scoped answer-bearing relation as the enclosing
  // obligation. Declared non-value components retain their literal terms.
  if (component?.value_type) return targetScopedClaim(source, target, answerBearingRelation);
  const terms = (component?.terms || []).map((term) => term.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'));
  if (!terms.length) return false;
  const relation = oneLine(text).match(
    new RegExp(
      `\\b(?:${terms.join('|')})\\b.{0,50}\\b(?:is|was|establishes?|finds?|found|indicates?|indicated|leaves?|left|matches?|matched|reads?|reveals?|revealed|shows?|showed|sounds?|sounded|weighs?|weighed)\\b\\s+([^.!?]{1,100})`,
      'iu',
    ),
  );
  if (!relation) return false;
  return contentTerms(relation[1]).some((term) => !NON_ANSWER_VALUE_TERMS.has(term));
}

function normalizeReleasedEvidence(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      premise: row?.premise || null,
      surface: oneLine(row?.surface || row?.text || ''),
      fact: Array.isArray(row?.fact) ? row.fact.join(' ') : oneLine(row?.fact || ''),
    }))
    .filter((row) => row.premise || row.surface || row.fact);
}

function maskReleasedEvidenceQuestions(text, releasedEvidence) {
  const characters = String(text || '').split('');
  for (const row of releasedEvidence) {
    const exact = oneLine(row.surface);
    if (!exact) continue;
    let offset = 0;
    while (offset < text.length) {
      const start = text.indexOf(exact, offset);
      if (start < 0) break;
      for (let index = start; index < start + exact.length; index += 1) {
        if (characters[index] === '?') characters[index] = ' ';
      }
      offset = start + exact.length;
    }
  }
  return characters.join('');
}

function deliveryFor(obligation, tutorOutcome) {
  const tutorText = oneLine(tutorOutcome?.tutor_text || tutorOutcome?.tutorText || '');
  const releasedEvidence = normalizeReleasedEvidence(
    tutorOutcome?.released_evidence || tutorOutcome?.releasedEvidence || [],
  );
  const auditedTutorText = maskReleasedEvidenceQuestions(tutorText, releasedEvidence);
  const targetNamed = targetTermsMatch(obligation.target, auditedTutorText);
  const unavailable = targetScopedClaim(auditedTutorText, obligation.target, (clause) =>
    UNAVAILABLE_RESULT.test(clause),
  );
  const answerRelation = targetScopedClaim(auditedTutorText, obligation.target, answerBearingRelation);
  const componentDelivery = (obligation.target?.required_components || []).map((component) => ({
    id: component.id,
    answered: componentAnswerBearing(auditedTutorText, component, obligation.target),
  }));
  const requiredComponentsAnswered =
    componentDelivery.length === 0 || componentDelivery.every((component) => component.answered);
  const typedValueAnswer = Boolean(
    obligation.target?.requested_value_types?.length && targetNamed && requiredComponentsAnswered,
  );
  const matchingRelease = releasedEvidence.find((row) =>
    targetTermsMatch(obligation.target, `${row.surface} ${row.fact}`, { kindFallback: false }),
  );
  const boundedNegativeComparison = Boolean(
    ['comparison_result', 'mark_or_tool_result'].includes(obligation.target?.kind) &&
    targetScopedClaim(auditedTutorText, obligation.target, (clause) =>
      /\b(?:no (?:public )?(?:comparison|cross-exhibit|die-mark|metal)?\s*match|match (?:is|remains) (?:absent|unrecorded)|nothing matches)\b/iu.test(
        clause,
      ),
    ),
  );
  const supplied = Boolean(
    matchingRelease ||
    boundedNegativeComparison ||
    typedValueAnswer ||
    (!unavailable && targetNamed && answerRelation && requiredComponentsAnswered),
  );
  const questionCount = (auditedTutorText.match(/\?/gu) || []).length;
  const concreteNextStep = concreteNextStepForTarget(auditedTutorText, obligation.target);
  const validDeferral = Boolean(unavailable && targetNamed && concreteNextStep && questionCount === 0);
  const status = supplied ? 'satisfied' : validDeferral ? 'deferred' : 'unfulfilled';
  return {
    schema: ADAPTIVE_WARRANT_PUBLIC_OBLIGATION_DELIVERY_SCHEMA,
    obligation_id: obligation.id,
    tutor_turn: Number(tutorOutcome?.turn) || null,
    status,
    target_named: targetNamed,
    answer_bearing_relation: answerRelation,
    required_components_answered: requiredComponentsAnswered,
    component_delivery: componentDelivery,
    matching_release_premise: matchingRelease?.premise || null,
    unavailable_claimed: unavailable,
    concrete_next_step: concreteNextStep,
    terminal_question_count: questionCount,
  };
}

/**
 * Pure public-text delivery audit shared by the cross-turn ledger and the
 * same-turn response/progression guard. The directive form uses
 * `obligation_id`; persisted ledger rows use `id`.
 */
export function auditAdaptiveWarrantPublicObligationDelivery({ obligation, tutorOutcome = {} } = {}) {
  if (!obligation) return null;
  return deliveryFor(
    {
      ...obligation,
      id: obligation.id || obligation.obligation_id || null,
      target: obligation.target || null,
    },
    tutorOutcome,
  );
}

function clone(value) {
  return structuredClone(value);
}

function blockingOrder(left, right) {
  const priority = { overdue: 0, open: 1, reactivated: 1, deferred: 2 };
  return (
    (priority[left.status] ?? 9) - (priority[right.status] ?? 9) ||
    left.created_turn - right.created_turn ||
    left.id.localeCompare(right.id)
  );
}

/** Stateful deterministic ledger, called once at each decision point. */
export function createAdaptiveWarrantPublicObligationLedger({ obligations = [] } = {}) {
  let sequence = obligations.reduce((max, row) => {
    const suffix = Number(
      String(row?.id || '')
        .split('-')
        .at(-1),
    );
    return Number.isFinite(suffix) ? Math.max(max, suffix) : max;
  }, 0);
  const rows = obligations.map((row) => clone(row));

  function addHistory(row, event) {
    row.history.push({ schema: ADAPTIVE_WARRANT_PUBLIC_OBLIGATION_SCHEMA, ...event });
  }

  function reconcileTutorOutcome(tutorOutcome) {
    if (!tutorOutcome || !Number.isFinite(Number(tutorOutcome.turn))) return [];
    const events = [];
    for (const row of rows) {
      if (!['open', 'overdue', 'reactivated', 'deferred'].includes(row.status)) continue;
      if (Number(tutorOutcome.turn) < row.created_turn) continue;
      const delivery = auditAdaptiveWarrantPublicObligationDelivery({ obligation: row, tutorOutcome });
      row.last_delivery = delivery;
      if (delivery.status === 'satisfied') {
        row.status = 'satisfied';
        row.satisfied_turn = Number(tutorOutcome.turn);
        addHistory(row, { type: 'satisfied', turn: Number(tutorOutcome.turn), delivery });
      } else if (delivery.status === 'deferred') {
        row.status = 'deferred';
        row.deferral = {
          public_reason: 'target named as currently unavailable',
          next_public_step: 'target-matching public test or release',
          deadline_turn: null,
          reactivation_policy: 'matching_public_release_or_explicit_learner_reminder',
        };
        addHistory(row, { type: 'deferred', turn: Number(tutorOutcome.turn), delivery });
      } else if (row.status !== 'deferred') {
        row.status = 'overdue';
        addHistory(row, {
          type: 'expired',
          turn: Number(tutorOutcome.turn),
          delivery,
        });
      }
      events.push({ obligation_id: row.id, ...delivery });
    }
    return events;
  }

  function closeByLearnerAct(act, turn) {
    const disposition = act.prior_obligation_disposition || act.kind;
    if (!['withdrawal', 'transfer_to_learner'].includes(disposition)) return [];
    const open = rows.filter((row) => ['open', 'overdue', 'reactivated', 'deferred'].includes(row.status));
    if (!open.length) return [];
    // A withdrawal/transfer without a repeated target closes only the oldest
    // blocking row, never every obligation in the dialogue.
    const dispositionTarget = act.kind === disposition ? act.target : null;
    const matching = dispositionTarget
      ? open.filter((row) => targetsEquivalent(row.target, dispositionTarget))
      : open.sort(blockingOrder).slice(0, 1);
    const events = [];
    for (const row of matching.slice(0, 1)) {
      row.status = disposition === 'withdrawal' ? 'withdrawn' : 'transferred_to_learner';
      addHistory(row, { type: row.status, turn });
      events.push({ type: row.status, obligation_id: row.id, turn });
    }
    return events;
  }

  return {
    schema: ADAPTIVE_WARRANT_PUBLIC_OBLIGATION_LEDGER_SCHEMA,

    assess({
      turn,
      learnerText = '',
      classification = null,
      semanticEventExtraction = null,
      priorTutorOutcome = null,
    } = {}) {
      const normalizedTurn = Number(turn);
      if (!Number.isFinite(normalizedTurn) || normalizedTurn < 1) {
        throw new Error('public-obligation ledger requires a positive decision turn');
      }
      const events = reconcileTutorOutcome(priorTutorOutcome);
      const speechAct = classifyAdaptiveWarrantPublicSpeechAct({
        learnerText,
        classification,
        semanticEventExtraction,
      });
      events.push(...closeByLearnerAct(speechAct, normalizedTurn));

      if (speechAct.creates_obligation) {
        const equivalent = rows.find(
          (row) =>
            ['open', 'overdue', 'reactivated', 'deferred'].includes(row.status) &&
            targetsEquivalent(row.target, speechAct.target),
        );
        const referential = equivalent ? null : referentialReminderCandidate(rows, speechAct);
        const existing = equivalent || referential;
        if (existing) {
          if (referential) {
            speechAct.referential_resolution = {
              kind: 'active_public_obligation',
              obligation_id: referential.id,
              original_target: clone(speechAct.target),
            };
            speechAct.target = clone(referential.target);
            events.push({
              type: 'referential_reminder_resolved',
              obligation_id: referential.id,
              turn: normalizedTurn,
            });
          }
          existing.target.required_components = mergeRequiredComponents(
            existing.target.required_components,
            speechAct.target.required_components,
          );
          existing.last_reminded_turn = normalizedTurn;
          existing.source_turns = [
            ...new Set([...(existing.source_turns || [existing.created_turn]), normalizedTurn]),
          ].sort((left, right) => left - right);
          existing.occurrences += 1;
          existing.status = existing.status === 'deferred' ? 'reactivated' : existing.status;
          addHistory(existing, { type: 'reminded', turn: normalizedTurn, surface: speechAct.surface });
          events.push({ type: 'reminded', obligation_id: existing.id, turn: normalizedTurn });
        } else {
          sequence += 1;
          const row = {
            schema: ADAPTIVE_WARRANT_PUBLIC_OBLIGATION_SCHEMA,
            id: `public-obligation-${String(sequence).padStart(3, '0')}`,
            kind: 'public_result_request',
            owner: 'tutor',
            target: clone(speechAct.target),
            created_turn: normalizedTurn,
            last_reminded_turn: normalizedTurn,
            source_turns: [normalizedTurn],
            response_due_turn: normalizedTurn,
            occurrences: 1,
            status: 'open',
            satisfied_turn: null,
            deferral: null,
            last_delivery: null,
            history: [],
          };
          addHistory(row, { type: 'created', turn: normalizedTurn, surface: speechAct.surface });
          rows.push(row);
          events.push({ type: 'created', obligation_id: row.id, turn: normalizedTurn });
        }
      }

      const blocking = rows
        .filter((row) => ['open', 'overdue', 'reactivated'].includes(row.status))
        .sort(blockingOrder)[0];
      return {
        schema: ADAPTIVE_WARRANT_PUBLIC_OBLIGATION_LEDGER_SCHEMA,
        turn: normalizedTurn,
        speech_act: speechAct,
        events,
        blocking_obligation: blocking ? clone(blocking) : null,
        open_count: rows.filter((row) => ['open', 'overdue', 'reactivated', 'deferred'].includes(row.status)).length,
        overdue_count: rows.filter((row) => ['overdue', 'reactivated'].includes(row.status)).length,
        obligations: rows.map((row) => clone(row)),
      };
    },

    snapshot() {
      return {
        schema: ADAPTIVE_WARRANT_PUBLIC_OBLIGATION_LEDGER_SCHEMA,
        obligations: rows.map((row) => clone(row)),
      };
    },
  };
}
