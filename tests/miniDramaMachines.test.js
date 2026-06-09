import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHumanAdjudicationAssignment } from '../scripts/create-a19-human-adjudication-assignment.js';
import { mergeA19AdjudicationCodes } from '../scripts/merge-a19-adjudication-codes.js';
import { validateA19HumanCoderFile } from '../scripts/validate-a19-human-coder-file.js';
import {
  DEFAULT_MINI_DRAMA_CODEBOOK,
  DEFAULT_A18_A19_RHETORICAL_BATTERY,
  DEFAULT_SELECTOR_RAIL_COLLISION_FANOUT,
  DEFAULT_SELECTOR_RAIL_REDIRECT_FANOUT,
  DEFAULT_SELECTOR_RAIL_TRANSFER_FANOUT,
  buildMiniDramaPacket,
  generateBaselineControl,
  generateMiniDramaRun,
  loadMiniDramaCards,
  loadMiniDramaCodebook,
  loadMiniDramaOntology,
  qaMiniDramaRun,
  runMiniDramaBatteryScreen,
  selectMiniDramaMovesForCard,
  summarizeMiniDramaBatteryScreen,
  validateMiniDramaCodebook,
} from '../services/miniDramaMachines.js';

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
});

function makeCoderFile({ tmpDir, assignment, assignmentKey, coderId }) {
  const privateByPublic = new Map(
    assignmentKey.arm_map.map((entry) => [entry.arm_public_id, entry.private_packet_mapping]),
  );
  const judgments = assignment.arms.map((arm) => {
    const privateMapping = privateByPublic.get(arm.arm_public_id);
    const isMiniDrama = privateMapping.move_id !== 'shadow_control';
    return {
      arm_public_id: arm.arm_public_id,
      primary_label: privateMapping.move_id,
      target_status: isMiniDrama ? 'target' : 'non_target',
      target_granularity_risk: false,
      obligations: {
        move_fidelity_visible: isMiniDrama ? 'present' : 'absent',
        helps_impasse_not_polish: isMiniDrama ? 'present' : 'partial',
        learner_agency_preserved: 'present',
        answer_leakage_avoided: 'present',
        manipulation_pressure_avoided: 'present',
      },
      excluded_moves_present: ['none'],
      evidence_spans: [
        {
          quote: arm.transcript.split('\n').at(-1).slice(0, 80),
          supports: 'primary_label',
        },
      ],
      rationale: isMiniDrama
        ? 'The arm visibly uses the intended local move. It changes the learner task without solving it.'
        : 'The arm stays plain and local. It does not instantiate a marked mini-drama move.',
      confidence: 0.82,
    };
  });
  const betterArm = assignmentKey.arm_map.find(
    (entry) => entry.private_packet_mapping.move_id !== 'shadow_control',
  ).arm_public_id;
  const coder = {
    coder_file_version: 'a19-human-coder-v01',
    coder_id: coderId,
    coder_role: 'expert_or_semi_expert',
    packet_id: assignment.packet_id,
    packet_sha256: assignment.packet_sha256,
    codebook_id: assignment.codebook_id,
    coded_at: '2026-06-08T00:00:00.000Z',
    arm_judgments: judgments,
    pairwise_judgment: {
      better_arm_public_id: betterArm,
      better_for_target_reason: true,
      reason: 'The selected arm better preserves a local learner action while changing the impasse frame.',
      alias_leakage_assessment: 'none_observed',
    },
    codebook_feedback: {
      ambiguous_terms: [],
      suggested_revision: '',
    },
  };
  const coderPath = path.join(tmpDir, `${coderId}.json`);
  writeJson(coderPath, coder);
  return coderPath;
}

test('mini-drama packets run through assignment, validation, and merge', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-drama-adjudication-'));
  const run = makeRun();
  const packet = buildMiniDramaPacket({
    run,
    candidate: run.candidates[0],
    ontology: loadMiniDramaOntology(),
  });
  const packetPath = path.join(tmpDir, 'packet.json');
  writeJson(packetPath, packet);

  const { assignment, assignmentKey, outPath, keyOutPath } = createHumanAdjudicationAssignment({
    packetPath,
    codebookPath: DEFAULT_MINI_DRAMA_CODEBOOK,
    outPath: path.join(tmpDir, 'assignment.json'),
    keyOutPath: path.join(tmpDir, 'assignment-key.json'),
    assignmentId: 'a19r-mini-drama-human-test',
    randomizeArms: false,
    createdAt: '2026-06-08T00:00:00.000Z',
  });
  writeJson(outPath, assignment);
  writeJson(keyOutPath, assignmentKey);

  const assignmentText = JSON.stringify(assignment);
  assert.equal(assignmentText.includes('intended_move_id'), false);
  assert.equal(assignmentText.includes('gate_status'), false);
  assert.equal(assignmentText.includes('S0_no_policy'), false);

  const firstCoder = makeCoderFile({ tmpDir, assignment, assignmentKey, coderId: 'coder-001' });
  const secondCoder = makeCoderFile({ tmpDir, assignment, assignmentKey, coderId: 'coder-002' });
  assert.equal(
    validateA19HumanCoderFile({
      assignmentPath: outPath,
      coderPath: firstCoder,
      codebookPath: DEFAULT_MINI_DRAMA_CODEBOOK,
    }).status,
    'pass',
  );

  const merge = mergeA19AdjudicationCodes({
    packetPath,
    assignmentPath: outPath,
    assignmentKeyPath: keyOutPath,
    coderPaths: [firstCoder, secondCoder],
  });
  assert.equal(merge.status, 'agreement_ready');
  assert.equal(merge.coder_count, 2);
});
