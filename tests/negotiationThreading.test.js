/**
 * A5 negotiation-resolution threading (hermetic regression test)
 *
 * Proves the tutor-core fix in tutorDialogueEngine.js's runDialogue(): the
 * dialectical negotiation layer (negotiateDialectically(), invoked once
 * inside the INITIAL egoGenerateSuggestions() call) tags suggestions[0]
 * with metadata.dialecticalStrategy. Every subsequent outer-loop
 * superego-review -> ego-revise round used to REPLACE currentSuggestions
 * wholesale with a freshly LLM-generated array that has no metadata slot,
 * silently discarding that tag on essentially every turn for
 * dialogue-enabled cells (see notes/2026-07-06-longitudinal-drift-
 * adaptation-prereg.md §10/§11).
 *
 * threadNegotiationResolution (default false) gates a minimal,
 * deterministic merge (captureNegotiationResolution /
 * threadNegotiationResolutionIntoSuggestions in tutorDialogueEngine.js)
 * that re-applies the captured negotiation onto the post-revision
 * suggestions array. No model call, no change to egoRevise's prompt or
 * behaviour — a true no-op when the flag is off.
 *
 * Two arms, same scenario/cell/fake-hook — only the flag differs:
 *   - OFF (default, omitted): reproduces the discard — pre-fix behaviour,
 *     byte-identical to a run with no A5 code involved at all.
 *   - ON: the delivered suggestion (and every post-revision trace entry)
 *     carries the negotiated metadata through to the end of the dialogue.
 *
 * Fully hermetic: temp EVAL_DB_PATH / EVAL_LOGS_DIR / AUTH_DB_PATH (set
 * before any import — evaluationStore resolves EVAL_DB_PATH at module
 * load), a fake hook standing in for the real CLI bridge (no subprocess
 * ever spawned, no network), and a tripwire globalThis.fetch that fails
 * the test if any call escapes to an HTTP provider.
 *
 * Cell + scenario mirror tests/cliBridgeDialogueEngine.test.js exactly
 * (cell_40, dialectical_negotiation: true, the multi-turn longitudinal-
 * drift scenario) — that file already proves the bare CLI-bridge plumbing
 * works; this file adds the threadNegotiationResolution arm comparison on
 * top of the same substrate. Unlike that file's fakeCallCli (which reuses
 * one canned suggestions array for every 'dialogue-engine'-channel call),
 * this one content-sniffs userPrompt for each call's signature phrase, so
 * the initial generation and the post-revision text are deliberately
 * DIFFERENT — a same-text revision would trip runDialogue's own
 * similarity->convergence early-return (>=0.65), which returns before the
 * 'revise' trace entry is ever pushed, and would mask the very discard
 * this test exists to catch.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Hermetic stores — MUST precede all service imports (evaluationStore reads
// EVAL_DB_PATH at module load; tutor-core's dbService reads AUTH_DB_PATH
// lazily; both point at this throwaway root).
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'negotiation-threading-test-'));
process.env.EVAL_DB_PATH = path.join(TMP_ROOT, 'evaluations.db');
process.env.EVAL_LOGS_DIR = path.join(TMP_ROOT, 'logs');
process.env.AUTH_DB_PATH = path.join(TMP_ROOT, 'lms.sqlite');
// Fake, non-secret key so provider resolution never trips on a missing env
// var; the fetch tripwire below guarantees it can never be used.
process.env.OPENROUTER_API_KEY = 'negotiation-threading-test-fake-key';

const { buildCliProviderHook } = await import('../services/cliProviderBridge.js');
const { runEvaluation } = await import('../services/evaluationRunner.js');
const evaluationStore = await import('../services/evaluationStore.js');
const tutorCore = await import('../tutor-core/index.js');
const { closeDb } = await import('../tutor-core/services/dbService.js');

const SCENARIO_ID = 'longitudinal_drift_session_1_multiturn_checkin';
const CELL = 'cell_40_base_dialectical_suspicious_unified_superego';

/** Every fake-hook call across both arms, for assertions. */
const hookCalls = [];
/** Any HTTP fetches that escaped (should stay empty). */
const escapedFetches = [];

// Initial ego generation. Deliberately WORDED DIFFERENTLY from the revised
// suggestion below (see file header) so the two rounds don't look
// text-similar enough to trip runDialogue's early convergence return.
const INITIAL_SUGGESTIONS = JSON.stringify([
  {
    title: 'Review: common denominator pattern',
    message: 'THREADING-TEST-INITIAL: let us look at the fractions step you just tried.',
    reasoning: 'Deterministic fake ego output for the hermetic threading proof (initial generation).',
    actionTarget: 'threading-check',
  },
]);

// Outer superego review: a real disapproval, so the dialogue deterministically
// takes the REJECTED -> ego-revise branch (the discard site under test) on
// every round.
const REJECT_REVIEW = JSON.stringify({
  approved: false,
  interventionType: 'revise',
  feedback: 'Cite a specific retry count and an exact lecture ID from the learner context.',
});

