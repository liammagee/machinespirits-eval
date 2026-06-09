import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  adjudicateMiniDramaCoderPacket,
  applyMiniDramaPrivateKey,
  buildMiniDramaPacket,
  generateMiniDramaRun,
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
