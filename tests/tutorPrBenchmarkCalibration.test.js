import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  analyzeTutorPrCalibration,
  getTutorPrCalibrationStatus,
  prepareTutorPrCalibrationWorkspace,
  saveTutorPrCalibrationAdjudication,
  saveTutorPrCalibrationCoding,
} from '../services/tutorPrBenchmarkCalibration.js';
import {
  buildTutorPrBenchmarkPlan,
  loadTutorPrBenchmarkConfig,
  runTutorPrBenchmark,
} from '../services/tutorStubPrBenchmark.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BENCHMARK_CONFIG = path.join(ROOT, 'config', 'tutor-pr-benchmark.yaml');
const CALIBRATION_CONFIG = path.join(ROOT, 'config', 'tutor-pr-benchmark-calibration.yaml');

function passingAudit() {
  return {
    ok: true,
    safetyFailure: false,
    failureClusters: [],
    hardFailureClusters: [],
    deliveryDecision: { hardIssues: [] },
  };
}

async function syntheticReport() {
  const loaded = loadTutorPrBenchmarkConfig(BENCHMARK_CONFIG);
  const plan = buildTutorPrBenchmarkPlan({
    config: loaded.config,
    root: ROOT,
    preset: 'smoke',
    configSha256: crypto.createHash('sha256').update(loaded.source).digest('hex'),
  });
  return runTutorPrBenchmark({
    plan,
    root: ROOT,
    metadata: { gitSha: 'synthetic-calibration-sha', gitTreeState: 'clean' },
    generateCandidate: async ({ job }) => ({
      text:
        job.modelId === 'codex_medium' ? 'Let us keep the licensed period in view.' : 'A candidate with a bad handoff.',
      provider: job.model.provider,
      model: job.model.model,
    }),
    auditCandidate: ({ job }) =>
      job.modelId === 'codex_medium'
        ? passingAudit()
        : {
            ...passingAudit(),
            ok: false,
            safetyFailure: true,
            failureClusters: ['questionSupportAudit:question_required_by_handoff_contract'],
            hardFailureClusters: ['questionSupportAudit:question_required_by_handoff_contract'],
            deliveryDecision: {
              hardIssues: [
                {
                  guard: 'questionSupportAudit',
                  type: 'question_required_by_handoff_contract',
                },
              ],
            },
          },
  });
}

