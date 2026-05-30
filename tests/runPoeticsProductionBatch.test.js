import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  buildPlan,
  generationCommand,
  DEFAULT_CRITICS,
  modelSlug,
  parseArgs,
  runScoreJobsPooled,
  scoreCommand,
  scoreJobs,
  structureCriticCommand,
  structureCriticJobs,
} from '../scripts/run-poetics-production-batch.js';

function planCommandValue(cmd, flag) {
  const i = cmd.indexOf(flag);
  return i === -1 ? null : cmd[i + 1];
}

describe('run-poetics-production-batch', () => {
  it('builds the pre-specified target/control/stress unit set', () => {
    const args = parseArgs([
      '--batch-id',
      'phase2-production-v1-test',
      '--root-dir',
      '/tmp/phase2-production-v1-test',
      '--repeats',
      '2',
      '--stress-repeats',
      '1',
    ]);
    const plan = buildPlan(args);

    assert.equal(plan.units.filter((unit) => unit.kind === 'target').length, 2);
    assert.equal(plan.units.filter((unit) => unit.kind === 'control').length, 8);
    assert.equal(plan.units.filter((unit) => unit.kind === 'stress').length, 1);
    assert.deepEqual(
      plan.units.filter((unit) => unit.kind === 'target').map((unit) => unit.pairedPolicies),
      [
        ['none', 'reframe'],
        ['none', 'reframe'],
      ],
    );
    assert.deepEqual(
      plan.units.filter((unit) => unit.kind === 'target').map((unit) => unit.directorVariationKey),
      ['phase2-production-v1-test:r01:target', 'phase2-production-v1-test:r02:target'],
    );
    assert.equal(new Set(plan.units.map((unit) => unit.directorVariationKey)).size, plan.units.length);
  });

  it('defaults to the five-critic panel including Sonnet and isolated Codex', () => {
    const args = parseArgs(['--root-dir', '/tmp/phase2-production-v1-test']);
    const plan = buildPlan(args);

    assert.deepEqual(plan.critics, DEFAULT_CRITICS);
    assert.deepEqual(DEFAULT_CRITICS, [
      'qwen/qwen3.7-max',
      'google/gemini-3.5-flash',
      'deepseek/deepseek-v4-pro',
      'anthropic/claude-sonnet-4.6',
      'codex',
    ]);
  });

  it('keeps selected units separate from the full persisted plan', () => {
    const args = parseArgs([
      '--root-dir',
      '/tmp/phase2-production-v1-test',
      '--only',
      'control-r01-d4,control-r01-d10-emphatic',
    ]);
    const plan = buildPlan(args);

    assert.deepEqual(
      plan.units.map((unit) => unit.id),
      ['control-r01-d4', 'control-r01-d10-emphatic'],
    );
    assert.equal(plan.allUnits.filter((unit) => unit.kind === 'target').length, 3);
    assert.equal(plan.allUnits.filter((unit) => unit.kind === 'control').length, 12);
    assert.equal(plan.allUnits.filter((unit) => unit.kind === 'stress').length, 1);
    assert.deepEqual(plan.selectedUnitIds, ['control-r01-d4', 'control-r01-d10-emphatic']);
  });

  it('emits fixed-prefix reframe generation commands for target units', () => {
    const args = parseArgs(['--root-dir', '/tmp/phase2-production-v1-test', '--generation-concurrency', '2']);
    const target = buildPlan(args).units.find((unit) => unit.kind === 'target');
    const cmd = generationCommand(target, args);

    assert.equal(buildPlan(args).generationConcurrency, 2);
    assert.ok(cmd.includes('--paired-continuation-policies'));
    assert.ok(cmd.includes('none,reframe'));
    assert.ok(cmd.includes('--generation-concurrency'));
    assert.ok(cmd.includes('2'));
    assert.ok(cmd.includes('--director-revisit-anchor'));
    assert.ok(cmd.includes('misframing-candidate'));
    assert.ok(cmd.includes('--director-variation-key'));
    assert.ok(cmd.includes('phase2-production-v1:r01:target'));
  });

  it('passes a mixed CLI role map through to generation commands', () => {
    const args = parseArgs([
      '--root-dir',
      '/tmp/phase2-production-v1-test',
      '--role-map',
      'director=claude,tutor=codex,learner=claude',
    ]);
    const plan = buildPlan(args);
    const target = plan.units.find((unit) => unit.kind === 'target');
    const cmd = generationCommand(target, args);

    assert.equal(plan.roleMap, 'director=claude,tutor=codex,learner=claude');
    assert.equal(plan.claudeModel, 'opus');
    assert.ok(cmd.includes('--role-map'));
    assert.ok(cmd.includes('director=claude,tutor=codex,learner=claude'));
    assert.ok(cmd.includes('--model'));
    assert.ok(cmd.includes('opus'));
  });

  it('does not pass a Claude model override for Codex-only generation', () => {
    const args = parseArgs(['--root-dir', '/tmp/phase2-production-v1-test', '--generator', 'codex']);
    const target = buildPlan(args).units.find((unit) => unit.kind === 'target');
    const cmd = generationCommand(target, args);

    assert.equal(planCommandValue(cmd, '--model'), null);
  });

  it('can emit the seven-arm tutor-adaptation target design', () => {
    const args = parseArgs([
      '--root-dir',
      '/tmp/phase2-production-v1-test',
      '--repeats',
      '1',
      '--stress-repeats',
      '0',
      '--adaptation-arms',
      '--critics',
      'qwen/qwen3.7-max,google/gemini-3.5-flash',
    ]);
    const target = buildPlan(args).units.find((unit) => unit.kind === 'target');
    const cmd = generationCommand(target, args);

    assert.deepEqual(target.pairedPolicies, [
      'routine',
      'none',
      'reframe-only',
      'tutor-uptake-only',
      'reframe+tutor-uptake',
      'peripeteia-only',
      'reframe+peripeteia',
    ]);
    assert.equal(target.pairedAdaptationArms, true);
    assert.ok(cmd.includes('--paired-adaptation-arms'));
    assert.ok(
      cmd.includes(
        'routine,none,reframe-only,tutor-uptake-only,reframe+tutor-uptake,peripeteia-only,reframe+peripeteia',
      ),
    );

    const jobs = scoreJobs(target, args);
    assert.equal(jobs.length, 14);
    assert.ok(jobs.some((job) => job.id === 'target-r01-routine'));
    assert.ok(jobs.some((job) => job.id === 'target-r01-reframe+tutor-uptake'));
    assert.ok(jobs.some((job) => job.id === 'target-r01-peripeteia-only'));
    assert.ok(jobs.some((job) => job.id === 'target-r01-reframe+peripeteia'));
  });

  it('can emit a selected tutor-adaptation target arm subset for cheap screens', () => {
    const args = parseArgs([
      '--root-dir',
      '/tmp/phase2-production-v1-test',
      '--repeats',
      '1',
      '--stress-repeats',
      '0',
      '--target-adaptation-arms',
      'routine,none',
      '--critics',
      'qwen/qwen3.7-max,anthropic/claude-sonnet-4.6',
    ]);
    const target = buildPlan(args).units.find((unit) => unit.kind === 'target');
    const cmd = generationCommand(target, args);

    assert.deepEqual(target.pairedPolicies, ['routine', 'none']);
    assert.equal(target.pairedAdaptationArms, true);
    assert.ok(cmd.includes('--paired-adaptation-arms'));
    assert.ok(cmd.includes('routine,none'));

    const jobs = scoreJobs(target, args);
    assert.equal(jobs.length, 4);
    assert.deepEqual([...new Set(jobs.map((job) => job.id))].sort(), ['target-r01-none', 'target-r01-routine']);
  });

  it('can add a pre-scoring structural critic stage', () => {
    const args = parseArgs([
      '--root-dir',
      '/tmp/phase2-production-v1-test',
      '--repeats',
      '1',
      '--stress-repeats',
      '0',
      '--adaptation-arms',
      '--structure-critic',
      'codex',
      '--structure-critic-concurrency',
      '2',
    ]);
    const target = buildPlan(args).units.find((unit) => unit.kind === 'target');
    const jobs = structureCriticJobs(target, args);
    assert.equal(jobs.length, 7);
    assert.equal(jobs[0].critic, 'codex');
    assert.ok(jobs.some((job) => job.id === 'target-r01-reframe+peripeteia'));
    const command = structureCriticCommand(jobs[0], args);
    assert.ok(command.includes('scripts/critic-poetics-structure.js'));
    assert.ok(command.includes('--critic'));
    assert.ok(command.includes('codex'));
    assert.ok(command.includes('--concurrency'));
    assert.ok(command.includes('2'));
  });

  it('can point target units at a breadth scenario spec', () => {
    const breadthSpec = path.resolve('config/poetics-calibration/phase2-dramas-v4.yaml');
    const args = parseArgs([
      '--batch-id',
      'phase2-production-v2-test',
      '--root-dir',
      '/tmp/phase2-production-v2-test',
      '--target-spec',
      breadthSpec,
      '--target-only',
      'D19,D20,D21,D22,D23,D24',
      '--target-tid-start',
      '18',
      '--stress-repeats',
      '0',
    ]);
    const plan = buildPlan(args);
    const target = plan.units.find((unit) => unit.kind === 'target');

    assert.equal(target.spec, breadthSpec);
    assert.equal(target.only, 'D19,D20,D21,D22,D23,D24');
    assert.equal(target.tidStart, 18);
    assert.equal(plan.units.filter((unit) => unit.kind === 'stress').length, 0);
  });

  it('includes hard-trap controls in the production plan', () => {
    const args = parseArgs(['--root-dir', '/tmp/phase2-production-v1-test', '--repeats', '1']);
    const controls = buildPlan(args).units.filter((unit) => unit.kind === 'control');

    assert.deepEqual(
      controls.map((unit) => unit.id),
      ['control-r01-d4', 'control-r01-d10-emphatic', 'control-r01-d25-hard-trap', 'control-r01-d26-hard-trap'],
    );
    assert.ok(
      controls.find((unit) => unit.id === 'control-r01-d25-hard-trap').spec.endsWith('phase2-dramas-hard-traps.yaml'),
    );
    assert.equal(controls.find((unit) => unit.id === 'control-r01-d10-emphatic').control, 'd10-boundary-trap');
  });

  it('scores paired target arms separately for each critic', () => {
    const args = parseArgs([
      '--root-dir',
      '/tmp/phase2-production-v1-test',
      '--score-concurrency',
      '1',
      '--critics',
      'qwen/qwen3.5-plus-02-15,google/gemini-3.5-flash',
    ]);
    const target = buildPlan(args).units.find((unit) => unit.kind === 'target');
    const jobs = scoreJobs(target, args);

    assert.equal(jobs.length, 4);
    assert.deepEqual(jobs.map((job) => job.id).sort(), [
      'target-r01-none',
      'target-r01-none',
      'target-r01-reframe',
      'target-r01-reframe',
    ]);
    const command = scoreCommand(jobs[0], args);
    assert.ok(command.includes('--sample-dir'));
    assert.ok(command.includes('--concurrency'));
    assert.ok(command.includes('1'));
  });

  it('includes extracted prefix-baseline arms in scoring jobs when present', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase2-production-prefix-'));
    const args = parseArgs([
      '--root-dir',
      rootDir,
      '--repeats',
      '1',
      '--stress-repeats',
      '0',
      '--target-adaptation-arms',
      'routine,none',
      '--critics',
      'qwen/qwen3.7-max',
    ]);
    const target = buildPlan(args).units.find((unit) => unit.kind === 'target');
    fs.mkdirSync(path.dirname(target.keyPath), { recursive: true });
    fs.writeFileSync(path.join(path.dirname(target.keyPath), 'key-prefix-baseline.yaml'), 'items: {}\n', 'utf8');
    fs.mkdirSync(path.join(target.outDir, 'prefix-baseline'), { recursive: true });

    const jobs = scoreJobs(target, args);

    assert.deepEqual(jobs.map((job) => job.id).sort(), [
      'target-r01-none',
      'target-r01-prefix-baseline',
      'target-r01-routine',
    ]);
  });

  it('normalizes model names into stable artifact slugs', () => {
    assert.equal(modelSlug('qwen/qwen3.5-plus-02-15'), 'qwen-qwen3-5-plus-02-15');
    assert.equal(modelSlug('google/gemini-3.5-flash'), 'google-gemini-3-5-flash');
    assert.equal(modelSlug('anthropic/claude-sonnet-4.6'), 'anthropic-claude-sonnet-4-6');
  });

  it('can resume scoring without overwriting existing score artifacts', () => {
    assert.equal(parseArgs(['--skip-existing-scores']).skipExistingScores, true);
  });
});

