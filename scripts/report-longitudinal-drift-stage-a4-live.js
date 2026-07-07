// A4 structural check-in pilot — LIVE gate + scoring
// (paid-run counterpart to the hermetic scripts/report-longitudinal-drift-stage-a4.js).
// Mirrors scripts/report-longitudinal-drift-stage-a3-live.js's --gate/--score
// shape. Drops A3's --build-injection mode entirely: A4 uses the internal
// Writing Pad read path (fixed in tutor-core/services/{dialecticalEngine,
// memoryDynamicsService,tutorDialogueEngine,writingPadService}.js, §8.8) as
// its canonical memory channel, not the external --external-ego-extension-file
// workaround — there is no narrative-building step to run between sessions.
// Reads the REAL production DBs (default AUTH_DB_PATH / EVAL_DB_PATH) — must
// NOT set either override. Every scoring metric is the frozen deterministic
// checker in services/longitudinalDriftChecker.js; no judge model
// participates.
//
// Modes:
//   --gate <learnerId>
//       §7.4's instrument-precondition gate, UNCHANGED from A2/A3 (prereg
//       §9: "§7.4's own gate stays in force unchanged"). Prints
//       total_recognition_moments (cross-checked against the raw
//       recognition_moments row count) and PASS / INSTRUMENT_FLOOR. Exit code
//       0 = PASS, 3 = INSTRUMENT_FLOOR.
//
//   --verify-live <learnerId> <runId> <sessionIndex>
//       §9's LIVE internal-path delivery check (the frozen gate's
//       precondition half): reads the given run's dialogue log directly and
//       reports how many apiPayload entries in session `sessionIndex` contain
//       any prior session's own interest_markers/misconception vocabulary —
//       mirroring A3's §8.1 standard of direct dialogue-log inspection, not
//       inference from the hermetic tutor-core tests alone. Exit 0 if at
//       least one match is found (session 1 always exits 2 — nothing to
//       verify, no predecessor), exit 1 otherwise.
//
//   --score padon:1:<runId> padon:2:<runId> padon:3:<runId> \
//           padoff:1:<runId> padoff:2:<runId> padoff:3:<runId> \
//           [--learner-id <padOnLearnerId>]
//       Scores each session's OPENING tutor turn (suggestions[0].message)
//       against scoreContentBearingCheckIn / scoreContinuityAcknowledgment
//       (prereg §9), aggregates per arm with summarizeContentBearingCheckIn
//       (the frozen "4-slot" §9 verdict), dumps the pad-content secondary
//       trace for the pad-ON learner, and writes
//       exports/longitudinal-drift-stage-a4.{json,md}.
//
// Usage:
//   node scripts/report-longitudinal-drift-stage-a4-live.js --gate <learnerId>
//   node scripts/report-longitudinal-drift-stage-a4-live.js --verify-live <learnerId> <runId> <sessionIndex>
//   node scripts/report-longitudinal-drift-stage-a4-live.js --score padon:1:eval-... ... [--learner-id <id>]

import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_JSON = path.join(ROOT, 'exports/longitudinal-drift-stage-a4.json');
const OUT_MD = path.join(ROOT, 'exports/longitudinal-drift-stage-a4.md');

const checkinScenarioId = (n) => `longitudinal_drift_session_${n}_multiturn_checkin`;

// CLI triples use A1/A2/A3's lowercase 'padon'/'padoff' convention;
// summarizeContentBearingCheckIn expects the camelCase 'padOn'/'padOff' arm
// labels its rows are already keyed on elsewhere in this module's schema.
const ARM_LABELS = { padon: 'padOn', padoff: 'padOff' };

async function loadDeps() {
  const evaluationStore = await import('../services/evaluationStore.js');
  const { getScenario } = await import('../services/evalConfigLoader.js');
  const checker = await import('../services/longitudinalDriftChecker.js');
  const { getWritingPad, getRecognitionMoments } = await import('../tutor-core/services/writingPadService.js');
  return { evaluationStore, getScenario, checker, getWritingPad, getRecognitionMoments };
}

function metaForSession({ getScenario, checker }, n) {
  const scenario = getScenario(checkinScenarioId(n));
  if (!scenario) throw new Error(`scenario ${checkinScenarioId(n)} not resolvable`);
  return checker.loadDriftScenarioMeta(scenario);
}

