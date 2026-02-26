#!/usr/bin/env node
/**
 * validate-bug-claims.js
 *
 * Research integrity audit for paper/manifest credibility.
 *
 * What it checks:
 *  1) Manifest ↔ DB and Paper ↔ Manifest validation (delegates to validate-paper-manifest)
 *  2) Manifest ↔ Logs validation for multi-turn rows
 *  3) Judge/version + leakage + history + multi-turn bug regression checks
 *  4) Paper disclosure coverage for known major bugs
 *  5) Outstanding issue checks from bug reports + TODO.md
 *
 * Usage:
 *   node scripts/validate-bug-claims.js
 *   node scripts/validate-bug-claims.js --strict
 *   node scripts/validate-bug-claims.js --json
 *   node scripts/validate-bug-claims.js --include-all-runs
 *   node scripts/validate-bug-claims.js --skip-command-checks
 *   node scripts/validate-bug-claims.js --skip-claims-suite
 *   node scripts/validate-bug-claims.js --claim-report notes/paper-claim-audit.json
 *   node scripts/validate-bug-claims.js --color
 *   node scripts/validate-bug-claims.js --no-color
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import Database from 'better-sqlite3';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const MANIFEST_PATH = path.join(ROOT, 'config', 'paper-manifest.json');
const PAPER_PATH = path.join(ROOT, 'docs', 'research', 'paper-full.md');
const DB_PATH = path.join(ROOT, 'data', 'evaluations.db');
const LOG_DIR = path.join(ROOT, 'logs', 'tutor-dialogues');
const TODO_PATH = path.join(ROOT, 'TODO.md');
const GITIGNORE_PATH = path.join(ROOT, '.gitignore');
const NOTES_DIR = path.join(ROOT, 'notes');
const EVAL_RUNNER_PATH = path.join(ROOT, 'services', 'evaluationRunner.js');
const EVAL_CLI_PATH = path.join(ROOT, 'scripts', 'eval-cli.js');
const EVAL_RUNNER_TEST_PATH = path.join(ROOT, 'tests', 'evaluationRunner.test.js');
const TUTOR_AGENTS_PATH = path.join(ROOT, 'config', 'tutor-agents.yaml');
const ELEMENTARY_SCENARIOS_PATH = path.join(ROOT, 'content-test-elementary', 'scenarios-elementary.yaml');
const MANIFEST_VALIDATOR_PATH = path.join(ROOT, 'scripts', 'validate-paper-manifest.js');
const PAPER_TODO_NOTE_RE = /^paper-todos-\d{4}-\d{2}-\d{2}\.md$/i;

function getArgValue(argv, flag) {
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === flag) {
      return i + 1 < argv.length ? argv[i + 1] : null;
    }
    if (token.startsWith(`${flag}=`)) {
      return token.slice(flag.length + 1);
    }
  }
  return null;
}

const cliArgs = process.argv.slice(2);
const args = new Set(cliArgs);
const strictMode = args.has('--strict');
const jsonMode = args.has('--json');
const includeAllRuns = args.has('--include-all-runs');
const skipCommandChecks = args.has('--skip-command-checks');
const skipClaimsSuite = args.has('--skip-claims-suite');
const claimReportPathArg = getArgValue(cliArgs, '--claim-report');
const noColorMode = args.has('--no-color') || process.env.NO_COLOR != null;
const forceColorMode = args.has('--color') || process.env.FORCE_COLOR === '1' || process.env.CLICOLOR_FORCE === '1';
const useColor = !jsonMode && !noColorMode && (forceColorMode || Boolean(process.stdout.isTTY));

const LEAK_MARKER_RE = /\bsuperego\b|\bperspective\s+[ab]\b/i;
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function paint(text, ...codes) {
  if (!useColor || codes.length === 0) return text;
  return `${codes.join('')}${text}${ANSI.reset}`;
}

function statusColor(status) {
  if (status === 'pass') return ANSI.green;
  if (status === 'warn') return ANSI.yellow;
  return ANSI.red;
}

const report = {
  started_at: new Date().toISOString(),
  mode: {
    strict: strictMode,
    json: jsonMode,
    include_all_runs: includeAllRuns,
    skip_command_checks: skipCommandChecks,
    skip_claims_suite: skipClaimsSuite,
    claim_report_path: claimReportPathArg || null,
    color: useColor,
  },
  checks: [],
};

let passCount = 0;
let warnCount = 0;
let failCount = 0;

function record(status, id, summary, details = {}) {
  const entry = { status, id, summary, details };
  report.checks.push(entry);
  if (status === 'pass') passCount++;
  if (status === 'warn') warnCount++;
  if (status === 'fail') failCount++;

  if (!jsonMode) {
    const symbol = status === 'pass' ? '✓' : status === 'warn' ? '⚠' : '✗';
    console.log(`${paint(symbol, statusColor(status))} ${paint(`[${id}]`, ANSI.cyan)} ${summary}`);
    const keys = Object.keys(details);
    if (keys.length > 0) {
      for (const key of keys) {
        console.log(`    ${paint('-', ANSI.gray)} ${paint(`${key}:`, ANSI.gray)} ${formatDetail(details[key])}`);
      }
    }
  }
}

function formatDetail(value) {
  if (Array.isArray(value)) {
    return value.length === 0 ? '[]' : JSON.stringify(value);
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(4);
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function remediationForCheck(check) {
  const details = check.details || {};

  switch (check.id) {
    case 'manifest-paper-validator':
      return [
        'Run `node scripts/validate-paper-manifest.js --deep` and inspect the failing check IDs.',
        'Align `config/paper-manifest.json` run IDs / counts with `data/evaluations.db`.',
        'Update `docs/research/paper-full.md` claims so paper stats match the manifest scope.',
      ];

    case 'manifest-logs':
      return [
        'Regenerate or repair missing/invalid dialogue logs in `logs/tutor-dialogues/` for affected multi-turn rows.',
        'Ensure each multi-turn log has `isMultiTurn: true` and a non-empty `dialogueTrace`.',
        'Re-run `npm run -s paper:bug-audit` to confirm manifest↔logs integrity.',
      ];

    case 'judge-drift':
      return [
        'Re-judge out-of-scope rows so manifest-scoped primary rows use one judge version.',
        'Normalize judge labels with the existing `normalizeJudgeLabel()` path before analysis.',
        'Re-run integrity audit and verify `judge-drift` passes.',
      ];

    case 'learner-leakage-clean-runs':
      return [
        'Regenerate the clean dynamic-learner runs after confirming anti-leakage prompts are active.',
        'Verify no `superego`/`Perspective A/B` leakage appears in learner external turns.',
        'Replace contaminated runs in the manifest with clean reruns and re-audit.',
      ];

    case 'conversation-history-source':
    case 'conversation-history-behavior':
    case 'conversation-history-tests':
      return [
        'Restore `flattenConversationHistory()` to include both tutor and learner turns via `.flatMap()`.',
        'Update `services/evaluationRunner.js` to use the helper in dynamic learner history construction.',
        'Run `node --test tests/evaluationRunner.test.js` and confirm regression fixture passes.',
      ];

    case 'multiturn-selection-source':
      return [
        'Ensure evaluate/rejudge paths always select last suggestion for multi-turn rows.',
        'Confirm both `services/evaluationRunner.js` and `scripts/eval-cli.js` use `suggestions[suggestions.length - 1]` when `dialogueId` exists.',
        'Re-run audit to verify `multiturn-selection-source` passes.',
      ];

    case 'multiturn-holistic-coverage': {
      const topRuns = Array.isArray(details.top_runs_missing_holistic) ? details.top_runs_missing_holistic : [];
      const runHint = topRuns.length > 0
        ? `Prioritize runs: ${topRuns.map((r) => `${r.run_id} (${r.missing})`).join(', ')}.`
        : 'Prioritize runs with the largest missing holistic counts.';
      return [
        'Backfill holistic scores by re-evaluating multi-turn rows per run: `node scripts/eval-cli.js evaluate <runId> --force --multiturn-only`.',
        runHint,
        'Re-run the audit and confirm `missing_holistic` drops to 0.',
      ];
    }

    case 'multiturn-turn0-risk':
      return [
        'Re-score rows where first vs last suggestions diverge by using `evaluate --force --multiturn-only` on affected runs.',
        'Confirm `holistic_overall_score` is populated for multi-suggestion rows.',
        'Re-run audit and ensure `materially_different_without_holistic` is 0.',
      ];

    case 'paper-disclosure-bug1':
      return [
        'Add explicit disclosure in `docs/research/paper-full.md` naming Opus 4.5/4.6 drift and rejudging.',
        'Tie disclosure to affected sections/tables and updated post-fix values.',
        'Re-run audit to confirm `paper-disclosure-bug1` passes.',
      ];

    case 'paper-disclosure-bug2':
      return [
        'Add explicit disclosure of learner-pipeline bug context and clean rerun IDs (0fbca69e/bd37cc62/4e131c6f).',
        'Mark pre-fix learner-side findings as caveated upper bounds where appropriate.',
        'Re-run audit to confirm `paper-disclosure-bug2` passes.',
      ];

    case 'paper-disclosure-bug3':
      return [
        'Add explicit `.flatMap()` conversation-history bug disclosure and fix date in limitations/data-integrity sections.',
        'State that pre-fix dynamic-learner runs had broken tutor-turn visibility.',
        'Re-run audit to confirm `paper-disclosure-bug3` passes.',
      ];

    case 'paper-disclosure-bug4':
      return [
        'Add an explicit Bug 4 paragraph to `docs/research/paper-full.md` documenting `suggestions[0]` mis-scoring, last-turn fix, and `holistic_overall_score` backfill.',
        'Update findings/tables that depend on multi-turn scores to reflect post-rescore values.',
        'Re-run audit to confirm `paper-disclosure-bug4` passes.',
      ];

    case 'bug-reports-major':
      return [
        'Resolve each underlying failed bug check first (especially Bug 4 multi-turn coverage/disclosure).',
        'Keep `notes/major-bugs.md` aligned with current technical and paper status.',
        'Re-run audit and confirm `bug-reports-major` transitions to pass.',
      ];

    case 'bug-reports-resume':
      return [
        'Ensure `resumeEvaluation()` rehydrates both `egoModelOverride` and `superegoModelOverride` from run metadata.',
        'Add/keep regression coverage for resume override paths.',
        'Re-run audit to verify `bug-reports-resume` passes.',
      ];

    case 'paper-claims-run-ids':
      return [
        'Ensure every run ID cited in `docs/research/paper-full.md` exists in `data/evaluations.db` and is represented in `config/paper-manifest.json`.',
        'Remove stale/deprecated run IDs from prose and appendices, or add them to the manifest with explicit scope notes.',
        'Re-run `npm run -s paper:bug-audit -- --json --claim-report notes/paper-claim-audit.json`.',
      ];

    case 'paper-claims-n-backtrack':
      return [
        'Align `N=` claims with computed counts from manifest totals or run-scoped DB evidence.',
        'For intentional subsets (grounded/paired/balanced samples), add explicit qualifier language near the claim.',
        'Regenerate claim report and resolve all high-confidence mismatches.',
      ];

    case 'paper-claims-stats-trace':
      return [
        'Add nearby run IDs, table references, or section-local evidence anchors for untraceable statistical claims.',
        'Where values come from subsets (paired, deduped, matched), name the subset criteria in-text.',
        'Re-run claim audit and verify traceability coverage improves.',
      ];

    case 'paper-claims-bug-caveats':
      return [
        'Add caveat text near contaminated pre-fix run mentions (bug, pre-fix, upper bound, clean re-run).',
        'Prefer citing clean replacement runs in main findings; keep pre-fix runs only when historically necessary.',
        'Re-run audit and ensure all contaminated-run mentions are caveated.',
      ];

    case 'paper-claims-log-trace':
      return [
        'Repair missing or unreadable multi-turn logs for paper-cited runs in `logs/tutor-dialogues/`.',
        'Backfill `holistic_overall_score` for multi-turn rows where narrative claims depend on whole-dialogue quality.',
        'Re-run claim audit to confirm run-level log and holistic coverage.',
      ];

    case 'paper-claims-suite':
      return [
        'Open the generated claim report (`--claim-report`) and resolve failing sections first.',
        'Prioritize high-confidence mismatches, then reduce untraceable statistical claims by adding explicit evidence anchors.',
        'Re-run `paper:bug-audit` until paper claim suite passes.',
      ];

    default:
      return [
        'Inspect check details above and reproduce with `npm run -s paper:bug-audit -- --json`.',
        'Apply code/data/paper fixes for this check ID, then re-run the audit.',
      ];
  }
}

function printPracticalFixSteps() {
  const failedChecks = report.checks.filter((check) => check.status === 'fail');
  if (failedChecks.length === 0 || jsonMode) return;

  console.log('');
  console.log(paint('Practical Fix Steps', ANSI.bold, ANSI.cyan));

  failedChecks.forEach((check, idx) => {
    console.log(`${idx + 1}. ${paint(`[${check.id}]`, ANSI.cyan)} ${check.summary}`);
    const steps = remediationForCheck(check);
    for (const step of steps) {
      console.log(`   - ${step}`);
    }
  });
}

function findCheckStatus(id) {
  for (let i = report.checks.length - 1; i >= 0; i--) {
    if (report.checks[i].id === id) return report.checks[i].status;
  }
  return null;
}

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }
}

function safeParseJson(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getSuggestionText(suggestion) {
  if (suggestion == null) return '';
  if (typeof suggestion === 'string') return suggestion;
  if (typeof suggestion === 'object') {
    return (
      suggestion.message ||
      suggestion.text ||
      suggestion.content ||
      suggestion.title ||
      JSON.stringify(suggestion)
    );
  }
  return String(suggestion);
}

function tokenize(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );
}

function jaccardSimilarity(aText, bText) {
  const a = tokenize(aText);
  const b = tokenize(bText);
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function shortRunId(runId) {
  return runId.slice(-8);
}

function loadLearnerTurnsFromLog(logPath) {
  if (!fs.existsSync(logPath)) return { turns: [], missing: true };
  try {
    const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    const traceTurns = (log.dialogueTrace || [])
      .filter((entry) => entry.agent === 'learner' && typeof entry.detail === 'string')
      .map((entry) => entry.detail.trim())
      .filter(Boolean);

    if (traceTurns.length > 0) {
      return { turns: traceTurns, missing: false };
    }

    const fallbackTurns = (log.turnResults || [])
      .map((turn) => turn.learnerMessage)
      .filter((msg) => typeof msg === 'string')
      .map((msg) => msg.trim())
      .filter(Boolean);

    return { turns: fallbackTurns, missing: false };
  } catch {
    return { turns: [], missing: true };
  }
}

function buildManifestRunMeta(manifest) {
  const byRun = new Map();
  for (const evalRow of manifest.key_evaluations || []) {
    for (const runId of evalRow.run_ids || []) {
      if (!byRun.has(runId)) byRun.set(runId, []);
      byRun.get(runId).push({
        label: evalRow.label,
        section: evalRow.section,
        unit: evalRow.unit,
        expected_attempts: evalRow.expected_attempts,
        expected_scored: evalRow.expected_scored,
        note: evalRow.note || '',
      });
    }
  }
  return byRun;
}

function buildReplacementMap(manifest) {
  const replacements = new Map(); // short contaminated run id -> replacement run ids
  for (const evalRow of manifest.key_evaluations || []) {
    const note = evalRow.note || '';
    for (const match of note.matchAll(/Replaces?\s+([a-f0-9]{8})/gi)) {
      const shortId = match[1].toLowerCase();
      const existing = replacements.get(shortId) || [];
      existing.push(...(evalRow.run_ids || []));
      replacements.set(shortId, [...new Set(existing)]);
    }
  }
  return replacements;
}

function getScopeRunIds(manifest, db) {
  if (!includeAllRuns) {
    return [...new Set((manifest.key_evaluations || []).flatMap((row) => row.run_ids || []))];
  }

  const rows = db.prepare('SELECT DISTINCT run_id FROM evaluation_results WHERE run_id IS NOT NULL').all();
  return rows.map((row) => row.run_id);
}

function makeInClause(values) {
  return values.map(() => '?').join(',');
}

function runManifestValidator() {
  if (!fs.existsSync(MANIFEST_VALIDATOR_PATH)) {
    record('fail', 'manifest-paper-validator', 'scripts/validate-paper-manifest.js not found', {
      path: path.relative(ROOT, MANIFEST_VALIDATOR_PATH),
    });
    return;
  }

  const result = spawnSync(process.execPath, [MANIFEST_VALIDATOR_PATH, '--deep'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  const summaryMatch = output.match(/Summary:\s+(\d+)\s+pass,\s+(\d+)\s+warn,\s+(\d+)\s+fail/i);
  const details = {
    exit_code: result.status,
  };
  if (summaryMatch) {
    details.validator_summary = {
      pass: Number(summaryMatch[1]),
      warn: Number(summaryMatch[2]),
      fail: Number(summaryMatch[3]),
    };
  }

  if (result.status === 0) {
    record('pass', 'manifest-paper-validator', 'validate-paper-manifest passed (DB↔manifest + paper↔manifest)', details);
  } else {
    const tail = output.split('\n').slice(-20);
    details.output_tail = tail;
    record('fail', 'manifest-paper-validator', 'validate-paper-manifest failed', details);
  }
}

function checkManifestLogIntegrity(db, scopeRunIds) {
  if (scopeRunIds.length === 0) {
    record('fail', 'manifest-logs', 'No run IDs available for manifest↔logs audit');
    return;
  }

  const inClause = makeInClause(scopeRunIds);
  const rows = db
    .prepare(
      `SELECT DISTINCT dialogue_id
       FROM evaluation_results
       WHERE run_id IN (${inClause})
         AND judge_model LIKE 'claude-opus%'
         AND tutor_first_turn_score IS NOT NULL
         AND dialogue_id IS NOT NULL
         AND json_array_length(suggestions) > 1`,
    )
    .all(...scopeRunIds);

  if (rows.length === 0) {
    record('warn', 'manifest-logs', 'No multi-turn dialogue rows found to validate logs');
    return;
  }

  let missing = 0;
  let unreadable = 0;
  let noTrace = 0;
  let notMulti = 0;

  for (const row of rows) {
    const logPath = path.join(LOG_DIR, `${row.dialogue_id}.json`);
    if (!fs.existsSync(logPath)) {
      missing++;
      continue;
    }

    let log = null;
    try {
      log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    } catch {
      unreadable++;
      continue;
    }

    if (!Array.isArray(log.dialogueTrace) || log.dialogueTrace.length === 0) noTrace++;
    if (!log.isMultiTurn) notMulti++;
  }

  if (missing > 0 || unreadable > 0 || noTrace > 0) {
    record('fail', 'manifest-logs', 'Manifest multi-turn rows are not fully backed by valid dialogue logs', {
      dialogue_rows: rows.length,
      missing_logs: missing,
      unreadable_logs: unreadable,
      logs_without_trace: noTrace,
      non_multiturn_logs: notMulti,
    });
    return;
  }

  if (notMulti > 0) {
    record('warn', 'manifest-logs', 'Some dialogue logs linked to multi-turn rows are not marked isMultiTurn=true', {
      dialogue_rows: rows.length,
      non_multiturn_logs: notMulti,
    });
  } else {
    record('pass', 'manifest-logs', 'Manifest multi-turn rows are backed by valid multi-turn dialogue logs', {
      dialogue_rows: rows.length,
    });
  }
}

function checkJudgeVersionDrift(manifest, db, scopeRunIds) {
  if (scopeRunIds.length === 0) {
    record('fail', 'judge-drift', 'No run IDs available for judge drift audit');
    return;
  }

  const inClause = makeInClause(scopeRunIds);
  const rows = db
    .prepare(
      `SELECT judge_model, COUNT(*) as rows
       FROM evaluation_results
       WHERE run_id IN (${inClause})
         AND tutor_first_turn_score IS NOT NULL
         AND judge_model LIKE 'claude-opus%'
       GROUP BY judge_model
       ORDER BY rows DESC`,
    )
    .all(...scopeRunIds);

  const versions = rows.map((row) => row.judge_model).filter(Boolean);
  const has45 = versions.includes('claude-opus-4.5');
  const has46 = versions.includes('claude-opus-4.6');
  const totalRows = rows.reduce((sum, row) => sum + (row.rows || 0), 0);

  if (includeAllRuns) {
    if (versions.length > 1) {
      record('warn', 'judge-drift', 'Multiple Opus judge versions exist across all runs', {
        versions,
        rows_by_version: rows,
        note: 'Expected historically; manifest-scoped checks should use a unified primary judge.',
      });
    } else {
      record('pass', 'judge-drift', 'Single Opus judge version across all runs', {
        versions,
        rows: totalRows,
      });
    }
    return;
  }

  if (!has46) {
    record('fail', 'judge-drift', 'Manifest scope does not include Opus 4.6 primary rows', {
      versions,
      rows_by_version: rows,
      rows: totalRows,
    });
    return;
  }

  if (has45) {
    record('fail', 'judge-drift', 'Manifest scope still contains Opus 4.5 rows (version drift risk)', {
      versions,
      rows_by_version: rows,
      rows: totalRows,
    });
    return;
  }

  if (versions.length > 1) {
    record('warn', 'judge-drift', 'Manifest scope includes multiple Opus labels', {
      versions,
      rows_by_version: rows,
      rows: totalRows,
    });
    return;
  }

  record('pass', 'judge-drift', 'Manifest scope is judge-version unified (Opus 4.6 only)', {
    version: versions[0] || null,
    rows: totalRows,
  });
}

function checkLearnerLeakage(manifest, db, scopeRunIds) {
  if (scopeRunIds.length === 0) {
    record('fail', 'learner-leakage', 'No run IDs available for leakage audit');
    return;
  }

  const inClause = makeInClause(scopeRunIds);
  const dynamicRuns = db
    .prepare(
      `SELECT DISTINCT run_id
       FROM evaluation_results
       WHERE run_id IN (${inClause})
         AND judge_model LIKE 'claude-opus%'
         AND learner_architecture LIKE 'ego_superego%'`,
    )
    .all(...scopeRunIds)
    .map((row) => row.run_id);

  if (dynamicRuns.length === 0) {
    record('warn', 'learner-leakage', 'No ego_superego learner runs found in scope');
    return;
  }

  const manifestRunMeta = buildManifestRunMeta(manifest);
  const replacements = buildReplacementMap(manifest);
  const cleanExpectationRuns = new Set();
  for (const [runId, entries] of manifestRunMeta.entries()) {
    for (const entry of entries) {
      if (/clean re-run|zero learner leakage/i.test(entry.note || '')) {
        cleanExpectationRuns.add(runId);
      }
    }
  }

  const runStats = [];
  for (const runId of dynamicRuns) {
    const dialogueRows = db
      .prepare(
        `SELECT DISTINCT dialogue_id
         FROM evaluation_results
         WHERE run_id = ?
           AND judge_model LIKE 'claude-opus%'
           AND dialogue_id IS NOT NULL`,
      )
      .all(runId);

    let missingLogs = 0;
    let totalTurns = 0;
    let leakedTurns = 0;
    let dialoguesWithLeak = 0;
    let analyzedDialogues = 0;

    for (const row of dialogueRows) {
      const dialogueId = row.dialogue_id;
      const logPath = path.join(LOG_DIR, `${dialogueId}.json`);
      const { turns, missing } = loadLearnerTurnsFromLog(logPath);
      if (missing) {
        missingLogs++;
        continue;
      }
      analyzedDialogues++;
      let dialogueLeaked = false;
      for (const turnText of turns) {
        totalTurns++;
        if (LEAK_MARKER_RE.test(turnText)) {
          leakedTurns++;
          dialogueLeaked = true;
        }
      }
      if (dialogueLeaked) dialoguesWithLeak++;
    }

    const turnLeakRate = totalTurns > 0 ? leakedTurns / totalTurns : 0;
    const dialogueLeakRate = analyzedDialogues > 0 ? dialoguesWithLeak / analyzedDialogues : 0;

    runStats.push({
      run_id: runId,
      dialogues_total: dialogueRows.length,
      dialogues_analyzed: analyzedDialogues,
      dialogues_with_leak: dialoguesWithLeak,
      turns_total: totalTurns,
      turns_leaked: leakedTurns,
      turn_leak_rate: turnLeakRate,
      dialogue_leak_rate: dialogueLeakRate,
      missing_logs: missingLogs,
    });
  }

  const severeLeakRuns = runStats.filter((s) => s.turn_leak_rate >= 0.5);
  const minorLeakRuns = runStats.filter((s) => s.turn_leak_rate > 0 && s.turn_leak_rate < 0.5);
  const unexpectedLeaksInCleanRuns = runStats.filter(
    (s) => cleanExpectationRuns.has(s.run_id) && s.turn_leak_rate > 0.01,
  );

  if (unexpectedLeaksInCleanRuns.length > 0) {
    record('fail', 'learner-leakage-clean-runs', 'Clean re-runs still show leakage markers', {
      runs: unexpectedLeaksInCleanRuns.map((s) => ({
        run_id: s.run_id,
        turn_leak_pct: +(s.turn_leak_rate * 100).toFixed(1),
        dialogue_leak_pct: +(s.dialogue_leak_rate * 100).toFixed(1),
      })),
    });
  } else {
    record('pass', 'learner-leakage-clean-runs', 'Clean re-runs satisfy near-zero leakage expectation', {
      clean_runs_checked: [...cleanExpectationRuns],
    });
  }

  if (severeLeakRuns.length > 0) {
    const nonReplaced = [];
    const replaced = [];

    for (const run of severeLeakRuns) {
      const shortId = shortRunId(run.run_id).toLowerCase();
      const replacementRunIds = replacements.get(shortId);
      if (replacementRunIds && replacementRunIds.length > 0) {
        replaced.push({
          run_id: run.run_id,
          turn_leak_pct: +(run.turn_leak_rate * 100).toFixed(1),
          replaced_by: replacementRunIds,
        });
      } else {
        nonReplaced.push({
          run_id: run.run_id,
          turn_leak_pct: +(run.turn_leak_rate * 100).toFixed(1),
          dialogue_leak_pct: +(run.dialogue_leak_rate * 100).toFixed(1),
        });
      }
    }

    if (nonReplaced.length > 0) {
      record('fail', 'learner-leakage-severe', 'Severe leakage detected without declared replacements', {
        runs: nonReplaced,
      });
    }

    if (replaced.length > 0) {
      record('warn', 'learner-leakage-severe-replaced', 'Severe leakage detected in historical runs with replacements', {
        runs: replaced,
      });
    }
  } else {
    record('pass', 'learner-leakage-severe', 'No severe leakage runs detected in scope');
  }

  if (minorLeakRuns.length > 0) {
    record('warn', 'learner-leakage-minor', 'Minor leakage markers detected', {
      runs: minorLeakRuns.map((s) => ({
        run_id: s.run_id,
        turn_leak_pct: +(s.turn_leak_rate * 100).toFixed(2),
      })),
    });
  } else {
    record('pass', 'learner-leakage-minor', 'No minor leakage markers detected');
  }
}

function checkConversationHistoryRegression() {
  ensureFile(EVAL_RUNNER_PATH);
  ensureFile(EVAL_CLI_PATH);

  const runnerSource = fs.readFileSync(EVAL_RUNNER_PATH, 'utf8');
  const cliSource = fs.readFileSync(EVAL_CLI_PATH, 'utf8');

  const hasFlatMap = runnerSource.includes('function flattenConversationHistory') && runnerSource.includes('.flatMap(');
  const includesTutorRole = runnerSource.includes("{ role: 'tutor'") || runnerSource.includes('{ role: "tutor"');
  const includesLearnerRole = runnerSource.includes("{ role: 'learner'") || runnerSource.includes('{ role: "learner"');

  if (!hasFlatMap || !includesTutorRole || !includesLearnerRole) {
    record('fail', 'conversation-history-source', 'flattenConversationHistory source guard failed', {
      hasFlatMap,
      includesTutorRole,
      includesLearnerRole,
    });
  } else {
    record('pass', 'conversation-history-source', 'flattenConversationHistory source guard passed', {
      hasFlatMap,
      includesTutorRole,
      includesLearnerRole,
    });
  }

  const fnMatch = runnerSource.match(
    /function\s+flattenConversationHistory\s*\(\s*conversationHistory\s*\)\s*\{([\s\S]*?)\n\}/,
  );
  let extractedFlattenFn = null;
  if (fnMatch) {
    const body = fnMatch[1];
    try {
      extractedFlattenFn = new Function('conversationHistory', body);
    } catch (error) {
      extractedFlattenFn = null;
      record('fail', 'conversation-history-behavior', 'Could not compile flattenConversationHistory from source', {
        error: error.message,
      });
    }
  } else {
    record('fail', 'conversation-history-behavior', 'Could not locate flattenConversationHistory function body');
  }

  const sampleHistory = [
    { suggestion: { message: 'Tutor turn 1' }, learnerMessage: 'Learner turn 1' },
    { suggestion: { message: 'Tutor turn 2' }, learnerMessage: 'Learner turn 2' },
  ];

  if (extractedFlattenFn) {
    const flattened = extractedFlattenFn(sampleHistory);
    const expected = [
      { role: 'tutor', content: 'Tutor turn 1' },
      { role: 'learner', content: 'Learner turn 1' },
      { role: 'tutor', content: 'Tutor turn 2' },
      { role: 'learner', content: 'Learner turn 2' },
    ];
    const behaviorOk = JSON.stringify(flattened) === JSON.stringify(expected);

    if (!behaviorOk) {
      record('fail', 'conversation-history-behavior', 'flattenConversationHistory behavior no longer matches regression fixture', {
        expected,
        actual: flattened,
      });
    } else {
      record('pass', 'conversation-history-behavior', 'flattenConversationHistory behavior matches regression fixture');
    }
  }

  if (fs.existsSync(EVAL_RUNNER_TEST_PATH)) {
    const testSource = fs.readFileSync(EVAL_RUNNER_TEST_PATH, 'utf8');
    const hasRegressionSuite = /describe\('flattenConversationHistory'/.test(testSource);
    if (hasRegressionSuite) {
      record('pass', 'conversation-history-tests', 'Regression tests for flattenConversationHistory are present');
    } else {
      record('warn', 'conversation-history-tests', 'No flattenConversationHistory regression suite detected in tests');
    }
  } else {
    record('warn', 'conversation-history-tests', 'tests/evaluationRunner.test.js not found');
  }

  const runnerUsesLastSuggestion =
    runnerSource.includes('result.dialogueId && result.suggestions.length > 1') &&
    runnerSource.includes('result.suggestions[result.suggestions.length - 1]');
  const cliUsesLastSuggestion =
    cliSource.includes('result.dialogueId && result.suggestions?.length > 1') &&
    cliSource.includes('result.suggestions[result.suggestions.length - 1]');

  if (runnerUsesLastSuggestion && cliUsesLastSuggestion) {
    record('pass', 'multiturn-selection-source', 'evaluate/rejudge source paths select last suggestion for multi-turn rows');
  } else {
    record('fail', 'multiturn-selection-source', 'Missing last-suggestion selection guard in evaluate/rejudge code paths', {
      runnerUsesLastSuggestion,
      cliUsesLastSuggestion,
    });
  }
}

function checkMultiturnScoringAlignment(manifest, db, scopeRunIds) {
  if (scopeRunIds.length === 0) {
    record('fail', 'multiturn-alignment', 'No run IDs available for multi-turn alignment audit');
    return;
  }

  const inClause = makeInClause(scopeRunIds);
  const rows = db
    .prepare(
      `SELECT id, run_id, scenario_id, profile_name, suggestions, tutor_first_turn_score, holistic_overall_score
       FROM evaluation_results
       WHERE run_id IN (${inClause})
         AND judge_model LIKE 'claude-opus%'
         AND tutor_first_turn_score IS NOT NULL
         AND json_array_length(suggestions) > 1`,
    )
    .all(...scopeRunIds);

  if (rows.length === 0) {
    record('warn', 'multiturn-alignment', 'No multi-suggestion rows found in scope');
    return;
  }

  let holisticPresent = 0;
  let materiallyDifferentFirstLast = 0;
  let materiallyDifferentWithoutHolistic = 0;
  const missingByRun = new Map();
  const riskyRowSamples = [];

  for (const row of rows) {
    if (row.holistic_overall_score != null) {
      holisticPresent++;
    } else {
      missingByRun.set(row.run_id, (missingByRun.get(row.run_id) || 0) + 1);
    }

    const suggestions = safeParseJson(row.suggestions);
    if (!Array.isArray(suggestions) || suggestions.length < 2) continue;
    const firstText = getSuggestionText(suggestions[0]);
    const lastText = getSuggestionText(suggestions[suggestions.length - 1]);
    const similarity = jaccardSimilarity(firstText, lastText);
    const materiallyDifferent = similarity < 0.85;
    if (materiallyDifferent) {
      materiallyDifferentFirstLast++;
      if (row.holistic_overall_score == null) {
        materiallyDifferentWithoutHolistic++;
        if (riskyRowSamples.length < 5) {
          riskyRowSamples.push({
            result_id: row.id,
            run_id: row.run_id,
            scenario_id: row.scenario_id,
            profile_name: row.profile_name,
            similarity: +similarity.toFixed(3),
          });
        }
      }
    }
  }

  const missingHolistic = rows.length - holisticPresent;
  const holisticCoverage = holisticPresent / rows.length;
  const topRunsMissingHolistic = [...missingByRun.entries()]
    .map(([run_id, missing]) => ({ run_id, missing }))
    .sort((a, b) => b.missing - a.missing)
    .slice(0, 8);

  if (missingHolistic > 0) {
    record('fail', 'multiturn-holistic-coverage', 'Multi-suggestion rows missing holistic scores', {
      rows_total: rows.length,
      holistic_present: holisticPresent,
      missing_holistic: missingHolistic,
      coverage_pct: +(holisticCoverage * 100).toFixed(2),
      top_runs_missing_holistic: topRunsMissingHolistic,
    });
  } else {
    record('pass', 'multiturn-holistic-coverage', 'All multi-suggestion rows have holistic scores', {
      rows_total: rows.length,
    });
  }

  if (materiallyDifferentWithoutHolistic > 0) {
    record(
      'fail',
      'multiturn-turn0-risk',
      'Rows with materially different first/last suggestions still lack holistic score',
      {
        materially_different_rows: materiallyDifferentFirstLast,
        materially_different_without_holistic: materiallyDifferentWithoutHolistic,
        risky_row_samples: riskyRowSamples,
      },
    );
  } else {
    record('pass', 'multiturn-turn0-risk', 'No unresolved turn-0/last-turn mismatch risk detected', {
      materially_different_rows: materiallyDifferentFirstLast,
    });
  }

  const snapshotExists = db
    .prepare(
      `SELECT 1 as exists_flag
       FROM sqlite_master
       WHERE type='table' AND name='multiturn_rescore_snapshot'`,
    )
    .get();

  if (snapshotExists) {
    const snapshotProgress = db
      .prepare(
        `SELECT
           COUNT(*) as snapshot_rows,
           SUM(CASE WHEN er.holistic_overall_score IS NOT NULL THEN 1 ELSE 0 END) as with_holistic,
           SUM(CASE WHEN ABS(er.tutor_first_turn_score - m.old_overall_score) > 0.01 THEN 1 ELSE 0 END) as score_changed
         FROM multiturn_rescore_snapshot m
         JOIN evaluation_results er ON er.id = m.result_id
         WHERE er.run_id IN (${inClause})`,
      )
      .get(...scopeRunIds);

    const changedRate =
      snapshotProgress.snapshot_rows > 0 ? snapshotProgress.score_changed / snapshotProgress.snapshot_rows : 0;
    const holisticRate =
      snapshotProgress.snapshot_rows > 0 ? snapshotProgress.with_holistic / snapshotProgress.snapshot_rows : 0;

    if (snapshotProgress.snapshot_rows === 0) {
      record('warn', 'multiturn-rescore-progress', 'Rescore snapshot table exists but has no rows in scope');
    } else if (changedRate < 0.5 || holisticRate < 0.5) {
      record('warn', 'multiturn-rescore-progress', 'Rescore progress appears incomplete', {
        snapshot_rows: snapshotProgress.snapshot_rows,
        score_changed: snapshotProgress.score_changed,
        changed_pct: +(changedRate * 100).toFixed(2),
        with_holistic: snapshotProgress.with_holistic,
        holistic_pct: +(holisticRate * 100).toFixed(2),
      });
    } else {
      record('pass', 'multiturn-rescore-progress', 'Rescore progress appears substantial', {
        snapshot_rows: snapshotProgress.snapshot_rows,
        score_changed: snapshotProgress.score_changed,
        with_holistic: snapshotProgress.with_holistic,
      });
    }
  } else {
    record('warn', 'multiturn-rescore-progress', 'multiturn_rescore_snapshot table not found');
  }
}

function checkPaperDisclosureCoverage(paperText) {
  const hasJudgeBugDisclosure =
    /Opus 4\.5/i.test(paperText) &&
    /Opus 4\.6/i.test(paperText) &&
    /(version drift|rejudg|re-judg)/i.test(paperText);

  if (hasJudgeBugDisclosure) {
    record('pass', 'paper-disclosure-bug1', 'Paper discloses judge-version drift and unification');
  } else {
    record('fail', 'paper-disclosure-bug1', 'Paper missing explicit judge-version drift disclosure');
  }

  const hasLearnerPipelineDisclosure =
    /learner pipeline bugs/i.test(paperText) &&
    /(0fbca69e|bd37cc62|4e131c6f)/i.test(paperText);

  if (hasLearnerPipelineDisclosure) {
    record('pass', 'paper-disclosure-bug2', 'Paper discloses learner-pipeline bug context and clean reruns');
  } else {
    record('fail', 'paper-disclosure-bug2', 'Paper missing explicit learner-pipeline bug disclosure');
  }

  const hasConversationHistoryDisclosure =
    /flatMap/i.test(paperText) || /conversation history/i.test(paperText) || /learner only ever saw/i.test(paperText);

  if (hasConversationHistoryDisclosure) {
    record('pass', 'paper-disclosure-bug3', 'Paper explicitly documents conversation-history failure mode');
  } else {
    record('fail', 'paper-disclosure-bug3', 'Paper does not explicitly document the broken conversation-history bug');
  }

  const hasMultiturnScoringDisclosure =
    /suggestions\[0\]/i.test(paperText) ||
    /\bTurn 0\b/i.test(paperText) ||
    /holistic_overall_score/i.test(paperText) ||
    /rescoring ongoing/i.test(paperText) ||
    /8,631|8631/i.test(paperText);

  if (hasMultiturnScoringDisclosure) {
    record('pass', 'paper-disclosure-bug4', 'Paper explicitly documents multi-turn scoring misalignment');
  } else {
    record('fail', 'paper-disclosure-bug4', 'Paper does not disclose the multi-turn scoring misalignment bug');
  }

  const paradoxIndex = paperText.search(/learner superego paradox/i);
  if (paradoxIndex >= 0) {
    const windowStart = Math.max(0, paradoxIndex - 1200);
    const windowEnd = Math.min(paperText.length, paradoxIndex + 2200);
    const localWindow = paperText.slice(windowStart, windowEnd);
    const hasBugContextNearParadox = /(bug|leak|flatmap|pipeline|contaminat|pre-fix|artifact)/i.test(localWindow);
    if (hasBugContextNearParadox) {
      record('pass', 'paper-disclosure-finding9', 'Finding #9 section includes local bug-context caveat');
    } else {
      record('warn', 'paper-disclosure-finding9', 'Finding #9 appears without local bug-context caveat');
    }
  } else {
    record('warn', 'paper-disclosure-finding9', 'Could not locate "learner superego paradox" in paper text');
  }
}

function checkBugReportIssueState() {
  const majorBugsPath = path.join(NOTES_DIR, 'major-bugs.md');
  const resumeBugPath = path.join(NOTES_DIR, 'session-resume-override-bug-2026-02-23.md');

  if (!fs.existsSync(majorBugsPath)) {
    record('warn', 'bug-reports-major', 'notes/major-bugs.md not found');
  } else {
    const bugCoverage = [
      {
        bug: 'Bug 1',
        checks: ['judge-drift', 'paper-disclosure-bug1'],
      },
      {
        bug: 'Bug 2',
        checks: ['learner-leakage-clean-runs', 'paper-disclosure-bug2'],
      },
      {
        bug: 'Bug 3',
        checks: ['conversation-history-source', 'conversation-history-behavior', 'paper-disclosure-bug3'],
      },
      {
        bug: 'Bug 4',
        checks: ['multiturn-selection-source', 'multiturn-holistic-coverage', 'multiturn-turn0-risk', 'paper-disclosure-bug4'],
      },
    ];

    const unresolved = [];
    const partial = [];
    const resolved = [];
    for (const entry of bugCoverage) {
      const statuses = entry.checks.map((id) => ({ id, status: findCheckStatus(id) }));
      if (statuses.some((s) => s.status === 'fail' || s.status == null)) {
        unresolved.push({ bug: entry.bug, statuses });
      } else if (statuses.some((s) => s.status === 'warn')) {
        partial.push({ bug: entry.bug, statuses });
      } else {
        resolved.push({ bug: entry.bug, statuses });
      }
    }

    if (unresolved.length > 0) {
      record('fail', 'bug-reports-major', 'Major bug report contains unresolved bug(s)', {
        unresolved,
        resolved_count: resolved.length,
      });
    } else if (partial.length > 0) {
      record('warn', 'bug-reports-major', 'Major bug report has partially-resolved bug(s)', {
        partial,
        resolved_count: resolved.length,
      });
    } else {
      record('pass', 'bug-reports-major', 'All major bugs map to passing technical/disclosure checks', {
        resolved_count: resolved.length,
      });
    }
  }

  if (!fs.existsSync(resumeBugPath)) {
    record('warn', 'bug-reports-resume', 'Session resume bug report file not found');
    return;
  }

  const runnerSource = fs.readFileSync(EVAL_RUNNER_PATH, 'utf8');
  const hasMetaEgoOverride = /metadata\.egoModelOverride/.test(runnerSource);
  const hasMetaSuperegoOverride = /metadata\.superegoModelOverride/.test(runnerSource);
  const reappliesEgo = /targetConfigs\s*=\s*targetConfigs\.map\(\(c\)\s*=>\s*\(\{\s*\.\.\.c,\s*egoModelOverride\s*\}\)\)/.test(
    runnerSource,
  );
  const reappliesSuperego = /targetConfigs\s*=\s*targetConfigs\.map\(\(c\)\s*=>\s*\(\{\s*\.\.\.c,\s*superegoModelOverride\s*\}\)\)/.test(
    runnerSource,
  );

  if (hasMetaEgoOverride && hasMetaSuperegoOverride && reappliesEgo && reappliesSuperego) {
    record('pass', 'bug-reports-resume', 'Resume override bug fix is present in source');
  } else {
    record('fail', 'bug-reports-resume', 'Resume override bug fix appears incomplete in source', {
      hasMetaEgoOverride,
      hasMetaSuperegoOverride,
      reappliesEgo,
      reappliesSuperego,
    });
  }
}

function listTodoSources() {
  const sources = [];
  if (fs.existsSync(TODO_PATH)) {
    sources.push(TODO_PATH);
  }

  if (fs.existsSync(NOTES_DIR)) {
    const noteCandidates = fs
      .readdirSync(NOTES_DIR)
      .filter((name) => PAPER_TODO_NOTE_RE.test(name))
      .sort();
    if (noteCandidates.length > 0) {
      const latest = noteCandidates[noteCandidates.length - 1];
      sources.push(path.join(NOTES_DIR, latest));
    }
  }

  return sources;
}

function collectOutstandingTodoItems(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  const source = path.relative(ROOT, filePath);
  const items = [];

  let inActionNeededBlock = false;
  let actionListStarted = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const checkboxMatch = line.match(/^\s*-\s+\[\s\]\s+(.*)$/);
    if (checkboxMatch) {
      items.push({
        source,
        line: i + 1,
        text: checkboxMatch[1].trim(),
        kind: 'checkbox',
      });
    }

    if (/action needed/i.test(line)) {
      inActionNeededBlock = true;
      actionListStarted = false;
      continue;
    }

    if (!inActionNeededBlock) continue;

    const numberedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (numberedMatch) {
      actionListStarted = true;
      items.push({
        source,
        line: i + 1,
        text: numberedMatch[1].trim(),
        kind: 'action-needed',
      });
      continue;
    }

    if (/^#{1,6}\s+/.test(line) || /^\*\*Priority\s+\d+/i.test(line) || /^\s*---\s*$/.test(line)) {
      inActionNeededBlock = false;
      actionListStarted = false;
      continue;
    }

    if (actionListStarted && line.trim() !== '') {
      inActionNeededBlock = false;
      actionListStarted = false;
    }
  }

  return items;
}

function checkTodoIssueState() {
  const todoSources = listTodoSources();
  if (todoSources.length === 0) {
    record('warn', 'todo-issues', 'No TODO sources found (TODO.md or notes/paper-todos-YYYY-MM-DD.md)');
    return;
  }

  const unchecked = [];
  for (const sourcePath of todoSources) {
    unchecked.push(...collectOutstandingTodoItems(sourcePath));
  }

  if (unchecked.length === 0) {
    record('pass', 'todo-issues', 'No outstanding TODO items found in configured sources');
    return;
  }

  const runnerSource = fs.existsSync(EVAL_RUNNER_PATH) ? fs.readFileSync(EVAL_RUNNER_PATH, 'utf8') : '';
  const tutorAgentsText = fs.existsSync(TUTOR_AGENTS_PATH) ? fs.readFileSync(TUTOR_AGENTS_PATH, 'utf8') : '';
  const gitignoreText = fs.existsSync(GITIGNORE_PATH) ? fs.readFileSync(GITIGNORE_PATH, 'utf8') : '';
  const paperText = fs.existsSync(PAPER_PATH) ? fs.readFileSync(PAPER_PATH, 'utf8') : '';

  let elementaryDoc = null;
  if (fs.existsSync(ELEMENTARY_SCENARIOS_PATH)) {
    try {
      elementaryDoc = YAML.parse(fs.readFileSync(ELEMENTARY_SCENARIOS_PATH, 'utf8'));
    } catch {
      elementaryDoc = null;
    }
  }

  let validateConfigResult = null;
  const hasValidateConfigTodo = unchecked.some((item) => /validate with `eval-cli\.js validate-config`/i.test(item.text));
  if (hasValidateConfigTodo && !skipCommandChecks) {
    validateConfigResult = spawnSync(process.execPath, [EVAL_CLI_PATH, 'validate-config'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  }

  const addressedButUnchecked = [];
  const unresolved = [];
  const manual = [];

  function addOutcome(bucket, item, detail) {
    bucket.push({
      source: item.source,
      line: item.line,
      text: item.text,
      detail,
    });
  }

  for (const item of unchecked) {
    const text = item.text;

    if (/Define cells 80-81 in `tutor-agents\.yaml`/i.test(text)) {
      const has80 = /cell_80/i.test(tutorAgentsText);
      const has81 = /cell_81/i.test(tutorAgentsText);
      if (has80 && has81) {
        addOutcome(addressedButUnchecked, item, 'cell_80 and cell_81 found in tutor-agents.yaml');
      } else {
        addOutcome(unresolved, item, { has_cell_80: has80, has_cell_81: has81 });
      }
      continue;
    }

    if (/Register cells 80-81 in `EVAL_ONLY_PROFILES`/i.test(text)) {
      const has80 = /['"]cell_80/i.test(runnerSource);
      const has81 = /['"]cell_81/i.test(runnerSource);
      if (has80 && has81) {
        addOutcome(addressedButUnchecked, item, 'cell_80 and cell_81 found in EVAL_ONLY_PROFILES');
      } else {
        addOutcome(unresolved, item, { has_cell_80: has80, has_cell_81: has81 });
      }
      continue;
    }

    if (/Author additional math scenarios/i.test(text)) {
      const scenarioCount = elementaryDoc?.scenarios ? Object.keys(elementaryDoc.scenarios).length : 0;
      if (scenarioCount >= 10) {
        addOutcome(addressedButUnchecked, item, `elementary scenario count=${scenarioCount}`);
      } else {
        addOutcome(unresolved, item, `elementary scenario count=${scenarioCount} (expected >=10)`);
      }
      continue;
    }

    if (/Ensure scenario structure matches core scenarios/i.test(text)) {
      if (!elementaryDoc?.scenarios) {
        addOutcome(unresolved, item, 'Could not parse elementary scenarios file');
      } else {
        const issues = [];
        for (const [scenarioId, scenario] of Object.entries(elementaryDoc.scenarios)) {
          for (const required of ['id', 'type', 'name', 'description', 'expected_behavior']) {
            if (!scenario?.[required]) issues.push(`${scenarioId}:missing_${required}`);
          }
          if (!scenario?.course_ids && !scenario?.current_content) {
            issues.push(`${scenarioId}:missing_content_scope`);
          }
        }
        if (issues.length === 0) {
          addOutcome(addressedButUnchecked, item, 'All elementary scenarios include required structural fields');
        } else {
          addOutcome(unresolved, item, { issue_count: issues.length, sample: issues.slice(0, 5) });
        }
      }
      continue;
    }

    if (/Validate with `eval-cli\.js validate-config`/i.test(text)) {
      if (skipCommandChecks) {
        addOutcome(manual, item, '--skip-command-checks enabled; command execution skipped');
      } else if (!validateConfigResult) {
        addOutcome(manual, item, 'validate-config command did not execute');
      } else if (validateConfigResult.status === 0) {
        addOutcome(addressedButUnchecked, item, 'validate-config command exits successfully');
      } else {
        const output = `${validateConfigResult.stdout || ''}\n${validateConfigResult.stderr || ''}`.trim();
        addOutcome(unresolved, item, {
          exit_code: validateConfigResult.status,
          output_tail: output.split('\n').slice(-8),
        });
      }
      continue;
    }

    if (/data\/evaluations\.db\.bak-\*/i.test(text)) {
      const dataDir = path.join(ROOT, 'data');
      const backups = fs.existsSync(dataDir)
        ? fs.readdirSync(dataDir).filter((name) => /^evaluations\.db\.bak/i.test(name))
        : [];
      const ignored = /\.db\.bak\*/.test(gitignoreText);
      if (backups.length > 0 && ignored) {
        addOutcome(addressedButUnchecked, item, { backups: backups.length, gitignored: true });
      } else {
        addOutcome(unresolved, item, { backups: backups.length, gitignored: ignored });
      }
      continue;
    }

    if (/Rewrite Tables 29,\s*30,\s*31 with above data/i.test(text)) {
      const hasNewCellMeans =
        /\b69\.2\b/.test(paperText) && /\b69\.7\b/.test(paperText) && /\b45\.5\b/.test(paperText) && /\b47\.4\b/.test(paperText);
      const hasLegacyCellMeans = /\b38\.0\b/.test(paperText);
      if (hasNewCellMeans && !hasLegacyCellMeans) {
        addOutcome(addressedButUnchecked, item, 'New post-fix Table 29-31 values detected in paper');
      } else {
        addOutcome(unresolved, item, { has_new_values: hasNewCellMeans, has_legacy_indicator_M38: hasLegacyCellMeans });
      }
      continue;
    }

    if (/Recompute F-statistics properly/i.test(text)) {
      const hasLegacyF = /F\s*=\s*11\.50/i.test(paperText);
      const hasUpdatedInteractionNarrative =
        /interaction d\s*=\s*0\.20/i.test(paperText) || /interaction.*(?:n\.s\.|non-significant)/i.test(paperText);
      if (!hasLegacyF && hasUpdatedInteractionNarrative) {
        addOutcome(addressedButUnchecked, item, 'Legacy F=11.50 removed and updated interaction narrative detected');
      } else if (hasLegacyF) {
        addOutcome(unresolved, item, { legacy_f_11_50_present: true, updated_interaction_narrative: hasUpdatedInteractionNarrative });
      } else {
        addOutcome(manual, item, 'No explicit legacy F-stat found; ANOVA recomputation still requires manual verification');
      }
      continue;
    }

    if (/Rewrite §6\.16 narrative:.*recognition doesn't rescue/i.test(text)) {
      const stillClaimsRescue = /recognition (?:partially )?rescues/i.test(paperText);
      const hasNoRescueClaim = /recognition (?:does not|doesn't|has essentially zero effect)/i.test(paperText);
      if (!stillClaimsRescue && hasNoRescueClaim) {
        addOutcome(addressedButUnchecked, item, '§6.16 appears updated to no-rescue interpretation');
      } else {
        addOutcome(unresolved, item, { rescue_language_present: stillClaimsRescue, no_rescue_language_present: hasNoRescueClaim });
      }
      continue;
    }

    if (/Rewrite §6\.16 simple effects paragraph/i.test(text)) {
      const hasLegacySimpleEffects = /multi-agent.*\+9\.5|single-agent.*-1\.3/i.test(paperText);
      if (hasLegacySimpleEffects) {
        addOutcome(unresolved, item, { legacy_simple_effects_present: true });
      } else {
        addOutcome(manual, item, 'Simple-effects rewrite cannot be fully validated automatically');
      }
      continue;
    }

    if (/Rewrite Finding #9 conclusion text/i.test(text)) {
      const legacyFinding9 = /recognition partially counteracts/i.test(paperText);
      if (legacyFinding9) {
        addOutcome(unresolved, item, { legacy_phrase_present: true });
      } else {
        addOutcome(manual, item, 'Finding #9 rewrite requires semantic/manual review');
      }
      continue;
    }

    if (/Remove "recognition partially rescues" language throughout/i.test(text)) {
      const matches = paperText.match(/recognition partially rescues/gi) || [];
      if (matches.length === 0) {
        addOutcome(addressedButUnchecked, item, 'No exact "recognition partially rescues" phrase found');
      } else {
        addOutcome(unresolved, item, { occurrences: matches.length });
      }
      continue;
    }

    if (/§6\.16\.1 "Recognition Inversion".*check if still valid/i.test(text)) {
      addOutcome(manual, item, 'Requires rerun/data-level validation beyond static paper checks');
      continue;
    }

    if (/Update §6\.11 line 1098.*M=38\.0/i.test(text)) {
      const hasM38 = /M\s*=\s*38\.0/.test(paperText);
      if (hasM38) {
        addOutcome(unresolved, item, { legacy_m_38_present: true });
      } else {
        addOutcome(addressedButUnchecked, item, 'Legacy M=38.0 narrative removed from paper');
      }
      continue;
    }

    if (/Replace Table 19 with clean data/i.test(text)) {
      const hasNewTable19 = /\b54\.1\b/.test(paperText) && /\b56\.5\b/.test(paperText) && /\b63\.4\b/.test(paperText);
      const hasOldTable19 = /\b75\.5\b/.test(paperText) || /\b73\.9\b/.test(paperText) || /\b88\.8\b/.test(paperText);
      if (hasNewTable19 && !hasOldTable19) {
        addOutcome(addressedButUnchecked, item, 'Table 19 appears updated to clean-regeneration values');
      } else {
        addOutcome(unresolved, item, { has_new_values: hasNewTable19, has_old_values: hasOldTable19 });
      }
      continue;
    }

    if (/Update §6\.10 prose interpreting Table 19/i.test(text)) {
      const legacyMechanismOrdering = /profiling and combined mechanisms reaching 88\.8 and 87\.8/i.test(paperText);
      if (legacyMechanismOrdering) {
        addOutcome(unresolved, item, { legacy_ordering_phrase_present: true });
      } else {
        addOutcome(manual, item, '§6.10 prose update requires semantic/manual verification');
      }
      continue;
    }

    if (/Update the "profiling and combined mechanisms reaching 88\.8 and 87\.8" narrative/i.test(text)) {
      const legacyPhrase = /profiling and combined mechanisms reaching 88\.8 and 87\.8/i.test(paperText);
      if (legacyPhrase) {
        addOutcome(unresolved, item, { legacy_phrase_present: true });
      } else {
        addOutcome(addressedButUnchecked, item, 'Legacy 88.8/87.8 narrative phrase not found');
      }
      continue;
    }

    if (/Update Finding #12 conclusion text/i.test(text)) {
      addOutcome(manual, item, 'Finding #12 update requires manual semantic comparison to clean Table 19');
      continue;
    }

    if (/Remove\/update §6\.10 footnote about "original runs; clean re-runs produce comparable tutor-side scores"/i.test(text)) {
      const legacyFootnote = /Table 19 tutor-side scores below are from the original runs; the bugs affected the learner's behavior but the tutor's generation path was independent/i.test(
        paperText,
      );
      if (legacyFootnote) {
        addOutcome(unresolved, item, { legacy_footnote_present: true });
      } else {
        addOutcome(addressedButUnchecked, item, 'Legacy "original runs" Table 19 footnote not found');
      }
      continue;
    }

    addOutcome(manual, item, 'No automatic detector for this TODO item');
  }

  if (unresolved.length > 0) {
    record('warn', 'todo-issues-unresolved', 'Unchecked TODO items remain unresolved', {
      count: unresolved.length,
      sources: [...new Set(unresolved.map((item) => item.source))],
      items: unresolved,
    });
  } else {
    record('pass', 'todo-issues-unresolved', 'No unresolved TODO items detected by automatic checks');
  }

  if (addressedButUnchecked.length > 0) {
    record('warn', 'todo-issues-stale', 'Unchecked TODO items appear already addressed (stale checkboxes)', {
      count: addressedButUnchecked.length,
      sources: [...new Set(addressedButUnchecked.map((item) => item.source))],
      items: addressedButUnchecked,
    });
  } else {
    record('pass', 'todo-issues-stale', 'No stale unchecked TODO items detected');
  }

  if (manual.length > 0) {
    record('warn', 'todo-issues-manual', 'Unchecked TODO items require manual verification', {
      count: manual.length,
      sources: [...new Set(manual.map((item) => item.source))],
      items: manual,
    });
  } else {
    record('pass', 'todo-issues-manual', 'All unchecked TODO items were automatically classified');
  }
}

