import { auditPublicOnlyInput, cleanPublicText } from './publicEvidence.js';

export const TASK_MASTERY_SCHEMA = 'dramatic-derivation.task-mastery.v0';
export const TASK_LOOP_BENCHMARK_SCHEMA = 'dramatic-derivation.task-loop-benchmark.v0';

export const NEXT_TASK_ACTIONS = Object.freeze([
  'repeat_same_object',
  'near_transfer',
  'contrast_case',
  'increase_difficulty',
  'review_prerequisite',
  'human_followup',
]);

export const TASK_MASTERY_SIGNAL_TYPES = Object.freeze([
  'ownership',
  'transfer',
  'self_regulation',
  'uptake',
  'repair',
  'error',
  'affect',
]);

const ACTION_SET = new Set(NEXT_TASK_ACTIONS);

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

function normalizeErrorCategories(input = {}) {
  const fromArray = Array.isArray(input.errorCategories) ? input.errorCategories : [];
  const fromEvents = Array.isArray(input.evidenceEvents)
    ? input.evidenceEvents.filter((event) => event?.type === 'error' && event.category).map((event) => event.category)
    : [];
  return [...new Set([...fromArray, ...fromEvents].map(norm).filter(Boolean))];
}

function normalizeEvidenceEvents(input = {}) {
  const explicit = Array.isArray(input.evidenceEvents)
    ? input.evidenceEvents.map((event) => ({
        type: TASK_MASTERY_SIGNAL_TYPES.includes(event?.type) ? event.type : 'error',
        value: clamp01(event?.value, event?.success === false ? 0 : event?.success === true ? 1 : 0.5),
        category: event?.category ? norm(event.category) : null,
        confidence: clamp01(event?.confidence, 0.6),
        detail: cleanPublicText(event?.detail || event?.text || '', 220),
      }))
    : [];

  const derived = [];
  if (input.ownershipScore !== undefined) {
    derived.push({
      type: 'ownership',
      value: clamp01(input.ownershipScore),
      category: null,
      confidence: clamp01(input.ownershipConfidence, 0.75),
      detail: 'ownership score',
    });
  }
  if (input.transferScore !== undefined) {
    derived.push({
      type: 'transfer',
      value: clamp01(input.transferScore),
      category: null,
      confidence: clamp01(input.transferConfidence, 0.7),
      detail: 'transfer score',
    });
  }
  if (input.selfRegulationScore !== undefined) {
    derived.push({
      type: 'self_regulation',
      value: clamp01(input.selfRegulationScore),
      category: null,
      confidence: clamp01(input.selfRegulationConfidence, 0.65),
      detail: 'self-regulation score',
    });
  }
  if (input.uptakeStatus) {
    const uptakeScore =
      {
        accepted_scaffold: 1,
        transformed_task: 0.6,
        complied_verbally_only: 0.25,
        unknown: 0.35,
        redirected_goal: 0.2,
        bypassed_scaffold: 0,
        resisted: 0,
      }[input.uptakeStatus] ?? 0.35;
    derived.push({
      type: 'uptake',
      value: uptakeScore,
      category: input.uptakeStatus,
      confidence: clamp01(input.uptakeConfidence, 0.65),
      detail: `uptake status: ${input.uptakeStatus}`,
    });
  }
  for (const category of normalizeErrorCategories(input)) {
    derived.push({
      type: 'error',
      value: 0,
      category,
      confidence: 0.75,
      detail: `error category: ${category}`,
    });
  }
  if (input.affectRisk) {
    derived.push({
      type: 'affect',
      value: input.affectRisk === 'high' ? 0 : input.affectRisk === 'medium' ? 0.4 : 0.8,
      category: norm(input.affectRisk),
      confidence: 0.65,
      detail: `affect risk: ${input.affectRisk}`,
    });
  }
  return [...explicit, ...derived].filter((event) => event.detail || event.category || event.type);
}

function average(events, type, fallback) {
  const rows = events.filter((event) => event.type === type);
  if (!rows.length) return fallback;
  return clamp01(rows.reduce((sum, event) => sum + event.value, 0) / rows.length, fallback);
}

function uptakeScore(events) {
  return average(events, 'uptake', 0.35);
}

function hasAny(categories, needles) {
  const set = new Set(categories);
  return needles.some((needle) => set.has(needle));
}

