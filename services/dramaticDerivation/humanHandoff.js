import { auditPublicOnlyInput, cleanPublicText } from './publicEvidence.js';
import { deriveTaskMasteryState } from './taskMastery.js';

export const HUMAN_HANDOFF_SCHEMA = 'dramatic-derivation.human-handoff.v0';
export const HUMAN_HANDOFF_PROBE_SCHEMA = 'dramatic-derivation.human-handoff-probe.v0';

export const HUMAN_HANDOFF_RECOMMENDATIONS = Object.freeze([
  'continue_system_support',
  'offer_optional_human_review',
  'recommend_human_followup',
  'immediate_human_review',
]);

const RECOMMENDATION_SET = new Set(HUMAN_HANDOFF_RECOMMENDATIONS);

function clamp01(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, +n.toFixed(2)));
}

function clampCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function norm(text) {
  return String(text || '')
    .trim()
    .toLowerCase();
}

function normalizeAffectRisk(value) {
  const risk = norm(value || 'low');
  if (['high', 'medium', 'low'].includes(risk)) return risk;
  return 'low';
}

function normalizeProofReliabilityIssue(value) {
  const issue = norm(value || 'none');
  if (
    ['none', 'low_confidence', 'proof_gate_failed', 'generator_unverified', 'audit_gap', 'policy_conflict'].includes(
      issue,
    )
  ) {
    return issue;
  }
  return 'none';
}

function signal(id, severity, detail) {
  return {
    id,
    severity,
    detail: cleanPublicText(detail, 220),
  };
}

function inputRequestedHuman(input = {}) {
  return Boolean(input.learnerRequestedHuman || input.humanRequested || input.teacherReviewRequested);
}

function collectHandoffSignals(input = {}, taskState) {
  const signals = [];
  const affectRisk = normalizeAffectRisk(input.affectRisk);
  const proofReliabilityIssue = normalizeProofReliabilityIssue(input.proofReliabilityIssue);
  const modelConfidence = clamp01(input.modelConfidence, 0.65);
  const repeatedNonUptake = Math.max(clampCount(input.repeatedNonUptake), taskState.repeatedNonUptake || 0);
  const selfRegulationScore = clamp01(input.selfRegulationScore, taskState.selfRegulationScore ?? 0.25);

  if (inputRequestedHuman(input)) {
    signals.push(signal('learner_requested_human', 'strong', 'learner or local operator requested human review'));
  }
  if (affectRisk === 'high') {
    signals.push(signal('high_affect_risk', 'strong', 'public affect risk is high'));
  } else if (affectRisk === 'medium') {
    signals.push(signal('medium_affect_risk', 'moderate', 'public affect risk is medium'));
  }
  if (repeatedNonUptake >= 2) {
    signals.push(signal('repeated_non_uptake', 'strong', `non-uptake count ${repeatedNonUptake}`));
  } else if (repeatedNonUptake === 1) {
    signals.push(signal('single_non_uptake', 'weak', 'one non-uptake event'));
  }
  if (selfRegulationScore < 0.2 && repeatedNonUptake >= 1) {
    signals.push(
      signal(
        'low_self_regulation_with_non_uptake',
        'strong',
        `self-regulation ${selfRegulationScore.toFixed(2)} with non-uptake`,
      ),
    );
  } else if (selfRegulationScore < 0.2) {
    signals.push(signal('low_self_regulation', 'moderate', `self-regulation ${selfRegulationScore.toFixed(2)}`));
  }
  if (['proof_gate_failed', 'policy_conflict'].includes(proofReliabilityIssue)) {
    signals.push(signal('proof_reliability_failure', 'strong', `proof reliability issue: ${proofReliabilityIssue}`));
  } else if (['low_confidence', 'generator_unverified', 'audit_gap'].includes(proofReliabilityIssue)) {
    signals.push(
      signal('proof_reliability_uncertain', 'moderate', `proof reliability issue: ${proofReliabilityIssue}`),
    );
  }
  if (modelConfidence < 0.35) {
    signals.push(signal('low_model_confidence', 'moderate', `model confidence ${modelConfidence.toFixed(2)}`));
  }
  if (taskState.nextTaskRecommendation === 'human_followup') {
    signals.push(signal('task_loop_human_followup', 'strong', 'task/session selector recommended human followup'));
  }

  return { signals, affectRisk, proofReliabilityIssue, modelConfidence, repeatedNonUptake, selfRegulationScore };
}

function recommendationFor({ signals }) {
  const ids = new Set(signals.map((row) => row.id));
  if (ids.has('high_affect_risk')) return 'immediate_human_review';
  if (
    ids.has('learner_requested_human') ||
    ids.has('repeated_non_uptake') ||
    ids.has('low_self_regulation_with_non_uptake') ||
    ids.has('proof_reliability_failure') ||
    ids.has('task_loop_human_followup')
  ) {
    return 'recommend_human_followup';
  }
  if (
    ids.has('medium_affect_risk') ||
    ids.has('proof_reliability_uncertain') ||
    ids.has('low_model_confidence') ||
    ids.has('low_self_regulation')
  ) {
    return 'offer_optional_human_review';
  }
  return 'continue_system_support';
}

