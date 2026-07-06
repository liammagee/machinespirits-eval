// A3 constructive-pad-use drift arc — LIVE gate + injection-building + scoring
// (paid-run counterpart to the hermetic scripts/report-longitudinal-drift-stage-a3.js).
// Mirrors scripts/report-longitudinal-drift-stage-a2-live.js's --gate/--score
// shape, adding a --build-injection mode A2 never needed (A2's pad content was
// never fed back into a later session; A3's is, via
// --external-ego-extension-file). Reads the REAL production DBs (default
// AUTH_DB_PATH / EVAL_DB_PATH) — must NOT set either override. Every scoring
// metric is the frozen deterministic checker in
// services/longitudinalDriftChecker.js; no judge model participates.
//
// Modes:
//   --gate <learnerId>
//       §7.4's instrument-precondition gate, UNCHANGED from A2 (prereg §8.5:
//       "§7.4's own gate stays in force unchanged"). Prints
//       total_recognition_moments (cross-checked against the raw
//       recognition_moments row count) and PASS / INSTRUMENT_FLOOR. Exit code
//       0 = PASS, 3 = INSTRUMENT_FLOOR.
//
//   --build-injection <learnerId> <outFile>
//       Builds services/writingPadNarrativeBuilder.js's narrative from the
//       learner's CURRENT (just-consolidated) pad state and writes it to
//       outFile, for use as --external-ego-extension-file on the NEXT pad-ON
//       session. Exit code 0 on a non-empty narrative, 1 if it comes back null
//       (nothing to inject — an instrument failure, not a session to run).
//
//   --score padon:1:<runId> padon:2:<runId> padon:3:<runId> \
//           padoff:1:<runId> padoff:2:<runId> padoff:3:<runId> \
//           [--learner-id <padOnLearnerId>]
//       Scores each session's OPENING tutor turn (suggestions[0].message)
//       against scoreContinuityAcknowledgment / scoreResolvedMisconceptionHandling
//       (prereg §8.4), aggregates per arm with summarizeConstructiveContinuity
//       (the frozen "4-slot" §8.5 verdict), dumps the pad-content secondary
//       trace for the pad-ON learner, and writes
//       exports/longitudinal-drift-stage-a3.{json,md}.
//
// Usage:
//   node scripts/report-longitudinal-drift-stage-a3-live.js --gate <learnerId>
//   node scripts/report-longitudinal-drift-stage-a3-live.js --build-injection <learnerId> <outFile>
//   node scripts/report-longitudinal-drift-stage-a3-live.js --score padon:1:eval-... ... [--learner-id <id>]

import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_JSON = path.join(ROOT, 'exports/longitudinal-drift-stage-a3.json');
const OUT_MD = path.join(ROOT, 'exports/longitudinal-drift-stage-a3.md');

const multiturnScenarioId = (n) => `longitudinal_drift_session_${n}_multiturn`;

// CLI triples use A1/A2's lowercase 'padon'/'padoff' convention;
// summarizeConstructiveContinuity expects the camelCase 'padOn'/'padOff' arm
// labels its rows are already keyed on elsewhere in this module's schema.
const ARM_LABELS = { padon: 'padOn', padoff: 'padOff' };

async function loadDeps() {
  const evaluationStore = await import('../services/evaluationStore.js');
  const { getScenario } = await import('../services/evalConfigLoader.js');
  const checker = await import('../services/longitudinalDriftChecker.js');
  const { getWritingPad, getRecognitionMoments } = await import('../tutor-core/services/writingPadService.js');
  const { buildWritingPadNarrative } = await import('../services/writingPadNarrativeBuilder.js');
  return { evaluationStore, getScenario, checker, getWritingPad, getRecognitionMoments, buildWritingPadNarrative };
}

function metaForSession({ getScenario, checker }, n) {
  const scenario = getScenario(multiturnScenarioId(n));
  if (!scenario) throw new Error(`scenario ${multiturnScenarioId(n)} not resolvable`);
  return checker.loadDriftScenarioMeta(scenario);
}

// The opening tutor turn of a (multi-turn) row — same convention A1/A2 use.
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
  console.log(`# A3 §7.4 instrument-precondition gate (unchanged from A2) — learner ${learnerId}`);
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

