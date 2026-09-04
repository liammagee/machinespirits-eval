import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  STEERING_DECOMPOSITION_ABSOLUTE_READER_ATTEMPT_CEILING,
  STEERING_DECOMPOSITION_AUTHORIZATION_MAXIMUM_CALLS,
  STEERING_DECOMPOSITION_CASES,
  STEERING_DECOMPOSITION_DECISION_CALLS,
  STEERING_DECOMPOSITION_DIALOGUES,
  STEERING_DECOMPOSITION_SEEDS,
  auditSteeringDecompositionSeedFreshness,
  buildSteeringDecompositionAssignments,
  buildSteeringDecompositionDryRun,
  guardSteeringDecompositionAssembly,
  guardSteeringDecompositionDecisionCollection,
  guardSteeringDecompositionStudyPlan,
  guardSteeringOnlyZeroChallenge,
  steeringDecompositionResumeSeedExclusions,
  verifySteeringDecompositionManifest,
} from '../scripts/run-adaptive-warrant-steering-decomposition.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SCRIPT = path.join(ROOT, 'scripts/run-adaptive-warrant-steering-decomposition.js');

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'steering-decomposition-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function writeTrace(directory, id, actionFamily = 'stage_next_step') {
  const tracePath = path.join(directory, `${id}.jsonl`);
  const rows = Array.from({ length: 8 }, (_unused, index) => ({
    type: 'turn_complete',
    turnRecord: { turn: index + 1, actual_action_family: actionFamily },
  }));
  fs.writeFileSync(tracePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
  return tracePath;
}

test('steering decomposition freezes the registered 48-dialogue balanced design and exact call bounds', () => {
  const guarded = verifySteeringDecompositionManifest();
  assert.deepEqual(guarded.manifest.seeds, STEERING_DECOMPOSITION_SEEDS);
  assert.deepEqual(guarded.manifest.conditions, ['gated', 'steering_only']);
  const assignments = buildSteeringDecompositionAssignments({ seeds: guarded.manifest.seeds });
  const plan = guardSteeringDecompositionStudyPlan({ manifest: guarded.manifest, assignments });
  assert.equal(plan.status, 'passed');
  assert.equal(plan.counts.dialogues, 48);
  assert.deepEqual(plan.counts.by_condition, { gated: 24, steering_only: 24 });
  assert.equal(
    Object.values(plan.counts.by_seed).every((count) => count === 4),
    true,
  );
  assert.equal(STEERING_DECOMPOSITION_CASES, 384);
  assert.equal(STEERING_DECOMPOSITION_DECISION_CALLS, 768);
  assert.equal(STEERING_DECOMPOSITION_AUTHORIZATION_MAXIMUM_CALLS, 788);
  assert.equal(STEERING_DECOMPOSITION_ABSOLUTE_READER_ATTEMPT_CEILING, 800);
});

test('steering decomposition dry-run builds active gated twins and disables challenges only in steering_only', () => {
  const dryRun = buildSteeringDecompositionDryRun();
  assert.equal(dryRun.status, 'passed');
  assert.equal(dryRun.zero_model_calls, true);
  assert.equal(dryRun.model_calls, 0);
  assert.equal(dryRun.jobs.length, STEERING_DECOMPOSITION_DIALOGUES);
  assert.equal(dryRun.checks.gated_unchanged, true);
  assert.equal(dryRun.checks.steering_only_unselectable, true);
});

test('steering decomposition bare invocation stays zero-call and its former paid path is retired', (t) => {
  const output = execFileSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: 'utf8' });
  assert.match(output, /HOLD \/ zero-call plan only/u);
  assert.match(output, /run cap 2240 calls/u);

  const outputDir = path.join(temporaryDirectory(t), 'must-not-exist');
  const refused = spawnSync(
    process.execPath,
    [SCRIPT, '--accept-charges', '--out', outputDir, '--instrument-freeze', '/missing/freeze.json'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /paid launcher retired: adaptive-warrant-steering-decomposition/u);
  assert.equal(fs.existsSync(outputDir), false);
});

