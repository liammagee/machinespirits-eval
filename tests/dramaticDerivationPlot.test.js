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
 *   G. TWO-LAYER PLANNING (§11 pre-run amendment, 2026-06-12) — the
 *      THROUGHLINE: the whole play's plan above the act plots. Guard (no
 *      plot loop, nothing binds), charter stability both ways, lifecycle
 *      (commit at the first turn, read-back every turn above the act plot,
 *      arc verdicts ride the act-close audit, off_arc binds the next
 *      opening's revision, on_arc permits a declared voluntary one, the
 *      run-end audit reckons the throughline clause by clause on the same
 *      call), engine rows/events/meta, the report block, and the mock chain
 *      — zero new LLM calls anywhere.
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

// ---------------------------------------------------------------------------
// G. two-layer planning — the throughline above the act plots
// ---------------------------------------------------------------------------

// Model-shaped throughlines (raw hold_to_end key) and their normalized rows.
const tl1 = {
  arc: ['the learner holds p1 and can say why', 'the learner joins p1 to p2'],
  hold_to_end: 'the conclusion stays unsaid until the board forces it',
  risk: 'the play stages evidence and never forces the join',
  salvage: 'fall back to the smallest two-fact join',
};
const tlRowOf = (tl) => ({ arc: tl.arc, holdToEnd: tl.hold_to_end, risk: tl.risk, salvage: tl.salvage });
const tl2 = { ...tl1, arc: ['the learner rebuilds the board after each break', 'the learner joins p1 to p2'] };
const tl3 = { ...tl1, arc: ['the learner forces the join unprompted'] };

test('G guard: throughline without the plot loop fails at build (no audit, nothing binds)', () => {
  const { client } = stubClient({});
  assert.throws(
    () => makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, throughline: true })),
    /throughline requires plot/,
  );
});

/** Capture all three charters (tutor, watch, audit) for a given dial pair. */
async function throughlineSystems({ throughline = false } = {}) {
  const { client, calls } = stubClient({
    tutor: [opening(act1Plot, throughline ? { throughline: tl1 } : {}), opening(act2Plot)],
    tutor_superego: [watchOk, { audit: [{ clause: 'x', verdict: 'kept', evidence: 'y' }], summary: 's' }, watchOk],
  });
  const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, plot: true, throughline }));
  await tutor(plotView(1));
  await tutor(plotView(4, { index: 2, startTurn: 4, closed: closed13 }));
  return {
    tutorSystem: calls.find((c) => c.role === 'tutor').system,
    superegoSystem: calls.find((c) => c.role === 'tutor_superego').system,
    auditSystem: calls.filter((c) => c.role === 'tutor_superego')[1].system,
  };
}

test('G dial off: the plot-only arm carries no throughline strings in any charter (the C1 regression pin)', async () => {
  const { tutorSystem, superegoSystem, auditSystem } = await throughlineSystems();
  assert.ok(!tutorSystem.includes('# The throughline'));
  assert.ok(!tutorSystem.includes('"throughline"'));
  assert.ok(!tutorSystem.includes('THROUGHLINE'));
  assert.ok(!superegoSystem.includes('THROUGHLINE'));
  assert.ok(superegoSystem.includes('act-close audit, not the turn watch, judges the plot.'));
  assert.ok(!auditSystem.includes('THROUGHLINE'));
  assert.ok(!auditSystem.includes('on_arc'));
  assert.ok(!auditSystem.includes('"arc"'));
});