describe('runScoreJobsPooled (critic-parallel score pool)', () => {
  it('runs jobs concurrently, skips existing, and aggregates failures', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-test-'));
    const jobs = [1, 2, 3, 4, 5].map((i) => ({
      id: `j${i}`,
      critic: 'qwen',
      outPath: path.join(tmp, `j${i}.json`),
      _fail: i === 5,
    }));
    fs.writeFileSync(jobs[1].outPath, 'pre'); // j2 pre-exists → should be skipped
    const steps = [];
    const progress = { step: (s) => steps.push(s), note: () => {}, start: () => {}, finish: () => {} };
    const makeCmd = (job) =>
      job._fail
        ? ['node', '-e', 'process.exit(3)']
        : ['node', '-e', 'require("fs").writeFileSync(process.argv[1], "{}")', job.outPath];
    const args = { scoreJobConcurrency: 4, skipExistingScores: true, dryRun: false };

    await assert.rejects(() => runScoreJobsPooled(jobs, args, progress, makeCmd), /1 score job\(s\) failed/);

    assert.equal(fs.readFileSync(jobs[0].outPath, 'utf8'), '{}'); // j1 ran
    assert.equal(fs.readFileSync(jobs[1].outPath, 'utf8'), 'pre'); // j2 skipped (untouched)
    assert.equal(fs.readFileSync(jobs[2].outPath, 'utf8'), '{}'); // j3 ran
    assert.equal(fs.readFileSync(jobs[3].outPath, 'utf8'), '{}'); // j4 ran
    assert.equal(fs.existsSync(jobs[4].outPath), false); // j5 failed → no output
    assert.ok(steps.some((s) => s.includes('skipped')));
    assert.ok(steps.some((s) => s.includes('FAILED')));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('preserves correct behavior at concurrency 1 (sequential)', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-seq-'));
    const jobs = [1, 2, 3].map((i) => ({
      id: `s${i}`,
      critic: 'qwen',
      outPath: path.join(tmp, `s${i}.json`),
    }));
    const progress = { step: () => {}, note: () => {}, start: () => {}, finish: () => {} };
    const makeCmd = (job) => ['node', '-e', 'require("fs").writeFileSync(process.argv[1], "{}")', job.outPath];
    await runScoreJobsPooled(jobs, { scoreJobConcurrency: 1, dryRun: false }, progress, makeCmd);
    assert.ok(jobs.every((j) => fs.existsSync(j.outPath)));
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