function splitPaperForClaims(paperText) {
  const appendixEMatch = paperText.match(/^##\s+Appendix E\b/m);
  if (!appendixEMatch) {
    return { body: paperText, appendix: '' };
  }
  const index = paperText.indexOf(appendixEMatch[0]);
  return {
    body: paperText.slice(0, index),
    appendix: paperText.slice(index),
  };
}

function parsePaperLinesWithSections(text) {
  const lines = text.split('\n');
  const out = [];
  let sectionHeading = 'front matter';
  let sectionNumber = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      sectionHeading = headingMatch[1].trim();
      const sectionMatch = sectionHeading.match(/^(\d+(?:\.\d+)*)\b/);
      sectionNumber = sectionMatch ? sectionMatch[1] : null;
    }
    out.push({
      line_no: i + 1,
      text: line,
      section_heading: sectionHeading,
      section_number: sectionNumber,
    });
  }

  return out;
}

function getLineWindow(lines, lineNo, before = 2, after = 2) {
  const start = Math.max(1, lineNo - before);
  const end = Math.min(lines.length, lineNo + after);
  return lines.slice(start - 1, end);
}

function lineWindowText(lines, lineNo, before = 2, after = 2) {
  return getLineWindow(lines, lineNo, before, after)
    .map((line) => line.text)
    .join('\n');
}

