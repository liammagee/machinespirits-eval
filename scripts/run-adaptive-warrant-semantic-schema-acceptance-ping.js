#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  validateAdaptiveWarrantSemanticReaderCatalog,
} from '../services/adaptiveWarrantSemanticAnnotation.js';
import {
  adaptiveWarrantSemanticSourceHash,
  normalizeAdaptiveWarrantSemanticQuotePunctuation,
} from '../services/adaptiveWarrantSemanticEvents.js';
import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { dispatchTutorStubCliBridgeRequest } from '../services/tutorStubCliRequest.js';
import {
  ADAPTIVE_WARRANT_SEMANTIC_SCHEMA_ACCEPTANCE_RESULT_SCHEMA,
  adaptiveWarrantSemanticValueSha256,
  validateAdaptiveWarrantSemanticPreflightArtifact,
} from '../services/adaptiveWarrantSemanticPreflight.js';
import {
  buildTutorStubPublicLearnerAnalysisProviderOutputSchema,
  parseTutorStubPublicLearnerAnalysisStrict,
} from '../services/tutorStubPublicLearnerAnalysis.js';

export const ADAPTIVE_WARRANT_SEMANTIC_SCHEMA_ACCEPTANCE_FREEZE_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-schema-acceptance-freeze.v1';
export const ADAPTIVE_WARRANT_SEMANTIC_SCHEMA_ACCEPTANCE_PACKET_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-schema-acceptance-packet.v1';
export const ADAPTIVE_WARRANT_SEMANTIC_SCHEMA_ACCEPTANCE_AUTHORIZATION_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-schema-acceptance-authorization-request.v1';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SAMPLE_ID = 'synthetic-live-analysis-schema-acceptance-01';
const LEARNER_TEXT = 'I will compare the amber token with cast V.';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function firstAdaptiveWarrantSemanticPingValueDifference(actual, expected, fieldPath = '$') {
  if (typeof actual === 'string' && typeof expected === 'string') {
    return normalizeAdaptiveWarrantSemanticQuotePunctuation(actual) ===
      normalizeAdaptiveWarrantSemanticQuotePunctuation(expected)
      ? null
      : fieldPath;
  }
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) return fieldPath;
    if (actual.length !== expected.length) return `${fieldPath}.length`;
    for (let index = 0; index < actual.length; index += 1) {
      const difference = firstAdaptiveWarrantSemanticPingValueDifference(
        actual[index],
        expected[index],
        `${fieldPath}[${index}]`,
      );
      if (difference) return difference;
    }
    return null;
  }
  if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
    const keys = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].sort((left, right) =>
      left.localeCompare(right),
    );
    for (const key of keys) {
      if (!Object.hasOwn(actual, key) || !Object.hasOwn(expected, key)) return `${fieldPath}.${key}`;
      const difference = firstAdaptiveWarrantSemanticPingValueDifference(
        actual[key],
        expected[key],
        `${fieldPath}.${key}`,
      );
      if (difference) return difference;
    }
    return null;
  }
  return Object.is(actual, expected) ? null : fieldPath;
}

export function retainAdaptiveWarrantSemanticPingResponseEvidence({ outputDir, rawResponse, parsedResponse } = {}) {
  const retained = { raw_response: null, response: null };
  if (rawResponse !== null && rawResponse !== undefined) {
    const rawResponsePath = path.join(outputDir, 'schema-acceptance.response.raw.txt');
    fs.writeFileSync(rawResponsePath, String(rawResponse));
    retained.raw_response = { path: rawResponsePath, sha256: fileSha256(rawResponsePath) };
  }
  if (parsedResponse !== null && parsedResponse !== undefined) {
    const parsedResponsePath = path.join(outputDir, 'schema-acceptance.response.json');
    writeJson(parsedResponsePath, parsedResponse);
    retained.response = { path: parsedResponsePath, sha256: fileSha256(parsedResponsePath) };
  }
  return retained;
}

