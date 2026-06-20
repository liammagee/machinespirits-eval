import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';

// Hermetic DB + logs and mock LLM, set BEFORE the runner (which opens the DB at
// import and would otherwise route to the production path / a paid backend) is
// dynamically imported inside the test.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-worldspec-'));
process.env.EVAL_DB_PATH = path.join(tmpDir, 'evaluations.db');
process.env.EVAL_LOGS_DIR = path.join(tmpDir, 'logs');
process.env.ADAPTIVE_TUTOR_LLM = 'mock';
fs.mkdirSync(path.join(process.env.EVAL_LOGS_DIR, 'tutor-dialogues'), { recursive: true });

function scenario(id, extra = {}) {
  return {
    id,
    opening: 'Can you help me with this fraction problem?',
    max_turns: 2,
    hidden: {
      actual_misconception: 'adds numerators and denominators',
      actual_sophistication: 'intermediate',
      trigger_turn: 1,
      trigger_signal: 'wait, that does not look right',
    },
    ...extra,
  };
}

// Regression guard for the world-spec resolution defect: an unresolvable
// world_adaptation_spec reference on one scenario must not abort the whole run.
// resolveWorldAdaptationSpec throws on a dangling reference; if that call sits
// outside the per-scenario try, the throw escapes the catch-less outer try and
// skips updateRun(), leaving evaluation_runs stuck at status='running'.
test('runner skips a scenario with an unresolvable world spec ref and still finalizes the run', async () => {
  const { runAdaptiveEvaluation } = await import('../services/adaptiveTutor/index.js');
  const evaluationStore = await import('../services/evaluationStore.js');

  // No world_adaptation_source => the loaded spec list is empty => the middle
  // scenario's world_adaptation_spec_id resolves to nothing and throws.
  const scenarioSource = path.join(tmpDir, 'scenarios.yaml');
  fs.writeFileSync(
    scenarioSource,
    yaml.stringify({
      scenarios: [
        scenario('good_before'),
        scenario('dangling_world_ref', { world_adaptation_spec_id: 'NO_SUCH_WORLD_SPEC' }),
        scenario('good_after'),
      ],
    }),
  );

  const evalProfile = {
    runner: 'adaptive',
    scenario_source: scenarioSource,
    adaptive: { architecture: 'state_policy', counterfactual: { enabled: false } },
  };

  // Before the fix this rejected (the throw escaped the outer try). It must instead
  // resolve: the dangling-ref scenario is skipped, both good scenarios persist.
  const result = await runAdaptiveEvaluation({
    profileName: 'cell_test_worldspec',
    evalProfile,
    runsPerConfig: 1,
  });

  assert.equal(result.persisted.length, 2, 'both good scenarios persist; the dangling-ref one is skipped');

  const run = evaluationStore.getRun(result.runId);
  assert.equal(run.status, 'completed', 'run must be finalized, not left stuck at status=running');
  assert.ok(run.completedAt, 'run must carry a completedAt timestamp');
});
