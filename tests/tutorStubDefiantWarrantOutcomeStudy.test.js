import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_DEFIANT_WARRANT_ARM_IDS,
  TUTOR_STUB_DEFIANT_WARRANT_DEFAULT_DESIGN,
  buildTutorStubDefiantWarrantPlan,
  configureTutorStubDefiantWarrantFromCli,
  loadTutorStubDefiantWarrantDesign,
  tutorStubDefiantWarrantConductCard,
  validateTutorStubDefiantWarrantDesign,
} from '../services/tutorStubDefiantWarrantOutcomeStudy.js';
import {
  TUTOR_STUB_DEFIANT_WARRANT_CONDUCT_ADJUDICATION_INDETERMINATE_CODE,
  TUTOR_STUB_DEFIANT_WARRANT_CONDUCT_NON_DELIVERY_CODE,
  applyTutorStubDefiantWarrantConductGate,
  createTutorStubDefiantWarrantConductAdjudicator,
} from '../services/tutorStubDefiantWarrantConductGate.js';
import {
  analysisRows,
  classifyDefiantWarrantAttempt,
  measureDefiantWarrantDialogue,
} from '../scripts/run-tutor-stub-defiant-warrant-pilot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadDesign() {
  return loadTutorStubDefiantWarrantDesign({ designPath: TUTOR_STUB_DEFIANT_WARRANT_DEFAULT_DESIGN, root: ROOT });
}

function validCliArgs(design, job) {
  return {
    'defiant-warrant-outcome-design': TUTOR_STUB_DEFIANT_WARRANT_DEFAULT_DESIGN,
    'defiant-warrant-outcome-job': job.id,
    'auto-learner-profile': design.execution.autoLearnerProfile,
    world: design.execution.world,
    'dag-mode': design.execution.dagMode,
    'register-policy': design.execution.registerPolicy,
    'register-palette': design.execution.registerPalette,
    'model-call-budget': String(design.execution.maximumReservationsPerDialogue),
    model: 'codex.gpt-5.6-luna',
    'classifier-model': 'codex.gpt-5.6-luna',
    'learner-record-model': 'codex.gpt-5.6-luna',
    'auto-learner-model': 'codex.gpt-5.6-luna',
    'cli-effort': design.models.cliEffort,
    'run-seed': String(job.run_seed),
    'acknowledge-research-use': true,
  };
}

test('shipped defiant-warrant design validates', () => {
  const loaded = loadDesign();
  const validation = validateTutorStubDefiantWarrantDesign(loaded.design);
  assert.deepEqual(validation, { valid: true, issues: [] });
});

test('validator rejects a drifted design', () => {
  const loaded = loadDesign();
  const drifted = JSON.parse(JSON.stringify(loaded.design));
  drifted.execution.autoTurns = 3;
  drifted.arms.warrant_withholding.conductInstruction = drifted.arms.warrant_serving.conductInstruction;
  const validation = validateTutorStubDefiantWarrantDesign(drifted);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.includes('identical conduct instructions')));
  assert.ok(validation.issues.some((issue) => issue.includes('execution pins drifted')));
});

test('plan is deterministic, balanced 9 vs 9, with unique ids and seeds', () => {
  const loaded = loadDesign();
  const plan = buildTutorStubDefiantWarrantPlan(loaded.design);
  const again = buildTutorStubDefiantWarrantPlan(loaded.design);
  assert.deepEqual(plan, again);
  assert.equal(plan.jobs.length, 18);
  for (const arm of TUTOR_STUB_DEFIANT_WARRANT_ARM_IDS) {
    assert.equal(plan.jobs.filter((job) => job.assigned_arm === arm).length, 9);
  }
  assert.equal(new Set(plan.jobs.map((job) => job.id)).size, 18);
  assert.equal(new Set(plan.jobs.map((job) => job.run_seed)).size, 18);
  for (const job of plan.jobs) {
    assert.equal(job.run_seed, loaded.design.randomization.masterSeed * 100 + job.assignment_index);
  }
});

test('conduct card wraps the registered instruction for each arm', () => {
  const loaded = loadDesign();
  for (const arm of TUTOR_STUB_DEFIANT_WARRANT_ARM_IDS) {
    const card = tutorStubDefiantWarrantConductCard(loaded.design, arm);
    assert.ok(card.startsWith('[Registered warrant-conduct directive]'));
    assert.ok(card.includes(loaded.design.arms[arm].conductInstruction));
    assert.ok(card.endsWith('[End registered warrant-conduct directive]'));
  }
  assert.throws(() => tutorStubDefiantWarrantConductCard(loaded.design, 'no_such_arm'), /unknown defiant-warrant arm/u);
});

