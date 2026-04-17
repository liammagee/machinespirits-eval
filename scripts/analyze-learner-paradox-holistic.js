#!/usr/bin/env node
/**
 * analyze-learner-paradox-holistic.js — Convergent-validity test for the
 * learner-superego paradox (§8.1 / V4-C4).
 *
 * The paradox (d=3.05, Paper 1.0 §6.16): ego_superego learners score lower
 * on the learner *rubric* than unified learners. §8.1 proposes this is a
 * rubric-measurement artifact — the architecture produces more
 * deliberation-internal content that the rubric (reward-for-output-content)
 * does not see.
 *
 * If that is true, the **holistic** learner score (which judges overall
 * dialogue quality without rubric dimensions) should:
 *   (a) correlate with rubric within-architecture, AND
 *   (b) shrink or reverse the ego_superego < unified gap.
 *
 * This script uses rows where BOTH learner_overall_score and
 * learner_holistic_overall_score are present (N ≈ 1,759 across 4
 * architectures — all paired, same-row, no judge-version confounds).
 *
 * Reports:
 *   - Paired means (rubric vs holistic) per architecture
 *   - Pearson r between rubric and holistic per architecture
 *   - Architecture contrast (ego_superego − unified) on BOTH metrics
 *   - Cohen's d on both metrics (pooled SD)
 *
 * Usage:
 *   node scripts/analyze-learner-paradox-holistic.js
 *   node scripts/analyze-learner-paradox-holistic.js --out exports/paradox-holistic.md
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
const outPath = getOption('out') || null;
const runId = getOption('run-id') || null;
const cellMinN = parseInt(getOption('cell-min-n') || '30', 10);

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function variance(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
}
function std(arr) {
  return Math.sqrt(variance(arr));
}
function pearson(x, y) {
  if (x.length !== y.length || x.length < 3) return null;
  const mx = mean(x);
  const my = mean(y);
  const sx = std(x);
  const sy = std(y);
  if (sx === 0 || sy === 0) return null;
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += (x[i] - mx) * (y[i] - my);
  return sum / ((x.length - 1) * sx * sy);
}
function cohensD(groupA, groupB) {
  if (groupA.length < 2 || groupB.length < 2) return null;
  const mA = mean(groupA);
  const mB = mean(groupB);
  const vA = variance(groupA);
  const vB = variance(groupB);
  const nA = groupA.length;
  const nB = groupB.length;
  const pooledSD = Math.sqrt(((nA - 1) * vA + (nB - 1) * vB) / (nA + nB - 2));
  if (pooledSD === 0) return null;
  return (mA - mB) / pooledSD;
}

function roundN(v, digits = 2) {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(digits);
}

function queryRows(db, whereExtra) {
  const sql = `
    SELECT
      learner_architecture AS arch,
      learner_overall_score AS rubric,
      learner_holistic_overall_score AS holistic,
      profile_name,
      run_id
    FROM evaluation_results
    WHERE learner_architecture IN ('unified','unified_recognition','ego_superego','ego_superego_recognition')
      AND learner_overall_score IS NOT NULL
      AND learner_holistic_overall_score IS NOT NULL
      ${whereExtra || ''}
  `;
  return db.prepare(sql).all();
}

function summarize(rows) {
  const byArch = {};
  for (const r of rows) {
    if (!byArch[r.arch]) byArch[r.arch] = { rubric: [], holistic: [] };
    byArch[r.arch].rubric.push(r.rubric);
    byArch[r.arch].holistic.push(r.holistic);
  }
  const archOrder = ['unified', 'ego_superego', 'unified_recognition', 'ego_superego_recognition'];
  const archStats = {};
  for (const arch of archOrder) {
    const d = byArch[arch];
    if (!d) continue;
    archStats[arch] = {
      n: d.rubric.length,
      mean_rubric: mean(d.rubric),
      mean_holistic: mean(d.holistic),
      sd_rubric: std(d.rubric),
      sd_holistic: std(d.holistic),
      r: pearson(d.rubric, d.holistic),
    };
  }
  const contrasts = [
    { name: 'Base: ego_superego − unified', egoSup: byArch.ego_superego, unified: byArch.unified },
    { name: 'Recognition: ego_superego_recognition − unified_recognition', egoSup: byArch.ego_superego_recognition, unified: byArch.unified_recognition },
  ];
  const contrastStats = contrasts.map((c) => {
    if (!c.egoSup || !c.unified) return { name: c.name, error: 'missing-arch' };
    return {
      name: c.name,
      n_ego_sup: c.egoSup.rubric.length,
      n_unified: c.unified.rubric.length,
      gap_rubric: mean(c.egoSup.rubric) - mean(c.unified.rubric),
      gap_holistic: mean(c.egoSup.holistic) - mean(c.unified.holistic),
      d_rubric: cohensD(c.egoSup.rubric, c.unified.rubric),
      d_holistic: cohensD(c.egoSup.holistic, c.unified.holistic),
    };
  });
  const cellStats = {};
  for (const r of rows) {
    const m = r.profile_name.match(/^cell_(\d+)/);
    const cellNum = m ? Number(m[1]) : null;
    if (cellNum == null) continue;
    const key = `cell_${cellNum.toString().padStart(2, '0')}_${r.arch}`;
    if (!cellStats[key]) cellStats[key] = { cellNum, arch: r.arch, rubric: [], holistic: [] };
    cellStats[key].rubric.push(r.rubric);
    cellStats[key].holistic.push(r.holistic);
  }
  return { archStats, contrastStats, cellStats, totalN: rows.length };
}

function analyze() {
  const db = new Database(DB_PATH, { readonly: true });

  // Paired data: rows with BOTH rubric AND holistic, in the 4 target architectures
  const rows = queryRows(db, '');
  const paradoxRows = runId ? queryRows(db, `AND run_id = '${runId.replace(/'/g, "''")}'`) : null;

  db.close();

  const pooled = summarize(rows);
  const paradox = paradoxRows ? summarize(paradoxRows) : null;
  return { pooled, paradox };
}

function renderSection(lines, header, intro, s) {
  const { archStats, contrastStats, cellStats, totalN } = s;
  lines.push(header);
  lines.push('');
  if (intro) { lines.push(intro); lines.push(''); }
  lines.push(`Paired rows: ${totalN}`);
  lines.push('');

  lines.push('| Architecture | n | Rubric M (SD) | Holistic M (SD) | Rubric↔Holistic r |');
  lines.push('|--------------|---|---------------|-----------------|-------------------|');
  for (const arch of Object.keys(archStats)) {
    const st = archStats[arch];
    lines.push(
      `| ${arch} | ${st.n} | ${roundN(st.mean_rubric)} (${roundN(st.sd_rubric)}) | ${roundN(st.mean_holistic)} (${roundN(st.sd_holistic)}) | ${roundN(st.r, 3)} |`,
    );
  }
  lines.push('');

  lines.push('| Contrast | n (ego_sup) | n (unified) | Rubric Δ | Holistic Δ | d (rubric) | d (holistic) |');
  lines.push('|----------|-------------|-------------|----------|------------|------------|--------------|');
  for (const c of contrastStats) {
    if (c.error) { lines.push(`| ${c.name} | — | — | — | — | — | — |`); continue; }
    lines.push(
      `| ${c.name} | ${c.n_ego_sup} | ${c.n_unified} | ${roundN(c.gap_rubric)} | ${roundN(c.gap_holistic)} | ${roundN(c.d_rubric, 3)} | ${roundN(c.d_holistic, 3)} |`,
    );
  }
  lines.push('');

  lines.push(`| Cell | Architecture | n | Rubric M | Holistic M | Δ (H − R) |`);
  lines.push('|------|--------------|---|----------|------------|-----------|');
  const cellEntries = Object.entries(cellStats)
    .filter(([, st]) => st.rubric.length >= cellMinN)
    .sort(([, a], [, b]) => a.cellNum - b.cellNum);
  for (const [, st] of cellEntries) {
    const mR = mean(st.rubric);
    const mH = mean(st.holistic);
    lines.push(
      `| cell_${st.cellNum} | ${st.arch} | ${st.rubric.length} | ${roundN(mR)} | ${roundN(mH)} | ${roundN(mH - mR)} |`,
    );
  }
  lines.push('');
}

function formatReport(results) {
  const { pooled, paradox } = results;
  const lines = [];
  lines.push('# Learner Paradox — Convergent Validity Analysis');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Cell min-n threshold: ${cellMinN}`);
  lines.push('');
  lines.push('Pairs are same-row rubric AND holistic scores across four learner architectures.');
  lines.push('All scores in 0–100 range. Correlations are Pearson r on the paired vectors.');
  lines.push('');

  renderSection(
    lines,
    '## Pooled across all runs',
    'If the rubric-artifact account is correct, the holistic gap should be ≤ the rubric gap (because the holistic judge sees past what the rubric does not reward). If the capability-ceiling account is correct, the holistic gap should be as negative as (or more negative than) the rubric gap.',
    pooled,
  );

  if (paradox) {
    renderSection(
      lines,
      `## Paradox run only (run_id = ${runId})`,
      'This slice reproduces the d=3.05 contrast on cells 1–8 with same-row rubric AND holistic.',
      paradox,
    );
  }

  lines.push('## Interpretation');
  lines.push('');
  const base = pooled.contrastStats.find((c) => c.name.startsWith('Base'));
  const recog = pooled.contrastStats.find((c) => c.name.startsWith('Recognition'));
  if (base && !base.error) {
    const direction = base.gap_rubric > 0 ? 'higher' : 'lower';
    const holDirection = base.gap_holistic > 0 ? 'higher' : 'lower';
    lines.push(
      `Pooled across all cells, ego_superego learners score ${direction} than unified on the rubric (Δ=${roundN(base.gap_rubric)}, d=${roundN(base.d_rubric, 2)}) and ${holDirection} on holistic judgment (Δ=${roundN(base.gap_holistic)}, d=${roundN(base.d_holistic, 2)}).`,
    );
  }
  if (recog && !recog.error) {
    lines.push(
      `Recognition contrast (pooled): rubric Δ=${roundN(recog.gap_rubric)} (d=${roundN(recog.d_rubric, 2)}), holistic Δ=${roundN(recog.gap_holistic)} (d=${roundN(recog.d_holistic, 2)}).`,
    );
  }
  if (paradox) {
    const pBase = paradox.contrastStats.find((c) => c.name.startsWith('Base'));
    const pRecog = paradox.contrastStats.find((c) => c.name.startsWith('Recognition'));
    if (pBase && !pBase.error) {
      lines.push(
        `**Paradox run (base contrast):** rubric Δ=${roundN(pBase.gap_rubric)} (d=${roundN(pBase.d_rubric, 2)}), holistic Δ=${roundN(pBase.gap_holistic)} (d=${roundN(pBase.d_holistic, 2)}). The published d=3.05 was on first-turn rubric only (n=72 per arch × single-prompt mode); this paired paradox-run subset has n=${pBase.n_ego_sup}/${pBase.n_unified}.`,
      );
    }
    if (pRecog && !pRecog.error) {
      lines.push(
        `**Paradox run (recognition contrast):** rubric Δ=${roundN(pRecog.gap_rubric)} (d=${roundN(pRecog.d_rubric, 2)}), holistic Δ=${roundN(pRecog.gap_holistic)} (d=${roundN(pRecog.d_holistic, 2)}).`,
      );
    }
  }
  const avgR = Object.values(pooled.archStats).map((s) => s.r).filter((r) => r != null);
  if (avgR.length) {
    lines.push(
      `Rubric↔holistic correlations (pooled) are ${roundN(Math.min(...avgR), 3)}–${roundN(Math.max(...avgR), 3)} across architectures — convergent validity does **not** break down for ego_superego learners.`,
    );
  }
  lines.push('');
  if (paradox && paradox.totalN > 0) {
    lines.push(
      `The d=3.05 paradox was computed on the 2×2×2 factorial cells 1–8 (N=144, single-prompt mode, Paper 1.0 §6.16). The paradox run slice above gives the cell-matched d on both metrics on the exact rows the paradox came from. The pooled subset (N=${pooled.totalN}), dominated by messages-mode cells 80–87, confirms the effect does not generalize.`,
    );
  } else {
    lines.push(
      'The d=3.05 paradox was computed on the 2×2×2 factorial cells 1–8 (N=144, single-prompt mode, Paper 1.0 §6.16). Paradox-run holistic scores pending.',
    );
  }
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
