#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsonrepair } from 'jsonrepair';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PACKET_DIR = path.join(ROOT, 'exports/dramatic-derivation/pairwise-transcript-eval');
const DEFAULT_OUT = path.join(DEFAULT_PACKET_DIR, 'scores.json');
const DEFAULT_REPORT = path.join(DEFAULT_PACKET_DIR, 'report.md');
const DIMENSIONS = [
  'natural_flow',
  'acknowledgement',
  'phatic_calibration',
  'non_formalist_speech',
  'readability',
  'pedagogical_traction',
];

function usage() {
  return `Usage:
  node scripts/score-derivation-transcript-pairwise-eval.js \\
    [--packet-dir exports/dramatic-derivation/pairwise-transcript-eval] \\
    [--out exports/dramatic-derivation/pairwise-transcript-eval/scores.json] \\
    [--report exports/dramatic-derivation/pairwise-transcript-eval/report.md] \\
    [--judge-cli codex|claude] [--judge-model MODEL] [--force] [--dry-run]
`;
}

export function parseArgs(argv = []) {
  const opts = {
    packetDir: DEFAULT_PACKET_DIR,
    out: null,
    report: null,
    judgeCli: 'codex',
    judgeModel: null,
    force: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...opts, help: true };
    if (arg === '--packet-dir') {
      opts.packetDir = path.resolve(ROOT, argv[++i]);
      continue;
    }
    if (arg === '--out') {
      opts.out = path.resolve(ROOT, argv[++i]);
      continue;
    }
    if (arg === '--report') {
      opts.report = path.resolve(ROOT, argv[++i]);
      continue;
    }
    if (arg === '--judge-cli') {
      opts.judgeCli = String(argv[++i] || '').trim().toLowerCase();
      continue;
    }
    if (arg === '--judge-model') {
      opts.judgeModel = argv[++i] || null;
      continue;
    }
    if (arg === '--force') {
      opts.force = true;
      continue;
    }
    if (arg === '--dry-run') {
      opts.dryRun = true;
      continue;
    }
    throw new Error(`Unknown argument ${arg}\n${usage()}`);
  }
  if (!['codex', 'claude'].includes(opts.judgeCli)) {
    throw new Error(`--judge-cli must be codex or claude, got ${JSON.stringify(opts.judgeCli)}`);
  }
  opts.out = opts.out || path.join(opts.packetDir, 'scores.json');
  opts.report = opts.report || path.join(opts.packetDir, 'report.md');
  return opts;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function extractJson(text) {
  const raw = String(text || '').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/iu);
  let candidate = fence ? fence[1].trim() : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) candidate = candidate.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(jsonrepair(candidate));
  }
}

