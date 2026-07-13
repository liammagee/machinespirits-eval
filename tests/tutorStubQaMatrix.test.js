import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  learnerProfileContractSummary,
  learnerProfilePickerPresentation,
  learnerProfilePrompt,
  learnerProfileSuiteIds,
} from '../scripts/tutor-stub-learner-profile-contracts.js';
import { verifyExperimentRun } from '../services/experimentRunArtifacts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function writeFakeCodex(binDir, { failWhenInputIncludes = null } = {}) {
  const executable = path.join(binDir, 'codex');
  fs.writeFileSync(
    executable,
    `#!/usr/bin/env node
const fs = require('node:fs');
const failMarker = ${JSON.stringify(failWhenInputIncludes)};
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  if (failMarker && input.includes(failMarker)) {
    process.stderr.write('fake codex: induced failure for test marker\\n');
    process.exit(1);
  }
  const response = input.includes('You are an automated learner')
    ? 'I would test the newest public mark before deciding.'
    : input.includes('compact up-front reviewer')
      ? '{}'
      : 'Which public mark would you test next, and what would it show?';
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
    'utf8',
  );
  fs.chmodSync(executable, 0o755);
}

function writeSummary(filePath, { learnerProfile, bland, field }) {
  const byPolicy = {
    bland: {
      rows: 1,
      ok: 1,
      failed: 0,
      dryRun: 0,
      grounded: bland.grounded,
      groundedRate: bland.grounded,
      meanTurns: bland.turns,
      meanCoverage: bland.coverage,
      meanMissing: bland.missing,
      registerCounts: { plain: 2 },
      registerEntropy: 0,
      leakCount: 0,
      errorCount: 0,
      primaryHorizon: 16,
      fixedHorizonRows: 1,
      fixedHorizonObserved: 1,
      fixedHorizonOutcomeMissing: 0,
      fixedHorizonComplete: 1,
      fixedHorizonIncomplete: 0,
      groundedByHorizon: bland.grounded,
      groundedByHorizonRate: bland.grounded,
      meanCoverageAtHorizon: bland.coverage,
      coverageAtHorizonLowerBound: bland.coverage,
      coverageAtHorizonUpperBound: bland.coverage,
      horizonSafetyPassed: bland.safetyIncomplete ? 0 : 1,
      horizonSafetyIncomplete: bland.safetyIncomplete ? 1 : 0,
      horizonSafetyPassRate: bland.safetyIncomplete ? 0 : 1,
      horizonSafetyIncompleteRate: bland.safetyIncomplete ? 1 : 0,
      horizonModelRepairTurns: 0,
      horizonDeterministicFallbackTurns: 0,
    },
    field: {
      rows: 1,
      ok: 1,
      failed: 0,
      dryRun: 0,
      grounded: field.grounded,
      groundedRate: field.grounded,
      meanTurns: field.turns,
      meanCoverage: field.coverage,
      meanMissing: field.missing,
      registerCounts: { precise: 1, warm: 1 },
      registerEntropy: 1,
      leakCount: 0,
      errorCount: 0,
      primaryHorizon: 16,
      fixedHorizonRows: 1,
      fixedHorizonObserved: 1,
      fixedHorizonOutcomeMissing: 0,
      fixedHorizonComplete: 1,
      fixedHorizonIncomplete: 0,
      groundedByHorizon: field.grounded,
      groundedByHorizonRate: field.grounded,
      meanCoverageAtHorizon: field.coverage,
      coverageAtHorizonLowerBound: field.coverage,
      coverageAtHorizonUpperBound: field.coverage,
      horizonSafetyPassed: field.safetyIncomplete ? 0 : 1,
      horizonSafetyIncomplete: field.safetyIncomplete ? 1 : 0,
      horizonSafetyPassRate: field.safetyIncomplete ? 0 : 1,
      horizonSafetyIncompleteRate: field.safetyIncomplete ? 1 : 0,
      horizonModelRepairTurns: 0,
      horizonDeterministicFallbackTurns: 0,
    },
  };
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        schema: 'machinespirits.tutor-stub.auto-eval.v1',
        startedAt: '2026-07-08T00:00:00.000Z',
        completedAt: `2026-07-08T00:0${learnerProfile === 'diligent' ? '1' : '2'}:00.000Z`,
        config: {
          policies: ['bland', 'field'],
          autoLearnerProfileId: learnerProfile,
          world: 'world_005_marrick',
          dryRun: false,
        },
        aggregates: {
          rows: 2,
          completed: 2,
          ok: 2,
          failed: 0,
          dryRun: 0,
          grounded: bland.grounded + field.grounded,
          groundedRate: (bland.grounded + field.grounded) / 2,
          meanTurns: (bland.turns + field.turns) / 2,
          meanCoverage: (bland.coverage + field.coverage) / 2,
          meanMissing: (bland.missing + field.missing) / 2,
          registerCounts: { plain: 2, precise: 1, warm: 1 },
          registerEntropy: 1.5,
          leakCount: 0,
          errorCount: 0,
          primaryHorizon: 16,
          fixedHorizonRows: 2,
          fixedHorizonObserved: 2,
          fixedHorizonOutcomeMissing: 0,
          fixedHorizonComplete: 2,
          fixedHorizonIncomplete: 0,
          groundedByHorizon: bland.grounded + field.grounded,
          groundedByHorizonRate: (bland.grounded + field.grounded) / 2,
          meanCoverageAtHorizon: (bland.coverage + field.coverage) / 2,
          coverageAtHorizonLowerBound: (bland.coverage + field.coverage) / 2,
          coverageAtHorizonUpperBound: (bland.coverage + field.coverage) / 2,
          horizonSafetyPassed: Number(!bland.safetyIncomplete) + Number(!field.safetyIncomplete),
          horizonSafetyIncomplete: Number(Boolean(bland.safetyIncomplete)) + Number(Boolean(field.safetyIncomplete)),
          horizonSafetyPassRate: (Number(!bland.safetyIncomplete) + Number(!field.safetyIncomplete)) / 2,
          horizonSafetyIncompleteRate:
            (Number(Boolean(bland.safetyIncomplete)) + Number(Boolean(field.safetyIncomplete))) / 2,
          horizonModelRepairTurns: 0,
          horizonDeterministicFallbackTurns: 0,
          byPolicy,
        },
      },
      null,
      2,
    )}\n`,
  );
}

