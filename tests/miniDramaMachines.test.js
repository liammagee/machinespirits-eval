import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  DEFAULT_A18_A19_RHETORICAL_BATTERY,
  DEFAULT_SELECTOR_RAIL_COLLISION_FANOUT,
  DEFAULT_SELECTOR_RAIL_REDIRECT_FANOUT,
  DEFAULT_SELECTOR_RAIL_TRANSFER_FANOUT,
  adjudicateMiniDramaCoderPacket,
  applyMiniDramaPrivateKey,
  buildMiniDramaPacket,
  generateMiniDramaRun,
  selectMiniDramaMovesForCard,
  loadMiniDramaCards,
  loadMiniDramaCodebook,
  loadMiniDramaOntology,
  qaMiniDramaRun,
  runMiniDramaBatteryScreen,
  summarizeMiniDramaAutomatedAdjudications,
  summarizeMiniDramaBatteryScreen,
  validateMiniDramaCodebook,
} from '../services/miniDramaMachines.js';
import { adjudicateA19RMiniDramaPackets } from '../scripts/adjudicate-a19r-mini-drama.js';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function makeRun() {
  return generateMiniDramaRun({
    ontology: loadMiniDramaOntology(),
    cardPool: loadMiniDramaCards(),
    moveIds: ['stasis_hypophora_reset', 'peripeteia_error_spotting'],
    cardIds: ['fraction_wrong_problem_001'],
    runId: 'a19r-mini-drama-test',
    createdAt: '2026-06-08T00:00:00.000Z',
  });
}

test('mini-drama codebook covers the frozen v0.1 ontology labels', () => {
  const report = validateMiniDramaCodebook({
    ontology: loadMiniDramaOntology(),
    codebook: loadMiniDramaCodebook(),
  });
  assert.equal(report.status, 'pass');
});

test('mini-drama generator creates gated candidates without model calls', () => {
  const run = makeRun();
  assert.equal(run.candidates.length, 2);
  assert.equal(qaMiniDramaRun(run).status, 'pass');
  for (const candidate of run.candidates) {
    assert.equal(candidate.mini_drama.gates.status, 'pass');
    assert.equal(candidate.shadow_control.gates.status, 'pass');
    assert.ok(candidate.mini_drama.response.length > 0);
    assert.ok(candidate.shadow_control.response.length > 0);
  }
});

test('mini-drama battery screen reports deterministic proxy headroom only', () => {
  const screen = runMiniDramaBatteryScreen({
    ontology: loadMiniDramaOntology(),
    cardPool: loadMiniDramaCards(),
    moveIds: ['stasis_hypophora_reset', 'peripeteia_error_spotting'],
    cardIds: ['fraction_wrong_problem_001', 'decimal_place_value_001'],
    samplesPerCard: 1,
    seed: 'mini-drama-test-seed',
    runId: 'a19r-mini-drama-battery-test',
    createdAt: '2026-06-08T00:00:00.000Z',
  });
  const report = summarizeMiniDramaBatteryScreen(screen);
  assert.equal(report.gate_status, 'pass');
  assert.equal(report.card_count, 2);
  assert.equal(report.candidate_count, 2);
  assert.ok(
    report.interpretation_limits.includes(
      'automated/model adjudication is required before treating any candidate as real headroom',
    ),
  );
});

test('mini-drama heuristic selector is seeded and favors fit for A19-style cards', () => {
  const ontology = loadMiniDramaOntology();
  const battery = loadMiniDramaCards(DEFAULT_A18_A19_RHETORICAL_BATTERY);
  const card = battery.cards.find((entry) => entry.card_id === 'a19_productive_impasse_answer_leakage_a');
  const first = selectMiniDramaMovesForCard({ card, ontology, samplesPerCard: 2, seed: 'fixed-seed' });
  const second = selectMiniDramaMovesForCard({ card, ontology, samplesPerCard: 2, seed: 'fixed-seed' });
  assert.deepEqual(first, second);
  assert.equal(first.length, 2);
  assert.equal(first[0].move_id, 'enargeia_subgoal');
});

test('A18/A19 rhetorical battery screen summarizes proxy feasibility without claims', () => {
  const ontology = loadMiniDramaOntology();
  const battery = loadMiniDramaCards(DEFAULT_A18_A19_RHETORICAL_BATTERY);
  const screen = runMiniDramaBatteryScreen({
    ontology,
    cardPool: battery,
    samplesPerCard: 2,
    seed: 'battery-test-seed',
    createdAt: '2026-06-09T00:00:00.000Z',
  });
  const report = summarizeMiniDramaBatteryScreen(screen);
  assert.equal(screen.card_ids.length, 10);
  assert.equal(screen.candidates.length, 20);
  assert.equal(report.gate_status, 'pass');
  assert.equal(report.non_claims.includes('a19_transfer_claim'), true);
  assert.ok(report.proxy_headroom_rate > 0);
  assert.ok(
    ['feasible_for_blinded_packet_screen', 'borderline_needs_human_packet_screen'].includes(report.feasibility),
  );
});