function repeatedNonUptake(input = {}, events = []) {
  const explicit = clampCount(input.repeatedNonUptake);
  const eventCount = events.filter(
    (event) =>
      event.type === 'uptake' &&
      ['bypassed_scaffold', 'redirected_goal', 'complied_verbally_only', 'resisted'].includes(event.category),
  ).length;
  return Math.max(explicit, eventCount);
}

function estimateMastery({ ownership, transfer, selfRegulation, uptake, repairCount, repeatedErrors }) {
  const base = ownership * 0.42 + transfer * 0.28 + selfRegulation * 0.17 + uptake * 0.13;
  const penalty = Math.min(0.35, repairCount * 0.06 + repeatedErrors * 0.05);
  return clamp01(base - penalty);
}

function estimateUncertainty({ events, masteryEstimate, repeatedErrors }) {
  const evidenceWeight = Math.min(0.45, events.length * 0.06);
  const confidence = events.length ? events.reduce((sum, event) => sum + event.confidence, 0) / events.length : 0.35;
  const edgePenalty = masteryEstimate > 0.38 && masteryEstimate < 0.68 ? 0.12 : 0;
  return clamp01(0.82 - evidenceWeight - confidence * 0.22 + repeatedErrors * 0.04 + edgePenalty, 0.65);
}

function recommendAction({
  input,
  ownership,
  transfer,
  selfRegulation,
  masteryEstimate,
  errors,
  repairCount,
  nonUptake,
}) {
  if (input.learnerRequestedHuman || input.humanRequested || input.affectRisk === 'high' || nonUptake >= 2) {
    return 'human_followup';
  }
  if (hasAny(errors, ['prerequisite_gap', 'missing_prerequisite', 'source_gap', 'vocabulary_gap'])) {
    return 'review_prerequisite';
  }
  if (hasAny(errors, ['near_miss', 'contrast_confusion', 'discrimination_failure'])) {
    return 'contrast_case';
  }
  if (ownership < 0.4 || masteryEstimate < 0.4 || repairCount >= 3) {
    return 'repeat_same_object';
  }
  if (masteryEstimate >= 0.78 && transfer >= 0.65 && selfRegulation >= 0.45) {
    return 'increase_difficulty';
  }
  if (masteryEstimate >= 0.52) {
    return 'near_transfer';
  }
  return 'repeat_same_object';
}

function rationaleFor(
  action,
  { errors, masteryEstimate, ownership, transfer, selfRegulation, repairCount, nonUptake },
) {
  const reason =
    {
      human_followup: 'human or hybrid support is conservative after repeated non-uptake, high affect risk, or request',
      review_prerequisite: 'public errors point to a prerequisite or vocabulary gap',
      contrast_case: 'public errors show near-miss or discrimination failure',
      repeat_same_object: 'mastery or ownership is not durable enough to move on',
      increase_difficulty: 'ownership, transfer, and self-regulation are jointly strong',
      near_transfer: 'current object is usable enough for a near-transfer check',
    }[action] || 'fallback recommendation';
  return [
    reason,
    `mastery=${masteryEstimate.toFixed(2)}`,
    `ownership=${ownership.toFixed(2)}`,
    `transfer=${transfer.toFixed(2)}`,
    `selfRegulation=${selfRegulation.toFixed(2)}`,
    `repairs=${repairCount}`,
    `nonUptake=${nonUptake}`,
    errors.length ? `errors=${errors.join(',')}` : 'errors=none',
  ];
}

export function fixedProgressionRecommendation() {
  return 'near_transfer';
}