function helperFor(recommendation) {
  return (
    {
      continue_system_support: 'system_only',
      offer_optional_human_review: 'hybrid_teacher_review',
      recommend_human_followup: 'human_teacher',
      immediate_human_review: 'human_teacher_priority',
    }[recommendation] || 'system_only'
  );
}

function rationaleFor({ recommendation, signals, taskState, modelConfidence, proofReliabilityIssue }) {
  const signalText = signals.length ? signals.map((row) => `${row.id}:${row.severity}`).join(',') : 'none';
  return [
    `recommendation=${recommendation}`,
    `signals=${signalText}`,
    `taskRecommendation=${taskState.nextTaskRecommendation}`,
    `mastery=${taskState.masteryEstimate.toFixed(2)}`,
    `selfRegulation=${taskState.selfRegulationScore.toFixed(2)}`,
    `modelConfidence=${modelConfidence.toFixed(2)}`,
    `proofReliabilityIssue=${proofReliabilityIssue}`,
  ];
}

export function deriveHumanHandoffState(input = {}) {
  const inputAudit = auditPublicOnlyInput(input);
  if (!inputAudit.ok) {
    return {
      schema: HUMAN_HANDOFF_SCHEMA,
      publicOnly: true,
      authority: 'advisory',
      mayOverrideProofControl: false,
      mayChangeProofControlBehavior: false,
      requiresProofControlLog: true,
      recommendation: 'continue_system_support',
      helperRecommendation: 'system_only',
      confidence: 0,
      handoffSignals: [],
      rationale: ['input rejected by public-only audit'],
      taskMasteryState: null,
      inputAudit,
    };
  }

  const taskInput =
    input.taskMasteryInput && typeof input.taskMasteryInput === 'object' ? input.taskMasteryInput : input;
  const taskState = deriveTaskMasteryState(taskInput);
  const signalState = collectHandoffSignals(input, taskState);
  const recommendation = recommendationFor(signalState);
  const confidenceBase =
    signalState.signals.length === 0
      ? 0.7
      : Math.min(0.92, 0.52 + signalState.signals.filter((row) => row.severity === 'strong').length * 0.18);
  const confidence =
    recommendation === 'offer_optional_human_review' ? Math.max(0.55, confidenceBase - 0.12) : confidenceBase;

  return {
    schema: HUMAN_HANDOFF_SCHEMA,
    publicOnly: true,
    authority: 'advisory',
    mayOverrideProofControl: false,
    mayChangeProofControlBehavior: false,
    requiresProofControlLog: true,
    recommendation,
    helperRecommendation: helperFor(recommendation),
    confidence: clamp01(confidence, 0.55),
    handoffSignals: signalState.signals,
    repeatedNonUptake: signalState.repeatedNonUptake,
    affectRisk: signalState.affectRisk,
    proofReliabilityIssue: signalState.proofReliabilityIssue,
    modelConfidence: signalState.modelConfidence,
    taskMasteryState: taskState,
    rationale: rationaleFor({ recommendation, taskState, ...signalState }),
    inputAudit,
  };
}

function caseRow({ id, expectedRecommendation, ...input }) {
  return { id, expectedRecommendation, input };
}

export const HUMAN_HANDOFF_PROBE_CASES = Object.freeze([
  caseRow({
    id: 'continue-durable-task-progress',
    expectedRecommendation: 'continue_system_support',
    ownershipScore: 0.86,
    transferScore: 0.72,
    selfRegulationScore: 0.74,
    uptakeStatus: 'accepted_scaffold',
    modelConfidence: 0.82,
    affectRisk: 'low',
  }),
  caseRow({
    id: 'continue-single-non-uptake',
    expectedRecommendation: 'continue_system_support',
    ownershipScore: 0.5,
    transferScore: 0.28,
    selfRegulationScore: 0.42,
    uptakeStatus: 'complied_verbally_only',
    repeatedNonUptake: 1,
    modelConfidence: 0.7,
    affectRisk: 'low',
  }),
  caseRow({
    id: 'optional-low-model-confidence',
    expectedRecommendation: 'offer_optional_human_review',
    ownershipScore: 0.7,
    transferScore: 0.42,
    selfRegulationScore: 0.5,
    uptakeStatus: 'accepted_scaffold',
    modelConfidence: 0.28,
    affectRisk: 'low',
  }),
  caseRow({
    id: 'optional-generator-unverified',
    expectedRecommendation: 'offer_optional_human_review',
    ownershipScore: 0.74,
    transferScore: 0.46,
    selfRegulationScore: 0.54,
    uptakeStatus: 'accepted_scaffold',
    proofReliabilityIssue: 'generator_unverified',
    modelConfidence: 0.62,
    affectRisk: 'low',
  }),
  caseRow({
    id: 'human-requested',
    expectedRecommendation: 'recommend_human_followup',
    ownershipScore: 0.66,
    transferScore: 0.38,
    selfRegulationScore: 0.46,
    uptakeStatus: 'accepted_scaffold',
    learnerRequestedHuman: true,
    modelConfidence: 0.78,
  }),
  caseRow({
    id: 'human-repeated-non-uptake',
    expectedRecommendation: 'recommend_human_followup',
    ownershipScore: 0.45,
    transferScore: 0.2,
    selfRegulationScore: 0.24,
    uptakeStatus: 'resisted',
    repeatedNonUptake: 2,
    modelConfidence: 0.64,
  }),
  caseRow({
    id: 'human-proof-reliability-failure',
    expectedRecommendation: 'recommend_human_followup',
    ownershipScore: 0.72,
    transferScore: 0.5,
    selfRegulationScore: 0.58,
    uptakeStatus: 'accepted_scaffold',
    proofReliabilityIssue: 'proof_gate_failed',
    modelConfidence: 0.68,
  }),
  caseRow({
    id: 'immediate-high-affect-risk',
    expectedRecommendation: 'immediate_human_review',
    ownershipScore: 0.5,
    transferScore: 0.22,
    selfRegulationScore: 0.26,
    uptakeStatus: 'redirected_goal',
    repeatedNonUptake: 1,
    affectRisk: 'high',
    modelConfidence: 0.55,
  }),
]);