test('cross-run analyzer emits policy x learner QA robustness', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-qa-analysis-'));
  try {
    const diligentPath = path.join(tmp, 'auto-eval-diligent.json');
    const skepticalPath = path.join(tmp, 'auto-eval-skeptical.json');
    writeSummary(diligentPath, {
      learnerProfile: 'diligent',
      bland: { grounded: 1, turns: 24, coverage: 0.45, missing: 4 },
      field: { grounded: 1, turns: 12, coverage: 0.9, missing: 1 },
    });
    writeSummary(skepticalPath, {
      learnerProfile: 'skeptical',
      bland: { grounded: 0, turns: 48, coverage: 0.35, missing: 5 },
      field: { grounded: 1, turns: 18, coverage: 0.78, missing: 2 },
    });

    const report = JSON.parse(
      execFileSync(
        process.execPath,
        [
          'scripts/analyze-tutor-stub-auto-evals.js',
          diligentPath,
          skepticalPath,
          '--json',
          '--qa',
          '--baseline-policy',
          'bland',
        ],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    );

    assert.equal(report.qaMatrix.schema, 'machinespirits.tutor-stub.qa-matrix.v1');
    assert.deepEqual(report.qaMatrix.learnerProfiles, ['diligent', 'skeptical']);
    assert.deepEqual(report.qaMatrix.policies, ['bland', 'field']);
    const field = report.qaMatrix.policyRobustness.find((row) => row.policy === 'field');
    assert.equal(field.observedLearners, 2);
    assert.ok(field.meanDeltaVsBaseline > 0);
    assert.ok(field.worstScore > 0);
    assert.equal(field.dispersion.label, 'low_cross_profile_dispersion');
    assert.equal(field.adequacy.passed, true);
    assert.equal(field.nonInferiority.passed, true);
    assert.equal(field.minimumEffect.passed, true);
    assert.equal(field.minimumEffect.endpoint, 'all_planned_row_fixed_horizon_coverage_delta');
    assert.equal(field.robust, true);
    assert.equal(field.qaInterpretation, 'robust');
    const skepticalCell = report.qaMatrix.cells.find(
      (cell) => cell.learnerProfile === 'skeptical' && cell.policy === 'field',
    );
    assert.ok(skepticalCell.deltaVsBaseline > 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('the frozen minimum-effect threshold changes the QA robustness verdict', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-qa-minimum-effect-'));
  try {
    const diligentPath = path.join(tmp, 'auto-eval-diligent.json');
    const skepticalPath = path.join(tmp, 'auto-eval-skeptical.json');
    writeSummary(diligentPath, {
      learnerProfile: 'diligent',
      bland: { grounded: 1, turns: 24, coverage: 0.45, missing: 4 },
      field: { grounded: 1, turns: 12, coverage: 0.9, missing: 1 },
    });
    writeSummary(skepticalPath, {
      learnerProfile: 'skeptical',
      bland: { grounded: 0, turns: 48, coverage: 0.35, missing: 5 },
      field: { grounded: 1, turns: 18, coverage: 0.78, missing: 2 },
    });
    const analyze = (minimumEffect) =>
      JSON.parse(
        execFileSync(
          process.execPath,
          [
            'scripts/analyze-tutor-stub-auto-evals.js',
            diligentPath,
            skepticalPath,
            '--json',
            '--qa',
            '--baseline-policy',
            'bland',
            '--qa-minimum-effect',
            String(minimumEffect),
          ],
          { cwd: ROOT, encoding: 'utf8' },
        ),
      );

    const permissive = analyze(0.4).qaMatrix.policyRobustness.find((row) => row.policy === 'field');
    const strict = analyze(0.45).qaMatrix.policyRobustness.find((row) => row.policy === 'field');
    assert.equal(permissive.minimumEffect.observedMeanDelta, 0.44);
    assert.equal(permissive.minimumEffect.passed, true);
    assert.equal(permissive.robust, true);
    assert.equal(strict.minimumEffect.observedMeanDelta, 0.44);
    assert.equal(strict.minimumEffect.passed, false);
    assert.equal(strict.robust, false);
    assert.equal(strict.qaInterpretation, 'minimum_effect_not_met');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('QA reports incomplete fixed-horizon guard evidence distinctly from a safety pass', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-qa-safety-incomplete-'));
  try {
    const summaryPath = path.join(tmp, 'auto-eval-safety.json');
    writeSummary(summaryPath, {
      learnerProfile: 'diligent',
      bland: { grounded: 1, turns: 20, coverage: 0.5, missing: 3 },
      field: { grounded: 1, turns: 16, coverage: 0.8, missing: 1, safetyIncomplete: true },
    });
    const report = JSON.parse(
      execFileSync(
        process.execPath,
        ['scripts/analyze-tutor-stub-auto-evals.js', summaryPath, '--json', '--qa', '--baseline-policy', 'bland'],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    );
    const field = report.qaMatrix.policyRobustness.find((row) => row.policy === 'field');
    assert.equal(field.worstHorizonSafetyPassRate, 0);
    assert.equal(field.worstHorizonSafetyIncompleteRate, 1);
    assert.equal(field.adequacy.passed, false);
    assert.equal(field.robust, false);
    assert.equal(field.qaInterpretation, 'safety_incomplete');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('low outcome spread is not mislabeled robust when adequacy fails', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-qa-dispersion-only-'));
  try {
    const first = path.join(tmp, 'auto-eval-first.json');
    const second = path.join(tmp, 'auto-eval-second.json');
    for (const [filePath, learnerProfile] of [
      [first, 'diligent'],
      [second, 'skeptical'],
    ]) {
      writeSummary(filePath, {
        learnerProfile,
        bland: { grounded: 0, turns: 60, coverage: 0.3, missing: 5 },
        field: { grounded: 0, turns: 60, coverage: 0.3, missing: 5 },
      });
    }
    const report = JSON.parse(
      execFileSync(
        process.execPath,
        ['scripts/analyze-tutor-stub-auto-evals.js', first, second, '--json', '--qa', '--baseline-policy', 'bland'],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    );
    const field = report.qaMatrix.policyRobustness.find((row) => row.policy === 'field');
    assert.equal(field.dispersion.label, 'low_cross_profile_dispersion');
    assert.equal(field.adequacy.passed, false);
    assert.equal(field.nonInferiority.passed, true);
    assert.equal(field.robust, false);
    assert.equal(field.qaInterpretation, 'low_cross_profile_dispersion');
    assert.doesNotMatch(JSON.stringify(report), /robust across observed learners/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('report-only QA rebuild preserves the original run plan', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-qa-report-only-'));
  try {
    const planPath = path.join(tmp, 'qa-plan.json');
    const originalPlan = `${JSON.stringify(
      {
        schema: 'machinespirits.tutor-stub.qa-matrix-plan.v1',
        generatedAt: '2026-07-10T00:00:00.000Z',
        marker: 'original-frozen-plan',
      },
      null,
      2,
    )}\n`;
    fs.writeFileSync(planPath, originalPlan);
    writeSummary(path.join(tmp, 'auto-eval-existing.json'), {
      learnerProfile: 'diligent',
      bland: { grounded: 1, turns: 24, coverage: 1, missing: 0 },
      field: { grounded: 1, turns: 18, coverage: 1, missing: 0 },
    });

    const output = execFileSync(process.execPath, ['scripts/run-tutor-stub-qa-matrix.js', '--from-dir', tmp], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    assert.match(output, /report-only mode; preserved/);
    assert.equal(fs.readFileSync(planPath, 'utf8'), originalPlan);
    assert.ok(fs.existsSync(path.join(tmp, 'qa-matrix.md')));
    assert.ok(fs.existsSync(path.join(tmp, 'qa-matrix.json')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('report-only QA rebuild applies the minimum effect frozen in qa-plan.json', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-qa-frozen-effect-'));
  try {
    fs.writeFileSync(
      path.join(tmp, 'qa-plan.json'),
      `${JSON.stringify({ schema: 'machinespirits.tutor-stub.qa-matrix-plan.v1', minimumEffect: 0.5 }, null, 2)}\n`,
    );
    writeSummary(path.join(tmp, 'auto-eval-existing.json'), {
      learnerProfile: 'diligent',
      bland: { grounded: 1, turns: 24, coverage: 0.4, missing: 3 },
      field: { grounded: 1, turns: 18, coverage: 0.8, missing: 1 },
    });

    execFileSync(
      process.execPath,
      ['scripts/run-tutor-stub-qa-matrix.js', '--from-dir', tmp, '--minimum-effect', '0.1'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const report = JSON.parse(fs.readFileSync(path.join(tmp, 'qa-matrix.json'), 'utf8'));
    const field = report.qaMatrix.policyRobustness.find((row) => row.policy === 'field');
    assert.equal(report.qaMatrix.thresholds.minimumEffect, 0.5);
    assert.equal(field.minimumEffect.observedMeanDelta, 0.4);
    assert.equal(field.minimumEffect.passed, false);
    assert.equal(field.robust, false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('QA collection fails closed when any trace declares an unknown model-call role', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-qa-unknown-model-role-'));
  try {
    fs.writeFileSync(
      path.join(tmp, 'unknown-model.jsonl'),
      `${JSON.stringify({
        type: 'model_call',
        role: 'future_reward_model',
        provider: 'codex',
        model: 'gpt-5.6-terra',
      })}\n`,
    );
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            'scripts/run-tutor-stub-qa-matrix.js',
            '--trace-dir',
            tmp,
            '--profiles',
            'diligent',
            '--policies',
            'bland',
            '--runs',
            '1',
            '--dry-run',
            '--no-html-report',
            '--no-ledger',
          ],
          { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' },
        ),
      (error) => {
        assert.equal(error.status, 1);
        assert.match(error.stderr, /Unknown tutor-stub model_call role.*future_reward_model/u);
        return true;
      },
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('live QA launch refuses to overwrite an existing frozen plan', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-qa-frozen-plan-'));
  try {
    const planPath = path.join(tmp, 'qa-plan.json');
    const originalPlan = `${JSON.stringify(
      {
        schema: 'machinespirits.tutor-stub.qa-matrix-plan.v1',
        generatedAt: '2026-07-10T00:00:00.000Z',
        marker: 'original-frozen-plan',
      },
      null,
      2,
    )}\n`;
    fs.writeFileSync(planPath, originalPlan);

    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            'scripts/run-tutor-stub-qa-matrix.js',
            '--trace-dir',
            tmp,
            '--profiles',
            'diligent',
            '--policies',
            'bland',
            '--runs',
            '1',
            '--dry-run',
            '--no-analyze',
          ],
          { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' },
        ),
      (error) => {
        assert.equal(error.status, 1);
        assert.match(error.stderr, /Refusing to overwrite frozen QA plan/);
        assert.match(error.stderr, /new --trace-dir/);
        return true;
      },
    );
    assert.equal(fs.readFileSync(planPath, 'utf8'), originalPlan);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('QA dry-run writes a sealed full-grid plan with deterministic dialogue job order', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-qa-transaction-'));
  try {
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-qa-matrix.js',
        '--trace-dir',
        tmp,
        '--profiles',
        'diligent',
        '--policies',
        'bland,field',
        '--runs',
        '2',
        '--run-seed',
        '1901',
        '--dry-run',
        '--no-html-report',
        '--no-ledger',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );

    const plan = JSON.parse(fs.readFileSync(path.join(tmp, 'run-plan.json'), 'utf8'));
    assert.equal(plan.schema, 'machinespirits.experiment-run-plan.v1');
    assert.equal(plan.randomization.masterSeed, 1901);
    assert.deepEqual(plan.metadata.randomDrawContract.requiredJobIds, []);
    assert.deepEqual(plan.randomization.jobOrder, [
      'diligent-bland-r1',
      'diligent-bland-r2',
      'diligent-field-r1',
      'diligent-field-r2',
    ]);
    assert.equal(plan.requiredObservedModelRoles.length, 0);
    assert.ok(fs.existsSync(path.join(tmp, 'qa-plan.json')));
    assert.ok(fs.existsSync(path.join(tmp, 'run-events.jsonl')));
    assert.ok(fs.existsSync(path.join(tmp, 'run-seal.json')));

    const verification = verifyExperimentRun(tmp);
    assert.equal(verification.ok, true, verification.errors.join('\n'));
    assert.ok(verification.inventory.some((entry) => entry.path === 'qa-matrix.json'));
    assert.ok(verification.inventory.some((entry) => entry.path === 'qa-plan.json'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('live-like QA matrix seals matching tutor, analyzer, and learner observations in parent and child runs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-qa-live-provenance-'));
  const qaDir = path.join(root, 'qa');
  const binDir = path.join(root, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  writeFakeCodex(binDir);
  try {
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-qa-matrix.js',
        '--trace-dir',
        qaDir,
        '--profiles',
        'diligent',
        '--policies',
        'bland,field',
        '--runs',
        '1',
        '--turns',
        '1',
        '--model',
        'codex.gpt-5.6-terra',
        '--analysis-model',
        'codex.gpt-5.6-terra',
        '--auto-learner-model',
        'codex.gpt-5.6-terra',
        '--parallelism',
        '1',
        '--no-html-report',
        '--no-ledger',
        '--no-memory-summary',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 8 * 1024 * 1024,
        env: {
          ...process.env,
          PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
          CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
        },
      },
    );

    const parent = verifyExperimentRun(qaDir);
    assert.equal(parent.ok, true, parent.errors.join('\n'));
    const childDir = path.join(qaDir, 'diligent');
    const child = verifyExperimentRun(childDir);
    assert.equal(child.ok, true, child.errors.join('\n'));
    assert.deepEqual(parent.plan.metadata.randomDrawContract.requiredJobIds, ['diligent-field-r1']);
    assert.deepEqual(child.plan.metadata.randomDrawContract.requiredJobIds, ['field-r1']);
    assert.ok(parent.replay.decisions.length >= 1);
    assert.ok(child.replay.decisions.length >= 1);
    assert.ok(parent.inventory.some((entry) => entry.path === 'diligent/run-seal.json'));
    assert.equal(child.plan.lineage.parentRunId, parent.plan.runId);
    for (const verification of [parent, child]) {
      assert.deepEqual(verification.plan.requiredObservedModelRoles, ['analyzer', 'learner', 'tutor']);
      const observations = fs
        .readFileSync(path.join(verification === parent ? qaDir : childDir, 'run-events.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
        .filter((event) => event.type === 'model_observed');
      assert.deepEqual(observations.map((event) => event.role).sort(), ['analyzer', 'learner', 'tutor']);
      assert.ok(verification.replay.decisions.every((decision) => decision.matches));
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a failed child under --keep-going still seals the matrix root with forwarded evidence', () => {
  // Regression for the 2026-07-13 register-confirmatory failure: children
  // whose jobs die (dead CLI sessions) seal without their contracted draws;
  // root finalization previously asserted every sealed child and crashed
  // before forwarding any draws or model observations, leaving the root
  // unsealed after all paid work had completed.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-qa-failed-child-'));
  const qaDir = path.join(root, 'qa');
  const binDir = path.join(root, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  writeFakeCodex(binDir, { failWhenInputIncludes: 'automated learner profile: proof_skipper' });
  const env = {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
    CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
  };
  try {
    const matrixError = (() => {
      try {
        execFileSync(
          process.execPath,
          [
            'scripts/run-tutor-stub-qa-matrix.js',
            '--trace-dir',
            qaDir,
            '--profiles',
            'diligent,proof_skipper',
            '--policies',
            'field',
            '--runs',
            '1',
            '--turns',
            '1',
            '--model',
            'codex.gpt-5.6-terra',
            '--analysis-model',
            'codex.gpt-5.6-terra',
            '--auto-learner-model',
            'codex.gpt-5.6-terra',
            '--parallelism',
            '1',
            '--keep-going',
            '--no-html-report',
            '--no-ledger',
            '--no-memory-summary',
          ],
          { cwd: ROOT, encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024, stdio: 'pipe', env },
        );
        return null;
      } catch (error) {
        return error;
      }
    })();
    assert.ok(matrixError, 'matrix with a failed child must exit non-zero');
    assert.equal(matrixError.status, 1);
    assert.match(matrixError.stderr, /profile job\(s\) failed \(proof_skipper\)/u);
    assert.match(matrixError.stderr, /sealed incomplete run reports \d+ unmet contract item\(s\)/u);
    assert.match(matrixError.stderr, /status incomplete; integrity verified/u);

    const rootSeal = JSON.parse(fs.readFileSync(path.join(qaDir, 'run-seal.json'), 'utf8'));
    assert.equal(rootSeal.status, 'incomplete');
    const rootEvents = fs
      .readFileSync(path.join(qaDir, 'run-events.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    // The healthy child's draws land in the root ledger re-keyed with the
    // profile prefix the root contract expects.
    const forwardedDraws = rootEvents.filter((event) => event.type === 'random_draw');
    assert.ok(forwardedDraws.length >= 1);
    assert.ok(forwardedDraws.every((event) => event.jobId === 'diligent-field-r1'));
    assert.ok(forwardedDraws.every((event) => event.sourceJobId === 'field-r1'));

    // Observed-model provenance reaches the root with non-null models.
    const observations = rootEvents.filter((event) => event.type === 'model_observed');
    assert.deepEqual(observations.map((event) => event.role).sort(), ['analyzer', 'learner', 'tutor']);
    assert.ok(observations.every((event) => typeof event.observed === 'string' && event.observed.length > 0));

    const completed = rootEvents.find((event) => event.type === 'run_completed');
    assert.equal(completed?.status, 'incomplete');
    assert.deepEqual(completed?.profileStatuses, [
      { profile: 'diligent', status: 0 },
      { profile: 'proof_skipper', status: 1 },
    ]);

    // Full verification reports the failed profile's unmet contract; the
    // sealed partial evidence itself is integrity-clean.
    const full = verifyExperimentRun(qaDir);
    assert.equal(full.ok, false);
    assert.match(full.errors.join('\n'), /random draw contract missing decisions for proof_skipper-field-r1/u);
    const integrityOnly = verifyExperimentRun(qaDir, { completeness: false });
    assert.equal(integrityOnly.ok, true, integrityOnly.errors.join('\n'));

    // The healthy child fully verifies; the failed child seals truthfully.
    const healthy = verifyExperimentRun(path.join(qaDir, 'diligent'));
    assert.equal(healthy.ok, true, healthy.errors.join('\n'));
    const failedSeal = JSON.parse(fs.readFileSync(path.join(qaDir, 'proof_skipper', 'run-seal.json'), 'utf8'));
    assert.equal(failedSeal.status, 'incomplete');
    const failedChild = verifyExperimentRun(path.join(qaDir, 'proof_skipper'));
    assert.equal(failedChild.ok, false);
    const failedChildIntegrity = verifyExperimentRun(path.join(qaDir, 'proof_skipper'), { completeness: false });
    assert.equal(failedChildIntegrity.ok, true, failedChildIntegrity.errors.join('\n'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('report regeneration from a sealed QA run byte-preserves every source artifact', () => {
  const container = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-qa-read-only-'));
  const sourceDir = path.join(container, 'sealed-source');
  try {
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-qa-matrix.js',
        '--trace-dir',
        sourceDir,
        '--profiles',
        'diligent',
        '--policies',
        'bland',
        '--runs',
        '1',
        '--run-seed',
        '1902',
        '--dry-run',
        '--no-html-report',
        '--no-ledger',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const before = verifyExperimentRun(sourceDir);
    assert.equal(before.ok, true, before.errors.join('\n'));
    const bytesByPath = new Map(
      before.inventory.map((entry) => [entry.path, fs.readFileSync(path.join(sourceDir, entry.path))]),
    );

    const output = execFileSync(
      process.execPath,
      ['scripts/run-tutor-stub-qa-matrix.js', '--from-dir', sourceDir, '--dry-run'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    assert.match(output, /sealed source verified; derived reports will be written/u);

    const after = verifyExperimentRun(sourceDir);
    assert.equal(after.ok, true, after.errors.join('\n'));
    for (const [relative, bytes] of bytesByPath) {
      assert.deepEqual(fs.readFileSync(path.join(sourceDir, relative)), bytes, `${relative} changed`);
    }
    const derived = fs
      .readdirSync(container, { withFileTypes: true })
      .find((entry) => entry.isDirectory() && entry.name.startsWith('sealed-source-derived-'));
    assert.ok(derived, 'report regeneration should use a sibling derived directory');
    assert.ok(fs.existsSync(path.join(container, derived.name, 'qa-matrix.md')));
    assert.ok(fs.existsSync(path.join(container, derived.name, 'qa-matrix.json')));
  } finally {
    fs.rmSync(container, { recursive: true, force: true });
  }
});

test('register diversity alone cannot manufacture an adaptive-vs-bland outcome delta', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-qa-diversity-'));
  try {
    const tiedPath = path.join(tmp, 'auto-eval-tied.json');
    // Outcome channels identical across policies; only register diversity
    // differs (bland entropy 0, field entropy 1 via the fixture defaults).
    writeSummary(tiedPath, {
      learnerProfile: 'diligent',
      bland: { grounded: 1, turns: 24, coverage: 1, missing: 0 },
      field: { grounded: 1, turns: 24, coverage: 1, missing: 0 },
    });

    const report = JSON.parse(
      execFileSync(
        process.execPath,
        ['scripts/analyze-tutor-stub-auto-evals.js', tiedPath, '--json', '--qa', '--baseline-policy', 'bland'],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    );

    const fieldCell = report.qaMatrix.cells.find((cell) => cell.policy === 'field');
    const blandCell = report.qaMatrix.cells.find((cell) => cell.policy === 'bland');
    // The outcome-only headline delta must be flat at outcome ceiling...
    assert.equal(fieldCell.deltaVsBaseline, 0);
    assert.equal(fieldCell.outcomeScore, blandCell.outcomeScore);
    // ...while the legacy process score still shows the diversity gap under
    // its explicit name, so the confound stays visible but never headline.
    // (fixture entropy 1 over the full palette ≈ 0.29 diversity × 0.14 weight)
    assert.ok(fieldCell.processScoreDeltaVsBaseline > 0.03);
    const fieldRow = report.qaMatrix.policyRobustness.find((row) => row.policy === 'field');
    const blandRow = report.qaMatrix.policyRobustness.find((row) => row.policy === 'bland');
    assert.equal(fieldRow.meanScore, blandRow.meanScore);
    assert.equal(fieldRow.meanDeltaVsBaseline, 0);
    assert.ok(fieldRow.meanRegisterDiversity > blandRow.meanRegisterDiversity);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('headroom suite defaults to discriminable profiles under a binding cap', () => {
  const plan = JSON.parse(
    execFileSync(
      process.execPath,
      ['scripts/run-tutor-stub-qa-matrix.js', '--print-plan', '--json', '--suite', 'headroom'],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );
  assert.equal(plan.policySuite, 'headroom');
  assert.equal(plan.profileSuite, 'sentinel');
  assert.equal(plan.safetyTurns, 40);
  assert.equal(plan.turns, 'until-grounded');
  // Outcome contrast needs same-run controls on both floors.
  assert.ok(plan.policies.includes('bland'));
  assert.ok(plan.policies.includes('negative'));
  assert.ok(plan.profiles.includes('affective_resistant'));
  // Explicit overrides must still win over the headroom defaults.
  const overridden = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-qa-matrix.js',
        '--print-plan',
        '--json',
        '--suite',
        'headroom',
        '--safety-turns',
        '120',
        '--profile-suite',
        'core',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );
  assert.equal(overridden.safetyTurns, 120);
  assert.equal(overridden.profileSuite, 'core');
  // ...and the plan must warn that both overrides remove the headroom.
  assert.ok(overridden.warnings.some((warning) => warning.includes('near-clone')));
  assert.ok(overridden.warnings.some((warning) => warning.includes('binding turn cap')));
  // Equals-form flags must count as explicit overrides too.
  const equalsForm = JSON.parse(
    execFileSync(
      process.execPath,
      ['scripts/run-tutor-stub-qa-matrix.js', '--print-plan', '--json', '--suite', 'headroom', '--safety-turns=100'],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );
  assert.equal(equalsForm.safetyTurns, 100);
});

test('qa matrix threads interleave, pressure-probe, and clue-pace flags to auto-eval children', () => {
  const plan = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-qa-matrix.js',
        '--print-plan',
        '--json',
        '--suite',
        'headroom',
        '--interleave-policies',
        '--pressure-turns',
        '6',
        '--release-speed',
        '1.5',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );
  assert.equal(plan.interleavePolicies, true);
  assert.equal(plan.pressureTurns, '6');
  assert.equal(plan.releaseSpeed, 1.5);
  for (const job of plan.jobs) {
    const command = job.command.join(' ');
    assert.ok(command.includes('--interleave-policies'));
    assert.ok(command.includes('--pressure-turns 6'));
    assert.ok(command.includes('--release-speed 1.5'));
  }
});

test('auto-eval forwards its declared default models to every child dialogue', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-model-forwarding-'));
  try {
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-auto-eval.js',
        '--dry-run',
        '--runs',
        '1',
        '--policies',
        'dynamic',
        '--turns',
        '1',
        '--trace-dir',
        tmp,
        '--no-progress',
        '--no-html-report',
        '--no-ledger',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );

    const summaryName = fs.readdirSync(tmp).find((name) => /^auto-eval-.*\.json$/u.test(name));
    assert.ok(summaryName, 'dry run should write a structured summary');
    const summary = JSON.parse(fs.readFileSync(path.join(tmp, summaryName), 'utf8'));
    const command = summary.results[0].command;
    const commandValue = (flag) => command[command.indexOf(flag) + 1];

    assert.equal(commandValue('--model'), 'codex.gpt-5.5');
    assert.equal(commandValue('--classifier-model'), 'codex.gpt-5.5');
    assert.equal(commandValue('--learner-record-model'), 'codex.gpt-5.5');
    assert.equal(commandValue('--auto-learner-model'), 'codex.gpt-5.5');
    assert.equal(commandValue('--run-seed'), '1');
    assert.equal(commandValue('--eval-repeat'), '1');
    assert.equal(commandValue('--eval-job-id'), 'dynamic-r1');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('tutor-stub dry-run exposes the full deterministic policy identity', () => {
  const preview = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--dry-run',
        '--run-seed',
        '77',
        '--eval-repeat',
        '3',
        '--eval-job-id',
        'false-memory-field-r3',
        '--auto-learner-profile',
        'false_memory',
        '--register-policy',
        'field',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );
  assert.deepEqual(preview.experiment, {
    schema: 'machinespirits.tutor-stub.experiment-identity.v1',
    runSeed: 77,
    profile: 'false_memory',
    policy: 'field',
    repeat: 3,
    jobId: 'false-memory-field-r3',
    dagFactDropoutSeed: 1,
    independentSeeds: true,
  });
});

test('qa matrix runner prints a reproducible focused-suite plan', () => {
  const plan = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-qa-matrix.js',
        '--print-plan',
        '--json',
        '--suite',
        'focused',
        '--profiles',
        'diligent,skeptical',
        '--runs',
        '1',
        '--trace-dir',
        '.tutor-stub-auto-eval/test-qa-plan',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );

  assert.equal(plan.schema, 'machinespirits.tutor-stub.qa-matrix-plan.v1');
  assert.equal(plan.suite, 'core');
  assert.equal(plan.policySuite, 'core');
  assert.deepEqual(plan.policySuiteAliases, ['focused']);
  assert.deepEqual(plan.profiles, ['diligent', 'skeptical']);
  assert.deepEqual(plan.policies, [
    'bland',
    'dynamic',
    'state',
    'field',
    'trajectory',
    'dynamical_system',
    'empirical_dynamical_system',
  ]);
  assert.equal(plan.expectedDialogueRows, 14);
  assert.equal(plan.jobs.length, 2);
  assert.ok(plan.jobs[0].command.includes('--auto-learner-profile-id'));
  assert.ok(plan.jobs[0].command.includes('diligent'));
});

test('qa matrix runner expands sentinel learner profile suite', () => {
  const plan = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-qa-matrix.js',
        '--print-plan',
        '--json',
        '--suite',
        'controls',
        '--profile-suite',
        'sentinel',
        '--runs',
        '1',
        '--trace-dir',
        '.tutor-stub-auto-eval/test-qa-plan-sentinel',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );

  assert.equal(plan.profileSuite, 'sentinel');
  assert.deepEqual(plan.profiles, ['diligent', 'proof_skipper', 'false_memory', 'affective_resistant']);
  assert.deepEqual(plan.policies, ['negative', 'bland', 'random']);
  assert.equal(plan.expectedDialogueRows, 12);
  assert.ok(plan.jobs.some((job) => job.command.includes('proof_skipper')));
});

test('qa matrix runner treats all-profile runs as explicit audits', () => {
  const plan = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-qa-matrix.js',
        '--print-plan',
        '--json',
        '--suite',
        'full',
        '--profile-suite',
        'all',
        '--runs',
        '1',
        '--trace-dir',
        '.tutor-stub-auto-eval/test-qa-plan-audit',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );

  assert.equal(plan.profileSuite, 'audit');
  assert.deepEqual(plan.profileSuiteAliases, ['all']);
  assert.equal(plan.profileSuiteCost, 'expensive');
  assert.equal(plan.policySuite, 'audit');
  assert.deepEqual(plan.policySuiteAliases, ['full', 'all']);
  assert.equal(plan.policySuiteCost, 'expensive');
  assert.equal(plan.profiles.length, 14);
  assert.equal(plan.policies.length, 11);
  assert.equal(plan.expectedDialogueRows, 154);
  assert.ok(plan.warnings.some((warning) => warning.includes('every register policy')));
  assert.ok(plan.warnings.some((warning) => warning.includes('expensive periodic audit')));
  assert.ok(plan.warnings.some((warning) => warning.includes('154 dialogue rows')));
});

test('qa matrix runner expands pressure policy suite for sentinel checks', () => {
  const plan = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-qa-matrix.js',
        '--print-plan',
        '--json',
        '--suite',
        'pressure',
        '--profile-suite',
        'sentinel',
        '--runs',
        '1',
        '--trace-dir',
        '.tutor-stub-auto-eval/test-qa-plan-pressure',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );

  assert.equal(plan.policySuite, 'pressure');
  assert.deepEqual(plan.policies, ['field', 'negative']);
  assert.equal(plan.profileSuite, 'sentinel');
  assert.equal(plan.expectedDialogueRows, 8);
  assert.equal(plan.warnings.length, 0);
});

test('qa matrix runner expands the representative sentinel policy ladder', () => {
  const plan = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-qa-matrix.js',
        '--print-plan',
        '--json',
        '--suite',
        'sentinel',
        '--profile-suite',
        'sentinel',
        '--runs',
        '3',
        '--trace-dir',
        '.tutor-stub-auto-eval/test-qa-plan-representative-sentinel',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );

  assert.equal(plan.policySuite, 'sentinel');
  assert.deepEqual(plan.policies, ['bland', 'field', 'trajectory', 'dynamical_system', 'negative']);
  assert.equal(plan.profileSuite, 'sentinel');
  assert.equal(plan.expectedDialogueRows, 60);
  assert.equal(plan.warnings.length, 0);
});

test('auto-eval lists stress learner profiles', () => {
  const output = execFileSync(process.execPath, ['scripts/run-tutor-stub-auto-eval.js', '--list-learner-profiles'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  assert.match(output, /Profile suites:/);
  assert.match(output, /audit \(alias: all\): Full profile audit/);
  assert.match(output, /proof_skipper:/);
  assert.match(output, /false_memory:/);
  assert.match(output, /affective_resistant:/);
  assert.match(output, /fast_learner:/);
  assert.match(output, /slow_learner:/);
  assert.match(output, /Stress - Proof skipper/);
  assert.doesNotMatch(output, /classifier labels/);
});

test('stress profile contracts preserve observable discrimination cues', () => {
  const proofSkipperPrompt = learnerProfilePrompt('proof_skipper');
  assert.match(proofSkipperPrompt, /at least five of the first eight learner turns/iu);
  assert.match(proofSkipperPrompt, /attribution, source, actor, or trial-book judgment/iu);
  const proofSkipperSummary = learnerProfileContractSummary('proof_skipper');
  assert.equal(proofSkipperSummary.stableFailure.mustRecurMinRate, 0.6);
  assert.deepEqual(proofSkipperSummary.traceSignatureTargets.evidenceUse.omits_warrant, [0.5, 0.8]);
  assert.deepEqual(proofSkipperSummary.observabilityContract.markerClauses, [
    [{ field: 'evidenceUse', values: ['omits_warrant'] }],
    [{ field: 'evidenceUse', values: ['overleaps_evidence'] }],
  ]);

  const falseMemoryPrompt = learnerProfilePrompt('false_memory');
  assert.match(falseMemoryPrompt, /wrong or distorted public detail/u);
  assert.match(falseMemoryPrompt, /already saw, read, heard, or recorded/iu);
  assert.match(falseMemoryPrompt, /do not merely draw a bad inference from a true clue/iu);
  assert.match(falseMemoryPrompt, /treating weight as alloy or crucible proof/u);
  assert.match(falseMemoryPrompt, /Do not repair the false detail in the same learner turn/u);

  const falseMemorySummary = learnerProfileContractSummary('false_memory');
  assert.equal(falseMemorySummary.stableFailure.mustShowByTurn, 2);
  assert.ok(falseMemorySummary.traceSignatureTargets.evidenceUse.distorts_public_evidence);
  assert.ok(falseMemorySummary.traceSignatureTargets.evidenceUse.overleaps_evidence);
  assert.deepEqual(falseMemorySummary.observabilityContract.markerClauses, [
    [{ field: 'evidenceUse', values: ['distorts_public_evidence'] }],
    [
      { field: 'evidenceUse', values: ['overleaps_evidence'] },
      { field: 'explicitRecollection', values: [true] },
    ],
  ]);
  assert.deepEqual(falseMemorySummary.traceSignatureTargets.evidenceUse.links_evidence_to_rule, [0, 0.18]);

  const affectivePrompt = learnerProfilePrompt('affective_resistant');
  assert.match(affectivePrompt, /negative, ironic, sarcastic, face_threat/u);
  assert.match(affectivePrompt, /At least three times, push back/u);
  assert.match(affectivePrompt, /pressure-only turns/u);
  assert.match(affectivePrompt, /That feels like a jump/u);

  const affectiveSummary = learnerProfileContractSummary('affective_resistant');
  assert.equal(affectiveSummary.stableFailure.mustRecurMinRate, 0.5);
  assert.ok(affectiveSummary.traceSignatureTargets.requestType.authority_refusal_or_status_challenge);
  assert.deepEqual(affectiveSummary.traceSignatureTargets.evidenceUse.links_evidence_to_rule, [0.15, 0.45]);
  assert.deepEqual(affectiveSummary.traceSignatureTargets.epistemicStance.grounded, [0.2, 0.5]);

  const fastPrompt = learnerProfilePrompt('fast_learner');
  assert.match(fastPrompt, /give me the next clue|move it along/iu);
  const fastSummary = learnerProfileContractSummary('fast_learner');
  assert.deepEqual(fastSummary.dagSignatureTargets.expectedBottlenecks, ['release_or_pacing_gap']);
  assert.equal(fastSummary.dagSignatureTargets.unsupportedAssertionRate, 'low');

  const slowPrompt = learnerProfilePrompt('slow_learner');
  assert.match(slowPrompt, /one clue at a time|slow down/iu);
  const slowSummary = learnerProfileContractSummary('slow_learner');
  assert.equal(slowSummary.dagSignatureTargets.coverageVelocity, 'slow_safe');
  assert.equal(slowSummary.dagSignatureTargets.unsupportedAssertionRate, 'low');
});

test('every stress profile explains its boundary against the declared nearest core profile', () => {
  const coreIds = new Set(learnerProfileSuiteIds('core'));
  for (const profileId of learnerProfileSuiteIds('stress')) {
    const presentation = learnerProfilePickerPresentation(profileId);
    assert.equal(presentation.group, 'stress probe');
    assert.ok(presentation.description.length > 20, profileId);
    assert.ok(coreIds.has(presentation.nearestNeighbor), `${profileId} nearest neighbor must be a core profile`);
    assert.ok(presentation.contrast?.length > 20, `${profileId} must explain its edge from core`);
  }
});

test('auto-eval dry run records selected learner profile contract', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-contract-dry-run-'));
  try {
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-auto-eval.js',
        '--runs',
        '1',
        '--policies',
        'field',
        '--turns',
        '8',
        '--auto-learner-profile-id',
        'proof_skipper',
        '--trace-dir',
        tmp,
        '--dry-run',
        '--no-html-report',
        '--no-ledger',
        '--no-progress',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const summaryPath = fs
      .readdirSync(tmp)
      .filter((name) => /^auto-eval-.*\.json$/u.test(name))
      .map((name) => path.join(tmp, name))
      .at(0);
    assert.ok(summaryPath);
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    assert.equal(summary.config.autoLearnerProfileId, 'proof_skipper');
    assert.equal(
      summary.config.autoLearnerProfileContract.schema,
      'machinespirits.tutor-stub.learner-profile-contract.v3',
    );
    assert.equal(summary.config.autoLearnerProfileContract.id, 'proof_skipper');
    const profileArg = summary.results[0].command[summary.results[0].command.indexOf('--auto-learner-profile') + 1];
    assert.match(profileArg, /Behavioral signature to approximate/);
    assert.match(profileArg, /Do not mention profile names/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('qa matrix adaptive suite includes continuous register policies', () => {
  const plan = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-qa-matrix.js',
        '--print-plan',
        '--json',
        '--suite',
        'adaptive',
        '--profiles',
        'diligent',
        '--runs',
        '1',
        '--trace-dir',
        '.tutor-stub-auto-eval/test-qa-plan-adaptive',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );

  assert.deepEqual(plan.policies, [
    'dynamic',
    'state',
    'field',
    'trajectory',
    'dynamical_system',
    'empirical_dynamical_system',
    'continuous_dynamical_system',
    'continuous_empirical_dynamical_system',
  ]);
  assert.equal(plan.expectedDialogueRows, 8);
});
