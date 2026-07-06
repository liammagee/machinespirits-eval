#!/usr/bin/env node
/**
 * Stage A3 no-paid check for the longitudinal drift-adaptation pilot
 * (notes/2026-07-06-longitudinal-drift-adaptation-prereg.md, Line A, §8.5).
 *
 * Proves, with zero paid calls and against throwaway temp SQLite DBs (never
 * the real tutor-core/data/lms.sqlite or data/evaluations.db), the two-half
 * injection-precondition gate §8.5 requires before any A3 paid session:
 *
 *  (i)  `buildWritingPadNarrative` returns a string containing a seeded
 *       marker once a real recognition moment has been written
 *       (`createRecognitionMoment`) and consolidated
 *       (`runBackgroundMaintenance`) — the exact real chain, not a
 *       synthetic `updateUnconscious` shortcut — and returns `null` for a
 *       freshly initialized, never-consolidated pad.
 *  (ii) With `globalThis.fetch` stubbed (mirroring
 *       tutor-core/services/__tests__/emptyContentRetry.test.js's pattern),
 *       calling `runEvaluation()` in-process with `externalEgoExtension`
 *       set to a narrative containing that marker results in the marker
 *       appearing in the captured outgoing ego request body — proving the
 *       already-committed §8.1/§8.3 read-side finding: (i)'s narrative
 *       actually reaches the model, via the externalEgoExtension /
 *       systemPromptExtension channel, not just the pad's own storage.
 *
 * If either half fails: STOP, fix, re-gate — no paid session runs on a
 * broken injection path (§8.5's own frozen stop rule).
 *
 * Usage: node scripts/report-longitudinal-drift-stage-a3.js --check
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Must be set before the first DB touch of either database this script
// exercises — tutor-core's own (AUTH_DB_PATH, lazily resolved by
// dbService.getDb()) and the eval repo's own results DB/logs
// (EVAL_DB_PATH / EVAL_LOGS_DIR, resolved at services/evaluationStore.js's
// MODULE LOAD time — a top-level const, not a lazy function — so these
// must be set before evaluationRunner.js is ever imported, transitively).
// Mirrors package.json's test:hermetic convention exactly.
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-a3-check-'));
process.env.AUTH_DB_PATH = path.join(TMP_ROOT, 'lms.sqlite');
process.env.EVAL_DB_PATH = path.join(TMP_ROOT, 'evaluations.db');
process.env.EVAL_LOGS_DIR = path.join(TMP_ROOT, 'logs');
// A fake, non-secret key so the OpenRouter provider resolves isConfigured
// === true and the real code path proceeds all the way to (the stubbed)
// fetch — globalThis.fetch is replaced below before any call is made, so
// this string never leaves the process or touches the network.
const HAD_OPENROUTER_API_KEY = 'OPENROUTER_API_KEY' in process.env;
const PRIOR_OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
process.env.OPENROUTER_API_KEY = 'stage-a3-check-hermetic-fake-key';

const { getOrInitializeWritingPad, createRecognitionMoment } =
  await import('../tutor-core/services/writingPadService.js');
const { runBackgroundMaintenance } = await import('../tutor-core/services/memoryDynamicsService.js');
const { closeDb } = await import('../tutor-core/services/dbService.js');
const { buildWritingPadNarrative } = await import('../services/writingPadNarrativeBuilder.js');
const { runEvaluation } = await import('../services/evaluationRunner.js');

const SMOKE_SCENARIO_ID = 'longitudinal_drift_session_1_multiturn';
const SMOKE_CELL = 'cell_40_base_dialectical_suspicious_unified_superego';

/**
 * Half (i): the real write -> consolidate -> narrative chain, using the
 * SAME calls the live pilot depends on (createRecognitionMoment is what
 * dialecticalEngine.negotiateDialectically's Step 3 calls on a real
 * superego disapproval; runBackgroundMaintenance with
 * {consolidation: {minAge: 0, requireTransformative: false}} is what
 * services/evaluationRunner.js already calls after every session).
 */
