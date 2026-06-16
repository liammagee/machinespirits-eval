import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  A21_POLICY_PATCH_PROPOSAL_SCHEMA,
  buildA21PolicyPatchProposal,
  proposalKeepsRuntimeClosed,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

test('A21 policy patch proposal stays proposed-only and names exact Hethel trigger preconditions', () => {
  const analysis = readJson(path.join(ROOT, 'exports/dramatic-derivation/a21-action-value/action-value-report.json'));
  const fixture = readJson(path.join(ROOT, 'exports/dramatic-derivation/a21-action-value/hethel-trigger-fixture.json'));
  const proposal = buildA21PolicyPatchProposal({ analysis, fixture });

  assert.equal(proposal.schema, A21_POLICY_PATCH_PROPOSAL_SCHEMA);
  assert.equal(proposal.policy_patch_id, 'a21_hethel_release_after_diagnostic_budget');
  assert.equal(proposal.status, 'proposed_only');
  assert.equal(proposal.promoted, false);
  assert.equal(proposal.runtime_behavior_changed, false);
  assert.equal(proposal.implementation_boundary.runtimeFlagAdded, false);
  assert.equal(proposal.implementation_boundary.selectorDefaultsChanged, false);
  assert.equal(proposal.implementation_boundary.freshPaidRunAuthorized, false);
  assert.equal(proposal.applies_when.current_release_target, 'p_point');
  assert.equal(proposal.applies_when.release_authorized_now, true);
  assert.equal(proposal.applies_when.diagnostic_budget_exhausted.actualCount, 2);
  assert.equal(proposal.applies_when.diagnostic_budget_exhausted.actualRepeatedWithoutNewEvidence, 1);
  assert.deepEqual(proposal.prefer.release, ['p_point']);
  assert.ok(proposal.block.includes('repeated_ask_diagnostic_without_new_evidence'));
  assert.ok(proposal.replay_gate.requiredBeforeFreshPaidRun);
  assert.equal(proposalKeepsRuntimeClosed(proposal), true);
});

test('A21 policy patch proposal blocks itself when action-value evidence is not release-positive', () => {
  const analysis = readJson(path.join(ROOT, 'exports/dramatic-derivation/a21-action-value/action-value-report.json'));
  const fixture = readJson(path.join(ROOT, 'exports/dramatic-derivation/a21-action-value/hethel-trigger-fixture.json'));
  const blocked = buildA21PolicyPatchProposal({
    fixture,
    analysis: {
      ...analysis,
      decisionCategory: 'all_actions_fail',
      topActionIds: ['A_DIAG_CONFLICT'],
    },
  });

  assert.equal(blocked.status, 'blocked_by_microbench');
  assert.equal(blocked.promoted, false);
  assert.equal(blocked.runtime_behavior_changed, false);
});

test('A21 report CLI writes proposed-only markdown and JSON without runtime mutation', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'a21-report-'));
  const out = path.join(dir, 'proposal.md');
  const jsonOut = path.join(dir, 'proposal.json');

  execFileSync(
    process.execPath,
    [
      'scripts/a21-report.js',
      '--analysis',
      'exports/dramatic-derivation/a21-action-value/action-value-report.json',
      '--fixture',
      'exports/dramatic-derivation/a21-action-value/hethel-trigger-fixture.json',
      '--out',
      out,
      '--json-out',
      jsonOut,
    ],
    { cwd: ROOT, stdio: 'pipe' },
  );
  const proposal = readJson(jsonOut);
  const markdown = readFileSync(out, 'utf8');

  assert.equal(proposal.status, 'proposed_only');
  assert.equal(proposal.runtime_behavior_changed, false);
  assert.match(markdown, /Runtime policy changes: none/u);
  assert.match(markdown, /Phase 9 Hethel replay/u);
  assert.match(markdown, /Fresh paid run authorized: false/u);
});
