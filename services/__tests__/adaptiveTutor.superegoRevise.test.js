// A16 (P2 §6.3.10) — superego-authored ego-prompt rewrite, S0/S1 arms.
//
// This file is BOTH the exit-criteria mock smoke and a hermetic regression
// pin: it runs the two new architectures end-to-end against the deterministic
// mock LLM via the public runner API only (no persistence in runScenario's
// import graph → zero DB/paper writes; `npm test` / `npm run test:hermetic`
// pick it up via the services/__tests__/*.test.js glob).
//
// Each test pins a clause of the pre-registered design (paper-full-2.0.md
// §6.3.10), not just "it runs":
//   - superegoRevise is actually visited and writes the dedicated
//     tutorInternal.superegoAuthoredPrompt channel.
//   - that channel is in state ENTERING the ego node (the override flow).
//     NOTE: the mock tutorEgoInitial fixture deliberately ignores
//     systemPromptOverride (it stays deterministic), so the honest
//     end-to-end claim under mock is state-level — the ego node receives
//     it. graph.js:tutorEgoInitial reads exactly that field into
//     systemPromptOverride (static guarantee); the real-LLM consumption
//     path is covered separately by the realLLM unit tests.
//   - S0 (stateless) leaves revisionLedger EMPTY by construction; S1
//     (cumulative) accumulates exactly one entry per turn AND threads the
//     prior ledger back in (the [[LEDGER_DEPTH]] marker). The S0-empty vs
//     S1-growing ledger is the entire operationalisation of the decisive
//     pre-registered S1-vs-S0 contrast.
//   - superegoAuthoredPrompt and idAuthoredPrompt never collide.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Deterministic + no paid calls regardless of how the suite is invoked.
process.env.ADAPTIVE_TUTOR_LLM = 'mock';

const { runScenario } = await import('../adaptiveTutor/runner.js');

// Opening learner turn carries three frustration tokens ("confused", "but",
// "why should") so the mock superegoRevise fixture's frustration regex fires
// deterministically from turn 0 — independent of the mock learnerTurn path.
const scenario = {
  id: 'superego-revise-smoke',
  hidden: {
    actualMisconception: 'treats recognition as affirmation',
    actualSophistication: 'advanced',
    triggerTurn: 1,
    triggerSignal: 'But that only works if recognition reduces to affirmation.',
  },
  openingTurns: [{ role: 'learner', content: "I'm confused — but why should this approach work?" }],
  maxTurns: 3,
};

const runArm = (architecture) => runScenario(scenario, { architecture });

const sawSuperegoReviseQueued = (history) =>
  history.some((s) => Array.isArray(s.next) && s.next.includes('superegoRevise'));

// The post-superegoRevise checkpoint: superegoRevise has returned, the ego is
// next, so state entering the ego must already carry the rewritten prompt.
const promptEnteringEgo = (history) => {
  const snap = history.find((s) => Array.isArray(s.next) && s.next.includes('tutorEgoInitial'));
  return snap?.values?.tutorInternal?.superegoAuthoredPrompt;
};

test('S0 (superego_revise_stateless): node visited, prompt flows to ego, ledger empty by construction', async () => {
  const { final, history } = await runArm('superego_revise_stateless');

  assert.ok(sawSuperegoReviseQueued(history), 'superegoRevise must be in the visited-node set');

  const authored = final.tutorInternal?.superegoAuthoredPrompt;
  assert.equal(typeof authored, 'string');
  assert.match(authored, /\[\[SUPEREGO_DIRECTIVE@t\d+\]\]/, 'superego must author a per-turn prompt');
  assert.match(authored, /\[\[STATELESS_REWRITE\]\]/, 'S0 must re-derive from scratch');
  assert.doesNotMatch(authored, /\[\[LEDGER_DEPTH\]\]/, 'S0 must never thread a prior ledger');

  const egoInput = promptEnteringEgo(history);
  assert.match(
    String(egoInput),
    /\[\[SUPEREGO_DIRECTIVE@t\d+\]\]/,
    'the superego-authored prompt must be in state entering the ego node',
  );

  // Empty by construction: the S0 graph branch never returns the
  // revisionLedger key, so the schema default [] stands.
  assert.deepEqual(final.revisionLedger, [], 'S0 must leave revisionLedger empty');

  assert.ok(
    final.dialogue.some((m) => m.role === 'tutor'),
    'ego must still produce a tutor turn after the rewrite',
  );
  // Non-collision: S0 must not touch the id-director channel.
  assert.equal(final.tutorInternal?.idAuthoredPrompt ?? '', '', 'idAuthoredPrompt must stay empty');
});

