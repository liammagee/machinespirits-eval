#!/usr/bin/env node

/**
 * Trace-only audit of superego-critique -> immediate ego-revision links.
 * Reads the evaluation database and dialogue traces, writes only requested
 * derived reports, and makes no model/provider calls.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { format as formatWithPrettier, resolveConfig as resolvePrettierConfig } from 'prettier';
import { analyzeCritiqueRevisionLinks } from '../services/communicationTopologyTraceAnalyzer.js';
import { resolveEvaluationDbPath, resolveTutorDialoguesDir } from '../services/evaluationDataPaths.js';
import { extractFramingTrajectoryChecks } from '../services/superegoFramingTrajectoryAnalyzer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANALYSIS_DATE = '2026-09-04';
const CORPUS_CUTOFF = '2026-04-17T16:01:39.987Z';
export const TARGET_PROFILES = Object.freeze([
  'cell_22_base_suspicious_unified',
  'cell_23_recog_suspicious_unified',
  'cell_24_base_adversary_unified',
  'cell_25_recog_adversary_unified',
  'cell_26_base_advocate_unified',
  'cell_27_recog_advocate_unified',
  'cell_28_base_dialectical_suspicious_unified',
  'cell_29_recog_dialectical_suspicious_unified',
  'cell_30_base_dialectical_adversary_unified',
  'cell_31_recog_dialectical_adversary_unified',
  'cell_32_base_dialectical_advocate_unified',
  'cell_33_recog_dialectical_advocate_unified',
]);

function compare(left, right) {
  return left === right ? 0 : left < right ? -1 : 1;
}

function parseArgs(argv) {
  const args = {
    db: null,
    logs: null,
    output: path.join(ROOT, 'notes', `${ANALYSIS_DATE}-communication-topology-link-analysis.md`),
    json: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === '--db') args.db = argv[++index];
    else if (token === '--logs') args.logs = argv[++index];
    else if (token === '--output') args.output = path.resolve(argv[++index]);
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  return `Usage: node scripts/analyze-communication-topology-links.js [options]

Options:
  --db <path>       Evaluation database override
  --logs <path>     Dialogue-log root or tutor-dialogues directory
  --output <path>   Markdown report path
  --json            Write the complete per-link JSON report beside Markdown
  --help            Show this help

The command opens SQLite read-only, reads stored traces, makes no model calls,
and writes only the requested derived report files.`;
}

function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function firstPresent(rows, field) {
  return rows.map((row) => row[field]).find((value) => value !== null && value !== undefined && value !== '') ?? null;
}

function nonemptyValues(rows, field) {
  return [
    ...new Set(rows.map((row) => row[field]).filter((value) => value !== null && value !== undefined && value !== '')),
  ].sort(compare);
}

function countValues(rows, field) {
  const counts = {};
  for (const row of rows) {
    const value = row[field] || '<missing>';
    counts[value] = (counts[value] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => compare(left, right)));
}

function loadTrace(logsDir, dialogueId, fileNames) {
  const exactName = `${dialogueId}.json`;
  const name = fileNames.has(exactName)
    ? exactName
    : [...fileNames].find((candidate) => candidate.includes(dialogueId) && candidate.endsWith('.json'));
  if (!name) return null;
  const filePath = path.join(logsDir, name);
  const bytes = fs.readFileSync(filePath);
  const parsed = JSON.parse(bytes.toString('utf8'));
  if (!Array.isArray(parsed.dialogueTrace)) return null;
  return { trace: parsed.dialogueTrace, sha256: hash(bytes), fileName: name };
}

function loadCorpus(dbPath, logsDir) {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const placeholders = TARGET_PROFILES.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT id, run_id, profile_name, scenario_id, dialogue_id,
              ego_model, superego_model, judge_model, tutor_rubric_version,
              config_hash, dialogue_content_hash, incorporation_rate, created_at
       FROM evaluation_results
       WHERE profile_name IN (${placeholders})
         AND success = 1
         AND dialogue_id IS NOT NULL
         AND created_at <= ?
       ORDER BY created_at, id`,
    )
    .all(...TARGET_PROFILES, CORPUS_CUTOFF);
  db.close();

  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.dialogue_id)) grouped.set(row.dialogue_id, []);
    grouped.get(row.dialogue_id).push(row);
  }

  const fileNames = new Set(fs.readdirSync(logsDir));
  const dialogues = [];
  const checks = [];
  const conflicts = [];
  const missingTraces = [];
  for (const [dialogueId, dialogueRows] of [...grouped.entries()].sort(([left], [right]) => compare(left, right))) {
    const conflictFields = ['run_id', 'profile_name', 'scenario_id', 'ego_model', 'superego_model'].filter(
      (field) => nonemptyValues(dialogueRows, field).length > 1,
    );
    if (conflictFields.length) {
      conflicts.push({ dialogueId, fields: conflictFields });
      continue;
    }
    const source = loadTrace(logsDir, dialogueId, fileNames);
    if (!source) {
      missingTraces.push(dialogueId);
      continue;
    }
    const metadata = {
      dialogueId,
      runId: firstPresent(dialogueRows, 'run_id'),
      profileName: firstPresent(dialogueRows, 'profile_name'),
      scenarioId: firstPresent(dialogueRows, 'scenario_id'),
      sourceTraceSha256: source.sha256,
    };
    const egoModel = firstPresent(dialogueRows, 'ego_model');
    const superegoModel = firstPresent(dialogueRows, 'superego_model');
    const dialogueChecks = extractFramingTrajectoryChecks(source.trace, metadata).map((check) => ({
      ...check,
      egoModel,
      superegoModel,
    }));
    dialogues.push({
      dialogueId,
      runId: metadata.runId,
      profileName: metadata.profileName,
      scenarioId: metadata.scenarioId,
      egoModel,
      superegoModel,
      sourceTraceSha256: source.sha256,
      sourceFileName: source.fileName,
      databaseRows: dialogueRows.length,
      superegoChecks: dialogueChecks.length,
    });
    checks.push(...dialogueChecks);
  }

  return {
    audit: {
      cutoff: CORPUS_CUTOFF,
      rawRows: rows.length,
      uniqueDialogues: grouped.size,
      tracesLoaded: dialogues.length,
      tracesMissing: missingTraces.length,
      provenanceConflicts: conflicts.length,
      allSuperegoChecks: checks.length,
      configHashRows: rows.filter((row) => row.config_hash).length,
      dialogueContentHashRows: rows.filter((row) => row.dialogue_content_hash).length,
      incorporationRateRows: rows.filter((row) => Number.isFinite(row.incorporation_rate)).length,
      judgeLanes: countValues(rows, 'judge_model'),
      tutorRubricLanes: countValues(rows, 'tutor_rubric_version'),
      missingTraceDialogueIds: missingTraces,
      conflicts,
    },
    dialogues,
    checks,
  };
}

function formatNumber(value, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function portablePath(filePath) {
  const relative = path.relative(ROOT, filePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? relative
    : `<external>/${path.basename(filePath)}`;
}

function reportMarkdown(result, dbPath, logsDir, jsonPath) {
  const { corpus, analysis } = result;
  const lines = [
    '# Superego critique → ego revision: communication-link audit',
    '',
    `Analysis date: ${ANALYSIS_DATE}`,
    '',
    '## Answer',
    '',
    `Across **${analysis.eligibleLinks}** eligible immediate critique→revision links, **${analysis.testableLinks}** had at least ${analysis.minimumNullComparators} matched null comparators. Of those testable links, ${analysis.positiveTestableLinks} had positive raw lexical uptake, but critique-specific lexical association was detected for **${analysis.outcomes.lexical_association_detected}** after correction; **${analysis.outcomes.not_detected}** were not detected and **${analysis.outcomes.indeterminate}** links lacked enough matched comparisons. Among testable links, median observed uptake was ${formatNumber(analysis.medianTestableUptakeScore)} and the median link-specific null median was ${formatNumber(analysis.medianTestableNullMedian)}.`,
    '',
    'These are association results, not causal effects. They show whether a revision contains unusually link-specific lexical material from its actual critique compared with same-scenario, same-route critiques that it did not receive. They do not show that the critique caused the change.',
    '',
    '## Comparison and null fixed before outcome inspection',
    '',
    'The observed link score is the IDF-weighted share of informative critique terms that were absent from the preceding ego draft and appeared among terms newly added in the immediate ego revision. For each link, the null keeps that draft and revision fixed and substitutes the same-ordinal critique from every other eligible dialogue with the same scenario and ego/superego model route. This destroys the observed critique→revision pairing while preserving task, route, and loop position without giving longer dialogues extra comparator weight.',
    '',
    `A link is \`lexical_association_detected\` only when its score is positive, it has at least ${analysis.minimumNullComparators} null comparators, and its one-sided empirical tail probability survives Benjamini–Hochberg correction at FDR ≤ ${analysis.fdrThreshold}. Sufficient links that do not pass are \`not_detected\`; missing or too-small comparison sets are \`indeterminate\`. The complete decision for every eligible link, including trace indexes and source-trace SHA-256, is in [the per-link JSON](./${path.basename(jsonPath)}).`,
    '',
    '## Corpus and provenance',
    '',
    `- Scope: exact stored profiles \`cell_22_*\` through \`cell_33_*\`, enumerated in the script rather than inferred from substrings; successful rows with a dialogue ID through ${corpus.cutoff}.`,
    `- Database: \`${portablePath(dbPath)}\`, opened read-only; ${corpus.rawRows} rows collapsed to ${corpus.uniqueDialogues} unique dialogue IDs before trace analysis.`,
    `- Dialogue logs: \`${portablePath(logsDir)}\`, read-only; each loaded file is represented by its SHA-256 in the dialogue and per-link JSON records.`,
    `- Stored traces: ${corpus.tracesLoaded}/${corpus.uniqueDialogues} loaded; ${corpus.tracesMissing} missing; ${corpus.provenanceConflicts} database-identity conflicts.`,
    `- Trace events: ${corpus.allSuperegoChecks} superego checks total; ${analysis.eligibleLinks} revision-demanding checks had a preceding draft and immediate explicit ego revision before learner uptake.`,
    `- Historical metadata coverage: config hash on ${corpus.configHashRows}/${corpus.rawRows} rows; dialogue-content hash on ${corpus.dialogueContentHashRows}/${corpus.rawRows}; stored dialogue-level \`incorporation_rate\` on ${corpus.incorporationRateRows}/${corpus.rawRows}. Source-trace byte hashes in the JSON are therefore the per-link provenance anchor.`,
    `- Judge lanes (not used by this text-only analysis): ${Object.entries(corpus.judgeLanes)
      .map(([lane, count]) => `${lane}=${count}`)
      .join(', ')}.`,
    `- Tutor-rubric lanes (not pooled or rescored): ${Object.entries(corpus.tutorRubricLanes)
      .map(([lane, count]) => `${lane}=${count}`)
      .join(', ')}.`,
    '',
    'Cells 101–109 are not forced into this analysis: in the current `config/tutor-agents.yaml`, their `superego` configuration serves as the back-stage id director while `dialogue.enabled` is false and `max_rounds` is zero. Their stored `id_construction_trace` therefore represents a different directed link, not the superego-review→ego-revision loop tested here; it requires a separately defined comparison and null.',
    '',
    '## Results by configured profile',
    '',
    '| Profile | Eligible links | Detected | Not detected | Indeterminate | Median uptake |',
    '|---|---:|---:|---:|---:|---:|',
  ];

  for (const profileName of TARGET_PROFILES) {
    const row = analysis.byProfile[profileName] || {
      links: 0,
      lexical_association_detected: 0,
      not_detected: 0,
      indeterminate: 0,
      medianUptakeScore: null,
    };
    lines.push(
      `| ${profileName} | ${row.links} | ${row.lexical_association_detected} | ${row.not_detected} | ${row.indeterminate} | ${formatNumber(row.medianUptakeScore)} |`,
    );
  }

  lines.push(
    '',
    '## What the result can and cannot mean',
    '',
    '- `lexical_association_detected` means the actual critique aligns with the revision’s newly introduced vocabulary more strongly than matched broken links. It is evidence that the content of that communication link is observably reflected, not that the link is causally necessary.',
    '- `not_detected` is a null result for this lexical instrument, not proof that the critique was inert. A revision may comply by paraphrasing, deleting a criticized phrase, changing a structured action field, or making a semantic move without shared tokens.',
    '- Temporal succession and the `revise` action label establish ordering and execution only. They are not a no-critique intervention, so they cannot identify a causal effect.',
    '- The corpus is simulated, historically heterogeneous, and only partly covered by stored config/dialogue hashes. Judge and rubric lanes are listed for provenance but are irrelevant to, and excluded from, the text association calculation.',
    '- The earlier 12-case single-coder framing-trajectory audit (`notes/2026-08-05-superego-framing-trajectory-recoding.md`) found that structural revision firing did not distinguish semantic reframes from restatements. This link audit therefore does not promote lexical uptake into a semantic-incorporation measure.',
    '',
    '## Reproduction',
    '',
    '```bash',
    'node scripts/analyze-communication-topology-links.js --json',
    '```',
    '',
    'The command makes no model/provider calls, opens the database read-only, does not rescore historical evidence, and writes only the Markdown and JSON reports.',
    '',
    '## Per-link decisions',
    '',
    '| Link | Outcome | Uptake | Null N | p | FDR q |',
    '|---|---|---:|---:|---:|---:|',
  );
  for (const row of analysis.rows) {
    lines.push(
      `| ${row.checkId} | ${row.outcome} | ${formatNumber(row.uptakeScore)} | ${row.nullComparatorCount} | ${formatNumber(row.empiricalP)} | ${formatNumber(row.fdrQ)} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

async function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const prettierConfig = (await resolvePrettierConfig(filePath)) || {};
  const formatted = await formatWithPrettier(JSON.stringify(value), { ...prettierConfig, filepath: filePath });
  fs.writeFileSync(filePath, formatted);
}

export async function runAnalysis(args) {
  const dbPath = resolveEvaluationDbPath(ROOT, args.db);
  const logsDir = resolveTutorDialoguesDir(ROOT, args.logs);
  const corpus = loadCorpus(dbPath, logsDir);
  if (corpus.audit.provenanceConflicts > 0) {
    throw new Error(`Found ${corpus.audit.provenanceConflicts} dialogue identity conflict(s); refusing to pool them.`);
  }
  const analysis = analyzeCritiqueRevisionLinks(corpus.checks);
  const result = {
    schemaVersion: 'communication-topology-link-audit-v1',
    analysisDate: ANALYSIS_DATE,
    claimBoundary: 'Matched lexical association only; no causal intervention and no semantic-incorporation claim.',
    method: {
      observed: 'IDF-weighted critique-specific terms absent from draft and newly present in immediate revision',
      null: 'substitute same-ordinal critiques from other dialogues with the same scenario and ego/superego route while holding draft and revision fixed',
      minimumNullComparators: analysis.minimumNullComparators,
      multipleTesting: `Benjamini-Hochberg FDR ${analysis.fdrThreshold}`,
    },
    corpus: corpus.audit,
    dialogues: corpus.dialogues,
    analysis,
  };
  const jsonPath = args.output.endsWith('.md') ? args.output.replace(/\.md$/u, '.json') : `${args.output}.json`;
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, reportMarkdown(result, dbPath, logsDir, jsonPath));
  if (args.json) await writeJson(jsonPath, result);
  return { result, output: args.output, jsonPath: args.json ? jsonPath : null };
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
      return;
    }
    const outcome = await runAnalysis(args);
    console.log(`Eligible links: ${outcome.result.analysis.eligibleLinks}`);
    console.log(`Detected: ${outcome.result.analysis.outcomes.lexical_association_detected}`);
    console.log(`Not detected: ${outcome.result.analysis.outcomes.not_detected}`);
    console.log(`Indeterminate: ${outcome.result.analysis.outcomes.indeterminate}`);
    console.log(`Report: ${outcome.output}`);
    if (outcome.jsonPath) console.log(`Per-link JSON: ${outcome.jsonPath}`);
  } catch (error) {
    console.error(`communication-topology-links: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
