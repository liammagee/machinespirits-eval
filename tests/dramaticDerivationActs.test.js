/**
 * Stage v2 — acts, the bounded learner, mutation, the reconstructing tutor
 * (engine.js header; design note notes/poetics/2026-06-11-act-bounded-
 * learner-design.md). What these tests pin, in order of importance:
 *
 *   1. off-state invariance — acts off AND mutateShare 0 means the engine
 *      result is field-for-field what v1 produced (the same rail the decay
 *      condition ran for the pre-decay engine, one stage up);
 *   2. the engine owns act boundaries — the director's end verdict is
 *      overridden below minActTurns (act_min_blocked), force-applied at
 *      maxActTurns (harness_max), and turn 1's direction is Act 1's brief
 *      regardless of any verdict;
 *   3. the bounded learner — at an act boundary the learner's view drops
 *      prior acts' prose/releases/voicings; its theory store is the only
 *      thing that crosses;
 *   4. acts-mode view redaction — the tutor's view is the base object ONLY
 *      (no learner store, no trajectory, no corruption, no frontier), in
 *      BOTH probe arms; the director keeps its instruments but loses the
 *      store dump and the corruption ledger;
 *   5. mutation opens two debts — a mutate slip is a deletion (closed by
 *      repair) PLUS a false belief (closed by retract_false); a completed
 *      revision closes both, and the trajectory shows it;
 *   6. reconstruction is recorded beside harness truth — per-turn theory
 *      commits land in result.reconstruction with the snapshot the engine
 *      took at the same moment, and reconstructionReport scores them.
 *
 * All scenarios run the deterministic mock cast on the smoke world, so every
 * assertion is an exact pin, not a tolerance.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  factKey,
  loadWorld,
  runDrama,
  normalizeActsConfig,
  corruptionReport,
  reconstructionReport,
  diagnose,
  renderEvalPanel,
  renderTranscript,
  makeMockDirector,
  makeMockTutor,
  makeMockLearner,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_PATH = path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml');

const world = loadWorld(WORLD_PATH);

const mockRoles = (tutorPolicy = {}, learnerPolicy = {}, directorPolicy = {}) => ({
  director: makeMockDirector(world, directorPolicy),
  tutor: makeMockTutor(world, tutorPolicy),
  learner: makeMockLearner(learnerPolicy),
});

const HAPPY_D_CURVE = [3, 2, 2, 2, 1, 1, 1, 0];

// v1's aggressive schedule (every eligible premise slips every turn, one at a
// time) — reused so the mutation arms are the SAME schedule with the mode
// dial turned.
const AGGRESSIVE = { seed: 1, rate: 1, graceTurns: 0, maxConcurrent: 1, startTurn: 2 };
const MUTATING = { ...AGGRESSIVE, mutateShare: 1 };

// The deterministic candidate pool for a mutation of p1 [child marin tessa]
// on this world: same-slot constants harvested from premises + background,
// minus collisions with premises (p4 blocks [child joren tessa]), the board,
// the secret/mirror, and the question pattern.
const P1_FALSE_FORMS = [
  ['child', 'tessa', 'tessa'],
  ['child', 'marin', 'founder'],
];
const isP1FalseForm = (fact) => P1_FALSE_FORMS.some((f) => factKey(f) === factKey(fact));

/**
 * A learner that repairs BOTH mutation debts from its view alone: re-adopts
 * facts it once held that vanished (the v1 channel, via mockRoles), and
 * retracts any board fact it never heard and that is not background — the
 * only view-legitimate false-belief detector, and exactly the epistemic
 * position the real LLM learner is in.
 */
function makeRevisingLearner(recordedBoards = null) {
  const inner = makeMockLearner({ readoptForgotten: true });
  const heardKeys = new Set();
  let backgroundKeys = null;
  return async (view) => {
    if (!backgroundKeys) backgroundKeys = new Set(view.background.map(factKey));
    for (const fact of view.releasedThisTurn) heardKeys.add(factKey(fact));
    if (recordedBoards) recordedBoards.push({ turn: view.turn, grounded: view.abox.grounded.map((f) => [...f]) });
    const out = await inner(view);
    const retract = view.abox.grounded.filter(
      (fact) => !heardKeys.has(factKey(fact)) && !backgroundKeys.has(factKey(fact)),
    );
    return retract.length ? { ...out, retract } : out;
  };
}

