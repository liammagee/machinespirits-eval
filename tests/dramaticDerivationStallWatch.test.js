/**
 * Stall-watcher / quasi-logical ToM guarantees (pre-registered build order
 * step 7, notes/poetics/2026-06-10-stall-watcher-quasi-logical-tom.md §7):
 *
 *   A. ENGINE VALIDATION PATHS — the learner-composed derive channel:
 *      voiced (with token normalization), repeat, base- and pattern-
 *      mischannel, overreach; voicing changes NOTHING formal; censoring and
 *      the inference frontier at drama end.
 *   B. CHARTER STABILITY — the v2 charter is untouched when stallWatch is
 *      off; v3 adds exactly the second jurisdiction + the jurisdiction key;
 *      counsel reaches the director and the superego, NEVER the tutor ego
 *      (the script file is the pinned iteration artifact).
 *   C. MOCK CAUSAL CHAIN — on world-003 the deterministic mock cast yields
 *      the exact fire pattern (rut t3/6/9/12/15, stall t11), the exact
 *      uptake (foulFrom available t8 → voiced t12), a CLEAN detector audit,
 *      and a formal channel identical across the ON/OFF arms.
 *   D. METRICS ON SYNTHETIC RESULTS — the instruments themselves audited:
 *      learnerInference on hand-built fires (obeyed/disobeyed, uptaken/
 *      censored) and the detector audit on planted missed/false fires.
 *
 * NOTE the mock-artifact boundary: the mock learner voices at seen-age 3
 * (engine age 4) in BOTH arms by construction, so mock ON/OFF latencies are
 * identical — these tests exercise plumbing and instruments, never the
 * hypothesis. The real OFF arm is the experiment's control.
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
  tutorFigures,
  learnerInference,
  renderTranscript,
  renderEvalPanel,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const smokeWorld = loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));
const bitterWorld = loadWorld(path.join(ROOT, 'config/drama-derivation/world-003-bitterwell.yaml'));
const bitterScript = fs.readFileSync(
  path.join(ROOT, 'config/drama-derivation/tutor-scripts/bitterwell-v001.md'),
  'utf8',
);

/** Wraps the mock client, recording every system prompt by role. */
function systemRecordingClient() {
  const inner = makeLlmClient({ mode: 'mock' });
  const systemsByRole = new Map();
  return {
    client: {
      mode: inner.mode,
      usage: inner.usage,
      call(role, payload) {
        if (!systemsByRole.has(role)) systemsByRole.set(role, []);
        systemsByRole.get(role).push(payload.system);
        return inner.call(role, payload);
      },
    },
    systems: (role) => systemsByRole.get(role) || [],
  };
}

function bitterRoles(client, { stallWatch, counsel = null } = {}) {
  return {
    director: makeLlmDirector(bitterWorld, client, { counsel }),
    tutor: makeLlmTutor(bitterWorld, client, { script: bitterScript, superego: true, stallWatch, counsel }),
    learner: makeLlmLearner({ setting: bitterWorld.setting, voice: bitterWorld.learnerVoice, client }),
  };
}

// ---------------------------------------------------------------------------
// A. engine validation paths — scripted choreography on world-000
// ---------------------------------------------------------------------------

const scheduled = (world, turn, via) => world.releaseSchedule.find((e) => e.turn === turn && e.via === via) || null;

/** Scripted roles: releases on the world's own schedule, learner per `plan`. */
function scriptedRoles(world, plan) {
  return {
    director: async (view) => {
      const entry = scheduled(world, view.turn, 'director');
      return { direction: entry ? '[evidence enters]' : '[the question holds]', release: entry?.premise || null };
    },
    tutor: async (view) => {
      const entry = scheduled(world, view.turn, 'tutor');
      return {
        dialogue: 'Consider what stands on your board.',
        move: { figure: 'erotema', targetPremise: entry?.premise || null, intent: entry ? 'release' : 'consolidate' },
        release: entry?.premise || null,
      };
    },
    learner: async (view) => ({
      dialogue: 'I am listening.',
      adopt: view.releasedThisTurn,
      ...(plan[view.turn] || {}),
    }),
  };
}

