import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function writeEvalSummary(dir, learnerProfile, completedAt) {
  fs.mkdirSync(dir, { recursive: true });
  const stem = `auto-eval-${completedAt.replaceAll(':', '-').replaceAll('.', '-')}`;
  const jsonPath = path.join(dir, `${stem}.json`);
  const htmlPath = path.join(dir, `${stem}.html`);
  const rows = ['bland', 'field'].map((policy, index) => ({
    policy,
    runIndex: 1,
    status: 'ok',
    groundedClosure: index === 1,
    turnCount: 8 + index,
    bestPathCoverage: index === 1 ? 1 : 0.5,
    missingPremiseCount: index === 1 ? 0 : 3,
    leakCount: 0,
    registerCounts: policy === 'bland' ? { plain: 8 } : { precise: 5, warm: 4 },
    efficacyCounts: { positive_progress: 3, no_clear_progress: 5 },
    field: {
      final: { learnerMastery: index === 1 ? 0.9 : 0.6, learnerRisk: index === 1 ? 0.1 : 0.3 },
      delta: { learnerMastery: 0.3, learnerRisk: -0.2 },
    },
    trainingExamples: {
      schema: 'machinespirits.tutor-stub.turn-training-examples.v1',
      examples: Array.from({ length: 6 }, (_, turnIndex) => ({
        turn: turnIndex + 1,
        action: {
          selectedRegister: policy === 'bland' ? 'plain' : turnIndex % 2 ? 'warm' : 'precise',
        },
        stateBeforeAction: {
          learnerState: {
            requestType: turnIndex % 2 ? 'reassurance' : 'proof_request',
            evidenceUse: turnIndex % 2 ? 'partial' : 'active',
          },
          dag: { bottleneck: turnIndex < 4 ? 'missing_premise' : 'learner_integration_gap' },
        },
        rewardProxy: { score: policy === 'field' ? 0.08 : 0 },
      })),
    },
  }));
  const byPolicy = Object.fromEntries(
    rows.map((row) => [
      row.policy,
      {
        rows: 1,
        ok: 1,
        failed: 0,
        dryRun: 0,
        grounded: row.groundedClosure ? 1 : 0,
        groundedRate: row.groundedClosure ? 1 : 0,
        meanTurns: row.turnCount,
        meanCoverage: row.bestPathCoverage,
        meanMissing: row.missingPremiseCount,
        registerCounts: row.registerCounts,
        registerEntropy: row.policy === 'bland' ? 0 : 1,
        leakCount: 0,
        errorCount: 0,
      },
    ]),
  );
  fs.writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        schema: 'machinespirits.tutor-stub.auto-eval.v1',
        startedAt: '2026-07-09T00:00:00.000Z',
        completedAt,
        config: {
          policies: ['bland', 'field'],
          autoLearnerProfileId: learnerProfile,
          autoLearnerModel: 'codex.gpt-5.5',
          world: 'world_005_marrick',
          dagMode: 'strict_dag',
          dryRun: false,
        },
        aggregates: {
          rows: 2,
          completed: 2,
          ok: 2,
          failed: 0,
          dryRun: 0,
          grounded: 1,
          groundedRate: 0.5,
          meanTurns: 8.5,
          meanCoverage: 0.75,
          meanMissing: 1.5,
          registerCounts: { plain: 8, precise: 5, warm: 4 },
          registerEntropy: 1,
          leakCount: 0,
          errorCount: 0,
          byPolicy,
        },
        rows,
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(htmlPath, '<!doctype html><title>fixture report</title>\n');
  return { jsonPath, htmlPath };
}

function writeRunState(dir, learnerProfile, updatedAt, resume = null) {
  fs.writeFileSync(
    path.join(dir, 'run-state.json'),
    `${JSON.stringify(
      {
        schema: 'machinespirits.tutor-stub.auto-eval-run-state.v1',
        status: 'running',
        pid: 1234,
        startedAt: updatedAt,
        updatedAt,
        traceDir: dir,
        config: {
          policies: ['bland', 'field'],
          autoLearnerProfileId: learnerProfile,
          world: 'world_005_marrick',
          dagMode: 'strict_dag',
        },
        resume,
        totals: { jobs: 2, completed: 1, active: 1, queued: 0, failed: 0, progressRate: 0.5 },
        jobs: [],
      },
      null,
      2,
    )}\n`,
  );
}