// The opening tutor turn of a (multi-turn) row — same convention A1/A2/A3 use.
function openingTurnMessage(row) {
  const s = row?.suggestions;
  if (!Array.isArray(s) || s.length === 0) return null;
  const first = s[0];
  if (typeof first === 'string') return first.trim() || null;
  const msg = first?.message;
  return typeof msg === 'string' && msg.trim() ? msg : null;
}

async function runGate(learnerId) {
  const { getWritingPad, getRecognitionMoments, checker } = await loadDeps();
  const pad = getWritingPad(learnerId);
  const gate = checker.checkPadInstrumentPrecondition(pad);
  let rawCount = null;
  if (pad?.id) {
    try {
      rawCount = getRecognitionMoments(pad.id, { limit: 500 }).length;
    } catch {
      rawCount = null;
    }
  }
  console.log(`# A4 §7.4 instrument-precondition gate (unchanged from A2/A3) — learner ${learnerId}`);
  console.log(`checker version: ${checker.LONGITUDINAL_DRIFT_CHECKER_VERSION}`);
  console.log(`pad exists: ${Boolean(pad)}`);
  console.log(`writing_pads.total_recognition_moments: ${gate.totalRecognitionMoments}`);
  console.log(`raw recognition_moments rows for pad: ${rawCount == null ? '(n/a)' : rawCount}`);
  if (pad && rawCount != null && rawCount !== gate.totalRecognitionMoments) {
    console.log(
      `NOTE: column (${gate.totalRecognitionMoments}) != raw row count (${rawCount}) — ` +
        `possible consolidation mismatch (evaluationRunner logs but does not raise on that).`,
    );
  }
  console.log(`\nGATE: ${gate.pass ? 'PASS' : 'INSTRUMENT_FLOOR'}`);
  if (!gate.pass) {
    console.log('Per §7.4 (unchanged): STOP — no session 2-3, no pad-OFF arm, no further rows without a fresh go.');
  }
  return gate.pass ? 0 : 3;
}

