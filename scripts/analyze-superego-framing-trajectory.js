#!/usr/bin/env node

/**
 * Read-only framing-trajectory recoding for the historical Writing Pad and
 * prompt-erosion cells. No model calls and no database writes.
 *
 * Usage:
 *   node scripts/analyze-superego-framing-trajectory.js \
 *     --db data/evaluations.db \
 *     --logs logs/tutor-dialogues \
 *     --coding data/paper2/superego-framing-trajectory-coding-v1.json \
 *     --output notes/2026-08-05-superego-framing-trajectory-recoding.md \
 *     --json
 *
 * Candidate preparation (does not code the cases):
 *   node scripts/analyze-superego-framing-trajectory.js \
 *     --db data/evaluations.db --logs logs/tutor-dialogues \
 *     --prepare-candidates exports/superego-framing-candidates.json
 */

import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveEvaluationDbPath, resolveTutorDialoguesDir } from '../services/evaluationDataPaths.js';
import {
  extractFramingTrajectoryChecks,
  summarizeFramingTrajectoryCodes,
} from '../services/superegoFramingTrajectoryAnalyzer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PROFILES = Object.freeze([
  'cell_21_recog_multi_unified_rewrite',
  'cell_48_base_dialectical_suspicious_unified_erosion',
  'cell_49_recog_dialectical_suspicious_unified_erosion',
]);