function sideMean(score, side) {
  const row = score?.scores?.[side] || {};
  const values = DIMENSIONS.map((dimension) => Number(row[dimension])).filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizePreference(value) {
  const pref = String(value || '').trim().toUpperCase().replace(/\s+/gu, '_');
  if (pref === 'A' || pref === 'B') return pref;
  return 'no_preference';
}

function resolvePreferredLabel(row) {
  const pref = normalizePreference(row.parsed?.preferred_transcript);
  if (pref === 'A') return row.assignment.A;
  if (pref === 'B') return row.assignment.B;
  return null;
}

function makePrompt({ rubric, packet }) {
  return `${rubric}

${packet}

Return JSON only. Do not include markdown fences, caveats outside JSON, or guesses about runtime arm identity.`;
}

function callClaude(prompt, model) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '-', '--output-format', 'text'];
    if (model) args.push('--model', model);
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    delete env.CLAUDECODE;
    const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'], env });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d;
    });
    child.stderr.on('data', (d) => {
      err += d;
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(err || out || `claude exited ${code}`))));
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function callCodex(prompt, model) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'derivation-pairwise-codex-'));
  const outFile = path.join(tmpDir, 'last-message.txt');
  return new Promise((resolve, reject) => {
    const args = [
      'exec',
      '--skip-git-repo-check',
      '--ephemeral',
      '--ignore-user-config',
      '-s',
      'read-only',
      '-C',
      tmpDir,
      '--color',
      'never',
    ];
    if (model) args.push('-m', model);
    if (process.env.CODEX_REASONING_EFFORT) args.push('-c', `model_reasoning_effort="${process.env.CODEX_REASONING_EFFORT}"`);
    else args.push('-c', 'model_reasoning_effort="medium"');
    args.push('-o', outFile, '-');
    const child = spawn('codex', args, { stdio: ['pipe', 'pipe', 'pipe'], cwd: tmpDir });
    let err = '';
    child.stderr.on('data', (d) => {
      err += d;
    });
    child.on('error', (error) => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      reject(error);
    });
    child.on('close', (code) => {
      try {
        if (code !== 0) throw new Error(err || `codex exited ${code}`);
        const out = fs.readFileSync(outFile, 'utf8');
        resolve(out);
      } catch (error) {
        reject(error);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

async function callJudge(prompt, { judgeCli, judgeModel }) {
  if (judgeCli === 'claude') return callClaude(prompt, judgeModel);
  return callCodex(prompt, judgeModel);
}

function dryRunScore(pair) {
  return {
    preferred_transcript: 'no_preference',
    preference_strength: 'none',
    scores: {
      A: Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, 3])),
      B: Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, 3])),
    },
    formalism_leak_observed: { A: false, B: false },
    evidence_A: [`dry-run placeholder for ${pair.packet_id} A`],
    evidence_B: [`dry-run placeholder for ${pair.packet_id} B`],
    reason: 'dry-run placeholder; no judge was called',
  };
}

function loadKey(packetDir) {
  const file = path.join(packetDir, 'key.json');
  return fs.existsSync(file) ? readJson(file) : { pairs: [] };
}

function summarizeRows(rows) {
  const byLabel = new Map();
  for (const row of rows) {
    for (const side of ['A', 'B']) {
      const label = row.assignment[side];
      if (!byLabel.has(label)) {
        byLabel.set(label, {
          label,
          appearances: 0,
          wins: 0,
          losses: 0,
          noPreference: 0,
          meanScores: [],
          dimensionScores: Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, []])),
        });
      }
      const target = byLabel.get(label);
      target.appearances += 1;
      const preferred = resolvePreferredLabel(row);
      if (preferred === label) target.wins += 1;
      else if (preferred === null) target.noPreference += 1;
      else target.losses += 1;
      const scores = row.parsed?.scores?.[side] || {};
      target.meanScores.push(sideMean(row.parsed, side));
      for (const dimension of DIMENSIONS) {
        const value = Number(scores[dimension]);
        if (Number.isFinite(value)) target.dimensionScores[dimension].push(value);
      }
    }
  }
  return [...byLabel.values()].map((row) => ({
    ...row,
    meanScore: average(row.meanScores),
    dimensionMeans: Object.fromEntries(
      DIMENSIONS.map((dimension) => [dimension, average(row.dimensionScores[dimension])]),
    ),
  }));
}

