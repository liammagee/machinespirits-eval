#!/usr/bin/env node

/**
 * Insight-Action Gap Analysis (TODO §D3, Paper 2.0 Finding 11)
 *
 * Operationalizes "self-reflection produces awareness without behavioral change."
 * For dialogues that include explicit ego/superego self-reflection traces
 * (cells with `self_reflection_evolution_enabled`), this script measures:
 *
 *   coupling = lexical similarity between the reflection text at turn N
 *              and the actual tutor message at turn N+1
 *   gap      = 1 − coupling
 *
 * High coupling → reflection's themes resurface in next-turn behavior (insight
 * translates into action). Low coupling → reflection stays cognitive while
 * behavior continues unchanged (the gap).
 *
 * As a baseline, the script also computes turn-to-turn message drift on the
 * same cells, so the gap can be interpreted alongside how much the tutor
 * changes its message between turns at all.
 *
 * Pure computation on existing dialogue logs — no LLM calls.
 *
 * Usage:
 *   node scripts/analyze-insight-action-gap.js <runId> [<runId>...] [--json] [--output PATH]
 *
 * Options:
 *   --json           Also emit JSON next to the markdown report
 *   --output PATH    Override default exports/insight-action-gap-<runId>.md
 *   --min-pairs N    Skip cells with fewer than N reflection-action pairs (default 5)
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as evaluationStore from '../services/evaluationStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', 'data', 'evaluations.db');

// ── CLI ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { runIds: [], json: false, output: null, minPairs: 5 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--min-pairs') args.minPairs = parseInt(argv[++i], 10);
    else if (!a.startsWith('--')) args.runIds.push(a);
  }
  return args;
}

// ── Text similarity ─────────────────────────────────────────────────────

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')        // strip XML-like tags from reflection bodies
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);     // drop short stopwords; keeps content terms
}

function jaccard(a, b) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (A.size === 0 || B.size === 0) return 0;
  let intersect = 0;
  for (const t of A) if (B.has(t)) intersect++;
  return intersect / (A.size + B.size - intersect);
}

function cosine(a, b) {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const fa = {};
  const fb = {};
  for (const t of ta) fa[t] = (fa[t] || 0) + 1;
  for (const t of tb) fb[t] = (fb[t] || 0) + 1;
  let dot = 0;
  let mA = 0;
  let mB = 0;
  const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]);
  for (const k of keys) {
    const va = fa[k] || 0;
    const vb = fb[k] || 0;
    dot += va * vb;
    mA += va * va;
    mB += vb * vb;
  }
  return dot / (Math.sqrt(mA) * Math.sqrt(mB) || 1);
}

// ── Stats ───────────────────────────────────────────────────────────────

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function sd(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

// D1 cross-pollination: per-cell ends-with-question rate.
// Sibling D1 (commits e8dc7a8 / 3c9eaa6 / c334722) found that
// `ends-with-question` survives as the sole within-cell mediator across
// 5 passes of structural-features analysis. Adding the diagnostic here
// lets us see whether D3 architectural bridges (cell 98+) shift this
// rate alongside coupling — same-channel vs different-channel
// architectural intervention.
//
// Strips trailing whitespace, closing quotes, parens, and trailing
// emoji-like characters before checking the final char. This is the
// same convention the sibling's pass-3 regex uses.
function endsWithQuestion(text) {
  if (!text || typeof text !== 'string') return false;
  // Strip trailing whitespace and common closers.
  const stripped = text.replace(/[\s)\]}"'’””’.*]*$/u, '').trim();
  return stripped.endsWith('?');
}

function cohensD(a, b) {
  if (a.length < 2 || b.length < 2) return 0;
  const pooled = Math.sqrt(((a.length - 1) * sd(a) ** 2 + (b.length - 1) * sd(b) ** 2) / (a.length + b.length - 2));
  if (pooled === 0) return 0;
  return (mean(a) - mean(b)) / pooled;
}

// ── Trace extraction ────────────────────────────────────────────────────

/**
 * Pull reflection→action pairs out of a single dialogue trace.
 *
 * Tutor reflection fires at the START of turn N and is followed within the
 * same turn by ego.generate (and possibly ego.revise). Real production traces
 * record turnIndex on the reflection but leave it undefined on the ego
 * generate/revise — so we walk the trace in order rather than matching by
 * turnIndex.
 *
 * For each ego_self_reflection, the paired "action" is the latest ego
 * generate/revise occurring after it but before the next ego_self_reflection
 * (or end of trace). This is a simple order-based scan.
 */
