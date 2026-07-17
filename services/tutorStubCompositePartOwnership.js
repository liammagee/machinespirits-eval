export const TUTOR_STUB_COMPOSITE_PART_OWNERSHIP_SCHEMA =
  'machinespirits.tutor-stub.composite-part-ownership.v1';
export const TUTOR_STUB_COMPOSITE_PART_OWNERSHIP_AUDIT_SCHEMA =
  'machinespirits.tutor-stub.composite-part-ownership-audit.v1';

const RELEVANCE_STOP_WORDS = new Set(
  'about action after again against also and answer are because before being break case challenge check claim could does evidence from handoff have into just material more next not only other public resist same should test than that their them then there these they this those through under very what when where which while with would your'.split(
    ' ',
  ),
);

const BOUNDED_CASE_PATTERN =
  /\b(?:but|cannot|can[’']t|does not|doesn[’']t|limit|not|only|possible|unproved|unless|until|yet)\b/iu;
const DELEGATED_COMPLEMENT_PATTERN =
  /\b(?:break|challenge|check|compare|establish|examine|inspect|look|prove|read|resist|show|test|tie|trace|weigh)\b/iu;
const RELATIONAL_OPERATION_PATTERN =
  /\b(?:hold|lay|place|put|set)\b[^.!?]{0,70}\b(?:against|beside|by|with)\b/iu;
const RELATIONAL_INQUIRY_PATTERN =
  /\bask\b[^.!?]{0,80}\b(?:how|what|which)\b|\b(?:how|what|which)\b[^.!?]{0,80}\b(?:can|could|does|would)\b[^.!?]{0,35}\b(?:establish|mean|prove|show|tell)\b/iu;
const PERFORMANCE_ACTION_LEAD_PATTERN =
  /^(?:(?:next|now|then)\s*[:,—-]?\s*)?(?:ask|break|challenge|check|choose|compare|examine|inspect|look|read|resist|show|test|trace|try|weigh)\b|^(?:let(?:[’']s| us)|we (?:can|must|need|should|will)|you (?:can|must|need|should|will))\b/iu;
const PERFORMANCE_SCHEDULED_ACTION_PATTERN =
  /\b(?:next|now|then)\b[^.!?]{0,30}\b(?:ask|break|challenge|check|choose|compare|examine|inspect|look|read|resist|show|test|trace|try|weigh)\b/iu;

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizedToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’]/gu, "'")
    .replace(/'s$/u, '')
    .replace(/(?:es|s)$/u, (suffix, offset, token) => (token.length - suffix.length >= 4 ? '' : suffix));
}

function contentTokens(value) {
  return new Set(
    (oneLine(value).match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]{2,}/gu) || [])
      .map(normalizedToken)
      .filter((token) => token.length >= 4 && !RELEVANCE_STOP_WORDS.has(token)),
  );
}

function exactEvidence(span) {
  if (!span) return [];
  return [{ span_id: span.id, start: span.start, end: span.end, text: span.text }];
}

function modelSpan(composition, id) {
  return (composition?.spans || []).find((span) => span?.id === id && span?.owner === 'model') || null;
}

function performanceIssuesAction(entry, response) {
  return [entry, response].filter(Boolean).some((span) => {
    const text = oneLine(span.text);
    return (
      text.includes('?') ||
      PERFORMANCE_ACTION_LEAD_PATTERN.test(text) ||
      PERFORMANCE_SCHEDULED_ACTION_PATTERN.test(text)
    );
  });
}

export function compileTutorStubCompositePartOwnership({
  actorialPart = null,
  actorialPartLabel = null,
  actionFamily = null,
} = {}) {
  if (actorialPart !== 'advocate' || actionFamily !== 'stage_next_step') return null;
  return {
    schema: TUTOR_STUB_COMPOSITE_PART_OWNERSHIP_SCHEMA,
    axis: 'actorial_part',
    selected_part: actorialPart,
    selected_part_label: oneLine(actorialPartLabel) || 'advocate for the live case',
    mode: 'delegated_complement',
    requirements: [
      {
        id: 'performance_initiation',
        owner: 'performance',
        slot_ids: ['performance_entry'],
        kind: 'bounded_first_person_case',
      },
      {
        id: 'performance_action_absent',
        owner: 'performance',
        slot_ids: ['performance_entry', 'performance_response'],
        kind: 'no_requested_or_scheduled_action',
      },
      {
        id: 'handoff_relevant_delegated_complement',
        owner: 'handoff',
        slot_ids: ['handoff'],
        kind: 'relevant_testability_on_shared_public_material',
      },
      {
        id: 'handoff_selected_action',
        owner: 'handoff',
        slot_ids: ['handoff'],
        kind: 'selected_action_family_visible',
        selected_action_family: actionFamily,
      },
    ],
    excluded_owners: ['source'],
    prompt: {
      performance_initiation:
        'Begin “My case is” and state a concrete public proposition, not merely whether the case is strong, weak, or limited. In this same PERFORMANCE ENTRY, name the evidence and the conclusion it cannot establish; do not replace either with “it,” “that,” or another pronoun. Do not defer the limit to PERFORMANCE RESPONSE.',
      performance_action_boundary:
        'Keep PERFORMANCE declarative: do not request, schedule, offer, or direct the next action.',
      handoff_delegated_complement:
        'Make HANDOFF the relevant concrete way to test, resist, or break that case, naming public material already named in PERFORMANCE.',
      declarative_handoff_operation:
        'Begin HANDOFF with “Next,” or “Now,” followed immediately by one concrete public operation: test, check, compare, or trace. Reuse a public object named in PERFORMANCE. A static statement that the case, claim, or accusation “breaks” is not a next operation.',
    },
  };
}

