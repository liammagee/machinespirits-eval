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
  executeTutorStubActionOutcomeCollection,
  extractTutorStubActionOutcomeCollectionRow,
  main as collectionLauncherMain,
} from '../scripts/run-tutor-stub-action-outcome-collection-pilot.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_PATH = 'config/tutor-stub-action-outcome-collection-pilot-design.v1.json';
const load = () => loadTutorStubActionOutcomeCollectionDesign({ root: REPO_ROOT, designPath: DESIGN_PATH });

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
      planned_successful: 25,
      per_dialogue_ceiling: 81,
    },
  };
}

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
    probeRoute: (route) => ({ ...route, status: 'passed_zero_call', model_calls: 0 }),
    smokeRole: async (route) => ({ ...route, status: 'passed_zero_call_stub', model_calls: 0 }),
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.destination_availability.comparisonRoot, false);
  assert.equal(result.checks.all_registered_destinations_absent, false);
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
    planned_successful: 25,
    per_dialogue_ceiling: 81,
  });

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
  assert.equal(report.execution.model_attempts.reserved_by_shared_ledger, 1944);
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
        planned_successful: 25,
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
