/**
 * The unreliable-learner condition (corruption.js + engine.js decay hooks;
 * design note notes/poetics/2026-06-10-unreliable-learner-design.md).
 *
 * What these tests pin, in order of importance:
 *   1. decay-off invariance — no `--decay` means the engine result is
 *      field-for-field what it was before the condition existed;
 *   2. seeded determinism — the corruption schedule is a pure function of
 *      (seed, role outputs), so ON/OFF arms share a corruption schedule and
 *      matched-pair comparisons are valid;
 *   3. the two repair channels (tutor targetPremise, learner re-adoption)
 *      restore derivability through the same single choke point that decay
 *      degrades it;
 *   4. the learner-view exclusion — a decayed fact vanishes from the
 *      learner's board AND from releasedFacts (no trivial re-adoption), while
 *      the world-side roles keep ground-truth visibility (v1).
 *
 * All scenarios run the deterministic mock cast on the smoke world, so every
 * assertion is an exact pin, not a tolerance.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  factKey,
  loadWorld,
  runDrama,
  normalizeDecayConfig,
  mulberry32,
  corruptionReport,
  diagnose,
  makeMockDirector,
  makeMockTutor,
  makeMockLearner,
  makeLlmClient,
  makeLlmDirector,
  makeLlmTutor,
  makeLlmLearner,
} from '../services/dramaticDerivation/index.js';

const WORLD_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../config/drama-derivation/world-000-smoke.yaml',
);

const world = loadWorld(WORLD_PATH);

const mockRoles = (tutorPolicy = {}, learnerPolicy = {}) => ({
  director: makeMockDirector(world),
  tutor: makeMockTutor(world, tutorPolicy),
  learner: makeMockLearner(learnerPolicy),
});

// Aggressive schedule used by the channel tests: every eligible premise slips
// every turn (rate 1), immediately (grace 0), one at a time (maxConcurrent 1).
const AGGRESSIVE = { seed: 1, rate: 1, graceTurns: 0, maxConcurrent: 1, startTurn: 2 };

// ---------------------------------------------------------------------------
// config validation
// ---------------------------------------------------------------------------

test('normalizeDecayConfig fills defaults, accepts JSON strings, rejects junk', () => {
  const filled = normalizeDecayConfig({});
  // mutateShare joined the surface in stage v2 (default 0 = v1 byte-identity);
  // pool joined in stage v3 (default "world" = pre-v3 byte-identity).
  assert.deepEqual(filled, {
    seed: 1,
    rate: 0.15,
    graceTurns: 2,
    maxConcurrent: 2,
    startTurn: 1,
    mutateShare: 0,
    pool: 'world',
  });
  assert.deepEqual(normalizeDecayConfig('{"rate":0.5,"seed":9}').rate, 0.5);
  assert.equal(normalizeDecayConfig({ pool: 'staged' }).pool, 'staged');
  assert.throws(() => normalizeDecayConfig({ rate: 1.5 }), /rate/);
  assert.throws(() => normalizeDecayConfig({ unknownKnob: 1 }), /unknownKnob/);
  assert.throws(() => normalizeDecayConfig({ maxConcurrent: 0 }), /maxConcurrent/);
  assert.throws(() => normalizeDecayConfig({ mutateShare: 1.5 }), /mutateShare/);
  assert.throws(() => normalizeDecayConfig({ pool: 'met' }), /pool/);
  assert.throws(() => normalizeDecayConfig('not json'), /JSON|json/);
});

test('mulberry32 is deterministic per seed and seeds diverge', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  const c = mulberry32(43);
  assert.notDeepEqual(seqA, [c(), c(), c()]);
  assert.ok(seqA.every((x) => x >= 0 && x < 1));
});

// ---------------------------------------------------------------------------
// decay-off invariance (the OFF state is the pre-condition engine, exactly)
// ---------------------------------------------------------------------------

test('without options.decay the result carries no corruption fields and the happy path is untouched', async () => {
  const result = await runDrama({ world, roles: mockRoles() });
  assert.equal('corruption' in result, false);
  assert.equal(result.verdict, 'grounded_anagnorisis');
  assert.deepEqual(
    result.trajectory.map((p) => p.D),
    [3, 2, 2, 2, 1, 1, 1, 0],
  );
  assert.ok(result.events.every((e) => e.type !== 'decay' && e.type !== 'repair'));
  // and the diagnosis panel object gains no corruption block either
  const d = diagnose(result, world);
  assert.equal('corruption' in d, false);
  assert.equal(corruptionReport(result), null);
});

// ---------------------------------------------------------------------------
// seeded determinism
// ---------------------------------------------------------------------------

test('same seed + same roles → identical corruption ledger and trajectory; different seed diverges', async () => {
  const run = (seed) =>
    runDrama({
      world,
      roles: mockRoles({}, {}),
      options: { decay: { seed, rate: 0.5, graceTurns: 0, maxConcurrent: 2, startTurn: 1 } },
    });
  const [r1, r2, r3] = [await run(7), await run(7), await run(8)];
  assert.deepEqual(r1.corruption.ledger, r2.corruption.ledger);
  assert.deepEqual(
    r1.trajectory.map((p) => p.D),
    r2.trajectory.map((p) => p.D),
  );
  assert.equal(r1.verdict, r2.verdict);
  assert.notDeepEqual(r1.corruption.ledger, r3.corruption.ledger);
});

// ---------------------------------------------------------------------------
// repair channels
// ---------------------------------------------------------------------------

test('learner re-adoption keeps the proof path alive under aggressive decay (matched contrast: no repair fails)', async () => {
  // WITH the re-adoption channel: every slip is restored within a turn, the
  // D-curve never reverses (repairs land before D is measured), and the drama
  // reaches the same grounded anagnorisis on the same turn as the happy path.
  const repaired = await runDrama({
    world,
    roles: mockRoles({}, { readoptForgotten: true }),
    options: { decay: AGGRESSIVE },
  });
  assert.equal(repaired.verdict, 'grounded_anagnorisis');
  assert.equal(repaired.turnsPlayed, 8);
  assert.deepEqual(
    repaired.trajectory.map((p) => p.D),
    [3, 2, 2, 2, 1, 1, 1, 0],
  );
  assert.deepEqual(repaired.corruption.decayedAtEnd, []);
  const vias = repaired.corruption.ledger.filter((e) => e.type === 'repair').map((e) => e.via);
  assert.ok(vias.includes('readoption'));
  // t3's repair comes via the tutor WITHOUT any repair policy: the plain
  // tutor's consolidate move targets the last release (p1), and any move
  // whose targetPremise names a decayed premise re-stages it. Incidental
  // repair is a designed property of the channel, pinned here.
  assert.deepEqual(repaired.corruption.ledger.slice(0, 2), [
    { turn: 2, type: 'decay', premiseId: 'p1', fact: ['child', 'marin', 'tessa'] },
    { turn: 3, type: 'repair', premiseId: 'p1', via: 'tutor' },
  ]);

  // SAME decay schedule, NO repair channel: p1 stays dead from t4 (the tutor
  // consolidates newer releases) and the drama never forces S.
  const unrepaired = await runDrama({ world, roles: mockRoles({}, {}), options: { decay: AGGRESSIVE } });
  assert.equal(unrepaired.verdict, 'disengagement');
  assert.equal(unrepaired.firstForcedTurn, null);
  assert.ok(unrepaired.corruption.decayedAtEnd.some((d) => d.premiseId === 'p1'));
  // the D-curve visibly reverses when the board loses a premise the proof needs
  const ds = unrepaired.trajectory.map((p) => p.D);
  assert.ok(ds.some((d, i) => i > 0 && d > ds[i - 1]));
});

test('tutor targetPremise repair restores a decayed premise before the learner speaks', async () => {
  const result = await runDrama({
    world,
    roles: mockRoles({ repairDecayed: true }, {}),
    options: { maxTurns: 4, decay: AGGRESSIVE },
  });
  assert.equal(result.turnsPlayed, 4);
  assert.equal(result.verdict, 'cap_reached');
  // exact tug-of-war: decay at each turn end, tutor restoration each turn after
  assert.deepEqual(result.corruption.ledger, [
    { turn: 2, type: 'decay', premiseId: 'p1', fact: ['child', 'marin', 'tessa'] },
    { turn: 3, type: 'repair', premiseId: 'p1', via: 'tutor' },
    { turn: 3, type: 'decay', premiseId: 'p1', fact: ['child', 'marin', 'tessa'] },
    { turn: 4, type: 'repair', premiseId: 'p1', via: 'tutor' },
    { turn: 4, type: 'decay', premiseId: 'p1', fact: ['child', 'marin', 'tessa'] },
  ]);
});

// ---------------------------------------------------------------------------
// eligibility guards
// ---------------------------------------------------------------------------

test('graceTurns larger than the run → zero decay events, trajectory identical to the happy path', async () => {
  const result = await runDrama({
    world,
    roles: mockRoles(),
    options: { decay: { seed: 1, rate: 1, graceTurns: 99, maxConcurrent: 2, startTurn: 1 } },
  });
  assert.deepEqual(result.corruption.ledger, []);
  assert.deepEqual(result.corruption.decayedAtEnd, []);
  assert.equal(result.verdict, 'grounded_anagnorisis');
  assert.deepEqual(
    result.trajectory.map((p) => p.D),
    [3, 2, 2, 2, 1, 1, 1, 0],
  );
});

test('maxConcurrent caps simultaneously degraded premises', async () => {
  // rate 1 with no repair: once one premise is down, active=1 blocks further
  // slips at maxConcurrent 1 — reconstruct the active count from the ledger.
  const result = await runDrama({ world, roles: mockRoles({}, {}), options: { decay: AGGRESSIVE } });
  let active = 0;
  for (const e of result.corruption.ledger) {
    if (e.type === 'decay') active += 1;
    if (e.type === 'repair') active -= 1;
    assert.ok(active <= 1, `active degraded count exceeded maxConcurrent at turn ${e.turn}`);
  }
});

test('background facts are immune — only released premises ever decay', async () => {
  const backgroundKeys = new Set(world.background.map(factKey));
  const result = await runDrama({
    world,
    roles: mockRoles({}, {}),
    options: { decay: { seed: 3, rate: 1, graceTurns: 0, maxConcurrent: 4, startTurn: 1 } },
  });
  for (const e of result.corruption.ledger.filter((x) => x.type === 'decay')) {
    assert.ok(!backgroundKeys.has(factKey(e.fact)), `background fact decayed: ${e.fact.join(' ')}`);
    assert.ok(e.premiseId, 'decayed entries are released premises with ids');
  }
});

// ---------------------------------------------------------------------------
// mutation pool (stage v3): "staged" never whispers an unmet name
// ---------------------------------------------------------------------------

// The lantern-p3 defect (critic's notice; registration §13): under the only
// pre-v3 pool ("world") a mutation could swap in a constant from a premise
// not yet released — corruption staging a name before any exhibit did. Under
// pool "staged" the sampler is confined to entities the learner has met on
// stage: background plus premises released so far.
const STAGED_MUTATING = {
  seed: 1,
  rate: 1,
  graceTurns: 0,
  maxConcurrent: 1,
  startTurn: 2,
  mutateShare: 1,
  pool: 'staged',
};

// Constants the learner has met on stage by the END of turn T: background
// arguments plus the arguments of every premise released at a turn <= T.
const metConstantsByTurn = (result, turn) => {
  const met = new Set();
  for (const fact of world.background) for (const c of fact.slice(1)) met.add(c);
  for (const row of result.ledger) {
    if (row.turn > turn) continue;
    const premise = world.premiseById.get(row.premiseId);
    for (const c of premise.fact.slice(1)) met.add(c);
  }
  return met;
};

test('pool "staged": every false form is built from met-on-stage constants; an unmet pool falls back to plain delete', async () => {
  const result = await runDrama({
    world,
    roles: mockRoles({}, { readoptForgotten: true }),
    options: { decay: STAGED_MUTATING },
  });
  // The repair channel keeps the drama on the happy path (cf. the re-adoption
  // test above): standing false beliefs never enter forcing, so the staged
  // pool changes WHAT a slip becomes, not where the drama goes.
  assert.equal(result.verdict, 'grounded_anagnorisis');

  const decays = result.corruption.ledger.filter((e) => e.type === 'decay');
  assert.ok(decays.length >= 4, `expected a decay cadence, got ${decays.length} rows`);

  // (1) The invariant: a mutate row's false form uses ONLY constants the
  // learner had met on stage by that turn — corruption can no longer whisper.
  const mutates = decays.filter((e) => e.mode === 'mutate');
  for (const e of mutates) {
    const met = metConstantsByTurn(result, e.turn);
    for (const c of e.falseForm.slice(1)) {
      assert.ok(met.has(c), `t${e.turn} false form uses unmet constant "${c}": ${e.falseForm.join(' ')}`);
    }
  }

  // (2) The refusal: while only p1 is on stage (t2-t3: the sole released
  // premise offers no same-slot swap), a mutate-share-1 hit cannot mutate —
  // it falls back to a plain delete (v1 row shape, no mode/falseForm).
  for (const e of decays.filter((d) => d.turn <= 3)) {
    assert.equal(e.mode, undefined, `t${e.turn} should be a plain delete under an unmet pool`);
    assert.equal('falseForm' in e, false);
  }

  // (3) Staged still mutates once names ARE met: by t5 (p1+p4+p2 released)
  // the pool offers met-constant swaps, and the share-1 schedule uses them.
  assert.ok(
    mutates.some((e) => e.turn >= 5),
    'expected at least one mutation after enough names are met on stage',
  );
});

test('pool "staged" diverges from "world" on the same seed; explicit "world" is byte-identical to the pre-v3 default', async () => {
  const run = (pool) =>
    runDrama({
      world,
      roles: mockRoles({}, { readoptForgotten: true }),
      options: { decay: { ...STAGED_MUTATING, pool } },
    });
  const staged = await run('staged');
  const worldPool = await run('world');
  // The dial is live: same seed, different ledgers (world mutates at t2 where
  // staged must delete).
  assert.notDeepEqual(staged.corruption.ledger, worldPool.corruption.ledger);
  assert.equal(worldPool.corruption.ledger.find((e) => e.type === 'decay' && e.turn === 2)?.mode, 'mutate');
  // And the default IS "world": omitting the key replays the same stream.
  const { pool: _unused, ...withoutPool } = STAGED_MUTATING;
  const defaulted = await runDrama({
    world,
    roles: mockRoles({}, { readoptForgotten: true }),
    options: { decay: withoutPool },
  });
  assert.deepEqual(defaulted.corruption.ledger, worldPool.corruption.ledger);
  assert.deepEqual(
    defaulted.trajectory.map((p) => p.D),
    worldPool.trajectory.map((p) => p.D),
  );
});

// ---------------------------------------------------------------------------
// learner-view exclusion vs world-side ground truth (v1 visibility)
// ---------------------------------------------------------------------------

test('a decayed fact vanishes from the learner view but stays visible to the tutor as ground truth', async () => {
  const learnerViews = [];
  const tutorViews = [];
  const innerLearner = makeMockLearner({});
  // null-move tutor: never names a targetPremise, so nothing ever repairs
  const tutor = async (view) => {
    tutorViews.push(JSON.parse(JSON.stringify(view)));
    const entry = world.releaseSchedule.find((e) => e.turn === view.turn && e.via === 'tutor');
    return {
      dialogue: 'Sit with what you have.',
      move: { figure: 'erotema', targetPremise: null, intent: 'orient' },
      ...(entry ? { release: entry.premise } : {}),
    };
  };
  const learner = async (view) => {
    learnerViews.push(JSON.parse(JSON.stringify(view)));
    return innerLearner(view);
  };
  const result = await runDrama({
    world,
    roles: { director: makeMockDirector(world), tutor, learner },
    options: { maxTurns: 4, decay: AGGRESSIVE },
  });
  const p1Fact = world.premiseById.get('p1').fact;
  const p1Key = factKey(p1Fact);
  const hasP1 = (facts) => facts.some((f) => factKey(f) === p1Key);

  // t2: p1 is released to the learner and adopted
  assert.ok(hasP1(learnerViews[1].releasedThisTurn));
  // t2 end: p1 decays (grace 0). t3+t4 learner views: gone from the board AND
  // from releasedFacts — re-hearing it for free would make decay a no-op.
  for (const v of learnerViews.slice(2)) {
    assert.equal(hasP1(v.abox.grounded), false, `decayed fact on learner board at t${v.turn}`);
    assert.equal(hasP1(v.releasedFacts), false, `decayed fact in releasedFacts at t${v.turn}`);
    assert.equal('corruption' in v, false, 'learner view must never carry the corruption ground truth');
  }
  // the tutor's omniscient view names the slipped premise from t3 on
  for (const v of tutorViews.slice(2)) {
    assert.ok(v.corruption, `tutor view at t${v.turn} missing corruption block`);
    assert.ok(
      v.corruption.decayed.some((d) => d.premiseId === 'p1' && d.sinceTurn === 2),
      `tutor view at t${v.turn} does not name p1 as slipped`,
    );
  }
  // and decay events surface in the result events channel
  assert.ok(result.events.some((e) => e.type === 'decay' && e.turn === 2));
});

// ---------------------------------------------------------------------------
// corruptionReport (the diagnosis block the matrix table reads)
// ---------------------------------------------------------------------------

test('corruptionReport pairs decay→repair chronologically and totals the degradation burden', async () => {
  const repaired = await runDrama({
    world,
    roles: mockRoles({}, { readoptForgotten: true }),
    options: { decay: AGGRESSIVE },
  });
  const report = corruptionReport(repaired);
  assert.equal(report.decayEvents, 6);
  assert.deepEqual(report.repairs, { total: 6, byTutor: 1, byReadoption: 5 });
  assert.equal(report.meanRepairLatency, 1);
  assert.equal(report.unrepairedAtEnd, 0);
  assert.equal(report.degradedTurnIntegral, 6);
  assert.equal(report.dReversals, 0);
  assert.equal(report.timeline.length, 6);
  assert.ok(report.timeline.every((t) => t.repairTurn === t.decayTurn + 1));

  const unrepaired = await runDrama({ world, roles: mockRoles({}, {}), options: { decay: AGGRESSIVE } });
  const report2 = corruptionReport(unrepaired);
  assert.equal(report2.unrepairedAtEnd, 1);
  assert.ok(report2.dReversals >= 1);
  // unrepaired slips accrue burden until the run ends
  const open = report2.timeline.find((t) => t.repairTurn === null);
  assert.ok(open);
  assert.equal(
    report2.degradedTurnIntegral,
    report2.timeline.reduce((s, t) => s + ((t.repairTurn ?? unrepaired.turnsPlayed) - t.decayTurn), 0),
  );

  // the diagnosis object embeds the same block under `corruption`
  const d = diagnose(repaired, world);
  assert.deepEqual(d.corruption, report);
});

// Regression (lantern-revise-on, 2026-06-11): false-belief debts must be
// matched by FORM, not premise. A premise can re-mutate while an earlier
// false form still stands (false forms outlive repairs), and a premise-keyed
// open map orphans the older row — its later retraction was dropped, so the
// panel reported a false belief held to the end that the transcript showed
// struck. Shape below is the paid run's m_post sequence: mutate t10 (form A),
// repair t14, re-mutate t15 (form B), retract B t16, retract A t17.
test('corruptionReport credits retractions of overlapping false forms of one premise', () => {
  const truth = ['atTowerThatNight', 'brandt', 'harlowPoint'];
  const formA = ['atTowerThatNight', 'senna', 'harlowPoint'];
  const formB = ['atTowerThatNight', 'brandt', 'southStack'];
  const result = {
    turnsPlayed: 20,
    trajectory: [],
    corruption: {
      config: { seed: 1 },
      decayedAtEnd: [],
      ledger: [
        { type: 'decay', turn: 10, premiseId: 'm_post', fact: truth, mode: 'mutate', falseForm: formA },
        { type: 'repair', turn: 14, premiseId: 'm_post', via: 'tutor' },
        { type: 'decay', turn: 15, premiseId: 'm_post', fact: truth, mode: 'mutate', falseForm: formB },
        { type: 'retract_false', turn: 16, premiseId: 'm_post', falseForm: formB },
        { type: 'retract_false', turn: 17, premiseId: 'm_post', falseForm: formA },
      ],
    },
  };
  const report = corruptionReport(result);
  assert.equal(report.mutations.total, 2);
  assert.equal(report.mutations.retracted, 2);
  assert.equal(report.mutations.falseBeliefsAtEnd, 0);
  const [rowA, rowB] = report.timeline;
  assert.equal(rowA.retractTurn, 17);
  assert.equal(rowA.repairTurn, 14);
  assert.equal(rowB.retractTurn, 16);
  // fully revised = struck + restored: only the t10 episode has both debts closed
  assert.equal(report.mutations.revised, 1);
});

// ---------------------------------------------------------------------------
// twin-fact premise aliases (lantern, bitterwell)
// ---------------------------------------------------------------------------

// Two worlds deliberately stage the SAME fact under two premise ids
// (alternative evidentiary routes; only one twin is ever scheduled). Board
// state is keyed on the fact, so every REPORTED id must be the released
// twin's — last-writer-wins aliasing here poisoned id-comparing consumers
// (corruptionReport pairing, no-repair guards) in the v1 mock sweeps.
test('decay/repair identity names the released twin, never the unstaged alias', async () => {
  const cases = [
    {
      file: '../config/drama-derivation/world-002-lantern.yaml',
      released: 'p_residue',
      alias: 'p_glimpse',
      // grace 0 from the twin's release turn: it decays the turn it lands
      decay: { seed: 1, rate: 1, graceTurns: 0, maxConcurrent: 8, startTurn: 13 },
    },
    {
      file: '../config/drama-derivation/world-003-bitterwell.yaml',
      released: 'p_lantern',
      alias: 'p_verger',
      decay: { seed: 1, rate: 1, graceTurns: 0, maxConcurrent: 8, startTurn: 12 },
    },
  ];
  for (const c of cases) {
    const twinWorld = loadWorld(path.resolve(path.dirname(fileURLToPath(import.meta.url)), c.file));
    // sanity: the twins really are one fact under two ids
    assert.equal(
      factKey(twinWorld.premiseById.get(c.released).fact),
      factKey(twinWorld.premiseById.get(c.alias).fact),
      `${c.released}/${c.alias} should share a fact key`,
    );
    const result = await runDrama({
      world: twinWorld,
      roles: {
        director: makeMockDirector(twinWorld),
        tutor: makeMockTutor(twinWorld, {}),
        learner: makeMockLearner({}),
      },
      options: { decay: c.decay },
    });
    const corruptionIds = [
      ...result.corruption.ledger.map((e) => e.premiseId),
      ...result.corruption.decayedAtEnd.map((d) => d.premiseId),
    ];
    // the released twin's slip is reported under ITS id...
    assert.ok(
      result.corruption.ledger.some((e) => e.type === 'decay' && e.premiseId === c.released),
      `${c.released} should decay under its own id`,
    );
    // ...and the unstaged alias never appears anywhere
    assert.ok(
      corruptionIds.every((id) => id !== c.alias),
      `unstaged alias ${c.alias} leaked into the corruption record`,
    );
    // every reported id was actually released in THIS run
    const releasedIds = new Set(result.ledger.map((e) => e.premiseId));
    for (const id of corruptionIds) {
      assert.ok(releasedIds.has(id), `${id} reported but never released`);
    }
    // the scorer-level pin: with ids canonical, every repair closes a decay —
    // the mock tutor's consolidate move repairs the twin incidentally, so the
    // pairing is exercised, not vacuous
    assert.ok(
      result.corruption.ledger.some((e) => e.type === 'repair' && e.premiseId === c.released),
      `expected an incidental tutor repair of ${c.released}`,
    );
    const report = corruptionReport(result);
    assert.equal(
      report.repairs.total,
      report.timeline.filter((t) => t.repairTurn !== null).length,
      'every repair event should close a decay row (id-keyed pairing)',
    );
  }
});

// ---------------------------------------------------------------------------
// decay visibility (the G3 dial — UNRELIABLE-LEARNER-PREREG.md §7)
// arm A 'told': the tutor ego user prompt carries the SLIPPED block;
// arm B 'conduct': the block is suppressed and the tutor prompt is
// byte-identical to a corruption-free render. The engine view and the
// corruption instruments keep ground truth in BOTH arms — the manipulation
// is textual, nothing else may move.
// ---------------------------------------------------------------------------

const TUTOR_SCRIPT = 'Teach by questions; never state the conclusion yourself.';

/** Client that records every (role, system, user) and answers from the mock backend. */
function recordingLlmClient() {
  const inner = makeLlmClient({ mode: 'mock' });
  const payloads = [];
  return {
    payloads,
    client: {
      mode: inner.mode,
      usage: inner.usage,
      call(role, payload) {
        payloads.push({ role, system: payload.system, user: payload.user });
        return inner.call(role, payload);
      },
    },
  };
}