export function auditTutorStubCompositePartOwnership({
  contract = null,
  composition = null,
  selectedActionVisible = false,
} = {}) {
  if (!contract) {
    return {
      schema: TUTOR_STUB_COMPOSITE_PART_OWNERSHIP_AUDIT_SCHEMA,
      active: false,
      ok: true,
      requirements: [],
      excluded_span_ids: [],
      linkage: { shared_content_tokens: [] },
    };
  }
  if (contract.schema !== TUTOR_STUB_COMPOSITE_PART_OWNERSHIP_SCHEMA) {
    throw new Error('composite part ownership audit requires a valid typed contract');
  }
  const entry = modelSpan(composition, 'performance_entry');
  const response = modelSpan(composition, 'performance_response');
  const handoff = modelSpan(composition, 'handoff');
  const performanceText = [entry?.text, response?.text].filter(Boolean).join(' ');
  const entryText = oneLine(entry?.text);
  const handoffText = oneLine(handoff?.text);
  const initiatesCase = /^my case (?:is|rests)\b/iu.test(entryText) && BOUNDED_CASE_PATTERN.test(entryText);
  const performanceActionAbsent = !performanceIssuesAction(entry, response);
  const performanceTokens = contentTokens(performanceText);
  const handoffTokens = contentTokens(handoffText);
  const sharedContentTokens = [...performanceTokens].filter((token) => handoffTokens.has(token)).sort();
  const handoffComplement =
    sharedContentTokens.length > 0 &&
    (DELEGATED_COMPLEMENT_PATTERN.test(handoffText) ||
      (RELATIONAL_OPERATION_PATTERN.test(handoffText) && RELATIONAL_INQUIRY_PATTERN.test(handoffText)));
  const requirements = [
    {
      id: 'performance_initiation',
      owner: 'performance',
      slot_ids: ['performance_entry'],
      ok: initiatesCase,
      evidence: initiatesCase ? exactEvidence(entry) : [],
      reason: initiatesCase
        ? 'PERFORMANCE begins a bounded first-person case.'
        : 'PERFORMANCE must begin a bounded first-person case independently of HANDOFF.',
    },
    {
      id: 'performance_action_absent',
      owner: 'performance',
      slot_ids: ['performance_entry', 'performance_response'],
      ok: performanceActionAbsent,
      evidence: performanceActionAbsent ? [] : [...exactEvidence(entry), ...exactEvidence(response)],
      reason: performanceActionAbsent
        ? 'PERFORMANCE remains declarative.'
        : 'PERFORMANCE requests or schedules an action owned by HANDOFF.',
    },
    {
      id: 'handoff_relevant_delegated_complement',
      owner: 'handoff',
      slot_ids: ['handoff'],
      ok: handoffComplement,
      evidence: handoffComplement ? exactEvidence(handoff) : [],
      reason: handoffComplement
        ? `HANDOFF tests the same public material: ${sharedContentTokens.join(', ')}.`
        : 'HANDOFF must name a concrete test, resistance, or challenge tied to public material in PERFORMANCE.',
    },
    {
      id: 'handoff_selected_action',
      owner: 'handoff',
      slot_ids: ['handoff'],
      ok: selectedActionVisible === true,
      evidence: selectedActionVisible === true ? exactEvidence(handoff) : [],
      reason:
        selectedActionVisible === true
          ? 'HANDOFF visibly realizes the selected action family.'
          : 'HANDOFF does not visibly realize the selected action family.',
    },
  ];
  return {
    schema: TUTOR_STUB_COMPOSITE_PART_OWNERSHIP_AUDIT_SCHEMA,
    active: true,
    ok: requirements.every((requirement) => requirement.ok),
    selected_part: contract.selected_part,
    mode: contract.mode,
    requirements,
    excluded_span_ids: (composition?.spans || [])
      .filter((span) => span?.owner === 'host' || span?.kind === 'source')
      .map((span) => span.id),
    linkage: { shared_content_tokens: sharedContentTokens },
  };
}
