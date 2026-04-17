#!/usr/bin/env node
/**
 * analyze-tutor-learner-asymmetry.js — M6 (v4 roadmap) adjudication.
 *
 * Question: The paper reports recognition d ≈ 1.85 on tutor rubric but
 * only d ≈ 0.16–0.25 on learner rubric, a 7–12× gap. The paper invokes
 * "synthetic-learner ceiling effect" without testing it.
 *
 * If the gap is a rubric-measurement artifact (parallel to the C4
 * paradox-closure), the *holistic* judge — which is not decomposed into
 * the rubric's content-weighted dimensions — should narrow the learner
 * gap more than the tutor gap. If the gap is a real role-level ceiling,
 * both metrics should show the same tutor>>learner pattern.
 *
 * The cleanest slice of the DB for this test is cells 80–87 (messages-
 * mode 2×2×2 factorial, rubric v2.2, all four metrics populated, three
 * judges). The recognition arm is cells 84–87; base arm is cells 80–83.
 *
 * Reports, per judge:
 *   - Recognition effect d on each of the four metrics
 *   - Tutor–learner d-gap on rubric and on holistic
 *   - Rubric↔holistic correlation within each role
 * Then reports the primary test: does (tutor_d − learner_d) shrink on
 * holistic vs rubric? Pooled over judges and per-judge.
 *
 * Usage:
 *   node scripts/analyze-tutor-learner-asymmetry.js
 *   node scripts/analyze-tutor-learner-asymmetry.js --out exports/m6-asymmetry.md
 *   node scripts/analyze-tutor-learner-asymmetry.js --judge claude-code/sonnet
 */

import Database from 'better-sqlite3';
import path from 'path';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'data', 'evaluations.db');

const args = process.argv.slice(2);
const getOption = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const outPath = getOption('out');
const judgeFilter = getOption('judge'); // optional filter to single judge

