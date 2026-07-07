import assert from 'node:assert/strict';
import test from 'node:test';
import { buildM0QualitySummary, renderM0QualityReport } from '../scripts/generate-m0-two-judge-quality-report.js';

const runs = [
  { suite: 'cross-suite', arm: 'baseline', runId: 'run-baseline', profile: 'cell_baseline' },
  { suite: 'cross-suite', arm: 'treatment', runId: 'run-treatment', profile: 'cell_treatment' },
  { suite: 'cross-suite', arm: 'state-scramble', runId: 'run-scramble', profile: 'cell_scramble' },
  { suite: 'cross-suite', arm: 'closure-off', runId: 'run-closure', profile: 'cell_closure' },
];

function row(id, runId, profileName, scores) {
  return {
    id,
    run_id: runId,
    profile_name: profileName,
    scenario_id: `s${id}`,
    adaptive_trigger_recognition: scores[0],
    adaptive_strategy_execution: scores[1],
    adaptive_strategy_quality: scores[2],
    adaptive_pedagogical_coherence: scores[3],
    adaptive_grader_judge_model: 'claude-code/sonnet',
    adaptive_grader_version: 'adaptive-grader-v0.1',
  };
}

test('M0 quality summary pairs DB rows with external judge rows and computes deltas', () => {
  const dbRows = [
    row(1, 'run-baseline', 'cell_baseline', [1, 2, 2, 2]),
    row(2, 'run-treatment', 'cell_treatment', [3, 3, 3, 3]),
    row(3, 'run-scramble', 'cell_scramble', [1, 1, 1, 1]),
    row(4, 'run-closure', 'cell_closure', [2, 2, 2, 2]),
  ];
  const externalJudge = {
    label: 'codex-cli.default',
    graderVersion: 'adaptive-grader-v0.1',
    rows: {
      1: {
        judge: 'codex-cli.default',
        scores: { trigger_recognition: 2, strategy_execution: 2, strategy_quality: 2, pedagogical_coherence: 2 },
      },
      2: {
        judge: 'codex-cli.default',
        scores: { trigger_recognition: 4, strategy_execution: 4, strategy_quality: 4, pedagogical_coherence: 4 },
      },
      3: {
        judge: 'codex-cli.default',
        scores: { trigger_recognition: 1, strategy_execution: 1, strategy_quality: 1, pedagogical_coherence: 1 },
      },
      4: {
        judge: 'codex-cli.default',
        scores: { trigger_recognition: 2, strategy_execution: 3, strategy_quality: 2, pedagogical_coherence: 3 },
      },
    },
  };

  const summary = buildM0QualitySummary(dbRows, externalJudge, runs);
  const treatment = summary.groups.find((g) => g.arm === 'treatment');
  const baselineDelta = summary.deltas.find((d) => d.contrast === 'treatment - baseline');
  const scrambleDelta = summary.deltas.find((d) => d.contrast === 'treatment - state-scramble');

  assert.equal(summary.rows.length, 4);
  assert.equal(treatment.dbComposite20, 12);
  assert.equal(treatment.externalComposite20, 16);
  assert.equal(baselineDelta.dbDelta, 5);
  assert.equal(baselineDelta.externalDelta, 8);
  assert.equal(scrambleDelta.dbDelta, 8);
  assert.equal(scrambleDelta.externalDelta, 12);
});

test('M0 quality report names judges and flags missing external rows', () => {
  const dbRows = [
    row(1, 'run-baseline', 'cell_baseline', [1, 2, 2, 2]),
    row(2, 'run-treatment', 'cell_treatment', [3, 3, 3, 3]),
  ];
  const summary = buildM0QualitySummary(
    dbRows,
    {
      label: 'codex-cli.default',
      graderVersion: 'adaptive-grader-v0.1',
      rows: {
        1: {
          judge: 'codex-cli.default',
          scores: {
            trigger_recognition: 2,
            strategy_execution: 2,
            strategy_quality: 2,
            pedagogical_coherence: 2,
          },
        },
      },
    },
    runs.slice(0, 2),
  );

  const report = renderM0QualityReport(summary, { generatedAt: '2026-06-23T00:00:00.000Z' });

  assert.match(report, /DB-side judge: `claude-code\/sonnet`/);
  assert.match(report, /External judge: `codex-cli.default`/);
  assert.match(report, /Paired rows: 1 \/ 2/);
  assert.match(report, /Missing external rows: 2/);
});
