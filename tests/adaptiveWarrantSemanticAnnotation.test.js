import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ADAPTIVE_WARRANT_SEMANTIC_ANNOTATION_RESPONSE_SCHEMA,
  buildAdaptiveWarrantSemanticConsensus,
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

const CORPUS_SHA = 'frozen-semantic-corpus';

function target(index) {
  return {
    kind: 'record_entry',
    subject: `bay ${index} access record`,
    public_identifiers: [`bay-${index}`],
    requested_value_types: ['time'],
    required_components: ['access_time'],
  };
}

function action(kind, index) {
  return kind === 'tutor_directed_public_result_request'
    ? { mode: 'requested', actor: 'tutor', action: 'supply_public_result', object: `bay-${index} access time` }
    : { mode: 'proposed', actor: 'learner', action: 'perform_public_test', object: `inspect bay-${index} log` };
}

function event(kind, text, index) {
  return {
    speech_act: kind,
    target: target(index),
    requested_or_proposed_action: action(kind, index),
    evidence_span: { text, start: 0, end: text.length },
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
  return { schema: 'blinded-fixture', study_id: 'semantic-study', blinded: true, cases };
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
      events: [event(row.kind, row.current_learner_turn.learner, index + 1)],
      note: 'The actor and public action are explicit.',
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

test('semantic collection freezes exact packets and assembles without normalization', () => {
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
  });
  assert.equal(prepared.authorizationRequest.call_budget.planned_calls, 4);
  assert.equal(prepared.authorizationRequest.call_budget.maximum_calls, 4);
  assert.equal(
    prepared.authorizationRequest.payload_scope.excluded.includes('private key, design support plan, and predictions'),
    true,
  );
  const reader = prepared.manifest.readers[0];
  const responseDir = path.join(root, 'responses');
  fs.mkdirSync(responseDir, { recursive: true });
  for (const batch of reader.batches) {
    const packet = JSON.parse(fs.readFileSync(batch.packet_path, 'utf8'));
    const response = packet.response_template;
    for (const sampleId of batch.required_sample_ids) {
      const row = corpus.cases.find((candidate) => candidate.sample_id === sampleId);
      response.cases_by_sample_id[sampleId] = {
        genuinely_ambiguous: false,
        events: [event(row.kind, row.current_learner_turn.learner, Number(sampleId.split('-').at(-1)))],
        note: 'The public actor and action are explicit.',
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
  const audit = JSON.parse(fs.readFileSync(assembled.auditPath, 'utf8'));
  assert.equal(audit.normalization, 'none');
  assert.equal(audit.edit_count, 0);
});

test('fresh V3 diagnostic supplies the predeclared semantic and rare-state construction floors', () => {
  const built = buildAdaptiveWarrantV3SemanticDiagnostic({ studyId: 'v3-diagnostic-fixture' });
  assert.equal(built.corpus.blinded, true);
  assert.equal(built.corpus.sampling.gate_eligible, false);
  assert.equal(built.corpus.cases.length, 24);
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
});

test('fresh V3 support plan prepares a separate blinded decision-reader collection', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v3-decision-annotation-'));
  const built = buildAdaptiveWarrantV3SemanticDiagnostic({ studyId: 'v3-decision-fixture' });
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
  });
  assert.equal(prepared.manifest.gate_eligible, false);
  assert.equal(prepared.authorizationRequest.call_budget.planned_calls, 6);
  assert.equal(prepared.authorizationRequest.call_budget.maximum_calls, 8);
  assert.equal(prepared.manifest.support_plan.counts.result_request >= 4, true);
  assert.equal(prepared.manifest.support_plan.counts.proposed_test >= 4, true);
});
