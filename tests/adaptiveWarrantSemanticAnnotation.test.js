import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ADAPTIVE_WARRANT_SEMANTIC_ANNOTATION_RESPONSE_SCHEMA,
  ADAPTIVE_WARRANT_SEMANTIC_READER_FIELD_CONTRACT,
  auditAdaptiveWarrantSemanticContractCatalog,
  auditAdaptiveWarrantSemanticReaderSchemaTotality,
  buildAdaptiveWarrantSemanticConsensus,
  materializeAdaptiveWarrantSemanticReaderEvent,
  scoreAdaptiveWarrantSemanticExtraction,
  summarizeAdaptiveWarrantSemanticDiagnosticSupport,
  validateAdaptiveWarrantSemanticAnnotationResponse,
} from '../services/adaptiveWarrantSemanticAnnotation.js';
import {
  assembleAdaptiveWarrantSemanticAnnotationResponse,
  prepareAdaptiveWarrantSemanticAnnotationBatches,
} from '../scripts/prepare-adaptive-warrant-semantic-annotations.js';
import { prepareAdaptiveWarrantAnnotationBatches } from '../scripts/prepare-adaptive-warrant-annotation-batches.js';
import { buildAdaptiveWarrantV3SemanticDiagnostic } from '../scripts/build-adaptive-warrant-v3-semantic-diagnostic.js';
import { runAdaptiveWarrantSemanticBrittlenessPreflight } from '../scripts/run-adaptive-warrant-semantic-brittleness-preflight.js';
import { buildAdaptiveWarrantSemanticSmokeCorpus } from '../scripts/run-adaptive-warrant-semantic-schema-smoke.js';
import { buildAdaptiveWarrantSemanticSchemaAcceptanceCorpus } from '../scripts/run-adaptive-warrant-semantic-schema-acceptance-ping.js';
import {
  ADAPTIVE_WARRANT_SEMANTIC_SCHEMA_ACCEPTANCE_RESULT_SCHEMA,
  validateAdaptiveWarrantSemanticPreflightArtifact,
  validateAdaptiveWarrantSemanticSchemaAcceptanceResult,
} from '../services/adaptiveWarrantSemanticPreflight.js';

const CORPUS_SHA = 'frozen-semantic-corpus';

function target(index) {
  return {
    kind: 'record_entry',
    target_id: `target-bay-${index}-access-record`,
    public_identifier_ids: [`public-id-bay-${index}`],
    requested_value_types: ['time'],
    component_ids: ['access_time'],
  };
}

function readerTarget(kind, index) {
  const value = target(index);
  if (kind !== 'tutor_directed_public_result_request') {
    value.requested_value_types = [];
    value.component_ids = [];
  }
  return value;
}

function action(kind, index) {
  return kind === 'tutor_directed_public_result_request'
    ? {
        mode: 'requested',
        executor: 'tutor',
        action: 'supply_public_result',
        action_object_id: `action-object-bay-${index}-access-time`,
      }
    : {
        mode: 'proposed',
        executor: 'learner',
        action: 'perform_public_test',
        action_object_id: `action-object-inspect-bay-${index}-log`,
      };
}

function event(kind, text, index) {
  return {
    speaker: 'learner',
    speech_act: kind,
    target: readerTarget(kind, index),
    requested_or_proposed_action: action(kind, index),
    evidence_span: { text, start: 0, end: text.length },
  };
}

function readerEvent(kind, text, index) {
  const full = event(kind, text, index);
  return {
    speech_act: full.speech_act,
    target: {
      state: 'catalog',
      target_id: full.target.target_id,
      requested_value_types: full.target.requested_value_types,
      component_ids: full.target.component_ids,
    },
    requested_or_proposed_action: {
      state: 'catalog',
      executor: full.requested_or_proposed_action.executor,
      action_object_id: full.requested_or_proposed_action.action_object_id,
    },
    evidence_span: full.evidence_span,
  };
}