function cleanSource() {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (status) throw new Error('semantic schema-acceptance ping requires a clean committed worktree');
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) throw new Error('schema-acceptance ping requires an exact commit');
  return sourceCommit;
}

export function buildAdaptiveWarrantSemanticSchemaAcceptanceCorpus(sourceCommit) {
  return {
    schema: 'machinespirits.adaptation-refinement.annotation-corpus.v1',
    study_id: `adaptive-warrant-v3-schema-acceptance-${sourceCommit.slice(0, 12)}`,
    blinded: true,
    synthetic_schema_acceptance_only: true,
    permanently_excluded_from_research: true,
    semantic_annotation_catalog: {
      schema: 'machinespirits.adaptation-refinement.semantic-event-reader-catalog.v3',
      targets: [
        {
          target_id: 'target-schema-ping-amber-token-cast-v',
          kind: 'mark_or_tool_result',
          public_identifier_ids: ['public-id-schema-ping-amber-token', 'public-id-schema-ping-cast-v'],
          allowed_value_types: ['match_status'],
          component_ids: ['match_status'],
          display_label: 'synthetic amber-token comparison',
        },
      ],
      public_identifiers: [
        { public_identifier_id: 'public-id-schema-ping-amber-token', display_label: 'amber token' },
        { public_identifier_id: 'public-id-schema-ping-cast-v', display_label: 'cast V' },
      ],
      components: [{ component_id: 'match_status', display_label: 'match status' }],
      action_objects: [
        {
          action_object_id: 'action-object-schema-ping-compare-amber-token',
          mode: 'proposed',
          action: 'perform_public_test',
          target_id: 'target-schema-ping-amber-token-cast-v',
          display_label: 'compare the amber token with cast V',
        },
        {
          action_object_id: 'action-object-schema-ping-explain-wording',
          mode: 'requested',
          action: 'explain_wording',
          target_id: null,
          display_label: 'explain public wording',
        },
        {
          action_object_id: 'action-object-schema-ping-withdraw-request',
          mode: 'requested',
          action: 'withdraw_request',
          target_id: null,
          display_label: 'withdraw the current request',
        },
      ],
    },
    cases: [
      {
        sample_id: SAMPLE_ID,
        current_learner_turn: { turn: 2, learner: LEARNER_TEXT },
        public_evidence_at_decision: [
          'The amber token and cast V are public synthetic identifiers for this transport-only case.',
        ],
      },
    ],
  };
}

function liveAnalysisResponseTemplate() {
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
    semantic_events: {
      schema: 'machinespirits.adaptation-refinement.semantic-event-extraction.v3',
      source_turn: 2,
      source_text_sha256: adaptiveWarrantSemanticSourceHash(LEARNER_TEXT),
      events: [],
      extraction_status: 'accepted',
    },
  };
}

