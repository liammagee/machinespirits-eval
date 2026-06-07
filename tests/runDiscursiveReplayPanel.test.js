import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import yaml from 'yaml';
import { buildReplayPanelPackage, isAdversarialPrecheck, parseArgs } from '../scripts/run-discursive-replay-panel.js';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('parseArgs defaults to survivor-only adversarial precheck requirement', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-panel-args-'));
  writeJson(path.join(tmp, 'manifest.json'), { records: [] });

  const args = parseArgs(['--replay-dir', tmp]);
  assert.deepEqual(args.includeStatus, ['survivor']);
  assert.equal(args.requireAdversarialPrecheck, true);
  assert.equal(args.critics.includes('codex'), true);
  assert.equal(args.criticConcurrency, args.critics.length);
});

test('parseArgs accepts explicit critic concurrency throttling', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-panel-args-'));
  writeJson(path.join(tmp, 'manifest.json'), { records: [] });

  const args = parseArgs(['--replay-dir', tmp, '--critic-concurrency', '2']);
  assert.equal(args.criticConcurrency, 2);
});

test('buildReplayPanelPackage writes blind sample and held-out precheck link', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-panel-'));
  const replayDir = path.join(tmp, 'replay');
  const itemDir = path.join(replayDir, 'item-a');
  const outDir = path.join(tmp, 'panel');
  fs.mkdirSync(itemDir, { recursive: true });

  const revisedPublicPath = path.join(itemDir, 'revised-public.txt');
  const revisionJsonPath = path.join(itemDir, 'revision.json');
  const checkJsonPath = path.join(itemDir, 'check.json');
  const gateJsonPath = path.join(itemDir, 'gate.json');
  const itemManifestPath = path.join(itemDir, 'manifest.json');
  fs.writeFileSync(revisedPublicPath, 'LEARNER: public only\nTUTOR: public response\n', 'utf8');
  writeJson(revisionJsonPath, { claim_boundary: 'counterfactual_revision_not_online_adaptation' });
  writeJson(checkJsonPath, { parsed: { passes: true } });
  writeJson(gateJsonPath, { status: 'survivor' });

  const record = {
    item: {
      id: 'source-run:target-r01:peripeteia-only:T15',
      run_id: 'source-run',
      full_transcript_path: 'config/source/T15.full.md',
    },
    paths: {
      revisedPublic: revisedPublicPath,
      revisionJson: revisionJsonPath,
      checkJson: checkJsonPath,
      gateJson: gateJsonPath,
      manifest: itemManifestPath,
    },
    generator: { backend: 'codex' },
    checker: { backend: 'claude' },
    checkerPolicy: 'adversarial',
    gate: { status: 'survivor', warnings: [], failures: [] },
  };
  writeJson(itemManifestPath, record);
  writeJson(path.join(replayDir, 'manifest.json'), {
    generator: 'codex',
    checker: 'claude',
    checker_policy: 'adversarial',
    records: [record],
  });

  assert.equal(isAdversarialPrecheck(record), true);

  const result = buildReplayPanelPackage({
    replayDir,
    outDir,
    runId: 'panel-test',
    critics: ['codex'],
    includeStatus: ['survivor'],
    requireAdversarialPrecheck: true,
    force: false,
    dryRun: false,
    mock: false,
    scoreConcurrency: 1,
  });

  const samplePath = path.join(outDir, 'replay-r01', 'sample', 'T01.txt');
  const keyPath = path.join(outDir, 'replay-r01', 'key.yaml');
  const batchPlanPath = path.join(outDir, 'batch-plan.json');
  assert.equal(fs.readFileSync(samplePath, 'utf8'), 'LEARNER: public only\nTUTOR: public response\n');
  assert.doesNotMatch(fs.readFileSync(samplePath, 'utf8'), /codex|claude|source-run/i);

  const key = yaml.parse(fs.readFileSync(keyPath, 'utf8'));
  assert.equal(key.items.T01.replay.generator_backend, 'codex');
  assert.equal(key.items.T01.replay.checker_backend, 'claude');
  assert.equal(key.items.T01.replay.adversarial_precheck.passed, true);
  assert.equal(key.preliminary_check_policy.visible_to_blind_critic, false);

  const plan = JSON.parse(fs.readFileSync(batchPlanPath, 'utf8'));
  assert.equal(plan.preliminaryCheckPolicy.linked, true);
  assert.equal(plan.criticConcurrency, 1);
  assert.equal(result.scoreCommands[0].critic, 'codex');
  assert.ok(result.scoreCommands[0].cmd.includes('scripts/score-poetics-phase2.js'));
});
