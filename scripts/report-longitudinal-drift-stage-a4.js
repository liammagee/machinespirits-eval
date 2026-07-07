#!/usr/bin/env node
/**
 * Stage A4 no-paid check for the longitudinal drift-adaptation pilot
 * (notes/2026-07-06-longitudinal-drift-adaptation-prereg.md, Line A, §9).
 *
 * Unlike Stage A3's --check (scripts/report-longitudinal-drift-stage-a3.js),
 * this gate does NOT re-prove the internal Writing Pad delivery mechanism
 * itself — that mechanism (the four read-path bugs fixed in §8.8) already
 * has an exhaustive hermetic proof at the exact function-call level the live
 * path uses, in tutor-core/services/__tests__/writingPadInternalPathDelivery.test.js
 * (15 tests across 4 files, committed alongside the fixes). Re-deriving that
 * proof at the runEvaluation() level here would duplicate real engineering
 * effort for marginal additional confidence, when §9's own frozen design
 * treats "verified live" as the live session-1→2 dialogue-log inspection
 * itself (mirroring A3's own §8.1 standard) — not a second hermetic layer.
 *
 * What IS new in A4, and what this gate DOES check, with zero paid calls and
 * zero DB/network touches at all:
 *   (i)  the three "_checkin" sibling scenarios
 *        (longitudinal_drift_session_{1,2,3}_multiturn_checkin) resolve,
 *        are multi-turn, carry a longitudinal_drift block identical to
 *        their _multiturn parent, and carry the identical structural
 *        check-in instruction text in learner_context.
 *   (ii) the two checker functions this stage adds
 *        (scoreContentBearingCheckIn, summarizeContentBearingCheckIn) are
 *        wired and behave per their frozen §9 gate (padOn >= 3/4 AND
 *        padOff == 0/4) on synthetic rows.
 * (Both halves are also covered by services/__tests__/longitudinalDriftChecker.test.js
 * under `npm test`; this script exists so the gate can be run standalone,
 * mirroring the Stage A0/A2/A3 --check convention, and so its PASS/FAIL is
 * loggable as its own commit-adjacent artifact.)
 *
 * Usage: node scripts/report-longitudinal-drift-stage-a4.js --check
 */
import { getScenario, isMultiTurnScenario } from '../services/evalConfigLoader.js';
import {
  loadDriftScenarioMeta,
  scoreContentBearingCheckIn,
  summarizeContentBearingCheckIn,
} from '../services/longitudinalDriftChecker.js';

const CHECK_IN_INSTRUCTION_FRAGMENT = 'take a moment to recall where you left off';

function checkScenarios() {
  let failures = 0;
  for (let n = 1; n <= 3; n += 1) {
    const parentId = `longitudinal_drift_session_${n}_multiturn`;
    const checkinId = `${parentId}_checkin`;
    const parent = getScenario(parentId);
    const checkin = getScenario(checkinId);

    if (!parent) {
      console.error(`FAIL: parent scenario ${parentId} does not resolve`);
      failures += 1;
      continue;
    }
    if (!checkin) {
      console.error(`FAIL: checkin scenario ${checkinId} does not resolve`);
      failures += 1;
      continue;
    }
    if (!isMultiTurnScenario(checkinId) || checkin.turns.length !== 3) {
      console.error(`FAIL: ${checkinId} is not a well-formed 3-turn multi-turn scenario`);
      failures += 1;
    } else {
      console.log(`ok   ${checkinId} resolves as a 3-turn multi-turn scenario`);
    }

    try {
      const parentMeta = loadDriftScenarioMeta(parent);
      const checkinMeta = loadDriftScenarioMeta(checkin);
      if (JSON.stringify(checkinMeta) !== JSON.stringify(parentMeta)) {
        console.error(`FAIL: ${checkinId}'s longitudinal_drift block differs from its parent's`);
        failures += 1;
      } else {
        console.log(`ok   ${checkinId}'s longitudinal_drift block matches its parent's exactly`);
      }
    } catch (e) {
      console.error(`FAIL: longitudinal_drift metadata invalid for ${parentId}/${checkinId}: ${e.message}`);
      failures += 1;
    }

    if (!checkin.learner_context.includes(CHECK_IN_INSTRUCTION_FRAGMENT)) {
      console.error(`FAIL: ${checkinId}'s learner_context is missing the structural check-in instruction`);
      failures += 1;
    } else {
      console.log(`ok   ${checkinId} carries the structural check-in instruction`);
    }
  }
  return failures;
}

