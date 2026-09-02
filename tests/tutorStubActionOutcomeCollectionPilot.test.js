import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubActionOutcomeCollectionPlan,
  loadTutorStubActionOutcomeCollectionDesign,
  runTutorStubActionOutcomeCollectionPreflight,
  tutorStubActionOutcomeCollectionRouteTable,
} from '../services/tutorStubActionOutcomeCollectionPilot.js';
import {
  loadTutorStubActionOutcomeComparableCollectionDesign,
  runTutorStubActionOutcomeComparableCollectionPreflight,
  TUTOR_STUB_ACTION_OUTCOME_COMPARABLE_COLLECTION_DESIGN_PATH,
} from '../services/tutorStubActionOutcomeComparableCollection.js';
import {
  loadTutorStubActionOutcomeProspectiveRedesign,
  runTutorStubActionOutcomeProspectiveRedesignPreflight,
} from '../services/tutorStubActionOutcomeProspectiveRedesign.js';
import {
  executeTutorStubActionOutcomeCollection,
  extractTutorStubActionOutcomeCollectionRow,
  loadTutorStubActionOutcomeCollectionRecovery,
  main as collectionLauncherMain,
} from '../scripts/run-tutor-stub-action-outcome-collection-pilot.js';
import {
  buildTutorStubActionOutcomeCollectionAudit,
  renderTutorStubActionOutcomeCollectionAudit,
  wilsonInterval,
} from '../scripts/audit-tutor-stub-action-outcome-collection.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_PATH = 'config/tutor-stub-action-outcome-collection-pilot-design.v1.json';
const load = () => loadTutorStubActionOutcomeCollectionDesign({ root: REPO_ROOT, designPath: DESIGN_PATH });
const loadComparable = () =>
  loadTutorStubActionOutcomeComparableCollectionDesign({
    root: REPO_ROOT,
    designPath: TUTOR_STUB_ACTION_OUTCOME_COMPARABLE_COLLECTION_DESIGN_PATH,
  });

test('the prospective redesign preflight fixes the comparison seam without granting model calls', () => {
  const loaded = loadTutorStubActionOutcomeProspectiveRedesign({ root: REPO_ROOT });
  const result = runTutorStubActionOutcomeProspectiveRedesignPreflight({ loaded });
  assert.equal(result.status, 'passed_zero_call');
  assert.equal(result.modelCalls, 0);
  assert.equal(result.productionWrites, 0);
  assert.deepEqual(result.supportedEligibleSet.families, [
    'explain_model',
    'minimal_support',
    'request_self_explanation',
  ]);
  assert.deepEqual(
    result.auditOnlyEligibleSets.map((row) => row.families),
    [['diagnose_elicit'], ['fade_transfer']],
  );
});

function optionValue(args, option) {
  const index = args.indexOf(option);
  assert.notEqual(index, -1, `${option} must be present`);
  return args[index + 1];
}

function executionFixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'action-outcome-collection-launcher-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const source = load();
  const design = {
    ...source.design,
    destinations: { ...source.design.destinations, liveRoot: 'run' },
  };
  const loaded = { ...source, root: base, design };
  const destination = path.join(base, 'run');
  fs.mkdirSync(destination);
  const plan = buildTutorStubActionOutcomeCollectionPlan({ loaded, destination });
  const events = [];
  const admission = {
    source: { commit: 'fixture-commit', tree: 'fixture-tree' },
    authorization: { path: 'notes/fixture-go.md' },
    reserved: 0,
    get studyReserved() {
      return this.reserved;
    },
    reserveModelAttempts(count, detail) {
      this.reserved += count;
      events.push({ type: 'reserve', count, detail });
    },
    record(event) {
      events.push(event);
    },
    close(event) {
      this.closed = event;
      events.push(event);
    },
  };
  return { loaded, destination, preflight: { destination, plan }, admission, events };
}

function completeRow(job) {
  return {
    job_id: job.id,
    world_id: job.world_id,
    repeat: job.repeat,
    status: 'complete',
    exit: { code: 0, signal: null, spawn_error: null },
    trace: `jobs/${job.id}/traces/trace.jsonl`,
    transcript: `jobs/${job.id}/transcript.json`,
    run_end: { reason: 'auto_turn_cap', turns: 8 },
    turns: 8,
    typed_action_decisions: 8,
    typed_action_outcomes_closed: 7,
    model_attempts: {
      reserved: 25,
      completed: 25,
      failed: 0,
      budget_exhausted: false,
      accounting_balanced: true,
      normal_planned_successful: 25,
      successful_at_or_above_normal_plan: true,
      per_dialogue_ceiling: 81,
    },
  };
}

