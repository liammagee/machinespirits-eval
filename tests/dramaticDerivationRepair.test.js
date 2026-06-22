/**
 * §12 dial — the repair clause (notes/poetics/2026-06-11-desire-multiturn-
 * strategy-plan.md §12). The lantern-p2 located failure: a silent slip the
 * LEARNER reported twice went unanswered because the confrontation machinery
 * covers only tutor-initiated re-entries. The clause is the exception that
 * runs the other way: a learner-named loss IS the read-back; the tutor's
 * next turn re-stages the named exhibit (declared intent "restore") before
 * any new matter; the superego verifies the claimed license against the
 * learner's last line. Guarantees:
 *
 *   A. BUILD GUARDS — the clause is an exception WITHIN the confrontation
 *      obligation; repairClause without confront fails at build.
 *   B. CHARTER STABILITY — confront-only charters are unchanged (no repair
 *      text, no "restore" intent); --repair-clause adds exactly the clause
 *      (tutor), the license paragraph (superego), and the intent.
 *   C. BRIDGE ARITHMETIC — a "restore" draft records restoreClaim with due
 *      false (the harness states the claim, never judges the learner's
 *      natural-language line; the slip ledger stays hidden); a watcher fire
 *      on the claim resolves to the re-entry jurisdiction and converts the
 *      move to the confrontation; off the dial the intent is a plain
 *      re-entry.
 *   D. ENGINE CONTRACT — a restore move that targets a decayed premise
 *      repairs it on its own turn (repair is target-based; only confront is
 *      excepted).
 *   E. INSTRUMENTS — confrontReport buckets restores apart from
 *      covered/uncovered, with ground-truth targetDecayed/repaired read
 *      post-hoc from the slip ledger; a restore spends any standing license;
 *      restore-claim fires never count against the detector audit; keys stay
 *      absent off the dial; the panel renders the repair-clause line.
 *   F. MOCK CHAIN — the full §12 arm config on lantern composes zero-cost;
 *      the mock cast never claims a restore, so the bucket stays absent.
 *
 * NOTE the mock-artifact boundary (as in the stall-watch, confront, and
 * plot suites): these exercise plumbing and instruments, never the
 * hypothesis — whether a real tutor obeys the clause is the paid arm's
 * question.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadWorld,
  runDrama,
  makeLlmClient,
  makeLlmDirector,
  makeLlmTutor,
  makeLlmLearner,
  diagnose,
  confrontReport,
  renderEvalPanel,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const smokeWorld = loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));
const lanternWorld = loadWorld(path.join(ROOT, 'config/drama-derivation/world-002-lantern.yaml'));
const lanternScript = fs.readFileSync(path.join(ROOT, 'config/drama-derivation/tutor-scripts/lantern-v001.md'), 'utf8');
const SCRIPT = 'Stay with the inquiry; release on cue; never name the conclusion.';

/** Build options for a legal acts-mode tutor (decayVisibility is forced). */
const actsOpts = (extra = {}) => ({ script: SCRIPT, actsMode: true, decayVisibility: 'conduct', ...extra });

/** Minimal acts-mode view for direct turn calls (engine contract subset). */
const actsView = (turn, { ledger = [], transcript = [] } = {}) => ({
  turn,
  ledger,
  transcript,
  acts: { index: 1, startTurn: 1, turnsThisAct: turn - 1, brief: null },
});

const tutorLine = (turn, move, extraMeta = {}) => ({
  turn,
  role: 'tutor',
  text: '(line)',
  meta: { move: { figure: 'erotema', ...move }, ...extraMeta },
});

const learnerLine = (turn, text) => ({ turn, role: 'learner', text, meta: {} });

/** Stub client: scripted JSON per (role, call-ordinal), payloads recorded. */
function stubClient(replies) {
  const calls = [];
  const remaining = new Map(Object.entries(replies).map(([role, list]) => [role, [...list]]));
  return {
    calls,
    client: {
      mode: 'mock',
      usage: () => ({}),
      async call(role, payload) {
        calls.push({ role, ...payload });
        const queue = remaining.get(role);
        if (!queue || !queue.length) throw new Error(`stubClient: no reply queued for ${role}`);
        const next = queue.shift();
        return typeof next === 'string' ? next : JSON.stringify(next);
      },
    },
  };
}

