#!/usr/bin/env node
/**
 * analyze-domain-generalization.js — V4-C3/A6 adjudication.
 *
 * Tests whether the recognition main effect replicates on non-philosophy
 * content. Generation model and judge model are held constant (Haiku 4.5
 * generation, Sonnet 4.6 judge) across all domains; conversation mode
 * differs between the programming contrast (single-prompt, cells 1/5) and
 * the philosophy contrast (messages, cells 80/84). Mode is flagged as a
 * known confound for the direct domain × recognition interaction test.
 *
 * Domains:
 *   - Programming (eval-2026-04-17-c92ad6c7, cells 1/5)
 *   - Elementary math (eval-2026-04-17-fde764e1 + eval-2026-04-17-7915be04)
 *   - Creative writing (eval-2026-04-17-428f0649 + eval-2026-04-17-93ba2f9a)
 *   - Social-emotional learning (eval-2026-04-17-44fa989c + eval-2026-04-17-5833830a)
 *   - Philosophy (Paper 2.0 Haiku, messages-mode cells 80/84,
 *     eval-2026-03-02-45163390)
 *
 * Usage:
 *   node scripts/analyze-domain-generalization.js
 *   node scripts/analyze-domain-generalization.js --out exports/a6-domain-generalization.md
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

function mean(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
function variance(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
}
function std(arr) { return Math.sqrt(variance(arr)); }
function cohensD(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const vA = variance(a), vB = variance(b), nA = a.length, nB = b.length;
  const pooled = Math.sqrt(((nA - 1) * vA + (nB - 1) * vB) / (nA + nB - 2));
  return pooled === 0 ? null : (mean(a) - mean(b)) / pooled;
}
function r(v, d = 2) { return v == null || !Number.isFinite(v) ? '—' : v.toFixed(d); }

function queryScores(db, runIds, profile, judge) {
  const ids = Array.isArray(runIds) ? runIds : [runIds];
  const placeholders = ids.map(() => '?').join(',');
  return db
    .prepare(
      `SELECT tutor_first_turn_score
       FROM evaluation_results
       WHERE run_id IN (${placeholders}) AND profile_name = ? AND judge_model = ?
         AND tutor_first_turn_score IS NOT NULL`,
    )
    .all(...ids, profile, judge)
    .map((row) => row.tutor_first_turn_score);
}

function summarizeContrast(label, base, recog) {
  return {
    label,
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

function magnitudeLabel(d) {
  if (d == null) return 'unavailable';
  if (d > 1.3) return 'very large';
  if (d > 0.8) return 'large';
  if (d > 0.5) return 'moderate';
  if (d > 0.2) return 'small';
  return 'negligible';
}

const JUDGE = 'claude-code/sonnet';

const DOMAINS = [
  {
    label: 'Programming (cells 1/5, single-prompt mode)',
    runIds: ['eval-2026-04-17-c92ad6c7'],
    baseCell: 'cell_1_base_single_unified',
    recogCell: 'cell_5_recog_single_unified',
    mode: 'single-prompt',
  },
  {
    label: 'Elementary math (cells 1/5, single-prompt mode)',
    runIds: ['eval-2026-04-17-fde764e1', 'eval-2026-04-17-7915be04'],
    baseCell: 'cell_1_base_single_unified',
    recogCell: 'cell_5_recog_single_unified',
    mode: 'single-prompt',
  },
  {
    label: 'Creative writing (cells 1/5, single-prompt mode)',
    runIds: ['eval-2026-04-17-428f0649', 'eval-2026-04-17-93ba2f9a'],
    baseCell: 'cell_1_base_single_unified',
    recogCell: 'cell_5_recog_single_unified',
    mode: 'single-prompt',
  },
  {
    label: 'Social-emotional learning (cells 1/5, single-prompt mode)',
    runIds: ['eval-2026-04-17-44fa989c', 'eval-2026-04-17-5833830a'],
    baseCell: 'cell_1_base_single_unified',
    recogCell: 'cell_5_recog_single_unified',
    mode: 'single-prompt',
  },
  {
    label: 'Philosophy (cells 80/84, messages mode)',
    runIds: ['eval-2026-03-02-45163390'],
    baseCell: 'cell_80_messages_base_single_unified',
    recogCell: 'cell_84_messages_recog_single_unified',
    mode: 'messages',
  },
];

function main() {
  const db = new Database(DB_PATH, { readonly: true });

  const contrasts = DOMAINS.map((dom) => {
    const base = queryScores(db, dom.runIds, dom.baseCell, JUDGE);
    const recog = queryScores(db, dom.runIds, dom.recogCell, JUDGE);
    return { ...summarizeContrast(dom.label, base, recog), mode: dom.mode };
  });

  db.close();

  const phil = contrasts.find((c) => c.label.startsWith('Philosophy'));
  const nonPhil = contrasts.filter((c) => !c.label.startsWith('Philosophy'));

  const lines = [];
  lines.push('# A6 — Domain Generalization: Multi-Domain Recognition Replication');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('All contrasts use Haiku 4.5 generation and Sonnet 4.6 judge. Domain varies across five content packages. Conversation mode is single-prompt for the four non-philosophy contrasts and messages for the philosophy contrast (a known confound).');
  lines.push('');
  lines.push('## Recognition main effect by domain');
  lines.push('');
  lines.push('| Domain | N base | N recog | Mean base (SD) | Mean recog (SD) | Δ | d (recog − base) |');
  lines.push('|--------|--------|---------|----------------|-----------------|---|------------------|');
  for (const c of contrasts) {
    lines.push(
      `| ${c.label} | ${c.nBase} | ${c.nRecog} | ${r(c.meanBase)} (${r(c.sdBase)}) | ${r(c.meanRecog)} (${r(c.sdRecog)}) | ${r(c.delta)} | **${r(c.d, 2)}** |`,
    );
  }
  lines.push('');

  lines.push('## Magnitude and direction summary');
  lines.push('');
  const dList = contrasts.map((c) => c.d).filter((v) => v != null);
  const allPositive = dList.every((d) => d > 0);
  const minD = Math.min(...dList);
  const maxD = Math.max(...dList);
  lines.push(`- Direction: ${allPositive ? 'all ' + dList.length + ' domains show recognition > base' : 'NOT unanimous — see table'}.`);
  lines.push(`- Magnitude range across domains: d = ${r(minD, 2)} – ${r(maxD, 2)}.`);
  lines.push(`- All domains classified as: ${[...new Set(contrasts.map((c) => magnitudeLabel(c.d)))].join(', ')}.`);
  lines.push('');

  lines.push('## Domain × recognition interaction (vs philosophy anchor)');
  lines.push('');
  if (phil && phil.d != null) {
    lines.push(`Philosophy anchor: d = **${r(phil.d, 2)}** (mode: ${phil.mode}).`);
    lines.push('');
    lines.push('| Non-philosophy domain | d | Δd vs philosophy | Interpretation |');
    lines.push('|-----------------------|---|------------------|----------------|');
    for (const c of nonPhil) {
      const delta = c.d != null ? c.d - phil.d : null;
      const absD = delta != null ? Math.abs(delta) : null;
      const interp = absD == null
        ? '—'
        : absD < 0.3
          ? 'small interaction'
          : absD < 0.6
            ? 'moderate interaction'
            : 'large interaction';
      lines.push(`| ${c.label.split(' (')[0]} | ${r(c.d, 2)} | ${r(delta, 2)} | ${interp} |`);
    }
    lines.push('');
    lines.push('Conversation mode differs between the non-philosophy contrasts (single-prompt) and the philosophy anchor (messages). The Δd values therefore conflate domain effects with a known mode effect (§6.3, §6.5).');
    lines.push('');
  }

  lines.push('## Interpretation');
  lines.push('');
  if (allPositive) {
    lines.push(`Recognition produces a positive effect on tutor quality in all ${contrasts.length} tested domains under matched Haiku × Sonnet generation × judge. Effect magnitudes span ${r(minD, 2)}–${r(maxD, 2)}, all within the "${magnitudeLabel(minD)}" to "${magnitudeLabel(maxD)}" range under Cohen's conventions.`);
    lines.push('');
    lines.push('The A6 question --- whether the recognition mechanism generalizes across content domains --- answers **yes on the directional criterion** across philosophy, programming, elementary math, creative writing, and social-emotional learning. The mechanism language in §6.1 / §6.2 is defensible across this five-domain range. Quantitative comparison across domains is constrained by the mode confound (single-prompt vs messages) and by scenario-count / scenario-type differences.');
    lines.push('');
  } else {
    lines.push('Recognition does NOT replicate in direction across all tested domains. This would require retraction of the "mechanism" language for affected domains.');
    lines.push('');
  }

  lines.push('## Confounds and caveats');
  lines.push('');
  lines.push('- **Conversation mode**: the four non-philosophy contrasts use single-prompt-mode cells (1, 5); the philosophy anchor uses messages-mode cells (80, 84). Mode is a known moderator of effect magnitude.');
  lines.push('- **Scenario counts and types**: each non-philosophy domain is 5 single-turn scenarios (4 core + 1 mood), 3 runs, $n = 15$ per cell; philosophy is 9 messages-mode scenarios × 2 runs, $n = 18$ per cell. Scenario content is domain-specific and not pairwise-matched across domains.');
  lines.push('- **Same generation model and judge**: Haiku 4.5 generation, Sonnet 4.6 judge, held constant across all five contrasts.');
  lines.push('- **Cross-judge validation**: the philosophy row replicates across Sonnet 4.6, Gemini 3.1 Pro, and GPT-5.4 (§6.4). Cross-judge validation on the four new domains was not run for this closure.');
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