// ---------------------------------------------------------------------------
// config validation
// ---------------------------------------------------------------------------

test('normalizeActsConfig fills defaults, accepts JSON strings, rejects junk', () => {
  assert.deepEqual(normalizeActsConfig({}), { minActTurns: 3, maxActTurns: 8 });
  assert.deepEqual(normalizeActsConfig('{"maxActTurns":5}'), { minActTurns: 3, maxActTurns: 5 });
  assert.throws(() => normalizeActsConfig({ unknownKnob: 1 }), /unknownKnob/);
  assert.throws(() => normalizeActsConfig({ minActTurns: 0 }), /minActTurns/);
  assert.throws(() => normalizeActsConfig({ minActTurns: 2.5 }), /minActTurns/);
  assert.throws(() => normalizeActsConfig({ minActTurns: 6, maxActTurns: 4 }), /must not exceed/);
  assert.throws(() => normalizeActsConfig('not json'), /JSON|json/);
  assert.throws(() => normalizeActsConfig([3, 8]), /object/);
});

// ---------------------------------------------------------------------------
// off-state invariance (the stage-v2 safety rail)
// ---------------------------------------------------------------------------

test('acts off + mutateShare 0: the result is field-for-field the v1 decay result', async () => {
  const run = (decay) => runDrama({ world, roles: mockRoles({}, {}), options: { decay } });
  const v1 = await run(AGGRESSIVE);
  const v2 = await run({ ...AGGRESSIVE, mutateShare: 0 });
  // Byte-identity: the mode/pick draws happen only when mutateShare > 0, so
  // the rng stream, the ledger, the trajectory (F included), and every other
  // field agree exactly.
  assert.deepEqual(v2, v1);
  assert.equal('acts' in v1, false);
  assert.equal('reconstruction' in v1, false);
  assert.ok(v1.corruption.ledger.every((e) => !('mode' in e) && !('falseForm' in e)));
  const d = diagnose(v1, world);
  assert.equal('acts' in d, false);
  assert.equal('reconstruction' in d, false);
  assert.deepEqual(d.corruption.mutations, { total: 0, retracted: 0, revised: 0, falseBeliefsAtEnd: 0 });
});

test('without options.acts the happy path carries no act state and no theory channel', async () => {
  const result = await runDrama({ world, roles: mockRoles() });
  assert.equal('acts' in result, false);
  assert.equal('reconstruction' in result, false);
  assert.equal(reconstructionReport(result), null);
  assert.ok(result.events.every((e) => e.type !== 'act_end' && e.type !== 'act_min_blocked'));
});

// ---------------------------------------------------------------------------
// act boundaries: the engine owns them
// ---------------------------------------------------------------------------

test('a verdict-less director is force-closed at maxActTurns; the formal channel is untouched', async () => {
  const result = await runDrama({
    world,
    roles: mockRoles(),
    options: { acts: { minActTurns: 1, maxActTurns: 3 } },
  });
  // Acts bound the learner's CONTEXT, not the play's formal channel: with a
  // compliant cast the drama lands exactly where the unbounded happy path did.
  assert.equal(result.verdict, 'grounded_anagnorisis');
  assert.equal(result.turnsPlayed, 8);
  assert.deepEqual(
    result.trajectory.map((p) => p.D),
    HAPPY_D_CURVE,
  );
  assert.deepEqual(result.acts, [
    {
      act: 1,
      turns: [1, 3],
      endedBy: 'harness_max',
      brief: '[Turn 1. The question hangs in the air: Who is the rightful heir of House Aldra?]',
    },
    {
      act: 2,
      turns: [4, 6],
      endedBy: 'harness_max',
      brief: '[The scene turns: it comes to light that child joren tessa.]',
    },
    {
      act: 3,
      turns: [7, 8],
      endedBy: 'run_end',
      brief: '[Turn 7. The question hangs in the air: Who is the rightful heir of House Aldra?]',
    },
  ]);
  assert.deepEqual(
    result.events.filter((e) => e.type === 'act_end').map((e) => e.turn),
    [4, 7],
  );
  // The synthesized `Act N` phases ARE the realized dramaturgy: every
  // phase-reading instrument (stagingSegments → diagnose) works unchanged.
  const d = diagnose(result, world);
  assert.deepEqual(d.acts, result.acts);
  assert.equal(d.staging.source, 'director');
  assert.deepEqual(
    d.staging.movements.map((m) => ({ turn: m.turn, name: m.name })),
    [
      { turn: 1, name: 'Act 1' },
      { turn: 4, name: 'Act 2' },
      { turn: 7, name: 'Act 3' },
    ],
  );
  assert.match(renderEvalPanel(d), /\*\*acts\*\* 3 played · closed by the director 0 · at max length 2 · at run end 1/);
});

