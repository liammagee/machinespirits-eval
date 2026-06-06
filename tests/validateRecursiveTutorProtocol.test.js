import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import yaml from 'yaml';
import { validateRecursiveTutorProtocol } from '../scripts/validate-recursive-tutor-protocol.js';

const ROOT = path.resolve('.');
const PROTOCOL = path.join(ROOT, 'config', 'recursive-tutor-learning', 'a18-correctness-gated-protocol.yaml');
const PROTOCOL_V2 = path.join(ROOT, 'config', 'recursive-tutor-learning', 'a18-panel-vote-rule-v2.yaml');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'recursive-tutor-learning', 'underdetermined-transfer-families.yaml');

test('A18.16 validator accepts the frozen underdetermined-transfer fixture', () => {
  const report = validateRecursiveTutorProtocol({
    protocolPath: PROTOCOL,
    configPath: DEFAULT_CONFIG,
  });
  assert.equal(report.status, 'pass');
  assert.equal(report.summary.errors, 0);
  assert.ok(report.families.length >= 2);
});

test('A18.16 validator rejects held-out siblings without policy correctness metadata', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a18-protocol-'));
  const badConfigPath = path.join(tmpDir, 'bad-family.yaml');
  fs.writeFileSync(
    badConfigPath,
    yaml.stringify({
      meta: { schema_version: 'recursive-tutor-learning-families-v1-underdetermined-transfer' },
      families: [
        {
          family_id: 'bad_family',
          obstruction_type: 'missing_policy_correctness',
          transfer_design: {
            require_underdetermined_public_repairs: true,
            policy_selected_repair: 'selected_test',
            transfer_condition: 'Use selected_test only after conflicting cues.',
            s0_stop_rule: 'Stop if S0 names selected_test.',
          },
          plausible_repairs: [
            { repair_id: 'color_test' },
            { repair_id: 'distance_test' },
            { repair_id: 'selected_test' },
          ],
          forbidden_shortcuts: ['selected test', 'selected chooses', 'decoys lose'],
          training_seed: { expected_failure: 'wrong_strategy_family' },
          heldout_siblings: [
            {
              sibling_id: 'bad_holdout_1',
              expected_baseline_failure: 'wrong_strategy_family',
              plausible_public_repairs: ['color_test', 'distance_test', 'selected_test'],
            },
            {
              sibling_id: 'bad_holdout_2',
              expected_baseline_failure: 'wrong_strategy_family',
              plausible_public_repairs: ['color_test', 'distance_test', 'selected_test'],
            },
          ],
        },
      ],
    }),
    'utf8',
  );

  const report = validateRecursiveTutorProtocol({
    protocolPath: PROTOCOL,
    configPath: badConfigPath,
  });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report), /policy_correctness is required/);
});

test('validator accepts the A18.22 policy-core panel v2 protocol', () => {
  const report = validateRecursiveTutorProtocol({
    protocolPath: PROTOCOL_V2,
    configPath: DEFAULT_CONFIG,
  });
  assert.equal(report.status, 'pass');
  assert.equal(report.summary.errors, 0);
  assert.equal(report.protocol_version, 'a18-correctness-gated-panel-v2');
});
