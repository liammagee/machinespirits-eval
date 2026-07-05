import { deriveOpportunityCostBudget } from './opportunityCost.js';
import { auditPublicOnlyInput, cleanPublicText } from './publicEvidence.js';

export const SELF_REGULATION_SCHEMA = 'dramatic-derivation.self-regulation.v0';
export const SELF_REGULATION_BENCHMARK_SCHEMA = 'dramatic-derivation.self-regulation-benchmark.v0';

function norm(text) {
  return String(text || '').toLowerCase();
}

function learnerText(input = {}) {
  if (input.learnerText) return cleanPublicText(input.learnerText, 800);
  const transcript = Array.isArray(input.transcript) ? input.transcript : [];
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    if (transcript[i]?.role === 'learner') return cleanPublicText(transcript[i].text, 800);
  }
  return '';
}

function score(text, patterns) {
  const lowered = norm(text);
  return patterns.some((pattern) => pattern.test(lowered)) ? 1 : 0;
}

function coachMove({ plansNextStep, monitorsConfidence, detectsOwnGap, requestsSpecificHelp, checksAnswerConditions }) {
  if (plansNextStep || checksAnswerConditions) return 'minimal_presence';
  if (!plansNextStep) return 'planning_prompt';
  if (!monitorsConfidence) return 'monitoring_prompt';
  if (!detectsOwnGap) return 'debugging_prompt';
  if (!requestsSpecificHelp) return 'evaluation_prompt';
  return 'return_to_task';
}

export function deriveSelfRegulationState(input = {}) {
  const inputAudit = auditPublicOnlyInput(input);
  const scope = ['dialogue_block', 'scene', 'act'].includes(input.scope) ? input.scope : 'dialogue_block';
  const text = inputAudit.ok ? learnerText(input) : '';
  const plansNextStep = score(text, [/\b(next i|my next step|i will|let me first|then i)\b/u]);
  const monitorsConfidence = score(text, [/\b(i am sure|i'm sure|not sure|uncertain|confidence|maybe)\b/u]);
  const detectsOwnGap = score(text, [/\b(i am missing|i'm missing|the gap|i need|not ready|i don't yet)\b/u]);
  const requestsSpecificHelp = score(text, [
    /\b(can you show|remind me where|which line|what evidence|specific|one hint)\b/u,
  ]);
  const checksAnswerConditions = score(text, [
    /\b(if .* then|before i assert|condition|has to be true|answer only if|does this satisfy)\b/u,
  ]);
  const reflectsOnStrategy = score(text, [/\b(my strategy|this route|better route|i should|worked because)\b/u]);
  const total =
    plansNextStep +
    monitorsConfidence +
    detectsOwnGap +
    requestsSpecificHelp +
    checksAnswerConditions +
    reflectsOnStrategy;
  const state = {
    schema: SELF_REGULATION_SCHEMA,
    publicOnly: true,
    scope,
    plansNextStep,
    monitorsConfidence,
    detectsOwnGap,
    requestsSpecificHelp,
    checksAnswerConditions,
    reflectsOnStrategy,
    selfRegulationScore: inputAudit.ok ? +(total / 6).toFixed(2) : 0,
    recommendedCoachMove: inputAudit.ok
      ? coachMove({ plansNextStep, monitorsConfidence, detectsOwnGap, requestsSpecificHelp, checksAnswerConditions })
      : 'return_to_task',
    opportunityCostBudget: deriveOpportunityCostBudget({
      scope,
      proofCriticalReleasePending: input.proofCriticalReleasePending,
      repairPending: input.repairPending,
      nearFinal: input.nearFinal,
      currentProofNeutralTutorTurns: input.currentProofNeutralTutorTurns,
      currentProofNeutralLearnerTurns: input.currentProofNeutralLearnerTurns,
    }),
    evidence: inputAudit.ok && text ? [text.slice(0, 220)] : ['input rejected or empty public learner text'],
    inputAudit,
  };
  return state;
}

function caseRow({ id, expectedMinScore, expectedMove, learnerText }) {
  return { id, expectedMinScore, expectedMove, learnerText };
}

export const SELF_REGULATION_BENCHMARK_CASES = Object.freeze([
  caseRow({
    id: 'plans-next-step',
    expectedMinScore: 0.16,
    expectedMove: 'minimal_presence',
    learnerText: 'Next I will check the source line before I assert the cause.',
  }),
  caseRow({
    id: 'monitors-confidence',
    expectedMinScore: 0.16,
    expectedMove: 'planning_prompt',
    learnerText: 'I am not sure yet, but maybe the gap is the source line.',
  }),
  caseRow({
    id: 'detects-gap',
    expectedMinScore: 0.16,
    expectedMove: 'planning_prompt',
    learnerText: 'I am missing the line that connects the mark to the yard.',
  }),
  caseRow({
    id: 'requests-specific-help',
    expectedMinScore: 0.16,
    expectedMove: 'planning_prompt',
    learnerText: 'Can you show which line names the yard? One hint is enough.',
  }),
  caseRow({
    id: 'checks-conditions',
    expectedMinScore: 0.16,
    expectedMove: 'minimal_presence',
    learnerText: 'Before I assert it, the condition has to be true: source first, cause second.',
  }),
  caseRow({
    id: 'reflects-on-strategy',
    expectedMinScore: 0.16,
    expectedMove: 'planning_prompt',
    learnerText: 'My strategy worked because I separated the payment route from the cause route.',
  }),
  caseRow({
    id: 'phatic-no-self-regulation',
    expectedMinScore: 0,
    expectedMove: 'planning_prompt',
    learnerText: 'Okay, got it.',
  }),
]);

export function evaluateSelfRegulationBenchmark(cases = SELF_REGULATION_BENCHMARK_CASES) {
  const rows = cases.map((fixture) => {
    const state = deriveSelfRegulationState(fixture);
    const scoreOk = state.selfRegulationScore >= fixture.expectedMinScore;
    const moveOk = state.recommendedCoachMove === fixture.expectedMove;
    return { ...fixture, state, passed: scoreOk && moveOk };
  });
  const summary = {
    schema: SELF_REGULATION_BENCHMARK_SCHEMA,
    count: rows.length,
    pass: rows.filter((row) => row.passed).length,
    fail: rows.filter((row) => !row.passed).length,
  };
  summary.allPassed = summary.fail === 0;
  return { schema: SELF_REGULATION_BENCHMARK_SCHEMA, summary, rows };
}

export function renderSelfRegulationBenchmarkMarkdown(report) {
  const lines = [
    '# Derivation Self-Regulation Benchmark',
    '',
    `Schema: \`${report.schema}\``,
    `Cases: ${report.summary.count}`,
    `Passed: ${report.summary.pass}`,
    `Failed: ${report.summary.fail}`,
    `Decision: ${report.summary.allPassed ? 'pass' : 'fail'}`,
    '',
    '| Case | Score | Move | Pass |',
    '|---|---:|---|---|',
  ];
  for (const row of report.rows) {
    lines.push(
      `| ${row.id} | ${row.state.selfRegulationScore.toFixed(2)} | ${row.state.recommendedCoachMove} | ${
        row.passed ? 'yes' : 'no'
      } |`,
    );
  }
  return `${lines.join('\n')}\n`;
}
