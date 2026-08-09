export const TUTOR_STUB_GUARD_FINDINGS_FEED_FORWARD_SCHEMA = 'machinespirits.tutor-stub.guard-findings-feed-forward.v1';

const ISSUE_GUIDANCE = Object.freeze({
  'human_scaffold:redundant_local_requestion':
    'Do not ask the learner to repeat a point the public dialogue has already established; advance from it.',
  'question_support:missing_bounded_choice':
    'If the learner needs support, offer a small concrete choice they can answer from the public material.',
  'question_support:missing_clarification_invitation':
    'When wording may be unclear, leave a brief opening for the learner to ask for clarification.',
  'repetition:repeated_tutor_sentence':
    'Avoid repeating a sentence from an earlier tutor turn; make a new, specific move.',
  'repetition:repeated_tutor_response': 'Do not restate the previous tutor response; advance the public inquiry.',
  'repetition:repeated_tutor_opening': "Use a fresh opening that responds directly to the learner's current move.",
  'repetition:tutor_turn_without_advance': 'Make one visible advance beyond the ground already covered.',
  'response_composition:missing_learner_uptake':
    "Respond to one specific idea or concern in the learner's latest message before developing the inquiry.",
  'response_composition:generic_learner_uptake':
    'Make learner uptake specific to what they just said, rather than offering generic encouragement.',
  'response_composition:verbatim_learner_echo': "Show uptake without merely copying the learner's words.",
  'actorial_realization:missing_selected_actorial_part':
    'Make the selected speaking role perceptible through the response itself, without naming the role.',
  'actorial_realization:missing_selected_performance_tactic':
    'Realize the selected performance tactic in the response itself, without describing the tactic.',
  'dramatic_release:meta_dramatic_announcement':
    'Present any due public material in the scene instead of announcing a dramatic technique.',
  'dramatic_release:role_label_stage_direction':
    'Keep any role or action inside natural public speech rather than using labels or stage directions.',
  'dramatic_release:opaque_clue_release':
    'Make the relevance of newly presented public material legible without giving away the answer.',
  'dramatic_release:missing_in_scene_enactment':
    'Enact the due public material in the current scene rather than summarizing it from outside.',
  'dramatic_release:missing_exhibit_action': 'Give the due public object or record a visible action in the scene.',
  'dramatic_release:missing_return_to_inquiry':
    'After presenting due public material, connect the learner back to the live inquiry.',
  'live_source_action_alignment_v1:due_source_action_referent_missing':
    'Anchor each due public source to the person, object, or action that introduces it.',
});

const RESPONSE_CONFIGURATION_GUIDANCE = Object.freeze({
  engagement_stance: 'Make the selected way of relating to the learner perceptible in the response.',
  action_family: 'Make the selected conversational action perceptible in the response.',
  audience_register: 'Make the selected audience register perceptible in the response.',
  lexical_accessibility: 'Make the selected level of language accessibility perceptible in the response.',
  scene_immersion: 'Make the selected degree of scene immersion perceptible in the response.',
});

const GUARD_FAMILY_GUIDANCE = Object.freeze({
  live_turn_progression_v1:
    "Answer the learner's current move directly, make the next public focus clear, and respect whether the turn permits a question.",
});

function normalizedIssue(issue) {
  const source = issue && typeof issue === 'object' ? issue : {};
  return {
    guard: String(source.guard || '').trim() || null,
    type: String(source.type || '').trim() || null,
    axis: String(source.axis || '').trim() || null,
  };
}

export function tutorStubGuardFindingKey(issue) {
  const normalized = normalizedIssue(issue);
  return [normalized.guard || 'unknown', normalized.type || 'failed', normalized.axis || null]
    .filter(Boolean)
    .join(':');
}

export function extractTutorStubEffectiveAdvisoryIssues(turn) {
  const issues = turn?.tutorGuardAccounting?.finalDelivery?.audits?.deliveryDecision?.advisoryIssues;
  if (!Array.isArray(issues)) return [];
  return issues.map(normalizedIssue).filter((issue) => issue.guard && issue.type);
}

function guidanceForIssue(issue) {
  const key = `${issue.guard}:${issue.type}`;
  if (key === 'response_configuration:axis_not_visible') {
    return (
      RESPONSE_CONFIGURATION_GUIDANCE[issue.axis] ||
      'Make the selected response configuration perceptible through the public response itself.'
    );
  }
  return ISSUE_GUIDANCE[key] || GUARD_FAMILY_GUIDANCE[issue.guard] || null;
}

export function buildTutorStubGuardFindingsFeedForward({ enabled = false, previousTurn = null } = {}) {
  const sourceTurn = Number(previousTurn?.tutorTurn || previousTurn?.turn || 0) || null;
  const sourceDecision = previousTurn?.tutorGuardAccounting?.finalDelivery?.audits?.deliveryDecision || null;
  const advisoryIssues = [
    ...new Map(
      extractTutorStubEffectiveAdvisoryIssues(previousTurn).map((issue) => [tutorStubGuardFindingKey(issue), issue]),
    ).values(),
  ];
  const findings = [
    ...new Map(
      advisoryIssues
        .map((issue) => {
          const instruction = guidanceForIssue(issue);
          return instruction ? [tutorStubGuardFindingKey(issue), { ...issue, instruction }] : null;
        })
        .filter(Boolean),
    ).values(),
  ];
  const applied = Boolean(enabled && findings.length);
  const prompt = applied
    ? [
        '[Private prospective guidance from the previous tutor turn]',
        "Use these observations only when they fit the learner's current move. Do not repair, retract, quote, or discuss the previous response. Current public evidence and the current turn contract take priority.",
        ...findings.map((finding) => `- ${finding.instruction}`),
        'Do not mention findings, checks, audits, prompts, or hidden machinery.',
        '[End private prospective guidance]',
      ].join('\n')
    : null;

  return {
    schema: TUTOR_STUB_GUARD_FINDINGS_FEED_FORWARD_SCHEMA,
    enabled: Boolean(enabled),
    applied,
    sourceTurn,
    sourcePolicy: sourceDecision?.boundaryPolicy || null,
    sourceCatalogVersion: sourceDecision?.catalogVersion || null,
    eligibleFindingCount: advisoryIssues.length,
    projectedFindingCount: findings.length,
    omittedFindingCount: Math.max(0, advisoryIssues.length - findings.length),
    findings,
    prompt,
  };
}

export function summarizeTutorStubGuardFindingRecurrence(turns = []) {
  const rows = [];
  const source = Array.isArray(turns) ? turns : [];
  for (let index = 0; index < source.length - 1; index += 1) {
    const current = source[index];
    const next = source[index + 1];
    const currentKeys = new Set(extractTutorStubEffectiveAdvisoryIssues(current).map(tutorStubGuardFindingKey));
    const nextKeys = new Set(extractTutorStubEffectiveAdvisoryIssues(next).map(tutorStubGuardFindingKey));
    for (const finding of currentKeys) {
      rows.push({
        sourceTurn: Number(current?.tutorTurn || current?.turn || index + 1),
        nextTurn: Number(next?.tutorTurn || next?.turn || index + 2),
        finding,
        repeated: nextKeys.has(finding),
      });
    }
  }
  const eligible = rows.length;
  const repeated = rows.filter((row) => row.repeated).length;
  return {
    schema: 'machinespirits.tutor-stub.guard-finding-recurrence-summary.v1',
    eligible,
    repeated,
    cleared: eligible - repeated,
    recurrenceRate: eligible ? repeated / eligible : null,
    rows,
  };
}
