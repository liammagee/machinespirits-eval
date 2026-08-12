#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import {
  ADAPTIVE_WARRANT_LIVE_SEMANTIC_SEAT_PING_SCHEMA,
  validateAdaptiveWarrantSemanticPreflightArtifact,
} from '../services/adaptiveWarrantSemanticPreflight.js';
import { dispatchTutorStubCliBridgeRequest } from '../services/tutorStubCliRequest.js';
import {
  TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_SYSTEM_PROMPT,
  buildTutorStubPublicLearnerAnalysisProviderOutputSchema,
  parseTutorStubPublicLearnerAnalysisStrict,
  rewriteTutorStubPublicLearnerAnalysisPromptProfile,
} from '../services/tutorStubPublicLearnerAnalysis.js';

export const ADAPTIVE_WARRANT_LIVE_SEMANTIC_SEAT_PROBE_SCHEMA =
  'machinespirits.adaptation-refinement.live-semantic-seat-diagnostic-probe.v1';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DEFAULT_SOURCE_ROOT = '/private/tmp/adaptive-warrant-v3-matrix-live-a4529e79-s505';
const DEFAULT_SOURCE_COMMIT = 'a4529e798012b2fb0366fea30fc2a0798b3a69ab';
const DEFAULT_SOURCE_CLOSURE = '60124bc8910b54bbebde7db2a17a9d458edfaf220622d0791a01707236046ffc';
const MAXIMUM_CALLS = 48;
const MAXIMUM_PROMPT_CHARS = 42000;
const MAXIMUM_PROMPT_APPROXIMATE_TOKENS = 10500;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function cleanSource() {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (status) throw new Error('live semantic-seat probe requires a clean committed worktree');
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/u.test(commit)) throw new Error('live semantic-seat probe requires an exact commit');
  return commit;
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

