/**
 * P1 dials (notes/poetics/2026-06-11-desire-multiturn-strategy-plan.md §C2 +
 * §C5) — guarantees:
 *
 *   A. BUILD GUARDS — confront is acts-mode machinery and a clause of the
 *      watcher charter; contradictory wirings fail at build, not mid-drama.
 *   B. CHARTER STABILITY — the acts-mode charter is untouched when both
 *      dials are off; --confront adds exactly the confrontation obligation +
 *      the "confront" intent + the re-entry jurisdiction (superego);
 *      --release-authority swaps the fixed cue line for the exhibit window.
 *   C. BRIDGE ARITHMETIC — C2: a claim is honored only inside the window,
 *      an invalid claim drops to a hold, the hold limit force-plays and
 *      records the override; the decision is made ONCE, on the draft. C5:
 *      the re-entry guard's license accounting (due → fire → confront
 *      revision; a confrontation licenses exactly one re-entry; a spent
 *      license falls due again), stated criterially in the superego prompt.
 *   D. ENGINE CONTRACT — a confront move never repairs (the read-back must
 *      test a real absence); the licensed re-entry that follows does. The
 *      ledger row and transcript meta carry the C2 decision record.
 *   E. INSTRUMENTS ON SYNTHETIC RESULTS — confrontReport's spoken-record
 *      audit (covered/uncovered/license-spent), corruptionReport's
 *      confront-prompted retraction class (window {0,+1}), releaseDeviations
 *      counts, and the OFF-state shape discipline (absent keys).
 *   F. MOCK CAUSAL CHAIN — the full P1 arm config on world-002-lantern
 *      (acts + decay + superego + confront + release authority), zero-cost:
 *      fires convert within-turn, no uncovered re-entry is ever spoken, the
 *      mock release policy is deviation-zero, and the panel renders both
 *      new instrument lines.
 *
 * NOTE the mock-artifact boundary (as in the stall-watch tests): the mock
 * cast exercises plumbing and instruments, never the hypothesis — the mock
 * tutor drafts bare re-entries by construction and its superego echoes the
 * bridge arithmetic. The paid arm is where conduct is measured.
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
  releaseDeviations,
  confrontReport,
  corruptionReport,
  renderEvalPanel,
  RELEASE_LATITUDE,
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

/**
 * Stub client: scripted JSON per (role, call-ordinal), recording every
 * payload so charter and criterial-record assertions read what the bridge
 * actually sent. `tutor` replies are consumed in order (draft, revision).
 */
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

test('confront without acts mode fails at build', () => {
  const { client } = stubClient({});
  assert.throws(
    () => makeLlmTutor(smokeWorld, client, { script: SCRIPT, superego: true, confront: true }),
    /acts mode/,
  );
});

test('confront composes with the acts-mode guards (legal build does not throw)', () => {
  const { client } = stubClient({});
  assert.doesNotThrow(() =>
    makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, confront: true, releaseAuthority: true })),
  );
});

test('pacing guard requires release authority', () => {
  const { client } = stubClient({});
  assert.throws(
    () => makeLlmTutor(smokeWorld, client, actsOpts({ pacingGuard: true })),
    /pacingGuard requires releaseAuthority/,
  );
});

// ---------------------------------------------------------------------------
// B. charter stability
// ---------------------------------------------------------------------------

async function capturedSystems({ superego = true, confront = false, releaseAuthority = false } = {}) {
  const draft = {
    dialogue: 'Hold what you have.',
    move: { figure: 'erotema', target_premise: null, intent: 'consolidate' },
    ...(releaseAuthority ? { release: null } : {}),
  };
  const { client, calls } = stubClient({
    tutor: [draft, draft],
    tutor_superego: [{ intervene: false, diagnosis: 'serves', note: null }],
  });
  const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego, confront, releaseAuthority }));
  await tutor(actsView(2));
  return {
    tutorSystem: calls.find((c) => c.role === 'tutor').system,
    superegoSystem: superego ? calls.find((c) => c.role === 'tutor_superego').system : null,
  };
}

test('both dials off: no confrontation clause, no window, no re-entry jurisdiction', async () => {
  const { tutorSystem, superegoSystem } = await capturedSystems();
  assert.ok(!tutorSystem.includes('confrontation obligation'));
  assert.ok(!/"confront"/.test(tutorSystem));
  assert.ok(!tutorSystem.includes('YOURS TO KEEP OR BEND'));
  assert.ok(!tutorSystem.includes('THE HOUSE CLOCK'));
  assert.ok(!tutorSystem.includes('TREATMENT FOLLOWS DIAGNOSIS'));
  assert.ok(!superegoSystem.includes('UNCONFRONTED RE-ENTRY'));
  assert.ok(!superegoSystem.includes('unconfronted_reentry'));
});