test('director end verdicts: ignored at turn 1, blocked below minActTurns, applied at the guard', async () => {
  const result = await runDrama({
    world,
    roles: mockRoles({}, {}, { endActAt: [1, 2, 4] }),
    options: { acts: { minActTurns: 3, maxActTurns: 8 } },
  });
  // t1: the verdict is ignored — turn 1's direction IS Act 1's brief.
  // t2: end wanted at 1 turn into the act → overridden (act_min_blocked).
  // t4: end wanted at 3 turns → applied; act 1 closes at turn 3.
  assert.deepEqual(result.acts, [
    {
      act: 1,
      turns: [1, 3],
      endedBy: 'director',
      brief: '[The act closes on turn 1; press the chain one link further.]',
    },
    {
      act: 2,
      turns: [4, 8],
      endedBy: 'run_end',
      brief: '[The scene turns: it comes to light that child joren tessa.]',
    },
  ]);
  assert.deepEqual(
    result.events.filter((e) => e.type === 'act_min_blocked').map((e) => e.turn),
    [2],
  );
  assert.deepEqual(
    result.events.filter((e) => e.type === 'act_end').map((e) => e.turn),
    [4],
  );
  // The blocked end at t2 did not eat the director's scheduled release.
  assert.ok(result.ledger.some((e) => e.premiseId === 'p1' && e.turn === 2 && e.via === 'director'));
  assert.equal(result.verdict, 'grounded_anagnorisis');
  // The transcript marks the verdict the engine applied.
  const directorMeta = result.transcript.filter((l) => l.role === 'director').map((l) => l.meta.act);
  assert.equal(directorMeta[0], 'end'); // recorded as spoken, even though ignored at t1
  assert.match(renderTranscript(result, world), /calls the act closed/);
});

// ---------------------------------------------------------------------------
// the bounded learner: only the current act is on stage
// ---------------------------------------------------------------------------