function traceFiles(sourceRoot) {
  const jobsRoot = path.join(sourceRoot, 'jobs');
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

function modelDestination(modelRef) {
  const [provider, ...parts] = String(modelRef || '').split('.');
  const model = parts.join('.');
  if (!['codex', 'claude-code'].includes(provider) || !model) {
    throw new Error(`unsupported diagnostic probe model: ${modelRef}`);
  }
  if (provider === 'codex' && model !== 'gpt-5.6-luna') {
    throw new Error(`prompt-parity probe is frozen to codex.gpt-5.6-luna, got ${modelRef}`);
  }
  if (provider === 'claude-code' && model !== 'claude-sonnet-5') {
    throw new Error(`analysis-seat upgrade is frozen to claude-code.claude-sonnet-5, got ${modelRef}`);
  }
  return { provider, model };
}

function residualIssues(error) {
  const details = error?.details;
  if (!details || typeof details !== 'object') return [String(error?.message || error)];
  return [
    ...(details.envelope_issues || []),
    ...(details.events || []).flatMap((event) => event?.validation?.issues || []),
  ];
}

function increment(counts, key) {
  counts[key] = (counts[key] || 0) + 1;
}

export function collectAdaptiveWarrantLiveSemanticProbeInputs({
  sourceRoot = DEFAULT_SOURCE_ROOT,
  expectedSourceCommit = DEFAULT_SOURCE_COMMIT,
  expectedSourceClosure = DEFAULT_SOURCE_CLOSURE,
} = {}) {
  const resolvedRoot = path.resolve(sourceRoot);
  const plan = JSON.parse(fs.readFileSync(path.join(resolvedRoot, 'study-plan.json'), 'utf8'));
  const sourceCommit = plan?.analysisProvenance?.gitCommit || plan?.provenance?.gitCommit || null;
  if (sourceCommit !== expectedSourceCommit) {
    throw new Error(`probe source commit mismatch: expected ${expectedSourceCommit}, found ${sourceCommit}`);
  }
  const files = traceFiles(resolvedRoot);
  const combinedSha256 = sha256(
    files.map((filePath) => `${path.relative(resolvedRoot, filePath)}\t${fileSha256(filePath)}`).join('\n'),
  );
  if (combinedSha256 !== expectedSourceClosure) {
    throw new Error(`probe source closure mismatch: expected ${expectedSourceClosure}, found ${combinedSha256}`);
  }
  const rows = [];
  for (const filePath of files) {
    const events = readJsonLines(filePath);
    const learnerByTurn = new Map(
      events.filter((event) => event.type === 'auto_learner_turn').map((event) => [event.turn, event.text]),
    );
    for (const event of events) {
      if (event.type !== 'model_call' || event.role !== 'tutor_stub_learner_analysis') continue;
      const learnerText = learnerByTurn.get(event.turn);
      if (typeof learnerText !== 'string') throw new Error(`missing learner text for ${filePath} turn ${event.turn}`);
      const prompt = rewriteTutorStubPublicLearnerAnalysisPromptProfile(event.request?.prompt, {
        includeRegisterSelection: true,
        includeSemanticEvents: true,
      });
      const approximateTokens = Math.ceil(prompt.length / 4);
      if (prompt.length > MAXIMUM_PROMPT_CHARS || approximateTokens > MAXIMUM_PROMPT_APPROXIMATE_TOKENS) {
        throw new Error(
          `rewritten probe prompt exceeds budget at ${path.relative(resolvedRoot, filePath)} turn ${event.turn}: ${prompt.length} chars / ${approximateTokens} approximate tokens`,
        );
      }
      rows.push({
        ordinal: rows.length + 1,
        trace: path.relative(resolvedRoot, filePath),
        run_id: event.runId,
        turn: event.turn,
        learner_text: learnerText,
        learner_text_sha256: sha256(learnerText),
        system_prompt: event.request?.systemPrompt || TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_SYSTEM_PROMPT,
        prompt,
        prompt_sha256: sha256(prompt),
        prompt_chars: prompt.length,
        prompt_approximate_tokens: approximateTokens,
      });
    }
  }
  if (rows.length < 1 || rows.length > MAXIMUM_CALLS) {
    throw new Error(`probe requires 1-${MAXIMUM_CALLS} preserved calls, found ${rows.length}`);
  }
  return {
    sourceRoot: resolvedRoot,
    sourceCommit,
    files,
    combinedSha256,
    rows,
  };
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  const output = Array(items.length);
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(items[index], index);
    }
  });
  await Promise.all(lanes);
  return output;
}