export function prepareAdaptiveWarrantSemanticSchemaAcceptancePing({ outputDir, preflightPath } = {}) {
  const sourceCommit = cleanSource();
  const resolvedOutput = path.resolve(outputDir);
  if (fs.existsSync(resolvedOutput) && fs.readdirSync(resolvedOutput).length) {
    throw new Error(`schema-acceptance output is not empty: ${resolvedOutput}`);
  }
  fs.mkdirSync(resolvedOutput, { recursive: true });
  const resolvedPreflight = path.resolve(preflightPath);
  const preflight = readJson(resolvedPreflight);
  validateAdaptiveWarrantSemanticPreflightArtifact({ artifact: preflight, expectedSourceCommit: sourceCommit });
  const corpus = buildAdaptiveWarrantSemanticSchemaAcceptanceCorpus(sourceCommit);
  validateAdaptiveWarrantSemanticReaderCatalog(corpus.semantic_annotation_catalog);
  const corpusPath = path.join(resolvedOutput, 'synthetic-schema-acceptance-corpus.json');
  writeJson(corpusPath, corpus);
  const corpusSha256 = fileSha256(corpusPath);
  const responseSchema = buildTutorStubPublicLearnerAnalysisProviderOutputSchema({ includeSemanticEvents: true });
  const responseSchemaPath = path.join(resolvedOutput, 'response.schema.json');
  writeJson(responseSchemaPath, responseSchema);
  const packet = {
    schema: ADAPTIVE_WARRANT_SEMANTIC_SCHEMA_ACCEPTANCE_PACKET_SCHEMA,
    task: 'transport_only_live_analysis_schema_acceptance',
    inferential_role: 'transport_only_permanently_excluded',
    instructions: [
      'This is a synthetic provider-schema acceptance ping, not a reader judgment or research case.',
      'Return the exact supplied live learner-analysis response template without changing any value.',
      'Do not use tools and do not add prose outside the JSON object.',
    ],
    study_id: corpus.study_id,
    corpus_sha256: corpusSha256,
    semantic_annotation_catalog: corpus.semantic_annotation_catalog,
    case: corpus.cases[0],
    response_template: liveAnalysisResponseTemplate(),
    response_json_schema: responseSchema,
  };
  const packetPath = path.join(resolvedOutput, 'schema-acceptance.packet.json');
  writeJson(packetPath, packet);
  const authorizationContract = {
    schema: ADAPTIVE_WARRANT_SEMANTIC_SCHEMA_ACCEPTANCE_AUTHORIZATION_SCHEMA,
    status: 'approval_required',
    task: 'transport_only_live_analysis_schema_acceptance',
    inferential_role: 'transport_only_permanently_excluded',
    synthetic_case_permanently_excluded: true,
    source_commit: sourceCommit,
    destination: 'OpenAI Codex CLI (ChatGPT-account route)',
    model: 'codex.gpt-5.6-luna',
    call_budget: { planned_calls: 1, maximum_calls: 1 },
    bindings: {
      preflight_sha256: fileSha256(resolvedPreflight),
      corpus_sha256: corpusSha256,
      packet_sha256: fileSha256(packetPath),
      response_schema_sha256: fileSha256(responseSchemaPath),
    },
  };
  const authorization = {
    ...authorizationContract,
    approval_digest: adaptiveWarrantSemanticValueSha256(authorizationContract),
  };
  const authorizationPath = path.join(resolvedOutput, 'schema-acceptance-authorization-request.json');
  writeJson(authorizationPath, authorization);
  const freeze = {
    schema: ADAPTIVE_WARRANT_SEMANTIC_SCHEMA_ACCEPTANCE_FREEZE_SCHEMA,
    status: 'frozen',
    inferential_role: 'transport_only_permanently_excluded',
    synthetic_case_permanently_excluded: true,
    source_commit: sourceCommit,
    preflight: { path: resolvedPreflight, sha256: fileSha256(resolvedPreflight) },
    corpus: { path: corpusPath, sha256: corpusSha256 },
    packet: { path: packetPath, sha256: fileSha256(packetPath) },
    response_schema: { path: responseSchemaPath, sha256: fileSha256(responseSchemaPath) },
    authorization: {
      path: authorizationPath,
      sha256: fileSha256(authorizationPath),
      approval_digest: authorization.approval_digest,
    },
  };
  const freezePath = path.join(resolvedOutput, 'schema-acceptance-freeze.json');
  writeJson(freezePath, freeze);
  return { freeze, freezePath, authorizationPath };
}

