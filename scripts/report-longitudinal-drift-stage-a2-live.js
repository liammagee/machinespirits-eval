// A2 pad-feeding drift arc — LIVE gate + scoring (paid-run counterpart to the
// hermetic scripts/report-longitudinal-drift-stage-a2.js). This script reads
// the REAL production DBs (tutor-core/data/lms.sqlite via the default
// AUTH_DB_PATH, data/evaluations.db via the default EVAL_DB_PATH) — it must
// NOT set either env override, or it would read empty temp DBs. Every metric
// is the frozen deterministic checker in services/longitudinalDriftChecker.js;
// no judge model participates.
//
// Modes:
//   --gate <learnerId>
//       Apply the frozen §7.4 instrument-precondition gate to the live
//       Writing Pad after pad-ON session 1. Prints the pad's
//       total_recognition_moments (cross-checked against the raw
//       recognition_moments row count) and PASS / INSTRUMENT_FLOOR.
//       Exit code 0 = PASS, 3 = INSTRUMENT_FLOOR (per §7.4 STOP).
//
//   --score padon:1:<runId> padon:2:<runId> padon:3:<runId> \
//           padoff:1:<runId> padoff:2:<runId> padoff:3:<runId> \
//           [--learner-id <padOnLearnerId>]
//       Score each session's OPENING tutor turn (suggestions[0].message)
//       against the frozen drift schedule, aggregate per arm with
//       summarizeDriftRun, apply the frozen §7.4 gates (validity,
//       directional adaptation, structural red flag), dump the pad-content
//       secondary trace for the pad-ON learner, and write
//       exports/longitudinal-drift-stage-a2.{json,md}.
//
// Usage:
//   node scripts/report-longitudinal-drift-stage-a2-live.js --gate <learnerId>
//   node scripts/report-longitudinal-drift-stage-a2-live.js --score padon:1:eval-... ... [--learner-id <id>]

import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_JSON = path.join(ROOT, 'exports/longitudinal-drift-stage-a2.json');
const OUT_MD = path.join(ROOT, 'exports/longitudinal-drift-stage-a2.md');

const multiturnScenarioId = (n) => `longitudinal_drift_session_${n}_multiturn`;

// Frozen §7.4 thresholds (directional-report-only at this n).
const VALIDITY_CURRENT_RATE = 2 / 3; // pad-ON current-reference rate must reach this
const ADAPTATION_GAP_ROWS = 2 / 3; // pad-ON stale-rate < pad-OFF stale-rate, gap >= this fraction of eligible rows

async function loadDeps() {
  const evaluationStore = await import('../services/evaluationStore.js');
  const { getScenario } = await import('../services/evalConfigLoader.js');
  const checker = await import('../services/longitudinalDriftChecker.js');
  const { getWritingPad, getRecognitionMoments } = await import('../tutor-core/services/writingPadService.js');
  return { evaluationStore, getScenario, checker, getWritingPad, getRecognitionMoments };
}

function metaForSession({ getScenario, checker }, n) {
  const scenario = getScenario(multiturnScenarioId(n));
  if (!scenario) throw new Error(`scenario ${multiturnScenarioId(n)} not resolvable`);
  return checker.loadDriftScenarioMeta(scenario);
}

// The opening tutor turn of a (multi-turn) row. A1's convention is
// suggestions[0].message; guard against a bare-string element and an
// empty/malformed array (which is a row-level instrument failure).
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
  console.log(`# A2 §7.4 instrument-precondition gate — learner ${learnerId}`);
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
    console.log('Per §7.4: STOP — no session 2-3, no pad-OFF arm, no further rows without a fresh go.');
  }
  return gate.pass ? 0 : 3;
}

function parseScoreTriples(args) {
  const triples = [];
  for (const a of args) {
    if (!/^(padon|padoff):[123]:/.test(a)) continue;
    const [arm, sessionStr, ...rest] = a.split(':');
    triples.push({ arm, sessionIndex: Number(sessionStr), runId: rest.join(':') });
  }
  return triples;
}

async function scoreArm(deps, arm, triples) {
  const { evaluationStore } = deps;
  const rows = [];
  for (const t of triples.filter((x) => x.arm === arm).sort((a, b) => a.sessionIndex - b.sessionIndex)) {
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
    const scored = deps.checker.scoreOpeningTurn({ tutorMessage, currentMeta, previousMeta });
    rows.push({ arm, runId: t.runId, openingChars: tutorMessage.length, ...scored });
  }
  return { rows, summary: deps.checker.summarizeDriftRun(rows) };
}

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