test('selector-rail transfer fanout produces gated peripeteia candidates', () => {
  const ontology = loadMiniDramaOntology();
  const fanout = loadMiniDramaCards(DEFAULT_SELECTOR_RAIL_TRANSFER_FANOUT);
  const screen = runMiniDramaBatteryScreen({
    ontology,
    cardPool: fanout,
    moveIds: ['peripeteia_error_spotting'],
    samplesPerCard: 1,
    seed: 'selector-fanout-test',
    createdAt: '2026-06-09T00:00:00.000Z',
  });
  const report = summarizeMiniDramaBatteryScreen(screen);
  assert.equal(screen.card_ids.length, 6);
  assert.equal(screen.candidates.length, 6);
  assert.equal(report.gate_status, 'pass');
  assert.equal(new Set(screen.candidates.map((candidate) => candidate.move_id)).size, 1);
  assert.equal(
    screen.candidates.every((candidate) => candidate.move_id === 'peripeteia_error_spotting'),
    true,
  );
});

test('redesigned selector-rail fanout separates diagnostic lure baseline from neutral shadow', () => {
  const ontology = loadMiniDramaOntology();
  const fanout = loadMiniDramaCards(DEFAULT_SELECTOR_RAIL_REDIRECT_FANOUT);
  const screen = runMiniDramaBatteryScreen({
    ontology,
    cardPool: fanout,
    moveIds: ['peripeteia_error_spotting'],
    samplesPerCard: 1,
    seed: 'selector-redesign-test',
    createdAt: '2026-06-09T00:00:00.000Z',
  });
  const report = summarizeMiniDramaBatteryScreen(screen);
  assert.equal(screen.card_ids.length, 4);
  assert.equal(screen.candidates.length, 4);
  assert.equal(report.gate_status, 'pass');
  for (const candidate of screen.candidates) {
    assert.equal(candidate.baseline_control.mode, 'diagnostic_lure');
    assert.equal(candidate.baseline_control.gates.status, 'pass');
    assert.notEqual(candidate.baseline_control.response, candidate.shadow_control.response);
    assert.match(candidate.baseline_control.response, /\bHold the odd small mark aside\b/u);
    assert.equal(candidate.mini_drama.gates.status, 'pass');
  }
});

test('collision selector-rail fanout carries explicit old-warrant collision into candidates', () => {
  const ontology = loadMiniDramaOntology();
  const fanout = loadMiniDramaCards(DEFAULT_SELECTOR_RAIL_COLLISION_FANOUT);
  const screen = runMiniDramaBatteryScreen({
    ontology,
    cardPool: fanout,
    moveIds: ['peripeteia_error_spotting'],
    samplesPerCard: 1,
    seed: 'selector-collision-test',
    createdAt: '2026-06-09T00:00:00.000Z',
  });
  assert.equal(screen.card_ids.length, 6);
  assert.equal(screen.candidates.length, 6);
  assert.equal(qaMiniDramaRun(screen).status, 'pass');
  for (const candidate of screen.candidates) {
    assert.ok(candidate.wrong_prediction_collision);
    assert.match(candidate.wrong_prediction_collision.old_rule_prediction, /\brail\b/u);
    assert.match(candidate.wrong_prediction_collision.visible_refutation, /\brail\b/u);
    assert.match(candidate.mini_drama.response, /\bold rule predict\b/u);
  }
});