test('the zero-call quality audit fails sparse, auxiliary-inconclusive evidence without inventing review results', () => {
  const design = load().design;
  const generationRows = design.randomization.jobs.map((job) =>
    completeRow({ id: job.jobId, world_id: job.worldId, repeat: job.repeat }),
  );
  const source = {
    path: '/fixture/jobs/aocp1_foxtrot_jukebox_r01/traces/trace.jsonl',
    runId: 'fixture-run',
    sha256: 'a'.repeat(64),
    bytes: 100,
    metadata: { world: { id: 'world_022_foxtrot_jukebox' } },
    errors: [],
  };
  const seeded = {
    recordId: 'fixture-run:contract-1',
    source: source.path,
    recordedOutcome: 'inconclusive',
    auxiliaryDeliveryVisible: true,
    assignmentStatus: 'seeded_uniform_family_assignment',
    prospectiveAssignment: {
      selected_move_family: 'diagnose_elicit',
      eligible_move_families: [{ family: 'diagnose_elicit' }],
    },
  };
  const mandatory = {
    ...seeded,
    recordId: 'fixture-run:contract-2',
    assignmentStatus: 'mandatory_policy_authority_preserved',
    prospectiveAssignment: { eligible_move_families: [] },
  };
  const summary = {
    sourceFiles: 1,
    quarantinedSources: 0,
    events: 20,
    typedDecisions: 3,
    closedOutcomes: 2,
    joinedMemoryRecords: 1,
  };
  const registeredReadiness = {
    modelCalls: 0,
    summary,
    sources: [source],
    evidenceRows: [seeded],
    exclusionCounts: { no_declared_condition_matched: 1, non_unique_required_join: 1 },
  };
  const allObservedReadiness = {
    modelCalls: 0,
    summary: { ...summary, joinedMemoryRecords: 2 },
    sources: [source],
    evidenceRows: [seeded, mandatory],
    exclusionCounts: { non_unique_required_join: 1 },
  };
  const audit = buildTutorStubActionOutcomeCollectionAudit({
    design,
    generationReport: {
      schema: 'fixture-generation-report',
      study_id: design.studyId,
      status: 'generation_complete',
      source: { commit: 'fixture', detached: true, dirty: false },
      design: { path: DESIGN_PATH },
      memory_controller_enabled: false,
      rows: generationRows,
      execution: {
        planned_units: 24,
        missing_units: 0,
        completed_turns: 192,
        planned_turns: 192,
        model_attempts: {},
      },
    },
    registeredReadiness,
    allObservedReadiness,
    decisionInventory: [
      { assignmentStatus: 'seeded_uniform_family_assignment', conditionDisposition: 'matched' },
      { assignmentStatus: 'mandatory_policy_authority_preserved', conditionDisposition: 'unmatched' },
      { assignmentStatus: 'seeded_uniform_family_assignment', conditionDisposition: 'unmatched' },
    ],
    asOf: '2026-09-01T23:00:00.000Z',
  });

  assert.equal(audit.modelCalls, 0);
  assert.equal(audit.verdict, 'registered_feasibility_gates_failed');
  assert.equal(audit.controllerStudyLicensed, false);
  assert.equal(audit.extraction.maximumPotentialBinaryRecords, 0);
  assert.equal(
    audit.gates.find((entry) => entry.id === 'minimumVisibleDeliveryRateAmongConditionMatchedAssignments').status,
    'pass',
  );
  assert.equal(audit.gates.find((entry) => entry.id === 'minimumFinalUsableBinaryRecords').status, 'fail');
  assert.match(renderTutorStubActionOutcomeCollectionAudit(audit), /does not license a held-out controller study/u);
});

test('Wilson intervals retain the observed fraction and finite bounds', () => {
  const interval = wilsonInterval(30, 158);
  assert.equal(interval.successes, 30);
  assert.equal(interval.total, 158);
  assert.ok(Math.abs(interval.estimate - 30 / 158) < Number.EPSILON);
  assert.ok(interval.lower > 0.13 && interval.lower < interval.estimate);
  assert.ok(interval.upper > interval.estimate && interval.upper < 0.26);
  assert.equal(wilsonInterval(0, 0), null);
});

test('the registered design compiles exactly 24 balanced, held-out-safe jobs', () => {
  const loaded = load();
  const destination = path.resolve(REPO_ROOT, loaded.design.destinations.liveRoot);
  const plan = buildTutorStubActionOutcomeCollectionPlan({ loaded, destination });

  assert.equal(plan.jobs.length, 24);
  assert.equal(new Set(plan.jobs.map((job) => job.id)).size, 24);
  assert.equal(plan.planned_turns, 192);
  assert.equal(plan.planned_model_calls, 600);
  assert.equal(plan.model_attempt_ceiling, 1944);
  assert.equal(plan.memory_controller_enabled, false);
  assert.deepEqual(plan.held_out_worlds, ['world_030_rowan_flat', 'world_031_tideway_makerspace']);

  for (const worldId of loaded.design.population.collectionWorlds) {
    assert.deepEqual(
      plan.jobs.filter((job) => job.world_id === worldId).map((job) => job.repeat),
      [1, 2, 3, 4, 5, 6],
    );
  }
  for (const job of plan.jobs) {
    assert.equal(optionValue(job.args, '--world'), job.world_id);
    assert.equal(optionValue(job.args, '--eval-job-id'), job.id);
    assert.equal(optionValue(job.args, '--model-call-budget'), '81');
    assert.equal(optionValue(job.args, '--typed-action-assignment'), 'uniform_family_eligible');
    assert.ok(job.args.includes('--no-light-adaptation'));
    assert.ok(job.args.includes('--no-training-reuse'));
    assert.ok(!plan.held_out_worlds.includes(job.world_id));
  }
});

test('the v2 design compiles exactly 60 balanced jobs inside the fixed comparable set', () => {
  const loaded = loadComparable();
  const destination = path.resolve(REPO_ROOT, loaded.design.destinations.liveRoot);
  const plan = buildTutorStubActionOutcomeCollectionPlan({ loaded, destination });

  assert.equal(plan.study_id, 'tutor-stub-action-outcome-comparable-collection-v2');
  assert.equal(plan.jobs.length, 60);
  assert.equal(plan.planned_turns, 480);
  assert.equal(plan.planned_model_calls, 1500);
  assert.equal(plan.model_attempt_ceiling, 4860);
  assert.equal(
    loaded.design.comparability.eligibleSetId,
    'action-outcome-eligible-set.v1:explain_model+minimal_support+request_self_explanation',
  );
  assert.deepEqual(loaded.design.comparability.moveFamilies, [
    'explain_model',
    'minimal_support',
    'request_self_explanation',
  ]);
  assert.equal(loaded.design.humanReview.measurementPolicy, 'human_consensus_auxiliary_veto_v2');
  for (const worldId of loaded.design.population.collectionWorlds) {
    assert.deepEqual(
      plan.jobs.filter((job) => job.world_id === worldId).map((job) => job.repeat),
      Array.from({ length: 15 }, (_, index) => index + 1),
    );
  }
});

