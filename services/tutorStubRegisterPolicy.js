/**
 * Deterministic assessment→register pipeline for the tutor stub.
 *
 * Every declaration in this module was moved verbatim (move, not copy) from
 * scripts/tutor-stub.js so the pure classification → field → trajectory →
 * dynamical-system → register-score pipeline is unit-testable; the CLI script
 * imports these bindings back, so decisions are byte-identical by construction.
 *
 * Boundary rules:
 * - keep LLM calls, CLI parsing, and rendering in scripts/tutor-stub.js;
 * - never import from scripts/ (one-way dependency, mirrored from the
 *   tutor-core seam rule);
 * - sampleEngagementStanceDistribution intentionally keeps Math.random() —
 *   deterministic seeding is owned by P0.2 in
 *   PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md.
 */

import { getRegisterOntologyVersion, resolveEngagementStance } from './engagementRegisterRegistry.js';
import { tutorStubComprehensionFeatures } from './tutorStubComprehensionState.js';
import {
  DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  temperTutorStubEngagementStanceScores,
} from './tutorStubRegisterTemperature.js';

// --- Field-progress threshold + learner-surface rank tables ---

const FIELD_PROGRESS_THRESHOLD = 0.05;

const LEARNER_FIELD_RANKS = {
  evidence_use: {
    none: 0,
    repeats_setup: 0.1,
    cites_public_evidence: 0.4,
    omits_warrant: 0.15,
    revises_from_evidence: 0.5,
    links_evidence_to_rule: 0.7,
    overleaps_evidence: -0.2,
    distorts_public_evidence: -0.35,
  },
  agency: {
    passive: 0,
    complying: 0.2,
    attempting: 0.5,
    steering: 0.55,
    self_correcting: 0.8,
  },
  epistemic_stance: {
    answer_seeking: 0.1,
    receptive: 0.2,
    confused: 0.25,
    exploratory: 0.5,
    reflective: 0.65,
    grounded: 0.75,
    overconfident: 0.15,
    resistant: 0.1,
  },
  discourse_move: {
    off_task: 0,
    answer_seeking: 0.1,
    question: 0.3,
    repair_request: 0.35,
    challenge: 0.35,
    claim: 0.45,
    hypothesis: 0.5,
    evidence_adoption: 0.65,
    inference: 0.75,
    metacognitive_reflection: 0.8,
  },
};

// --- Register-selection history readers ---

function latestRegisterSelection(state) {
  return normalizeStoredRegisterSelection(state.register?.history?.at(-1) || null);
}

function normalizeStoredRegisterEfficacy(efficacy) {
  if (!efficacy) return null;
  const selection = normalizeStoredRegisterSelection({
    engagement_stance: efficacy.engagement_stance || efficacy.selected_register,
  });
  return {
    ...efficacy,
    engagement_stance: selection?.engagement_stance || efficacy.engagement_stance || efficacy.selected_register,
    selected_register: selection?.selected_register || efficacy.selected_register,
    legacy_selected_register: efficacy.legacy_selected_register || selection?.legacy_selected_register || null,
  };
}

function normalizeStoredRegisterSelection(selection) {
  if (!selection) return null;
  const rawRegister = String(
    selection.engagement_stance || selection.selected_register || selection.selected_mode || selection.register || '',
  ).trim();
  const resolved = resolveEngagementStance(rawRegister, { fallback: rawRegister || null });
  const selected = resolved?.register || rawRegister || null;
  const actionFamily = selection.action_family || resolved?.action_family || null;
  const requestType = selection.request_type || resolved?.request_type || selection.learner_signal || null;
  return {
    ...selection,
    register_ontology_version: selection.register_ontology_version || getRegisterOntologyVersion(),
    engagement_stance: selected,
    selected_register: selected,
    selected_mode: selected,
    legacy_selected_register:
      selection.legacy_selected_register ||
      resolved?.legacy_selected_register ||
      preferredLegacyRegister({ register: selected, requestType, actionFamily }),
    action_family: actionFamily,
    request_type: requestType,
    efficacy: normalizeStoredRegisterEfficacy(selection.efficacy),
  };
}

function latestRegisterEfficacy(state) {
  const entry = [...(state.register?.history || [])].reverse().find((item) => item.efficacy);
  return normalizeStoredRegisterEfficacy(entry?.efficacy || null);
}

function recentRegisterCount(state, registerName, { limit = 4 } = {}) {
  return (state.register?.history || [])
    .slice(-limit)
    .filter((entry) => normalizeStoredRegisterSelection(entry)?.selected_register === registerName).length;
}

// --- Classifier score helpers ---

function scoreValue(score) {
  if (score && typeof score === 'object' && score.score !== undefined) return score.score;
  if (score !== undefined && score !== null) return score;
  return '?';
}

// --- Learner-DAG progress features + learner-surface field points ---

function dagProgressFeatures(model) {
  const metrics = model?.metrics || {};
  const assessment = model?.assessment || {};
  return {
    bestPathCoverage: Number(assessment.bestPathCoverage || 0),
    groundedCount: Number(metrics.groundedCount || 0),
    voicedDerivedCount: Number(metrics.voicedDerivedCount || 0),
    candidateConclusionCount: Number(metrics.candidateConclusionCount || 0),
    answerCandidateCount: Number(metrics.answerCandidateCount || 0),
    missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
    unsupportedAssertionCount: Number(assessment.unsupportedAssertionCount || 0),
    finalSecretEntailed: assessment.finalSecretEntailed === true,
    assertedSecret: assessment.assertedSecret === true,
    assertedMirror: assessment.assertedMirror === true,
  };
}