function extractRunMentions(lines) {
  const mentions = [];
  const runIdsByLine = new Map();
  const runMentionsByLine = new Map();

  for (const line of lines) {
    const runIds = new Set();
    const re = /\beval-\d{4}-\d{2}-\d{2}-[a-f0-9]{8}\b/gi;
    for (const match of line.text.matchAll(re)) {
      const runId = match[0];
      runIds.add(runId);
      if (!runMentionsByLine.has(line.line_no)) runMentionsByLine.set(line.line_no, []);
      runMentionsByLine.get(line.line_no).push({
        run_id: runId,
        match_index: match.index,
      });
      mentions.push({
        run_id: runId,
        match_index: match.index,
        line_no: line.line_no,
        section_heading: line.section_heading,
        section_number: line.section_number,
        line_text: line.text.trim(),
      });
    }
    if (runIds.size > 0) {
      runIdsByLine.set(line.line_no, runIds);
    }
  }

  return { mentions, runIdsByLine, runMentionsByLine };
}

function extractNClaims(lines) {
  const claims = [];
  const nRe = /\bN\s*[=≈]\s*(\d[\d,]*)(\+)?/g;

  for (const line of lines) {
    for (const match of line.text.matchAll(nRe)) {
      claims.push({
        claim_text: match[0],
        value: Number(match[1].replace(/,/g, '')),
        lower_bound: Boolean(match[2]),
        match_index: match.index,
        line_no: line.line_no,
        section_heading: line.section_heading,
        section_number: line.section_number,
        line_text: line.text.trim(),
      });
    }
  }

  return claims;
}