// ---------------------------------------------------------------------------
// A. build guards
// ---------------------------------------------------------------------------

test('repair clause without confront fails at build', () => {
  const { client } = stubClient({});
  assert.throws(
    () => makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, repairClause: true })),
    /repairClause requires confront/,
  );
});

test('repair clause composes with the full confront stack (legal build does not throw)', () => {
  const { client } = stubClient({});
  assert.doesNotThrow(() =>
    makeLlmTutor(
      smokeWorld,
      client,
      actsOpts({
        superego: true,
        confront: true,
        repairClause: true,
        releaseAuthority: true,
        plot: true,
        throughline: true,
      }),
    ),
  );
});

// ---------------------------------------------------------------------------
// B. charter stability
// ---------------------------------------------------------------------------

async function capturedSystems({ confront = false, repairClause = false } = {}) {
  const draft = {
    dialogue: 'Hold what you have.',
    move: { figure: 'erotema', target_premise: null, intent: 'consolidate' },
  };
  const { client, calls } = stubClient({
    tutor: [draft, draft],
    tutor_superego: [{ intervene: false, diagnosis: 'serves', note: null }],
  });
  const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, confront, repairClause }));
  await tutor(actsView(2));
  return {
    tutorSystem: calls.find((c) => c.role === 'tutor').system,
    superegoSystem: calls.find((c) => c.role === 'tutor_superego').system,
  };
}

test('confront alone: the §11 charters are unchanged — no repair clause, no restore intent', async () => {
  const { tutorSystem, superegoSystem } = await capturedSystems({ confront: true });
  assert.ok(!tutorSystem.includes('repair clause'));
  assert.ok(!/"restore"/.test(tutorSystem));
  assert.ok(!superegoSystem.includes('REPAIR CLAUSE'));
  assert.ok(!/"restore"/.test(superegoSystem));
});

test('repair clause adds the tutor clause, the restore intent, and the superego license paragraph', async () => {
  const { tutorSystem, superegoSystem } = await capturedSystems({ confront: true, repairClause: true });
  // Tutor: the clause text, pinned so the registered charter cannot drift.
  assert.ok(tutorSystem.includes('# The repair clause (a named loss is already a read-back)'));
  assert.ok(tutorSystem.includes('their report IS the read-back. Do not demand another'));
  assert.ok(tutorSystem.includes('re-stages the named exhibit, plainly and in full, BEFORE any new matter'));
  assert.ok(tutorSystem.includes('declare the move with intent "restore"'));
  assert.ok(tutorSystem.includes('One report licenses one restoration'));
  assert.ok(tutorSystem.includes('New matter can wait a turn; a hole in the board cannot.'));
  // The intent vocabulary gains restore (the declare-move line).
  assert.ok(/intent ∈ \{[^}]*restore[^}]*\}/.test(tutorSystem));
  // Superego: the license is the watcher's to verify, against the learner's
  // most recent line — never the harness's, never ground truth.
  assert.ok(superegoSystem.includes('REPAIR CLAUSE'));
  assert.ok(superegoSystem.includes('in their most recent'));
  assert.ok(superegoSystem.includes('the report stands as the read-back'));
  assert.ok(superegoSystem.includes('the claim is false and the draft is an uncovered re-entry'));
});

// ---------------------------------------------------------------------------
// C. bridge arithmetic — the restore claim in the per-turn record
// ---------------------------------------------------------------------------

const p1Staged = { ledger: [{ turn: 1, premiseId: 'p1', via: 'director' }] };
const lossReport = learnerLine(2, 'I find no entry for the first paper on my board — may I have it back?');
const restoreDraft = {
  dialogue: 'Here is that first paper again, in full.',
  move: { figure: 'exemplum', target_premise: 'p1', intent: 'restore' },
};
const confrontRevision = {
  dialogue: 'Read it back to me, word for word.',
  move: { figure: 'erotema', target_premise: 'p1', intent: 'confront' },
};