function fixture(count = 8) {
  const cases = Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const request = index < Math.ceil(count / 2);
    const learner = request
      ? `Please give me the bay-${number} access time.`
      : `I will inspect the bay-${number} log next.`;
    return {
      sample_id: `sample-${number}`,
      current_learner_turn: { turn: 2, learner },
      kind: request ? 'tutor_directed_public_result_request' : 'learner_proposed_test',
    };
  });
  return {
    schema: 'blinded-fixture',
    study_id: 'semantic-brittleness-preflight-test',
    blinded: true,
    semantic_annotation_catalog: {
      schema: 'machinespirits.adaptation-refinement.semantic-event-reader-catalog.v3',
      targets: cases.map((row, index) => ({
        target_id: target(index + 1).target_id,
        kind: target(index + 1).kind,
        public_identifier_ids: target(index + 1).public_identifier_ids,
        allowed_value_types: target(index + 1).requested_value_types,
        component_ids: target(index + 1).component_ids,
        display_label: `bay ${index + 1} access record`,
      })),
      public_identifiers: cases.map((row, index) => ({
        public_identifier_id: target(index + 1).public_identifier_ids[0],
        display_label: `bay-${index + 1}`,
      })),
      components: [{ component_id: 'access_time', display_label: 'access time' }],
      action_objects: cases.map((row, index) => ({
        action_object_id: action(row.kind, index + 1).action_object_id,
        mode: action(row.kind, index + 1).mode,
        action: action(row.kind, index + 1).action,
        target_id: target(index + 1).target_id,
        display_label: `${row.kind} bay ${index + 1}`,
      })),
    },
    cases,
  };
}

function reader(corpus, readerId, runId) {
  return {
    schema: ADAPTIVE_WARRANT_SEMANTIC_ANNOTATION_RESPONSE_SCHEMA,
    study_id: corpus.study_id,
    corpus_sha256: CORPUS_SHA,
    annotator_id: readerId,
    annotation_run_id: runId,
    cases: corpus.cases.map((row, index) => ({
      sample_id: row.sample_id,
      genuinely_ambiguous: false,
      ambiguity_reason: 'none',
      assembly_rejection: null,
      events: [event(row.kind, row.current_learner_turn.learner, index + 1)],
      note: 'The executor and public action are explicit.',
    })),
  };
}

function predictions(corpus) {
  return Object.fromEntries(
    corpus.cases.map((row, index) => {
      const predicted = event(row.kind, row.current_learner_turn.learner, index + 1);
      return [
        row.sample_id,
        {
          extraction_status: 'accepted',
          counts: { accepted: 1, uncertain: 0, rejected: 0 },
          events: [
            {
              ...predicted,
              event_id: `event-${index + 1}`,
              validation: { status: 'accepted', issues: [] },
            },
          ],
        },
      ];
    }),
  );
}

test('semantic readers validate independently and the separate diagnostic scorer reaches perfect agreement', () => {
  const corpus = fixture();
  const readerA = reader(corpus, 'reader-a', 'run-a');
  const readerB = reader(corpus, 'reader-b', 'run-b');
  assert.equal(
    validateAdaptiveWarrantSemanticAnnotationResponse({ response: readerA, corpus, corpusSha256: CORPUS_SHA }).ok,
    true,
  );
  const consensus = buildAdaptiveWarrantSemanticConsensus({ readerA, readerB, corpus, corpusSha256: CORPUS_SHA });
  assert.equal(consensus.raw_structure_agreement, 1);
  assert.equal(consensus.hard_consensus_cases, 8);
  assert.equal(summarizeAdaptiveWarrantSemanticDiagnosticSupport(consensus).status, 'insufficient_support');
  const score = scoreAdaptiveWarrantSemanticExtraction({
    consensus,
    predictionsBySampleId: predictions(corpus),
    corpusRole: 'targeted_challenge',
  });
  assert.equal(score.verdict, 'diagnostic_only');
  assert.equal(score.core_request_proposal_support.status, 'supported');
  assert.equal(score.metrics.result_request_precision, 1);
  assert.equal(score.metrics.result_request_recall, 1);
  assert.equal(score.metrics.subject_value_partition_accuracy, 1);
  assert.equal(score.metrics.proposed_test_false_obligation_rate, 0);
});

