import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import yaml from 'yaml';

import { hashCanonicalJson, hashFile, sha256 } from '../services/experimentRunArtifacts.js';
import { buildAdaptiveStateCriticalPathPlan } from '../services/adaptiveTutor/stateBenchmarkV2.js';
import { createAdaptiveStateStage1ProductionLiveSeams } from '../services/adaptiveTutor/stateBenchmarkStage1LiveAdapters.js';
import {
  ADAPTIVE_STATE_S2_SEMANTIC_REGENERATION_IMPLEMENTED,
  validateAdaptiveStateHistoricalS1RunPlan,
  validateAdaptiveStateS1PromotionParent,
  validateAdaptiveStateStage2Run,
} from '../services/adaptiveTutor/stateBenchmarkStage2Lineage.js';
import { buildPlanArtifact } from '../scripts/run-adaptive-state-benchmark-v2.js';

const ROOT = path.resolve('.');
const CONFIG_PATH = path.join(ROOT, 'config', 'adaptive-state-benchmark-v2.yaml');

function config() {
  return yaml.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function cleanGitAttestation(sha, branch = 'codex/historical-s1') {
  const statusSha256 = sha256('');
  const patchSha256 = sha256('');
  const untracked = [];
  return {
    sha,
    branch,
    dirty: false,
    statusSha256,
    patchSha256,
    untracked,
    fingerprintSha256: hashCanonicalJson({ sha, branch, statusSha256, patchSha256, untracked }),
  };
}

test('S1 lineage accepts a later unrelated Git SHA but rejects S1 source or CLI drift', () => {
  const expectedCurrentPlan = {
    createdAt: '2026-07-12T01:00:00.000Z',
    runner: 'scripts/execute-adaptive-state-benchmark-v2-s1.js',
    provenance: { git: cleanGitAttestation('a'.repeat(40), 'codex/current-s2') },
    hashes: { runner: 'b'.repeat(64), analyzer: 'c'.repeat(64), config: 'd'.repeat(64) },
    metadata: {
      cliVersions: {
        codex: { version: 'codex 1', executable_realpath: '/usr/local/bin/codex' },
        claude: { version: 'claude 1', executable_realpath: '/usr/local/bin/claude' },
      },
    },
  };
  const sealedPlan = structuredClone(expectedCurrentPlan);
  sealedPlan.createdAt = '2026-07-11T01:00:00.000Z';
  sealedPlan.provenance.git = cleanGitAttestation('e'.repeat(40), 'codex/historical-s1');
  assert.doesNotThrow(() =>
    validateAdaptiveStateHistoricalS1RunPlan({ sealedPlan, expectedCurrentPlan }),
  );

  const sourceDrift = structuredClone(expectedCurrentPlan);
  sourceDrift.hashes.analyzer = 'f'.repeat(64);
  assert.throws(
    () => validateAdaptiveStateHistoricalS1RunPlan({ sealedPlan, expectedCurrentPlan: sourceDrift }),
    /S1-relevant sources\/config\/CLI contract/u,
  );

  const cliDrift = structuredClone(expectedCurrentPlan);
  cliDrift.metadata.cliVersions.codex.version = 'codex 2';
  assert.throws(
    () => validateAdaptiveStateHistoricalS1RunPlan({ sealedPlan, expectedCurrentPlan: cliDrift }),
    /S1-relevant sources\/config\/CLI contract/u,
  );

  const dirtyHistorical = structuredClone(sealedPlan);
  dirtyHistorical.provenance.git.dirty = true;
  assert.throws(
    () => validateAdaptiveStateHistoricalS1RunPlan({ sealedPlan: dirtyHistorical, expectedCurrentPlan }),
    /historical clean-Git attestation/u,
  );
});

test('S2 design is fixed at eight seeds per cell and carries no power-selection branch', () => {
  const value = config();
  const plan = buildAdaptiveStateCriticalPathPlan(value, { stage: 's2_confirmation' });
  assert.equal(plan.counts.seeds_per_cell, 8);
  assert.equal(plan.counts.dialogue_jobs, 96);
  assert.equal(plan.counts.expected_cli_process_dispatches, 1344);
  assert.equal(plan.counts.expected_model_calls, 1344);
  assert.equal(
    plan.counts.expected_model_calls_deprecated_alias_semantics,
    'cli_process_dispatches_not_backend_requests',
  );
  assert.throws(
    () => buildAdaptiveStateCriticalPathPlan(value, { stage: 's2_confirmation', confirmationPerCell: 6 }),
    /fixed at --per-cell 8/u,
  );
});

test('direct S2 planning rejects a caller-fabricated authorization object', () => {
  const value = config();
  assert.throws(
    () =>
      buildPlanArtifact({
        config: value,
        configPath: CONFIG_PATH,
        stage: 's2_confirmation',
        confirmationPerCell: 8,
        label: 'forged-s2',
        promotionParent: {
          authorization: {
            selected_seeds_per_cell: 8,
            sample_size_basis: 'preregistered_bounded_maximum',
          },
        },
      }),
    /live sealed-parent verification/u,
  );
});

test('canonical paid S1 live surface rejects injected CLI and resolver capabilities', () => {
  assert.throws(
    () =>
      createAdaptiveStateStage1ProductionLiveSeams({
        config: config(),
        callCli: async () => ({ text: '{}' }),
      }),
    /do not accept injected CLI or resolver/u,
  );
  assert.throws(
    () =>
      createAdaptiveStateStage1ProductionLiveSeams({
        config: config(),
        resolveModelRef: () => ({ provider: 'mock', model: 'mock', isConfigured: true }),
      }),
    /do not accept injected CLI or resolver/u,
  );
});

test('S2 CLI planning refuses missing sealed S0/S1 parents', () => {
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        ['scripts/run-adaptive-state-benchmark-v2.js', '--stage', 's2_confirmation', '--stdout'],
        { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' },
      ),
    /sealed S0 parent run is required/u,
  );
});

test('self-consistent claimed S0 hashes cannot authorize S1 without the actual sealed S0 run', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-state-s2-forged-s0-'));
  try {
    assert.throws(
      () =>
        validateAdaptiveStateS1PromotionParent({
          parentRunDir: path.join(root, 'forged-s1'),
          s0RunDir: path.join(root, 'forged-s0'),
          config: config(),
          configPath: CONFIG_PATH,
          repoRoot: ROOT,
        }),
      /sealed S0 parent run is required|failed seal verification/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('final S2 path refuses promotion because semantic regeneration is not implemented', () => {
  assert.equal(ADAPTIVE_STATE_S2_SEMANTIC_REGENERATION_IMPLEMENTED, false);
  assert.match(hashFile(path.join(ROOT, 'services', 'adaptiveTutor', 'stateBenchmarkStage2Lineage.js')), /^[0-9a-f]{64}$/u);
  assert.equal(typeof validateAdaptiveStateStage2Run, 'function');
});

test('final v2 analyzer rejects the old arbitrary bare-report entrypoint', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-state-s2-bare-report-'));
  const report = path.join(root, 'arbitrary-report.json');
  try {
    fs.writeFileSync(report, '{}\n');
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          ['scripts/analyze-adaptive-state-validity-v2.js', '--report', report, '--stdout'],
          { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' },
        ),
      /Bare --report input is forbidden/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