function extractStatClaims(lines) {
  const claims = [];
  const statRe =
    /(?:\b(?:d|r)\s*=\s*-?\d+(?:\.\d+)?|\bF(?:\([^)]+\))?\s*=\s*\d+(?:\.\d+)?|\bp\s*(?:<|>|≈|=)\s*(?:\d+(?:\.\d+)?|\.\d+)|\b(?:eta|η)\^?2\s*=\s*(?:\d+(?:\.\d+)?|\.\d+))/gi;

  for (const line of lines) {
    for (const match of line.text.matchAll(statRe)) {
      claims.push({
        claim_text: match[0],
        line_no: line.line_no,
        section_heading: line.section_heading,
        section_number: line.section_number,
        line_text: line.text.trim(),
      });
    }
  }

  return claims;
}

function findNearbyRunIds(runIdsByLine, lineNo, radius = 2) {
  const runIds = new Set();
  const start = Math.max(1, lineNo - radius);
  const end = lineNo + radius;
  for (let line = start; line <= end; line++) {
    const ids = runIdsByLine.get(line);
    if (!ids) continue;
    for (const runId of ids) runIds.add(runId);
  }
  return [...runIds];
}

function buildManifestSectionMap(manifest) {
  const map = new Map();

  for (const evalRow of manifest.key_evaluations || []) {
    const sections = String(evalRow.section || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const section of sections) {
      if (!map.has(section)) map.set(section, new Set());
      for (const runId of evalRow.run_ids || []) {
        map.get(section).add(runId);
      }
    }
  }

  return map;
}