test('A19R model-screen dry run can use checker-only S0 with diagnostic baseline', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-drama-redesign-dry-'));
  const screenPath = path.join(tmpDir, 'screen.json');
  const outDir = path.join(tmpDir, 'model-screen');
  const ontology = loadMiniDramaOntology();
  const fanout = loadMiniDramaCards(DEFAULT_SELECTOR_RAIL_REDIRECT_FANOUT);
  const screen = runMiniDramaBatteryScreen({
    ontology,
    cardPool: fanout,
    moveIds: ['peripeteia_error_spotting'],
    samplesPerCard: 1,
    seed: 'selector-redesign-dry-test',
    createdAt: '2026-06-09T00:00:00.000Z',
  });
  writeJson(screenPath, screen);
  const selected = screen.candidates[0].candidate_id;
  const output = execFileSync(
    'node',
    [
      'scripts/a19r-mini-drama.js',
      'model-screen',
      '--run',
      screenPath,
      '--candidate-ids',
      selected,
      '--out-dir',
      outDir,
      '--rewrite-mode',
      'role_separated_continuation',
      '--bounded-max-added-lines',
      '5',
      '--codex-model',
      'gpt-5.5',
      '--codex-effort',
      'xhigh',
      '--claude-model',
      'claude-fable-5',
      '--claude-effort',
      'medium',
      '--baseline-mode',
      'diagnostic_lure',
      '--s0-mode',
      'checker_only',
      '--dry-run',
      '--json',
    ],
    { encoding: 'utf8' },
  );
  const summary = JSON.parse(output.slice(output.indexOf('{')));
  assert.equal(summary.baseline_mode, 'diagnostic_lure');
  assert.equal(summary.rewrite_mode, 'role_separated_continuation');
  assert.equal(summary.codex_model, 'gpt-5.5');
  assert.equal(summary.codex_effort, 'xhigh');
  assert.equal(summary.claude_model, 'claude-fable-5');
  assert.equal(summary.claude_effort, 'medium');
  assert.equal(summary.s0_mode, 'checker_only');
  assert.equal(summary.rows[0].baseline_source, 'baseline_control');
  assert.match(summary.rows[0].commands.s0, /--generator" "none/u);
  assert.match(summary.rows[0].commands.s1, /--rewrite-mode" "role_separated_continuation/u);
  assert.match(summary.rows[0].commands.s1, /--codex-model" "gpt-5\.5/u);
  assert.match(summary.rows[0].commands.s1, /--claude-model" "claude-fable-5/u);
  assert.match(summary.rows[0].commands.s1, /--policy-memory/u);
});

test('A19R model-screen policy memory includes explicit collision metadata when present', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-drama-collision-dry-'));
  const screenPath = path.join(tmpDir, 'screen.json');
  const outDir = path.join(tmpDir, 'model-screen');
  const ontology = loadMiniDramaOntology();
  const fanout = loadMiniDramaCards(DEFAULT_SELECTOR_RAIL_COLLISION_FANOUT);
  const screen = runMiniDramaBatteryScreen({
    ontology,
    cardPool: fanout,
    moveIds: ['peripeteia_error_spotting'],
    samplesPerCard: 1,
    seed: 'selector-collision-dry-test',
    createdAt: '2026-06-09T00:00:00.000Z',
  });
  writeJson(screenPath, screen);
  const selected = screen.candidates[0].candidate_id;
  execFileSync(
    'node',
    [
      'scripts/a19r-mini-drama.js',
      'model-screen',
      '--run',
      screenPath,
      '--candidate-ids',
      selected,
      '--out-dir',
      outDir,
      '--rewrite-mode',
      'bounded_continuation',
      '--bounded-max-added-lines',
      '4',
      '--baseline-mode',
      'diagnostic_lure',
      '--s0-mode',
      'checker_only',
      '--dry-run',
      '--json',
    ],
    { encoding: 'utf8' },
  );
  const policyPath = path.join(outDir, selected, 'inputs', 'rhetorical-policy-memory.json');
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  assert.equal(policy.wrong_prediction_collision.old_rule_prediction, 'top rail');
  assert.match(policy.selected_policy.wrong_prediction_collision_instruction, /old prediction: top rail/u);
  assert.match(policy.selected_policy.wrong_prediction_collision_instruction, /visible refutation:/u);
});

test('mini-drama packet keeps intended move and provenance out of coder-facing materials', () => {
  const run = makeRun();
  const candidate = run.candidates[0];
  const packet = buildMiniDramaPacket({ run, candidate, ontology: loadMiniDramaOntology() });
  const coderText = JSON.stringify(packet.coder_packet);
  assert.equal(coderText.includes(candidate.move_id), false);
  assert.equal(coderText.includes('mini_drama'), false);
  assert.equal(coderText.includes('shadow_control'), false);
  assert.equal(packet.private_key.intended_move_id, candidate.move_id);
  assert.match(packet.packet_id, /^mini_drama_v01__fraction_wrong_problem_001__[a-f0-9]{12}$/u);
  assert.equal(packet.packet_id.includes(candidate.move_id), false);
  assert.equal(packet.status, 'packet_only_no_judgments');
});

