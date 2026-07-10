/**
 * CLI provider bridge → tutor-core dialogue engine (hermetic proof)
 *
 * Proves that a codex-CLI-shaped provider config (--ego-model codex.gpt-5.5
 * / --superego-model codex.gpt-5.5) reaches tutor-core's callAI layer for a
 * cell_40-style run — the long-standing "bridge doesn't reach tutor-core's
 * dialogue engine" gap — via the external-AI-provider hook injected from the
 * eval side (services/evaluationRunner.js → tutor-core
 * setExternalAIProviderHook).
 *
 * Fully hermetic: temp EVAL_DB_PATH / EVAL_LOGS_DIR / AUTH_DB_PATH (set
 * before any import, since evaluationStore resolves EVAL_DB_PATH at module
 * load), a fake hook standing in for the real CLI bridge (no subprocess is
 * ever spawned), and a tripwire globalThis.fetch that fails the test if any
 * call escapes to an HTTP provider — on a fully CLI-routed stack, zero
 * HTTP LLM traffic is the expected behavior.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Hermetic stores — MUST precede all service imports (evaluationStore reads
// EVAL_DB_PATH at module load; tutor-core's dbService reads AUTH_DB_PATH
// lazily; both point at this throwaway root).
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-bridge-engine-test-'));
process.env.EVAL_DB_PATH = path.join(TMP_ROOT, 'evaluations.db');
process.env.EVAL_LOGS_DIR = path.join(TMP_ROOT, 'logs');
process.env.AUTH_DB_PATH = path.join(TMP_ROOT, 'lms.sqlite');
// Fake, non-secret key so provider resolution never trips on a missing env
// var; the fetch tripwire below guarantees it can never be used.
process.env.OPENROUTER_API_KEY = 'cli-bridge-test-fake-key';

const { splitProviderMessages, buildCliProviderHook } = await import('../services/cliProviderBridge.js');
const { runEvaluation } = await import('../services/evaluationRunner.js');
const evaluationStore = await import('../services/evaluationStore.js');
const tutorCore = await import('../tutor-core/index.js');
const { closeDb } = await import('../tutor-core/services/dbService.js');

const SCENARIO_ID = 'longitudinal_drift_session_1_multiturn_checkin';
const CELL = 'cell_40_base_dialectical_suspicious_unified_superego';

/** Calls the fake hook received, for assertions. */
const hookCalls = [];
/** Any HTTP fetches that escaped (should stay empty). */
const escapedFetches = [];

const FAKE_SUGGESTIONS = JSON.stringify([
  {
    title: 'Bridge check suggestion',
    message: 'CLI-BRIDGE-TEST: let us look at the fractions step you just tried.',
    reasoning: 'Deterministic fake ego output for the hermetic bridge proof.',
    actionTarget: 'bridge-check',
  },
]);

// Superego critique JSON that short-circuits dialectical negotiation
// (no disapproval → strategy 'no_conflict', no negotiation rounds).
const FAKE_NO_CONFLICT_CRITIQUE = JSON.stringify({
  disapproves: false,
  severity: 0.0,
  critique: null,
  reasoning: 'Fake unified-channel response: no pedagogical objection.',
});

/**
 * Fake CLI call function injected into the REAL buildCliProviderHook wrapper
 * — so splitProviderMessages and the cli_capture recording path are
 * exercised for real, while no codex/claude subprocess can ever spawn.
 * Signature mirrors callAIWithCliBridge.
 */