function meanFinite(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function rankLearnerFieldLabel(axis, value) {
  if (value === undefined || value === null) return null;
  return LEARNER_FIELD_RANKS[axis]?.[String(value).trim()] ?? null;
}

function normalizedClassifierScore(score) {
  const numeric = Number(scoreValue(score));
  return Number.isFinite(numeric) ? clampField01((numeric - 1) / 4) : null;
}

function learnerSurfaceFieldPoint(classification) {
  const turn = classification?.turn || {};
  const scores = turn.scores || {};
  const dimensions = {
    conceptual: normalizedClassifierScore(scores.conceptual_engagement),
    epistemic: normalizedClassifierScore(scores.epistemic_readiness),
    evidence: rankLearnerFieldLabel('evidence_use', turn.evidence_use),
    agency: rankLearnerFieldLabel('agency', turn.agency),
    stance: rankLearnerFieldLabel('epistemic_stance', turn.epistemic_stance),
    discourse: rankLearnerFieldLabel('discourse_move', turn.discourse_move),
  };
  return {
    score: meanFinite(Object.values(dimensions)),
    dimensions,
    labels: {
      discourse_move: turn.discourse_move || null,
      evidence_use: turn.evidence_use || null,
      epistemic_stance: turn.epistemic_stance || null,
      agency: turn.agency || null,
    },
    summary: turn.summary || null,
  };
}

function previousLearnerSurfaceFieldPoint(state) {
  const previousTurn = [...(state.turns || [])].reverse().find((turn) => turn.classification);
  return previousTurn ? learnerSurfaceFieldPoint(previousTurn.classification) : null;
}

function fieldProgressFromClassification({ state, classification }) {
  const before = previousLearnerSurfaceFieldPoint(state);
  const after = learnerSurfaceFieldPoint(classification);
  const delta =
    before?.score === null || before?.score === undefined || after?.score === null || after?.score === undefined
      ? null
      : Number((after.score - before.score).toFixed(3));
  return {
    threshold: FIELD_PROGRESS_THRESHOLD,
    beforeScore: before?.score ?? null,
    afterScore: after?.score ?? null,
    delta,
    progress: delta !== null && delta >= FIELD_PROGRESS_THRESHOLD,
    before: before || null,
    after,
  };
}

function classifyFieldStateRelation({ fieldProgress, dagProgress }) {
  if (fieldProgress && !dagProgress) return 'field_without_dag';
  if (dagProgress && !fieldProgress) return 'dag_without_field';
  if (fieldProgress && dagProgress) return 'both_progress';
  return 'neither_progress';
}

function summarizeDagDeltas(delta) {
  const parts = [];
  if (delta.bestPathCoverage) parts.push(`coverage ${delta.bestPathCoverage > 0 ? '+' : ''}${delta.bestPathCoverage}`);
  if (delta.groundedCount) parts.push(`grounded ${delta.groundedCount > 0 ? '+' : ''}${delta.groundedCount}`);
  if (delta.voicedDerivedCount)
    parts.push(`voiced ${delta.voicedDerivedCount > 0 ? '+' : ''}${delta.voicedDerivedCount}`);
  if (delta.answerCandidateCount)
    parts.push(`answers ${delta.answerCandidateCount > 0 ? '+' : ''}${delta.answerCandidateCount}`);
  if (delta.missingPremiseCount)
    parts.push(`missing ${delta.missingPremiseCount > 0 ? '+' : ''}${delta.missingPremiseCount}`);
  if (delta.unsupportedAssertionCount) {
    parts.push(`unsupported ${delta.unsupportedAssertionCount > 0 ? '+' : ''}${delta.unsupportedAssertionCount}`);
  }
  return parts.join(', ') || 'no learner-DAG movement';
}

function registerEfficacyFromDagProgress({ selection, currentModel, accepted, state, classification }) {
  const before = dagProgressFeatures(selection?.selectedAtDag);
  const after = dagProgressFeatures(currentModel);
  const delta = Object.fromEntries(Object.keys(after).map((key) => [key, Number(after[key]) - Number(before[key])]));
  const progressScore =
    delta.bestPathCoverage * 4 +
    delta.groundedCount +
    delta.voicedDerivedCount * 2 +
    delta.candidateConclusionCount +
    delta.answerCandidateCount * 3 -
    delta.missingPremiseCount -
    Math.max(0, delta.unsupportedAssertionCount);
  const label =
    progressScore > 0 ? 'positive_progress' : progressScore < 0 ? 'regression_or_overreach' : 'no_clear_progress';
  const dagProgress = progressScore > 0;
  const field = fieldProgressFromClassification({ state, classification });
  const mismatch = classifyFieldStateRelation({ fieldProgress: field.progress, dagProgress });
  return {
    schema: 'machinespirits.tutor-stub.register-efficacy.v1',
    evaluatedAtTurn: currentModel?.turn ?? null,
    registerTurn: selection?.turn ?? null,
    selected_register: selection?.selected_register || null,
    label,
    progressScore,
    dagProgress,
    field,
    mismatch,
    delta,
    acceptedUpdate: accepted
      ? {
          adopted: accepted.adopt?.length || 0,
          derived: accepted.derive?.length || 0,
          hypothesis: Boolean(accepted.hypothesis),
          assertedAnswer: accepted.assertAnswer || null,
          learnerAdvance: currentModel?.learnerAdvance || null,
        }
      : null,
    summary: summarizeDagDeltas(delta),
    caveat:
      'Heuristic local association only: the next learner turn is compared with the DAG and learner-field state when the register was selected.',
  };
}

// --- Register naming + explicit-stepwise signal detection ---

function preferredLegacyRegister({ register, requestType, actionFamily }) {
  if (register === 'ironic') return 'ironic_challenge';
  if (register === 'sarcastic') return 'sarcastic_challenge';
  if (register === 'face_threat') return 'face_threat_challenge';
  if (register === 'witnessing') return 'witnessing_restraint';
  if (register === 'charismatic') return 'charismatic_challenge';
  if (actionFamily === 'stage_next_step') return 'scaffolding';
  if (actionFamily === 'answer_accountably') return 'accountable_bid_authority';
  if (actionFamily === 'compress_sayback') return 'plain_compression';
  if (actionFamily === 'reanchor_lived_stake') return 'lived_stakes_reentry';
  if (actionFamily === 'ground_in_material') return 'transfer_grounding';
  if (requestType === 'conceptual_clarity_request') return 'clarity';
  return null;
}

function registerSignalText(classification) {
  const turn = classification?.turn || {};
  return [
    turn.summary,
    turn.request_type,
    turn.discourse_move,
    turn.evidence_use,
    turn.epistemic_stance,
    turn.affect,
    turn.agency,
    turn.pedagogical_need,
    classification?.overall?.current_state,
    classification?.overall?.next_best_tutor_move,
  ]
    .filter(Boolean)
    .join(' ');
}

function hasExplicitStepwiseSignal(classification) {
  return /step|stepwise|next|how do i|how should i|start|begin|walk|break|stuck|confus|which evidence|what evidence|what line|clue|hint|show me|what should i do/iu.test(
    registerSignalText(classification),
  );
}

// --- Field register policy ---

const FIELD_REGISTER_BASE_WEIGHTS = {
  plain: 1,
  precise: 1,
  brisk: 0.7,
  warm: 0.8,
  witnessing: 0.55,
  charismatic: 0.75,
  ironic: 0.35,
  sarcastic: 0.2,
  face_threat: 0.08,
};

function hasScoreRegister(scores, register) {
  return Object.prototype.hasOwnProperty.call(scores, register);
}

function addRegisterScore(scores, register, amount, drivers, reason) {
  if (!hasScoreRegister(scores, register) || !Number.isFinite(Number(amount))) return;
  scores[register] += Number(amount);
  if (amount > 0 && reason) drivers.push(`${register}+${Number(amount).toFixed(2)} ${reason}`);
}

function multiplyRegisterScore(scores, register, factor, drivers, reason) {
  if (!hasScoreRegister(scores, register) || !Number.isFinite(Number(factor))) return;
  scores[register] *= Number(factor);
  if (reason) drivers.push(`${register}x${Number(factor).toFixed(2)} ${reason}`);
}

function learnerDagDeltaForFieldPolicy({ state, tutorLearnerDag }) {
  const previous = state.turns?.at(-1)?.tutorLearnerDagModel || null;
  const current = tutorLearnerDag?.model || null;
  const before = dagProgressFeatures(previous);
  const after = dagProgressFeatures(current);
  const delta = Object.fromEntries(Object.keys(after).map((key) => [key, Number(after[key]) - Number(before[key])]));
  const progressScore =
    delta.bestPathCoverage * 4 +
    delta.groundedCount +
    delta.voicedDerivedCount * 2 +
    delta.candidateConclusionCount +
    delta.answerCandidateCount * 3 -
    Math.max(0, delta.unsupportedAssertionCount);
  return {
    before,
    after,
    delta,
    progressScore: Number(progressScore.toFixed(3)),
    progress: progressScore > 0,
  };
}

function fieldRegisterPolicyFeatures({ state, classification, tutorLearnerDag }) {
  const turn = classification?.turn || {};
  const assessment = tutorLearnerDag?.model?.assessment || {};
  const metrics = tutorLearnerDag?.model?.metrics || {};
  const field = fieldProgressFromClassification({ state, classification });
  const dag = learnerDagDeltaForFieldPolicy({ state, tutorLearnerDag });
  const advance = tutorLearnerDag?.advance || tutorLearnerDag?.model?.learnerAdvance || null;
  const turnNumber = tutorLearnerDag?.model?.turn ?? state.turns.length + 1;
  const fieldRelation =
    field.delta === null
      ? 'initial'
      : classifyFieldStateRelation({
          fieldProgress: field.progress,
          dagProgress: dag.progress,
        });
  return {
    turn: turnNumber,
    requestType: turn.request_type || 'unknown_request',
    discourseMove: turn.discourse_move || 'unknown',
    evidenceUse: turn.evidence_use || 'unknown',
    epistemicStance: turn.epistemic_stance || 'unknown',
    agency: turn.agency || 'unknown',
    affect: turn.affect || 'unknown',
    field: {
      relation: fieldRelation,
      beforeScore: field.beforeScore,
      afterScore: field.afterScore,
      delta: field.delta,
      progress: field.progress,
      dimensions: field.after?.dimensions || {},
      labels: field.after?.labels || {},
    },
    dag: {
      progress: dag.progress,
      progressScore: dag.progressScore,
      delta: dag.delta,
      bottleneck: assessment.bottleneck || 'unknown',
      bestPathCoverage: assessment.bestPathCoverage ?? null,
      missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
      unsupportedAssertionCount: Number(assessment.unsupportedAssertionCount || 0),
      finalSecretEntailed: assessment.finalSecretEntailed === true,
      assertedSecret: assessment.assertedSecret === true,
    },
    advance,
    explicitStepwise: hasExplicitStepwiseSignal(classification),
    comprehension: tutorStubComprehensionFeatures(state.comprehension, { turn: turnNumber }),
    recentRegisters: (state.register?.history || [])
      .slice(-4)
      .map((entry) => normalizeStoredRegisterSelection(entry)?.selected_register),
    latestEfficacy: latestRegisterEfficacy(state),
  };
}

function buildFieldRegisterScores({ state, classification, tutorLearnerDag }) {
  const palette = state.register?.palette || [];
  const scores = Object.fromEntries(
    palette.map((register) => [register, FIELD_REGISTER_BASE_WEIGHTS[register] ?? 0.45]),
  );
  const drivers = [];
  const features = fieldRegisterPolicyFeatures({ state, classification, tutorLearnerDag });
  const signal = [
    features.requestType,
    features.discourseMove,
    features.evidenceUse,
    features.epistemicStance,
    features.agency,
    features.affect,
    features.dag.bottleneck,
  ]
    .filter(Boolean)
    .join(' ');
  const comprehensionPressure = Number(features.comprehension?.pressure || 0);

  if (comprehensionPressure > 0) {
    addRegisterScore(scores, 'plain', 3.0 * comprehensionPressure, drivers, 'for comprehension-side-state gloss');
    addRegisterScore(scores, 'warm', 1.5 * comprehensionPressure, drivers, 'for low-pressure vocabulary repair');
    addRegisterScore(scores, 'precise', 0.5 * comprehensionPressure, drivers, 'for one exact definition');
    multiplyRegisterScore(
      scores,
      'charismatic',
      Math.max(0.15, 1 - 0.8 * comprehensionPressure),
      drivers,
      'comprehension pressure suppresses challenge',
    );
    multiplyRegisterScore(scores, 'ironic', 0.25, drivers, 'comprehension pressure suppresses irony');
    multiplyRegisterScore(scores, 'sarcastic', 0.1, drivers, 'comprehension pressure suppresses sarcasm');
    multiplyRegisterScore(scores, 'face_threat', 0.05, drivers, 'comprehension pressure suppresses face threat');
  }

  if (
    /conceptual_clarity_request|challenge|omits_warrant|overleaps_evidence|distorts_public_evidence|unsupported/iu.test(
      signal,
    )
  ) {
    addRegisterScore(scores, 'precise', 2.2, drivers, 'for distinction, warrant, or overreach');
    addRegisterScore(scores, 'ironic', 0.7, drivers, 'for visible mismatch');
  }
  if (/plain_language_request|plain_simplification_followup/iu.test(signal)) {
    addRegisterScore(scores, 'plain', 2.4, drivers, 'for plain-language compression');
    addRegisterScore(scores, 'warm', 0.7, drivers, 'for low-friction re-entry');
  }
  if (/transfer_demand_or_named_material/iu.test(signal)) {
    addRegisterScore(scores, 'plain', 1.2, drivers, 'for material grounding');
    addRegisterScore(scores, 'warm', 0.9, drivers, 'for lived continuity');
  }
  if (/vulnerability_or_moral_exposure|affective_signal|vulnerable|shame|anxious|risk/iu.test(signal)) {
    addRegisterScore(scores, 'witnessing', 3.0, drivers, 'for affective exposure');
    addRegisterScore(scores, 'warm', 1.3, drivers, 'for non-sentimental invitation');
  }
  if (/resistance_or_low_agency|resistant|answer_seeking|overconfident|passive|complying/iu.test(signal)) {
    addRegisterScore(scores, 'charismatic', 2.6, drivers, 'for low-agency or resistant posture');
    addRegisterScore(scores, 'ironic', 1.0, drivers, 'for rote-performance mismatch');
    addRegisterScore(scores, 'sarcastic', 0.55, drivers, 'for negative-register probe');
    addRegisterScore(scores, 'face_threat', 0.25, drivers, 'for simulated stress-test availability');
  }
  if (/off_task_or_mixed|off_task/iu.test(signal)) {
    addRegisterScore(scores, 'plain', 1.0, drivers, 'for reset');
    addRegisterScore(scores, 'charismatic', 0.9, drivers, 'for sharper re-entry');
  }
  if (features.explicitStepwise || /release_or_pacing_gap|inference_gap/iu.test(features.dag.bottleneck)) {
    addRegisterScore(scores, 'precise', 0.8, drivers, 'for immediate proof-state focus');
    if (features.explicitStepwise) {
      addRegisterScore(scores, 'brisk', 2.1, drivers, 'for explicit stepwise request');
    } else {
      addRegisterScore(scores, 'brisk', 0.35, drivers, 'for proof gap without explicit stepwise request');
    }
  }

  if (features.field.relation === 'field_without_dag') {
    addRegisterScore(scores, 'plain', 1.7, drivers, 'to convert field movement into a claim');
    addRegisterScore(scores, 'precise', 1.5, drivers, 'to make the warrant checkable');
  } else if (features.field.relation === 'dag_without_field') {
    addRegisterScore(scores, 'warm', 1.2, drivers, 'to recover learner ownership');
    addRegisterScore(scores, 'witnessing', 0.9, drivers, 'to lower agency risk');
    addRegisterScore(scores, 'plain', 1.0, drivers, 'to ask for say-back');
  } else if (features.field.relation === 'both_progress') {
    addRegisterScore(scores, 'precise', 0.9, drivers, 'to consolidate dual progress');
    addRegisterScore(scores, 'brisk', 0.8, drivers, 'to preserve momentum');
    addRegisterScore(scores, 'plain', 0.6, drivers, 'to keep the move portable');
  } else if (features.field.relation === 'neither_progress') {
    addRegisterScore(scores, 'charismatic', 1.4, drivers, 'to change a flat field');
    addRegisterScore(scores, 'ironic', 0.8, drivers, 'to expose a stuck mismatch');
    addRegisterScore(scores, 'plain', 0.6, drivers, 'to reset without decoration');
  } else {
    addRegisterScore(scores, 'warm', 0.6, drivers, 'for first-turn invitation');
    addRegisterScore(scores, 'precise', 0.6, drivers, 'for first-turn warranting');
  }

  if (features.advance?.accelerated && !features.dag.finalSecretEntailed && !features.dag.assertedSecret) {
    addRegisterScore(scores, 'brisk', 2.4, drivers, 'for learner-owned multi-premise acceleration');
    addRegisterScore(scores, 'precise', 1.5, drivers, 'to test only the next unresolved edge');
    addRegisterScore(scores, 'plain', 0.4, drivers, 'to credit the compressed chain cleanly');
    multiplyRegisterScore(scores, 'warm', 0.65, drivers, 'acceleration reduces re-entry support');
    multiplyRegisterScore(scores, 'witnessing', 0.55, drivers, 'acceleration reduces ownership repair');
    multiplyRegisterScore(scores, 'charismatic', 0.55, drivers, 'acceleration reduces disruption pressure');
    multiplyRegisterScore(scores, 'ironic', 0.4, drivers, 'warranted acceleration suppresses mismatch pressure');
    multiplyRegisterScore(scores, 'sarcastic', 0.2, drivers, 'warranted acceleration suppresses negative pressure');
    multiplyRegisterScore(scores, 'face_threat', 0.1, drivers, 'warranted acceleration suppresses face threat');
  }

  if (Number(features.field.delta) < -FIELD_PROGRESS_THRESHOLD) {
    addRegisterScore(scores, 'warm', 1.0, drivers, 'for negative field movement');
    addRegisterScore(scores, 'witnessing', 0.8, drivers, 'for increased learner risk');
  }
  if (features.dag.finalSecretEntailed || features.dag.assertedSecret) {
    addRegisterScore(scores, 'plain', 1.3, drivers, 'for closure');
    addRegisterScore(scores, 'precise', 1.0, drivers, 'for accountable closeout');
    multiplyRegisterScore(scores, 'sarcastic', 0.4, drivers, 'near closure');
    multiplyRegisterScore(scores, 'face_threat', 0.25, drivers, 'near closure');
  }

  const latest = latestRegisterSelection(state);
  if (latest?.selected_register) {
    const latestLabel = latest.efficacy?.label || features.latestEfficacy?.label || '';
    const factor = /regression_or_overreach/iu.test(latestLabel)
      ? 0.35
      : /no_clear_progress/iu.test(latestLabel)
        ? 0.55
        : 0.82;
    multiplyRegisterScore(scores, latest.selected_register, factor, drivers, 'recent repetition penalty');
  }
  for (const register of new Set(features.recentRegisters.filter(Boolean))) {
    if (recentRegisterCount(state, register) >= 2) {
      multiplyRegisterScore(scores, register, 0.5, drivers, 'last-four repetition penalty');
    }
  }
  if (!features.explicitStepwise && !features.advance?.accelerated) {
    multiplyRegisterScore(scores, 'brisk', 0.65, drivers, 'brisk remains non-default without explicit stepwise need');
  }

  return { features, scores, drivers };
}

// --- Engagement-stance distribution + sampling ---

function normalizeEngagementStanceDistribution(
  scores,
  { temperature = DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE } = {},
) {
  const sourceScores = Object.fromEntries(
    Object.entries(scores || {}).map(([register, weight]) => [register, Math.max(0.02, Number(weight) || 0)]),
  );
  const temperedScores = temperTutorStubEngagementStanceScores(sourceScores, { temperature });
  const weighted = Object.entries(temperedScores)
    .map(([register, weight]) => ({
      register,
      sourceWeight: sourceScores[register],
      weight,
    }))
    .sort((a, b) => b.weight - a.weight || a.register.localeCompare(b.register));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  return weighted.map((entry) => ({
    register: entry.register,
    weight: roundField(entry.weight),
    sourceWeight: roundField(entry.sourceWeight),
    probability: Number((entry.weight / total).toFixed(4)),
  }));
}

function sampleEngagementStanceDistribution(distribution) {
  const total = distribution.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  const randomValue = Math.random();
  const threshold = randomValue * total;
  let cumulative = 0;
  for (const entry of distribution) {
    cumulative += entry.weight;
    if (threshold <= cumulative) {
      return {
        entry,
        random: {
          method: 'Math.random',
          value: Number(randomValue.toFixed(6)),
          threshold: Number(threshold.toFixed(6)),
        },
      };
    }
  }
  return {
    entry: distribution[distribution.length - 1],
    random: {
      method: 'Math.random',
      value: Number(randomValue.toFixed(6)),
      threshold: Number(threshold.toFixed(6)),
    },
  };
}

// --- Trajectory window + finite-difference metrics ---

function finiteNumberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function roundOptionalField(value) {
  const numeric = finiteNumberOrNull(value);
  return numeric === null ? null : roundField(numeric);
}

function numberOr(value, fallback = 0) {
  const numeric = finiteNumberOrNull(value);
  return numeric === null ? fallback : numeric;
}

function dagProgressScalar(features) {
  const score =
    numberOr(features.bestPathCoverage) * 4 +
    numberOr(features.groundedCount) +
    numberOr(features.voicedDerivedCount) * 2 +
    numberOr(features.candidateConclusionCount) +
    numberOr(features.answerCandidateCount) * 3 -
    numberOr(features.missingPremiseCount) * 0.15 -
    numberOr(features.unsupportedAssertionCount) * 0.8;
  return roundField(score);
}

function dagRiskScalar(features) {
  const prematureAnswerRisk = features.assertedSecret && !features.finalSecretEntailed ? 2 : 0;
  return roundField(
    numberOr(features.missingPremiseCount) * 0.25 +
      numberOr(features.unsupportedAssertionCount) * 1.25 +
      prematureAnswerRisk,
  );
}

function trajectoryPointFromTurn(turn, index) {
  const fieldPoint = turn?.classification ? learnerSurfaceFieldPoint(turn.classification) : null;
  const dag = dagProgressFeatures(turn?.tutorLearnerDagModel || null);
  const advance =
    turn?.learnerAdvance || turn?.tutorLearnerDagUpdate?.advance || turn?.tutorLearnerDagModel?.learnerAdvance || null;
  return {
    turn: Number.isFinite(Number(turn?.turn)) ? Number(turn.turn) : index + 1,
    fieldScore: fieldPoint?.score ?? null,
    dagScore: dagProgressScalar(dag),
    riskScore: dagRiskScalar(dag),
    bottleneck: turn?.tutorLearnerDagModel?.assessment?.bottleneck || 'unknown',
    field: fieldPoint,
    dag,
    advance,
    advanceScore: Number(advance?.strength || 0),
  };
}

function trajectoryPointFromCurrent({ state, classification, tutorLearnerDag }) {
  const fieldPoint = learnerSurfaceFieldPoint(classification);
  const dag = dagProgressFeatures(tutorLearnerDag?.model || null);
  const advance = tutorLearnerDag?.advance || tutorLearnerDag?.model?.learnerAdvance || null;
  return {
    turn: tutorLearnerDag?.model?.turn ?? state.turns.length + 1,
    fieldScore: fieldPoint?.score ?? null,
    dagScore: dagProgressScalar(dag),
    riskScore: dagRiskScalar(dag),
    bottleneck: tutorLearnerDag?.model?.assessment?.bottleneck || 'unknown',
    field: fieldPoint,
    dag,
    advance,
    advanceScore: Number(advance?.strength || 0),
  };
}

function finitePointValues(points, key) {
  return points
    .map((point, index) => ({
      x: index,
      y: finiteNumberOrNull(point?.[key]),
    }))
    .filter((point) => point.y !== null);
}

function linearTrajectorySlope(points, key) {
  const values = finitePointValues(points, key);
  if (values.length < 2) return null;
  const meanX = values.reduce((sum, point) => sum + point.x, 0) / values.length;
  const meanY = values.reduce((sum, point) => sum + point.y, 0) / values.length;
  const denominator = values.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  if (!denominator) return null;
  const numerator = values.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
  return numerator / denominator;
}

function latestTrajectoryDelta(points, key) {
  const values = finitePointValues(points, key).map((point) => point.y);
  if (values.length < 2) return null;
  return values.at(-1) - values.at(-2);
}

function previousTrajectoryDelta(points, key) {
  const values = finitePointValues(points, key).map((point) => point.y);
  if (values.length < 3) return null;
  return values.at(-2) - values.at(-3);
}

function trajectoryMetric(points, key) {
  const values = finitePointValues(points, key).map((point) => point.y);
  const velocity = latestTrajectoryDelta(points, key);
  const previousVelocity = previousTrajectoryDelta(points, key);
  const acceleration = velocity !== null && previousVelocity !== null ? velocity - previousVelocity : null;
  return {
    current: roundOptionalField(values.at(-1)),
    previous: roundOptionalField(values.length >= 2 ? values.at(-2) : null),
    velocity: roundOptionalField(velocity),
    previousVelocity: roundOptionalField(previousVelocity),
    acceleration: roundOptionalField(acceleration),
    slope: roundOptionalField(linearTrajectorySlope(points, key)),
  };
}

function buildTrajectoryWindow({ state, classification, tutorLearnerDag, window = 4 }) {
  const historical = (state.turns || [])
    .filter((turn) => turn?.classification || turn?.tutorLearnerDagModel)
    .slice(-window)
    .map((turn, index) => trajectoryPointFromTurn(turn, index));
  const points = [...historical, trajectoryPointFromCurrent({ state, classification, tutorLearnerDag })];
  const field = trajectoryMetric(points, 'fieldScore');
  const dag = trajectoryMetric(points, 'dagScore');
  const risk = trajectoryMetric(points, 'riskScore');
  const advance = trajectoryMetric(points, 'advanceScore');
  const currentDag = points.at(-1)?.dag || {};
  const currentAdvance = points.at(-1)?.advance || null;
  const fieldSlope = numberOr(field.slope);
  const dagSlope = numberOr(dag.slope);
  const riskSlope = numberOr(risk.slope);
  const fieldVelocity = numberOr(field.velocity);
  const dagVelocity = numberOr(dag.velocity);
  const riskVelocity = numberOr(risk.velocity);
  const flags = {
    plateau: points.length >= 3 && Math.abs(fieldSlope) < 0.025 && Math.abs(dagSlope) < 0.25 && riskSlope >= -0.15,
    fieldRegression: points.length >= 2 && (fieldVelocity < -0.04 || fieldSlope < -0.025),
    riskRising: points.length >= 2 && (riskVelocity > 0.35 || riskSlope > 0.18),
    fieldOnlyDrift: points.length >= 3 && fieldSlope > 0.025 && dagSlope <= 0.2,
    dagOnlyDrift: points.length >= 3 && dagSlope > 0.25 && fieldSlope < 0.015,
    stableConvergence: points.length >= 3 && dagSlope > 0.2 && fieldSlope >= -0.015 && riskSlope <= 0.1,
    learnerAcceleration: currentAdvance?.accelerated === true,
    coerciveProgress:
      points.length >= 2 &&
      currentAdvance?.accelerated !== true &&
      (dagVelocity > 0.9 || dagSlope > 0.45) &&
      (fieldVelocity < -0.02 || fieldSlope < -0.02 || riskVelocity > 0.4 || riskSlope > 0.18),
    noisyAcceleration:
      points.length >= 3 &&
      (Math.abs(numberOr(field.acceleration)) > 0.08 ||
        Math.abs(numberOr(dag.acceleration)) > 1.25 ||
        Math.abs(numberOr(risk.acceleration)) > 0.75),
    nearClosure:
      currentDag.finalSecretEntailed === true ||
      currentDag.assertedSecret === true ||
      numberOr(currentDag.bestPathCoverage) >= 0.8,
  };
  return {
    schema: 'machinespirits.tutor-stub.register-trajectory.v1',
    window,
    pointCount: points.length,
    points: points.map((point) => ({
      turn: point.turn,
      fieldScore: roundOptionalField(point.fieldScore),
      dagScore: roundOptionalField(point.dagScore),
      riskScore: roundOptionalField(point.riskScore),
      advanceScore: roundOptionalField(point.advanceScore),
      bottleneck: point.bottleneck,
    })),
    field,
    dag,
    risk,
    advance,
    currentAdvance,
    flags,
  };
}

// --- Trajectory register policy ---

function buildTrajectoryRegisterScores({ state, classification, tutorLearnerDag }) {
  const base = buildFieldRegisterScores({ state, classification, tutorLearnerDag });
  const scores = { ...base.scores };
  const drivers = [...base.drivers];
  const trajectory = buildTrajectoryWindow({ state, classification, tutorLearnerDag });
  const flags = trajectory.flags || {};

  if (trajectory.pointCount < 3) {
    drivers.push('trajectory baseline: fewer than three points, mostly field policy');
  }
  if (flags.learnerAcceleration) {
    addRegisterScore(scores, 'brisk', 2.0, drivers, 'for observed learner-owned acceleration');
    addRegisterScore(scores, 'precise', 1.3, drivers, 'to test the next unresolved edge');
    multiplyRegisterScore(scores, 'warm', 0.7, drivers, 'acceleration reduces re-entry support');
    multiplyRegisterScore(scores, 'witnessing', 0.6, drivers, 'acceleration shows current learner ownership');
    multiplyRegisterScore(scores, 'charismatic', 0.6, drivers, 'acceleration reduces disruption need');
    multiplyRegisterScore(scores, 'ironic', 0.35, drivers, 'warranted acceleration suppresses mismatch pressure');
    multiplyRegisterScore(scores, 'sarcastic', 0.15, drivers, 'warranted acceleration suppresses negative pressure');
    multiplyRegisterScore(scores, 'face_threat', 0.08, drivers, 'warranted acceleration suppresses face threat');
  }
  if (flags.plateau) {
    addRegisterScore(scores, 'charismatic', 1.4, drivers, 'for flat recent trajectory');
    addRegisterScore(scores, 'precise', 0.9, drivers, 'for plateau warrant focus');
    addRegisterScore(scores, 'plain', 0.6, drivers, 'for plateau reset');
    addRegisterScore(scores, 'ironic', 0.35, drivers, 'for visible stuckness');
    multiplyRegisterScore(scores, 'brisk', 0.55, drivers, 'plateau is not a pacing problem');
  }
  if (flags.coerciveProgress) {
    addRegisterScore(scores, 'warm', 1.4, drivers, 'for coercive progress risk');
    addRegisterScore(scores, 'witnessing', 1.1, drivers, 'for proof movement without ownership');
    addRegisterScore(scores, 'plain', 0.8, drivers, 'for learner-owned say-back');
    addRegisterScore(scores, 'precise', 0.4, drivers, 'for accountable warrant');
    multiplyRegisterScore(scores, 'brisk', 0.4, drivers, 'coercive trajectory dampens speed');
    multiplyRegisterScore(scores, 'charismatic', 0.65, drivers, 'coercive trajectory dampens pressure');
    multiplyRegisterScore(scores, 'sarcastic', 0.25, drivers, 'coercive trajectory dampens negative register');
    multiplyRegisterScore(scores, 'face_threat', 0.15, drivers, 'coercive trajectory dampens negative register');
  } else if (flags.dagOnlyDrift) {
    addRegisterScore(scores, 'warm', 1.0, drivers, 'for DAG movement without field movement');
    addRegisterScore(scores, 'witnessing', 0.7, drivers, 'for ownership recovery');
    addRegisterScore(scores, 'plain', 0.8, drivers, 'for proof say-back');
  }
  if (flags.fieldOnlyDrift) {
    addRegisterScore(scores, 'plain', 1.2, drivers, 'for field movement awaiting proof-state conversion');
    addRegisterScore(scores, 'precise', 1.1, drivers, 'for trajectory warrant conversion');
    addRegisterScore(scores, 'brisk', 0.3, drivers, 'for convergent field-to-DAG handoff');
  }
  if (flags.stableConvergence && !flags.coerciveProgress) {
    addRegisterScore(scores, 'precise', 0.9, drivers, 'for stable field/DAG convergence');
    addRegisterScore(scores, 'plain', 0.7, drivers, 'for portable consolidation');
    addRegisterScore(scores, 'brisk', 0.45, drivers, 'for controlled convergent momentum');
  }
  if (flags.riskRising) {
    addRegisterScore(scores, 'warm', 1.2, drivers, 'for rising trajectory risk');
    addRegisterScore(scores, 'witnessing', 1.0, drivers, 'for rising affective or warrant risk');
    addRegisterScore(scores, 'precise', 0.8, drivers, 'for risk-bounded warrant check');
    multiplyRegisterScore(scores, 'brisk', 0.55, drivers, 'risk rising dampens speed');
    multiplyRegisterScore(scores, 'sarcastic', 0.35, drivers, 'risk rising dampens negative register');
    multiplyRegisterScore(scores, 'face_threat', 0.2, drivers, 'risk rising dampens negative register');
  }
  if (flags.fieldRegression) {
    addRegisterScore(scores, 'warm', 0.8, drivers, 'for learner-field regression');
    addRegisterScore(scores, 'witnessing', 0.7, drivers, 'for learner-field regression');
    addRegisterScore(scores, 'plain', 0.5, drivers, 'for regression reset');
  }
  if (flags.noisyAcceleration) {
    addRegisterScore(scores, 'plain', 0.6, drivers, 'for unstable trajectory');
    addRegisterScore(scores, 'warm', 0.5, drivers, 'for unstable trajectory');
    multiplyRegisterScore(scores, 'brisk', 0.7, drivers, 'unstable trajectory dampens speed');
    multiplyRegisterScore(scores, 'face_threat', 0.4, drivers, 'unstable trajectory dampens stress');
  }
  if (flags.nearClosure && !flags.riskRising) {
    addRegisterScore(scores, 'plain', 1.1, drivers, 'for near-closure trajectory');
    addRegisterScore(scores, 'precise', 1.0, drivers, 'for near-closure warrant');
    multiplyRegisterScore(scores, 'sarcastic', 0.35, drivers, 'near-closure trajectory');
    multiplyRegisterScore(scores, 'face_threat', 0.2, drivers, 'near-closure trajectory');
  }

  return {
    features: base.features,
    trajectory,
    scores,
    drivers,
    baseScores: base.scores,
    baseDrivers: base.drivers,
  };
}

// --- Dynamical-system register policy ---

const DYNAMICAL_SYSTEM_TEMPERATURE = DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE;

const DYNAMICAL_SYSTEM_BASE_WEIGHTS = {
  plain: 1.05,
  precise: 1.1,
  brisk: 0.55,
  warm: 0.9,
  witnessing: 0.5,
  charismatic: 0.75,
  ironic: 0.2,
  sarcastic: 0.05,
  face_threat: 0.02,
};

const DYNAMICAL_SYSTEM_REGISTER_AFFINITY = {
  plain: {
    evidence_gap: 0.45,
    agency_deficit: 0.45,
    integration_need: 1.35,
    compression_need: 1.4,
    language_opacity: 1.8,
    closure_pressure: 0.75,
    empirical_uncertainty: 0.25,
  },
  precise: {
    evidence_gap: 1.0,
    warrant_gap: 1.65,
    integration_need: 0.45,
    language_opacity: 0.4,
    momentum: 0.4,
    closure_pressure: 1.0,
    empirical_uncertainty: 0.15,
  },
  brisk: {
    evidence_gap: 0.4,
    momentum: 1.35,
    tempo_affordance: 1.9,
    closure_pressure: 0.35,
    affective_risk: -1.15,
    coercion_risk: -1.35,
    empirical_uncertainty: -0.45,
    language_opacity: -0.8,
  },
  warm: {
    evidence_gap: 0.2,
    agency_deficit: 0.95,
    affective_risk: 1.55,
    recognition_pressure: 0.65,
    coercion_risk: 1.25,
    field_regression: 0.85,
    language_opacity: 1.2,
  },
  witnessing: {
    agency_deficit: 0.5,
    affective_risk: 1.9,
    recognition_pressure: 0.75,
    coercion_risk: 1.65,
    field_regression: 0.7,
    momentum: -0.55,
    closure_pressure: -0.25,
    language_opacity: 0.2,
  },
  charismatic: {
    agency_deficit: 1.35,
    recognition_pressure: 0.85,
    stagnation: 1.2,
    disruption_need: 1.15,
    integration_need: 0.25,
    affective_risk: -0.45,
    coercion_risk: -0.65,
    language_opacity: -2.0,
  },
  ironic: {
    warrant_gap: 0.7,
    stagnation: 0.75,
    disruption_need: 0.9,
    recognition_pressure: 0.25,
    affective_risk: -0.9,
    coercion_risk: -0.85,
    empirical_uncertainty: -0.25,
    language_opacity: -1.5,
  },
  sarcastic: {
    warrant_gap: 0.2,
    stagnation: 0.35,
    disruption_need: 0.35,
    affective_risk: -1.5,
    coercion_risk: -1.5,
    closure_pressure: -0.55,
    empirical_uncertainty: -0.7,
    language_opacity: -2.0,
  },
  face_threat: {
    agency_deficit: 0.15,
    disruption_need: 0.2,
    affective_risk: -2.0,
    coercion_risk: -2.0,
    closure_pressure: -0.8,
    empirical_uncertainty: -1.0,
    language_opacity: -2.5,
  },
};

function axisValue(value, fallback = 0.5) {
  const numeric = finiteNumberOrNull(value);
  return numeric === null ? fallback : clampField01(numeric);
}

function signalMatches(pattern, values) {
  return pattern.test(values.filter(Boolean).join(' '));
}

function positivePart(value, scale = 1) {
  const numeric = finiteNumberOrNull(value);
  if (numeric === null) return 0;
  return Math.max(0, numeric * scale);
}

function topNumericEntries(object, { limit = 5, abs = false } = {}) {
  return Object.entries(object || {})
    .filter(([, value]) => Number.isFinite(Number(value)))
    .sort((a, b) => {
      const av = abs ? Math.abs(Number(a[1])) : Number(a[1]);
      const bv = abs ? Math.abs(Number(b[1])) : Number(b[1]);
      return bv - av || a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([key, value]) => `${key}=${roundField(value)}`);
}

function buildDynamicalSystemState({ state, classification, tutorLearnerDag }) {
  const features = fieldRegisterPolicyFeatures({ state, classification, tutorLearnerDag });
  const trajectory = buildTrajectoryWindow({ state, classification, tutorLearnerDag });
  const dims = features.field?.dimensions || {};
  const conceptual = axisValue(dims.conceptual);
  const epistemic = axisValue(dims.epistemic);
  const evidence = axisValue(dims.evidence);
  const agency = axisValue(dims.agency);
  const bestPathCoverage = axisValue(features.dag.bestPathCoverage, 0);
  const missingNeed = clampField01(numberOr(features.dag.missingPremiseCount) / 6);
  const unsupportedNeed = clampField01(numberOr(features.dag.unsupportedAssertionCount) / 3);
  const signalValues = [
    features.requestType,
    features.discourseMove,
    features.evidenceUse,
    features.epistemicStance,
    features.agency,
    features.affect,
    features.dag.bottleneck,
  ];
  const requestSignal = signalValues.join(' ');
  const flags = trajectory.flags || {};
  const learnerAcceleration =
    features.dag.finalSecretEntailed || features.dag.assertedSecret
      ? 0
      : clampField01(Number(features.advance?.strength || 0));
  const explicitAffective = signalMatches(
    /vulnerability_or_moral_exposure|affective_signal|vulnerable|shame|anxious|risk/iu,
    signalValues,
  );
  const answerSeeking = signalMatches(/answer_seeking|overconfident|passive|complying/iu, signalValues);
  const resistance = signalMatches(/resistance_or_low_agency|resistant|challenge|authority_refusal/iu, signalValues);
  const plainNeed = signalMatches(
    /plain_language_request|plain_simplification_followup|transfer_demand_or_named_material/iu,
    signalValues,
  );
  const languageOpacity = clampField01(Number(features.comprehension?.languageOpacity || 0));
  const overreach = signalMatches(
    /omits_warrant|overleaps_evidence|distorts_public_evidence|unsupported|premature_assertion/iu,
    signalValues,
  );
  const learnerIntegrationGap = features.dag.bottleneck === 'learner_integration_gap';
  const assertionGap = features.dag.bottleneck === 'assertion_gap';
  const releaseGap = /release_or_pacing_gap|inference_gap/iu.test(features.dag.bottleneck);
  const surface = meanFinite([conceptual, epistemic, evidence, agency]) ?? 0.5;
  const lowSurface = clampField01(1 - surface);

  const affectiveRisk = clampField01(
    (explicitAffective ? 0.5 : 0) +
      (flags.riskRising ? 0.25 : 0) +
      (flags.fieldRegression ? 0.2 : 0) +
      clampField01(numberOr(trajectory.risk?.current) / 3) * 0.2,
  );
  const coercionRisk = clampField01(
    (flags.coerciveProgress ? 0.55 : 0) +
      (flags.dagOnlyDrift ? 0.2 : 0) +
      (answerSeeking ? 0.15 : 0) +
      affectiveRisk * 0.2 -
      learnerAcceleration * 0.45,
  );
  const agencyDeficit = clampField01(1 - agency + (answerSeeking ? 0.25 : 0) + (resistance ? 0.15 : 0));
  const evidenceGap = clampField01(
    (1 - bestPathCoverage) * 0.45 + missingNeed * 0.35 + (1 - evidence) * 0.15 + (releaseGap ? 0.15 : 0),
  );
  const warrantGap = clampField01(
    unsupportedNeed * 0.35 +
      (overreach ? 0.3 : 0) +
      (features.dag.assertedSecret && !features.dag.finalSecretEntailed ? 0.3 : 0) +
      (assertionGap ? 0.25 : 0) +
      (1 - epistemic) * 0.1,
  );
  const recognitionPressure = clampField01(
    agencyDeficit * 0.35 +
      (resistance ? 0.25 : 0) +
      (answerSeeking ? 0.25 : 0) +
      coercionRisk * 0.25 +
      affectiveRisk * 0.15,
  );
  const integrationNeed = clampField01(
    lowSurface * 0.35 +
      (flags.fieldOnlyDrift ? 0.25 : 0) +
      (learnerIntegrationGap ? 0.25 : 0) +
      (plainNeed ? 0.2 : 0) +
      languageOpacity * 0.25 -
      learnerAcceleration * 0.3,
  );
  const compressionNeed = clampField01(
    (plainNeed ? 0.5 : 0) + languageOpacity * 0.35 + lowSurface * 0.35 + (features.dag.finalSecretEntailed ? 0.15 : 0),
  );
  const momentum = clampField01(
    positivePart(trajectory.field?.slope, 4) * 0.2 +
      positivePart(trajectory.dag?.slope, 0.5) * 0.25 +
      (flags.stableConvergence ? 0.35 : 0) +
      learnerAcceleration * 0.45 +
      (features.explicitStepwise ? 0.2 : 0) -
      affectiveRisk * 0.25 -
      coercionRisk * 0.25,
  );
  const stagnation = clampField01(
    (flags.plateau ? 0.5 : 0) +
      (features.field.relation === 'neither_progress' ? 0.25 : 0) +
      (latestRegisterEfficacy(state)?.label === 'no_clear_progress' ? 0.2 : 0) +
      (Math.abs(numberOr(trajectory.field?.velocity)) < 0.02 && Math.abs(numberOr(trajectory.dag?.velocity)) < 0.2
        ? 0.15
        : 0),
  );
  const closurePressure = clampField01(
    (flags.nearClosure ? 0.45 : 0) +
      bestPathCoverage * 0.35 +
      (assertionGap ? 0.2 : 0) +
      (features.dag.finalSecretEntailed ? 0.25 : 0),
  );
  const disruptionNeed = clampField01(
    stagnation * 0.5 + (resistance ? 0.25 : 0) + agencyDeficit * 0.2 - affectiveRisk * 0.35 - coercionRisk * 0.35,
  );
  const tempoAffordance = clampField01(
    momentum * (1 - affectiveRisk) * (1 - coercionRisk) +
      (features.explicitStepwise ? 0.25 : 0) +
      learnerAcceleration * 0.4,
  );
  const fieldRegression = clampField01(
    (flags.fieldRegression ? 0.6 : 0) + Math.max(0, -numberOr(trajectory.field?.velocity)) * 3,
  );
  const empiricalEvidenceCount = (state.register?.history || []).filter((entry) => entry.efficacy).length;
  const empiricalUncertainty = clampField01(1 - Math.min(1, empiricalEvidenceCount / 4));

  const stateVector = {
    evidence_gap: evidenceGap,
    warrant_gap: warrantGap,
    agency_deficit: agencyDeficit,
    affective_risk: affectiveRisk,
    recognition_pressure: recognitionPressure,
    coercion_risk: coercionRisk,
    integration_need: integrationNeed,
    compression_need: compressionNeed,
    language_opacity: languageOpacity,
    momentum,
    stagnation,
    disruption_need: disruptionNeed,
    tempo_affordance: tempoAffordance,
    closure_pressure: closurePressure,
    field_regression: fieldRegression,
    empirical_uncertainty: empiricalUncertainty,
    learner_acceleration: learnerAcceleration,
  };
  const derivativeVector = {
    field_velocity: trajectory.field.velocity,
    field_slope: trajectory.field.slope,
    field_acceleration: trajectory.field.acceleration,
    dag_velocity: trajectory.dag.velocity,
    dag_slope: trajectory.dag.slope,
    dag_acceleration: trajectory.dag.acceleration,
    risk_velocity: trajectory.risk.velocity,
    risk_slope: trajectory.risk.slope,
    risk_acceleration: trajectory.risk.acceleration,
  };
  const attractors = {
    recognition_safety: roundField(Math.max(affectiveRisk, coercionRisk)),
    learner_ownership: roundField(Math.max(agencyDeficit, flags.dagOnlyDrift ? 0.7 : 0)),
    evidence_grounding: roundField(Math.max(evidenceGap, warrantGap)),
    accountable_closure: closurePressure,
    productive_disruption: disruptionNeed,
    controlled_pace: tempoAffordance,
  };
  return {
    schema: 'machinespirits.tutor-stub.dynamical-system-state.v1',
    features,
    trajectory,
    raw_signal: requestSignal,
    state_vector: Object.fromEntries(Object.entries(stateVector).map(([key, value]) => [key, roundField(value)])),
    derivative_vector: derivativeVector,
    attractors,
  };
}

function empiricalRegisterCorrections(state, palette) {
  const corrections = Object.fromEntries((palette || []).map((register) => [register, 0]));
  const evidence = [];
  const entries = (state.register?.history || [])
    .map((entry) => normalizeStoredRegisterSelection(entry))
    .filter((entry) => entry?.selected_register && entry.efficacy && corrections[entry.selected_register] !== undefined)
    .slice(-8);
  entries.forEach((entry, index) => {
    const efficacy = normalizeStoredRegisterEfficacy(entry.efficacy);
    const recency = (index + 1) / entries.length;
    const progress = Math.max(-1, Math.min(1, numberOr(efficacy.progressScore) / 4));
    const fieldDelta = Math.max(-1, Math.min(1, numberOr(efficacy.field?.delta) * 4));
    const labelAdjustment =
      efficacy.label === 'positive_progress' ? 0.15 : efficacy.label === 'regression_or_overreach' ? -0.35 : -0.08;
    const update = recency * (0.45 * progress + 0.25 * fieldDelta + labelAdjustment);
    corrections[entry.selected_register] += update;
    evidence.push({
      turn: entry.turn,
      register: entry.selected_register,
      label: efficacy.label,
      progressScore: efficacy.progressScore,
      fieldDelta: efficacy.field?.delta ?? null,
      correction: roundField(update),
    });
  });
  return {
    schema: 'machinespirits.tutor-stub.register-empirical-corrections.v1',
    source: 'within_dialogue_next_turn_efficacy',
    corrections: Object.fromEntries(
      Object.entries(corrections).map(([register, value]) => [register, roundField(value)]),
    ),
    evidence,
  };
}

function emptyCorpusRegisterCorrections(palette, reason = 'not_enabled') {
  return {
    schema: 'machinespirits.tutor-stub.corpus-register-corrections.v1',
    enabled: false,
    reason,
    corrections: Object.fromEntries((palette || []).map((register) => [register, 0])),
    evidence: [],
  };
}

function corpusContextKeys(features) {
  return [
    features.requestType ? `request_type:${features.requestType}` : null,
    features.discourseMove ? `discourse_move:${features.discourseMove}` : null,
    features.evidenceUse ? `evidence_use:${features.evidenceUse}` : null,
    features.epistemicStance ? `epistemic_stance:${features.epistemicStance}` : null,
    features.agency ? `agency:${features.agency}` : null,
    features.dag?.bottleneck ? `bottleneck:${features.dag.bottleneck}` : null,
  ].filter(Boolean);
}

function corpusPriorRowAdjustment(row) {
  return numberOr(row?.logitAdjustment);
}

function corpusEmpiricalRegisterCorrections({ state, palette, system, features, enabled }) {
  if (!enabled) return emptyCorpusRegisterCorrections(palette);
  const prior = state.register?.empiricalPrior || null;
  if (!prior) return emptyCorpusRegisterCorrections(palette, 'missing_prior');
  const corrections = Object.fromEntries((palette || []).map((register) => [register, 0]));
  const evidence = [];
  const contextKeys = corpusContextKeys(features);
  const highAxes = Object.entries(system.state_vector || {}).filter(([, value]) => Number(value) >= 0.55);

  for (const register of palette || []) {
    const overall = prior.registerPriors?.[register] || null;
    if (overall) {
      const adjustment = corpusPriorRowAdjustment(overall);
      corrections[register] += adjustment;
      evidence.push({
        type: 'overall',
        register,
        n: overall.n,
        meanOutcome: overall.meanOutcome,
        adjustment: roundField(adjustment),
      });
    }
    for (const [axis, value] of highAxes) {
      const row = prior.axisPriors?.[axis]?.[register] || null;
      if (!row) continue;
      const adjustment = Number(value) * corpusPriorRowAdjustment(row);
      corrections[register] += adjustment;
      evidence.push({
        type: 'axis',
        axis,
        register,
        value: roundField(value),
        n: row.n,
        meanOutcome: row.meanOutcome,
        adjustment: roundField(adjustment),
      });
    }
    for (const key of contextKeys) {
      const row = prior.contextPriors?.[key]?.[register] || null;
      if (!row) continue;
      const adjustment = corpusPriorRowAdjustment(row);
      corrections[register] += adjustment;
      evidence.push({
        type: 'context',
        key,
        register,
        n: row.n,
        meanOutcome: row.meanOutcome,
        adjustment: roundField(adjustment),
      });
    }
  }

  return {
    schema: 'machinespirits.tutor-stub.corpus-register-corrections.v1',
    enabled: true,
    priorSchema: prior.schema || null,
    generatedAt: prior.generatedAt || null,
    source: prior.source || null,
    contextKeys,
    highAxes: highAxes.map(([axis, value]) => ({ axis, value: roundField(value) })),
    corrections: Object.fromEntries(
      Object.entries(corrections).map(([register, value]) => [register, roundField(value)]),
    ),
    evidence: evidence.sort((a, b) => Math.abs(numberOr(b.adjustment)) - Math.abs(numberOr(a.adjustment))).slice(0, 30),
  };
}

function registerAffinityContributions(register, stateVector) {
  const affinity = DYNAMICAL_SYSTEM_REGISTER_AFFINITY[register] || {};
  return Object.entries(affinity)
    .map(([axis, weight]) => ({
      axis,
      weight,
      value: numberOr(stateVector[axis]),
      contribution: numberOr(stateVector[axis]) * Number(weight),
    }))
    .filter((row) => row.contribution !== 0)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution) || a.axis.localeCompare(b.axis));
}