export async function runAdaptiveWarrantLiveSemanticSeatProbe({
  sourceRoot = DEFAULT_SOURCE_ROOT,
  outputDir,
  modelRef = 'codex.gpt-5.6-luna',
  expectedSourceCommit = DEFAULT_SOURCE_COMMIT,
  expectedSourceClosure = DEFAULT_SOURCE_CLOSURE,
  approvedBy,
  concurrency = 4,
  callModel = callAIWithCliBridge,
} = {}) {
  const probeCommit = cleanSource();
  if (!approvedBy?.trim()) throw new Error('live semantic-seat probe requires the standing authorization reference');
  const resolvedOutput = path.resolve(outputDir);
  if (fs.existsSync(resolvedOutput) && fs.readdirSync(resolvedOutput).length) {
    throw new Error(`diagnostic probe output is not empty: ${resolvedOutput}`);
  }
  fs.mkdirSync(path.join(resolvedOutput, 'responses'), { recursive: true });
  const destination = modelDestination(modelRef);
  const inputs = collectAdaptiveWarrantLiveSemanticProbeInputs({
    sourceRoot,
    expectedSourceCommit,
    expectedSourceClosure,
  });
  const outputSchema = buildTutorStubPublicLearnerAnalysisProviderOutputSchema({
    includeRegisterSelection: true,
    includeSemanticEvents: true,
  });
  const rows = await runPool(inputs.rows, Number(concurrency) || 1, async (input) => {
    const responsePath = path.join(resolvedOutput, 'responses', `${String(input.ordinal).padStart(3, '0')}.json`);
    const base = {
      ordinal: input.ordinal,
      trace: input.trace,
      run_id: input.run_id,
      turn: input.turn,
      learner_text_sha256: input.learner_text_sha256,
      prompt_sha256: input.prompt_sha256,
      prompt_chars: input.prompt_chars,
      prompt_approximate_tokens: input.prompt_approximate_tokens,
    };
    try {
      const response = await dispatchTutorStubCliBridgeRequest(callModel, {
        resolved: destination,
        systemPrompt: input.system_prompt,
        userPrompt: input.prompt,
        role: 'adaptive-warrant-live-semantic-seat-diagnostic',
        outputSchema,
        effort: 'low',
        timeoutMs: 600_000,
        maxStdoutBytes: 512_000,
        maxStderrBytes: 128_000,
      });
      const rawText = String(response?.text || '').trim();
      let status = 'survives';
      let errorCode = null;
      let issues = [];
      try {
        parseTutorStubPublicLearnerAnalysisStrict(rawText, {
          includeRegisterSelection: true,
          includeSemanticEvents: true,
          benchmarkLearnerText: input.learner_text,
          tutorTurn: input.turn,
          semanticPublicText: input.prompt,
        });
        if (response.structuredOutput !== true || Number(response.prohibitedToolEventCount || 0) !== 0) {
          throw Object.assign(new Error('diagnostic response provenance was not one structured no-tools call'), {
            code: 'invalid_probe_call_provenance',
          });
        }
      } catch (error) {
        status = 'discarded';
        errorCode = error?.code || error?.name || 'probe_validation_error';
        issues = residualIssues(error);
      }
      writeJson(responsePath, {
        schema: 'machinespirits.adaptation-refinement.live-semantic-seat-diagnostic-response.v1',
        inferential_role: 'diagnostic_only_never_evidence',
        model: modelRef,
        ...base,
        returned_provider: response.provider || null,
        returned_model: response.model || null,
        structured_output: response.structuredOutput === true,
        prohibited_tool_event_count: Number(response.prohibitedToolEventCount || 0),
        raw_response: rawText,
        raw_response_sha256: sha256(rawText),
        status,
        error_code: errorCode,
        residual_issues: issues,
      });
      return {
        ...base,
        status,
        error_code: errorCode,
        residual_issues: issues,
        response: { path: responsePath, sha256: fileSha256(responsePath) },
      };
    } catch (error) {
      const failure = {
        schema: 'machinespirits.adaptation-refinement.live-semantic-seat-diagnostic-response.v1',
        inferential_role: 'diagnostic_only_never_evidence',
        model: modelRef,
        ...base,
        status: 'discarded',
        error_code: error?.code || error?.name || 'probe_call_failed',
        residual_issues: [String(error?.message || error)],
      };
      writeJson(responsePath, failure);
      return { ...base, ...failure, response: { path: responsePath, sha256: fileSha256(responsePath) } };
    }
  });
  const discardedRows = rows.filter((row) => row.status === 'discarded');
  const errorCodeCounts = {};
  const residualIssueCounts = {};
  for (const row of discardedRows) {
    increment(errorCodeCounts, row.error_code);
    for (const issue of new Set(row.residual_issues || [])) increment(residualIssueCounts, issue);
  }
  const artifact = {
    schema: ADAPTIVE_WARRANT_LIVE_SEMANTIC_SEAT_PROBE_SCHEMA,
    generated_at: new Date().toISOString(),
    inferential_role: 'diagnostic_only_never_evidence',
    permanently_excluded_from_scoring_pooling_and_claims: true,
    approved_by: approvedBy,
    probe_commit: probeCommit,
    prompt_profile: 'handbook_v1',
    model: modelRef,
    destination,
    calls: { planned: rows.length, attempted: rows.length, maximum: MAXIMUM_CALLS, retries: 0 },
    source: {
      root: inputs.sourceRoot,
      commit: inputs.sourceCommit,
      trace_count: inputs.files.length,
      combined_sha256: inputs.combinedSha256,
    },
    result: {
      completed_analysis_calls: rows.length,
      surviving_calls: rows.length - discardedRows.length,
      discarded_calls: discardedRows.length,
      discard_rate: discardedRows.length / rows.length,
      relaunch_threshold: 0.15,
      relaunch_gate: discardedRows.length / rows.length <= 0.15 ? 'pass' : 'fail',
      error_code_counts: errorCodeCounts,
      residual_issue_counts: residualIssueCounts,
    },
    rows,
  };
  const artifactPath = path.join(resolvedOutput, 'diagnostic-probe.json');
  writeJson(artifactPath, artifact);
  return { artifact, artifactPath };
}