test("an act boundary clears the learner's stage; its theory store is the only carry-over", async () => {
  const views = [];
  const inner = makeMockLearner({});
  const learner = async (view) => {
    views.push(view);
    return inner(view);
  };
  const result = await runDrama({
    world,
    roles: { director: makeMockDirector(world), tutor: makeMockTutor(world, {}), learner },
    options: { acts: { minActTurns: 1, maxActTurns: 3 } },
  });
  assert.equal(result.verdict, 'grounded_anagnorisis');
  const at = (turn) => views.find((v) => v.turn === turn);
  const facts = (xs) => xs.map((f) => f.join(' ')).sort();

  // Act 1 (turns 1–3): the released record accumulates as in v1.
  assert.deepEqual(at(3).act, { index: 1, startTurn: 1, brief: at(1).act.brief });
  assert.deepEqual(facts(at(3).releasedFacts), ['child marin tessa']);

  // Act 2 opens at t4: p1 (released t2, a prior act) drops from the released
  // record and from the visible transcript — but stays on the learner's board.
  assert.deepEqual(at(5).act.index, 2);
  assert.equal(at(5).act.startTurn, 4);
  assert.deepEqual(facts(at(5).releasedFacts), ['child joren tessa', 'child tessa founder']);
  assert.ok(at(5).transcript.every((l) => l.turn >= 4));
  assert.ok(facts(at(5).abox.grounded).includes('child marin tessa'));

  // Act 3 opens at t7: only p3 (t8) is of this act; the board still carries
  // everything adopted across all three acts.
  assert.deepEqual(at(8).act.index, 3);
  assert.deepEqual(facts(at(8).releasedFacts), ['bearsMark marin']);
  assert.ok(at(8).transcript.every((l) => l.turn >= 7));
  assert.deepEqual(facts(at(8).abox.grounded), [
    'child joren tessa',
    'child marin tessa',
    'child tessa founder',
    'livesAt marin harbor',
  ]);

  // releasedThisTurn is a per-turn channel — bounding never touches it.
  assert.deepEqual(facts(at(8).releasedThisTurn), ['bearsMark marin']);
  // Single-concealment holds in acts mode too.
  assert.ok(views.every((v) => !('corruption' in v) && !('staging' in v) && !('world' in v)));

  // Contrast: acts off, same cast → the released record is cumulative.
  const offViews = [];
  const offLearner = async (view) => {
    offViews.push(view);
    return makeMockLearner({})(view);
  };
  await runDrama({
    world,
    roles: { director: makeMockDirector(world), tutor: makeMockTutor(world, {}), learner: offLearner },
  });
  const off5 = offViews.find((v) => v.turn === 5);
  assert.deepEqual(facts(off5.releasedFacts), ['child joren tessa', 'child marin tessa', 'child tessa founder']);
  assert.equal('act' in off5, false);
});

// ---------------------------------------------------------------------------
// acts-mode view redaction + reconstruction recording (the probe-arm shape)
// ---------------------------------------------------------------------------

test('acts mode redacts the tutor view to the base object and strips the director to instruments-only', async () => {
  const tutorViews = [];
  const directorViews = [];
  const innerTutor = makeMockTutor(world, { reconstruct: true });
  const innerDirector = makeMockDirector(world);
  const result = await runDrama({
    world,
    roles: {
      director: async (view) => {
        directorViews.push(view);
        return innerDirector(view);
      },
      tutor: async (view) => {
        tutorViews.push(view);
        return innerTutor(view);
      },
      learner: makeRevisingLearner(),
    },
    options: { acts: { minActTurns: 1, maxActTurns: 3 }, decay: MUTATING },
  });

  // The tutor's blindness is total and structural, in BOTH probe arms: the
  // base object only — no learner store, no trajectory, no corruption ground
  // truth, no inference frontier (each is computed FROM the hidden store).
  for (const v of tutorViews) {
    assert.deepEqual(Object.keys(v).sort(), [
      'acts',
      'ledger',
      'publicRegister',
      'releasedFacts',
      'role',
      'staging',
      'transcript',
      'turn',
      'world',
    ]);
  }

  // The director keeps its evaluative instruments (it must judge an act's
  // work done) but loses the store dump and the corruption ledger — briefs
  // must not be able to smuggle slip identities to the tutor.
  for (const v of directorViews) {
    assert.deepEqual(Object.keys(v).sort(), [
      'acts',
      'inference',
      'learnerAbox',
      'ledger',
      'publicRegister',
      'releasedFacts',
      'role',
      'staging',
      'trajectory',
      'transcript',
      'turn',
      'world',
    ]);
    assert.deepEqual(Object.keys(v.learnerAbox).sort(), ['groundedCount', 'hypotheses']);
    assert.equal(typeof v.learnerAbox.groundedCount, 'number');
    assert.deepEqual(Object.keys(v.acts).sort(), [
      'brief',
      'closed',
      'index',
      'maxActTurns',
      'minActTurns',
      'startTurn',
      'turnsThisAct',
    ]);
  }

  // The adapt-ON arm's machinery coexists with the redaction: theory commits
  // recorded beside harness truth, decay instruments intact, acts played.
  assert.ok(result.reconstruction.length > 0);
  assert.ok(result.acts.length >= 2);
  assert.ok(result.corruption.ledger.length > 0);
  const panel = renderEvalPanel(diagnose(result, world));
  assert.match(panel, /\*\*acts\*\*/);
  assert.match(panel, /\*\*reconstruction\*\*/);
  assert.match(panel, /\*\*decay\*\*/);

  // Contrast: acts off, the v1 visibility — the tutor view carries the
  // corruption ground truth and the full learner store.
  const offTutorViews = [];
  await runDrama({
    world,
    roles: {
      director: makeMockDirector(world),
      tutor: async (view) => {
        offTutorViews.push(view);
        return makeMockTutor(world, {})(view);
      },
      learner: makeMockLearner({}),
    },
    options: { decay: AGGRESSIVE },
  });
  const late = offTutorViews[offTutorViews.length - 1];
  assert.ok('corruption' in late);
  assert.ok(Array.isArray(late.learnerAbox.grounded));
  assert.ok('trajectory' in late);
});

