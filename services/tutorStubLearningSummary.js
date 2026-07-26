import { tutorStubComprehensionSnapshot } from './tutorStubComprehensionState.js';
import { tutorStubPlainInterimBottleneck as plainInterimBottleneck } from './tutorStubInterimPresentation.js';
import { summarizeTutorStubLearnerResponseProvenance } from './tutorStubLearnerResponseProvenance.js';
import { tutorStubReleasePacingSnapshot } from './tutorStubReleasePacing.js';

export const TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA = 'machinespirits.tutor-stub.learning-summary-html.v1';

function oneLine(value, { max = 220 } = {}) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function jsonClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function uniqueSummaryText(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const text = oneLine(typeof item === 'string' ? item : item?.surface || item?.text || '', { max: 360 });
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function learnerRecordSummaryRows(model, key) {
  return uniqueSummaryText(Array.isArray(model?.learnerRecord?.[key]) ? model.learnerRecord[key] : []);
}

export function tutorStubLearningSummaryEndReason(reason, natural) {
  if (natural) return 'The inquiry reached its natural conclusion on the public evidence.';
  const labels = {
    exit: 'You chose to end the session here.',
    sigint: 'You interrupted and ended the session here.',
    once: 'The requested single turn is complete.',
    report: 'You requested a summary at this point.',
    report_during_turn: 'You requested a summary while the next tutor response was being prepared.',
    exit_requested_during_turn: 'You ended the session while the next tutor response was still being prepared.',
    initial_profile_picker_exit: 'The session ended during setup.',
    initial_settings_exit: 'The session ended during setup.',
    auto_safety_turn_cap: 'The automated conversation paused at its safety limit.',
    auto_turn_limit: 'The automated conversation completed the requested number of turns.',
    auto_grounded_closure: 'The automated conversation reached its natural ending.',
    interactive_auto_grounded_closure: 'The automated conversation reached its natural ending.',
    dialogue_grounded_closure: 'The conversation reached its natural ending.',
    dialogue_closure_acknowledgement: 'The final check-in was completed.',
  };
  return (
    labels[reason] || `The session ended at ${String(reason || 'the current stopping point').replaceAll('_', ' ')}.`
  );
}

export function tutorStubDialogueCaseStatus(turn) {
  const assessment = turn?.tutorLearnerDagModel?.assessment || {};
  const closure = turn?.dialogueClosure?.lifecycle || null;
  const missing = Number(
    turn?.tutorLearnerDagModel?.metrics?.missingPremiseCount ?? assessment.missingPremiseCount ?? 0,
  );
  if (assessment.finalSecretEntailed && assessment.assertedSecret) {
    return 'The learner reached and stated a conclusion supported by the public evidence.';
  }
  if (closure?.phase === 'closed') {
    return 'The conversation closed naturally from the public evidence.';
  }
  if (closure?.phase === 'awaiting_checkin') {
    return 'The conclusion has been stated; one optional final check-in remains.';
  }
  if (assessment.finalSecretEntailed && assessment.secretStatedVia === 'voiced_derivation') {
    return 'The learner reached the conclusion and said it in passing, but never claimed it as the answer.';
  }
  if (assessment.finalSecretEntailed) {
    return 'The evidence supports the conclusion, but the learner has not fully stated it.';
  }
  if (missing > 0) {
    return `${missing} evidence ${missing === 1 ? 'step remains' : 'steps remain'}. Next need: ${plainInterimBottleneck(
      assessment.bottleneck,
    )}.`;
  }
  return `The inquiry remains open. Next need: ${plainInterimBottleneck(assessment.bottleneck)}.`;
}

export function buildTutorStubLearningSummary(
  state,
  { reason = 'exit', generatedAt = new Date().toISOString(), trace = null } = {},
) {
  const turns = state.turns || [];
  const last = turns.at(-1) || {};
  const finalModel = last.tutorLearnerDagModel || {};
  const assessment = finalModel.assessment || {};
  const metrics = finalModel.metrics || {};
  const finalOverall = last.classification?.overall || {};
  const comprehension = tutorStubComprehensionSnapshot(state.comprehension, { turn: turns.length + 1 });
  const evidenceHeld = learnerRecordSummaryRows(finalModel, 'grounded');
  const learnerAdvances = turns
    .map(
      (turn) => turn.learnerAdvance || turn.tutorLearnerDagUpdate?.advance || turn.tutorLearnerDagModel?.learnerAdvance,
    )
    .filter(Boolean);
  const acceleratedAdvances = learnerAdvances.filter((advance) => advance.accelerated);
  let reasoningVoiced = learnerRecordSummaryRows(finalModel, 'voicedDerived');
  if (!reasoningVoiced.length) {
    reasoningVoiced = uniqueSummaryText(
      turns
        .filter((turn) => {
          const analysis = turn.classification?.turn || {};
          return analysis.evidence_use && analysis.evidence_use !== 'none' && analysis.epistemic_stance === 'grounded';
        })
        .map((turn) => turn.learner),
    );
  }

  const journey = [];
  let previousEvidence = new Set();
  let previousReasoning = new Set();
  for (const turn of turns) {
    const model = turn.tutorLearnerDagModel || {};
    const evidence = learnerRecordSummaryRows(model, 'grounded');
    const reasoning = learnerRecordSummaryRows(model, 'voicedDerived');
    const evidenceKeys = new Set(evidence.map((item) => item.toLowerCase()));
    const reasoningKeys = new Set(reasoning.map((item) => item.toLowerCase()));
    journey.push({
      turn: turn.turn,
      turnId: turn.turnId || null,
      learner: turn.learner || '',
      learnerResponseProvenance: jsonClone(turn.learnerResponseProvenance || null),
      tutor: turn.tutor || '',
      reading: turn.classification?.turn?.summary || turn.classification?.overall?.current_state || null,
      coverage: model.assessment?.bestPathCoverage ?? null,
      newEvidence: evidence.filter((item) => !previousEvidence.has(item.toLowerCase())),
      newReasoning: reasoning.filter((item) => !previousReasoning.has(item.toLowerCase())),
      learnerAdvance: turn.learnerAdvance || turn.tutorLearnerDagUpdate?.advance || model.learnerAdvance || null,
      releasePacing: turn.releasePacing || null,
    });
    previousEvidence = evidenceKeys;
    previousReasoning = reasoningKeys;
  }

  const missingPremiseCount = Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0);
  const closure = last.dialogueClosure?.lifecycle || state.dialogueClosure || null;
  const natural = Boolean(
    closure?.phase === 'closed' ||
    assessment.assertedSecret === true ||
    ['dialogue_grounded_closure', 'interactive_auto_grounded_closure'].includes(reason),
  );
  const openQuestions = [];
  if (comprehension.features.unresolvedTerms.length) {
    openQuestions.push(`Clarify the remaining terms: ${comprehension.features.unresolvedTerms.join(', ')}.`);
  }
  if (assessment.finalSecretEntailed && !assessment.assertedSecret) {
    openQuestions.push(
      'The public evidence supports a verdict, but it has not yet been stated in the learner’s own words.',
    );
  } else if (missingPremiseCount > 0) {
    openQuestions.push(
      `${missingPremiseCount} part${missingPremiseCount === 1 ? '' : 's'} of the best-supported reasoning path remained unestablished when the session ended.`,
    );
  } else if (!natural) {
    openQuestions.push('The inquiry ended before a natural close, so the current conclusion remains provisional.');
  }
  if (last.humanDiscourseFrame?.proofDebt?.counts?.open) {
    openQuestions.push('At least one compressed reasoning step still needs an explicit public warrant.');
  }

  let nextStep = 'Try the same reasoning pattern on a fresh case and explain which evidence licenses each step.';
  if (!natural) {
    if (comprehension.features.unresolvedTerms.length) {
      nextStep = `Resolve ${comprehension.features.unresolvedTerms[0]} first, then return to the evidence it affects.`;
    } else if (assessment.finalSecretEntailed && !assessment.assertedSecret) {
      nextStep = 'State the verdict in your own words and name the public evidence that licenses it.';
    } else if (missingPremiseCount > 0) {
      nextStep = 'Identify the remaining public evidence and connect it explicitly to the strongest current inference.';
    } else if (finalOverall.next_best_tutor_move) {
      nextStep = oneLine(finalOverall.next_best_tutor_move, { max: 300 });
    }
  }

  return {
    schema: TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA,
    generatedAt,
    runId: state.debugRunId || null,
    reason,
    turnCount: turns.length,
    topic: state.topic || null,
    world: state.world
      ? {
          id: state.world.id,
          title: state.world.title,
          question: state.world.question,
          discipline: state.world.discipline || null,
        }
      : null,
    trace,
    completion: {
      natural,
      plainReason: tutorStubLearningSummaryEndReason(reason, natural),
      closurePhase: closure?.phase || null,
    },
    finalStatus: turns.length ? tutorStubDialogueCaseStatus(last) : 'No completed tutor turns.',
    arc: {
      summary: finalOverall.summary || last.classification?.turn?.summary || null,
      trajectory: finalOverall.trajectory || null,
      recurringPattern: finalOverall.recurring_pattern || null,
      currentState: finalOverall.current_state || null,
    },
    progress: {
      bestPathCoverage: assessment.bestPathCoverage ?? null,
      missingPremiseCount,
      finalSecretEntailed: assessment.finalSecretEntailed === true,
      assertedSecret: assessment.assertedSecret === true,
      plainStatus: turns.length ? tutorStubDialogueCaseStatus(last) : 'No learning evidence was recorded.',
      acceleratedTurnCount: acceleratedAdvances.length,
      maxSupportedMoves: Math.max(0, ...learnerAdvances.map((advance) => Number(advance.supportedMoveCount || 0))),
    },
    releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
    learnerResponseProvenance: summarizeTutorStubLearnerResponseProvenance(turns),
    trainingReuse: jsonClone(state.trainingReuse),
    evidenceHeld,
    reasoningVoiced,
    comprehension: {
      explainedTerms: comprehension.features.explainedTerms,
      unresolvedTerms: comprehension.features.unresolvedTerms,
    },
    openQuestions,
    nextStep,
    journey,
    boundary:
      'This report uses only public dialogue, public learner-record evidence, and learner-visible clarification state. It does not reveal unreleased premises, hidden proof paths, or a concealed answer that the learner had not earned.',
  };
}