function dynamicalGuardAdjustment(register, system, features, drivers) {
  const vector = system.state_vector || {};
  let adjustment = 0;
  const comprehensionPressure = numberOr(features.comprehension?.pressure);
  if (comprehensionPressure > 0 && register === 'charismatic') {
    adjustment -= 1.5 * comprehensionPressure;
    drivers.push(`charismatic-${roundField(1.5 * comprehensionPressure)} comprehension-pressure guard`);
  }
  if (comprehensionPressure > 0 && ['ironic', 'sarcastic', 'face_threat'].includes(register)) {
    adjustment -= 1.8 * comprehensionPressure;
    drivers.push(`${register}-${roundField(1.8 * comprehensionPressure)} comprehension-pressure guard`);
  }
  if (register === 'brisk' && !features.explicitStepwise) {
    adjustment -= 0.45;
    drivers.push('brisk-0.45 no explicit stepwise request');
  }
  if (register === 'brisk' && (numberOr(vector.affective_risk) > 0.55 || numberOr(vector.coercion_risk) > 0.45)) {
    adjustment -= 0.7;
    drivers.push('brisk-0.70 high safety/coercion risk');
  }
  if (['ironic', 'sarcastic', 'face_threat'].includes(register) && numberOr(vector.affective_risk) > 0.45) {
    adjustment -= register === 'ironic' ? 0.55 : 1.05;
    drivers.push(`${register}-${register === 'ironic' ? '0.55' : '1.05'} affective risk guard`);
  }
  if (['sarcastic', 'face_threat'].includes(register) && numberOr(vector.coercion_risk) > 0.35) {
    adjustment -= 1.1;
    drivers.push(`${register}-1.10 coercion risk guard`);
  }
  if (['sarcastic', 'face_threat'].includes(register) && numberOr(vector.empirical_uncertainty) > 0.5) {
    adjustment -= 0.45;
    drivers.push(`${register}-0.45 empirical uncertainty guard`);
  }
  if (features.dag.finalSecretEntailed && ['sarcastic', 'face_threat'].includes(register)) {
    adjustment -= 0.7;
    drivers.push(`${register}-0.70 closure guard`);
  }
  return adjustment;
}