test('the v2 zero-call preflight pins the comparable design, routes, and ceiling', async () => {
  const loaded = loadComparable();
  const result = await runTutorStubActionOutcomeComparableCollectionPreflight({
    loaded,
    buildPlan: buildTutorStubActionOutcomeCollectionPlan,
    destinationExists: () => false,
    resolveArchive: () => '/private/fixture-archive',
    archiveIsWritable: () => true,
    probeRoute: (route) => ({ ...route, status: 'passed_zero_call', model_calls: 0 }),
    smokeRole: async (route) => ({ ...route, status: 'passed_zero_call_stub', model_calls: 0 }),
  });

  assert.equal(result.status, 'passed_zero_call');
  assert.equal(result.model_calls_executed, 0);
  assert.equal(result.production_writes, 0);
  assert.equal(result.plan.jobs.length, 60);
  assert.equal(result.plan.model_attempt_ceiling, 4860);
  assert.deepEqual(
    Object.entries(result.checks).filter(([, passed]) => !passed),
    [],
  );
});

test('the v2 recovery preflight requires the original live root and keeps later outputs unused', async () => {
  const loaded = loadComparable();
  const liveRoot = path.resolve(loaded.root, loaded.design.destinations.liveRoot);
  const destination = path.resolve(
    loaded.root,
    '.tutor-stub-auto-eval/action-outcome-comparable-collection-v2-2026-09-02-recovery-1',
  );
  const result = await runTutorStubActionOutcomeComparableCollectionPreflight({
    loaded,
    destination,
    recovery: true,
    buildPlan: buildTutorStubActionOutcomeCollectionPlan,
    destinationExists: (candidate) => path.resolve(candidate) === liveRoot,
    resolveArchive: () => '/private/fixture-archive',
    archiveIsWritable: () => true,
    probeRoute: (route) => ({ ...route, status: 'passed_zero_call', model_calls: 0 }),
    smokeRole: async (route) => ({ ...route, status: 'passed_zero_call_stub', model_calls: 0 }),
  });

  assert.equal(result.status, 'passed_zero_call');
  assert.equal(result.destination_availability.liveRoot, false);
  assert.equal(result.destination_availability.packetRoot, true);
  assert.equal(result.destination_availability.comparisonRoot, true);
  assert.equal(result.destination_availability.readinessRoot, true);
  assert.equal(result.checks.registered_destinations_match_launch_kind, true);
  assert.equal(result.checks.selected_destination_absent, true);
  assert.equal(result.model_calls_executed, 0);
  assert.equal(result.production_writes, 0);
});

test('the maintained launcher selects the pinned v2 design without authorizing calls', async () => {
  let observedStudy = null;
  const result = await collectionLauncherMain(
    ['--design', TUTOR_STUB_ACTION_OUTCOME_COMPARABLE_COLLECTION_DESIGN_PATH, '--dry-run'],
    {
      runPreflight: async ({ loaded }) => {
        observedStudy = loaded.design.studyId;
        return {
          status: 'passed_zero_call',
          checks: { fixture: true },
          plan: { jobs: [], model_attempt_ceiling: loaded.design.attemptCeiling.hardMaximumReservations },
        };
      },
    },
  );
  assert.equal(observedStudy, 'tutor-stub-action-outcome-comparable-collection-v2');
  assert.equal(result.plan.model_attempt_ceiling, 4860);
});

test('the route table holds every model-backed role to the registered Luna stack', () => {
  const routes = tutorStubActionOutcomeCollectionRouteTable(load().design);
  assert.deepEqual(
    routes.map((route) => route.role),
    ['tutor', 'learner_analysis', 'automated_learner'],
  );
  assert.deepEqual(new Set(routes.map((route) => route.modelRef)), new Set(['codex.gpt-5.6-luna']));
  assert.deepEqual(new Set(routes.map((route) => route.effort)), new Set(['low']));
});

test('zero-call preflight compiles the full plan, probes one transport, and grants nothing', async () => {
  const loaded = load();
  const probes = [];
  const smokes = [];
  const result = await runTutorStubActionOutcomeCollectionPreflight({
    loaded,
    destinationExists: () => false,
    resolveArchive: () => '/private/fixture-archive',
    archiveIsWritable: () => true,
    probeRoute(route) {
      probes.push(route);
      return { status: 'passed_zero_call', modelRef: route.modelRef, model_calls: 0 };
    },
    async smokeRole(route) {
      smokes.push(route);
      return { status: 'passed_zero_call_stub', role: route.role, model_calls: 0 };
    },
  });

  assert.equal(result.status, 'passed_zero_call');
  assert.equal(result.model_calls_executed, 0);
  assert.equal(result.production_writes, 0);
  assert.equal(probes.length, 1, 'one Luna transport probe covers all three roles');
  assert.equal(smokes.length, 3);
  assert.deepEqual(
    Object.entries(result.checks).filter(([, passed]) => !passed),
    [],
  );
  assert.equal(loaded.design.callAuthority.grantsModelCalls, false);
  assert.equal(loaded.design.callAuthority.grantsLaunch, false);
});