export function deriveTaskMasteryState(input = {}) {
  const inputAudit = auditPublicOnlyInput(input);
  const events = inputAudit.ok ? normalizeEvidenceEvents(input) : [];
  const errors = inputAudit.ok ? normalizeErrorCategories(input) : [];
  const ownership = average(events, 'ownership', clamp01(input.ownershipScore, 0.35));
  const transfer = average(events, 'transfer', clamp01(input.transferScore, 0.25));
  const selfRegulation = average(events, 'self_regulation', clamp01(input.selfRegulationScore, 0.25));
  const uptake = uptakeScore(events);
  const repairCount = clampCount(input.repairCount);
  const repeatedErrors = clampCount(input.repeatedErrors || errors.length);
  const nonUptake = repeatedNonUptake(input, events);
  const masteryEstimate = inputAudit.ok
    ? estimateMastery({ ownership, transfer, selfRegulation, uptake, repairCount, repeatedErrors })
    : 0;
  const uncertainty = inputAudit.ok ? estimateUncertainty({ events, masteryEstimate, repeatedErrors }) : 1;
  const nextTaskRecommendation = inputAudit.ok
    ? recommendAction({
        input,
        ownership,
        transfer,
        selfRegulation,
        masteryEstimate,
        errors,
        repairCount,
        nonUptake,
      })
    : 'review_prerequisite';

  return {
    schema: TASK_MASTERY_SCHEMA,
    publicOnly: true,
    authority: 'advisory',
    mayOverrideProofControl: false,
    learnerId: input.learnerId || 'unknown-learner',
    skillId: input.skillId || 'unknown-skill',
    objectId: input.objectId || 'unknown-object',
    masteryEstimate,
    uncertainty,
    ownershipScore: ownership,
    transferScore: transfer,
    selfRegulationScore: selfRegulation,
    uptakeScore: uptake,
    repairCount,
    repeatedErrors,
    repeatedNonUptake: nonUptake,
    errorCategories: errors,
    evidenceEvents: events,
    nextTaskRecommendation,
    fixedProgressionRecommendation: fixedProgressionRecommendation(input),
    confidence: inputAudit.ok ? clamp01(1 - uncertainty, 0.35) : 0,
    rationale: inputAudit.ok
      ? rationaleFor(nextTaskRecommendation, {
          errors,
          masteryEstimate,
          ownership,
          transfer,
          selfRegulation,
          repairCount,
          nonUptake,
        })
      : ['input rejected by public-only audit'],
    inputAudit,
  };
}

function caseRow({
  id,
  expectedRecommendation,
  ownershipScore,
  transferScore,
  selfRegulationScore,
  uptakeStatus = 'accepted_scaffold',
  repairCount = 0,
  repeatedErrors = 0,
  repeatedNonUptake = 0,
  errorCategories = [],
  affectRisk = 'low',
  learnerRequestedHuman = false,
}) {
  return {
    id,
    expectedRecommendation,
    ownershipScore,
    transferScore,
    selfRegulationScore,
    uptakeStatus,
    repairCount,
    repeatedErrors,
    repeatedNonUptake,
    errorCategories,
    affectRisk,
    learnerRequestedHuman,
  };
}

export const TASK_LOOP_BENCHMARK_CASES = Object.freeze([
  caseRow({
    id: 'repeat-low-ownership',
    expectedRecommendation: 'repeat_same_object',
    ownershipScore: 0.24,
    transferScore: 0.1,
    selfRegulationScore: 0.25,
    repairCount: 1,
  }),
  caseRow({
    id: 'repeat-after-repairs',
    expectedRecommendation: 'repeat_same_object',
    ownershipScore: 0.48,
    transferScore: 0.28,
    selfRegulationScore: 0.32,
    repairCount: 3,
  }),
  caseRow({
    id: 'near-transfer-medium-mastery',
    expectedRecommendation: 'near_transfer',
    ownershipScore: 0.72,
    transferScore: 0.42,
    selfRegulationScore: 0.55,
  }),
  caseRow({
    id: 'near-transfer-transfer-gap',
    expectedRecommendation: 'near_transfer',
    ownershipScore: 0.82,
    transferScore: 0.3,
    selfRegulationScore: 0.7,
  }),
  caseRow({
    id: 'contrast-near-miss',
    expectedRecommendation: 'contrast_case',
    ownershipScore: 0.62,
    transferScore: 0.32,
    selfRegulationScore: 0.42,
    errorCategories: ['near_miss'],
  }),
  caseRow({
    id: 'contrast-discrimination-failure',
    expectedRecommendation: 'contrast_case',
    ownershipScore: 0.68,
    transferScore: 0.26,
    selfRegulationScore: 0.46,
    errorCategories: ['discrimination_failure'],
  }),
  caseRow({
    id: 'review-prerequisite-source-gap',
    expectedRecommendation: 'review_prerequisite',
    ownershipScore: 0.52,
    transferScore: 0.2,
    selfRegulationScore: 0.38,
    errorCategories: ['source_gap'],
  }),
  caseRow({
    id: 'review-prerequisite-vocabulary',
    expectedRecommendation: 'review_prerequisite',
    ownershipScore: 0.58,
    transferScore: 0.24,
    selfRegulationScore: 0.44,
    errorCategories: ['vocabulary_gap'],
  }),
  caseRow({
    id: 'increase-difficulty-durable',
    expectedRecommendation: 'increase_difficulty',
    ownershipScore: 0.94,
    transferScore: 0.82,
    selfRegulationScore: 0.74,
  }),
  caseRow({
    id: 'increase-difficulty-self-regulated',
    expectedRecommendation: 'increase_difficulty',
    ownershipScore: 0.88,
    transferScore: 0.78,
    selfRegulationScore: 0.82,
  }),
  caseRow({
    id: 'human-followup-repeated-non-uptake',
    expectedRecommendation: 'human_followup',
    ownershipScore: 0.45,
    transferScore: 0.2,
    selfRegulationScore: 0.24,
    uptakeStatus: 'resisted',
    repeatedNonUptake: 2,
  }),
  caseRow({
    id: 'human-followup-requested',
    expectedRecommendation: 'human_followup',
    ownershipScore: 0.62,
    transferScore: 0.4,
    selfRegulationScore: 0.48,
    learnerRequestedHuman: true,
  }),
]);

