/**
 * C1 — the act-plot commitment loop (notes/poetics/2026-06-11-desire-
 * multiturn-strategy-plan.md §5) — guarantees:
 *
 *   A. BUILD GUARDS — the plot is an act-scale commitment and the act-close
 *      audit is the superego's jurisdiction; contradictory wirings fail at
 *      build, not mid-drama.
 *   B. CHARTER STABILITY — both charters are untouched when the dial is off;
 *      --plot adds exactly the plot charter + the reply field (tutor) and the
 *      context clause (superego); the audit charter carries the three
 *      verdicts, vague-is-drift, and the no-concealed-channels discipline.
 *   C. LIFECYCLE — one bridge instance over evolving views: commit at the
 *      opening (no audit behind act 1), read the standing plot back mid-act
 *      (a mid-act re-commitment is ignored), audit FIRST at the next opening
 *      with the verdicts in the same prompt that demands the next plot (the
 *      binding is the ordering); a verdict outside the contract gates to
 *      unscored; a malformed plot runs the act unplotted and the next opening
 *      audits nothing (absence is data); an intervened opening keeps its
 *      commitment (revision rewrite honored, parse-miss falls back).
 *   D. ENGINE CONTRACT — plot/plotAudit rows ride the result, the events log,
 *      and the transcript meta (the theory recording pattern, zero engine
 *      config); the finalAudit hook fires exactly once at the run-end act
 *      close and is acts-gated; the OFF arm has no plot key anywhere.
 *   E. INSTRUMENTS — plotReport's form and cross-check measures (disciplined
 *      plots, named-vs-staged hold exhibits, verdict mix incl. the unscored
 *      gate, final-audit inclusion); null off the arm.
 *   F. MOCK CAUSAL CHAIN — the full dial stack on world-002-lantern
 *      (acts + decay + superego + confront + release authority + plot),
 *      zero-cost: one plot per act, every plot audited (boundaries + run
 *      end), mock plots disciplined by construction, and the panel renders
 *      the plot line beside the P1 instruments.
 *
 * NOTE the mock-artifact boundary (as in the stall-watch and confront
 * suites): the mock cast exercises plumbing and instruments, never the
 * hypothesis — the mock plot is schedule-derived and the mock audit echoes
 * bridge-computed verdicts. The paid arm is where conduct is measured.
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
  plotReport,
  renderEvalPanel,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const smokeWorld = loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));
const lanternWorld = loadWorld(path.join(ROOT, 'config/drama-derivation/world-002-lantern.yaml'));
const lanternScript = fs.readFileSync(path.join(ROOT, 'config/drama-derivation/tutor-scripts/lantern-v001.md'), 'utf8');
const SCRIPT = 'Stay with the inquiry; release on cue; never name the conclusion.';

/** Build options for a legal acts-mode tutor (decayVisibility is forced). */
const actsOpts = (extra = {}) => ({ script: SCRIPT, actsMode: true, decayVisibility: 'conduct', ...extra });

/** Acts-mode view with the closed-act history the plot lifecycle reads. */
const plotView = (turn, { index = 1, startTurn = 1, closed = [], ledger = [], transcript = [] } = {}) => ({
  turn,
  ledger,
  transcript,
  acts: { index, startTurn, turnsThisAct: turn - startTurn, brief: null, closed },
});

const tutorLine = (turn, move, extraMeta = {}) => ({
  turn,
  role: 'tutor',
  text: '(line)',
  meta: { move: { figure: 'erotema', ...move }, ...extraMeta },
});