test('G dial on: the throughline charter (two frames), the reply field, the watch context clause, the audit arc jurisdiction', async () => {
  const { tutorSystem, superegoSystem, auditSystem } = await throughlineSystems({ throughline: true });
  assert.ok(tutorSystem.includes("# The throughline (the whole play's plan, above the act plots)"));
  assert.ok(tutorSystem.includes('Two frames govern every line you speak: the ACT — the lesson, what this'));
  assert.ok(tutorSystem.includes('- "arc": two to four waypoints, in order — the shape the whole inquiry'));
  assert.ok(tutorSystem.includes('on_arc or off_arc. When the verdict is off_arc, the next act opening'));
  assert.ok(tutorSystem.includes("correction is conduct; silent drift is the failure. At the run's end"));
  assert.ok(
    tutorSystem.includes(
      ', "throughline": {"arc": ["<waypoint>", ...], "hold_to_end": "...", "risk": "...", "salvage": "..."}, "throughline_reason": "<one line when revising voluntarily, else null>"',
    ),
  );
  assert.ok(
    tutorSystem.includes(
      '("throughline" belongs to the FIRST turn and to act-opening revisions — the harness marks when it is due; omit the key otherwise.)',
    ),
  );
  assert.ok(
    superegoSystem.includes(
      'standing THROUGHLINE for the whole play (committed at the first turn). Read them as context',
    ),
  );
  assert.ok(superegoSystem.includes('act-close audit, not the turn watch, judges the plot and the arc.'));
  assert.ok(auditSystem.includes("You may also be shown the tutor's standing THROUGHLINE — the whole"));
  assert.ok(auditSystem.includes('ONE further verdict on the act as a whole against it: "on_arc" (the act'));
  assert.ok(auditSystem.includes('reckons the throughline clause by clause, not you.'));
  assert.ok(
    auditSystem.includes(
      ' "arc": {"verdict": "on_arc" | "off_arc", "evidence": "<one line from the record>"} (only when a throughline is before you, else omit),',
    ),
  );
});