function logitsToRegisterScores(logits, { temperature = DYNAMICAL_SYSTEM_TEMPERATURE } = {}) {
  const entries = Object.entries(logits);
  const maxLogit = entries.reduce((max, [, value]) => Math.max(max, Number(value)), Number.NEGATIVE_INFINITY);
  return Object.fromEntries(
    entries.map(([register, logit]) => [register, Math.exp((Number(logit) - maxLogit) / temperature) * 10]),
  );
}

function buildDynamicalSystemRegisterScores({ state, classification, tutorLearnerDag, useCorpusPrior = false }) {
  const system = buildDynamicalSystemState({ state, classification, tutorLearnerDag });
  const features = system.features;
  const trajectory = system.trajectory;
  const palette = state.register?.palette || [];
  const empirical = empiricalRegisterCorrections(state, palette);
  const corpusEmpirical = corpusEmpiricalRegisterCorrections({
    state,
    palette,
    system,
    features,
    enabled: useCorpusPrior,
  });
  const logits = {};
  const drivers = [
    `state: ${topNumericEntries(system.state_vector, { limit: 5 }).join(', ') || 'none'}`,
    `derivatives: fieldSlope=${trajectory.field.slope ?? 'n/a'}, dagSlope=${trajectory.dag.slope ?? 'n/a'}, riskSlope=${
      trajectory.risk.slope ?? 'n/a'
    }`,
  ];

  for (const register of palette) {
    const base = Math.max(0.01, DYNAMICAL_SYSTEM_BASE_WEIGHTS[register] ?? 0.25);
    const affinity = DYNAMICAL_SYSTEM_REGISTER_AFFINITY[register] || {};
    let logit = Math.log(base);
    for (const [axis, value] of Object.entries(system.state_vector)) {
      logit += numberOr(value) * numberOr(affinity[axis]);
    }
    logit += numberOr(empirical.corrections[register]);
    logit += numberOr(corpusEmpirical.corrections[register]);
    logit += dynamicalGuardAdjustment(register, system, features, drivers);
    const recentCount = recentRegisterCount(state, register, { limit: 4 });
    if (recentCount >= 2) {
      logit -= 0.45;
      drivers.push(`${register}-0.45 repeated in recent window`);
    } else if (latestRegisterSelection(state)?.selected_register === register) {
      logit -= 0.25;
      drivers.push(`${register}-0.25 immediate repetition`);
    }
    logits[register] = logit;
  }

  return {
    features,
    trajectory,
    system,
    empirical,
    corpusEmpirical,
    logits,
    scores: logitsToRegisterScores(logits, { temperature: state.register?.temperature }),
    drivers,
  };
}

