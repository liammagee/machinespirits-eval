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
import {
  ADAPTIVE_WARRANT_ANNOTATION_RESPONSE_V4_SCHEMA,
  mechanismAnnotationHandbook,
} from '../scripts/run-adaptive-warrant-baseline-study.js';
import {
  ADAPTIVE_WARRANT_TARGETED_CHALLENGE_SCORE_SCHEMA,
  scoreAdaptiveWarrantChallengeAnnotations,
} from '../scripts/score-adaptive-warrant-challenge-annotations.js';

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

function annotationFromKey({ corpus, key, corpusSha256, annotatorId, runId }) {
  const byId = new Map(key.cases.map((row) => [row.sample_id, row]));
  return {
    schema: ADAPTIVE_WARRANT_ANNOTATION_RESPONSE_V4_SCHEMA,
    study_id: corpus.study_id,
    corpus_sha256: corpusSha256,
    annotator_id: annotatorId,
    annotation_run_id: runId,
    cases: corpus.cases.map((publicCase) => {
      const projection = byId.get(publicCase.sample_id).shadow;
      const obligations = projection.public_obligation?.obligations || [];
      const unresolved = obligations.filter((row) =>
        ['open', 'overdue', 'reactivated', 'deferred'].includes(row.status),
      );
      const state = obligations.some((row) => row.status === 'overdue' || row.status === 'reactivated')
        ? 'overdue'
        : obligations.some((row) => row.status === 'open')
          ? 'open'
          : obligations.some((row) => row.status === 'deferred')
            ? 'deferred'
            : obligations.at(-1)?.status === 'satisfied'
              ? 'satisfied'
              : ['withdrawn', 'transferred_to_learner'].includes(obligations.at(-1)?.status)
                ? 'withdrawn_or_transferred'
                : 'none';
      const basis = projection.warrant_basis.startsWith('immediate:')
        ? 'immediate_repair'
        : projection.warrant_basis.startsWith('public_obligation_')
          ? 'public_obligation'
          : projection.warrant_basis.startsWith('inquiry_complete:')
            ? 'inquiry_completion'
            : projection.warrant_basis.startsWith('inquiry_incomplete_candidate:')
              ? 'candidate_safety'
            : projection.warrant_basis.startsWith('contract_')
              ? 'action_contract'
              : projection.warrant_basis.startsWith('register_') || projection.warrant_basis.startsWith('accumulated:')
                ? 'register_or_accumulated_trouble'
                : 'none';
      return {
        sample_id: publicCase.sample_id,
        speech_act: projection.public_obligation.speech_act.kind,
        open_obligation_source_turns: [
          ...new Set(unresolved.flatMap((row) => row.source_turns || [row.created_turn])),
        ].sort((left, right) => left - right),
        obligation_state: state,
        inquiry_state: projection.inquiry_completion.status === 'complete' ? 'complete' : 'incomplete',
        commitment_transition_warranted: projection.commitment_transition_warranted ? 'yes' : 'no',
        current_candidate_override_required: projection.current_candidate_override_required ? 'yes' : 'no',
        primary_warrant_basis: basis,
        recommended_action_family: projection.revision_warranted ? projection.policy.family : 'hold',
        note: 'Public decision-time fields jointly support this deterministic test annotation.',
        divergence_by_dimension: Object.fromEntries(
          projection.divergence.map((row) => [
            row.dimension,
            {
              interpretation: row.interpretation,
              magnitude: row.magnitude,
              persistence: row.persistence === 0 ? 'none' : row.persistence === 1 ? 'single_turn' : 'sustained',
              note: `Public ${row.dimension} evidence supports this deterministic test label.`,
            },
          ]),
        ),
      };
    }),
  };
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
  const publicById = new Map(built.corpus.cases.map((row) => [row.sample_id, row]));
  const proposalCases = built.key.cases.filter((row) => row.job_id.startsWith('proposal-'));
  assert.equal(proposalCases.length, 8);
  assert.ok(
    proposalCases.every((row) => publicById.get(row.sample_id).current_learner_turn.learner.includes('answered my result request')),
  );
  const engagementPersistence = built.key.cases.filter((row) => ['persistence-05', 'persistence-06'].includes(row.job_id));
  assert.equal(engagementPersistence.length, 2);
  assert.ok(
    engagementPersistence.every(
      (row) => !publicById.get(row.sample_id).current_learner_turn.learner.includes('decide what I should do'),
    ),
  );
  assert.match(mechanismAnnotationHandbook(), /becomes `overdue` when a completed tutor turn neither answers/u);
});

test('challenge source provenance binds the builder, collection logic, and dedicated tests', () => {
  const provenance = adaptiveWarrantChallengeSourceFingerprint();
  for (const relative of [
    'config/hermetic-test-manifest.json',
    'package.json',
    'scripts/build-adaptive-warrant-challenge-corpus.js',
    'scripts/prepare-adaptive-warrant-annotation-batches.js',
    'scripts/score-adaptive-warrant-challenge-annotations.js',
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
    assert.ok(firstPacket.instructions.some((instruction) => instruction.includes('later reminder remains overdue')));
    assert.ok(firstPacket.instructions.some((instruction) => instruction.includes('direct result-request clause')));
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

test('dedicated challenge scorer validates blind readers and never emits a pass-fail gate result', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-diagnostic-score-'));
  try {
    const frozen = writeAdaptiveWarrantChallengeCorpus({
      outputDir: path.join(root, 'freeze'),
      provenance: cleanTestProvenance(),
      excludedCorpusPaths: [writeEmptyExcludedCorpus(root)],
    });
    const annotationA = annotationFromKey({
      corpus: frozen.corpus,
      key: frozen.key,
      corpusSha256: frozen.manifest.corpus.sha256,
      annotatorId: 'reader-a',
      runId: 'reader-a-independent-run',
    });
    const annotationB = annotationFromKey({
      corpus: frozen.corpus,
      key: frozen.key,
      corpusSha256: frozen.manifest.corpus.sha256,
      annotatorId: 'reader-b',
      runId: 'reader-b-independent-run',
    });
    const firstPath = path.join(root, 'reader-a.json');
    const secondPath = path.join(root, 'reader-b.json');
    fs.writeFileSync(firstPath, `${JSON.stringify(annotationA, null, 2)}\n`);
    fs.writeFileSync(secondPath, `${JSON.stringify(annotationB, null, 2)}\n`);
    const scored = scoreAdaptiveWarrantChallengeAnnotations({
      rootDir: path.dirname(frozen.manifestPath),
      annotationAPath: firstPath,
      annotationBPath: secondPath,
    });
    assert.equal(scored.artifact.schema, ADAPTIVE_WARRANT_TARGETED_CHALLENGE_SCORE_SCHEMA);
    assert.equal(scored.artifact.gate_eligible, false);
    assert.equal(scored.artifact.pass_fail_gate.status, 'not_applicable');
    assert.equal(scored.artifact.diagnostic_support.status, 'supported');
    assert.equal(scored.artifact.diagnostic_support.checks.obligation_resolution.passed, true);
    assert.equal(scored.artifact.score.metrics.totalCases, 24);
    assert.equal(scored.artifact.score.metrics.obligationPersistenceAccuracy, 1);
    assert.equal(Object.hasOwn(scored.artifact, 'decisionGate'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
