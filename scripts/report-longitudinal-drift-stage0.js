#!/usr/bin/env node
/**
 * Stage A0 no-paid check for the longitudinal drift-adaptation pilot
 * (notes/2026-07-06-longitudinal-drift-adaptation-prereg.md, Line A).
 *
 * `--check`: validates the three drift-schedule scenarios resolve with
 * well-formed `longitudinal_drift` blocks (globally-unique tokens), and
 * exercises `scoreOpeningTurn` against synthetic fixture messages covering
 * all four current x stale combinations plus the session-1-has-no-
 * predecessor edge case and `summarizeDriftRun`'s instrument-failure
 * exclusion. No paid calls anywhere in this script.
 *
 * Usage: node scripts/report-longitudinal-drift-stage0.js --check
 */
import { getScenario } from '../services/evalConfigLoader.js';
import { loadDriftScenarioMeta, scoreOpeningTurn, summarizeDriftRun } from '../services/longitudinalDriftChecker.js';

const SESSION_IDS = ['longitudinal_drift_session_1', 'longitudinal_drift_session_2', 'longitudinal_drift_session_3'];

function runCheck() {
  let failures = 0;

  const scenarios = SESSION_IDS.map((id) => {
    const s = getScenario(id);
    if (!s) {
      console.error(`FAIL: scenario ${id} not found`);
      failures += 1;
      return null;
    }
    return s;
  });
  if (failures > 0) {
    console.error(`\nSTAGE A0 CHECK FAILED: ${failures} failures (scenario resolution)`);
    process.exit(1);
  }
  console.log(`ok   resolved ${scenarios.length}/3 scenarios`);

  const metas = scenarios.map(loadDriftScenarioMeta);
  console.log(`ok   all 3 scenarios carry well-formed longitudinal_drift blocks`);

  const tokens = metas.map((m) => m.active_misconception.token);
  const uniqueTokens = new Set(tokens);
  if (uniqueTokens.size !== tokens.length) {
    console.error(`FAIL: duplicate misconception tokens across schedule: ${tokens.join(', ')}`);
    failures += 1;
  } else {
    console.log(`ok   misconception tokens globally unique: ${tokens.join(', ')}`);
  }

  // Fixture messages exercising all four current x stale combinations
  // against session 2 (has both a current and a previous meta).
  const current = metas[1];
  const previous = metas[0];
  const fixtures = [
    { label: 'neither', message: 'Great work today, keep it up!', expectCurrent: false, expectStale: false },
    {
      label: 'current only',
      message: "Let's dig into ratios today, especially proportions.",
      expectCurrent: true,
      expectStale: false,
    },
    {
      label: 'stale only',
      message: 'Remember our work on fractions and the denominator issue?',
      expectCurrent: false,
      expectStale: true,
    },
    {
      label: 'both',
      message: 'Today we move to ratios, but first recall fractions and denominators from before.',
      expectCurrent: true,
      expectStale: true,
    },
  ];

  for (const fixture of fixtures) {
    const result = scoreOpeningTurn({ tutorMessage: fixture.message, currentMeta: current, previousMeta: previous });
    const ok = result.current.hit === fixture.expectCurrent && result.stale.hit === fixture.expectStale;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${fixture.label}: current=${result.current.hit} (expect ${fixture.expectCurrent}), stale=${result.stale.hit} (expect ${fixture.expectStale})`,
    );
    if (!ok) failures += 1;
  }

  // Session 1 has no previous — stale must be null, never a false hit.
  const session1Result = scoreOpeningTurn({
    tutorMessage: 'Fractions today!',
    currentMeta: metas[0],
    previousMeta: null,
  });
  if (session1Result.stale !== null) {
    console.error('FAIL: session 1 (no predecessor) must have stale=null, got', session1Result.stale);
    failures += 1;
  } else {
    console.log('ok   session 1 has no predecessor: stale=null (excluded, not scored false)');
  }

  // summarizeDriftRun sanity: instrument-failure rows excluded from both denominators.
  const rows = [
    { current: { hit: true }, stale: { hit: false }, instrumentFailure: false },
    { current: { hit: false }, stale: { hit: true }, instrumentFailure: false },
    { current: { hit: true }, stale: { hit: true }, instrumentFailure: true }, // excluded
  ];
  const summary = summarizeDriftRun(rows);
  if (summary.usable !== 2 || summary.instrumentFailures !== 1) {
    console.error('FAIL: summarizeDriftRun did not exclude the instrument-failure row correctly', summary);
    failures += 1;
  } else {
    console.log(
      `ok   summarizeDriftRun excludes instrument-failure rows (usable=${summary.usable}, failures=${summary.instrumentFailures})`,
    );
  }

  if (failures > 0) {
    console.error(`\nSTAGE A0 CHECK FAILED: ${failures} failures`);
    process.exit(1);
  }
  console.log('\nSTAGE A0 CHECK PASSED');
}

const isMain = process.argv[1] && process.argv[1].endsWith('report-longitudinal-drift-stage0.js');
if (isMain) {
  if (!process.argv.includes('--check')) {
    console.error('Usage: node scripts/report-longitudinal-drift-stage0.js --check');
    process.exit(1);
  }
  runCheck();
}