// ---------------------------------------------------------------------------
// mutation: a slip opens two debts; a revision closes both
// ---------------------------------------------------------------------------

test('mutate slips are revised within a turn: false form struck, true premise re-adopted, trajectory clean', async () => {
  const boards = [];
  const result = await runDrama({
    world,
    roles: {
      director: makeMockDirector(world),
      tutor: makeMockTutor(world, {}),
      learner: makeRevisingLearner(boards),
    },
    options: { decay: MUTATING },
  });

  // The revision channel at latency 1 keeps the formal channel exactly on the
  // happy path: same verdict, same turn, same D-curve — and F(t) reads 1.0 at
  // every measurement point (instrumentation runs after the learner's repair,
  // before the end-of-turn decay draw).
  assert.equal(result.verdict, 'grounded_anagnorisis');
  assert.equal(result.turnsPlayed, 8);
  assert.deepEqual(
    result.trajectory.map((p) => p.D),
    HAPPY_D_CURVE,
  );
  assert.ok(result.trajectory.every((p) => p.F === 1));

  // The schedule: p1 (first on the board, the only proof-path premise staged
  // before t4) decays at the end of every turn 2..7, ALWAYS as a mutation
  // (mutateShare 1), and both debts close the following turn.
  const decays = result.corruption.ledger.filter((e) => e.type === 'decay');
  const retracts = result.corruption.ledger.filter((e) => e.type === 'retract_false');
  const repairs = result.corruption.ledger.filter((e) => e.type === 'repair');
  assert.deepEqual(
    decays.map((e) => e.turn),
    [2, 3, 4, 5, 6, 7],
  );
  for (const e of decays) {
    assert.equal(e.mode, 'mutate');
    assert.equal(e.premiseId, 'p1');
    assert.deepEqual(e.fact, ['child', 'marin', 'tessa']);
    assert.ok(isP1FalseForm(e.falseForm), `unexpected false form ${JSON.stringify(e.falseForm)}`);
  }
  assert.deepEqual(
    retracts.map((e) => e.turn),
    [3, 4, 5, 6, 7, 8],
  );
  for (const e of retracts) {
    assert.equal(e.premiseId, 'p1');
    assert.ok(isP1FalseForm(e.falseForm));
  }
  assert.ok(repairs.every((e) => e.premiseId === 'p1'));
  // t3's repair arrives in the TUTOR phase: the no-policy tutor's consolidate
  // move targets the last release (still p1), and a move that targets a
  // decayed premise re-stages it. From t4 the consolidation target moves on
  // with the ledger, so the learner's re-adoption closes the deletion debt.
  assert.deepEqual(
    repairs.map((e) => `${e.turn}:${e.via}`),
    ['3:tutor', '4:readoption', '5:readoption', '6:readoption', '7:readoption', '8:readoption'],
  );
  // Ledger order pins the phase structure: the t3 repair (tutor phase)
  // precedes the t3 retraction (learner phase); within a learner turn the
  // false form is struck BEFORE the true premise returns (retract → adopt).
  const types = result.corruption.ledger.map((e) => `${e.turn}:${e.type}`);
  assert.deepEqual(types.slice(0, 6), [
    '2:decay',
    '3:repair',
    '3:retract_false',
    '3:decay',
    '4:retract_false',
    '4:repair',
  ]);

  // The false belief was VISIBLE to the learner while it stood: each turn
  // after a mutation, the belief board carries exactly one false form.
  for (const { turn, grounded } of boards.filter((b) => b.turn >= 3)) {
    const falseHeld = grounded.filter((f) => isP1FalseForm(f));
    assert.equal(falseHeld.length, 1, `expected one standing false belief on the t${turn} board`);
  }

  // corruptionReport closes the books: every mutation fully revised.
  const report = corruptionReport(result);
  assert.deepEqual(report.mutations, { total: 6, retracted: 6, revised: 6, falseBeliefsAtEnd: 0 });
  assert.deepEqual(report.repairs, { total: 6, byTutor: 1, byReadoption: 5 });
  assert.equal(report.meanRepairLatency, 1);
  assert.equal(report.unrepairedAtEnd, 0);
  assert.equal(report.degradedTurnIntegral, 6);
  assert.equal(report.dReversals, 0);
  assert.deepEqual(report.fidelity, { final: 1, min: 1 });
  assert.ok(report.timeline.every((t) => t.mode === 'mutate' && t.retractTurn === t.decayTurn + 1));
  const panel = renderEvalPanel(diagnose(result, world));
  assert.match(panel, /\*\*mutations\*\* 6 of the slips misremembered .* fully revised \(struck \+ restored\) 6/);
  assert.match(panel, /\*\*theory fidelity\*\* F 1 at end · min 1/);
});

