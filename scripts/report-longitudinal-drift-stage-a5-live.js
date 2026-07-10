// A5 negotiation-threading three-arm drift pilot — LIVE gate + scoring
// (paid-run counterpart; sibling of scripts/report-longitudinal-drift-stage-a4-live.js,
// generalized from two arms to three per notes/2026-07-06-longitudinal-drift-adaptation-prereg.md §11).
//
// Reuses the frozen checker (services/longitudinalDriftChecker.js@1.2)
// byte-unchanged for the primary/secondary outcome — only the per-arm
// AGGREGATION and GATE THRESHOLDS are new here, because §11.4's signal
// criteria are asymmetric across arms (arm-1 lower-bound, arm-2
// upper-bound, arm-3 exact-zero), unlike every prior stage's single
// pad-ON->=N / pad-OFF==0 shape that
// longitudinalDriftChecker.summarizeContentBearingCheckIn already encodes.
// Reads the REAL production DBs (default AUTH_DB_PATH / EVAL_DB_PATH) —
// must NOT set either override. No judge model participates anywhere in
// this script.
//
// Arms (§11.2):
//   padon-threadon   — arm 1: pad-ON + threading ON  (learner-id required)
//   padon-threadoff  — arm 2: pad-ON + threading OFF (learner-id required)
//   padoff-threadon  — arm 3: pad-OFF + threading ON (no learner-id)
//
// Modes:
//   --gate <learnerId>
//       §7.4's instrument-precondition gate, UNCHANGED from A2-A4-codex.
//       Applies to arm 1 and arm 2's own learner-ids (arm 3 has none —
//       not applicable, per §11.4 point 2). Exit 0 = PASS, 3 = INSTRUMENT_FLOOR.
//
//   --verify-live <learnerId> <runId> <sessionIndex>
//       §10's LIVE internal-path delivery check, unchanged mechanism
//       (pad-only marker scoping via prior-session apiPayload inspection).
//       Applies to arm 1 and arm 2 only (§11.4 point 3); not applicable to
//       arm 3 (no pad to verify delivery of). Exit 0 = PASS, 1 = FAIL,
//       2 = session 1 (nothing to verify).
//
//   --canary <runId>
//       §11.4 point 1's threading-live canary: arm-1 session 1 only. Checks
//       4/4 clean turns AND at least 1 of the 4 turns' stored suggestion
//       carries non-null metadata.dialecticalStrategy — the live-production
//       proof the Part 1 fix actually fires outside the hermetic test.
//       Exit 0 = PASS, 1 = FAIL.
//
//   --score padon-threadon:1:<runId> padon-threadon:2:<runId> padon-threadon:3:<runId> \
//           padon-threadoff:1:<runId> padon-threadoff:2:<runId> padon-threadoff:3:<runId> \
//           padoff-threadon:1:<runId> padoff-threadon:2:<runId> padoff-threadon:3:<runId> \
//           [--learner-id-arm1 <id>] [--learner-id-arm2 <id>]
//       Scores each session's OPENING tutor turn against
//       scoreContentBearingCheckIn / scoreContinuityAcknowledgment (same
//       instruments as §9/§10), aggregates per arm to the frozen 4-slot
//       scale, applies §11.4's THREE distinct gate thresholds, computes the
//       new per-turn threading-delivery diagnostic (metadata.dialecticalStrategy
//       presence across all 4 turns/session), dumps the pad-content
//       secondary trace for arms 1 and 2, and writes
//       exports/longitudinal-drift-stage-a5.{json,md}.
//
// Usage:
//   node scripts/report-longitudinal-drift-stage-a5-live.js --gate <learnerId>
//   node scripts/report-longitudinal-drift-stage-a5-live.js --verify-live <learnerId> <runId> <sessionIndex>
//   node scripts/report-longitudinal-drift-stage-a5-live.js --canary <runId>
//   node scripts/report-longitudinal-drift-stage-a5-live.js --score padon-threadon:1:<runId> ... [--learner-id-arm1 <id>] [--learner-id-arm2 <id>]

