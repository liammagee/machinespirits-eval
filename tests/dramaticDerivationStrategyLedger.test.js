/**
 * Strategy Ledger v1 (LAYERED-DECISION-LOOPS-PLAN.md Phases 0-2). What these
 * tests pin, in order of importance:
 *
 *   1. off-state invariance — both dials absent means the engine result is
 *      field-for-field what it was before the ledger existed (the same rail
 *      decay and acts ran); with the inline mock cast (which never commits),
 *      the ON result differs from OFF by exactly the result.strategyLedger
 *      envelope;
 *   2. proof-control fingerprint — ledger on/off runs are byte-identical on
 *      {release ledger, trajectory, verdict}: the ledger is conduct-only by
 *      construction;
 *   3. the commit/audit loop at scene scope — the tutor commits at every
 *      scene opening (mock hints), the engine applies and HOLDS the
 *      palette-bound register for the scene and reverts at its close, and
 *      the deterministic audit binds at the next opening;
 *   4. blocks — pressing exchange episodes open blocks, exit-condition
 *      clearance closes them, budgets fail them, and a failed held mode is
 *      escalated rather than re-selected;
 *   5. learner mirror — the learner commits its own scene intent and act
 *      carry-forward; its ledger rows share the tutor rows' exact field set
 *      (the symmetry rule).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkBlockClearance,
  escalateDidacticMode,
  ledgerRow,
  loadWorld,
  makeLlmClient,
  makeLlmDirector,
  makeLlmLearner,
  makeLlmTutor,
  makeMockDirector,
  makeMockLearner,
  makeMockTutor,
  normalizeLearnerActCarry,
  normalizeLearnerSceneIntent,
  normalizeSceneCommitment,
  normalizeStrategyLedgerConfig,
  openBlock,
  runDrama,
  updateBlockLedger,
  DIDACTIC_MODE_FAMILIES,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));
const SCRIPT = fs.readFileSync(path.join(ROOT, 'config/drama-derivation/tutor-scripts/nocturne-v001.md'), 'utf8');

const mockCast = () => ({
  director: makeMockDirector(world),
  tutor: makeMockTutor(world),
  learner: makeMockLearner({}),
});

const llmCast = (client, { strategyLedger = false, learnerLedger = false, actsMode = false } = {}) => ({
  director: makeLlmDirector(world, client, { actsMode }),
  tutor: makeLlmTutor(world, client, {
    script: SCRIPT,
    didacticMode: true,
    strategyLedger,
    publicRegister: 'modern',
    ...(actsMode ? { actsMode, decayVisibility: 'conduct' } : {}),
  }),
  learner: makeLlmLearner({
    setting: world.setting,
    voice: 'plain, careful, first person',
    client,
    publicRegister: 'modern',
    learnerLedger,
  }),
});

// ---------------------------------------------------------------------------
// config + shape gates
// ---------------------------------------------------------------------------

test('strategy-ledger config: defaults, unknown keys, palette validation', () => {
  const cfg = normalizeStrategyLedgerConfig(true);
  assert.equal(cfg.maxBlockTurns, 3);
  assert.equal(cfg.registerPalette, null);
  assert.throws(() => normalizeStrategyLedgerConfig({ nope: 1 }), /unknown key "nope"/);
  assert.throws(() => normalizeStrategyLedgerConfig({ maxBlockTurns: 0 }), /maxBlockTurns/);
  assert.throws(() => normalizeStrategyLedgerConfig({ registerPalette: ['klingon'] }), /unknown palette register/);
  assert.deepEqual(normalizeStrategyLedgerConfig({ registerPalette: ['Modern', 'period'] }).registerPalette, [
    'modern',
    'period',
  ]);
});

test('scene-commitment shape gate: palette bounds the register, empty drops to null', () => {
  const full = normalizeSceneCommitment(
    {
      register: 'period',
      didactic_default: 'teach_back',
      release_posture: 'hold',
      recognition_budget: 2,
      rationale: 'r',
      exit_condition: 'x',
    },
    { registerPalette: ['modern', 'period'], currentRegister: 'modern' },
  );
  assert.equal(full.register, 'period');
  assert.equal(full.didacticDefault, 'teach_back');
  assert.equal(full.releasePosture, 'hold');
  assert.equal(full.recognitionBudget, 2);
  // a register outside the palette is dropped, not obeyed
  const offPalette = normalizeSceneCommitment(
    { register: 'period', release_posture: 'eager' },
    { registerPalette: ['modern'], currentRegister: 'modern' },
  );
  assert.equal(offPalette.register, null);
  assert.equal(offPalette.releasePosture, 'eager');
  assert.equal(normalizeSceneCommitment({}, {}), null);
  assert.equal(normalizeSceneCommitment({ register: 'klingon' }, { registerPalette: ['modern'] }), null);
});

test('learner intent/carry shape gates mirror the tutor discipline', () => {
  const intent = normalizeLearnerSceneIntent({ want: 'w', if_lost: 'ask_repair', speech_posture: 'p' });
  assert.deepEqual(intent, { want: 'w', ifLost: 'ask_repair', speechPosture: 'p' });
  assert.equal(normalizeLearnerSceneIntent({ if_lost: 'panic' }), null);
  assert.deepEqual(normalizeLearnerActCarry({ carry_forward: 'c', still_owe: 's' }), {
    carryForward: 'c',
    stillOwe: 's',
  });
  assert.equal(normalizeLearnerActCarry({}), null);
});

test('escalation stays inside the mode families and never returns its input', () => {
  for (const mode of DIDACTIC_MODE_FAMILIES) {
    const next = escalateDidacticMode(mode);
    assert.ok(DIDACTIC_MODE_FAMILIES.includes(next), `${mode} -> ${next}`);
    assert.notEqual(next, mode);
  }
});

test('ledger row: one shape, both agents; unknown agent/scope fail loudly', () => {
  const t = ledgerRow({ agent: 'tutor', scope: 'scene', commitment: {}, committedTurn: 1 });
  const l = ledgerRow({ agent: 'learner', scope: 'scene', commitment: {}, committedTurn: 1 });
  assert.deepEqual(Object.keys(t).sort(), Object.keys(l).sort());
  assert.throws(() => ledgerRow({ agent: 'director', scope: 'scene', commitment: {}, committedTurn: 1 }));
  assert.throws(() => ledgerRow({ agent: 'tutor', scope: 'epoch', commitment: {}, committedTurn: 1 }));
});

// ---------------------------------------------------------------------------
// block mechanics
// ---------------------------------------------------------------------------

test('blocks: clearance, supersession, budget failure', () => {
  let step = updateBlockLedger(openBlock({ index: 1, turn: 2, type: 'confusion' }), {
    turn: 3,
    learnerText: 'So that means the line joins, because the rule says so.',
    exchangeType: 'substantive',
    maxBlockTurns: 3,
  });
  assert.equal(step.closed.status, 'cleared');

  step = updateBlockLedger(openBlock({ index: 2, turn: 4, type: 'confusion' }), {
    turn: 5,
    learnerText: 'But surely that cannot be.',
    exchangeType: 'resistance',
    maxBlockTurns: 3,
  });
  assert.equal(step.closed.status, 'superseded');

  let block = openBlock({ index: 3, turn: 6, type: 'resistance' });
  for (const turn of [7, 8]) {
    ({ block } = updateBlockLedger(block, {
      turn,
      learnerText: 'Surely not.',
      exchangeType: 'resistance',
      maxBlockTurns: 3,
    }));
  }
  step = updateBlockLedger(block, {
    turn: 9,
    learnerText: 'Surely it cannot stand.',
    exchangeType: 'resistance',
    maxBlockTurns: 3,
  });
  assert.equal(step.closed.status, 'failed');
  assert.equal(step.closed.clearance.length, 3);
});

test('mode-held clearance is stricter than episode clearance', () => {
  assert.equal(
    checkBlockClearance({ mode: 'teach_back', learnerText: 'Yes, got it.', exchangeType: 'phatic_ack' }).cleared,
    false,
  );
  assert.equal(
    checkBlockClearance({
      mode: 'teach_back',
      learnerText: 'I would say the mark settles it, because the rule joins the line.',
      exchangeType: 'substantive',
    }).cleared,
    true,
  );
  assert.equal(
    checkBlockClearance({ blockType: 'confusion', learnerText: 'Yes, got it.', exchangeType: 'phatic_ack' }).cleared,
    true,
  );
});

// ---------------------------------------------------------------------------
// off-state invariance + proof fingerprint
// ---------------------------------------------------------------------------

test('off-state invariance: dials absent means absent; inline ON differs only by the envelope', async () => {
  const off = await runDrama({ world, roles: mockCast(), options: { sceneMode: true, maxTurns: 8 } });
  assert.ok(!('strategyLedger' in off), 'off-run must not carry a strategyLedger field');

  const on = await runDrama({
    world,
    roles: mockCast(),
    options: {
      sceneMode: true,
      maxTurns: 8,
      strategyLedger: normalizeStrategyLedgerConfig(true),
      learnerLedger: true,
    },
  });
  assert.ok(on.strategyLedger, 'on-run carries the envelope');
  // the inline mock cast never commits and never gets confused: with the
  // envelope stripped, the ON result is field-for-field the OFF result.
  const stripped = { ...on };
  delete stripped.strategyLedger;
  assert.deepEqual(stripped, off);
});

test('ledger requires scene mode (loud config error, not silent fallback)', async () => {
  await assert.rejects(
    runDrama({ world, roles: mockCast(), options: { strategyLedger: true } }),
    /requires scene mode/,
  );
  await assert.rejects(runDrama({ world, roles: mockCast(), options: { learnerLedger: true } }), /requires scene mode/);
});

test('proof-control fingerprint: llmRoles cast on/off byte-identical', async () => {
  const fingerprint = (r) => JSON.stringify({ ledger: r.ledger, trajectory: r.trajectory, verdict: r.verdict });
  const off = await runDrama({
    world,
    roles: llmCast(makeLlmClient({ mode: 'mock' })),
    options: { sceneMode: true, publicRegister: 'modern', maxTurns: 10, stopOnStall: false },
  });
  const on = await runDrama({
    world,
    roles: llmCast(makeLlmClient({ mode: 'mock' }), { strategyLedger: true, learnerLedger: true }),
    options: {
      sceneMode: true,
      publicRegister: 'modern',
      maxTurns: 10,
      stopOnStall: false,
      strategyLedger: normalizeStrategyLedgerConfig({ registerPalette: ['modern', 'period'] }),
      learnerLedger: true,
    },
  });
  assert.equal(fingerprint(on), fingerprint(off));
});

// ---------------------------------------------------------------------------
// the commit/audit loop (llmRoles + mock client)
// ---------------------------------------------------------------------------

test('scene commitments: committed at every opening, register palette-bound, held, audited', async () => {
  const result = await runDrama({
    world,
    roles: llmCast(makeLlmClient({ mode: 'mock' }), { strategyLedger: true }),
    options: {
      sceneMode: true,
      publicRegister: 'modern',
      strategyLedger: normalizeStrategyLedgerConfig({ registerPalette: ['modern', 'period'] }),
      maxTurns: 10,
      stopOnStall: false,
    },
  });
  const openings = result.events.filter((e) => e.type === 'scene_open').length;
  const commits = result.events.filter((e) => e.type === 'strategy_commit').length;
  assert.ok(openings > 1, 'the run spans several scenes');
  assert.equal(commits, openings, 'every scene opening carries a commitment');

  const tutorRows = result.strategyLedger.rows.filter((r) => r.agent === 'tutor' && r.scope === 'scene');
  assert.equal(tutorRows.length, openings);
  for (const row of tutorRows) {
    if (row.commitment.register) assert.ok(['modern', 'period'].includes(row.commitment.register));
  }

  // the engine applied and held the committed register, reverting at close
  const switches = (result.publicRegisters || []).filter((r) => r.scope === 'scene');
  assert.ok(switches.length > 0, 'a scene register switch was applied');
  for (const row of switches) {
    const revert = (result.publicRegisters || []).find((r) => r.scope === 'scene_end' && r.scene === row.scene);
    const endTurn = revert ? revert.turn : result.turnsPlayed;
    const learnerLines = result.transcript.filter(
      (l) => l.role === 'learner' && l.turn > row.turn && l.turn <= endTurn,
    );
    for (const line of learnerLines) assert.equal(line.meta.publicRegister, row.register);
  }

  // audits attach to every sealed scene's row (the final scene's lapse is
  // the run-end boundary, not a failure)
  const audited = tutorRows.filter((r) => r.audit);
  assert.ok(audited.length >= openings - 1);
  for (const row of audited) {
    for (const clause of row.audit.clauses) {
      assert.ok(['kept', 'drift', 'unscored'].includes(clause.verdict));
    }
  }
});

// ---------------------------------------------------------------------------
// engine blocks with a scripted learner
// ---------------------------------------------------------------------------

test('engine blocks: pressing episodes open, clear, and fail through the live loop', async () => {
  const lines = {
    1: 'I do not get it, that is unclear to me.',
    2: 'Still unclear, I do not get it.',
    3: 'So that means the child line gives a grandchild, because the rule joins them.',
    4: 'But surely that cannot be right.',
    5: 'Surely that still cannot follow.',
    6: 'It surely cannot be so.',
    7: 'Surely not.',
  };
  const roles = {
    director: async () => ({ direction: '[The question holds.]', release: null }),
    tutor: async () => ({
      dialogue: 'Hold what you have.',
      move: { figure: 'erotema', targetPremise: null, intent: 'orient' },
    }),
    learner: async (view) => ({
      dialogue: lines[view.turn] || 'I am listening.',
      adopt: [],
      hypothesis: null,
      asserts: null,
    }),
  };
  const result = await runDrama({
    world,
    roles,
    options: { sceneMode: true, strategyLedger: normalizeStrategyLedgerConfig(true), maxTurns: 7, stopOnStall: false },
  });
  const blocks = result.strategyLedger.blocks;
  assert.ok(blocks.some((b) => b.type === 'confusion' && b.status === 'cleared'));
  assert.ok(blocks.some((b) => b.type === 'resistance'));
  assert.ok(result.events.some((e) => e.type === 'block_open'));
  assert.ok(result.events.some((e) => e.type === 'block_close'));
  assert.ok(Number.isInteger(result.strategyLedger.budgetFinal.currentProofNeutralTutorTurns));
});

// ---------------------------------------------------------------------------
// the learner mirror
// ---------------------------------------------------------------------------

test('learner mirror: scene intents + act carries recorded, rows field-identical to the tutor', async () => {
  const result = await runDrama({
    world,
    roles: llmCast(makeLlmClient({ mode: 'mock' }), { strategyLedger: true, learnerLedger: true, actsMode: true }),
    options: {
      sceneMode: true,
      publicRegister: 'modern',
      strategyLedger: normalizeStrategyLedgerConfig({ registerPalette: ['modern', 'period'] }),
      learnerLedger: true,
      acts: { minActTurns: 2, maxActTurns: 4 },
      maxTurns: 12,
      stopOnStall: false,
    },
  });
  const rows = result.strategyLedger.rows;
  const learnerScene = rows.filter((r) => r.agent === 'learner' && r.scope === 'scene');
  const learnerAct = rows.filter((r) => r.agent === 'learner' && r.scope === 'act');
  const tutorScene = rows.filter((r) => r.agent === 'tutor' && r.scope === 'scene');
  const openings = result.events.filter((e) => e.type === 'scene_open').length;
  assert.equal(learnerScene.length, openings, 'every scene opening carries a learner intent');
  assert.ok(learnerAct.length >= 1, 'act boundaries carry a learner carry-forward');
  assert.deepEqual(Object.keys(tutorScene[0]).sort(), Object.keys(learnerScene[0]).sort());
  assert.ok(result.events.some((e) => e.type === 'learner_intent'));
  assert.ok(result.events.some((e) => e.type === 'learner_carry'));
  // intents are private: no tutor-side transcript meta carries them
  for (const line of result.transcript.filter((l) => l.role === 'tutor')) {
    assert.ok(!('sceneIntent' in (line.meta || {})));
  }
});
