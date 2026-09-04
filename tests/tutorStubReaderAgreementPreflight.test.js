import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  TUTOR_STUB_READER_AGREEMENT_PREFLIGHT_REPORT_SCHEMA,
  createTutorStubReaderPreflightTransport,
  executeTutorStubReaderAgreementPreflight,
  loadTutorStubArchivedCalibrationCorpus,
  renderTutorStubReaderAgreementPreflightMarkdown,
  resolveTutorStubReaderPreflightScope,
  runTutorStubReaderAgreementPreflight,
} from '../services/tutorStubReaderAgreementPreflight.js';
import {
  loadTutorStubResistantLearnerDesign,
  summarizeTutorStubFrameRefuserDepthCalibration,
  summarizeTutorStubResistantLearnerCalibration,
  summarizeTutorStubResistantLearnerReaderGates,
} from '../services/tutorStubResistantLearnerCalibration.js';
import {
  parseReaderAgreementPreflightArgs,
  runReaderAgreementPreflightCli,
} from '../scripts/run-reader-agreement-preflight.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEPTH_DESIGN_PATH = 'config/tutor-stub-frame-refuser-depth-design.v5.json';
const MERGED_DESIGN_PATH = 'config/tutor-stub-resistant-learner-merged-design.v5.json';
const ENDPOINT = 'final_graded_engagement_rung';
const HORIZON = 8;
const TRIGGER_TURN = 1;

