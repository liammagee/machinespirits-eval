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