import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_JSON = path.join(ROOT, 'exports/longitudinal-drift-stage-a5.json');
const OUT_MD = path.join(ROOT, 'exports/longitudinal-drift-stage-a5.md');

const checkinScenarioId = (n) => `longitudinal_drift_session_${n}_multiturn_checkin`;

// §11.2/§11.7's three arm tokens.
const ARM_TOKENS = ['padon-threadon', 'padon-threadoff', 'padoff-threadon'];
const ARM_LABEL = {
  'padon-threadon': 'Arm 1: pad-ON + threading ON',
  'padon-threadoff': 'Arm 2: pad-ON + threading OFF (§10 replication control)',
  'padoff-threadon': 'Arm 3: pad-OFF + threading ON (critical control)',
};

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

// The opening tutor turn of a (multi-turn) row — same convention A1-A4 use.
function openingTurnMessage(row) {
  const s = row?.suggestions;
  if (!Array.isArray(s) || s.length === 0) return null;
  const first = s[0];
  if (typeof first === 'string') return first.trim() || null;
  const msg = first?.message;
  return typeof msg === 'string' && msg.trim() ? msg : null;
}

// NEW for A5: per-turn threading-delivery diagnostic (§11.3). Counts, across
// every entry in row.suggestions (one per turn — 4 for a _checkin session),
// how many carry non-null metadata.dialecticalStrategy, and how many of
// those also carry non-empty metadata content (a proxy for "the negotiated
// text itself, not just the tag, made it through").
function threadingDeliveryForRow(row) {
  const s = row?.suggestions;
  if (!Array.isArray(s) || s.length === 0) return { turns: 0, tagged: 0, taggedTurnIndices: [] };
  let tagged = 0;
  const taggedTurnIndices = [];
  s.forEach((turn, i) => {
    const strategy = turn?.metadata?.dialecticalStrategy;
    if (strategy !== undefined && strategy !== null) {
      tagged += 1;
      taggedTurnIndices.push(i);
    }
  });
  return { turns: s.length, tagged, taggedTurnIndices };
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
  console.log(`# A5 §7.4 instrument-precondition gate (unchanged from A2-A4-codex) — learner ${learnerId}`);
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
    console.log('Per §7.4/§11.4pt2 (unchanged): STOP that arm — no session 2-3 without a fresh go.');
  }
  return gate.pass ? 0 : 3;
}

