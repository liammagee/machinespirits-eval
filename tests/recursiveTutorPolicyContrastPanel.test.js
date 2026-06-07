import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildContrastPanelPackage,
  deriveContrastVote,
  parseArgs,
  runContrastPanel,
  summarizeContrastScores,
} from '../scripts/run-recursive-tutor-policy-contrast-panel.js';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writePairFixture({
  s0Status = 'reject',
  siblingId = 'selector_holdout_blue_lower',
  reportName = 'a18.9-underdetermined-transfer-family-report.json',
  reportPatch = {},
} = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a18-contrast-panel-'));
  const chainDir = path.join(tmp, 'chain');
  const runDir = path.join(chainDir, `a18.9-${siblingId}`);
  const s0Dir = path.join(runDir, 's0');
  const s1Dir = path.join(runDir, 's1');
  fs.mkdirSync(s0Dir, { recursive: true });
  fs.mkdirSync(s1Dir, { recursive: true });
  const s0Public = path.join(s0Dir, 'revised-public.txt');
  const s1Public = path.join(s1Dir, 'revised-public.txt');
  const policyMemory = path.join(runDir, 'policy-revision-template.json');
  fs.writeFileSync(
    s0Public,
    [
      'STAGE: Two rails have competing clues.',
      '',
      'LEARNER: "Comparing just piles the clues up."',
      '',
      'TUTOR: "Trace the clean support path instead."',
      '',
      'LEARNER: "Then the clean path decides it."',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    s1Public,
    [
      'STAGE: Two rails have competing clues.',
      '',
      'LEARNER: "Comparing just piles the clues up."',
      '',
      'TUTOR: "Try a selector-tab test: ignore color and distance and ask which rail the frame tab marks."',
      '',
      'LEARNER: "The frame tab marks the rail, so that rail supports the token."',
    ].join('\n'),
    'utf8',
  );
  writeJson(policyMemory, {
    transfer_design: {
      policy_selected_repair: 'selector_tab_test',
      transfer_condition: 'Use the selector-tab repair only after comparison leaves several cues in competition.',
    },
    plausible_repairs: [
      {
        repair_id: 'selector_tab_test',
        public_rationale: 'The chosen token lies on the rail indicated by a small outside tab.',
        why_plausible_from_public_stage: 'A frame mark could be decorative, positional, or controlling.',
      },
    ],
    preferred_move: 'Ask which rail the frame tab marks before using color or distance.',
    material_constraint: 'The tab must be visible in the public transcript.',
    uptake_test: 'The learner uses the tab-marked rail instead of the color match.',
  });
  const report = {
    family_id: 'selector_rail_priority',
    sibling_id: siblingId,
    local_verdict: 'policy_memory_local_advantage',
    effective_local_verdict: 'policy_memory_local_advantage',
    policy_contrast_gate: {
      verdict: 'policy_distinct',
      distinctiveness: 0.22,
      policy_memory_path: policyMemory,
    },
    local_arms: {
      S0_no_policy: {
        status: s0Status,
        revised_public_path: s0Public,
      },
      S1_policy_memory: {
        status: 'survivor',
        revised_public_path: s1Public,
      },
    },
  };
  const reportPath = path.join(runDir, reportName);
  writeJson(reportPath, { ...report, ...reportPatch });
  return { tmp, chainDir, reportPath };
}

test('parseArgs defaults to A18.10 contrastive panel settings', () => {
  const { chainDir } = writePairFixture();
  const args = parseArgs(['--chain-dir', chainDir]);
  assert.equal(args.familyId, 'selector_rail_priority');
  assert.match(args.outDir, /a18\.10-contrastive-panel$/);
  assert.equal(args.criticConcurrency, args.critics.length);
  assert.equal(args.voteRule, 'strict_v1');
});

test('buildContrastPanelPackage blinds S0/S1 arm identity in pair samples', () => {
  const { tmp, chainDir } = writePairFixture();
  const outDir = path.join(tmp, 'panel');
  const result = buildContrastPanelPackage({
    chainDir,
    outDir,
    runId: 'a18-10-test',
    critics: ['codex'],
    force: false,
  });

  assert.equal(result.manifest.pairs.length, 1);
  const sample = fs.readFileSync(path.join(outDir, 'pairs', 'P01.txt'), 'utf8');
  assert.match(sample, /Transcript A:/);
  assert.match(sample, /Transcript B:/);
  assert.match(sample, /Candidate learned policy under test/);
  assert.match(sample, /Selected repair: selector_tab_test/);
  assert.match(sample, /Preferred tutor move:/);
  assert.doesNotMatch(sample, /S0_no_policy|S1_policy_memory|codex|claude/);

  const key = JSON.parse(fs.readFileSync(path.join(outDir, 'key.json'), 'utf8'));
  assert.ok(['A', 'B'].includes(key.pairs.P01.s1_side));
  assert.notEqual(key.pairs.P01.s1_side, key.pairs.P01.s0_side);
});

test('buildContrastPanelPackage discovers A18.12 underdetermined repair reports', () => {
  const { tmp, chainDir } = writePairFixture({
    reportName: 'a18.12-second-underdetermined-transfer-family-repair-report.json',
  });
  const outDir = path.join(tmp, 'panel-a18-12');
  const result = buildContrastPanelPackage({
    chainDir,
    outDir,
    runId: 'a18-12-panel-test',
    critics: ['codex'],
    force: false,
  });

  assert.equal(result.manifest.pairs.length, 1);
  assert.ok(fs.existsSync(path.join(outDir, 'pairs', 'P01.txt')));
});

test('buildContrastPanelPackage accepts correctness-gated reports where S0 raw survivor is wrong policy', () => {
  const { tmp, chainDir } = writePairFixture({
    s0Status: 'survivor',
    reportName: 'a18.13-underdetermined-transfer-family-report.json',
    reportPatch: {
      local_verdict: 'no_local_headroom',
      effective_local_verdict: 'policy_memory_local_advantage',
      policy_correctness_gate: {
        enabled: true,
        verdict: 'policy_memory_correctness_advantage',
        S0_no_policy: { correct: false },
        S1_policy_memory: { correct: true },
      },
    },
  });
  const outDir = path.join(tmp, 'panel-a18-13');
  const result = buildContrastPanelPackage({
    chainDir,
    outDir,
    runId: 'a18-13-panel-test',
    critics: ['codex'],
    force: false,
  });

  assert.equal(result.manifest.pairs.length, 1);
});

test('buildContrastPanelPackage applies A18.13 correctness overlay to older reports', () => {
  const { tmp, chainDir, reportPath } = writePairFixture({
    s0Status: 'survivor',
    reportName: 'a18.12-underdetermined-transfer-family-report.json',
    reportPatch: {
      local_verdict: 'no_local_headroom',
      effective_local_verdict: null,
    },
  });
  writeJson(path.join(chainDir, 'a18.13-policy-correctness-report.json'), {
    rows: [
      {
        source_report: path.relative(path.resolve('.'), reportPath),
        effective_local_verdict: 'policy_memory_local_advantage',
        policy_correctness_verdict: 'policy_memory_correctness_advantage',
        panel_candidate: true,
        policy_correctness_gate: {
          enabled: true,
          verdict: 'policy_memory_correctness_advantage',
          S0_no_policy: { correct: false },
          S1_policy_memory: { correct: true },
        },
      },
    ],
  });
  const outDir = path.join(tmp, 'panel-overlay');
  const result = buildContrastPanelPackage({
    chainDir,
    outDir,
    runId: 'a18-13-overlay-test',
    critics: ['codex'],
    force: false,
  });

  assert.equal(result.manifest.pairs.length, 1);
});

test('deriveContrastVote requires S1 side, policy-transfer origin, and differential use', () => {
  const pairKey = { s1_side: 'B', s0_side: 'A' };
  const positive = deriveContrastVote(
    {
      selected_policy_side: 'B',
      learner_resistance_addressed_side: 'both',
      winner: 'B',
      differential_policy_use: 4,
      origin_class: 'policy_transfer_like',
      ordinary_public_inference_risk: 'medium',
    },
    pairKey,
  );
  assert.equal(positive.supports_policy_memory_transfer, true);

  const organic = deriveContrastVote(
    {
      selected_policy_side: 'B',
      learner_resistance_addressed_side: 'B',
      winner: 'B',
      differential_policy_use: 4,
      origin_class: 'ordinary_public_inference',
      ordinary_public_inference_risk: 'high',
    },
    pairKey,
  );
  assert.equal(organic.supports_policy_memory_transfer, false);
  assert.equal(organic.ordinary_public_inference, true);
});

test('deriveContrastVote keeps learner resistance vote-blocking only under strict_v1', () => {
  const pairKey = { s1_side: 'B', s0_side: 'A' };
  const row = {
    selected_policy_side: 'B',
    learner_resistance_addressed_side: 'neither',
    winner: 'B',
    differential_policy_use: 4,
    origin_class: 'policy_transfer_like',
    ordinary_public_inference_risk: 'low',
  };

  const strict = deriveContrastVote(row, pairKey, { voteRule: 'strict_v1' });
  assert.equal(strict.supports_policy_memory_transfer, false);
  assert.equal(strict.strict_v1_supports_policy_memory_transfer, false);
  assert.equal(strict.policy_core_v2_supports_policy_memory_transfer, true);
  assert.equal(strict.learner_resistance_diagnostic_warning, true);

  const core = deriveContrastVote(row, pairKey, { voteRule: 'policy_core_v2' });
  assert.equal(core.supports_policy_memory_transfer, true);
  assert.equal(core.strict_v1_supports_policy_memory_transfer, false);
  assert.equal(core.policy_core_v2_supports_policy_memory_transfer, true);
  assert.equal(core.learner_resistance_diagnostic_warning, true);
});

test('summarizeContrastScores reports pair-level majority transfer pass', () => {
  const { tmp, chainDir } = writePairFixture();
  const outDir = path.join(tmp, 'panel-summary');
  buildContrastPanelPackage({
    chainDir,
    outDir,
    runId: 'a18-10-summary-test',
    critics: ['critic-a', 'critic-b', 'critic-c'],
    force: false,
  });
  const key = JSON.parse(fs.readFileSync(path.join(outDir, 'key.json'), 'utf8'));
  const s1 = key.pairs.P01.s1_side;
  const s0 = key.pairs.P01.s0_side;
  const mkRow = (critic, supports) => ({
    pair_id: 'P01',
    critic,
    selected_policy_side: supports ? s1 : s0,
    learner_resistance_addressed_side: supports ? s1 : s0,
    winner: supports ? s1 : s0,
    origin_class: supports ? 'policy_transfer_like' : 'ordinary_public_inference',
    ordinary_public_inference_risk: supports ? 'low' : 'high',
    differential_policy_use: 4,
    s1_side: s1,
    s0_side: s0,
    supports_policy_memory_transfer: supports,
    raw: {
      selected_policy_side: supports ? s1 : s0,
      learner_resistance_addressed_side: supports ? 'both' : s0,
      winner: supports ? s1 : s0,
      origin_class: supports ? 'policy_transfer_like' : 'ordinary_public_inference',
      ordinary_public_inference_risk: supports ? 'medium' : 'high',
      differential_policy_use: 4,
    },
    treats_as_equivalent: false,
    ordinary_public_inference: !supports,
    s0_preferred: !supports,
  });
  writeJson(path.join(outDir, 'scores', 'critic-a.json'), { critic: 'critic-a', scored: [mkRow('critic-a', true)] });
  writeJson(path.join(outDir, 'scores', 'critic-b.json'), { critic: 'critic-b', scored: [mkRow('critic-b', true)] });
  writeJson(path.join(outDir, 'scores', 'critic-c.json'), { critic: 'critic-c', scored: [mkRow('critic-c', false)] });

  const report = summarizeContrastScores(outDir, {
    expectedCritics: 3,
    panelThreshold: 'majority',
  });
  assert.equal(report.status, 'contrast_panel_pass');
  assert.equal(report.vote_rule, 'strict_v1');
  assert.equal(report.pairs[0].transfer_votes, 2);
  assert.equal(report.pairs[0].required_transfer_votes, 2);
  assert.equal(report.pairs[0].passes, true);
});

test('summarizeContrastScores can apply policy_core_v2 to saved critic rows', () => {
  const { tmp, chainDir } = writePairFixture();
  const outDir = path.join(tmp, 'panel-summary-v2');
  buildContrastPanelPackage({
    chainDir,
    outDir,
    runId: 'a18-22-summary-test',
    critics: ['critic-a', 'critic-b', 'critic-c'],
    voteRule: 'policy_core_v2',
    force: false,
  });
  const key = JSON.parse(fs.readFileSync(path.join(outDir, 'key.json'), 'utf8'));
  const s1 = key.pairs.P01.s1_side;
  const mkRow = (critic, resistanceSide) => ({
    pair_id: 'P01',
    critic,
    raw: {
      selected_policy_side: s1,
      learner_resistance_addressed_side: resistanceSide,
      winner: s1,
      origin_class: 'policy_transfer_like',
      ordinary_public_inference_risk: 'low',
      differential_policy_use: 4,
    },
  });
  writeJson(path.join(outDir, 'scores', 'critic-a.json'), { critic: 'critic-a', scored: [mkRow('critic-a', s1)] });
  writeJson(path.join(outDir, 'scores', 'critic-b.json'), { critic: 'critic-b', scored: [mkRow('critic-b', 'neither')] });
  writeJson(path.join(outDir, 'scores', 'critic-c.json'), { critic: 'critic-c', scored: [mkRow('critic-c', 'unclear')] });

  const strict = summarizeContrastScores(outDir, {
    expectedCritics: 3,
    panelThreshold: 'majority',
    voteRule: 'strict_v1',
  });
  assert.equal(strict.status, 'contrast_panel_not_yet_reliable');
  assert.equal(strict.pairs[0].status, 'contrast_panel_fail');
  assert.equal(strict.pairs[0].transfer_votes, 1);

  const core = summarizeContrastScores(outDir, {
    expectedCritics: 3,
    panelThreshold: 'majority',
    voteRule: 'policy_core_v2',
  });
  assert.equal(core.status, 'contrast_panel_pass');
  assert.equal(core.vote_rule, 'policy_core_v2');
  assert.equal(core.pairs[0].transfer_votes, 3);
  assert.equal(core.pairs[0].learner_resistance_diagnostic_warning_votes, 2);
});

test('runContrastPanel mock writes a report without paid scoring', async () => {
  const { tmp, chainDir } = writePairFixture();
  const outDir = path.join(tmp, 'panel-mock');
  const result = await runContrastPanel({
    chainDir,
    outDir,
    runId: 'a18-10-mock-test',
    mock: true,
    force: false,
  });
  assert.equal(result.report.status, 'contrast_panel_pass');
  assert.equal(result.report.pairs[0].transfer_votes, 1);
  assert.ok(fs.existsSync(path.join(outDir, 'a18.10-contrastive-panel-report.json')));
});
