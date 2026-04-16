#!/usr/bin/env node
/**
 * human-validation-analyze.js — Compute LLM↔human inter-rater agreement.
 *
 * Reads the rater-filled CSVs and the stored LLM key, computes Cohen's κ,
 * per-category precision/recall/F1, confusion matrix, and (optionally)
 * Fleiss' κ across all raters + LLM.
 *
 * Inputs:
 *   exports/human-validation-pilot-key.jsonl        (from sample script)
 *   exports/human-validation-pilot-rater-<id>.csv   (one or more; id is arbitrary)
 *
 * Usage:
 *   node scripts/human-validation-analyze.js                     # auto-discover rater-*.csv
 *   node scripts/human-validation-analyze.js --rater A:path.csv  # explicit
 *   node scripts/human-validation-analyze.js --rater A:a.csv --rater B:b.csv
 *   node scripts/human-validation-analyze.js --out exports/custom-output.md
 *
 * Synthetic-rater mode (LLM-vs-LLM baseline):
 *   node scripts/human-validation-analyze.js --synthetic-rater sonnet:path/to/sonnet-classified.jsonl
 *     → treats the second LLM's classifications as a "rater" and computes LLM↔LLM κ as a
 *       lower-bound reference for the expected human↔LLM range.
 *
 * Output: a markdown report at exports/human-validation-pilot-analysis.md
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const keyPath = join(ROOT, 'exports', 'human-validation-pilot-key.jsonl');
const outPath = (() => {
  const i = args.indexOf('--out');
  return i !== -1 ? args[i + 1] : join(ROOT, 'exports', 'human-validation-pilot-analysis.md');
})();

const raterArgs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--rater' && args[i + 1]) {
    raterArgs.push(args[i + 1]);
    i++;
  }
}

const syntheticArgs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--synthetic-rater' && args[i + 1]) {
    syntheticArgs.push(args[i + 1]);
    i++;
  }
}

const CATEGORIES = [
  'CONTEXT_BLINDNESS',
  'RECOGNITION_FAILURE',
  'REDIRECTION',
  'FABRICATION',
  'VAGUENESS',
  'EMOTIONAL_NEGLECT',
  'REGISTER_MISMATCH',
  'PEDAGOGICAL_MISJUDGMENT',
  'LACK_OF_AGENCY',
  'MEMORY_FAILURE',
  'APPROVAL',
  'OTHER',
];

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const parseRow = (line) => {
    const out = [];
    let cur = '';
    let inside = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inside) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inside = false;
        } else {
          cur += c;
        }
      } else {
        if (c === ',') {
          out.push(cur);
          cur = '';
        } else if (c === '"') {
          inside = true;
        } else {
          cur += c;
        }
      }
    }
    out.push(cur);
    return out;
  };
  const header = parseRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseRow(lines[i]);
    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = cells[j] || '';
    rows.push(obj);
  }
  return { header, rows };
}

function normalizeLabel(s) {
  if (!s) return null;
  const up = s.toUpperCase().trim().replace(/[\s-]+/g, '_');
  return CATEGORIES.includes(up) ? up : null;
}

function loadRater(raterArg) {
  const [id, ...pathParts] = raterArg.split(':');
  const path = pathParts.join(':');
  if (!existsSync(path)) throw new Error(`Rater CSV not found: ${path}`);
  const { rows } = parseCsv(readFileSync(path, 'utf-8'));
  const map = {};
  let filled = 0;
  for (const r of rows) {
    const label = normalizeLabel(r.human_primary);
    if (label) {
      map[r.item_id] = label;
      filled++;
    }
  }
  return { id, path, map, filled, totalRows: rows.length };
}

function loadSyntheticRater(arg) {
  const [id, ...pathParts] = arg.split(':');
  const path = pathParts.join(':');
  if (!existsSync(path)) throw new Error(`Synthetic classified file not found: ${path}`);
  const lines = readFileSync(path, 'utf-8').trim().split('\n');
  const map = {};
  let filled = 0;
  for (const line of lines) {
    const row = JSON.parse(line);
    const key = row.item_id || row.classification?.item_id;
    const label = normalizeLabel(row.classification?.primary);
    if (key && label) {
      map[key] = label;
      filled++;
    }
  }
  return { id: `synthetic:${id}`, path, map, filled, totalRows: lines.length, synthetic: true };
}

function autoDiscoverRaters() {
  const dir = join(ROOT, 'exports');
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) =>
    /^human-validation-pilot-rater-.+\.csv$/.test(f)
  );
  return files.map((f) => {
    const id = f.replace(/^human-validation-pilot-rater-/, '').replace(/\.csv$/, '');
    return `${id}:${join(dir, f)}`;
  });
}

function cohensKappa(pairs) {
  if (pairs.length === 0) return { kappa: NaN, agree: NaN, chance: NaN, n: 0 };
  const labels = Array.from(new Set(pairs.flatMap((p) => [p[0], p[1]])));
  const n = pairs.length;
  let po = 0;
  const marginalA = {};
  const marginalB = {};
  for (const l of labels) {
    marginalA[l] = 0;
    marginalB[l] = 0;
  }
  for (const [a, b] of pairs) {
    if (a === b) po++;
    marginalA[a]++;
    marginalB[b]++;
  }
  po /= n;
  let pe = 0;
  for (const l of labels) pe += (marginalA[l] / n) * (marginalB[l] / n);
  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
  return { kappa, agree: po, chance: pe, n };
}

function fleissKappa(allRaters, items) {
  const k = allRaters.length;
  if (k < 2) return { kappa: NaN, n: 0 };
  const categories = Array.from(
    new Set(items.flatMap((id) => allRaters.map((r) => r.map[id]).filter(Boolean)))
  );
  if (categories.length < 2) return { kappa: NaN, n: 0 };
  const N = items.length;
  const catIdx = {};
  categories.forEach((c, i) => (catIdx[c] = i));
  const table = Array.from({ length: N }, () => new Array(categories.length).fill(0));
  let validItems = 0;
  const validMask = [];
  for (let i = 0; i < N; i++) {
    let ratings = 0;
    for (const r of allRaters) {
      const lab = r.map[items[i]];
      if (lab && catIdx[lab] !== undefined) {
        table[i][catIdx[lab]]++;
        ratings++;
      }
    }
    validMask.push(ratings === k);
    if (ratings === k) validItems++;
  }
  if (validItems === 0) return { kappa: NaN, n: 0 };

  const filtered = table.filter((_, i) => validMask[i]);
  const totalsByCategory = new Array(categories.length).fill(0);
  for (const row of filtered) for (let j = 0; j < categories.length; j++) totalsByCategory[j] += row[j];
  const p = totalsByCategory.map((t) => t / (validItems * k));
  const Pe = p.reduce((s, pj) => s + pj * pj, 0);
  let Pbar = 0;
  for (const row of filtered) {
    let sumSq = 0;
    for (let j = 0; j < categories.length; j++) sumSq += row[j] * row[j];
    const Pi = (sumSq - k) / (k * (k - 1));
    Pbar += Pi;
  }
  Pbar /= validItems;
  const kappa = Pe === 1 ? 1 : (Pbar - Pe) / (1 - Pe);
  return { kappa, n: validItems };
}

function perCategoryF1(pairs, categories) {
  const out = {};
  for (const cat of categories) {
    let tp = 0,
      fp = 0,
      fn = 0;
    for (const [gold, pred] of pairs) {
      if (gold === cat && pred === cat) tp++;
      else if (gold !== cat && pred === cat) fp++;
      else if (gold === cat && pred !== cat) fn++;
    }
    const precision = tp + fp === 0 ? NaN : tp / (tp + fp);
    const recall = tp + fn === 0 ? NaN : tp / (tp + fn);
    const f1 =
      Number.isNaN(precision) || Number.isNaN(recall) || precision + recall === 0
        ? NaN
        : (2 * precision * recall) / (precision + recall);
    out[cat] = { precision, recall, f1, tp, fp, fn };
  }
  return out;
}

function confusionMatrix(pairs, categories) {
  const mtx = {};
  for (const row of categories) {
    mtx[row] = {};
    for (const col of categories) mtx[row][col] = 0;
  }
  for (const [gold, pred] of pairs) {
    if (!mtx[gold]) continue;
    if (mtx[gold][pred] === undefined) mtx[gold][pred] = 0;
    mtx[gold][pred]++;
  }
  return mtx;
}

function fmt(x, dp = 3) {
  if (Number.isNaN(x) || x === undefined || x === null) return '—';
  return x.toFixed(dp);
}

function renderCM(mtx, categories) {
  const header = ['LLM →'].concat(categories.map((c) => c.slice(0, 8)));
  const out = ['| ' + header.join(' | ') + ' |'];
  out.push('|' + header.map(() => '---').join('|') + '|');
  for (const gold of categories) {
    const row = [gold.slice(0, 16)];
    for (const pred of categories) {
      const v = mtx[gold]?.[pred] || 0;
      row.push(v === 0 ? '.' : String(v));
    }
    out.push('| ' + row.join(' | ') + ' |');
  }
  return out.join('\n');
}

function main() {
  if (!existsSync(keyPath)) {
    console.error(`Key not found: ${keyPath}`);
    console.error('Run scripts/human-validation-sample.js first.');
    process.exit(1);
  }
  const keyLines = readFileSync(keyPath, 'utf-8').trim().split('\n');
  const key = {};
  for (const line of keyLines) {
    const row = JSON.parse(line);
    key[row.item_id] = row;
  }
  const items = Object.keys(key);

  const rater_specs = raterArgs.length > 0 ? raterArgs : autoDiscoverRaters();

  const raters = [];
  for (const spec of rater_specs) {
    try {
      raters.push(loadRater(spec));
    } catch (err) {
      console.error(`Failed to load rater ${spec}: ${err.message}`);
    }
  }
  for (const spec of syntheticArgs) {
    try {
      raters.push(loadSyntheticRater(spec));
    } catch (err) {
      console.error(`Failed to load synthetic rater ${spec}: ${err.message}`);
    }
  }

  if (raters.length === 0) {
    console.error('No raters loaded. Either:');
    console.error('  - Fill exports/human-validation-pilot-rater-A.csv and run again');
    console.error('  - Pass --rater A:path.csv --rater B:path.csv');
    console.error('  - Pass --synthetic-rater sonnet:exports/sonnet-classified.jsonl');
    process.exit(1);
  }

  const out = [];
  out.push('# Human Validation Pilot — Inter-Rater Analysis\n');
  out.push(`Generated: ${new Date().toISOString()}\n`);
  out.push(`Key: \`${keyPath}\`\n`);
  out.push(`Items in sample: ${items.length}\n`);
  out.push('');
  out.push('## Raters\n');
  for (const r of raters) {
    out.push(
      `- **${r.id}**${r.synthetic ? ' (synthetic LLM baseline)' : ''}: ${r.filled}/${r.totalRows} items labelled. Path: \`${basename(r.path)}\``
    );
  }
  out.push('');

  const llmMap = Object.fromEntries(items.map((id) => [id, key[id].llm_primary]));

  out.push('## LLM ↔ Rater Agreement (Cohen\'s κ, primary category)\n');
  out.push('| Rater | n_items | Agreement | Chance | **Cohen\'s κ** | Interpretation |');
  out.push('|-------|---------|-----------|--------|---------------|----------------|');
  for (const r of raters) {
    const pairs = items
      .map((id) => [llmMap[id], r.map[id]])
      .filter(([a, b]) => a && b);
    const k = cohensKappa(pairs);
    const interp =
      k.kappa < 0
        ? 'Worse than chance'
        : k.kappa < 0.21
          ? 'Slight'
          : k.kappa < 0.41
            ? 'Fair'
            : k.kappa < 0.61
              ? 'Moderate'
              : k.kappa < 0.81
                ? 'Substantial'
                : 'Almost perfect';
    out.push(
      `| ${r.id} | ${k.n} | ${fmt(k.agree)} | ${fmt(k.chance)} | **${fmt(k.kappa)}** | ${interp} |`
    );
  }
  out.push('');

  if (raters.length >= 2) {
    out.push('## Rater ↔ Rater Agreement\n');
    out.push('| A | B | n_items | Agreement | **Cohen\'s κ** |');
    out.push('|---|---|---------|-----------|---------------|');
    for (let i = 0; i < raters.length; i++) {
      for (let j = i + 1; j < raters.length; j++) {
        const A = raters[i],
          B = raters[j];
        const pairs = items
          .map((id) => [A.map[id], B.map[id]])
          .filter(([a, b]) => a && b);
        const k = cohensKappa(pairs);
        out.push(
          `| ${A.id} | ${B.id} | ${k.n} | ${fmt(k.agree)} | **${fmt(k.kappa)}** |`
        );
      }
    }
    out.push('');

    const allRaters = [
      { id: 'LLM', map: llmMap, synthetic: false },
      ...raters,
    ];
    const fk = fleissKappa(allRaters, items);
    out.push(
      `**Fleiss' κ across all raters + LLM** (n=${fk.n} items with complete coverage): **${fmt(fk.kappa)}**\n`
    );
  }

  for (const r of raters) {
    const pairs = items
      .map((id) => [llmMap[id], r.map[id]])
      .filter(([a, b]) => a && b);
    out.push(`## Per-Category F1 — LLM vs ${r.id}\n`);
    out.push('| Category | TP | FP | FN | Precision | Recall | F1 |');
    out.push('|----------|----|----|----|-----------|--------|-----|');
    const pcf = perCategoryF1(pairs, CATEGORIES);
    for (const cat of CATEGORIES) {
      const s = pcf[cat];
      if (s.tp === 0 && s.fp === 0 && s.fn === 0) continue;
      out.push(
        `| ${cat} | ${s.tp} | ${s.fp} | ${s.fn} | ${fmt(s.precision)} | ${fmt(s.recall)} | ${fmt(s.f1)} |`
      );
    }
    out.push('');

    out.push(`### Confusion Matrix — LLM (rows) vs ${r.id} (cols)\n`);
    const activeCats = CATEGORIES.filter((c) =>
      pairs.some(([a, b]) => a === c || b === c)
    );
    out.push(renderCM(confusionMatrix(pairs, activeCats), activeCats));
    out.push('');
  }

  writeFileSync(outPath, out.join('\n'));
  console.error(`Report written: ${outPath}`);
  console.error(`Raters: ${raters.map((r) => r.id).join(', ')}`);
}

main();
