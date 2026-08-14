#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual, parseArgs } from 'node:util';

import { adaptiveWarrantSemanticInstrumentBindings } from '../services/adaptiveWarrantSemanticPreflight.js';

export const SEMANTIC_READER_PRESENCE_GATE_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-reader-presence-gate.v1';

export const SEMANTIC_READER_PRESENCE_GATE_FLOORS = Object.freeze({
  result_request_presence_agreement: 0.8,
  proposed_test_presence_agreement: 0.8,
  ambiguity_flag_agreement: 0.9,
  presence_grain_consensus_cases: 72,
  consensus_non_ambiguous_result_request_cases: 4,
  consensus_non_ambiguous_proposed_test_cases: 4,
});

const EXPECTED_MODEL = 'codex.gpt-5.6-luna';
const UNKNOWN_ACTION = '__UNKNOWN_ACTION__';
const RESPONSE_CAP = 14000;
const PACKET_CAP = 42000;
const REGISTRATION_CONSTANTS = Object.freeze({
  corpus_sha256: '52bc3ae49f634bd2c4b872f843b1be1f15e859618b3ffa7cfa1fb0ae7cc1e184',
  extraction_schema_digest: 'e5af8f2b6877e7e427ddae77bf7ed58bf0b6d129082885a838905cad5bce820d',
  provider_response_schema_sha256: '44b4807e25f0620e2677ed49031dec558daa6f0aeec0f20a97b85ec2c6cb6bc1',
  one_case_response_schema_sha256: 'f944b9b89c7bc3c3756bfe81dac476e2e84ca1fc215dbb1b05df89b3288135f0',
  one_case_response_schema_bytes: 10930,
  one_case_packet_sha256: '237c0784f637cb74ea124a5ec2c00912e3bc39eddf6359573c276fa823c3e06b',
  preparer_sha256: '9b545f368da469d0271613751d6da6f11bb4ae1fc57fa63d39a66733ce83177c',
  reader_digest: '6cb95fd8032f4c43c9fdc1e45808680365d5a0d3eb2dda5ef085e4d97e10145f',
  response_cap: RESPONSE_CAP,
  packet_cap: PACKET_CAP,
});
const BATCH_FIELDS = Object.freeze([
  'schema',
  'reader_id',
  'batch_id',
  'study_id',
  'corpus_sha256',
  'cases_by_sample_id',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, canonical(value[key])]),
  );
}

function exactFields(value, expected) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    isDeepStrictEqual(Object.keys(value).sort(), [...expected].sort())
  );
}

export function validateJsonSchema(value, schema) {
  const errors = [];
  const root = schema;
  const visit = (candidate, node, fieldPath) => {
    if (!node || typeof node !== 'object') {
      errors.push(`${fieldPath}:missing_schema`);
      return;
    }
    if (node.$ref) {
      const prefix = '#/$defs/';
      if (!node.$ref.startsWith(prefix) || !root.$defs?.[node.$ref.slice(prefix.length)]) {
        errors.push(`${fieldPath}:unknown_ref`);
        return;
      }
      visit(candidate, root.$defs[node.$ref.slice(prefix.length)], fieldPath);
      return;
    }
    if (Array.isArray(node.anyOf)) {
      const results = node.anyOf.map((branch) => {
        const start = errors.length;
        visit(candidate, branch, fieldPath);
        return errors.splice(start);
      });
      if (!results.some((result) => result.length === 0)) errors.push(`${fieldPath}:no_anyOf_branch`);
      return;
    }
    if (Array.isArray(node.oneOf)) {
      const passing = node.oneOf.filter((branch) => {
        const start = errors.length;
        visit(candidate, branch, fieldPath);
        return errors.splice(start).length === 0;
      });
      if (passing.length !== 1) errors.push(`${fieldPath}:oneOf_branch_count_${passing.length}`);
      return;
    }
    const actualType = candidate === null ? 'null' : Array.isArray(candidate) ? 'array' : typeof candidate;
    const allowedTypes = Array.isArray(node.type) ? node.type : node.type ? [node.type] : [];
    if (allowedTypes.length && !allowedTypes.includes(actualType)) {
      errors.push(`${fieldPath}:type_${actualType}`);
      return;
    }
    if (Array.isArray(node.enum) && !node.enum.some((entry) => Object.is(entry, candidate))) {
      errors.push(`${fieldPath}:not_in_enum`);
    }
    if (actualType === 'object') {
      const properties = node.properties || {};
      for (const key of node.required || []) {
        if (!Object.hasOwn(candidate, key)) errors.push(`${fieldPath}.${key}:required`);
      }
      for (const [key, child] of Object.entries(candidate)) {
        if (!Object.hasOwn(properties, key)) {
          if (node.additionalProperties === false) errors.push(`${fieldPath}.${key}:additional_property`);
        } else {
          visit(child, properties[key], `${fieldPath}.${key}`);
        }
      }
    }
    if (actualType === 'array') {
      if (Number.isInteger(node.minItems) && candidate.length < node.minItems) errors.push(`${fieldPath}:minItems`);
      if (Number.isInteger(node.maxItems) && candidate.length > node.maxItems) errors.push(`${fieldPath}:maxItems`);
      if (node.items) candidate.forEach((child, index) => visit(child, node.items, `${fieldPath}[${index}]`));
    }
    if (actualType === 'string') {
      if (Number.isInteger(node.minLength) && candidate.length < node.minLength) errors.push(`${fieldPath}:minLength`);
      if (Number.isInteger(node.maxLength) && candidate.length > node.maxLength) errors.push(`${fieldPath}:maxLength`);
    }
  };
  visit(value, schema, '$');
  return { valid: errors.length === 0, errors };
}

