import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  catalogueBindingSet,
  eventTargetSlotSet,
  scoreSemanticReaderPresenceGate,
} from '../scripts/score-semantic-reader-presence-gate.js';

const sha256 = (filePath) => createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

function fixture({
  cases = 93,
  disagreeAt = [],
  resultDisagreeAt = [],
  invalidReader = null,
  bindingFailure = false,
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'presence-gate-'));
  const sampleIds = Array.from({ length: cases }, (_, index) => `case-${String(index + 1).padStart(3, '0')}`);
  const semanticCatalog = {
    action_objects: [
      { action_object_id: 'request-a', target_id: 'target-a' },
      { action_object_id: 'test-b', target_id: 'target-b' },
      { action_object_id: 'null-action', target_id: null },
    ],
  };
  const corpus = { study_id: 'presence-fixture', cases: sampleIds.map((sample_id) => ({ sample_id })), semantic_annotation_catalog: semanticCatalog };
  const corpusPath = path.join(root, 'corpus.json');
  fs.writeFileSync(corpusPath, `${JSON.stringify(corpus)}\n`);
  const manifest = {
    study_id: corpus.study_id,
    source_commit: 'a'.repeat(40),
    corpus: { path: corpusPath, sha256: sha256(corpusPath), cases },
    readers: [],
  };
  const run = { status: 'complete', study_id: corpus.study_id, source_commit: manifest.source_commit, model: 'codex.gpt-5.6-luna', batches: [] };
  for (const readerId of ['semantic-reader-a', 'semantic-reader-b']) {
    const batches = [];
    for (const [index, sampleId] of sampleIds.entries()) {
      const batchId = `${readerId}-batch-${String(index + 1).padStart(2, '0')}`;
      const responseName = `${batchId}.response.json`;
      const responseDir = path.join(root, readerId);
      fs.mkdirSync(responseDir, { recursive: true });
      const events = [
        {
          speech_act: 'tutor_directed_public_result_request',
          target: { state: 'catalog', target_id: bindingFailure && index === 0 ? 'target-x' : 'target-a' },
          requested_or_proposed_action: { state: 'catalog', executor: 'tutor', action_object_id: 'request-a' },
          evidence_span: 'request',
        },
        {
          speech_act: 'learner_proposed_test',
          target: { state: 'catalog', target_id: 'target-b' },
          requested_or_proposed_action: { state: 'catalog', executor: 'learner', action_object_id: 'test-b' },
          evidence_span: 'test',
        },
      ];
      if (readerId === 'semantic-reader-b' && disagreeAt.includes(index)) events.pop();
      if (readerId === 'semantic-reader-b' && resultDisagreeAt.includes(index)) events.shift();
      const response = {
        schema: 'batch-v1',
        reader_id: readerId,
        batch_id: batchId,
        study_id: corpus.study_id,
        corpus_sha256: manifest.corpus.sha256,
        cases_by_sample_id: {
          [sampleId]: { genuinely_ambiguous: false, ambiguity_reason: 'none', events, note: 'fixture rationale' },
        },
      };
      const responsePath = path.join(responseDir, responseName);
      fs.writeFileSync(responsePath, `${JSON.stringify(response)}\n`);
      const schemaPath = path.join(root, `${batchId}.schema.json`);
      const schema = {
        type: 'object',
        additionalProperties: false,
        required: ['schema', 'reader_id', 'batch_id', 'study_id', 'corpus_sha256', 'cases_by_sample_id'],
        properties: {
          schema: { type: 'string', enum: ['batch-v1'] },
          reader_id: { type: 'string', enum: [readerId] },
          batch_id: { type: 'string', enum: [batchId] },
          study_id: { type: 'string', enum: [corpus.study_id] },
          corpus_sha256: { type: 'string', enum: [manifest.corpus.sha256] },
          cases_by_sample_id: { type: 'object', required: [sampleId], properties: { [sampleId]: { $ref: '#/$defs/case' } }, additionalProperties: false },
        },
        $defs: {
          case: {
            type: 'object',
            required: ['genuinely_ambiguous', 'ambiguity_reason', 'events', 'note'],
            properties: { genuinely_ambiguous: { type: 'boolean' }, ambiguity_reason: { type: 'string' }, events: { type: 'array' }, note: { type: 'string' } },
            additionalProperties: false,
          },
        },
      };
      fs.writeFileSync(schemaPath, `${JSON.stringify(schema)}\n`);
      batches.push({ batch_id: batchId, required_sample_ids: [sampleId], response_schema_path: schemaPath, expected_response_filename: responseName });
      run.batches.push({
        reader_id: readerId,
        batch_id: batchId,
        status: 'complete',
        response_path: responsePath,
        response_sha256: sha256(responsePath),
        returned_provider: 'codex',
        returned_model: 'gpt-5.6-luna',
        model_attestation_basis: 'explicit_cli_model_argument_accepted_bridge_echo',
        model_independently_attested: false,
        prohibited_tool_event_count: 0,
      });
    }
    manifest.readers.push({ reader_id: readerId, batches });
  }
  if (invalidReader) fs.rmSync(path.join(root, invalidReader), { recursive: true });
  return { root, manifest, run, corpus };
}