test('makeLlmTutor rejects unknown decayVisibility values', () => {
  assert.throws(
    () => makeLlmTutor(world, { call() {} }, { script: TUTOR_SCRIPT, decayVisibility: 'blind' }),
    /decayVisibility/,
  );
});

test('told renders the SLIPPED block; conduct is byte-identical to a corruption-free render', async () => {
  const capture = () => {
    const calls = [];
    return {
      calls,
      client: {
        mode: 'mock',
        usage: () => ({}),
        call(role, payload) {
          calls.push({ role, system: payload.system, user: payload.user });
          return JSON.stringify({
            dialogue: 'A line.',
            move: { figure: 'erotema', target_premise: null, intent: 'consolidate' },
          });
        },
      },
    };
  };
  const baseView = {
    turn: 3,
    learnerAbox: { grounded: [['water', 'reaches', 'well']], hypotheses: [] },
    trajectory: [{ turn: 2, D: 2, forced: false }],
    ledger: [{ premiseId: 'p1' }],
    transcript: [{ turn: 2, role: 'tutor', text: 'Consider the well.' }],
  };
  const decayedView = {
    ...baseView,
    corruption: { decayed: [{ premiseId: 'p1', fact: ['water', 'reaches', 'well'], sinceTurn: 2 }], repaired: [] },
  };

  const told = capture();
  await makeLlmTutor(world, told.client, { script: TUTOR_SCRIPT })(decayedView);
  assert.match(told.calls[0].user, /SLIPPED FROM THE BOARD/);
  assert.match(told.calls[0].user, /p1 \(since turn 2\)/);

  const conduct = capture();
  await makeLlmTutor(world, conduct.client, { script: TUTOR_SCRIPT, decayVisibility: 'conduct' })(decayedView);
  const clean = capture();
  await makeLlmTutor(world, clean.client, { script: TUTOR_SCRIPT })(baseView);
  assert.equal(conduct.calls[0].user.includes('SLIPPED'), false);
  assert.equal(conduct.calls[0].user, clean.calls[0].user);
  assert.equal(conduct.calls[0].system, clean.calls[0].system);
});

