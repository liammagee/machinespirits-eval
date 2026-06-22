#!/usr/bin/env node
/**
 * Analyze a Plan 2.5 prefix-branch replay against its predeclared screen gate.
 *
 * This intentionally stays narrow: it reads the replay manifest, design YAML,
 * score JSON, and branch transcripts, then emits a small pass/fail report. It
 * does not call any model and does not mutate evaluation state.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import { recognitionOriginForScoreRow } from './lib/recognitionOrigin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function usage() {
  return `Usage:
  node scripts/analyze-plan25-branch-screen.js --run-dir <replay-output-dir> [--out-dir <dir>]

The run directory must contain manifest.json and the score file named by the
manifest's outputs.score field.
`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const opts = { runDir: null, outDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--run-dir':
        opts.runDir = path.resolve(argv[++i]);
        break;
      case '--out-dir':
        opts.outDir = path.resolve(argv[++i]);
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default:
        throw new Error(`Unknown arg: ${arg}\n\n${usage()}`);
    }
  }
  return opts;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readYaml(p) {
  return yaml.parse(fs.readFileSync(p, 'utf8')) || {};
}

function resolveRoot(relativeOrAbsolute) {
  return path.isAbsolute(relativeOrAbsolute)
    ? relativeOrAbsolute
    : path.resolve(ROOT, relativeOrAbsolute);
}

function rowId(row = {}) {
  return row.id || row.item_id || row.itemId || row.tid || row.condition || row.key;
}

function originFor(row = {}, transcriptText = '') {
  const transcript = String(transcriptText || '').trim();
  if (!transcript) return recognitionOriginForScoreRow(row);
  return recognitionOriginForScoreRow({
    ...row,
    actionalBreakthroughEvidence: [row.actionalBreakthroughEvidence, transcript].filter(Boolean).join('\n'),
  });
}

function scoreAt(origin, key) {
  const value = Number(origin?.scores?.[key]);
  return Number.isFinite(value) ? value : 0;
}

function aliasesForRequiredNumber(needle) {
  const s = String(needle);
  if (s === '94') {
    return ['94', 'ninety-four', 'ninety four', '940/1000', '940 over 1000', 'nine-forty over a thousand'];
  }
  if (s === '16.7') {
    return ['16.7', '17', 'seventeen', '10/(10+50)', '10/60', '10 over 60', 'ten over sixty'];
  }
  return [s];
}

function containsAllNumbers(text, numbers = []) {
  const lower = String(text || '').toLowerCase();
  return numbers.every((needle) => aliasesForRequiredNumber(needle).some((alias) => lower.includes(alias)));
}

function evalBranch({ key, criterion = {}, row, manifestBranch = {}, transcriptText }) {
  const origin = originFor(row, transcriptText);
  const form = row?.formClass || row?.form_class || 'unknown';
  const checks = [];
  const add = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });

  if (criterion.required_form) add('required_form', form === criterion.required_form, `${form} == ${criterion.required_form}`);
  if (criterion.required_origin) add('required_origin', origin.class === criterion.required_origin, `${origin.class} == ${criterion.required_origin}`);
  if (criterion.required_subtype) {
    add(
      'required_subtype',
      origin.mechanismSubtype === criterion.required_subtype,
      `${origin.mechanismSubtype} == ${criterion.required_subtype}`,
    );
  }
  if (Array.isArray(criterion.allowed_origins) && criterion.allowed_origins.length) {
    add('allowed_origins', criterion.allowed_origins.includes(origin.class), `${origin.class} in ${criterion.allowed_origins.join(', ')}`);
  }
  if (Array.isArray(criterion.allowed_subtypes) && criterion.allowed_subtypes.length) {
    add(
      'allowed_subtypes',
      criterion.allowed_subtypes.includes(origin.mechanismSubtype),
      `${origin.mechanismSubtype} in ${criterion.allowed_subtypes.join(', ')}`,
    );
  }
  if (Array.isArray(criterion.disallowed_subtypes) && criterion.disallowed_subtypes.length) {
    add(
      'disallowed_subtypes',
      !criterion.disallowed_subtypes.includes(origin.mechanismSubtype),
      `${origin.mechanismSubtype} not in ${criterion.disallowed_subtypes.join(', ')}`,
    );
  }

  const minimums = [
    ['learner_self_reframe_min', 'learnerSelfReframe'],
    ['learner_action_min', 'learnerAction'],
    ['tutor_mechanism_min', 'tutorAdaptiveMechanism'],
    ['adaptive_mechanism_quality_min', 'adaptiveMechanismQuality'],
  ];
  for (const [criterionKey, scoreKey] of minimums) {
    if (criterion[criterionKey] != null) {
      const actual = scoreAt(origin, scoreKey);
      add(criterionKey, actual >= Number(criterion[criterionKey]), `${actual} >= ${criterion[criterionKey]}`);
    }
  }

  if (Array.isArray(criterion.required_learner_numbers) && criterion.required_learner_numbers.length) {
    add(
      'required_learner_numbers',
      containsAllNumbers(transcriptText, criterion.required_learner_numbers),
      `${criterion.required_learner_numbers.join(', ')} present in transcript`,
    );
  }

  if (criterion.no_metric_repair_leak) {
    const violations = manifestBranch?.suffix_forbidden_audit?.violations || [];
    add('no_metric_repair_leak', violations.length === 0, violations.length ? violations.join(', ') : 'no violations');
  }

  return {
    key,
    pass: checks.every((check) => check.pass),
    form,
    origin: origin.class || 'unknown',
    subtype: origin.mechanismSubtype || 'unknown',
    scores: origin.scores || {},
    checks,
  };
}

function markdownReport({ runDir, scorePath, manifest, branchResults, pass }) {
  const lines = [
    '# Plan 2.5 Branch Screen Analysis',
    '',
    `Run: \`${path.relative(ROOT, runDir)}\``,
    `Score file: \`${path.relative(ROOT, scorePath)}\``,
    `Mode: \`${manifest.mode || manifest.learner_generation?.mode || 'unknown'}\``,
    `Overall: **${pass ? 'PASS' : 'FAIL'}**`,
    '',
    '| Branch | Form | Origin | Subtype | Gate |',
    '|---|---:|---:|---:|---:|',
  ];
  for (const result of branchResults) {
    lines.push(
      `| \`${result.key}\` | ${result.form} | ${result.origin} | ${result.subtype} | ${
        result.pass ? 'PASS' : 'FAIL'
      } |`,
    );
  }
  lines.push('', '## Checks', '');
  for (const result of branchResults) {
    lines.push(`### ${result.key}`, '');
    for (const check of result.checks) {
      lines.push(`- ${check.pass ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trim()}\n`;
}

function main() {
  const opts = parseArgs();
  if (opts.help) {
    process.stdout.write(usage());
    return;
  }
  if (!opts.runDir) throw new Error(`Missing --run-dir\n\n${usage()}`);
  const runDir = opts.runDir;
  const manifestPath = path.join(runDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`manifest.json not found in ${runDir}`);
  const manifest = readJson(manifestPath);
  const designPath = resolveRoot(manifest.design);
  const scorePath = resolveRoot(manifest.outputs?.score);
  if (!fs.existsSync(designPath)) throw new Error(`Design not found: ${designPath}`);
  if (!fs.existsSync(scorePath)) throw new Error(`Score file not found: ${scorePath}`);
  const design = readYaml(designPath);
  const scores = readJson(scorePath);
  const rows = new Map((scores.scored || []).map((row) => [rowId(row), row]));
  const criteria = design.success_criteria?.cheap_replay_screen || {};

  const branchResults = Object.keys(design.branches || {}).map((key) => {
    const row = rows.get(key);
    if (!row) {
      return {
        key,
        pass: false,
        form: 'missing',
        origin: 'missing',
        subtype: 'missing',
        scores: {},
        checks: [{ name: 'score_row_present', pass: false, detail: `No score row for ${key}` }],
      };
    }
    const manifestBranch = manifest.branches?.[key] || {};
    const transcriptPath = manifestBranch.transcript ? resolveRoot(manifestBranch.transcript) : null;
    const transcriptText = transcriptPath && fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, 'utf8') : '';
    return evalBranch({ key, criterion: criteria[key] || {}, row, manifestBranch, transcriptText });
  });

  const pass = branchResults.every((result) => result.pass);
  const outDir = opts.outDir || runDir;
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    schema: 'plan25_branch_screen_analysis_v0_1',
    generated_at: new Date().toISOString(),
    run_dir: path.relative(ROOT, runDir),
    design: path.relative(ROOT, designPath),
    score: path.relative(ROOT, scorePath),
    pass,
    branch_results: branchResults,
  };
  const jsonPath = path.join(outDir, 'screen-analysis.json');
  const mdPath = path.join(outDir, 'screen-analysis.md');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(mdPath, markdownReport({ runDir, scorePath, manifest, branchResults, pass }), 'utf8');

  for (const result of branchResults) {
    process.stdout.write(
      `${result.pass ? 'PASS' : 'FAIL'} ${result.key}: ${result.form}/${result.origin}/${result.subtype}\n`,
    );
  }
  process.stdout.write(`Overall: ${pass ? 'PASS' : 'FAIL'}\n`);
  process.stdout.write(`Report: ${path.relative(ROOT, mdPath)}\n`);
}

main();