test('configure is disabled when both args are absent and throws on a partial pair', () => {
  const disabled = configureTutorStubDefiantWarrantFromCli({
    args: { 'defiant-warrant-outcome-design': '', 'defiant-warrant-outcome-job': '' },
    state: {},
    root: ROOT,
  });
  assert.deepEqual(disabled, { enabled: false });
  assert.throws(
    () =>
      configureTutorStubDefiantWarrantFromCli({
        args: {
          'defiant-warrant-outcome-design': TUTOR_STUB_DEFIANT_WARRANT_DEFAULT_DESIGN,
          'defiant-warrant-outcome-job': '',
        },
        state: {},
        root: ROOT,
      }),
    /requires design and job together/u,
  );
});

test('configure sets standing conduct state and appends the execution-start event', () => {
  const loaded = loadDesign();
  const plan = buildTutorStubDefiantWarrantPlan(loaded.design);
  const job = plan.jobs[0];
  const state = { trace: { sink: true } };
  const traceEvents = [];
  const configured = configureTutorStubDefiantWarrantFromCli({
    args: validCliArgs(loaded.design, job),
    state,
    root: ROOT,
    autoLearnerEnabled: true,
    autoTurns: loaded.design.execution.autoTurns,
    appendTraceEvent: (trace, event) => {
      assert.equal(trace, state.trace);
      traceEvents.push(event);
    },
  });
  assert.equal(configured.enabled, true);
  assert.equal(state.defiantWarrantOutcomeStudy.enabled, true);
  assert.equal(state.defiantWarrantOutcomeStudy.job_id, job.id);
  assert.equal(state.defiantWarrantOutcomeStudy.assigned_arm, job.assigned_arm);
  assert.equal(
    state.defiantWarrantOutcomeStudy.conduct_card,
    tutorStubDefiantWarrantConductCard(loaded.design, job.assigned_arm),
  );
  assert.equal(traceEvents.length, 1);
  assert.equal(traceEvents[0].type, 'defiant_warrant_outcome_execution_start');
  assert.equal(traceEvents[0].assigned_arm, job.assigned_arm);
  assert.equal(traceEvents[0].publicTranscriptChanged, false);
});

test('configure accepts the host-resolved profile id when args carry the rendered prompt', () => {
  const loaded = loadDesign();
  const plan = buildTutorStubDefiantWarrantPlan(loaded.design);
  const job = plan.jobs[0];
  const renderedArgs = {
    ...validCliArgs(loaded.design, job),
    'auto-learner-profile': 'You are simulating this automated learner profile: frame_defiant\n<long rendered brief>',
  };
  const configured = configureTutorStubDefiantWarrantFromCli({
    args: renderedArgs,
    state: {},
    root: ROOT,
    autoLearnerEnabled: true,
    autoLearnerProfileId: loaded.design.execution.autoLearnerProfile,
    autoTurns: loaded.design.execution.autoTurns,
  });
  assert.equal(configured.enabled, true);
  assert.throws(
    () =>
      configureTutorStubDefiantWarrantFromCli({
        args: renderedArgs,
        state: {},
        root: ROOT,
        autoLearnerEnabled: true,
        autoLearnerProfileId: null,
        autoTurns: loaded.design.execution.autoTurns,
      }),
    /launch pins drifted from the registered design: learner profile/u,
  );
});

test('configure accepts a reduced recovery budget and rejects one above the cap', () => {
  const loaded = loadDesign();
  const plan = buildTutorStubDefiantWarrantPlan(loaded.design);
  const job = plan.jobs[0];
  const base = {
    args: null,
    state: {},
    root: ROOT,
    autoLearnerEnabled: true,
    autoLearnerProfileId: loaded.design.execution.autoLearnerProfile,
    autoTurns: loaded.design.execution.autoTurns,
  };
  const reduced = configureTutorStubDefiantWarrantFromCli({
    ...base,
    args: { ...validCliArgs(loaded.design, job), 'model-call-budget': '18' },
  });
  assert.equal(reduced.enabled, true);
  const cap = loaded.design.execution.maximumReservationsPerDialogue;
  assert.throws(
    () =>
      configureTutorStubDefiantWarrantFromCli({
        ...base,
        state: {},
        args: { ...validCliArgs(loaded.design, job), 'model-call-budget': String(cap + 1) },
      }),
    /launch pins drifted from the registered design: per-dialogue budget/u,
  );
});