test('steering decomposition seed audit passes a clean root and catches registered-seed run evidence', (t) => {
  const directory = temporaryDirectory(t);
  assert.equal(auditSteeringDecompositionSeedFreshness({ roots: [directory] }).status, 'passed');
  const burned = path.join(directory, 'burned-s536');
  fs.mkdirSync(burned, { recursive: true });
  fs.writeFileSync(path.join(burned, 'run-plan.json'), '{"command":["--run-seed","536"]}\n');
  const failed = auditSteeringDecompositionSeedFreshness({ roots: [directory] });
  assert.equal(failed.status, 'failed');
  assert.equal(
    failed.hits.some((row) => row.seed === 536 && row.kind === 'run_directory_name'),
    true,
  );
  assert.equal(
    failed.hits.some((row) => row.seed === 536 && row.kind === 'run_metadata'),
    true,
  );
});

test('steering decomposition resume excludes only its local run and automatic private mirror', (t) => {
  const directory = temporaryDirectory(t);
  const repoRoot = path.join(directory, 'worktree');
  const privateArchiveRoot = path.join(directory, 'private');
  const relativeRun = path.join('.tutor-stub-auto-eval', 'live-run');
  const rootDir = path.join(repoRoot, relativeRun);
  const mirrorRoot = path.join(privateArchiveRoot, 'artifacts', 'tutor-stub-live', relativeRun);
  for (const base of [rootDir, mirrorRoot]) {
    const dialogue = path.join(base, 'dialogues', 'outcome-main-s536-gated');
    fs.mkdirSync(dialogue, { recursive: true });
    fs.writeFileSync(path.join(dialogue, 'run-plan.json'), '{"command":["--run-seed","536"]}\n');
  }
  const priorRun = path.join(privateArchiveRoot, 'prior-s537');
  fs.mkdirSync(priorRun, { recursive: true });
  fs.writeFileSync(path.join(priorRun, 'run-plan.json'), '{"command":["--run-seed","537"]}\n');

  const excludeRoots = steeringDecompositionResumeSeedExclusions({
    rootDir,
    repoRoot,
    privateArchiveRoot,
  });
  const audit = auditSteeringDecompositionSeedFreshness({
    roots: [path.join(repoRoot, '.tutor-stub-auto-eval'), privateArchiveRoot],
    excludeRoots,
  });
  assert.deepEqual(excludeRoots, [rootDir, mirrorRoot]);
  assert.equal(audit.status, 'failed');
  assert.equal(
    audit.hits.some((row) => row.seed === 536),
    false,
  );
  assert.equal(
    audit.hits.some((row) => row.seed === 537),
    true,
  );
});

test('zero-challenge validity guard passes a mock steering_only batch and rejects one delivered challenge', (t) => {
  const directory = temporaryDirectory(t);
  const completed = Array.from({ length: 24 }, (_unused, index) => ({
    id: `steering-${index + 1}`,
    condition: 'steering_only',
    trace_path: writeTrace(directory, `steering-${index + 1}`),
  }));
  assert.equal(guardSteeringOnlyZeroChallenge({ completed }).status, 'passed');
  completed[7].trace_path = writeTrace(directory, 'steering-8-challenge', 'challenge_resistance');
  const failed = guardSteeringOnlyZeroChallenge({ completed });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.violations.length, 8);
});

test('assembly gate requires 384 cases, 768 accepted reads, and at most 800 reader attempts', () => {
  const batches = Array.from({ length: STEERING_DECOMPOSITION_CASES }, (_unused, index) => ({
    required_sample_ids: [`case-${index + 1}`],
  }));
  const collectionGuard = guardSteeringDecompositionDecisionCollection({
    manifest: {
      corpus: { cases: STEERING_DECOMPOSITION_CASES },
      readers: [
        { reader_id: 'decision-reader-a', batches },
        { reader_id: 'decision-reader-b', batches: structuredClone(batches) },
      ],
    },
    authorizationRequest: {
      call_budget: {
        planned_calls: STEERING_DECOMPOSITION_DECISION_CALLS,
        maximum_calls: STEERING_DECOMPOSITION_AUTHORIZATION_MAXIMUM_CALLS,
      },
    },
  });
  const passed = guardSteeringDecompositionAssembly({
    collectionGuard,
    readerRun: { status: 'complete', calls_attempted: 800 },
    acceptanceAudit: { responses_validated: 768 },
  });
  assert.equal(passed.status, 'passed');
  const failed = guardSteeringDecompositionAssembly({
    collectionGuard,
    readerRun: { status: 'complete', calls_attempted: 801 },
    acceptanceAudit: { responses_validated: 768 },
  });
  assert.equal(failed.status, 'failed');
});