export function evaluateTaskLoopBenchmark(cases = TASK_LOOP_BENCHMARK_CASES) {
  const rows = cases.map((fixture) => {
    const state = deriveTaskMasteryState(fixture);
    const fixedRecommendation = fixedProgressionRecommendation(fixture);
    const adaptivePassed = state.nextTaskRecommendation === fixture.expectedRecommendation;
    const fixedPassed = fixedRecommendation === fixture.expectedRecommendation;
    return {
      ...fixture,
      state,
      fixedRecommendation,
      adaptivePassed,
      fixedPassed,
    };
  });
  const adaptivePass = rows.filter((row) => row.adaptivePassed).length;
  const fixedPass = rows.filter((row) => row.fixedPassed).length;
  const summary = {
    schema: TASK_LOOP_BENCHMARK_SCHEMA,
    count: rows.length,
    adaptivePass,
    adaptiveFail: rows.length - adaptivePass,
    fixedPass,
    fixedFail: rows.length - fixedPass,
    adaptiveAccuracy: +(adaptivePass / rows.length).toFixed(3),
    fixedAccuracy: +(fixedPass / rows.length).toFixed(3),
  };
  summary.improvement = +(summary.adaptiveAccuracy - summary.fixedAccuracy).toFixed(3);
  summary.allPassed = summary.adaptiveFail === 0 && summary.improvement > 0;
  return { schema: TASK_LOOP_BENCHMARK_SCHEMA, summary, rows };
}

export function renderTaskLoopBenchmarkMarkdown(report) {
  const lines = [
    '# Derivation Task-Loop Adaptation Benchmark',
    '',
    `Schema: \`${report.schema}\``,
    'Zero-paid status: deterministic local fixtures only',
    `Cases: ${report.summary.count}`,
    `Adaptive passed: ${report.summary.adaptivePass}`,
    `Fixed progression passed: ${report.summary.fixedPass}`,
    `Accuracy delta: ${report.summary.improvement.toFixed(3)}`,
    `Decision: ${report.summary.allPassed ? 'pass' : 'fail'}`,
    '',
    '| Case | Expected | Adaptive | Fixed progression | Mastery | Pass |',
    '|---|---|---|---|---:|---|',
  ];
  for (const row of report.rows) {
    lines.push(
      `| ${row.id} | ${row.expectedRecommendation} | ${row.state.nextTaskRecommendation} | ${
        row.fixedRecommendation
      } | ${row.state.masteryEstimate.toFixed(2)} | ${row.adaptivePassed ? 'yes' : 'no'} |`,
    );
  }
  lines.push(
    '',
    'Boundary: this is simulated task-choice evidence. It is not proof-control adaptation and not human-learning evidence.',
  );
  return `${lines.join('\n')}\n`;
}

export function assertTaskRecommendation(action) {
  if (!ACTION_SET.has(action)) {
    throw new Error(`Unknown next task action: ${action}`);
  }
  return action;
}