function findRunsForSection(sectionMap, sectionNumber) {
  if (!sectionNumber) return [];

  const runIds = new Set();
  for (const [section, ids] of sectionMap.entries()) {
    if (
      section === sectionNumber ||
      section.startsWith(`${sectionNumber}.`) ||
      sectionNumber.startsWith(`${section}.`)
    ) {
      for (const runId of ids) runIds.add(runId);
    }
  }

  return [...runIds];
}

function buildRunEvidenceIndex(db, runIds, manifestRunMeta) {
  const index = new Map();
  const statsStmt = db.prepare(
    `SELECT
       COUNT(*) as total_rows,
       SUM(CASE WHEN tutor_first_turn_score IS NOT NULL THEN 1 ELSE 0 END) as scored_rows,
       SUM(CASE WHEN learner_overall_score IS NOT NULL THEN 1 ELSE 0 END) as learner_scored_rows,
       SUM(CASE WHEN dialogue_id IS NOT NULL THEN 1 ELSE 0 END) as dialogue_rows,
       SUM(CASE WHEN dialogue_id IS NOT NULL AND json_array_length(suggestions) > 1 THEN 1 ELSE 0 END) as multiturn_rows,
       SUM(CASE WHEN dialogue_id IS NOT NULL AND json_array_length(suggestions) > 1 AND holistic_overall_score IS NOT NULL THEN 1 ELSE 0 END) as multiturn_with_holistic,
       SUM(
         CASE
           WHEN tutor_first_turn_score IS NOT NULL
             AND (scenario_id LIKE '%grounded%' OR profile_name LIKE '%grounded%')
           THEN 1 ELSE 0
         END
       ) as grounded_rows,
       MIN(created_at) as first_created_at,
       MAX(created_at) as last_created_at
     FROM evaluation_results
     WHERE run_id = ?`,
  );
  const judgeStmt = db.prepare(
    `SELECT judge_model, COUNT(*) as rows
     FROM evaluation_results
     WHERE run_id = ? AND judge_model IS NOT NULL
     GROUP BY judge_model
     ORDER BY rows DESC`,
  );
  const runStmt = db.prepare(
    `SELECT id, status, created_at, completed_at
     FROM evaluation_runs
     WHERE id = ?`,
  );

  for (const runId of runIds) {
    const stats = statsStmt.get(runId) || {};
    const judges = judgeStmt.all(runId).map((row) => row.judge_model);
    const runRow = runStmt.get(runId) || null;
    const manifestEntries = manifestRunMeta.get(runId) || [];
    const manifestExpectedScoredValues = [
      ...new Set(
        manifestEntries
          .map((entry) => Number(entry.expected_scored))
          .filter((value) => Number.isFinite(value)),
      ),
    ];
    const manifestExpectedAttemptValues = [
      ...new Set(
        manifestEntries
          .map((entry) => Number(entry.expected_attempts))
          .filter((value) => Number.isFinite(value)),
      ),
    ];

    index.set(runId, {
      run_id: runId,
      in_evaluation_runs: Boolean(runRow),
      run_status: runRow?.status || null,
      run_created_at: runRow?.created_at || null,
      run_completed_at: runRow?.completed_at || null,
      total_rows: Number(stats.total_rows || 0),
      scored_rows: Number(stats.scored_rows || 0),
      learner_scored_rows: Number(stats.learner_scored_rows || 0),
      dialogue_rows: Number(stats.dialogue_rows || 0),
      multiturn_rows: Number(stats.multiturn_rows || 0),
      multiturn_with_holistic: Number(stats.multiturn_with_holistic || 0),
      grounded_rows: Number(stats.grounded_rows || 0),
      first_created_at: stats.first_created_at || null,
      last_created_at: stats.last_created_at || null,
      judge_models: judges,
      manifest_entries: manifestEntries,
      manifest_expected_scored_values: manifestExpectedScoredValues,
      manifest_expected_attempt_values: manifestExpectedAttemptValues,
    });
  }

  return index;
}

