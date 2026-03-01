#!/usr/bin/env node
/**
 * Score transcript sample files via claude CLI and gather results.
 *
 * Reads all public/full transcript pairs from a directory,
 * sends each to `claude -p` for scoring, and outputs a consolidated report.
 *
 * Usage:
 *   node scripts/score-transcript-samples.js --dir <path> [options]
 *
 * Options:
 *   --dir <path>       Directory containing transcript files (required)
 *   --parallelism N    Concurrent judge calls (default: 2)
 *   --model <model>    Override claude model (e.g. opus, sonnet)
 *   --only-public      Score only public transcripts
 *   --only-full        Score only full transcripts
 *   --filter <pattern> Only score files matching pattern (e.g. "cell5")
 *   --output <path>    Write JSON results to file
 *   --verbose          Show raw claude output
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(__dirname, '..', 'logs', 'transcript-samples');

// ── Parse CLI args ──────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dir: null, parallelism: 2, model: null, onlyPublic: false, onlyFull: false, filter: null, output: null, verbose: false };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dir': opts.dir = args[++i]; break;
      case '--parallelism': opts.parallelism = parseInt(args[++i], 10); break;
      case '--model': opts.model = args[++i]; break;
      case '--only-public': opts.onlyPublic = true; break;
      case '--only-full': opts.onlyFull = true; break;
      case '--filter': opts.filter = args[++i]; break;
      case '--output': opts.output = args[++i]; break;
      case '--verbose': opts.verbose = true; break;
      default: console.error(`Unknown option: ${args[i]}`); process.exit(1);
    }
  }
  return opts;
}

// ── Discover transcript pairs ───────────────────────────────────────────────

function discoverPairs(dir, filter) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('-public.txt'));
  const pairs = [];
  for (const pubFile of files) {
    const base = pubFile.replace(/-public\.txt$/, '');
    if (filter && !base.includes(filter)) continue;
    const fullFile = `${base}-full.txt`;
    const hasPublic = fs.existsSync(path.join(dir, pubFile));
    const hasFull = fs.existsSync(path.join(dir, fullFile));
    pairs.push({ base, pubFile: hasPublic ? pubFile : null, fullFile: hasFull ? fullFile : null });
  }
  return pairs.sort((a, b) => a.base.localeCompare(b.base));
}

// ── Call claude judge ───────────────────────────────────────────────────────

function callJudge(promptText, model, verbose) {
  return new Promise((resolve, reject) => {
    const claudeArgs = ['-p', '-', '--output-format', 'text'];
    if (model) claudeArgs.push('--model', model);

    const env = { ...process.env };
    // Avoid nested-session detection
    delete env.CLAUDE_CODE;
    delete env.CLAUDECODE;

    const child = spawn('claude', claudeArgs, { stdio: ['pipe', 'pipe', 'pipe'], env });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (verbose) {
        console.log(`  [stdout] ${out.slice(0, 300)}`);
        if (err) console.log(`  [stderr] ${err.slice(0, 200)}`);
      }
      if (code !== 0) {
        reject(new Error(err || out || `claude exited with code ${code}`));
      } else {
        resolve(out);
      }
    });
    child.stdin.write(promptText);
    child.stdin.end();
  });
}

// ── Parse judge JSON ────────────────────────────────────────────────────────

const DIMENSIONS = [
  'pedagogical_progression',
  'dialogical_responsiveness',
  'knowledge_co_construction',
  'productive_tension_management',
  'transformation_evidence',
  'interactional_coherence',
];

const WEIGHTS = {
  pedagogical_progression: 0.20,
  dialogical_responsiveness: 0.20,
  knowledge_co_construction: 0.20,
  productive_tension_management: 0.15,
  transformation_evidence: 0.15,
  interactional_coherence: 0.10,
};

function parseJudgeOutput(raw) {
  let jsonStr = raw.trim();
  // Strip markdown fences
  const fm = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fm) {
    jsonStr = fm[1].trim();
  } else {
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }
  }

  const parsed = JSON.parse(jsonStr);
  const scores = {};
  for (const [key, value] of Object.entries(parsed.scores || {})) {
    if (typeof value === 'object' && value !== null) {
      scores[key] = { score: value.score, reasoning: value.reasoning || '' };
    } else if (typeof value === 'number') {
      scores[key] = { score: value, reasoning: '' };
    }
  }

  // Compute weighted overall on 0-100 scale
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [key, w] of Object.entries(WEIGHTS)) {
    if (scores[key]) {
      weightedSum += scores[key].score * w;
      totalWeight += w;
    }
  }
  const overall = totalWeight > 0 ? ((weightedSum / totalWeight - 1) / 4) * 100 : parsed.overall_score || 0;

  return { scores, overall: Math.round(overall * 10) / 10, summary: parsed.summary || '' };
}

// ── Parallel runner ─────────────────────────────────────────────────────────

async function runWithLimit(tasks, limit) {
  const results = [];
  let idx = 0;
  async function next() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => next()));
  return results;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const samplesDir = opts.dir ? path.resolve(opts.dir) : DEFAULT_DIR;

  if (!fs.existsSync(samplesDir)) {
    console.error(`Directory not found: ${samplesDir}`);
    process.exit(1);
  }

  const pairs = discoverPairs(samplesDir, opts.filter);

  if (pairs.length === 0) {
    console.error(`No transcript pairs found in ${samplesDir}. Run gen-transcript-samples.js first.`);
    process.exit(1);
  }

  // Try DB lookup for dialogue-ID-based filenames; use filename as label for cell-prefixed names
  const cellMap = {};
  try {
    const Database = (await import('better-sqlite3')).default;
    const dbPath = path.resolve(__dirname, '..', 'data', 'evaluations.db');
    const db = new Database(dbPath, { readonly: true });
    for (const pair of pairs) {
      const dialogueId = pair.base;
      if (dialogueId.startsWith('dialogue-')) {
        const row = db.prepare('SELECT profile_name, scenario_id FROM evaluation_results WHERE dialogue_id = ? LIMIT 1').get(dialogueId);
        if (row) cellMap[dialogueId] = { cell: row.profile_name, scenario: row.scenario_id };
      }
    }
    db.close();
  } catch { /* ignore */ }

  // Build task list
  const jobs = [];
  for (const pair of pairs) {
    if (!opts.onlyFull && pair.pubFile) {
      jobs.push({ base: pair.base, mode: 'public', file: pair.pubFile });
    }
    if (!opts.onlyPublic && pair.fullFile) {
      jobs.push({ base: pair.base, mode: 'full', file: pair.fullFile });
    }
  }

  console.log(`Directory: ${samplesDir}`);
  console.log(`Scoring ${jobs.length} transcripts (${pairs.length} pairs, parallelism: ${opts.parallelism})...\n`);

  const results = {};
  let completed = 0;

  const tasks = jobs.map((job) => async () => {
    const filePath = path.join(samplesDir, job.file);
    const prompt = fs.readFileSync(filePath, 'utf-8');
    const meta = cellMap[job.base] || {};
    const label = meta.cell || job.base; // cell-prefixed filenames are already descriptive

    process.stdout.write(`  [${++completed}/${jobs.length}] ${label} (${job.mode})...`);
    const startMs = Date.now();

    try {
      const raw = await callJudge(prompt, opts.model, opts.verbose);
      const parsed = parseJudgeOutput(raw);
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      console.log(` ${parsed.overall} (${elapsed}s)`);

      if (!results[job.base]) results[job.base] = { cell: label, scenario: meta.scenario || '' };
      results[job.base][job.mode] = parsed;
    } catch (e) {
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      console.log(` ERROR (${elapsed}s): ${e.message.slice(0, 100)}`);
      if (!results[job.base]) results[job.base] = { cell: label, scenario: meta.scenario || '' };
      results[job.base][job.mode] = { error: e.message, scores: {}, overall: null, summary: '' };
    }
  });

  await runWithLimit(tasks, opts.parallelism);

  // ── Report ──────────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(100));
  console.log('DIALOGUE QUALITY SCORES — PUBLIC vs FULL TRANSCRIPT');
  console.log('='.repeat(100));

  // Table header
  const dimShort = {
    pedagogical_progression: 'Prog',
    dialogical_responsiveness: 'Resp',
    knowledge_co_construction: 'CoCon',
    productive_tension_management: 'Tens',
    transformation_evidence: 'Trans',
    interactional_coherence: 'Coher',
  };

  const colW = 6;
  const cellW = 48;
  const modeW = 7;
  const hdr = 'Cell'.padEnd(cellW) + 'Mode'.padEnd(modeW)
    + Object.values(dimShort).map(d => d.padStart(colW)).join('')
    + '  Overall';
  console.log('\n' + hdr);
  console.log('-'.repeat(hdr.length));

  const sortedBases = Object.keys(results).sort((a, b) => {
    const ca = results[a].cell || a;
    const cb = results[b].cell || b;
    return ca.localeCompare(cb);
  });

  for (const base of sortedBases) {
    const entry = results[base];
    for (const mode of ['public', 'full']) {
      const data = entry[mode];
      if (!data) continue;

      const cellName = (entry.cell || base).slice(0, cellW - 1);
      const dimScores = DIMENSIONS.map(d => {
        const s = data.scores?.[d]?.score;
        return s != null ? String(s).padStart(colW) : '  -   ';
      }).join('');

      const overallStr = data.overall != null ? data.overall.toFixed(1) : 'ERR';
      console.log(`${cellName.padEnd(cellW)}${mode.padEnd(modeW)}${dimScores}  ${overallStr}`);
    }
  }

  // ── Dimension reasoning ─────────────────────────────────────────────────

  console.log('\n' + '='.repeat(100));
  console.log('DIMENSION REASONING');
  console.log('='.repeat(100));

  for (const base of sortedBases) {
    const entry = results[base];
    console.log(`\n--- ${entry.cell || base} ---`);
    for (const mode of ['public', 'full']) {
      const data = entry[mode];
      if (!data || data.error) continue;
      console.log(`  [${mode.toUpperCase()}]`);
      for (const dim of DIMENSIONS) {
        const d = data.scores?.[dim];
        if (d) {
          console.log(`    ${dimShort[dim]} (${d.score}/5): ${d.reasoning}`);
        }
      }
      if (data.summary) {
        console.log(`    Summary: ${data.summary}`);
      }
    }
  }

  // ── Delta analysis ──────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(100));
  console.log('PUBLIC vs FULL DELTA (full - public)');
  console.log('='.repeat(100));

  const deltaHdr = 'Cell'.padEnd(cellW)
    + Object.values(dimShort).map(d => d.padStart(colW)).join('')
    + '  Overall';
  console.log('\n' + deltaHdr);
  console.log('-'.repeat(deltaHdr.length));

  const deltas = { overall: [] };
  for (const dim of DIMENSIONS) deltas[dim] = [];

  for (const base of sortedBases) {
    const entry = results[base];
    const pub = entry.public;
    const full = entry.full;
    if (!pub || !full || pub.error || full.error) continue;

    const cellName = (entry.cell || base).slice(0, cellW - 1);
    const dims = DIMENSIONS.map(d => {
      const ps = pub.scores?.[d]?.score;
      const fs = full.scores?.[d]?.score;
      if (ps != null && fs != null) {
        const delta = fs - ps;
        deltas[d].push(delta);
        const sign = delta > 0 ? '+' : delta < 0 ? '' : ' ';
        return `${sign}${delta}`.padStart(colW);
      }
      return '  -   ';
    }).join('');

    const overallDelta = (full.overall != null && pub.overall != null) ? full.overall - pub.overall : null;
    if (overallDelta != null) deltas.overall.push(overallDelta);
    const overallStr = overallDelta != null
      ? `${overallDelta > 0 ? '+' : ''}${overallDelta.toFixed(1)}`
      : 'N/A';
    console.log(`${cellName.padEnd(cellW)}${dims}  ${overallStr}`);
  }

  // Averages
  const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const avgDims = DIMENSIONS.map(d => {
    const m = mean(deltas[d]);
    const sign = m > 0 ? '+' : m < 0 ? '' : ' ';
    return `${sign}${m.toFixed(1)}`.padStart(colW);
  }).join('');
  const avgOverall = mean(deltas.overall);
  console.log('-'.repeat(deltaHdr.length));
  console.log(`${'Mean'.padEnd(cellW)}${avgDims}  ${avgOverall > 0 ? '+' : ''}${avgOverall.toFixed(1)}`);

  // ── JSON output ─────────────────────────────────────────────────────────

  if (opts.output) {
    const outPath = path.resolve(opts.output);
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`\nJSON results written to: ${outPath}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
