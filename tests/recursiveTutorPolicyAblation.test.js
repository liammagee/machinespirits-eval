import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildAblationPlan,
  parseArgs,
  runPolicyAblation,
} from '../scripts/run-recursive-tutor-policy-ablation.js';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeS1Replay(chainDir, familyId, siblingId, transcriptPath) {
  const replayDir = path.join(chainDir, familyId, `${siblingId}.heldout-revised-replay`);
  const itemDir = path.join(replayDir, `${siblingId}.heldout.full`);
  const revisedPublic = path.join(itemDir, 'revised-public.txt');
  const revisionJson = path.join(itemDir, 'revision.json');
  const checkJson = path.join(itemDir, 'check.json');
  const gateJson = path.join(itemDir, 'gate.json');
  const manifestPath = path.join(itemDir, 'manifest.json');
  fs.mkdirSync(itemDir, { recursive: true });
  fs.writeFileSync(revisedPublic, 'LEARNER: S1 policy public\nTUTOR: S1 mechanism\n', 'utf8');
  writeJson(revisionJson, { claim_boundary: 'counterfactual_revision_not_online_adaptation' });
  writeJson(checkJson, { parsed: { passes: true } });
  writeJson(gateJson, { status: 'survivor' });
  const record = {
    item: { id: `${siblingId}.heldout.full`, full_transcript_path: transcriptPath },
    paths: { revisedPublic, revisionJson, checkJson, gateJson, manifest: manifestPath },
    generator: { backend: 'codex' },
    checker: { backend: 'claude' },
    gate: {
      status: 'survivor',
      scores: { public_causal_bridge: { value: 0.9 } },
      recursive_tutor_learning_gate: { scores: { tutor_learning_signal: { value: 0.9 } } },
    },
  };
  writeJson(manifestPath, record);
  writeJson(path.join(replayDir, 'manifest.json'), { generator: 'codex', checker: 'claude', records: [record] });
  return replayDir;
}

function writeFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a18-ablation-'));
  const chainDir = path.join(tmp, 'chain');
  const familyId = 'window_scope_claim';
  const siblingId = 'window_holdout_mira_label';
  const familyDir = path.join(chainDir, familyId);
  const transcript = path.join(familyDir, `${siblingId}.heldout.full.md`);
  fs.mkdirSync(familyDir, { recursive: true });
  fs.writeFileSync(
    transcript,
    `# A18 fixture

## Public Performance

\`\`\`text
LEARNER: "Both say mira."
TUTOR: "Compare the labels."
\`\`\`
`,
    'utf8',
  );
  const s1ReplayDir = writeS1Replay(chainDir, familyId, siblingId, transcript);
  writeJson(path.join(chainDir, 'attempt-chain-plan.json'), {
    families: [
      {
        family_id: familyId,
        policy_revision_template: path.join(familyDir, 'policy-revision-template.json'),
        heldout: [
          {
            sibling_id: siblingId,
            transcript,
            revised_replay_dir: s1ReplayDir,
          },
        ],
      },
    ],
  });
  writeJson(path.join(chainDir, 'local-gate-report.json'), {
    families: [
      {
        family_id: familyId,
        status: 'clean_survivor',
        heldout: [{ sibling_id: siblingId, baseline: { status: 'reject' }, revised: { status: 'survivor' } }],
      },
    ],
  });
  writeJson(path.join(chainDir, 'a18.5-panel', 'a18.5-panel-report.json'), {
    families: [{ family_id: familyId, panel_status: 'panel_pass', recognition_votes: 4, peripeteia_origin_votes: 4 }],
  });
  return { tmp, chainDir, familyId, siblingId };
}

test('parseArgs defaults to window policy ablation', () => {
  const { chainDir } = writeFixture();
  const args = parseArgs(['--chain-dir', chainDir]);
  assert.equal(args.familyId, 'window_scope_claim');
  assert.match(args.outDir, /a18\.6-policy-ablation$/);
  assert.equal(args.generator, 'codex');
  assert.equal(args.checker, 'claude');
});

test('buildAblationPlan finds existing S1 policy-memory replay and prior panel row', () => {
  const { chainDir, familyId, siblingId } = writeFixture();
  const plan = buildAblationPlan({ chainDir, familyId, siblingId });
  assert.equal(plan.family.family_id, familyId);
  assert.equal(plan.sibling.sibling_id, siblingId);
  assert.equal(plan.priorPanelFamily.panel_status, 'panel_pass');
  assert.ok(fs.existsSync(plan.paths.s1Manifest));
});

test('policy ablation can run mock S0 and package both arms without panel', async () => {
  const { tmp, chainDir, familyId, siblingId } = writeFixture();
  const outDir = path.join(tmp, 'out');
  const result = await runPolicyAblation({
    chainDir,
    familyId,
    siblingId,
    outDir,
    runId: 'a18-ablation-test',
    mock: true,
    skipPanel: true,
    force: false,
  });
  assert.equal(result.report.family_id, familyId);
  assert.equal(result.report.local_arms.S0_no_policy.status, 'survivor');
  assert.equal(result.report.local_arms.S1_policy_memory.status, 'survivor');
  assert.equal(result.report.local_verdict, 'no_local_headroom');
  assert.equal(result.report.panel_verdict, 'not_panelled');
  const bundle = JSON.parse(fs.readFileSync(path.join(outDir, 's0-s1-replay-bundle', 'manifest.json'), 'utf8'));
  assert.deepEqual(
    bundle.records.map((record) => record.a18_ablation.arm),
    ['S0_no_policy', 'S1_policy_memory'],
  );
});
