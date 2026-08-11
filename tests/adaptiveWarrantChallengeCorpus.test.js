import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  adaptiveWarrantChallengeSourceFingerprint,
  buildAdaptiveWarrantChallengeCorpus,
  validateAdaptiveWarrantChallengeFreeze,
  writeAdaptiveWarrantChallengeCorpus,
} from '../scripts/build-adaptive-warrant-challenge-corpus.js';
import {
  ADAPTIVE_WARRANT_ANNOTATION_AUTHORIZATION_REQUEST_SCHEMA,
  ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA,
  ADAPTIVE_WARRANT_CHALLENGE_DIAGNOSTIC_MINIMA,
  prepareAdaptiveWarrantAnnotationBatches,
  validateAdaptiveWarrantAnnotationAuthorizationRequest,
} from '../scripts/prepare-adaptive-warrant-annotation-batches.js';

function cleanTestProvenance() {
  return {
    ...adaptiveWarrantChallengeSourceFingerprint(),
    gitCommit: 'a'.repeat(40),
    gitBranch: 'test',
    gitStatus: '',
  };
}

function writeEmptyExcludedCorpus(root) {
  const excludedPath = path.join(root, 'excluded-prior-corpus.json');
  fs.writeFileSync(excludedPath, '{"cases":[]}\n');
  return excludedPath;
}

test('authored challenge realizes its declared diagnostic coverage without becoming gate evidence', () => {
  const built = buildAdaptiveWarrantChallengeCorpus({
    studyId: 'diagnostic-challenge-test',
    handbookSha256: 'b'.repeat(64),
    provenance: { combinedSha256: 'c'.repeat(64) },
  });
  assert.equal(built.corpus.cases.length, 24);
  assert.equal(built.corpus.sampling.diagnostic_only, true);
  assert.equal(built.corpus.sampling.gate_eligible, false);
  for (const [stratum, minimum] of Object.entries(ADAPTIVE_WARRANT_CHALLENGE_DIAGNOSTIC_MINIMA)) {
    assert.ok(built.supportPlan.strata[stratum].length >= minimum, `${stratum} diagnostic coverage`);
  }
  assert.equal(new Set(built.corpus.cases.map((row) => row.sample_id)).size, 24);
  assert.deepEqual(
    built.corpus.cases.map((row) => row.sample_id),
    [...built.corpus.cases.map((row) => row.sample_id)].sort(),
  );
});

test('challenge source provenance binds the builder, collection logic, and dedicated tests', () => {
  const provenance = adaptiveWarrantChallengeSourceFingerprint();
  for (const relative of [
    'config/hermetic-test-manifest.json',
    'package.json',
    'scripts/build-adaptive-warrant-challenge-corpus.js',
    'scripts/prepare-adaptive-warrant-annotation-batches.js',
    'tests/adaptiveWarrantChallengeCorpus.test.js',
  ]) {
    assert.match(provenance.files[relative], /^[0-9a-f]{64}$/u, relative);
  }
  assert.equal(provenance.dependencyPolicy.targetedChallengeBuilderAndTests, true);
});