test('confront adds the obligation clause, the intent, and the second jurisdiction', async () => {
  const { tutorSystem, superegoSystem } = await capturedSystems({ confront: true });
  assert.ok(tutorSystem.includes('confrontation obligation'));
  assert.ok(/\bconfront\b/.test(tutorSystem));
  assert.ok(superegoSystem.includes('UNCONFRONTED RE-ENTRY'));
  assert.ok(superegoSystem.includes('"unconfronted_reentry"'));
});

test('release authority swaps the fixed cue for the exhibit window', async () => {
  const { tutorSystem } = await capturedSystems({ releaseAuthority: true });
  assert.ok(tutorSystem.includes('YOURS TO KEEP OR BEND'));
  assert.ok(tutorSystem.includes('hold limit'));
});

// charter v2 (plan §10, registered 2026-06-12): two text-only clauses. The
// clock clause rides the release-authority dial; the treatment clause rides
// confront. Pinned here so the registered text cannot drift silently.
test('charter v2: release authority carries the house clock, with the world window interpolated', async () => {
  const { tutorSystem } = await capturedSystems({ releaseAuthority: true });
  assert.ok(tutorSystem.includes('THE HOUSE CLOCK'));
  assert.ok(tutorSystem.includes(`${smokeWorld.slope.aporia_window}-turn stretch passes with no fresh ground gained`));
  assert.ok(tutorSystem.includes('You cannot see the clock; you can only keep it'));
  assert.ok(tutorSystem.includes('an exhibit in your window is a rescue — spend it'));
  assert.ok(!tutorSystem.includes('TREATMENT FOLLOWS DIAGNOSIS'));
});

test('charter v2: confront carries treatment-follows-diagnosis', async () => {
  const { tutorSystem } = await capturedSystems({ confront: true });
  assert.ok(tutorSystem.includes('TREATMENT FOLLOWS DIAGNOSIS'));
  assert.ok(tutorSystem.includes('Spend it on your NEXT turn'));
  assert.ok(!tutorSystem.includes('THE HOUSE CLOCK'));
});

// ---------------------------------------------------------------------------
// C. bridge arithmetic
// ---------------------------------------------------------------------------

// C2 — the window. Smoke schedule: p2 via tutor t5 (window 3–7), p3 via
// tutor t8 (window 6–10), with RELEASE_LATITUDE = 2.

async function releaseTurn({ turn, reply, ledger = [] }) {
  const { client } = stubClient({ tutor: [reply] });
  const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ releaseAuthority: true }));
  return tutor(actsView(turn, { ledger }));
}

async function lanternReleaseTurn({ turn, reply, ledger = [] }) {
  const { client } = stubClient({ tutor: [reply] });
  const tutor = makeLlmTutor(lanternWorld, client, actsOpts({ releaseAuthority: true, pacingGuard: true }));
  return tutor(actsView(turn, { ledger }));
}

async function v3ReleaseTurn({ turn, reply, ledger = [], transcript = [] }) {
  const { client } = stubClient({ tutor: [reply] });
  const tutor = makeLlmTutor(
    smokeWorld,
    client,
    actsOpts({ releaseAuthority: true, pacingGuard: true, visiblePushProbeGuard: true }),
  );
  return tutor(actsView(turn, { ledger, transcript }));
}

test('C2: a claim inside the window is honored, offset and reason recorded', async () => {
  const out = await releaseTurn({
    turn: 4,
    reply: {
      dialogue: 'Take this now.',
      move: { figure: 'exemplum', target_premise: 'p2', intent: 'release' },
      release: 'p2',
      release_reason: 'strike while the question is open',
    },
  });
  assert.equal(out.release, 'p2');
  assert.equal(out.releaseReason, 'strike while the question is open');
  assert.deepEqual(
    {
      claimed: out.releaseDecision.claimed,
      played: out.releaseDecision.played,
      offset: out.releaseDecision.offset,
      invalidClaim: out.releaseDecision.invalidClaim,
      forced: out.releaseDecision.forced,
      overridden: out.releaseDecision.overridden,
    },
    { claimed: 'p2', played: 'p2', offset: -1, invalidClaim: false, forced: null, overridden: false },
  );
});

test('C2: a claim outside the window is invalid and drops to a hold', async () => {
  const out = await releaseTurn({
    turn: 3,
    reply: { dialogue: 'Too soon.', move: { figure: 'erotema', target_premise: null, intent: 'test' }, release: 'p3' },
  });
  assert.equal(out.release, null);
  assert.equal(out.releaseDecision.claimed, 'p3');
  assert.equal(out.releaseDecision.invalidClaim, true);
  assert.equal(out.releaseDecision.played, null);
});