test('automated mini-drama raw judgment stays blind before private-key mapping', () => {
  const run = makeRun();
  const candidate = run.candidates[0];
  const packet = buildMiniDramaPacket({ run, candidate, ontology: loadMiniDramaOntology() });
  const raw = adjudicateMiniDramaCoderPacket({
    coderPacket: packet.coder_packet,
    codebook: loadMiniDramaCodebook(),
    ontology: loadMiniDramaOntology(),
    adjudicatedAt: '2026-06-09T00:00:00.000Z',
  });
  const rawText = JSON.stringify(raw);
  assert.equal(raw.private_key_used, false);
  assert.equal(raw.arm_judgments.length, 2);
  assert.equal(rawText.includes('S1_mini_drama'), false);
  assert.equal(rawText.includes('S0_shadow_control'), false);
  assert.equal(rawText.includes('intended_move_id'), false);
  assert.equal(rawText.includes('mini_drama'), false);
  assert.ok(['arm_A', 'arm_B'].includes(raw.pairwise_judgment.better_arm_label));
  assert.equal(raw.pairwise_judgment.better_for_target_reason, true);
});

test('automated mini-drama private-key mapping identifies S1 support after raw judgment', () => {
  const run = makeRun();
  const candidate = run.candidates[0];
  const packet = buildMiniDramaPacket({ run, candidate, ontology: loadMiniDramaOntology() });
  const raw = adjudicateMiniDramaCoderPacket({
    coderPacket: packet.coder_packet,
    codebook: loadMiniDramaCodebook(),
    ontology: loadMiniDramaOntology(),
    adjudicatedAt: '2026-06-09T00:00:00.000Z',
  });
  const result = applyMiniDramaPrivateKey({ packet, rawJudgment: raw });
  assert.equal(result.private_mapping_applied_after_raw_judgment, true);
  assert.equal(result.pairwise_result.preferred_condition, 'S1_mini_drama');
  assert.equal(result.pairwise_result.supports_s1_for_registered_move, true);
  assert.equal(result.intended_move_id, candidate.move_id);
});

test('automated mini-drama summary marks systemic S1>S0 support only over multiple packets', () => {
  const run = generateMiniDramaRun({
    ontology: loadMiniDramaOntology(),
    cardPool: loadMiniDramaCards(),
    moveIds: ['enargeia_subgoal', 'peripeteia_error_spotting', 'anagnorisis_sententia'],
    cardIds: ['fraction_wrong_problem_001'],
    runId: 'a19r-mini-drama-systemic-test',
    createdAt: '2026-06-09T00:00:00.000Z',
  });
  const results = run.candidates.map((candidate) => {
    const packet = buildMiniDramaPacket({ run, candidate, ontology: loadMiniDramaOntology() });
    const raw = adjudicateMiniDramaCoderPacket({
      coderPacket: packet.coder_packet,
      codebook: loadMiniDramaCodebook(),
      ontology: loadMiniDramaOntology(),
      adjudicatedAt: '2026-06-09T00:00:00.000Z',
    });
    return applyMiniDramaPrivateKey({ packet, rawJudgment: raw });
  });
  const summary = summarizeMiniDramaAutomatedAdjudications(results);
  assert.equal(summary.packet_count, 3);
  assert.equal(summary.s1_supported_count, 3);
  assert.equal(summary.s0_preferred_count, 0);
  assert.equal(summary.systemic_difference, true);
  assert.equal(summary.result_label, 'systemic_s1_mini_drama_greater_than_s0_shadow');
});

test('a19r automated adjudication script processes packet files without human coding', () => {
  const run = generateMiniDramaRun({
    ontology: loadMiniDramaOntology(),
    cardPool: loadMiniDramaCards(),
    moveIds: ['enargeia_subgoal', 'peripeteia_error_spotting', 'anagnorisis_sententia'],
    cardIds: ['fraction_wrong_problem_001'],
    runId: 'a19r-mini-drama-script-test',
    createdAt: '2026-06-09T00:00:00.000Z',
  });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19r-packets-'));
  const outDir = path.join(tempDir, 'out');
  const packetPaths = run.candidates.map((candidate) => {
    const packet = buildMiniDramaPacket({ run, candidate, ontology: loadMiniDramaOntology() });
    const packetPath = path.join(tempDir, `${packet.packet_id}.packet.json`);
    fs.writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
    return packetPath;
  });
  const { summary, written } = adjudicateA19RMiniDramaPackets({
    packetPaths,
    codebook: loadMiniDramaCodebook(),
    ontology: loadMiniDramaOntology(),
    criticId: 'deterministic-mini-drama-test',
    outDir,
    adjudicatedAt: '2026-06-09T00:00:00.000Z',
  });
  assert.equal(summary.systemic_difference, true);
  assert.equal(summary.s1_supported_count, 3);
  assert.equal(written.length, 3);
  for (const relPath of written) {
    const result = JSON.parse(fs.readFileSync(path.resolve(relPath), 'utf8'));
    assert.equal(result.raw_blinded_judgment.private_key_used, false);
    assert.equal(
      result.private_mapping_applied_after_raw_judgment.pairwise_result.preferred_condition,
      'S1_mini_drama',
    );
  }
});