function aggregateRunEvidence(runIds, runEvidenceIndex) {
  const aggregate = {
    run_ids: [],
    total_rows: 0,
    scored_rows: 0,
    learner_scored_rows: 0,
    grounded_rows: 0,
    dialogue_rows: 0,
    multiturn_rows: 0,
    multiturn_with_holistic: 0,
    manifest_expected_scored_values: new Set(),
    manifest_expected_attempt_values: new Set(),
  };

  for (const runId of runIds) {
    const evidence = runEvidenceIndex.get(runId);
    if (!evidence) continue;
    aggregate.run_ids.push(runId);
    aggregate.total_rows += evidence.total_rows;
    aggregate.scored_rows += evidence.scored_rows;
    aggregate.learner_scored_rows += evidence.learner_scored_rows;
    aggregate.grounded_rows += evidence.grounded_rows;
    aggregate.dialogue_rows += evidence.dialogue_rows;
    aggregate.multiturn_rows += evidence.multiturn_rows;
    aggregate.multiturn_with_holistic += evidence.multiturn_with_holistic;
    for (const value of evidence.manifest_expected_scored_values) aggregate.manifest_expected_scored_values.add(value);
    for (const value of evidence.manifest_expected_attempt_values) aggregate.manifest_expected_attempt_values.add(value);
  }

  return {
    ...aggregate,
    manifest_expected_scored_values: [...aggregate.manifest_expected_scored_values],
    manifest_expected_attempt_values: [...aggregate.manifest_expected_attempt_values],
  };
}

function hasPaperTotalCue(text) {
  return /(primary scored|fifty key evaluations|key evaluations above)/i.test(text);
}

function hasDatabaseTotalCue(text) {
  return /(7,000\+|total evaluation database|complete database contains|across all development runs|full evaluation database including historical development runs)/i.test(
    text,
  );
}

function hasLearnerCue(text) {
  return /(learner[-\s]side|learner rubric|learner quality|learner[-\s]scored|learner turn)/i.test(text);
}

function hasGroundedCue(text) {
  return /\bgrounded\b/i.test(text);
}

function hasSubsampleCue(text) {
  return /(balanced|used in analysis|matched scenarios|matched|paired|subset|filtered|grounded|dedup|deduplic|n\$\s*[<>]=|per cell|cell sizes range)/i.test(
    text,
  );
}