test('any occupied registered destination fails the zero-call preflight', async () => {
  const loaded = load();
  const occupied = path.resolve(loaded.root, loaded.design.destinations.comparisonRoot);
  const result = await runTutorStubActionOutcomeCollectionPreflight({
    loaded,
    destinationExists: (candidate) => candidate === occupied,
    resolveArchive: () => '/private/fixture-archive',
    archiveIsWritable: () => true,
    probeRoute: (route) => ({ ...route, status: 'passed_zero_call', model_calls: 0 }),
    smokeRole: async (route) => ({ ...route, status: 'passed_zero_call_stub', model_calls: 0 }),
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.destination_availability.comparisonRoot, false);
  assert.equal(result.checks.all_registered_destinations_absent, false);
});

test('zero-call preflight rejects an archive that exists but is not writable', async () => {
  const loaded = load();
  const result = await runTutorStubActionOutcomeCollectionPreflight({
    loaded,
    destinationExists: () => false,
    resolveArchive: () => '/private/read-only-archive',
    archiveIsWritable: () => false,
    probeRoute: (route) => ({ ...route, status: 'passed_zero_call', model_calls: 0 }),
    smokeRole: async (route) => ({ ...route, status: 'passed_zero_call_stub', model_calls: 0 }),
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.checks.private_archive_available, true);
  assert.equal(result.checks.private_archive_writable, false);
  assert.equal(result.production_writes, 0);
});

test('trace extraction requires the complete eight-turn, seven-outcome contract', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'action-outcome-collection-row-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const traceDir = path.join(base, 'traces');
  const transcript = path.join(base, 'transcript.json');
  fs.mkdirSync(traceDir);
  fs.writeFileSync(transcript, '{}\n');
  const events = [
    ...Array.from({ length: 25 }, () => ({ type: 'model_call_budget_reserved' })),
    ...Array.from({ length: 25 }, () => ({ type: 'model_call' })),
    ...Array.from({ length: 8 }, (_, index) => ({ type: 'turn_complete', turnRecord: { turn: index + 1 } })),
    ...Array.from({ length: 8 }, () => ({ type: 'tutor_typed_action_decision' })),
    ...Array.from({ length: 7 }, () => ({ type: 'tutor_typed_action_outcome_closed' })),
    { type: 'run_end', reason: 'auto_turn_cap', turns: 8 },
  ];
  fs.writeFileSync(path.join(traceDir, 'trace.jsonl'), `${events.map(JSON.stringify).join('\n')}\n`);
  const job = {
    id: 'fixture-job',
    world_id: 'fixture-world',
    repeat: 1,
    trace_dir: traceDir,
    transcript,
    planned_model_calls: 25,
    model_attempt_ceiling: 81,
  };

  const row = extractTutorStubActionOutcomeCollectionRow({
    job,
    exit: { code: 0, signal: null, spawn_error: null },
    destination: base,
  });
  assert.equal(row.status, 'complete');
  assert.equal(row.turns, 8);
  assert.equal(row.typed_action_decisions, 8);
  assert.equal(row.typed_action_outcomes_closed, 7);
  assert.deepEqual(row.model_attempts, {
    reserved: 25,
    completed: 25,
    failed: 0,
    budget_exhausted: false,
    accounting_balanced: true,
    normal_planned_successful: 25,
    successful_at_or_above_normal_plan: true,
    per_dialogue_ceiling: 81,
  });

  const repairedEvents = [
    ...events,
    { type: 'model_call_budget_reserved', role: 'tutor_stub_auto_learner', turn: 3 },
    { type: 'model_call', role: 'tutor_stub_auto_learner', turn: 3 },
    { type: 'model_call_budget_reserved', role: 'tutor_stub_learner_analysis', turn: 3 },
    { type: 'model_call', role: 'tutor_stub_learner_analysis', turn: 3 },
  ];
  fs.writeFileSync(path.join(traceDir, 'trace.jsonl'), `${repairedEvents.map(JSON.stringify).join('\n')}\n`);
  const repaired = extractTutorStubActionOutcomeCollectionRow({
    job,
    exit: { code: 0, signal: null, spawn_error: null },
    destination: base,
  });
  assert.equal(repaired.status, 'complete');
  assert.equal(repaired.model_attempts.completed, 27);
  assert.equal(repaired.model_attempts.successful_at_or_above_normal_plan, true);

  fs.writeFileSync(
    path.join(traceDir, 'trace.jsonl'),
    `${events
      .filter((event, index) => event.type !== 'model_call' || index !== 25)
      .map(JSON.stringify)
      .join('\n')}\n`,
  );
  const corrupt = extractTutorStubActionOutcomeCollectionRow({
    job,
    exit: { code: 0, signal: null, spawn_error: null },
    destination: base,
  });
  assert.equal(corrupt.status, 'technical_failure');
  assert.equal(corrupt.model_attempts.accounting_balanced, false);
});

test('execution accounts for all 24 jobs and seals the complete generation block', async (t) => {
  const value = executionFixture(t);
  const report = await executeTutorStubActionOutcomeCollection({
    ...value,
    childSpec: ({ job }) => job,
    runChild: async () => ({ code: 0, signal: null, spawn_error: null }),
    extractRow: ({ job }) => completeRow(job),
    progress: () => {},
  });

  assert.equal(report.status, 'generation_complete');
  assert.equal(report.memory_controller_enabled, false);
  assert.equal(report.execution.complete_units, 24);
  assert.equal(report.execution.missing_units, 0);
  assert.equal(report.execution.completed_turns, 192);
  assert.equal(report.execution.model_attempts.completed, 600);
  assert.equal(report.execution.model_attempts.reserved_by_shared_study_ledger, 1944);
  assert.equal(value.admission.closed.status, 'generation_complete');
  assert.equal(fs.existsSync(path.join(value.destination, 'plan.json')), true);
  assert.equal(fs.existsSync(path.join(value.destination, 'checkpoint.json')), true);
  assert.equal(fs.existsSync(path.join(value.destination, 'report.json')), true);
});

test('a technical failure stops before the next job and preserves bounded recovery authority', async (t) => {
  const value = executionFixture(t);
  const report = await executeTutorStubActionOutcomeCollection({
    ...value,
    childSpec: ({ job }) => job,
    runChild: async () => ({ code: null, signal: null, spawn_error: 'fixture transport failure' }),
    extractRow: ({ job }) => ({
      ...completeRow(job),
      status: 'technical_failure',
      exit: { code: null, signal: null, spawn_error: 'fixture transport failure' },
      turns: 0,
      model_attempts: {
        reserved: 1,
        completed: 0,
        failed: 1,
        budget_exhausted: false,
        accounting_balanced: true,
        normal_planned_successful: 25,
        successful_at_or_above_normal_plan: false,
        per_dialogue_ceiling: 81,
      },
    }),
    progress: () => {},
  });

  assert.equal(report.status, 'technical_failure');
  assert.equal(report.execution.technical_failure_units, 1);
  assert.equal(report.execution.missing_units, 23);
  assert.equal(value.admission.reserved, 81);
  assert.equal(value.admission.closed.recovery_permitted, true);
});

function interruptedRecoveryFixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'action-outcome-collection-recovery-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const source = load();
  const design = {
    ...source.design,
    destinations: { ...source.design.destinations, liveRoot: '.tutor-stub-auto-eval/fixture-initial' },
  };
  const loaded = { ...source, root: base, design };
  const sourceRoot = path.join(base, '.tutor-stub-auto-eval', 'fixture-initial');
  const recoveryDestination = path.join(base, '.tutor-stub-auto-eval', 'fixture-initial-recovery-1');
  const sourcePlan = buildTutorStubActionOutcomeCollectionPlan({ loaded, destination: sourceRoot });
  const recoveryPlan = buildTutorStubActionOutcomeCollectionPlan({
    loaded,
    destination: recoveryDestination,
    recovery: true,
  });
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.writeFileSync(
    path.join(sourceRoot, 'plan.json'),
    `${JSON.stringify({
      status: 'admitted_under_shared_paid_study_launch_contract',
      source: { commit: 'fixture-launch' },
      design: { path: loaded.relativePath },
      model_attempt_ceiling: 1944,
      preflight: { plan: sourcePlan },
    })}\n`,
  );
  const failedJob = sourcePlan.jobs[0];
  fs.mkdirSync(failedJob.trace_dir, { recursive: true });
  const traceEvents = [
    ...Array.from({ length: 31 }, () => ({ type: 'model_call_budget_reserved' })),
    ...Array.from({ length: 30 }, () => ({ type: 'model_call' })),
    ...Array.from({ length: 5 }, (_, index) => ({ type: 'turn_complete', turnRecord: { turn: index + 1 } })),
    ...Array.from({ length: 5 }, () => ({ type: 'tutor_typed_action_decision' })),
    ...Array.from({ length: 4 }, () => ({ type: 'tutor_typed_action_outcome_closed' })),
  ];
  fs.writeFileSync(path.join(failedJob.trace_dir, 'trace.jsonl'), `${traceEvents.map(JSON.stringify).join('\n')}\n`);
  const studyStateRoot = path.join(base, '.tutor-stub-auto-eval', '.paid-study-state');
  const studyDirectory = path.join(studyStateRoot, loaded.design.studyId);
  fs.mkdirSync(studyDirectory, { recursive: true });
  const studyLedgerPath = path.join(studyDirectory, 'study-ledger.jsonl');
  const runLedger = [
    {
      type: 'launch_admitted',
      study_id: loaded.design.studyId,
      source_commit: 'fixture-launch',
      design_path: loaded.relativePath,
      spend_cap: 1944,
      study_ledger: studyLedgerPath,
    },
    { type: 'model_attempt_reserved', unit: failedJob.id, count: 81 },
    {
      type: 'run_sealed',
      status: 'technical_failure',
      recovery_permitted: true,
      reserved_attempts: 81,
      reason: 'fixture interrupted launcher',
    },
  ];
  fs.writeFileSync(path.join(sourceRoot, 'run-ledger.jsonl'), `${runLedger.map(JSON.stringify).join('\n')}\n`);
  const studyLedger = [
    { type: 'study_created', study_id: loaded.design.studyId, model_attempt_ceiling: 1944 },
    {
      type: 'study_launch_admitted',
      study_id: loaded.design.studyId,
      destination: sourceRoot,
      run_ledger: path.join(sourceRoot, 'run-ledger.jsonl'),
    },
    {
      type: 'study_model_attempt_reserved',
      destination: sourceRoot,
      unit: failedJob.id,
      count: 81,
      study_reserved: 81,
      model_attempt_ceiling: 1944,
    },
    {
      type: 'study_run_sealed',
      destination: sourceRoot,
      status: 'technical_failure',
      recovery_permitted: true,
      reserved_in_run: 81,
      study_reserved: 81,
      model_attempt_ceiling: 1944,
    },
  ];
  fs.writeFileSync(studyLedgerPath, `${studyLedger.map(JSON.stringify).join('\n')}\n`);
  const preflight = { destination: recoveryDestination, plan: recoveryPlan };
  return { loaded, sourceRoot, recoveryDestination, preflight, failedJob };
}