async function runVerifyLive(learnerId, runId, sessionIndex) {
  const deps = await loadDeps();
  const n = Number(sessionIndex);
  console.log(`# A5 §11.4pt3 LIVE internal-path delivery check — learner ${learnerId}, run ${runId}, session ${n}`);
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

async function runCanary(runId) {
  const deps = await loadDeps();
  console.log(`# A5 §11.4pt1 threading-live canary — arm-1 session 1, run ${runId}`);
  const results = deps.evaluationStore.getResults(runId, { scenarioId: checkinScenarioId(1) });
  const row = results[0];
  if (!row) {
    console.error(`FAIL: no result row for run ${runId} × scenario ${checkinScenarioId(1)}.`);
    return 1;
  }
  const s = row.suggestions;
  const cleanTurns = Array.isArray(s) ? s.filter((t) => typeof t?.message === 'string' && t.message.trim()).length : 0;
  console.log(`clean turns: ${cleanTurns}/4`);
  const delivery = threadingDeliveryForRow(row);
  console.log(
    `turns carrying metadata.dialecticalStrategy: ${delivery.tagged}/${delivery.turns} (indices: ${delivery.taggedTurnIndices.join(', ') || 'none'})`,
  );
  const pass = cleanTurns === 4 && delivery.tagged >= 1;
  console.log(`\nCANARY: ${pass ? 'PASS' : 'FAIL'}`);
  if (!pass) {
    console.log('Per §11.4pt1: STOP, investigate, fix, re-canary via resume before any further spend.');
  }
  return pass ? 0 : 1;
}

function parseScoreTriples(args) {
  const triples = [];
  for (const a of args) {
    const armToken = ARM_TOKENS.find((t) => a.startsWith(`${t}:`));
    if (!armToken) continue;
    const rest = a.slice(armToken.length + 1);
    const [sessionStr, ...runIdParts] = rest.split(':');
    triples.push({ armToken, sessionIndex: Number(sessionStr), runId: runIdParts.join(':') });
  }
  return triples;
}

async function scoreArm(deps, armToken, triples) {
  const { evaluationStore } = deps;
  const rows = [];
  for (const t of triples.filter((x) => x.armToken === armToken).sort((a, b) => a.sessionIndex - b.sessionIndex)) {
    const results = evaluationStore.getResults(t.runId, { scenarioId: checkinScenarioId(t.sessionIndex) });
    const row = results[0] || null;
    const tutorMessage = openingTurnMessage(row);
    if (!row || !tutorMessage) {
      rows.push({
        armToken,
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
    const delivery = threadingDeliveryForRow(row);
    rows.push({
      armToken,
      sessionIndex: t.sessionIndex,
      runId: t.runId,
      openingChars: tutorMessage.length,
      contentBearing,
      continuity,
      delivery,
    });
  }
  return rows;
}

// §11's own 3-way aggregation + gate logic — NOT longitudinalDriftChecker's
// summarizeContentBearingCheckIn (that function is hardcoded to the 2-arm
// padOn->=3/padOff==0 shape; §11.4's thresholds are asymmetric across three
// arms, so the aggregation lives here rather than in the frozen checker).
function summarizeThreeArm(allRows) {
  const byArm = {};
  for (const armToken of ARM_TOKENS) {
    const armRows = allRows.filter((r) => r.armToken === armToken);
    const usableRows = armRows.filter((r) => !r.instrumentFailure);
    let slotsHit = 0;
    let slotsApplicable = 0;
    let turnsTagged = 0;
    let turnsTotal = 0;
    const detail = [];
    for (const row of usableRows) {
      for (const checkerName of ['contentBearing', 'continuity']) {
        const result = row[checkerName];
        if (result?.applicable) {
          slotsApplicable += 1;
          if (result.hit) slotsHit += 1;
        }
        detail.push({
          sessionIndex: row.sessionIndex,
          checker: checkerName,
          applicable: Boolean(result?.applicable),
          hit: result?.hit ?? null,
          evidence: result?.evidence ?? null,
        });
      }
      turnsTagged += row.delivery?.tagged ?? 0;
      turnsTotal += row.delivery?.turns ?? 0;
    }
    byArm[armToken] = {
      ran: armRows.length > 0,
      slotsHit,
      slotsApplicable,
      instrumentFailures: armRows.length - usableRows.length,
      threadingDeliveryRate: turnsTotal ? turnsTagged / turnsTotal : null,
      turnsTagged,
      turnsTotal,
      detail,
    };
  }

  // §11.4 point 4 — the three asymmetric frozen thresholds. A gate is only
  // meaningful for an arm that actually ran (an arm stopped/blocked upstream
  // — e.g. at the §7.4 precondition floor — must read NOT RUN, not a
  // vacuous 0/4 pass or fail).
  const notRun = ARM_TOKENS.filter((t) => !byArm[t].ran);
  const arm1Pass = byArm['padon-threadon'].ran ? byArm['padon-threadon'].slotsHit >= 3 : null;
  const arm2Pass = byArm['padon-threadoff'].ran ? byArm['padon-threadoff'].slotsHit <= 1 : null;
  const arm3Pass = byArm['padoff-threadon'].ran ? byArm['padoff-threadon'].slotsHit === 0 : null;
  const cleanSignal = arm1Pass === true && arm2Pass === true && arm3Pass === true;
  // §11.4 point 5 — arm-3 red flag is ANY hit, independent of the arm3Pass
  // boolean above (identical condition here, but reported/labeled
  // separately per the frozen design so it is never silently absorbed into
  // a single pass/fail bit).
  const arm3RedFlag = byArm['padoff-threadon'].slotsHit > 0;

  return {
    byArm,
    gates: { arm1Pass, arm2Pass, arm3Pass },
    verdict:
      notRun.length > 0
        ? `NOT_EVALUABLE — arm(s) not run: ${notRun.join(', ')} (see the prereg §11.8 implementation log)`
        : cleanSignal
          ? 'CLEAN_SIGNAL'
          : 'NOT_CLEAN — see §11.5 interpretation map',
    arm3RedFlag,
  };
}

// Identical in spirit to A2-A4's padContentTrace — generic over any learnerId.
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
  const arm1LearnerIdx = args.indexOf('--learner-id-arm1');
  const arm2LearnerIdx = args.indexOf('--learner-id-arm2');
  const arm1LearnerId = arm1LearnerIdx >= 0 ? args[arm1LearnerIdx + 1] : null;
  const arm2LearnerId = arm2LearnerIdx >= 0 ? args[arm2LearnerIdx + 1] : null;
  const triples = parseScoreTriples(args);
  if (triples.length === 0) {
    console.error('No padon-threadon:/padon-threadoff:/padoff-threadon: triples supplied.');
    process.exit(1);
  }

  const allRows = [];
  for (const armToken of ARM_TOKENS) {
    allRows.push(...(await scoreArm(deps, armToken, triples)));
  }
  const summary = summarizeThreeArm(allRows);
  const traceArm1 = padContentTrace(deps, arm1LearnerId);
  const traceArm2 = padContentTrace(deps, arm2LearnerId);

  const report = {
    checkerVersion: deps.checker.LONGITUDINAL_DRIFT_CHECKER_VERSION,
    rows: allRows,
    summary,
    padContentTrace: { arm1: traceArm1, arm2: traceArm2 },
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

  const rowLine = (r) =>
    r.instrumentFailure
      ? `| ${ARM_LABEL[r.armToken]} | ${r.sessionIndex} | ${r.runId} | INSTRUMENT FAILURE (${r.reason}) | | | |`
      : `| ${ARM_LABEL[r.armToken]} | ${r.sessionIndex} | ${r.runId} | ${r.openingChars} chars | ${fmtSlot(r.contentBearing)} | ${fmtSlot(r.continuity)} | ${r.delivery.tagged}/${r.delivery.turns} |`;

  const armSummaryLine = (armToken) => {
    const s = summary.byArm[armToken];
    if (!s.ran) {
      return `| ${ARM_LABEL[armToken]} | NOT RUN | — | — | — |`;
    }
    const rate = s.threadingDeliveryRate == null ? 'n/a' : `${(s.threadingDeliveryRate * 100).toFixed(0)}%`;
    return `| ${ARM_LABEL[armToken]} | ${s.slotsHit}/4 | ${s.slotsApplicable} | ${s.instrumentFailures} | ${s.turnsTagged}/${s.turnsTotal} (${rate}) |`;
  };
  const gateWord = (pass) => (pass === null ? 'NOT RUN' : pass ? 'pass' : 'fail');
  const armGateCell = (armToken, pass) =>
    summary.byArm[armToken].ran ? `${summary.byArm[armToken].slotsHit}/4 [${gateWord(pass)}]` : 'NOT RUN';

  const md = [
    '# Longitudinal Drift — Stage A5 (negotiation threading, three-arm) live scoring',
    '',
    `Checker \`longitudinalDriftChecker@${report.checkerVersion}\` (byte-unchanged) · deterministic, judge-free · opening tutor turn only. 3-way aggregation/gates are new to this script (§11.4).`,
    '',
    '## Per-session rows',
    '',
    '| Arm | Session | Run ID | Opening | Content-bearing check-in | Continuity-ack | Threading tagged/turns |',
    '| --- | ---: | --- | --- | :---: | :---: | :---: |',
    ...allRows.map(rowLine),
    '',
    '## Frozen §11.3 "4-slot" aggregate (2 sessions × 2 checkers) + threading-delivery diagnostic',
    '',
    '| Arm | Slots hit | Slots applicable | Instrument failures | Threading-delivery rate |',
    '| --- | :---: | ---: | ---: | :---: |',
    ...ARM_TOKENS.map(armSummaryLine),
    '',
    `- **Structural-signal gate** (arm-1 >=3/4 AND arm-2 <=1/4 AND arm-3 =0/4): **${summary.verdict}** ` +
      `(arm-1 ${armGateCell('padon-threadon', summary.gates.arm1Pass)}, ` +
      `arm-2 ${armGateCell('padon-threadoff', summary.gates.arm2Pass)}, ` +
      `arm-3 ${armGateCell('padoff-threadon', summary.gates.arm3Pass)}). ` +
      'Directional-only at this n — scaling needs a fresh pre-registration (§11.6).',
    summary.byArm['padon-threadoff'].ran
      ? `- **§10 comparison line (frozen)**: §10's pad-ON/threading-OFF-equivalent result was **2/4**. Arm-2 here scored ` +
        `**${summary.byArm['padon-threadoff'].slotsHit}/4** — ${summary.byArm['padon-threadoff'].slotsHit === 2 ? 'matches §10 exactly' : 'deviates from §10; see §11.5 for how to read a deviation'}.`
      : `- **§10 comparison line (frozen)**: arm 2 NOT RUN — no fresh replication datum; §10's own pad-ON **2/4** stands unchallenged.`,
    `- **Red flag** (arm-3 — the critical control — any content-bearing hit): ${summary.arm3RedFlag ? '**RAISED** — investigate for scenario-echo vs genuine fabrication per §11.4pt5/§11.5 before any positive reading' : 'none'}.`,
    '',
    '## Pad-content secondary trace',
    '',
    '### Arm 1 (pad-ON + threading ON)',
    '',
    traceArm1 == null
      ? '_(no --learner-id-arm1 supplied)_'
      : !traceArm1.padExists
        ? `_(no pad row for ${traceArm1.learnerId})_`
        : [
            `Pad \`${traceArm1.learnerId}\`: total_recognition_moments **${traceArm1.totalRecognitionMoments}**, ` +
              `raw moments **${traceArm1.rawMomentCount}**, updated ${traceArm1.updatedAt}.`,
            '',
            ...(traceArm1.moments.length
              ? [
                  '| voice | need | synthesis | transformative | layer |',
                  '| --- | --- | --- | :---: | --- |',
                  ...traceArm1.moments.map(
                    (m) =>
                      `| ${m.voice ?? '—'} | ${m.need ?? '—'} | ${(m.synthesis ?? '—').toString().slice(0, 80)} | ${m.transformative} | ${m.layer ?? '—'} |`,
                  ),
                ]
              : ['_(pad exists but no recognition moments recorded)_']),
          ].join('\n'),
    '',
    '### Arm 2 (pad-ON + threading OFF)',
    '',
    traceArm2 == null
      ? '_(no --learner-id-arm2 supplied)_'
      : !traceArm2.padExists
        ? `_(no pad row for ${traceArm2.learnerId})_`
        : [
            `Pad \`${traceArm2.learnerId}\`: total_recognition_moments **${traceArm2.totalRecognitionMoments}**, ` +
              `raw moments **${traceArm2.rawMomentCount}**, updated ${traceArm2.updatedAt}.`,
            '',
            ...(traceArm2.moments.length
              ? [
                  '| voice | need | synthesis | transformative | layer |',
                  '| --- | --- | --- | :---: | --- |',
                  ...traceArm2.moments.map(
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
  if (args.includes('--canary')) {
    const runId = args[args.indexOf('--canary') + 1];
    if (!runId) {
      console.error('--canary requires a <runId>.');
      process.exit(1);
    }
    process.exit(await runCanary(runId));
  }
  if (args.includes('--score')) {
    process.exit(await runScore(args));
  }
  console.error(
    'Usage: --gate <learnerId>  |  --verify-live <learnerId> <runId> <sessionIndex>  |  --canary <runId>  |  ' +
      '--score padon-threadon:1:<runId> ... [--learner-id-arm1 <id>] [--learner-id-arm2 <id>]',
  );
  process.exit(1);
}

const isMain = process.argv[1] && process.argv[1].endsWith('report-longitudinal-drift-stage-a5-live.js');
if (isMain) {
  main().catch((err) => {
    console.error(err.stack || String(err));
    process.exit(1);
  });
}