function setValues(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function eventTargetSlotSet(events) {
  return setValues(
    (events || []).filter((event) => event?.target?.state === 'catalog').map((event) => event.target.target_id),
  );
}

export function catalogueBindingSet(events, semanticCatalog) {
  const actionById = new Map(
    (semanticCatalog?.action_objects || []).map((action) => [action.action_object_id, action]),
  );
  return setValues(
    (events || [])
      .filter((event) => event?.requested_or_proposed_action?.state === 'catalog')
      .flatMap((event) => {
        const id = event.requested_or_proposed_action.action_object_id;
        const action = actionById.get(id);
        if (!action) return [UNKNOWN_ACTION];
        return action.target_id === null || action.target_id === undefined ? [] : [action.target_id];
      }),
  );
}

function bindingFailures(events, semanticCatalog) {
  const actionById = new Map(
    (semanticCatalog?.action_objects || []).map((action) => [action.action_object_id, action]),
  );
  return (events || []).filter((event) => {
    const action = event?.requested_or_proposed_action;
    if (action?.state !== 'catalog') return false;
    const registered = actionById.get(action.action_object_id);
    if (!registered) return true;
    const targetId = event?.target?.state === 'catalog' ? event.target.target_id : null;
    return registered.target_id !== targetId;
  }).length;
}

function strictIdentity(row) {
  return {
    genuinely_ambiguous: row.genuinely_ambiguous,
    ambiguity_reason: row.ambiguity_reason,
    events: (row.events || []).map((event) => ({
      speech_act: event.speech_act,
      target: canonical(event.target),
      requested_or_proposed_action: canonical(event.requested_or_proposed_action),
    })),
  };
}

function presence(row) {
  const acts = new Set((row.events || []).map((event) => event.speech_act));
  return {
    genuinely_ambiguous: row.genuinely_ambiguous,
    result_request: acts.has('tutor_directed_public_result_request'),
    proposed_test: acts.has('learner_proposed_test'),
  };
}

function responseAdmissibility({ responsePath, schemaPath, batch, readerId, manifest, run }) {
  try {
    if (!fs.existsSync(responsePath)) return { ok: false, reason: 'missing_response' };
    if (fs.statSync(responsePath).size > RESPONSE_CAP) return { ok: false, reason: 'response_cap_exceeded' };
    const response = readJson(responsePath);
    const schema = readJson(schemaPath);
    const schemaResult = validateJsonSchema(response, schema);
    if (!schemaResult.valid) return { ok: false, reason: 'schema_invalid', errors: schemaResult.errors };
    if (!exactFields(response, BATCH_FIELDS)) return { ok: false, reason: 'schema_invalid_exact_fields' };
    if (
      response.reader_id !== readerId ||
      response.batch_id !== batch.batch_id ||
      response.study_id !== manifest.study_id ||
      response.corpus_sha256 !== manifest.corpus.sha256
    ) {
      return { ok: false, reason: 'packet_binding_mismatch' };
    }
    const runBatch = run?.batches?.find((entry) => entry.reader_id === readerId && entry.batch_id === batch.batch_id);
    const [provider, ...modelParts] = String(run?.model || '').split('.');
    const bridgeEcho =
      runBatch?.model_attestation_basis === 'explicit_cli_model_argument_accepted_bridge_echo' &&
      runBatch?.returned_provider === provider &&
      runBatch?.returned_model === modelParts.join('.') &&
      runBatch?.model_independently_attested === false;
    if (
      run?.status !== 'complete' ||
      run?.study_id !== manifest.study_id ||
      run?.source_commit !== manifest.source_commit ||
      run?.model !== EXPECTED_MODEL ||
      runBatch?.status !== 'complete' ||
      path.resolve(runBatch?.response_path || '') !== path.resolve(responsePath) ||
      runBatch?.response_sha256 !== fileSha256(responsePath) ||
      !(runBatch?.model_independently_attested === true || bridgeEcho) ||
      Number(runBatch?.prohibited_tool_event_count || 0) !== 0
    ) {
      return { ok: false, reason: 'provenance_inadmissible' };
    }
    return { ok: true, response };
  } catch (error) {
    return { ok: false, reason: 'unreadable_or_invalid_response', error: error.message };
  }
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function floorCell(observed, floor) {
  return { observed, floor, pass: observed >= floor };
}

export function preflightSemanticReaderPresenceGate({ manifestPath, preflightPath, schemaAcceptancePath }) {
  const manifest = readJson(path.resolve(manifestPath));
  const priorPreflight = readJson(path.resolve(preflightPath));
  const schemaAcceptance = readJson(path.resolve(schemaAcceptancePath));
  const firstBatch = manifest.readers?.[0]?.batches?.[0];
  const currentBindings = adaptiveWarrantSemanticInstrumentBindings({ sourceCommit: 'presence-gate-preflight' });
  const observed = {
    corpus_sha256: fileSha256(manifest.corpus.path),
    extraction_schema_digest: currentBindings.extraction_schema.digest,
    provider_response_schema_sha256: schemaAcceptance.response_schema?.sha256,
    one_case_response_schema_sha256: firstBatch ? fileSha256(firstBatch.response_schema_path) : null,
    one_case_response_schema_bytes: firstBatch ? fs.statSync(firstBatch.response_schema_path).size : null,
    one_case_packet_sha256: firstBatch ? fileSha256(firstBatch.packet_path) : null,
    preparer_sha256: currentBindings.source_files.preparation_and_assembly.sha256,
    reader_digest: currentBindings.reader_schema_digest,
    response_cap: firstBatch?.maximum_response_bytes,
    packet_cap: firstBatch?.maximum_packet_bytes,
  };
  const checks = Object.fromEntries(
    Object.entries(REGISTRATION_CONSTANTS).map(([name, expected]) => [
      name,
      { expected, observed: observed[name], pass: observed[name] === expected },
    ]),
  );
  checks.preflight_artifact_identity = {
    expected: {
      extraction_schema_digest: REGISTRATION_CONSTANTS.extraction_schema_digest,
      preparer_sha256: REGISTRATION_CONSTANTS.preparer_sha256,
      reader_digest: REGISTRATION_CONSTANTS.reader_digest,
    },
    observed: {
      extraction_schema_digest: priorPreflight.bindings?.extraction_schema?.digest,
      preparer_sha256: priorPreflight.bindings?.source_files?.preparation_and_assembly?.sha256,
      reader_digest: priorPreflight.bindings?.reader_schema_digest,
    },
  };
  checks.preflight_artifact_identity.pass = isDeepStrictEqual(
    checks.preflight_artifact_identity.expected,
    checks.preflight_artifact_identity.observed,
  );
  return {
    schema: 'machinespirits.adaptation-refinement.semantic-reader-presence-gate-preflight.v1',
    zero_model_calls: true,
    status: Object.values(checks).every((check) => check.pass) ? 'passed' : 'failed',
    checks,
  };
}

export function scoreSemanticReaderPresenceGate({ manifest, run, responsesRoot, corpus }) {
  const sampleIds = corpus.cases.map((row) => row.sample_id);
  const byReader = new Map();
  const invalidInputs = [];
  const bindingFailureCounts = {};
  for (const reader of manifest.readers) {
    const rows = new Map();
    let bindingFailureCases = 0;
    let bindingFailureCount = 0;
    for (const batch of reader.batches) {
      const responsePath = path.join(responsesRoot, reader.reader_id, batch.expected_response_filename);
      const admissibility = responseAdmissibility({
        responsePath,
        schemaPath: batch.response_schema_path,
        batch,
        readerId: reader.reader_id,
        manifest,
        run,
      });
      if (!admissibility.ok) {
        invalidInputs.push({
          reader_id: reader.reader_id,
          batch_id: batch.batch_id,
          sample_ids: batch.required_sample_ids,
          reason: admissibility.reason,
          errors: admissibility.errors || null,
        });
        continue;
      }
      for (const sampleId of batch.required_sample_ids) {
        const row = admissibility.response.cases_by_sample_id[sampleId];
        if (row) {
          rows.set(sampleId, row);
          const failures = bindingFailures(row.events, corpus.semantic_annotation_catalog);
          bindingFailureCount += failures;
          if (failures) bindingFailureCases += 1;
        }
      }
    }
    byReader.set(reader.reader_id, rows);
    bindingFailureCounts[reader.reader_id] = { cases: bindingFailureCases, events: bindingFailureCount };
  }
  const [readerA, readerB] = manifest.readers.map((reader) => reader.reader_id);
  const cases = sampleIds.map((sampleId) => {
    const left = byReader.get(readerA)?.get(sampleId) || null;
    const right = byReader.get(readerB)?.get(sampleId) || null;
    if (!left || !right) {
      return {
        sample_id: sampleId,
        admissible_pair: false,
        result_request_presence_agreement: false,
        proposed_test_presence_agreement: false,
        ambiguity_flag_agreement: false,
        presence_grain_consensus: false,
        strict_canonical_identity: false,
      };
    }
    const a = presence(left);
    const b = presence(right);
    const resultAgreement = a.result_request === b.result_request;
    const testAgreement = a.proposed_test === b.proposed_test;
    const flagAgreement = a.genuinely_ambiguous === b.genuinely_ambiguous;
    const consensus = resultAgreement && testAgreement && flagAgreement;
    const targetA = eventTargetSlotSet(left.events);
    const targetB = eventTargetSlotSet(right.events);
    const bindingA = catalogueBindingSet(left.events, corpus.semantic_annotation_catalog);
    const bindingB = catalogueBindingSet(right.events, corpus.semantic_annotation_catalog);
    const countDiff = left.events.length !== right.events.length;
    return {
      sample_id: sampleId,
      admissible_pair: true,
      reader_a_presence: a,
      reader_b_presence: b,
      result_request_presence_agreement: resultAgreement,
      proposed_test_presence_agreement: testAgreement,
      ambiguity_flag_agreement: flagAgreement,
      presence_grain_consensus: consensus,
      consensus_non_ambiguous: consensus && !a.genuinely_ambiguous,
      strict_canonical_identity:
        !left.genuinely_ambiguous &&
        !right.genuinely_ambiguous &&
        isDeepStrictEqual(strictIdentity(left), strictIdentity(right)),
      diff_profile: {
        counts: countDiff,
        speech_acts:
          countDiff ||
          !isDeepStrictEqual(
            left.events.map((event) => event.speech_act),
            right.events.map((event) => event.speech_act),
          ),
        targets:
          countDiff ||
          !isDeepStrictEqual(
            left.events.map((event) => canonical(event.target)),
            right.events.map((event) => canonical(event.target)),
          ),
        actions:
          countDiff ||
          !isDeepStrictEqual(
            left.events.map((event) => canonical(event.requested_or_proposed_action)),
            right.events.map((event) => canonical(event.requested_or_proposed_action)),
          ),
      },
      event_target_slot_sets: { reader_a: targetA, reader_b: targetB, agree: isDeepStrictEqual(targetA, targetB) },
      catalogue_binding_sets: {
        reader_a: bindingA,
        reader_b: bindingB,
        agree: isDeepStrictEqual(bindingA, bindingB),
      },
    };
  });
  const total = sampleIds.length;
  const count = (field) => cases.filter((row) => row[field]).length;
  const resultAgreementCount = count('result_request_presence_agreement');
  const testAgreementCount = count('proposed_test_presence_agreement');
  const flagAgreementCount = count('ambiguity_flag_agreement');
  const consensusCount = count('presence_grain_consensus');
  const goldResult = cases.filter((row) => row.consensus_non_ambiguous && row.reader_a_presence.result_request).length;
  const goldTest = cases.filter((row) => row.consensus_non_ambiguous && row.reader_a_presence.proposed_test).length;
  const metrics = {
    total_cases: total,
    result_request_presence_agreement: { count: resultAgreementCount, rate: ratio(resultAgreementCount, total) },
    proposed_test_presence_agreement: { count: testAgreementCount, rate: ratio(testAgreementCount, total) },
    ambiguity_flag_agreement: { count: flagAgreementCount, rate: ratio(flagAgreementCount, total) },
    presence_grain_consensus: { count: consensusCount, rate: ratio(consensusCount, total) },
    consensus_non_ambiguous_result_request_cases: goldResult,
    consensus_non_ambiguous_proposed_test_cases: goldTest,
  };
  const floorChecks = {
    result_request_presence_agreement: floorCell(
      metrics.result_request_presence_agreement.rate,
      SEMANTIC_READER_PRESENCE_GATE_FLOORS.result_request_presence_agreement,
    ),
    proposed_test_presence_agreement: floorCell(
      metrics.proposed_test_presence_agreement.rate,
      SEMANTIC_READER_PRESENCE_GATE_FLOORS.proposed_test_presence_agreement,
    ),
    ambiguity_flag_agreement: floorCell(
      metrics.ambiguity_flag_agreement.rate,
      SEMANTIC_READER_PRESENCE_GATE_FLOORS.ambiguity_flag_agreement,
    ),
    presence_grain_consensus_cases: floorCell(
      consensusCount,
      SEMANTIC_READER_PRESENCE_GATE_FLOORS.presence_grain_consensus_cases,
    ),
    consensus_non_ambiguous_result_request_cases: floorCell(
      goldResult,
      SEMANTIC_READER_PRESENCE_GATE_FLOORS.consensus_non_ambiguous_result_request_cases,
    ),
    consensus_non_ambiguous_proposed_test_cases: floorCell(
      goldTest,
      SEMANTIC_READER_PRESENCE_GATE_FLOORS.consensus_non_ambiguous_proposed_test_cases,
    ),
  };
  const strictCount = count('strict_canonical_identity');
  const reported = {
    strict_canonical_identity: { count: strictCount, rate: ratio(strictCount, total) },
    strict_canonical_diff_profile: Object.fromEntries(
      ['targets', 'actions', 'speech_acts', 'counts'].map((field) => [
        field,
        cases.filter((row) => !row.strict_canonical_identity && row.diff_profile?.[field]).length,
      ]),
    ),
    event_target_slot_set_agreement: {
      count: cases.filter((row) => row.event_target_slot_sets?.agree).length,
      rate: ratio(cases.filter((row) => row.event_target_slot_sets?.agree).length, total),
    },
    catalogue_binding_set_agreement: {
      count: cases.filter((row) => row.catalogue_binding_sets?.agree).length,
      rate: ratio(cases.filter((row) => row.catalogue_binding_sets?.agree).length, total),
    },
    catalogue_binding_failure_counts: bindingFailureCounts,
  };
  const verdict = Object.values(floorChecks).every((check) => check.pass) ? 'PASS' : 'FAIL';
  return {
    schema: SEMANTIC_READER_PRESENCE_GATE_SCHEMA,
    verdict,
    floors: SEMANTIC_READER_PRESENCE_GATE_FLOORS,
    floor_checks: floorChecks,
    metrics,
    reported_not_gating: reported,
    invalid_inputs: invalidInputs,
    cases,
  };
}

export function scoreSemanticReaderPresenceGateFiles({ manifestPath, runPath, outputPath }) {
  const manifest = readJson(path.resolve(manifestPath));
  const run = readJson(path.resolve(runPath));
  const corpus = readJson(manifest.corpus.path);
  const artifact = scoreSemanticReaderPresenceGate({
    manifest,
    run,
    responsesRoot: path.dirname(path.resolve(runPath)),
    corpus,
  });
  artifact.study_id = manifest.study_id;
  artifact.source_commit = manifest.source_commit;
  artifact.inputs = {
    manifest_path: path.resolve(manifestPath),
    manifest_sha256: fileSha256(path.resolve(manifestPath)),
    run_path: path.resolve(runPath),
    run_sha256: fileSha256(path.resolve(runPath)),
    corpus_path: manifest.corpus.path,
    corpus_sha256: fileSha256(manifest.corpus.path),
  };
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(artifact, null, 2)}\n`);
  return artifact;
}

export function semanticReaderPresenceGateSummary(artifact) {
  const metric = artifact.metrics;
  const reported = artifact.reported_not_gating;
  return [
    `Presence-grain gate: ${artifact.verdict}`,
    `Result-request presence: ${metric.result_request_presence_agreement.count}/${metric.total_cases} (${metric.result_request_presence_agreement.rate.toFixed(3)})`,
    `Proposed-test presence: ${metric.proposed_test_presence_agreement.count}/${metric.total_cases} (${metric.proposed_test_presence_agreement.rate.toFixed(3)})`,
    `Ambiguity flag: ${metric.ambiguity_flag_agreement.count}/${metric.total_cases} (${metric.ambiguity_flag_agreement.rate.toFixed(3)})`,
    `Presence consensus: ${metric.presence_grain_consensus.count}/${metric.total_cases}`,
    `Consensus non-ambiguous result requests: ${metric.consensus_non_ambiguous_result_request_cases}`,
    `Consensus non-ambiguous proposed tests: ${metric.consensus_non_ambiguous_proposed_test_cases}`,
    `Strict canonical identity (reported only): ${reported.strict_canonical_identity.count}/${metric.total_cases}`,
    `Event-target-slot set agreement (reported only): ${reported.event_target_slot_set_agreement.count}/${metric.total_cases}`,
    `Catalogue-binding set agreement (reported only): ${reported.catalogue_binding_set_agreement.count}/${metric.total_cases}`,
    `Catalogue-binding failures (reported only): ${JSON.stringify(reported.catalogue_binding_failure_counts)}`,
  ].join('\n');
}

function usage() {
  return `Usage:
  node scripts/score-semantic-reader-presence-gate.js --manifest <collection> --run <semantic-reader-run.json> --output <report.json>
  node scripts/score-semantic-reader-presence-gate.js --preflight --manifest <collection> --preflight-artifact <preflight.json> --schema-acceptance <result.json> --output <preflight.json>
`;
}

function main() {
  const { values } = parseArgs({
    options: {
      manifest: { type: 'string' },
      run: { type: 'string' },
      output: { type: 'string' },
      preflight: { type: 'boolean' },
      'preflight-artifact': { type: 'string' },
      'schema-acceptance': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.preflight) {
    if (!values.manifest || !values['preflight-artifact'] || !values['schema-acceptance'] || !values.output) {
      process.stdout.write(usage());
      process.exitCode = 1;
      return;
    }
    const artifact = preflightSemanticReaderPresenceGate({
      manifestPath: values.manifest,
      preflightPath: values['preflight-artifact'],
      schemaAcceptancePath: values['schema-acceptance'],
    });
    fs.writeFileSync(path.resolve(values.output), `${JSON.stringify(artifact, null, 2)}\n`);
    process.stdout.write(`Presence-gate preflight: ${artifact.status}\nReport: ${path.resolve(values.output)}\n`);
    if (artifact.status !== 'passed') process.exitCode = 1;
    return;
  }
  if (values.help || !values.manifest || !values.run || !values.output) {
    process.stdout.write(usage());
    if (!values.help) process.exitCode = 1;
    return;
  }
  const artifact = scoreSemanticReaderPresenceGateFiles({
    manifestPath: values.manifest,
    runPath: values.run,
    outputPath: values.output,
  });
  process.stdout.write(`${semanticReaderPresenceGateSummary(artifact)}\nReport: ${path.resolve(values.output)}\n`);
  if (artifact.verdict !== 'PASS') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    main();
  } catch (error) {
    console.error(`[semantic-reader-presence-gate] error: ${error.message}`);
    process.exitCode = 1;
  }
}
