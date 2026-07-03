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
  auditTutorSceneCommitment,
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
  normalizeSceneCommitmentV2,
  normalizeStrategyLedgerConfig,
  normalizeStrategyReview,
  sceneStanceFidelity,
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

// ---------------------------------------------------------------------------
// v2 — mechanism trialling (Part 6)
// ---------------------------------------------------------------------------

test('v2 config: stancePalette/releaseIntent require trialling; unknown stances fail loudly', () => {
  assert.throws(() => normalizeStrategyLedgerConfig({ stancePalette: ['ironic_challenge'] }), /requires trialling/);
  assert.throws(() => normalizeStrategyLedgerConfig({ releaseIntent: true }), /requires trialling/);
  assert.throws(
    () => normalizeStrategyLedgerConfig({ trialling: true, stancePalette: ['not_a_register'] }),
    /unknown engagement register/,
  );
  const cfg = normalizeStrategyLedgerConfig({ trialling: true, stancePalette: ['charismatic_challenge'] });
  assert.equal(cfg.trialling, true);
  assert.deepEqual(cfg.stancePalette, ['charismatic_challenge']);
});

test('v2 commitment shape gate: stance palette-bound, intent id-validated, stance-only is real', () => {
  const opts = {
    registerPalette: ['modern'],
    currentRegister: 'modern',
    stancePalette: ['ironic_challenge'],
    premiseIds: ['p1', 'p2'],
  };
  const full = normalizeSceneCommitmentV2(
    { stance: 'ironic_challenge', release_intent: ['p1', 'p9', 'p1'], rationale: 'r' },
    opts,
  );
  assert.equal(full.stance, 'ironic_challenge');
  assert.deepEqual(full.releaseIntent, ['p1']);
  assert.equal(full.rationale, 'r');
  assert.equal(normalizeSceneCommitmentV2({ stance: 'sarcastic_challenge' }, opts), null, 'off-palette stance drops');
  assert.equal(normalizeStrategyReview({ decision: 'switch', reason: 'x' }).decision, 'switch');
  assert.equal(normalizeStrategyReview({ decision: 'panic' }), null);
});

test('v2 stance fidelity: cues make faithful, person attack dominates, bare warmth does not count', () => {
  const faithful = sceneStanceFidelity({
    stance: 'ironic_challenge',
    tutorLines: [
      'Hold what you have.',
      'The small irony is that your answer conveniently repeats the formula - test it against one case and show me where it breaks.',
    ],
    learnerLines: ['', 'I am bored, why do we keep repeating this formula?'],
  });
  assert.equal(faithful.label, 'faithful');
  const positive = sceneStanceFidelity({
    stance: 'charismatic_challenge',
    tutorLines: ['Anything at all.'],
  });
  assert.equal(positive.label, 'not_applicable', 'the gate is a negative-register discipline');
  const warm = sceneStanceFidelity({
    stance: 'ironic_challenge',
    tutorLines: ['Wonderful work, let us look together at the next step.'],
  });
  assert.notEqual(warm.label, 'faithful');
  assert.equal(sceneStanceFidelity({ stance: null, tutorLines: ['x'] }), null);
});

test('v2 audit: stance clause follows the fidelity gate; departures license drift except stance', () => {
  const sceneRecord = {
    index: 2,
    startTurn: 3,
    endTurn: 5,
    status: 'budget',
    counts: { phatic: 3 },
    exchanges: [{ turn: 4, type: 'substantive', formalActions: 1 }],
    lastLearnerText: 'I see.',
    lastExchangeType: 'phatic_ack',
    releases: [],
    scheduled: [],
    didacticModes: null,
    registerHeld: true,
  };
  const commitment = {
    register: null,
    didacticDefault: null,
    releasePosture: null,
    recognitionBudget: 1,
    rationale: null,
    exitCondition: null,
    stance: 'ironic_challenge',
    releaseIntent: ['p1'],
  };
  const noDeparture = auditTutorSceneCommitment(commitment, sceneRecord, {
    departures: 0,
    fidelity: { label: 'weak_or_warm_in_costume' },
  });
  const budgetClause = noDeparture.clauses.find((c) => c.clause.startsWith('recognition budget'));
  const stanceClause = noDeparture.clauses.find((c) => c.clause.startsWith('stance '));
  const intentClause = noDeparture.clauses.find((c) => c.clause === 'release intent');
  assert.equal(budgetClause.verdict, 'drift');
  assert.equal(stanceClause.verdict, 'drift');
  assert.equal(intentClause.verdict, 'drift');
  const withDeparture = auditTutorSceneCommitment(commitment, sceneRecord, {
    departures: 1,
    fidelity: { label: 'weak_or_warm_in_costume' },
  });
  assert.equal(
    withDeparture.clauses.find((c) => c.clause.startsWith('recognition budget')).verdict,
    'justified_deviation',
  );
  assert.equal(
    withDeparture.clauses.find((c) => c.clause.startsWith('stance ')).verdict,
    'drift',
    'a departure never licenses treatment noncompliance',
  );
});

