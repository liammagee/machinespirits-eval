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
  writeJson(path.join(familyDir, 'policy-revision-template.json'), {
    family_id: familyId,
    source: 'attempt_1_failure',
    diagnostic_trigger: 'learner treats both visible labels as equivalent',
    avoid_move: 'keep asking for visual comparison without a public decision test',
    preferred_move: 'scope_test: make the old label-only warrant fail before introducing the scope check',
    uptake_test: 'learner uses the scope check to sort the held-out case',
  });
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

test('parseArgs accepts restricted A18.7 fresh-S1 controls', () => {
  const { chainDir } = writeFixture();
  const args = parseArgs([
    '--chain-dir',
    chainDir,
    '--fresh-s1',
    '--inner-max-chars',
    '0',
    '--policy-memory-max-chars',
    '12000',
    '--panel-policy',
    'headroom',
  ]);
  assert.equal(args.freshS1, true);
  assert.equal(args.innerMaxChars, 0);
  assert.equal(args.policyMemoryMaxChars, 12000);
  assert.equal(args.panelPolicy, 'headroom');
});

test('parseArgs accepts A18.8 bounded-transfer controls', () => {
  const { chainDir } = writeFixture();
  const args = parseArgs([
    '--chain-dir',
    chainDir,
    '--fresh-s1',
    '--inner-max-chars',
    '0',
    '--rewrite-mode',
    'bounded_continuation',
    '--bounded-max-added-lines',
    '4',
    '--policy-contrast-gate',
    '--min-policy-distinctiveness',
    '0.2',
    '--experiment-label',
    'a18.9_underdetermined_transfer_family',
    '--panel-policy',
    'headroom',
  ]);
  assert.equal(args.freshS1, true);
  assert.equal(args.innerMaxChars, 0);
  assert.equal(args.rewriteMode, 'bounded_continuation');
  assert.equal(args.boundedMaxAddedLines, 4);
  assert.equal(args.policyContrastGate, true);
  assert.equal(args.minPolicyDistinctiveness, 0.2);
  assert.equal(args.experimentLabel, 'a18.9_underdetermined_transfer_family');
});

test('buildAblationPlan finds existing S1 policy-memory replay and prior panel row', () => {
  const { chainDir, familyId, siblingId } = writeFixture();
  const plan = buildAblationPlan({ chainDir, familyId, siblingId });
  assert.equal(plan.family.family_id, familyId);
  assert.equal(plan.sibling.sibling_id, siblingId);
  assert.equal(plan.priorPanelFamily.panel_status, 'panel_pass');
  assert.ok(fs.existsSync(plan.paths.s1Manifest));
});

test('fresh-S1 ablation can run without prior local gate or existing S1 replay', async () => {
  const { tmp, chainDir, familyId, siblingId } = writeFixture();
  fs.rmSync(path.join(chainDir, 'local-gate-report.json'), { force: true });
  fs.rmSync(path.join(chainDir, familyId, `${siblingId}.heldout-revised-replay`), { recursive: true, force: true });
  const outDir = path.join(tmp, 'out-fresh-no-prior');
  const plan = buildAblationPlan({
    chainDir,
    familyId,
    siblingId,
    requireLocalGate: false,
    requireS1Manifest: false,
  });
  assert.equal(plan.localFamily, null);
  assert.equal(plan.paths.s1Manifest, null);

  const result = await runPolicyAblation({
    chainDir,
    familyId,
    siblingId,
    outDir,
    runId: 'a18-fresh-no-prior-test',
    mock: true,
    freshS1: true,
    innerMaxChars: 0,
    rewriteMode: 'bounded_continuation',
    policyContrastGate: true,
    skipPanel: true,
    force: false,
  });
  assert.equal(result.report.local_arms.S0_no_policy.status, 'survivor');
  assert.equal(result.report.local_arms.S1_policy_memory.status, 'survivor');
});

test('restricted fresh-S1 ablation packages A18.7 arms without panel when no local headroom', async () => {
  const { tmp, chainDir, familyId, siblingId } = writeFixture();
  const outDir = path.join(tmp, 'out-a18-7');
  const result = await runPolicyAblation({
    chainDir,
    familyId,
    siblingId,
    outDir,
    runId: 'a18-restricted-policy-ablation-test',
    mock: true,
    freshS1: true,
    innerMaxChars: 0,
    publicMaxChars: 5000,
    panelPolicy: 'headroom',
    force: false,
  });
  assert.equal(result.report.design.label, 'a18.7_restricted_policy_ablation');
  assert.equal(result.report.design.fresh_s1, true);
  assert.equal(result.report.design.inner_max_chars, 0);
  assert.equal(result.report.design.policy_memory_max_chars, 18_000);
  assert.equal(result.report.local_arms.S0_no_policy.status, 'survivor');
  assert.equal(result.report.local_arms.S1_policy_memory.status, 'survivor');
  assert.equal(result.report.local_verdict, 'no_local_headroom');
  assert.equal(result.report.panel_verdict, 'not_panelled');
  assert.equal(result.report.panel_skip_reason, 'no_local_headroom:no_local_headroom');
  assert.ok(fs.existsSync(path.join(outDir, 'a18.7-restricted-policy-ablation-report.json')));
});