test('request/proposal cells are inconclusive below the predeclared four-by-four support floor', () => {
  const corpus = fixture(6);
  const consensus = buildAdaptiveWarrantSemanticConsensus({
    readerA: reader(corpus, 'reader-a', 'run-a'),
    readerB: reader(corpus, 'reader-b', 'run-b'),
    corpus,
    corpusSha256: CORPUS_SHA,
  });
  const score = scoreAdaptiveWarrantSemanticExtraction({
    consensus,
    predictionsBySampleId: predictions(corpus),
    corpusRole: 'targeted_challenge',
  });
  assert.equal(score.core_request_proposal_support.status, 'inconclusive_support');
  assert.equal(score.checks.result_request_precision, 'inconclusive_support');
  assert.equal(score.checks.result_request_recall, 'inconclusive_support');
  assert.equal(score.checks.request_proposal_macro_f1, 'inconclusive_support');
  assert.equal(score.verdict, 'diagnostic_only');
});

test('semantic annotation validation rejects non-literal spans before consensus', () => {
  const corpus = fixture();
  const response = reader(corpus, 'reader-a', 'run-a');
  response.cases[0].events[0].evidence_span.end -= 1;
  assert.throws(
    () => validateAdaptiveWarrantSemanticAnnotationResponse({ response, corpus, corpusSha256: CORPUS_SHA }),
    /not an exact current-turn substring/u,
  );
});