function linkedZeroProviderRecoveryFixture(t) {
  const initial = interruptedRecoveryFixture(t);
  const firstRecovery = loadTutorStubActionOutcomeCollectionRecovery({
    loaded: initial.loaded,
    preflight: initial.preflight,
    recoveryFrom: initial.sourceRoot,
  });
  const sourceRoot = initial.recoveryDestination;
  const nextDestination = path.join(initial.loaded.root, '.tutor-stub-auto-eval', 'fixture-initial-recovery-2');
  const sourcePlan = initial.preflight.plan;
  const nextPlan = buildTutorStubActionOutcomeCollectionPlan({
    loaded: initial.loaded,
    destination: nextDestination,
    recovery: true,
  });
  const failedJob = sourcePlan.jobs[1];
  const zeroProviderRow = {
    job_id: failedJob.id,
    world_id: failedJob.world_id,
    repeat: failedJob.repeat,
    status: 'technical_failure',
    exit: { code: 1, signal: null, spawn_error: null },
    trace: null,
    transcript: null,
    run_end: null,
    turns: 0,
    typed_action_decisions: 0,
    typed_action_outcomes_closed: 0,
    model_attempts: {
      reserved: 0,
      completed: 0,
      failed: 0,
      budget_exhausted: false,
      accounting_balanced: true,
      normal_planned_successful: 25,
      successful_at_or_above_normal_plan: false,
      per_dialogue_ceiling: 81,
    },
  };
  const rows = [...firstRecovery.priorRows, zeroProviderRow];
  const studyLedgerPath = path.join(
    initial.loaded.root,
    '.tutor-stub-auto-eval',
    '.paid-study-state',
    initial.loaded.design.studyId,
    'study-ledger.jsonl',
  );
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.writeFileSync(
    path.join(sourceRoot, 'plan.json'),
    `${JSON.stringify({
      status: 'admitted_under_shared_paid_study_launch_contract',
      source: { commit: 'fixture-recovery' },
      design: { path: initial.loaded.relativePath },
      model_attempt_ceiling: 1944,
      recovery: {
        source_root: initial.sourceRoot,
        source_plan: path.join(initial.sourceRoot, 'plan.json'),
        source_ledger: path.join(initial.sourceRoot, 'run-ledger.jsonl'),
        prior_reserved_attempts: 81,
        prior_completed_units: 0,
        failed_job_ids: [initial.failedJob.id],
      },
      execution_job_ids: firstRecovery.executionJobs.map((job) => job.id),
      preflight: { plan: sourcePlan },
    })}\n`,
  );
  fs.writeFileSync(
    path.join(sourceRoot, 'checkpoint.json'),
    `${JSON.stringify({
      status: 'technical_failure',
      rows,
      missing_job_ids: nextPlan.jobs.slice(2).map((job) => job.id),
      shared_reserved_attempts: 81,
      hard_ceiling: 1944,
    })}\n`,
  );
  fs.writeFileSync(
    path.join(sourceRoot, 'report.json'),
    `${JSON.stringify({
      schema: 'machinespirits.tutor-stub.action-outcome-collection-generation-report.v1',
      study_id: initial.loaded.design.studyId,
      status: 'technical_failure',
      source: { commit: 'fixture-recovery' },
      recovery: { source_root: initial.sourceRoot },
      execution: {
        model_attempts: {
          reserved_in_predecessor: 81,
          reserved_in_current_run: 81,
          reserved_by_shared_study_ledger: 162,
          hard_ceiling: 1944,
        },
      },
      rows,
    })}\n`,
  );
  const runLedgerPath = path.join(sourceRoot, 'run-ledger.jsonl');
  const runLedger = [
    {
      type: 'launch_admitted',
      study_id: initial.loaded.design.studyId,
      source_commit: 'fixture-recovery',
      design_path: initial.loaded.relativePath,
      spend_cap: 1944,
      study_ledger: studyLedgerPath,
      launch_kind: 'recovery',
      recovery_from: initial.sourceRoot,
    },
    { type: 'model_attempt_reserved', unit: failedJob.id, count: 81 },
    {
      type: 'unit_complete',
      job_id: failedJob.id,
      status: 'technical_failure',
      child_reserved_attempts: 0,
      child_completed_attempts: 0,
      child_failed_attempts: 0,
    },
    { type: 'run_sealed', status: 'technical_failure', reserved_attempts: 81 },
  ];
  fs.writeFileSync(runLedgerPath, `${runLedger.map(JSON.stringify).join('\n')}\n`);
  const studyEvents = fs.readFileSync(studyLedgerPath, 'utf8').trim().split('\n').map(JSON.parse);
  studyEvents.push(
    {
      type: 'study_launch_admitted',
      study_id: initial.loaded.design.studyId,
      destination: sourceRoot,
      run_ledger: runLedgerPath,
      launch_kind: 'recovery',
      recovery_from: initial.sourceRoot,
    },
    {
      type: 'study_model_attempt_reserved',
      destination: sourceRoot,
      unit: failedJob.id,
      count: 81,
      study_reserved: 162,
      model_attempt_ceiling: 1944,
    },
    {
      type: 'study_run_sealed',
      destination: sourceRoot,
      run_ledger: runLedgerPath,
      status: 'technical_failure',
      recovery_permitted: false,
      reserved_in_run: 81,
      study_reserved: 162,
      model_attempt_ceiling: 1944,
    },
  );
  fs.writeFileSync(studyLedgerPath, `${studyEvents.map(JSON.stringify).join('\n')}\n`);
  return {
    ...initial,
    firstFailedJob: initial.failedJob,
    sourceRoot,
    nextDestination,
    failedJob,
    preflight: { destination: nextDestination, plan: nextPlan },
  };
}