/**
 * Stub client: scripted JSON per (role, call-ordinal), recording every
 * payload so charter and prompt assertions read what the bridge actually
 * sent. `tutor_superego` replies are consumed in order — on an act-opening
 * turn the AUDIT reply comes first, then the watch reply.
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

// Shared fixtures: model-shaped plots (raw hold_by_end key) and a quiet watcher.
const act1Plot = {
  hold_by_end: ['the learner holds p1 beside what already stands'],
  withhold: 'p2 waits until p1 has landed',
  friction: 'the learner may leap early',
  fallback: 'restage what is garbled',
};
const act2Plot = {
  hold_by_end: ['the learner reads p2 back'],
  withhold: 'p3 waits until p2 has landed',
  friction: 'fatigue at the board',
  fallback: 'shorten the turn',
};
const opening = (plotObj, extra = {}) => ({
  dialogue: 'We begin with what stands.',
  move: { figure: 'erotema', target_premise: null, intent: 'consolidate' },
  ...(plotObj === undefined ? {} : { plot: plotObj }),
  ...extra,
});
const watchOk = { intervene: false, diagnosis: 'serves', note: null };
const closed13 = [{ act: 1, turns: [1, 3], endedBy: 'director', brief: null }];

// ---------------------------------------------------------------------------
// A. build guards
// ---------------------------------------------------------------------------

test('plot without acts mode fails at build', () => {
  const { client } = stubClient({});
  assert.throws(() => makeLlmTutor(smokeWorld, client, { script: SCRIPT, superego: true, plot: true }), /acts mode/);
});

test('plot without the superego fails at build (the audit needs its auditor)', () => {
  const { client } = stubClient({});
  assert.throws(() => makeLlmTutor(smokeWorld, client, actsOpts({ plot: true })), /superego/);
});

test('plot composes with the full dial stack (legal build does not throw)', () => {
  const { client } = stubClient({});
  assert.doesNotThrow(() =>
    makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, confront: true, releaseAuthority: true, plot: true })),
  );
});

// ---------------------------------------------------------------------------
// B. charter stability
// ---------------------------------------------------------------------------

async function plotSystems({ plot = false } = {}) {
  const { client, calls } = stubClient({
    tutor: [opening(undefined)],
    tutor_superego: [watchOk],
  });
  const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, plot }));
  await tutor(plotView(2)); // mid-act: no opening demand, no audit
  return {
    tutorSystem: calls.find((c) => c.role === 'tutor').system,
    superegoSystem: calls.find((c) => c.role === 'tutor_superego').system,
  };
}

test('dial off: no plot charter, no reply field, no superego context clause', async () => {
  const { tutorSystem, superegoSystem } = await plotSystems();
  assert.ok(!tutorSystem.includes('# The act plot'));
  assert.ok(!tutorSystem.includes('hold_by_end'));
  assert.ok(!tutorSystem.includes('"plot"'));
  assert.ok(!superegoSystem.includes('standing PLOT'));
});

test('dial on: the plot charter, the reply field, and the superego context clause — context, not jurisdiction', async () => {
  const { tutorSystem, superegoSystem } = await plotSystems({ plot: true });
  assert.ok(tutorSystem.includes('# The act plot (committed at each opening; audited at each close)'));
  assert.ok(tutorSystem.includes('"hold_by_end": one to three claims the learner should DEMONSTRABLY hold'));
  assert.ok(tutorSystem.includes('The plot is a commitment, not a mood.'));
  assert.ok(/A clause too vague to\s+check audits as drift/.test(tutorSystem));
  assert.ok(tutorSystem.includes("BINDS: your next act's plot must answer every drifted clause"));
  assert.ok(/Mid-act turns commit no\s+new plot; they play under the standing one\./.test(tutorSystem));
  assert.ok(
    tutorSystem.includes(
      ', "plot": {"hold_by_end": ["<claim>", ...], "withhold": "...", "friction": "...", "fallback": "..."}',
    ),
  );
  assert.ok(
    tutorSystem.includes('("plot" belongs to act-opening turns ONLY — the harness marks them; omit the key mid-act.)'),
  );
  assert.ok(superegoSystem.includes("The draft may come with the tutor's standing PLOT for the act (committed"));
  assert.ok(superegoSystem.includes('act-close audit, not the turn watch, judges the plot.'));
});

test('the audit charter: a second seat with the three verdicts, vague-is-drift, and no concealed channels', async () => {
  const { client, calls } = stubClient({
    tutor: [opening(act1Plot), opening(act2Plot)],
    tutor_superego: [watchOk, { audit: [{ clause: 'x', verdict: 'kept', evidence: 'y' }], summary: 's' }, watchOk],
  });
  const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, plot: true }));
  await tutor(plotView(1));
  await tutor(plotView(4, { index: 2, startTurn: 4, closed: closed13 }));
  const auditCall = calls.filter((c) => c.role === 'tutor_superego')[1];
  assert.ok(auditCall.system.includes('ACT-CLOSE AUDITOR'));
  assert.ok(auditCall.system.includes('"kept" — the record honours the clause'));
  assert.ok(auditCall.system.includes('"justified_deviation" — the clause was bent and the record shows why'));
  assert.ok(auditCall.system.includes('"drift" — the act wandered off the clause'));
  assert.ok(auditCall.system.includes('A clause too vague to check is drift by default.'));
  assert.ok(auditCall.system.includes("No secret, no exhibit ledger, no view of the learner's board."));
  assert.ok(auditCall.system.includes('Your audit reaches the tutor alone — never the stage.'));
});

// ---------------------------------------------------------------------------
// C. lifecycle — one bridge instance over evolving views
// ---------------------------------------------------------------------------

test('C1 lifecycle: commit at the opening, read back mid-act, audit FIRST at the next opening — the verdict binds', async () => {
  const auditReply = {
    audit: [
      {
        clause: 'the learner holds p1 beside what already stands',
        verdict: 'kept',
        evidence: 'read back at turn 3',
      },
      // a verdict outside the contract — must gate to 'unscored'
      { clause: 'p2 waits until p1 has landed', verdict: 'mostly', evidence: 'staged early' },
    ],
    summary: 'One clause held; the withhold broke early.',
  };
  const { client, calls } = stubClient({
    tutor: [
      opening(act1Plot),
      // mid-act: the model tries to re-commit — must be ignored
      opening({ ...act1Plot, withhold: 'DECOY never to stand' }),
      opening(act2Plot),
    ],
    tutor_superego: [watchOk, watchOk, auditReply, watchOk],
  });
  const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, plot: true }));

  // t1 — act 1 opens with nothing behind it: demand, commit, no audit.
  const out1 = await tutor(plotView(1));
  assert.equal(calls.filter((c) => c.role === 'tutor_superego').length, 1, 'watch only — no act behind act 1');
  const t1user = calls.find((c) => c.role === 'tutor').user;
  assert.ok(
    t1user.includes('THIS TURN OPENS ACT 1 — COMMIT YOUR PLOT for the act in "plot", alongside your dialogue.'),
  );
  assert.ok(!t1user.includes('THE AUDIT of your act'));
  assert.ok(!t1user.includes('(No audit'));
  assert.deepEqual(out1.plot, {
    act: 1,
    turn: 1,
    holdByEnd: ['the learner holds p1 beside what already stands'],
    withhold: 'p2 waits until p1 has landed',
    friction: 'the learner may leap early',
    fallback: 'restage what is garbled',
  });
  assert.ok(!('plotAudit' in out1));

  // t2 — mid-act: the standing plot is read back; the reply's plot is ignored.
  const out2 = await tutor(plotView(2));
  const t2user = calls.filter((c) => c.role === 'tutor').at(-1).user;
  assert.ok(t2user.includes('YOUR PLOT for this act (committed at its opening):'));
  assert.ok(t2user.includes('- hold_by_end[1]: the learner holds p1 beside what already stands'));
  assert.ok(t2user.includes('Play under it; the audit at the act close distinguishes justified deviation from drift.'));
  assert.ok(!t2user.includes('COMMIT YOUR PLOT'));
  assert.ok(!('plot' in out2));
  assert.ok(!('plotAudit' in out2));

  // t4 — act 2 opens: the audit call comes FIRST, the verdicts land in the
  // same prompt that demands the next plot, and the audit row rides the out.
  const t4transcript = [
    tutorLine(1, { targetPremise: null, intent: 'consolidate' }),
    { turn: 2, role: 'director', text: 'unseen direction', meta: {} },
    { turn: 2, role: 'learner', text: 'I see p1 now.', meta: {} },
    { turn: 3, role: 'learner', text: 'I hold p1 beside the rest.', meta: {} },
  ];
  const before = calls.length;
  const out4 = await tutor(
    plotView(4, {
      index: 2,
      startTurn: 4,
      closed: closed13,
      transcript: t4transcript,
      ledger: [{ turn: 2, premiseId: 'p1', via: 'tutor' }],
    }),
  );
  assert.deepEqual(
    calls.slice(before).map((c) => c.role),
    ['tutor_superego', 'tutor', 'tutor_superego'],
    'audit first, then the draft that reads its verdicts, then the watch',
  );

  // The audit call: the t1 plot (not the mid-act decoy) against the act-1
  // public record only — tutor/learner lines in span, staged ids, no director.
  const auditCall = calls[before];
  assert.ok(auditCall.user.includes('Act 1 has closed (turns 1–3).'));
  assert.ok(auditCall.user.includes('- withhold: p2 waits until p1 has landed'));
  assert.ok(!auditCall.user.includes('DECOY'));
  assert.ok(auditCall.user.includes('Exhibits staged during the act: p1.'));
  assert.ok(auditCall.user.includes('[turn 3] LEARNER: I hold p1 beside the rest.'));
  assert.ok(!auditCall.user.includes('unseen direction'));

  // The verdict row: gated verdict, act-tagged, on the out.
  assert.deepEqual(out4.plotAudit, {
    act: 1,
    clauses: [
      {
        clause: 'the learner holds p1 beside what already stands',
        verdict: 'kept',
        evidence: 'read back at turn 3',
      },
      { clause: 'p2 waits until p1 has landed', verdict: 'unscored', evidence: 'staged early' },
    ],
    summary: 'One clause held; the withhold broke early.',
  });

  // The new demand carries the verdicts and the binding clause.
  const t4user = calls[before + 1].user;
  assert.ok(t4user.includes('THE AUDIT of your act 1 plot (your own watcher, clause by clause):'));
  assert.ok(t4user.includes('- [kept] the learner holds p1 beside what already stands — read back at turn 3'));
  assert.ok(t4user.includes('- [unscored] p2 waits until p1 has landed — staged early'));
  assert.ok(t4user.includes("The auditor's summary: One clause held; the withhold broke early."));
  assert.ok(t4user.includes('THE AUDIT BINDS: the plot you now commit must answer every drifted'));
  assert.ok(
    t4user.includes('THIS TURN OPENS ACT 2 — COMMIT YOUR PLOT for the act in "plot", alongside your dialogue.'),
  );

  // The act-2 commitment stands, and the watch sees it as context.
  assert.equal(out4.plot.act, 2);
  assert.equal(out4.plot.turn, 4);
  assert.equal(out4.plot.withhold, 'p3 waits until p2 has landed');
  const t4watch = calls[before + 2].user;
  assert.ok(t4watch.includes("The tutor's standing PLOT for this act (context only — the act-close audit judges it):"));
  assert.ok(t4watch.includes('- withhold: p3 waits until p2 has landed'));
});

test('C1 absence is data: a malformed opening plot runs the act unplotted; the next opening audits nothing', async () => {
  const { client, calls } = stubClient({
    tutor: [opening('winging it'), opening(act2Plot)],
    tutor_superego: [watchOk, watchOk],
  });
  const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, plot: true }));
  const out1 = await tutor(plotView(1));
  assert.ok(!('plot' in out1), "a malformed plot is not fabricated on the model's behalf");
  const out3 = await tutor(
    plotView(3, { index: 2, startTurn: 3, closed: [{ act: 1, turns: [1, 2], endedBy: 'director', brief: null }] }),
  );
  assert.equal(
    calls.filter((c) => c.role === 'tutor_superego').length,
    2,
    'watch calls only — no plot on record, no audit call',
  );
  assert.ok(!('plotAudit' in out3));
  const t3user = calls.filter((c) => c.role === 'tutor').at(-1).user;
  assert.ok(t3user.includes('(No audit: the previous act closed without a plot on record.)'));
  assert.ok(t3user.includes('THIS TURN OPENS ACT 2'));
});

test('C1 revision: an intervened opening keeps its commitment — rewrite honored, parse-miss falls back to the draft', async () => {
  const rutTranscript = [
    tutorLine(1, { targetPremise: null, intent: 'test' }),
    tutorLine(2, { targetPremise: null, intent: 'test' }),
  ];
  const fire = { intervene: true, diagnosis: 'a third erotema', note: 'Leave the device this turn.' };
  const revision = (extra = {}) => ({
    dialogue: 'Another way in.',
    move: { figure: 'exemplum', target_premise: null, intent: 'test' },
    ...extra,
  });

  // Arm 1: the revision rewrites the plot — the rewrite is the commitment.
  {
    const { client } = stubClient({
      tutor: [opening(act1Plot), revision({ plot: act2Plot })],
      tutor_superego: [fire],
    });
    const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, plot: true }));
    const out = await tutor(plotView(3, { index: 2, startTurn: 3, transcript: rutTranscript }));
    assert.equal(out.move.figure, 'exemplum');
    assert.equal(out.deliberation.intervened, true);
    assert.deepEqual([out.plot.act, out.plot.turn, out.plot.withhold], [2, 3, 'p3 waits until p2 has landed']);
  }

  // Arm 2: the revision omits the plot — the draft's commitment stands.
  {
    const { client } = stubClient({
      tutor: [opening(act1Plot), revision()],
      tutor_superego: [fire],
    });
    const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, plot: true }));
    const out = await tutor(plotView(3, { index: 2, startTurn: 3, transcript: rutTranscript }));
    assert.equal(out.plot.withhold, 'p2 waits until p1 has landed');
  }
});

// ---------------------------------------------------------------------------
// D. engine contract — scripted roles on the smoke world
// ---------------------------------------------------------------------------

const scheduled = (world, turn, via) => world.releaseSchedule.find((e) => e.turn === turn && e.via === via) || null;

test('engine: plot and audit rows ride the result, events, and transcript meta; the final audit fires once', async () => {
  const plotRow = (act, turn) => ({
    act,
    turn,
    holdByEnd: ['the learner holds p1'],
    withhold: 'p2 waits',
    friction: 'a leap',
    fallback: 'restage',
  });
  const auditRow = {
    act: 1,
    clauses: [
      { clause: 'the learner holds p1', verdict: 'kept', evidence: 'read back' },
      { clause: 'p2 waits', verdict: 'sideways', evidence: '' }, // unscored in the tally
    ],
    summary: 'held, mostly',
  };
  const finalCalls = [];
  const tutor = async (view) => {
    const openingTurn = view.acts.startTurn === view.turn;
    return {
      dialogue: 'Consider the board.',
      move: { figure: 'erotema', targetPremise: null, intent: 'consolidate' },
      release: null,
      ...(openingTurn ? { plot: plotRow(view.acts.index, view.turn) } : {}),
      ...(openingTurn && view.acts.index === 2 ? { plotAudit: auditRow } : {}),
    };
  };
  tutor.finalAudit = async (payload) => {
    finalCalls.push(payload);
    return {
      act: payload.acts.at(-1).act,
      clauses: [{ clause: 'stood to the end', verdict: 'drift', evidence: 'no record' }],
      summary: 'final audit',
    };
  };
  const roles = {
    director: async (view) => ({
      direction: view.turn === 3 ? 'Act two.' : '[holds]',
      release: scheduled(smokeWorld, view.turn, 'director')?.premise || null,
      ...(view.turn === 3 ? { act: 'end' } : {}),
    }),
    tutor,
    learner: async (view) => ({ dialogue: 'I am listening.', adopt: view.releasedThisTurn }),
  };
  const result = await runDrama({ world: smokeWorld, roles, options: { acts: { minActTurns: 2, maxActTurns: 99 } } });

  // Two acts: [1,2] director-closed at t3; [3,cap] closed at run end.
  assert.equal(result.acts.length, 2);
  assert.deepEqual(result.acts[0].turns, [1, 2]);

  assert.deepEqual(
    result.plot.plots.map((p) => [p.act, p.turn]),
    [
      [1, 1],
      [2, 3],
    ],
  );
  assert.equal(result.plot.audits.length, 2);
  assert.deepEqual(result.plot.audits[0], { turn: 3, ...auditRow });
  const fin = result.plot.audits[1];
  assert.equal(fin.final, true);
  assert.equal(fin.turn, result.turnsPlayed);
  assert.equal(fin.act, 2);

  // The hook: exactly once, after the final act seals.
  assert.equal(finalCalls.length, 1);
  assert.equal(finalCalls[0].acts.at(-1).endedBy, 'run_end');
  assert.ok(Array.isArray(finalCalls[0].transcript) && Array.isArray(finalCalls[0].ledger));

  // Transcript meta on the boundary turn carries both rows.
  const t3line = result.transcript.find((l) => l.role === 'tutor' && l.turn === 3);
  assert.deepEqual(t3line.meta.plot, plotRow(2, 3));
  assert.deepEqual(t3line.meta.plotAudit, auditRow);

  // Events: commitments, audits, the unscored gate in the tally, the run-end suffix.
  assert.equal(result.events.filter((e) => e.type === 'plot').length, 2);
  const auditEvents = result.events.filter((e) => e.type === 'plot_audit');
  assert.equal(auditEvents.length, 2);
  assert.equal(auditEvents[0].detail, 'act 1 plot audited: kept 1, justified 0, drift 0, unscored 1');
  assert.ok(auditEvents[1].detail.includes('at run end'));
});

test('engine: no plot key off the arm; the final-audit hook is acts-gated', async () => {
  const finalCalls = [];
  const bare = async () => ({
    dialogue: 'On we go.',
    move: { figure: 'erotema', targetPremise: null, intent: 'test' },
    release: null,
  });
  bare.finalAudit = async (payload) => {
    finalCalls.push(payload);
    return { act: 1, clauses: [{ clause: 'x', verdict: 'kept', evidence: '' }], summary: null };
  };
  const roles = {
    director: async (view) => ({
      direction: '[holds]',
      release: scheduled(smokeWorld, view.turn, 'director')?.premise || null,
    }),
    tutor: bare,
    learner: async (view) => ({ dialogue: 'Listening.', adopt: view.releasedThisTurn }),
  };
  const result = await runDrama({ world: smokeWorld, roles });
  assert.ok(!('plot' in result));
  assert.equal(finalCalls.length, 0, 'no acts, no run-end act close, no hook');
  const d = diagnose(result, smokeWorld);
  assert.ok(!('plot' in d));
});

// ---------------------------------------------------------------------------
// E. instruments on synthetic results
// ---------------------------------------------------------------------------

test('plotReport: discipline, named-vs-staged cross-check, verdict mix with the unscored gate, final inclusion', () => {
  const result = {
    ledger: [
      { turn: 2, premiseId: 'p_a', via: 'tutor' },
      { turn: 5, premiseId: 'p_b', via: 'director' },
    ],
    acts: [
      { act: 1, turns: [1, 3], endedBy: 'director' },
      { act: 2, turns: [4, 7], endedBy: 'run_end' },
    ],
    plot: {
      plots: [
        {
          act: 1,
          turn: 1,
          holdByEnd: ['the learner holds p_a', 'p_b stays legible'],
          withhold: 'p_b waits',
          friction: 'a leap',
          fallback: 'restage',
        },
        {
          act: 2,
          turn: 4,
          holdByEnd: ['the learner reads p_b back'],
          withhold: null,
          friction: 'fatigue',
          fallback: null,
        },
      ],
      audits: [
        {
          turn: 4,
          act: 1,
          clauses: [
            { clause: 'c1', verdict: 'kept', evidence: '' },
            { clause: 'c2', verdict: 'drift', evidence: '' },
            { clause: 'c3', verdict: 'mystery', evidence: '' },
          ],
          summary: null,
        },
        {
          turn: 7,
          final: true,
          act: 2,
          clauses: [{ clause: 'c4', verdict: 'justified_deviation', evidence: '' }],
          summary: 's',
        },
      ],
    },
  };
  assert.deepEqual(plotReport(result, null), {
    plots: {
      count: 2,
      disciplined: 1,
      meanClauses: 3.5,
      perAct: [
        {
          act: 1,
          turn: 1,
          clauseCount: 5,
          hasWithhold: true,
          hasFriction: true,
          holdNamed: ['p_a', 'p_b'],
          holdStagedInAct: ['p_a'],
          withholdNamed: ['p_b'],
          withholdPlayedInAct: [],
        },
        {
          act: 2,
          turn: 4,
          clauseCount: 2,
          hasWithhold: false,
          hasFriction: true,
          holdNamed: ['p_b'],
          holdStagedInAct: ['p_b'],
          withholdNamed: [],
          withholdPlayedInAct: [],
        },
      ],
    },
    audits: {
      count: 2,
      finalIncluded: true,
      verdictMix: { kept: 1, justified_deviation: 1, drift: 1, unscored: 1 },
      perAct: [
        { act: 1, turn: 4, final: false, clauses: 3, mix: { kept: 1, justified_deviation: 0, drift: 1, unscored: 1 } },
        { act: 2, turn: 7, final: true, clauses: 1, mix: { kept: 0, justified_deviation: 1, drift: 0, unscored: 0 } },
      ],
    },
    crossCheck: { holdNamed: 3, holdStagedInAct: 2, withholdNamed: 1, withholdPlayedInAct: 0 },
  });
});

test('plotReport: null off the arm and on empty blocks', () => {
  assert.equal(plotReport({ ledger: [], transcript: [] }), null);
  assert.equal(plotReport({ plot: { plots: [], audits: [] }, ledger: [] }), null);
});

// ---------------------------------------------------------------------------
// F. mock causal chain — the full dial stack on lantern, zero-cost
// ---------------------------------------------------------------------------

test('mock chain: C1 on the full stack — a plot per act, every plot audited, the panel renders the line', async () => {
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
      plot: true,
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

  // One commitment per act (the mock plotHint always parses), every plot
  // audited — boundary audits for the inner acts, the run-end hook for the
  // last — and the rows agree with the events log.
  assert.ok(result.plot, 'plot block present on the arm');
  assert.equal(result.plot.plots.length, result.acts.length, 'one plot per act opening');
  assert.equal(result.plot.audits.length, result.plot.plots.length, 'every plot audited');
  assert.ok(result.plot.audits.at(-1).final, 'the final act audit is the run-end hook');
  assert.equal(result.events.filter((e) => e.type === 'plot').length, result.plot.plots.length);
  const auditEvents = result.events.filter((e) => e.type === 'plot_audit');
  assert.equal(auditEvents.length, result.plot.audits.length);
  assert.ok(auditEvents.at(-1).detail.includes('at run end'));

  // Each opening turn's transcript meta carries its commitment.
  for (const p of result.plot.plots) {
    const line = result.transcript.find((l) => l.role === 'tutor' && l.turn === p.turn);
    assert.deepEqual(line.meta.plot, p);
  }

  // The mock plot is disciplined by construction (withhold + friction), names
  // at least one exhibit, and the mock audit stays inside the verdict contract.
  assert.equal(d.plot.plots.disciplined, d.plot.plots.count);
  assert.ok(d.plot.crossCheck.holdNamed >= 1);
  assert.equal(d.plot.audits.verdictMix.unscored, 0);
  assert.ok(d.plot.audits.finalIncluded);

  // No cross-dial interference: the P1 instruments keep their mock contracts.
  assert.ok(d.confrontation);
  assert.ok(d.releaseDeviations);
  assert.equal(d.releaseDeviations.invalidClaims, 0);

  // The panel renders the plot line beside the P1 lines.
  const panel = renderEvalPanel(d);
  assert.ok(panel.includes('**plot**'));
  assert.ok(panel.includes('**release authority**'));
  assert.ok(panel.includes('**confrontation**'));
});