test('end-to-end blindness: under conduct no role prompt ever carries the notice; under told only the tutor ego does; the formal channel is invariant', async () => {
  const run = async (decayVisibility) => {
    const rec = recordingLlmClient();
    const roles = {
      director: makeLlmDirector(world, rec.client, {}),
      tutor: makeLlmTutor(world, rec.client, { script: TUTOR_SCRIPT, superego: true, decayVisibility }),
      learner: makeLlmLearner({ setting: world.setting, voice: world.learnerVoice, client: rec.client }),
    };
    const result = await runDrama({ world, roles, options: { decay: AGGRESSIVE } });
    return { rec, result };
  };

  const told = await run('told');
  const decayEvents = told.result.corruption.ledger.filter((e) => e.type === 'decay');
  assert.ok(decayEvents.length > 0, 'precondition: the mock drama must actually decay');
  const slipped = told.rec.payloads.filter((p) => `${p.system}\n${p.user}`.includes('SLIPPED FROM THE BOARD'));
  assert.ok(slipped.length > 0, 'told arm: the notice must reach the tutor');
  assert.ok(
    slipped.every((p) => p.role === 'tutor'),
    'the notice may reach ONLY the tutor ego — superego/learner/director are blind by construction',
  );

  const conduct = await run('conduct');
  assert.equal(
    conduct.rec.payloads.some((p) => `${p.system}\n${p.user}`.includes('SLIPPED')),
    false,
    'conduct arm: no prompt for any role may carry the notice',
  );
  // The manipulation is textual: with the prompt-indifferent mock cast the
  // two arms must agree on every formal field — corruption schedule included.
  assert.deepEqual(
    conduct.result.corruption.ledger.filter((e) => e.type === 'decay'),
    decayEvents,
  );
  assert.deepEqual(
    conduct.result.trajectory.map((p) => p.D),
    told.result.trajectory.map((p) => p.D),
  );
  assert.deepEqual(conduct.result.ledger, told.result.ledger);
});
