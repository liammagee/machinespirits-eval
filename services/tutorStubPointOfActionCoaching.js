import { createHash } from 'node:crypto';

export const TUTOR_STUB_POINT_OF_ACTION_SCHEMA = 'machinespirits.tutor-stub.point-of-action-turn.v1';
export const TUTOR_STUB_POINT_OF_ACTION_DETECTOR_VERSION = 'step4-frozen-2026-07-14.v1';
export const TUTOR_STUB_POINT_OF_ACTION_ARMS = Object.freeze([
  'standing_book',
  'triggered_placebo',
  'side_coach',
  'compiled_constraint',
]);
// Phase 5 live-pilot arms (PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md).
// Additive only: the frozen Step 4 registry above, the detector, and every
// existing arm's behavior are byte-unchanged. Neither Phase 5 arm ever
// injects text at trigger time — `committee` intervenes at the generation
// layer inside the speaking call, `silent_control` observes only.
export const TUTOR_STUB_POINT_OF_ACTION_PHASE5_ARMS = Object.freeze(['committee', 'silent_control']);
const ALL_POINT_OF_ACTION_ARMS = Object.freeze([
  ...TUTOR_STUB_POINT_OF_ACTION_ARMS,
  ...TUTOR_STUB_POINT_OF_ACTION_PHASE5_ARMS,
]);

export const TUTOR_STUB_POINT_OF_ACTION_TRIGGERS = Object.freeze(['stagnant_repeat', 'warrant_skip']);

const WARRANT_CUE_RE = /\b(?:evidence|item|test|record|fact|rule)\b/iu;
const PLACEBO_FORBIDDEN_RE =
  /\b(?:warrant|evidence|item|test|record|fact|rule|release|premise|answer|proof|reanchor|ground_in_material|break_stagnation|expose_warrant)\b/iu;

const TARGET_TEXT = Object.freeze({
  stagnant_repeat: [
    '[Point-of-action side coaching]',
    'Break the stagnant repetition now.',
    'If a public premise is due, stage that premise through the existing release guard.',
    'Otherwise reanchor a different already-public exhibit or material domain.',
    'Do not repeat the previous action family.',
    '[End point-of-action side coaching]',
  ].join('\n'),
  warrant_skip: [
    '[Point-of-action side coaching]',
    "Expose the learner's warrant now.",
    'Ask exactly one focused public question connecting the learner’s claim to an evidence item, test, record, fact, or rule.',
    'Release no new premise on this turn.',
    'Do not state the answer or a hidden proof edge.',
    '[End point-of-action side coaching]',
  ].join('\n'),
});

const PLACEBO_BASE =
  '[Point-of-action inspection] Inspect the current exchange carefully before responding. Review the present public context with ordinary care. [End point-of-action inspection]';
const PLACEBO_FILLER = ['current', 'exchange', 'carefully', 'present', 'context', 'ordinary', 'attention'];

function sha256(value) {
  return createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

export function pointOfActionTokenCount(value) {
  return String(value || '').match(/[\p{L}\p{N}_'-]+|[^\s\p{L}\p{N}_'-]/gu)?.length || 0;
}

function tokenMatchedPlacebo(targetText) {
  const targetCount = pointOfActionTokenCount(targetText);
  const baseTokens = PLACEBO_BASE.match(/[\p{L}\p{N}_'-]+|[^\s\p{L}\p{N}_'-]/gu) || [];
  if (baseTokens.length > targetCount) throw new Error('Point-of-action placebo base exceeds target token count');
  const tokens = [...baseTokens];
  let index = 0;
  while (tokens.length < targetCount) {
    tokens.splice(tokens.length - 6, 0, PLACEBO_FILLER[index % PLACEBO_FILLER.length]);
    index += 1;
  }
  const text = tokens
    .join(' ')
    .replace(/\s+([\].,;:!?])/gu, '$1')
    .replace(/([[])\s+/gu, '$1');
  if (PLACEBO_FORBIDDEN_RE.test(text)) throw new Error('Point-of-action placebo contains target-bearing language');
  if (pointOfActionTokenCount(text) !== targetCount) throw new Error('Point-of-action placebo token matching failed');
  return text;
}

export const TUTOR_STUB_POINT_OF_ACTION_PLACEBOS = Object.freeze(
  Object.fromEntries(Object.entries(TARGET_TEXT).map(([trigger, text]) => [trigger, tokenMatchedPlacebo(text)])),
);

export function normalizeTutorStubPointOfActionArm(value, { allowOff = true } = {}) {
  const arm = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/-/gu, '_');
  if (!arm && allowOff) return null;
  if (!ALL_POINT_OF_ACTION_ARMS.includes(arm)) {
    throw new Error(
      `Unknown point-of-action arm ${JSON.stringify(value)}; expected ${ALL_POINT_OF_ACTION_ARMS.join(', ')}`,
    );
  }
  return arm;
}

