import { auditPublicOnlyInput, cleanPublicText } from './publicEvidence.js';

export const UPTAKE_NEGOTIATION_SCHEMA = 'dramatic-derivation.uptake-negotiation.v0';
export const UPTAKE_BENCHMARK_SCHEMA = 'dramatic-derivation.uptake-benchmark.v0';

export const UPTAKE_STATUSES = Object.freeze([
  'accepted_scaffold',
  'bypassed_scaffold',
  'redirected_goal',
  'complied_verbally_only',
  'resisted',
  'transformed_task',
  'unknown',
]);

function norm(text) {
  return String(text || '').toLowerCase();
}

function learnerResponse(input = {}) {
  if (input.learnerResponse) return cleanPublicText(input.learnerResponse, 800);
  const transcript = Array.isArray(input.transcript) ? input.transcript : [];
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    if (transcript[i]?.role === 'learner') return cleanPublicText(transcript[i].text, 800);
  }
  return '';
}

function publicEvidenceLines(text, input = {}) {
  const lines = [];
  if (input.scaffoldOffered) lines.push(`scaffold offered: ${input.scaffoldOffered}`);
  if (/\b(as with|same pattern|parallel|contrast|not .* but|instead of|example|like the)\b/u.test(norm(text))) {
    lines.push('learner uses scaffold-shaped language');
  }
  if (/\b(just tell me|give me the answer|skip this|what is the answer)\b/u.test(norm(text))) {
    lines.push('learner bypasses scaffold toward answer request');
  }
  if (/\b(yes|okay|got it|understood|sure)\b/u.test(norm(text))) lines.push('learner gives verbal compliance marker');
  if (/\b(why are we|why this|different question|can we instead|rather talk about)\b/u.test(norm(text))) {
    lines.push('learner redirects the public goal');
  }
  if (/\b(no|but|doesn't follow|does not follow|i disagree|can't be|cannot be)\b/u.test(norm(text))) {
    lines.push('learner resists the scaffold or premise');
  }
  if (/\b(i changed it|new route|better way|turns the task|instead i can)\b/u.test(norm(text))) {
    lines.push('learner transforms the task');
  }
  return lines.slice(0, 5);
}

function classifyUptake(text, input = {}) {
  const lowered = norm(text);
  if (input.status && UPTAKE_STATUSES.includes(input.status)) return input.status;
  if (/\b(i changed it|new route|better way|turns the task|instead i can)\b/u.test(lowered)) {
    return 'transformed_task';
  }
  if (/\b(why are we|why this|different question|can we instead|rather talk about)\b/u.test(lowered)) {
    return 'redirected_goal';
  }
  if (/\b(just tell me|give me the answer|skip this|what is the answer)\b/u.test(lowered)) {
    return 'bypassed_scaffold';
  }
  const scaffoldUse =
    /\b(as with|same pattern|parallel|contrast|not .* but|instead of|example|like the|first line|second line)\b/u.test(
      lowered,
    ) && /\b(because|so|therefore|which means|that means|matters|proves|shows)\b/u.test(lowered);
  if (scaffoldUse || input.usedScaffold === true) return 'accepted_scaffold';
  if (/\b(no|but|doesn't follow|does not follow|i disagree|can't be|cannot be)\b/u.test(lowered)) {
    return 'resisted';
  }
  if (
    /\b(yes|okay|ok|got it|understood|sure|that helps)\b/u.test(lowered) &&
    !/\b(because|so|therefore|which means|that means|matters|proves|shows)\b/u.test(lowered)
  ) {
    return 'complied_verbally_only';
  }
  return 'unknown';
}

function recommendationFor(status) {
  return (
    {
      accepted_scaffold: 'continue_same_scaffold',
      bypassed_scaffold: 'switch_mode',
      redirected_goal: 'return_to_proof_control',
      complied_verbally_only: 'minimal_presence',
      resisted: 'switch_mode',
      transformed_task: 'human_handoff_candidate',
      unknown: 'return_to_proof_control',
    }[status] || 'return_to_proof_control'
  );
}

function confidenceFor(status, lines) {
  if (status === 'unknown') return 0.35;
  return Math.min(0.95, +(0.64 + lines.length * 0.07).toFixed(2));
}

export function deriveUptakeNegotiationState(input = {}) {
  const inputAudit = auditPublicOnlyInput(input);
  const scope = ['dialogue_block', 'scene'].includes(input.scope) ? input.scope : 'dialogue_block';
  const text = inputAudit.ok ? learnerResponse(input) : '';
  const status = inputAudit.ok ? classifyUptake(text, input) : 'unknown';
  const evidence = inputAudit.ok ? publicEvidenceLines(text, input) : ['input rejected by public-only audit'];
  return {
    schema: UPTAKE_NEGOTIATION_SCHEMA,
    publicOnly: true,
    scope,
    status,
    scaffoldOffered: input.scaffoldOffered || null,
    learnerResponse: text,
    publicEvidence: evidence,
    nextActionRecommendation: recommendationFor(status),
    confidence: inputAudit.ok ? confidenceFor(status, evidence) : 0,
    inputAudit,
  };
}