test('challenge freeze is gate-ineligible, drift-checked, and produces a digest-bound bounded authorization', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-diagnostic-challenge-'));
  try {
    const frozen = writeAdaptiveWarrantChallengeCorpus({
      outputDir: path.join(root, 'freeze'),
      provenance: cleanTestProvenance(),
      excludedCorpusPaths: [writeEmptyExcludedCorpus(root)],
    });
    assert.equal(frozen.manifest.inferential_role, 'diagnostic_only');
    assert.equal(frozen.manifest.gate_eligible, false);
    assert.equal(frozen.manifest.may_contribute_to_pass_fail_gate, false);
    assert.equal(Object.hasOwn(frozen.manifest, 'decision_gate'), false);
    assert.deepEqual(validateAdaptiveWarrantChallengeFreeze({ manifestPath: frozen.manifestPath }), {
      ok: true,
      diagnostic_only: true,
      gate_eligible: false,
      cases: 24,
      source_provenance_sha256: cleanTestProvenance().combinedSha256,
    });

    const prepared = prepareAdaptiveWarrantAnnotationBatches({
      corpusPath: frozen.corpusPath,
      handbookPath: frozen.handbookPath,
      outputDir: path.join(root, 'collection'),
      corpusRole: 'targeted_challenge',
      supportPlanPath: frozen.supportPlanPath,
      batchSize: 8,
      maxAnnotationCalls: 8,
    });
    assert.equal(prepared.manifest.gate_eligible, false);
    assert.match(prepared.manifest.inference_boundary, /Diagnostic only/u);
    assert.equal(prepared.authorizationRequest.schema, ADAPTIVE_WARRANT_ANNOTATION_AUTHORIZATION_REQUEST_SCHEMA);
    assert.equal(prepared.authorizationRequest.call_budget.planned_calls, 6);
    assert.equal(prepared.authorizationRequest.call_budget.maximum_calls, 8);
    assert.equal(prepared.authorizationRequest.bindings.reader_packets.length, 6);
    assert.match(prepared.authorizationRequest.approval_digest, /^[0-9a-f]{64}$/u);
    const firstBatch = prepared.manifest.readers[0].batches[0];
    const firstPacket = JSON.parse(fs.readFileSync(firstBatch.packet_path, 'utf8'));
    const firstOutputSchema = JSON.parse(fs.readFileSync(firstBatch.output_schema_path, 'utf8'));
    assert.deepEqual(firstPacket.response_json_schema, firstOutputSchema);
    assert.deepEqual(firstOutputSchema.properties.schema.enum, [ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA]);
    assert.deepEqual(firstOutputSchema.properties.reader_id.enum, ['reader-a']);
    assert.deepEqual(firstOutputSchema.properties.batch_id.enum, ['reader-a-batch-01']);
    assert.deepEqual(firstOutputSchema.properties.cases_by_sample_id.required, firstBatch.required_sample_ids);
    assert.deepEqual(Object.keys(firstOutputSchema.properties.cases_by_sample_id.properties), firstBatch.required_sample_ids);
    assert.equal(firstOutputSchema.properties.cases_by_sample_id.additionalProperties, false);
    assert.deepEqual(
      firstOutputSchema.$defs.case.properties.recommended_action_family.enum,
      frozen.corpus.allowed_recommended_action_families,
    );
    assert.deepEqual(
      firstPacket.allowed_recommended_action_families,
      frozen.corpus.allowed_recommended_action_families,
    );
    assert.match(
      firstOutputSchema.$defs.case.properties.open_obligation_source_turns.description,
      /empty for none, satisfied, or withdrawn_or_transferred/u,
    );
    assert.doesNotMatch(JSON.stringify(firstOutputSchema.properties), /annotator_id|annotation_run_id/u);
    assert.ok(
      firstPacket.instructions.some(
        (instruction) =>
          instruction.includes('assembled reader artifact') &&
          instruction.includes(ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA),
      ),
    );
    assert.ok(
      firstPacket.instructions.some(
        (instruction) =>
          instruction.includes('open_obligation_source_turns') && instruction.includes('satisfied'),
      ),
    );
    assert.match(firstBatch.output_schema_sha256, /^[0-9a-f]{64}$/u);
    assert.equal(
      prepared.authorizationRequest.bindings.reader_packets[0].output_schema_sha256,
      firstBatch.output_schema_sha256,
    );
    assert.deepEqual(
      validateAdaptiveWarrantAnnotationAuthorizationRequest({
        requestPath: prepared.authorizationRequestPath,
        manifestPath: prepared.manifestPath,
      }),
      {
        ok: true,
        approval_digest: prepared.authorizationRequest.approval_digest,
        planned_calls: 6,
        maximum_calls: 8,
      },
    );

    const frozenOutputSchema = fs.readFileSync(firstBatch.output_schema_path, 'utf8');
    fs.appendFileSync(firstBatch.output_schema_path, '\n');
    assert.throws(
      () =>
        validateAdaptiveWarrantAnnotationAuthorizationRequest({
          requestPath: prepared.authorizationRequestPath,
          manifestPath: prepared.manifestPath,
        }),
      /output schema drift/u,
    );
    fs.writeFileSync(firstBatch.output_schema_path, frozenOutputSchema);

    fs.appendFileSync(frozen.corpusPath, '\n');
    assert.throws(
      () => validateAdaptiveWarrantChallengeFreeze({ manifestPath: frozen.manifestPath }),
      /blinded corpus drift/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('challenge freeze proves zero overlap with explicitly excluded corpora', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-diagnostic-overlap-'));
  try {
    const first = writeAdaptiveWarrantChallengeCorpus({
      outputDir: path.join(root, 'first'),
      provenance: cleanTestProvenance(),
      excludedCorpusPaths: [writeEmptyExcludedCorpus(root)],
    });
    assert.throws(
      () =>
        writeAdaptiveWarrantChallengeCorpus({
          outputDir: path.join(root, 'second'),
          provenance: cleanTestProvenance(),
          excludedCorpusPaths: [first.corpusPath],
        }),
      /overlaps 24 excluded public cases/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