test('C2: an already-played exhibit is out of the window', async () => {
  const out = await releaseTurn({
    turn: 5,
    ledger: [{ turn: 3, premiseId: 'p2', via: 'tutor' }],
    reply: { dialogue: 'Again?', move: { figure: 'erotema', target_premise: null, intent: 'test' }, release: 'p2' },
  });
  assert.equal(out.release, null);
  assert.equal(out.releaseDecision.invalidClaim, true);
});

test('C2: the hold limit force-plays over a contrary claim and records the override', async () => {
  const out = await releaseTurn({
    turn: 5 + RELEASE_LATITUDE,
    reply: {
      dialogue: 'I would rather wait.',
      move: { figure: 'erotema', target_premise: null, intent: 'test' },
      release: null,
    },
  });
  assert.equal(out.release, 'p2');
  assert.equal(out.releaseDecision.forced, 'p2');
  assert.equal(out.releaseDecision.overridden, true);
  assert.equal(out.releaseDecision.offset, RELEASE_LATITUDE);
});

test('E3 pacing guard blocks the known early-chart fatal pull', async () => {
  const out = await lanternReleaseTurn({
    turn: 7,
    ledger: [
      { turn: 2, premiseId: 'm_key', via: 'director' },
      { turn: 3, premiseId: 'p_bearing', via: 'tutor' },
      { turn: 6, premiseId: 'm_post', via: 'director' },
    ],
    reply: {
      dialogue: 'The chart should enter now.',
      move: { figure: 'analogia', target_premise: 'p_chart', intent: 'release' },
      release: 'p_chart',
      release_reason: 'the learner asked for the chart',
    },
  });
  assert.equal(out.release, null);
  assert.equal(out.releaseDecision.played, null);
  assert.equal(out.releaseDecision.pacingGuard.blocked, true);
  assert.equal(out.releaseDecision.pacingGuard.candidate, 'p_chart');
  assert.equal(out.releaseDecision.pacingGuard.alternativeTurn, 8);
  assert.deepEqual(out.releaseDecision.pacingGuard.safeTurns.p_chart, [8]);
});

test('E3 pacing guard force-plays an exhibit on its last safe turn', async () => {
  const out = await lanternReleaseTurn({
    turn: 8,
    ledger: [
      { turn: 2, premiseId: 'm_key', via: 'director' },
      { turn: 3, premiseId: 'p_bearing', via: 'tutor' },
      { turn: 6, premiseId: 'm_post', via: 'director' },
      { turn: 8, premiseId: 'm_shutter', via: 'director' },
    ],
    reply: {
      dialogue: 'Hold one more beat.',
      move: { figure: 'erotema', target_premise: null, intent: 'test' },
      release: null,
    },
  });
  assert.equal(out.release, 'p_chart');
  assert.equal(out.releaseDecision.played, 'p_chart');
  assert.equal(out.releaseDecision.offset, -1);
  assert.equal(out.releaseDecision.overridden, true);
  assert.equal(out.releaseDecision.pacingGuard.forcedSafe, true);
  assert.equal(out.releaseDecision.pacingGuard.forcedBy, 'last_safe_turn');
});

test('E3 pacing guard suppresses a late key release after the safe set closes', async () => {
  const out = await lanternReleaseTurn({
    turn: 19,
    ledger: [
      { turn: 2, premiseId: 'm_key', via: 'director' },
      { turn: 4, premiseId: 'p_bearing', via: 'tutor' },
      { turn: 6, premiseId: 'm_post', via: 'director' },
      { turn: 8, premiseId: 'm_shutter', via: 'director' },
      { turn: 9, premiseId: 'p_chart', via: 'tutor' },
      { turn: 13, premiseId: 'p_residue', via: 'director' },
    ],
    reply: {
      dialogue: 'Only now do we open the key book.',
      move: { figure: 'exemplum', target_premise: 'p_key', intent: 'release' },
      release: 'p_key',
      release_reason: 'the hand question is finally live',
    },
  });
  assert.equal(out.release, null);
  assert.equal(out.releaseDecision.played, null);
  assert.equal(out.releaseDecision.pacingGuard.blocked, true);
  assert.equal(out.releaseDecision.pacingGuard.candidate, 'p_key');
  assert.equal(out.releaseDecision.pacingGuard.alternativeTurn, null);
  assert.deepEqual(out.releaseDecision.pacingGuard.safeTurns.p_key, [15, 16, 17, 18]);
});