function caseRow({ id, expectedStatus, scaffoldOffered, learnerResponse }) {
  return { id, expectedStatus, scaffoldOffered, learnerResponse };
}

export const UPTAKE_BENCHMARK_CASES = Object.freeze([
  caseRow({
    id: 'accepted-contrast-1',
    expectedStatus: 'accepted_scaffold',
    scaffoldOffered: 'contrast_case',
    learnerResponse: 'The contrast helps: not the bond line but the cause line matters because it shows what happened.',
  }),
  caseRow({
    id: 'accepted-analogy-2',
    expectedStatus: 'accepted_scaffold',
    scaffoldOffered: 'analogy_bridge',
    learnerResponse: 'As with the crown joint, the same pattern proves source before cause, so I can carry it here.',
  }),
  caseRow({
    id: 'bypassed-answer-1',
    expectedStatus: 'bypassed_scaffold',
    scaffoldOffered: 'teach_back',
    learnerResponse: 'Can you just tell me the answer instead of asking me to restate it?',
  }),
  caseRow({
    id: 'bypassed-skip-2',
    expectedStatus: 'bypassed_scaffold',
    scaffoldOffered: 'concrete_example',
    learnerResponse: 'Skip this example and give me the answer.',
  }),
  caseRow({
    id: 'verbal-only-1',
    expectedStatus: 'complied_verbally_only',
    scaffoldOffered: 'purpose_bridge',
    learnerResponse: 'Yes, okay, that helps.',
  }),
  caseRow({
    id: 'verbal-only-2',
    expectedStatus: 'complied_verbally_only',
    scaffoldOffered: 'slow_recap',
    learnerResponse: 'Understood. Got it.',
  }),
  caseRow({
    id: 'redirected-goal-1',
    expectedStatus: 'redirected_goal',
    scaffoldOffered: 'contrast_case',
    learnerResponse: 'Why are we doing this proof? Can we instead talk about the larger story?',
  }),
  caseRow({
    id: 'redirected-goal-2',
    expectedStatus: 'redirected_goal',
    scaffoldOffered: 'teach_back',
    learnerResponse: 'This feels like a different question; I would rather talk about who is liable.',
  }),
  caseRow({
    id: 'resistant-1',
    expectedStatus: 'resisted',
    scaffoldOffered: 'analogy_bridge',
    learnerResponse: "But the analogy doesn't follow from the public line.",
  }),
  caseRow({
    id: 'resistant-2',
    expectedStatus: 'resisted',
    scaffoldOffered: 'purpose_bridge',
    learnerResponse: 'No, I disagree that this shows purpose.',
  }),
  caseRow({
    id: 'transformed-task-1',
    expectedStatus: 'transformed_task',
    scaffoldOffered: 'decompose_subtask',
    learnerResponse: 'I changed it into a new route: first source, then cause, then liability.',
  }),
  caseRow({
    id: 'transformed-task-2',
    expectedStatus: 'transformed_task',
    scaffoldOffered: 'contrast_case',
    learnerResponse: 'A better way turns the task into two columns instead of one proof line.',
  }),
]);

export function evaluateUptakeBenchmark(cases = UPTAKE_BENCHMARK_CASES) {
  const rows = cases.map((fixture) => {
    const state = deriveUptakeNegotiationState(fixture);
    const passed = state.status === fixture.expectedStatus;
    return { ...fixture, state, passed };
  });
  const summary = {
    schema: UPTAKE_BENCHMARK_SCHEMA,
    count: rows.length,
    pass: rows.filter((row) => row.passed).length,
    fail: rows.filter((row) => !row.passed).length,
  };
  summary.allPassed = summary.fail === 0;
  return { schema: UPTAKE_BENCHMARK_SCHEMA, summary, rows };
}

export function renderUptakeBenchmarkMarkdown(report) {
  const lines = [
    '# Derivation Uptake Negotiation Benchmark',
    '',
    `Schema: \`${report.schema}\``,
    `Cases: ${report.summary.count}`,
    `Passed: ${report.summary.pass}`,
    `Failed: ${report.summary.fail}`,
    `Decision: ${report.summary.allPassed ? 'pass' : 'fail'}`,
    '',
    '| Case | Expected | Actual | Pass |',
    '|---|---|---|---|',
  ];
  for (const row of report.rows) {
    lines.push(`| ${row.id} | ${row.expectedStatus} | ${row.state.status} | ${row.passed ? 'yes' : 'no'} |`);
  }
  return `${lines.join('\n')}\n`;
}