export function extractReflectionActionPairs(trace) {
  if (!Array.isArray(trace)) return [];

  const reflectionPositions = [];
  for (let i = 0; i < trace.length; i++) {
    if (trace[i].agent === 'ego_self_reflection') reflectionPositions.push(i);
  }

  const pairs = [];
  for (let r = 0; r < reflectionPositions.length; r++) {
    const start = reflectionPositions[r];
    const end = r + 1 < reflectionPositions.length ? reflectionPositions[r + 1] : trace.length;
    const reflectionEntry = trace[start];
    const reflection = (reflectionEntry.detail || '').trim();
    if (!reflection) continue;

    let action = null;
    let actionMessage = null; // message-only text, for ends-with-question check
    for (let i = start + 1; i < end; i++) {
      const e = trace[i];
      if (e.agent !== 'ego') continue;
      if (!['generate', 'revise', 'generate_final'].includes(e.action)) continue;
      const text = (e.suggestions || []).map((s) => `${s.title || ''} ${s.message || ''} ${s.reasoning || ''}`).join(' ').trim();
      const messageOnly = (e.suggestions || []).map((s) => s.message || '').filter(Boolean).join(' ').trim();
      if (text) {
        action = text; // keep latest within the window (revise wins over earlier generate)
        actionMessage = messageOnly;
      }
    }
    if (!action) continue;
    pairs.push({ turn: reflectionEntry.turnIndex ?? r, reflection, action, actionMessage });
  }

  return pairs;
}

/**
 * Compute turn-to-turn drift for the SAME dialogue.
 * Uses cosine distance between consecutive final tutor messages.
 *
 * Walks the trace in order, collecting one final message per turn. A turn
 * boundary is marked by a `context_input` entry from the user/tutor agent
 * (legacy traces use `user`, newer ones use `tutor`).
 */
export function computeTurnDrift(trace) {
  if (!Array.isArray(trace)) return [];
  const turnTexts = [];
  let currentText = null;
  for (const e of trace) {
    if ((e.agent === 'user' || e.agent === 'tutor') && e.action === 'context_input') {
      if (currentText) turnTexts.push(currentText);
      currentText = null;
      continue;
    }
    if (e.agent !== 'ego') continue;
    if (!['generate', 'revise', 'generate_final'].includes(e.action)) continue;
    const text = (e.suggestions || []).map((s) => `${s.title || ''} ${s.message || ''} ${s.reasoning || ''}`).join(' ').trim();
    if (text) currentText = text;
  }
  if (currentText) turnTexts.push(currentText);

  const drifts = [];
  for (let i = 1; i < turnTexts.length; i++) {
    drifts.push(1 - cosine(turnTexts[i - 1], turnTexts[i]));
  }
  return drifts;
}

// ── Cell classification ─────────────────────────────────────────────────

function isRecog(profile) {
  return /(_recog_|_recog$|recognition)/i.test(profile);
}

function hasReflectionMechanism(profile) {
  // Cells with self_reflection_evolution_enabled in tutor-agents.yaml.
  // Original pattern: 40-45 dialectical+suspicious/adversary/advocate; 60-63
  // selfreflect_psycho; 72-77 A2 sweep variants. Then D3 added cells 97
  // (dialectical_suspicious_directive), 98 (dialectical_suspicious_two_pass),
  // 99 (dialectical_coupling). Generalised the dialectical_* match to any
  // dialectical_<word> so future bridges (cell 100+) don't silently fall
  // through this filter.
  return /selfreflect|dialectical_\w+|_quantitative|_erosion|_intersubjective|_combined/.test(profile);
}

// ── Aggregation ─────────────────────────────────────────────────────────