function linkedInterruptedRecoveryFixture(t) {
  const initial = interruptedRecoveryFixture(t);
  const firstRecovery = loadTutorStubActionOutcomeCollectionRecovery({
    loaded: initial.loaded,
    preflight: initial.preflight,
    recoveryFrom: initial.sourceRoot,
  });
  const sourceRoot = initial.recoveryDestination;
  const nextDestination = path.join(initial.loaded.root, '.tutor-stub-auto-eval', 'fixture-initial-recovery-2');
  const sourcePlan = initial.preflight.plan;
  const nextPlan = buildTutorStubActionOutcomeCollectionPlan({
    loaded: initial.loaded,
    destination: nextDestination,
    recovery: true,
  });
  const completedJob = sourcePlan.jobs[1];
  const failedJob = sourcePlan.jobs[2];
  const completedRow = completeRow(completedJob);
  const rows = [...firstRecovery.priorRows, completedRow];
  const studyLedgerPath = path.join(
    initial.loaded.root,
    '.tutor-stub-auto-eval',
    '.paid-study-state',
    initial.loaded.design.studyId,
    'study-ledger.jsonl',
  );
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.writeFileSync(
    path.join(sourceRoot, 'plan.json'),
    `${JSON.stringify({
      status: 'admitted_under_shared_paid_study_launch_contract',
      source: { commit: 'fixture-recovery' },
      design: { path: initial.loaded.relativePath },
      model_attempt_ceiling: 1944,
      recovery: {
        source_root: initial.sourceRoot,
        source_plan: path.join(initial.sourceRoot, 'plan.json'),
        source_ledger: path.join(initial.sourceRoot, 'run-ledger.jsonl'),
        prior_reserved_attempts: 81,
        prior_completed_units: 0,
        failed_job_ids: [initial.failedJob.id],
      },
      execution_job_ids: firstRecovery.executionJobs.map((job) => job.id),
      preflight: { plan: sourcePlan },
    })}\n`,
  );
  fs.writeFileSync(
    path.join(sourceRoot, 'checkpoint.json'),
    `${JSON.stringify({
      status: 'generation_running',
      rows,
      missing_job_ids: sourcePlan.jobs.slice(2).map((job) => job.id),
      shared_reserved_attempts: 81,
      hard_ceiling: 1944,
    })}\n`,
  );
  fs.mkdirSync(failedJob.trace_dir, { recursive: true });
  const traceEvents = [
    ...Array.from({ length: 31 }, () => ({ type: 'model_call_budget_reserved' })),
    ...Array.from({ length: 30 }, () => ({ type: 'model_call' })),
    ...Array.from({ length: 5 }, (_, index) => ({ type: 'turn_complete', turnRecord: { turn: index + 1 } })),
    ...Array.from({ length: 5 }, () => ({ type: 'tutor_typed_action_decision' })),
    ...Array.from({ length: 4 }, () => ({ type: 'tutor_typed_action_outcome_closed' })),
  ];
  fs.writeFileSync(path.join(failedJob.trace_dir, 'trace.jsonl'), `${traceEvents.map(JSON.stringify).join('\n')}\n`);
  const runLedgerPath = path.join(sourceRoot, 'run-ledger.jsonl');
  const runLedger = [
    {
      type: 'launch_admitted',
      study_id: initial.loaded.design.studyId,
      source_commit: 'fixture-recovery',
      design_path: initial.loaded.relativePath,
      spend_cap: 1944,
      study_ledger: studyLedgerPath,
      launch_kind: 'recovery',
      recovery_from: initial.sourceRoot,
    },
    { type: 'model_attempt_reserved', unit: completedJob.id, count: 81 },
    {
      type: 'unit_complete',
      job_id: completedJob.id,
      status: 'complete',
      child_reserved_attempts: 25,
      child_completed_attempts: 25,
      child_failed_attempts: 0,
    },
    { type: 'model_attempt_reserved', unit: failedJob.id, count: 81 },
    {
      type: 'run_sealed',
      status: 'technical_failure',
      recovery_permitted: true,
      reserved_attempts: 162,
      reason: 'fixture interrupted linked recovery',
    },
  ];
  fs.writeFileSync(runLedgerPath, `${runLedger.map(JSON.stringify).join('\n')}\n`);
  const studyEvents = fs.readFileSync(studyLedgerPath, 'utf8').trim().split('\n').map(JSON.parse);
  studyEvents.push(
    {
      type: 'study_launch_admitted',
      study_id: initial.loaded.design.studyId,
      destination: sourceRoot,
      run_ledger: runLedgerPath,
      launch_kind: 'recovery',
      recovery_from: initial.sourceRoot,
    },
    {
      type: 'study_model_attempt_reserved',
      destination: sourceRoot,
      unit: completedJob.id,
      count: 81,
      study_reserved: 162,
      model_attempt_ceiling: 1944,
    },
    {
      type: 'study_model_attempt_reserved',
      destination: sourceRoot,
      unit: failedJob.id,
      count: 81,
      study_reserved: 243,
      model_attempt_ceiling: 1944,
    },
    {
      type: 'study_run_sealed',
      destination: sourceRoot,
      run_ledger: runLedgerPath,
      status: 'technical_failure',
      recovery_permitted: true,
      reserved_in_run: 162,
      study_reserved: 243,
      model_attempt_ceiling: 1944,
    },
  );
  fs.writeFileSync(studyLedgerPath, `${studyEvents.map(JSON.stringify).join('\n')}\n`);
  return {
    ...initial,
    firstFailedJob: initial.failedJob,
    sourceRoot,
    nextDestination,
    completedJob,
    failedJob,
    preflight: { destination: nextDestination, plan: nextPlan },
  };
}

