import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import yaml from 'yaml';

import { appendRunEvent, canonicalJson, createRunPlan, createRunSeal } from '../services/experimentRunArtifacts.js';
import { adaptiveStateStage1ReportContentSha256 } from '../services/adaptiveTutor/stateBenchmarkStage1Analysis.js';
import { buildAdaptiveStateCriticalPathPlan } from '../services/adaptiveTutor/stateBenchmarkV2.js';
import {
  executionRunPlan,
  validateAdaptiveStateStage1SupersededStoppedRun,
} from '../scripts/execute-adaptive-state-benchmark-v2-s1.js';

const ROOT = path.resolve('.');
const CONFIG_PATH = path.join(ROOT, 'config', 'adaptive-state-benchmark-v2.yaml');
const config = yaml.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const parent = {
  run_id: 'sealed-s0-parent-v21',
  report_sha256: 'a'.repeat(64),
};
const replacementPlan = buildAdaptiveStateCriticalPathPlan(config, {
  stage: 's1_technical_pilot',
  label: 'repaired-s1-v21',
});

function stoppedReport({ status = 'stop', decision = 'stop_and_repair_s1' } = {}) {
  const report = {
    schema: 'machinespirits.adaptive-state-stage1-technical-report.v2.1',
    version: '2.1',
    stage: 's1_technical_pilot',
    status,
    decision,
    confirmation_eligible: false,
    s2_validity_verdict: null,
    protocol: {
      gate_eligible: false,
      target_contracts: config.targets.co_primary,
    },
  };
  report.content_sha256 = adaptiveStateStage1ReportContentSha256(report);
  return report;
}

function createStoppedFixture(
  root,
  {
    id = 'stopped-s1-v21',
    sourceParent = parent,
    sealStatus = 'stopped',
    report = stoppedReport(),
    sealDecision = 'stop_and_repair_s1',
  } = {},
) {
  const runDir = path.join(root, id);
  const criticalPlan = buildAdaptiveStateCriticalPathPlan(config, {
    stage: 's1_technical_pilot',
    label: id,
  });
  const runPlan = executionRunPlan({
    plan: criticalPlan,
    config,
    configPath: CONFIG_PATH,
    parent: sourceParent,
    runSeed: 20260712,
    cliVersions: {
      codex: { version: 'fixture-codex', executable_realpath: '/fixture/codex' },
      claude: { version: 'fixture-claude', executable_realpath: '/fixture/claude' },
    },
  });
  const created = createRunPlan(runDir, runPlan);
  fs.writeFileSync(
    path.join(runDir, 'critical-path-plan.json'),
    canonicalJson(criticalPlan, { space: 2, trailingNewline: true }),
  );
  fs.writeFileSync(
    path.join(runDir, 'stage1-technical-report.json'),
    canonicalJson(report, { space: 2, trailingNewline: true }),
  );
  appendRunEvent(runDir, { type: 'stage1_technical_evaluated', status: report.status, decision: report.decision });
  createRunSeal(runDir, {
    status: sealStatus,
    metadata: {
      stage: 's1_technical_pilot',
      decision: sealDecision,
      runPlanSha256: created.sha256,
      stage1ReportSha256: report.content_sha256,
    },
  });
  return runDir;
}

test('stopped S1 replacement validation seals one explicit supersedes run id into lineage', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-s1-supersedes-'));
  try {
    const stoppedRunDir = createStoppedFixture(temporaryRoot);
    const superseded = validateAdaptiveStateStage1SupersededStoppedRun({
      supersededRunDir: stoppedRunDir,
      replacementPlan,
      replacementParent: parent,
      configPath: CONFIG_PATH,
    });
    assert.equal(superseded.run_id, 'stopped-s1-v21');
    const replacementRunPlan = executionRunPlan({
      plan: replacementPlan,
      config,
      configPath: CONFIG_PATH,
      parent,
      runSeed: 20260712,
      cliVersions: {
        codex: { version: 'fixture-codex', executable_realpath: '/fixture/codex' },
        claude: { version: 'fixture-claude', executable_realpath: '/fixture/claude' },
      },
      supersedes: [superseded.run_id],
    });
    assert.deepEqual(replacementRunPlan.lineage.supersedes, ['stopped-s1-v21']);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('replacement validation rejects completed, passing, wrong-parent, or matrix-drift sources', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-s1-supersedes-reject-'));
  const validate = (runDir, plan = replacementPlan) =>
    validateAdaptiveStateStage1SupersededStoppedRun({
      supersededRunDir: runDir,
      replacementPlan: plan,
      replacementParent: parent,
      configPath: CONFIG_PATH,
    });
  try {
    assert.throws(
      () => validate(createStoppedFixture(temporaryRoot, { id: 'completed', sealStatus: 'complete' })),
      /sealed stopped paid v2\.1 S1/u,
    );
    assert.throws(
      () =>
        validate(
          createStoppedFixture(temporaryRoot, {
            id: 'passing',
            report: stoppedReport({ status: 'pass', decision: 'advance_to_s2' }),
            sealDecision: 'advance_to_s2',
          }),
        ),
      /stopped, non-passing/u,
    );
    assert.throws(
      () =>
        validate(
          createStoppedFixture(temporaryRoot, {
            id: 'wrong-parent',
            sourceParent: { run_id: 'other-s0', report_sha256: 'b'.repeat(64) },
          }),
        ),
      /share the replacement run's sealed S0 parent/u,
    );
    const driftedReplacement = structuredClone(replacementPlan);
    driftedReplacement.jobs[0].action_schedule[0] = 'request_evidence';
    assert.throws(
      () => validate(createStoppedFixture(temporaryRoot, { id: 'matrix-source' }), driftedReplacement),
      /exact matrix/u,
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('S1 help documents the optional stopped-run replacement lineage flag', () => {
  const help = execFileSync(process.execPath, ['scripts/execute-adaptive-state-benchmark-v2-s1.js', '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.match(help, /--supersedes-stopped-s1 <dir>/u);
  assert.match(help, /Sealed stopped v2\.1 S1 replaced by this run/u);
});