export function aggregateByCell(allPairs) {
  const groups = new Map();
  for (const p of allPairs) {
    if (!groups.has(p.profile)) {
      groups.set(p.profile, { profile: p.profile, pairs: [], drifts: [] });
    }
    const g = groups.get(p.profile);
    g.pairs.push(...p.pairs);
    g.drifts.push(...p.drifts);
  }

  const summary = [];
  for (const g of groups.values()) {
    const cosines = g.pairs.map((pp) => cosine(pp.reflection, pp.action));
    const jaccards = g.pairs.map((pp) => jaccard(pp.reflection, pp.action));
    const gaps = cosines.map((c) => 1 - c);

    // Cross-pollination with sibling D1 finding: per-cell ends-with-question
    // rate. Looks at `actionMessage` only (not title/reasoning) so the
    // pragmatic act is read off the surface delivery, not internal monologue.
    const eowqHits = g.pairs.filter((pp) => endsWithQuestion(pp.actionMessage)).length;
    const eowqDenom = g.pairs.filter((pp) => pp.actionMessage).length;

    summary.push({
      profile: g.profile,
      condition: isRecog(g.profile) ? 'recog' : 'base',
      reflectionPairs: g.pairs.length,
      driftSamples: g.drifts.length,
      meanCoupling: mean(cosines),
      sdCoupling: sd(cosines),
      meanJaccard: mean(jaccards),
      meanGap: mean(gaps),
      meanTurnDrift: mean(g.drifts),
      sdTurnDrift: sd(g.drifts),
      // diagnostic: gap minus drift. If positive, the reflection-to-action
      // gap is bigger than ordinary turn-to-turn drift → reflection content
      // is even less present in next-turn behavior than a random adjacent
      // message would be. If ≈0, the reflection is essentially "average drift"
      // away from action — i.e. no special coupling produced by reflecting.
      gapMinusDrift: mean(gaps) - mean(g.drifts),
      // D1 cross-pollination: ends-with-question rate (sibling's within-cell mediator).
      endsWithQuestionRate: eowqDenom > 0 ? eowqHits / eowqDenom : null,
      endsWithQuestionDenom: eowqDenom,
    });
  }

  summary.sort((a, b) => a.profile.localeCompare(b.profile));
  return summary;
}

// ── Report ──────────────────────────────────────────────────────────────