// --- State register policy ---

const STATE_REGISTER_BASE_WEIGHTS = {
  plain: 1.15,
  precise: 1.2,
  brisk: 0.55,
  warm: 0.9,
  witnessing: 0.55,
  charismatic: 0.8,
  ironic: 0.22,
  sarcastic: 0.08,
  face_threat: 0.03,
};

function stateRegisterPolicyFeatures({ state, classification, tutorLearnerDag }) {
  const turn = classification?.turn || {};
  const scores = turn.scores || {};
  const assessment = tutorLearnerDag?.model?.assessment || {};
  const metrics = tutorLearnerDag?.model?.metrics || {};
  const conceptual = normalizedClassifierScore(scores.conceptual_engagement);
  const readiness = normalizedClassifierScore(scores.epistemic_readiness);
  const turnNumber = tutorLearnerDag?.model?.turn ?? state.turns.length + 1;
  const advance = tutorLearnerDag?.advance || tutorLearnerDag?.model?.learnerAdvance || null;
  return {
    turn: turnNumber,
    requestType: turn.request_type || 'unknown_request',
    discourseMove: turn.discourse_move || 'unknown',
    evidenceUse: turn.evidence_use || 'unknown',
    epistemicStance: turn.epistemic_stance || 'unknown',
    agency: turn.agency || 'unknown',
    affect: turn.affect || 'unknown',
    scores: {
      conceptual,
      epistemicReadiness: readiness,
      learnerSurface: meanFinite([conceptual, readiness]),
    },
    dag: {
      bottleneck: assessment.bottleneck || 'unknown',
      bestPathCoverage: Number(assessment.bestPathCoverage || 0),
      missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
      groundedCount: Number(metrics.groundedCount || 0),
      voicedDerivedCount: Number(metrics.voicedDerivedCount || 0),
      unsupportedAssertionCount: Number(assessment.unsupportedAssertionCount || 0),
      finalSecretEntailed: assessment.finalSecretEntailed === true,
      assertedSecret: assessment.assertedSecret === true,
      assertedMirror: assessment.assertedMirror === true,
    },
    advance,
    explicitStepwise: hasExplicitStepwiseSignal(classification),
    comprehension: tutorStubComprehensionFeatures(state.comprehension, { turn: turnNumber }),
    recentRegisters: (state.register?.history || [])
      .slice(-4)
      .map((entry) => normalizeStoredRegisterSelection(entry)?.selected_register),
  };
}