test('agreeing flags and both presences score consensus', () => {
  const value = fixture();
  const score = scoreSemanticReaderPresenceGate({ ...value, responsesRoot: value.root });
  assert.equal(score.verdict, 'PASS');
  assert.equal(score.metrics.presence_grain_consensus.count, 93);
});

test('either presence disagreement scores non-consensus', () => {
  const value = fixture({ disagreeAt: [0] });
  const score = scoreSemanticReaderPresenceGate({ ...value, responsesRoot: value.root });
  assert.equal(score.cases[0].proposed_test_presence_agreement, false);
  assert.equal(score.cases[0].presence_grain_consensus, false);
});

test('missing response files fail closed without crashing', () => {
  const value = fixture({ invalidReader: 'semantic-reader-b' });
  const score = scoreSemanticReaderPresenceGate({ ...value, responsesRoot: value.root });
  assert.equal(score.verdict, 'FAIL');
  assert.equal(score.metrics.presence_grain_consensus.count, 0);
  assert.equal(score.invalid_inputs.length, 93);
});

test('a schema-invalid response scores every covered case non-consensus', () => {
  const value = fixture();
  const batch = value.manifest.readers[1].batches[0];
  const responsePath = path.join(value.root, 'semantic-reader-b', batch.expected_response_filename);
  const response = JSON.parse(fs.readFileSync(responsePath, 'utf8'));
  response.unregistered_field = true;
  fs.writeFileSync(responsePath, `${JSON.stringify(response)}\n`);
  const runBatch = value.run.batches.find((row) => row.batch_id === batch.batch_id);
  runBatch.response_sha256 = sha256(responsePath);
  const score = scoreSemanticReaderPresenceGate({ ...value, responsesRoot: value.root });
  assert.equal(score.cases[0].presence_grain_consensus, false);
  assert.equal(score.invalid_inputs[0].reason, 'schema_invalid');
});

test('catalogue-binding failures do not prevent presence consensus', () => {
  const value = fixture({ bindingFailure: true });
  const score = scoreSemanticReaderPresenceGate({ ...value, responsesRoot: value.root });
  assert.equal(score.cases[0].presence_grain_consensus, true);
  assert.deepEqual(score.reported_not_gating.catalogue_binding_failure_counts['semantic-reader-a'], {
    cases: 1,
    events: 1,
  });
});

test('71 of 93 consensus fails and 72 of 93 passes when other floors hold', () => {
  const failValue = fixture({
    disagreeAt: Array.from({ length: 18 }, (_, index) => index),
    resultDisagreeAt: [18, 19, 20, 21],
  });
  const failed = scoreSemanticReaderPresenceGate({ ...failValue, responsesRoot: failValue.root });
  assert.equal(failed.metrics.presence_grain_consensus.count, 71);
  assert.equal(failed.verdict, 'FAIL');
  const passValue = fixture({
    disagreeAt: Array.from({ length: 18 }, (_, index) => index),
    resultDisagreeAt: [18, 19, 20],
  });
  const passed = scoreSemanticReaderPresenceGate({ ...passValue, responsesRoot: passValue.root });
  assert.equal(passed.metrics.presence_grain_consensus.count, 72);
  assert.equal(passed.verdict, 'PASS');
});

test('the pinned object-set extractions use different slots', () => {
  const events = [{
    target: { state: 'catalog', target_id: 'target-slot' },
    requested_or_proposed_action: { state: 'catalog', action_object_id: 'catalog-action' },
  }];
  const catalog = { action_objects: [{ action_object_id: 'catalog-action', target_id: 'bound-target' }] };
  assert.deepEqual(eventTargetSlotSet(events), ['target-slot']);
  assert.deepEqual(catalogueBindingSet(events, catalog), ['bound-target']);
});
