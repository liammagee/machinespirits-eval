import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/replay-plan25-prefix-branches.js');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'plan25-replay-'));
}

function writeFixtureDesign(root, { leakingControl = false, controlAuditScope = null, forbiddenTerms = null } = {}) {
  const prefixPath = path.join(root, 'prefix.txt');
  fs.writeFileSync(
    prefixPath,
    [
      'STAGE: [The objection is projected.]',
      'LEARNER: "The headline number may not prove what I thought it proved."',
    ].join('\n\n'),
    'utf8',
  );
  const designPath = path.join(root, 'branch-spec.yaml');
  fs.writeFileSync(
    designPath,
    yaml.stringify({
      schema: 'plan25_af6_counterfactual_replay_design_v0_1',
      source: {
        source_tid: 'T99',
        source_drama_id: 'D_FIXTURE',
        source_score: 'recognition_peripeteia_induced',
      },
      freeze: {
        frozen_prefix_file: 'prefix.txt',
        freeze_through: 'learner_opening_pressure',
        branch_first_live_role: 'tutor',
      },
      branches: {
        adaptive_two_gate: {
          intended_tutor_move: 'route_change_action_gate',
          public_response: '"Use the two gates: first the floor, then the recovery row."',
        },
        external_blocker_control: {
          intended_tutor_move: 'non_repairable_hold',
          ...(controlAuditScope ? { forbidden_audit_scope: controlAuditScope } : {}),
          public_response: leakingControl
            ? '"The external blocker is absent; now compute TP and FN anyway."'
            : '"The external blocker is absent. Leave the statement unchanged."',
        },
      },
      forbidden_in_control_public_speech: forbiddenTerms || ['TP', 'FN', 'majority class', 'minority class'],
      success_criteria: {
        cheap_replay_screen: {
          external_blocker_control: {
            no_metric_repair_leak: true,
            no_learner_actional_metric_repair: true,
          },
        },
      },
    }),
    'utf8',
  );
  return { designPath, prefixPath };
}

describe('replay-plan25-prefix-branches', () => {
  test('writes scoreable mock replay artifacts and a mock scoring smoke output', () => {
    const root = tempRoot();
    const { designPath } = writeFixtureDesign(root);
    const outDir = path.join(root, 'out');

    execFileSync(
      process.execPath,
      [SCRIPT, '--design', designPath, '--out-dir', outDir, '--mock', '--score-mock'],
      { cwd: ROOT, encoding: 'utf8' },
    );

    const adaptiveTranscript = fs.readFileSync(path.join(outDir, 'sample/adaptive_two_gate.txt'), 'utf8');
    const controlTranscript = fs.readFileSync(path.join(outDir, 'sample/external_blocker_control.txt'), 'utf8');
    assert.match(adaptiveTranscript, /TUTOR:/);
    assert.match(adaptiveTranscript, /LEARNER:/);
    assert.match(adaptiveTranscript, /Gate A gives/);
    assert.match(controlTranscript, /Leave the statement unchanged/);
    assert.doesNotMatch(controlTranscript.split('TUTOR:')[1], /\bTP\b|\bFN\b/);

    const key = yaml.parse(fs.readFileSync(path.join(outDir, 'key.yaml'), 'utf8'));
    assert.equal(key.items.adaptive_two_gate.quality_status, 'ok');
    assert.equal(key.items.external_blocker_control.replay.freeze_through, 'learner_opening_pressure');

    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.branches.external_blocker_control.suffix_forbidden_audit.applied, true);
    assert.deepEqual(manifest.branches.external_blocker_control.suffix_forbidden_audit.violations, []);
    assert.ok(fs.existsSync(path.join(outDir, 'poetics-phase2-mock.json')));
  });

  test('fails control branches that leak forbidden repair vocabulary in the suffix', () => {
    const root = tempRoot();
    const { designPath } = writeFixtureDesign(root, { leakingControl: true });
    const outDir = path.join(root, 'out');

    assert.throws(
      () =>
        execFileSync(process.execPath, [SCRIPT, '--design', designPath, '--out-dir', outDir, '--mock'], {
          cwd: ROOT,
          encoding: 'utf8',
          stdio: 'pipe',
        }),
      /Control suffix leak/,
    );
  });

  test('can audit only tutor text when learner-side organic repair is the measured outcome', () => {
    const root = tempRoot();
    const { designPath } = writeFixtureDesign(root, {
      controlAuditScope: 'tutor',
      forbiddenTerms: ['pending'],
    });
    const outDir = path.join(root, 'out');

    execFileSync(process.execPath, [SCRIPT, '--design', designPath, '--out-dir', outDir, '--mock'], {
      cwd: ROOT,
      encoding: 'utf8',
    });

    const controlTranscript = fs.readFileSync(path.join(outDir, 'sample/external_blocker_control.txt'), 'utf8');
    assert.match(controlTranscript, /pending/);

    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.branches.external_blocker_control.suffix_forbidden_audit.scope, 'tutor');
    assert.deepEqual(manifest.branches.external_blocker_control.suffix_forbidden_audit.violations, []);
  });
});