export async function runAdaptiveWarrantSemanticSchemaAcceptancePing({
  freezePath,
  outputDir,
  approvedBy,
  effort = 'medium',
  callModel = callAIWithCliBridge,
} = {}) {
  const sourceCommit = cleanSource();
  const freeze = readJson(path.resolve(freezePath));
  if (
    freeze.schema !== ADAPTIVE_WARRANT_SEMANTIC_SCHEMA_ACCEPTANCE_FREEZE_SCHEMA ||
    freeze.status !== 'frozen' ||
    freeze.source_commit !== sourceCommit ||
    freeze.inferential_role !== 'transport_only_permanently_excluded' ||
    freeze.synthetic_case_permanently_excluded !== true
  ) {
    throw new Error('semantic schema-acceptance freeze mismatch');
  }
  for (const binding of [
    freeze.preflight,
    freeze.corpus,
    freeze.packet,
    freeze.response_schema,
    freeze.authorization,
  ]) {
    if (!binding?.path || fileSha256(binding.path) !== binding.sha256) {
      throw new Error('semantic schema-acceptance artifact drift');
    }
  }
  validateAdaptiveWarrantSemanticPreflightArtifact({
    artifact: readJson(freeze.preflight.path),
    expectedSourceCommit: sourceCommit,
  });
  const authorization = readJson(freeze.authorization.path);
  const { approval_digest: approvalDigest, ...authorizationContract } = authorization;
  if (
    authorization.schema !== ADAPTIVE_WARRANT_SEMANTIC_SCHEMA_ACCEPTANCE_AUTHORIZATION_SCHEMA ||
    authorization.status !== 'approval_required' ||
    approvalDigest !== adaptiveWarrantSemanticValueSha256(authorizationContract) ||
    approvalDigest !== freeze.authorization.approval_digest ||
    !approvedBy?.trim()
  ) {
    throw new Error('semantic schema-acceptance authorization mismatch');
  }
  const resolvedOutput = path.resolve(outputDir);
  if (fs.existsSync(resolvedOutput) && fs.readdirSync(resolvedOutput).length) {
    throw new Error(`schema-acceptance run output is not empty: ${resolvedOutput}`);
  }
  fs.mkdirSync(resolvedOutput, { recursive: true });
  const resultPath = path.join(resolvedOutput, 'schema-acceptance-result.json');
  const baseResult = {
    schema: ADAPTIVE_WARRANT_SEMANTIC_SCHEMA_ACCEPTANCE_RESULT_SCHEMA,
    inferential_role: 'transport_only_permanently_excluded',
    synthetic_case_permanently_excluded: true,
    source_commit: sourceCommit,
    preflight: freeze.preflight,
    response_schema: freeze.response_schema,
    destination: authorization.destination,
    model: authorization.model,
    calls: { attempted: 1, completed: 0, maximum: 1 },
    response_received: false,
    prohibited_tool_event_count: 0,
  };
  let rawResponse = null;
  let rawResponseBinding = null;
  let parsedResponse = null;
  let parsedResponseBinding = null;
  let firstDifferingFieldPath = null;
  let failureStatus = 'provider_failed_before_response';
  try {
    const response = await dispatchTutorStubCliBridgeRequest(callModel, {
      resolved: { provider: 'codex', model: 'gpt-5.6-luna' },
      systemPrompt:
        'You are a transport-only structured-output schema acceptance ping. Return exactly the supplied schema-bound JSON and do not use tools.',
      userPrompt: JSON.stringify(readJson(freeze.packet.path)),
      role: 'adaptive-warrant-semantic-schema-acceptance',
      outputSchema: readJson(freeze.response_schema.path),
      effort,
      timeoutMs: 600_000,
      maxStdoutBytes: 256_000,
      maxStderrBytes: 64_000,
    });
    rawResponse = String(response?.text || '').trim();
    ({ raw_response: rawResponseBinding } = retainAdaptiveWarrantSemanticPingResponseEvidence({
      outputDir: resolvedOutput,
      rawResponse,
    }));
    failureStatus = 'response_received_strict_parse_failed';
    parsedResponse = parseTutorStubPublicLearnerAnalysisStrict(rawResponse, {
      includeSemanticEvents: true,
      benchmarkLearnerText: LEARNER_TEXT,
      semanticPublicText: JSON.stringify(readJson(freeze.packet.path)),
      tutorTurn: 2,
    }).parsed;
    ({ response: parsedResponseBinding } = retainAdaptiveWarrantSemanticPingResponseEvidence({
      outputDir: resolvedOutput,
      parsedResponse,
    }));
    failureStatus = 'parsed_response_provenance_failed';
    const prohibitedToolEventCount = Number(response.prohibitedToolEventCount || 0);
    if (response.structuredOutput !== true)
      throw new Error('schema-acceptance response lacked structured-output provenance');
    if (prohibitedToolEventCount !== 0) throw new Error('schema-acceptance ping used a prohibited tool');
    const corpus = readJson(freeze.corpus.path);
    if (corpus.cases.length !== 1 || corpus.cases[0].sample_id !== SAMPLE_ID) {
      throw new Error('schema-acceptance synthetic corpus binding mismatch');
    }
    firstDifferingFieldPath = firstAdaptiveWarrantSemanticPingValueDifference(
      parsedResponse,
      readJson(freeze.packet.path).response_template,
    );
    if (firstDifferingFieldPath) {
      failureStatus = 'parsed_response_canonical_value_mismatch';
      throw new Error(`schema-acceptance live response value mismatch at ${firstDifferingFieldPath}`);
    }
    const result = {
      ...baseResult,
      status: 'passed',
      calls: { attempted: 1, completed: 1, maximum: 1 },
      response_received: true,
      strict_parse_succeeded: true,
      validator_accepted: true,
      canonical_value_match: true,
      first_differing_field_path: null,
      structured_output: true,
      prohibited_tool_event_count: prohibitedToolEventCount,
      returned_provider: response.provider || null,
      returned_model: response.model || null,
      raw_response: rawResponseBinding,
      response: parsedResponseBinding,
    };
    writeJson(resultPath, result);
    return { result, resultPath };
  } catch (error) {
    writeJson(resultPath, {
      ...baseResult,
      status: failureStatus,
      response_received: rawResponse !== null,
      strict_parse_succeeded: parsedResponse !== null,
      validator_accepted: parsedResponse !== null,
      canonical_value_match: firstDifferingFieldPath === null ? null : false,
      first_differing_field_path: firstDifferingFieldPath,
      raw_response: rawResponseBinding,
      response: parsedResponseBinding,
      error: String(error.message || error),
    });
    throw error;
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const { values } = parseArgs({
    args,
    options: {
      out: { type: 'string' },
      preflight: { type: 'string' },
      freeze: { type: 'string' },
      'approved-by': { type: 'string' },
      effort: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  const usage =
    'Usage:\n  node scripts/run-adaptive-warrant-semantic-schema-acceptance-ping.js prepare --out <empty-dir> --preflight <passing-artifact>\n  node scripts/run-adaptive-warrant-semantic-schema-acceptance-ping.js run --freeze <freeze.json> --out <empty-dir> --approved-by <standing-authorization> [--effort medium]\n';
  if (values.help || !command) {
    process.stdout.write(usage);
    return;
  }
  if (command === 'prepare') {
    const result = prepareAdaptiveWarrantSemanticSchemaAcceptancePing({
      outputDir: values.out,
      preflightPath: values.preflight,
    });
    process.stdout.write(`${result.freezePath}\n${result.authorizationPath}\n`);
    return;
  }
  if (command === 'run') {
    const result = await runAdaptiveWarrantSemanticSchemaAcceptancePing({
      freezePath: values.freeze,
      outputDir: values.out,
      approvedBy: values['approved-by'],
      effort: values.effort || 'medium',
    });
    process.stdout.write(`${result.resultPath}\n`);
    return;
  }
  throw new Error(`unknown command ${command}\n${usage}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    console.error(`[semantic-schema-acceptance] error: ${error.message}`);
    process.exitCode = 1;
  });
}