async function runBuildInjection(learnerId, outFile) {
  const { buildWritingPadNarrative } = await loadDeps();
  const narrative = buildWritingPadNarrative(learnerId);
  console.log(`# A3 §8.2/§8.7 injection build — learner ${learnerId}`);
  if (!narrative) {
    console.error(
      'FAIL: buildWritingPadNarrative returned null — nothing to inject. This is an instrument failure for the ' +
        "next session, not a session to run; per §8.5's stop-rule spirit, do not proceed without investigating why.",
    );
    return 1;
  }
  fs.writeFileSync(outFile, narrative);
  console.log(`Wrote ${narrative.length} chars to ${outFile}`);
  console.log(`\n--- narrative preview ---\n${narrative}\n--- end preview ---`);
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
    const results = evaluationStore.getResults(t.runId, { scenarioId: multiturnScenarioId(t.sessionIndex) });
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
    const currentMeta = metaForSession(deps, t.sessionIndex);
    const previousMeta = t.sessionIndex > 1 ? metaForSession(deps, t.sessionIndex - 1) : null;
    const continuity = deps.checker.scoreContinuityAcknowledgment({ tutorMessage, previousMeta });
    const misconceptionHandling = deps.checker.scoreResolvedMisconceptionHandling({
      tutorMessage,
      currentMeta,
      previousMeta,
    });
    rows.push({
      arm,
      sessionIndex: t.sessionIndex,
      runId: t.runId,
      openingChars: tutorMessage.length,
      continuity,
      misconceptionHandling,
    });
  }
  return rows;
}

// Identical in spirit to A2's padContentTrace — generic over any learnerId.
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
      strategy: m.synthesis_strategy ?? null,
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
  const summary = deps.checker.summarizeConstructiveContinuity(allRows);
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
      : `| ${r.arm} | ${r.sessionIndex} | ${r.runId} | ${r.openingChars} chars | ${fmtSlot(r.continuity)} | ${fmtSlot(r.misconceptionHandling)} |`;

  const armSummaryLine = (label, s) =>
    `| ${label} | ${s.slotsHit}/4 | ${s.slotsApplicable} | ${s.instrumentFailures} |`;

  const md = [
    '# Longitudinal Drift — Stage A3 (constructive pad use) live scoring',
    '',
    `Checker \`longitudinalDriftChecker@${report.checkerVersion}\` · deterministic, judge-free · opening tutor turn only`,
    '',
    '## Per-session rows',
    '',
    '| Arm | Session | Run ID | Opening | Continuity-ack | Misconception-not-retaught |',
    '| --- | ---: | --- | --- | :---: | :---: |',
    ...allRows.map(rowLine),
    '',
    '## Frozen §8.5 "4-slot" aggregate (2 sessions × 2 checkers)',
    '',
    '| Arm | Slots hit | Slots applicable | Instrument failures |',
    '| --- | :---: | ---: | ---: |',
    armSummaryLine('pad-ON (cell_40, learner-id)', summary.padOn),
    armSummaryLine('pad-OFF (cell_93, no learner-id)', summary.padOff),
    '',
    `- **Constructive-signal gate** (pad-ON ≥ 2/4 AND pad-OFF = 0/4): **${summary.verdict}** ` +
      `(pad-ON ${summary.padOn.slotsHit}/4, pad-OFF ${summary.padOff.slotsHit}/4). Directional-only at this n — ` +
      'scaling needs a fresh pre-registration (§8.5).',
    `- **Red flag** (any pad-OFF constructive hit): ${summary.redFlag ? '**RAISED** — investigate for leakage, do not fold into a positive pad-OFF finding' : 'none'}.`,
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
                  '| voice | need | strategy | transformative | layer |',
                  '| --- | --- | --- | :---: | --- |',
                  ...trace.moments.map(
                    (m) =>
                      `| ${m.voice ?? '—'} | ${m.need ?? '—'} | ${m.strategy ?? '—'} | ${m.transformative} | ${m.layer ?? '—'} |`,
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
  if (args.includes('--build-injection')) {
    const idx = args.indexOf('--build-injection');
    const learnerId = args[idx + 1];
    const outFile = args[idx + 2];
    if (!learnerId || !outFile) {
      console.error('--build-injection requires <learnerId> <outFile>.');
      process.exit(1);
    }
    process.exit(await runBuildInjection(learnerId, outFile));
  }
  if (args.includes('--score')) {
    process.exit(await runScore(args));
  }
  console.error(
    'Usage: --gate <learnerId>  |  --build-injection <learnerId> <outFile>  |  ' +
      '--score padon:1:<runId> ... [--learner-id <id>]',
  );
  process.exit(1);
}

const isMain = process.argv[1] && process.argv[1].endsWith('report-longitudinal-drift-stage-a3-live.js');
if (isMain) {
  main().catch((err) => {
    console.error(err.stack || String(err));
    process.exit(1);
  });
}