async function restoreTurn({
  turn = 3,
  transcript = [tutorLine(1, { targetPremise: 'p1', intent: 'release' }), lossReport],
  superegoReply,
  revisionReply = confrontRevision,
  repairClause = true,
}) {
  const { client, calls } = stubClient({
    tutor: [restoreDraft, revisionReply],
    tutor_superego: [superegoReply],
  });
  const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, confront: true, repairClause }));
  const out = await tutor(actsView(turn, { ...p1Staged, transcript }));
  return { out, calls };
}

test('C: a restore draft records the claim — due false, the verification left to the watcher', async () => {
  const { out, calls } = await restoreTurn({
    superegoReply: { intervene: false, jurisdiction: null, diagnosis: 'the learner named the loss', note: null },
  });
  assert.equal(out.move.intent, 'restore');
  assert.equal(out.move.targetPremise, 'p1');
  assert.equal(out.deliberation.intervened, false);
  assert.equal(out.deliberation.reentry.restoreClaim, true);
  assert.equal(out.deliberation.reentry.due, false);
  const segUser = calls.find((c) => c.role === 'tutor_superego').user;
  assert.ok(segUser.includes('with intent restore — the repair clause'));
  assert.ok(segUser.includes("The claim is yours to verify against the learner's last line above"));
  // The harness states the mechanical facts beside the claim.
  assert.ok(segUser.includes('p1 was last staged at turn 1'));
});

test('C: a rejected claim fires the re-entry jurisdiction and converts the move to the confrontation', async () => {
  const { out, calls } = await restoreTurn({
    transcript: [
      tutorLine(1, { targetPremise: 'p1', intent: 'release' }),
      learnerLine(2, 'The chain to Brandt holds.'),
    ],
    superegoReply: {
      intervene: true,
      jurisdiction: 'unconfronted_reentry',
      diagnosis: 'the learner named no loss — the claim is false',
      note: 'Demand the read-back first.',
    },
  });
  assert.equal(out.move.intent, 'confront');
  assert.equal(out.deliberation.jurisdiction, 'unconfronted_reentry');
  assert.equal(out.deliberation.reentry.restoreClaim, true);
  const revision = calls.filter((c) => c.role === 'tutor').at(-1);
  assert.equal(revision.meta.revision.jurisdiction, 'unconfronted_reentry');
  assert.equal(revision.meta.revision.confrontTarget, 'p1');
});

test('C: an unattributed fire on a restore draft resolves to the re-entry jurisdiction', async () => {
  const { out } = await restoreTurn({
    superegoReply: { intervene: true, diagnosis: 'that paper was never asked for', note: 'Hear the learner first.' },
  });
  assert.equal(out.deliberation.jurisdiction, 'unconfronted_reentry');
  assert.equal(out.move.intent, 'confront');
});

test('C: off the dial a restore intent is a plain re-entry — due by the ordinary arithmetic', async () => {
  const { out, calls } = await restoreTurn({
    repairClause: false,
    superegoReply: { intervene: false, jurisdiction: null, diagnosis: 'covered elsewhere', note: null },
  });
  assert.equal(out.deliberation.reentry.due, true);
  assert.equal(out.deliberation.reentry.restoreClaim, undefined);
  const segUser = calls.find((c) => c.role === 'tutor_superego').user;
  assert.ok(!segUser.includes('the repair clause'));
});

// ---------------------------------------------------------------------------
// D. engine contract — restore repairs; only confront is excepted
// ---------------------------------------------------------------------------

const scheduled = (world, turn, via) => world.releaseSchedule.find((e) => e.turn === turn && e.via === via) || null;