export function evaluateHumanHandoffProbe(cases = HUMAN_HANDOFF_PROBE_CASES) {
  const rows = (Array.isArray(cases) ? cases : []).map((fixture) => {
    const state = deriveHumanHandoffState(fixture.input || {});
    const recommendationPassed = state.recommendation === fixture.expectedRecommendation;
    const publicOnlyOk = state.inputAudit.ok;
    const advisoryOnly =
      state.authority === 'advisory' &&
      state.mayOverrideProofControl === false &&
      state.mayChangeProofControlBehavior === false &&
      state.requiresProofControlLog === true;
    const passed = recommendationPassed && publicOnlyOk && advisoryOnly;
    return {
      id: fixture.id || 'unknown-human-handoff-case',
      expectedRecommendation: fixture.expectedRecommendation,
      recommendation: state.recommendation,
      helperRecommendation: state.helperRecommendation,
      confidence: state.confidence,
      signalIds: state.handoffSignals.map((row) => row.id),
      publicOnlyOk,
      advisoryOnly,
      recommendationPassed,
      passed,
      state,
    };
  });
  const count = rows.length;
  const pass = rows.filter((row) => row.passed).length;
  const summary = {
    schema: HUMAN_HANDOFF_PROBE_SCHEMA,
    count,
    pass,
    fail: count - pass,
    publicOnlyFail: rows.filter((row) => !row.publicOnlyOk).length,
    nonAdvisoryRows: rows.filter((row) => !row.advisoryOnly).length,
    handoffRecommendations: rows.filter((row) =>
      ['recommend_human_followup', 'immediate_human_review'].includes(row.recommendation),
    ).length,
    optionalReviewRecommendations: rows.filter((row) => row.recommendation === 'offer_optional_human_review').length,
  };
  summary.allPassed = count > 0 && summary.fail === 0 && summary.publicOnlyFail === 0 && summary.nonAdvisoryRows === 0;
  return { schema: HUMAN_HANDOFF_PROBE_SCHEMA, baseSchema: HUMAN_HANDOFF_SCHEMA, summary, rows };
}

export function renderHumanHandoffProbeMarkdown(report) {
  const lines = [
    '# Derivation Human / Hybrid Handoff Probe',
    '',
    `Schema: \`${report.schema}\``,
    'Zero-paid status: deterministic local public-signal controls only',
    `Cases: ${report.summary.count}`,
    `Passed: ${report.summary.pass}`,
    `Failed: ${report.summary.fail}`,
    `Public-only failures: ${report.summary.publicOnlyFail}`,
    `Non-advisory rows: ${report.summary.nonAdvisoryRows}`,
    `Human followup recommendations: ${report.summary.handoffRecommendations}`,
    `Optional review recommendations: ${report.summary.optionalReviewRecommendations}`,
    `Decision: ${report.summary.allPassed ? 'pass' : 'fail'}`,
    '',
    '| Case | Expected | Recommendation | Helper | Signals | Advisory | Pass |',
    '|---|---|---|---|---|---|---|',
  ];

  for (const row of report.rows) {
    lines.push(
      `| ${row.id} | ${row.expectedRecommendation} | ${row.recommendation} | ${
        row.helperRecommendation
      } | ${row.signalIds.join(', ') || 'none'} | ${row.advisoryOnly ? 'yes' : 'no'} | ${row.passed ? 'yes' : 'no'} |`,
    );
  }

  lines.push(
    '',
    'Boundary: this is a local deployment-risk probe for advisory handoff recommendations.',
    'It does not route a learner, replace proof-control logs, change hidden+proofDebt behavior, or support a human-learning claim.',
  );
  return `${lines.join('\n')}\n`;
}

export function assertHumanHandoffRecommendation(recommendation) {
  if (!RECOMMENDATION_SET.has(recommendation)) {
    throw new Error(`Unknown human handoff recommendation: ${recommendation}`);
  }
  return recommendation;
}
