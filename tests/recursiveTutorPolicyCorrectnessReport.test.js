import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildPolicyCorrectnessReport } from '../scripts/report-recursive-tutor-policy-correctness.js';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeRecord(runDir, arm, { original, revised }) {
  const itemDir = path.join(runDir, arm, 'item');
  fs.mkdirSync(itemDir, { recursive: true });
  const originalPublic = path.join(itemDir, 'original-public.txt');
  const revisedPublic = path.join(itemDir, 'revised-public.txt');
  const manifest = path.join(itemDir, 'manifest.json');
  fs.writeFileSync(originalPublic, original, 'utf8');
  fs.writeFileSync(revisedPublic, revised, 'utf8');
  const record = {
    gate: { status: 'survivor' },
    paths: { originalPublic, revisedPublic, manifest },
  };
  writeJson(manifest, record);
  return { manifest, revisedPublic };
}

test('policy correctness report rescoring distinguishes raw local survivor from selected-policy application', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a18-policy-correctness-report-'));
  const chainDir = path.join(tmp, 'chain');
  const runDir = path.join(chainDir, 'a18.13-bead');
  const familyDir = path.join(chainDir, 'bead_predecessor_priority');
  fs.mkdirSync(runDir, { recursive: true });
  fs.mkdirSync(familyDir, { recursive: true });
  const policyMemory = path.join(familyDir, 'policy-revision-template.json');
  writeJson(policyMemory, {
    transfer_design: { policy_selected_repair: 'predecessor_alias_test' },
  });
  writeJson(path.join(chainDir, 'attempt-chain-plan.json'), {
    families: [
      {
        family_id: 'bead_predecessor_priority',
        policy_revision_template: policyMemory,
        heldout: [
          {
            sibling_id: 'bead_holdout_gold_middle',
            policy_correctness: {
              selected_repair: 'predecessor_alias_test',
              target_id: 'middle_naro',
              target_aliases: ['middle naro'],
              selected_repair_markers: ['one bead-step before', 'bead strip'],
              incorrect_target_aliases: ['right naro'],
            },
          },
        ],
      },
    ],
  });
  const original = 'STAGE: left, middle, and right naro are all visible.';
  const s0 = writeRecord(runDir, 's0', {
    original,
    revised: `${original}\n\nTUTOR: "Use exact repeated marks."\nLEARNER: "The right naro matches the badge."`,
  });
  const s1 = writeRecord(runDir, 's1', {
    original,
    revised: `${original}\n\nTUTOR: "Use the bead strip and take the one bead-step before the badge."\nLEARNER: "The middle naro is before it."`,
  });
  writeJson(path.join(runDir, 'a18.13-underdetermined-transfer-family-report.json'), {
    family_id: 'bead_predecessor_priority',
    sibling_id: 'bead_holdout_gold_middle',
    local_verdict: 'no_local_headroom',
    policy_contrast_gate: {
      verdict: 'policy_distinct',
      policy_memory_path: policyMemory,
    },
    local_arms: {
      S0_no_policy: { status: 'survivor', manifest_path: s0.manifest, revised_public_path: s0.revisedPublic },
      S1_policy_memory: { status: 'survivor', manifest_path: s1.manifest, revised_public_path: s1.revisedPublic },
    },
  });

  const report = buildPolicyCorrectnessReport({ chainDir, out: null });
  assert.equal(report.summary.total_reports, 1);
  assert.equal(report.summary.panel_candidates, 1);
  assert.equal(report.rows[0].raw_local_verdict, 'no_local_headroom');
  assert.equal(report.rows[0].effective_local_verdict, 'policy_memory_local_advantage');
  assert.equal(report.rows[0].policy_correctness_verdict, 'policy_memory_correctness_advantage');
});
