import { strict as assert } from 'node:assert';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  buildPlan,
  generationCommand,
  modelSlug,
  parseArgs,
  scoreCommand,
  scoreJobs,
} from '../scripts/run-poetics-production-batch.js';

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
    assert.equal(plan.units.filter((unit) => unit.kind === 'control').length, 4);
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
    assert.equal(plan.allUnits.filter((unit) => unit.kind === 'control').length, 6);
    assert.equal(plan.allUnits.filter((unit) => unit.kind === 'stress').length, 1);
    assert.deepEqual(plan.selectedUnitIds, ['control-r01-d4', 'control-r01-d10-emphatic']);
  });

  it('emits fixed-prefix reframe generation commands for target units', () => {
    const args = parseArgs(['--root-dir', '/tmp/phase2-production-v1-test']);
    const target = buildPlan(args).units.find((unit) => unit.kind === 'target');
    const cmd = generationCommand(target, args);

    assert.ok(cmd.includes('--paired-continuation-policies'));
    assert.ok(cmd.includes('none,reframe'));
    assert.ok(cmd.includes('--director-revisit-anchor'));
    assert.ok(cmd.includes('misframing-candidate'));
    assert.ok(cmd.includes('--director-variation-key'));
    assert.ok(cmd.includes('phase2-production-v1:r01:target'));
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

  it('scores paired target arms separately for each critic', () => {
    const args = parseArgs([
      '--root-dir',
      '/tmp/phase2-production-v1-test',
      '--critics',
      'qwen/qwen3.5-plus-02-15,google/gemini-3.5-flash',
    ]);
    const target = buildPlan(args).units.find((unit) => unit.kind === 'target');
    const jobs = scoreJobs(target, args);

    assert.equal(jobs.length, 4);
    assert.deepEqual(
      jobs.map((job) => job.id).sort(),
      ['target-r01-none', 'target-r01-none', 'target-r01-reframe', 'target-r01-reframe'],
    );
    assert.ok(scoreCommand(jobs[0], args).includes('--sample-dir'));
  });

  it('normalizes model names into stable artifact slugs', () => {
    assert.equal(modelSlug('qwen/qwen3.5-plus-02-15'), 'qwen-qwen3-5-plus-02-15');
    assert.equal(modelSlug('google/gemini-3.5-flash'), 'google-gemini-3-5-flash');
  });
});