// The choreography: adopt every release on arrival (p1 t2, p4 t4, p2 t5,
// p3 t8); voice one derivation the turn it becomes available, the other a
// turn late with case noise; send every invalid shape down the channel once.
const DERIVE_PLAN = {
  5: { derive: [['grandchild', 'marin', 'founder']] },
  6: {
    derive: [
      ['GrandChild', 'JOREN', 'FOUNDER'], // token noise — must match canonically
      ['grandchild', 'marin', 'founder'], // already voiced — repeat
      ['livesAt', 'marin', 'harbor'], // background — base mischannel
      ['grandchild', 'marin', 'tessa'], // not in the closure — overreach
    ],
  },
  8: { derive: [['heir', 'marin']] }, // derivable but question-shaped — pattern mischannel
  9: { asserts: ['heir', 'marin'] },
};

test('derive channel: voiced/repeat/base/pattern/overreach each land in their lane', async () => {
  const result = await runDrama({ world: smokeWorld, roles: scriptedRoles(smokeWorld, DERIVE_PLAN) });
  assert.equal(result.verdict, 'grounded_anagnorisis');
  assert.equal(result.firstForcedTurn, 8);
  assert.equal(result.assertedGroundedTurn, 9);
  assert.equal(result.turnsPlayed, 9);

  // The voiced ledger holds CANONICAL facts (the noisy claim normalized to
  // the closure's own tokens), in voicing order.
  assert.deepEqual(result.inference.voiced, [
    { fact: ['grandchild', 'marin', 'founder'], turn: 5 },
    { fact: ['grandchild', 'joren', 'founder'], turn: 6 },
  ]);
  // Overreach keeps the claim AS COMPOSED (it matches nothing canonical).
  assert.deepEqual(result.inference.overreaches, [{ turn: 6, fact: ['grandchild', 'marin', 'tessa'] }]);
  assert.deepEqual(result.inference.mischanneled, [
    { turn: 6, fact: ['livesAt', 'marin', 'harbor'], kind: 'base' },
    { turn: 8, fact: ['heir', 'marin'], kind: 'pattern' },
  ]);

  // Per-claim outcomes on the learner's own transcript line, in claim order.
  const t6 = result.transcript.find((l) => l.role === 'learner' && l.turn === 6);
  assert.deepEqual(
    t6.meta.deriveOutcomes.map((o) => o.status),
    ['voiced', 'repeat', 'base', 'overreach'],
  );
  // Overreach is an ENGINE EVENT (guard G2's raw material); mischannels are not.
  assert.deepEqual(
    result.events.filter((e) => e.type === 'overreach'),
    [{ turn: 6, type: 'overreach', detail: 'grandchild marin tessa' }],
  );

  // Availability: both derived nodes first available at t5 (the adoption that
  // closed them), question-shaped facts never tracked.
  assert.deepEqual(result.inference.availability, [
    { fact: ['grandchild', 'joren', 'founder'], firstAvailable: 5, firstVoiced: 6 },
    { fact: ['grandchild', 'marin', 'founder'], firstAvailable: 5, firstVoiced: 5 },
  ]);

  // The instrument over it: latencies 0 and 1, nothing censored, no stall.
  const li = learnerInference(result);
  assert.equal(li.voicedCount, 2);
  assert.equal(li.overreachCount, 1);
  assert.equal(li.mischanneledCount, 2);
  assert.equal(li.stallIntegral, 0);
  assert.deepEqual(
    li.nodes.map((n) => [n.latency, n.censored]),
    [
      [1, false],
      [0, false],
    ],
  );

  // The panel and the transcript carry the channel for the operator/critic.
  const d = diagnose(result, smokeWorld);
  const panel = renderEvalPanel(d);
  assert.match(panel, /\*\*inference\*\* 2 voiced · stall integral 0 · overreach 1 · mischanneled 2/);
  const md = renderTranscript(result, smokeWorld, { diagnosis: d });
  assert.match(md, /derives `grandchild joren founder`/);
  assert.match(md, /⚑ \*\*overreach\*\* — grandchild marin tessa/);
});