function formatTable(rows, columns) {
  const header = `| ${columns.map((c) => c.label).join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows
    .map((r) => `| ${columns.map((c) => c.fmt(r[c.key])).join(' | ')} |`)
    .join('\n');
  return [header, sep, body].join('\n');
}

export function buildReport({ runIds, summary, minPairs }) {
  const filtered = summary.filter((s) => s.reflectionPairs >= minPairs);
  const skipped = summary.length - filtered.length;
  const lines = [];
  lines.push(`# Insight-Action Gap (D3)`);
  lines.push('');
  lines.push(`**Runs analyzed:** ${runIds.join(', ') || '(all)'}`);
  lines.push(`**Cells with ≥${minPairs} reflection-action pairs:** ${filtered.length} (${skipped} skipped)`);
  lines.push('');
  lines.push('## What this measures');
  lines.push('');
  lines.push('- **Coupling** — cosine similarity between a turn\'s `ego_self_reflection` text and the same turn\'s final tutor message. High = reflection themes show up in the action.');
  lines.push('- **Gap** — `1 − Coupling`. Big numbers mean the insight stayed cognitive.');
  lines.push('- **Turn drift** — cosine distance between consecutive final tutor messages on the same dialogue. The "how much does the tutor change between turns at all" baseline.');
  lines.push('- **Gap − Drift** — diagnostic. If ≈ 0, reflection content is no more present in next-turn behavior than any neighbouring turn would be (i.e. reflection adds no special coupling).');
  lines.push('- **EoQ%** — fraction of `actionMessage` ending in `?`. The sibling D1 fifth-pass found `ends-with-question` is the sole within-cell mediator of the orientation-family effect (commits e8dc7a8 / 3c9eaa6 / c334722); reporting it here lets cross-checking of whether D3 architectural bridges shift the same channel.');
  lines.push('');

  if (filtered.length === 0) {
    lines.push('_No cells met the minimum-pairs threshold. Lower `--min-pairs` or run a reflection-mechanism cell._');
    return lines.join('\n');
  }

  lines.push('## Per-cell summary');
  lines.push('');
  lines.push(
    formatTable(filtered, [
      { key: 'profile', label: 'Cell', fmt: (v) => v },
      { key: 'condition', label: 'Cond', fmt: (v) => v },
      { key: 'reflectionPairs', label: 'N pairs', fmt: (v) => `${v}` },
      { key: 'meanCoupling', label: 'Coupling (cos)', fmt: (v) => v.toFixed(3) },
      { key: 'meanJaccard', label: 'Coupling (Jaccard)', fmt: (v) => v.toFixed(3) },
      { key: 'meanGap', label: 'Gap', fmt: (v) => v.toFixed(3) },
      { key: 'meanTurnDrift', label: 'Turn drift', fmt: (v) => v.toFixed(3) },
      { key: 'gapMinusDrift', label: 'Gap−Drift', fmt: (v) => v.toFixed(3) },
      { key: 'endsWithQuestionRate', label: 'EoQ%', fmt: (v) => v == null ? '—' : `${(v * 100).toFixed(0)}%` },
    ]),
  );
  lines.push('');

  // Base vs recog comparison on the gap.
  // Treat each cell's mean as one observation — Cohen's d is computed on
  // cell-level means, not pair-replicated copies of those means (which would
  // artificially zero out within-cell variance and inflate d).
  const base = filtered.filter((s) => s.condition === 'base');
  const recog = filtered.filter((s) => s.condition === 'recog');
  if (base.length > 0 && recog.length > 0) {
    const baseCellMeans = base.map((s) => s.meanGap);
    const recogCellMeans = recog.map((s) => s.meanGap);
    lines.push('## Recognition contrast (cell-level)');
    lines.push('');
    lines.push(`- Base cells (n=${base.length}): mean cell gap = ${mean(baseCellMeans).toFixed(3)} (sd ${sd(baseCellMeans).toFixed(3)})`);
    lines.push(`- Recog cells (n=${recog.length}): mean cell gap = ${mean(recogCellMeans).toFixed(3)} (sd ${sd(recogCellMeans).toFixed(3)})`);
    lines.push(`- Cohen's d (base − recog cell means): ${cohensD(baseCellMeans, recogCellMeans).toFixed(3)}`);
    if (Math.min(base.length, recog.length) < 5) {
      lines.push('');
      lines.push('_n per group < 5 — treat the d as exploratory; replicate across more cells/runs before drawing conclusions._');
    }
    lines.push('');
  }

  lines.push('## How to read');
  lines.push('');
  lines.push('A small **Gap** with a large **Turn drift** is the strongest evidence the reflection shaped behavior — the tutor changes between turns *and* the change tracks the reflection. A large **Gap − Drift** says reflection content is no more present in next-turn behavior than a neighbouring turn would be: awareness without coupling. Compare across cells to see which mechanisms (suspicious vs adversary vs advocate; base vs recog) actually narrow the gap.');
  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.runIds.length === 0) {
    console.error('Usage: node scripts/analyze-insight-action-gap.js <runId> [<runId>...] [--json] [--output PATH] [--min-pairs N]');
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });
  const placeholders = args.runIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT dialogue_id, profile_name FROM evaluation_results
       WHERE run_id IN (${placeholders})
         AND dialogue_id IS NOT NULL AND dialogue_id <> ''
         AND success = 1`,
    )
    .all(...args.runIds);

  console.log(`Loaded ${rows.length} candidate rows from ${args.runIds.length} run(s)`);

  const buckets = new Map();
  let dialoguesScanned = 0;
  let dialoguesUsed = 0;
  let pairsFound = 0;

  for (const row of rows) {
    if (!hasReflectionMechanism(row.profile_name)) continue;
    const log = evaluationStore.loadDialogueLog(row.dialogue_id);
    if (!log || !log.dialogueTrace) continue;
    dialoguesScanned++;

    const pairs = extractReflectionActionPairs(log.dialogueTrace);
    const drifts = computeTurnDrift(log.dialogueTrace);
    if (pairs.length === 0 && drifts.length === 0) continue;
    dialoguesUsed++;
    pairsFound += pairs.length;

    if (!buckets.has(row.profile_name)) {
      buckets.set(row.profile_name, { profile: row.profile_name, pairs: [], drifts: [] });
    }
    const b = buckets.get(row.profile_name);
    b.pairs.push(...pairs);
    b.drifts.push(...drifts);
  }

  console.log(`Scanned ${dialoguesScanned} reflection-mechanism dialogues; used ${dialoguesUsed}; ${pairsFound} reflection-action pairs`);

  const summary = aggregateByCell([...buckets.values()]);
  const report = buildReport({ runIds: args.runIds, summary, minPairs: args.minPairs });

  const outPath = args.output || path.join(__dirname, '..', 'exports', `insight-action-gap-${args.runIds[0]}.md`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report, 'utf8');
  console.log(`Wrote report → ${outPath}`);

  if (args.json) {
    const jsonPath = outPath.replace(/\.md$/, '.json');
    fs.writeFileSync(jsonPath, JSON.stringify({ runIds: args.runIds, minPairs: args.minPairs, summary }, null, 2));
    console.log(`Wrote JSON   → ${jsonPath}`);
  }
}

// Allow tests to import the helpers without invoking main()
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
