#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { parseTutorStubPublicLearnerAnalysisStrict } from '../services/tutorStubPublicLearnerAnalysis.js';

export const ADAPTIVE_WARRANT_SEMANTIC_COUNTERFACTUAL_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-counterfactual-replay.v1';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readJsonLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\n/u)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${filePath}:${index + 1} is not valid JSON: ${error.message}`);
      }
    });
}

function traceFiles(root) {
  const jobsRoot = path.join(root, 'jobs');
  return fs
    .readdirSync(jobsRoot)
    .flatMap((jobId) => {
      const jobRoot = path.join(jobsRoot, jobId);
      return fs
        .readdirSync(jobRoot)
        .filter((name) => name.endsWith('.jsonl') && name !== 'run-events.jsonl')
        .map((name) => path.join(jobRoot, name));
    })
    .sort();
}

function residualIssues(error) {
  const details = error?.details;
  if (!details || typeof details !== 'object') return [];
  return [
    ...(details.envelope_issues || []),
    ...(details.events || []).flatMap((event) => event?.validation?.issues || []),
  ];
}

function increment(counts, key) {
  counts[key] = (counts[key] || 0) + 1;
}

export function replayAdaptiveWarrantSemanticCounterfactual({ root, outputPath, expectedSourceSha } = {}) {
  const resolvedRoot = path.resolve(root);
  const planPath = path.join(resolvedRoot, 'study-plan.json');
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const actualSourceSha =
    plan?.analysisProvenance?.gitCommit || plan?.provenance?.gitCommit || plan?.provenance?.git_commit || null;
  if (expectedSourceSha && actualSourceSha !== expectedSourceSha) {
    throw new Error(`counterfactual source mismatch: expected ${expectedSourceSha}, found ${actualSourceSha}`);
  }

  const files = traceFiles(resolvedRoot);
  const rows = [];
  for (const filePath of files) {
    const events = readJsonLines(filePath);
    const learnerByTurn = new Map(
      events.filter((event) => event.type === 'auto_learner_turn').map((event) => [event.turn, event.text]),
    );
    for (const event of events) {
      if (event.type !== 'model_call' || event.role !== 'tutor_stub_learner_analysis') continue;
      const learnerText = learnerByTurn.get(event.turn);
      if (typeof learnerText !== 'string') {
        throw new Error(`${filePath} lacks the learner turn for analysis turn ${event.turn}`);
      }
      const rawResponseText = String(event.response?.text || '');
      let status = 'survives';
      let errorCode = null;
      let issues = [];
      try {
        parseTutorStubPublicLearnerAnalysisStrict(rawResponseText, {
          includeSemanticEvents: true,
          benchmarkLearnerText: learnerText,
          tutorTurn: event.turn,
          semanticPublicText: event.request?.prompt || learnerText,
        });
      } catch (error) {
        status = 'discarded';
        errorCode = error?.code || error?.name || 'counterfactual_validation_error';
        issues = residualIssues(error);
        if (!issues.length) issues = [String(error?.message || errorCode)];
      }
      rows.push({
        trace: path.relative(resolvedRoot, filePath),
        run_id: event.runId,
        turn: event.turn,
        status,
        error_code: errorCode,
        residual_issues: issues,
        learner_text_sha256: sha256(learnerText),
        raw_response_sha256: sha256(rawResponseText),
      });
    }
  }

  const discardedRows = rows.filter((row) => row.status === 'discarded');
  const issueCounts = {};
  const errorCodeCounts = {};
  for (const row of discardedRows) {
    increment(errorCodeCounts, row.error_code);
    for (const issue of new Set(row.residual_issues)) increment(issueCounts, issue);
  }
  const completed = rows.length;
  const discarded = discardedRows.length;
  const artifact = {
    schema: ADAPTIVE_WARRANT_SEMANTIC_COUNTERFACTUAL_SCHEMA,
    generated_at: new Date().toISOString(),
    zero_provider_calls: true,
    source_root: resolvedRoot,
    source_study_id: plan.studyId || path.basename(resolvedRoot),
    source_commit: actualSourceSha,
    repaired_validator_commit: process.env.ADAPTIVE_WARRANT_COUNTERFACTUAL_REPAIR_SHA || null,
    input_closure: {
      trace_count: files.length,
      trace_sha256: Object.fromEntries(
        files.map((filePath) => [path.relative(resolvedRoot, filePath), sha256(fs.readFileSync(filePath))]),
      ),
      combined_sha256: sha256(
        files.map((filePath) => `${path.relative(resolvedRoot, filePath)}\t${sha256(fs.readFileSync(filePath))}`).join('\n'),
      ),
    },
    result: {
      completed_analysis_calls: completed,
      predicted_surviving_calls: completed - discarded,
      predicted_discarded_calls: discarded,
      predicted_discard_rate: completed ? discarded / completed : null,
      relaunch_threshold: 0.1,
      relaunch_gate: completed > 0 && discarded / completed <= 0.1 ? 'pass' : 'fail',
      error_code_counts: errorCodeCounts,
      residual_issue_counts: issueCounts,
    },
    rows,
  };
  if (outputPath) {
    const resolvedOutput = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
    fs.writeFileSync(resolvedOutput, `${JSON.stringify(artifact, null, 2)}\n`);
  }
  return artifact;
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string' },
      out: { type: 'string' },
      'expected-source-sha': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.help || !values.root || !values.out) {
    process.stdout.write(
      'Usage: node scripts/replay-adaptive-warrant-semantic-counterfactual.js --root <halted-study-root> --out <artifact.json> [--expected-source-sha <sha>]\n',
    );
    if (!values.help) process.exitCode = 1;
    return;
  }
  const artifact = replayAdaptiveWarrantSemanticCounterfactual({
    root: values.root,
    outputPath: values.out,
    expectedSourceSha: values['expected-source-sha'],
  });
  process.stdout.write(`${JSON.stringify(artifact.result, null, 2)}\n`);
  if (artifact.result.relaunch_gate !== 'pass') process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