test('v2 full mock run: history + reviews accumulate; v1 runs carry no history field', async () => {
  const client = makeLlmClient({ mode: 'mock' });
  const cast = {
    director: makeLlmDirector(world, client, {}),
    tutor: makeLlmTutor(world, client, {
      script: SCRIPT,
      didacticMode: true,
      strategyLedger: true,
      strategyLedgerV2: true,
      publicRegister: 'modern',
    }),
    learner: makeLlmLearner({
      setting: world.setting,
      voice: 'plain, careful, first person',
      client,
      publicRegister: 'modern',
    }),
  };
  const result = await runDrama({
    world,
    roles: cast,
    options: {
      sceneMode: true,
      publicRegister: 'modern',
      strategyLedger: normalizeStrategyLedgerConfig({
        trialling: true,
        stancePalette: ['charismatic_challenge', 'ironic_challenge'],
      }),
      maxTurns: 10,
      stopOnStall: false,
    },
  });
  const history = result.strategyLedger.history;
  assert.ok(history.length >= 2);
  for (const entry of history) {
    assert.ok(entry.strategy.stance, 'every trial names its stance');
    assert.ok(entry.fidelity?.label, 'gate one always runs');
    assert.ok(!('D' in (entry.outcome || {})), 'history is public-only');
  }
  assert.ok(result.events.some((e) => e.type === 'strategy_review'));
  assert.ok(result.events.some((e) => e.type === 'stance_fidelity'));

  const v1 = await runDrama({
    world,
    roles: llmCast(makeLlmClient({ mode: 'mock' }), { strategyLedger: true }),
    options: {
      sceneMode: true,
      publicRegister: 'modern',
      strategyLedger: normalizeStrategyLedgerConfig({ registerPalette: ['modern', 'period'] }),
      maxTurns: 8,
      stopOnStall: false,
    },
  });
  assert.ok(!('history' in v1.strategyLedger), 'v1 result shape unchanged (no history field)');
  assert.ok(!v1.events.some((e) => e.type === 'strategy_review'));
});

test('v2 requires v1: strategyLedgerV2 without strategyLedger fails at build', () => {
  assert.throws(
    () => makeLlmTutor(world, makeLlmClient({ mode: 'mock' }), { script: SCRIPT, strategyLedgerV2: true }),
    /requires strategyLedger/,
  );
});

// ---------------------------------------------------------------------------
// plan mode — the dialogic stock-take (course-changing, not course-holding)
// ---------------------------------------------------------------------------

test('plan-mode config: exclusive with trialling; bridge guards enforce prerequisites', () => {
  assert.throws(() => normalizeStrategyLedgerConfig({ planMode: true, trialling: true }), /mutually exclusive/);
  const cfg = normalizeStrategyLedgerConfig({ planMode: true });
  assert.equal(cfg.planMode, true);
  assert.throws(
    () => makeLlmTutor(world, makeLlmClient({ mode: 'mock' }), { script: SCRIPT, strategyLedgerPlanMode: true }),
    /requires strategyLedger/,
  );
  assert.throws(
    () =>
      makeLlmTutor(world, makeLlmClient({ mode: 'mock' }), {
        script: SCRIPT,
        strategyLedger: true,
        strategyLedgerV2: true,
        strategyLedgerPlanMode: true,
      }),
    /mutually exclusive/,
  );
});

test('plan mode: stock-takes fire between scenes, reorientations answer corrections, no commitments', async () => {
  const client = makeLlmClient({ mode: 'mock' });
  const cast = {
    director: makeLlmDirector(world, client, {}),
    tutor: makeLlmTutor(world, client, {
      script: SCRIPT,
      didacticMode: true,
      strategyLedger: true,
      strategyLedgerPlanMode: true,
      publicRegister: 'modern',
    }),
    learner: makeLlmLearner({
      setting: world.setting,
      voice: 'plain, careful, first person',
      client,
      publicRegister: 'modern',
    }),
  };
  const result = await runDrama({
    world,
    roles: cast,
    options: {
      sceneMode: true,
      publicRegister: 'modern',
      strategyLedger: normalizeStrategyLedgerConfig({ planMode: true }),
      maxTurns: 10,
      stopOnStall: false,
    },
  });
  const stocktakes = result.strategyLedger.stocktakes;
  assert.ok(stocktakes.length >= 1, 'stock-takes fire at openings with a sealed scene');
  for (const st of stocktakes) {
    assert.ok(st.assessment, 'the second voice always assesses');
    if (st.correction) {
      assert.ok(st.reorientation, 'a demanded correction is answered');
      assert.equal(st.orientationAfter, st.reorientation, 'the reorientation becomes the working orientation');
    }
  }
  assert.ok(!result.events.some((e) => e.type === 'strategy_commit'), 'no commitment machinery under plan mode');
  assert.ok(!result.events.some((e) => e.type === 'strategy_audit'), 'no conformance audits under plan mode');
  assert.ok(result.events.some((e) => e.type === 'stocktake'));
  assert.ok(!('history' in result.strategyLedger), 'no trialling history table under plan mode');
});