test('voicing is formally inert; unvoiced nodes censor and stand on the final frontier', async () => {
  const voiced = await runDrama({ world: smokeWorld, roles: scriptedRoles(smokeWorld, DERIVE_PLAN) });
  const silentPlan = { 9: { asserts: ['heir', 'marin'] } }; // same drama, no derives
  const silent = await runDrama({ world: smokeWorld, roles: scriptedRoles(smokeWorld, silentPlan) });

  // The formal channel cannot tell the runs apart: a derivable fact is in
  // the closure whether or not spoken (the channel's design invariant).
  assert.equal(silent.verdict, voiced.verdict);
  assert.equal(silent.firstForcedTurn, voiced.firstForcedTurn);
  assert.equal(silent.turnsPlayed, voiced.turnsPlayed);
  assert.deepEqual(silent.trajectory, voiced.trajectory);
  assert.deepEqual(silent.ledger, voiced.ledger);

  // Censoring: available t5, never voiced over 9 turns → ages 4, stall turns
  // at ages 3 and 4 (t8, t9) on each node.
  const li = learnerInference(silent);
  assert.equal(li.voicedCount, 0);
  assert.deepEqual(
    li.nodes.map((n) => [n.censored, n.ageAtEnd, n.stallTurns]),
    [
      [true, 4, 2],
      [true, 4, 2],
    ],
  );
  assert.equal(li.stallIntegral, 4);

  // Both unvoiced derivations stand on the final frontier with their ages
  // and grounds; the voiced run's frontier is empty of them.
  const frontier = silent.inference.frontierFinal;
  assert.equal(frontier.length, 2);
  assert.ok(frontier.every((item) => item.age === 4 && item.groundPremiseIds.includes('p2')));
  assert.equal(voiced.inference.frontierFinal.length, 0);
});

// ---------------------------------------------------------------------------
// B. charter stability
// ---------------------------------------------------------------------------

test('stallWatch requires the superego: the factory refuses the orphan flag', () => {
  const { client } = systemRecordingClient();
  assert.throws(
    () => makeLlmTutor(bitterWorld, client, { script: bitterScript, stallWatch: true }),
    /stallWatch requires the superego/,
  );
});

test('charter v2 vs v3: the OFF charter carries no stall jurisdiction; ON adds exactly the second jurisdiction', async () => {
  const off = systemRecordingClient();
  await runDrama({ world: bitterWorld, roles: bitterRoles(off.client, { stallWatch: false }) });
  const on = systemRecordingClient();
  await runDrama({ world: bitterWorld, roles: bitterRoles(on.client, { stallWatch: true }) });

  // One stable charter per run (built at factory time, never per-turn).
  const offSystems = off.systems('tutor_superego');
  const onSystems = on.systems('tutor_superego');
  assert.ok(offSystems.length > 0 && onSystems.length > 0);
  assert.equal(new Set(offSystems).size, 1);
  assert.equal(new Set(onSystems).size, 1);

  // v2 (OFF): rut only — no stall jurisdiction, no jurisdiction key, no counsel.
  assert.match(offSystems[0], /FIGURE RUT/);
  assert.doesNotMatch(offSystems[0], /STALLED INFERENCE/);
  assert.doesNotMatch(offSystems[0], /"jurisdiction"/);
  assert.doesNotMatch(offSystems[0], /[Cc]ounsel/);

  // v3 (ON): both jurisdictions, the jurisdiction key in the reply shape,
  // and the evidence boundary restated for the stall note.
  assert.match(onSystems[0], /FIGURE RUT/);
  assert.match(onSystems[0], /STALLED INFERENCE/);
  assert.match(onSystems[0], /"jurisdiction": "figure_rut" \| "stalled_inference" \| null/);
  assert.match(onSystems[0], /THE EVIDENCE BOUNDARY/);
});