function evaluateNClaimsBacktracking({
  nClaims,
  lines,
  runMentionsByLine,
  runEvidenceIndex,
  manifest,
  sectionMap,
  dbTotals,
}) {
  const outcomes = [];

  for (const claim of nClaims) {
    const context = lineWindowText(lines, claim.line_no, 2, 2);
    const sectionRuns = findRunsForSection(sectionMap, claim.section_number);
    const lowerContext = context.toLowerCase();
    const lineText = claim.line_text || '';
    const claimStart = Number.isInteger(claim.match_index) ? claim.match_index : lineText.indexOf(claim.claim_text);
    const localStart = Math.max(0, claimStart - 48);
    const localEnd = Math.min(lineText.length, claimStart + claim.claim_text.length + 72);
    const localContext = lineText.slice(localStart, localEnd).toLowerCase();
    const cueContext = `${localContext}\n${lowerContext}`;
    const sameLineMentions = runMentionsByLine.get(claim.line_no) || [];
    const nearbyRunIds = [
      ...new Set(
        sameLineMentions
          .filter((mention) => {
            if (!Number.isInteger(claimStart) || claimStart < 0) return true;
            return Math.abs(mention.match_index - claimStart) <= 120;
          })
          .map((mention) => mention.run_id),
      ),
    ];
    const lineNCount = (lineText.match(/\bN\s*[=≈]\s*\d[\d,]*\+?/g) || []).length;
    const manifestTotal = Number(manifest?.totals?.expected_scored || 0);
    const dbExpected = /scored/i.test(cueContext) ? Number(dbTotals.scored || 0) : Number(dbTotals.attempts || 0);
    const paperCue = hasPaperTotalCue(localContext);
    const dbCue = hasDatabaseTotalCue(localContext);
    const details = {
      line_no: claim.line_no,
      section: claim.section_number || claim.section_heading,
      claim: claim.claim_text,
      value: claim.value,
      lower_bound: claim.lower_bound,
      nearby_run_ids: nearbyRunIds,
    };

    if (paperCue && dbCue) {
      const preferPaper = claim.value === manifestTotal || Math.abs(claim.value - manifestTotal) <= Math.abs(claim.value - dbExpected);
      const expected = preferPaper ? manifestTotal : dbExpected;
      const pass = claim.lower_bound ? expected >= claim.value : claim.value === expected;
      outcomes.push({
        status: pass ? 'pass' : 'warn',
        reason: preferPaper ? 'paper-total-mixed-cue' : 'db-total-mixed-cue',
        ...details,
        expected,
      });
      continue;
    }

    if (dbCue) {
      const expected = dbExpected;
      const pass = claim.lower_bound ? expected >= claim.value : claim.value === expected;
      outcomes.push({
        status: pass ? 'pass' : 'fail',
        reason: 'db-total',
        ...details,
        expected,
      });
      continue;
    }

    if (paperCue) {
      const expected = manifestTotal;
      const pass = claim.lower_bound ? expected >= claim.value : claim.value === expected;
      outcomes.push({
        status: pass ? 'pass' : 'fail',
        reason: 'paper-total',
        ...details,
        expected,
      });
      continue;
    }

    if (nearbyRunIds.length > 0) {
      const aggregate = aggregateRunEvidence(nearbyRunIds, runEvidenceIndex);
      const targetCounts = [
        { label: 'db_scored_rows', value: aggregate.scored_rows },
        { label: 'db_total_rows', value: aggregate.total_rows },
        { label: 'db_learner_scored_rows', value: aggregate.learner_scored_rows },
      ];
      for (const value of aggregate.manifest_expected_scored_values) {
        targetCounts.push({ label: 'manifest_expected_scored', value });
      }
      for (const value of aggregate.manifest_expected_attempt_values) {
        targetCounts.push({ label: 'manifest_expected_attempts', value });
      }
      if (hasGroundedCue(lowerContext)) {
        targetCounts.push({ label: 'db_grounded_rows', value: aggregate.grounded_rows });
      }

      const exact = targetCounts.find((target) => target.value === claim.value);
      if (exact) {
        outcomes.push({
          status: 'pass',
          reason: 'run-bound-exact',
          ...details,
          matched_metric: exact.label,
          matched_value: exact.value,
        });
        continue;
      }

      const lowerBound = targetCounts.find((target) => target.value >= claim.value);
      if (claim.lower_bound && lowerBound) {
        outcomes.push({
          status: 'pass',
          reason: 'run-bound-lower-bound',
          ...details,
          matched_metric: lowerBound.label,
          matched_value: lowerBound.value,
        });
        continue;
      }

      const maxTarget = targetCounts.reduce((max, target) => Math.max(max, target.value), 0);
      const highConfidenceMismatch =
        /\b(scored|attempted|rows?|responses?)\b/i.test(cueContext) &&
        !/\b(dialogues?|turns?|paired|grounded|balanced)\b/i.test(cueContext);
      if ((hasSubsampleCue(cueContext) || lineNCount > 1) && claim.value <= maxTarget && maxTarget > 0) {
        outcomes.push({
          status: 'warn',
          reason: 'run-bound-subsample',
          ...details,
          max_available: maxTarget,
          target_counts: targetCounts,
        });
      } else {
        outcomes.push({
          status: highConfidenceMismatch ? 'fail' : 'warn',
          reason: highConfidenceMismatch ? 'run-bound-mismatch' : 'run-bound-unverified',
          ...details,
          target_counts: targetCounts,
        });
      }
      continue;
    }

    if (sectionRuns.length > 0) {
      const aggregate = aggregateRunEvidence(sectionRuns, runEvidenceIndex);
      const targetCounts = [
        { label: 'section_db_scored_rows', value: aggregate.scored_rows },
        { label: 'section_db_total_rows', value: aggregate.total_rows },
        { label: 'section_db_learner_scored_rows', value: aggregate.learner_scored_rows },
      ];
      const exact = targetCounts.find((target) => target.value === claim.value);
      if (exact) {
        outcomes.push({
          status: 'pass',
          reason: 'section-inferred-exact',
          ...details,
          matched_metric: exact.label,
          matched_value: exact.value,
          inferred_section_runs: sectionRuns,
        });
      } else if (hasSubsampleCue(cueContext) && aggregate.scored_rows >= claim.value) {
        outcomes.push({
          status: 'warn',
          reason: 'section-inferred-subsample',
          ...details,
          inferred_section_runs: sectionRuns,
          section_scored_rows: aggregate.scored_rows,
        });
      } else {
        outcomes.push({
          status: 'warn',
          reason: 'section-unverified',
          ...details,
          inferred_section_runs: sectionRuns,
          target_counts: targetCounts,
        });
      }
      continue;
    }

    outcomes.push({
      status: 'warn',
      reason: hasLearnerCue(lowerContext) ? 'unresolved-learner-claim' : 'unresolved',
      ...details,
    });
  }

  const summary = {
    total: outcomes.length,
    pass: outcomes.filter((outcome) => outcome.status === 'pass').length,
    warn: outcomes.filter((outcome) => outcome.status === 'warn').length,
    fail: outcomes.filter((outcome) => outcome.status === 'fail').length,
  };

  return { outcomes, summary };
}

function evaluateRunIdTraceability(runMentions, manifestRunIds, runEvidenceIndex) {
  const uniqueRunIds = [...new Set(runMentions.map((mention) => mention.run_id))];
  const missingInDb = [];
  const missingInManifest = [];

  for (const runId of uniqueRunIds) {
    const evidence = runEvidenceIndex.get(runId);
    if (!evidence || !evidence.in_evaluation_runs) {
      missingInDb.push(runId);
    }
    if (!manifestRunIds.has(runId)) {
      missingInManifest.push(runId);
    }
  }

  let status = 'pass';
  if (missingInDb.length > 0) status = 'fail';
  else if (missingInManifest.length > 0) status = 'warn';

  return {
    status,
    total_mentions: runMentions.length,
    unique_run_ids: uniqueRunIds.length,
    missing_in_db: missingInDb,
    missing_in_manifest: missingInManifest,
  };
}

function evaluateStatClaimTraceability(statClaims, runIdsByLine, sectionMap) {
  const empiricalClaims = statClaims.filter((claim) => {
    if (!claim.section_number) return false;
    const majorSection = Number(claim.section_number.split('.')[0]);
    return Number.isFinite(majorSection) && majorSection >= 5;
  });

  const outcomes = [];
  for (const claim of empiricalClaims) {
    const nearbyRuns = findNearbyRunIds(runIdsByLine, claim.line_no, 2);
    if (nearbyRuns.length > 0) {
      outcomes.push({
        status: 'traceable',
        reason: 'run-nearby',
        line_no: claim.line_no,
        claim: claim.claim_text,
        nearby_run_ids: nearbyRuns,
      });
      continue;
    }
    const sectionRuns = findRunsForSection(sectionMap, claim.section_number);
    if (sectionRuns.length > 0) {
      outcomes.push({
        status: 'traceable',
        reason: 'section-inferred',
        line_no: claim.line_no,
        claim: claim.claim_text,
        inferred_section_runs: sectionRuns,
      });
      continue;
    }
    outcomes.push({
      status: 'untraceable',
      reason: 'no-run-anchor',
      line_no: claim.line_no,
      claim: claim.claim_text,
      section: claim.section_number,
      line_text: claim.line_text,
    });
  }

  const summary = {
    total: outcomes.length,
    traceable: outcomes.filter((outcome) => outcome.status === 'traceable').length,
    untraceable: outcomes.filter((outcome) => outcome.status === 'untraceable').length,
  };

  return { outcomes, summary };
}

function buildContaminatedRunSet(manifest, _db, runEvidenceIndex) {
  const contaminated = new Set();

  const replacementMap = buildReplacementMap(manifest);
  const knownContaminatedShortIds = new Set([...replacementMap.keys(), 'b6d75e87']);

  for (const runId of runEvidenceIndex.keys()) {
    if (knownContaminatedShortIds.has(shortRunId(runId).toLowerCase())) {
      contaminated.add(runId);
    }
  }

  return contaminated;
}