test('S1 (superego_revise_cumulative): accumulates one ledger entry per turn and threads it back', async () => {
  const { final, history } = await runArm('superego_revise_cumulative');

  assert.ok(sawSuperegoReviseQueued(history), 'superegoRevise must be in the visited-node set');
  assert.match(
    String(promptEnteringEgo(history)),
    /\[\[SUPEREGO_DIRECTIVE@t\d+\]\]/,
    'the superego-authored prompt must be in state entering the ego node',
  );

  const ledger = final.revisionLedger;
  assert.ok(Array.isArray(ledger), 'revisionLedger must be an array');
  assert.ok(ledger.length >= 2, `S1 must accumulate (got ${ledger.length} entries)`);

  // One entry per turn, append-only, turn-ordered, content-bearing.
  const turns = ledger.map((e) => e.turn);
  assert.deepEqual(
    turns,
    [...turns].sort((a, b) => a - b),
    'ledger must be turn-ordered',
  );
  assert.equal(new Set(turns).size, turns.length, 'exactly one ledger entry per turn');
  for (const e of ledger) {
    assert.equal(typeof e.turn, 'number');
    assert.ok(e.correctiveDirective.length > 0, 'each entry records a corrective directive');
    assert.ok(
      e.promptDiffHead.length > 0 && e.promptDiffHead.length <= 240,
      'promptDiffHead is the bounded rewrite head',
    );
  }

  // Decisive S1 behaviour: by the last turn the cumulative branch must have
  // threaded >=1 prior ledger entry back into the rewrite — the mock encodes
  // that as [[LEDGER_DEPTH]] N. Its absence would mean S1 ran statelessly.
  assert.match(
    final.tutorInternal.superegoAuthoredPrompt,
    /\[\[LEDGER_DEPTH\]\] [1-9]\d*/,
    'S1 last-turn rewrite must reflect the accumulated prior ledger',
  );
  assert.equal(final.tutorInternal?.idAuthoredPrompt ?? '', '', 'idAuthoredPrompt must stay empty');
});

test('decisive S1-vs-S0 contrast (§6.3.10): identical scenario, ledger-statefulness is the only divergence', async () => {
  const [s0, s1] = await Promise.all([runArm('superego_revise_stateless'), runArm('superego_revise_cumulative')]);

  // The single assertion that operationalises the pre-registered contrast:
  // same topology, same ego, same superego role prompt — empty vs growing
  // ledger and stateless vs ledger-aware rewrite are the ONLY differences.
  assert.deepEqual(s0.final.revisionLedger, [], 'S0 ledger empty');
  assert.ok(s1.final.revisionLedger.length >= 2, 'S1 ledger grows');
  assert.match(s0.final.tutorInternal.superegoAuthoredPrompt, /\[\[STATELESS_REWRITE\]\]/);
  assert.match(s1.final.tutorInternal.superegoAuthoredPrompt, /\[\[LEDGER_DEPTH\]\] [1-9]\d*/);

  // Both arms still drive the ego to a real tutor turn (the rewrite is an
  // input to the ego, not a replacement for it).
  assert.ok(s0.final.dialogue.some((m) => m.role === 'tutor'));
  assert.ok(s1.final.dialogue.some((m) => m.role === 'tutor'));
});
