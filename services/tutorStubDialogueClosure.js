const CLOSURE_SCHEMA = 'machinespirits.tutor-stub.dialogue-closure.v1';

const EXPLICIT_CLOSURE_PATTERN =
  /\b(?:case (?:is|stands)?\s*(?:closed|settled|resolved)|close(?:d|s)? (?:the |this )?(?:case|book|inquiry)|inquiry (?:is )?(?:complete|closed|settled)|this (?:case|inquiry) is (?:complete|closed|settled)|we can (?:end|stop|close)|that (?:completes|settles|closes) (?:the|this) (?:case|inquiry)|the verdict stands)\b/iu;
const ANSWER_VERDICT_PATTERN = /\b(?:culprit|guilty|struck|coined|responsible|final conclusion)\b/iu;
const AFFIRMATIVE_VERDICT_PATTERN = /\b(?:the )?verdict(?:\s+now)?\s+(?:is|stands|has been)|\bverdict\s*:/iu;
const NEGATED_VERDICT_PATTERN =
  /\b(?:no verdict|verdict (?:is|stands|has been) (?:not|un)|cannot|can't|not yet|before (?:a|the) verdict)\b/iu;
const NEGATED_CLOSURE_PATTERN =
  /\b(?:cannot|can't|do not|don't|not ready to|too early to|must not)\s+(?:yet\s+)?(?:close|end|settle)\b/iu;
const CHECKIN_PATTERN =
  /\b(?:anything|any (?:step|link|part|question)|one (?:step|link|part|question)|want (?:me|us) to|need (?:me|us) to|revisit|unclear|before we close)\b/iu;
const CLOSURE_ACKNOWLEDGEMENT_PATTERN =
  /^(?:no(?:pe)?(?: thanks)?|nothing|all good|i(?:'m| am) good|that(?:'s| is) all|done|finished|thanks|thank you|okay|ok|fine)[.!\s]*$/iu;

function answerMentioned(text, answerTerm) {
  const answer = String(answerTerm || '').trim();
  if (!answer) return false;
  return new RegExp(`(?:^|\\b)${answer.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?:\\b|$)`, 'iu').test(
    String(text || ''),
  );
}

export function createTutorStubDialogueClosureLifecycle({
  enabled = false,
  allowCheckIn = false,
  allowAuthoredDagClosure = false,
} = {}) {
  return {
    schema: CLOSURE_SCHEMA,
    enabled: Boolean(enabled),
    phase: 'open',
    allowCheckIn: Boolean(enabled && allowCheckIn),
    allowAuthoredDagClosure: Boolean(enabled && allowAuthoredDagClosure),
    reachedAtTurn: null,
    completedAtTurn: null,
    basis: null,
  };
}

export function tutorStubLearnerDagGrounded(model) {
  const assessment = model?.assessment || model || {};
  return Boolean(
    assessment.bottleneck === 'grounded_asserted_secret' ||
    (assessment.finalSecretEntailed === true && assessment.assertedSecret === true),
  );
}

export function tutorStubAuthoredDagSatisfied(snapshot) {
  const released = Number(snapshot?.leavesReleased || 0);
  const total = Number(snapshot?.leavesTotal || 0);
  return Boolean(snapshot?.derivable && total > 0 && released === total);
}

export function buildTutorStubDialogueClosureFrame({
  lifecycle,
  learnerDagModel = null,
  tutorDagSnapshot = null,
  answerTerm = '',
} = {}) {
  const current = lifecycle || createTutorStubDialogueClosureLifecycle();
  const strictGrounded = tutorStubLearnerDagGrounded(learnerDagModel);
  const authoredDagSatisfied = tutorStubAuthoredDagSatisfied(tutorDagSnapshot);
  const base = {
    schema: CLOSURE_SCHEMA,
    enabled: Boolean(current.enabled),
    phase: 'open',
    mandatory: false,
    available: false,
    strictGrounded,
    authoredDagSatisfied,
    allowCheckIn: Boolean(current.allowCheckIn),
    answerTerm: String(answerTerm || '').trim() || null,
    basis: null,
  };
  if (!current.enabled || current.phase === 'closed') return base;
  if (current.phase === 'awaiting_checkin') {
    return {
      ...base,
      phase: 'final_checkin_response',
      mandatory: true,
      available: true,
      allowCheckIn: false,
      basis: current.basis || 'conversational_closure',
    };
  }
  if (strictGrounded) {
    return {
      ...base,
      phase: current.allowCheckIn ? 'grounded_closing_invitation' : 'grounded_terminal_close',
      mandatory: true,
      available: true,
      basis: 'strict_learner_dag_grounded_and_asserted',
    };
  }
  if (current.allowAuthoredDagClosure && authoredDagSatisfied) {
    return {
      ...base,
      phase: current.allowCheckIn ? 'authored_closure_available' : 'authored_terminal_available',
      available: true,
      basis: 'authored_dag_fully_public',
    };
  }
  return base;
}

export function detectTutorStubVerdictDeclaration(text, { answerTerm = '' } = {}) {
  const source = String(text || '');
  const explicitClosure = EXPLICIT_CLOSURE_PATTERN.test(source) && !NEGATED_CLOSURE_PATTERN.test(source);
  const finalVerdict = Boolean(
    !NEGATED_VERDICT_PATTERN.test(source) &&
    (AFFIRMATIVE_VERDICT_PATTERN.test(source) ||
      (answerMentioned(source, answerTerm) && ANSWER_VERDICT_PATTERN.test(source))),
  );
  return { declared: explicitClosure || finalVerdict, explicitClosure, finalVerdict };
}

function questionRows(text) {
  return String(text || '')
    .split('?')
    .slice(0, -1)
    .map((part) => part.split(/[.!]/u).at(-1)?.trim() || '')
    .filter(Boolean);
}

export function auditTutorStubDialogueClosureResponse({ text, frame } = {}) {
  if (!frame?.enabled || (!frame.mandatory && !frame.available)) {
    return { ok: true, closesDialogue: false, invitesCheckIn: false, issues: [] };
  }
  const verdict = detectTutorStubVerdictDeclaration(text, { answerTerm: frame.answerTerm });
  const shouldClose = Boolean(frame.mandatory || verdict.declared);
  if (!shouldClose) {
    return { ok: true, closesDialogue: false, invitesCheckIn: false, issues: [], verdict };
  }

  const questions = questionRows(text);
  const invitesCheckIn = Boolean(frame.allowCheckIn && questions.length === 1 && CHECKIN_PATTERN.test(questions[0]));
  const issues = [];
  if (!verdict.explicitClosure) {
    issues.push({
      type: 'missing_explicit_dialogue_close',
      reason: 'the response reaches or states the final verdict without explicitly closing the case or inquiry',
    });
  }
  if (frame.phase === 'final_checkin_response' || !frame.allowCheckIn) {
    if (questions.length) {
      issues.push({
        type: 'closure_response_opens_another_turn',
        reason: 'the terminal response asks another question instead of ending the dialogue',
      });
    }
  } else {
    if (questions.length > 1) {
      issues.push({
        type: 'multiple_closure_questions',
        reason: 'the closing response may offer at most one learner check-in',
      });
    } else if (questions.length === 1 && !invitesCheckIn) {
      issues.push({
        type: 'closure_reopens_proof_work',
        reason: 'the response asks a new proof question rather than an optional final check-in',
      });
    }
  }
  return {
    ok: issues.length === 0,
    closesDialogue: true,
    invitesCheckIn,
    issues,
    verdict,
    questionCount: questions.length,
  };
}

export function advanceTutorStubDialogueClosure(lifecycle, { frame, audit, turn } = {}) {
  const current = lifecycle || createTutorStubDialogueClosureLifecycle();
  if (!current.enabled || !audit?.closesDialogue || !audit.ok) return current;
  const reachedAtTurn = current.reachedAtTurn ?? (Number(turn || 0) || null);
  if (audit.invitesCheckIn && frame?.allowCheckIn) {
    return {
      ...current,
      phase: 'awaiting_checkin',
      reachedAtTurn,
      basis: frame.basis || current.basis,
    };
  }
  return {
    ...current,
    phase: 'closed',
    reachedAtTurn,
    completedAtTurn: Number(turn || 0) || reachedAtTurn,
    basis: frame?.basis || current.basis,
  };
}

export function tutorStubClosureAcknowledgement(text) {
  return CLOSURE_ACKNOWLEDGEMENT_PATTERN.test(String(text || '').trim());
}

export function deterministicTutorStubClosureResponse(frame, { acknowledgement = false } = {}) {
  if (frame?.phase === 'final_checkin_response' || acknowledgement || !frame?.allowCheckIn) {
    return 'Then we can close the book here. The verdict stands on the public evidence, and this inquiry is complete.';
  }
  return [
    'That completes the public chain and settles the verdict. We can close the case here.',
    'Before we close the book, is there one link you want to revisit?',
  ].join(' ');
}