test('tutor-stub report index nests profiles under evaluations and preserves reporting UX state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-reporting-ux-'));
  const cohortRoot = path.join(root, 'custom-profile-pressure-run');
  const diligentDir = path.join(cohortRoot, 'diligent');
  const skipperDir = path.join(cohortRoot, 'proof_skipper');
  fs.mkdirSync(cohortRoot, { recursive: true });
  fs.writeFileSync(
    path.join(cohortRoot, 'qa-plan.json'),
    `${JSON.stringify({
      schema: 'machinespirits.tutor-stub.qa-matrix-plan.v1',
      studyId: 'profile-pressure',
      researchQuestion: 'Does policy adaptation help across contrasting learner profiles?',
      hypothesis: 'Field-contingent policies outperform the bland baseline.',
      primaryContrast: 'field vs bland',
      decisionRule: 'Require positive benefit with transition evidence.',
      profiles: ['diligent', 'proof_skipper'],
      policies: ['bland', 'field'],
    })}\n`,
  );
  fs.writeFileSync(
    path.join(cohortRoot, 'qa-matrix.json'),
    `${JSON.stringify({
      schema: 'machinespirits.tutor-stub.cross-run-field.v1',
      qaMatrix: {
        baselinePolicy: 'bland',
        learnerProfiles: ['diligent', 'proof_skipper'],
        policies: ['bland', 'field'],
      },
      policySummary: [
        { policy: 'field', meanScore: 0.7, meanTurns: 9, meanEffectiveClosure: 0.5 },
        { policy: 'bland', meanScore: 0.5, meanTurns: 8, meanEffectiveClosure: 0 },
      ],
    })}\n`,
  );
  fs.writeFileSync(path.join(cohortRoot, 'qa-matrix.md'), '# QA matrix\n');
  fs.writeFileSync(
    path.join(cohortRoot, 'profile-discrimination.json'),
    `${JSON.stringify({
      schema: 'machinespirits.tutor-stub.profile-discrimination.v2',
      summary: { averagePairwiseCosine: 0.91, maxSimilarityToControl: 0.95 },
      gate: {
        mode: 'contract_conditioned',
        pass: false,
        targetAverageCosine: 0.85,
        targetMaxToControl: 0.9,
        conditioned: { profiles: [{ profile: 'proof_skipper', pass: false }] },
      },
    })}\n`,
  );
  fs.writeFileSync(path.join(cohortRoot, 'profile-discrimination.md'), '# Profile gate\n');
  writeEvalSummary(diligentDir, 'diligent', '2026-07-09T00:01:00.000Z');
  writeEvalSummary(skipperDir, 'proof_skipper', '2026-07-09T00:02:00.000Z');
  writeRunState(diligentDir, 'diligent', new Date().toISOString());
  writeRunState(skipperDir, 'proof_skipper', '2020-01-01T00:00:00.000Z', {
    sourcePath: 'proof_skipper/auto-eval-2026-07-09T00-02-00-000Z.json',
    retried: 2,
    statuses: ['failed'],
  });

  execFileSync(process.execPath, ['scripts/run-tutor-stub-auto-eval.js', '--index', '--index-root', root], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  const data = JSON.parse(fs.readFileSync(path.join(root, 'index-data.json'), 'utf8'));
  const researchData = JSON.parse(fs.readFileSync(path.join(root, 'index-research-data.json'), 'utf8'));
  assert.equal(data.schema, 'machinespirits.tutor-stub.report-index-data.v2');
  assert.deepEqual(researchData.cohorts, data.cohorts);
  assert.equal(data.cohorts.length, 1);
  const [cohort] = data.cohorts;
  assert.equal(cohort.id, 'custom-profile-pressure-run');
  assert.equal(cohort.status, 'running');
  assert.match(cohort.decision, /adaptive advantage is supported/);
  assert.deepEqual(cohort.profiles, ['diligent', 'proof_skipper']);
  assert.deepEqual(cohort.policies, ['bland', 'field']);
  assert.equal(cohort.discriminationGate.pass, false);
  assert.deepEqual(cohort.discriminationGate.failedProfiles, ['proof_skipper']);
  assert.ok(cohort.links.some((link) => link.label === 'QA summary'));
  assert.ok(cohort.links.some((link) => link.label === 'profile gate'));
  assert.equal(cohort.childReports.length, 2);
  assert.ok(cohort.childReports.every((profile) => profile.completedTrials === 1));
  assert.ok(cohort.childReports.every((profile) => profile.expectedTrials === 2));
  assert.ok(cohort.childReports.every((profile) => profile.model === 'codex.gpt-5.5'));
  assert.equal(cohort.adaptation.schema, 'machinespirits.tutor-stub.adaptation-matrix.v1');
  assert.equal(cohort.adaptation.verdict, 'supported');
  assert.equal(cohort.adaptation.baselinePolicy, 'bland');
  assert.equal(cohort.adaptation.cells.length, 4);
  assert.equal(
    cohort.adaptation.cells.find((cell) => cell.profile === 'diligent' && cell.policy === 'field').verdict,
    'supported',
  );
  assert.equal(cohort.study.id, 'profile-pressure');
  assert.match(cohort.study.researchQuestion, /contrasting learner profiles/);
  assert.equal(cohort.lineage.position, 1);
  assert.equal(cohort.lineage.total, 1);
  assert.equal(cohort.lineage.evaluations[0].status, 'running');
  assert.ok(Number.isFinite(Date.parse(cohort.lineage.evaluations[0].completedAt)));
  assert.equal(cohort.lab3d.eligible, false);
  assert.ok(cohort.lab3d.reasons.some((reason) => reason.includes('profile-discrimination')));
  assert.equal(cohort.progress.trialsCompleted, 2);
  assert.equal(cohort.progress.trialsExpected, 4);
  assert.equal(cohort.progress.trialRate, 0.5);
  assert.ok(Number.isFinite(Date.parse(cohort.progress.lastActivityAt)));
  assert.deepEqual(cohort.progress.liveProfiles.map((slice) => slice.status).sort(), ['running', 'stale']);
  assert.equal(cohort.progress.liveProfiles.find((slice) => slice.profile === 'diligent').repairPass, false);
  assert.equal(cohort.progress.liveProfiles.find((slice) => slice.profile === 'proof_skipper').repairPass, true);
  assert.deepEqual(cohort.progress.liveProfiles.find((slice) => slice.profile === 'proof_skipper').retriedStatuses, [
    'failed',
  ]);
  assert.ok(
    data.rows.every((row) => row.adaptationEvidence?.schema === 'machinespirits.tutor-stub.adaptation-evidence.v1'),
  );
  assert.ok(data.rows.every((row) => row.reportScope.kind === 'qa_matrix_child'));
  assert.deepEqual(data.activeRuns.map((run) => run.status).sort(), ['running', 'stale']);

  const client = fs.readFileSync(path.join(root, 'assets', 'tutor-stub-index.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'assets', 'tutor-stub-report.css'), 'utf8');
  const shell = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(client, /renderCohortWorkspace/);
  assert.match(client, /renderEvaluationWorkspace/);
  assert.match(client, /function evaluationTimestamp\(cohort\)/);
  assert.match(client, /new Intl\.DateTimeFormat\(undefined/);
  assert.match(client, /timeZoneName: 'short'/);
  assert.match(client, /\.formatToParts\(date\)/);
  assert.match(client, /\(live \? 'updated ' : 'completed '\)/);
  assert.match(client, /esc\(evaluationTimestamp\(cohort\)\)/);
  assert.match(client, /Evaluation → Profile → Trial/);
  assert.match(client, /Adaptation Research Console/);
  assert.match(client, /Profile × Policy/);
  assert.match(client, /Comparison tray/);
  assert.match(client, /URLSearchParams/);
  assert.match(client, /index-research-data\.json/);
  assert.match(client, /mergeResearchData/);
  assert.match(client, /data-view-select/);
  assert.match(client, /data-compare-toggle/);
  assert.match(client, /Study Lineage/);
  assert.match(client, /3D never drives verdicts/);
  assert.match(client, /stays locked until each plotted point can be checked as a plain 2D row/);
  assert.match(client, /lab-3d-stage/);
  assert.match(client, /function renderEvaluationProgress\(cohort\)/);
  assert.match(client, /function statusExplainer\(status\)/);
  assert.match(client, /trials finished \(/);
  assert.match(client, /unitLabel/);
  assert.match(client, /repair pass/);
  assert.match(client, /Interim read: trials are still running/);
  assert.match(client, /How to read these numbers/);
  assert.match(client, /missing evidence, not evidence of a zero effect/);
  assert.match(client, /lab-2d-legend/);
  assert.match(client, /last activity/);
  assert.match(client, /operations-drawer/);
  assert.match(client, /evaluation-profiles/);
  assert.match(client, /Artifact history/);
  assert.match(client, /data-evaluation-filter/);
  assert.match(client, /machinespirits\.tutorStub\.reportIndex\.v1/);
  assert.match(client, /sessionStorage\.setItem/);
  assert.match(client, /report-index-card/);
  assert.match(client, /Needs attention/);
  assert.match(css, /\.cohort-workspace/);
  assert.match(css, /\.evaluation-progress/);
  assert.match(css, /\.reading-guide/);
  assert.match(css, /\.decision-caveat/);
  assert.match(css, /\.live-slice/);
  assert.match(css, /\.lab-2d-legend/);
  assert.match(css, /\.evaluation-profiles/);
  assert.match(css, /\.adaptation-matrix/);
  assert.match(css, /\.evaluation-routebar/);
  assert.match(css, /\.comparison-tray/);
  assert.match(css, /\.operations-drawer/);
  assert.match(css, /\.lab-3d-stage/);
  assert.match(css, /\.artifact-history/);
  assert.match(css, /\.report-card-list/);
  assert.match(css, /\.report-shell \{ display:block; \}/);
  assert.match(shell, /data-index-data="index-data\.json"/);

  execFileSync(process.execPath, ['--check', path.join(root, 'assets', 'tutor-stub-index.js')], {
    cwd: ROOT,
    encoding: 'utf8',
  });
});

test('paired tutor-stub experiments get a live placeholder without an interim verdict', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-experiment-placeholder-'));
  const experimentRoot = path.join(root, 'dag-dropout-paired-smoke');
  const controlDir = path.join(experimentRoot, 'control');
  const treatmentDir = path.join(experimentRoot, 'dropout-015');
  fs.mkdirSync(controlDir, { recursive: true });
  fs.mkdirSync(treatmentDir, { recursive: true });
  fs.writeFileSync(
    path.join(experimentRoot, 'experiment-plan.json'),
    `${JSON.stringify({
      schema: 'machinespirits.tutor-stub.experiment-plan.v1',
      id: 'dag-dropout-paired-smoke',
      title: 'DAG Dropout Paired Smoke',
      studyId: 'dag-dropout',
      researchQuestion: 'Does premise dropout change recovery behavior?',
      primaryContrast: '15% dropout versus no dropout',
      decisionRule: 'Wait for every arm before interpreting the contrast.',
      baselinePolicy: 'bland',
      factor: { name: 'DAG premise dropout', control: '0%', treatment: '15%' },
      measures: ['closure', 'coverage', 'turn cost', 'premise re-adoption'],
      sharedConfig: { policies: ['bland', 'continuous_dynamical_system'], model: 'codex.gpt-5.5' },
      arms: [
        { id: 'control', label: 'No dropout', path: 'control', expectedTrials: 2 },
        { id: 'dropout-015', label: '15% dropout', path: 'dropout-015', expectedTrials: 2 },
      ],
    }, null, 2)}\n`,
  );
  writeRunState(controlDir, 'diligent', new Date().toISOString());
  writeRunState(treatmentDir, 'diligent', new Date().toISOString());

  execFileSync(process.execPath, ['scripts/run-tutor-stub-auto-eval.js', '--index', '--index-root', root], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  const data = JSON.parse(fs.readFileSync(path.join(root, 'index-data.json'), 'utf8'));
  const experimentData = JSON.parse(fs.readFileSync(path.join(root, 'index-experiment-data.json'), 'utf8'));
  const cohort = data.cohorts.find((item) => item.id === 'dag-dropout-paired-smoke');
  assert.ok(cohort);
  assert.equal(cohort.kind, 'experiment_placeholder');
  assert.equal(cohort.status, 'running');
  assert.equal(cohort.unitLabel, 'arm');
  assert.equal(cohort.progress.trialsCompleted, 2);
  assert.equal(cohort.progress.trialsExpected, 4);
  assert.equal(cohort.childReports.length, 2);
  assert.deepEqual(cohort.childReports.map((arm) => arm.armId), ['control', 'dropout-015']);
  assert.equal(cohort.adaptation.verdict, 'pending');
  assert.match(cohort.adaptation.headline, /Work in progress/);
  assert.equal(cohort.experiment.analysisStatus, 'waiting_for_all_arms');
  assert.equal(experimentData.schema, 'machinespirits.tutor-stub.experiment-index-data.v1');
  assert.deepEqual(experimentData.cohorts.map((item) => item.id), ['dag-dropout-paired-smoke']);

  const client = fs.readFileSync(path.join(root, 'assets', 'tutor-stub-index.js'), 'utf8');
  const placeholder = fs.readFileSync(path.join(experimentRoot, 'index.html'), 'utf8');
  assert.match(client, /renderExperimentPlaceholder/);
  assert.match(client, /mergeExperimentData/);
  assert.match(client, /refreshExperimentProgress/);
  assert.match(client, /index-experiment-data\.json/);
  assert.match(client, /Declared paired design/);
  assert.match(client, /no interim verdict/);
  assert.match(placeholder, /live placeholder/i);
  assert.match(placeholder, /experiment-plan\.json/);
  assert.match(placeholder, /no comparative verdict is reported until every arm completes/i);
  assert.match(placeholder, /\?evaluation=dag-dropout-paired-smoke/);
});

test('individual tutor-stub reports expose progressive summaries and accessible replay tabs', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'run-tutor-stub-auto-eval.js'), 'utf8');
  assert.match(source, /class="read-first-cards"/);
  assert.match(source, /<h2>Adaptation Verdict<\/h2>/);
  assert.match(source, /machinespirits\.tutor-stub\.adaptation-evidence\.v1/);
  assert.match(source, /summary\.adaptationEvidence = adaptationEvidenceForRows/);
  assert.match(source, /<h2>Adaptation Timeline<\/h2>/);
  assert.match(source, /data-adaptation-replay/);
  assert.match(source, /Tutor Stub Profile Report/);
  assert.match(source, /<h2>Trial Details<\/h2>/);
  assert.match(source, /Evaluation → Profile → Trial/);
  assert.doesNotMatch(source, /not the consolidated QA matrix/);
  assert.doesNotMatch(source, /Full policy ranking and secondary metrics/);
  assert.doesNotMatch(source, /strongest current signal/);
  assert.match(source, /Evidence dimensions and baseline differences/);
  assert.match(source, /<details class="viz-sidebar"/);
  assert.match(source, /role="tab" aria-selected="true" aria-controls="tutor-stub-viz-canvas"/);
  assert.match(source, /button\.setAttribute\('aria-selected'/);
  assert.match(source, /\['profile gate', scope\.discriminationMarkdownHref\]/);
});