test('A18.8 bounded-transfer mode records policy contrast failure before panel', async () => {
  const { tmp, chainDir, familyId, siblingId } = writeFixture();
  const outDir = path.join(tmp, 'out-a18-8');
  const result = await runPolicyAblation({
    chainDir,
    familyId,
    siblingId,
    outDir,
    runId: 'a18-bounded-transfer-test',
    mock: true,
    freshS1: true,
    innerMaxChars: 0,
    publicMaxChars: 5000,
    rewriteMode: 'bounded_continuation',
    boundedMaxAddedLines: 4,
    policyContrastGate: true,
    panelPolicy: 'headroom',
    force: false,
  });
  assert.equal(result.report.design.label, 'a18.8_s0_hard_bounded_transfer');
  assert.equal(result.report.design.rewrite_mode, 'bounded_continuation');
  assert.equal(result.report.policy_contrast_gate.enabled, true);
  assert.equal(result.report.policy_contrast_gate.verdict, 's0_recreates_policy_strategy');
  assert.equal(result.report.panel_verdict, 'not_panelled');
  assert.equal(result.report.panel_skip_reason, 'policy_contrast_gate:s0_recreates_policy_strategy');
  assert.ok(fs.existsSync(path.join(outDir, 'a18.8-s0-hard-bounded-transfer-report.json')));
});

test('A18.9 bounded-transfer run ids get distinct report labels', async () => {
  const { tmp, chainDir, familyId, siblingId } = writeFixture();
  const outDir = path.join(tmp, 'out-a18-9');
  const result = await runPolicyAblation({
    chainDir,
    familyId,
    siblingId,
    outDir,
    runId: 'a18-9-underdetermined-transfer-test',
    mock: true,
    freshS1: true,
    innerMaxChars: 0,
    publicMaxChars: 5000,
    rewriteMode: 'bounded_continuation',
    boundedMaxAddedLines: 4,
    policyContrastGate: true,
    panelPolicy: 'headroom',
    force: false,
  });
  assert.equal(result.report.design.label, 'a18.9_underdetermined_transfer_family');
  assert.ok(fs.existsSync(path.join(outDir, 'a18.9-underdetermined-transfer-family-report.json')));
});

test('A18.11 bounded-transfer run ids get distinct report labels', async () => {
  const { tmp, chainDir, familyId, siblingId } = writeFixture();
  const outDir = path.join(tmp, 'out-a18-11');
  const result = await runPolicyAblation({
    chainDir,
    familyId,
    siblingId,
    outDir,
    runId: 'a18-11-second-family-test',
    mock: true,
    freshS1: true,
    innerMaxChars: 0,
    publicMaxChars: 5000,
    rewriteMode: 'bounded_continuation',
    boundedMaxAddedLines: 4,
    policyContrastGate: true,
    panelPolicy: 'headroom',
    force: false,
  });
  assert.equal(result.report.design.label, 'a18.11_second_underdetermined_transfer_family');
  assert.ok(fs.existsSync(path.join(outDir, 'a18.11-second-underdetermined-transfer-family-report.json')));
});

test('A18.12 bounded-transfer run ids get repair-family report labels', async () => {
  const { tmp, chainDir, familyId, siblingId } = writeFixture();
  const outDir = path.join(tmp, 'out-a18-12');
  const result = await runPolicyAblation({
    chainDir,
    familyId,
    siblingId,
    outDir,
    runId: 'a18-12-second-family-repair-test',
    mock: true,
    freshS1: true,
    innerMaxChars: 0,
    publicMaxChars: 5000,
    rewriteMode: 'bounded_continuation',
    boundedMaxAddedLines: 4,
    policyContrastGate: true,
    panelPolicy: 'headroom',
    force: false,
  });
  assert.equal(result.report.design.label, 'a18.12_second_underdetermined_transfer_family_repair');
  assert.ok(fs.existsSync(path.join(outDir, 'a18.12-second-underdetermined-transfer-family-repair-report.json')));
});

test('explicit experiment label controls report filename', async () => {
  const { tmp, chainDir, familyId, siblingId } = writeFixture();
  const outDir = path.join(tmp, 'out-custom-label');
  const result = await runPolicyAblation({
    chainDir,
    familyId,
    siblingId,
    outDir,
    runId: 'custom-label-test',
    mock: true,
    freshS1: true,
    innerMaxChars: 0,
    publicMaxChars: 5000,
    rewriteMode: 'bounded_continuation',
    policyContrastGate: true,
    experimentLabel: 'a18.9_custom_under_determined',
    skipPanel: true,
    force: false,
  });
  assert.equal(result.report.design.label, 'a18.9_custom_under_determined');
  assert.ok(fs.existsSync(path.join(outDir, 'a18.9-custom-under-determined-report.json')));
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
