#!/usr/bin/env node
/**
 * Analyze tutor-stub dialogue traces as both point-in-time state and
 * change-over-time field movement.
 *
 * Usage:
 *   node scripts/analyze-tutor-stub-field-traces.js
 *   node scripts/analyze-tutor-stub-field-traces.js --traces-dir ../machinespirits-eval-preconscious/.tutor-stub-traces
 *   node scripts/analyze-tutor-stub-field-traces.js --json --out /tmp/tutor-stub-field-report.json
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const FIELD_RANKS = {
  evidence_use: {
    none: 0,
    repeats_setup: 0.1,
    cites_public_evidence: 0.4,
    revises_from_evidence: 0.5,
    links_evidence_to_rule: 0.7,
    overleaps_evidence: -0.2,
  },
  agency: {
    passive: 0,
    complying: 0.2,
    attempting: 0.5,
    steering: 0.55,
    self_correcting: 0.8,
  },
  epistemic_stance: {
    answer_seeking: 0.1,
    receptive: 0.2,
    confused: 0.25,
    exploratory: 0.5,
    reflective: 0.65,
    grounded: 0.75,
    overconfident: 0.15,
    resistant: 0.1,
  },
  discourse_move: {
    off_task: 0,
    answer_seeking: 0.1,
    question: 0.3,
    repair_request: 0.35,
    challenge: 0.35,
    claim: 0.45,
    hypothesis: 0.5,
    evidence_adoption: 0.65,
    inference: 0.75,
    metacognitive_reflection: 0.8,
  },
};

const POSITIVE_EFFICACY_LABELS = new Set(['progress', 'positive_progress', 'clear_progress', 'strong_progress']);

function parseArgs(argv) {
  const args = {
    tracesDir: path.resolve(process.cwd(), '.tutor-stub-traces'),
    files: [],
    json: false,
    out: null,
    minFieldDelta: 0.05,
    limitMismatches: 12,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      printUsage();
      process.exit(0);
    }
    if (token === '--json') {
      args.json = true;
      continue;
    }
    if (token === '--traces-dir') {
      args.tracesDir = path.resolve(argv[++i] || '');
      continue;
    }
    if (token === '--trace') {
      args.files.push(path.resolve(argv[++i] || ''));
      continue;
    }
    if (token === '--out') {
      args.out = path.resolve(argv[++i] || '');
      continue;
    }
    if (token === '--min-field-delta') {
      args.minFieldDelta = Number(argv[++i]);
      continue;
    }
    if (token === '--limit-mismatches') {
      args.limitMismatches = Number(argv[++i]);
      continue;
    }
    if (token.startsWith('--')) {
      throw new Error(`Unknown option: ${token}`);
    }
    args.files.push(path.resolve(token));
  }

  if (!Number.isFinite(args.minFieldDelta)) {
    throw new Error('--min-field-delta must be a number');
  }
  if (!Number.isInteger(args.limitMismatches) || args.limitMismatches < 0) {
    throw new Error('--limit-mismatches must be a non-negative integer');
  }
  return args;
}

function printUsage() {
  console.log(`Usage:
  node scripts/analyze-tutor-stub-field-traces.js [options] [trace.jsonl ...]

Options:
  --traces-dir <dir>        Directory of tutor-stub .jsonl traces (default: ./.tutor-stub-traces)
  --trace <file>            Analyze one trace file; may be repeated
  --json                    Print JSON instead of Markdown
  --out <file>              Write report to a file instead of stdout
  --min-field-delta <n>     Field delta threshold for progress (default: 0.05)
  --limit-mismatches <n>    Number of mismatch examples in Markdown report (default: 12)
`);
}

function discoverTraceFiles(args) {
  if (args.files.length > 0) {
    return args.files;
  }
  if (!fs.existsSync(args.tracesDir)) {
    throw new Error(`Trace directory does not exist: ${args.tracesDir}`);
  }
  return fs
    .readdirSync(args.tracesDir)
    .filter((name) => name.endsWith('.jsonl'))
    .sort()
    .map((name) => path.join(args.tracesDir, name));
}

function readJsonl(file) {
  const text = fs.readFileSync(file, 'utf8').trim();
  if (!text) return [];
  const rows = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    try {
      rows.push(JSON.parse(line));
    } catch (error) {
      throw new Error(`${file}:${index + 1}: invalid JSON: ${error.message}`);
    }
  }
  return rows;
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRubricScore(value) {
  const n = asNumber(value);
  if (n == null) return null;
  return clamp((n - 1) / 4);
}

function rankValue(mapName, value) {
  if (value == null) return null;
  return FIELD_RANKS[mapName]?.[String(value).trim()] ?? null;
}

function mean(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function sum(values) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function scoreTurnField(turn) {
  const classification = turn.classification?.turn || null;
  if (!classification) {
    return {
      score: null,
      dimensions: {},
      labels: {},
      reason: 'missing_classification',
    };
  }

  const dimensions = {
    conceptual: normalizeRubricScore(classification.scores?.conceptual_engagement?.score),
    epistemic: normalizeRubricScore(classification.scores?.epistemic_readiness?.score),
    evidence: rankValue('evidence_use', classification.evidence_use),
    agency: rankValue('agency', classification.agency),
    stance: rankValue('epistemic_stance', classification.epistemic_stance),
    discourse: rankValue('discourse_move', classification.discourse_move),
  };

  return {
    score: mean(Object.values(dimensions)),
    dimensions,
    labels: {
      discourse_move: classification.discourse_move || null,
      evidence_use: classification.evidence_use || null,
      epistemic_stance: classification.epistemic_stance || null,
      agency: classification.agency || null,
    },
    summary: classification.summary || null,
    pedagogicalNeed: classification.pedagogical_need || null,
  };
}

function dagSnapshot(turn) {
  const model = turn.tutorLearnerDagModel || {};
  const assessment = model.assessment || {};
  const metrics = model.metrics || {};
  return {
    status: assessment.status || null,
    bestPathCoverage: asNumber(assessment.bestPathCoverage),
    missingPremiseCount: asNumber(metrics.missingPremiseCount ?? assessment.missingPremiseCount),
    groundedCount: asNumber(metrics.groundedCount),
    voicedDerivedCount: asNumber(metrics.voicedDerivedCount ?? assessment.voicedDerivedCount),
    hypothesisCount: asNumber(metrics.hypothesisCount ?? assessment.hypothesisCount),
    candidateConclusionCount: asNumber(metrics.candidateConclusionCount),
    answerCandidateCount: asNumber(metrics.answerCandidateCount),
    unsupportedAssertionCount: asNumber(assessment.unsupportedAssertionCount),
    finalSecretEntailed: Boolean(assessment.finalSecretEntailed),
    assertedSecret: Boolean(assessment.assertedSecret),
    assertedMirror: Boolean(assessment.assertedMirror),
    bottleneck: assessment.bottleneck || null,
  };
}

function delta(next, prev, key) {
  if (!next || !prev) return null;
  const a = asNumber(next[key]);
  const b = asNumber(prev[key]);
  return a == null || b == null ? null : a - b;
}

function inverseDelta(next, prev, key) {
  const d = delta(next, prev, key);
  return d == null ? null : -d;
}

function isPositiveEfficacy(label) {
  if (!label) return false;
  if (POSITIVE_EFFICACY_LABELS.has(label)) return true;
  return String(label).includes('progress') && !String(label).startsWith('no_');
}

function dagProgressFromPair(pair) {
  return (
    isPositiveEfficacy(pair.builtInLabel) ||
    (pair.coverageDelta ?? 0) > 0 ||
    (pair.missingPremiseReduction ?? 0) > 0 ||
    (pair.voicedDerivedDelta ?? 0) > 0 ||
    (pair.candidateConclusionDelta ?? 0) > 0 ||
    (pair.answerCandidateDelta ?? 0) > 0 ||
    Boolean(pair.toDag?.finalSecretEntailed && !pair.fromDag?.finalSecretEntailed) ||
    Boolean(pair.toDag?.assertedSecret && !pair.fromDag?.assertedSecret)
  );
}

function classifyMismatch(pair, minFieldDelta) {
  const fieldProgress = pair.fieldDelta != null && pair.fieldDelta >= minFieldDelta;
  const dagProgress = dagProgressFromPair(pair);
  if (fieldProgress && !dagProgress) return 'field_without_dag';
  if (dagProgress && !fieldProgress) return 'dag_without_field';
  if (fieldProgress && dagProgress) return 'both_progress';
  return 'neither_progress';
}

function analyzeTrace(file, args) {
  const events = readJsonl(file);
  const start = events.find((event) => event.type === 'run_start') || null;
  const runMetadata = start?.metadata || start?.options || null;
  const turns = events
    .filter((event) => event.type === 'turn_complete' && event.turnRecord)
    .map((event) => event.turnRecord)
    .sort((a, b) => Number(a.turn || 0) - Number(b.turn || 0));

  const enrichedTurns = turns.map((turn) => ({
    turn: turn.turn,
    learner: turn.learner ?? turn.learnerInput ?? null,
    tutor: turn.tutor ?? null,
    provider: turn.provider || null,
    model: turn.model || null,
    field: scoreTurnField(turn),
    dag: dagSnapshot(turn),
    classification: {
      turn: turn.classification?.turn || null,
      overall: turn.classification?.overall || null,
      provider: turn.classification?.provider || null,
      model: turn.classification?.model || null,
      parseError: turn.classification?.parseError || null,
    },
    registerSelection: turn.registerSelection || null,
    previousRegisterEfficacy: turn.previousRegisterEfficacy || null,
    leakAuditOk: turn.tutorLeakAudit?.ok ?? null,
    tutorResponseRepaired: Boolean(turn.tutorResponseRepaired),
    tutorDeterministicFallback: Boolean(turn.tutorDeterministicFallback),
    latencyMs: asNumber(turn.latencyMs),
  }));

  const pairs = [];
  for (let i = 1; i < enrichedTurns.length; i++) {
    const prev = enrichedTurns[i - 1];
    const cur = enrichedTurns[i];
    const efficacy = cur.previousRegisterEfficacy || {};
    const selectedRegister =
      efficacy.selected_register ||
      prev.registerSelection?.selected_register ||
      prev.registerSelection?.selected_mode ||
      'unknown';
    const fieldDelta =
      cur.field.score == null || prev.field.score == null ? null : cur.field.score - prev.field.score;

    const pair = {
      file,
      fromTurn: prev.turn,
      toTurn: cur.turn,
      selectedRegister,
      selectedMode: prev.registerSelection?.selected_mode || null,
      learnerSignal: prev.registerSelection?.learner_signal || null,
      builtInLabel: efficacy.label || null,
      builtInSummary: efficacy.summary || null,
      fieldDelta,
      fromField: prev.field.score,
      toField: cur.field.score,
      coverageDelta: delta(cur.dag, prev.dag, 'bestPathCoverage'),
      missingPremiseReduction: inverseDelta(cur.dag, prev.dag, 'missingPremiseCount'),
      voicedDerivedDelta: delta(cur.dag, prev.dag, 'voicedDerivedCount'),
      candidateConclusionDelta: delta(cur.dag, prev.dag, 'candidateConclusionCount'),
      answerCandidateDelta: delta(cur.dag, prev.dag, 'answerCandidateCount'),
      fromDag: prev.dag,
      toDag: cur.dag,
      fromLearner: prev.learner,
      toLearner: cur.learner,
      fromClassification: prev.classification.turn,
      toClassification: cur.classification.turn,
    };
    pair.dagProgress = dagProgressFromPair(pair);
    pair.fieldProgress = fieldDelta != null && fieldDelta >= args.minFieldDelta;
    pair.mismatch = classifyMismatch(pair, args.minFieldDelta);
    pairs.push(pair);
  }

  const finalTurn = enrichedTurns.at(-1) || null;
  const failedAuditAttempts = events.filter((event) => {
    if (event.type !== 'tutor_response_audit' && event.type !== 'tutor_leak_audit') return false;
    return (event.audit?.ok ?? event.ok) === false;
  }).length;

  return {
    file,
    basename: path.basename(file),
    startedAt: start?.ts || events[0]?.ts || null,
    metadata: runMetadata,
    turns: enrichedTurns,
    pairs,
    summary: {
      turnCount: enrichedTurns.length,
      provider: finalTurn?.provider || runMetadata?.resolved?.provider || runMetadata?.provider || null,
      model: finalTurn?.model || runMetadata?.resolved?.model || runMetadata?.model || runMetadata?.modelRef || null,
      story:
        runMetadata?.story ||
        runMetadata?.storyId ||
        runMetadata?.world?.id ||
        runMetadata?.worldId ||
        runMetadata?.world?.title ||
        null,
      finalCoverage: finalTurn?.dag.bestPathCoverage ?? null,
      finalMissingPremiseCount: finalTurn?.dag.missingPremiseCount ?? null,
      finalBottleneck: finalTurn?.dag.bottleneck || null,
      finalSecretEntailed: Boolean(finalTurn?.dag.finalSecretEntailed),
      assertedSecret: Boolean(finalTurn?.dag.assertedSecret),
      grounded:
        Boolean(finalTurn?.dag.finalSecretEntailed) ||
        Boolean(finalTurn?.dag.assertedSecret) ||
        finalTurn?.dag.bottleneck === 'grounded_asserted_secret',
      finalLeakFailures: enrichedTurns.filter((turn) => turn.leakAuditOk === false).length,
      repairedTurns: enrichedTurns.filter((turn) => turn.tutorResponseRepaired).length,
      deterministicFallbacks: enrichedTurns.filter((turn) => turn.tutorDeterministicFallback).length,
      failedAuditAttempts,
    },
  };
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return sortObjectByValue(counts);
}

function sortObjectByValue(obj) {
  return Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function aggregateByRegister(pairs) {
  const groups = new Map();
  for (const pair of pairs) {
    if (!groups.has(pair.selectedRegister)) groups.set(pair.selectedRegister, []);
    groups.get(pair.selectedRegister).push(pair);
  }

  return [...groups.entries()]
    .map(([register, group]) => ({
      register,
      pairs: group.length,
      meanFieldDelta: mean(group.map((pair) => pair.fieldDelta)),
      positiveField: group.filter((pair) => pair.fieldProgress).length,
      meanCoverageDelta: mean(group.map((pair) => pair.coverageDelta)),
      meanMissingPremiseReduction: mean(group.map((pair) => pair.missingPremiseReduction)),
      dagProgress: group.filter((pair) => pair.dagProgress).length,
      builtPositive: group.filter((pair) => isPositiveEfficacy(pair.builtInLabel)).length,
      fieldWithoutDag: group.filter((pair) => pair.mismatch === 'field_without_dag').length,
      dagWithoutField: group.filter((pair) => pair.mismatch === 'dag_without_field').length,
      bothProgress: group.filter((pair) => pair.mismatch === 'both_progress').length,
      neitherProgress: group.filter((pair) => pair.mismatch === 'neither_progress').length,
    }))
    .sort((a, b) => b.pairs - a.pairs || a.register.localeCompare(b.register));
}

function buildReport(traceReports, args) {
  const allTurns = traceReports.flatMap((trace) => trace.turns.map((turn) => ({ ...turn, file: trace.file })));
  const allPairs = traceReports.flatMap((trace) => trace.pairs);
  const usableRuns = traceReports.filter((trace) => trace.summary.turnCount > 0);
  const mismatchCounts = countBy(allPairs, (pair) => pair.mismatch);
  const registerRows = aggregateByRegister(allPairs);
  const fieldWithoutDagExamples = allPairs
    .filter((pair) => pair.mismatch === 'field_without_dag')
    .sort((a, b) => (b.fieldDelta ?? -Infinity) - (a.fieldDelta ?? -Infinity))
    .slice(0, args.limitMismatches);
  const dagWithoutFieldExamples = allPairs
    .filter((pair) => pair.mismatch === 'dag_without_field')
    .sort((a, b) => (b.coverageDelta ?? 0) - (a.coverageDelta ?? 0))
    .slice(0, args.limitMismatches);

  return {
    generatedAt: new Date().toISOString(),
    input: {
      tracesDir: args.files.length ? null : args.tracesDir,
      files: traceReports.map((trace) => trace.file),
      minFieldDelta: args.minFieldDelta,
    },
    summary: {
      files: traceReports.length,
      usableRuns: usableRuns.length,
      totalTurns: allTurns.length,
      registerPairs: allPairs.length,
      groundedRuns: usableRuns.filter((trace) => trace.summary.grounded).length,
      finalLeakFailures: sum(usableRuns.map((trace) => trace.summary.finalLeakFailures)),
      repairedTurns: sum(usableRuns.map((trace) => trace.summary.repairedTurns)),
      deterministicFallbacks: sum(usableRuns.map((trace) => trace.summary.deterministicFallbacks)),
      failedAuditAttempts: sum(usableRuns.map((trace) => trace.summary.failedAuditAttempts)),
      meanFinalCoverage: mean(usableRuns.map((trace) => trace.summary.finalCoverage)),
      meanFinalMissingPremises: mean(usableRuns.map((trace) => trace.summary.finalMissingPremiseCount)),
      meanFieldDelta: mean(allPairs.map((pair) => pair.fieldDelta)),
    },
    runs: traceReports.map((trace) => trace.summary),
    runReports: traceReports.map((trace) => ({
      file: trace.file,
      basename: trace.basename,
      startedAt: trace.startedAt,
      summary: trace.summary,
    })),
    distributions: {
      registers: countBy(allPairs, (pair) => pair.selectedRegister),
      builtInEfficacyLabels: countBy(allPairs, (pair) => pair.builtInLabel),
      mismatch: mismatchCounts,
      discourseMoves: countBy(allTurns, (turn) => turn.field.labels.discourse_move),
      evidenceUse: countBy(allTurns, (turn) => turn.field.labels.evidence_use),
      epistemicStance: countBy(allTurns, (turn) => turn.field.labels.epistemic_stance),
      agency: countBy(allTurns, (turn) => turn.field.labels.agency),
    },
    registers: registerRows,
    mismatches: {
      fieldWithoutDag: fieldWithoutDagExamples,
      dagWithoutField: dagWithoutFieldExamples,
    },
    traces: traceReports,
  };
}

function formatMarkdown(report) {
  const lines = [];
  lines.push('# Tutor Stub Field Trace Analysis');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  if (report.input.tracesDir) lines.push(`Trace directory: \`${report.input.tracesDir}\``);
  lines.push(`Field-progress threshold: \`${formatNumber(report.input.minFieldDelta)}\``);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Files: ${report.summary.files}`);
  lines.push(`- Usable runs: ${report.summary.usableRuns}`);
  lines.push(`- Human learner turns: ${report.summary.totalTurns}`);
  lines.push(`- Register-outcome pairs: ${report.summary.registerPairs}`);
  lines.push(`- Grounded or asserted-secret runs: ${report.summary.groundedRuns}`);
  lines.push(`- Mean final DAG coverage: ${formatNumber(report.summary.meanFinalCoverage)}`);
  lines.push(`- Mean final missing premises: ${formatNumber(report.summary.meanFinalMissingPremises)}`);
  lines.push(`- Mean turn-to-turn field delta: ${formatSigned(report.summary.meanFieldDelta)}`);
  lines.push(`- Failed audit attempts: ${report.summary.failedAuditAttempts}`);
  lines.push(`- Final leak failures: ${report.summary.finalLeakFailures}`);
  lines.push(`- Repaired tutor turns: ${report.summary.repairedTurns}`);
  lines.push(`- Deterministic fallbacks: ${report.summary.deterministicFallbacks}`);
  lines.push('');

  lines.push('## Runs');
  lines.push('');
  lines.push(
    markdownTable(
      ['trace', 'turns', 'model', 'story', 'coverage', 'missing', 'bottleneck', 'grounded', 'final leaks'],
      report.runReports.map((run) => [
        run.basename,
        run.summary.turnCount,
        [run.summary.provider, run.summary.model].filter(Boolean).join('.') || '',
        run.summary.story || '',
        formatNumber(run.summary.finalCoverage),
        formatNumber(run.summary.finalMissingPremiseCount),
        run.summary.finalBottleneck || '',
        run.summary.grounded ? 'yes' : 'no',
        run.summary.finalLeakFailures,
      ]),
    ),
  );
  lines.push('');

  lines.push('## Register Efficacy');
  lines.push('');
  lines.push(
    markdownTable(
      [
        'register',
        'pairs',
        'mean field delta',
        'field +',
        'mean coverage delta',
        'mean missing reduction',
        'DAG +',
        'built-in +',
        'field no DAG',
        'DAG no field',
      ],
      report.registers.map((row) => [
        row.register,
        row.pairs,
        formatSigned(row.meanFieldDelta),
        `${row.positiveField}/${row.pairs}`,
        formatSigned(row.meanCoverageDelta),
        formatSigned(row.meanMissingPremiseReduction),
        `${row.dagProgress}/${row.pairs}`,
        `${row.builtPositive}/${row.pairs}`,
        row.fieldWithoutDag,
        row.dagWithoutField,
      ]),
    ),
  );
  lines.push('');

  lines.push('## Classifier Distributions');
  lines.push('');
  lines.push('Registers: ' + inlineCounts(report.distributions.registers));
  lines.push('Built-in efficacy labels: ' + inlineCounts(report.distributions.builtInEfficacyLabels));
  lines.push('Mismatch classes: ' + inlineCounts(report.distributions.mismatch));
  lines.push('Discourse moves: ' + inlineCounts(report.distributions.discourseMoves));
  lines.push('Evidence use: ' + inlineCounts(report.distributions.evidenceUse));
  lines.push('Epistemic stance: ' + inlineCounts(report.distributions.epistemicStance));
  lines.push('Agency: ' + inlineCounts(report.distributions.agency));
  lines.push('');

  lines.push('## Field Movement Without DAG Progress');
  lines.push('');
  lines.push(formatPairExamples(report.mismatches.fieldWithoutDag));
  lines.push('');

  lines.push('## DAG Progress Without Field Movement');
  lines.push('');
  lines.push(formatPairExamples(report.mismatches.dagWithoutField));
  lines.push('');

  lines.push('## Reading The Report');
  lines.push('');
  lines.push(
    '- DAG columns report point-in-time proof state: coverage, missing premises, voiced derivations, candidate conclusions, and final-secret flags.',
  );
  lines.push(
    '- Field columns report movement in the learner discourse surface: conceptual and epistemic scores plus ranked evidence use, agency, stance, and discourse move.',
  );
  lines.push(
    '- `field_without_dag` is the main diagnostic for a useful register move whose effect is invisible to the current proof-DAG efficacy heuristic.',
  );
  lines.push(
    '- `dag_without_field` is the inverse diagnostic: the proof state advanced while the classifier did not see a broader improvement in learner posture or discourse.',
  );

  return `${lines.join('\n')}\n`;
}

function formatPairExamples(pairs) {
  if (!pairs.length) return '_None._';
  return markdownTable(
    ['trace', 'turns', 'register', 'field delta', 'coverage delta', 'missing reduction', 'label', 'next learner'],
    pairs.map((pair) => [
      path.basename(pair.file),
      `${pair.fromTurn}->${pair.toTurn}`,
      pair.selectedRegister,
      formatSigned(pair.fieldDelta),
      formatSigned(pair.coverageDelta),
      formatSigned(pair.missingPremiseReduction),
      pair.builtInLabel || '',
      excerpt(pair.toLearner, 86),
    ]),
  );
}

function inlineCounts(counts) {
  const entries = Object.entries(counts);
  if (!entries.length) return '_none_';
  return entries.map(([key, value]) => `\`${key}\` ${value}`).join(', ');
}

function markdownTable(headers, rows) {
  const escapedHeaders = headers.map(markdownCell);
  const escapedRows = rows.map((row) => row.map(markdownCell));
  const widths = escapedHeaders.map((header, index) =>
    Math.max(header.length, ...escapedRows.map((row) => row[index]?.length || 0)),
  );
  const formatRow = (row) => `| ${row.map((cell, index) => cell.padEnd(widths[index])).join(' | ')} |`;
  return [
    formatRow(escapedHeaders),
    formatRow(widths.map((width) => '-'.repeat(width))),
    ...escapedRows.map(formatRow),
  ].join('\n');
}

function markdownCell(value) {
  if (value == null) return '';
  return String(value).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(3).replace(/\.?0+$/, '') : '';
}

function formatSigned(value) {
  if (!Number.isFinite(value)) return '';
  const fixed = Math.abs(value).toFixed(3).replace(/\.?0+$/, '');
  if (value > 0) return `+${fixed}`;
  if (value < 0) return `-${fixed}`;
  return '0';
}

function excerpt(text, maxLength) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function writeOutput(output, outPath) {
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, output);
    console.error(`Wrote ${outPath}`);
    return;
  }
  process.stdout.write(output);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = discoverTraceFiles(args);
  if (!files.length) {
    throw new Error(`No .jsonl traces found in ${args.tracesDir}`);
  }
  const traceReports = files.map((file) => analyzeTrace(file, args));
  const report = buildReport(traceReports, args);
  const output = args.json ? `${JSON.stringify(report, null, 2)}\n` : formatMarkdown(report);
  writeOutput(output, args.out);
}

try {
  main();
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(1);
}
