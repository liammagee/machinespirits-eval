/**
 * Zero-call preflight for the learner cast of the scoreboard crossed run
 * (notes/2026-09-04-scoreboard-replay-prompt.md, Step 2).
 *
 * The brief casts each learner as a policy over the board: a trigger on the
 * board and the response bias the profile contract fixes for it
 * (scripts/tutor-stub-learner-profile-contracts.js). Before any paid call,
 * this module builds the trace records the extractor would write for each
 * trigger, runs the fixed Step 1 board reader over them, and checks two
 * things with no model call:
 *
 *   1. each trigger's response shows on the learner row the way the shape
 *      rules need it (a request; a licensed small move; a secret commitment
 *      without warrant; a defaulted challenge);
 *   2. a dialogue made of those triggers reads as the cast shape under
 *      readShape (low_agency -> permission_seeking, overconfident ->
 *      overconfident).
 *
 * Either miss fails the cast, and the run does not open. The reader and the
 * shape rules are not tuned here; only the cast is checked against them.
 */

import { buildScoreboard } from './tutorStubScoreboard.js';
import { castShapeForProfile, readShape } from './tutorStubScoreboardShapes.js';

export const SCOREBOARD_CAST_PROFILES = Object.freeze(['low_agency', 'overconfident']);

function culpritName(world) {
  const questionVar = (world.questionPattern || []).findIndex((a) => String(a).startsWith('?'));
  const atom = questionVar >= 0 ? world.secret?.fact?.[questionVar] : null;
  if (!atom) throw new Error(`world ${world.id} has no secret atom in its question pattern`);
  const s = String(atom);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function premiseSurface(premise) {
  const text = String(premise.surface || premise.text || premise.id);
  const first = text.split(/(?<=[.!?])\s+/u)[0] || text;
  return first.length > 160 ? `${first.slice(0, 157)}...` : first;
}

/**
 * The two casts. Each trigger names the board state that fires it (the
 * contract's `when`), the tutor line that produces that state, the learner
 * response the bias fixes, the extractor record for that response, and what
 * the learner row must show.
 */
export function scoreboardLearnerCasts(world) {
  const culprit = culpritName(world);
  const premises = world.premises || [];
  if (premises.length < 2) throw new Error(`world ${world.id} has fewer than two premises`);
  const clue = (i) => premises[i % premises.length];
  // The overconfident cast keeps the last premise unreleased. Once the whole
  // chain is public the culprit claim is warranted and the leap is no leap;
  // the reader says so (see the test). A live tutor under release pacing
  // holds the last link while the learner claims without warrant, and the
  // cast fixture does the same.
  const heldBackIndex = premises.length - 1;
  const openClue = (i) => premises[Math.min(i, heldBackIndex - 1)];
  const openClueReleases = (i) => i < heldBackIndex;
  return {
    low_agency: {
      shape: 'permission_seeking',
      triggers: [
        {
          id: 'asks_next_step',
          when: 'tutor asks for a next step',
          responseBias: 'ask whether the tutor can choose it',
          tutor: () => 'Good. What do you want to look at next?',
          learner: () => 'Could you choose the next step for me? I do not know this room well enough to pick.',
          record: () => ({}),
          expect: (row) => [
            ['request on the row', (row.provenance?.requests || 0) > 0],
            ['no node commitment', (row.provenance?.nodeCommitments || []).length === 0],
          ],
        },
        {
          id: 'narrow_task',
          when: 'tutor offers a narrow task',
          responseBias: 'attempt only if the task is very small',
          tutor: (i) => `${premiseSurface(clue(i))} Look only at that and tell me what it shows.`,
          tutorRecord: (i) => ({ releasePacing: { releasedNow: [clue(i).id], dueNow: [] } }),
          learner: (i) =>
            `Should I say that this puts the ${clue(i).id.replace(/^p_/u, '')} clue on the record? If that is what you want, I will note it and stop there.`,
          record: (i) => ({
            tutorLearnerDagUpdate: {
              preflight: { eligiblePublicPremiseIds: [clue(i).id] },
              accepted: { adopt: [clue(i).id], retract: [], derive: [], assertAnswer: null, hypothesis: null },
            },
          }),
          expect: (row) => [
            ['request on the row', (row.provenance?.requests || 0) > 0],
            ['one small node commitment', (row.provenance?.nodeCommitments || []).length === 1],
            ['commitment warranted', row.fields.entitlement_status === 'warranted'],
          ],
        },
      ],
    },
    overconfident: {
      shape: 'overconfident',
      triggers: [
        {
          id: 'incriminating_clue',
          when: 'a clue sounds incriminating',
          responseBias: 'name the likely culprit or secret too early',
          tutor: (i) => `${premiseSurface(openClue(i))} Take that in before you go further.`,
          tutorRecord: (i) =>
            openClueReleases(i) ? { releasePacing: { releasedNow: [openClue(i).id], dueNow: [] } } : {},
          learner: () => `That settles it for me. ${culprit} did it, and the rest is detail.`,
          record: () => ({
            tutorLearnerDagUpdate: {
              preflight: { eligiblePublicPremiseIds: [] },
              accepted: { adopt: [], retract: [], derive: [], assertAnswer: culprit, hypothesis: null },
            },
          }),
          expect: (row) => [
            ['secret commitment on the row', String(row.fields.commitment_undertaken).split('+').includes('secret')],
            ['not warranted', row.fields.entitlement_status !== 'warranted'],
          ],
        },
        {
          id: 'asked_for_support',
          when: 'tutor asks for support',
          responseBias: 'defend the leap until shown a concrete missing premise',
          tutor: () => `I challenge that. What on the record would show it was ${culprit} and no one else?`,
          tutorRecord: () => ({ warrantGateDecision: { revision_warranted: true, decision_kind: 'hold' } }),
          learner: () => `It was ${culprit}. What we already have is enough for me, and I am not backing off it.`,
          record: () => ({
            tutorLearnerDagUpdate: {
              preflight: { eligiblePublicPremiseIds: [] },
              accepted: { adopt: [], retract: [], derive: [], assertAnswer: culprit, hypothesis: null },
            },
          }),
          expect: (row) => [
            ['challenge defaulted', String(row.fields.challenge).split('+').includes('defaulted')],
            ['secret commitment on the row', String(row.fields.commitment_undertaken).split('+').includes('secret')],
          ],
        },
      ],
    },
  };
}

const RECORD_DEFAULTS = Object.freeze({
  tutorLearnerDagUpdate: {
    preflight: { eligiblePublicPremiseIds: [] },
    accepted: { adopt: [], retract: [], derive: [], assertAnswer: null, hypothesis: null },
  },
  proofDebt: { open: [], repaidNow: [] },
  releasePacing: { releasedNow: [], dueNow: [] },
});

/**
 * Build the trace events of one cast dialogue: the triggers fire in turn,
 * each at least once, over `turns` turns. The tutor line of turn N is the
 * trigger for the learner line of turn N+1; the opening is the first trigger.
 */
export function buildScoreboardCastEvents({ world, profile, policy = 'board', turns = 8 } = {}) {
  const casts = scoreboardLearnerCasts(world);
  const cast = casts[profile];
  if (!cast) throw new Error(`no scoreboard cast for profile ${profile}`);
  const { triggers } = cast;
  const events = [
    {
      type: 'run_start',
      metadata: {
        world: { id: world.id, title: world.title },
        experiment: { runSeed: 0, profile, policy, repeat: 0, jobId: `cast-preflight-${profile}` },
        autoLearner: { profileId: profile },
        provenance: { preflight: 'scoreboard-learner-cast', modelCalls: 0 },
      },
    },
  ];
  const firing = [];
  // Opening: the trigger for learner turn 1.
  const t0 = triggers[0];
  events.push({
    type: 'tutor_opening',
    turnId: 't0',
    text: `${world.title}. ${t0.tutor(0)}`,
  });
  let pendingTutorRecord = t0.tutorRecord ? t0.tutorRecord(0) : {};
  for (let turn = 1; turn <= turns; turn += 1) {
    const idx = (turn - 1) % triggers.length;
    const trig = triggers[idx];
    const next = triggers[turn % triggers.length];
    const cycle = Math.floor((turn - 1) / triggers.length);
    const learnerRecord = trig.record(cycle);
    const nextTutorRecord = next.tutorRecord ? next.tutorRecord(cycle + (turn % triggers.length === 0 ? 1 : 0)) : {};
    // The tutor record of turn N-1 (release or gate) belongs to the tutor line
    // that fired trigger N. The extractor writes it on that earlier record, so
    // it is carried on the previous turn_complete event.
    const previous = events[events.length - 1];
    if (previous?.type === 'turn_complete' && Object.keys(pendingTutorRecord).length) {
      Object.assign(previous.turnRecord, pendingTutorRecord);
    } else if (previous?.type === 'tutor_opening' && Object.keys(pendingTutorRecord).length) {
      // The opening carries no record; a release named there does not enter
      // the ledger. The cast does not depend on it for turn 1.
    }
    events.push({
      type: 'turn_complete',
      turn,
      turnId: `t${turn}`,
      turnRecord: {
        turn,
        turnId: `t${turn}`,
        learner: trig.learner(cycle),
        tutor: next.tutor(cycle + (turn % triggers.length === 0 ? 1 : 0)),
        ...structuredClone(RECORD_DEFAULTS),
        ...learnerRecord,
      },
    });
    firing.push({ turn, trigger: trig.id, when: trig.when, responseBias: trig.responseBias });
    pendingTutorRecord = nextTutorRecord;
  }
  const last = events[events.length - 1];
  if (last?.type === 'turn_complete' && Object.keys(pendingTutorRecord).length) {
    Object.assign(last.turnRecord, pendingTutorRecord);
  }
  return { events, firing, shape: cast.shape };
}

/** Run the cast check for one profile in one world. Zero model calls. */
export function checkScoreboardLearnerCast({ world, profile, policy = 'board', turns = 8 } = {}) {
  const casts = scoreboardLearnerCasts(world);
  const cast = casts[profile];
  if (!cast) throw new Error(`no scoreboard cast for profile ${profile}`);
  const { events, firing } = buildScoreboardCastEvents({ world, profile, policy, turns });
  const board = buildScoreboard({ events, world, arm: policy });
  const learnerRows = board.rows.filter((r) => r.speaker === 'learner');
  const triggerChecks = firing.map((f) => {
    const row = learnerRows.find((r) => r.turn === f.turn);
    const trig = cast.triggers.find((t) => t.id === f.trigger);
    const checks = row ? trig.expect(row) : [['learner row present', false]];
    return {
      turn: f.turn,
      trigger: f.trigger,
      when: f.when,
      responseBias: f.responseBias,
      ok: checks.every(([, ok]) => ok),
      checks: checks.map(([name, ok]) => ({ name, ok })),
      row: row
        ? {
            commitment_undertaken: row.fields.commitment_undertaken,
            entitlement_status: row.fields.entitlement_status,
            challenge: row.fields.challenge,
            requests: row.provenance?.requests || 0,
            licence_in_force: row.fields.licence_in_force,
          }
        : null,
    };
  });
  const read = readShape(board);
  const castShape = castShapeForProfile(profile);
  const everyTriggerFired = cast.triggers.every((t) => firing.some((f) => f.trigger === t.id));
  const unread = Object.values(board.unread || {}).reduce((a, b) => a + b, 0);
  const ok =
    everyTriggerFired && triggerChecks.every((t) => t.ok) && read.shape === castShape && castShape === cast.shape;
  return {
    world: world.id,
    profile,
    policy,
    turns,
    castShape,
    readShape: read.shape,
    truthy: read.truthy,
    everyTriggerFired,
    unread,
    modelCalls: 0,
    ok,
    triggers: triggerChecks,
  };
}

/** Run every cast in every world. `ok` is false when any cast fails. */
export function preflightScoreboardLearnerCast({
  worlds,
  profiles = SCOREBOARD_CAST_PROFILES,
  policies = ['board'],
  turns = 8,
} = {}) {
  const results = [];
  for (const world of worlds)
    for (const profile of profiles)
      for (const policy of policies) results.push(checkScoreboardLearnerCast({ world, profile, policy, turns }));
  return { ok: results.length > 0 && results.every((r) => r.ok), modelCalls: 0, results };
}

export function renderScoreboardCastReport(preflight) {
  const lines = [];
  lines.push(
    `Scoreboard learner cast preflight: ${preflight.ok ? 'PASS' : 'FAIL'} (model calls: ${preflight.modelCalls})`,
  );
  for (const r of preflight.results) {
    lines.push(
      `- ${r.world} / ${r.profile} / ${r.policy}: read ${r.readShape}, cast ${r.castShape}, ${r.ok ? 'ok' : 'FAIL'}; unread ${r.unread}`,
    );
    for (const t of r.triggers) {
      const failed = t.checks.filter((c) => !c.ok).map((c) => c.name);
      lines.push(
        `    turn ${t.turn} ${t.trigger}: ${t.ok ? 'ok' : `FAIL (${failed.join('; ')})`} [commitment=${t.row?.commitment_undertaken} entitlement=${t.row?.entitlement_status} challenge=${t.row?.challenge} requests=${t.row?.requests}]`,
      );
    }
  }
  return lines.join('\n');
}