async function fakeCallCli(agentConfig, systemPrompt, userPrompt, role) {
  const channel = String(role || '').includes(':') ? String(role).split(':')[1] : String(role);
  hookCalls.push({
    channel,
    provider: agentConfig?.provider,
    model: agentConfig?.model,
    systemPromptLength: (systemPrompt || '').length,
    hasUserPrompt: Boolean(userPrompt),
  });
  // The unified channel serves the dialectical layer (critique JSON); the
  // dialogue-engine channel serves the standard ego/superego loop (a
  // suggestions array keeps every consumer of that channel happy:
  // ego-generate parses it, superego-review treats it as review text).
  const text = channel === 'unified' ? FAKE_NO_CONFLICT_CRITIQUE : FAKE_SUGGESTIONS;
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

let runResult;

before(async () => {
  // The runner registers the REAL CLI hook from a dynamic import .then();
  // flush a macrotask so that registration lands first, then overwrite it
  // with the fake (last set wins) so no codex/claude subprocess can spawn.
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(
    typeof tutorCore.setExternalAIProviderHook,
    'function',
    'tutor-core must export setExternalAIProviderHook',
  );
  tutorCore.setExternalAIProviderHook(buildCliProviderHook({ callCli: fakeCallCli }));

  // Tripwire: any HTTP fetch during the run is a routing leak. Record and
  // reject so the failure is loud and attributable.
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input?.url;
    escapedFetches.push(url);
    throw new Error(`HTTP fetch escaped the CLI-routed stack: ${url}`);
  };

  runResult = await runEvaluation({
    scenarios: [SCENARIO_ID],
    configurations: [CELL],
    runsPerConfig: 1,
    skipRubricEval: true,
    dryRun: false,
    verbose: false,
    egoModelOverride: 'codex.gpt-5.5',
    superegoModelOverride: 'codex.gpt-5.5',
    learnerId: 'cli-bridge-test-learner',
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

test('run completes successfully on the fully CLI-routed stack', () => {
  assert.ok(runResult, 'runEvaluation returned a result');
  assert.equal(runResult.totalTests, 1);
  assert.equal(runResult.successfulTests, 1, `expected 1 successful test, got ${JSON.stringify(runResult)}`);
});

test('codex-CLI-shaped provider config reaches the callAI layer (dialogue-engine channel)', () => {
  const dialogueEngineCalls = hookCalls.filter((c) => c.channel === 'dialogue-engine');
  assert.ok(
    dialogueEngineCalls.length > 0,
    `expected callAI-layer hook calls, saw channels: ${JSON.stringify([...new Set(hookCalls.map((c) => c.channel))])}`,
  );
  for (const call of dialogueEngineCalls) {
    assert.equal(call.provider, 'codex');
    assert.equal(call.model, 'gpt-5.5');
  }
  // The ego call carries a real system prompt and a user prompt.
  assert.ok(dialogueEngineCalls[0].systemPromptLength > 100, 'ego system prompt should be substantial');
  assert.ok(dialogueEngineCalls[0].hasUserPrompt);
});

test('dialectical layer (unified channel) routes through the hook too', () => {
  const unifiedCalls = hookCalls.filter((c) => c.channel === 'unified');
  assert.ok(unifiedCalls.length > 0, 'expected unified-channel (aiService.generateText) hook calls');
  for (const call of unifiedCalls) {
    assert.equal(call.provider, 'codex');
  }
});

test('zero HTTP LLM traffic escaped the CLI routing', () => {
  assert.deepEqual(escapedFetches, []);
});

test('dialogue log carries cli_capture apiPayload entries (observability restored)', () => {
  const rows = evaluationStore.getResults(runResult.runId);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.ok(row.success, 'result row should be marked successful');
  assert.ok(
    String(row.profileName || '').startsWith('cell_40'),
    `row must carry the requested cell (got "${row.profileName}"), not a default-profile fallback`,
  );
  const log = evaluationStore.loadDialogueLog(row.dialogueId);
  assert.ok(log, 'dialogue log should exist');
  const trace = log.dialogueTrace || [];
  const cliPayloads = trace.filter((e) => e.apiPayload?.source === 'cli_capture');
  assert.ok(
    cliPayloads.length > 0,
    `expected >=1 trace entry with a cli_capture apiPayload, trace agents: ${JSON.stringify(trace.map((e) => `${e.agent}/${e.action}`))}`,
  );
  assert.equal(cliPayloads[0].apiPayload.request.body.model, 'gpt-5.5');
});

test('splitProviderMessages folds system messages and splits user/history', () => {
  const { systemPrompt, userPrompt, messageHistory } = splitProviderMessages(
    [
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'latest' },
    ],
    'SYS',
  );
  assert.equal(systemPrompt, 'SYS'); // deduped against the explicit one
  assert.equal(userPrompt, 'latest');
  assert.deepEqual(messageHistory, [
    { role: 'user', content: 'first' },
    { role: 'assistant', content: 'reply' },
  ]);
});

test('hook registration is SYNCHRONOUS at runner import (regression: macrotask starvation)', () => {
  // A run whose path to the first LLM call is sync/microtask-only (sqlite +
  // config reads are synchronous) never yields to the event loop — a lazy
  // dynamic-import .then() registration fires only at process teardown and
  // the first codex call dies with "Provider codex not configured". Guard:
  // after a purely STATIC import of the runner, with NO event-loop turn of
  // any kind, the hook must already be live.
  const { execSync } = childProcess;
  const script = [
    "import './services/evaluationRunner.js';",
    "import { externalProviderHandles } from './tutor-core/index.js';",
    "console.log('HANDLES=' + externalProviderHandles('codex'));",
    'process.exit(0);', // exit immediately — no event-loop turn allowed
  ].join('\n');
  const out = execSync(`node --input-type=module -e "${script.replace(/"/g, '\\"')}"`, {
    cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'),
    env: {
      ...process.env,
      EVAL_DB_PATH: path.join(TMP_ROOT, 'sync-check.db'),
      EVAL_LOGS_DIR: path.join(TMP_ROOT, 'sync-check-logs'),
      AUTH_DB_PATH: path.join(TMP_ROOT, 'sync-check-lms.sqlite'),
    },
    encoding: 'utf8',
    timeout: 60_000,
  });
  assert.match(out, /HANDLES=true/);
});

test('splitProviderMessages tolerates empty/odd shapes', () => {
  assert.deepEqual(splitProviderMessages(null, 'S'), { systemPrompt: 'S', userPrompt: '', messageHistory: [] });
  const solo = splitProviderMessages([{ role: 'user', content: 'hi' }]);
  assert.equal(solo.systemPrompt, '');
  assert.equal(solo.userPrompt, 'hi');
  assert.deepEqual(solo.messageHistory, []);
});