test('v3 selector arbitration ignores visible block/echo evidence and keeps the hidden-safe release', async () => {
  const out = await v3ReleaseTurn({
    turn: 6,
    ledger: [{ turn: 5, premiseId: 'p2', via: 'tutor' }],
    transcript: [{ turn: 5, role: 'learner', text: 'I am not sure what that was for.' }],
    reply: {
      dialogue: 'Now take the next exhibit.',
      move: { figure: 'exemplum', target_premise: 'p3', intent: 'release' },
      release: 'p3',
      release_reason: 'keep the proof moving',
    },
  });
  assert.equal(out.release, 'p3');
  assert.equal(out.releaseDecision.pacingGuard.blocked, false);
  assert.equal(out.releaseDecision.visibleGuard.blocked, true);
  assert.equal(out.releaseDecision.hybridGuard.accepted, false);
  assert.match(out.releaseDecision.hybridGuard.reason, /only visible_stall/);
});

test('v3 selector arbitration accepts a visible-stall push only when hidden marks it safe now', async () => {
  const transcript = [
    { turn: 2, role: 'learner', text: 'The first matter gives us a fairly stable footing.' },
    { turn: 3, role: 'learner', text: 'I can still describe the line of reasoning clearly.' },
    { turn: 5, role: 'learner', text: 'maybe?' },
    { turn: 6, role: 'learner', text: 'not sure?' },
  ];
  const out = await v3ReleaseTurn({
    turn: 6,
    ledger: [{ turn: 5, premiseId: 'p2', via: 'tutor' }],
    transcript,
    reply: {
      dialogue: 'Hold one beat.',
      move: { figure: 'erotema', target_premise: null, intent: 'test' },
      release: null,
    },
  });
  assert.equal(out.release, 'p3');
  assert.equal(out.releaseDecision.visibleGuard.forcedSafe, true);
  assert.equal(out.releaseDecision.visibleGuard.forcedBy, 'visible_stall');
  assert.equal(out.releaseDecision.hybridGuard.accepted, true);
  assert.equal(out.releaseDecision.hybridGuard.hiddenSafeAtCurrentTurn, true);
});

test('v3 selector arbitration rejects a visible-stall push when hidden says the current turn is unsafe', async () => {
  const out = await v3ReleaseTurn({
    turn: 4,
    transcript: [{ turn: 3, role: 'learner', text: 'I am stuck. Maybe? Not sure.' }],
    reply: {
      dialogue: 'Hold one beat.',
      move: { figure: 'erotema', target_premise: null, intent: 'test' },
      release: null,
    },
  });
  assert.equal(out.release, null);
  assert.equal(out.releaseDecision.visibleGuard.forcedSafe, true);
  assert.equal(out.releaseDecision.visibleGuard.forcedBy, 'visible_stall');
  assert.equal(out.releaseDecision.hybridGuard.accepted, false);
  assert.equal(out.releaseDecision.hybridGuard.hiddenSafeAtCurrentTurn, false);
});

// C5 — the license arithmetic. Ledger stages p1 at t1; the draft re-enters.

const p1Staged = {
  ledger: [{ turn: 1, premiseId: 'p1', via: 'director' }],
};
const reentryDraft = {
  dialogue: 'Back to the first entry.',
  move: { figure: 'erotema', target_premise: 'p1', intent: 'consolidate' },
};
const confrontRevision = {
  dialogue: 'Read it back to me, word for word.',
  move: { figure: 'erotema', target_premise: 'p1', intent: 'confront' },
};

async function confrontTurn({ turn, transcript, superegoReply, revisionReply = confrontRevision }) {
  const { client, calls } = stubClient({
    tutor: [reentryDraft, revisionReply],
    tutor_superego: [superegoReply],
  });
  const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, confront: true }));
  const out = await tutor(actsView(turn, { ...p1Staged, transcript }));
  return { out, calls };
}

test('C5: a bare re-entry is due, the fire revises the move into the confrontation', async () => {
  const { out, calls } = await confrontTurn({
    turn: 3,
    transcript: [tutorLine(1, { targetPremise: 'p1', intent: 'release' })],
    superegoReply: {
      intervene: true,
      jurisdiction: 'unconfronted_reentry',
      diagnosis: 'bare re-entry',
      note: 'Demand the read-back first.',
    },
  });
  assert.equal(out.move.intent, 'confront');
  assert.equal(out.move.targetPremise, 'p1');
  assert.equal(out.deliberation.intervened, true);
  assert.equal(out.deliberation.jurisdiction, 'unconfronted_reentry');
  assert.equal(out.deliberation.reentry.due, true);
  const segUser = calls.find((c) => c.role === 'tutor_superego').user;
  assert.ok(segUser.includes('the draft targets p1'));
  assert.ok(segUser.includes('Is this a figure rut, an uncovered re-entry, or neither?'));
  const revision = calls.filter((c) => c.role === 'tutor').at(-1);
  assert.equal(revision.meta.revision.jurisdiction, 'unconfronted_reentry');
  assert.equal(revision.meta.revision.confrontTarget, 'p1');
  assert.ok(revision.user.includes('Rewrite the move as a'));
});