// Outer ego-revise response: a freshly "LLM-generated" array with NO
// metadata field — models a realistic revision that has no spontaneous way
// to reproduce the prior round's negotiated metadata. Title/message start
// with different text than INITIAL_SUGGESTIONS on purpose (see file header).
const REVISED_SUGGESTIONS = JSON.stringify([
  {
    title: 'XREV-Practice: smallest common denominator method',
    message:
      'THREADING-TEST-REVISED: a substantially reworded revision addressing the review feedback, with no memory of the earlier negotiated resolution.',
    reasoning: 'Deterministic fake ego output for the hermetic threading proof (post-revision).',
    actionTarget: 'threading-check',
  },
]);

// Inner dialectical superego critique (channel 'unified'): no disapproval,
// so negotiateDialectically() takes its 'no_conflict' fast path and tags
// suggestions[0].metadata.dialecticalStrategy = 'no_conflict'. severity 0.0
// is what actually matters — generateSuperegoCritique() recomputes
// `disapproves` from severity after parsing, so the JSON's own
// `disapproves` field is documentation only.
const FAKE_NO_CONFLICT_CRITIQUE = JSON.stringify({
  disapproves: false,
  severity: 0.0,
  critique: null,
  reasoning: 'Fake unified-channel response: no pedagogical objection.',
});

/**
 * Fake CLI call function injected into the REAL buildCliProviderHook
 * wrapper — so splitProviderMessages and the cli_capture recording path
 * are exercised for real, while no codex/claude subprocess can ever spawn.
 * Signature mirrors callAIWithCliBridge.
 *
 * The 'unified' channel (dialectical layer) and 'dialogue-engine' channel
 * (outer ego/superego loop) collapse ego-generate / superego-review /
 * ego-revise into the SAME channel value, so those three are
 * disambiguated by sniffing userPrompt for each call's known signature
 * phrase (confirmed against the literal prompt text in
 * tutorDialogueEngine.js's egoGenerateSuggestions / superegoReview /
 * egoRevise).
 */
async function fakeCallCli(agentConfig, systemPrompt, userPrompt, role) {
  const channel = String(role || '').includes(':') ? String(role).split(':')[1] : String(role);
  const prompt = userPrompt || '';

  let text;
  let kind;
  if (channel === 'unified') {
    text = FAKE_NO_CONFLICT_CRITIQUE;
    kind = 'inner_critique';
  } else if (prompt.includes('Review these suggestions critically')) {
    text = REJECT_REVIEW;
    kind = 'outer_superego_review';
  } else if (prompt.includes('Revise your suggestions based on the feedback')) {
    text = REVISED_SUGGESTIONS;
    kind = 'outer_ego_revise';
  } else {
    // Initial ego generation (and the format-reminder retry, if it ever fires).
    text = INITIAL_SUGGESTIONS;
    kind = 'ego_initial';
  }

  hookCalls.push({ channel, kind, provider: agentConfig?.provider, model: agentConfig?.model });

  return {
    text,
    model: agentConfig?.model,
    provider: agentConfig?.provider,
    latencyMs: 1,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
  };
}

let runResultOff;
let runResultOn;

before(async () => {
  // The runner registers the REAL CLI hook from a dynamic import .then();
  // flush a macrotask so that registration lands first, then overwrite it
  // with the fake (last set wins) so no codex/claude subprocess can spawn.
  await new Promise((resolve) => setTimeout(resolve, 25));
  tutorCore.setExternalAIProviderHook(buildCliProviderHook({ callCli: fakeCallCli }));

  // Tripwire: any HTTP fetch during either run is a routing leak.
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input?.url;
    escapedFetches.push(url);
    throw new Error(`HTTP fetch escaped the CLI-routed stack: ${url}`);
  };

  // Arm OFF: threadNegotiationResolution omitted — current/pre-fix behaviour.
  runResultOff = await runEvaluation({
    scenarios: [SCENARIO_ID],
    configurations: [CELL],
    runsPerConfig: 1,
    skipRubricEval: true,
    dryRun: false,
    verbose: false,
    egoModelOverride: 'codex.gpt-5.5',
    superegoModelOverride: 'codex.gpt-5.5',
    learnerId: 'a5-threading-test-off',
  });

  // Arm ON: threadNegotiationResolution explicit true — the A5 fix.
  runResultOn = await runEvaluation({
    scenarios: [SCENARIO_ID],
    configurations: [CELL],
    runsPerConfig: 1,
    skipRubricEval: true,
    dryRun: false,
    verbose: false,
    egoModelOverride: 'codex.gpt-5.5',
    superegoModelOverride: 'codex.gpt-5.5',
    learnerId: 'a5-threading-test-on',
    threadNegotiationResolution: true,
  });
});

