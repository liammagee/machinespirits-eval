import {
  tutorStubDisplayDiagnosticLabel,
  tutorStubDominantPlainPolicySignals,
  tutorStubPlainPolicyLabel,
  tutorStubPlainResponseCheckSummary,
  tutorStubPlainStrategyText,
} from './tutorStubResponseDetails.js';

const QUESTION_SUPPORT_READINGS = Object.freeze({
  open_question: 'the next question was answerable from public evidence',
  embedded_directional_hint:
    'the missing direction was put into the discourse because the exact evidence was not public yet',
  bounded_directional_choice: 'a small public-safe choice replaced an impossible open recall question',
  stage_then_ask: 'new evidence was stated before the learner was asked to interpret it',
  stage_then_bounded_choice: 'new evidence was stated first, then narrowed to a small interpretive choice',
  embedded_public_hint: 'an already-public clue was restated and narrowed before asking',
  bounded_public_choice: 'an already-public clue was narrowed to a small interpretive choice',
});

function presentationColors(colors = {}) {
  return {
    cyan: colors.cyan || '',
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

function oneLine(value, { max = 220 } = {}) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function appendAnalysisLine(lines, colors, label, value, { max = 220 } = {}) {
  const text = oneLine(value, { max });
  if (!text) return;
  lines.push(`${colors.dim}  ${label}: ${text}${colors.reset}`);
}

export function projectTutorStubTurnAnalysisLines({
  turn = null,
  registerSelection = null,
  previousEfficacy = null,
  policy = 'off',
  distribution = '',
  colors = {},
} = {}) {
  const C = presentationColors(colors);
  if (!turn) {
    return Object.freeze([
      `${C.cyan}analysis >${C.reset} no completed turns yet`,
      `${C.dim}  enter a learner turn first, then use /analysis; add "technical" for debugging evidence${C.reset}\n`,
    ]);
  }

  const lines = [`${C.cyan}analysis >${C.reset} turn ${turn.turn}`];
  const classification = turn.classification || {};
  const turnAnalysis = classification.turn || {};
  const overall = classification.overall || {};
  const signals = tutorStubDominantPlainPolicySignals(registerSelection);
  const generousInference = turn.generousInference || turn.humanDiscourseFrame?.generousInference || null;
  const proofDebt = turn.humanDiscourseFrame?.proofDebt || null;
  const questionSupport = turn.humanDiscourseFrame?.questionSupport || null;
  const dialogueClosure = turn.dialogueClosure || null;
  const comprehension = turn.comprehension?.beforeTutor?.features || null;
  const dagFactDropout = turn.dagFactDropout || null;
  const learnerAdvance = turn.learnerAdvance || turn.tutorLearnerDagUpdate?.advance || null;

  appendAnalysisLine(lines, C, 'learner said', turn.learner);
  appendAnalysisLine(
    lines,
    C,
    'plain reading',
    turnAnalysis.summary || overall.summary || 'No plain-language reading is available.',
  );
  if (learnerAdvance?.accelerated) {
    appendAnalysisLine(
      lines,
      C,
      'learning pace',
      `accelerating: ${learnerAdvance.adoptedPremiseCount} public premise(s) and ${learnerAdvance.derivedFactCount} supported inference(s) were accepted together`,
    );
  }
  if (turn.releasePacing?.signal?.direction && turn.releasePacing.signal.direction !== 'steady') {
    appendAnalysisLine(
      lines,
      C,
      'clue pace',
      `${turn.releasePacing.signal.reason} The effective pace became ${turn.releasePacing.effectiveSpeed}x${
        turn.releasePacing.releasedNow?.length
          ? `, and ${turn.releasePacing.releasedNow.length} new clue${turn.releasePacing.releasedNow.length === 1 ? '' : 's'} entered this turn`
          : ''
      }.`,
    );
  }
  if (generousInference?.applied) {
    appendAnalysisLine(
      lines,
      C,
      'generous inference',
      'accepted the short answer in context; the local question counts as answered',
    );
    appendAnalysisLine(lines, C, 'what was carried forward', generousInference.resolvedMeaning);
  }
  if (proofDebt?.elision?.applied) {
    appendAnalysisLine(
      lines,
      C,
      'step compression',
      `${proofDebt.elision.count} obvious public bridge(s) were carried forward without asking for a restatement`,
    );
  }
  if (questionSupport) {
    appendAnalysisLine(
      lines,
      C,
      'question support',
      QUESTION_SUPPORT_READINGS[questionSupport.modality] || questionSupport.reason || questionSupport.modality,
    );
  }
  if (dialogueClosure?.lifecycle?.phase && dialogueClosure.lifecycle.phase !== 'open') {
    appendAnalysisLine(
      lines,
      C,
      'dialogue ending',
      dialogueClosure.lifecycle.phase === 'awaiting_checkin'
        ? 'the public verdict has closed the proof sequence; one optional check-in remains'
        : 'the tutor has explicitly closed the inquiry',
    );
  }
  if (Number(comprehension?.pressure || 0) > 0) {
    appendAnalysisLine(
      lines,
      C,
      'wording gap',
      comprehension.unresolvedTerms?.length
        ? `the learner asked about ${comprehension.unresolvedTerms.join(', ')}`
        : 'the learner recently asked for plainer wording',
    );
  }
  if (dagFactDropout?.droppedNow?.length || dagFactDropout?.activeDropped?.length) {
    appendAnalysisLine(
      lines,
      C,
      'memory pressure',
      dagFactDropout.droppedNow?.length
        ? `${dagFactDropout.droppedNow.length} previously accumulated evidence item(s) slipped on this turn; the tutor should re-anchor without turning it into a memory test`
        : `${dagFactDropout.activeDropped.length} accumulated evidence item(s) remain out of the learner’s active reasoning record`,
    );
  } else if (dagFactDropout?.repairedNow?.length) {
    appendAnalysisLine(
      lines,
      C,
      'memory recovery',
      `${dagFactDropout.repairedNow.length} dropped evidence item(s) were re-adopted`,
    );
  }

  appendAnalysisLine(lines, C, 'teaching approach', tutorStubPlainPolicyLabel(policy));
  if (registerSelection?.policy_composition) {
    const composition = registerSelection.policy_composition;
    appendAnalysisLine(
      lines,
      C,
      'additional overrides',
      `${composition.overlay_policies.map(tutorStubPlainPolicyLabel).join(', ') || 'none'}; ${
        composition.activated_overlay
          ? `${tutorStubPlainPolicyLabel(composition.activated_overlay)} took priority because the change was strong enough`
          : 'the primary policy stayed in control'
      }`,
    );
  }
  if (registerSelection) {
    appendAnalysisLine(
      lines,
      C,
      'style blend',
      distribution ||
        registerSelection.engagement_stance ||
        registerSelection.selected_register ||
        'No teaching style was stored.',
    );
    appendAnalysisLine(
      lines,
      C,
      'next tutor move',
      tutorStubPlainStrategyText(
        tutorStubDisplayDiagnosticLabel(registerSelection.action_family || 'No action was stored.'),
      ),
    );
    appendAnalysisLine(
      lines,
      C,
      'speaking level',
      `${tutorStubDisplayDiagnosticLabel(registerSelection.audience_register || 'unknown audience')}; ${tutorStubDisplayDiagnosticLabel(
        registerSelection.lexical_accessibility || 'unknown language level',
      )}`,
    );
    appendAnalysisLine(
      lines,
      C,
      'in-scene voice',
      tutorStubDisplayDiagnosticLabel(registerSelection.scene_immersion || 'unknown'),
    );
    appendAnalysisLine(
      lines,
      C,
      'part in the scene',
      tutorStubDisplayDiagnosticLabel(
        registerSelection.actorial_part_label || registerSelection.actorial_part || 'unknown',
      ),
    );
    if (registerSelection.actorial_performance?.label) {
      appendAnalysisLine(
        lines,
        C,
        'performance tactic',
        `${tutorStubDisplayDiagnosticLabel(registerSelection.actorial_performance.label)} — ${registerSelection.actorial_performance.contract}`,
      );
    }
    if (registerSelection.actorial_part_selection?.reason) {
      appendAnalysisLine(lines, C, 'why this part', registerSelection.actorial_part_selection.reason);
    }
    if (turn.responseConfigurationAudit) {
      appendAnalysisLine(
        lines,
        C,
        'style visible in the reply',
        `${turn.responseConfigurationAudit.visible_axis_count}/${turn.responseConfigurationAudit.axis_count} intended features were visible`,
      );
    }
    if (signals.length) {
      lines.push(`${C.dim}  why this approach was chosen:${C.reset}`);
      for (const signal of signals) lines.push(`${C.dim}    - ${signal}${C.reset}`);
    } else {
      appendAnalysisLine(lines, C, 'why', registerSelection.reviewer_signal || turnAnalysis.pedagogical_need);
    }
    appendAnalysisLine(
      lines,
      C,
      'tutor’s immediate aim',
      tutorStubPlainStrategyText(
        registerSelection.expected_field_move || overall.next_best_tutor_move || turnAnalysis.pedagogical_need,
      ),
    );
    appendAnalysisLine(lines, C, 'reasoning aim', tutorStubPlainStrategyText(registerSelection.expected_dag_move));
  } else {
    appendAnalysisLine(
      lines,
      C,
      'tutor’s immediate aim',
      tutorStubPlainStrategyText(overall.next_best_tutor_move || turnAnalysis.pedagogical_need),
    );
  }

  if (previousEfficacy) {
    const result =
      previousEfficacy.label === 'positive_progress'
        ? 'helped the learner move forward'
        : previousEfficacy.label === 'regression_or_overreach'
          ? 'was followed by regression or overreach'
          : 'did not yet produce clear reasoning progress';
    appendAnalysisLine(
      lines,
      C,
      'last teaching style result',
      `${tutorStubDisplayDiagnosticLabel(previousEfficacy.selected_register)}: ${result}`,
    );
    if (previousEfficacy.learnerFeedback?.rating) {
      appendAnalysisLine(
        lines,
        C,
        'your rating of that reply',
        previousEfficacy.learnerFeedback.rating === 'up'
          ? 'helpful; this was retained as one positive self-assessment signal'
          : 'not helpful; the tutor was told to make an observable change rather than repeat the same realization',
      );
    }
  }
  const responseCheck = tutorStubPlainResponseCheckSummary(turn);
  if (responseCheck) appendAnalysisLine(lines, C, 'response check', responseCheck);
  lines.push(`${C.dim}  technical details: /analysis technical (or /a technical)${C.reset}\n`);
  return Object.freeze(lines);
}