export function tutorStubPointOfActionStandingBook() {
  return [
    '[Standing point-of-action book]',
    'When learner conduct omits or overleaps a warrant, expose the warrant: ask exactly one focused public question connecting the claim to a public evidence item, test, record, fact, or rule; release no new premise and do not state the answer.',
    'When the interaction stagnates and the same action has repeated, break the repetition: stage a due public premise through the existing release guard, otherwise reanchor a different already-public exhibit or material domain.',
    'These notes are standing craft guidance only. No trigger-time interruption will repeat them.',
    '[End standing point-of-action book]',
  ].join('\n');
}

// Phase 5: the committee mini's activation instruction is the frozen
// side-coach block for the fired trigger — the same text the compliant
// source turns carried at training time. The composing frontier never
// receives it.
export function tutorStubPointOfActionTargetText(trigger) {
  return TARGET_TEXT[trigger] || null;
}

function assignedTrigger({
  turn,
  stagnation,
  proposedActionFamily,
  previousActionFamilies,
  evidenceUse,
  unresolvedTerms,
  nearClosure,
  closeInquiry,
}) {
  const eligibleTurn = Number(turn) >= 3 && Number(turn) <= 24;
  const suppression = {
    outside_window: !eligibleTurn,
    near_closure: Boolean(nearClosure),
    close_inquiry: Boolean(closeInquiry || proposedActionFamily === 'close_inquiry'),
    unresolved_glossary: Array.isArray(unresolvedTerms) && unresolvedTerms.length > 0,
  };
  if (suppression.outside_window || suppression.near_closure || suppression.close_inquiry) {
    return { trigger: null, suppression, cofire: false };
  }
  const priorFour = (previousActionFamilies || []).slice(-4).map(String);
  const stagnantRepeat =
    Number(stagnation) >= 0.6 &&
    priorFour.length === 4 &&
    Boolean(proposedActionFamily) &&
    priorFour.every((action) => action === proposedActionFamily) &&
    !suppression.unresolved_glossary;
  const warrantSkip = ['omits_warrant', 'overleaps_evidence'].includes(String(evidenceUse || ''));
  return {
    trigger: stagnantRepeat ? 'stagnant_repeat' : warrantSkip ? 'warrant_skip' : null,
    suppression,
    cofire: stagnantRepeat && warrantSkip,
    candidates: { stagnant_repeat: stagnantRepeat, warrant_skip: warrantSkip },
  };
}

function compiledConstraint(trigger, duePremises) {
  if (trigger === 'stagnant_repeat') {
    const releaseDue = Array.isArray(duePremises) && duePremises.length > 0;
    return {
      target_action: 'break_stagnation',
      action_family: releaseDue ? 'stage_next_step' : 'reanchor_public_evidence',
      suppress_new_premise: false,
      force_due_release: releaseDue,
    };
  }
  if (trigger === 'warrant_skip') {
    return {
      target_action: 'expose_warrant',
      action_family: 'answer_accountably',
      suppress_new_premise: true,
      force_due_release: false,
    };
  }
  return null;
}

export function buildTutorStubPointOfActionTurn({
  arm,
  turn,
  stagnation,
  proposedActionFamily,
  previousActionFamilies = [],
  evidenceUse,
  unresolvedTerms = [],
  nearClosure = false,
  closeInquiry = false,
  duePremises = [],
} = {}) {
  const normalizedArm = normalizeTutorStubPointOfActionArm(arm);
  if (!normalizedArm) return null;
  const assignment = assignedTrigger({
    turn,
    stagnation,
    proposedActionFamily,
    previousActionFamilies,
    evidenceUse,
    unresolvedTerms,
    nearClosure,
    closeInquiry,
  });
  const trigger = assignment.trigger;
  let injectedText = null;
  let injectedKind = null;
  if (trigger && normalizedArm === 'triggered_placebo') {
    injectedText = TUTOR_STUB_POINT_OF_ACTION_PLACEBOS[trigger];
    injectedKind = 'trigger_yoked_target_free_placebo';
  } else if (trigger && normalizedArm === 'side_coach') {
    injectedText = TARGET_TEXT[trigger];
    injectedKind = 'action_shaped_side_coaching';
  } else if (trigger && normalizedArm === 'compiled_constraint') {
    injectedText = TARGET_TEXT[trigger].replaceAll('side coaching', 'compiled constraint');
    injectedKind = 'compiled_typed_action_constraint';
  }
  return {
    schema: TUTOR_STUB_POINT_OF_ACTION_SCHEMA,
    detector_version: TUTOR_STUB_POINT_OF_ACTION_DETECTOR_VERSION,
    arm: normalizedArm,
    turn: Number(turn),
    assigned_trigger: trigger,
    assignment_priority: trigger === 'stagnant_repeat' ? 1 : trigger === 'warrant_skip' ? 2 : null,
    cofire: assignment.cofire,
    candidates: assignment.candidates || { stagnant_repeat: false, warrant_skip: false },
    suppression: assignment.suppression,
    inputs: {
      stagnation: Number(stagnation || 0),
      proposed_action_family: proposedActionFamily || null,
      previous_action_families: previousActionFamilies.slice(-4),
      evidence_use: evidenceUse || null,
      unresolved_terms: [...unresolvedTerms],
      near_closure: Boolean(nearClosure),
      close_inquiry: Boolean(closeInquiry || proposedActionFamily === 'close_inquiry'),
      due_premises: [...duePremises],
    },
    interruption: {
      kind: injectedKind,
      text: injectedText,
      sha256: injectedText ? sha256(injectedText) : null,
      token_count: injectedText ? pointOfActionTokenCount(injectedText) : 0,
      target_token_count: trigger ? pointOfActionTokenCount(TARGET_TEXT[trigger]) : 0,
    },
    compiled_constraint:
      trigger && normalizedArm === 'compiled_constraint' ? compiledConstraint(trigger, duePremises) : null,
  };
}