test('G lifecycle: commit at the first turn, read back above the plot every turn, arc verdicts bind — off_arc demands, on_arc permits, the run-end call reckons', async () => {
  const arcAudit = (verdict, evidence) => ({
    audit: [{ clause: 'a standing clause', verdict: 'kept', evidence: 'held' }],
    summary: 'the act played out',
    arc: { verdict, evidence },
  });
  const act3Plot = { ...act2Plot, withhold: 'p4 waits until p3 has landed' };
  const act4Plot = { ...act2Plot, withhold: 'nothing held back — the join is due' };
  const finalReply = {
    audit: [{ clause: 'a standing clause', verdict: 'kept', evidence: 'held' }],
    summary: 'final act held',
    arc: { verdict: 'on_arc', evidence: 'the join was forced' },
    throughline_audit: [
      { clause: 'the learner forces the join unprompted', verdict: 'kept', evidence: 'turn 12' },
      // a verdict outside the contract — must gate to 'unscored'
      { clause: tl1.hold_to_end, verdict: 'maybe', evidence: 'mostly' },
    ],
  };
  const closedActs = [
    { act: 1, turns: [1, 3], endedBy: 'director', brief: null },
    { act: 2, turns: [4, 6], endedBy: 'director', brief: null },
    { act: 3, turns: [7, 9], endedBy: 'director', brief: null },
  ];
  const { client, calls } = stubClient({
    tutor: [
      opening(act1Plot, { throughline: tl1 }),
      // mid-act: a decoy revision — must be ignored (the standing frame is the commitment)
      opening(undefined, { throughline: tl3, throughline_reason: 'DECOY' }),
      opening(act2Plot, { throughline: tl2, throughline_reason: 'the learner is faster than planned' }),
      opening(act3Plot, { throughline: tl3 }),
      opening(act4Plot),
    ],
    tutor_superego: [
      watchOk, // t1 watch
      watchOk, // t2 watch
      arcAudit('on_arc', 'p1 staged and read back'), // t4 audit of act 1
      watchOk, // t4 watch
      arcAudit('off_arc', 'the act circled and the arc did not advance'), // t7 audit of act 2
      watchOk, // t7 watch
      arcAudit('sideways', 'neither here nor there'), // t10 audit of act 3 — gates to unscored
      watchOk, // t10 watch
      finalReply, // run-end audit of act 4 + the throughline reckoning
    ],
  });
  const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, plot: true, throughline: true }));

  // t1 — the play opens: the demand comes ABOVE the act-plot demand, and the
  // commitment rides the out with trigger 'opening'.
  const out1 = await tutor(plotView(1));
  const t1user = calls.find((c) => c.role === 'tutor').user;
  assert.ok(
    t1user.includes(
      'THIS TURN OPENS THE PLAY — COMMIT YOUR THROUGHLINE (the whole play\'s plan) in "throughline", alongside your dialogue and your act plot.',
    ),
  );
  assert.ok(t1user.indexOf('THIS TURN OPENS THE PLAY') < t1user.indexOf('THIS TURN OPENS ACT 1'));
  assert.deepEqual(out1.throughline, { act: 1, turn: 1, trigger: 'opening', ...tlRowOf(tl1) });

  // t2 — mid-act: both frames read back, course above lesson; the decoy
  // revision is ignored.
  const out2 = await tutor(plotView(2));
  const t2user = calls.filter((c) => c.role === 'tutor').at(-1).user;
  assert.ok(t2user.includes('YOUR THROUGHLINE for the whole play (standing since turn 1):'));
  assert.ok(t2user.includes('- arc[1]: the learner holds p1 and can say why'));
  assert.ok(t2user.includes('The play moves under it; this act serves it.'));
  assert.ok(t2user.indexOf('YOUR THROUGHLINE for the whole play') < t2user.indexOf('YOUR PLOT for this act'));
  assert.ok(!t2user.includes('COMMIT YOUR THROUGHLINE'));
  assert.ok(!('throughline' in out2));

  // t4 — act 2 opens, the audit's arc verdict is on_arc: the audit user shows
  // the throughline AS IT STOOD (tl1, not the decoy), the demand is permissive,
  // and the model's voluntary revision lands with its declared reason.
  const before4 = calls.length;
  const out4 = await tutor(plotView(4, { index: 2, startTurn: 4, closed: closedActs.slice(0, 1) }));
  const auditCall4 = calls[before4];
  assert.ok(auditCall4.user.includes("THE THROUGHLINE the tutor holds for the whole play — give your 'arc'"));
  assert.ok(auditCall4.user.includes('verdict on the closed act against it:'));
  assert.ok(auditCall4.user.includes('- arc[1]: the learner holds p1 and can say why'));
  assert.ok(!auditCall4.user.includes('RUN-END'));
  assert.deepEqual(out4.plotAudit.arc, { verdict: 'on_arc', evidence: 'p1 staged and read back' });
  const t4user = calls[before4 + 1].user;
  assert.ok(
    t4user.includes(
      'The arc verdict on the closed act: ON_ARC. You MAY revise the throughline in "throughline" with a one-line "throughline_reason"; silence keeps it standing.',
    ),
  );
  assert.deepEqual(out4.throughline, {
    act: 2,
    turn: 4,
    trigger: 'voluntary',
    reason: 'the learner is faster than planned',
    ...tlRowOf(tl2),
  });
  // The watch reads the NEW standing frame as context, course above lesson.
  const t4watch = calls[before4 + 2].user;
  assert.ok(
    t4watch.includes(
      "The tutor's standing THROUGHLINE for the whole play (context only — the act-close audit judges the arc):",
    ),
  );
  assert.ok(t4watch.includes('- arc[1]: the learner rebuilds the board after each break'));
  assert.ok(t4watch.indexOf('standing THROUGHLINE for the whole play') < t4watch.indexOf('standing PLOT for this act'));

  // t7 — the arc verdict went off_arc: THE AUDIT BINDS, the revision is demanded.
  const before7 = calls.length;
  const out7 = await tutor(plotView(7, { index: 3, startTurn: 7, closed: closedActs.slice(0, 2) }));
  const t7user = calls[before7 + 1].user;
  assert.ok(t7user.includes('THE ARC VERDICT on the closed act was OFF_ARC — THE AUDIT BINDS: revise'));
  assert.ok(t7user.includes('your throughline in "throughline" THIS turn to answer the evidence,'));
  assert.deepEqual(out7.throughline, { act: 3, turn: 7, trigger: 'audit_bound', ...tlRowOf(tl3) });

  // t10 — an arc verdict outside the contract gates to 'unscored': no demand
  // (the audit did not bind), the permissive line WITHOUT the ON_ARC prefix,
  // and the model's silence keeps the frame standing.
  const before10 = calls.length;
  const out10 = await tutor(plotView(10, { index: 4, startTurn: 10, closed: closedActs }));
  assert.deepEqual(out10.plotAudit.arc, { verdict: 'unscored', evidence: 'neither here nor there' });
  const t10user = calls[before10 + 1].user;
  assert.ok(!t10user.includes('THE AUDIT BINDS: revise'));
  assert.ok(!t10user.includes('The arc verdict on the closed act: ON_ARC.'));
  assert.ok(
    t10user.includes(
      'You MAY revise the throughline in "throughline" with a one-line "throughline_reason"; silence keeps it standing.',
    ),
  );
  assert.ok(t10user.includes('- arc[1]: the learner forces the join unprompted'));
  assert.ok(!('throughline' in out10));

  // The run-end audit RIDES the final-audit call: the inline demand, the
  // standing frame (tl3), and the clause reckoning with the unscored gate.
  const fin = await tutor.finalAudit({
    transcript: [],
    ledger: [],
    acts: [...closedActs, { act: 4, turns: [10, 12], endedBy: 'run_end', brief: null }],
  });
  const finCall = calls.filter((c) => c.role === 'tutor_superego').at(-1);
  assert.ok(finCall.user.includes('This is the RUN-END audit: the play is over. Additionally reckon the'));
  assert.ok(finCall.user.includes('"throughline_audit"'));
  assert.ok(finCall.user.includes('- arc[1]: the learner forces the join unprompted'));
  assert.deepEqual(fin, {
    act: 4,
    clauses: [{ clause: 'a standing clause', verdict: 'kept', evidence: 'held' }],
    summary: 'final act held',
    arc: { verdict: 'on_arc', evidence: 'the join was forced' },
    throughlineAudit: [
      { clause: 'the learner forces the join unprompted', verdict: 'kept', evidence: 'turn 12' },
      { clause: 'the conclusion stays unsaid until the board forces it', verdict: 'unscored', evidence: 'mostly' },
    ],
  });
});