test('recovery validates the sealed predecessor and selects only 23 never-attempted jobs', (t) => {
  const value = interruptedRecoveryFixture(t);
  const recovery = loadTutorStubActionOutcomeCollectionRecovery({
    loaded: value.loaded,
    preflight: value.preflight,
    recoveryFrom: value.sourceRoot,
  });
  assert.equal(recovery.prior_reserved_attempts, 81);
  assert.equal(recovery.prior_completed_units, 0);
  assert.deepEqual(recovery.failed_job_ids, [value.failedJob.id]);
  assert.equal(recovery.priorRows.length, 1);
  assert.equal(recovery.priorRows[0].status, 'technical_failure');
  assert.equal(recovery.priorRows[0].turns, 5);
  assert.equal(recovery.priorRows[0].model_attempts.reserved, 31);
  assert.equal(recovery.priorRows[0].model_attempts.completed, 30);
  assert.equal(recovery.executionJobs.length, 23);
  assert.equal(
    recovery.executionJobs.some((job) => job.id === value.failedJob.id),
    false,
  );
  assert.equal(81 + recovery.executionJobs.length * 81, 1944);
});

test('linked recovery preserves two failures and selects only 22 untouched jobs', (t) => {
  const value = linkedZeroProviderRecoveryFixture(t);
  const recovery = loadTutorStubActionOutcomeCollectionRecovery({
    loaded: value.loaded,
    preflight: value.preflight,
    recoveryFrom: value.sourceRoot,
  });
  assert.equal(recovery.prior_reserved_attempts, 162);
  assert.equal(recovery.prior_completed_units, 0);
  assert.deepEqual(recovery.failed_job_ids, [value.firstFailedJob.id, value.failedJob.id]);
  assert.equal(recovery.priorRows.length, 2);
  assert.equal(recovery.priorRows[1].artifact_root, value.sourceRoot);
  assert.equal(recovery.executionJobs.length, 22);
  assert.equal(recovery.executionJobs[0].id.endsWith('r03'), true);
  assert.equal(162 + recovery.executionJobs.length * 81, 1944);
});

test('linked interrupted recovery preserves both partial failures and selects only untouched jobs', (t) => {
  const value = linkedInterruptedRecoveryFixture(t);
  const recovery = loadTutorStubActionOutcomeCollectionRecovery({
    loaded: value.loaded,
    preflight: value.preflight,
    recoveryFrom: value.sourceRoot,
  });
  assert.equal(recovery.prior_reserved_attempts, 243);
  assert.equal(recovery.prior_completed_units, 1);
  assert.deepEqual(recovery.failed_job_ids, [value.firstFailedJob.id, value.failedJob.id]);
  assert.equal(recovery.priorRows.length, 3);
  assert.equal(recovery.priorRows[2].artifact_root, value.sourceRoot);
  assert.equal(recovery.priorRows[2].turns, 5);
  assert.equal(recovery.priorRows[2].model_attempts.reserved, 31);
  assert.equal(recovery.priorRows[2].model_attempts.completed, 30);
  assert.equal(recovery.executionJobs.length, 21);
  assert.equal(recovery.executionJobs[0].id.endsWith('r04'), true);
  assert.equal(243 + recovery.executionJobs.length * 81, 1944);
});