test('configure throws when a launch pin drifts', () => {
  const loaded = loadDesign();
  const plan = buildTutorStubDefiantWarrantPlan(loaded.design);
  const job = plan.jobs[0];
  const drifted = { ...validCliArgs(loaded.design, job), 'run-seed': String(job.run_seed + 1) };
  assert.throws(
    () =>
      configureTutorStubDefiantWarrantFromCli({
        args: drifted,
        state: {},
        root: ROOT,
        autoLearnerEnabled: true,
        autoTurns: loaded.design.execution.autoTurns,
      }),
    /launch pins drifted from the registered design: run seed/u,
  );
  assert.throws(
    () =>
      configureTutorStubDefiantWarrantFromCli({
        args: { ...validCliArgs(loaded.design, job), 'defiant-warrant-outcome-job': 'dwo_missing' },
        state: {},
        root: ROOT,
        autoLearnerEnabled: true,
        autoTurns: loaded.design.execution.autoTurns,
      }),
    /not in the registered plan/u,
  );
});

test('tutor turn preparation carries the standing conduct card', () => {
  const source = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubTutorTurnPreparation.js'), 'utf8');
  assert.ok(source.includes('defiantWarrantOutcomeStudy?.conduct_card'));
});

test('attempt classification distinguishes complete, registered-terminal, and technical outcomes', () => {
  const turn = (index) => ({ type: 'turn_complete', turnRecord: { turn: index } });
  const started = { type: 'defiant_warrant_outcome_execution_start' };
  const clean = classifyDefiantWarrantAttempt({
    events: [started, turn(1), turn(2), turn(3)],
    exit: { code: 0, signal: null, spawn_error: null },
    autoTurns: 3,
  });
  assert.deepEqual(
    { terminal: clean.terminal, category: clean.category },
    { terminal: true, category: 'semantic_terminal' },
  );
  const registered = classifyDefiantWarrantAttempt({
    events: [started, { type: 'auto_learner_profile_adherence_exhausted' }],
    exit: { code: 0, signal: null, spawn_error: null },
    autoTurns: 3,
  });
  assert.equal(registered.category, 'registered_nonsemantic_terminal');
  const short = classifyDefiantWarrantAttempt({
    events: [started, turn(1)],
    exit: { code: 0, signal: null, spawn_error: null },
    autoTurns: 3,
  });
  assert.deepEqual(
    { recoverable: short.recoverable, code: short.code },
    { recoverable: true, code: 'incomplete_turn_sequence' },
  );
  const undirected = classifyDefiantWarrantAttempt({
    events: [turn(1), turn(2), turn(3)],
    exit: { code: 0, signal: null, spawn_error: null },
    autoTurns: 3,
  });
  assert.equal(undirected.code, 'study_dispatch_missing');
});

test('dialogue measurement computes settlement, coverage, and escalation deterministically', () => {
  const neutralTurn = (index, { supported = false, coverage = 0.2 } = {}) => ({
    type: 'turn_complete',
    turnRecord: {
      turn: index,
      learner: 'The tide tables show the causeway floods at dusk.',
      tutor: 'Good. What does that tell us about the crossing time?',
      classification: { turn: {} },
      learnerAdvance: { supportedMoveCount: supported ? 1 : 0 },
      tutorLearnerDagModel: { assessment: { bestPathCoverage: coverage } },
    },
  });
  const events = [
    { type: 'tutor_opening', text: 'Welcome to Marrick. The causeway question stands open.' },
    neutralTurn(1),
    neutralTurn(2),
    neutralTurn(3, { supported: true, coverage: 0.5 }),
    neutralTurn(4, { supported: true, coverage: 0.75 }),
  ];
  const measures = measureDefiantWarrantDialogue(events);
  assert.equal(measures.turns_measured, 4);
  assert.equal(measures.frame_settlement, true);
  assert.equal(measures.first_settlement_turn, 3);
  assert.equal(measures.settlement_turn_count, 2);
  assert.equal(measures.final_best_path_coverage, 0.75);
  assert.equal(measures.escalation_delta, 0);
  const again = measureDefiantWarrantDialogue(events);
  assert.deepEqual(measures, again);
});