// A fake archived calibration run: report.json rows, jobs/<id>/transcript.json,
// and the trace file each row names, carrying the two study events the
// corpus loader reads (intervention applied, final public learner turn).
function writeArchivedRun({ archiveRoot, runName, cases }) {
  const runRoot = path.join(archiveRoot, runName);
  const rows = cases.map((entry) => {
    const jobRoot = path.join(runRoot, 'jobs', entry.id);
    fs.mkdirSync(path.join(jobRoot, 'traces'), { recursive: true });
    const turns = Array.from({ length: HORIZON }, (_, index) => ({
      turn: index + 1,
      learner: `${entry.id} learner turn ${index + 1} disputes the standing of the wider question.`,
      tutor: `${entry.id} tutor turn ${index + 1} offers one local public test under protest.`,
    }));
    fs.writeFileSync(path.join(jobRoot, 'transcript.json'), JSON.stringify({ turns }));
    const traceName = `2026-08-30T14-00-00-000Z.jsonl`;
    const events = [
      { type: 'model_call', jobId: entry.id, turn: 1 },
      { type: 'resistance_action_register_intervention_applied', jobId: entry.id, turn: TRIGGER_TURN },
      {
        type: 'resistance_action_register_outcome_learner_turn',
        jobId: entry.id,
        turn: TRIGGER_TURN + 3,
        learnerText: 'x',
      },
      {
        type: 'resistance_action_register_outcome_learner_turn',
        jobId: entry.id,
        turn: TRIGGER_TURN + HORIZON,
        learnerText: `${entry.id} final learner turn ${entry.archived === '2' ? 'takes the bridge and reads the coin' : 'still reserves the wider frame'}.`,
      },
    ];
    fs.writeFileSync(
      path.join(jobRoot, 'traces', traceName),
      `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
    );
    return {
      job: {
        id: entry.id,
        study: entry.study || 'R1',
        ...(entry.face ? { face_id: entry.face } : { arm_id: entry.arm ?? null }),
        world: 'world_005_marrick',
        register: 'plain',
        outcome_horizon_learner_turns: HORIZON,
      },
      status: entry.status || 'complete',
      trace: path.join('jobs', entry.id, 'traces', traceName),
      transcript: path.join('jobs', entry.id, 'transcript.json'),
      outcome: {
        primary: {
          status: 'determinate',
          fields: { [ENDPOINT]: { status: 'determinate', value: entry.archived } },
          seats: ['reader_a', 'reader_b', 'reader_c'].map((judgeId) => ({
            judge_id: judgeId,
            model_ref: 'mock',
            validation: { fields: { [ENDPOINT]: { eligible: true, value: entry.archived } } },
          })),
        },
      },
    };
  });
  fs.writeFileSync(
    path.join(runRoot, 'report.json'),
    JSON.stringify({ schema: 'fake', rows, execution: { source_commit: 'abc123' } }),
  );
  return runRoot;
}

function resolveModel(modelRef) {
  return modelRef === 'codex.gpt-5.6-sol'
    ? { provider: 'codex', model: 'gpt-5.6-sol' }
    : modelRef === 'claude-code.sonnet-5'
      ? { provider: 'claude-code', model: 'claude-sonnet-5' }
      : { provider: 'claude-code', model: 'claude-opus-5' };
}

// Answer every field of the reader prompt validly. The endpoint rung comes
// from the vote table keyed by case and seat; every other field takes a
// registered value whose evidence contract is easy to satisfy.
function mockReader({ votes, failFor = new Set() }) {
  const calls = [];
  async function callPromptModel({ prompt, resolved, role }) {
    const parsed = JSON.parse(prompt);
    calls.push({ caseId: parsed.case_id, judge: parsed.judge.id, instrument: parsed.instrument, role });
    if (failFor.has(parsed.case_id)) throw new Error('bridge transport failed');
    const packet = parsed.public_packet;
    const learnerSource = Object.keys(packet)
      .filter((id) => /^post_\d+$/u.test(id))
      .sort()
      .at(-1);
    const judgment = {};
    for (const [field, schema] of Object.entries(parsed.output_schema.properties.judgment.properties)) {
      const allowed = schema.properties.value.enum;
      let value;
      let quotes;
      if (field === ENDPOINT) {
        value = votes[parsed.case_id]?.[parsed.judge.id] ?? '1';
        quotes = value === '0' ? null : [{ source_id: learnerSource, text: packet[learnerSource] }];
      } else if (allowed.includes('yes')) {
        value = 'no';
        quotes = null;
      } else {
        value = allowed.includes('plain') ? 'plain' : allowed[0];
        quotes = [{ source_id: 'intervention', text: packet.intervention }];
      }
      judgment[field] = { value, evidence_quotes: quotes, confidence: 'high', indeterminacy_reason: 'none' };
    }
    return {
      text: JSON.stringify({
        schema: parsed.output_schema.properties.schema.enum[0],
        case_id: parsed.case_id,
        judgment,
      }),
      provider: resolved.provider,
      model: resolved.model,
      effort: 'low',
      structuredOutput: true,
      prohibitedToolEventCountObserved: true,
      prohibitedToolEventCount: 0,
    };
  }
  return { callPromptModel, calls };
}

function tempArchive() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-preflight-'));
  const archiveRoot = path.join(root, 'artifacts', 'tutor-stub-live');
  fs.mkdirSync(archiveRoot, { recursive: true });
  return { root, archiveRoot };
}

// Ten cases: the registered determinate floor is 8, so a corpus under the
// floor fails the first gate no matter how the readers vote.
const TREATMENT_CASES = Array.from({ length: 10 }, (_, index) => ({
  id: `depth_treatment_case_${index + 1}`,
  arm: 'treatment',
  archived: index === 0 ? '2' : '1',
}));
const REFERENCE_CASES = [
  { id: 'depth_reference_case_1', arm: 'reference', archived: '1' },
  { id: 'depth_reference_failed', arm: 'reference', archived: '1', status: 'retained_substantive_failure' },
];

test('scope resolution follows the design schema and refuses the wrong selector', () => {
  const depth = loadTutorStubResistantLearnerDesign({ designPath: DEPTH_DESIGN_PATH, root: ROOT }).design;
  const scope = resolveTutorStubReaderPreflightScope({ design: depth, arm: 'treatment', root: ROOT });
  assert.equal(scope.kind, 'depth');
  assert.equal(scope.studyCode, 'R1');
  assert.equal(scope.faceDesign.measurement.endpointField, ENDPOINT);
  assert.throws(() => resolveTutorStubReaderPreflightScope({ design: depth, face: 'faceA', root: ROOT }), /--arm/u);
  const merged = loadTutorStubResistantLearnerDesign({ designPath: MERGED_DESIGN_PATH, root: ROOT }).design;
  assert.equal(resolveTutorStubReaderPreflightScope({ design: merged, face: 'faceA' }).studyCode, 'B1');
  assert.equal(resolveTutorStubReaderPreflightScope({ design: merged, face: 'faceB' }).studyCode, 'R1');
  assert.throws(() => resolveTutorStubReaderPreflightScope({ design: merged, arm: 'treatment' }), /--face/u);
});

test('corpus loader rebuilds the live public packet from archived rows in the requested arm only', () => {
  const { archiveRoot } = tempArchive();
  writeArchivedRun({ archiveRoot, runName: 'fake-run', cases: [...TREATMENT_CASES, ...REFERENCE_CASES] });
  const corpus = loadTutorStubArchivedCalibrationCorpus({
    runDirectories: ['fake-run'],
    archiveRoot,
    arm: 'treatment',
    studyCode: 'R1',
    endpointField: ENDPOINT,
  });
  assert.equal(corpus.runs.length, 1);
  assert.equal(corpus.runs[0].rows_total, 12);
  assert.equal(corpus.runs[0].rows_complete, 11);
  assert.equal(corpus.runs[0].rows_selected, 10);
  assert.equal(corpus.cases.length, 10);
  const first = corpus.cases[0];
  assert.equal(first.trigger_turn, TRIGGER_TURN);
  assert.equal(first.outcome_horizon_learner_turns, HORIZON);
  assert.deepEqual(Object.keys(first.public_packet), [
    'trigger',
    'intervention',
    ...Array.from({ length: HORIZON - 1 }, (_, i) => [`post_${i + 1}`, `tutor_${i + 1}`]).flat(),
    `post_${HORIZON}`,
  ]);
  assert.match(first.public_packet[`post_${HORIZON}`], /takes the bridge/u);
  assert.equal(first.archived.endpoint_value, '2');
  assert.equal(first.archived.seats.reader_a.value, '2');
  const reference = loadTutorStubArchivedCalibrationCorpus({
    runDirectories: ['fake-run'],
    archiveRoot,
    arm: 'reference',
    studyCode: 'R1',
    endpointField: ENDPOINT,
  });
  assert.equal(reference.cases.length, 1, 'the failed reference row is not a case');
});

test('unanimous readers pass the three reader gates through the live runtime and the shared gate helper', async () => {
  const { archiveRoot } = tempArchive();
  writeArchivedRun({ archiveRoot, runName: 'fake-run', cases: [...TREATMENT_CASES, ...REFERENCE_CASES] });
  const votes = Object.fromEntries(
    TREATMENT_CASES.map((entry) => [
      entry.id,
      { reader_a: entry.archived, reader_b: entry.archived, reader_c: entry.archived },
    ]),
  );
  const reader = mockReader({ votes });
  const report = await executeTutorStubReaderAgreementPreflight({
    designPath: DEPTH_DESIGN_PATH,
    arm: 'treatment',
    runDirectories: ['fake-run'],
    archiveRoot,
    root: ROOT,
    callPromptModel: reader.callPromptModel,
    resolveModel,
    parallelism: 3,
  });
  assert.equal(report.schema, TUTOR_STUB_READER_AGREEMENT_PREFLIGHT_REPORT_SCHEMA);
  assert.equal(report.status, 'passed');
  assert.deepEqual(report.gates, {
    determinate_outcome: true,
    eligible_vote_rate_per_seat_and_instrument: true,
    pairwise_exact_endpoint_agreement: true,
  });
  assert.equal(report.statistics.cases, 10);
  assert.equal(report.statistics.determinate, 10);
  assert.deepEqual(report.statistics.rung_counts, { 0: 0, 1: 9, 2: 1 });
  assert.equal(report.statistics.reader_errors, 0);
  assert.equal(report.statistics.archived_comparison.same_endpoint, 10);
  assert.equal(report.corpus.live_calls, 0);
  // Three primary seats plus two fidelity seats per case, one attempt each.
  assert.equal(reader.calls.length, 10 * 5);
  assert.equal(report.statistics.reader_calls, 50);
  assert.equal(report.corpus.planned_reader_calls, 50);
  assert.ok(reader.calls.every((call) => call.role.includes('reader') || call.role.includes('semantic')));
  assert.deepEqual(report.live_only_gates_not_checked.slice(0, 2), [
    'execution_and_typed_failure_accounting',
    'treatment_delivery_rate',
  ]);
  // Parity: the depth summarizer, fed the same fresh rows, reaches the same three verdicts.
  const design = loadTutorStubResistantLearnerDesign({ designPath: DEPTH_DESIGN_PATH, root: ROOT }).design;
  const live = summarizeTutorStubFrameRefuserDepthCalibration({ rows: report.rows, design, root: ROOT });
  const liveGates = live.arms.find((arm) => arm.arm_id === 'treatment').gates;
  for (const gate of Object.keys(report.gates)) assert.equal(liveGates[gate], report.gates[gate], gate);
  const markdown = renderTutorStubReaderAgreementPreflightMarkdown(report);
  assert.match(markdown, /^# Reader-agreement preflight: PASSED/u);
  assert.match(markdown, /live calls 0/u);
  assert.match(markdown, /Not checked here \(live run only\)/u);
});

test('a split panel fails the agreement gate and the report names it', async () => {
  const { archiveRoot } = tempArchive();
  writeArchivedRun({ archiveRoot, runName: 'fake-run', cases: TREATMENT_CASES });
  // Seat c disagrees on three of ten cases: pairwise a×c and b×c sit at 0.7, under the 0.8 floor.
  const votes = Object.fromEntries(
    TREATMENT_CASES.map((entry, index) => [
      entry.id,
      { reader_a: '1', reader_b: '1', reader_c: index < 3 ? '2' : '1' },
    ]),
  );
  const reader = mockReader({ votes });
  const report = await executeTutorStubReaderAgreementPreflight({
    designPath: DEPTH_DESIGN_PATH,
    arm: 'treatment',
    runDirectories: ['fake-run'],
    archiveRoot,
    root: ROOT,
    callPromptModel: reader.callPromptModel,
    resolveModel,
  });
  assert.equal(report.status, 'failed');
  assert.equal(report.gates.pairwise_exact_endpoint_agreement, false);
  assert.equal(report.gates.determinate_outcome, true, 'a 2-1 majority is still determinate');
  const pairs = Object.fromEntries(
    report.statistics.endpoint_pairs.map((pair) => [pair.readers.join('x'), pair.conditional_exact_agreement]),
  );
  assert.equal(pairs.reader_axreader_b, 1);
  assert.equal(pairs.reader_axreader_c, 0.7);
  assert.match(
    renderTutorStubReaderAgreementPreflightMarkdown(report),
    /pairwise_exact_endpoint_agreement \|[^\n]*\| FAIL \|/u,
  );
});

// The merged v5 design registers no per-pair floor: its agreement gate is the
// modal rule (enough cases with two eligible endpoint votes, mean pairwise
// agreement at the backstop). The same 3-of-10 split that fails the depth
// design passes here, and the report must say which rule it applied.
const MERGED_FACE_A_CASES = Array.from({ length: 10 }, (_, index) => ({
  id: `merged_faceA_case_${index + 1}`,
  study: 'B1',
  face: 'faceA',
  archived: index === 0 ? '2' : '1',
}));

test('a merged face gates on the modal agreement rule the design registers, not on a per-pair floor', async () => {
  const { archiveRoot } = tempArchive();
  writeArchivedRun({ archiveRoot, runName: 'fake-merged-run', cases: MERGED_FACE_A_CASES });
  const votes = Object.fromEntries(
    MERGED_FACE_A_CASES.map((entry, index) => [
      entry.id,
      { reader_a: '1', reader_b: '1', reader_c: index < 3 ? '2' : '1' },
    ]),
  );
  const reader = mockReader({ votes });
  const report = await executeTutorStubReaderAgreementPreflight({
    designPath: MERGED_DESIGN_PATH,
    face: 'faceA',
    runDirectories: ['fake-merged-run'],
    archiveRoot,
    root: ROOT,
    callPromptModel: reader.callPromptModel,
    resolveModel,
  });
  assert.equal(report.scope.kind, 'merged');
  assert.equal(report.statistics.cases, 10);
  assert.equal(report.agreement_rule, 'modal_backstop');
  assert.equal(report.floors.minimum_pairwise_exact_endpoint_agreement, null);
  // Revision 5 of the merged design names its two reader gates this way; the
  // per-seat eligibility floor is report-only there.
  assert.deepEqual(Object.keys(report.gates).sort(), [
    'primary_endpoint_determinacy',
    'primary_endpoint_reader_eligibility_and_validity_backstop',
  ]);
  assert.equal(report.status, 'passed');
  assert.equal(report.gates.primary_endpoint_reader_eligibility_and_validity_backstop, true);
  assert.equal(report.statistics.endpoint_panel.cases_with_at_least_two_eligible_votes, 10);
  assert.ok(Math.abs(report.statistics.endpoint_panel.mean_pairwise_exact_agreement - 0.8) < 1e-9);
  // Parity with the live merged-face summary on the one gate both compute.
  const merged = loadTutorStubResistantLearnerDesign({ designPath: MERGED_DESIGN_PATH, root: ROOT }).design;
  const live = summarizeTutorStubResistantLearnerCalibration({ rows: report.rows, design: merged, root: ROOT });
  const faceA = live.faces.find((face) => face.face_id === 'faceA');
  assert.equal(
    faceA.gates.primary_endpoint_reader_eligibility_and_validity_backstop,
    report.gates.primary_endpoint_reader_eligibility_and_validity_backstop,
  );
  assert.equal(faceA.gates.primary_endpoint_determinacy, report.gates.primary_endpoint_determinacy);
  const markdown = renderTutorStubReaderAgreementPreflightMarkdown(report);
  assert.match(
    markdown,
    /primary_endpoint_reader_eligibility_and_validity_backstop \| 10\/10 cases with two eligible votes; mean pairwise 0\.800 \|[^\n]*\| pass \|/u,
  );
  assert.match(markdown, /Report only under the modal rule: eligible votes per seat reader_a 10\/10/u);
  assert.doesNotMatch(markdown, /pairwise_exact_endpoint_agreement \|/u);
});

test('a transport failure leaves the verdict incomplete instead of counting as an ineligible vote', async () => {
  const { archiveRoot } = tempArchive();
  writeArchivedRun({ archiveRoot, runName: 'fake-run', cases: TREATMENT_CASES });
  const votes = Object.fromEntries(
    TREATMENT_CASES.map((entry) => [entry.id, { reader_a: '1', reader_b: '1', reader_c: '1' }]),
  );
  const reader = mockReader({ votes, failFor: new Set(['depth_treatment_case_2']) });
  const scope = resolveTutorStubReaderPreflightScope({
    design: loadTutorStubResistantLearnerDesign({ designPath: DEPTH_DESIGN_PATH, root: ROOT }).design,
    arm: 'treatment',
    root: ROOT,
  });
  const corpus = loadTutorStubArchivedCalibrationCorpus({
    runDirectories: ['fake-run'],
    archiveRoot,
    arm: 'treatment',
    studyCode: 'R1',
    endpointField: ENDPOINT,
  });
  const result = await runTutorStubReaderAgreementPreflight({
    scope,
    cases: corpus.cases,
    callPromptModel: reader.callPromptModel,
    resolveModel,
  });
  // The live runtime records a failed seat as unreached and moves on, so the
  // row still completes with that seat ineligible; the gates still pass on
  // the other nine cases. The preflight refuses to call that a pass.
  assert.equal(result.status, 'incomplete');
  assert.equal(result.statistics.reader_errors, 0);
  assert.equal(result.statistics.completed, 10);
  assert.equal(result.gates.determinate_outcome, true);
  // Three primary seats and two fidelity seats never reached the model.
  assert.equal(result.statistics.transport_failures, 5);
  const failed = result.rows.find((row) => row.job.id === 'depth_treatment_case_2');
  assert.equal(failed.status, 'complete');
  assert.equal(failed.transport_failures, 5);
  assert.equal(failed.outcome.primary.status, 'measurement_indeterminate');
  const markdown = renderTutorStubReaderAgreementPreflightMarkdown({
    ...result,
    design: { path: 'd', sha256: 'x'.repeat(64), revision: 5 },
    scope: { kind: 'depth', arm: 'treatment', study_code: 'R1', endpoint_field: ENDPOINT, protocol_source: 'p' },
    readers: [],
    corpus: { runs: [] },
    live_only_gates_not_checked: [],
  });
  assert.match(markdown, /Transport failures: 5 seat read\(s\)/u);
  const gates = summarizeTutorStubResistantLearnerReaderGates({ rows: result.rows, faceDesign: scope.faceDesign });
  assert.equal(gates.completed.length, 10);
});

test('dry run lists the plan and makes no reader call; the CLI refuses an existing --out', async () => {
  const { root, archiveRoot } = tempArchive();
  writeArchivedRun({ archiveRoot, runName: 'fake-run', cases: TREATMENT_CASES });
  const plan = await executeTutorStubReaderAgreementPreflight({
    designPath: DEPTH_DESIGN_PATH,
    arm: 'treatment',
    runDirectories: ['fake-run'],
    archiveRoot,
    root: ROOT,
    callPromptModel: null,
    resolveModel,
  });
  assert.equal(plan.status, 'dry_run');
  assert.equal(plan.cases.length, 10);
  assert.equal(plan.corpus.planned_reader_calls, 50);
  assert.equal(plan.readers.length, 3);

  const lines = [];
  let bridgeCalls = 0;
  const callBridge = async () => {
    bridgeCalls += 1;
    throw new Error('dry run must not reach the bridge');
  };
  const code = await runReaderAgreementPreflightCli(
    ['--design', DEPTH_DESIGN_PATH, '--arm', 'treatment', '--corpus', 'fake-run', '--archive-root', root, '--dry-run'],
    { callBridge, log: (line) => lines.push(line) },
  );
  assert.equal(code, 0);
  assert.equal(bridgeCalls, 0);
  assert.match(
    lines[0],
    /^dry run: 10 case\(s\) from 1 run\(s\); 3 reader seat\(s\); 50 planned reader calls; ceiling 100; live calls 0$/u,
  );

  const out = path.join(root, 'existing-out');
  fs.mkdirSync(out);
  await assert.rejects(
    runReaderAgreementPreflightCli(
      [
        '--design',
        DEPTH_DESIGN_PATH,
        '--arm',
        'treatment',
        '--corpus',
        'fake-run',
        '--archive-root',
        root,
        '--out',
        out,
      ],
      { callBridge, log: () => {} },
    ),
    /--out already exists/u,
  );
  assert.equal(bridgeCalls, 0);
  assert.throws(
    () => parseReaderAgreementPreflightArgs(['--design', DEPTH_DESIGN_PATH, '--corpus', 'x']),
    /--out is required/u,
  );
});

test('CLI live path writes report.json and report.md once and returns the gate exit code', async () => {
  const { root, archiveRoot } = tempArchive();
  writeArchivedRun({ archiveRoot, runName: 'fake-run', cases: TREATMENT_CASES });
  const votes = Object.fromEntries(
    TREATMENT_CASES.map((entry) => [entry.id, { reader_a: '1', reader_b: '1', reader_c: '1' }]),
  );
  const reader = mockReader({ votes });
  // The CLI's transport wraps the bridge; the bridge mock answers with the
  // shape callAIWithCliBridge returns, so the transport's envelope mapping runs.
  const callBridge = async (agentConfig, systemPrompt, userPrompt) => {
    const response = await reader.callPromptModel({
      prompt: userPrompt,
      resolved: { provider: agentConfig.provider, model: agentConfig.model },
      role: 'reader',
    });
    return { ...response, reasoningEffort: 'low', inputTokens: 10, outputTokens: 5, cost: 0 };
  };
  const out = path.join(root, 'out');
  const lines = [];
  const code = await runReaderAgreementPreflightCli(
    [
      '--design',
      DEPTH_DESIGN_PATH,
      '--arm',
      'treatment',
      '--corpus',
      'fake-run',
      '--archive-root',
      root,
      '--out',
      out,
      '--ceiling',
      '50',
    ],
    { callBridge, log: (line) => lines.push(line) },
  );
  assert.equal(code, 0);
  const report = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8'));
  assert.equal(report.status, 'passed');
  assert.equal(report.execution.reader_attempts, 50);
  assert.equal(report.execution.attempt_ceiling, 50);
  assert.ok(fs.existsSync(path.join(out, 'report.md')));
  assert.match(lines.at(-1), /^passed: /u);
});

test('transport enforces the attempt ceiling before the call is made', async () => {
  let bridgeCalls = 0;
  const transport = createTutorStubReaderPreflightTransport({
    callBridge: async () => {
      bridgeCalls += 1;
      return {
        text: '{}',
        provider: 'codex',
        model: 'gpt-5.6-sol',
        structuredOutput: true,
        prohibitedToolEventCount: 0,
      };
    },
    attemptCeiling: 1,
  });
  const input = {
    prompt: '{}',
    resolved: { provider: 'codex', model: 'gpt-5.6-sol' },
    systemPrompt: 's',
    role: 'reader',
    trace: [],
  };
  const first = await transport.callPromptModel(input);
  assert.equal(first.prohibitedToolEventCountObserved, true);
  assert.equal(first.structuredOutput, true);
  await assert.rejects(transport.callPromptModel(input), /attempt ceiling/u);
  assert.equal(bridgeCalls, 1);
  assert.equal(transport.attempts(), 1);
});