test('G recommit: a malformed first-turn throughline leaves the play frameless — the next opening re-demands; the audit shows no arc', async () => {
  const { client, calls } = stubClient({
    tutor: [opening(act1Plot, { throughline: 'wing it' }), opening(act2Plot, { throughline: tl1 })],
    tutor_superego: [watchOk, { audit: [{ clause: 'x', verdict: 'kept', evidence: '' }], summary: 's' }, watchOk],
  });
  const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, plot: true, throughline: true }));
  const out1 = await tutor(plotView(1));
  assert.ok(!('throughline' in out1), "a malformed throughline is not fabricated on the model's behalf");
  const out3 = await tutor(
    plotView(3, { index: 2, startTurn: 3, closed: [{ act: 1, turns: [1, 2], endedBy: 'director', brief: null }] }),
  );
  // No standing frame at the audit: no arc demanded, none returned.
  const auditCall = calls.filter((c) => c.role === 'tutor_superego')[1];
  assert.ok(!auditCall.user.includes('THROUGHLINE'));
  assert.ok(!('arc' in out3.plotAudit));
  const t3user = calls.filter((c) => c.role === 'tutor').at(-1).user;
  assert.ok(
    t3user.includes(
      'NO THROUGHLINE STANDS — COMMIT YOUR THROUGHLINE (the whole play\'s plan) in "throughline", alongside your dialogue and your act plot.',
    ),
  );
  assert.deepEqual(out3.throughline, { act: 2, turn: 3, trigger: 'recommit', ...tlRowOf(tl1) });
});