test('analysis reads the on-disk trace when a replayed terminal attempt has no trace pointer', () => {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'dwo-replay-'));
  try {
    const caseId = 'dwo_b01_s1_warrant_withholding';
    const traceDir = path.join(destination, 'jobs', caseId, 'initial', 'traces');
    fs.mkdirSync(traceDir, { recursive: true });
    const events = [
      { type: 'tutor_opening', text: 'Welcome to Marrick.' },
      {
        type: 'turn_complete',
        turnRecord: {
          turn: 1,
          learner: 'The tide tables show the causeway floods at dusk.',
          tutor: 'Good. What does that tell us about the crossing time?',
          classification: { turn: {} },
          learnerAdvance: { supportedMoveCount: 1 },
          tutorLearnerDagModel: { assessment: { bestPathCoverage: 0.25 } },
        },
      },
    ];
    fs.writeFileSync(path.join(traceDir, 'trace.jsonl'), events.map((row) => JSON.stringify(row)).join('\n'));
    const execution = {
      results: [
        {
          case_id: caseId,
          terminal: true,
          terminal_category: 'semantic_terminal',
          cumulative_reservations: 24,
          attempts: [
            {
              case_id: caseId,
              attempt_number: 1,
              reservations: 24,
              cumulative_reservations: 24,
              disposition: { terminal: true, category: 'semantic_terminal' },
              ledger_replayed: true,
            },
          ],
        },
      ],
    };
    const plan = {
      jobs: [{ id: caseId, block_id: 'dwo_block_01', assigned_arm: 'warrant_withholding', run_seed: 2026082900 }],
    };
    const withDisk = analysisRows(execution, plan, destination);
    assert.equal(withDisk[0].measures.turns_measured, 1);
    assert.equal(withDisk[0].measures.frame_settlement, true);
    assert.ok(withDisk[0].trace);
    const withoutDisk = analysisRows(execution, plan, undefined);
    assert.equal(withoutDisk[0].measures, null);
  } finally {
    fs.rmSync(destination, { recursive: true, force: true });
  }
});

// ---- Design revision 2: structural conduct gate ----

const DISPUTE_TEXT = 'Why should I accept your frame at all?';
const NEUTRAL_TEXT = 'The tide tables show the causeway floods at dusk.';

function gateState(loaded, arm) {
  return {
    trace: { sink: true },
    defiantWarrantOutcomeStudy: {
      enabled: true,
      assigned_arm: arm,
      conduct_gate: loaded.design.conductGate,
    },
  };
}

test('v1 design still validates and rejects an unregistered conduct gate', () => {
  const v1 = loadTutorStubDefiantWarrantDesign({
    designPath: 'config/tutor-stub-defiant-warrant-outcome-pilot.v1.json',
    root: ROOT,
  });
  assert.deepEqual(validateTutorStubDefiantWarrantDesign(v1.design), { valid: true, issues: [] });
  const withGate = JSON.parse(JSON.stringify(v1.design));
  withGate.conductGate = loadDesign().design.conductGate;
  const validation = validateTutorStubDefiantWarrantDesign(withGate);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.includes('carries a conduct gate it does not register')));
});

test('v2 validator rejects a missing gate, a self-judging seat, and a reader-entangled seat', () => {
  const base = loadDesign().design;
  const missing = JSON.parse(JSON.stringify(base));
  delete missing.conductGate;
  assert.ok(validateTutorStubDefiantWarrantDesign(missing).issues.some((issue) => issue.includes('no conduct gate')));
  const selfJudge = JSON.parse(JSON.stringify(base));
  selfJudge.conductGate.check.adjudicatorSeat.modelRef = base.models.tutor;
  assert.ok(validateTutorStubDefiantWarrantDesign(selfJudge).issues.some((issue) => issue.includes('self-judging')));
  const entangled = JSON.parse(JSON.stringify(base));
  entangled.conductGate.check.adjudicatorSeat.modelRef = base.models.conductReader;
  assert.ok(
    validateTutorStubDefiantWarrantDesign(entangled).issues.some((issue) => issue.includes('instrument entanglement')),
  );
});