test('C5: a confrontation since the last staging licenses the re-entry (not due)', async () => {
  const { out, calls } = await confrontTurn({
    turn: 4,
    transcript: [
      tutorLine(1, { targetPremise: 'p1', intent: 'release' }),
      tutorLine(2, { targetPremise: 'p1', intent: 'confront' }),
    ],
    superegoReply: { intervene: false, jurisdiction: null, diagnosis: 'covered', note: null },
  });
  assert.equal(out.move.intent, 'consolidate');
  assert.equal(out.deliberation.reentry.due, false);
  assert.equal(out.deliberation.reentry.confrontedSince, true);
  const segUser = calls.find((c) => c.role === 'tutor_superego').user;
  assert.ok(segUser.includes('a confrontation of it since then: yes'));
});

test('C5: a covered re-entry spends the license — the next bare re-entry falls due again', async () => {
  const { out } = await confrontTurn({
    turn: 6,
    transcript: [
      tutorLine(1, { targetPremise: 'p1', intent: 'release' }),
      tutorLine(2, { targetPremise: 'p1', intent: 'confront' }),
      tutorLine(4, { targetPremise: 'p1', intent: 'consolidate' }),
    ],
    superegoReply: {
      intervene: true,
      jurisdiction: 'unconfronted_reentry',
      diagnosis: 'license spent at t4',
      note: 'Demand the read-back again.',
    },
  });
  assert.equal(out.deliberation.reentry.due, true);
  assert.equal(out.deliberation.reentry.lastStagedTurn, 4);
  assert.equal(out.move.intent, 'confront');
});

test('C5: an unattributed fire on a due draft resolves to the re-entry jurisdiction', async () => {
  const { out } = await confrontTurn({
    turn: 3,
    transcript: [tutorLine(1, { targetPremise: 'p1', intent: 'release' })],
    superegoReply: { intervene: true, diagnosis: 'something is off', note: 'Hear it from the learner first.' },
  });
  assert.equal(out.deliberation.jurisdiction, 'unconfronted_reentry');
  assert.equal(out.move.intent, 'confront');
});

test('C5: a confront draft is never itself a re-entry', async () => {
  const { client, calls } = stubClient({
    tutor: [confrontRevision],
    tutor_superego: [{ intervene: false, jurisdiction: null, diagnosis: 'a confrontation', note: null }],
  });
  const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, confront: true }));
  const out = await tutor(
    actsView(3, { ...p1Staged, transcript: [tutorLine(1, { targetPremise: 'p1', intent: 'release' })] }),
  );
  assert.equal(out.deliberation.reentry.due, false);
  const segUser = calls.find((c) => c.role === 'tutor_superego').user;
  assert.ok(segUser.includes('a confrontation is never a re-entry'));
});

test('C2+C5: the release decision is made on the draft; a revision never moves it', async () => {
  const { client } = stubClient({
    tutor: [
      {
        ...reentryDraft,
        release: 'p2',
        release_reason: 'play it while the thread is warm',
      },
      // The revision claims a DIFFERENT release — it must be ignored.
      { ...confrontRevision, release: 'p3', release_reason: 'switch' },
    ],
    tutor_superego: [
      {
        intervene: true,
        jurisdiction: 'unconfronted_reentry',
        diagnosis: 'bare re-entry',
        note: 'Demand the read-back.',
      },
    ],
  });
  const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, confront: true, releaseAuthority: true }));
  const out = await tutor(
    actsView(4, { ...p1Staged, transcript: [tutorLine(1, { targetPremise: 'p1', intent: 'release' })] }),
  );
  assert.equal(out.move.intent, 'confront');
  assert.equal(out.release, 'p2');
  assert.equal(out.releaseReason, 'play it while the thread is warm');
  assert.equal(out.releaseDecision.claimed, 'p2');
});

// ---------------------------------------------------------------------------
// D. engine contract — scripted roles on the smoke world
// ---------------------------------------------------------------------------

const scheduled = (world, turn, via) => world.releaseSchedule.find((e) => e.turn === turn && e.via === via) || null;