function buildStateRegisterScores({ state, classification, tutorLearnerDag }) {
  const palette = state.register?.palette || [];
  const scores = Object.fromEntries(
    palette.map((register) => [register, STATE_REGISTER_BASE_WEIGHTS[register] ?? 0.35]),
  );
  const drivers = [];
  const features = stateRegisterPolicyFeatures({ state, classification, tutorLearnerDag });
  const signal = [
    features.requestType,
    features.discourseMove,
    features.evidenceUse,
    features.epistemicStance,
    features.agency,
    features.affect,
    features.dag.bottleneck,
  ]
    .filter(Boolean)
    .join(' ');
  const comprehensionPressure = Number(features.comprehension?.pressure || 0);

  if (comprehensionPressure > 0) {
    addRegisterScore(scores, 'plain', 2.8 * comprehensionPressure, drivers, 'for current comprehension gap');
    addRegisterScore(scores, 'warm', 1.4 * comprehensionPressure, drivers, 'for current vocabulary re-entry');
    addRegisterScore(scores, 'precise', 0.45 * comprehensionPressure, drivers, 'for one exact gloss');
    multiplyRegisterScore(
      scores,
      'charismatic',
      Math.max(0.15, 1 - 0.8 * comprehensionPressure),
      drivers,
      'comprehension gap suppresses challenge',
    );
    multiplyRegisterScore(scores, 'ironic', 0.25, drivers, 'comprehension gap suppresses irony');
    multiplyRegisterScore(scores, 'sarcastic', 0.1, drivers, 'comprehension gap suppresses sarcasm');
    multiplyRegisterScore(scores, 'face_threat', 0.05, drivers, 'comprehension gap suppresses face threat');
  }

  if (features.dag.finalSecretEntailed || features.dag.assertedSecret) {
    addRegisterScore(scores, 'plain', 2.0, drivers, 'for current closure state');
    addRegisterScore(scores, 'precise', 1.8, drivers, 'for accountable closeout');
    multiplyRegisterScore(scores, 'ironic', 0.5, drivers, 'closure dampening');
    multiplyRegisterScore(scores, 'sarcastic', 0.25, drivers, 'closure dampening');
    multiplyRegisterScore(scores, 'face_threat', 0.1, drivers, 'closure dampening');
  }
  if (/release_or_pacing_gap|inference_gap/iu.test(features.dag.bottleneck)) {
    addRegisterScore(scores, 'precise', 1.4, drivers, 'for current proof bottleneck');
    addRegisterScore(scores, 'plain', 0.9, drivers, 'for portable evidence wording');
    if (features.explicitStepwise) {
      addRegisterScore(scores, 'brisk', 1.5, drivers, 'for explicit stepwise request');
    } else {
      addRegisterScore(scores, 'brisk', 0.25, drivers, 'for proof bottleneck without explicit pacing request');
    }
  }
  if (features.dag.bottleneck === 'learner_integration_gap') {
    addRegisterScore(scores, 'plain', 1.7, drivers, 'for learner integration');
    addRegisterScore(scores, 'precise', 1.1, drivers, 'for warrant integration');
    addRegisterScore(scores, 'warm', 0.8, drivers, 'for ownership recovery');
  }
  if (features.dag.bottleneck === 'assertion_gap') {
    addRegisterScore(scores, 'plain', 1.6, drivers, 'for final say-back');
    addRegisterScore(scores, 'precise', 1.2, drivers, 'for licensed assertion');
    addRegisterScore(scores, 'charismatic', 0.6, drivers, 'for final commitment pressure');
  }
  if (features.dag.bottleneck === 'premature_assertion') {
    addRegisterScore(scores, 'precise', 2.0, drivers, 'for premature assertion');
    addRegisterScore(scores, 'charismatic', 1.0, drivers, 'to interrupt answer-first closure');
    addRegisterScore(scores, 'ironic', 0.45, drivers, 'for visible warrant gap');
  }
  if (
    /conceptual_clarity_request|challenge|omits_warrant|overleaps_evidence|distorts_public_evidence|unsupported/iu.test(
      signal,
    )
  ) {
    addRegisterScore(scores, 'precise', 1.8, drivers, 'for current distinction or warrant issue');
    addRegisterScore(scores, 'ironic', 0.35, drivers, 'for current mismatch');
  }
  if (/plain_language_request|plain_simplification_followup|transfer_demand_or_named_material/iu.test(signal)) {
    addRegisterScore(scores, 'plain', 2.0, drivers, 'for current plain-language need');
    addRegisterScore(scores, 'warm', 0.65, drivers, 'for current re-entry need');
  }
  if (/vulnerability_or_moral_exposure|affective_signal|vulnerable|shame|anxious|risk/iu.test(signal)) {
    addRegisterScore(scores, 'witnessing', 2.8, drivers, 'for current affective exposure');
    addRegisterScore(scores, 'warm', 1.2, drivers, 'for current affective risk');
  }
  if (/resistance_or_low_agency|resistant|answer_seeking|overconfident|passive|complying/iu.test(signal)) {
    addRegisterScore(scores, 'charismatic', 2.0, drivers, 'for current low-agency state');
    addRegisterScore(scores, 'plain', 0.8, drivers, 'for small public commitment');
    addRegisterScore(scores, 'precise', 0.7, drivers, 'for accountable warrant');
    addRegisterScore(scores, 'ironic', 0.25, drivers, 'for current rote-performance gap');
  }
  if (Number(features.scores.conceptual) <= 0.25 || Number(features.scores.epistemicReadiness) <= 0.25) {
    addRegisterScore(scores, 'plain', 0.9, drivers, 'for low current surface engagement');
    addRegisterScore(scores, 'warm', 0.55, drivers, 'for low current readiness');
  }
  if (/links_evidence_to_rule|revises_from_evidence|grounded|self_correcting/iu.test(signal)) {
    addRegisterScore(scores, 'precise', 0.9, drivers, 'for current grounded evidence use');
    addRegisterScore(scores, 'brisk', 0.55, drivers, 'for current momentum');
  }
  if (features.advance?.accelerated && !features.dag.finalSecretEntailed && !features.dag.assertedSecret) {
    addRegisterScore(scores, 'brisk', 2.2, drivers, 'for accepted multi-premise learner acceleration');
    addRegisterScore(scores, 'precise', 1.4, drivers, 'for the next unresolved distinction');
    multiplyRegisterScore(scores, 'warm', 0.7, drivers, 'acceleration reduces support need');
    multiplyRegisterScore(scores, 'witnessing', 0.6, drivers, 'acceleration shows learner ownership');
    multiplyRegisterScore(scores, 'charismatic', 0.6, drivers, 'acceleration reduces disruption need');
    multiplyRegisterScore(scores, 'ironic', 0.35, drivers, 'warranted acceleration suppresses mismatch pressure');
    multiplyRegisterScore(scores, 'sarcastic', 0.15, drivers, 'warranted acceleration suppresses negative pressure');
    multiplyRegisterScore(scores, 'face_threat', 0.08, drivers, 'warranted acceleration suppresses face threat');
  }

  const latest = latestRegisterSelection(state);
  if (latest?.selected_register) {
    multiplyRegisterScore(scores, latest.selected_register, 0.72, drivers, 'state-policy repetition penalty');
  }
  for (const register of new Set(features.recentRegisters.filter(Boolean))) {
    if (recentRegisterCount(state, register) >= 2) {
      multiplyRegisterScore(scores, register, 0.58, drivers, 'last-four repetition penalty');
    }
  }
  if (!features.explicitStepwise && !features.advance?.accelerated) {
    multiplyRegisterScore(scores, 'brisk', 0.55, drivers, 'brisk non-default without explicit stepwise need');
  }
  if (!features.dag.finalSecretEntailed) {
    multiplyRegisterScore(scores, 'sarcastic', 0.55, drivers, 'negative-register dampening under state policy');
    multiplyRegisterScore(scores, 'face_threat', 0.3, drivers, 'negative-register dampening under state policy');
  }

  return { features, scores, drivers };
}