test('linked recovery seals after the remaining 22 untouched jobs', async (t) => {
  const value = linkedZeroProviderRecoveryFixture(t);
  const recovery = loadTutorStubActionOutcomeCollectionRecovery({
    loaded: value.loaded,
    preflight: value.preflight,
    recoveryFrom: value.sourceRoot,
  });
  fs.mkdirSync(value.nextDestination, { recursive: true });
  const admission = {
    source: { commit: 'fixture-linked-recovery', tree: 'fixture-tree' },
    authorization: { path: 'notes/fixture-go.md' },
    reserved: 0,
    get studyReserved() {
      return 162 + this.reserved;
    },
    reserveModelAttempts(count) {
      this.reserved += count;
    },
    record() {},
    close(event) {
      this.closed = event;
    },
  };
  const report = await executeTutorStubActionOutcomeCollection({
    loaded: value.loaded,
    preflight: { ...value.preflight, recovery, executionJobs: recovery.executionJobs },
    admission,
    childSpec: ({ job }) => job,
    runChild: async () => ({ code: 0, signal: null, spawn_error: null }),
    extractRow: ({ job }) => completeRow(job),
    progress: () => {},
  });

  assert.equal(report.status, 'generation_complete_with_technical_failure');
  assert.equal(report.execution.complete_units, 22);
  assert.equal(report.execution.technical_failure_units, 2);
  assert.equal(report.execution.missing_units, 0);
  assert.equal(report.execution.model_attempts.reserved_in_predecessor, 162);
  assert.equal(report.execution.model_attempts.reserved_in_current_run, 1782);
  assert.equal(report.execution.model_attempts.reserved_by_shared_study_ledger, 1944);
  assert.equal(admission.closed.recovery_permitted, undefined);
});

test('missing-only recovery preserves the failed unit and seals after the other 23 jobs', async (t) => {
  const value = interruptedRecoveryFixture(t);
  const recovery = loadTutorStubActionOutcomeCollectionRecovery({
    loaded: value.loaded,
    preflight: value.preflight,
    recoveryFrom: value.sourceRoot,
  });
  fs.mkdirSync(value.recoveryDestination, { recursive: true });
  const events = [];
  const admission = {
    source: { commit: 'fixture-recovery', tree: 'fixture-tree' },
    authorization: { path: 'notes/fixture-recovery-go.md' },
    reserved: 0,
    get studyReserved() {
      return 81 + this.reserved;
    },
    reserveModelAttempts(count, detail) {
      this.reserved += count;
      events.push({ type: 'reserve', count, detail });
    },
    record(event) {
      events.push(event);
    },
    close(event) {
      this.closed = event;
      events.push(event);
    },
  };
  const report = await executeTutorStubActionOutcomeCollection({
    loaded: value.loaded,
    preflight: { ...value.preflight, recovery, executionJobs: recovery.executionJobs },
    admission,
    childSpec: ({ job }) => job,
    runChild: async () => ({ code: 0, signal: null, spawn_error: null }),
    extractRow: ({ job }) => completeRow(job),
    progress: () => {},
  });

  assert.equal(report.status, 'generation_complete_with_technical_failure');
  assert.equal(report.execution.complete_units, 23);
  assert.equal(report.execution.technical_failure_units, 1);
  assert.equal(report.execution.missing_units, 0);
  assert.equal(report.execution.model_attempts.reserved_in_predecessor, 81);
  assert.equal(report.execution.model_attempts.reserved_in_current_run, 1863);
  assert.equal(report.execution.model_attempts.reserved_by_shared_study_ledger, 1944);
  assert.equal(admission.closed.status, 'generation_complete_with_technical_failure');
  assert.equal(admission.closed.recovery_permitted, undefined);
  assert.equal(events.filter((event) => event.type === 'reserve').length, 23);
  assert.equal(
    events.some((event) => event.type === 'reserve' && event.detail.unit === value.failedJob.id),
    false,
  );
});

test('CLI dry-run returns before admission, while live wiring passes the registered ceiling', async () => {
  let admissionCalls = 0;
  const preflight = {
    status: 'passed_zero_call',
    destination: path.join(REPO_ROOT, '.tutor-stub-auto-eval', 'action-outcome-collection-pilot-v1-2026-09-01'),
    plan: { model_attempt_ceiling: 1944, jobs: [] },
    model_calls_executed: 0,
    production_writes: 0,
  };
  await collectionLauncherMain(['--dry-run'], {
    runPreflight: async () => preflight,
    admit() {
      admissionCalls += 1;
      throw new Error('dry-run reached paid admission');
    },
  });
  assert.equal(admissionCalls, 0);

  let admitted = null;
  let executed = false;
  await collectionLauncherMain(
    [
      '--launch-commit',
      'fixture-launch',
      '--go-note-commit',
      'fixture-go',
      '--go-note-path',
      'notes/fixture-go.md',
      '--accept-charges',
    ],
    {
      runPreflight: async () => preflight,
      admit(input) {
        admitted = input;
        return { fixture: true };
      },
      execute({ loaded, admission }) {
        assert.equal(loaded.design.studyId, 'tutor-stub-action-outcome-collection-pilot-v1');
        assert.deepEqual(admission, { fixture: true });
        executed = true;
        return { status: 'fixture_complete' };
      },
    },
  );
  assert.equal(admitted.spendCap, 1944);
  assert.equal(admitted.studyId, 'tutor-stub-action-outcome-collection-pilot-v1');
  assert.equal(admitted.designPath, DESIGN_PATH);
  assert.equal(executed, true);
});

test('CLI reports the exact failed zero-call checks before admission', async () => {
  let admissionCalls = 0;
  await assert.rejects(
    collectionLauncherMain(['--dry-run'], {
      runPreflight: async () => ({
        status: 'failed',
        checks: { private_archive_available: true, private_archive_writable: false },
      }),
      admit() {
        admissionCalls += 1;
      },
    }),
    /zero-call preflight failed: private_archive_writable/u,
  );
  assert.equal(admissionCalls, 0);
});