/** Scripted cast: schedule-faithful releases; tutor move per `movePlan`. */
function scriptedRoles(world, { movePlan = {}, releaseExtras = {} } = {}) {
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
        ...(releaseExtras[view.turn] || {}),
      };
    },
    learner: async (view) => ({ dialogue: 'I am listening.', adopt: view.releasedThisTurn }),
  };
}

test('engine: a confront move never repairs; the licensed re-entry does', async () => {
  // rate 1 + grace 0 decays every grounded contingent premise from t3; p1
  // (staged t2, adopted t2) is down by t4. The confront at t4 must leave it
  // down; the consolidate at t5 restores it.
  const roles = scriptedRoles(smokeWorld, {
    movePlan: {
      4: { figure: 'erotema', targetPremise: 'p1', intent: 'confront' },
      5: { figure: 'erotema', targetPremise: 'p1', intent: 'consolidate' },
    },
  });
  const result = await runDrama({
    world: smokeWorld,
    roles,
    options: { decay: { rate: 1, graceTurns: 0, maxConcurrent: 4, startTurn: 3, seed: 1, mutateShare: 0 } },
  });
  const repairs = result.corruption.ledger.filter((e) => e.type === 'repair' && e.premiseId === 'p1');
  assert.ok(
    !repairs.some((e) => e.turn === 4),
    'the confrontation itself must not repair (the read-back would test nothing)',
  );
  assert.ok(
    repairs.some((e) => e.turn === 5 && e.via === 'tutor'),
    'the licensed re-entry restores the exhibit',
  );
});

test('engine: the C2 decision record rides the ledger row and the transcript meta', async () => {
  const decision = {
    turn: 5,
    windowSize: 1,
    claimed: 'p2',
    invalidClaim: false,
    forced: null,
    overridden: false,
    played: 'p2',
    scheduledTurn: 5,
    offset: 0,
    reason: 'on its turn',
  };
  const roles = scriptedRoles(smokeWorld, {
    releaseExtras: { 5: { releaseDecision: decision, releaseReason: 'on its turn' } },
  });
  const result = await runDrama({ world: smokeWorld, roles });
  const row = result.ledger.find((e) => e.premiseId === 'p2');
  assert.equal(row.via, 'tutor');
  assert.equal(row.reason, 'on its turn');
  assert.equal(row.offset, 0);
  const line = result.transcript.find((l) => l.role === 'tutor' && l.turn === 5);
  assert.deepEqual(line.meta.releaseDecision, decision);
  assert.equal(line.meta.releaseReason, 'on its turn');
  // Rows without a decision stay bare — the pre-P1 ledger shape.
  const p3row = result.ledger.find((e) => e.premiseId === 'p3');
  assert.ok(p3row && !('reason' in p3row) && !('offset' in p3row));
});

// ---------------------------------------------------------------------------
// E. instruments on synthetic results
// ---------------------------------------------------------------------------

test('confrontReport: covered/uncovered and the license-spent sequence, from the spoken record', () => {
  const result = {
    ledger: [{ turn: 1, premiseId: 'p_a', via: 'director' }],
    transcript: [
      tutorLine(1, { targetPremise: 'p_a', intent: 'release' }), // same-turn staging, not a re-entry
      tutorLine(3, { targetPremise: 'p_a', intent: 'consolidate' }), // uncovered
      tutorLine(5, { targetPremise: 'p_a', intent: 'confront' }),
      tutorLine(6, { targetPremise: 'p_a', intent: 'test' }), // covered by t5
      tutorLine(8, { targetPremise: 'p_a', intent: 'test' }), // license spent at t6
    ],
  };
  const report = confrontReport(result);
  assert.equal(report.confrontations.length, 1);
  assert.deepEqual(report.confrontations[0], { turn: 5, target: 'p_a', targetDecayed: null });
  assert.equal(report.reentries.total, 3);
  assert.equal(report.reentries.covered, 1);
  assert.deepEqual(
    report.reentries.uncovered.map((r) => r.turn),
    [3, 8],
  );
});