test('an unrevised mutation stands: the false belief persists, fidelity drops, the drama fails', async () => {
  const result = await runDrama({
    world,
    roles: mockRoles({}, {}),
    options: { decay: MUTATING },
  });
  // p1 mutates at t2 end; the tutor's t3 consolidate move re-stages it
  // (closing the deletion debt and freeing the maxConcurrent slot), so it
  // mutates AGAIN at t3 end. Nothing ever strikes either false form: the
  // plain learner does not revise, and a re-stage never retracts. Two false
  // beliefs stand to the end and the proof path stays blocked.
  assert.notEqual(result.verdict, 'grounded_anagnorisis');
  const decays = result.corruption.ledger.filter((e) => e.type === 'decay');
  assert.equal(decays.length, 2);
  assert.ok(decays.every((e) => e.premiseId === 'p1' && e.mode === 'mutate' && isP1FalseForm(e.falseForm)));
  // The second draw cannot repeat the first false form: it still stands on
  // the belief board, and board facts are excluded from the candidate pool.
  assert.notDeepEqual(decays[0].falseForm, decays[1].falseForm);
  assert.equal(result.corruption.ledger.filter((e) => e.type === 'retract_false').length, 0);
  assert.deepEqual(
    result.corruption.ledger.filter((e) => e.type === 'repair').map((e) => `${e.turn}:${e.via}`),
    ['3:tutor'],
  );
  assert.deepEqual(
    result.corruption.decayedAtEnd.map((d) => d.premiseId),
    ['p1'],
  );

  const report = corruptionReport(result);
  assert.deepEqual(report.mutations, { total: 2, retracted: 0, revised: 0, falseBeliefsAtEnd: 2 });
  assert.ok(report.fidelity.final < 1);
  assert.ok(report.fidelity.min < 1);
  assert.ok(report.dReversals >= 1);

  // The false belief counts for the learner's board, never for forcing: F < 1
  // from the turn after the first mutation. D is masked at t3 by the tutor's
  // re-stage and reopens at t4 once the second mutation stands unrepaired.
  const f3 = result.trajectory.find((p) => p.turn === 3);
  assert.ok(f3.F < 1);
  const f4 = result.trajectory.find((p) => p.turn === 4);
  assert.ok(f4.D > f3.D);
});

// ---------------------------------------------------------------------------
// the reconstructing tutor: theory commits recorded beside harness truth
// ---------------------------------------------------------------------------