test('G revision: an intervened opening keeps its throughline — rewrite honored, parse-miss falls back to the draft', async () => {
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

  // Arm 1: the revision rewrites the throughline — the rewrite is the commitment.
  {
    const { client } = stubClient({
      tutor: [opening(act1Plot, { throughline: tl1 }), revision({ plot: act2Plot, throughline: tl2 })],
      tutor_superego: [fire],
    });
    const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, plot: true, throughline: true }));
    const out = await tutor(plotView(3, { index: 2, startTurn: 3, transcript: rutTranscript }));
    assert.equal(out.deliberation.intervened, true);
    assert.deepEqual(out.throughline, { act: 2, turn: 3, trigger: 'recommit', ...tlRowOf(tl2) });
  }

  // Arm 2: the revision omits the throughline — the draft's commitment stands.
  {
    const { client } = stubClient({
      tutor: [opening(act1Plot, { throughline: tl1 }), revision()],
      tutor_superego: [fire],
    });
    const tutor = makeLlmTutor(smokeWorld, client, actsOpts({ superego: true, plot: true, throughline: true }));
    const out = await tutor(plotView(3, { index: 2, startTurn: 3, transcript: rutTranscript }));
    assert.deepEqual(out.throughline, { act: 2, turn: 3, trigger: 'recommit', ...tlRowOf(tl1) });
  }
});

test('G engine: throughline rows ride the result, events, and transcript meta; audit details carry the arc and the run-end reckoning', async () => {
  const tlRow = (act, turn, trigger) => ({
    act,
    turn,
    trigger,
    arc: ['w1', 'w2'],
    holdToEnd: 'h',
    risk: 'r',
    salvage: 's',
  });
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
    clauses: [{ clause: 'c', verdict: 'kept', evidence: 'e' }],
    summary: 's',
    arc: { verdict: 'off_arc', evidence: 'circled' },
  };
  const tutor = async (view) => {
    const openingTurn = view.acts.startTurn === view.turn;
    return {
      dialogue: 'Consider the board.',
      move: { figure: 'erotema', targetPremise: null, intent: 'consolidate' },
      release: null,
      ...(openingTurn ? { plot: plotRow(view.acts.index, view.turn) } : {}),
      ...(view.turn === 1 ? { throughline: tlRow(1, 1, 'opening') } : {}),
      ...(openingTurn && view.acts.index === 2
        ? { plotAudit: auditRow, throughline: tlRow(2, view.turn, 'audit_bound') }
        : {}),
    };
  };
  tutor.finalAudit = async () => ({
    act: 2,
    clauses: [{ clause: 'end', verdict: 'kept', evidence: '' }],
    summary: 'fin',
    arc: { verdict: 'on_arc', evidence: 'forced' },
    throughlineAudit: [
      { clause: 'w1', verdict: 'kept', evidence: '' },
      { clause: 'w2', verdict: 'drift', evidence: '' },
    ],
  });
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

  assert.deepEqual(result.plot.throughlines, [tlRow(1, 1, 'opening'), tlRow(2, 3, 'audit_bound')]);
  assert.deepEqual(
    result.events.filter((e) => e.type === 'throughline').map((e) => e.detail),
    ['throughline committed (opening)', 'throughline revised (audit_bound)'],
  );
  const auditEvents = result.events.filter((e) => e.type === 'plot_audit');
  assert.equal(auditEvents[0].detail, 'act 1 plot audited: kept 1, justified 0, drift 0; arc off_arc');
  assert.equal(
    auditEvents[1].detail,
    'act 2 plot audited at run end: kept 1, justified 0, drift 0; arc on_arc; throughline reckoned (2 clauses)',
  );
  const t1line = result.transcript.find((l) => l.role === 'tutor' && l.turn === 1);
  assert.deepEqual(t1line.meta.throughline, tlRow(1, 1, 'opening'));
  const finRow = result.plot.audits.at(-1);
  assert.equal(finRow.final, true);
  assert.equal(finRow.throughlineAudit.length, 2);
});

