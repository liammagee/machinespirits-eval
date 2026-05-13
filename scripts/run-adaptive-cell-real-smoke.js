#!/usr/bin/env node
// Real-LLM smoke for cell_126 evidence extractor (A14 Stage 2a verification).
//
// Runs cell_126_state_policy_evidence_bound on a filterable subset of the
// adaptive trap suite with ADAPTIVE_TUTOR_LLM=real. After the run completes,
// reads back the persisted trace files and computes the verifiable-quote
// rate from finalEvidenceLog: (validated entries) / (total entries).
//
// Gate thresholds (from TODO.md §A14 Stage 2):
//   ≥70%  → unlocks Stage 2b (hypothesisUpdater)
//   ≥95%  → calibration target
//   <70%  → prompt iteration required before proceeding
//
// COSTS REAL API BUDGET. Default filter is three scenarios spanning the
// compliant/resistant/questioning agencySignal types so the calibration
// reading covers heterogeneous dialogue shapes rather than one quirk.
// Override with: node scripts/run-adaptive-cell-real-smoke.js <id-or-comma-list-or-all>

import fs from 'fs';
import os from 'os';
import path from 'path';

const DEFAULT_FILTER = 'false_confusion_v1,resistance_to_insight_v1,sophistication_upgrade_v1';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-cell-real-'));
process.env.EVAL_DB_PATH = path.join(tmpDir, 'evaluations.db');
process.env.EVAL_LOGS_DIR = path.join(tmpDir, 'logs');
process.env.ADAPTIVE_TUTOR_LLM = 'real';
fs.mkdirSync(path.join(process.env.EVAL_LOGS_DIR, 'tutor-dialogues'), { recursive: true });

const evalConfigLoader = await import('../services/evalConfigLoader.js');
const { runAdaptiveEvaluation } = await import('../services/adaptiveTutor/index.js');

const profileName = 'cell_126_state_policy_evidence_bound';
const scenarioFilter = process.argv[2] || DEFAULT_FILTER;
const evalProfile = evalConfigLoader.loadTutorAgents()?.profiles?.[profileName];
if (!evalProfile) throw new Error(`profile ${profileName} not found in tutor-agents.yaml`);

console.log(`[real-smoke] profile=${profileName} scenarios=${scenarioFilter} llm=real`);
console.log(`[real-smoke] tmp=${tmpDir}`);

const summary = await runAdaptiveEvaluation({
  profileName,
  evalProfile,
  scenarios: scenarioFilter,
  runsPerConfig: 1,
  description: `${profileName} real-LLM extractor smoke`,
  dryRun: false,
  verbose: true,
});

console.log('\n--- run summary ---');
console.log(JSON.stringify(summary, null, 2));

const tracesDir = path.join(process.env.EVAL_LOGS_DIR, 'tutor-dialogues');
const files = fs.readdirSync(tracesDir).filter((f) => f.endsWith('.json'));

// Trace files are written under both <dialogueId>.json and <sha256>.json
// (per persistence.js writeTraceFile), so dedupe by scenario.id.
const seenIds = new Set();
const perScenario = [];
for (const f of files) {
  let trace;
  try { trace = JSON.parse(fs.readFileSync(path.join(tracesDir, f), 'utf8')); }
  catch { continue; }
  const sid = trace?.scenario?.id;
  if (!sid || seenIds.has(sid)) continue;
  seenIds.add(sid);

  const origLog = Array.isArray(trace.original?.finalEvidenceLog) ? trace.original.finalEvidenceLog : [];
  const cfLog = Array.isArray(trace.counterfactual?.finalEvidenceLog) ? trace.counterfactual.finalEvidenceLog : [];

  // Per-turn breakdown shows when extractor mis-fires (e.g. only the
  // opening turn or only later turns hallucinate). The validated flag is
  // computed at extraction time by graph.js's substring-match gate.
  const turnStats = new Map();
  for (const e of [...origLog, ...cfLog]) {
    const t = e.turn ?? -1;
    if (!turnStats.has(t)) turnStats.set(t, { total: 0, validated: 0 });
    const s = turnStats.get(t);
    s.total += 1;
    if (e.validated) s.validated += 1;
  }
  const byTurn = [...turnStats.entries()].sort(([a], [b]) => a - b)
    .map(([turn, s]) => ({ turn, total: s.total, validated: s.validated }));

  const total = origLog.length + cfLog.length;
  const validated = [...origLog, ...cfLog].filter((e) => e.validated).length;
  const rate = total > 0 ? validated / total : null;
  perScenario.push({ scenarioId: sid, total, validated, rate, byTurn });
}

console.log('\n--- per-scenario extractor stats ---');
for (const s of perScenario) {
  const pct = s.rate == null ? 'n/a' : `${(s.rate * 100).toFixed(1)}%`;
  console.log(`  ${s.scenarioId.padEnd(40)} validated=${s.validated}/${s.total}  rate=${pct}`);
  for (const t of s.byTurn) {
    console.log(`    turn ${t.turn}: ${t.validated}/${t.total} validated`);
  }
}

const validTotals = perScenario.filter((s) => s.total > 0);
if (validTotals.length === 0) {
  console.error('\nNo evidence entries extracted in any scenario.');
  console.error('Possible causes: extractor not wired for state_policy_evidence_bound,');
  console.error('or learner messages absent from dialogue, or all extractions returned empty arrays.');
  process.exit(1);
}
const totalAll = validTotals.reduce((sum, s) => sum + s.total, 0);
const valAll = validTotals.reduce((sum, s) => sum + s.validated, 0);
const aggRate = valAll / totalAll;
const aggPct = (aggRate * 100).toFixed(1);

console.log('\n--- aggregate ---');
console.log(`  total entries:      ${totalAll}`);
console.log(`  validated entries:  ${valAll}`);
console.log(`  aggregate rate:     ${aggPct}%`);
console.log('  threshold (gate):   70.0%  (≥70% unlocks Stage 2b)');
console.log('  threshold (target): 95.0%  (calibration target)');

if (aggRate >= 0.95) console.log('\nVERDICT: ≥95% — extractor well-calibrated. Proceed to Stage 2b.');
else if (aggRate >= 0.7) console.log('\nVERDICT: ≥70% — gate cleared. Proceed to Stage 2b; consider prompt tuning toward 95%.');
else console.log('\nVERDICT: <70% — prompt iteration required before Stage 2b.');

console.log(`\n(tmp dir kept for inspection: ${tmpDir})`);
