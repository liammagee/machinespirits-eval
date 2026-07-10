import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  learnerProfileContractSummary,
  learnerProfilePrompt,
} from '../scripts/tutor-stub-learner-profile-contracts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
    const skepticalCell = report.qaMatrix.cells.find(
      (cell) => cell.learnerProfile === 'skeptical' && cell.policy === 'field',
    );
    assert.ok(skepticalCell.deltaVsBaseline > 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
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
  assert.equal(plan.profiles.length, 12);
  assert.equal(plan.policies.length, 11);
  assert.equal(plan.expectedDialogueRows, 132);
  assert.ok(plan.warnings.some((warning) => warning.includes('every register policy')));
  assert.ok(plan.warnings.some((warning) => warning.includes('expensive periodic audit')));
  assert.ok(plan.warnings.some((warning) => warning.includes('132 dialogue rows')));
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
  assert.match(output, /Stress - Proof skipper/);
  assert.doesNotMatch(output, /classifier labels/);
});

test('stress profile contracts preserve observable discrimination cues', () => {
  const proofSkipperPrompt = learnerProfilePrompt('proof_skipper');
  assert.match(proofSkipperPrompt, /at least four of the first eight learner turns/iu);
  const proofSkipperSummary = learnerProfileContractSummary('proof_skipper');
  assert.deepEqual(proofSkipperSummary.traceSignatureTargets.evidenceUse.omits_warrant, [0.35, 0.65]);

  const falseMemoryPrompt = learnerProfilePrompt('false_memory');
  assert.match(falseMemoryPrompt, /wrong or distorted public detail/u);
  assert.match(falseMemoryPrompt, /treating weight as alloy or crucible proof/u);
  assert.match(falseMemoryPrompt, /Do not repair the false detail in the same learner turn/u);

  const falseMemorySummary = learnerProfileContractSummary('false_memory');
  assert.equal(falseMemorySummary.stableFailure.mustShowByTurn, 2);
  assert.ok(falseMemorySummary.traceSignatureTargets.evidenceUse.distorts_public_evidence);
  assert.ok(falseMemorySummary.traceSignatureTargets.evidenceUse.overleaps_evidence);
  assert.deepEqual(falseMemorySummary.observabilityContract.markerClauses, [
    [{ field: 'evidenceUse', values: ['distorts_public_evidence'] }],
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
      'machinespirits.tutor-stub.learner-profile-contract.v2',
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