test('semantic collection freezes exact packets and derives only unique literal span offsets', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-annotation-'));
  const corpus = fixture();
  const corpusPath = path.join(root, 'corpus.json');
  const handbookPath = path.join(root, 'handbook.md');
  fs.writeFileSync(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`);
  fs.writeFileSync(handbookPath, '# Frozen semantic handbook\n');
  const prepared = prepareAdaptiveWarrantSemanticAnnotationBatches({
    corpusPath,
    handbookPath,
    outputDir: path.join(root, 'collection'),
    corpusRole: 'targeted_challenge',
    batchSize: 4,
    maximumCalls: 4,
    preflightMode: true,
  });
  assert.equal(prepared.authorizationRequest.call_budget.planned_calls, 4);
  assert.equal(prepared.authorizationRequest.call_budget.maximum_calls, 4);
  assert.equal(
    prepared.authorizationRequest.payload_scope.excluded.includes('private key, design support plan, and predictions'),
    true,
  );
  const firstBatchSchema = JSON.parse(fs.readFileSync(prepared.manifest.readers[0].batches[0].response_schema_path));
  assert.deepEqual(firstBatchSchema.properties.cases_by_sample_id.properties['sample-1'], { $ref: '#/$defs/case' });
  const firstSampleSchema = firstBatchSchema.$defs.case;
  assert.equal(firstSampleSchema.properties.note.type, 'string');
  const eventBranches = firstSampleSchema.properties.events.items.anyOf;
  const requestBranch = eventBranches.find(
    (branch) => branch.properties.speech_act.enum[0] === 'tutor_directed_public_result_request',
  );
  const analyticBranch = eventBranches.find(
    (branch) => branch.properties.speech_act.enum[0] === 'analytic_contribution',
  );
  assert.equal(requestBranch.properties.evidence_span.type, 'string');
  assert.equal('speaker' in requestBranch.properties, false);
  const targetSchema = firstBatchSchema.$defs[requestBranch.properties.target.$ref.split('/').at(-1)];
  const actionSchema =
    firstBatchSchema.$defs[requestBranch.properties.requested_or_proposed_action.$ref.split('/').at(-1)];
  const targetChoices = analyticBranch.properties.target.anyOf;
  assert.deepEqual(
    targetChoices.map((choice) => choice.$ref),
    ['#/$defs/t', '#/$defs/n'],
  );
  assert.deepEqual(Object.keys(targetSchema.properties).sort(), [
    'component_ids',
    'requested_value_types',
    'state',
    'target_id',
  ]);
  assert.deepEqual(Object.keys(actionSchema.properties).sort(), ['action_object_id', 'executor', 'state']);
  assert.deepEqual(
    targetSchema.properties.target_id.enum,
    corpus.semantic_annotation_catalog.targets.map((row) => row.target_id),
  );
  assert.deepEqual(
    actionSchema.properties.action_object_id.enum,
    corpus.semantic_annotation_catalog.action_objects
      .filter((row) => row.mode === 'requested' && row.action === 'supply_public_result')
      .map((row) => row.action_object_id),
  );
  assert.deepEqual(
    auditAdaptiveWarrantSemanticReaderSchemaTotality({
      schema: firstBatchSchema,
      semanticCatalog: corpus.semantic_annotation_catalog,
    }),
    {
      ok: true,
      issue_count: 0,
      issues: [],
      reader_fields_total: true,
      explicit_none_tokens: true,
      catalogue_domains_closed: true,
      provider_keywords_supported: true,
      union_branches_pairwise_disjoint: true,
      act_contract_language_equivalent: true,
      maximum_nesting_depth: 9,
      nesting_depth_within_limit: true,
    },
  );
  const unsupportedSchema = structuredClone(firstBatchSchema);
  unsupportedSchema.$defs.case.properties.note.minLength = 8;
  const unsupportedAudit = auditAdaptiveWarrantSemanticReaderSchemaTotality({
    schema: unsupportedSchema,
    semanticCatalog: corpus.semantic_annotation_catalog,
  });
  assert.equal(unsupportedAudit.ok, false);
  assert.equal(unsupportedAudit.provider_keywords_supported, false);

  const overlappingSchema = structuredClone(firstBatchSchema);
  const overlappingAnalytic = overlappingSchema.$defs.case.properties.events.items.anyOf.find(
    (branch) => branch.properties.speech_act.enum[0] === 'analytic_contribution',
  );
  overlappingAnalytic.properties.target.anyOf[1] = { $ref: '#/$defs/t' };
  const overlappingAudit = auditAdaptiveWarrantSemanticReaderSchemaTotality({
    schema: overlappingSchema,
    semanticCatalog: corpus.semantic_annotation_catalog,
  });
  assert.equal(overlappingAudit.ok, false);
  assert.equal(overlappingAudit.union_branches_pairwise_disjoint, false);
  const reader = prepared.manifest.readers[0];
  const responseDir = path.join(root, 'responses');
  fs.mkdirSync(responseDir, { recursive: true });
  for (const batch of reader.batches) {
    const packet = JSON.parse(fs.readFileSync(batch.packet_path, 'utf8'));
    const response = packet.response_template;
    for (const sampleId of batch.required_sample_ids) {
      const row = corpus.cases.find((candidate) => candidate.sample_id === sampleId);
      const packetEvent = readerEvent(row.kind, row.current_learner_turn.learner, Number(sampleId.split('-').at(-1)));
      packetEvent.evidence_span = packetEvent.evidence_span.text;
      response.cases_by_sample_id[sampleId] = {
        genuinely_ambiguous: false,
        ambiguity_reason: 'none',
        events: [packetEvent],
        note: 'The public executor and action are explicit.',
      };
    }
    fs.writeFileSync(
      path.join(responseDir, batch.expected_response_filename),
      `${JSON.stringify(response, null, 2)}\n`,
    );
  }
  const assembled = assembleAdaptiveWarrantSemanticAnnotationResponse({
    manifestPath: prepared.manifestPath,
    readerId: reader.reader_id,
    annotationRunId: 'independent-run-a',
    responseDir,
    outputPath: path.join(root, 'reader-a.json'),
  });
  assert.equal(assembled.response.cases.length, 8);
  assert.equal(
    assembled.response.cases.every((row) => Number.isInteger(row.events[0].evidence_span.start)),
    true,
  );
  const audit = JSON.parse(fs.readFileSync(assembled.auditPath, 'utf8'));
  assert.equal(audit.normalization, 'schema_declared_literal_span_and_event_order_derivation');
  assert.equal(audit.edit_count, 8);
  assert.equal(
    audit.canonicalizations.every((row) => row.operation === 'derive_unique_literal_utf16_offsets'),
    true,
  );
});

test('reader event materialization derives mechanical fields and enforces request executor asymmetry', () => {
  const corpus = fixture(1);
  const source = readerEvent('tutor_directed_public_result_request', corpus.cases[0].current_learner_turn.learner, 1);
  source.evidence_span = { text: corpus.cases[0].current_learner_turn.learner };
  const materialized = materializeAdaptiveWarrantSemanticReaderEvent({
    event: source,
    semanticCatalog: corpus.semantic_annotation_catalog,
  });
  assert.equal(materialized.speaker, 'learner');
  assert.equal(materialized.target.kind, 'record_entry');
  assert.deepEqual(materialized.target.public_identifier_ids, ['public-id-bay-1']);
  assert.equal(materialized.requested_or_proposed_action.mode, 'requested');
  assert.equal(materialized.requested_or_proposed_action.action, 'supply_public_result');

  source.requested_or_proposed_action.executor = 'learner';
  assert.throws(
    () =>
      materializeAdaptiveWarrantSemanticReaderEvent({
        event: source,
        semanticCatalog: corpus.semantic_annotation_catalog,
      }),
    /incompatible with the speech act|executor must differ|incompatible_with_speech_act/u,
  );
});

test('reader events require total non-null target and action fields with explicit none tokens', () => {
  const corpus = buildAdaptiveWarrantSemanticSmokeCorpus('b'.repeat(40));
  const analyticText = corpus.cases[0].current_learner_turn.learner.split(';')[0];
  const analytic = {
    speech_act: 'analytic_contribution',
    target: {
      state: 'catalog',
      target_id: 'target-smoke-west-landing-docket',
      requested_value_types: [],
      component_ids: [],
    },
    requested_or_proposed_action: { state: 'none' },
    evidence_span: { text: analyticText },
  };
  const materialized = materializeAdaptiveWarrantSemanticReaderEvent({
    event: analytic,
    semanticCatalog: corpus.semantic_annotation_catalog,
  });
  assert.equal(materialized.target.target_id, 'target-smoke-west-landing-docket');
  assert.equal(materialized.requested_or_proposed_action, null);

  assert.throws(
    () =>
      materializeAdaptiveWarrantSemanticReaderEvent({
        event: { ...analytic, target: null },
        semanticCatalog: corpus.semantic_annotation_catalog,
      }),
    /target must be an object/u,
  );
  assert.throws(
    () =>
      materializeAdaptiveWarrantSemanticReaderEvent({
        event: { ...analytic, requested_or_proposed_action: null },
        semanticCatalog: corpus.semantic_annotation_catalog,
      }),
    /requested_or_proposed_action must be an object/u,
  );
});

test('contract/catalog audit validates every speech act through the production annotation validator', () => {
  const corpus = buildAdaptiveWarrantSemanticSmokeCorpus('b'.repeat(40));
  const audit = auditAdaptiveWarrantSemanticContractCatalog({
    semanticCatalog: corpus.semantic_annotation_catalog,
  });
  assert.equal(audit.ok, true);
  assert.equal(audit.speech_act_count, 15);
  assert.equal(audit.worked_example_count, 15);
  assert.equal(
    audit.worked_examples.find((row) => row.speech_act === 'tutor_selection_request').target_id,
    'target-smoke-observatory-chart-choice',
  );

  const inconsistent = structuredClone(corpus.semantic_annotation_catalog);
  inconsistent.action_objects.find(
    (row) => row.action_object_id === 'action-object-smoke-select-observatory-chart',
  ).target_id = null;
  assert.throws(
    () => auditAdaptiveWarrantSemanticContractCatalog({ semanticCatalog: inconsistent }),
    /cannot satisfy tutor_selection_request/u,
  );
});

test('the tabletop contract accounts for every reader field and every mechanical derivative', () => {
  assert.deepEqual(
    Object.keys(ADAPTIVE_WARRANT_SEMANTIC_READER_FIELD_CONTRACT).sort(),
    [
      'action',
      'action_mode',
      'action_object_id',
      'ambiguity_reason',
      'assembly_rejection',
      'component_ids',
      'event_multiplicity',
      'evidence_span',
      'executor',
      'genuinely_ambiguous',
      'note',
      'public_identifier_ids',
      'requested_value_types',
      'speaker',
      'speech_act',
      'target_id',
      'target_kind',
    ].sort(),
  );
});

test('semantic annotation rejects overlapping reader events as non-atomic multiplicity', () => {
  const corpus = fixture(1);
  const response = reader(corpus, 'reader-a', 'run-a');
  response.cases[0].events.push(structuredClone(response.cases[0].events[0]));
  assert.throws(
    () => validateAdaptiveWarrantSemanticAnnotationResponse({ response, corpus, corpusSha256: CORPUS_SHA }),
    /overlapping non-atomic event spans/u,
  );
});

test('fresh V3 diagnostic supplies the predeclared semantic and rare-state construction floors', () => {
  const built = buildAdaptiveWarrantV3SemanticDiagnostic({ studyId: 'v3-diagnostic-fixture' });
  assert.equal(built.corpus.blinded, true);
  assert.equal(built.corpus.sampling.gate_eligible, false);
  assert.equal(built.corpus.cases.length, 24);
  assert.equal(built.corpus.semantic_annotation_catalog.targets.length >= 8, true);
  assert.equal(
    built.corpus.semantic_annotation_catalog.targets.some((value) => value.display_label.includes('expected')),
    false,
  );
  assert.equal(built.key.cases.length, 24);
  const strata = built.supportPlan.strata;
  assert.ok(strata.result_request.length >= 4);
  assert.ok(strata.proposed_test.length >= 4);
  assert.ok(strata.target_value_partition.length >= 4);
  assert.ok(strata.record_entry_request.length >= 2);
  assert.ok(strata.tutor_selection_request.length >= 2);
  assert.ok(strata.obligation_persistence.length >= 2);
  assert.ok(strata.obligation_resolution.length >= 2);
  assert.ok(strata.inquiry_complete.length >= 2);
  assert.ok(strata.inquiry_incomplete.length >= 6);
  for (const dimension of ['conceptual', 'interactional', 'engagement', 'pacing', 'epistemic', 'strategy_exhaustion']) {
    assert.ok(strata[`divergence_${dimension}_nonaligned`].length >= 2, dimension);
  }
  assert.equal(
    built.corpus.cases.some((row) => JSON.stringify(row).includes('expected_semantic_events')),
    false,
  );
  const expectedResponse = {
    schema: ADAPTIVE_WARRANT_SEMANTIC_ANNOTATION_RESPONSE_SCHEMA,
    study_id: built.corpus.study_id,
    corpus_sha256: CORPUS_SHA,
    annotator_id: 'private-construction-check',
    annotation_run_id: 'private-construction-check-run',
    cases: built.key.cases.map((row) => ({
      sample_id: row.sample_id,
      genuinely_ambiguous: false,
      ambiguity_reason: 'none',
      assembly_rejection: null,
      events: row.expected_semantic_events,
      note: 'Prospective construction-only contract check.',
    })),
  };
  assert.equal(
    validateAdaptiveWarrantSemanticAnnotationResponse({
      response: expectedResponse,
      corpus: built.corpus,
      corpusSha256: CORPUS_SHA,
    }).ok,
    true,
  );
});

test('fresh V3 support plan prepares a separate blinded decision-reader collection', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v3-decision-annotation-'));
  const built = buildAdaptiveWarrantV3SemanticDiagnostic({
    studyId: 'semantic-brittleness-preflight-v3-decision-fixture',
  });
  const corpusPath = path.join(root, 'corpus.json');
  const handbookPath = path.join(root, 'decision-handbook.md');
  const supportPath = path.join(root, 'support.private.json');
  fs.writeFileSync(corpusPath, `${JSON.stringify(built.corpus, null, 2)}\n`);
  fs.writeFileSync(handbookPath, '# Frozen decision handbook\n');
  built.supportPlan.corpus_sha256 = createHash('sha256').update(fs.readFileSync(corpusPath)).digest('hex');
  fs.writeFileSync(supportPath, `${JSON.stringify(built.supportPlan, null, 2)}\n`);
  const prepared = prepareAdaptiveWarrantAnnotationBatches({
    corpusPath,
    handbookPath,
    supportPlanPath: supportPath,
    outputDir: path.join(root, 'collection'),
    corpusRole: 'targeted_challenge',
    batchSize: 8,
    maxAnnotationCalls: 8,
    preflightMode: true,
  });
  assert.equal(prepared.manifest.gate_eligible, false);
  assert.equal(prepared.authorizationRequest.call_budget.planned_calls, 6);
  assert.equal(prepared.authorizationRequest.call_budget.maximum_calls, 8);
  assert.equal(prepared.manifest.support_plan.counts.result_request >= 4, true);
  assert.equal(prepared.manifest.support_plan.counts.proposed_test >= 4, true);
});

test('zero-call brittleness preflight exercises the complete instrument path and binds every fingerprint', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-brittleness-preflight-'));
  const result = runAdaptiveWarrantSemanticBrittlenessPreflight({
    outputPath: path.join(root, 'preflight.json'),
    sourceCommit: 'a'.repeat(40),
  });
  assert.equal(result.artifact.zero_model_calls, true);
  assert.equal(result.artifact.status, 'passed');
  assert.equal(result.artifact.verdict, 'instrument_ready');
  assert.equal(
    result.artifact.checks.every((row) => row.status === 'pass'),
    true,
  );
  for (const checkName of [
    'all_event_contracts_satisfiable_by_preflight_catalog',
    'smoke_catalog_worked_examples_pass_production_validator',
    'diagnostic_catalog_worked_examples_pass_production_validator',
    'all_reader_fields_total_non_nullable_and_catalogue_closed',
    'reader_schema_uses_only_supported_provider_keywords',
    'reader_anyof_branches_are_pairwise_disjoint',
    'reader_schema_matches_shared_act_contract_language',
    'reader_schema_nesting_depth_at_most_10',
    'diagnostic_prompt_and_response_schema_size_limits',
  ]) {
    assert.equal(result.artifact.checks.find((row) => row.name === checkName).status, 'pass');
  }
  assert.match(result.artifact.bindings.extraction_schema.digest, /^[0-9a-f]{64}$/u);
  assert.match(result.artifact.bindings.reader_schema_digest, /^[0-9a-f]{64}$/u);
  assert.match(result.artifact.bindings.consensus_scorer_fingerprint, /^[0-9a-f]{64}$/u);
  assert.match(result.artifact.bindings.threshold_configuration_digest, /^[0-9a-f]{64}$/u);
  assert.match(result.artifact.bindings.corpus_builder_fingerprint, /^[0-9a-f]{64}$/u);
});

test('semantic collection refuses to prepare without a passing preflight outside the internal synthetic path', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-preflight-required-'));
  const corpus = fixture();
  corpus.study_id = 'ordinary-v3-semantic-study';
  const corpusPath = path.join(root, 'corpus.json');
  const handbookPath = path.join(root, 'handbook.md');
  fs.writeFileSync(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`);
  fs.writeFileSync(handbookPath, '# Frozen semantic handbook\n');
  assert.throws(
    () =>
      prepareAdaptiveWarrantSemanticAnnotationBatches({
        corpusPath,
        handbookPath,
        outputDir: path.join(root, 'collection'),
        corpusRole: 'targeted_challenge',
      }),
    /requires a passing preflight artifact/u,
  );
});