test('confrontReport: decay state at the moment of the demand, and the watcher fires', () => {
  const result = {
    ledger: [{ turn: 1, premiseId: 'p_a', via: 'director' }],
    corruption: {
      ledger: [
        { turn: 2, type: 'decay', premiseId: 'p_a', mode: 'delete' },
        { turn: 6, type: 'repair', premiseId: 'p_a', via: 'tutor' },
      ],
    },
    transcript: [
      tutorLine(5, { targetPremise: 'p_a', intent: 'confront' }), // down at t5
      tutorLine(
        6,
        { targetPremise: 'p_a', intent: 'consolidate' },
        {
          deliberation: {
            intervened: false,
            jurisdiction: null,
            reentry: { due: false, target: 'p_a', confrontedSince: true },
          },
        },
      ),
      tutorLine(8, { targetPremise: 'p_a', intent: 'confront' }), // repaired at t6 → up at t8
      tutorLine(
        9,
        { targetPremise: 'p_a', intent: 'confront' },
        {
          deliberation: {
            intervened: true,
            jurisdiction: 'unconfronted_reentry',
            reentry: { due: true, target: 'p_a', lastStagedTurn: 6 },
          },
        },
      ),
    ],
  };
  const report = confrontReport(result);
  assert.deepEqual(
    report.confrontations.map((c) => c.targetDecayed),
    [true, false, false],
  );
  assert.equal(report.superego.reentryFires, 1);
  assert.equal(report.superego.convertedToConfront, 1);
  assert.equal(report.superego.firesWithoutDue, 0);
  assert.equal(report.superego.draftsDueByRecord, 1);
});

test('confrontReport: null off the arm', () => {
  const result = {
    ledger: [{ turn: 1, premiseId: 'p_a', via: 'director' }],
    transcript: [tutorLine(3, { targetPremise: 'p_a', intent: 'consolidate' })],
  };
  assert.equal(confrontReport(result), null);
});

test('corruptionReport: confront-prompted retraction class, window {0,+1}, keys only on the arm', () => {
  const mutate = (turn, premiseId, falseForm) => ({
    turn,
    type: 'decay',
    premiseId,
    fact: ['true', premiseId],
    mode: 'mutate',
    falseForm,
  });
  const retract = (turn, premiseId, falseForm) => ({ turn, type: 'retract_false', premiseId, falseForm });
  const base = {
    trajectory: [],
    turnsPlayed: 12,
    corruption: {
      config: { seed: 1, rate: 1, graceTurns: 0 },
      decayedAtEnd: [],
      ledger: [
        mutate(3, 'p_m', ['false', 'a']),
        retract(5, 'p_m', ['false', 'a']), // confront t5 → window 0
        mutate(6, 'p_n', ['false', 'b']),
        retract(8, 'p_n', ['false', 'b']), // confront t7 → window 1
        mutate(9, 'p_o', ['false', 'c']),
        retract(12, 'p_o', ['false', 'c']), // confront t9 → window 3: not prompted
      ],
    },
    transcript: [
      tutorLine(5, { targetPremise: 'p_m', intent: 'confront' }),
      tutorLine(7, { targetPremise: 'p_n', intent: 'confront' }),
      tutorLine(9, { targetPremise: 'p_o', intent: 'confront' }),
    ],
  };
  const report = corruptionReport(base);
  assert.equal(report.mutations.confrontPromptedRetractions, 2);
  assert.deepEqual(
    report.timeline.map((t) => t.confrontPrompted),
    [true, true, false],
  );
  // Off the arm: no confront moves → neither the count nor the row key exists.
  const off = corruptionReport({ ...base, transcript: [] });
  assert.ok(!('confrontPromptedRetractions' in off.mutations));
  assert.ok(off.timeline.every((t) => !('confrontPrompted' in t)));
});

test('releaseDeviations: decision-series counts; null off the arm', () => {
  const dec = (turn, decision) => ({ turn, role: 'tutor', text: '', meta: { releaseDecision: { turn, ...decision } } });
  const result = {
    transcript: [
      dec(4, {
        windowSize: 1,
        claimed: 'p_x',
        invalidClaim: false,
        forced: null,
        overridden: false,
        played: 'p_x',
        offset: -1,
        reason: 'early, while it lands',
      }),
      dec(5, {
        windowSize: 1,
        claimed: null,
        invalidClaim: false,
        forced: null,
        overridden: false,
        played: null,
        offset: null,
        reason: null,
      }),
      dec(6, {
        windowSize: 2,
        claimed: 'p_q',
        invalidClaim: true,
        forced: null,
        overridden: false,
        played: null,
        offset: null,
        reason: null,
      }),
      dec(7, {
        windowSize: 2,
        claimed: null,
        invalidClaim: false,
        forced: 'p_y',
        overridden: true,
        played: 'p_y',
        offset: 2,
        reason: null,
      }),
      dec(9, {
        windowSize: 1,
        claimed: 'p_z',
        invalidClaim: false,
        forced: null,
        overridden: false,
        played: 'p_z',
        offset: 0,
        reason: 'its turn',
      }),
    ],
  };
  const report = releaseDeviations(result);
  assert.equal(report.turnsWithWindow, 5);
  assert.equal(report.played, 3);
  assert.equal(report.onSchedule, 1);
  assert.equal(report.early, 1);
  assert.equal(report.held, 1);
  assert.equal(report.forced, 1);
  assert.equal(report.overridden, 1);
  assert.equal(report.invalidClaims, 1);
  assert.deepEqual(
    report.reasons.map((r) => r.premise),
    ['p_x', 'p_z'],
  );
  assert.equal(releaseDeviations({ transcript: [tutorLine(2, { targetPremise: null, intent: 'test' })] }), null);
});