function acceptancePingTemplate() {
  return {
    classification: {
      turn: {
        summary: 'Synthetic transport-only learner analysis.',
        request_type: 'off_task_or_mixed',
        discourse_move: 'claim',
        evidence_use: 'none',
        epistemic_stance: 'exploratory',
        affect: 'neutral',
        agency: 'attempting',
        scores: {
          conceptual_engagement: { score: 3, reason: 'Synthetic transport acceptance only.' },
          epistemic_readiness: { score: 3, reason: 'Synthetic transport acceptance only.' },
        },
        pedagogical_need: 'Synthetic transport acceptance only.',
      },
      overall: {
        summary: 'Synthetic transport acceptance only.',
        trajectory: 'Synthetic transport acceptance only.',
        recurring_pattern: 'Synthetic transport acceptance only.',
        current_state: 'Synthetic transport acceptance only.',
        next_best_tutor_move: 'Synthetic transport acceptance only.',
      },
    },
    learner_record: {
      adopt: [],
      retract: [],
      derive: [],
      hypothesis: null,
      assert_answer: null,
      human_discourse: {
        proof_status: 'unclear',
        provisional_claims: [],
        implied_warrants: [],
        missing_warrants: [],
        implied_public_premises: [],
        suppressed_or_private_premises: [],
        common_sense_bridges: [],
        illicit_hidden_premises: [],
        proof_debt_candidates: [],
        side_arc: { detected: false, type: null, reason: null, return_target: null },
      },
      notes: 'Synthetic transport acceptance only.',
    },
    semantic_events: { events: [] },
  };
}