export function tutorStubPointOfActionPrompt(turn) {
  if (!turn?.assigned_trigger || !turn?.interruption?.text) return '';
  return turn.interruption.text;
}

export function applyTutorStubPointOfActionConstraint(selection, turn) {
  const constraint = turn?.compiled_constraint;
  if (!selection || !constraint) return selection;
  return {
    ...selection,
    action_family: constraint.action_family,
    expected_dag_move:
      constraint.target_action === 'expose_warrant'
        ? 'Ask exactly one focused public warrant question and release no new premise.'
        : constraint.force_due_release
          ? 'Stage the due public premise through the existing release guard.'
          : 'Reanchor a different already-public exhibit or material domain.',
    source: 'point_of_action_compiled_constraint',
    response_configuration: selection.response_configuration
      ? {
          ...selection.response_configuration,
          action_family: constraint.action_family,
          action_reason: `Frozen Step 4 compiled constraint: ${constraint.target_action}.`,
        }
      : selection.response_configuration,
  };
}

function questionCount(text) {
  return (String(text || '').match(/\?/gu) || []).length;
}

export function auditTutorStubPointOfActionCompliance({
  turn,
  tutorText,
  releasedPremiseCount = 0,
  realizedActionFamily = null,
  guardsPassed = true,
} = {}) {
  if (!turn?.assigned_trigger) return null;
  const released = Number(releasedPremiseCount || 0);
  const questions = questionCount(tutorText);
  const warrantCue = WARRANT_CUE_RE.test(String(tutorText || ''));
  const repeatedFamily = turn.inputs?.previous_action_families?.at(-1) || null;
  const changedToReanchor =
    ['reanchor_public_evidence', 'ground_in_material'].includes(realizedActionFamily) &&
    realizedActionFamily !== repeatedFamily;
  const components =
    turn.assigned_trigger === 'stagnant_repeat'
      ? {
          release_increased: released > 0,
          realized_reanchor_or_material: changedToReanchor,
          changed_from_repeated_family: changedToReanchor,
        }
      : {
          exactly_one_question: questions === 1,
          warrant_cue: warrantCue,
          no_new_premise: released === 0,
          guards_passed: Boolean(guardsPassed),
        };
  const compliant =
    turn.assigned_trigger === 'stagnant_repeat'
      ? components.release_increased || components.realized_reanchor_or_material
      : Object.values(components).every(Boolean);
  return {
    schema: 'machinespirits.tutor-stub.point-of-action-compliance.v1',
    detector_version: turn.detector_version,
    arm: turn.arm,
    turn: turn.turn,
    trigger: turn.assigned_trigger,
    compliant,
    components,
    realized_action_family: realizedActionFamily,
    released_premise_count: released,
    question_count: questions,
  };
}

export function tutorStubPointOfActionPlaceboAudit() {
  return Object.fromEntries(
    TUTOR_STUB_POINT_OF_ACTION_TRIGGERS.map((trigger) => {
      const target = TARGET_TEXT[trigger];
      const placebo = TUTOR_STUB_POINT_OF_ACTION_PLACEBOS[trigger];
      return [
        trigger,
        {
          target_token_count: pointOfActionTokenCount(target),
          placebo_token_count: pointOfActionTokenCount(placebo),
          token_count_matched: pointOfActionTokenCount(target) === pointOfActionTokenCount(placebo),
          target_free: !PLACEBO_FORBIDDEN_RE.test(placebo),
          target_sha256: sha256(target),
          placebo_sha256: sha256(placebo),
        },
      ];
    }),
  );
}