test('G plotReport: the throughline block — triggers, discipline, arc mix with the unscored gate, the run-end reckoning', () => {
  const synthetic = {
    ledger: [],
    acts: [
      { act: 1, turns: [1, 3], endedBy: 'director' },
      { act: 2, turns: [4, 7], endedBy: 'run_end' },
    ],
    plot: {
      plots: [{ act: 1, turn: 1, holdByEnd: ['x'], withhold: 'w', friction: 'f', fallback: 'b' }],
      audits: [
        {
          turn: 4,
          act: 1,
          clauses: [{ clause: 'c', verdict: 'kept', evidence: '' }],
          summary: null,
          arc: { verdict: 'on_arc', evidence: '' },
        },
        {
          turn: 7,
          final: true,
          act: 2,
          clauses: [{ clause: 'c2', verdict: 'kept', evidence: '' }],
          summary: null,
          arc: { verdict: 'weird', evidence: '' }, // gates to unscored in the mix
          throughlineAudit: [
            { clause: 'w1', verdict: 'kept', evidence: '' },
            { clause: 'w2', verdict: 'justified_deviation', evidence: '' },
            { clause: 'w3', verdict: 'mystery', evidence: '' }, // gates to unscored
          ],
        },
      ],
      throughlines: [
        { act: 1, turn: 1, trigger: 'opening', arc: ['w1', 'w2'], holdToEnd: 'h', risk: 'r', salvage: 's' },
        { act: 2, turn: 4, trigger: 'audit_bound', arc: ['w3'], holdToEnd: 'h', risk: null, salvage: 's' },
      ],
    },
  };
  assert.deepEqual(plotReport(synthetic, null).throughline, {
    count: 2,
    byTrigger: { opening: 1, recommit: 0, audit_bound: 1, voluntary: 0 },
    disciplined: 1, // the second row lacks its risk clause
    arcs: { count: 2, mix: { on_arc: 1, off_arc: 0, unscored: 1 } },
    finalReckoning: { clauses: 3, mix: { kept: 1, justified_deviation: 1, drift: 0, unscored: 1 } },
  });
  // The plot-only arm keeps the exact C1 report shape (no throughline key).
  const { throughlines: _throughlines, ...plotOnly } = synthetic.plot;
  assert.ok(!('throughline' in plotReport({ ...synthetic, plot: plotOnly }, null)));
});

test('G mock chain: two-layer planning on the full stack — committed at the first turn, an arc on every audit, the run-end reckoning, the panel line', async () => {
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
  const tl = d.plot.throughline;

  // The frame is committed at the first turn, and every commit answers a
  // harness demand (the mock revises only when the audit binds or the frame
  // lapses — silence keeps it standing while on_arc).
  assert.ok(result.plot.throughlines.length >= 1);
  assert.deepEqual([result.plot.throughlines[0].turn, result.plot.throughlines[0].trigger], [1, 'opening']);
  assert.equal(tl.byTrigger.opening, 1);
  assert.equal(tl.byTrigger.voluntary, 0);
  assert.equal(
    tl.count,
    tl.byTrigger.opening + tl.byTrigger.recommit + tl.byTrigger.audit_bound + tl.byTrigger.voluntary,
  );
  assert.equal(tl.disciplined, tl.count, 'the mock throughline carries all four clauses by construction');

  // Every audit (boundaries + run end) carries an arc verdict inside the
  // contract, and each off_arc boundary verdict binds exactly one revision.
  assert.equal(tl.arcs.count, result.plot.audits.length);
  assert.equal(tl.arcs.mix.unscored, 0);
  assert.equal(tl.arcs.mix.on_arc + tl.arcs.mix.off_arc, tl.arcs.count);
  const offArcBoundaries = result.plot.audits.filter((a) => !a.final && a.arc?.verdict === 'off_arc').length;
  assert.equal(tl.byTrigger.audit_bound, offArcBoundaries);

  // The run-end reckoning rides the final audit, inside the verdict contract.
  assert.ok(tl.finalReckoning, 'the run-end reckoning landed');
  assert.equal(tl.finalReckoning.mix.unscored, 0);

  // No cross-dial interference, and the panel renders the line.
  assert.equal(d.plot.plots.disciplined, d.plot.plots.count);
  assert.equal(d.releaseDeviations.invalidClaims, 0);
  const panel = renderEvalPanel(d);
  assert.ok(panel.includes('**throughline**'));
  assert.ok(panel.includes('**plot**'));
});