function average(values) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function fmt(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function labelShort(label) {
  if (/s0-no-cast/u.test(label)) return 'S0 no cast';
  if (/s1-static-cast/u.test(label)) return 'S1 static cast';
  if (/s2-reinvention/u.test(label)) return 'S2 cast + reinvention';
  return label;
}

function renderReport({ packetDir, out, judge, rows, summary }) {
  const lines = [];
  lines.push('# Cast Layer Paired Transcript Comparison');
  lines.push('');
  lines.push(`Packet: \`${path.relative(ROOT, packetDir)}\``);
  lines.push(`Scores: \`${path.relative(ROOT, out)}\``);
  lines.push(`Judge: \`${judge}\``);
  lines.push('');
  lines.push('## Pair Results');
  lines.push('');
  lines.push('| Pair | A | B | Preferred | Strength | A mean | B mean | Formalism leak |');
  lines.push('| --- | --- | --- | --- | --- | ---: | ---: | --- |');
  for (const row of rows) {
    const preferred = resolvePreferredLabel(row);
    const leak = row.parsed?.formalism_leak_observed || {};
    lines.push(
      `| ${row.pair_id} | ${labelShort(row.assignment.A)} | ${labelShort(row.assignment.B)} | ${
        preferred ? labelShort(preferred) : 'no preference'
      } | ${row.parsed?.preference_strength || 'n/a'} | ${fmt(sideMean(row.parsed, 'A'))} | ${fmt(
        sideMean(row.parsed, 'B'),
      )} | A:${Boolean(leak.A)} B:${Boolean(leak.B)} |`,
    );
  }
  lines.push('');
  lines.push('## Arm Summary');
  lines.push('');
  lines.push('| Arm | Appearances | Wins | Losses | No preference | Mean score |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const row of summary) {
    lines.push(
      `| ${labelShort(row.label)} | ${row.appearances} | ${row.wins} | ${row.losses} | ${row.noPreference} | ${fmt(
        row.meanScore,
      )} |`,
    );
  }
  lines.push('');
  lines.push('## Interpretation Boundary');
  lines.push('');
  lines.push(
    'This is a blinded transcript-quality comparison, not a proof-control validation. Mechanism evidence still requires proof reliability plus improved uptake, turn count, or impasse prevention without negative transfer.',
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export async function scorePairwiseTranscriptEval(options) {
  const packetDir = options.packetDir || DEFAULT_PACKET_DIR;
  const manifest = readJson(path.join(packetDir, 'manifest.json'));
  const rubric = fs.readFileSync(path.join(packetDir, 'rubric.md'), 'utf8');
  const key = loadKey(packetDir);
  const keyByPacket = new Map((key.pairs || []).map((pair) => [pair.packet_id, pair]));
  const rows = [];
  for (const pair of manifest.pairs || []) {
    const packet = fs.readFileSync(path.join(packetDir, pair.packet), 'utf8');
    const raw = options.dryRun ? JSON.stringify(dryRunScore(pair)) : await callJudge(makePrompt({ rubric, packet }), options);
    const parsed = extractJson(raw);
    const keyRow = keyByPacket.get(pair.packet_id);
    if (!keyRow) throw new Error(`Missing key row for ${pair.packet_id}`);
    rows.push({
      pair_id: pair.pair_id,
      packet_id: pair.packet_id,
      packet: pair.packet,
      assignment: keyRow.assignment,
      left_label: keyRow.left_label,
      right_label: keyRow.right_label,
      parsed,
      raw,
    });
  }
  const state = {
    schema: 'machinespirits.derivation.blinded_pairwise_transcript_scores.v1',
    generated_at: new Date().toISOString(),
    packet_dir: packetDir,
    judge: options.dryRun
      ? 'dry-run'
      : `${options.judgeCli}${options.judgeModel ? `/${options.judgeModel}` : '/default'}`,
    rows,
    summary: summarizeRows(rows),
  };
  writeJson(options.out, state);
  fs.writeFileSync(
    options.report,
    renderReport({ packetDir, out: options.out, judge: state.judge, rows, summary: state.summary }),
  );
  return state;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(usage());
      process.exit(0);
    }
    if (fs.existsSync(args.out) && !args.force) {
      throw new Error(`Output already exists: ${args.out}. Pass --force to overwrite.`);
    }
    const result = await scorePairwiseTranscriptEval(args);
    process.stdout.write(`Scored ${result.rows.length} pair(s) with ${result.judge}\n`);
    process.stdout.write(`Report: ${args.report}\n`);
  } catch (err) {
    process.stderr.write(`${err.stack || err.message}\n`);
    process.exit(1);
  }
}