test('semantic preflight validation refuses stale source and instrument fingerprints', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'semantic-preflight-stale-'));
  const sourceCommit = 'c'.repeat(40);
  const result = runAdaptiveWarrantSemanticBrittlenessPreflight({
    outputPath: path.join(root, 'preflight.json'),
    sourceCommit,
  });
  assert.throws(
    () =>
      validateAdaptiveWarrantSemanticPreflightArtifact({
        artifact: result.artifact,
        expectedSourceCommit: 'd'.repeat(40),
      }),
    /stale or fingerprint-mismatched/u,
  );
  const altered = structuredClone(result.artifact);
  altered.bindings.reader_schema_digest = '0'.repeat(64);
  assert.throws(
    () => validateAdaptiveWarrantSemanticPreflightArtifact({ artifact: altered, expectedSourceCommit: sourceCommit }),
    /stale or fingerprint-mismatched/u,
  );
});

test('the two-call schema smoke uses synthetic cases that are permanently excluded from evidence', () => {
  const corpus = buildAdaptiveWarrantSemanticSmokeCorpus('b'.repeat(40));
  assert.equal(corpus.synthetic_smoke_only, true);
  assert.equal(corpus.permanently_excluded_from_research, true);
  assert.equal(corpus.cases.length, 3);
  assert.equal(corpus.semantic_annotation_catalog.targets.length, 3);
  assert.equal(JSON.stringify(corpus).includes('construction_support'), false);
  assert.equal(JSON.stringify(corpus).includes('expected_semantic_events'), false);
});