test('counsel reaches the director and the superego, never the tutor ego', async () => {
  const counsel = 'Mind the lantern scene; the room goes slack after the levels are read.';
  const rec = systemRecordingClient();
  await runDrama({ world: bitterWorld, roles: bitterRoles(rec.client, { stallWatch: true, counsel }) });

  const directorSystem = rec.systems('director')[0];
  assert.match(directorSystem, /# A reader's judgment on the previous performance in this series/);
  assert.ok(directorSystem.includes(counsel));

  const superegoSystem = rec.systems('tutor_superego')[0];
  assert.match(superegoSystem, /# Counsel from the previous performance's reader/);
  assert.match(superegoSystem, /Counsel, never a jurisdiction/);
  assert.ok(superegoSystem.includes(counsel));

  // The tutor ego's system prompt is the pinned iteration artifact (the
  // role-script file + fixed harness appendix): counsel must never reach it.
  const tutorSystems = rec.systems('tutor');
  assert.ok(tutorSystems.length > 0);
  assert.ok(tutorSystems.every((s) => !s.includes(counsel)));
});

// ---------------------------------------------------------------------------
// C. mock causal chain on world-003 (the bitterwell pair, both arms)
// ---------------------------------------------------------------------------

test('stall-watch ON (mock): rut fires t3/6/9/12/15, the stall fires t11, the audit is clean, the uptake lands', async () => {
  const { client } = systemRecordingClient();
  const result = await runDrama({ world: bitterWorld, roles: bitterRoles(client, { stallWatch: true }) });
  assert.equal(result.verdict, 'grounded_anagnorisis');
  assert.equal(result.firstForcedTurn, 15);
  assert.equal(result.turnsPlayed, 15);

  // The fire pattern: the mock rut-watcher trips every third erotema; the
  // stall jurisdiction fires once, at t11 — foulFrom available since t8
  // (age 3), unvoiced, untargeted by t9/t10 or the draft.
  const intervened = result.transcript.filter((l) => l.role === 'tutor' && l.meta.deliberation?.intervened);
  assert.deepEqual(
    intervened.map((l) => [l.turn, l.meta.deliberation.jurisdiction]),
    [
      [3, 'figure_rut'],
      [6, 'figure_rut'],
      [9, 'figure_rut'],
      [11, 'stalled_inference'],
      [12, 'figure_rut'],
      [15, 'figure_rut'],
    ],
  );

  // The stall revision aims the move at a ground of the named inference and
  // HOLDS the figure (the two jurisdictions act on different axes).
  const fire = intervened.find((l) => l.turn === 11);
  assert.ok(['p_course', 'p_basin', 'p_rill'].includes(fire.meta.move.targetPremise));
  assert.equal(fire.meta.move.figure, 'erotema');

  // tutorFigures: 6 interventions, figure changed on the 5 rut fires only;
  // the detector audit recomputes due/not-due over all 15 turns and finds
  // the record clean (the P2 criterion, mismatch budget 0).
  const tf = tutorFigures(result);
  assert.equal(tf.superego.watched, 15);
  assert.equal(tf.superego.interventions, 6);
  assert.equal(tf.superego.withinTurnChanges, 5);
  assert.deepEqual(tf.superego.stallWatch.byJurisdiction, { figure_rut: 5, stalled_inference: 1 });
  assert.deepEqual(tf.superego.stallWatch.audit, {
    turns: 15,
    due: 6,
    fired: 6,
    missedFires: [],
    falseFires: [],
    clean: true,
  });

  // The learner-movement instrument: foulFrom available t8, voiced t12
  // (the mock derive clock: seen t9, voiced at seen-age 3 — one turn after
  // the fire), so latency 4 with a single stall turn (t11), uptake and
  // target obedience both 1/1, and no overreach (guard G2).
  const li = learnerInference(result);
  assert.deepEqual(li.nodes, [
    {
      fact: ['foulFrom', 'commonWell', 'springHouse'],
      firstAvailable: 8,
      firstVoiced: 12,
      latency: 4,
      censored: false,
      ageAtEnd: 7,
      stallTurns: 1,
    },
  ]);
  assert.equal(li.stallIntegral, 1);
  assert.equal(li.overreachCount, 0);
  assert.equal(li.stallFires.length, 1);
  assert.equal(li.stallFires[0].turn, 11);
  assert.deepEqual(li.stallFires[0].stalled, ['foulFrom', 'commonWell', 'springHouse']);
  assert.equal(li.stallFires[0].obeyed, true);
  assert.equal(li.stallFires[0].voicedTurn, 12);
  assert.equal(li.stallFires[0].uptaken, true);
  assert.deepEqual(li.postFireUptake, { fires: 1, uptaken: 1, rate: 1 });
  assert.deepEqual(li.targetObedience, { fires: 1, obeyed: 1, rate: 1 });

  // Panel + transcript surfaces: the audit line, the inference line, the
  // per-fire line, and the jurisdiction tags on the second voice.
  const d = diagnose(result, bitterWorld);
  const panel = renderEvalPanel(d);
  assert.match(
    panel,
    /\*\*stall watch\*\* fires by jurisdiction: figure rut 5 · stalled inference 1 · detector audit CLEAN \(6\/6 due fires, 0 false, 15 turns\)/,
  );
  assert.match(panel, /\*\*inference\*\* 1 voiced · stall integral 1 · overreach 0 · mischanneled 0/);
  assert.match(panel, /\*\*stall fires\*\* 1: uptake within 3 turns 1\/1 · target obeyed 1\/1/);
  const md = renderTranscript(result, bitterWorld, { diagnosis: d });
  assert.match(md, /the second voice \[stalled inference\]: "/);
  assert.match(md, /the second voice \[figure rut\]: "/);
  assert.match(md, /derives `foulFrom commonWell springHouse`/);
});

test('stall-watch OFF (mock): the v2 arm records no stall arithmetic and the formal channel matches the ON arm', async () => {
  const off = await runDrama({
    world: bitterWorld,
    roles: bitterRoles(systemRecordingClient().client, { stallWatch: false }),
  });
  const on = await runDrama({
    world: bitterWorld,
    roles: bitterRoles(systemRecordingClient().client, { stallWatch: true }),
  });

  // OFF deliberation carries no v3 bookkeeping at all (the audit's v2/v3
  // discriminator is `stall !== undefined` — it must stay undefined here).
  const offTutorLines = off.transcript.filter((l) => l.role === 'tutor');
  assert.ok(offTutorLines.every((l) => l.meta.deliberation && l.meta.deliberation.stall === undefined));
  assert.ok(offTutorLines.every((l) => l.meta.deliberation.jurisdiction === undefined));
  assert.equal(tutorFigures(off).superego.stallWatch, null);

  // Without the stall jurisdiction the t11 fire does not happen, and the rut
  // cadence re-spaces over the unbroken erotema run.
  const offFires = offTutorLines.filter((l) => l.meta.deliberation.intervened);
  assert.deepEqual(
    offFires.map((l) => l.turn),
    [3, 6, 9, 12, 15],
  );
  const li = learnerInference(off);
  assert.equal(li.stallFires.length, 0);
  assert.deepEqual(li.postFireUptake, { fires: 0, uptaken: 0, rate: null });

  // The formal channel cannot tell the arms apart — and in MOCK the learner
  // can't either (its derive clock is arm-blind by construction): identical
  // verdict, trajectory, releases, and availability. The real OFF arm is the
  // experiment's control; this equality is the plumbing guarantee, not the
  // hypothesis.
  assert.equal(off.verdict, on.verdict);
  assert.equal(off.firstForcedTurn, on.firstForcedTurn);
  assert.deepEqual(off.trajectory, on.trajectory);
  assert.deepEqual(off.ledger, on.ledger);
  assert.deepEqual(off.inference.availability, on.inference.availability);
});

// ---------------------------------------------------------------------------
// D. metrics on synthetic results — auditing the auditors
// ---------------------------------------------------------------------------

test('learnerInference: null on pre-instrument artifacts; fires judged on obedience and uptake independently', () => {
  assert.equal(learnerInference({ transcript: [], turnsPlayed: 5 }), null);

  const fireLine = (turn, { fact, age, groundPremiseIds, target }) => ({
    turn,
    role: 'tutor',
    meta: {
      move: { figure: 'erotema', targetPremise: target },
      deliberation: {
        intervened: true,
        jurisdiction: 'stalled_inference',
        stall: { items: [{ fact, age, targetedByLast2: false, targetedByDraft: false, groundPremiseIds }] },
      },
    },
  });
  const result = {
    turnsPlayed: 10,
    transcript: [
      // obeyed AND uptaken: target pA ∈ grounds; voiced t6, one turn after.
      fireLine(5, { fact: ['f', 'a'], age: 3, groundPremiseIds: ['pA', 'pB'], target: 'pA' }),
      // disobeyed AND never voiced: target pZ ∉ grounds; the node censors.
      fireLine(8, { fact: ['g', 'b'], age: 4, groundPremiseIds: ['pC'], target: 'pZ' }),
    ],
    inference: {
      voiced: [{ fact: ['f', 'a'], turn: 6 }],
      overreaches: [{ turn: 3, fact: ['x', 'y'] }],
      mischanneled: [],
      availability: [
        { fact: ['f', 'a'], firstAvailable: 2, firstVoiced: 6 },
        { fact: ['g', 'b'], firstAvailable: 4, firstVoiced: null },
      ],
    },
  };
  const li = learnerInference(result);
  assert.deepEqual(
    li.nodes.map((n) => [n.latency, n.censored, n.stallTurns]),
    [
      [4, false, 1], // age 3 at t5, voiced t6 → one stall turn
      [null, true, 4], // ages 3–6 over t7–t10, never voiced
    ],
  );
  assert.equal(li.stallIntegral, 5);
  assert.equal(li.overreachCount, 1);
  assert.deepEqual(
    li.stallFires.map((f) => [f.turn, f.obeyed, f.voicedTurn, f.uptaken]),
    [
      [5, true, 6, true],
      [8, false, null, false],
    ],
  );
  assert.deepEqual(li.postFireUptake, { fires: 2, uptaken: 1, rate: 0.5 });
  assert.deepEqual(li.targetObedience, { fires: 2, obeyed: 1, rate: 0.5 });
});

test('detector audit: planted missed and false fires are caught from the record, never from the watcher', () => {
  const move = (turn, figure, deliberation) => ({
    turn,
    role: 'tutor',
    meta: { move: { figure }, deliberation },
  });
  const quiet = (draftFigure, items = []) => ({
    draftFigure,
    intervened: false,
    diagnosis: null,
    note: null,
    jurisdiction: null,
    stall: { items, due: items.length > 0 },
  });
  const result = {
    transcript: [
      move(1, 'erotema', quiet('erotema')),
      move(2, 'erotema', quiet('erotema')),
      // t3: third erotema drafted AND realized — rut-due, but no fire (missed).
      move(3, 'erotema', quiet('erotema')),
      // t4: nothing due (no rut, empty stall record) — yet it fired (false).
      move(4, 'analogia', {
        draftFigure: 'analogia',
        intervened: true,
        jurisdiction: 'figure_rut',
        diagnosis: 'x',
        note: 'x',
        stall: { items: [], due: false },
      }),
      // t5: stall-due on the recorded arithmetic — no fire (missed).
      move(
        5,
        'erotema',
        quiet('erotema', [{ fact: ['f', 'a'], age: 4, targetedByLast2: false, targetedByDraft: false }]),
      ),
    ],
  };
  const sw = tutorFigures(result).superego.stallWatch;
  assert.deepEqual(sw.byJurisdiction, { figure_rut: 1, stalled_inference: 0 });
  assert.deepEqual(sw.audit, {
    turns: 5,
    due: 2,
    fired: 1,
    missedFires: [3, 5],
    falseFires: [4],
    clean: false,
  });
});