async function runVerifyLive(learnerId, runId, sessionIndex) {
  const deps = await loadDeps();
  const n = Number(sessionIndex);
  console.log(`# A4 §9 LIVE internal-path delivery check — learner ${learnerId}, run ${runId}, session ${n}`);
  if (n <= 1) {
    console.log('Session 1 has no predecessor — nothing to verify. This mode is only meaningful for sessions 2-3.');
    return 2;
  }
  const previousMeta = metaForSession(deps, n - 1);
  const candidates = [
    ...previousMeta.interest_markers,
    previousMeta.active_misconception.token,
    ...previousMeta.active_misconception.markers,
  ];

  // §8.8's own method: the per-session dialogue log in logs/tutor-dialogues/,
  // resolved via the run's result row's dialogue_id, whose dialogueTrace
  // entries carry the literal outgoing ego/superego request as `apiPayload`.
  const results = deps.evaluationStore.getResults(runId, { scenarioId: checkinScenarioId(n) });
  const row = results[0];
  if (!row) {
    console.error(`FAIL: no result row for run ${runId} × scenario ${checkinScenarioId(n)}.`);
    return 1;
  }
  if (!row.dialogueId) {
    console.error(`FAIL: result row ${row.id} has no dialogue_id — cannot locate the dialogue log.`);
    return 1;
  }
  const { resolveTutorDialoguesDir } = await import('../services/evaluationDataPaths.js');
  const logPath = path.join(resolveTutorDialoguesDir(ROOT), `${row.dialogueId}.json`);
  if (!fs.existsSync(logPath)) {
    console.error(`FAIL: no dialogue log found at ${logPath}`);
    return 1;
  }
  const dialogue = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  const traceEntries = Array.isArray(dialogue.dialogueTrace) ? dialogue.dialogueTrace : [];
  const payloadEntries = traceEntries.filter((e) => e?.apiPayload);

  let hitCount = 0;
  let firstEntryHit = false;
  const hitMarkers = new Set();
  payloadEntries.forEach((entry, i) => {
    const payloadText = JSON.stringify(entry.apiPayload);
    let entryHit = false;
    for (const marker of candidates) {
      const re = new RegExp(`\\b${String(marker).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(payloadText)) {
        hitMarkers.add(marker);
        entryHit = true;
      }
    }
    if (entryHit) {
      hitCount += 1;
      if (i === 0) firstEntryHit = true;
    }
  });

  console.log(`dialogue log: ${logPath}`);
  console.log(`dialogueTrace entries with apiPayload: ${payloadEntries.length}`);
  console.log(`entries containing prior-session vocabulary: ${hitCount}`);
  const first = payloadEntries[0];
  console.log(
    `first payload entry (${first ? `agent: ${first.agent}, action: ${first.action}, round: ${first.round}` : 'none'}) ` +
      `contains prior-session vocabulary: ${firstEntryHit}`,
  );
  console.log(`markers matched: ${hitMarkers.size ? [...hitMarkers].join(', ') : '(none)'}`);

  if (hitCount === 0) {
    console.error('\nFAIL: prior-session vocabulary not found in any outgoing apiPayload for this session.');
    return 1;
  }
  console.log('\nPASS: internal-path delivery confirmed live (prior-session content reached the outgoing request).');
  return 0;
}

function parseScoreTriples(args) {
  const triples = [];
  for (const a of args) {
    if (!/^(padon|padoff):[123]:/.test(a)) continue;
    const [armToken, sessionStr, ...rest] = a.split(':');
    triples.push({ armToken, arm: ARM_LABELS[armToken], sessionIndex: Number(sessionStr), runId: rest.join(':') });
  }
  return triples;
}

async function scoreArm(deps, armToken, triples) {
  const { evaluationStore } = deps;
  const arm = ARM_LABELS[armToken];
  const rows = [];
  for (const t of triples.filter((x) => x.armToken === armToken).sort((a, b) => a.sessionIndex - b.sessionIndex)) {
    const results = evaluationStore.getResults(t.runId, { scenarioId: checkinScenarioId(t.sessionIndex) });
    const row = results[0] || null;
    const tutorMessage = openingTurnMessage(row);
    if (!row || !tutorMessage) {
      rows.push({
        arm,
        sessionIndex: t.sessionIndex,
        runId: t.runId,
        instrumentFailure: true,
        reason: !row ? 'no result row' : 'empty/malformed opening turn',
      });
      continue;
    }
    const previousMeta = t.sessionIndex > 1 ? metaForSession(deps, t.sessionIndex - 1) : null;
    const contentBearing = deps.checker.scoreContentBearingCheckIn({ tutorMessage, previousMeta });
    const continuity = deps.checker.scoreContinuityAcknowledgment({ tutorMessage, previousMeta });
    rows.push({
      arm,
      sessionIndex: t.sessionIndex,
      runId: t.runId,
      openingChars: tutorMessage.length,
      contentBearing,
      continuity,
    });
  }
  return rows;
}

// Identical in spirit to A2/A3's padContentTrace — generic over any learnerId.
function padContentTrace(deps, learnerId) {
  if (!learnerId) return null;
  const pad = deps.getWritingPad(learnerId);
  if (!pad) return { learnerId, padExists: false };
  let moments = [];
  try {
    moments = deps.getRecognitionMoments(pad.id, { limit: 500 });
  } catch {
    moments = [];
  }
  return {
    learnerId,
    padExists: true,
    totalRecognitionMoments: pad.metrics.totalRecognitionMoments,
    rawMomentCount: moments.length,
    createdAt: pad.createdAt,
    updatedAt: pad.updatedAt,
    moments: moments.map((m) => ({
      voice: m.ghostDemand?.voice ?? null,
      principle: m.ghostDemand?.principle ?? null,
      need: m.learnerNeed?.need ?? null,
      synthesis: m.synthesis_resolution ?? null,
      transformative: m.transformative,
      layer: m.persistence_layer,
    })),
  };
}

function fmtSlot(result) {
  if (!result) return 'n/a';
  if (!result.applicable) return 'n/a (not applicable)';
  return result.hit ? 'HIT' : 'miss';
}

async function runScore(args) {
  const deps = await loadDeps();
  const learnerIdIdx = args.indexOf('--learner-id');
  const learnerId = learnerIdIdx >= 0 ? args[learnerIdIdx + 1] : null;
  const triples = parseScoreTriples(args);
  if (triples.length === 0) {
    console.error('No padon:/padoff: triples supplied.');
    process.exit(1);
  }

  const padOnRows = await scoreArm(deps, 'padon', triples);
  const padOffRows = await scoreArm(deps, 'padoff', triples);
  const allRows = [...padOnRows, ...padOffRows];
  const summary = deps.checker.summarizeContentBearingCheckIn(allRows);
  const trace = padContentTrace(deps, learnerId);

  const report = {
    checkerVersion: deps.checker.LONGITUDINAL_DRIFT_CHECKER_VERSION,
    rows: allRows,
    summary,
    padContentTrace: trace,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

  const rowLine = (r) =>
    r.instrumentFailure
      ? `| ${r.arm} | ${r.sessionIndex} | ${r.runId} | INSTRUMENT FAILURE (${r.reason}) | | |`
      : `| ${r.arm} | ${r.sessionIndex} | ${r.runId} | ${r.openingChars} chars | ${fmtSlot(r.contentBearing)} | ${fmtSlot(r.continuity)} |`;

  const armSummaryLine = (label, s) =>
    `| ${label} | ${s.slotsHit}/4 | ${s.slotsApplicable} | ${s.instrumentFailures} |`;

  const md = [
    '# Longitudinal Drift — Stage A4 (structural check-in pilot) live scoring',
    '',
    `Checker \`longitudinalDriftChecker@${report.checkerVersion}\` · deterministic, judge-free · opening tutor turn only`,
    '',
    '## Per-session rows',
    '',
    '| Arm | Session | Run ID | Opening | Content-bearing check-in | Continuity-ack |',
    '| --- | ---: | --- | --- | :---: | :---: |',
    ...allRows.map(rowLine),
    '',
    '## Frozen §9 "4-slot" aggregate (2 sessions × 2 checkers)',
    '',
    '| Arm | Slots hit | Slots applicable | Instrument failures |',
    '| --- | :---: | ---: | ---: |',
    armSummaryLine('pad-ON (cell_40, learner-id)', summary.padOn),
    armSummaryLine('pad-OFF (cell_93, no learner-id)', summary.padOff),
    '',
    `- **Structural-signal gate** (pad-ON >= 3/4 AND pad-OFF = 0/4): **${summary.verdict}** ` +
      `(pad-ON ${summary.padOn.slotsHit}/4, pad-OFF ${summary.padOff.slotsHit}/4). Directional-only at this n — ` +
      'scaling needs a fresh pre-registration (§9).',
    `- **Red flag** (any pad-OFF content-bearing hit): ${summary.redFlag ? '**RAISED** — investigate for leakage, do not fold into a positive pad-OFF finding' : 'none'}.`,
    '',
    '## Pad-content secondary trace (pad-ON)',
    '',
    trace == null
      ? '_(no learner-id supplied)_'
      : !trace.padExists
        ? `_(no pad row for ${trace.learnerId})_`
        : [
            `Pad \`${trace.learnerId}\`: total_recognition_moments **${trace.totalRecognitionMoments}**, ` +
              `raw moments **${trace.rawMomentCount}**, updated ${trace.updatedAt}.`,
            '',
            ...(trace.moments.length
              ? [
                  '| voice | need | synthesis | transformative | layer |',
                  '| --- | --- | --- | :---: | --- |',
                  ...trace.moments.map(
                    (m) =>
                      `| ${m.voice ?? '—'} | ${m.need ?? '—'} | ${(m.synthesis ?? '—').toString().slice(0, 80)} | ${m.transformative} | ${m.layer ?? '—'} |`,
                  ),
                ]
              : ['_(pad exists but no recognition moments recorded)_']),
          ].join('\n'),
    '',
  ].join('\n');

  fs.writeFileSync(OUT_MD, md);
  console.log(md);
  console.log(`\nWrote ${path.relative(ROOT, OUT_JSON)} and ${path.relative(ROOT, OUT_MD)}`);
  return 0;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--gate')) {
    const learnerId = args[args.indexOf('--gate') + 1];
    if (!learnerId) {
      console.error('--gate requires a <learnerId>.');
      process.exit(1);
    }
    process.exit(await runGate(learnerId));
  }
  if (args.includes('--verify-live')) {
    const idx = args.indexOf('--verify-live');
    const learnerId = args[idx + 1];
    const runId = args[idx + 2];
    const sessionIndex = args[idx + 3];
    if (!learnerId || !runId || !sessionIndex) {
      console.error('--verify-live requires <learnerId> <runId> <sessionIndex>.');
      process.exit(1);
    }
    process.exit(await runVerifyLive(learnerId, runId, sessionIndex));
  }
  if (args.includes('--score')) {
    process.exit(await runScore(args));
  }
  console.error(
    'Usage: --gate <learnerId>  |  --verify-live <learnerId> <runId> <sessionIndex>  |  ' +
      '--score padon:1:<runId> ... [--learner-id <id>]',
  );
  process.exit(1);
}

const isMain = process.argv[1] && process.argv[1].endsWith('report-longitudinal-drift-stage-a4-live.js');
if (isMain) {
  main().catch((err) => {
    console.error(err.stack || String(err));
    process.exit(1);
  });
}
