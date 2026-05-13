#!/usr/bin/env node
// Real-LLM smoke for cell_126 evidence-bound chain (A14 Stage 2a + 2b).
//
// Runs cell_126_state_policy_evidence_bound on a filterable subset of the
// adaptive trap suite with ADAPTIVE_TUTOR_LLM=real, then reads the persisted
// trace files and reports two complementary calibration metrics:
//
//   (Stage 2a)  Verifiable-quote rate: (validated entries) / (total entries)
//               from finalEvidenceLog. The substring-match gate filters
//               fabricated quotes; rate measures how often the extractor
//               needs the gate to fire.
//
//   (Stage 2b)  Grounded-hypothesis rate: (hypotheses with non-empty
//               supporting_evidence) / (total hypotheses). The node already
//               filters out hallucinated obs_id refs at synthesis time, so
//               this rate measures whether the model actually cites the
//               ledger rather than emitting empty-supported claims that the
//               filter then strips down to nothing useful.
//
// Gate thresholds (TODO.md §A14):
//   Stage 2a  ≥70% / ≥95%   (verifiable-quote rate)
//   Stage 2b  ≥70%          (grounded-hypothesis rate — Stage-2-internal
//                            check; Stage 3 will gate on retention behavior
//                            against the groundingValidator)
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

  // Hypothesis-side aggregation. finalHypotheses already reflects the
  // merge-by-id reducer's last-write-wins state, so duplicate-id counts
  // can't be measured from terminal state alone — that requires per-turn
  // snapshots which extractTurnTrace doesn't capture today. What WE can
  // measure: how many synthesised hypotheses cite the ledger (grounded
  // rate), claim-length distribution (proxy for "not a single-token
  // hallucination"), status distribution, and created_at_turn spread
  // (cheap proxy for "first creation vs revision survived").
  const origHyp = Array.isArray(trace.original?.finalHypotheses) ? trace.original.finalHypotheses : [];
  const cfHyp = Array.isArray(trace.counterfactual?.finalHypotheses) ? trace.counterfactual.finalHypotheses : [];
  const allHyp = [...origHyp, ...cfHyp];
  const grounded = allHyp.filter((h) => Array.isArray(h.supporting_evidence) && h.supporting_evidence.length > 0).length;
  const groundedRate = allHyp.length > 0 ? grounded / allHyp.length : null;
  const claimLens = allHyp.map((h) => (h.claim || '').length);
  const statusDist = allHyp.reduce((acc, h) => { acc[h.status || 'tentative'] = (acc[h.status || 'tentative'] || 0) + 1; return acc; }, {});
  const createdAtTurns = allHyp.map((h) => h.created_at_turn).filter((t) => typeof t === 'number');

  perScenario.push({
    scenarioId: sid,
    total, validated, rate, byTurn,
    hyp: {
      count: allHyp.length,
      grounded,
      groundedRate,
      avgClaimLen: claimLens.length > 0 ? claimLens.reduce((a, b) => a + b, 0) / claimLens.length : 0,
      minClaimLen: claimLens.length > 0 ? Math.min(...claimLens) : 0,
      statusDist,
      createdAtTurns,
      sampleClaim: allHyp[0]?.claim?.slice(0, 80) || '(none)',
    },
  });
}

console.log('\n--- per-scenario extractor (Stage 2a) stats ---');
for (const s of perScenario) {
  const pct = s.rate == null ? 'n/a' : `${(s.rate * 100).toFixed(1)}%`;
  console.log(`  ${s.scenarioId.padEnd(40)} validated=${s.validated}/${s.total}  rate=${pct}`);
  for (const t of s.byTurn) {
    console.log(`    turn ${t.turn}: ${t.validated}/${t.total} validated`);
  }
}

console.log('\n--- per-scenario hypothesisUpdater (Stage 2b) stats ---');
for (const s of perScenario) {
  const h = s.hyp;
  const gPct = h.groundedRate == null ? 'n/a' : `${(h.groundedRate * 100).toFixed(1)}%`;
  const turnsStr = h.createdAtTurns.length > 0 ? `[${h.createdAtTurns.join(',')}]` : '[]';
  const statusStr = Object.entries(h.statusDist).map(([k, v]) => `${k}=${v}`).join(' ');
  console.log(`  ${s.scenarioId.padEnd(40)} hyp=${h.count}  grounded=${h.grounded}/${h.count} (${gPct})  avgClaimLen=${h.avgClaimLen.toFixed(0)}`);
  console.log(`    created_at_turns: ${turnsStr}  status: ${statusStr || '(none)'}`);
  console.log(`    sample: "${h.sampleClaim}"`);
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

console.log('\n--- Stage 2a aggregate (verifiable-quote rate) ---');
console.log(`  total entries:      ${totalAll}`);
console.log(`  validated entries:  ${valAll}`);
console.log(`  aggregate rate:     ${aggPct}%`);
console.log('  threshold (gate):   70.0%  (Stage 2a → 2b)');
console.log('  threshold (target): 95.0%  (calibration target)');

if (aggRate >= 0.95) console.log('  VERDICT: ≥95% — extractor well-calibrated.');
else if (aggRate >= 0.7) console.log('  VERDICT: ≥70% — gate cleared; consider prompt tuning toward 95%.');
else console.log('  VERDICT: <70% — extractor prompt iteration required.');

// Stage 2b aggregate: grounded-hypothesis rate. Per-scenario hypotheses
// are merged into the same metric — what fraction of all final hypotheses
// across all scenarios carry at least one supporting obs_id ref. A grounded
// rate of 100% means the model always cited the ledger (or the node's
// filter removed orphan refs without leaving the hypothesis with empty
// support — same outcome from the consumer's perspective).
const allHypAll = perScenario.reduce((sum, s) => sum + s.hyp.count, 0);
const groundedAll = perScenario.reduce((sum, s) => sum + s.hyp.grounded, 0);
if (allHypAll === 0) {
  console.log('\n--- Stage 2b aggregate (grounded-hypothesis rate) ---');
  console.log('  no hypotheses synthesised across any scenario.');
  console.log('  Possible causes: updater prompt is too conservative (always emits []),');
  console.log('  or no validated evidence was passed in to anchor a hypothesis.');
} else {
  const gAggRate = groundedAll / allHypAll;
  const gAggPct = (gAggRate * 100).toFixed(1);
  console.log('\n--- Stage 2b aggregate (grounded-hypothesis rate) ---');
  console.log(`  total hypotheses:   ${allHypAll}`);
  console.log(`  grounded:           ${groundedAll}`);
  console.log(`  aggregate rate:     ${gAggPct}%`);
  console.log('  threshold (soft):   70.0%  (Stage-2-internal; Stage 3 will gate on retention against groundingValidator)');
  if (gAggRate >= 0.95) console.log('  VERDICT: ≥95% — updater consistently cites the ledger.');
  else if (gAggRate >= 0.7) console.log('  VERDICT: ≥70% — soft gate cleared.');
  else console.log('  VERDICT: <70% — updater prompt iteration recommended.');
}

console.log(`\n(tmp dir kept for inspection: ${tmpDir})`);