function evaluateContaminatedRunCaveats(runMentions, lines, contaminatedRuns) {
  const caveatRe = /(bug|pre-fix|upper bound|artifact|caveat|inflat|clean re-run|clean rerun|pipeline|leak|flatmap|fixed)/i;
  const relevantMentions = runMentions.filter((mention) => contaminatedRuns.has(mention.run_id));
  const narrativeMentions = relevantMentions.filter((mention) => {
    if (/\|/.test(mention.line_text)) return false;
    if (/^\s*node\s+scripts\//i.test(mention.line_text)) return false;
    if (/^\s*`/.test(mention.line_text)) return false;
    return true;
  });
  const missingCaveats = [];

  for (const mention of narrativeMentions) {
    const context = lineWindowText(lines, mention.line_no, 4, 4);
    if (!caveatRe.test(context)) {
      missingCaveats.push({
        run_id: mention.run_id,
        line_no: mention.line_no,
        line_text: mention.line_text,
      });
    }
  }

  let status = 'pass';
  if (missingCaveats.length >= 3) status = 'fail';
  else if (missingCaveats.length > 0) status = 'warn';
  else if (relevantMentions.length === 0) status = 'warn';

  return {
    status,
    contaminated_runs_known: contaminatedRuns.size,
    contaminated_mentions: relevantMentions.length,
    narrative_mentions: narrativeMentions.length,
    mentions_missing_caveat: missingCaveats,
  };
}

function collectRunLogBacktrace(db, runId) {
  const rows = db
    .prepare(
      `SELECT DISTINCT dialogue_id
       FROM evaluation_results
       WHERE run_id = ?
         AND dialogue_id IS NOT NULL
         AND tutor_first_turn_score IS NOT NULL
         AND json_array_length(suggestions) > 1`,
    )
    .all(runId);

  let missingLogs = 0;
  let unreadableLogs = 0;
  let noTrace = 0;
  let notMulti = 0;
  for (const row of rows) {
    const logPath = path.join(LOG_DIR, `${row.dialogue_id}.json`);
    if (!fs.existsSync(logPath)) {
      missingLogs++;
      continue;
    }
    let log;
    try {
      log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    } catch {
      unreadableLogs++;
      continue;
    }
    if (!Array.isArray(log.dialogueTrace) || log.dialogueTrace.length === 0) noTrace++;
    if (!log.isMultiTurn) notMulti++;
  }

  return {
    run_id: runId,
    dialogue_rows: rows.length,
    missing_logs: missingLogs,
    unreadable_logs: unreadableLogs,
    no_trace_logs: noTrace,
    not_multiturn_logs: notMulti,
  };
}

function evaluateLogBacktrackingForClaims(runIds, runEvidenceIndex, db) {
  const runsWithMultiturn = runIds.filter((runId) => {
    const evidence = runEvidenceIndex.get(runId);
    return evidence && evidence.multiturn_rows > 0;
  });

  const runLogStats = runsWithMultiturn.map((runId) => {
    const evidence = runEvidenceIndex.get(runId);
    const logStats = collectRunLogBacktrace(db, runId);
    const holisticCoverage =
      evidence.multiturn_rows > 0 ? evidence.multiturn_with_holistic / evidence.multiturn_rows : 1;
    return {
      run_id: runId,
      multiturn_rows: evidence.multiturn_rows,
      multiturn_with_holistic: evidence.multiturn_with_holistic,
      holistic_coverage_pct: +(holisticCoverage * 100).toFixed(2),
      ...logStats,
    };
  });

  const logFailures = runLogStats.filter(
    (row) => row.missing_logs > 0 || row.unreadable_logs > 0 || row.no_trace_logs > 0,
  );
  const holisticGaps = runLogStats.filter((row) => row.multiturn_rows > 0 && row.multiturn_with_holistic < row.multiturn_rows);
  const nonMulti = runLogStats.filter((row) => row.not_multiturn_logs > 0);

  let status = 'pass';
  if (logFailures.length > 0) status = 'fail';
  else if (holisticGaps.length > 0 || nonMulti.length > 0) status = 'warn';

  return {
    status,
    runs_checked: runLogStats.length,
    log_failures: logFailures,
    holistic_gaps: holisticGaps,
    non_multiturn_logs: nonMulti,
    sample_runs: runLogStats.slice(0, 10),
  };
}

function checkPaperClaimsSuite(manifest, paperText, db) {
  const { body } = splitPaperForClaims(paperText);
  const lines = parsePaperLinesWithSections(body);
  const { mentions: runMentions, runIdsByLine, runMentionsByLine } = extractRunMentions(lines);
  const nClaims = extractNClaims(lines);
  const statClaims = extractStatClaims(lines);

  const manifestRunMeta = buildManifestRunMeta(manifest);
  const manifestRunIds = new Set((manifest.key_evaluations || []).flatMap((row) => row.run_ids || []));
  const sectionMap = buildManifestSectionMap(manifest);

  const claimRunIds = [...new Set(runMentions.map((mention) => mention.run_id))];
  const runIdsForEvidence = [...new Set([...manifestRunIds, ...claimRunIds])];
  const runEvidenceIndex = buildRunEvidenceIndex(db, runIdsForEvidence, manifestRunMeta);
  const dbTotals =
    db
      .prepare(
        `SELECT
           COUNT(*) as attempts,
           SUM(CASE WHEN tutor_first_turn_score IS NOT NULL THEN 1 ELSE 0 END) as scored,
           SUM(CASE WHEN learner_overall_score IS NOT NULL THEN 1 ELSE 0 END) as learner_scored,
           COUNT(DISTINCT run_id) as runs
         FROM evaluation_results`,
      )
      .get() || {};

  const runIdTrace = evaluateRunIdTraceability(runMentions, manifestRunIds, runEvidenceIndex);
  record(runIdTrace.status, 'paper-claims-run-ids', 'Run IDs in paper are traceable to manifest and DB', {
    unique_run_ids: runIdTrace.unique_run_ids,
    mentions: runIdTrace.total_mentions,
    missing_in_db: runIdTrace.missing_in_db,
    missing_in_manifest: runIdTrace.missing_in_manifest,
  });

  const nBacktracking = evaluateNClaimsBacktracking({
    nClaims,
    lines,
    runMentionsByLine,
    runEvidenceIndex,
    manifest,
    sectionMap,
    dbTotals,
  });
  const nStatus = nBacktracking.summary.fail > 0 ? 'fail' : nBacktracking.summary.warn > 0 ? 'warn' : 'pass';
  record(nStatus, 'paper-claims-n-backtrack', 'N-claims backtracked to manifest/DB evidence where possible', {
    claims_total: nBacktracking.summary.total,
    pass: nBacktracking.summary.pass,
    warn: nBacktracking.summary.warn,
    fail: nBacktracking.summary.fail,
    failure_samples: nBacktracking.outcomes.filter((outcome) => outcome.status === 'fail').slice(0, 10),
    unresolved_samples: nBacktracking.outcomes
      .filter((outcome) => outcome.status === 'warn' && outcome.reason.startsWith('unresolved'))
      .slice(0, 10),
  });

  const statTrace = evaluateStatClaimTraceability(statClaims, runIdsByLine, sectionMap);
  const statStatus = statTrace.summary.untraceable > 0 ? 'warn' : 'pass';
  record(statStatus, 'paper-claims-stats-trace', 'Empirical statistical claims have local run/section trace anchors', {
    claims_total: statTrace.summary.total,
    traceable: statTrace.summary.traceable,
    untraceable: statTrace.summary.untraceable,
    untraceable_samples: statTrace.outcomes.filter((outcome) => outcome.status === 'untraceable').slice(0, 10),
  });

  const contaminatedRuns = buildContaminatedRunSet(manifest, db, runEvidenceIndex);
  const caveatEval = evaluateContaminatedRunCaveats(runMentions, lines, contaminatedRuns);
  record(caveatEval.status, 'paper-claims-bug-caveats', 'Mentions of contaminated runs include nearby caveat language', {
    contaminated_runs_known: caveatEval.contaminated_runs_known,
    contaminated_mentions: caveatEval.contaminated_mentions,
    narrative_mentions: caveatEval.narrative_mentions,
    missing_caveat_mentions: caveatEval.mentions_missing_caveat.slice(0, 10),
  });

  const logTrace = evaluateLogBacktrackingForClaims(claimRunIds, runEvidenceIndex, db);
  record(logTrace.status, 'paper-claims-log-trace', 'Paper-cited multi-turn runs are backed by logs and holistic coverage', {
    runs_checked: logTrace.runs_checked,
    log_failure_count: logTrace.log_failures.length,
    holistic_gap_count: logTrace.holistic_gaps.length,
    non_multiturn_log_count: logTrace.non_multiturn_logs.length,
    log_failure_samples: logTrace.log_failures.slice(0, 10),
    holistic_gap_samples: logTrace.holistic_gaps.slice(0, 10),
  });

  const componentStatuses = [
    runIdTrace.status,
    nStatus,
    statStatus,
    caveatEval.status,
    logTrace.status,
  ];
  const suiteStatus = componentStatuses.includes('fail') ? 'fail' : componentStatuses.includes('warn') ? 'warn' : 'pass';
  record(suiteStatus, 'paper-claims-suite', 'Comprehensive paper claim backtracking audit completed', {
    run_id_claims: runMentions.length,
    n_claims: nClaims.length,
    stat_claims: statClaims.length,
    db_totals: {
      attempts: Number(dbTotals.attempts || 0),
      scored: Number(dbTotals.scored || 0),
      learner_scored: Number(dbTotals.learner_scored || 0),
      runs: Number(dbTotals.runs || 0),
    },
  });

  const claimAuditReport = {
    generated_at: new Date().toISOString(),
    files: {
      paper: path.relative(ROOT, PAPER_PATH),
      manifest: path.relative(ROOT, MANIFEST_PATH),
      db: path.relative(ROOT, DB_PATH),
    },
    totals: {
      run_id_mentions: runMentions.length,
      unique_run_ids: claimRunIds.length,
      n_claims: nClaims.length,
      stat_claims: statClaims.length,
    },
    run_id_traceability: runIdTrace,
    n_claim_backtracking: nBacktracking,
    stat_claim_traceability: statTrace,
    contaminated_run_caveats: caveatEval,
    log_backtracking: logTrace,
  };

  if (claimReportPathArg) {
    const reportPath = path.isAbsolute(claimReportPathArg) ? claimReportPathArg : path.join(ROOT, claimReportPathArg);
    try {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(claimAuditReport, null, 2), 'utf8');
      report.claim_report = path.relative(ROOT, reportPath);
      if (!jsonMode) {
        console.log(`    ${paint('-', ANSI.gray)} ${paint('claim_report:', ANSI.gray)} ${path.relative(ROOT, reportPath)}`);
      }
    } catch (error) {
      record('warn', 'paper-claims-report-write', 'Could not write claim report file', {
        path: reportPath,
        error: error.message,
      });
    }
  }

  report.claim_audit = {
    totals: claimAuditReport.totals,
    summary_status: suiteStatus,
  };
}

function main() {
  if (!jsonMode) {
    console.log(paint('═══ Research Integrity Audit ═══', ANSI.bold, ANSI.cyan));
    console.log(
      `strict=${strictMode} include_all_runs=${includeAllRuns} skip_command_checks=${skipCommandChecks} skip_claims_suite=${skipClaimsSuite}`,
    );
  }

  ensureFile(MANIFEST_PATH);
  ensureFile(PAPER_PATH);
  ensureFile(DB_PATH);

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const paperText = fs.readFileSync(PAPER_PATH, 'utf8');
  const db = new Database(DB_PATH, { readonly: true });

  const scopeRunIds = getScopeRunIds(manifest, db);

  if (!jsonMode) {
    console.log(
      `manifest=${manifest.version} generated=${manifest.generated} scope_runs=${scopeRunIds.length} paper=${path.relative(ROOT, PAPER_PATH)}`,
    );
    console.log('');
  }

  runManifestValidator();
  checkManifestLogIntegrity(db, scopeRunIds);
  checkJudgeVersionDrift(manifest, db, scopeRunIds);
  checkLearnerLeakage(manifest, db, scopeRunIds);
  checkConversationHistoryRegression();
  checkMultiturnScoringAlignment(manifest, db, scopeRunIds);
  checkPaperDisclosureCoverage(paperText);
  checkBugReportIssueState();
  checkTodoIssueState();
  if (skipClaimsSuite) {
    record('warn', 'paper-claims-suite', 'Paper claim backtracking suite skipped (--skip-claims-suite)');
  } else {
    checkPaperClaimsSuite(manifest, paperText, db);
  }

  db.close();

  report.summary = {
    pass: passCount,
    warn: warnCount,
    fail: failCount,
  };
  report.fix_steps = report.checks
    .filter((check) => check.status === 'fail')
    .map((check) => ({ id: check.id, steps: remediationForCheck(check) }));
  report.finished_at = new Date().toISOString();

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('');
    console.log(
      `Summary: ${paint(String(passCount), ANSI.green)} pass, ${paint(String(warnCount), ANSI.yellow)} warn, ${paint(String(failCount), ANSI.red)} fail`,
    );
    printPracticalFixSteps();
  }

  if (failCount > 0 || (strictMode && warnCount > 0)) {
    process.exit(1);
  }
}

main();