after(() => {
  try {
    tutorCore.clearExternalAIProviderHook();
  } catch {
    /* best effort */
  }
  try {
    closeDb();
  } catch {
    /* best effort */
  }
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

function loadRowAndTrace(runResult) {
  const rows = evaluationStore.getResults(runResult.runId);
  assert.equal(rows.length, 1, `expected 1 result row, got ${rows.length}`);
  const row = rows[0];
  assert.ok(row.success, `result row should be marked successful: ${row.errorMessage || ''}`);
  const log = evaluationStore.loadDialogueLog(row.dialogueId);
  assert.ok(log, 'dialogue log should exist');
  const trace = log.dialogueTrace || [];
  return { row, trace };
}

test('both arms complete successfully on the fully CLI-routed stack', () => {
  assert.ok(runResultOff, 'flag-off runEvaluation returned a result');
  assert.ok(runResultOn, 'flag-on runEvaluation returned a result');
  assert.equal(runResultOff.totalTests, 1);
  assert.equal(runResultOff.successfulTests, 1, `flag-off: ${JSON.stringify(runResultOff)}`);
  assert.equal(runResultOn.totalTests, 1);
  assert.equal(runResultOn.successfulTests, 1, `flag-on: ${JSON.stringify(runResultOn)}`);
});

test('zero HTTP LLM traffic escaped the CLI routing across both arms', () => {
  assert.deepEqual(escapedFetches, []);
});

test('negotiation runs on every turn regardless of the flag (dialecticalStrategy tagged at generation)', () => {
  for (const runResult of [runResultOff, runResultOn]) {
    const { trace } = loadRowAndTrace(runResult);
    const generateEntries = trace.filter((e) => e.agent === 'ego' && e.action === 'generate');
    assert.ok(generateEntries.length > 0, 'expected at least one ego/generate trace entry');
    for (const entry of generateEntries) {
      assert.equal(
        entry.suggestions?.[0]?.metadata?.dialecticalStrategy,
        'no_conflict',
        `every initial generation should carry the no_conflict tag: ${JSON.stringify(entry.suggestions?.[0])}`,
      );
    }
  }
});

test('outer revision round fires on every turn (exercises the discard site)', () => {
  for (const runResult of [runResultOff, runResultOn]) {
    const { trace } = loadRowAndTrace(runResult);
    const reviseEntries = trace.filter(
      (e) => e.agent === 'ego' && (e.action === 'revise' || e.action === 'incorporate-feedback'),
    );
    assert.ok(reviseEntries.length > 0, 'expected at least one post-revision ego trace entry');
    for (const entry of reviseEntries) {
      assert.match(
        entry.suggestions?.[0]?.message || '',
        /THREADING-TEST-REVISED/,
        'post-revision suggestion should carry the revised (not initial) fake text',
      );
    }
  }
});

test('flag OFF: post-revision suggestions do NOT carry the negotiated metadata (pre-fix behaviour, reproduced)', () => {
  const { row, trace } = loadRowAndTrace(runResultOff);

  const reviseEntries = trace.filter(
    (e) => e.agent === 'ego' && (e.action === 'revise' || e.action === 'incorporate-feedback'),
  );
  assert.ok(reviseEntries.length > 0, 'expected at least one post-revision ego trace entry');
  for (const entry of reviseEntries) {
    assert.equal(
      entry.suggestions?.[0]?.metadata?.dialecticalStrategy,
      undefined,
      `flag off: post-revision suggestion should NOT carry dialecticalStrategy: ${JSON.stringify(entry.suggestions?.[0])}`,
    );
  }

  // The delivered/stored suggestion (what actually reaches the learner and
  // the scoring pipeline) reflects the same discard.
  assert.equal(
    row.suggestions?.[0]?.metadata?.dialecticalStrategy,
    undefined,
    `flag off: delivered suggestion should NOT carry dialecticalStrategy: ${JSON.stringify(row.suggestions?.[0])}`,
  );
});

test('flag ON: post-revision suggestions carry the negotiated metadata through to delivery (the A5 fix)', () => {
  const { row, trace } = loadRowAndTrace(runResultOn);

  const reviseEntries = trace.filter(
    (e) => e.agent === 'ego' && (e.action === 'revise' || e.action === 'incorporate-feedback'),
  );
  assert.ok(reviseEntries.length > 0, 'expected at least one post-revision ego trace entry');
  for (const entry of reviseEntries) {
    assert.equal(
      entry.suggestions?.[0]?.metadata?.dialecticalStrategy,
      'no_conflict',
      `flag on: post-revision suggestion SHOULD carry dialecticalStrategy: ${JSON.stringify(entry.suggestions?.[0])}`,
    );
    // The negotiated (initial) message text must have survived into the
    // delivered message too, not just the metadata tag.
    assert.match(
      entry.suggestions?.[0]?.message || '',
      /THREADING-TEST-INITIAL/,
      'threaded suggestion should carry the negotiated message text forward',
    );
  }

  // The delivered/stored suggestion (what actually reaches the learner and
  // the scoring pipeline) carries the negotiated tag through.
  assert.equal(
    row.suggestions?.[0]?.metadata?.dialecticalStrategy,
    'no_conflict',
    `flag on: delivered suggestion SHOULD carry dialecticalStrategy: ${JSON.stringify(row.suggestions?.[0])}`,
  );
});