test('conduct gate is inert without a registered gate and skips non-dispute turns', async () => {
  const loaded = loadDesign();
  const response = { text: 'Weigh the assay first.' };
  const v1State = { trace: {}, defiantWarrantOutcomeStudy: { enabled: true, assigned_arm: 'warrant_withholding' } };
  const untouched = await applyTutorStubDefiantWarrantConductGate({
    state: v1State,
    response,
    turnNumber: 1,
    learnerText: DISPUTE_TEXT,
    appendTraceEvent: () => assert.fail('inert gate must not trace'),
  });
  assert.equal(untouched, response);

  const events = [];
  let adjudications = 0;
  const skipped = await applyTutorStubDefiantWarrantConductGate({
    state: gateState(loaded, 'warrant_withholding'),
    response,
    turnNumber: 1,
    learnerText: NEUTRAL_TEXT,
    priorTutorText: 'Let us weigh the assay.',
    classification: {},
    adjudicateConduct: () => {
      adjudications += 1;
      return { pass: true, label: 'clean', quote: null };
    },
    repairTutor: () => assert.fail('no repair on a skipped turn'),
    appendTraceEvent: (trace, event) => events.push(event),
  });
  assert.equal(skipped, response);
  assert.equal(adjudications, 0);
  assert.deepEqual(
    events.map((event) => [event.type, event.triggered]),
    [['defiant_warrant_conduct_gate', false]],
  );
});

test('conduct gate repairs a breach and ships the clean candidate', async () => {
  const loaded = loadDesign();
  const state = gateState(loaded, 'warrant_withholding');
  const events = [];
  const verdicts = [
    { pass: false, label: 'breach', quote: 'I take that as our proper starting discipline' },
    { pass: true, label: 'clean', quote: null },
  ];
  const instructions = [];
  const shipped = await applyTutorStubDefiantWarrantConductGate({
    state,
    response: { text: 'You ask fairly; I take that as our proper starting discipline.' },
    turnNumber: 2,
    learnerText: DISPUTE_TEXT,
    priorTutorText: 'Let us weigh the assay.',
    classification: {},
    adjudicateConduct: () => verdicts.shift(),
    repairTutor: ({ instruction }) => {
      instructions.push(instruction);
      return { text: 'The assay waits. Set the stone on the scale and read the grain marks.' };
    },
    appendTraceEvent: (trace, event) => events.push(event),
  });
  assert.equal(shipped.text, 'The assay waits. Set the stone on the scale and read the grain marks.');
  assert.equal(instructions.length, 1);
  assert.ok(instructions[0].includes(loaded.design.conductGate.armChecks.warrant_withholding.repairInstruction));
  assert.ok(instructions[0].includes('I take that as our proper starting discipline'));
  assert.deepEqual(
    events.map((event) => event.type),
    ['defiant_warrant_conduct_repair_requested', 'defiant_warrant_conduct_enforcement'],
  );
  assert.equal(events[1].delivered, true);
  assert.equal(events[1].repairAttempts, 1);
  assert.equal(state.defiantWarrantConductEnforcement.delivered, true);
});

test('conduct gate exhaustion stops the dialogue with the registered typed code', async () => {
  const loaded = loadDesign();
  const state = gateState(loaded, 'warrant_withholding');
  const events = [];
  let adjudications = 0;
  await assert.rejects(
    applyTutorStubDefiantWarrantConductGate({
      state,
      response: { text: 'Your question deserves an answer: the test can establish purity, not provenance.' },
      turnNumber: 3,
      learnerText: DISPUTE_TEXT,
      priorTutorText: 'Let us weigh the assay.',
      classification: {},
      adjudicateConduct: () => {
        adjudications += 1;
        return { pass: false, label: 'breach', quote: 'the test can establish purity' };
      },
      repairTutor: () => ({ text: 'Still, the test can establish purity, and you should know it.' }),
      appendTraceEvent: (trace, event) => events.push(event),
    }),
    (error) => {
      assert.equal(error.code, TUTOR_STUB_DEFIANT_WARRANT_CONDUCT_NON_DELIVERY_CODE);
      assert.equal(error.substantiveStudyFailure, true);
      assert.equal(error.neverScored, true);
      assert.equal(error.measurementDeterminate, false);
      return true;
    },
  );
  assert.equal(adjudications, 1 + loaded.design.conductGate.repairsAllowedPerTurn);
  assert.equal(events.filter((event) => event.type === 'defiant_warrant_conduct_repair_requested').length, 2);
  const stop = events.find((event) => event.type === 'defiant_warrant_conduct_non_delivery');
  assert.ok(stop);
  assert.equal(stop.repairAttempts, 2);
});

