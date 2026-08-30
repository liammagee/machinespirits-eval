import assert from 'node:assert/strict';
import fs from 'node:fs';
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