async function prepare(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-pr-calibration-test-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const reportPath = path.join(temporary, 'report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(await syntheticReport(), null, 2)}\n`);
  const workspace = path.join(temporary, 'workspace');
  const prepared = prepareTutorPrCalibrationWorkspace({
    root: ROOT,
    reportPath,
    configPath: CALIBRATION_CONFIG,
    outDir: workspace,
    purpose: 'development',
  });
  return { temporary, reportPath, workspace, prepared };
}

function savePacketForCoder({ prepared, workspace, coderId, mutate = (labels) => labels }) {
  for (const item of prepared.packet.items) {
    const key = prepared.machineKey.items.find((entry) => entry.item_id === item.item_id);
    saveTutorPrCalibrationCoding({
      workspaceDir: workspace,
      configPath: CALIBRATION_CONFIG,
      coderId,
      itemId: item.item_id,
      labels: mutate(structuredClone(key.machine_labels), item),
    });
  }
}

test('prepare, independent coding, adjudication, and analysis are resumable and hash-linked', async (t) => {
  const { workspace, prepared } = await prepare(t);
  assert.equal(prepared.packet.items.length, 2);
  assert.equal(prepared.manifest.required_coders, 2);
  const visible = JSON.stringify(prepared.packet);
  assert.doesNotMatch(visible, /codex_medium|claude_medium|gpt-5\.6|claude-sonnet/u);
  assert.match(JSON.stringify(prepared.machineKey), /codex_medium/u);

  let status = getTutorPrCalibrationStatus({ workspaceDir: workspace, configPath: CALIBRATION_CONFIG });
  assert.equal(status.state, 'awaiting_labels');

  savePacketForCoder({ prepared, workspace, coderId: 'coder-a' });
  status = getTutorPrCalibrationStatus({ workspaceDir: workspace, configPath: CALIBRATION_CONFIG });
  assert.equal(status.state, 'awaiting_second_coder');

  const disputedItem = prepared.packet.items[0];
  savePacketForCoder({
    prepared,
    workspace,
    coderId: 'coder-b',
    mutate: (labels, item) => {
      if (item.item_id === disputedItem.item_id) labels.overall_delivery = 'unsure';
      return labels;
    },
  });
  status = getTutorPrCalibrationStatus({ workspaceDir: workspace, configPath: CALIBRATION_CONFIG });
  assert.equal(status.state, 'awaiting_adjudication');
  assert.equal(status.unresolved_disagreements.length, 1);

  saveTutorPrCalibrationAdjudication({
    workspaceDir: workspace,
    configPath: CALIBRATION_CONFIG,
    coderId: 'adjudicator',
    itemId: disputedItem.item_id,
    axis: 'overall_delivery',
    value: prepared.machineKey.items.find((entry) => entry.item_id === disputedItem.item_id).machine_labels
      .overall_delivery,
    notes: 'Resolved from the frozen public record.',
  });
  status = getTutorPrCalibrationStatus({ workspaceDir: workspace, configPath: CALIBRATION_CONFIG });
  assert.equal(status.state, 'ready_to_analyze');

  const disputedKey = prepared.machineKey.items.find((entry) => entry.item_id === disputedItem.item_id);
  saveTutorPrCalibrationCoding({
    workspaceDir: workspace,
    configPath: CALIBRATION_CONFIG,
    coderId: 'coder-b',
    itemId: disputedItem.item_id,
    labels: {
      ...disputedKey.machine_labels,
      overall_delivery: disputedKey.machine_labels.overall_delivery === 'pass' ? 'fail' : 'pass',
    },
  });
  status = getTutorPrCalibrationStatus({ workspaceDir: workspace, configPath: CALIBRATION_CONFIG });
  assert.equal(status.state, 'awaiting_adjudication');
  saveTutorPrCalibrationAdjudication({
    workspaceDir: workspace,
    configPath: CALIBRATION_CONFIG,
    coderId: 'adjudicator',
    itemId: disputedItem.item_id,
    axis: 'overall_delivery',
    value: disputedKey.machine_labels.overall_delivery,
    notes: 'Refreshed after a coder changed the disputed evidence.',
  });

  const analysis = analyzeTutorPrCalibration({ workspaceDir: workspace, configPath: CALIBRATION_CONFIG });
  assert.equal(analysis.enforcement, 'report_only');
  assert.equal(analysis.promotion_eligible, false);
  assert.deepEqual(analysis.promotion_reasons, [
    'report_only_harness',
    'development_packet_cannot_promote',
    'acceptance_thresholds_not_approved',
  ]);
  assert.equal(analysis.metrics.overall_delivery.agreement, 1);
  assert.match(analysis.evidence_sha256, /^[a-f0-9]{64}$/u);
  status = getTutorPrCalibrationStatus({ workspaceDir: workspace, configPath: CALIBRATION_CONFIG });
  assert.equal(status.state, 'complete');

  saveTutorPrCalibrationCoding({
    workspaceDir: workspace,
    configPath: CALIBRATION_CONFIG,
    coderId: 'coder-a',
    itemId: disputedItem.item_id,
    labels: disputedKey.machine_labels,
    notes: 'A later note changes the evidence fingerprint.',
  });
  status = getTutorPrCalibrationStatus({ workspaceDir: workspace, configPath: CALIBRATION_CONFIG });
  assert.equal(status.state, 'ready_to_analyze');
});

test('acceptance preparation requires a complete report from a clean recorded commit', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-pr-calibration-acceptance-test-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const report = await syntheticReport();
  report.metadata.gitTreeState = 'dirty';
  const reportPath = path.join(temporary, 'report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  assert.throws(
    () =>
      prepareTutorPrCalibrationWorkspace({
        root: ROOT,
        reportPath,
        configPath: CALIBRATION_CONFIG,
        outDir: path.join(temporary, 'dirty-workspace'),
        purpose: 'acceptance',
      }),
    /complete benchmark report from a clean recorded commit/u,
  );

  report.metadata.gitTreeState = 'clean';
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const prepared = prepareTutorPrCalibrationWorkspace({
    root: ROOT,
    reportPath,
    configPath: CALIBRATION_CONFIG,
    outDir: path.join(temporary, 'clean-workspace'),
    purpose: 'acceptance',
  });
  assert.equal(prepared.manifest.purpose, 'acceptance');
});

test('workspace loading rejects a modified machine key', async (t) => {
  const { workspace } = await prepare(t);
  const keyPath = path.join(workspace, 'machine-key.json');
  const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  key.items[0].source_model = 'tampered-model';
  fs.writeFileSync(keyPath, `${JSON.stringify(key, null, 2)}\n`);
  assert.throws(
    () => getTutorPrCalibrationStatus({ workspaceDir: workspace, configPath: CALIBRATION_CONFIG }),
    /workspace provenance mismatch/u,
  );
});

test('calibration CLI advertises the zero-call resumable workflow', () => {
  const result = spawnSync(process.execPath, ['scripts/tutor-pr-benchmark-calibration.js', '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /All commands are artifact-only and make zero model calls/u);
  assert.match(result.stdout, /label --workspace/u);
  assert.match(result.stdout, /adjudicate --workspace/u);
});