test('conduct adjudicator verifies quotes per arm and stops on malformed verdicts', async () => {
  const loaded = loadDesign();
  const replies = [];
  const adjudicate = createTutorStubDefiantWarrantConductAdjudicator({
    appendTraceEvent: () => {},
    callPromptModel: async () => ({ text: replies.shift() }),
    resolveModel: () => ({ provider: 'codex', model: 'gpt-5.6-sol' }),
  });
  const tutorText = 'The assay can establish purity of the ore. Set the stone on the scale.';
  const withholding = gateState(loaded, 'warrant_withholding');

  replies.push(JSON.stringify({ label: 'breach', quote: 'The assay can establish purity' }));
  const breach = await adjudicate({ state: withholding, tutorText, learnerText: DISPUTE_TEXT, turnNumber: 1 });
  assert.deepEqual(breach, { label: 'breach', pass: false, quote: 'The assay can establish purity' });

  replies.push(JSON.stringify({ label: 'clean', quote: null }));
  const clean = await adjudicate({ state: withholding, tutorText, learnerText: DISPUTE_TEXT, turnNumber: 1 });
  assert.deepEqual(clean, { label: 'clean', pass: true, quote: null });

  replies.push(JSON.stringify({ label: 'breach', quote: 'words that are not in the draft' }));
  await assert.rejects(
    adjudicate({ state: withholding, tutorText, learnerText: DISPUTE_TEXT, turnNumber: 1 }),
    (error) => error.code === TUTOR_STUB_DEFIANT_WARRANT_CONDUCT_ADJUDICATION_INDETERMINATE_CODE,
  );

  replies.push('not json at all');
  await assert.rejects(
    adjudicate({ state: withholding, tutorText, learnerText: DISPUTE_TEXT, turnNumber: 1 }),
    (error) => error.code === TUTOR_STUB_DEFIANT_WARRANT_CONDUCT_ADJUDICATION_INDETERMINATE_CODE,
  );

  const serving = gateState(loaded, 'warrant_serving');
  replies.push(JSON.stringify({ label: 'delivered', quote: 'The assay can establish purity of the ore.' }));
  const delivered = await adjudicate({ state: serving, tutorText, learnerText: DISPUTE_TEXT, turnNumber: 1 });
  assert.deepEqual(delivered, {
    label: 'delivered',
    pass: true,
    quote: 'The assay can establish purity of the ore.',
  });

  replies.push(JSON.stringify({ label: 'not_delivered', quote: null }));
  const notDelivered = await adjudicate({ state: serving, tutorText, learnerText: DISPUTE_TEXT, turnNumber: 1 });
  assert.deepEqual(notDelivered, { label: 'not_delivered', pass: false, quote: null });

  replies.push(JSON.stringify({ label: 'delivered', quote: null }));
  await assert.rejects(
    adjudicate({ state: serving, tutorText, learnerText: DISPUTE_TEXT, turnNumber: 1 }),
    (error) => error.code === TUTOR_STUB_DEFIANT_WARRANT_CONDUCT_ADJUDICATION_INDETERMINATE_CODE,
  );
});

test('classifier treats conduct-gate stops as registered non-semantic terminals', () => {
  const events = [
    { type: 'defiant_warrant_outcome_execution_start' },
    { type: 'defiant_warrant_conduct_non_delivery', code: TUTOR_STUB_DEFIANT_WARRANT_CONDUCT_NON_DELIVERY_CODE },
  ];
  const disposition = classifyDefiantWarrantAttempt({
    events,
    exit: { code: 1, signal: null, spawn_error: false },
    autoTurns: 8,
  });
  assert.deepEqual(disposition, {
    terminal: true,
    recoverable: false,
    category: 'registered_nonsemantic_terminal',
    code: TUTOR_STUB_DEFIANT_WARRANT_CONDUCT_NON_DELIVERY_CODE,
  });
});

test('measurement reports per-dialogue conduct-gate burden', () => {
  const turn = (number) => ({
    type: 'turn_complete',
    turnRecord: {
      turn: number,
      learner: NEUTRAL_TEXT,
      tutor: 'Set the stone on the scale.',
      classification: { turn: {} },
      learnerAdvance: { supportedMoveCount: 1 },
      tutorLearnerDagModel: { assessment: { bestPathCoverage: 0.25 } },
    },
  });
  const events = [
    { type: 'tutor_opening', text: 'Welcome to the assay bench.' },
    turn(1),
    { type: 'defiant_warrant_conduct_enforcement', turn: 2, delivered: true, repairAttempts: 1 },
    turn(2),
    { type: 'defiant_warrant_conduct_enforcement', turn: 3, delivered: true, repairAttempts: 0 },
    turn(3),
  ];
  const measures = measureDefiantWarrantDialogue(events);
  assert.deepEqual(measures.conduct_gate, {
    gated_turns: 2,
    repaired_turns: 1,
    repair_attempts: 1,
    non_delivery: false,
  });
});
