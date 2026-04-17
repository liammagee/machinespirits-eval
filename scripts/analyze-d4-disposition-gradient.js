#!/usr/bin/env node
/**
 * analyze-d4-disposition-gradient.js — D4 disposition-gradient replication.
 *
 * The paper's Prediction 3 (§3.4) documents a disposition gradient on
 * philosophy: hostile superegos (suspicious) benefit most from recognition,
 * cooperative superegos (advocate) benefit least. Recognition theory predicts
 * this because recognition emerges from *struggle*, not agreement.
 *
 * D4 tests whether the gradient replicates on a second domain (SEL) under
 * matched generation × judge.
 *
 * Philosophy baselines (existing DB rows):
 *   - Cells 40-45 (dialectical ego + divergent superego, Haiku × Opus):
 *       susp Δ=+9.8, adv Δ=+7.0, advocate Δ=+5.7
 *   - Cells 22-27 (standard ego + divergent superego, Haiku × Opus):
 *       computed at analysis time (smaller N)
 *
 * D4 SEL run (cells 22-27, Haiku × Sonnet): passed in at runtime.
 *
 * Usage:
 *   node scripts/analyze-d4-disposition-gradient.js <runId>
 *   node scripts/analyze-d4-disposition-gradient.js <runId> --out exports/d4-disposition.md
 */

import Database from 'better-sqlite3';
import path from 'path';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'evaluations.db');

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const runId = positional[0];
if (!runId) {
  console.error('Usage: node scripts/analyze-d4-disposition-gradient.js <runId> [--out path.md]');
  process.exit(1);
}
const getOption = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const outPath = getOption('out');

function mean(a) { return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0; }
function variance(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1);
}
function std(a) { return Math.sqrt(variance(a)); }
function cohensD(recog, base) {
  if (recog.length < 2 || base.length < 2) return null;
  const vR = variance(recog), vB = variance(base), nR = recog.length, nB = base.length;
  const pooled = Math.sqrt(((nR - 1) * vR + (nB - 1) * vB) / (nR + nB - 2));
  return pooled === 0 ? null : (mean(recog) - mean(base)) / pooled;
}
function r(v, d = 2) { return v == null || !Number.isFinite(v) ? '—' : v.toFixed(d); }

function queryScores(db, { runIds = null, profilePatterns, judge }) {
  const patternClause = profilePatterns.map(() => 'profile_name LIKE ?').join(' OR ');
  const params = [...profilePatterns];
  let sql = `SELECT profile_name, tutor_first_turn_score AS score
             FROM evaluation_results
             WHERE (${patternClause}) AND judge_model = ? AND tutor_first_turn_score IS NOT NULL`;
  params.push(judge);
  if (runIds && runIds.length) {
    sql += ` AND run_id IN (${runIds.map(() => '?').join(',')})`;
    params.push(...runIds);
  }
  return db.prepare(sql).all(...params);
}

function summarizeDisposition(rows, disposition) {
  const baseKey = `base_${disposition}`;
  const recogKey = `recog_${disposition}`;
  const base = rows.filter((r) => r.profile_name.includes(baseKey)).map((r) => r.score);
  const recog = rows.filter((r) => r.profile_name.includes(recogKey)).map((r) => r.score);
  return {
    disposition,
    nBase: base.length,
    nRecog: recog.length,
    meanBase: mean(base),
    meanRecog: mean(recog),
    sdBase: std(base),
    sdRecog: std(recog),
    delta: mean(recog) - mean(base),
    d: cohensD(recog, base),
  };
}

function gradientTable(summary) {
  const order = ['suspicious', 'adversary', 'advocate'];
  return order.map((disp) => summary.find((s) => s.disposition === disp)).filter(Boolean);
}

function renderTable(rows, label) {
  const lines = [];
  lines.push(`### ${label}`);
  lines.push('');
  lines.push('| Disposition | N base / recog | Mean base (SD) | Mean recog (SD) | Δ | d (recog − base) |');
  lines.push('|-------------|----------------|----------------|-----------------|---|------------------|');
  for (const s of rows) {
    lines.push(
      `| ${s.disposition} | ${s.nBase} / ${s.nRecog} | ${r(s.meanBase, 1)} (${r(s.sdBase, 1)}) | ${r(s.meanRecog, 1)} (${r(s.sdRecog, 1)}) | ${r(s.delta, 1)} | **${r(s.d, 2)}** |`,
    );
  }
  lines.push('');
  return lines;
}