function mean(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
function variance(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
}
function std(arr) { return Math.sqrt(variance(arr)); }
function pearson(x, y) {
  if (x.length !== y.length || x.length < 3) return null;
  const mx = mean(x), my = mean(y), sx = std(x), sy = std(y);
  if (sx === 0 || sy === 0) return null;
  let s = 0;
  for (let i = 0; i < x.length; i++) s += (x[i] - mx) * (y[i] - my);
  return s / ((x.length - 1) * sx * sy);
}
function cohensD(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const vA = variance(a), vB = variance(b), nA = a.length, nB = b.length;
  const pooled = Math.sqrt(((nA - 1) * vA + (nB - 1) * vB) / (nA + nB - 2));
  return pooled === 0 ? null : (mean(a) - mean(b)) / pooled;
}
function r(v, d = 2) { return v == null || !Number.isFinite(v) ? '—' : v.toFixed(d); }

const METRICS = [
  { key: 'tutor_first_turn_score', label: 'tutor rubric', role: 'tutor', kind: 'rubric' },
  { key: 'tutor_holistic_overall_score', label: 'tutor holistic', role: 'tutor', kind: 'holistic' },
  { key: 'learner_overall_score', label: 'learner rubric', role: 'learner', kind: 'rubric' },
  { key: 'learner_holistic_overall_score', label: 'learner holistic', role: 'learner', kind: 'holistic' },
];

function classifyArm(profile) {
  // cells 80-83 = base; cells 84-87 = recog (messages-mode 2×2×2)
  const m = profile.match(/^cell_(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (n >= 80 && n <= 83) return 'base';
  if (n >= 84 && n <= 87) return 'recog';
  return null;
}

function analyze() {
  const db = new Database(DB_PATH, { readonly: true });
  const rows = db
    .prepare(
      `
      SELECT profile_name, judge_model,
             tutor_first_turn_score, tutor_holistic_overall_score,
             learner_overall_score, learner_holistic_overall_score
      FROM evaluation_results
      WHERE profile_name LIKE 'cell_8%'
        AND tutor_first_turn_score IS NOT NULL
        AND tutor_holistic_overall_score IS NOT NULL
        AND learner_overall_score IS NOT NULL
        AND learner_holistic_overall_score IS NOT NULL
        AND tutor_rubric_version = '2.2'
        AND learner_rubric_version = '2.2'
      `,
    )
    .all();
  db.close();

  const filtered = rows
    .map((r) => ({ ...r, arm: classifyArm(r.profile_name) }))
    .filter((r) => r.arm && (!judgeFilter || r.judge_model === judgeFilter));

  const judges = [...new Set(filtered.map((r) => r.judge_model))].sort();

  function recognitionEffect(subset) {
    const out = { arms: {}, effects: {} };
    out.arms.base = subset.filter((r) => r.arm === 'base');
    out.arms.recog = subset.filter((r) => r.arm === 'recog');
    for (const m of METRICS) {
      const b = out.arms.base.map((r) => r[m.key]).filter(Number.isFinite);
      const rg = out.arms.recog.map((r) => r[m.key]).filter(Number.isFinite);
      out.effects[m.key] = {
        n_base: b.length,
        n_recog: rg.length,
        mean_base: mean(b),
        mean_recog: mean(rg),
        sd_base: std(b),
        sd_recog: std(rg),
        d: cohensD(rg, b),
        delta: mean(rg) - mean(b),
      };
    }
    // Rubric↔holistic r within each role
    const tutorRubric = subset.map((r) => r.tutor_first_turn_score);
    const tutorHolistic = subset.map((r) => r.tutor_holistic_overall_score);
    const learnerRubric = subset.map((r) => r.learner_overall_score);
    const learnerHolistic = subset.map((r) => r.learner_holistic_overall_score);
    out.correlations = {
      tutor_r: pearson(tutorRubric, tutorHolistic),
      learner_r: pearson(learnerRubric, learnerHolistic),
    };
    out.n_total = subset.length;
    return out;
  }

  const byJudge = {};
  for (const j of judges) {
    byJudge[j] = recognitionEffect(filtered.filter((r) => r.judge_model === j));
  }
  const pooled = recognitionEffect(filtered);
  return { byJudge, pooled, judges };
}

function formatGapLine(effects) {
  const tr = effects.tutor_first_turn_score.d;
  const th = effects.tutor_holistic_overall_score.d;
  const lr = effects.learner_overall_score.d;
  const lh = effects.learner_holistic_overall_score.d;
  const gapRubric = tr != null && lr != null ? tr - lr : null;
  const gapHolistic = th != null && lh != null ? th - lh : null;
  const ratioRubric = lr != null && tr != null && tr !== 0 ? lr / tr : null;
  const ratioHolistic = lh != null && th != null && th !== 0 ? lh / th : null;
  return { tr, th, lr, lh, gapRubric, gapHolistic, ratioRubric, ratioHolistic };
}

function formatReport(results) {
  const { byJudge, pooled, judges } = results;
  const lines = [];
  lines.push('# M6 — Tutor–Learner Asymmetry: Rubric vs Holistic Adjudication');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('Scope: messages-mode 2×2×2 factorial cells 80–87, rubric v2.2, rows with all four metrics populated (tutor rubric, tutor holistic, learner rubric, learner holistic). Recognition arm = cells 84–87; base arm = cells 80–83.');
  lines.push('');
  lines.push('Recognition effect d computed as Cohen\'s d (recog − base, pooled SD). Rubric↔holistic Pearson r computed within each role on the paired subset.');
  lines.push('');

  // Pooled summary
  lines.push('## Pooled across judges');
  lines.push('');
  lines.push(`N total: ${pooled.n_total} (base ${pooled.arms.base.length}, recog ${pooled.arms.recog.length})`);
  lines.push('');
  lines.push('| Metric | N base | N recog | Mean base | Mean recog | Δ | d (recog − base) |');
  lines.push('|--------|--------|---------|-----------|------------|---|------------------|');
  for (const m of METRICS) {
    const e = pooled.effects[m.key];
    lines.push(`| ${m.label} | ${e.n_base} | ${e.n_recog} | ${r(e.mean_base)} | ${r(e.mean_recog)} | ${r(e.delta)} | ${r(e.d, 3)} |`);
  }
  lines.push('');
  lines.push(`Rubric↔holistic Pearson r within role (pooled): tutor ${r(pooled.correlations.tutor_r, 3)}, learner ${r(pooled.correlations.learner_r, 3)}.`);
  lines.push('');

  const gap = formatGapLine(pooled.effects);
  lines.push('### Primary test: does the tutor–learner d-gap shrink on holistic?');
  lines.push('');
  lines.push(`| Metric family | Tutor d | Learner d | Gap (t − l) | Learner/Tutor ratio |`);
  lines.push('|---------------|---------|-----------|-------------|---------------------|');
  lines.push(`| Rubric | ${r(gap.tr, 3)} | ${r(gap.lr, 3)} | ${r(gap.gapRubric, 3)} | ${r(gap.ratioRubric, 3)} |`);
  lines.push(`| Holistic | ${r(gap.th, 3)} | ${r(gap.lh, 3)} | ${r(gap.gapHolistic, 3)} | ${r(gap.ratioHolistic, 3)} |`);
  lines.push('');
  if (gap.gapRubric != null && gap.gapHolistic != null) {
    const shrinkage = ((gap.gapRubric - gap.gapHolistic) / gap.gapRubric) * 100;
    lines.push(`Tutor–learner d-gap on rubric: **${r(gap.gapRubric, 3)}**. On holistic: **${r(gap.gapHolistic, 3)}**. Shrinkage: **${r(shrinkage, 1)}%**.`);
    lines.push('');
  }

  // Per-judge breakdown
  lines.push('## Per-judge breakdown');
  lines.push('');
  for (const j of judges) {
    const b = byJudge[j];
    const g = formatGapLine(b.effects);
    lines.push(`### ${j}`);
    lines.push('');
    lines.push(`N total: ${b.n_total} (base ${b.arms.base.length}, recog ${b.arms.recog.length}). Rubric↔holistic r: tutor ${r(b.correlations.tutor_r, 3)}, learner ${r(b.correlations.learner_r, 3)}.`);
    lines.push('');
    lines.push('| Metric | Mean base | Mean recog | d (recog − base) |');
    lines.push('|--------|-----------|------------|------------------|');
    for (const m of METRICS) {
      const e = b.effects[m.key];
      lines.push(`| ${m.label} | ${r(e.mean_base)} | ${r(e.mean_recog)} | ${r(e.d, 3)} |`);
    }
    lines.push('');
    if (g.gapRubric != null && g.gapHolistic != null) {
      const shrinkage = ((g.gapRubric - g.gapHolistic) / g.gapRubric) * 100;
      lines.push(`Tutor–learner d-gap: rubric ${r(g.gapRubric, 3)}; holistic ${r(g.gapHolistic, 3)}; shrinkage ${r(shrinkage, 1)}%.`);
    }
    lines.push('');
  }

  // Interpretation
  lines.push('## Interpretation');
  lines.push('');
  if (gap.gapRubric != null && gap.gapHolistic != null) {
    const shrinkage = ((gap.gapRubric - gap.gapHolistic) / gap.gapRubric) * 100;
    const direction = shrinkage > 10 ? 'narrows substantially on holistic, consistent with the rubric-artifact account for M6\'s remaining piece' :
                      shrinkage < -10 ? 'widens on holistic, arguing against the rubric-artifact account' :
                      'is roughly stable across rubric and holistic, consistent with a genuine role-level difference rather than a rubric-artifact';
    lines.push(`The tutor–learner recognition-effect d-gap ${direction} (rubric ${r(gap.gapRubric, 3)} → holistic ${r(gap.gapHolistic, 3)}, shrinkage ${r(shrinkage, 1)}%).`);
    lines.push('');
  }
  lines.push('Additional checks worth running if the primary test is ambiguous:');
  lines.push('- Regress learner score on learner-message token length (is the effect absorbed by length?)');
  lines.push('- Check per-dimension learner rubric scores under recog vs base (which dimensions move, which don\'t?)');
  lines.push('- Same contrast on messages-mode cells 80–87 restricted to single-architecture (unified-only) to rule out architecture × recognition interaction confound.');
  lines.push('');

  return lines.join('\n');
}

function main() {
  const results = analyze();
  const report = formatReport(results);
  if (outPath) {
    writeFileSync(outPath, report);
    console.error(`Wrote ${report.split('\n').length} lines to ${outPath}`);
  } else {
    process.stdout.write(report + '\n');
  }
}

main();
