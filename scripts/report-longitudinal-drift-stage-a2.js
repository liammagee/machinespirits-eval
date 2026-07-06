#!/usr/bin/env node
/**
 * Stage A2 no-paid check for the longitudinal drift-adaptation pilot
 * (notes/2026-07-06-longitudinal-drift-adaptation-prereg.md, Line A, §7).
 *
 * Exercises, with zero paid calls and against a throwaway temp SQLite DB
 * (never the real `tutor-core/data/lms.sqlite`):
 *
 *  1. The three new `longitudinal_drift_session_{1,2,3}_multiturn` sibling
 *     scenarios resolve, are recognized as multi-turn (`isMultiTurnScenario`),
 *     carry exactly 3 follow-up turns each, and carry the identical
 *     `longitudinal_drift` block as their single-turn parent (same schedule,
 *     same tokens).
 *  2. The full synthetic write -> consolidate -> column-update chain the live
 *     A2 pilot depends on: an empty pad's instrument-precondition gate FAILs
 *     (§7.4 INSTRUMENT_FLOOR), a synthetic recognition moment is written via
 *     `createRecognitionMoment` (the same function
 *     `dialecticalEngine.negotiateDialectically` calls on a real superego
 *     disapproval), `runBackgroundMaintenance` (the same call
 *     `services/evaluationRunner.js` already makes after every session, with
 *     the same `{consolidation: {minAge: 0, requireTransformative: false}}`
 *     options) makes `writing_pads.total_recognition_moments` visible, and
 *     the gate now PASSes.
 *
 * This proves the mechanism end-to-end before any paid spend — it does NOT
 * exercise the real tutor/dialecticalEngine LLM path (no mock exists for
 * `generateSuperegoCritique`; that only runs live, paid, in Stage A2-pilot).
 *
 * Usage: node scripts/report-longitudinal-drift-stage-a2.js --check
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Must be set before the first getDb() call (triggered lazily by any
// writingPadService/dbService function) so this script never touches the
// real database.
const TMP_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stage-a2-check-')), 'lms.sqlite');
process.env.AUTH_DB_PATH = TMP_DB_PATH;

const { getScenario, isMultiTurnScenario } = await import('../services/evalConfigLoader.js');
const { checkPadInstrumentPrecondition, loadDriftScenarioMeta } =
  await import('../services/longitudinalDriftChecker.js');
const { createRecognitionMoment, getOrInitializeWritingPad, getRecognitionMoments, getWritingPad } =
  await import('../tutor-core/services/writingPadService.js');
const { runBackgroundMaintenance } = await import('../tutor-core/services/memoryDynamicsService.js');
const { closeDb } = await import('../tutor-core/services/dbService.js');

const SESSION_IDS = ['longitudinal_drift_session_1', 'longitudinal_drift_session_2', 'longitudinal_drift_session_3'];

function checkScenarios() {
  let failures = 0;

  for (const id of SESSION_IDS) {
    const multiturnId = `${id}_multiturn`;
    const parent = getScenario(id);
    const multiturn = getScenario(multiturnId);

    if (!parent) {
      console.error(`FAIL: parent scenario ${id} not found`);
      failures += 1;
      continue;
    }
    if (!multiturn) {
      console.error(`FAIL: multi-turn sibling ${multiturnId} not found`);
      failures += 1;
      continue;
    }
    console.log(`ok   ${multiturnId} resolves`);

    if (!isMultiTurnScenario(multiturnId)) {
      console.error(`FAIL: ${multiturnId} is not recognized as multi-turn (isMultiTurnScenario)`);
      failures += 1;
    } else {
      console.log(`ok   ${multiturnId} is recognized as multi-turn`);
    }

    const turnCount = Array.isArray(multiturn.turns) ? multiturn.turns.length : -1;
    if (turnCount !== 3) {
      console.error(`FAIL: ${multiturnId} should carry exactly 3 follow-up turns, got ${turnCount}`);
      failures += 1;
    } else {
      console.log(`ok   ${multiturnId} carries exactly 3 follow-up turns (4 turns/session total)`);
    }

    const parentMeta = loadDriftScenarioMeta(parent);
    const multiturnMeta = loadDriftScenarioMeta(multiturn);
    if (JSON.stringify(multiturnMeta) !== JSON.stringify(parentMeta)) {
      console.error(`FAIL: ${multiturnId}'s longitudinal_drift block does not match its parent's`, {
        parentMeta,
        multiturnMeta,
      });
      failures += 1;
    } else {
      console.log(`ok   ${multiturnId} carries the identical longitudinal_drift block as ${id}`);
    }
  }

  return failures;
}

function checkPadChain() {
  let failures = 0;
  const learnerId = `stage-a2-check-${Date.now()}`;

  // 1. A freshly initialized pad has zero recognition moments -> gate FAILs.
  const freshPad = getOrInitializeWritingPad(learnerId);
  const preGate = checkPadInstrumentPrecondition(freshPad);
  if (preGate.pass !== false || preGate.totalRecognitionMoments !== 0) {
    console.error('FAIL: fresh pad should fail the instrument-precondition gate (0 recognition moments)', preGate);
    failures += 1;
  } else {
    console.log('ok   fresh pad correctly FAILs the instrument-precondition gate (INSTRUMENT_FLOOR shape)');
  }

  // 2. Write one synthetic recognition moment — the same call
  //    dialecticalEngine.negotiateDialectically makes on a real superego
  //    disapproval (Step 3, gated on `if (learnerId && writingPad)`).
  const moment = createRecognitionMoment({
    writingPadId: freshPad.id,
    sessionId: null,
    ghostDemand: { voice: 'stage-a2-check-voice', principle: 'stage-a2-check-principle' },
    learnerNeed: { need: 'stage-a2-check-need', intensity: 0.5 },
    synthesis: { synthesis: 'stage-a2-check-synthesis', transformative: true },
    parameters: { superegoCompliance: 0.7, recognitionSeeking: 0.6 },
  });
  const rawMoments = getRecognitionMoments(freshPad.id, { limit: 10 });
  if (!moment || rawMoments.length !== 1) {
    console.error(`FAIL: expected exactly 1 raw recognition_moments row after the synthetic write, got`, rawMoments);
    failures += 1;
  } else {
    console.log('ok   synthetic recognition_moments row written (raw table, pre-consolidation)');
  }

  // The pad's own total_recognition_moments column is NOT touched by
  // createRecognitionMoment — only settleToUnconscious (via
  // runBackgroundMaintenance) increments it. Confirm this two-step gap
  // explicitly before consolidating.
  const padBeforeMaintenance = getWritingPad(learnerId);
  if (padBeforeMaintenance.metrics.totalRecognitionMoments !== 0) {
    console.error(
      'FAIL: total_recognition_moments should still be 0 before runBackgroundMaintenance',
      padBeforeMaintenance.metrics,
    );
    failures += 1;
  } else {
    console.log('ok   total_recognition_moments column stays 0 until consolidation runs (two-step gap confirmed)');
  }

  // 3. Eager consolidation — the same call services/evaluationRunner.js
  //    already makes after every session, with the same minAge: 0 override.
  runBackgroundMaintenance(learnerId, { consolidation: { minAge: 0, requireTransformative: false } });

  const padAfterMaintenance = getWritingPad(learnerId);
  const postGate = checkPadInstrumentPrecondition(padAfterMaintenance);
  if (postGate.pass !== true || postGate.totalRecognitionMoments !== 1) {
    console.error(
      'FAIL: instrument-precondition gate should PASS with totalRecognitionMoments=1 after consolidation',
      postGate,
    );
    failures += 1;
  } else {
    console.log('ok   instrument-precondition gate PASSes after runBackgroundMaintenance consolidates the moment');
  }

  return failures;
}

function runCheck() {
  let failures = 0;
  console.log(`(hermetic: AUTH_DB_PATH=${TMP_DB_PATH})\n`);
  failures += checkScenarios();
  failures += checkPadChain();

  closeDb();
  fs.rmSync(path.dirname(TMP_DB_PATH), { recursive: true, force: true });

  if (failures > 0) {
    console.error(`\nSTAGE A2 CHECK FAILED: ${failures} failures`);
    process.exit(1);
  }
  console.log('\nSTAGE A2 CHECK PASSED');
}

const isMain = process.argv[1] && process.argv[1].endsWith('report-longitudinal-drift-stage-a2.js');
if (isMain) {
  if (!process.argv.includes('--check')) {
    console.error('Usage: node scripts/report-longitudinal-drift-stage-a2.js --check');
    process.exit(1);
  }
  runCheck();
}