/** Scripted cast: schedule-faithful releases; tutor move per `movePlan`. */
function scriptedRoles(world, { movePlan = {} } = {}) {
  return {
    director: async (view) => {
      const entry = scheduled(world, view.turn, 'director');
      return { direction: entry ? '[evidence enters]' : '[the question holds]', release: entry?.premise || null };
    },
    tutor: async (view) => {
      const entry = scheduled(world, view.turn, 'tutor');
      return {
        dialogue: 'Consider what stands on your board.',
        move: movePlan[view.turn] || {
          figure: 'erotema',
          targetPremise: entry?.premise || null,
          intent: entry ? 'release' : 'consolidate',
        },
        release: entry?.premise || null,
      };
    },
    learner: async (view) => ({ dialogue: 'I am listening.', adopt: view.releasedThisTurn }),
  };
}

test('engine: a restore move repairs the decayed premise on its own turn', async () => {
  // rate 1 + grace 0 decays every grounded contingent premise from t3; p1
  // (staged t2, adopted t2) is down by t4. The restore at t4 repairs it
  // there — unlike a confront, which must leave it down.
  const roles = scriptedRoles(smokeWorld, {
    movePlan: { 4: { figure: 'exemplum', targetPremise: 'p1', intent: 'restore' } },
  });
  const result = await runDrama({
    world: smokeWorld,
    roles,
    options: { decay: { rate: 1, graceTurns: 0, maxConcurrent: 4, startTurn: 3, seed: 1, mutateShare: 0 } },
  });
  const repairs = result.corruption.ledger.filter((e) => e.type === 'repair' && e.premiseId === 'p1');
  assert.ok(
    repairs.some((e) => e.turn === 4 && e.via === 'tutor'),
    'the restore move repairs on its own turn',
  );
});

// ---------------------------------------------------------------------------
// E. instruments — the restore bucket in confrontReport, and the panel
// ---------------------------------------------------------------------------

test('confrontReport: restores bucket apart from covered/uncovered, with ground truth from the slip ledger', () => {
  const result = {
    ledger: [{ turn: 1, premiseId: 'p_a', via: 'director' }],
    corruption: {
      ledger: [
        { turn: 3, type: 'decay', premiseId: 'p_a', mode: 'delete' },
        { turn: 4, type: 'repair', premiseId: 'p_a', via: 'tutor' },
      ],
    },
    transcript: [
      tutorLine(1, { targetPremise: 'p_a', intent: 'release' }), // same-turn staging, not a re-entry
      tutorLine(4, { targetPremise: 'p_a', intent: 'restore' }), // real slip, repaired
      tutorLine(7, { targetPremise: 'p_a', intent: 'restore' }), // nothing down — a false or stale claim
      tutorLine(9, { targetPremise: 'p_a', intent: 'test' }), // bare re-entry AFTER the restores: uncovered
    ],
  };
  const report = confrontReport(result);
  assert.deepEqual(report.restores, [
    { turn: 4, target: 'p_a', targetDecayed: true, repaired: true },
    { turn: 7, target: 'p_a', targetDecayed: false, repaired: false },
  ]);
  // Restores never enter the covered/uncovered audit…
  assert.equal(report.reentries.total, 1);
  // …but they re-stage: the t9 re-entry is uncovered (no confrontation since t7).
  assert.deepEqual(
    report.reentries.uncovered.map((r) => r.turn),
    [9],
  );
});

test('confrontReport: a restore spends a standing confrontation license', () => {
  const result = {
    ledger: [{ turn: 1, premiseId: 'p_a', via: 'director' }],
    transcript: [
      tutorLine(3, { targetPremise: 'p_a', intent: 'confront' }),
      tutorLine(5, { targetPremise: 'p_a', intent: 'restore' }), // re-stages; the t3 license is spent
      tutorLine(6, { targetPremise: 'p_a', intent: 'test' }), // uncovered — the license went with the restore
    ],
  };
  const report = confrontReport(result);
  assert.equal(report.restores.length, 1);
  assert.deepEqual(
    report.reentries.uncovered.map((r) => r.turn),
    [6],
  );
});