test('per-turn theory commits are recorded with harness-truth snapshots; the credulous tutor catches nothing', async () => {
  const result = await runDrama({
    world,
    roles: mockRoles({ reconstruct: true }, {}),
    options: { decay: AGGRESSIVE },
  });
  assert.ok(Array.isArray(result.reconstruction));
  assert.equal(result.reconstruction.length, result.turnsPlayed);
  assert.deepEqual(
    result.reconstruction.map((r) => r.turn),
    Array.from({ length: result.turnsPlayed }, (_, i) => i + 1),
  );

  // t2: p1 was released by the director moments earlier — the learner has
  // not yet spoken, so the truth snapshot has it missing; the credulous
  // theory (everything staged is held) is already wrong.
  assert.deepEqual(result.reconstruction[1], {
    turn: 2,
    believed: { believed_held: ['p1'], believed_missing: [], believed_mistaken: [] },
    truth: { held: [], missing: ['p1'], mistaken: [] },
  });
  // t3: p1 decayed at the end of t2 (delete mode — no mistaken entries ever).
  assert.deepEqual(result.reconstruction[2].truth, { held: [], missing: ['p1'], mistaken: [] });
  assert.ok(result.reconstruction.every((r) => r.truth.mistaken.length === 0));

  const report = reconstructionReport(result);
  assert.equal(report.turns, result.turnsPlayed);
  assert.ok(report.missing.actual > 0);
  assert.equal(report.missing.caught, 0);
  assert.equal(report.missing.rate, 0);
  assert.deepEqual(report.mistaken, { actual: 0, caught: 0, rate: null });
  assert.equal(report.perTurn[0].heldJaccard, 1); // t1: nothing staged, nothing believed
  const d = diagnose(result, world);
  assert.deepEqual(d.reconstruction, report);
  assert.match(renderEvalPanel(d), /\*\*reconstruction\*\* \d+ theory commits .* gaps caught 0\//);
});

test('a tutor that names the gaps and the false belief scores full detection', async () => {
  // Oracle-shaped theory WITHOUT oracle access: claim every staged premise
  // missing and p1 mistaken, every turn. The theory is committed AFTER the
  // tutor's own release lands, so on its release turns the tutor must count
  // the premise it just staged among the missing (the learner has not yet
  // spoken) — view.ledger alone predates the release and would miss it.
  // Detection rates must then equal 1 wherever the harness truth has
  // entries — this pins the report's direction (caught ⊆ actual, rated
  // against actual).
  const innerTutor = makeMockTutor(world, {});
  const tutor = async (view) => {
    const out = await innerTutor(view);
    return {
      ...out,
      theory: {
        believed_held: [],
        believed_missing: [...view.ledger.map((e) => e.premiseId), ...(out.release ? [out.release] : [])],
        believed_mistaken: ['p1'],
      },
    };
  };
  const result = await runDrama({
    world,
    roles: { director: makeMockDirector(world), tutor, learner: makeMockLearner({}) },
    options: { decay: MUTATING },
  });
  const report = reconstructionReport(result);
  assert.ok(report.missing.actual > 0);
  assert.equal(report.missing.rate, 1);
  assert.ok(report.mistaken.actual > 0);
  assert.equal(report.mistaken.rate, 1);
  // The mutation surfaces in the truth channel from t3 on.
  const t3 = result.reconstruction.find((r) => r.turn === 3);
  assert.deepEqual(t3.truth.mistaken, ['p1']);
});

// ---------------------------------------------------------------------------
// CLI guards (the loop script refuses incoherent stage-v2 arms before any work)
// ---------------------------------------------------------------------------

test('run-derivation-loop refuses --reconstruct without --acts and told-visibility in acts mode', () => {
  const loop = path.join(ROOT, 'scripts/run-derivation-loop.js');
  const run = (args) => spawnSync(process.execPath, [loop, ...args], { cwd: ROOT, encoding: 'utf8' });

  const orphanReconstruct = run(['--reconstruct']);
  assert.equal(orphanReconstruct.status, 1);
  assert.match(orphanReconstruct.stderr, /--reconstruct requires --acts/);

  const toldInActs = run(['--acts', '{}', '--decay-visibility', 'told']);
  assert.equal(toldInActs.status, 1);
  assert.match(toldInActs.stderr, /acts mode implies conduct/);
});