function checkNarrativeHalf() {
  let failures = 0;

  const emptyLearnerId = `stage-a3-check-empty-${Date.now()}`;
  getOrInitializeWritingPad(emptyLearnerId);
  const emptyNarrative = buildWritingPadNarrative(emptyLearnerId);
  if (emptyNarrative !== null) {
    console.error(
      `FAIL: a freshly initialized, never-consolidated pad should yield a null narrative, got`,
      emptyNarrative,
    );
    failures += 1;
  } else {
    console.log('ok   freshly initialized pad -> buildWritingPadNarrative returns null (nothing to inject)');
  }

  const learnerId = `stage-a3-check-marker-${Date.now()}`;
  const marker = `STAGE-A3-CHECK-MARKER-${Date.now()}`;
  const pad = getOrInitializeWritingPad(learnerId);
  createRecognitionMoment({
    writingPadId: pad.id,
    sessionId: null,
    ghostDemand: { voice: 'stage-a3-check-voice', principle: 'stage-a3-check-principle' },
    learnerNeed: { need: 'stage-a3-check-need', intensity: 0.6 },
    synthesis: { synthesis: `Learner reached ${marker} while working through fractions.`, transformative: true },
    parameters: { superegoCompliance: 0.7, recognitionSeeking: 0.6 },
  });
  runBackgroundMaintenance(learnerId, { consolidation: { minAge: 0, requireTransformative: false } });

  const narrative = buildWritingPadNarrative(learnerId);
  if (!narrative || !narrative.includes(marker)) {
    console.error(`FAIL: expected buildWritingPadNarrative to surface the seeded marker; got`, narrative);
    failures += 1;
  } else {
    console.log("ok   buildWritingPadNarrative surfaces a real consolidated moment's synthesis text (marker present)");
  }

  return { failures, marker, narrative };
}

/**
 * Half (ii): calling the REAL runEvaluation() in-process (not a lower-level
 * function — the frozen §8.5 text names runEvaluation() specifically),
 * against the real scenario/cell pair Stage A3-pilot will actually use,
 * with globalThis.fetch stubbed to a canned, immediate, non-empty
 * OpenRouter-shaped response (never touches the network) and rubric
 * judging skipped (this gate is about generation-time prompt assembly,
 * not scoring). Confirms the seeded narrative's marker reaches the
 * captured outgoing ego request body.
 */
async function checkInjectionHalf(narrative) {
  let failures = 0;
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'stage-a3-check-gen',
        choices: [
          {
            message: { content: '[{"title":"Stage A3 check","message":"stub response","actionTarget":"stub"}]' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10 },
      }),
    };
  };

  try {
    await runEvaluation({
      scenarios: [SMOKE_SCENARIO_ID],
      configurations: [SMOKE_CELL],
      runsPerConfig: 1,
      skipRubricEval: true,
      dryRun: false,
      externalEgoExtension: narrative,
      verbose: false,
    });
  } catch (e) {
    console.error('FAIL: runEvaluation() threw during the hermetic injection-path smoke check:', e.message);
    failures += 1;
  } finally {
    globalThis.fetch = originalFetch;
  }

  if (calls.length === 0) {
    console.error('FAIL: runEvaluation() made zero outgoing fetch calls — nothing to check');
    failures += 1;
    return failures;
  }
  console.log(`ok   runEvaluation() drove ${calls.length} stubbed outgoing call(s) with zero network traffic`);

  const marker = narrative.match(/STAGE-A3-CHECK-MARKER-\d+/)?.[0];
  const hit = calls.some((c) => {
    const body = typeof c.options?.body === 'string' ? c.options.body : '';
    return marker && body.includes(marker);
  });
  if (!hit) {
    console.error(
      `FAIL: seeded marker (${marker}) did not appear in any captured outgoing ego request body across ${calls.length} call(s)`,
    );
    failures += 1;
  } else {
    console.log(
      'ok   seeded marker reached the captured outgoing ego request body (externalEgoExtension -> systemPromptExtension -> callAI confirmed live)',
    );
  }

  return failures;
}

function cleanup() {
  closeDb();
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  if (HAD_OPENROUTER_API_KEY) {
    process.env.OPENROUTER_API_KEY = PRIOR_OPENROUTER_API_KEY;
  } else {
    delete process.env.OPENROUTER_API_KEY;
  }
}

async function runCheck() {
  let failures = 0;
  console.log(`(hermetic: AUTH_DB_PATH=${process.env.AUTH_DB_PATH}, EVAL_DB_PATH=${process.env.EVAL_DB_PATH})\n`);

  const { failures: narrativeFailures, narrative } = checkNarrativeHalf();
  failures += narrativeFailures;

  if (narrativeFailures > 0) {
    console.error('\nSTAGE A3 CHECK FAILED: half (i) failed — skipping half (ii) (no valid narrative to inject)');
    cleanup();
    process.exit(1);
  }

  failures += await checkInjectionHalf(narrative);

  cleanup();

  if (failures > 0) {
    console.error(`\nSTAGE A3 CHECK FAILED: ${failures} failures`);
    process.exit(1);
  }
  console.log('\nSTAGE A3 CHECK PASSED');
}

const isMain = process.argv[1] && process.argv[1].endsWith('report-longitudinal-drift-stage-a3.js');
if (isMain) {
  if (!process.argv.includes('--check')) {
    console.error('Usage: node scripts/report-longitudinal-drift-stage-a3.js --check');
    process.exit(1);
  }
  await runCheck();
}