export async function runAdaptiveWarrantLiveSemanticSeatAcceptancePing({
  outputDir,
  preflightPath,
  modelRef = 'claude-code.claude-sonnet-5',
  approvedBy,
  callModel = callAIWithCliBridge,
} = {}) {
  const sourceCommit = cleanSource();
  if (!approvedBy?.trim()) throw new Error('analysis-seat ping requires the standing authorization reference');
  const resolvedPreflight = path.resolve(preflightPath);
  validateAdaptiveWarrantSemanticPreflightArtifact({
    artifact: readJson(resolvedPreflight),
    expectedSourceCommit: sourceCommit,
  });
  const destination = modelDestination(modelRef);
  if (destination.provider !== 'claude-code') throw new Error('upgrade ping is reserved for the Claude analysis seat');
  const resolvedOutput = path.resolve(outputDir);
  if (fs.existsSync(resolvedOutput) && fs.readdirSync(resolvedOutput).length) {
    throw new Error(`analysis-seat ping output is not empty: ${resolvedOutput}`);
  }
  fs.mkdirSync(resolvedOutput, { recursive: true });
  const template = acceptancePingTemplate();
  const outputSchema = buildTutorStubPublicLearnerAnalysisProviderOutputSchema({ includeSemanticEvents: true });
  const response = await dispatchTutorStubCliBridgeRequest(callModel, {
    resolved: destination,
    systemPrompt: 'You are a transport-only structured-output acceptance ping. Return exactly the supplied JSON template and do not use tools.',
    userPrompt: JSON.stringify({ task: 'transport_only_never_evidence', response_template: template }),
    role: 'adaptive-warrant-live-semantic-seat-acceptance-ping',
    outputSchema,
    effort: 'low',
    timeoutMs: 600_000,
    maxStdoutBytes: 256_000,
    maxStderrBytes: 64_000,
  });
  const rawText = String(response?.text || '').trim();
  const parsed = parseTutorStubPublicLearnerAnalysisStrict(rawText, {
    includeSemanticEvents: true,
    benchmarkLearnerText: 'Synthetic transport-only learner turn.',
    tutorTurn: 1,
    semanticPublicText: 'Synthetic transport-only public context.',
  }).parsed;
  if (
    JSON.stringify(parsed) !== JSON.stringify(template) ||
    response.structuredOutput !== true ||
    Number(response.prohibitedToolEventCount || 0) !== 0
  ) {
    throw new Error('analysis-seat acceptance ping returned a non-matching or non-structured response');
  }
  const artifact = {
    schema: ADAPTIVE_WARRANT_LIVE_SEMANTIC_SEAT_PING_SCHEMA,
    status: 'passed',
    generated_at: new Date().toISOString(),
    inferential_role: 'transport_only_permanently_excluded',
    synthetic_case_permanently_excluded: true,
    source_commit: sourceCommit,
    preflight: { path: resolvedPreflight, sha256: fileSha256(resolvedPreflight) },
    approved_by: approvedBy,
    model: modelRef,
    destination,
    calls: { attempted: 1, completed: 1, maximum: 1 },
    response_received: true,
    structured_output: true,
    prohibited_tool_event_count: 0,
    raw_response_sha256: sha256(rawText),
  };
  const artifactPath = path.join(resolvedOutput, 'acceptance-ping.json');
  writeJson(artifactPath, artifact);
  return { artifact, artifactPath };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const { values } = parseArgs({
    args,
    options: {
      root: { type: 'string' },
      out: { type: 'string' },
      model: { type: 'string' },
      concurrency: { type: 'string' },
      'approved-by': { type: 'string' },
      preflight: { type: 'string' },
      'expected-source-sha': { type: 'string' },
      'expected-source-closure': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  const usage =
    'Usage:\n  node scripts/probe-adaptive-warrant-live-semantic-seat.js probe --out <empty-dir> --model <codex.gpt-5.6-luna|claude-code.claude-sonnet-5> --approved-by <standing-direction> [--root <seed505-root>] [--concurrency 4]\n  node scripts/probe-adaptive-warrant-live-semantic-seat.js ping --out <empty-dir> --preflight <passing-artifact> --model claude-code.claude-sonnet-5 --approved-by <standing-direction>\n';
  if (values.help || !command) {
    process.stdout.write(usage);
    return;
  }
  if (!values.out || !values.model || !values['approved-by']) throw new Error(usage.trim());
  if (command === 'probe') {
    const result = await runAdaptiveWarrantLiveSemanticSeatProbe({
      sourceRoot: values.root || DEFAULT_SOURCE_ROOT,
      outputDir: values.out,
      modelRef: values.model,
      expectedSourceCommit: values['expected-source-sha'] || DEFAULT_SOURCE_COMMIT,
      expectedSourceClosure: values['expected-source-closure'] || DEFAULT_SOURCE_CLOSURE,
      approvedBy: values['approved-by'],
      concurrency: Number(values.concurrency || 4),
    });
    process.stdout.write(`${result.artifactPath}\n${JSON.stringify(result.artifact.result, null, 2)}\n`);
    return;
  }
  if (command === 'ping') {
    if (!values.preflight) throw new Error(usage.trim());
    const result = await runAdaptiveWarrantLiveSemanticSeatAcceptancePing({
      outputDir: values.out,
      preflightPath: values.preflight,
      modelRef: values.model,
      approvedBy: values['approved-by'],
    });
    process.stdout.write(`${result.artifactPath}\n`);
    return;
  }
  throw new Error(usage.trim());
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    console.error(`[live-semantic-seat-probe] error: ${error.message}`);
    process.exitCode = 1;
  });
}