test('the one-call schema-acceptance ping is synthetic, excluded, and stale results are rejected', () => {
  const sourceCommit = 'e'.repeat(40);
  const preflightSha256 = 'f'.repeat(64);
  const corpus = buildAdaptiveWarrantSemanticSchemaAcceptanceCorpus(sourceCommit);
  assert.equal(corpus.synthetic_schema_acceptance_only, true);
  assert.equal(corpus.permanently_excluded_from_research, true);
  assert.equal(corpus.cases.length, 8);
  const artifact = {
    schema: ADAPTIVE_WARRANT_SEMANTIC_SCHEMA_ACCEPTANCE_RESULT_SCHEMA,
    status: 'passed',
    inferential_role: 'transport_only_permanently_excluded',
    synthetic_case_permanently_excluded: true,
    source_commit: sourceCommit,
    response_received: true,
    calls: { attempted: 1, completed: 1, maximum: 1 },
    prohibited_tool_event_count: 0,
    preflight: { sha256: preflightSha256 },
  };
  assert.deepEqual(
    validateAdaptiveWarrantSemanticSchemaAcceptanceResult({
      artifact,
      expectedSourceCommit: sourceCommit,
      expectedPreflightSha256: preflightSha256,
    }),
    { ok: true },
  );
  assert.throws(
    () =>
      validateAdaptiveWarrantSemanticSchemaAcceptanceResult({
        artifact,
        expectedSourceCommit: sourceCommit,
        expectedPreflightSha256: '0'.repeat(64),
      }),
    /did not pass or is stale/u,
  );
});