test('confrontReport: restore-claim fires never count against the detector audit', () => {
  const result = {
    ledger: [{ turn: 1, premiseId: 'p_a', via: 'director' }],
    transcript: [
      tutorLine(
        5,
        { targetPremise: 'p_a', intent: 'confront' }, // the fire converted the move
        {
          deliberation: {
            intervened: true,
            jurisdiction: 'unconfronted_reentry',
            reentry: { due: false, restoreClaim: true, target: 'p_a' },
          },
        },
      ),
    ],
  };
  const report = confrontReport(result);
  assert.equal(report.superego.reentryFires, 1);
  assert.equal(report.superego.restoreClaimFires, 1);
  assert.equal(report.superego.firesWithoutDue, 0);
  assert.equal(report.superego.convertedToConfront, 1);
  assert.ok(!('restores' in report), 'a converted claim was never spoken as a restore');
});

test('confrontReport: no restores key when none are spoken', () => {
  const result = {
    ledger: [{ turn: 1, premiseId: 'p_a', via: 'director' }],
    transcript: [
      tutorLine(3, { targetPremise: 'p_a', intent: 'confront' }),
      tutorLine(4, { targetPremise: 'p_a', intent: 'test' }),
    ],
  };
  const report = confrontReport(result);
  assert.ok(!('restores' in report));
  assert.equal(report.superego.restoreClaimFires, 0);
});

// ---------------------------------------------------------------------------
// F. mock chain — the full §12 arm config on lantern, zero-cost
// ---------------------------------------------------------------------------

test('mock chain: the full §12 stack composes — no restore is ever claimed by the mock cast; the panel line renders on a spliced bucket', async () => {
  const client = makeLlmClient({ mode: 'mock' });
  const roles = {
    director: makeLlmDirector(lanternWorld, client, { actsMode: true }),
    tutor: makeLlmTutor(lanternWorld, client, {
      script: lanternScript,
      superego: true,
      decayVisibility: 'conduct',
      actsMode: true,
      confront: true,
      repairClause: true,
      releaseAuthority: true,
      plot: true,
      throughline: true,
    }),
    learner: makeLlmLearner({ setting: lanternWorld.setting, voice: lanternWorld.learnerVoice, client }),
  };
  const result = await runDrama({
    world: lanternWorld,
    roles,
    options: {
      decay: { rate: 0.75, graceTurns: 1, maxConcurrent: 2, startTurn: 1, mutateShare: 1.0, seed: 1 },
      acts: { minActTurns: 3, maxActTurns: 8 },
    },
  });
  const d = diagnose(result, lanternWorld);

  // The dial composes with the whole §11 stack without disturbing it.
  assert.ok(d.confrontation, 'confrontation block present on the arm');
  assert.equal(d.confrontation.superego.firesWithoutDue, 0);
  assert.equal(d.confrontation.reentries.uncovered.length, 0);
  // The mock tutor never declares restore, so the bucket stays absent — the
  // shape discipline the §11 artifacts rely on.
  assert.ok(!('restores' in d.confrontation));
  assert.equal(d.confrontation.superego.restoreClaimFires, 0);
  assert.ok(!renderEvalPanel(d).includes('repair clause'));

  // The panel line, exercised by splicing a synthetic bucket into the real
  // diagnosis shape (the mock cast cannot produce one).
  const spliced = {
    ...d,
    confrontation: {
      ...d.confrontation,
      restores: [
        { turn: 8, target: 'p_bearing', targetDecayed: true, repaired: true },
        { turn: 11, target: 'p_chart', targetDecayed: false, repaired: false },
      ],
      superego: { ...d.confrontation.superego, restoreClaimFires: 1 },
    },
  };
  const panel = renderEvalPanel(spliced);
  assert.ok(panel.includes('**repair clause** restores 2 (1 repaired a real slip)'));
  assert.ok(panel.includes('watcher fires on restore claims 1'));
  assert.ok(panel.includes('p_bearing t8 · p_chart t11'));
});