test('diagnosis shape discipline: P1 keys absent off the dials', async () => {
  const result = await runDrama({ world: smokeWorld, roles: scriptedRoles(smokeWorld) });
  const d = diagnose(result, smokeWorld);
  assert.ok(!('releaseDeviations' in d));
  assert.ok(!('confrontation' in d));
});

// ---------------------------------------------------------------------------
// F. mock causal chain — the P1 arm config on lantern, zero-cost
// ---------------------------------------------------------------------------

test('mock chain: full P1 arm on lantern — fires convert, nothing uncovered, deviation-zero releases', async () => {
  const client = makeLlmClient({ mode: 'mock' });
  const roles = {
    director: makeLlmDirector(lanternWorld, client, { actsMode: true }),
    tutor: makeLlmTutor(lanternWorld, client, {
      script: lanternScript,
      superego: true,
      decayVisibility: 'conduct',
      actsMode: true,
      confront: true,
      releaseAuthority: true,
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

  // The confrontation block: every watcher fire converts within-turn (the
  // mock revision always obeys), no uncovered re-entry is ever SPOKEN (a
  // re-entry draft either fires this jurisdiction or loses its target to a
  // rut revision), and the detector audit is clean.
  assert.ok(d.confrontation, 'confrontation block present on the arm');
  assert.ok(d.confrontation.superego.reentryFires >= 1, 'the mock choreography drives at least one fire');
  assert.equal(d.confrontation.superego.convertedToConfront, d.confrontation.superego.reentryFires);
  assert.equal(d.confrontation.superego.firesWithoutDue, 0);
  assert.equal(d.confrontation.reentries.uncovered.length, 0);
  assert.ok(d.confrontation.confrontations.length >= 1);

  // The release block: the mock policy plays each exhibit exactly on its
  // scheduled turn — deviation zero, nothing forced, nothing invalid.
  assert.ok(d.releaseDeviations, 'release block present on the arm');
  assert.equal(d.releaseDeviations.invalidClaims, 0);
  assert.equal(d.releaseDeviations.early, 0);
  assert.equal(d.releaseDeviations.held, 0);
  assert.equal(d.releaseDeviations.forced, 0);
  assert.equal(d.releaseDeviations.onSchedule, d.releaseDeviations.played);

  // Confront moves were spoken and the engine accepted them; none repaired.
  const confrontTurns = result.transcript
    .filter((l) => l.role === 'tutor' && (l.meta?.move?.intent || '').toLowerCase() === 'confront')
    .map((l) => ({ turn: l.turn, target: l.meta.move.targetPremise }));
  assert.ok(confrontTurns.length >= 1);
  for (const c of confrontTurns) {
    assert.ok(
      !result.corruption.ledger.some(
        (e) => e.type === 'repair' && e.turn === c.turn && e.premiseId === c.target && e.via === 'tutor',
      ),
      `confront at t${c.turn} must not repair ${c.target}`,
    );
  }

  // The panel renders both instrument lines.
  const panel = renderEvalPanel(d);
  assert.ok(panel.includes('**release authority**'));
  assert.ok(panel.includes('**confrontation**'));
});

test('mock chain: pacing guard preserves the on-cue lantern path', async () => {
  const client = makeLlmClient({ mode: 'mock' });
  const roles = {
    director: makeLlmDirector(lanternWorld, client, { actsMode: true }),
    tutor: makeLlmTutor(lanternWorld, client, {
      script: lanternScript,
      superego: true,
      decayVisibility: 'conduct',
      actsMode: true,
      confront: true,
      releaseAuthority: true,
      pacingGuard: true,
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
  assert.equal(d.releaseDeviations.invalidClaims, 0);
  assert.equal(d.releaseDeviations.early, 0);
  assert.equal(d.releaseDeviations.held, 0);
  assert.equal(d.releaseDeviations.onSchedule, d.releaseDeviations.played);
  assert.ok(
    d.releaseDeviations.decisions.some((decision) => decision.pacingGuard),
    'decision records carry pacing guard audit data',
  );
});