function main() {
  const db = new Database(DB_PATH, { readonly: true });

  // D4 SEL run (Haiku 4.5 × Sonnet 4.6, cells 22-27)
  const selRows = queryScores(db, {
    runIds: [runId],
    profilePatterns: ['cell_22_%', 'cell_23_%', 'cell_24_%', 'cell_25_%', 'cell_26_%', 'cell_27_%'],
    judge: 'claude-code/sonnet',
  });
  const selSummary = [
    summarizeDisposition(selRows, 'suspicious'),
    summarizeDisposition(selRows, 'adversary'),
    summarizeDisposition(selRows, 'advocate'),
  ];

  // Philosophy baseline: cells 22-27 under Haiku × Opus (closest matched cell choice)
  const phil22Rows = queryScores(db, {
    profilePatterns: ['cell_22_%', 'cell_23_%', 'cell_24_%', 'cell_25_%', 'cell_26_%', 'cell_27_%'],
    judge: 'claude-opus-4.6',
  });
  const phil22Summary = [
    summarizeDisposition(phil22Rows, 'suspicious'),
    summarizeDisposition(phil22Rows, 'adversary'),
    summarizeDisposition(phil22Rows, 'advocate'),
  ];

  // Philosophy: cells 40-45 (dialectical, cited in paper §3.4 Prediction 3)
  // Filter to Haiku-generated rows under Opus 4.6 judge. The model column
  // uses the `openrouter.anthropic/claude-haiku-4.5` form in the DB; use LIKE.
  const phil40HaikuRows = db
    .prepare(
      `SELECT profile_name, tutor_first_turn_score AS score
       FROM evaluation_results
       WHERE (profile_name LIKE 'cell_40_%' OR profile_name LIKE 'cell_41_%'
           OR profile_name LIKE 'cell_42_%' OR profile_name LIKE 'cell_43_%'
           OR profile_name LIKE 'cell_44_%' OR profile_name LIKE 'cell_45_%')
         AND judge_model = 'claude-opus-4.6'
         AND model LIKE '%claude-haiku-4.5%'
         AND tutor_first_turn_score IS NOT NULL`,
    )
    .all();
  // Cells 40-45 profile names are like `cell_40_base_dialectical_suspicious_unified_superego`,
  // so match on the ending disposition token rather than the `base_${disp}` prefix used for 22-27.
  function summarizeDialectical(rows, disposition) {
    const base = rows
      .filter((r) => r.profile_name.includes('_base_') && r.profile_name.includes(`_${disposition}_`))
      .map((r) => r.score);
    const recog = rows
      .filter((r) => r.profile_name.includes('_recog_') && r.profile_name.includes(`_${disposition}_`))
      .map((r) => r.score);
    return {
      disposition,
      nBase: base.length,
      nRecog: recog.length,
      meanBase: mean(base),
      meanRecog: mean(recog),
      sdBase: std(base),
      sdRecog: std(recog),
      delta: mean(recog) - mean(base),
      d: cohensD(recog, base),
    };
  }
  const phil40Summary = [
    summarizeDialectical(phil40HaikuRows, 'suspicious'),
    summarizeDialectical(phil40HaikuRows, 'adversary'),
    summarizeDialectical(phil40HaikuRows, 'advocate'),
  ];

  db.close();

  const lines = [];
  lines.push('# D4 — Disposition Gradient Replication on SEL');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`D4 run ID: ${runId}`);
  lines.push('');
  lines.push('Tests whether the disposition gradient documented on philosophy (hostile > moderate > cooperative superegos benefit from recognition in that order) replicates on social-emotional learning (SEL). Paper §3.4 Prediction 3 cites cells 40-45 on philosophy with gradient susp > adv > advocate.');
  lines.push('');

  lines.push('## Primary result: D4 SEL (cells 22-27, Haiku 4.5 × Sonnet 4.6)');
  lines.push('');
  lines.push(...renderTable(gradientTable(selSummary), 'SEL'));

  const selGradient = gradientTable(selSummary);
  const gradientDir = (selGradient[0]?.delta ?? 0) > (selGradient[1]?.delta ?? 0)
    && (selGradient[1]?.delta ?? 0) > (selGradient[2]?.delta ?? 0);
  lines.push(`Gradient direction on SEL: susp Δ=${r(selGradient[0]?.delta, 1)} ${gradientDir ? '>' : 'vs'} adv Δ=${r(selGradient[1]?.delta, 1)} ${gradientDir ? '>' : 'vs'} advocate Δ=${r(selGradient[2]?.delta, 1)}. ${gradientDir ? '**Predicted gradient reproduces on SEL.**' : '**Predicted gradient does NOT reproduce.**'}`);
  lines.push('');

  lines.push('## Philosophy baselines');
  lines.push('');
  lines.push('Two existing-DB baselines for comparison. Both are Opus 4.6-judged (the D4 SEL run is Sonnet 4.6-judged, so judge-model differs — flagged as confound below).');
  lines.push('');
  lines.push(...renderTable(gradientTable(phil22Summary), 'Philosophy, cells 22-27 (standard ego + divergent superego, Haiku × Opus) — matched cells'));
  lines.push(...renderTable(gradientTable(phil40Summary), 'Philosophy, cells 40-45 (dialectical ego + divergent superego, Haiku × Opus) — paper-cited gradient'));

  lines.push('## Comparison');
  lines.push('');
  lines.push('| Domain | Cells | Generator | Judge | susp Δ | adv Δ | advocate Δ | Gradient |');
  lines.push('|--------|-------|-----------|-------|--------|-------|------------|----------|');
  const phil22G = gradientTable(phil22Summary);
  const phil40G = gradientTable(phil40Summary);
  const sign = (a, b, c) => `${r(a, 1)} ${a > b ? '>' : '<'} ${r(b, 1)} ${b > c ? '>' : '<'} ${r(c, 1)}`;
  lines.push(`| **SEL (D4)** | 22-27 | Haiku 4.5 | Sonnet 4.6 | ${r(selGradient[0].delta, 1)} | ${r(selGradient[1].delta, 1)} | ${r(selGradient[2].delta, 1)} | ${sign(selGradient[0].delta, selGradient[1].delta, selGradient[2].delta)} |`);
  if (phil22G[0]?.nBase) {
    lines.push(`| Philosophy | 22-27 | Haiku 4.5 | Opus 4.6 | ${r(phil22G[0].delta, 1)} | ${r(phil22G[1].delta, 1)} | ${r(phil22G[2].delta, 1)} | ${sign(phil22G[0].delta, phil22G[1].delta, phil22G[2].delta)} |`);
  }
  if (phil40G[0]?.nBase) {
    lines.push(`| Philosophy | 40-45 | Haiku 4.5 | Opus 4.6 | ${r(phil40G[0].delta, 1)} | ${r(phil40G[1].delta, 1)} | ${r(phil40G[2].delta, 1)} | ${sign(phil40G[0].delta, phil40G[1].delta, phil40G[2].delta)} |`);
  }
  lines.push('');

  lines.push('## Interpretation');
  lines.push('');
  if (gradientDir) {
    lines.push('The disposition gradient **replicates directionally on SEL**: hostile superegos (suspicious) benefit most from recognition, cooperative superegos (advocate) least. This is the pattern Prediction 3 derives from recognition theory: recognition emerges from *struggle*, so the dispositions that create the most struggle (suspicious, adversary) have the most room for recognition to operate. The replication supports the theoretical framing as domain-general rather than philosophy-specific.');
  } else {
    lines.push('The disposition gradient **does NOT replicate directionally on SEL**. This would suggest that Prediction 3 (recognition emerges from struggle) is philosophy-specific and does not generalize to SEL. Interpretation requires care — single replication does not foreclose the effect, but it does bound domain-general claims.');
  }
  lines.push('');

  lines.push('## Confounds and caveats');
  lines.push('');
  lines.push('- **Judge-model differs**: D4 SEL uses Sonnet 4.6; philosophy baselines are Opus 4.6. Sonnet and Opus produce different absolute magnitudes (see §6.4 cross-judge validation). Direction-of-gradient should replicate across judges, but Δ magnitudes are not directly comparable. A matched-judge replication would rejudge either side.');
  lines.push('- **Cells 22-27 vs 40-45**: D4 uses standard ego + divergent superego (cells 22-27); the paper-cited gradient uses dialectical ego + divergent superego (cells 40-45). The two contrasts differ in ego architecture; the gradient is expected to replicate in both under the same theoretical account, but the precise magnitudes will differ.');
  lines.push('- **Single-domain replication**: this extends the gradient from 1 to 2 domains. A cross-application generalization claim would require additional domains.');
  lines.push('- **Learner-side test deferred**: the D4 scope also includes testing whether recognition rescues hostile learner-side superegos. This requires new cells (learner-side disposition variants) and is out of scope for the current pass.');
  lines.push('');

  const report = lines.join('\n');
  if (outPath) {
    writeFileSync(outPath, report);
    console.error(`Wrote ${report.split('\n').length} lines to ${outPath}`);
  } else {
    process.stdout.write(report + '\n');
  }
}

main();