function checkCheckerGate() {
  let failures = 0;

  const noPredecessor = scoreContentBearingCheckIn({ tutorMessage: 'anything', previousMeta: null });
  if (noPredecessor.applicable !== false) {
    console.error('FAIL: scoreContentBearingCheckIn should be inapplicable with no previousMeta');
    failures += 1;
  } else {
    console.log('ok   scoreContentBearingCheckIn: session 1 (no predecessor) is inapplicable');
  }

  const previousMeta = {
    session_index: 1,
    interest_markers: ['fraction', 'fractions'],
    active_misconception: { token: 'LDS-M1', markers: ['common denominator'] },
  };
  const contentBearing = scoreContentBearingCheckIn({
    tutorMessage: 'Last time we worked on fractions — nice progress on the common denominator idea.',
    previousMeta,
  });
  if (!contentBearing.applicable || !contentBearing.hit) {
    console.error('FAIL: scoreContentBearingCheckIn should hit on previous-session vocabulary');
    failures += 1;
  } else {
    console.log('ok   scoreContentBearingCheckIn hits on previous-session vocabulary');
  }

  const generic = scoreContentBearingCheckIn({ tutorMessage: "Welcome back! Let's continue.", previousMeta });
  if (!generic.applicable || generic.hit) {
    console.error('FAIL: scoreContentBearingCheckIn should miss on a generic, content-free check-in');
    failures += 1;
  } else {
    console.log('ok   scoreContentBearingCheckIn misses on a generic content-free check-in');
  }

  const hit = { applicable: true, hit: true, evidence: null };
  const miss = { applicable: true, hit: false, evidence: null };
  const passRows = [
    { arm: 'padOn', sessionIndex: 2, contentBearing: hit, continuity: hit },
    { arm: 'padOn', sessionIndex: 3, contentBearing: hit, continuity: miss },
    { arm: 'padOff', sessionIndex: 2, contentBearing: miss, continuity: miss },
    { arm: 'padOff', sessionIndex: 3, contentBearing: miss, continuity: miss },
  ];
  const passSummary = summarizeContentBearingCheckIn(passRows);
  if (passSummary.verdict !== 'PASS' || passSummary.padOn.slotsHit < 3 || passSummary.padOff.slotsHit !== 0) {
    console.error('FAIL: summarizeContentBearingCheckIn did not produce the expected frozen §9 PASS shape');
    failures += 1;
  } else {
    console.log('ok   summarizeContentBearingCheckIn: frozen §9 PASS shape confirmed (padOn 3/4, padOff 0/4)');
  }

  const redFlagRows = [
    { arm: 'padOn', sessionIndex: 2, contentBearing: hit, continuity: hit },
    { arm: 'padOn', sessionIndex: 3, contentBearing: hit, continuity: hit },
    { arm: 'padOff', sessionIndex: 2, contentBearing: hit, continuity: miss },
    { arm: 'padOff', sessionIndex: 3, contentBearing: miss, continuity: miss },
  ];
  const redFlagSummary = summarizeContentBearingCheckIn(redFlagRows);
  if (!redFlagSummary.redFlag || redFlagSummary.verdict !== 'FAIL') {
    console.error('FAIL: any pad-OFF content-bearing hit should raise the red flag and FAIL the verdict');
    failures += 1;
  } else {
    console.log('ok   summarizeContentBearingCheckIn: pad-OFF content-bearing hit raises the red flag and FAILs');
  }

  return failures;
}

function runCheck() {
  console.log('# Stage A4 (§9) no-paid gate — scenario + checker wiring only');
  console.log('# (internal-path delivery mechanism itself already proven in Part 1 —');
  console.log('#  see tutor-core/services/__tests__/writingPadInternalPathDelivery.test.js)\n');

  const failures = checkScenarios() + checkCheckerGate();

  if (failures > 0) {
    console.error(`\nSTAGE A4 CHECK FAILED: ${failures} failures`);
    process.exit(1);
  }
  console.log('\nSTAGE A4 CHECK PASSED');
}

const isMain = process.argv[1] && process.argv[1].endsWith('report-longitudinal-drift-stage-a4.js');
if (isMain) {
  if (!process.argv.includes('--check')) {
    console.error('Usage: node scripts/report-longitudinal-drift-stage-a4.js --check');
    process.exit(1);
  }
  runCheck();
}