async function runScore(args) {
  const deps = await loadDeps();
  const learnerIdIdx = args.indexOf('--learner-id');
  const learnerId = learnerIdIdx >= 0 ? args[learnerIdIdx + 1] : null;
  const triples = parseScoreTriples(args);
  if (triples.length === 0) {
    console.error('No padon:/padoff: triples supplied.');
    process.exit(1);
  }

  const padon = await scoreArm(deps, 'padon', triples);
  const padoff = await scoreArm(deps, 'padoff', triples);
  const trace = padContentTrace(deps, learnerId);

  // Frozen §7.4 gates.
  const validityPass =
    padon.summary.currentReferenceRate != null && padon.summary.currentReferenceRate >= VALIDITY_CURRENT_RATE;

  const padOnStale = padon.summary.staleReferenceRate;
  const padOffStale = padoff.summary.staleReferenceRate;
  const staleEligible = Math.max(padon.summary.staleEligibleRows, padoff.summary.staleEligibleRows);
  const rateGap = padOnStale != null && padOffStale != null ? padOffStale - padOnStale : null;
  const rowGap = rateGap != null ? rateGap * staleEligible : null;
  const adaptationDirectional =
    padOnStale != null &&
    padOffStale != null &&
    padOnStale < padOffStale &&
    rowGap != null &&
    rowGap >= ADAPTATION_GAP_ROWS;

  const structuralRedFlag = padOffStale != null && padOffStale > 0;

  const report = {
    checkerVersion: deps.checker.LONGITUDINAL_DRIFT_CHECKER_VERSION,
    thresholds: { validityCurrentRate: VALIDITY_CURRENT_RATE, adaptationGapRows: ADAPTATION_GAP_ROWS },
    padon,
    padoff,
    gates: {
      validity: { pass: validityPass, padOnCurrentRate: padon.summary.currentReferenceRate },
      adaptationDirectional: {
        consistentWithSignal: adaptationDirectional,
        padOnStaleRate: padOnStale,
        padOffStaleRate: padOffStale,
        rateGap,
        rowGap,
        note: 'directional-report-only at this n; neither confirms nor refutes',
      },
      structuralRedFlag,
    },
    padContentTrace: trace,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

  const fmtRate = (r) => (r == null ? 'n/a' : r.toFixed(2));
  const armLine = (label, s) =>
    `| ${label} | ${s.usable}/${s.n} | ${s.currentReferenceHits}/${s.usable} (${fmtRate(s.currentReferenceRate)}) | ` +
    `${s.staleReferenceHits}/${s.staleEligibleRows} (${fmtRate(s.staleReferenceRate)}) | ${s.instrumentFailures} |`;

  const md = [
    '# Longitudinal Drift — Stage A2 (pad-feeding, multi-turn) live scoring',
    '',
    `Checker \`longitudinalDriftChecker@${report.checkerVersion}\` · deterministic, judge-free · opening tutor turn only`,
    '',
    '| Arm | Usable | Current-ref hits (rate) | Stale-ref hits (rate) | Instrument failures |',
    '| --- | ---: | :---: | :---: | ---: |',
    armLine('pad-ON (cell_40, learner-id)', padon.summary),
    armLine('pad-OFF (cell_93, no learner-id)', padoff.summary),
    '',
    '## Frozen §7.4 gates',
    '',
    `- **Instrument-precondition (session-1 gate)**: applied separately via \`--gate\` before this scoring; ` +
      `pad-content trace below records the settled count.`,
    `- **Primary-outcome validity** (pad-ON current-reference ≥ ${VALIDITY_CURRENT_RATE.toFixed(2)}): ` +
      `**${validityPass ? 'PASS' : 'FAIL'}** (pad-ON current-reference ${fmtRate(padon.summary.currentReferenceRate)}).`,
    `- **Adaptation signal** (directional-report-only; pad-ON stale < pad-OFF stale with gap ≥ ${ADAPTATION_GAP_ROWS.toFixed(2)} rows): ` +
      `pad-ON stale ${fmtRate(padOnStale)}, pad-OFF stale ${fmtRate(padOffStale)}, row-gap ${rowGap == null ? 'n/a' : rowGap.toFixed(2)} — ` +
      `${adaptationDirectional ? 'CONSISTENT WITH a signal (not confirmed at this n)' : 'no directional signal'}.`,
    `- **Structural red flag** (pad-OFF stale > 0): ${structuralRedFlag ? '**RAISED**' : 'none'}.`,
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
  if (args.includes('--score')) {
    process.exit(await runScore(args));
  }
  console.error('Usage: --gate <learnerId>  |  --score padon:1:<runId> ... [--learner-id <id>]');
  process.exit(1);
}

const isMain = process.argv[1] && process.argv[1].endsWith('report-longitudinal-drift-stage-a2-live.js');
if (isMain) {
  main().catch((err) => {
    console.error(err.stack || String(err));
    process.exit(1);
  });
}