// --- Shared numeric field helpers ---

function clampField01(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.max(0, Math.min(1, Number(value)));
}

function roundField(value) {
  return Number((Number(value) || 0).toFixed(3));
}

export {
  addRegisterScore,
  axisValue,
  buildDynamicalSystemRegisterScores,
  buildDynamicalSystemState,
  buildFieldRegisterScores,
  buildStateRegisterScores,
  buildTrajectoryRegisterScores,
  buildTrajectoryWindow,
  clampField01,
  classifyFieldStateRelation,
  corpusContextKeys,
  corpusEmpiricalRegisterCorrections,
  corpusPriorRowAdjustment,
  dagProgressFeatures,
  dagProgressScalar,
  dagRiskScalar,
  DYNAMICAL_SYSTEM_BASE_WEIGHTS,
  DYNAMICAL_SYSTEM_REGISTER_AFFINITY,
  DYNAMICAL_SYSTEM_TEMPERATURE,
  dynamicalGuardAdjustment,
  empiricalRegisterCorrections,
  emptyCorpusRegisterCorrections,
  FIELD_PROGRESS_THRESHOLD,
  FIELD_REGISTER_BASE_WEIGHTS,
  fieldProgressFromClassification,
  fieldRegisterPolicyFeatures,
  finiteNumberOrNull,
  finitePointValues,
  hasExplicitStepwiseSignal,
  hasScoreRegister,
  latestRegisterEfficacy,
  latestRegisterSelection,
  latestTrajectoryDelta,
  LEARNER_FIELD_RANKS,
  learnerDagDeltaForFieldPolicy,
  learnerSurfaceFieldPoint,
  linearTrajectorySlope,
  logitsToRegisterScores,
  meanFinite,
  multiplyRegisterScore,
  normalizedClassifierScore,
  normalizeEngagementStanceDistribution,
  normalizeStoredRegisterEfficacy,
  normalizeStoredRegisterSelection,
  numberOr,
  positivePart,
  preferredLegacyRegister,
  previousLearnerSurfaceFieldPoint,
  previousTrajectoryDelta,
  rankLearnerFieldLabel,
  recentRegisterCount,
  registerAffinityContributions,
  registerEfficacyFromDagProgress,
  registerSignalText,
  roundField,
  roundOptionalField,
  sampleEngagementStanceDistribution,
  scoreValue,
  signalMatches,
  STATE_REGISTER_BASE_WEIGHTS,
  stateRegisterPolicyFeatures,
  summarizeDagDeltas,
  topNumericEntries,
  trajectoryMetric,
  trajectoryPointFromCurrent,
  trajectoryPointFromTurn,
};