function parseArgs(argv) {
  const args = {
    db: null,
    logs: null,
    coding: path.join(ROOT, 'data/paper2/superego-framing-trajectory-coding-v1.json'),
    codebook: path.join(ROOT, 'config/analysis/superego-framing-trajectory-codebook-v1.json'),
    output: path.join(ROOT, 'notes/2026-08-05-superego-framing-trajectory-recoding.md'),
    prepareCandidates: null,
    samplePerProfile: 4,
    json: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === '--db') args.db = argv[++index];
    else if (token === '--logs') args.logs = argv[++index];
    else if (token === '--coding') args.coding = path.resolve(argv[++index]);
    else if (token === '--codebook') args.codebook = path.resolve(argv[++index]);
    else if (token === '--output') args.output = path.resolve(argv[++index]);
    else if (token === '--prepare-candidates') args.prepareCandidates = path.resolve(argv[++index]);
    else if (token === '--sample-per-profile') args.samplePerProfile = Number(argv[++index]);
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  return `Usage: node scripts/analyze-superego-framing-trajectory.js [options]

Options:
  --db <path>                   Evaluation database override
  --logs <path>                 Dialogue-log root or tutor-dialogues directory
  --codebook <path>             Versioned coding codebook
  --coding <path>               Completed coding ledger
  --output <path>               Markdown report path
  --json                        Write JSON beside the Markdown report
  --prepare-candidates <path>   Write eligible candidate inventory and stop
  --sample-per-profile <n>      Systematic sample size per profile (default: 4)
  --help                        Show this help

This command is read-only with respect to the database and makes no model calls.`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadTrace(logsDir, dialogueId) {
  const exact = path.join(logsDir, `${dialogueId}.json`);
  let filePath = exact;
  if (!fs.existsSync(filePath)) {
    const match = fs.readdirSync(logsDir).find((name) => name.includes(dialogueId) && name.endsWith('.json'));
    if (!match) return null;
    filePath = path.join(logsDir, match);
  }
  const bytes = fs.readFileSync(filePath);
  const parsed = JSON.parse(bytes.toString('utf8'));
  return Array.isArray(parsed.dialogueTrace)
    ? { trace: parsed.dialogueTrace, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }
    : null;
}

function loadCorpus(dbPath, logsDir) {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const placeholders = DEFAULT_PROFILES.map(() => '?').join(', ');
  const rawRows = db
    .prepare(
      `SELECT run_id, profile_name, scenario_id, dialogue_id, judge_model,
              incorporation_rate, dimension_convergence, created_at
       FROM evaluation_results
       WHERE profile_name IN (${placeholders})
         AND success = 1
         AND dialogue_id IS NOT NULL
       ORDER BY created_at, run_id, profile_name, scenario_id`,
    )
    .all(...DEFAULT_PROFILES);
  db.close();

  const uniqueRows = [];
  const seenDialogues = new Set();
  for (const row of rawRows) {
    if (seenDialogues.has(row.dialogue_id)) continue;
    seenDialogues.add(row.dialogue_id);
    uniqueRows.push(row);
  }

  const checks = [];
  let tracesLoaded = 0;
  for (const row of uniqueRows) {
    const source = loadTrace(logsDir, row.dialogue_id);
    if (!source) continue;
    tracesLoaded++;
    checks.push(
      ...extractFramingTrajectoryChecks(source.trace, {
        dialogueId: row.dialogue_id,
        runId: row.run_id,
        profileName: row.profile_name,
        scenarioId: row.scenario_id,
        sourceTraceSha256: source.sha256,
        dbIncorporationRate: row.incorporation_rate,
        dimensionConvergence: row.dimension_convergence,
      }),
    );
  }

  return {
    rawRowCount: rawRows.length,
    uniqueDialogueCount: uniqueRows.length,
    tracesLoaded,
    tracesMissing: uniqueRows.length - tracesLoaded,
    checks,
  };
}

function eligibleCandidates(checks) {
  return checks
    .filter((check) => check.requiresRevision && check.followupKind === 'immediate' && check.response && check.nextEgo)
    .sort(
      (left, right) =>
        left.profileName.localeCompare(right.profileName) ||
        left.scenarioId.localeCompare(right.scenarioId) ||
        left.dialogueId.localeCompare(right.dialogueId) ||
        left.ordinal - right.ordinal,
    );
}

function selectSystematicSample(candidates, perProfile) {
  if (!Number.isInteger(perProfile) || perProfile < 1)
    throw new Error('--sample-per-profile must be a positive integer');
  const sample = [];
  for (const profile of DEFAULT_PROFILES) {
    const group = candidates.filter((candidate) => candidate.profileName === profile);
    const take = Math.min(perProfile, group.length);
    for (let index = 0; index < take; index++) {
      const groupIndex = Math.min(group.length - 1, Math.floor(((index + 0.5) * group.length) / take));
      sample.push(group[groupIndex]);
    }
  }
  return sample;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function prepareCandidatePacket(corpus, outputPath, samplePerProfile) {
  const candidates = eligibleCandidates(corpus.checks).map((check) => ({
    ...check,
    coding_template: { check_id: check.checkId, label: null, rationale: null },
  }));
  const sample = selectSystematicSample(candidates, samplePerProfile);
  writeJson(outputPath, {
    schema_version: 'superego-framing-candidates-v1',
    generated_at: new Date().toISOString(),
    corpus: {
      raw_rows: corpus.rawRowCount,
      unique_dialogues: corpus.uniqueDialogueCount,
      traces_loaded: corpus.tracesLoaded,
      traces_missing: corpus.tracesMissing,
      all_superego_checks: corpus.checks.length,
      eligible_immediate_revision_checks: candidates.length,
    },
    sample_strategy: {
      method: 'profile-stratified systematic midpoint sampling over profile/scenario/dialogue/check sorted candidates',
      per_profile: samplePerProfile,
      selected: sample.length,
    },
    sample,
    candidates,
  });
  return { candidates: candidates.length, sample: sample.length };
}

function formatNumber(value, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function excerpt(text, limit = 180) {
  const compact = String(text || '')
    .replace(/\s+/gu, ' ')
    .trim();
  return compact.length <= limit ? compact : `${compact.slice(0, limit - 1)}…`;
}

function portableSourcePath(sourcePath) {
  const relative = path.relative(ROOT, sourcePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? relative
    : `<external>/${path.basename(sourcePath)}`;
}

function reportMarkdown({ corpus, codebook, coding, summary, dbPath, logsDir }) {
  const lines = [
    '# Superego incorporation as a framing trajectory',
    '',
    `Coding date: ${coding.coding_date}`,
    '',
    '## Scope and claim boundary',
    '',
    'This is a single-coder, read-only diagnostic over frozen simulated traces. It compares a semantic framing-trajectory code with the existing structural incorporation proxy; it does not validate a replacement metric, establish inter-rater reliability, or report a human-learning effect.',
    '',
    `- Codebook: \`${codebook.codebook_id}\` (${codebook.version})`,
    `- Coding ledger: \`${path.relative(ROOT, coding.__path)}\``,
    `- Database: \`${portableSourcePath(dbPath)}\` (opened read-only)`,
    `- Dialogue logs: \`${portableSourcePath(logsDir)}\``,
    `- Historical DB rows: ${corpus.rawRowCount}; unique dialogues: ${corpus.uniqueDialogueCount}; traces loaded: ${corpus.tracesLoaded}; missing traces: ${corpus.tracesMissing}`,
    `- Superego checks found: ${corpus.checks.length}; eligible immediate revision-demanding checks: ${eligibleCandidates(corpus.checks).length}; hand-coded sample: ${summary.codedChecks}`,
    '',
    'The five-stage vocabulary—prompt, response, learner uptake, disciplinary check, reframe—is used as an external coding frame. The coded unit is deliberately narrower: a revision-demanding superego check with both the preceding ego response and an immediate next ego response observable before another learner turn.',
    '',
    '## Results',
    '',
    `Manual reframes: **${summary.labels.reframe || 0}/${summary.codedChecks}** (${formatNumber(summary.reframeRate * 100, 1)}%); restatements: **${summary.labels.restate || 0}/${summary.codedChecks}**.`,
    '',
    '| Profile | N | Reframe | Restate | Reframe rate |',
    '|---|---:|---:|---:|---:|',
  ];

  for (const profile of DEFAULT_PROFILES) {
    const row = summary.byProfile[profile] || { total: 0, reframe: 0, restate: 0 };
    lines.push(
      `| ${profile} | ${row.total} | ${row.reframe} | ${row.restate} | ${row.total ? formatNumber((row.reframe / row.total) * 100, 1) : '—'}% |`,
    );
  }

  const matrix = summary.comparison.dialogueProxyMatrix;
  lines.push(
    '',
    '## Comparison with the existing proxy',
    '',
    '`incorporationRate` is a dialogue-level count ratio: ego revision entries divided by superego feedback entries. It does not link a particular check to the semantic content of its following response. For the coded cases:',
    '',
    '| Dialogue proxy | Manual reframe | Manual restate |',
    '|---|---:|---:|',
    `| Greater than zero | ${matrix.proxy_positive_reframe} | ${matrix.proxy_positive_restate} |`,
    `| Zero | ${matrix.proxy_zero_reframe} | ${matrix.proxy_zero_restate} |`,
    '',
    `The event-local structural signal (“an immediate ego revision entry followed this check”) agreed with the semantic code in **${summary.comparison.immediateRevisionMatches}/${summary.codedChecks}** cases (${formatNumber(summary.comparison.immediateRevisionAgreement * 100, 1)}%). A structural revision can still be a restatement; conversely, a semantic reframe can be expressed through a normal generation entry.`,
    '',
    '## Historical missingness',
    '',
    `The target rows contain **${summary.comparison.dbIncorporationAvailable}/${summary.codedChecks}** populated database values for \`incorporation_rate\` and **${summary.comparison.dimensionConvergenceAvailable}/${summary.codedChecks}** for \`dimension_convergence\`. The incorporation proxy above was therefore recomputed from the immutable trace files. Dimension convergence cannot be reconstructed from these logs because the historical rows do not contain the required per-turn rubric trajectories; it is reported as unavailable and was not backfilled.`,
    '',
    '## Coded cases',
    '',
  );

  for (const row of summary.rows) {
    lines.push(
      `### ${row.checkId} — ${row.label}`,
      '',
      `- Profile/scenario: \`${row.profileName}\` / \`${row.scenarioId}\``,
      `- Prior response: “${excerpt(row.response.text)}”`,
      `- Disciplinary check: “${excerpt(row.disciplinaryCheck.text)}”`,
      `- Next ego response: “${excerpt(row.nextEgo.text)}”`,
      `- Lexical distance: ${formatNumber(row.lexicalDistance)}; dialogue incorporation proxy: ${formatNumber(row.dialogueIncorporationRate)}`,
      `- Coding rationale: ${row.rationale}`,
      '',
    );
  }

  lines.push(
    '## Interpretation',
    '',
    'This pilot tests construct separation, not effect size. The dialogue-level incorporation proxy was positive for all 12 sampled events while semantic coding split them evenly between reframes and restatements. In this sample the count proxy is therefore non-discriminating: it records whether revision machinery fired somewhere in the dialogue, not whether this check produced a materially different framing. A second independent coder would be required before treating the manual proportions as stable empirical estimates.',
    '',
    '## Reproduction',
    '',
    '```bash',
    'npm run analyze:superego-framing -- --db /path/to/evaluations.db --logs /path/to/tutor-dialogues --json',
    '```',
    '',
    'The command makes no model calls and does not write to the evaluation database.',
    '',
  );

  return lines.join('\n');
}

export function runAnalysis(args) {
  const dbPath = resolveEvaluationDbPath(ROOT, args.db);
  const logsDir = resolveTutorDialoguesDir(ROOT, args.logs);
  const corpus = loadCorpus(dbPath, logsDir);

  if (args.prepareCandidates) {
    const counts = prepareCandidatePacket(corpus, args.prepareCandidates, args.samplePerProfile);
    return { mode: 'prepare', ...counts, path: args.prepareCandidates };
  }

  const codebook = readJson(args.codebook);
  const coding = readJson(args.coding);
  coding.__path = args.coding;
  if (coding.codebook_id !== codebook.codebook_id) {
    throw new Error(`Coding/codebook mismatch: ${coding.codebook_id} != ${codebook.codebook_id}`);
  }
  const summary = summarizeFramingTrajectoryCodes(corpus.checks, coding.rows);
  const markdown = reportMarkdown({ corpus, codebook, coding, summary, dbPath, logsDir });
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, markdown);

  const result = {
    schema_version: 'superego-framing-analysis-v1',
    codebook_id: codebook.codebook_id,
    corpus: {
      raw_rows: corpus.rawRowCount,
      unique_dialogues: corpus.uniqueDialogueCount,
      traces_loaded: corpus.tracesLoaded,
      traces_missing: corpus.tracesMissing,
      all_superego_checks: corpus.checks.length,
      eligible_immediate_revision_checks: eligibleCandidates(corpus.checks).length,
    },
    summary,
  };
  if (args.json) {
    const jsonPath = args.output.endsWith('.md') ? args.output.replace(/\.md$/u, '.json') : `${args.output}.json`;
    writeJson(jsonPath, result);
  }
  return { mode: 'analyze', result, output: args.output };
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
      return;
    }
    const outcome = runAnalysis(args);
    if (outcome.mode === 'prepare') {
      console.log(
        `Prepared ${outcome.candidates} eligible checks and ${outcome.sample} sampled cases: ${outcome.path}`,
      );
    } else {
      console.log(`Coded checks: ${outcome.result.summary.codedChecks}`);
      console.log(`Reframe rate: ${formatNumber(outcome.result.summary.reframeRate * 100, 1)}%`);
      console.log(`Report: ${outcome.output}`);
    }
  } catch (error) {
    console.error(`superego-framing-trajectory: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { DEFAULT_PROFILES, eligibleCandidates, parseArgs, reportMarkdown, selectSystematicSample };
